from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from approval_workflows.submission import configured_snapshot
from iam.permissions import has_effective_permission
from master_data.models import Currency, Item, Party, PaymentTerm, TaxRate, UnitOfMeasure
from organization.models import Branch, Department
from . import models
from .services import actor_for, audit

MONEY = Decimal("0.0001")


def number_for_contract(company, document_date=None, year=None):
    """
    Generate unique purchase contract number (BR02, BR03, BR04, BR05).
    Format: HDMH-{YYYY}-{5 digits sequence}, e.g. HDMH-2026-00001.
    Starts from 00001 per year and company.
    """
    if not year:
        if isinstance(document_date, str):
            try:
                document_date = date.fromisoformat(document_date)
            except ValueError:
                pass
        if isinstance(document_date, (date, datetime)):
            year = document_date.year
        else:
            year = timezone.now().year

    prefix = f"HDMH-{year}-"
    existing_numbers = models.PurchaseContract.objects.filter(
        company=company,
        number__startswith=prefix,
    ).values_list("number", flat=True)

    max_seq = 0
    for num in existing_numbers:
        suffix = num[len(prefix):]
        if suffix.isdigit():
            seq = int(suffix)
            if seq > max_seq:
                max_seq = seq

    new_seq = max_seq + 1
    return f"{prefix}{new_seq:05d}"


def check_and_update_contract_expiration(contract):
    """
    Update contract status to EXPIRED if past end_date and not completed/cancelled (BR20).
    """
    today = timezone.now().date()
    if contract.end_date and today > contract.end_date:
        if contract.status in (models.DocumentStatus.APPROVED, models.DocumentStatus.IN_PROGRESS):
            contract.status = models.DocumentStatus.EXPIRED
            contract.save(update_fields=("status", "updated_at"))
    return contract.status


def validate_contract_header(data, company, current_contract=None):
    """
    Validate contract header fields according to business rules (BR06, BR10, BR11, EX01-EX03, EX09).
    """
    errors = {}

    # BR06, EX01: Tên hợp đồng bắt buộc
    title = (data.get("title") or "").strip()
    if not title:
        errors["title"] = "Vui lòng nhập đầy đủ thông tin bắt buộc."

    # BR06, EX01: Nhà cung cấp bắt buộc
    supplier_val = data.get("supplier") or data.get("supplier_id")
    supplier = None
    if not supplier_val:
        errors["supplier"] = "Vui lòng nhập đầy đủ thông tin bắt buộc."
    else:
        supplier_id = getattr(supplier_val, "pk", supplier_val)
        supplier = Party.objects.filter(pk=supplier_id, company=company).first()
        if not supplier:
            errors["supplier"] = "Nhà cung cấp không tồn tại."
        elif supplier.status != "ACTIVE":
            # EX03: Nhà cung cấp đã ngừng hoạt động
            errors["supplier"] = "Nhà cung cấp đã ngừng hoạt động. Vui lòng chọn nhà cung cấp đang hoạt động."

    # BR06, EX01: Ngày ký bắt buộc
    signed_date_raw = data.get("signed_date")
    signed_date = None
    if not signed_date_raw:
        errors["signed_date"] = "Vui lòng nhập đầy đủ thông tin bắt buộc."
    else:
        if isinstance(signed_date_raw, str):
            try:
                signed_date = date.fromisoformat(signed_date_raw)
            except ValueError:
                errors["signed_date"] = "Ngày ký không đúng định dạng YYYY-MM-DD."
        elif isinstance(signed_date_raw, date):
            signed_date = signed_date_raw

    # BR06, EX01: Ngày bắt đầu bắt buộc
    start_date_raw = data.get("start_date")
    start_date = None
    if not start_date_raw:
        errors["start_date"] = "Vui lòng nhập đầy đủ thông tin bắt buộc."
    else:
        if isinstance(start_date_raw, str):
            try:
                start_date = date.fromisoformat(start_date_raw)
            except ValueError:
                errors["start_date"] = "Ngày bắt đầu không đúng định dạng YYYY-MM-DD."
        elif isinstance(start_date_raw, date):
            start_date = start_date_raw

    # BR06, EX01: Ngày kết thúc bắt buộc
    end_date_raw = data.get("end_date")
    end_date = None
    if not end_date_raw:
        errors["end_date"] = "Vui lòng nhập đầy đủ thông tin bắt buộc."
    else:
        if isinstance(end_date_raw, str):
            try:
                end_date = date.fromisoformat(end_date_raw)
            except ValueError:
                errors["end_date"] = "Ngày kết thúc không đúng định dạng YYYY-MM-DD."
        elif isinstance(end_date_raw, date):
            end_date = end_date_raw

    # BR10, EX02: Ngày kết thúc phải lớn hơn hoặc bằng Ngày bắt đầu
    if start_date and end_date and end_date < start_date:
        errors["end_date"] = "Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu."

    # BR06, BR11: Loại tiền (mặc định VND)
    currency_val = data.get("currency") or data.get("currency_id")
    currency = None
    if currency_val:
        currency_id = getattr(currency_val, "pk", currency_val)
        currency = Currency.objects.filter(pk=currency_id).first()
    if not currency:
        currency = company.accounting_currency or Currency.objects.filter(code="VND").first()

    # BR11, EX09: Tỷ giá
    exchange_rate_raw = data.get("exchange_rate")
    exchange_rate = Decimal("1")
    if currency and currency.code != "VND":
        if exchange_rate_raw is None or str(exchange_rate_raw).strip() == "":
            errors["exchange_rate"] = "Vui lòng nhập tỷ giá lớn hơn 0."
        else:
            try:
                exchange_rate = Decimal(str(exchange_rate_raw))
                if exchange_rate <= Decimal("0"):
                    errors["exchange_rate"] = "Vui lòng nhập tỷ giá lớn hơn 0."
            except (TypeError, ValueError):
                errors["exchange_rate"] = "Vui lòng nhập tỷ giá lớn hơn 0."
    elif exchange_rate_raw is not None:
        try:
            exchange_rate = Decimal(str(exchange_rate_raw))
            if exchange_rate <= Decimal("0"):
                errors["exchange_rate"] = "Vui lòng nhập tỷ giá lớn hơn 0."
        except (TypeError, ValueError):
            exchange_rate = Decimal("1")

    # BR06, EX01: Điều khoản thanh toán bắt buộc
    payment_term_val = data.get("payment_term") or data.get("payment_term_id")
    payment_term = None
    if not payment_term_val:
        errors["payment_term"] = "Vui lòng nhập đầy đủ thông tin bắt buộc."
    else:
        term_id = getattr(payment_term_val, "pk", payment_term_val)
        payment_term = PaymentTerm.objects.filter(pk=term_id, company=company).first()
        if not payment_term:
            errors["payment_term"] = "Điều khoản thanh toán không tồn tại."

    # EX16: Kiểm tra định dạng và dung lượng file đính kèm
    attachments = data.get("attachments", [])
    if attachments:
        if not isinstance(attachments, list):
            errors["attachments"] = "Tệp đính kèm phải là danh sách."
        else:
            import os
            ALLOWED_EXTS = {".pdf", ".docx", ".xlsx", ".png", ".jpg", ".jpeg"}
            MAX_SIZE = 10 * 1024 * 1024
            for att in attachments:
                if isinstance(att, dict):
                    f_name = att.get("file_name") or att.get("name", "")
                    f_size = att.get("file_size") or att.get("size", 0)
                    if f_size and int(f_size) > MAX_SIZE:
                        errors["attachments"] = f"Tệp đính kèm '{f_name}' vượt quá 10 MB. Dung lượng hỗ trợ tối đa 10 MB."
                        break
                    if f_name:
                        ext = os.path.splitext(f_name)[1].lower()
                        if ext and ext not in ALLOWED_EXTS:
                            errors["attachments"] = f"Định dạng tệp '{ext}' không được hỗ trợ. Định dạng cho phép gồm PDF, DOCX, XLSX, PNG, JPG, JPEG."
                            break

    if errors:
        raise ValidationError(errors)

    # Optional fields
    branch_val = data.get("branch") or data.get("branch_id")
    branch = None
    if branch_val:
        b_id = getattr(branch_val, "pk", branch_val)
        branch = Branch.objects.filter(pk=b_id, company=company).first()

    dept_val = data.get("department") or data.get("department_id")
    department = None
    if dept_val:
        d_id = getattr(dept_val, "pk", dept_val)
        department = Department.objects.filter(pk=d_id, company=company).first()

    assigned_to_val = data.get("assigned_to") or data.get("assigned_to_id")
    assigned_to = None
    if assigned_to_val:
        a_id = getattr(assigned_to_val, "pk", assigned_to_val)
        from iam.models import UserAccount
        assigned_to = UserAccount.objects.filter(pk=a_id).first()

    return {
        "title": title,
        "supplier": supplier,
        "signed_date": signed_date,
        "start_date": start_date,
        "end_date": end_date,
        "currency": currency,
        "exchange_rate": exchange_rate,
        "payment_term": payment_term,
        "branch": branch,
        "department": department,
        "assigned_to": assigned_to,
        "delivery_place": (data.get("delivery_place") or "").strip(),
        "delivery_term": (data.get("delivery_term") or "").strip(),
        "content": (data.get("content") or "").strip(),
        "notes": (data.get("notes") or "").strip(),
        "attachments": data.get("attachments", []),
        "payment_schedules": data.get("payment_schedules", []),
    }


def validate_contract_lines(lines_data, company):
    """
    Validate detail lines (BR07, BR08, BR09, EX04-EX08).
    Calculates line amount, discount, pre-tax, tax, total.
    """
    if not lines_data:
        # BR07, EX04: Hợp đồng phải có ít nhất một hàng hóa hoặc dịch vụ
        raise ValidationError("Hợp đồng phải có ít nhất một hàng hóa hoặc dịch vụ.")

    cleaned_lines = []
    line_no = 1
    total_subtotal = Decimal("0")
    total_discount = Decimal("0")
    total_tax = Decimal("0")
    total_contract = Decimal("0")

    for raw in lines_data:
        item_val = raw.get("item") or raw.get("item_id")
        uom_val = raw.get("uom") or raw.get("uom_id")
        tax_rate_val = raw.get("tax_rate") or raw.get("tax_rate_id")

        if not item_val or not uom_val or not tax_rate_val:
            raise ValidationError("Dòng chi tiết thiếu Hàng hóa/Dịch vụ, Đơn vị tính hoặc Thuế suất.")

        item_id = getattr(item_val, "pk", item_val)
        item = Item.objects.filter(pk=item_id, company=company).first()
        if not item or item.status != "ACTIVE":
            raise ValidationError("Hàng hóa/Dịch vụ không tồn tại hoặc đã ngừng hoạt động.")

        uom_id = getattr(uom_val, "pk", uom_val)
        uom = UnitOfMeasure.objects.filter(pk=uom_id, company=company).first()
        if not uom or uom.status != "ACTIVE":
            raise ValidationError("Đơn vị tính không tồn tại hoặc đã ngừng hoạt động.")

        tax_id = getattr(tax_rate_val, "pk", tax_rate_val)
        tax_rate = TaxRate.objects.filter(pk=tax_id, company=company).first()
        if not tax_rate or tax_rate.status != "ACTIVE":
            raise ValidationError("Thuế suất GTGT không tồn tại hoặc đã ngừng hoạt động.")

        # Quantity validation (EX06, BR09)
        try:
            quantity = Decimal(str(raw.get("quantity", 0)))
        except (TypeError, ValueError):
            raise ValidationError("Vui lòng nhập số lượng lớn hơn 0.")
        if quantity <= Decimal("0"):
            raise ValidationError("Vui lòng nhập số lượng lớn hơn 0.")

        # Unit price validation (EX07, BR09)
        try:
            unit_price = Decimal(str(raw.get("unit_price", 0)))
        except (TypeError, ValueError):
            raise ValidationError("Vui lòng nhập lại đơn giá.")
        if unit_price < Decimal("0"):
            raise ValidationError("Vui lòng nhập lại đơn giá.")

        # Discount rate validation (EX08, BR09)
        discount_rate_raw = raw.get("discount_rate", 0)
        try:
            discount_rate = Decimal(str(discount_rate_raw or 0))
        except (TypeError, ValueError):
            raise ValidationError("Vui lòng nhập lại tỷ lệ chiết khấu.")
        if discount_rate < Decimal("0") or discount_rate > Decimal("100"):
            raise ValidationError("Vui lòng nhập lại tỷ lệ chiết khấu.")

        # Calculations (Steps 12-16)
        line_subtotal = (quantity * unit_price).quantize(MONEY, ROUND_HALF_UP)
        discount_amount = (line_subtotal * discount_rate / Decimal("100")).quantize(MONEY, ROUND_HALF_UP)
        pre_tax_amount = line_subtotal - discount_amount

        tax_percent = getattr(tax_rate, "rate_percent", None) or getattr(tax_rate, "rate", Decimal("0"))
        tax_amount = (pre_tax_amount * tax_percent / Decimal("100")).quantize(MONEY, ROUND_HALF_UP)
        total_amount = pre_tax_amount + tax_amount

        expected_date = raw.get("expected_delivery_date")
        if isinstance(expected_date, str) and expected_date.strip():
            try:
                expected_date = date.fromisoformat(expected_date.strip())
            except ValueError:
                expected_date = None

        cleaned_lines.append({
            "line_no": line_no,
            "item": item,
            "uom": uom,
            "quantity": quantity,
            "unit_price": unit_price,
            "discount_rate": discount_rate,
            "discount_amount": discount_amount,
            "tax_rate": tax_rate,
            "pre_tax_amount": pre_tax_amount,
            "tax_amount": tax_amount,
            "total_amount": total_amount,
            "expected_delivery_date": expected_date,
            "description": raw.get("description", "").strip(),
            "ordered_quantity": Decimal("0"),
            "ordered_amount": Decimal("0"),
            "maximum_quantity": quantity,
        })

        total_subtotal += line_subtotal
        total_discount += discount_amount
        total_tax += tax_amount
        total_contract += total_amount
        line_no += 1

    return {
        "lines": cleaned_lines,
        "subtotal": total_subtotal,
        "discount_amount": total_discount,
        "tax_amount": total_tax,
        "total_amount": total_contract,
    }


def validate_payment_schedules(schedules, total_contract_value):
    """
    Validate payment schedules total amount does not exceed total contract amount (BR12, EX10).
    """
    if not schedules:
        return []

    cleaned_schedules = []
    total_schedule_amount = Decimal("0")

    for s in schedules:
        stage_name = (s.get("stage_name") or s.get("name") or "").strip()
        due_date = s.get("due_date")
        percentage = Decimal(str(s.get("percentage") or s.get("rate") or 0))
        amount = Decimal(str(s.get("amount") or 0))
        condition = (s.get("condition") or "").strip()

        total_schedule_amount += amount
        cleaned_schedules.append({
            "stage_name": stage_name,
            "due_date": str(due_date) if due_date else "",
            "percentage": str(percentage),
            "amount": str(amount),
            "condition": condition,
        })

    if total_schedule_amount > total_contract_value:
        # EX10, BR12: Tổng tiền các đợt thanh toán vượt Tổng giá trị hợp đồng
        raise ValidationError("Tổng tiền các đợt thanh toán không được vượt Tổng giá trị hợp đồng.")

    return cleaned_schedules


@transaction.atomic
def create_contract(request, data):
    """
    Create a new purchase contract in DRAFT status (Steps 3-24, BR01, BR04).
    """
    company = data.get("company")
    if not company:
        raise ValidationError("Không xác định được phạm vi dữ liệu của tài khoản. Vui lòng liên hệ quản trị viên.")

    header = validate_contract_header(data, company)
    lines_calc = validate_contract_lines(data.get("lines", []), company)
    schedules = validate_payment_schedules(header["payment_schedules"], lines_calc["total_amount"])

    # Issue unique contract number (BR02, BR04)
    contract_number = data.get("number")
    if not contract_number or not contract_number.strip():
        contract_number = number_for_contract(company, document_date=header["signed_date"])

    contract = models.PurchaseContract.objects.create(
        company=company,
        branch=header["branch"],
        department=header["department"],
        number=contract_number,
        title=header["title"],
        document_date=header["signed_date"],
        signed_date=header["signed_date"],
        start_date=header["start_date"],
        end_date=header["end_date"],
        supplier=header["supplier"],
        currency=header["currency"],
        exchange_rate=header["exchange_rate"],
        payment_term=header["payment_term"],
        assigned_to=header["assigned_to"],
        delivery_place=header["delivery_place"],
        delivery_term=header["delivery_term"],
        content=header["content"],
        notes=header["notes"],
        payment_schedules=schedules,
        attachments=header["attachments"],
        status=models.DocumentStatus.DRAFT,
        approval_required=True,
        workflow_snapshot={},
        subtotal=lines_calc["subtotal"],
        discount_amount=lines_calc["discount_amount"],
        tax_amount=lines_calc["tax_amount"],
        total_amount=lines_calc["total_amount"],
        maximum_value=lines_calc["total_amount"],
        ordered_amount=Decimal("0"),
        received_amount=Decimal("0"),
        invoiced_amount=Decimal("0"),
        paid_amount=Decimal("0"),
        created_by=actor_for(request),
    )

    for line_dict in lines_calc["lines"]:
        models.PurchaseContractLine.objects.create(contract=contract, **line_dict)

    contract.workflow_snapshot = configured_snapshot(contract, "PUR.CONTRACT") or {}
    contract.save(update_fields=("workflow_snapshot",))

    audit(request, contract, "CREATE", after={"status": contract.status, "number": contract.number})
    return contract


@transaction.atomic
def update_contract(contract, request, data):
    """
    Update purchase contract in DRAFT or REJECTED status (AF02, BR18, EX15).
    """
    # BR18: Hợp đồng đã được phê duyệt không được sửa trực tiếp
    if contract.status not in (models.DocumentStatus.DRAFT, models.DocumentStatus.REJECTED):
        raise ValidationError("Chỉ hợp đồng Chưa phê duyệt mới được sửa nội dung nghiệp vụ.")

    # EX15: Optimistic locking
    req_version = data.get("version")
    if req_version is not None and int(req_version) != contract.version:
        raise ValidationError("Hợp đồng đã được User khác cập nhật. Vui lòng tải lại thông tin mới nhất.")

    before_status = contract.status
    header = validate_contract_header(data, contract.company, current_contract=contract)
    lines_calc = validate_contract_lines(data.get("lines", []), contract.company)
    schedules = validate_payment_schedules(header["payment_schedules"], lines_calc["total_amount"])

    contract.title = header["title"]
    contract.supplier = header["supplier"]
    contract.signed_date = header["signed_date"]
    contract.document_date = header["signed_date"]
    contract.start_date = header["start_date"]
    contract.end_date = header["end_date"]
    contract.currency = header["currency"]
    contract.exchange_rate = header["exchange_rate"]
    contract.payment_term = header["payment_term"]
    contract.branch = header["branch"]
    contract.department = header["department"]
    contract.assigned_to = header["assigned_to"]
    contract.delivery_place = header["delivery_place"]
    contract.delivery_term = header["delivery_term"]
    contract.content = header["content"]
    contract.notes = header["notes"]
    contract.payment_schedules = schedules
    contract.attachments = header["attachments"]
    contract.subtotal = lines_calc["subtotal"]
    contract.discount_amount = lines_calc["discount_amount"]
    contract.tax_amount = lines_calc["tax_amount"]
    contract.total_amount = lines_calc["total_amount"]
    contract.maximum_value = lines_calc["total_amount"]

    # AF03, AF02: Editing a rejected contract increments version and resets to DRAFT
    if before_status == models.DocumentStatus.REJECTED:
        contract.version += 1
        contract.status = models.DocumentStatus.DRAFT
        contract.rejection_reason = ""

    contract.save()

    contract.lines.all().delete()
    for line_dict in lines_calc["lines"]:
        models.PurchaseContractLine.objects.create(contract=contract, **line_dict)

    audit(request, contract, "EDIT", {"status": before_status}, {"status": contract.status})
    return contract


@transaction.atomic
def submit_contract(contract, request):
    """
    Submit contract for approval (Steps 25-26, AF04).
    """
    if contract.status not in (models.DocumentStatus.DRAFT, models.DocumentStatus.REJECTED):
        raise ValidationError("Chỉ hợp đồng Chưa phê duyệt mới được gửi phê duyệt.")

    lines_count = contract.lines.count()
    if lines_count == 0 or contract.total_amount <= Decimal("0"):
        raise ValidationError("Hợp đồng phải có ít nhất một hàng hóa hoặc dịch vụ.")

    today = timezone.now().date()
    snapshot = contract.workflow_snapshot
    if not snapshot:
        try:
            snapshot = configured_snapshot(contract, "PUR.CONTRACT") or {}
        except ValidationError:
            # EX11: Không xác định được người phê duyệt
            raise ValidationError("Chưa thiết lập người phê duyệt cho nghiệp vụ này.")
        except Exception:
            snapshot = {}
    contract.workflow_snapshot = snapshot

    # EX11: Không xác định được người phê duyệt khi quy trình yêu cầu
    if snapshot and snapshot.get("approval_required") and snapshot.get("steps"):
        approvers_exist = any(step.get("approvers") for step in snapshot.get("steps", []))
        if not approvers_exist:
            raise ValidationError("Chưa thiết lập người phê duyệt cho nghiệp vụ này.")

    # AF04: Doanh nghiệp không sử dụng workflow hoặc cho phép tự xác nhận
    allow_direct = snapshot.get("allow_creator_posting", False) or not snapshot.get("steps")
    before = contract.status

    if allow_direct:
        # Step 28: Đã phê duyệt nếu chưa đến Ngày bắt đầu; Đang thực hiện nếu đã đến Ngày bắt đầu
        if today >= contract.start_date:
            contract.status = models.DocumentStatus.IN_PROGRESS
        else:
            contract.status = models.DocumentStatus.APPROVED
        contract.approved_at = timezone.now()
    else:
        contract.status = models.DocumentStatus.PENDING_APPROVAL

    contract.submitted_at = timezone.now()
    contract.save(update_fields=("status", "submitted_at", "approved_at", "workflow_snapshot", "updated_at"))
    audit(request, contract, "SUBMIT", {"status": before}, {"status": contract.status})
    return contract


@transaction.atomic
def approve_contract(contract, request):
    """
    Approve contract (Steps 27-28).
    Status transitions to APPROVED (if before start_date) or IN_PROGRESS (if on/after start_date).
    """
    if contract.status != models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Hợp đồng không ở trạng thái chờ phê duyệt.")

    today = timezone.now().date()
    before = contract.status

    # Step 28: Chuyển sang Đã phê duyệt nếu chưa đến Ngày bắt đầu; Đang thực hiện nếu đã đến
    if today >= contract.start_date:
        contract.status = models.DocumentStatus.IN_PROGRESS
    else:
        contract.status = models.DocumentStatus.APPROVED

    contract.approved_at = timezone.now()
    contract.save(update_fields=("status", "approved_at", "updated_at"))

    models.ApprovalDecision.objects.create(
        company=contract.company,
        document_type="CONTRACT",
        document_id=contract.pk,
        document_version=contract.version,
        level=1,
        decision=models.ApprovalDecision.Decision.APPROVED,
        actor=actor_for(request),
        comment=request.data.get("comment", "") or request.data.get("notes", ""),
    )
    audit(request, contract, "APPROVE", {"status": before}, {"status": contract.status})
    return contract


@transaction.atomic
def reject_contract(contract, request):
    """
    Reject contract with mandatory reason (AF03).
    Transitions back to DRAFT or REJECTED.
    """
    if contract.status != models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Hợp đồng không ở trạng thái chờ phê duyệt.")

    reason = (request.data.get("reason") or request.data.get("comment") or "").strip()
    if not reason:
        raise ValidationError({"reason": "Vui lòng nhập lý do từ chối."})

    before = contract.status
    contract.status = models.DocumentStatus.REJECTED
    contract.rejection_reason = reason
    contract.save(update_fields=("status", "rejection_reason", "updated_at"))

    models.ApprovalDecision.objects.create(
        company=contract.company,
        document_type="CONTRACT",
        document_id=contract.pk,
        document_version=contract.version,
        level=1,
        decision=models.ApprovalDecision.Decision.REJECTED,
        actor=actor_for(request),
        comment=reason,
    )
    audit(request, contract, "REJECT", {"status": before}, {"status": contract.status}, reason=reason)
    return contract


@transaction.atomic
def confirm_contract(contract, request):
    """
    Confirm contract directly when enterprise does not use approval workflow (AF04).
    """
    if contract.status != models.DocumentStatus.DRAFT:
        raise ValidationError("Chỉ hợp đồng Chưa phê duyệt mới có thể xác nhận.")

    today = timezone.now().date()
    before = contract.status
    if today >= contract.start_date:
        contract.status = models.DocumentStatus.IN_PROGRESS
    else:
        contract.status = models.DocumentStatus.APPROVED

    contract.approved_at = timezone.now()
    contract.save(update_fields=("status", "approved_at", "updated_at"))
    audit(request, contract, "CONFIRM", {"status": before}, {"status": contract.status})
    return contract


@transaction.atomic
def complete_contract(contract, request):
    """
    Mark contract as COMPLETED (AF05).
    Requires reason if not fully executed.
    """
    check_and_update_contract_expiration(contract)
    if contract.status not in (models.DocumentStatus.IN_PROGRESS, models.DocumentStatus.APPROVED):
        raise ValidationError("Chỉ hợp đồng Đang thực hiện hoặc Đã phê duyệt mới có thể hoàn thành.")

    # AF05 Bước 3: Lý do hoàn thành trước hạn nếu chưa thực hiện hết
    reason = (request.data.get("reason") or "").strip()
    if contract.ordered_amount < contract.total_amount and not reason:
        raise ValidationError({"reason": "Vui lòng nhập lý do hoàn thành trước hạn."})

    before = contract.status
    contract.status = models.DocumentStatus.COMPLETED
    contract.completion_reason = reason
    contract.save(update_fields=("status", "completion_reason", "updated_at"))
    audit(request, contract, "COMPLETE", {"status": before}, {"status": contract.status}, reason=reason)
    return contract


@transaction.atomic
def cancel_contract(contract, request):
    """
    Cancel contract (AF06).
    Checks that contract does not have active purchase orders (EX13).
    Reason is mandatory.
    """
    if contract.status == models.DocumentStatus.CANCELLED:
        raise ValidationError("Hợp đồng đã ở trạng thái Đã hủy.")

    reason = (request.data.get("reason") or "").strip()
    if not reason:
        raise ValidationError({"reason": "Vui lòng nhập lý do hủy."})

    # EX13: Kiểm tra hợp đồng có đơn mua hàng liên quan hay không
    active_orders = contract.orders.exclude(status=models.DocumentStatus.CANCELLED)
    if active_orders.exists():
        raise ValidationError("Không thể hủy hợp đồng đã có đơn mua hàng liên quan. Vui lòng xử lý hoặc hủy các đơn mua trước.")

    before = contract.status
    contract.status = models.DocumentStatus.CANCELLED
    contract.cancellation_reason = reason
    contract.terminated_at = timezone.now()
    contract.termination_reason = reason
    contract.save(update_fields=("status", "cancellation_reason", "terminated_at", "termination_reason", "updated_at"))
    audit(request, contract, "CANCEL", {"status": before}, {"status": contract.status}, reason=reason)
    return contract


@transaction.atomic
def delete_contract(contract, request):
    """
    Delete contract in DRAFT status with no linked purchase orders (AF07, BR19, EX13).
    """
    if contract.status != models.DocumentStatus.DRAFT:
        raise ValidationError("Chỉ hợp đồng Chưa phê duyệt mới được xóa.")

    if contract.orders.exists():
        raise ValidationError("Không thể xóa hợp đồng đã có đơn mua hàng hoặc chứng từ liên quan.")

    audit(request, contract, "DELETE", before={"number": contract.number, "status": contract.status})
    contract.delete()


@transaction.atomic
def create_order_from_contract(contract, request, order_data):
    """
    Create a PurchaseOrder from an approved/in-progress contract (Steps 29-31, BR15-17, EX12).
    """
    check_and_update_contract_expiration(contract)

    # BR15: Chỉ hợp đồng đã được phê duyệt, chưa hết hiệu lực và chưa bị hủy mới được dùng để tạo đơn mua hàng
    if contract.status not in (models.DocumentStatus.APPROVED, models.DocumentStatus.IN_PROGRESS):
        raise ValidationError("Chỉ hợp đồng đã được phê duyệt, chưa hết hiệu lực và chưa bị hủy mới được dùng để tạo đơn mua hàng.")

    lines_input = order_data.get("lines", [])
    if not lines_input:
        raise ValidationError("Vui lòng chọn ít nhất một dòng hàng hóa hoặc dịch vụ cần đặt mua.")

    company = contract.company
    document_date = order_data.get("document_date", timezone.now().date())
    delivery_date = order_data.get("delivery_date") or contract.end_date
    if isinstance(delivery_date, str):
        try:
            delivery_date = date.fromisoformat(delivery_date)
        except ValueError:
            delivery_date = contract.end_date

    branch_val = order_data.get("branch") or contract.branch
    if isinstance(branch_val, Branch):
        branch = branch_val
    elif branch_val:
        branch = Branch.objects.filter(pk=branch_val, company=company).first()
    else:
        branch = contract.branch

    warehouse_val = order_data.get("receiving_warehouse")
    receiving_warehouse = None
    if warehouse_val:
        from master_data.models import Warehouse
        if isinstance(warehouse_val, Warehouse):
            receiving_warehouse = warehouse_val
        else:
            receiving_warehouse = Warehouse.objects.filter(pk=warehouse_val, company=company).first()

    # Generate PO number
    from purchases.services import generate_purchase_order_number
    po_number = order_data.get("number")
    if not po_number or not po_number.strip():
        po_number = generate_purchase_order_number(company, branch=branch, document_date=document_date)

    # Validate lines and quantities (BR17, EX12)
    po_lines_to_create = []
    po_subtotal = Decimal("0")
    po_tax_amount = Decimal("0")
    po_discount_amount = Decimal("0")
    po_total_amount = Decimal("0")

    for raw in lines_input:
        line_id = raw.get("contract_line_id") or raw.get("line_id")
        if not line_id:
            raise ValidationError("Thiếu thông tin dòng hợp đồng cần đặt mua.")

        contract_line = contract.lines.filter(pk=line_id).first()
        if not contract_line:
            raise ValidationError("Dòng hợp đồng được chọn không tồn tại.")

        try:
            order_qty = Decimal(str(raw.get("quantity", 0)))
        except (TypeError, ValueError):
            raise ValidationError("Số lượng đặt mua phải lớn hơn 0.")

        if order_qty <= Decimal("0"):
            raise ValidationError("Số lượng đặt mua phải lớn hơn 0.")

        remaining_qty = contract_line.quantity - contract_line.ordered_quantity
        # BR17, EX12: Không vượt phần còn lại của hợp đồng
        if order_qty > remaining_qty:
            raise ValidationError(
                f"Số lượng đặt mua ({order_qty}) vượt quá số lượng còn lại ({remaining_qty}) của dòng hàng hóa {contract_line.item.code}."
            )

        line_sub = (order_qty * contract_line.unit_price).quantize(MONEY, ROUND_HALF_UP)
        line_disc = (line_sub * contract_line.discount_rate / Decimal("100")).quantize(MONEY, ROUND_HALF_UP)
        line_pre = line_sub - line_disc
        tax_pct = getattr(contract_line.tax_rate, "rate_percent", Decimal("0")) if contract_line.tax_rate else Decimal("0")
        line_tax = (line_pre * tax_pct / Decimal("100")).quantize(MONEY, ROUND_HALF_UP)
        line_tot = line_pre + line_tax

        po_lines_to_create.append({
            "contract_line": contract_line,
            "quantity": order_qty,
            "unit_price": contract_line.unit_price,
            "discount_rate": contract_line.discount_rate,
            "discount_amount": line_disc,
            "tax_rate": contract_line.tax_rate,
            "tax_amount": line_tax,
            "line_subtotal": line_sub,
            "total_amount": line_tot,
        })

        po_subtotal += line_sub
        po_discount_amount += line_disc
        po_tax_amount += line_tax
        po_total_amount += line_tot

    # Check overall contract value remaining (BR17, EX12)
    contract_remaining_val = contract.total_amount - contract.ordered_amount
    if po_total_amount > contract_remaining_val:
        raise ValidationError(
            f"Tổng giá trị đơn mua ({po_total_amount}) vượt quá giá trị còn lại của hợp đồng ({contract_remaining_val})."
        )

    # BR16: NCC và loại tiền trên đơn mua phải trùng với hợp đồng
    order = models.PurchaseOrder.objects.create(
        company=company,
        branch=branch,
        contract=contract,
        supplier=contract.supplier,
        currency=contract.currency,
        exchange_rate=contract.exchange_rate,
        payment_term=contract.payment_term,
        number=po_number,
        document_date=document_date,
        delivery_date=delivery_date,
        receiving_warehouse=receiving_warehouse,
        receiving_location=order_data.get("receiving_location", contract.delivery_place or "Kho nhận hàng"),
        delivery_address=order_data.get("delivery_address", contract.delivery_place or ""),
        notes=order_data.get("notes", f"Đơn mua theo hợp đồng {contract.number}"),
        status=models.DocumentStatus.APPROVED,
        subtotal=po_subtotal,
        discount_amount=po_discount_amount,
        tax_amount=po_tax_amount,
        total_amount=po_total_amount,
        created_by=actor_for(request),
    )

    line_no = 1
    for p_line in po_lines_to_create:
        c_line = p_line["contract_line"]
        models.PurchaseOrderLine.objects.create(
            order=order,
            line_no=line_no,
            item=c_line.item,
            uom=c_line.uom,
            quantity=p_line["quantity"],
            unit_price=p_line["unit_price"],
            discount_rate=p_line["discount_rate"],
            tax_rate=p_line["tax_rate"],
            description=c_line.description,
        )

        # Update contract line ordered progress (Step 31)
        c_line.ordered_quantity += p_line["quantity"]
        c_line.ordered_amount += p_line["total_amount"]
        c_line.save(update_fields=("ordered_quantity", "ordered_amount"))
        line_no += 1

    # Update contract header progress (Step 31)
    contract.ordered_amount += po_total_amount
    if contract.status == models.DocumentStatus.APPROVED:
        contract.status = models.DocumentStatus.IN_PROGRESS
    contract.save(update_fields=("ordered_amount", "status", "updated_at"))

    audit(request, contract, "CREATE_ORDER", after={"order_number": order.number, "po_total": str(po_total_amount)})
    return order


def get_contract_execution_summary(contract):
    """
    Calculate real-time execution statistics for contract (Step 32).
    """
    check_and_update_contract_expiration(contract)

    orders_qs = contract.orders.all().order_by("-document_date", "-created_at")
    total_val = contract.total_amount or Decimal("0")
    ordered_val = contract.ordered_amount or Decimal("0")
    remaining_val = max(Decimal("0"), total_val - ordered_val)

    progress_pct = (
        min(Decimal("100"), (ordered_val / total_val * Decimal("100")).quantize(Decimal("0.01")))
        if total_val > Decimal("0")
        else Decimal("0")
    )

    # Received value from GoodsPurchase related to orders
    received_val = Decimal("0")
    for o in orders_qs:
        gp_lines = models.GoodsPurchaseLine.objects.filter(
            purchase__purchase_order=o,
            purchase__status="POSTED"
        )
        received_val += sum((g.total_amount for g in gp_lines), Decimal("0"))

    # Invoiced value from SupplierInvoices linked to orders
    from accounts_payable.models import SupplierInvoice
    invoiced_val = sum((
        inv.total_amount for inv in SupplierInvoice.objects.filter(
            purchase_order__in=orders_qs,
            status="POSTED"
        )
    ), Decimal("0"))

    # Paid value
    paid_val = sum((o.paid_amount for o in orders_qs), Decimal("0"))

    lines_summary = []
    for l in contract.lines.select_related("item", "uom", "tax_rate").all():
        rem_q = max(Decimal("0"), l.quantity - l.ordered_quantity)
        l_progress = (
            min(Decimal("100"), (l.ordered_quantity / l.quantity * Decimal("100")).quantize(Decimal("0.01")))
            if l.quantity > Decimal("0")
            else Decimal("0")
        )
        lines_summary.append({
            "id": str(l.id),
            "line_no": l.line_no,
            "item_id": str(l.item_id),
            "item_code": l.item.code,
            "item_name": l.item.name,
            "uom_id": str(l.uom_id),
            "uom_name": l.uom.name,
            "contract_quantity": str(l.quantity),
            "ordered_quantity": str(l.ordered_quantity),
            "remaining_quantity": str(rem_q),
            "unit_price": str(l.unit_price),
            "line_total": str(l.total_amount),
            "ordered_amount": str(l.ordered_amount),
            "progress_percent": str(l_progress),
        })

    orders_summary = []
    for o in orders_qs:
        orders_summary.append({
            "id": str(o.id),
            "number": o.number,
            "document_date": str(o.document_date),
            "status": o.status,
            "total_amount": str(o.total_amount),
        })

    return {
        "contract_id": str(contract.id),
        "number": contract.number,
        "title": contract.title,
        "status": contract.status,
        "status_display": contract.get_status_display(),
        "total_amount": str(total_val),
        "ordered_amount": str(ordered_val),
        "remaining_amount": str(remaining_val),
        "progress_percent": str(progress_pct),
        "received_amount": str(received_val),
        "invoiced_amount": str(invoiced_val),
        "paid_amount": str(paid_val),
        "lines": lines_summary,
        "orders": orders_summary,
    }
