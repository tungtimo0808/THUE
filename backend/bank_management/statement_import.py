"""Preview and atomically import bank statement rows without creating accounting vouchers."""

from decimal import Decimal, InvalidOperation
from hashlib import sha256
from uuid import uuid4
from zipfile import BadZipFile

from django.db import transaction
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError

from . import models


MAX_FILE_SIZE = 20 * 1024 * 1024


def _money(value):
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None
    if not result.is_finite() or result <= 0 or result.as_tuple().exponent < -4 or result.adjusted() > 15:
        return None
    return result


def _optional_money(value):
    if value in (None, ""):
        return None
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError({"balance": "Số dư sao kê không hợp lệ."})
    if not result.is_finite():
        raise ValidationError({"balance": "Số dư sao kê không hợp lệ."})
    return result


def _account(payload, company_id, branch_id=None):
    account = models.AccountProfile.objects.select_related(
        "account__currency", "account__bank", "account__branch"
    ).filter(pk=payload.get("account"), company_id=company_id, account__status="ACTIVE").first()
    if not account:
        raise ValidationError({"account": "Tài khoản ngân hàng không thuộc doanh nghiệp hoặc không hoạt động."})
    if branch_id and str(account.account.branch_id) != str(branch_id):
        raise ValidationError({"branch_id": "Chi nhánh không quản lý tài khoản ngân hàng đã chọn."})
    if str(payload.get("currency")) not in (str(account.account.currency_id), account.account.currency.code):
        raise ValidationError({"currency": "Loại tiền sao kê không khớp tài khoản ngân hàng."})
    return account


def preview(payload, company_id, branch_id=None):
    account = _account(payload, company_id, branch_id)
    start, end = parse_date(str(payload.get("period_from") or "")), parse_date(str(payload.get("period_to") or ""))
    if not start or not end or end < start:
        raise ValidationError({"period_to": "Khoảng ngày sao kê không hợp lệ."})
    rows = payload.get("rows")
    if not isinstance(rows, list) or not rows or len(rows) > 20000:
        raise ValidationError({"rows": "Tệp phải có từ 1 đến 20.000 dòng giao dịch để kiểm tra."})
    if not str(payload.get("sheet_name") or "").strip() or not isinstance(payload.get("column_mapping"), dict):
        raise ValidationError({"column_mapping": "Thiếu trang tính hoặc cấu hình ghép cột."})
    unique_reference = bool(payload.get("unique_reference"))
    existing = models.StatementLine.objects.filter(statement__account=account).select_related("statement")
    existing_by_reference = {line.reference: line for line in existing if line.reference} if unique_reference else {}
    existing_fingerprints = {}
    for line in existing:
        key = (line.transaction_date, line.direction, line.amount, line.description.strip().casefold())
        existing_fingerprints.setdefault(key, line)
    seen_references, seen_fingerprints, source_rows = set(), {}, set()
    results = []
    receipts = payments = Decimal("0")
    for raw in rows:
        if not isinstance(raw, dict):
            raise ValidationError({"rows": "Dữ liệu dòng sao kê không hợp lệ."})
        try:
            source_row = int(raw.get("source_row"))
        except (ValueError, TypeError):
            source_row = 0
        date = parse_date(str(raw.get("transaction_date") or ""))
        value_date = parse_date(str(raw.get("value_date") or "")) if raw.get("value_date") else None
        direction = str(raw.get("direction") or "").upper()
        amount = _money(raw.get("amount"))
        description = str(raw.get("description") or "").strip()
        reference = str(raw.get("reference") or "").strip()
        reason = ""
        status = "VALID"
        matched = None
        if source_row <= 0 or source_row in source_rows:
            reason = "Số dòng nguồn không hợp lệ hoặc bị lặp."
        elif not date or not start <= date <= end:
            reason = "Ngày giao dịch không hợp lệ hoặc ngoài khoảng sao kê."
        elif raw.get("value_date") and not value_date:
            reason = "Ngày giá trị không hợp lệ."
        elif not description:
            reason = "Thiếu nội dung giao dịch."
        elif len(description) > 1000 or len(reference) > 150 or len(str(raw.get("counterparty") or "")) > 255:
            reason = "Nội dung, mã giao dịch hoặc tên đối tác vượt độ dài cho phép."
        elif direction not in ("CREDIT", "DEBIT"):
            reason = "Chiều giao dịch phải là Thu hoặc Chi."
        elif amount is None:
            reason = "Số tiền giao dịch phải lớn hơn 0."
        elif raw.get("source_account") and str(raw["source_account"]).strip() != account.account.account_number:
            reason = "Số tài khoản trong tệp không khớp tài khoản đã chọn."
        elif raw.get("source_currency") and str(raw["source_currency"]).strip().upper() != account.account.currency.code:
            reason = "Loại tiền trong tệp không khớp tài khoản đã chọn."
        if reason:
            status = "ERROR"
        elif unique_reference and reference and (reference in seen_references or reference in existing_by_reference):
            status, reason = "DUPLICATE", "Mã giao dịch duy nhất đã có trong tệp hoặc hệ thống."
            matched = existing_by_reference.get(reference)
        else:
            key = (date, direction, amount, description.casefold())
            matched = None if unique_reference and reference else seen_fingerprints.get(key) or existing_fingerprints.get(key)
            if matched:
                status, reason = "SUSPECT", "Ngày, chiều, số tiền và nội dung giống giao dịch khác; cần xác nhận."
            if unique_reference and reference:
                seen_references.add(reference)
            seen_fingerprints[key] = raw
        source_rows.add(source_row)
        if status in ("VALID", "SUSPECT"):
            if direction == "CREDIT":
                receipts += amount
            else:
                payments += amount
        results.append({"source_row": source_row, "status": status, "reason": reason,
            "transaction_date": str(date) if date else "", "direction": direction,
            "amount": str(amount) if amount is not None else "", "description": description,
            "reference": reference, "existing": ({"number": matched.statement.source_reference,
            "transaction_date": str(matched.transaction_date), "direction": matched.direction,
            "amount": str(matched.amount), "description": matched.description} if isinstance(matched, models.StatementLine) else None)})
    opening = _optional_money(payload.get("opening_balance"))
    closing = _optional_money(payload.get("closing_balance"))
    calculated = opening + receipts - payments if opening is not None else None
    return {"account": str(account.pk), "currency": account.account.currency.code,
        "rows": results, "total_receipts": str(receipts), "total_payments": str(payments),
        "opening_balance": str(opening) if opening is not None else None,
        "closing_balance": str(closing) if closing is not None else None,
        "calculated_closing": str(calculated) if calculated is not None else None,
        "balance_difference": str(closing - calculated) if closing is not None and calculated is not None else None,
        "counts": {status: sum(row["status"] == status for row in results) for status in ("VALID", "ERROR", "DUPLICATE", "SUSPECT")}}


@transaction.atomic
def confirm(payload, source_file, company, actor_user, request):
    if not source_file or not source_file.name.lower().endswith((".xlsx", ".xls")) or source_file.size > MAX_FILE_SIZE or source_file.size == 0:
        raise ValidationError({"source_file": "Chỉ nhận tệp .xlsx hoặc .xls, tối đa 20 MB."})
    signature = source_file.read(8)
    source_file.seek(0)
    if source_file.name.lower().endswith(".xlsx") and not signature.startswith(b"PK") or source_file.name.lower().endswith(".xls") and signature != bytes.fromhex("D0CF11E0A1B11AE1"):
        raise ValidationError({"source_file": "Tệp Excel không đọc được hoặc không đúng định dạng."})
    if source_file.name.lower().endswith(".xlsx"):
        try:
            from openpyxl import load_workbook
            workbook = load_workbook(source_file, read_only=True, data_only=True)
            if payload.get("sheet_name") not in workbook.sheetnames:
                raise ValidationError({"sheet_name": "Trang tính không tồn tại trong tệp."})
            workbook.close()
        except (BadZipFile, OSError, ValueError, KeyError):
            raise ValidationError({"source_file": "Tệp Excel bị hỏng hoặc được bảo vệ bằng mật khẩu."})
        finally:
            source_file.seek(0)
    account = _account(payload, company.pk, request.query_params.get("branch_id"))
    models.AccountProfile.objects.select_for_update().get(pk=account.pk)
    result = preview(payload, company.pk, request.query_params.get("branch_id"))
    if not isinstance(payload.get("selected_rows"), list) or not isinstance(payload.get("confirmed_suspects", []), list):
        raise ValidationError({"selected_rows": "Danh sách dòng import không hợp lệ."})
    try:
        selected = {int(value) for value in payload.get("selected_rows", [])}
        confirmed = {int(value) for value in payload.get("confirmed_suspects", [])}
    except (ValueError,TypeError):
        raise ValidationError({"selected_rows": "Danh sách dòng import không hợp lệ."})
    row_by_number = {row["source_row"]: row for row in result["rows"]}
    if not selected or len(selected) > len(row_by_number) or not selected.issubset(row_by_number):
        raise ValidationError({"selected_rows": "Chưa chọn dòng giao dịch hợp lệ để nhập."})
    for number in selected:
        status = row_by_number[number]["status"]
        if status not in ("VALID", "SUSPECT") or status == "SUSPECT" and number not in confirmed:
            raise ValidationError({"selected_rows": f"Dòng {number} có lỗi, trùng hoặc chưa xác nhận nghi trùng; hãy kiểm tra lại."})
    if result["balance_difference"] not in (None, "0", "0.0000") and not payload.get("confirm_balance_warning"):
        raise ValidationError({"balance": "Số dư cuối sao kê không khớp; cần xác nhận cảnh báo."})
    file_hash = sha256()
    for chunk in source_file.chunks():
        file_hash.update(chunk)
    source_file.seek(0)
    import_key = sha256(f"{file_hash.hexdigest()}:{payload['sheet_name']}:{','.join(map(str, sorted(selected)))}".encode()).hexdigest()
    if models.StatementImport.objects.filter(account=account, raw_file__import_key=import_key).exists():
        raise ValidationError({"source_file": "Các dòng đã chọn của tệp này đã được import trước đó."})
    from .services import audit
    statement = models.StatementImport.objects.create(company=company, account=account, source="FILE",
        source_reference=f"IMP-{uuid4().hex[:12].upper()}", period_from=payload["period_from"],period_to=payload["period_to"],
        source_file=source_file, created_by=actor_user,
        raw_file={"file_name": source_file.name, "file_size": source_file.size,
            "sheet_name": payload["sheet_name"], "header_row": payload.get("header_row"),
            "first_data_row": payload.get("first_data_row"), "date_format": payload.get("date_format"),
            "number_format": payload.get("number_format"), "column_mapping": payload["column_mapping"],
            "opening_balance": result["opening_balance"], "closing_balance": result["closing_balance"],
            "balance_difference": result["balance_difference"], "confirmed_suspects": sorted(confirmed & selected),
            "active_total_receipts": str(sum(Decimal(str(row["amount"])) for row in payload["rows"] if int(row["source_row"]) in selected and row["direction"] == "CREDIT")),
            "active_total_payments": str(sum(Decimal(str(row["amount"])) for row in payload["rows"] if int(row["source_row"]) in selected and row["direction"] == "DEBIT")),
            "active_line_count": len(selected),
            "import_key": import_key})
    for raw in payload["rows"]:
        source_row = int(raw["source_row"])
        if source_row not in selected:
            continue
        models.StatementLine.objects.create(statement=statement,external_id=f"line-{source_row}",
            transaction_date=raw["transaction_date"],value_date=raw.get("value_date") or None,
            direction=raw["direction"],amount=raw["amount"],currency=account.account.currency,
            reference=str(raw.get("reference") or ""),description=raw["description"],
            counterparty=str(raw.get("counterparty") or ""),raw_data={"source_row": source_row,
                "source": raw.get("raw") or {}, "counterparty_account": str(raw.get("counterparty_account") or ""),
                "ending_balance": raw.get("ending_balance"), "confirmed_suspect": source_row in confirmed})
    audit(request,statement,"IMPORT",after={"lines":len(selected),"source_reference":statement.source_reference})
    return statement
