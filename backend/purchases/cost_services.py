from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from accounts_payable.models import Payable, SupplierInvoice
from approval_workflows.submission import configured_snapshot
from common_services.models import DocumentNumberingRule
from common_services.period_services import determine_period_for_date
from general_ledger.models import Account, AccountingPeriod, JournalEntry, JournalLine
from general_ledger.services import post as post_journal
from master_data.models import Party
from . import models
from .services import actor_for, audit

MONEY = Decimal("0.0001")


def number_for(company, document_date, branch=None):
    """Generate unique purchase cost number according to numbering rules (BR-PUR-CST-33)."""
    from common_services.numbering_services import generate_document_number
    from master_data.models import DocumentType

    document_type = DocumentType.objects.filter(code__in=["PUR.COST", "PUR.PURCHASE_COST"], status="ACTIVE").first()
    if document_type and DocumentNumberingRule.objects.filter(company=company, document_type=document_type, status="ACTIVE").exists():
        configured = generate_document_number(company, document_type, branch=branch, document_date=document_date)
        if configured:
            if models.PurchaseCost.objects.filter(company=company, number=configured).exists():
                raise ValidationError("Số chứng từ đã tồn tại.")
            return configured

    if isinstance(document_date, str):
        try:
            document_date = date.fromisoformat(document_date)
        except ValueError:
            pass
    if isinstance(document_date, date):
        prefix = f"CP{document_date:%Y%m%d}"
    else:
        prefix = "CP"
    last = models.PurchaseCost.objects.filter(company=company, number__startswith=prefix).order_by("-number").values_list("number", flat=True).first()
    sequence = int(last[len(prefix):]) + 1 if last and last[len(prefix):].isdigit() else 1
    return f"{prefix}{sequence:04d}"


def get_default_tax_account(company):
    """Find default input VAT account (1331 or 133)."""
    return Account.objects.filter(
        company=company,
        code__in=["1331", "133"],
        status="ACTIVE",
    ).first()


def validate_cost_lines_payload(cost, lines_data):
    """Validate each cost line before saving (BR-PUR-CST-13, 14, 15, 20, 21, EF-06, EF-07)."""
    if not lines_data:
        raise ValidationError("Chứng từ phải có ít nhất một dòng chi phí hợp lệ.")

    cleaned_lines = []
    line_no = 1
    for raw in lines_data:
        cost_type = raw.get("cost_type")
        if not cost_type or cost_type not in models.CostType.values:
            raise ValidationError("Vui lòng nhập đầy đủ các trường bắt buộc.")

        description = raw.get("description", "").strip()
        if not description:
            raise ValidationError("Vui lòng nhập đầy đủ các trường bắt buộc.")

        try:
            pre_tax = Decimal(str(raw.get("pre_tax_amount", 0)))
        except (TypeError, ValueError):
            raise ValidationError("Số tiền trước thuế phải lớn hơn 0.")

        # EF-06, BR-PUR-CST-13: Số tiền trước thuế phải lớn hơn 0
        if pre_tax <= Decimal("0"):
            raise ValidationError("Số tiền trước thuế phải lớn hơn 0.")

        tax_rate_id = raw.get("tax_rate") or raw.get("tax_rate_id")
        tax_rate = None
        if tax_rate_id:
            from master_data.models import TaxRate
            tax_rate = TaxRate.objects.filter(pk=tax_rate_id, company=cost.company).first()

        # Calculate or accept tax amount (BR-PUR-CST-14)
        if "tax_amount" in raw and raw["tax_amount"] is not None:
            tax_amount = Decimal(str(raw["tax_amount"])).quantize(MONEY, ROUND_HALF_UP)
        elif tax_rate:
            rate_percent = getattr(tax_rate, "rate_percent", None) or getattr(tax_rate, "rate", Decimal("0"))
            tax_amount = (pre_tax * rate_percent / Decimal("100")).quantize(MONEY, ROUND_HALF_UP)
        else:
            tax_amount = Decimal("0")

        total_amount = pre_tax + tax_amount

        account_id = raw.get("account") or raw.get("account_id")
        if not account_id:
            raise ValidationError("Vui lòng nhập đầy đủ các trường bắt buộc.")

        try:
            account = Account.objects.get(pk=account_id, company=cost.company)
        except Account.DoesNotExist:
            raise ValidationError("Tài khoản kế toán đã ngừng sử dụng. Vui lòng chọn tài khoản khác.")

        # EF-07, BR-PUR-CST-30: Tài khoản kế toán phải đang hoạt động
        if account.status != "ACTIVE":
            raise ValidationError("Tài khoản kế toán đã ngừng sử dụng. Vui lòng chọn tài khoản khác.")

        requires_allocation = bool(raw.get("requires_allocation", True))

        cleaned_lines.append({
            "line_no": line_no,
            "cost_type": cost_type,
            "description": description,
            "pre_tax_amount": pre_tax,
            "tax_rate": tax_rate,
            "tax_amount": tax_amount,
            "total_amount": total_amount,
            "requires_allocation": requires_allocation,
            "account": account,
            "cost_center_id": raw.get("cost_center") or raw.get("cost_center_id"),
            "expense_item_id": raw.get("expense_item") or raw.get("expense_item_id"),
            "allocation_status": models.CostAllocationStatus.UNALLOCATED if requires_allocation else models.CostAllocationStatus.NOT_REQUIRED,
            "allocated_amount": Decimal("0"),
        })
        line_no += 1

    return cleaned_lines


def save_cost_lines(cost, cleaned_lines):
    """Save cleaned lines and recalculate totals (BR-PUR-CST-16)."""
    cost.lines.all().delete()
    subtotal = Decimal("0")
    tax_amount = Decimal("0")

    for line_dict in cleaned_lines:
        models.PurchaseCostLine.objects.create(cost=cost, **line_dict)
        subtotal += line_dict["pre_tax_amount"]
        tax_amount += line_dict["tax_amount"]

    cost.subtotal = subtotal
    cost.tax_amount = tax_amount
    cost.total_amount = subtotal + tax_amount

    # Update allocation status for header
    has_unallocated = any(l["requires_allocation"] for l in cleaned_lines)
    cost.allocation_status = (
        models.CostAllocationStatus.UNALLOCATED if has_unallocated
        else models.CostAllocationStatus.NOT_REQUIRED
    )
    cost.save(update_fields=("subtotal", "tax_amount", "total_amount", "allocation_status", "updated_at"))


def validate_cost_header(cost_data, company, current_cost_id=None):
    """Validate mandatory fields and business rules for PurchaseCost header."""
    supplier_id = cost_data.get("supplier") or cost_data.get("supplier_id")
    if not supplier_id:
        raise ValidationError("Vui lòng nhập đầy đủ các trường bắt buộc.")

    try:
        supplier = Party.objects.get(pk=supplier_id, company=company)
    except Party.DoesNotExist:
        raise ValidationError("Vui lòng nhập đầy đủ các trường bắt buộc.")

    # EF-03: Nhà cung cấp đã ngừng hoạt động
    if supplier.status != "ACTIVE":
        raise ValidationError("Nhà cung cấp chi phí không còn hoạt động.")

    document_date = cost_data.get("document_date")
    posting_date = cost_data.get("posting_date")
    if not document_date or not posting_date:
        raise ValidationError("Vui lòng nhập đầy đủ các trường bắt buộc.")

    if isinstance(document_date, str):
        try:
            document_date = date.fromisoformat(document_date)
        except ValueError:
            raise ValidationError("Vui lòng nhập đầy đủ các trường bắt buộc.")

    if isinstance(posting_date, str):
        try:
            posting_date = date.fromisoformat(posting_date)
        except ValueError:
            raise ValidationError("Vui lòng nhập đầy đủ các trường bắt buộc.")

    # EF-09, BR-PUR-CST-31: Ngày hạch toán thuộc kỳ kế toán chưa khóa
    try:
        pinfo = determine_period_for_date(company, posting_date)
        period = pinfo.get("period") if isinstance(pinfo, dict) else pinfo
        if not period or getattr(period, "status", "") != "OPEN":
            raise ValidationError("Ngày hạch toán thuộc kỳ kế toán đã khóa.")
    except ValidationError as e:
        if "Ngày hạch toán thuộc kỳ kế toán đã khóa." in str(e):
            raise
        raise ValidationError("Ngày hạch toán thuộc kỳ kế toán đã khóa.")
    except Exception:
        raise ValidationError("Ngày hạch toán thuộc kỳ kế toán đã khóa.")

    # Payment account validation (AF-05, AF-06, AF-07, BR-PUR-CST-27, 28, 29)
    payment_type = cost_data.get("payment_type", "UNPAID")
    payment_account_id = cost_data.get("payment_account") or cost_data.get("payment_account_id")
    payment_account = None
    if payment_account_id:
        try:
            payment_account = Account.objects.get(pk=payment_account_id, company=company)
            if payment_account.status != "ACTIVE":
                raise ValidationError("Tài khoản kế toán đã ngừng sử dụng. Vui lòng chọn tài khoản khác.")
        except Account.DoesNotExist:
            raise ValidationError("Tài khoản kế toán đã ngừng sử dụng. Vui lòng chọn tài khoản khác.")
    elif payment_type == "UNPAID":
        # Default payable account 331
        payment_account = Account.objects.filter(company=company, code__startswith="331", status="ACTIVE").first()
    elif payment_type == "CASH":
        payment_account = Account.objects.filter(company=company, code__startswith="111", status="ACTIVE").first()
    elif payment_type == "BANK":
        payment_account = Account.objects.filter(company=company, code__startswith="112", status="ACTIVE").first()

    if not payment_account:
        raise ValidationError("Vui lòng nhập đầy đủ các trường bắt buộc.")

    # Invoice validation (EF-05, BR-PUR-CST-18)
    invoice_id = cost_data.get("supplier_invoice") or cost_data.get("supplier_invoice_id")
    supplier_invoice = None
    if invoice_id:
        try:
            supplier_invoice = SupplierInvoice.objects.get(pk=invoice_id, company=company)
        except SupplierInvoice.DoesNotExist:
            raise ValidationError("Hóa đơn đầu vào không tồn tại.")

        if supplier_invoice.supplier_id != supplier.id:
            raise ValidationError("Hóa đơn đầu vào phải thuộc đúng nhà cung cấp chi phí.")
        if supplier_invoice.status == "CANCELLED":
            raise ValidationError("Hóa đơn đầu vào không còn đủ điều kiện liên kết.")

        # Check invoice uniqueness
        qs = models.PurchaseCost.objects.filter(supplier_invoice=supplier_invoice).exclude(status=models.DocumentStatus.CANCELLED)
        if current_cost_id:
            qs = qs.exclude(pk=current_cost_id)
        if qs.exists():
            raise ValidationError("Hóa đơn đầu vào đã được sử dụng cho chứng từ khác.")

    # Related purchase documents validation (BR-PUR-CST-07, 08, 11, EF-04)
    related_orders_ids = cost_data.get("related_orders", [])
    related_gp_ids = cost_data.get("related_goods_purchases", [])

    if not related_orders_ids and not related_gp_ids:
        # BR-PUR-CST-07: Bắt buộc liên kết với ít nhất một đơn mua hoặc chứng từ mua hàng hóa
        raise ValidationError("Chứng từ chi phí phải liên kết với ít nhất một đơn mua hoặc chứng từ mua hàng hóa.")

    valid_orders = []
    for o_id in related_orders_ids:
        order = models.PurchaseOrder.objects.filter(pk=o_id, company=company).first()
        if not order:
            raise ValidationError("Chứng từ mua được chọn không còn đủ điều kiện liên kết.")
        # BR-PUR-CST-08: Phải đã phê duyệt hoặc đã ghi sổ, không bị hủy
        if order.status in (models.DocumentStatus.DRAFT, models.DocumentStatus.CANCELLED, models.DocumentStatus.REJECTED):
            raise ValidationError("Chứng từ mua được chọn không còn đủ điều kiện liên kết.")
        valid_orders.append(order)

    valid_gps = []
    for gp_id in related_gp_ids:
        gp = models.GoodsPurchase.objects.filter(pk=gp_id, company=company).first()
        if not gp:
            raise ValidationError("Chứng từ mua được chọn không còn đủ điều kiện liên kết.")
        if gp.status in (models.DocumentStatus.DRAFT, models.DocumentStatus.CANCELLED, models.DocumentStatus.REJECTED):
            raise ValidationError("Chứng từ mua được chọn không còn đủ điều kiện liên kết.")
        valid_gps.append(gp)

    return {
        "supplier": supplier,
        "document_date": document_date,
        "posting_date": posting_date,
        "payment_type": payment_type,
        "payment_account": payment_account,
        "supplier_invoice": supplier_invoice,
        "valid_orders": valid_orders,
        "valid_gps": valid_gps,
    }


@transaction.atomic
def create_purchase_cost(request, data):
    """Create a new purchase cost document in DRAFT status (Step 7-8, AF-08)."""
    company = data.get("company")
    if not company:
        raise ValidationError("Không xác định được phạm vi dữ liệu của tài khoản. Vui lòng liên hệ quản trị viên.")

    header_data = validate_cost_header(data, company)
    lines_data = data.get("lines", [])
    cleaned_lines = validate_cost_lines_payload(models.PurchaseCost(company=company), lines_data)

    branch_val = data.get("branch")
    branch_id = getattr(branch_val, "pk", branch_val) if branch_val else data.get("branch_id")
    branch_obj = None
    if branch_id:
        from organization.models import Branch
        branch_obj = Branch.objects.filter(pk=branch_id, company=company).first()

    cost_number = data.get("number")
    if not cost_number or not cost_number.strip():
        cost_number = number_for(company, header_data["document_date"], branch=branch_obj)

    cost = models.PurchaseCost.objects.create(
        company=company,
        branch=branch_obj,
        number=cost_number,
        document_date=header_data["document_date"],
        posting_date=header_data["posting_date"],
        supplier=header_data["supplier"],
        payment_type=header_data["payment_type"],
        payment_account=header_data["payment_account"],
        supplier_invoice=header_data["supplier_invoice"],
        notes=data.get("notes", "") or data.get("description", ""),
        attachments=data.get("attachments", []),
        status=models.DocumentStatus.DRAFT,
        approval_required=True,
        workflow_snapshot={},
        created_by=actor_for(request),
    )

    cost.related_orders.set(header_data["valid_orders"])
    cost.related_goods_purchases.set(header_data["valid_gps"])

    save_cost_lines(cost, cleaned_lines)
    cost.workflow_snapshot = configured_snapshot(cost, "PUR.COST") or {}
    cost.save(update_fields=("workflow_snapshot",))
    audit(request, cost, "CREATE", after={"status": cost.status, "number": cost.number})
    return cost


@transaction.atomic
def update_purchase_cost(cost, request, data):
    """Update an existing cost in DRAFT or REJECTED status (BR-PUR-CST-03, AF-11)."""
    if cost.status not in (models.DocumentStatus.DRAFT, models.DocumentStatus.REJECTED):
        raise ValidationError("Chỉ chứng từ Nháp hoặc Bị từ chối mới được sửa nội dung nghiệp vụ.")

    before_status = cost.status
    header_data = validate_cost_header(data, cost.company, current_cost_id=cost.pk)
    cleaned_lines = validate_cost_lines_payload(cost, data.get("lines", []))

    cost.document_date = header_data["document_date"]
    cost.posting_date = header_data["posting_date"]
    cost.supplier = header_data["supplier"]
    cost.payment_type = header_data["payment_type"]
    cost.payment_account = header_data["payment_account"]
    cost.supplier_invoice = header_data["supplier_invoice"]
    cost.notes = data.get("notes", cost.notes) or data.get("description", cost.notes)
    cost.attachments = data.get("attachments", cost.attachments)

    # AF-11: Increment version when updating rejected document
    if before_status == models.DocumentStatus.REJECTED:
        cost.version += 1
        cost.status = models.DocumentStatus.DRAFT
        cost.rejection_reason = ""

    cost.save(update_fields=(
        "document_date", "posting_date", "supplier", "payment_type",
        "payment_account", "supplier_invoice", "notes", "attachments",
        "version", "status", "rejection_reason", "updated_at",
    ))

    cost.related_orders.set(header_data["valid_orders"])
    cost.related_goods_purchases.set(header_data["valid_gps"])

    save_cost_lines(cost, cleaned_lines)
    audit(request, cost, "EDIT", {"status": before_status}, {"status": cost.status})
    return cost


@transaction.atomic
def submit_purchase_cost(cost, request):
    """Submit purchase cost for approval (Steps 34-41, AF-09)."""
    if cost.status not in (models.DocumentStatus.DRAFT, models.DocumentStatus.REJECTED):
        raise ValidationError("Chỉ chứng từ Nháp hoặc Bị từ chối mới được gửi phê duyệt.")

    lines = list(cost.lines.all())
    # EF-10, Step 38: Kiểm tra ít nhất một dòng hợp lệ và tổng tiền > 0
    if not lines or cost.total_amount <= Decimal("0"):
        raise ValidationError("Chứng từ phải có ít nhất một dòng chi phí hợp lệ.")

    # EF-09: Kiểm tra kỳ kế toán
    try:
        pinfo = determine_period_for_date(cost.company, cost.posting_date)
        period = pinfo.get("period") if isinstance(pinfo, dict) else pinfo
        if not period or getattr(period, "status", "") != "OPEN":
            raise ValidationError("Ngày hạch toán thuộc kỳ kế toán đã khóa.")
    except ValidationError as e:
        if "Ngày hạch toán thuộc kỳ kế toán đã khóa." in str(e):
            raise
        raise ValidationError("Ngày hạch toán thuộc kỳ kế toán đã khóa.")
    except Exception:
        raise ValidationError("Ngày hạch toán thuộc kỳ kế toán đã khóa.")

    # EF-04: Kiểm tra chứng từ mua liên quan còn hợp lệ
    orders = list(cost.related_orders.all())
    gps = list(cost.related_goods_purchases.all())
    if not orders and not gps:
        raise ValidationError("Chứng từ chi phí phải liên kết với ít nhất một đơn mua hoặc chứng từ mua hàng hóa.")

    for o in orders:
        if o.status in (models.DocumentStatus.DRAFT, models.DocumentStatus.CANCELLED):
            raise ValidationError("Chứng từ mua được chọn không còn đủ điều kiện liên kết.")
    for gp in gps:
        if gp.status in (models.DocumentStatus.DRAFT, models.DocumentStatus.CANCELLED):
            raise ValidationError("Chứng từ mua được chọn không còn đủ điều kiện liên kết.")

    # EF-05: Kiểm tra hóa đơn không bị dùng trùng
    if cost.supplier_invoice_id:
        if models.PurchaseCost.objects.filter(
            supplier_invoice=cost.supplier_invoice
        ).exclude(pk=cost.pk).exclude(status=models.DocumentStatus.CANCELLED).exists():
            raise ValidationError("Hóa đơn đầu vào đã được sử dụng cho chứng từ khác.")

    snapshot = cost.workflow_snapshot or configured_snapshot(cost, "PUR.COST") or {}
    cost.workflow_snapshot = snapshot

    # AF-09: Doanh nghiệp không áp dụng phê duyệt cho loại chứng từ này
    allow_direct = snapshot.get("allow_creator_posting", False) or not snapshot.get("steps")
    before = cost.status
    if allow_direct:
        cost.status = models.DocumentStatus.APPROVED
        cost.approved_at = timezone.now()
    else:
        cost.status = models.DocumentStatus.PENDING_APPROVAL

    cost.save(update_fields=("status", "approved_at", "workflow_snapshot", "updated_at"))
    audit(request, cost, "SUBMIT", {"status": before}, {"status": cost.status})
    return cost


@transaction.atomic
def approve_purchase_cost(cost, request):
    """Approve purchase cost (Steps 44-46)."""
    if cost.status != models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Chứng từ đã được xử lý bởi người dùng khác.")

    before = cost.status
    cost.status = models.DocumentStatus.APPROVED
    cost.approved_at = timezone.now()
    cost.save(update_fields=("status", "approved_at", "updated_at"))

    models.ApprovalDecision.objects.create(
        company=cost.company,
        document_type="COST",
        document_id=cost.pk,
        document_version=cost.version,
        level=1,
        decision=models.ApprovalDecision.Decision.APPROVED,
        actor=actor_for(request),
        comment=request.data.get("comment", ""),
    )
    audit(request, cost, "APPROVE", {"status": before}, {"status": cost.status})
    return cost


@transaction.atomic
def reject_purchase_cost(cost, request):
    """Reject purchase cost with mandatory reason (AF-10, BR-PUR-CST-37)."""
    if cost.status != models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Chứng từ đã được xử lý bởi người dùng khác.")

    reason = request.data.get("reason", "").strip() or request.data.get("comment", "").strip()
    # BR-PUR-CST-37: Bắt buộc nhập lý do khi từ chối
    if not reason:
        raise ValidationError({"reason": "Vui lòng nhập lý do từ chối."})

    before = cost.status
    cost.status = models.DocumentStatus.REJECTED
    cost.rejection_reason = reason
    cost.save(update_fields=("status", "rejection_reason", "updated_at"))

    models.ApprovalDecision.objects.create(
        company=cost.company,
        document_type="COST",
        document_id=cost.pk,
        document_version=cost.version,
        level=1,
        decision=models.ApprovalDecision.Decision.REJECTED,
        actor=actor_for(request),
        comment=reason,
    )
    audit(request, cost, "REJECT", {"status": before}, {"status": cost.status}, reason=reason)
    return cost


@transaction.atomic
def cancel_purchase_cost(cost, request):
    """Cancel purchase cost prior to posting (AF-12, BR-PUR-CST-05, BR-PUR-CST-40)."""
    if cost.status == "POSTED":
        raise ValidationError("Chứng từ Đã ghi sổ không được sửa trực tiếp.")
    if cost.status == models.DocumentStatus.CANCELLED:
        raise ValidationError("Chứng từ đã ở trạng thái Đã hủy.")

    reason = request.data.get("reason", "").strip() or request.data.get("comment", "").strip()
    if not reason:
        raise ValidationError({"reason": "Vui lòng nhập lý do hủy chứng từ."})

    before = cost.status
    cost.status = models.DocumentStatus.CANCELLED
    cost.cancelled_at = timezone.now()
    cost.cancelled_by = actor_for(request)
    cost.cancellation_reason = reason
    cost.save(update_fields=("status", "cancelled_at", "cancelled_by", "cancellation_reason", "updated_at"))
    audit(request, cost, "CANCEL", {"status": before}, {"status": cost.status}, reason=reason)
    return cost


@transaction.atomic
def post_purchase_cost(cost, request):
    """
    Post purchase cost (Steps 47-57).
    Creates JournalEntry and Payable in an atomic transaction (BR-PUR-CST-27 to 34, EF-15).
    """
    # BR-PUR-CST-04, EF-13: Chỉ chứng từ Đã phê duyệt mới được ghi sổ
    if cost.status != models.DocumentStatus.APPROVED:
        raise ValidationError("Chỉ chứng từ Đã phê duyệt mới được ghi sổ.")

    # EF-09: Kiểm tra kỳ kế toán
    try:
        pinfo = determine_period_for_date(cost.company, cost.posting_date)
        period = pinfo.get("period") if isinstance(pinfo, dict) else pinfo
        if not period or getattr(period, "status", "") != "OPEN":
            raise ValidationError("Ngày hạch toán thuộc kỳ kế toán đã khóa.")
    except ValidationError as e:
        if "Ngày hạch toán thuộc kỳ kế toán đã khóa." in str(e):
            raise
        raise ValidationError("Ngày hạch toán thuộc kỳ kế toán đã khóa.")
    except Exception:
        raise ValidationError("Ngày hạch toán thuộc kỳ kế toán đã khóa.")

    gl_period = AccountingPeriod.objects.filter(
        company=cost.company,
        start_date__lte=cost.posting_date,
        end_date__gte=cost.posting_date,
        status="OPEN",
    ).first()
    if not gl_period:
        raise ValidationError("Không có kỳ sổ cái đang mở cho ngày hạch toán.")

    # EF-14: Dữ liệu liên quan thay đổi sau khi phê duyệt
    for o in cost.related_orders.all():
        if o.status in (models.DocumentStatus.DRAFT, models.DocumentStatus.CANCELLED):
            raise ValidationError("Dữ liệu liên quan đã thay đổi. Vui lòng kiểm tra và phê duyệt lại chứng từ.")
    for gp in cost.related_goods_purchases.all():
        if gp.status in (models.DocumentStatus.DRAFT, models.DocumentStatus.CANCELLED):
            raise ValidationError("Dữ liệu liên quan đã thay đổi. Vui lòng kiểm tra và phê duyệt lại chứng từ.")

    # EF-07: Kiểm tra các tài khoản kế toán còn hiệu lực
    if not cost.payment_account or cost.payment_account.status != "ACTIVE":
        raise ValidationError("Tài khoản kế toán đã ngừng sử dụng. Vui lòng chọn tài khoản khác.")

    lines = list(cost.lines.select_related("account", "tax_rate"))
    for l in lines:
        if l.account.status != "ACTIVE":
            raise ValidationError("Tài khoản kế toán đã ngừng sử dụng. Vui lòng chọn tài khoản khác.")

    try:
        # Create Journal Entry (BR-PUR-CST-34, Steps 50-52)
        journal = JournalEntry.objects.create(
            company=cost.company,
            branch=cost.branch,
            period=gl_period,
            number=f"{cost.number}-GL-{cost.version}",
            entry_type="SUBLEDGER",
            posting_date=cost.posting_date,
            document_date=cost.document_date,
            description=cost.notes or f"Chi phí mua hàng {cost.number}",
            source_module="PUR",
            source_event_id=f"PUR.COST:{cost.pk}:{cost.version}",
            source_entity_type="PurchaseCost",
            source_entity_id=cost.pk,
            status="APPROVED",
            total_debit=cost.total_amount,
            total_credit=cost.total_amount,
            workflow_snapshot={"allow_creator_posting": True},
            created_by=actor_for(request),
            approved_by=actor_for(request),
            approved_at=timezone.now(),
        )

        currency = cost.company.accounting_currency
        line_idx = 0

        # Step 50: Debit cost accounts
        for l in lines:
            line_idx += 1
            JournalLine.objects.create(
                entry=journal,
                line_no=line_idx,
                account=l.account,
                debit=l.pre_tax_amount,
                currency=currency,
                party=cost.supplier,
                department=l.cost_center,
                dimensions={"expense_item_id": str(l.expense_item_id or "")},
            )

        # Step 51: Debit input VAT if applicable (BR-PUR-CST-17)
        if cost.tax_amount > Decimal("0"):
            tax_acc = get_default_tax_account(cost.company) or cost.lines.first().account
            line_idx += 1
            JournalLine.objects.create(
                entry=journal,
                line_no=line_idx,
                account=tax_acc,
                debit=cost.tax_amount,
                currency=currency,
                party=cost.supplier,
            )

        # Step 52: Credit payment/payable account
        line_idx += 1
        JournalLine.objects.create(
            entry=journal,
            line_no=line_idx,
            account=cost.payment_account,
            credit=cost.total_amount,
            currency=currency,
            party=cost.supplier,
        )

        post_journal(journal, request)
        cost.journal_entry = journal

        # Step 53: Payable for UNPAID (BR-PUR-CST-27)
        if cost.payment_type == "UNPAID":
            payable = Payable.objects.create(
                company=cost.company,
                branch=cost.branch,
                supplier=cost.supplier,
                purchase_cost=cost,
                currency=currency,
                exchange_rate=Decimal("1"),
                original_amount=cost.total_amount,
                balance=cost.total_amount,
            )
            # Reverse accessor cost.payable is automatically established

        # Step 55: Update line allocation status (BR-PUR-CST-22)
        for l in lines:
            if l.requires_allocation:
                l.allocation_status = models.CostAllocationStatus.UNALLOCATED
                l.allocated_amount = Decimal("0")
            else:
                l.allocation_status = models.CostAllocationStatus.NOT_REQUIRED
            l.save(update_fields=("allocation_status", "allocated_amount"))

        # Step 56: Update cost header status
        has_unallocated = any(l.requires_allocation for l in lines)
        cost.allocation_status = (
            models.CostAllocationStatus.UNALLOCATED if has_unallocated
            else models.CostAllocationStatus.NOT_REQUIRED
        )
        cost.status = "POSTED"
        cost.posted_at = timezone.now()
        cost.save(update_fields=("status", "posted_at", "journal_entry", "allocation_status", "updated_at"))

        # Step 57: Audit Log
        audit(request, cost, "POST", {"status": models.DocumentStatus.APPROVED}, {"status": cost.status})
        return cost

    except ValidationError:
        raise
    except Exception as exc:
        # EF-15, BR-PUR-CST-32: Rollback completely
        raise ValidationError("Ghi sổ không thành công. Không có bút toán hoặc công nợ nào được tạo.")
