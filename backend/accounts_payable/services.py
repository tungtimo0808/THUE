from datetime import date, datetime, timedelta
from decimal import Decimal
from django.db import transaction
from django.db.models import Sum, Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from audit_log.services import record_audit
from approval_workflows.submission import configured_snapshot
from approval_workflows.execution import approval_progress
from master_data.models import Party, PaymentTerm, Currency, TaxRate, DocumentType
from general_ledger.models import Account, AccountingPeriod, JournalEntry, JournalLine
from common_services.models import DocumentNumberingRule
from common_services.numbering_services import generate_document_number
from common_services.period_services import determine_period_for_date
from general_ledger import services as gl_services
from . import models


def actor(request): return request.user.iam_account


def audit(request, obj, action, before=None, after=None, reason=""):
    record_audit(company=obj.company, actor_user=actor(request), module_code="AP", action_code=action, entity=obj, before=before or {}, after=after or {}, request=request, reason=reason)


def document_info(obj):
    if isinstance(obj, models.SupplierInvoice):
        return ("INVOICE", obj.created_by_id, obj.workflow_snapshot)
    elif isinstance(obj, models.PayableDocument):
        return ("DOCUMENT", obj.created_by_id, obj.workflow_snapshot)
    return ("PAYMENT_REQUEST", obj.created_by_id, obj.workflow_snapshot)


@transaction.atomic
def submit(obj, request):
    obj = type(obj).objects.select_for_update().get(pk=obj.pk)
    if obj.status not in {models.DocumentStatus.DRAFT, models.DocumentStatus.REJECTED}: raise ValidationError("Trạng thái không cho phép gửi duyệt.")
    if isinstance(obj, models.SupplierInvoice) and obj.match_status == "VARIANCE": raise ValidationError("Sai lệch đối chiếu chưa được xử lý.")
    raw = request.data.get("workflow_snapshot") or {}
    try:
        levels = max(1, min(int(raw.get("levels", 1)), 20))
    except (TypeError, ValueError):
        raise ValidationError({"workflow_snapshot": "Số cấp phê duyệt phải là số nguyên từ 1 đến 20."})
    obj.workflow_snapshot = {"version": str(raw.get("version", "DEFAULT"))[:80], "levels": levels, "allow_self_approval": bool(raw.get("allow_self_approval", False))}
    dtype, _, _ = document_info(obj)
    configured = configured_snapshot(obj, f"AP.{dtype}")
    if configured is not None:
        obj.workflow_snapshot = configured
        obj.approval_required = configured["approval_required"]
    before = obj.status
    obj.status = models.DocumentStatus.PENDING_APPROVAL if obj.approval_required else models.DocumentStatus.APPROVED
    if hasattr(obj, "submitted_at"): obj.submitted_at = timezone.now()
    if hasattr(obj, "approved_at") and obj.status == models.DocumentStatus.APPROVED: obj.approved_at = timezone.now()
    obj.save()
    models.ApprovalDecision.objects.create(company=obj.company, document_type=dtype, document_id=obj.pk, decision="SUBMITTED", actor=actor(request), comment=request.data.get("comment", ""))
    audit(request, obj, "SUBMIT", {"status": before}, {"status": obj.status})
    return obj


@transaction.atomic
def decide(obj, request, approved):
    obj = type(obj).objects.select_for_update().get(pk=obj.pk)
    if obj.status != models.DocumentStatus.PENDING_APPROVAL: raise ValidationError("Chứng từ không chờ phê duyệt.")
    comment = request.data.get("comment", "").strip()
    if not approved and not comment: raise ValidationError({"comment": "Ý kiến từ chối là bắt buộc."})
    dtype, creator_id, workflow = document_info(obj)
    if creator_id == actor(request).id and not workflow.get("allow_self_approval", False): raise ValidationError("Không được tự phê duyệt.")
    level = models.ApprovalDecision.objects.filter(document_type=dtype, document_id=obj.pk, decision="APPROVED").count() + 1
    final = approved and level >= int(workflow.get("levels", 1))
    progress = approval_progress(obj, actor(request), approved,
        models.ApprovalDecision.objects.filter(document_type=dtype, document_id=obj.pk))
    if progress is not None:
        level, final = progress["level"], progress["final"]
    before = obj.status
    obj.status = models.DocumentStatus.APPROVED if final else models.DocumentStatus.PENDING_APPROVAL if approved or progress and progress["return_to_previous"] else models.DocumentStatus.REJECTED
    if hasattr(obj, "approved_at"): obj.approved_at = timezone.now() if final else None
    obj.save()
    models.ApprovalDecision.objects.create(company=obj.company, document_type=dtype, document_id=obj.pk, level=level, decision="APPROVED" if approved else "REJECTED", actor=actor(request), comment=comment)
    audit(request, obj, "APPROVE" if approved else "REJECT", {"status": before}, {"status": obj.status}, comment)
    return obj


@transaction.atomic
def match_invoice(invoice, request):
    invoice = models.SupplierInvoice.objects.select_for_update().prefetch_related("lines__purchase_order_line", "lines__receipt_line").get(pk=invoice.pk)
    if invoice.received_via_purchase:
        raise ValidationError("Hóa đơn đầu vào này được đối chiếu tại Mua hàng.")
    if invoice.status not in {models.DocumentStatus.DRAFT, models.DocumentStatus.REJECTED}: raise ValidationError("Chỉ hóa đơn nháp hoặc bị từ chối được đối chiếu.")
    mode = request.data.get("mode", "THREE_WAY")
    qty_tolerance = Decimal(str(request.data.get("quantity_tolerance_percent", 0)))
    price_tolerance = Decimal(str(request.data.get("price_tolerance_percent", 0)))
    variances = []
    for line in invoice.lines.all():
        if mode == "NONE":
            continue
        po = line.purchase_order_line
        if not po:
            variances.append({"line": line.line_no, "reason": "MISSING_PO"}); continue
        qty_diff = abs(line.quantity - po.quantity) / po.quantity * 100
        price_diff = abs(line.unit_price - po.unit_price) / po.unit_price * 100 if po.unit_price else Decimal("0")
        if qty_diff > qty_tolerance or price_diff > price_tolerance: variances.append({"line": line.line_no, "quantity_variance_percent": str(qty_diff), "price_variance_percent": str(price_diff)})
        if mode == "THREE_WAY" and not line.receipt_line_id: variances.append({"line": line.line_no, "reason": "MISSING_RECEIPT"})
    accepted = bool(request.data.get("accept_variance"))
    if variances and accepted and not request.data.get("reason", "").strip(): raise ValidationError({"reason": "Lý do chấp nhận sai lệch là bắt buộc."})
    invoice.match_status = "ACCEPTED_VARIANCE" if variances and accepted else "VARIANCE" if variances else "MATCHED"
    invoice.match_details = {"mode": mode, "variances": variances, "accepted_by": str(actor(request).id) if accepted else None, "reason": request.data.get("reason", "")}
    invoice.save(update_fields=("match_status", "match_details", "updated_at"))
    audit(request, invoice, "MATCH", after={"match_status": invoice.match_status, "details": invoice.match_details})
    return invoice


@transaction.atomic
def post_invoice(invoice, request):
    invoice = models.SupplierInvoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.received_via_purchase:
        raise ValidationError("Hóa đơn đầu vào tiếp nhận tại Mua hàng được hạch toán qua chứng từ mua hàng.")
    if invoice.status != models.DocumentStatus.APPROVED: raise ValidationError("Chỉ hóa đơn APPROVED được ghi sổ.")
    if invoice.match_status == "VARIANCE": raise ValidationError("Sai lệch chưa được xử lý.")
    if hasattr(invoice, "payable"): raise ValidationError("Hóa đơn đã được ghi sổ.")
    payable = models.Payable.objects.create(company=invoice.company, branch=invoice.branch, supplier=invoice.supplier, invoice=invoice, currency=invoice.currency, exchange_rate=invoice.exchange_rate, original_amount=invoice.total_amount, balance=invoice.total_amount, due_date=invoice.due_date)
    before = invoice.status
    invoice.status, invoice.posted_at = models.DocumentStatus.POSTED, timezone.now()
    invoice.posting_reference = request.data.get("posting_reference", "")
    invoice.save(update_fields=("status", "posted_at", "posting_reference", "updated_at"))
    audit(request, invoice, "POST", {"status": before}, {"status": invoice.status, "payable": payable.id})
    return invoice


@transaction.atomic
def reverse_invoice(invoice, request):
    invoice = models.SupplierInvoice.objects.select_for_update().get(pk=invoice.pk)
    reason = request.data.get("reason", "").strip()
    if invoice.status != models.DocumentStatus.POSTED or not reason:
        raise ValidationError("Chỉ hóa đơn đã ghi sổ và có lý do mới được đảo.")
    payable = models.Payable.objects.select_for_update().get(invoice=invoice)
    if payable.paid_amount or payable.netted_amount or payable.adjustment_amount:
        raise ValidationError("Phải xử lý các giao dịch thanh toán, đối trừ hoặc điều chỉnh liên quan trước khi đảo.")
    before = {"invoice_status": invoice.status, "payable_status": payable.status, "balance": payable.balance}
    payable.balance = Decimal("0")
    payable.status = models.PayableStatus.REVERSED
    payable.save(update_fields=("balance", "status", "updated_at"))
    invoice.status = models.DocumentStatus.REVERSED
    invoice.posting_reference = request.data.get("posting_reference", invoice.posting_reference)
    invoice.save(update_fields=("status", "posting_reference", "updated_at"))
    audit(request, invoice, "REVERSE", before, {"invoice_status": invoice.status, "payable_status": payable.status, "balance": payable.balance}, reason)
    return invoice


def update_payable_status(payable):
    today = timezone.localdate()
    if payable.balance == 0:
        payable.status = models.PayableStatus.PAID
    elif payable.due_date and payable.due_date < today and payable.balance > 0:
        payable.status = models.PayableStatus.OVERDUE
    elif payable.balance < payable.original_amount + payable.adjustment_amount:
        payable.status = models.PayableStatus.PARTIALLY_PAID
    else:
        payable.status = models.PayableStatus.OPEN
    payable.save()


@transaction.atomic
def allocate(payment, request):
    payment = models.Payment.objects.select_for_update().get(pk=payment.pk)
    if payment.status not in ("CONFIRMED", "POSTED"): raise ValidationError("Giao dịch thanh toán không có hiệu lực.")
    rows = request.data.get("allocations", [])
    total = sum((Decimal(str(x["amount"])) for x in rows), Decimal("0"))
    if total <= 0 or payment.allocated_amount + total > payment.amount: raise ValidationError("Tổng phân bổ vượt số tiền chưa phân bổ.")
    for row in rows:
        payable = models.Payable.objects.select_for_update().get(pk=row["payable"])
        amount = Decimal(str(row["amount"]))
        if payable.supplier_id != payment.supplier_id or amount > payable.balance: raise ValidationError("Khoản phân bổ không hợp lệ.")
        if payable.currency_id != payment.currency_id and not row.get("exchange_rate"): raise ValidationError("Phân bổ khác loại tiền phải có tỷ giá.")
        models.PaymentAllocation.objects.create(payment=payment, payable=payable, amount=amount, exchange_rate=row.get("exchange_rate", 1), created_by=actor(request))
        payable.paid_amount += amount; payable.balance -= amount; update_payable_status(payable)
    payment.allocated_amount += total; payment.save(update_fields=("allocated_amount",))
    audit(request, payment, "ALLOCATE", after={"allocated": total})
    return payment


@transaction.atomic
def post_netting(obj, request):
    obj = models.Netting.objects.select_for_update().get(pk=obj.pk); p = models.Payable.objects.select_for_update().get(pk=obj.payable_id)
    if obj.company_id != p.company_id or obj.status != "DRAFT" or obj.amount > p.balance: raise ValidationError("Số tiền đối trừ không hợp lệ.")
    obj.status = "POSTED"; obj.save(update_fields=("status",)); p.netted_amount += obj.amount; p.balance -= obj.amount; update_payable_status(p); audit(request, obj, "NET", after={"status": obj.status}); return obj


@transaction.atomic
def post_adjustment(obj, request):
    obj = models.PayableAdjustment.objects.select_for_update().get(pk=obj.pk); p = models.Payable.objects.select_for_update().get(pk=obj.payable_id)
    if obj.company_id != p.company_id or obj.status != "DRAFT" or p.balance + obj.amount < 0: raise ValidationError("Giá trị điều chỉnh không hợp lệ.")
    obj.status = "POSTED"; obj.posting_reference = request.data.get("posting_reference", ""); obj.save(); p.adjustment_amount += obj.amount; p.balance += obj.amount; update_payable_status(p); audit(request, obj, "ADJUST", after={"amount": obj.amount}); return obj


@transaction.atomic
def reverse_adjustment(obj, request):
    obj = models.PayableAdjustment.objects.select_for_update().get(pk=obj.pk)
    reason = request.data.get("reason", "").strip()
    if obj.status != "POSTED" or not reason: raise ValidationError("Chỉ điều chỉnh đã ghi sổ và có lý do mới được đảo.")
    p = models.Payable.objects.select_for_update().get(pk=obj.payable_id)
    if p.balance - obj.amount < 0: raise ValidationError("Không thể đảo vì số dư hiện tại không đủ.")
    reversal = models.PayableAdjustment.objects.create(company=obj.company, payable=obj.payable, adjustment_date=timezone.localdate(), amount=-obj.amount, reason=reason, status="POSTED", reverses=obj, created_by=actor(request))
    p.adjustment_amount -= obj.amount; p.balance -= obj.amount; update_payable_status(p); obj.status="REVERSED"; obj.save(update_fields=("status",)); audit(request, obj, "REVERSE", after={"reversal": reversal.id}); return reversal


def get_default_tax_account(company):
    return Account.objects.filter(
        company=company,
        code__in=["1331", "133"],
        status="ACTIVE",
    ).first()


def generate_payable_document_number(company, branch=None, document_date=None):
    dt = DocumentType.objects.filter(code__in=["AP.DOCUMENT", "AP.DEBT", "AP.PAYABLE_DOCUMENT"], status="ACTIVE").first()
    if dt and DocumentNumberingRule.objects.filter(company=company, document_type=dt, status="ACTIVE").exists():
        configured = generate_document_number(company, dt, branch=branch, document_date=document_date)
        if configured:
            return configured

    if isinstance(document_date, str):
        try:
            document_date = date.fromisoformat(document_date)
        except ValueError:
            pass
    year = document_date.year if isinstance(document_date, (date, datetime)) else timezone.localdate().year
    prefix = f"CNPT-{year}-"
    last = models.PayableDocument.objects.filter(company=company, number__startswith=prefix).order_by("-number").values_list("number", flat=True).first()
    seq = 1
    if last and len(last) > len(prefix):
        suffix = last[len(prefix):]
        if suffix.isdigit():
            seq = int(suffix) + 1
    return f"{prefix}{seq:05d}"


def preview_payable_document_number(company, branch=None, document_date=None):
    if isinstance(document_date, str):
        try:
            document_date = date.fromisoformat(document_date)
        except ValueError:
            pass
    year = document_date.year if isinstance(document_date, (date, datetime)) else timezone.localdate().year
    prefix = f"CNPT-{year}-"
    last = models.PayableDocument.objects.filter(company=company, number__startswith=prefix).order_by("-number").values_list("number", flat=True).first()
    seq = 1
    if last and len(last) > len(prefix):
        suffix = last[len(prefix):]
        if suffix.isdigit():
            seq = int(suffix) + 1
    return f"{prefix}{seq:05d}"


def get_supplier_info(company, supplier_id):
    try:
        supplier = Party.objects.get(pk=supplier_id, company=company)
    except (Party.DoesNotExist, ValueError):
        raise ValidationError({"supplier": "Nhà cung cấp không tồn tại trong hệ thống."})
    if supplier.status != "ACTIVE":
        raise ValidationError("Nhà cung cấp không còn hoạt động. Vui lòng chọn nhà cung cấp khác.")

    balance = models.Payable.objects.filter(
        company=company,
        supplier=supplier,
        status__in=[models.PayableStatus.OPEN, models.PayableStatus.PARTIALLY_PAID, models.PayableStatus.OVERDUE],
    ).aggregate(total=Sum("balance"))["total"] or Decimal("0")

    address_obj = getattr(supplier, "addresses", None)
    addr_str = ""
    if address_obj:
        first_addr = address_obj.first()
        if first_addr:
            addr_str = getattr(first_addr, "address_line1", "") or str(first_addr)

    term = supplier.payment_term
    return {
        "supplier_id": str(supplier.id),
        "supplier_code": supplier.code,
        "supplier_name": supplier.name,
        "tax_code": supplier.tax_code or "",
        "address": addr_str,
        "payment_term_id": str(term.id) if term else None,
        "payment_term_code": term.code if term else "",
        "payment_term_name": term.name if term else "",
        "due_days": term.due_days if term else 0,
        "current_balance": str(balance),
        "status": supplier.status,
    }


def validate_payable_document_data(company, data, instance=None, action="SAVE_DRAFT"):
    errors = {}
    for field in ["document_date", "posting_date", "supplier", "payable_account", "due_date"]:
        if not data.get(field):
            errors[field] = "Trường này là bắt buộc."
    if errors:
        raise ValidationError({"detail": "Vui lòng nhập đầy đủ các trường bắt buộc.", "fields": errors})

    doc_date = data["document_date"]
    if isinstance(doc_date, str):
        doc_date = date.fromisoformat(doc_date)
    due_date = data["due_date"]
    if isinstance(due_date, str):
        due_date = date.fromisoformat(due_date)
    post_date = data["posting_date"]
    if isinstance(post_date, str):
        post_date = date.fromisoformat(post_date)

    if due_date < doc_date:
        raise ValidationError("Hạn thanh toán không được nhỏ hơn ngày chứng từ.")

    supplier_id = data["supplier"]
    try:
        supplier = Party.objects.get(pk=supplier_id, company=company)
    except (Party.DoesNotExist, ValueError):
        raise ValidationError({"supplier": "Nhà cung cấp không tồn tại."})
    if supplier.status != "ACTIVE":
        raise ValidationError("Nhà cung cấp không còn hoạt động. Vui lòng chọn nhà cung cấp khác.")

    payable_acc_id = data["payable_account"]
    try:
        payable_acc = Account.objects.get(pk=payable_acc_id, company=company)
    except (Account.DoesNotExist, ValueError):
        raise ValidationError({"payable_account": "Tài khoản phải trả không tồn tại."})
    if payable_acc.status != "ACTIVE":
        raise ValidationError("Tài khoản kế toán đã ngừng sử dụng. Vui lòng chọn tài khoản khác.")

    dim_reqs = payable_acc.dimension_requirements or {}
    tracks_supplier = (
        payable_acc.code.startswith("331")
        or payable_acc.requires_party
        or dim_reqs.get("SUPPLIER") in ("REQUIRED", "OPTIONAL")
    )
    if not tracks_supplier:
        raise ValidationError("Tài khoản được chọn không theo dõi công nợ theo nhà cung cấp.")

    if data.get("tax_account"):
        try:
            tax_acc = Account.objects.get(pk=data["tax_account"], company=company)
            if tax_acc.status != "ACTIVE":
                raise ValidationError("Tài khoản thuế đã ngừng sử dụng.")
        except (Account.DoesNotExist, ValueError):
            raise ValidationError({"tax_account": "Tài khoản thuế không hợp lệ."})

    invoice_id = data.get("invoice")
    if invoice_id:
        try:
            inv = models.SupplierInvoice.objects.get(pk=invoice_id, company=company)
        except (models.SupplierInvoice.DoesNotExist, ValueError):
            raise ValidationError({"invoice": "Hóa đơn đầu vào không tồn tại."})
        if inv.supplier_id != supplier.id:
            raise ValidationError("Hóa đơn được chọn không thuộc nhà cung cấp của chứng từ.")
        dup_qs = models.PayableDocument.objects.filter(company=company, invoice=inv).exclude(status=models.DocumentStatus.CANCELLED)
        if instance:
            dup_qs = dup_qs.exclude(pk=instance.pk)
        if dup_qs.exists() or hasattr(inv, "payable"):
            raise ValidationError("Hóa đơn đã được sử dụng để ghi nhận công nợ.")

    src_type = data.get("source_document_type")
    src_id = data.get("source_document_id")
    if src_type and src_id:
        dup_src = models.PayableDocument.objects.filter(
            company=company, source_document_type=src_type, source_document_id=src_id
        ).exclude(status=models.DocumentStatus.CANCELLED)
        if instance:
            dup_src = dup_src.exclude(pk=instance.pk)
        if dup_src.exists():
            raise ValidationError("Khoản công nợ đã được ghi nhận từ chứng từ hoặc hóa đơn này.")

    if action in ("SUBMIT", "POST"):
        try:
            pinfo = determine_period_for_date(company, post_date)
            period = pinfo.get("period") if isinstance(pinfo, dict) else pinfo
            if not period or getattr(period, "status", "") != "OPEN":
                raise ValidationError("Ngày hạch toán thuộc kỳ kế toán đã khóa.")
        except ValidationError as e:
            if "Ngày hạch toán thuộc kỳ kế toán đã khóa." in str(e):
                raise
            raise ValidationError("Ngày hạch toán thuộc kỳ kế toán đã khóa.")
        except Exception:
            raise ValidationError("Ngày hạch toán thuộc kỳ kế toán đã khóa.")

    lines_data = data.get("lines", [])
    if action != "SAVE_DRAFT" and not lines_data:
        raise ValidationError("Chứng từ phải có ít nhất một dòng chi tiết hợp lệ.")

    for idx, l in enumerate(lines_data, start=1):
        if not l.get("description"):
            raise ValidationError({f"lines[{idx}]": "Nội dung khoản phải trả là bắt buộc."})
        debit_acc_id = l.get("debit_account")
        if not debit_acc_id:
            raise ValidationError({f"lines[{idx}]": "Tài khoản ghi Nợ là bắt buộc."})
        try:
            debit_acc = Account.objects.get(pk=debit_acc_id, company=company)
            if debit_acc.status != "ACTIVE":
                raise ValidationError("Tài khoản kế toán đã ngừng sử dụng. Vui lòng chọn tài khoản khác.")
        except (Account.DoesNotExist, ValueError):
            raise ValidationError({f"lines[{idx}]": "Tài khoản ghi Nợ không hợp lệ."})

        amount = Decimal(str(l.get("amount", 0)))
        if amount <= Decimal("0"):
            raise ValidationError("Số tiền trước thuế phải lớn hơn 0.")

    attachments = data.get("attachments", [])
    if isinstance(attachments, list):
        for att in attachments:
            if isinstance(att, dict):
                size = att.get("file_size", 0)
                if size and int(size) > 20 * 1024 * 1024:
                    raise ValidationError("Tệp đính kèm không đúng định dạng hoặc vượt quá dung lượng cho phép.")


@transaction.atomic
def save_payable_document(request, data, instance=None, action="SAVE_DRAFT"):
    company_id = data.get("company")
    from organization.models import Company
    try:
        company = Company.objects.get(pk=company_id)
    except (Company.DoesNotExist, ValueError):
        raise ValidationError({"company": "Doanh nghiệp không hợp lệ."})

    validate_payable_document_data(company, data, instance=instance, action=action)

    subtotal = Decimal("0")
    tax_amount = Decimal("0")
    lines_data = data.get("lines", [])
    for l in lines_data:
        amt = Decimal(str(l.get("amount", 0)))
        rate_pct = Decimal(str(l.get("tax_rate_percent", 0))) if l.get("tax_rate_percent") is not None else Decimal("0")
        if "tax_amount" in l and l["tax_amount"] is not None:
            tax = Decimal(str(l["tax_amount"]))
        else:
            tax = (amt * rate_pct / Decimal("100")).quantize(Decimal("0.0001"))
        subtotal += amt
        tax_amount += tax

    total_amount = subtotal + tax_amount

    if action != "SAVE_DRAFT" and total_amount <= Decimal("0"):
        raise ValidationError("Tổng phải trả phải lớn hơn 0.")

    currency_id = data.get("currency")
    if currency_id:
        try:
            currency = Currency.objects.get(pk=currency_id)
        except (Currency.DoesNotExist, ValueError):
            currency = company.accounting_currency
    else:
        currency = company.accounting_currency

    status = models.DocumentStatus.DRAFT
    approval_required = True
    workflow_snapshot = data.get("workflow_snapshot") or {}
    if "approval_required" in workflow_snapshot:
        approval_required = bool(workflow_snapshot["approval_required"])

    if action == "SUBMIT":
        configured = configured_snapshot(instance or models.PayableDocument(company=company), "AP.DOCUMENT")
        if configured is not None:
            workflow_snapshot = configured
            approval_required = configured.get("approval_required", True)
        status = models.DocumentStatus.APPROVED if not approval_required else models.DocumentStatus.PENDING_APPROVAL

    if instance is None:
        number = generate_payable_document_number(company, branch=data.get("branch"), document_date=data.get("document_date"))
        doc = models.PayableDocument.objects.create(
            company=company,
            branch_id=data.get("branch"),
            number=number,
            document_date=data["document_date"],
            posting_date=data["posting_date"],
            supplier_id=data["supplier"],
            source_type=data.get("source_type", models.PayableDocumentSourceType.OTHER),
            source_document_type=data.get("source_document_type", ""),
            source_document_id=data.get("source_document_id", ""),
            source_document_number=data.get("source_document_number", ""),
            due_date=data["due_date"],
            payment_term_id=data.get("payment_term"),
            payable_account_id=data["payable_account"],
            tax_account_id=data.get("tax_account"),
            invoice_id=data.get("invoice"),
            currency=currency,
            exchange_rate=Decimal(str(data.get("exchange_rate", 1))),
            subtotal=subtotal,
            tax_amount=tax_amount,
            total_amount=total_amount,
            description=data.get("description", ""),
            attachments=data.get("attachments", []),
            status=status,
            approval_required=approval_required,
            workflow_snapshot=workflow_snapshot,
            created_by=actor(request),
            submitted_at=timezone.now() if action == "SUBMIT" else None,
            approved_at=timezone.now() if status == models.DocumentStatus.APPROVED else None,
        )
        for idx, l in enumerate(lines_data, start=1):
            amt = Decimal(str(l.get("amount", 0)))
            rate_pct = Decimal(str(l.get("tax_rate_percent", 0))) if l.get("tax_rate_percent") is not None else None
            tax = Decimal(str(l.get("tax_amount", 0))) if l.get("tax_amount") is not None else Decimal("0")
            models.PayableDocumentLine.objects.create(
                document=doc,
                line_no=l.get("line_no", idx),
                description=l["description"],
                debit_account_id=l["debit_account"],
                amount=amt,
                tax_rate_id=l.get("tax_rate"),
                tax_rate_percent=rate_pct,
                tax_amount=tax,
                total_amount=amt + tax,
                cost_center_id=l.get("cost_center"),
                expense_item_id=l.get("expense_item"),
                statistical_code_id=l.get("statistical_code"),
            )
        if action == "SUBMIT":
            models.ApprovalDecision.objects.create(
                company=company, document_type="DOCUMENT", document_id=doc.pk,
                decision="SUBMITTED", actor=actor(request), comment=data.get("comment", "")
            )
        audit(request, doc, "CREATE" if action == "SAVE_DRAFT" else "SUBMIT", after={"status": doc.status, "number": doc.number})
        return doc
    else:
        doc = instance
        if doc.status not in {models.DocumentStatus.DRAFT, models.DocumentStatus.REJECTED}:
            raise ValidationError("Chỉ chứng từ Nháp hoặc Bị từ chối mới được sửa nội dung nghiệp vụ.")
        req_ver = data.get("version")
        if req_ver is not None and int(req_ver) != doc.version:
            raise ValidationError("Dữ liệu chứng từ đã thay đổi. Vui lòng kiểm tra và phê duyệt lại.")

        before_status = doc.status
        doc.branch_id = data.get("branch", doc.branch_id)
        doc.document_date = data["document_date"]
        doc.posting_date = data["posting_date"]
        doc.supplier_id = data["supplier"]
        doc.source_type = data.get("source_type", doc.source_type)
        doc.due_date = data["due_date"]
        doc.payment_term_id = data.get("payment_term")
        doc.payable_account_id = data["payable_account"]
        doc.tax_account_id = data.get("tax_account")
        doc.invoice_id = data.get("invoice")
        doc.exchange_rate = Decimal(str(data.get("exchange_rate", doc.exchange_rate)))
        doc.subtotal = subtotal
        doc.tax_amount = tax_amount
        doc.total_amount = total_amount
        doc.description = data.get("description", doc.description)
        doc.attachments = data.get("attachments", doc.attachments)
        doc.approval_required = approval_required
        doc.workflow_snapshot = workflow_snapshot
        doc.status = status
        doc.version += 1
        if action == "SUBMIT":
            doc.submitted_at = timezone.now()
            if status == models.DocumentStatus.APPROVED:
                doc.approved_at = timezone.now()
            doc.rejection_reason = ""
        doc.save()

        doc.lines.all().delete()
        for idx, l in enumerate(lines_data, start=1):
            amt = Decimal(str(l.get("amount", 0)))
            rate_pct = Decimal(str(l.get("tax_rate_percent", 0))) if l.get("tax_rate_percent") is not None else None
            tax = Decimal(str(l.get("tax_amount", 0))) if l.get("tax_amount") is not None else Decimal("0")
            models.PayableDocumentLine.objects.create(
                document=doc,
                line_no=l.get("line_no", idx),
                description=l["description"],
                debit_account_id=l["debit_account"],
                amount=amt,
                tax_rate_id=l.get("tax_rate"),
                tax_rate_percent=rate_pct,
                tax_amount=tax,
                total_amount=amt + tax,
                cost_center_id=l.get("cost_center"),
                expense_item_id=l.get("expense_item"),
                statistical_code_id=l.get("statistical_code"),
            )
        if action == "SUBMIT":
            models.ApprovalDecision.objects.create(
                company=company, document_type="DOCUMENT", document_id=doc.pk,
                decision="SUBMITTED", actor=actor(request), comment=data.get("comment", "")
            )
        audit(request, doc, "EDIT" if action == "SAVE_DRAFT" else "SUBMIT", {"status": before_status}, {"status": doc.status})
        return doc


@transaction.atomic
def submit_payable_document(doc, request):
    doc = models.PayableDocument.objects.select_for_update().get(pk=doc.pk)
    if doc.status not in {models.DocumentStatus.DRAFT, models.DocumentStatus.REJECTED}:
        raise ValidationError("Trạng thái không cho phép gửi duyệt.")

    lines = list(doc.lines.all())
    if not lines or doc.total_amount <= Decimal("0"):
        raise ValidationError("Chứng từ phải có ít nhất một dòng chi tiết hợp lệ.")

    try:
        pinfo = determine_period_for_date(doc.company, doc.posting_date)
        period = pinfo.get("period") if isinstance(pinfo, dict) else pinfo
        if not period or getattr(period, "status", "") != "OPEN":
            raise ValidationError("Ngày hạch toán thuộc kỳ kế toán đã khóa.")
    except ValidationError as e:
        if "Ngày hạch toán thuộc kỳ kế toán đã khóa." in str(e):
            raise
        raise ValidationError("Ngày hạch toán thuộc kỳ kế toán đã khóa.")
    except Exception:
        raise ValidationError("Ngày hạch toán thuộc kỳ kế toán đã khóa.")

    if doc.supplier.status != "ACTIVE":
        raise ValidationError("Nhà cung cấp không còn hoạt động. Vui lòng chọn nhà cung cấp khác.")

    configured = configured_snapshot(doc, "AP.DOCUMENT")
    if configured is not None:
        doc.workflow_snapshot = configured
        doc.approval_required = configured.get("approval_required", True)

    before = doc.status
    doc.status = models.DocumentStatus.APPROVED if not doc.approval_required else models.DocumentStatus.PENDING_APPROVAL
    doc.submitted_at = timezone.now()
    if doc.status == models.DocumentStatus.APPROVED:
        doc.approved_at = timezone.now()
    doc.version += 1
    doc.save()

    models.ApprovalDecision.objects.create(
        company=doc.company, document_type="DOCUMENT", document_id=doc.pk,
        decision="SUBMITTED", actor=actor(request), comment=request.data.get("comment", "")
    )
    audit(request, doc, "SUBMIT", {"status": before}, {"status": doc.status})
    return doc


@transaction.atomic
def approve_payable_document(doc, request):
    doc = models.PayableDocument.objects.select_for_update().get(pk=doc.pk)
    if doc.status != models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Chứng từ đã được xử lý bởi người dùng khác.")

    req_ver = request.data.get("version")
    if req_ver is not None and int(req_ver) != doc.version:
        raise ValidationError("Dữ liệu chứng từ đã thay đổi. Vui lòng kiểm tra và phê duyệt lại.")

    workflow = doc.workflow_snapshot or {}
    if doc.created_by_id == actor(request).id and not workflow.get("allow_self_approval", False):
        raise ValidationError("Không được tự phê duyệt.")

    before = doc.status
    doc.status = models.DocumentStatus.APPROVED
    doc.approved_at = timezone.now()
    doc.version += 1
    doc.save()

    models.ApprovalDecision.objects.create(
        company=doc.company, document_type="DOCUMENT", document_id=doc.pk,
        decision="APPROVED", actor=actor(request), comment=request.data.get("comment", "")
    )
    audit(request, doc, "APPROVE", {"status": before}, {"status": doc.status})
    return doc


@transaction.atomic
def reject_payable_document(doc, request):
    doc = models.PayableDocument.objects.select_for_update().get(pk=doc.pk)
    if doc.status != models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Chứng từ đã được xử lý bởi người dùng khác.")

    reason = request.data.get("reason", "").strip() or request.data.get("comment", "").strip()
    if not reason:
        raise ValidationError({"reason": "Vui lòng nhập lý do từ chối."})

    before = doc.status
    doc.status = models.DocumentStatus.REJECTED
    doc.rejection_reason = reason
    doc.version += 1
    doc.save()

    models.ApprovalDecision.objects.create(
        company=doc.company, document_type="DOCUMENT", document_id=doc.pk,
        decision="REJECTED", actor=actor(request), comment=reason
    )
    audit(request, doc, "REJECT", {"status": before}, {"status": doc.status}, reason=reason)
    return doc


@transaction.atomic
def post_payable_document(doc, request):
    doc = models.PayableDocument.objects.select_for_update().get(pk=doc.pk)
    if doc.status != models.DocumentStatus.APPROVED:
        raise ValidationError("Chỉ chứng từ Đã phê duyệt mới được ghi sổ.")

    req_ver = request.data.get("version")
    if req_ver is not None and int(req_ver) != doc.version:
        raise ValidationError("Dữ liệu chứng từ đã thay đổi. Vui lòng kiểm tra và phê duyệt lại.")

    try:
        pinfo = determine_period_for_date(doc.company, doc.posting_date)
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
        company=doc.company,
        start_date__lte=doc.posting_date,
        end_date__gte=doc.posting_date,
        status="OPEN",
    ).first()
    if not gl_period:
        raise ValidationError("Ngày hạch toán thuộc kỳ kế toán đã khóa.")

    if doc.supplier.status != "ACTIVE":
        raise ValidationError("Nhà cung cấp không còn hoạt động. Vui lòng chọn nhà cung cấp khác.")

    if doc.payable_account.status != "ACTIVE":
        raise ValidationError("Tài khoản kế toán đã ngừng sử dụng. Vui lòng chọn tài khoản khác.")

    lines = list(doc.lines.select_related("debit_account").all())
    if not lines:
        raise ValidationError("Chứng từ phải có ít nhất một dòng chi tiết hợp lệ.")

    for l in lines:
        if l.debit_account.status != "ACTIVE":
            raise ValidationError("Tài khoản kế toán đã ngừng sử dụng. Vui lòng chọn tài khoản khác.")

    if hasattr(doc, "payable"):
        raise ValidationError("Khoản công nợ đã được ghi nhận từ chứng từ hoặc hóa đơn này.")

    try:
        journal = JournalEntry.objects.create(
            company=doc.company,
            branch=doc.branch,
            period=gl_period,
            number=f"{doc.number}-GL-{doc.version}",
            entry_type="SUBLEDGER",
            posting_date=doc.posting_date,
            document_date=doc.document_date,
            description=doc.description or f"Ghi nhận công nợ phải trả {doc.number}",
            source_module="AP",
            source_event_id=f"AP.DOCUMENT:{doc.pk}:{doc.version}",
            source_entity_type="PayableDocument",
            source_entity_id=doc.pk,
            status="APPROVED",
            total_debit=doc.total_amount,
            total_credit=doc.total_amount,
            workflow_snapshot={"allow_creator_posting": True},
            created_by=actor(request),
            approved_by=actor(request),
            approved_at=timezone.now(),
        )

        currency = doc.currency or doc.company.accounting_currency
        line_idx = 0

        for l in lines:
            line_idx += 1
            dims = {}
            if l.expense_item_id: dims["expense_item_id"] = str(l.expense_item_id)
            if l.statistical_code_id: dims["statistical_code_id"] = str(l.statistical_code_id)
            JournalLine.objects.create(
                entry=journal,
                line_no=line_idx,
                account=l.debit_account,
                debit=l.amount,
                credit=Decimal("0"),
                currency=currency,
                party=doc.supplier,
                department=l.cost_center,
                dimensions=dims,
            )

        if doc.tax_amount > Decimal("0"):
            tax_acc = doc.tax_account or get_default_tax_account(doc.company) or doc.payable_account
            line_idx += 1
            JournalLine.objects.create(
                entry=journal,
                line_no=line_idx,
                account=tax_acc,
                debit=doc.tax_amount,
                credit=Decimal("0"),
                currency=currency,
                party=doc.supplier,
            )

        line_idx += 1
        JournalLine.objects.create(
            entry=journal,
            line_no=line_idx,
            account=doc.payable_account,
            debit=Decimal("0"),
            credit=doc.total_amount,
            currency=currency,
            party=doc.supplier,
        )

        gl_services.post(journal, request)

        today = timezone.localdate()
        initial_status = models.PayableStatus.OVERDUE if doc.due_date < today else models.PayableStatus.OPEN

        payable = models.Payable.objects.create(
            company=doc.company,
            branch=doc.branch,
            supplier=doc.supplier,
            document=doc,
            invoice=doc.invoice,
            currency=currency,
            exchange_rate=doc.exchange_rate,
            original_amount=doc.total_amount,
            balance=doc.total_amount,
            paid_amount=Decimal("0"),
            netted_amount=Decimal("0"),
            adjustment_amount=Decimal("0"),
            due_date=doc.due_date,
            status=initial_status,
        )

        before = doc.status
        doc.journal_entry = journal
        doc.status = models.DocumentStatus.POSTED
        doc.posted_at = timezone.now()
        doc.posting_reference = request.data.get("posting_reference", doc.posting_reference) or f"GL-{journal.number}"
        doc.version += 1
        doc.save(update_fields=("journal_entry", "status", "posted_at", "posting_reference", "version", "updated_at"))

        audit(request, doc, "POST", {"status": before}, {"status": doc.status, "payable": str(payable.id), "journal": str(journal.id)})
        return doc

    except ValidationError:
        raise
    except Exception as exc:
        raise ValidationError(f"Ghi sổ không thành công. Không có công nợ hoặc bút toán nào được tạo. Chi tiết: {exc}")


@transaction.atomic
def cancel_payable_document(doc, request):
    doc = models.PayableDocument.objects.select_for_update().get(pk=doc.pk)
    if doc.status == models.DocumentStatus.POSTED:
        raise ValidationError("Chứng từ Đã ghi sổ không được sửa trực tiếp.")
    if doc.status == models.DocumentStatus.CANCELLED:
        raise ValidationError("Chứng từ đã ở trạng thái Đã hủy.")

    reason = request.data.get("reason", "").strip() or request.data.get("comment", "").strip()
    if not reason:
        raise ValidationError({"reason": "Vui lòng nhập lý do hủy chứng từ."})

    before = doc.status
    doc.status = models.DocumentStatus.CANCELLED
    doc.cancelled_at = timezone.now()
    doc.cancellation_reason = reason
    doc.version += 1
    doc.save(update_fields=("status", "cancelled_at", "cancellation_reason", "version", "updated_at"))
    audit(request, doc, "CANCEL", {"status": before}, {"status": doc.status}, reason=reason)
    return doc


def auto_recognize_payable_from_purchase(purchase_obj, request=None, due_date=None, payment_term=None, paid_amount=Decimal("0")):
    total = getattr(purchase_obj, "total_amount", Decimal("0"))
    unpaid = total - Decimal(str(paid_amount))
    if unpaid <= Decimal("0"):
        return None

    comp = purchase_obj.company
    supp = purchase_obj.supplier
    curr = getattr(purchase_obj, "currency", comp.accounting_currency)
    rate = getattr(purchase_obj, "exchange_rate", Decimal("1"))
    d_date = getattr(purchase_obj, "document_date", timezone.localdate())

    if not due_date:
        term = payment_term or getattr(purchase_obj, "payment_term", None) or getattr(supp, "payment_term", None)
        if term and hasattr(term, "due_days"):
            from master_data.payment_terms import calculate_payment_dates
            due_date = calculate_payment_dates(term, document_date=d_date)["due_date"]
        else:
            due_date = d_date

    today = timezone.localdate()
    p_status = models.PayableStatus.OVERDUE if due_date < today else models.PayableStatus.PARTIALLY_PAID if paid_amount > Decimal("0") else models.PayableStatus.OPEN

    kwargs = {
        "company": comp,
        "branch": getattr(purchase_obj, "branch", None),
        "supplier": supp,
        "currency": curr,
        "exchange_rate": rate,
        "original_amount": total,
        "paid_amount": paid_amount,
        "balance": unpaid,
        "due_date": due_date,
        "status": p_status,
    }
    from purchases import models as pur_models
    if isinstance(purchase_obj, pur_models.GoodsPurchase):
        kwargs["goods_purchase"] = purchase_obj
    elif isinstance(purchase_obj, pur_models.PurchaseCost):
        kwargs["purchase_cost"] = purchase_obj
    elif isinstance(purchase_obj, models.SupplierInvoice):
        kwargs["invoice"] = purchase_obj

    payable = models.Payable.objects.create(**kwargs)
    return payable

