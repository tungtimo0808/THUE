"""UC-SAL-04: Ghi nhận bán dịch vụ (Sales Service Document / Sales Service Invoice).

Implements:
- Header & Line creation, validation, precision calculation, and rounding (BR-SAL-04-02, BR-SAL-04-04).
- Automatic document numbering (DV-YYYY-NNNNNN) and default values prefill.
- Rejection of goods items; services only (BR-SAL-04-02, EF-03).
- Source inheritance from Sales Order (BR-SAL-04-03, AF-02).
- Service completion / acceptance verification (BR-SAL-04-05, EF-06).
- Workflow management: Submit, Withdraw, Approve, Request Revision, Reject, Cancel.
- Posting (Ghi sổ):
  * Accounting period & postable account validation (BR-SAL-04-07, EF-04, EF-05).
  * GL JournalEntry creation (Nợ 131/111/112, Có 5113/511, Có 33311) (BR-SAL-04-08).
  * No inventory / warehouse / COGS entries (BR-SAL-04-09).
  * Accounts Receivable creation when UNPAID (BR-SAL-04-08, BR-SAL-04-10).
- Unposting (Bỏ ghi sổ) and invoice linking (AF-08, BR-SAL-04-11, EF-08).
- Optimistic concurrency control and Audit Logging (BR-SAL-04-13, EF-09, EF-10).
"""
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import F, Q, Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts_receivable.models import Receivable, ReceivableStatus
from approval_workflows.execution import approval_progress
from approval_workflows.submission import configured_snapshot
from audit_log.services import record_audit
from common_services.models import DocumentNumberingRule
from general_ledger.models import Account, AccountBalance, AccountingPeriod, JournalEntry, JournalLine
from general_ledger.services import _balance as get_or_create_balance, _recalculate_closing
from general_ledger.services import post as post_journal
from master_data.models import Currency, DocumentType, Item, Party, PartyAddress, TaxRate, UnitOfMeasure
from . import models

MONEY = Decimal("0.0001")


def actor_for(request):
    """Retrieve IAM account or fallback user for audit and ownership tracking."""
    if hasattr(request, "user") and hasattr(request.user, "iam_account"):
        return request.user.iam_account
    return getattr(request, "user", None)


def audit(request, sale, action, before=None, after=None, reason=""):
    """Write an audit entry for service sales transactions."""
    actor = actor_for(request)
    if actor and hasattr(actor, "id"):
        record_audit(
            company=sale.company,
            actor_user=actor,
            module_code="SAL",
            action_code=action,
            entity=sale,
            before=before or {},
            after=after or {},
            request=request,
            reason=reason,
        )


def generate_service_sale_number(company, branch=None, document_date=None):
    """Generate unique service sale number using DocumentNumberingRule or ServiceSaleCounter."""
    ref_date = document_date or timezone.localdate()
    try:
        from common_services.numbering_services import generate_document_number
        doc_type = DocumentType.objects.filter(code__in=["SAL.SERVICE_SALE", "DV", "SALES_SERVICE"]).first()
        if doc_type:
            num = generate_document_number(company, doc_type, branch=branch, document_date=ref_date)
            if num:
                return num
    except Exception:
        pass

    year = ref_date.year
    with transaction.atomic():
        counter, _ = models.ServiceSaleCounter.objects.select_for_update().get_or_create(company=company, year=year)
        while True:
            counter.value += 1
            counter.save(update_fields=["value"])
            candidate = f"DV-{year}-{counter.value:06d}"
            if not models.ServiceSale.objects.filter(company=company, number=candidate).exists():
                return candidate


def resolve_default_accounts(company, payment_type=models.ServiceSale.PaymentType.UNPAID):
    """Resolve default postable accounts for service sales operations."""
    # Receivable / Payment
    if payment_type == models.ServiceSale.PaymentType.CASH:
        payment_acc = Account.objects.filter(company=company, code__startswith="111", is_postable=True, status="ACTIVE").order_by("code").first()
    elif payment_type == models.ServiceSale.PaymentType.BANK:
        payment_acc = Account.objects.filter(company=company, code__startswith="112", is_postable=True, status="ACTIVE").order_by("code").first()
    else:
        payment_acc = Account.objects.filter(company=company, code__startswith="131", is_postable=True, status="ACTIVE").order_by("code").first()

    revenue_acc = Account.objects.filter(company=company, code__startswith="5113", is_postable=True, status="ACTIVE").order_by("code").first()
    if not revenue_acc:
        revenue_acc = Account.objects.filter(company=company, code__startswith="511", is_postable=True, status="ACTIVE").order_by("code").first()

    tax_acc = Account.objects.filter(company=company, code__startswith="3331", is_postable=True, status="ACTIVE").order_by("code").first()

    return {
        "payment_account": payment_acc,
        "revenue_account": revenue_acc,
        "tax_account": tax_acc,
    }


def get_service_sale_defaults(company, user, customer_id=None, branch_id=None):
    """Provide default values when creating a new service sale document (Luồng chính Bước 2, 3, 4)."""
    today = timezone.localdate()
    currency = getattr(company, "accounting_currency", None) or Currency.objects.filter(code="VND").first()

    defaults = {
        "document_date": today.isoformat(),
        "posting_date": today.isoformat(),
        "currency": str(currency.id) if currency else None,
        "currency_code": currency.code if currency else "VND",
        "exchange_rate": "1",
        "payment_type": models.ServiceSale.PaymentType.UNPAID,
        "customer": None,
        "customer_address": "",
        "customer_tax_code": "",
        "payment_term": None,
        "due_date": today.isoformat(),
        "service_acceptance_required": False,
        "acceptance_document_number": "",
        "acceptance_date": None,
        "description": "Cung cấp dịch vụ",
    }

    accs = resolve_default_accounts(company, models.ServiceSale.PaymentType.UNPAID)
    defaults["default_accounts"] = {
        "receivable_or_payment_account": str(accs["payment_account"].id) if accs["payment_account"] else None,
        "revenue_account": str(accs["revenue_account"].id) if accs["revenue_account"] else None,
        "tax_account": str(accs["tax_account"].id) if accs["tax_account"] else None,
    }

    if customer_id:
        customer = Party.objects.filter(pk=customer_id, company=company).first()
        if customer:
            defaults["customer"] = str(customer.id)
            defaults["customer_tax_code"] = customer.tax_code or ""
            addr = PartyAddress.objects.filter(party=customer, is_default=True).first() or PartyAddress.objects.filter(party=customer).first()
            if addr:
                defaults["customer_address"] = addr.address_line or getattr(addr, "street_address", "")
            else:
                defaults["customer_address"] = getattr(customer, "legal_name", "") or customer.name

            if customer.payment_term:
                defaults["payment_term"] = str(customer.payment_term_id)
                due_days = customer.payment_term.due_days or 0
                defaults["due_date"] = (today + timedelta(days=due_days)).isoformat()

    return defaults


def calculate_and_validate_service_lines(company, lines_data, payment_type, currency=None):
    """Validate service items, calculate line amounts, and resolve GL accounts (BR-SAL-04-02, BR-SAL-04-04)."""
    if not lines_data:
        raise ValidationError("Chứng từ bán dịch vụ phải có ít nhất một dòng dịch vụ.")

    defaults = resolve_default_accounts(company, payment_type)
    subtotal = Decimal("0")
    discount_amount = Decimal("0")
    tax_amount = Decimal("0")
    processed_lines = []

    for idx, raw in enumerate(lines_data, start=1):
        item_id = raw.get("item") or raw.get("item_id")
        if not item_id:
            raise ValidationError(f"Dòng {idx}: Chưa chọn dịch vụ.")

        item = Item.objects.filter(pk=item_id, company=company).first()
        if not item:
            raise ValidationError(f"Dòng {idx}: Dịch vụ không tồn tại.")
        if item.status != "ACTIVE":
            raise ValidationError(f"Dòng {idx}: Dịch vụ {item.code} đã ngừng sử dụng.")

        # BR-SAL-04-02 & EF-03: Chỉ ghi nhận mặt hàng loại Dịch vụ; không chọn hàng hóa
        if item.item_type != "SERVICE":
            raise ValidationError(f"Dòng {idx}: Chỉ ghi nhận mặt hàng loại Dịch vụ (mặt hàng {item.code} là {item.get_item_type_display()}).")

        try:
            quantity = Decimal(str(raw.get("quantity", "0")))
            unit_price = Decimal(str(raw.get("unit_price", "0")))
            discount_rate = Decimal(str(raw.get("discount_rate", "0")))
        except Exception:
            raise ValidationError(f"Dòng {idx}: Số lượng, đơn giá hoặc tỷ lệ chiết khấu không hợp lệ.")

        if quantity <= 0:
            raise ValidationError(f"Dòng {idx}: Số lượng dịch vụ phải lớn hơn 0.")
        if unit_price < 0:
            raise ValidationError(f"Dòng {idx}: Đơn giá dịch vụ không được âm.")
        if discount_rate < 0 or discount_rate > 100:
            raise ValidationError(f"Dòng {idx}: Tỷ lệ chiết khấu phải từ 0% đến 100%.")

        gross = (quantity * unit_price).quantize(MONEY, ROUND_HALF_UP)
        line_discount = (gross * discount_rate / 100).quantize(MONEY, ROUND_HALF_UP)
        if raw.get("discount_amount") is not None and not raw.get("discount_rate"):
            line_discount = Decimal(str(raw.get("discount_amount"))).quantize(MONEY, ROUND_HALF_UP)

        if line_discount > gross:
            raise ValidationError(f"Dòng {idx}: Tiền chiết khấu không được vượt quá thành tiền.")

        net = gross - line_discount

        tax_rate_id = raw.get("tax_rate") or raw.get("tax_rate_id")
        tax_rate = None
        line_tax = Decimal("0")
        if tax_rate_id:
            tax_rate = TaxRate.objects.filter(pk=tax_rate_id).first()
            if tax_rate and tax_rate.rate_percent:
                line_tax = (net * tax_rate.rate_percent / 100).quantize(MONEY, ROUND_HALF_UP)

        line_total = net + line_tax

        # Service period validation
        service_from = raw.get("service_from")
        service_to = raw.get("service_to")
        if service_from and service_to:
            dt_from = service_from if isinstance(service_from, date) else date.fromisoformat(str(service_from))
            dt_to = service_to if isinstance(service_to, date) else date.fromisoformat(str(service_to))
            if dt_to < dt_from:
                raise ValidationError(f"Dòng {idx}: Ngày kết thúc dịch vụ không được trước ngày bắt đầu.")

        # UoM
        uom_id = raw.get("uom") or raw.get("uom_id") or getattr(item, "sales_uom_id", None) or getattr(item, "base_uom_id", None)
        uom = UnitOfMeasure.objects.filter(pk=uom_id).first()
        if not uom:
            raise ValidationError(f"Dòng {idx}: Chưa xác định đơn vị tính.")

        # GL Accounts Resolution
        rec_acc_id = raw.get("receivable_or_payment_account") or raw.get("receivable_or_payment_account_id")
        rec_acc = Account.objects.filter(pk=rec_acc_id, company=company).first() if rec_acc_id else defaults["payment_account"]
        if not rec_acc or not rec_acc.is_postable or rec_acc.status != "ACTIVE":
            raise ValidationError(f"Dòng {idx}: Tài khoản thanh toán/phải thu không hợp lệ hoặc không cho phép hạch toán.")

        rev_acc_id = raw.get("revenue_account") or raw.get("revenue_account_id") or getattr(item, "revenue_account_id", None)
        rev_acc = Account.objects.filter(pk=rev_acc_id, company=company).first() if rev_acc_id else defaults["revenue_account"]
        if not rev_acc or not rev_acc.is_postable or rev_acc.status != "ACTIVE":
            raise ValidationError(f"Dòng {idx}: Tài khoản doanh thu dịch vụ không hợp lệ hoặc không cho phép hạch toán.")

        tax_acc = None
        if line_tax > 0:
            tax_acc_id = raw.get("tax_account") or raw.get("tax_account_id")
            tax_acc = Account.objects.filter(pk=tax_acc_id, company=company).first() if tax_acc_id else defaults["tax_account"]
            if not tax_acc or not tax_acc.is_postable or tax_acc.status != "ACTIVE":
                raise ValidationError(f"Dòng {idx}: Tài khoản thuế đầu ra không hợp lệ hoặc không cho phép hạch toán.")

        # Source link
        order_line_id = raw.get("order_line") or raw.get("order_line_id")
        order_line = models.SalesOrderLine.objects.filter(pk=order_line_id).first() if order_line_id else None

        processed_lines.append({
            "line_no": idx,
            "item": item,
            "description": raw.get("description") or item.name,
            "uom": uom,
            "quantity": quantity,
            "unit_price": unit_price,
            "discount_rate": discount_rate,
            "discount_amount": line_discount,
            "tax_rate": tax_rate,
            "tax_amount": line_tax,
            "line_total": line_total,
            "service_from": service_from,
            "service_to": service_to,
            "receivable_or_payment_account": rec_acc,
            "revenue_account": rev_acc,
            "tax_account": tax_acc,
            "order_line": order_line,
        })

        subtotal += gross
        discount_amount += line_discount
        tax_amount += line_tax

    total_amount = subtotal - discount_amount + tax_amount

    return {
        "lines": processed_lines,
        "subtotal": subtotal,
        "discount_amount": discount_amount,
        "tax_amount": tax_amount,
        "total_amount": total_amount,
    }


def prepare_from_sales_order(company, order_id):
    """Inherit service details from an existing confirmed Sales Order (AF-02, BR-SAL-04-03)."""
    order = models.SalesOrder.objects.filter(pk=order_id, company=company).first()
    if not order:
        raise ValidationError("Đơn bán hàng nguồn không tồn tại.")
    if order.status in {models.DocumentStatus.CANCELLED, models.DocumentStatus.DRAFT, models.DocumentStatus.REJECTED}:
        raise ValidationError(f"Đơn bán hàng phải ở trạng thái Đã xác nhận (trạng thái hiện tại: {order.get_status_display()}).")

    lines_out = []
    for line in order.lines.select_related("item", "uom", "tax_rate").all():
        if line.item.item_type != "SERVICE":
            continue
        used = models.ServiceSaleLine.objects.filter(order_line=line).exclude(sale__status=models.DocumentStatus.CANCELLED).aggregate(t=Sum("quantity"))["t"] or Decimal("0")
        rem = line.quantity - used
        if rem > 0:
            lines_out.append({
                "order_line": str(line.id),
                "item": str(line.item_id),
                "item_code": line.item.code,
                "item_name": line.item.name,
                "description": line.description or line.item.name,
                "uom": str(line.uom_id),
                "uom_name": line.uom.name,
                "quantity": str(rem),
                "unit_price": str(line.unit_price),
                "discount_rate": str(line.discount_rate),
                "tax_rate": str(line.tax_rate_id) if line.tax_rate_id else None,
            })

    if not lines_out:
        raise ValidationError("Đơn bán hàng không còn dòng dịch vụ nào chưa ghi nhận bán hàng.")

    addr = order.customer_address
    if not addr:
        first_addr = PartyAddress.objects.filter(party=order.customer).first()
        addr = first_addr.address_line if first_addr else order.customer.name

    return {
        "company": str(company.id),
        "customer": str(order.customer_id),
        "customer_name": order.customer.name,
        "customer_address": addr,
        "customer_tax_code": order.customer.tax_code or "",
        "sales_order": str(order.id),
        "sales_order_number": order.number,
        "currency": str(order.currency_id),
        "currency_code": order.currency.code,
        "exchange_rate": str(order.exchange_rate),
        "payment_term": str(order.payment_term_id) if order.payment_term_id else None,
        "lines": lines_out,
    }


@transaction.atomic
def create_service_sale(request, validated_data, lines_data):
    """Create a new ServiceSale record and lines in DRAFT status."""
    company = validated_data["company"]
    customer = validated_data["customer"]
    payment_type = validated_data.get("payment_type", models.ServiceSale.PaymentType.UNPAID)

    if customer.company_id != company.id or customer.status != "ACTIVE":
        raise ValidationError("Khách hàng không hợp lệ hoặc đã ngừng hoạt động.")

    if payment_type == models.ServiceSale.PaymentType.BANK and not validated_data.get("company_bank_account"):
        raise ValidationError({"company_bank_account": "Bắt buộc chọn tài khoản ngân hàng khi thanh toán qua ngân hàng."})

    calc = calculate_and_validate_service_lines(
        company=company,
        lines_data=lines_data,
        payment_type=payment_type,
        currency=validated_data.get("currency"),
    )

    doc_date = validated_data.get("document_date") or timezone.localdate()
    posting_date = validated_data.get("posting_date") or doc_date

    number = validated_data.get("number")
    if not number:
        number = generate_service_sale_number(company, branch=validated_data.get("branch"), document_date=doc_date)

    sale = models.ServiceSale.objects.create(
        company=company,
        branch=validated_data.get("branch"),
        number=number,
        document_date=doc_date,
        posting_date=posting_date,
        customer=customer,
        customer_address=validated_data.get("customer_address") or "",
        customer_tax_code=validated_data.get("customer_tax_code") or customer.tax_code or "",
        sales_order=validated_data.get("sales_order"),
        currency=validated_data.get("currency"),
        exchange_rate=validated_data.get("exchange_rate", Decimal("1")),
        payment_type=payment_type,
        payment_term=validated_data.get("payment_term"),
        due_date=validated_data.get("due_date"),
        company_bank_account=validated_data.get("company_bank_account"),
        service_acceptance_required=validated_data.get("service_acceptance_required", False),
        acceptance_document_number=validated_data.get("acceptance_document_number", ""),
        acceptance_date=validated_data.get("acceptance_date"),
        tax_invoice=validated_data.get("tax_invoice"),
        subtotal=calc["subtotal"],
        discount_amount=calc["discount_amount"],
        tax_amount=calc["tax_amount"],
        total_amount=calc["total_amount"],
        status=models.DocumentStatus.DRAFT,
        description=validated_data.get("description", "Cung cấp dịch vụ"),
        notes=validated_data.get("notes", ""),
        attachments=validated_data.get("attachments", []),
        created_by=actor_for(request),
        version=1,
    )

    for item_calc in calc["lines"]:
        models.ServiceSaleLine.objects.create(sale=sale, **item_calc)

    audit(request, sale, "CREATE", after={"number": sale.number, "total_amount": str(sale.total_amount)})
    return sale


@transaction.atomic
def update_service_sale(request, sale, validated_data, lines_data=None):
    """Update ServiceSale header & lines with optimistic locking (BR-SAL-04-12, EF-09, EF-10)."""
    sale = models.ServiceSale.objects.select_for_update().get(pk=sale.pk)

    # EF-10: Sửa/hủy trực tiếp chứng từ Đã ghi sổ -> Chặn
    if sale.status == models.DocumentStatus.POSTED:
        raise ValidationError("Không thể sửa chứng từ Đã ghi sổ. Vui lòng bỏ ghi sổ hoặc thực hiện quy trình điều chỉnh.")
    if sale.status not in {models.DocumentStatus.DRAFT, models.DocumentStatus.REVISION_REQUIRED, models.DocumentStatus.REJECTED}:
        raise ValidationError(f"Không thể sửa chứng từ ở trạng thái {sale.get_status_display()}.")

    # EF-09: Optimistic Locking
    client_version = request.data.get("version")
    if client_version is not None and int(client_version) != sale.version:
        raise ValidationError("Chứng từ vừa được người khác cập nhật. Vui lòng tải lại trang.")

    company = sale.company
    customer = validated_data.get("customer", sale.customer)
    payment_type = validated_data.get("payment_type", sale.payment_type)

    if lines_data is not None:
        calc = calculate_and_validate_service_lines(
            company=company,
            lines_data=lines_data,
            payment_type=payment_type,
            currency=validated_data.get("currency", sale.currency),
        )
        sale.lines.all().delete()
        for item_calc in calc["lines"]:
            models.ServiceSaleLine.objects.create(sale=sale, **item_calc)
        sale.subtotal = calc["subtotal"]
        sale.discount_amount = calc["discount_amount"]
        sale.tax_amount = calc["tax_amount"]
        sale.total_amount = calc["total_amount"]

    sale.customer = customer
    sale.customer_address = validated_data.get("customer_address", sale.customer_address)
    sale.customer_tax_code = validated_data.get("customer_tax_code", sale.customer_tax_code)
    sale.document_date = validated_data.get("document_date", sale.document_date)
    sale.posting_date = validated_data.get("posting_date", sale.posting_date)
    sale.payment_type = payment_type
    sale.sales_order = validated_data.get("sales_order", sale.sales_order)
    sale.payment_term = validated_data.get("payment_term", sale.payment_term)
    sale.due_date = validated_data.get("due_date", sale.due_date)
    sale.company_bank_account = validated_data.get("company_bank_account", sale.company_bank_account)
    sale.service_acceptance_required = validated_data.get("service_acceptance_required", sale.service_acceptance_required)
    sale.acceptance_document_number = validated_data.get("acceptance_document_number", sale.acceptance_document_number)
    sale.acceptance_date = validated_data.get("acceptance_date", sale.acceptance_date)
    sale.tax_invoice = validated_data.get("tax_invoice", sale.tax_invoice)
    sale.description = validated_data.get("description", sale.description)
    sale.notes = validated_data.get("notes", sale.notes)
    sale.attachments = validated_data.get("attachments", sale.attachments)
    sale.version += 1
    sale.save()

    audit(request, sale, "EDIT", after={"version": sale.version, "total_amount": str(sale.total_amount)})
    return sale


@transaction.atomic
def submit_service_sale(request, sale, comment=""):
    """Submit service sale document for workflow approval (Luồng chính Bước 8, BR-SAL-04-06)."""
    sale = models.ServiceSale.objects.select_for_update().get(pk=sale.pk)
    if sale.status not in {models.DocumentStatus.DRAFT, models.DocumentStatus.REVISION_REQUIRED, models.DocumentStatus.REJECTED}:
        raise ValidationError(f"Không thể gửi duyệt chứng từ ở trạng thái {sale.get_status_display()}.")

    if not sale.lines.exists():
        raise ValidationError("Chứng từ bán dịch vụ phải có ít nhất một dòng dịch vụ.")

    configured = configured_snapshot(sale, "SAL.SERVICE_SALE")
    requires_approval = True
    if configured is not None:
        sale.workflow_snapshot = configured
        requires_approval = configured.get("approval_required", True)
    else:
        sale.approval_required = True

    before = sale.status
    if requires_approval:
        sale.status = models.DocumentStatus.PENDING_APPROVAL
        sale.submitted_at = timezone.now()
        models.ApprovalDecision.objects.create(
            company=sale.company,
            document_type="SERVICE_SALE",
            document_id=sale.pk,
            decision="SUBMITTED",
            actor=actor_for(request),
            comment=comment,
        )
    else:
        sale.status = models.DocumentStatus.APPROVED
        sale.approved_at = timezone.now()
        models.ApprovalDecision.objects.create(
            company=sale.company,
            document_type="SERVICE_SALE",
            document_id=sale.pk,
            decision="APPROVED",
            actor=actor_for(request),
            comment="Tự động phê duyệt (Doanh nghiệp không yêu cầu quy trình duyệt)",
        )

    sale.version += 1
    sale.save()
    audit(request, sale, "SUBMIT", {"status": before}, {"status": sale.status}, reason=comment)
    return sale


@transaction.atomic
def withdraw_service_sale(request, sale, reason=""):
    """Withdraw a submitted service sale document back to DRAFT (AF-05)."""
    sale = models.ServiceSale.objects.select_for_update().get(pk=sale.pk)
    if sale.status != models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Chỉ chứng từ Chờ duyệt mới có thể thu hồi.")

    before = sale.status
    sale.status = models.DocumentStatus.DRAFT
    sale.withdrawal_reason = reason
    sale.version += 1
    sale.save(update_fields=["status", "withdrawal_reason", "version", "updated_at"])

    models.ApprovalDecision.objects.create(
        company=sale.company,
        document_type="SERVICE_SALE",
        document_id=sale.pk,
        decision="WITHDRAWN",
        actor=actor_for(request),
        comment=reason,
    )
    audit(request, sale, "WITHDRAW", {"status": before}, {"status": sale.status}, reason=reason)
    return sale


@transaction.atomic
def decide_service_sale(request, sale, decision, comment=""):
    """Handle approval decisions: APPROVED, REVISION_REQUIRED, REJECTED (AF-06)."""
    sale = models.ServiceSale.objects.select_for_update().get(pk=sale.pk)
    if sale.status != models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Chứng từ không ở trạng thái Chờ duyệt.")

    if decision in {"REJECTED", "REVISION_REQUIRED"} and not comment.strip():
        raise ValidationError({"reason": "Vui lòng nhập lý do/ý kiến khi từ chối hoặc yêu cầu sửa đổi."})

    decisions = models.ApprovalDecision.objects.filter(document_type="SERVICE_SALE", document_id=sale.pk)
    current_level = decisions.filter(decision="APPROVED").count() + 1

    next_status = decision
    if sale.workflow_snapshot.get("version_id"):
        progress = approval_progress(sale, actor_for(request), decision == "APPROVED", decisions)
        if progress:
            current_level = progress["level"]
            if decision == "APPROVED" and not progress["final"]:
                next_status = models.DocumentStatus.PENDING_APPROVAL

    before = sale.status
    sale.status = next_status
    if next_status == models.DocumentStatus.APPROVED:
        sale.approved_at = timezone.now()
    elif next_status == models.DocumentStatus.REJECTED:
        sale.rejection_reason = comment

    sale.version += 1
    sale.save()

    models.ApprovalDecision.objects.create(
        company=sale.company,
        document_type="SERVICE_SALE",
        document_id=sale.pk,
        level=current_level,
        decision="APPROVED" if next_status in {models.DocumentStatus.APPROVED, models.DocumentStatus.PENDING_APPROVAL} else decision,
        actor=actor_for(request),
        comment=comment,
    )
    audit(request, sale, decision, {"status": before}, {"status": sale.status}, reason=comment)
    return sale


@transaction.atomic
def cancel_service_sale(request, sale, reason=""):
    """Cancel a service sale document (AF-07)."""
    sale = models.ServiceSale.objects.select_for_update().get(pk=sale.pk)
    if sale.status == models.DocumentStatus.POSTED:
        raise ValidationError("Không thể hủy trực tiếp chứng từ Đã ghi sổ. Vui lòng bỏ ghi sổ trước (EF-10).")
    if sale.status == models.DocumentStatus.CANCELLED:
        raise ValidationError("Chứng từ đã bị hủy trước đó.")

    before = sale.status
    sale.status = models.DocumentStatus.CANCELLED
    sale.cancellation_reason = reason
    sale.version += 1
    sale.save(update_fields=["status", "cancellation_reason", "version", "updated_at"])
    audit(request, sale, "CANCEL", {"status": before}, {"status": sale.status}, reason=reason)
    return sale


def _validate_service_posting_preconditions(sale):
    """Validate accounting period, postable accounts, and acceptance record (EF-04, EF-05, EF-06, BR-SAL-04-05, BR-SAL-04-07)."""
    # 1. Accounting Period Check (EF-04, BR-SAL-04-07)
    period = AccountingPeriod.objects.filter(
        company=sale.company,
        start_date__lte=sale.posting_date,
        end_date__gte=sale.posting_date,
        status="OPEN"
    ).first()
    if not period:
        raise ValidationError("Kỳ kế toán đã bị khóa hoặc chưa mở cho ngày hạch toán (EF-04).")

    # 2. Account Validity Check (EF-05, BR-SAL-04-07)
    lines = list(sale.lines.select_related(
        "item", "receivable_or_payment_account", "revenue_account", "tax_account"
    ).all())

    for line in lines:
        for acc_field, acc in (
            ("receivable_or_payment_account", line.receivable_or_payment_account),
            ("revenue_account", line.revenue_account),
            ("tax_account", line.tax_account),
        ):
            if acc:
                if acc.company_id != sale.company_id or not acc.is_postable or acc.status != "ACTIVE":
                    raise ValidationError(f"Tài khoản {acc.code} trên dòng {line.line_no} không hợp lệ hoặc đã ngừng sử dụng (EF-05).")

    # 3. Source Remaining Balance Check (BR-SAL-04-03, EF-07)
    for line in lines:
        if line.order_line:
            used = models.ServiceSaleLine.objects.filter(order_line=line.order_line).exclude(sale__status=models.DocumentStatus.CANCELLED).exclude(sale=sale).aggregate(t=Sum("quantity"))["t"] or Decimal("0")
            remaining = line.order_line.quantity - used
            if line.quantity > remaining:
                raise ValidationError(f"Số lượng bán ({line.quantity}) vượt phần còn lại của đơn hàng ({remaining}) (EF-07).")

    # 4. Service Acceptance Verification (BR-SAL-04-05, EF-06)
    requires_acc = sale.service_acceptance_required or any(getattr(line.item, "requires_service_acceptance", False) for line in lines)
    if requires_acc:
        if not sale.acceptance_document_number and not sale.acceptance_date:
            raise ValidationError("Bắt buộc có hồ sơ/biên bản nghiệm thu dịch vụ trước khi ghi sổ (EF-06, BR-SAL-04-05).")

    return period, lines


@transaction.atomic
def post_service_sale(request, sale):
    """Post ServiceSale: creates GL entries, registers receivable (Luồng chính Bước 9-10)."""
    sale = models.ServiceSale.objects.select_for_update().get(pk=sale.pk)
    if sale.status == models.DocumentStatus.POSTED:
        raise ValidationError("Chứng từ đã được ghi sổ trước đó.")

    # Check approval state: must be APPROVED, or allow direct posting from DRAFT if workflow not configured
    if sale.status != models.DocumentStatus.APPROVED:
        if sale.status == models.DocumentStatus.DRAFT and not sale.approval_required:
            pass  # Direct posting allowed
        else:
            raise ValidationError(f"Chỉ chứng từ Đã duyệt mới có thể ghi sổ (trạng thái hiện tại: {sale.get_status_display()}).")

    period, lines = _validate_service_posting_preconditions(sale)

    # BR-SAL-04-09: Không tạo phiếu xuất kho hoặc bút toán giảm tồn kho
    total_debit = sale.total_amount
    total_credit = sale.total_amount

    journal = JournalEntry.objects.create(
        company=sale.company,
        branch=sale.branch,
        period=period,
        number=f"{sale.number}-GL",
        entry_type="SUBLEDGER",
        posting_date=sale.posting_date,
        document_date=sale.document_date,
        description=sale.description or f"Doanh thu dịch vụ {sale.number}",
        source_module="SAL",
        source_event_id=f"SAL.SERVICE:{sale.pk}:{sale.version}",
        source_entity_type="ServiceSale",
        source_entity_id=sale.pk,
        status="APPROVED",
        total_debit=total_debit,
        total_credit=total_credit,
        workflow_snapshot={"allow_creator_posting": True},
        created_by=actor_for(request),
        approved_by=actor_for(request),
        approved_at=timezone.now(),
    )

    gl_line_no = 0
    # Debit 1: Receivable or Cash or Bank
    gl_line_no += 1
    first_payment_acc = lines[0].receivable_or_payment_account
    dims = {}
    if sale.payment_type == models.ServiceSale.PaymentType.BANK and sale.company_bank_account_id:
        dims["bank_account"] = str(sale.company_bank_account_id)
        dims["bank_account_id"] = str(sale.company_bank_account_id)

    JournalLine.objects.create(
        entry=journal,
        line_no=gl_line_no,
        account=first_payment_acc,
        description=f"Thanh toán/Phải thu dịch vụ - {sale.number}",
        debit=sale.total_amount,
        credit=Decimal("0"),
        currency=sale.currency,
        party=sale.customer,
        dimensions=dims,
    )

    # Credits: Revenue and Tax
    for line in lines:
        line_net = (line.quantity * line.unit_price) - line.discount_amount
        if line_net > 0:
            gl_line_no += 1
            JournalLine.objects.create(
                entry=journal,
                line_no=gl_line_no,
                account=line.revenue_account,
                description=f"Doanh thu dịch vụ {line.item.code} - {sale.number}",
                debit=Decimal("0"),
                credit=line_net,
                currency=sale.currency,
                party=sale.customer,
            )

        if line.tax_amount > 0 and line.tax_account:
            gl_line_no += 1
            JournalLine.objects.create(
                entry=journal,
                line_no=gl_line_no,
                account=line.tax_account,
                description=f"Thuế GTGT đầu ra {line.item.code} - {sale.number}",
                debit=Decimal("0"),
                credit=line.tax_amount,
                currency=sale.currency,
                party=sale.customer,
            )

    post_journal(journal, request)
    sale.journal_entry = journal

    # Create Accounts Receivable record if UNPAID
    if sale.payment_type == models.ServiceSale.PaymentType.UNPAID:
        receivable = Receivable.objects.create(
            company=sale.company,
            branch=sale.branch,
            customer=sale.customer,
            currency=sale.currency,
            exchange_rate=sale.exchange_rate,
            account=first_payment_acc,
            original_amount=sale.total_amount,
            balance=sale.total_amount,
            due_date=sale.due_date,
            payment_term=sale.payment_term,
            document_date=sale.document_date,
            posting_date=sale.posting_date,
            journal_entry=journal,
            sales_order=sale.sales_order,
            description=sale.description or f"Phải thu bán dịch vụ {sale.number}",
            source_document_type="SERVICE_SALE",
            source_document_id=str(sale.id),
            source_document_number=sale.number,
            status=ReceivableStatus.OPEN,
            created_by=actor_for(request),
        )
        sale.receivable = receivable

    sale.status = models.DocumentStatus.POSTED
    sale.posted_at = timezone.now()
    sale.posted_by = actor_for(request)
    sale.version += 1
    sale.save()

    audit(request, sale, "POST", after={"status": sale.status, "journal_id": str(journal.id)})
    return sale


@transaction.atomic
def unpost_service_sale(request, sale, reason=""):
    """Unpost ServiceSale: reverses journal entries and receivable."""
    sale = models.ServiceSale.objects.select_for_update().get(pk=sale.pk)
    if sale.status != models.DocumentStatus.POSTED:
        raise ValidationError("Chỉ chứng từ Đã ghi sổ mới có thể thực hiện bỏ ghi sổ.")

    # Check open period
    period = AccountingPeriod.objects.filter(
        company=sale.company,
        start_date__lte=sale.posting_date,
        end_date__gte=sale.posting_date,
        status="OPEN"
    ).first()
    if not period:
        raise ValidationError("Kỳ kế toán đã bị khóa, không thể bỏ ghi sổ.")

    # Check receivable payments
    if sale.receivable:
        if sale.receivable.collected_amount > 0 or sale.receivable.netted_amount > 0:
            raise ValidationError("Khoản phải thu đã phát sinh thu tiền hoặc cấn trừ, không thể bỏ ghi sổ.")
        rec = sale.receivable
        sale.receivable = None
        sale.save(update_fields=["receivable"])
        rec.delete()

    # Revert GL balances and delete journal entry
    if sale.journal_entry:
        entry = sale.journal_entry
        for line in entry.lines.all():
            bal = AccountBalance.objects.filter(period=entry.period, account=line.account, branch=entry.branch).first()
            if bal:
                bal.period_debit = max(bal.period_debit - line.debit, Decimal("0"))
                bal.period_credit = max(bal.period_credit - line.credit, Decimal("0"))
                _recalculate_closing(bal)
                bal.save(update_fields=["period_debit", "period_credit", "closing_debit", "closing_credit", "updated_at"])
        sale.journal_entry = None
        sale.save(update_fields=["journal_entry"])
        entry.delete()

    before = sale.status
    sale.status = models.DocumentStatus.APPROVED
    sale.posted_at = None
    sale.posted_by = None
    sale.version += 1
    sale.save()

    audit(request, sale, "UNPOST", {"status": before}, {"status": sale.status}, reason=reason)
    return sale


@transaction.atomic
def link_tax_invoice(request, sale, invoice_id, notes=""):
    """Link an output tax invoice to the service sale document (AF-08, BR-SAL-04-11, EF-08)."""
    sale = models.ServiceSale.objects.select_for_update().get(pk=sale.pk)
    from tax_management.models import TaxInvoice

    invoice = TaxInvoice.objects.filter(pk=invoice_id, company=sale.company).first()
    if not invoice:
        raise ValidationError("Hóa đơn không tồn tại.")
    if invoice.direction != "OUTPUT":
        raise ValidationError("Chỉ được liên kết hóa đơn đầu ra (OUTPUT).")
    if invoice.party_id != sale.customer_id:
        raise ValidationError("Hóa đơn không cùng khách hàng với chứng từ bán dịch vụ.")
    if invoice.currency_id != sale.currency_id:
        raise ValidationError("Loại tiền trên hóa đơn không khớp với chứng từ.")

    diff = abs(invoice.total_amount - sale.total_amount)
    if diff > Decimal("1.0"):
        raise ValidationError(f"Tổng tiền hóa đơn ({invoice.total_amount}) không khớp với tổng thanh toán chứng từ ({sale.total_amount}). Chênh lệch: {diff} (EF-08).")

    sale.tax_invoice = invoice
    sale.invoice_link_notes = notes
    sale.version += 1
    sale.save(update_fields=["tax_invoice", "invoice_link_notes", "version", "updated_at"])

    audit(request, sale, "LINK_INVOICE", after={"tax_invoice_id": str(invoice.id), "notes": notes})
    return sale
