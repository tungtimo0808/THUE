import os
from datetime import date, datetime
from decimal import Decimal

from django.db import connection, transaction
from django.db.models import F, Q, Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from audit_log.services import record_audit
from general_ledger import services as gl_services
from general_ledger.models import (
    Account, AccountStatus, AccountingPeriod, JournalEntry, JournalLine,
)
from iam.models import UserAccount
from iam.permissions import has_effective_permission
from master_data.models import CompanyBankAccount, Currency, Party
from organization.models import Company
from . import models
from .services import update_payable_status


ALLOWED_ATTACHMENT_EXTENSIONS = {"pdf", "png", "jpg", "jpeg"}
MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_ATTACHMENTS_COUNT = 20


def get_user_account_by_identifier(ident):
    if not ident:
        return None
    if isinstance(ident, UserAccount):
        return ident
    ident_str = str(ident).strip()
    try:
        import uuid
        u_val = uuid.UUID(ident_str)
        acc = UserAccount.objects.filter(pk=u_val).first()
        if acc:
            return acc
    except (ValueError, AttributeError):
        pass
    if ident_str.isdigit():
        return UserAccount.objects.filter(auth_user_id=int(ident_str)).first()
    return None


def get_actor_user_account(request):
    if hasattr(request, "user"):
        u = request.user
    else:
        u = request
    if hasattr(u, "iam_account"):
        return u.iam_account
    if isinstance(u, UserAccount):
        return u
    return get_user_account_by_identifier(u)


def generate_payment_voucher_number(company, payment_method, payment_date=None, is_preview=False):
    """
    BR-AP-PAY-11..17:
    - Cash: PC-YYYY-NNNNNN
    - Bank transfer: UNC-YYYY-NNNNNN
    - YYYY is year of payment_date.
    - Locked counter per company, method, and year.
    - Reset to 000001 on Jan 1st each year.
    - Never reused.
    """
    if isinstance(payment_date, str):
        try:
            payment_date = date.fromisoformat(payment_date)
        except ValueError:
            payment_date = timezone.localdate()
    elif not isinstance(payment_date, (date, datetime)):
        payment_date = timezone.localdate()

    year = payment_date.year
    prefix = "PC-" if payment_method == models.PaymentRequestMethod.CASH else "UNC-"
    full_prefix = f"{prefix}{year}-"

    if not is_preview and connection.features.has_select_for_update:
        Company.objects.select_for_update().get(pk=company.pk)

    last = (
        models.Payment.objects.filter(company=company, number__startswith=full_prefix)
        .order_by("-number")
        .values_list("number", flat=True)
        .first()
    )

    seq = 1
    if last and len(last) > len(full_prefix):
        suffix = last[len(full_prefix):]
        if suffix.isdigit():
            seq = int(suffix) + 1

    return f"{full_prefix}{seq:06d}"


def get_eligible_payment_requests(company, supplier_id=None):
    """
    Steps 3-4, BR-AP-PAY-20:
    Find payment requests satisfying:
    - Type is DEBT_PAYMENT
    - Status in APPROVED or PARTIALLY_PAID
    - Remaining payable amount > 0
    """
    qs = models.PaymentRequest.objects.filter(
        company=company,
        request_type=models.PaymentRequestType.DEBT_PAYMENT,
        status__in=[models.PaymentRequestStatus.APPROVED, models.PaymentRequestStatus.PARTIALLY_PAID],
    ).select_related("supplier", "currency", "company_bank_account", "cash_fund", "created_by", "approver")

    if supplier_id:
        qs = qs.filter(supplier_id=supplier_id)

    results = []
    for req in qs:
        # Calculate remaining on request lines
        total_remaining = Decimal("0")
        lines = req.lines.select_related("payable").all()
        for l in lines:
            if not l.payable:
                continue
            line_paid = l.paid_amount
            line_rem = max(Decimal("0"), l.amount - line_paid)
            avail = min(line_rem, l.payable.balance)
            total_remaining += avail

        if total_remaining > Decimal("0"):
            results.append({
                "id": str(req.pk),
                "number": req.number,
                "requested_date": str(req.requested_date),
                "planned_payment_date": str(req.planned_payment_date),
                "supplier_id": str(req.supplier_id),
                "supplier_name": req.supplier.name,
                "supplier_code": req.supplier.code,
                "payment_method": req.payment_method,
                "total_requested_amount": float(req.total_amount),
                "total_paid_amount": float(req.paid_amount),
                "total_available_amount": float(total_remaining),
                "status": req.status,
                "payment_content": req.payment_content,
            })

    return {"items": results}


def get_payment_request_detail_for_payment(company, request_id):
    """
    Steps 5-8:
    Load request header & lines with remaining payable amounts.
    Default suggested amount = available_to_pay.
    """
    try:
        req = models.PaymentRequest.objects.select_related(
            "supplier", "currency", "company_bank_account", "cash_fund", "created_by", "approver"
        ).get(pk=request_id, company=company)
    except (models.PaymentRequest.DoesNotExist, ValueError):
        raise ValidationError({"payment_request": "Đề nghị thanh toán không tồn tại hoặc không thuộc doanh nghiệp."})

    if req.request_type != models.PaymentRequestType.DEBT_PAYMENT:
        raise ValidationError({"payment_request": "Đề nghị tạm ứng nhà cung cấp không được sử dụng trong nghiệp vụ này."})

    if req.status not in [models.PaymentRequestStatus.APPROVED, models.PaymentRequestStatus.PARTIALLY_PAID]:
        raise ValidationError({"payment_request": "Đề nghị thanh toán không còn ở trạng thái cho phép thanh toán. Vui lòng tải lại dữ liệu."})

    req_lines = req.lines.select_related("payable__document", "payable__invoice", "payable__currency").all()
    lines_data = []

    for l in req_lines:
        if not l.payable:
            continue
        p = l.payable
        line_paid = l.paid_amount
        line_rem = max(Decimal("0"), l.amount - line_paid)
        avail = min(line_rem, p.balance)

        if avail <= Decimal("0"):
            continue

        voucher_no = p.document.number if p.document else ""
        voucher_date = str(p.document.document_date) if p.document else ""
        inv_no = p.invoice.invoice_number if p.invoice else ""

        lines_data.append({
            "request_line_id": str(l.pk),
            "payable_id": str(p.pk),
            "voucher_number": voucher_no,
            "voucher_date": voucher_date,
            "invoice_number": inv_no,
            "due_date": str(p.due_date) if p.due_date else "",
            "requested_amount": float(l.amount),
            "paid_amount": float(line_paid),
            "remaining_on_request": float(line_rem),
            "payable_balance": float(p.balance),
            "available_to_pay": float(avail),
            "suggested_amount": float(avail),
        })

    return {
        "request": {
            "id": str(req.pk),
            "number": req.number,
            "requested_date": str(req.requested_date),
            "planned_payment_date": str(req.planned_payment_date),
            "supplier_id": str(req.supplier_id),
            "supplier_name": req.supplier.name,
            "supplier_code": req.supplier.code,
            "requester_name": req.created_by.display_name if req.created_by else "",
            "approver_name": req.approver.display_name if req.approver else "",
            "payment_method": req.payment_method,
            "cash_fund_id": str(req.cash_fund_id) if req.cash_fund_id else None,
            "cash_fund_name": req.cash_fund.name if req.cash_fund else "",
            "company_bank_account_id": str(req.company_bank_account_id) if req.company_bank_account_id else None,
            "company_bank_account_name": f"{req.company_bank_account.account_number} - {req.company_bank_account.bank.name}" if req.company_bank_account else "",
            "beneficiary_name": req.beneficiary_name,
            "beneficiary_account_number": req.beneficiary_account_number,
            "beneficiary_bank_name": req.beneficiary_bank_name,
            "payment_content": req.payment_content,
            "total_requested_amount": float(req.total_amount),
            "total_paid_amount": float(req.paid_amount),
            "status": req.status,
        },
        "lines": lines_data,
    }


def validate_payment_voucher_data(company, data, user, instance=None, action="POST"):
    """
    Validates all rules for UC-AP-04 (EX-AP-PAY-02 to EX-AP-PAY-21, BR-AP-PAY-01 to 23).
    """
    errors = {}
    today = timezone.localdate()

    # 1. Payment Date (EX-02, EX-03, EX-04)
    payment_date_raw = data.get("payment_date")
    if not payment_date_raw:
        errors["payment_date"] = ["Vui lòng nhập Ngày thanh toán."]
        payment_date = None
    else:
        try:
            payment_date = date.fromisoformat(str(payment_date_raw))
            if payment_date > today:
                errors["payment_date"] = ["Ngày thanh toán không được lớn hơn ngày hiện tại."]
        except ValueError:
            errors["payment_date"] = ["Ngày thanh toán không đúng định dạng YYYY-MM-DD."]
            payment_date = None

    # Check accounting period when POSTING (EX-04)
    if action == "POST" and payment_date and "payment_date" not in errors:
        gl_period = AccountingPeriod.objects.filter(
            company=company,
            start_date__lte=payment_date,
            end_date__gte=payment_date,
            status="OPEN",
        ).first()
        if not gl_period:
            errors["payment_date"] = ["Kỳ kế toán của ngày thanh toán đã bị khóa. Không thể ghi sổ chứng từ."]

    # 2. Supplier
    supplier_id = data.get("supplier")
    if not supplier_id:
        errors["supplier"] = ["Nhà cung cấp là bắt buộc."]
        supplier = None
    else:
        try:
            supplier = Party.objects.get(pk=supplier_id, company=company)
            if supplier.status != "ACTIVE":
                errors["supplier"] = ["Nhà cung cấp không còn hoạt động."]
        except (Party.DoesNotExist, ValueError):
            errors["supplier"] = ["Nhà cung cấp không hợp lệ."]
            supplier = None

    # 3. Payment Source
    payment_source = data.get("payment_source", models.PaymentSource.PAYMENT_REQUEST)

    # 4. Payment Content (EX-05)
    payment_content = str(data.get("payment_content", "")).strip()
    if not payment_content:
        errors["payment_content"] = ["Vui lòng nhập Nội dung thanh toán."]

    # 5. Payment Method & Method-specific validations
    payment_method = data.get("payment_method")
    if not payment_method or payment_method not in models.PaymentRequestMethod.values:
        errors["payment_method"] = ["Phương thức thanh toán là bắt buộc (CASH hoặc BANK_TRANSFER)."]

    # Source: PAYMENT_REQUEST
    payment_request = None
    if payment_source == models.PaymentSource.PAYMENT_REQUEST:
        req_id = data.get("payment_request")
        if not req_id:
            errors["payment_request"] = ["Vui lòng chọn đề nghị thanh toán."]
        else:
            try:
                payment_request = models.PaymentRequest.objects.select_related(
                    "company_bank_account", "cash_fund"
                ).get(pk=req_id, company=company)
                # BR-20
                if payment_request.request_type != models.PaymentRequestType.DEBT_PAYMENT:
                    errors["payment_request"] = ["Đề nghị tạm ứng nhà cung cấp không được sử dụng trong nghiệp vụ này."]
                # EX-15
                if payment_request.status not in [models.PaymentRequestStatus.APPROVED, models.PaymentRequestStatus.PARTIALLY_PAID]:
                    errors["payment_request"] = ["Đề nghị thanh toán không còn ở trạng thái cho phép thanh toán. Vui lòng tải lại dữ liệu."]
                # BR-19
                if supplier and payment_request.supplier_id != supplier.id:
                    errors["supplier"] = ["Nhà cung cấp không khớp với đề nghị thanh toán đã chọn."]
                # BR-21: Payment method must match request
                if payment_method and payment_method != payment_request.payment_method:
                    errors["payment_method"] = ["Phương thức thanh toán không được thay đổi so với đề nghị đã duyệt."]
            except (models.PaymentRequest.DoesNotExist, ValueError):
                errors["payment_request"] = ["Đề nghị thanh toán không tồn tại."]

    # Direct payment permission check (AF-04)
    elif payment_source == models.PaymentSource.DIRECT:
        if action == "POST" and not (user.auth_user.is_superuser or has_effective_permission(user, company, "AP.PAYMENT.POST_DIRECT")):
            raise PermissionDenied("Bạn không có quyền ghi sổ thanh toán không qua đề nghị.")

    # CASH Method validations (EX-06, EX-07)
    if payment_method == models.PaymentRequestMethod.CASH:
        cash_fund_id = data.get("cash_fund")
        if not cash_fund_id:
            errors["cash_fund"] = ["Vui lòng chọn Quỹ tiền mặt chi."]
        else:
            from cash_management.models import CashFund
            try:
                fund = CashFund.objects.get(pk=cash_fund_id, company=company)
                if fund.status != "ACTIVE":
                    errors["cash_fund"] = ["Quỹ tiền mặt không còn hoạt động."]
            except (CashFund.DoesNotExist, ValueError):
                errors["cash_fund"] = ["Quỹ tiền mặt không tồn tại."]

        recipient_name = str(data.get("recipient_name", "")).strip()
        if not recipient_name:
            errors["recipient_name"] = ["Vui lòng nhập Người nhận tiền."]

    # BANK_TRANSFER Method validations (EX-08, EX-09, EX-10, EX-11, BR-22)
    elif payment_method == models.PaymentRequestMethod.BANK_TRANSFER:
        c_bank_id = data.get("company_bank_account")
        if not c_bank_id:
            errors["company_bank_account"] = ["Đề nghị thanh toán chưa có Tài khoản ngân hàng trích tiền."]
        else:
            try:
                c_bank = CompanyBankAccount.objects.get(pk=c_bank_id, company=company)
                if c_bank.status != "ACTIVE":
                    errors["company_bank_account"] = ["Tài khoản ngân hàng chi không còn hoạt động."]
            except (CompanyBankAccount.DoesNotExist, ValueError):
                errors["company_bank_account"] = ["Tài khoản ngân hàng chi không tồn tại."]

        # Check lock from request (BR-21)
        if payment_request and payment_request.company_bank_account_id:
            if str(c_bank_id) != str(payment_request.company_bank_account_id):
                errors["company_bank_account"] = ["Không cho phép thay đổi tài khoản ngân hàng trích tiền so với đề nghị đã duyệt."]

        ben_name = str(data.get("beneficiary_name", "")).strip()
        ben_num = str(data.get("beneficiary_account_number", "")).strip()
        ben_bank = str(data.get("beneficiary_bank_name", "")).strip()

        if not ben_name or not ben_num or not ben_bank:
            errors["beneficiary"] = ["Thông tin người thụ hưởng chưa đầy đủ. Vui lòng lập lại đề nghị thanh toán."]

        bank_tx_code = str(data.get("bank_transaction_code", "")).strip()
        if not bank_tx_code:
            errors["bank_transaction_code"] = ["Vui lòng nhập Mã giao dịch ngân hàng."]
        else:
            # Check unique bank_transaction_code per company_bank_account (EX-11, BR-22)
            dup_qs = models.Payment.objects.filter(
                company_bank_account_id=c_bank_id,
                bank_transaction_code=bank_tx_code,
            ).exclude(status=models.PaymentStatus.CANCELED)
            if instance:
                dup_qs = dup_qs.exclude(pk=instance.pk)
            dup = dup_qs.first()
            if dup:
                errors["bank_transaction_code"] = [
                    f"Mã giao dịch ngân hàng đã được sử dụng cho chứng từ {dup.number}."
                ]

    # Attachments validation (EX-18, EX-19)
    attachments = data.get("attachments", [])
    if isinstance(attachments, list) and attachments:
        if len(attachments) > MAX_ATTACHMENTS_COUNT:
            errors["attachments"] = [f"Mỗi chứng từ chỉ được đính kèm tối đa {MAX_ATTACHMENTS_COUNT} tệp."]
        else:
            for att in attachments:
                if isinstance(att, dict):
                    f_name = att.get("file_name", "")
                    f_size = att.get("file_size", 0)
                    if f_name:
                        ext = f_name.rsplit(".", 1)[-1].lower() if "." in f_name else ""
                        if ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
                            errors["attachments"] = [f"Tệp {f_name} không đúng định dạng được hỗ trợ."]
                            break
                    if f_size and f_size > MAX_ATTACHMENT_BYTES:
                        errors["attachments"] = [f"Tệp {f_name} vượt quá dung lượng tối đa 10 MB."]
                        break

    # Lines validation (EX-12, EX-13, EX-14)
    lines_data = data.get("lines", [])
    valid_lines_count = 0
    total_amount = Decimal("0")

    if not lines_data or not isinstance(lines_data, list):
        errors["lines"] = ["Chứng từ phải có ít nhất một khoản thanh toán."]
    else:
        line_errors = []
        for idx, l in enumerate(lines_data):
            l_err = {}
            raw_amt = l.get("amount")
            try:
                amt = Decimal(str(raw_amt))
            except (TypeError, ValueError):
                amt = Decimal("-1")

            # EX-12: Cannot be negative
            if amt < Decimal("0"):
                l_err["amount"] = ["Số tiền thanh toán lần này không được nhỏ hơn 0."]

            # If amt == 0, omitted per AF-AP-PAY-03
            if amt == Decimal("0"):
                continue

            valid_lines_count += 1
            total_amount += amt

            p_id = l.get("payable") or l.get("payable_id")
            if not p_id:
                l_err["payable"] = ["Vui lòng chọn chứng từ công nợ."]
            else:
                try:
                    p = models.Payable.objects.get(pk=p_id, company=company)
                    if supplier and p.supplier_id != supplier.id:
                        l_err["payable"] = ["Khoản công nợ không thuộc nhà cung cấp đã chọn."]

                    # Check against available to pay on request line if by request
                    if payment_request:
                        req_line_id = l.get("payment_request_line") or l.get("payment_request_line_id")
                        req_line = payment_request.lines.filter(Q(pk=req_line_id) | Q(payable_id=p_id)).first()
                        if not req_line:
                            l_err["payment_request_line"] = ["Dòng công nợ không thuộc đề nghị thanh toán đã chọn."]
                        else:
                            line_rem = max(Decimal("0"), req_line.amount - req_line.paid_amount)
                            max_allowed = min(line_rem, p.balance)
                            if amt > max_allowed:
                                doc_no = p.document.number if p.document else str(p.pk)
                                l_err["amount"] = [
                                    f"Số tiền thanh toán của chứng từ {doc_no} vượt quá số tiền còn được thanh toán là {max_allowed:,.2f}."
                                ]
                    else:
                        if amt > p.balance:
                            doc_no = p.document.number if p.document else str(p.pk)
                            l_err["amount"] = [
                                f"Số tiền thanh toán của chứng từ {doc_no} vượt quá số tiền còn được thanh toán là {p.balance:,.2f}."
                            ]
                except (models.Payable.DoesNotExist, ValueError):
                    l_err["payable"] = ["Khoản công nợ không tồn tại."]

            if l_err:
                line_errors.append(l_err)

        if line_errors:
            errors["lines"] = line_errors
        elif valid_lines_count == 0 or total_amount <= Decimal("0"):
            # EX-14
            errors["amount"] = ["Tổng tiền thanh toán phải lớn hơn 0."]

    if errors:
        raise ValidationError(errors)

    return total_amount


@transaction.atomic
def save_payment_voucher(request, data, instance=None, action="POST"):
    """
    Handles creating, updating draft, and posting of Payment vouchers.
    Implements Steps 17-33 of Activity Flow, AF-01 (Lưu nháp), AF-02 (Thanh toán 1 phần),
    AF-03 (Bỏ dòng 0đ), AF-04 (Thanh toán trực tiếp), AF-05 (Sửa nháp).
    """
    user = get_actor_user_account(request)

    merged_data = dict(data) if data else {}
    if instance:
        if "company" not in merged_data:
            merged_data["company"] = str(instance.company_id)
        if "supplier" not in merged_data:
            merged_data["supplier"] = str(instance.supplier_id)
        if "payment_date" not in merged_data:
            merged_data["payment_date"] = str(instance.payment_date)
        if "payment_method" not in merged_data:
            merged_data["payment_method"] = instance.payment_method
        if "payment_source" not in merged_data:
            merged_data["payment_source"] = instance.payment_source
        if "payment_request" not in merged_data and instance.payment_request_id:
            merged_data["payment_request"] = str(instance.payment_request_id)
        if "payment_content" not in merged_data:
            merged_data["payment_content"] = instance.payment_content
        if "cash_fund" not in merged_data and instance.cash_fund_id:
            merged_data["cash_fund"] = str(instance.cash_fund_id)
        if "recipient_name" not in merged_data:
            merged_data["recipient_name"] = instance.recipient_name
        if "company_bank_account" not in merged_data and instance.company_bank_account_id:
            merged_data["company_bank_account"] = str(instance.company_bank_account_id)
        if "beneficiary_name" not in merged_data:
            merged_data["beneficiary_name"] = instance.beneficiary_name
        if "beneficiary_account_number" not in merged_data:
            merged_data["beneficiary_account_number"] = instance.beneficiary_account_number
        if "beneficiary_bank_name" not in merged_data:
            merged_data["beneficiary_bank_name"] = instance.beneficiary_bank_name
        if "bank_transaction_code" not in merged_data:
            merged_data["bank_transaction_code"] = instance.bank_transaction_code
        if "attachments" not in merged_data:
            merged_data["attachments"] = instance.attachments or []
        if "lines" not in merged_data:
            merged_data["lines"] = [
                {
                    "payable": str(a.payable_id),
                    "payment_request_line": str(a.payment_request_line_id) if a.payment_request_line_id else None,
                    "amount": str(a.amount),
                    "note": a.note,
                }
                for a in instance.allocations.all()
            ]
    data = merged_data

    company_id = data.get("company")
    if not company_id and hasattr(request, "query_params"):
        company_id = request.query_params.get("company_id")
    if not company_id and hasattr(request, "headers"):
        company_id = request.headers.get("X-Company-Id")
    if not company_id and instance:
        company_id = instance.company_id
    if not company_id and hasattr(request, "user") and hasattr(request.user, "iam_account"):
        mem = request.user.iam_account.memberships.first()
        if mem:
            company_id = mem.company_id
    data["company"] = company_id

    try:
        company = Company.objects.get(pk=company_id)
    except (Company.DoesNotExist, ValueError):
        raise ValidationError({"company": "Doanh nghiệp không hợp lệ."})

    # Permission check (EX-20)
    if action == "POST":
        if not (user.auth_user.is_superuser or has_effective_permission(user, company, "AP.PAYMENT.POST")):
            raise PermissionDenied("Bạn không có quyền ghi sổ chứng từ thanh toán nhà cung cấp.")
    else:
        req_perm = "AP.PAYMENT.CREATE" if instance is None else "AP.PAYMENT.EDIT"
        if not (user.auth_user.is_superuser or has_effective_permission(user, company, req_perm)):
            raise PermissionDenied("Bạn không có quyền lập hoặc chỉnh sửa chứng từ thanh toán.")

    # BR-AP-PAY-05: Cannot edit directly if already POSTED
    if instance is not None and instance.status == models.PaymentStatus.POSTED:
        raise ValidationError("Chứng từ đã ghi sổ không được sửa trực tiếp. Vui lòng hủy chứng từ và lập mới.")

    if instance is not None and instance.status == models.PaymentStatus.CANCELED:
        raise ValidationError("Chứng từ đã bị hủy không thể chỉnh sửa.")

    # Validation
    total_amount = validate_payment_voucher_data(company, data, user, instance=instance, action=action)

    payment_method = data["payment_method"]
    payment_source = data.get("payment_source", models.PaymentSource.PAYMENT_REQUEST)
    payment_date = date.fromisoformat(str(data["payment_date"]))
    lines_data = [l for l in data.get("lines", []) if Decimal(str(l.get("amount", 0))) > Decimal("0")]

    currency_id = data.get("currency")
    if currency_id:
        currency = Currency.objects.get(pk=currency_id)
    else:
        currency = company.accounting_currency

    exchange_rate = Decimal(str(data.get("exchange_rate", "1")))

    # Handle SAVE_DRAFT (AF-01)
    if action == "SAVE_DRAFT":
        if instance is None:
            number = generate_payment_voucher_number(company, payment_method, payment_date=payment_date)
        else:
            number = instance.number

        if instance is None:
            voucher = models.Payment.objects.create(
                company=company,
                branch_id=data.get("branch"),
                number=number,
                payment_source=payment_source,
                payment_request_id=data.get("payment_request"),
                supplier_id=data["supplier"],
                currency=currency,
                exchange_rate=exchange_rate,
                payment_date=payment_date,
                amount=total_amount,
                allocated_amount=total_amount,
                payment_method=payment_method,
                payment_content=data["payment_content"],
                recipient_name=data.get("recipient_name", "").strip(),
                company_bank_account_id=data.get("company_bank_account"),
                cash_fund_id=data.get("cash_fund"),
                beneficiary_name=data.get("beneficiary_name", "").strip(),
                beneficiary_account_number=data.get("beneficiary_account_number", "").strip(),
                beneficiary_bank_name=data.get("beneficiary_bank_name", "").strip(),
                bank_transaction_code=data.get("bank_transaction_code", "").strip(),
                external_type=payment_method,
                external_reference=number,
                attachments=data.get("attachments", []),
                status=models.PaymentStatus.DRAFT,
                created_by=user,
            )
        else:
            voucher = instance
            voucher.branch_id = data.get("branch", voucher.branch_id)
            voucher.payment_source = payment_source
            voucher.payment_request_id = data.get("payment_request")
            voucher.supplier_id = data["supplier"]
            voucher.currency = currency
            voucher.exchange_rate = exchange_rate
            voucher.payment_date = payment_date
            voucher.amount = total_amount
            voucher.allocated_amount = total_amount
            voucher.payment_method = payment_method
            voucher.payment_content = data["payment_content"]
            voucher.recipient_name = data.get("recipient_name", "").strip()
            voucher.company_bank_account_id = data.get("company_bank_account")
            voucher.cash_fund_id = data.get("cash_fund")
            voucher.beneficiary_name = data.get("beneficiary_name", "").strip()
            voucher.beneficiary_account_number = data.get("beneficiary_account_number", "").strip()
            voucher.beneficiary_bank_name = data.get("beneficiary_bank_name", "").strip()
            voucher.bank_transaction_code = data.get("bank_transaction_code", "").strip()
            voucher.attachments = data.get("attachments", [])
            voucher.save()
            voucher.allocations.all().delete()

        for idx, l in enumerate(lines_data, start=1):
            pr_line_id = l.get("payment_request_line") or None
            models.PaymentAllocation.objects.create(
                payment=voucher,
                payable_id=l["payable"],
                payment_request_line_id=pr_line_id,
                line_no=idx,
                amount=Decimal(str(l["amount"])),
                exchange_rate=exchange_rate,
                note=l.get("note", "").strip(),
                created_by=user,
            )

        record_audit(
            company=company,
            actor_user=user,
            module_code="AP",
            action_code="SAVE_DRAFT",
            entity=voucher,
            before={"status": "NONE" if instance is None else instance.status},
            after={"status": voucher.status, "number": voucher.number, "amount": str(voucher.amount)},
            request=request,
        )
        return voucher

    # Handle POST (Steps 17-33)
    # Step 18: Lock payment request and payables
    pr_obj = None
    if payment_source == models.PaymentSource.PAYMENT_REQUEST and data.get("payment_request"):
        pr_qs = models.PaymentRequest.objects
        if connection.features.has_select_for_update:
            pr_qs = pr_qs.select_for_update()
        pr_obj = pr_qs.get(pk=data["payment_request"])

        # EX-15: Check request still in approved state
        if pr_obj.status not in [models.PaymentRequestStatus.APPROVED, models.PaymentRequestStatus.PARTIALLY_PAID]:
            raise ValidationError({"payment_request": "Đề nghị thanh toán không còn ở trạng thái cho phép thanh toán. Vui lòng tải lại dữ liệu."})

    payable_ids = [l["payable"] for l in lines_data]
    p_qs = models.Payable.objects.filter(id__in=payable_ids).select_related("document", "document__payable_account")
    if connection.features.has_select_for_update:
        p_qs = p_qs.select_for_update()
    locked_payables = {str(p.pk): p for p in p_qs}

    # Step 19, 20: Recalculate remaining under lock
    req_lines_map = {}
    if pr_obj:
        rl_qs = pr_obj.lines.all()
        if connection.features.has_select_for_update:
            rl_qs = rl_qs.select_for_update()
        req_lines_map = {str(rl.pk): rl for rl in rl_qs}

    for l in lines_data:
        p_id = str(l["payable"])
        p = locked_payables.get(p_id)
        if not p:
            raise ValidationError("Khoản công nợ không tồn tại hoặc đã bị xóa.")

        line_amt = Decimal(str(l["amount"]))
        if pr_obj:
            rl_id = str(l.get("payment_request_line") or "")
            rl = req_lines_map.get(rl_id) or pr_obj.lines.filter(payable=p).first()
            if not rl:
                raise ValidationError("Dòng công nợ không thuộc đề nghị thanh toán đã chọn.")
            line_rem = max(Decimal("0"), rl.amount - rl.paid_amount)
            avail = min(line_rem, p.balance)
            # EX-13, EX-17
            if line_amt > avail:
                raise ValidationError("Số tiền còn được thanh toán đã thay đổi. Vui lòng tải lại chứng từ.")
        else:
            if line_amt > p.balance:
                raise ValidationError("Số tiền còn được thanh toán đã thay đổi. Vui lòng tải lại chứng từ.")

    # Step 23: Balance check if enabled
    if payment_method == models.PaymentRequestMethod.CASH and data.get("cash_fund"):
        from cash_management.models import CashFund
        fund_qs = CashFund.objects.filter(pk=data["cash_fund"])
        if connection.features.has_select_for_update:
            fund_qs = fund_qs.select_for_update()
        fund = fund_qs.first()
        if fund and getattr(fund, "balance_control", False) and fund.balance < total_amount:
            raise ValidationError({"balance": f"Số dư khả dụng của quỹ {fund.name} không đủ để thực hiện thanh toán."})

    # Step 24, 25: Number generation
    if instance is None:
        number = generate_payment_voucher_number(company, payment_method, payment_date=payment_date)
    else:
        number = instance.number

    now = timezone.now()

    # Step 26: Create or update Payment
    if instance is None:
        voucher = models.Payment.objects.create(
            company=company,
            branch_id=data.get("branch"),
            number=number,
            payment_source=payment_source,
            payment_request=pr_obj,
            supplier_id=data["supplier"],
            currency=currency,
            exchange_rate=exchange_rate,
            payment_date=payment_date,
            amount=total_amount,
            allocated_amount=total_amount,
            payment_method=payment_method,
            payment_content=data["payment_content"],
            recipient_name=data.get("recipient_name", "").strip(),
            company_bank_account_id=data.get("company_bank_account"),
            cash_fund_id=data.get("cash_fund"),
            beneficiary_name=data.get("beneficiary_name", "").strip(),
            beneficiary_account_number=data.get("beneficiary_account_number", "").strip(),
            beneficiary_bank_name=data.get("beneficiary_bank_name", "").strip(),
            bank_transaction_code=data.get("bank_transaction_code", "").strip(),
            external_type=payment_method,
            external_reference=number,
            attachments=data.get("attachments", []),
            status=models.PaymentStatus.POSTED,
            posted_at=now,
            posted_by=user,
            created_by=user,
        )
    else:
        voucher = instance
        voucher.branch_id = data.get("branch", voucher.branch_id)
        voucher.payment_source = payment_source
        voucher.payment_request = pr_obj
        voucher.supplier_id = data["supplier"]
        voucher.currency = currency
        voucher.exchange_rate = exchange_rate
        voucher.payment_date = payment_date
        voucher.amount = total_amount
        voucher.allocated_amount = total_amount
        voucher.payment_method = payment_method
        voucher.payment_content = data["payment_content"]
        voucher.recipient_name = data.get("recipient_name", "").strip()
        voucher.company_bank_account_id = data.get("company_bank_account")
        voucher.cash_fund_id = data.get("cash_fund")
        voucher.beneficiary_name = data.get("beneficiary_name", "").strip()
        voucher.beneficiary_account_number = data.get("beneficiary_account_number", "").strip()
        voucher.beneficiary_bank_name = data.get("beneficiary_bank_name", "").strip()
        voucher.bank_transaction_code = data.get("bank_transaction_code", "").strip()
        voucher.attachments = data.get("attachments", [])
        voucher.status = models.PaymentStatus.POSTED
        voucher.posted_at = now
        voucher.posted_by = user
        voucher.save()
        voucher.allocations.all().delete()

    # Create allocations
    for idx, l in enumerate(lines_data, start=1):
        p_id = l["payable"]
        rl_id = l.get("payment_request_line") or None
        models.PaymentAllocation.objects.create(
            payment=voucher,
            payable_id=p_id,
            payment_request_line_id=rl_id,
            line_no=idx,
            amount=Decimal(str(l["amount"])),
            exchange_rate=exchange_rate,
            note=l.get("note", "").strip(),
            created_by=user,
        )

    # Step 27: GL Journal Entry
    # Debit 331 (Supplier payable), Credit 1111 (Cash) / 1121 (Bank deposit)
    gl_period = AccountingPeriod.objects.filter(
        company=company,
        start_date__lte=payment_date,
        end_date__gte=payment_date,
        status="OPEN",
    ).first()
    if not gl_period:
        raise ValidationError({"payment_date": "Kỳ kế toán của ngày thanh toán đã bị khóa. Không thể ghi sổ chứng từ."})
    period = gl_period
    gl_num = f"{number}-GL"

    # Credit account determination
    if payment_method == models.PaymentRequestMethod.CASH:
        credit_acc = None
        if voucher.cash_fund and voucher.cash_fund.gl_account:
            credit_acc = voucher.cash_fund.gl_account
        if not credit_acc:
            credit_acc = Account.objects.filter(
                company=company, code__in=["1111", "111"], status=AccountStatus.ACTIVE
            ).first()
    else:
        credit_acc = None
        if voucher.company_bank_account and voucher.company_bank_account.gl_account:
            credit_acc = voucher.company_bank_account.gl_account
        if not credit_acc:
            credit_acc = Account.objects.filter(
                company=company, code__in=["1121", "112"], status=AccountStatus.ACTIVE
            ).first()

    if not credit_acc:
        raise ValidationError({"account": "Tài khoản kế toán thanh toán (Có 1111/1121) chưa được cấu hình hoặc không hoạt động."})

    default_ap_acc = Account.objects.filter(
        company=company, code__in=["331", "3311"], status=AccountStatus.ACTIVE
    ).first()

    journal = JournalEntry.objects.create(
        company=company,
        branch=voucher.branch,
        period=period,
        number=gl_num,
        entry_type="SUBLEDGER",
        posting_date=payment_date,
        document_date=payment_date,
        description=voucher.payment_content or f"Thanh toán công nợ nhà cung cấp {voucher.number}",
        source_module="AP",
        source_event_id=f"AP.PAYMENT:{voucher.pk}",
        source_entity_type="Payment",
        source_entity_id=voucher.pk,
        status="APPROVED",
        total_debit=total_amount,
        total_credit=total_amount,
        workflow_snapshot={"allow_creator_posting": True},
        created_by=user,
        approved_by=user,
        approved_at=now,
    )

    # Debit lines per payable
    line_no = 0
    for l in lines_data:
        line_no += 1
        p = locked_payables[str(l["payable"])]
        l_amt = Decimal(str(l["amount"]))
        debit_acc = getattr(p, "payable_account", None) or (p.document.payable_account if p.document and hasattr(p.document, "payable_account") else None) or default_ap_acc
        if not debit_acc:
            raise ValidationError({"account": "Tài khoản công nợ phải trả (Nợ 331) không hợp lệ."})

        JournalLine.objects.create(
            entry=journal,
            line_no=line_no,
            account=debit_acc,
            debit=l_amt,
            credit=Decimal("0"),
            currency=currency,
            party=voucher.supplier,
            description=voucher.payment_content,
        )

    # Credit line
    line_no += 1
    JournalLine.objects.create(
        entry=journal,
        line_no=line_no,
        account=credit_acc,
        debit=Decimal("0"),
        credit=total_amount,
        currency=currency,
        party=voucher.supplier,
        description=voucher.payment_content,
        dimensions={
            "cash_fund_id": str(voucher.cash_fund_id) if voucher.cash_fund_id else "",
            "bank_account_id": str(voucher.company_bank_account_id) if voucher.company_bank_account_id else "",
            "company_bank_account_id": str(voucher.company_bank_account_id) if voucher.company_bank_account_id else "",
        },
    )

    gl_services.post(journal, request)
    voucher.journal_entry = journal
    voucher.save(update_fields=("journal_entry", "updated_at"))

    # Step 28: Reduce debt on Payables
    for l in lines_data:
        p = locked_payables[str(l["payable"])]
        l_amt = Decimal(str(l["amount"]))
        p.paid_amount += l_amt
        p.balance -= l_amt
        update_payable_status(p)

    # Step 29, 30: Update PaymentRequest & lines
    if pr_obj:
        for l in lines_data:
            rl_id = str(l.get("payment_request_line") or "")
            rl = req_lines_map.get(rl_id) or pr_obj.lines.filter(payable_id=l["payable"]).first()
            if rl:
                rl.paid_amount += Decimal(str(l["amount"]))
                rl.save(update_fields=("paid_amount",))

        pr_obj.paid_amount += total_amount
        # Check total remaining unpaid amount
        total_unpaid = Decimal("0")
        for rl in pr_obj.lines.all():
            total_unpaid += max(Decimal("0"), rl.amount - rl.paid_amount)

        if total_unpaid <= Decimal("0"):
            pr_obj.status = models.PaymentRequestStatus.PAID
        else:
            pr_obj.status = models.PaymentRequestStatus.PARTIALLY_PAID
        pr_obj.save(update_fields=("paid_amount", "status", "updated_at"))

    # Step 31: Update Cash / Bank subledgers
    if payment_method == models.PaymentRequestMethod.CASH and voucher.cash_fund:
        from cash_management.models import CashFund, CashTransaction
        fund = CashFund.objects.select_for_update().get(pk=voucher.cash_fund_id)
        fund.balance -= total_amount
        fund.save(update_fields=("balance", "updated_at"))

        CashTransaction.objects.create(
            company=company,
            fund=fund,
            number=voucher.number,
            transaction_type="PAYMENT",
            business_type="AP_SUPPLIER_PAYMENT",
            transaction_date=payment_date,
            party=voucher.supplier,
            payer_payee=voucher.recipient_name or voucher.supplier.name,
            currency=voucher.currency,
            amount=total_amount,
            exchange_rate=exchange_rate,
            base_amount=total_amount * exchange_rate,
            description=voucher.payment_content,
            status="POSTED",
            approval_required=False,
            balance_applied=True,
            gl_status="POSTED",
            source_module="AP",
            source_reference=str(voucher.pk),
            created_by=user,
            cashier=user,
            posted_at=now,
        )
    elif payment_method == models.PaymentRequestMethod.BANK_TRANSFER and voucher.company_bank_account:
        from bank_management.models import AccountProfile, BankTransaction
        profile = AccountProfile.objects.filter(account_id=voucher.company_bank_account_id).first()
        if profile:
            profile = AccountProfile.objects.select_for_update().get(pk=profile.pk)
            profile.balance -= total_amount
            profile.save(update_fields=("balance", "updated_at"))

            BankTransaction.objects.create(
                company=company,
                account=profile,
                number=voucher.number,
                transaction_type="PAYMENT",
                business_type="AP_SUPPLIER_PAYMENT",
                transaction_date=payment_date,
                value_date=payment_date,
                party=voucher.supplier,
                counterparty_name=voucher.beneficiary_name or voucher.supplier.name,
                currency=voucher.currency,
                amount=total_amount,
                exchange_rate=exchange_rate,
                base_amount=total_amount * exchange_rate,
                description=voucher.payment_content,
                bank_reference=voucher.bank_transaction_code,
                status="POSTED",
                approval_required=False,
                balance_applied=True,
                gl_status="POSTED",
                source_module="AP",
                source_reference=str(voucher.pk),
                created_by=user,
                posted_at=now,
            )

    # Step 32: Audit Log
    record_audit(
        company=company,
        actor_user=user,
        module_code="AP",
        action_code="POST",
        entity=voucher,
        before={"status": "NONE" if instance is None else instance.status},
        after={"status": voucher.status, "number": voucher.number, "amount": str(voucher.amount)},
        request=request,
    )

    return voucher


@transaction.atomic
def cancel_payment_voucher(request, obj, reason=""):
    """
    Cancels payment voucher.
    - If DRAFT (AF-06): transitions to CANCELED, no GL, no debt rollback.
    - If POSTED (AF-07):
      - Checks permission AP.PAYMENT.CANCEL_POSTED.
      - Requires cancellation reason.
      - Creates reversing GL entry (bút toán đảo).
      - Restores debt on Payables (balance += amt, paid_amount -= amt).
      - Restores paid_amount on PaymentRequest & updates status.
      - Reverses cash/bank ledger transactions.
      - Transitions status to CANCELED.
      - Number is NEVER reused (BR-AP-PAY-16).
    """
    user = get_actor_user_account(request)
    reason = str(reason).strip()

    p_qs = models.Payment.objects
    if connection.features.has_select_for_update:
        p_qs = p_qs.select_for_update()
    obj = p_qs.get(pk=obj.pk)

    if obj.status == models.PaymentStatus.CANCELED:
        raise ValidationError("Chứng từ thanh toán đã bị hủy trước đó.")

    if models.PaymentAllocationVoucher.objects.filter(
        payment=obj, status=models.AllocationStatus.ALLOCATED
    ).exists():
        raise ValidationError({"payment": "Cần đảo các phiếu phân bổ trước khi hủy chứng từ thanh toán."})

    # AF-06: Cancel DRAFT
    if obj.status == models.PaymentStatus.DRAFT:
        before = obj.status
        obj.status = models.PaymentStatus.CANCELED
        obj.canceled_at = timezone.now()
        obj.canceled_by = user
        obj.cancellation_reason = reason
        obj.save(update_fields=("status", "canceled_at", "canceled_by", "cancellation_reason", "updated_at"))

        record_audit(
            company=obj.company,
            actor_user=user,
            module_code="AP",
            action_code="CANCEL_DRAFT",
            entity=obj,
            before={"status": before},
            after={"status": obj.status},
            reason=reason,
            request=request,
        )
        return obj

    # AF-07: Cancel POSTED
    if not (user.auth_user.is_superuser or has_effective_permission(user, obj.company, "AP.PAYMENT.CANCEL_POSTED")):
        raise PermissionDenied("Bạn không có quyền hủy chứng từ thanh toán đã ghi sổ.")

    if not reason:
        raise ValidationError({"reason": "Vui lòng nhập lý do hủy chứng từ thanh toán."})

    now = timezone.now()
    today_date = timezone.localdate()
    gl_period = AccountingPeriod.objects.filter(
        company=obj.company,
        start_date__lte=today_date,
        end_date__gte=today_date,
        status="OPEN",
    ).first()
    if not gl_period:
        raise ValidationError({"period": "Kỳ kế toán hiện tại đã bị khóa. Không thể ghi sổ bút toán đảo."})
    period = gl_period

    # 1. Reverse GL Entry
    if obj.journal_entry:
        entry = obj.journal_entry
        reversal = JournalEntry.objects.create(
            company=entry.company,
            branch=entry.branch,
            period=period,
            number=f"REV-{entry.number}",
            entry_type="REVERSAL",
            posting_date=timezone.localdate(),
            document_date=timezone.localdate(),
            description=f"Đảo {entry.number}: {reason}",
            source_module="AP",
            source_event_id=f"AP.PAYMENT.CANCEL:{obj.pk}",
            source_entity_type="Payment",
            source_entity_id=obj.pk,
            original_entry=entry,
            status="APPROVED",
            total_debit=entry.total_credit,
            total_credit=entry.total_debit,
            created_by=user,
            approved_by=user,
            approved_at=now,
            workflow_snapshot={"allow_creator_posting": True, "reversal": True},
        )
        for line in entry.lines.all():
            JournalLine.objects.create(
                entry=reversal,
                line_no=line.line_no,
                account=line.account,
                description=line.description,
                debit=line.credit,
                credit=line.debit,
                currency=line.currency,
                foreign_amount=line.foreign_amount,
                exchange_rate=line.exchange_rate,
                party=line.party,
                department=line.department,
                project=line.project,
                cost_center=line.cost_center,
                warehouse=line.warehouse,
                dimensions=line.dimensions,
            )
        gl_services.post(reversal, request)
        entry.status = "REVERSED"
        entry.save(update_fields=("status", "updated_at"))
        obj.reversal_journal_entry = reversal

    # 2. Restore debt on Payables
    allocations = obj.allocations.select_related("payable").all()
    for alloc in allocations:
        p = alloc.payable
        p = models.Payable.objects.select_for_update().get(pk=p.pk) if connection.features.has_select_for_update else p
        p.paid_amount = max(Decimal("0"), p.paid_amount - alloc.amount)
        p.balance += alloc.amount
        update_payable_status(p)

    # 3. Restore Payment Request
    if obj.payment_request:
        pr = models.PaymentRequest.objects.select_for_update().get(pk=obj.payment_request_id) if connection.features.has_select_for_update else obj.payment_request
        for alloc in allocations:
            if alloc.payment_request_line:
                rl = alloc.payment_request_line
                rl = models.PaymentRequestLine.objects.select_for_update().get(pk=rl.pk) if connection.features.has_select_for_update else rl
                rl.paid_amount = max(Decimal("0"), rl.paid_amount - alloc.amount)
                rl.save(update_fields=("paid_amount",))

        pr.paid_amount = max(Decimal("0"), pr.paid_amount - obj.amount)
        if pr.paid_amount <= Decimal("0"):
            pr.status = models.PaymentRequestStatus.APPROVED
        else:
            pr.status = models.PaymentRequestStatus.PARTIALLY_PAID
        pr.save(update_fields=("paid_amount", "status", "updated_at"))

    # 4. Reverse Cash / Bank subledger
    if obj.payment_method == models.PaymentRequestMethod.CASH and obj.cash_fund_id:
        from cash_management.models import CashFund, CashTransaction
        fund = CashFund.objects.filter(pk=obj.cash_fund_id).first()
        if fund:
            fund = CashFund.objects.select_for_update().get(pk=fund.pk) if connection.features.has_select_for_update else fund
            fund.balance += obj.amount
            fund.save(update_fields=("balance", "updated_at"))
        CashTransaction.objects.filter(source_module="AP", source_reference=str(obj.pk)).update(status="CANCELLED")

    elif obj.payment_method == models.PaymentRequestMethod.BANK_TRANSFER and obj.company_bank_account_id:
        from bank_management.models import AccountProfile, BankTransaction
        profile = AccountProfile.objects.filter(account_id=obj.company_bank_account_id).first()
        if profile:
            profile = AccountProfile.objects.select_for_update().get(pk=profile.pk) if connection.features.has_select_for_update else profile
            profile.balance += obj.amount
            profile.save(update_fields=("balance", "updated_at"))
        BankTransaction.objects.filter(source_module="AP", source_reference=str(obj.pk)).update(status="CANCELLED")

    # 5. Set status CANCELED
    before = obj.status
    obj.status = models.PaymentStatus.CANCELED
    obj.canceled_at = now
    obj.canceled_by = user
    obj.cancellation_reason = reason
    obj.save(update_fields=("status", "canceled_at", "canceled_by", "cancellation_reason", "reversal_journal_entry", "updated_at"))

    record_audit(
        company=obj.company,
        actor_user=user,
        module_code="AP",
        action_code="CANCEL_POSTED",
        entity=obj,
        before={"status": before},
        after={"status": obj.status},
        reason=reason,
        request=request,
    )

    return obj
