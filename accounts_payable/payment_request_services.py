import os
from datetime import date, datetime
from decimal import Decimal

from django.db import connection, transaction
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from audit_log.services import record_audit
from common_services.models import Notification
from iam.models import UserAccount
from iam.permissions import has_effective_permission
from master_data.models import CompanyBankAccount, Currency, Party, PartyBankAccount
from organization.models import Company
from purchases.models import PurchaseContract, PurchaseOrder
from . import models


ALLOWED_ATTACHMENT_EXTENSIONS = {
    "pdf", "png", "jpg", "jpeg", "doc", "docx", "xls", "xlsx"
}
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


def generate_payment_request_number(company, requested_date=None, is_preview=False):
    """
    Generate request number strictly following BR-AP-REQ-03, 04, 05, 06:
    - Format: DNTT-YYYYMM-NNNNNN
    - Counter managed per company and reset every month.
    - Locked counter (SELECT FOR UPDATE) to prevent duplicate codes.
    - Numbers are never reused even if canceled or aborted.
    """
    if isinstance(requested_date, str):
        try:
            requested_date = date.fromisoformat(requested_date)
        except ValueError:
            requested_date = timezone.localdate()
    elif not isinstance(requested_date, (date, datetime)):
        requested_date = timezone.localdate()

    year = requested_date.year
    month = requested_date.month
    prefix = f"DNTT-{year}{month:02d}-"

    # Acquire lock on Company row to guarantee atomic serialization within company
    if not is_preview and connection.features.has_select_for_update:
        Company.objects.select_for_update().get(pk=company.pk)

    last = (
        models.PaymentRequest.objects.filter(company=company, number__startswith=prefix)
        .order_by("-number")
        .values_list("number", flat=True)
        .first()
    )

    seq = 1
    if last and len(last) > len(prefix):
        suffix = last[len(prefix):]
        if suffix.isdigit():
            seq = int(suffix) + 1

    return f"{prefix}{seq:06d}"


def get_eligible_payables_for_supplier(company, supplier_id, exclude_request_id=None):
    """
    Steps 14-21, BR-14..24:
    Get payables for supplier that are posted, open/partially paid/overdue,
    and have available_amount > 0.
    """
    try:
        supplier = Party.objects.get(pk=supplier_id, company=company)
    except (Party.DoesNotExist, ValueError):
        raise ValidationError({"supplier": "Nhà cung cấp không tồn tại hoặc không thuộc doanh nghiệp."})

    if supplier.status != "ACTIVE":
        raise ValidationError({"supplier": "Nhà cung cấp không còn hoạt động. Vui lòng chọn nhà cung cấp khác."})

    payables = (
        models.Payable.objects.filter(
            company=company,
            supplier=supplier,
            status__in=[models.PayableStatus.OPEN, models.PayableStatus.PARTIALLY_PAID, models.PayableStatus.OVERDUE],
            balance__gt=0,
        )
        .select_related("document", "invoice", "goods_purchase", "purchase_cost", "currency")
        .order_by("due_date", "created_at")
    )

    items = []
    for p in payables:
        # Step 16: Ensure payable is from posted document
        if p.document and p.document.status != models.DocumentStatus.POSTED:
            continue

        active_lines = models.PaymentRequestLine.objects.filter(
            payable=p,
            request__status__in=[
                models.PaymentRequestStatus.PENDING_APPROVAL,
                models.PaymentRequestStatus.APPROVED,
                models.PaymentRequestStatus.PARTIALLY_PAID,
            ],
        )
        if exclude_request_id:
            active_lines = active_lines.exclude(request_id=exclude_request_id)

        pending_amount = active_lines.aggregate(s=Sum("amount"))["s"] or Decimal("0")
        remaining_amount = p.balance
        available_amount = max(Decimal("0"), remaining_amount - pending_amount)

        if available_amount <= 0:
            continue

        voucher_no = ""
        voucher_dt = None
        inv_no = ""

        if p.document:
            voucher_no = p.document.number
            voucher_dt = p.document.document_date
            if p.document.invoice:
                inv_no = p.document.invoice.invoice_number
        elif p.invoice:
            voucher_no = p.invoice.invoice_number
            voucher_dt = p.invoice.invoice_date
            inv_no = p.invoice.invoice_number
        elif p.goods_purchase:
            voucher_no = p.goods_purchase.number
            voucher_dt = p.goods_purchase.document_date
        elif p.purchase_cost:
            voucher_no = p.purchase_cost.number
            voucher_dt = p.purchase_cost.document_date

        items.append({
            "payable_id": str(p.pk),
            "voucher_number": voucher_no,
            "voucher_date": str(voucher_dt) if voucher_dt else "",
            "invoice_number": inv_no,
            "due_date": str(p.due_date) if p.due_date else "",
            "original_amount": float(p.original_amount),
            "remaining_amount": float(remaining_amount),
            "pending_amount": float(pending_amount),
            "available_amount": float(available_amount),
            "suggested_amount": float(available_amount),
            "currency_code": p.currency.code,
        })

    # Default bank account for beneficiary
    default_bank_acc = (
        supplier.bank_accounts.filter(status="ACTIVE").order_by("-is_default").first()
    )

    supplier_info = {
        "id": str(supplier.pk),
        "code": supplier.code,
        "name": supplier.name,
        "beneficiary_name": supplier.name,
        "bank_account_number": default_bank_acc.account_number if default_bank_acc else "",
        "bank_name": default_bank_acc.bank.name if default_bank_acc and default_bank_acc.bank else "",
    }

    return {
        "supplier": supplier_info,
        "items": items,
        "message": "" if items else "Nhà cung cấp không có khoản công nợ nào còn được đề nghị thanh toán.",
    }


def get_eligible_orders_for_advance(company, supplier_id, exclude_request_id=None):
    """
    AF-01, AF-02, AF-03:
    Get purchase orders and contracts eligible for supplier advance.
    """
    try:
        supplier = Party.objects.get(pk=supplier_id, company=company)
    except (Party.DoesNotExist, ValueError):
        raise ValidationError({"supplier": "Nhà cung cấp không tồn tại hoặc không thuộc doanh nghiệp."})

    if supplier.status != "ACTIVE":
        raise ValidationError({"supplier": "Nhà cung cấp không còn hoạt động. Vui lòng chọn nhà cung cấp khác."})

    orders = (
        PurchaseOrder.objects.filter(
            company=company,
            supplier=supplier,
            status=models.DocumentStatus.APPROVED,
            cancelled_at__isnull=True,
        )
        .select_related("currency")
        .order_by("-document_date", "-created_at")
    )

    items = []
    for po in orders:
        allowed_advance = max(Decimal("0"), po.total_amount - po.invoiced_amount)
        advance_paid = po.paid_amount

        active_lines = models.PaymentRequestLine.objects.filter(
            purchase_order=po,
            request__status__in=[
                models.PaymentRequestStatus.PENDING_APPROVAL,
                models.PaymentRequestStatus.APPROVED,
                models.PaymentRequestStatus.PARTIALLY_PAID,
            ],
        )
        if exclude_request_id:
            active_lines = active_lines.exclude(request_id=exclude_request_id)

        pending_amount = active_lines.aggregate(s=Sum("amount"))["s"] or Decimal("0")
        available_advance = max(Decimal("0"), allowed_advance - advance_paid - pending_amount)

        if available_advance <= 0:
            continue

        items.append({
            "order_id": str(po.pk),
            "order_number": po.number,
            "order_date": str(po.document_date),
            "contract_number": po.contract_or_quotation_no,
            "total_order_amount": float(po.total_amount),
            "allowed_advance_amount": float(allowed_advance),
            "advance_paid": float(advance_paid),
            "pending_amount": float(pending_amount),
            "available_advance_amount": float(available_advance),
            "suggested_amount": float(available_advance),
            "currency_code": po.currency.code,
        })

    default_bank_acc = supplier.bank_accounts.filter(status="ACTIVE").order_by("-is_default").first()

    supplier_info = {
        "id": str(supplier.pk),
        "code": supplier.code,
        "name": supplier.name,
        "beneficiary_name": supplier.name,
        "bank_account_number": default_bank_acc.account_number if default_bank_acc else "",
        "bank_name": default_bank_acc.bank.name if default_bank_acc and default_bank_acc.bank else "",
    }

    return {
        "supplier": supplier_info,
        "items": items,
        "message": "" if items else "Nhà cung cấp không có đơn mua hoặc hợp đồng nào đủ điều kiện tạm ứng.",
    }


def validate_payment_request_data(company, data, user, instance=None, action="SAVE_DRAFT"):
    """
    Validates all business rules (BR-07..16, EF-05..23).
    Ensures strict validation across header, payment method, approver, attachments, and lines.
    """
    errors = {}

    # 1. Required general fields (BR-07, EF-07)
    requested_date_raw = data.get("requested_date")
    if not requested_date_raw:
        errors["requested_date"] = ["Ngày đề nghị là bắt buộc."]
        req_date = None
    else:
        try:
            req_date = date.fromisoformat(str(requested_date_raw))
            # EF-13: requested_date <= today
            if req_date > timezone.localdate():
                errors["requested_date"] = ["Ngày đề nghị không được lớn hơn ngày hiện tại."]
        except ValueError:
            errors["requested_date"] = ["Ngày đề nghị không đúng định dạng YYYY-MM-DD."]
            req_date = None

    planned_date_raw = data.get("planned_payment_date")
    if not planned_date_raw:
        errors["planned_payment_date"] = ["Ngày dự kiến thanh toán là bắt buộc."]
    else:
        try:
            planned_date = date.fromisoformat(str(planned_date_raw))
            # EF-14: planned_payment_date >= requested_date
            if req_date and planned_date < req_date:
                errors["planned_payment_date"] = ["Ngày dự kiến thanh toán không được nhỏ hơn ngày đề nghị."]
        except ValueError:
            errors["planned_payment_date"] = ["Ngày dự kiến thanh toán không đúng định dạng YYYY-MM-DD."]

    # Supplier (EF-03)
    supplier_id = data.get("supplier")
    if not supplier_id:
        errors["supplier"] = ["Nhà cung cấp là bắt buộc."]
        supplier = None
    else:
        try:
            supplier = Party.objects.get(pk=supplier_id, company=company)
            if supplier.status != "ACTIVE":
                errors["supplier"] = ["Nhà cung cấp không còn hoạt động. Vui lòng chọn nhà cung cấp khác."]
        except (Party.DoesNotExist, ValueError):
            errors["supplier"] = ["Nhà cung cấp không hợp lệ."]
            supplier = None

    # Request type
    request_type = data.get("request_type", models.PaymentRequestType.DEBT_PAYMENT)
    if request_type not in models.PaymentRequestType.values:
        errors["request_type"] = ["Loại đề nghị không hợp lệ."]

    # Payment method (BR-10, BR-11, EF-10, EF-11, EF-16)
    payment_method = data.get("payment_method")
    if not payment_method or payment_method not in models.PaymentRequestMethod.values:
        errors["payment_method"] = ["Phương thức thanh toán là bắt buộc (CASH hoặc BANK_TRANSFER)."]
    elif payment_method == models.PaymentRequestMethod.CASH:
        cash_fund_id = data.get("cash_fund")
        if not cash_fund_id:
            errors["cash_fund"] = ["Vui lòng chọn quỹ tiền mặt dự kiến chi."]
        else:
            from cash_management.models import CashFund
            try:
                fund = CashFund.objects.get(pk=cash_fund_id, company=company)
                if fund.status != "ACTIVE":
                    errors["cash_fund"] = ["Quỹ hoặc tài khoản dự kiến chi không còn hoạt động."]
            except (CashFund.DoesNotExist, ValueError):
                errors["cash_fund"] = ["Quỹ hoặc tài khoản dự kiến chi không còn hoạt động."]
    elif payment_method == models.PaymentRequestMethod.BANK_TRANSFER:
        bank_acc_id = data.get("company_bank_account")
        beneficiary_acc_num = str(data.get("beneficiary_account_number", "")).strip()
        beneficiary_bank_name = str(data.get("beneficiary_bank_name", "")).strip()

        if not bank_acc_id or not beneficiary_acc_num or not beneficiary_bank_name:
            errors["bank_transfer"] = ["Vui lòng nhập đầy đủ tài khoản ngân hàng chi và thông tin tài khoản nhận."]
        else:
            try:
                c_bank = CompanyBankAccount.objects.get(pk=bank_acc_id, company=company)
                if c_bank.status != "ACTIVE":
                    errors["company_bank_account"] = ["Quỹ hoặc tài khoản dự kiến chi không còn hoạt động."]
            except (CompanyBankAccount.DoesNotExist, ValueError):
                errors["company_bank_account"] = ["Quỹ hoặc tài khoản dự kiến chi không còn hoạt động."]

    # Beneficiary name
    beneficiary_name = str(data.get("beneficiary_name", "")).strip()
    if not beneficiary_name:
        errors["beneficiary_name"] = ["Người thụ hưởng là bắt buộc."]

    # Payment content (EF-07)
    payment_content = str(data.get("payment_content", "")).strip()
    if not payment_content:
        errors["payment_content"] = ["Nội dung thanh toán không được để trống hoặc chỉ chứa khoảng trắng."]

    # Approver (BR-28, BR-29, EF-17)
    approver_id = data.get("approver")
    if not approver_id:
        errors["approver"] = ["Người phê duyệt là bắt buộc."]
    else:
        approver = get_user_account_by_identifier(approver_id)
        if not approver:
            errors["approver"] = ["Người phê duyệt không hợp lệ."]
        elif not approver.auth_user.is_active:
            errors["approver"] = ["Người phê duyệt không còn quyền xử lý đề nghị thanh toán."]
        elif approver.id == getattr(user, "id", None) or approver.auth_user_id == getattr(user, "auth_user_id", None):
            # BR-29: Requester cannot choose themselves as approver
            errors["approver"] = ["Người lập không được chọn chính mình làm người phê duyệt."]
        else:
            has_perm = (
                approver.auth_user.is_superuser
                or has_effective_permission(approver, company, "AP.PAYMENT_REQUEST.APPROVE")
            )
            if not has_perm:
                errors["approver"] = ["Người phê duyệt không còn quyền xử lý đề nghị thanh toán."]

    # Attachments validation (BR-12, EF-12, EF-21, EF-22, EF-23)
    attachments = data.get("attachments", [])
    if not isinstance(attachments, list) or len(attachments) == 0:
        errors["attachments"] = ["Vui lòng liên kết hoặc tải lên ít nhất một hồ sơ thanh toán."]
    elif len(attachments) > MAX_ATTACHMENTS_COUNT:
        errors["attachments"] = [f"Mỗi đề nghị chỉ được đính kèm tối đa {MAX_ATTACHMENTS_COUNT} tệp."]
    else:
        for idx, att in enumerate(attachments):
            if isinstance(att, dict):
                f_name = att.get("file_name", "")
                f_size = att.get("file_size", 0)
                if f_name:
                    ext = f_name.rsplit(".", 1)[-1].lower() if "." in f_name else ""
                    if ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
                        errors["attachments"] = ["Định dạng tệp không được hỗ trợ."]
                        break
                if f_size and f_size > MAX_ATTACHMENT_BYTES:
                    errors["attachments"] = ["Dung lượng mỗi tệp không được vượt quá 10 MB."]
                    break

    # Lines validation (BR-08, BR-09, EF-05, EF-06, EF-08, EF-09)
    lines_data = data.get("lines", [])
    if not lines_data or not isinstance(lines_data, list):
        errors["lines"] = ["Đề nghị phải có ít nhất một khoản cần thanh toán."]
    else:
        line_errors = []
        for idx, l in enumerate(lines_data):
            l_err = {}
            raw_amt = l.get("amount")
            try:
                amt = Decimal(str(raw_amt))
                if amt <= Decimal("0"):
                    l_err["amount"] = ["Số tiền đề nghị phải lớn hơn 0."]
            except (TypeError, ValueError):
                l_err["amount"] = ["Số tiền đề nghị không hợp lệ."]

            if request_type == models.PaymentRequestType.DEBT_PAYMENT:
                p_id = l.get("payable") or l.get("payable_id")
                if not p_id:
                    l_err["detail"] = ["Vui lòng chọn khoản công nợ và nhập số tiền đề nghị."]
                else:
                    try:
                        p = models.Payable.objects.get(pk=p_id, company=company)
                        if supplier and p.supplier_id != supplier.id:
                            l_err["payable"] = ["Khoản công nợ không thuộc nhà cung cấp đã chọn."]
                        if p.balance <= Decimal("0"):
                            l_err["payable"] = ["Khoản công nợ đã được thanh toán hết."]
                    except (models.Payable.DoesNotExist, ValueError):
                        l_err["payable"] = ["Khoản công nợ không tồn tại."]

            elif request_type == models.PaymentRequestType.SUPPLIER_ADVANCE:
                po_id = l.get("purchase_order") or l.get("purchase_order_id")
                pc_id = l.get("purchase_contract") or l.get("purchase_contract_id")
                if not po_id and not pc_id:
                    l_err["detail"] = ["Vui lòng chọn đơn mua hoặc hợp đồng và nhập số tiền tạm ứng."]

            if l_err:
                line_errors.append(l_err)

        if line_errors:
            errors["lines"] = line_errors

    if errors:
        raise ValidationError(errors)


@transaction.atomic
def save_payment_request(request, data, instance=None, action="SAVE_DRAFT"):
    """
    Main entry point for creating, updating, and submitting Payment Requests.
    Fulfills steps 40-64 of Activity Flow and handles both SAVE_DRAFT and SUBMIT actions.
    """
    from .services import actor, audit

    user = actor(request)

    merged_data = dict(data) if data else {}
    if instance:
        if "company" not in merged_data:
            merged_data["company"] = str(instance.company_id)
        if "requested_date" not in merged_data:
            merged_data["requested_date"] = str(instance.requested_date)
        if "planned_payment_date" not in merged_data:
            merged_data["planned_payment_date"] = str(instance.planned_payment_date)
        if "supplier" not in merged_data:
            merged_data["supplier"] = str(instance.supplier_id)
        if "request_type" not in merged_data:
            merged_data["request_type"] = instance.request_type
        if "payment_method" not in merged_data:
            merged_data["payment_method"] = instance.payment_method
        if "cash_fund" not in merged_data and instance.cash_fund_id:
            merged_data["cash_fund"] = str(instance.cash_fund_id)
        if "company_bank_account" not in merged_data and instance.company_bank_account_id:
            merged_data["company_bank_account"] = str(instance.company_bank_account_id)
        if "beneficiary_name" not in merged_data:
            merged_data["beneficiary_name"] = instance.beneficiary_name
        if "beneficiary_account_number" not in merged_data:
            merged_data["beneficiary_account_number"] = instance.beneficiary_account_number
        if "beneficiary_bank_name" not in merged_data:
            merged_data["beneficiary_bank_name"] = instance.beneficiary_bank_name
        if "payment_content" not in merged_data:
            merged_data["payment_content"] = instance.payment_content
        if "approver" not in merged_data and instance.approver_id:
            merged_data["approver"] = str(instance.approver_id)
        if "attachments" not in merged_data:
            merged_data["attachments"] = instance.attachments or []
        if "lines" not in merged_data:
            merged_data["lines"] = [
                {
                    "payable": str(l.payable_id) if l.payable_id else None,
                    "purchase_order": str(l.purchase_order_id) if l.purchase_order_id else None,
                    "purchase_contract": str(l.purchase_contract_id) if l.purchase_contract_id else None,
                    "amount": str(l.amount),
                    "note": l.note,
                }
                for l in instance.lines.all()
            ]
    data = merged_data

    company_id = data.get("company")
    if not company_id and instance:
        company_id = instance.company_id

    try:
        company = Company.objects.get(pk=company_id)
    except (Company.DoesNotExist, ValueError):
        raise ValidationError({"company": "Doanh nghiệp không hợp lệ."})

    # Permission check (EF-02, BR-27)
    req_perm = "AP.PAYMENT_REQUEST.CREATE" if instance is None else "AP.PAYMENT_REQUEST.EDIT"
    if not (user.auth_user.is_superuser or has_effective_permission(user, company, req_perm)):
        raise PermissionDenied("Bạn không có quyền lập đề nghị thanh toán." if instance is None else "Bạn không có quyền chỉnh sửa đề nghị thanh toán.")

    # BR-38: Only DRAFT or REJECTED can be edited
    if instance is not None and instance.status not in {
        models.PaymentRequestStatus.DRAFT,
        models.PaymentRequestStatus.REJECTED,
    }:
        raise ValidationError("Chỉ đề nghị Nháp hoặc Bị từ chối mới được sửa.")

    # Run full business rule validation
    validate_payment_request_data(company, data, user, instance=instance, action=action)

    request_type = data.get("request_type", models.PaymentRequestType.DEBT_PAYMENT)
    lines_data = data.get("lines", [])

    # Calculate total and verify lines under select_for_update (Steps 52-54, EF-18)
    total_amount = Decimal("0")
    for l in lines_data:
        total_amount += Decimal(str(l["amount"]))

    # EF-15: Total amount > 0
    if total_amount <= Decimal("0"):
        raise ValidationError({"total_amount": "Tổng số tiền đề nghị phải lớn hơn 0."})

    # Concurrency locking & amount verification (Steps 52, 53, 54, EF-18, EF-19)
    if action == "SUBMIT":
        if request_type == models.PaymentRequestType.DEBT_PAYMENT:
            payable_ids = [l.get("payable") or l.get("payable_id") for l in lines_data]
            p_qs = models.Payable.objects.filter(id__in=payable_ids)
            if connection.features.has_select_for_update:
                p_qs = p_qs.select_for_update()
            locked_payables = {str(p.pk): p for p in p_qs}

            for l in lines_data:
                p_id = str(l.get("payable") or l.get("payable_id"))
                p = locked_payables.get(p_id)
                if not p:
                    raise ValidationError("Khoản công nợ không tồn tại hoặc đã bị xóa.")

                # Re-calculate available amount
                active_lines = models.PaymentRequestLine.objects.filter(
                    payable=p,
                    request__status__in=[
                        models.PaymentRequestStatus.PENDING_APPROVAL,
                        models.PaymentRequestStatus.APPROVED,
                        models.PaymentRequestStatus.PARTIALLY_PAID,
                    ],
                )
                if instance:
                    active_lines = active_lines.exclude(request_id=instance.pk)

                pending = active_lines.aggregate(s=Sum("amount"))["s"] or Decimal("0")
                available = max(Decimal("0"), p.balance - pending)
                line_amt = Decimal(str(l["amount"]))

                # EF-06 / EF-18
                if line_amt > available:
                    raise ValidationError("Số dư công nợ đã thay đổi. Vui lòng kiểm tra lại số tiền đề nghị.")

        elif request_type == models.PaymentRequestType.SUPPLIER_ADVANCE:
            po_ids = [l.get("purchase_order") or l.get("purchase_order_id") for l in lines_data if l.get("purchase_order") or l.get("purchase_order_id")]
            if po_ids:
                po_qs = PurchaseOrder.objects.filter(id__in=po_ids)
                if connection.features.has_select_for_update:
                    po_qs = po_qs.select_for_update()
                locked_orders = {str(o.pk): o for o in po_qs}
                for l in lines_data:
                    po_id = str(l.get("purchase_order") or l.get("purchase_order_id"))
                    po = locked_orders.get(po_id)
                    if po:
                        active_lines = models.PaymentRequestLine.objects.filter(
                            purchase_order=po,
                            request__status__in=[
                                models.PaymentRequestStatus.PENDING_APPROVAL,
                                models.PaymentRequestStatus.APPROVED,
                                models.PaymentRequestStatus.PARTIALLY_PAID,
                            ],
                        )
                        if instance:
                            active_lines = active_lines.exclude(request_id=instance.pk)
                        pending = active_lines.aggregate(s=Sum("amount"))["s"] or Decimal("0")
                        allowed_advance = max(Decimal("0"), po.total_amount - po.invoiced_amount)
                        avail_adv = max(Decimal("0"), allowed_advance - po.paid_amount - pending)
                        if Decimal(str(l["amount"])) > avail_adv:
                            raise ValidationError("Số tiền tạm ứng vượt mức còn được tạm ứng của đơn mua.")

    # Number generation (Steps 55, 56, BR-03..06)
    if instance is None:
        number = generate_payment_request_number(company, requested_date=data["requested_date"])
    else:
        number = instance.number

    currency_id = data.get("currency")
    if currency_id:
        currency = Currency.objects.get(pk=currency_id)
    else:
        currency = company.accounting_currency

    target_status = (
        models.PaymentRequestStatus.PENDING_APPROVAL
        if action == "SUBMIT"
        else models.PaymentRequestStatus.DRAFT
    )

    approver = get_user_account_by_identifier(data.get("approver"))

    if instance is None:
        req_obj = models.PaymentRequest.objects.create(
            company=company,
            branch_id=data.get("branch"),
            number=number,
            request_type=request_type,
            supplier_id=data["supplier"],
            currency=currency,
            requested_date=data["requested_date"],
            planned_payment_date=data["planned_payment_date"],
            payment_method=data["payment_method"],
            cash_fund_id=data.get("cash_fund"),
            company_bank_account_id=data.get("company_bank_account"),
            beneficiary_name=data.get("beneficiary_name", "").strip(),
            beneficiary_account_number=data.get("beneficiary_account_number", "").strip(),
            beneficiary_bank_name=data.get("beneficiary_bank_name", "").strip(),
            beneficiary_account_id=data.get("beneficiary_account"),
            payment_content=data.get("payment_content", "").strip(),
            notes=data.get("notes", "").strip(),
            approver=approver,
            attachments=data.get("attachments", []),
            total_amount=total_amount,
            status=target_status,
            approval_required=True,
            created_by=user,
            submitted_at=timezone.now() if action == "SUBMIT" else None,
        )
    else:
        req_obj = instance
        req_obj.branch_id = data.get("branch", req_obj.branch_id)
        req_obj.request_type = request_type
        req_obj.supplier_id = data["supplier"]
        req_obj.currency = currency
        req_obj.requested_date = data["requested_date"]
        req_obj.planned_payment_date = data["planned_payment_date"]
        req_obj.payment_method = data["payment_method"]
        req_obj.cash_fund_id = data.get("cash_fund")
        req_obj.company_bank_account_id = data.get("company_bank_account")
        req_obj.beneficiary_name = data.get("beneficiary_name", "").strip()
        req_obj.beneficiary_account_number = data.get("beneficiary_account_number", "").strip()
        req_obj.beneficiary_bank_name = data.get("beneficiary_bank_name", "").strip()
        req_obj.beneficiary_account_id = data.get("beneficiary_account")
        req_obj.payment_content = data.get("payment_content", "").strip()
        req_obj.notes = data.get("notes", "").strip()
        req_obj.approver = approver
        req_obj.attachments = data.get("attachments", [])
        req_obj.total_amount = total_amount
        req_obj.status = target_status
        if action == "SUBMIT":
            req_obj.submitted_at = timezone.now()
            req_obj.rejection_reason = ""
        req_obj.save()
        req_obj.lines.all().delete()

    # Create lines (Step 58)
    for idx, l in enumerate(lines_data, start=1):
        amt = Decimal(str(l["amount"]))
        p_id = l.get("payable") or l.get("payable_id") if request_type == models.PaymentRequestType.DEBT_PAYMENT else None
        po_id = l.get("purchase_order") or l.get("purchase_order_id") if request_type == models.PaymentRequestType.SUPPLIER_ADVANCE else None
        pc_id = l.get("purchase_contract") or l.get("purchase_contract_id") if request_type == models.PaymentRequestType.SUPPLIER_ADVANCE else None

        models.PaymentRequestLine.objects.create(
            request=req_obj,
            line_no=idx,
            payable_id=p_id,
            purchase_order_id=po_id,
            purchase_contract_id=pc_id,
            amount=amt,
            note=l.get("note", "").strip(),
        )

    # Step 60: Send notification to Approver
    if action == "SUBMIT":
        Notification.objects.create(
            recipient=req_obj.approver,
            company=company,
            title=f"Đề nghị thanh toán cần phê duyệt: {req_obj.number}",
            message=(
                f"Đề nghị thanh toán {req_obj.number} từ {user.display_name or user.email} "
                f"cho nhà cung cấp {req_obj.supplier.name}. Tổng tiền: {req_obj.total_amount:,.2f} {req_obj.currency.code}. "
                f"Ngày dự kiến thanh toán: {req_obj.planned_payment_date}."
            ),
            level=Notification.Level.INFO,
            source_module="AP",
            entity_type="PAYMENT_REQUEST",
            entity_id=req_obj.pk,
        )

    # Step 61, BR-42: Audit Log
    audit(
        request,
        req_obj,
        "SUBMIT" if action == "SUBMIT" else "CREATE" if instance is None else "EDIT",
        before={"status": "NONE" if instance is None else instance.status},
        after={"status": req_obj.status, "number": req_obj.number, "total_amount": str(req_obj.total_amount)},
    )

    return req_obj


@transaction.atomic
def recall_payment_request(request, obj):
    """
    BR-39: User recalls a PENDING_APPROVAL request back to DRAFT before decision.
    Releases amount holding pool.
    """
    from .services import actor, audit

    user = actor(request)
    pr_qs = models.PaymentRequest.objects
    if connection.features.has_select_for_update:
        pr_qs = pr_qs.select_for_update()
    obj = pr_qs.get(pk=obj.pk)

    if obj.status != models.PaymentRequestStatus.PENDING_APPROVAL:
        raise ValidationError("Chỉ đề nghị đang Chờ phê duyệt mới được thu hồi.")

    if obj.created_by_id != user.id:
        if not (user.auth_user.is_superuser or has_effective_permission(user, obj.company, "AP.PAYMENT_REQUEST.EDIT")):
            raise PermissionDenied("Chỉ người lập đề nghị mới được thu hồi chứng từ này.")

    before = obj.status
    obj.status = models.PaymentRequestStatus.DRAFT
    obj.save(update_fields=("status", "updated_at"))

    audit(request, obj, "RECALL", before={"status": before}, after={"status": obj.status})
    return obj


@transaction.atomic
def approve_payment_request(request, obj):
    """
    Approves request. Moves status to APPROVED. Amount holding remains reserved.
    """
    from .services import actor, audit

    user = actor(request)
    pr_qs = models.PaymentRequest.objects
    if connection.features.has_select_for_update:
        pr_qs = pr_qs.select_for_update()
    obj = pr_qs.get(pk=obj.pk)

    if obj.status != models.PaymentRequestStatus.PENDING_APPROVAL:
        raise ValidationError("Chỉ đề nghị Chờ phê duyệt mới được phê duyệt.")

    if obj.created_by_id == user.id:
        raise ValidationError("Người lập không được tự phê duyệt đề nghị của chính mình.")

    if not (user.auth_user.is_superuser or has_effective_permission(user, obj.company, "AP.PAYMENT_REQUEST.APPROVE")):
        raise PermissionDenied("Bạn không có quyền phê duyệt đề nghị thanh toán.")

    before = obj.status
    obj.status = models.PaymentRequestStatus.APPROVED
    obj.approved_at = timezone.now()
    obj.save(update_fields=("status", "approved_at", "updated_at"))

    audit(request, obj, "APPROVE", before={"status": before}, after={"status": obj.status})
    return obj


@transaction.atomic
def reject_payment_request(request, obj, reason=""):
    """
    Rejects request. Moves status to REJECTED. Releases amount holding pool (BR-36).
    """
    from .services import actor, audit

    user = actor(request)
    pr_qs = models.PaymentRequest.objects
    if connection.features.has_select_for_update:
        pr_qs = pr_qs.select_for_update()
    obj = pr_qs.get(pk=obj.pk)

    if obj.status != models.PaymentRequestStatus.PENDING_APPROVAL:
        raise ValidationError("Chỉ đề nghị Chờ phê duyệt mới có thể bị từ chối.")

    if not (user.auth_user.is_superuser or has_effective_permission(user, obj.company, "AP.PAYMENT_REQUEST.REJECT")):
        raise PermissionDenied("Bạn không có quyền từ chối đề nghị thanh toán.")

    reason = str(reason).strip()
    if not reason:
        raise ValidationError({"reason": "Vui lòng nhập lý do từ chối đề nghị thanh toán."})

    before = obj.status
    obj.status = models.PaymentRequestStatus.REJECTED
    obj.rejected_at = timezone.now()
    obj.rejection_reason = reason
    obj.save(update_fields=("status", "rejected_at", "rejection_reason", "updated_at"))

    audit(request, obj, "REJECT", before={"status": before}, after={"status": obj.status}, reason=reason)
    return obj


@transaction.atomic
def cancel_payment_request(request, obj, reason=""):
    """
    Cancels request. BR-40: Cannot cancel if partially paid.
    Releases amount holding pool (BR-36). Number is not reused (BR-05).
    """
    from .services import actor, audit

    user = actor(request)
    pr_qs = models.PaymentRequest.objects
    if connection.features.has_select_for_update:
        pr_qs = pr_qs.select_for_update()
    obj = pr_qs.get(pk=obj.pk)

    if not (user.auth_user.is_superuser or has_effective_permission(user, obj.company, "AP.PAYMENT_REQUEST.CANCEL")):
        raise PermissionDenied("Bạn không có quyền hủy đề nghị thanh toán.")

    if obj.status in {models.PaymentRequestStatus.PARTIALLY_PAID, models.PaymentRequestStatus.PAID}:
        raise ValidationError("Đề nghị đã phát sinh thanh toán không được hủy trước khi hủy chứng từ thanh toán liên quan.")

    if obj.status == models.PaymentRequestStatus.CANCELED:
        raise ValidationError("Đề nghị thanh toán đã bị hủy.")

    before = obj.status
    obj.status = models.PaymentRequestStatus.CANCELED
    obj.canceled_at = timezone.now()
    obj.cancellation_reason = str(reason).strip()
    obj.save(update_fields=("status", "canceled_at", "cancellation_reason", "updated_at"))

    audit(request, obj, "CANCEL", before={"status": before}, after={"status": obj.status}, reason=reason)
    return obj
