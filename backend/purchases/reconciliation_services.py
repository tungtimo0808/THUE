from decimal import Decimal
import uuid

from django.db import transaction
from django.db.models import F, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from accounts_payable.models import SupplierInvoice, SupplierInvoiceLine
from iam.permissions import has_effective_permission
from master_data.models import DocumentNumberingRule, DocumentType
from organization.models import Company

from .models import (
    GoodsPurchase,
    GoodsPurchaseLine,
    InvoicingProgressStatus,
    MatchingMethod,
    PurchaseInvoiceMatch,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseReceipt,
    PurchaseReceiptLine,
    PurchaseReconciliation,
    PurchaseReconciliationLine,
    ReconciliationLineResult,
    ReconciliationStatus,
)
from .services import audit


def check_scope(request, company, branch_id, permission_code):
    if request.user.is_superuser:
        return
    if not hasattr(request.user, "iam_account"):
        raise ValidationError("Quyền truy cập của bạn đã thay đổi. Vui lòng tải lại trang.")
    if not has_effective_permission(request.user.iam_account, company, permission_code, branch_id=branch_id):
        raise ValidationError("Quyền truy cập của bạn đã thay đổi. Vui lòng tải lại trang.")


def number_for(company, document_date, branch=None):
    from common_services.numbering_services import generate_document_number

    kind = DocumentType.objects.filter(code="PUR.RECONCILIATION", status="ACTIVE").first()
    if kind and DocumentNumberingRule.objects.filter(company=company, document_type=kind, status="ACTIVE").exists():
        number = generate_document_number(company, kind, branch=branch, document_date=document_date)
        if PurchaseReconciliation.objects.filter(company=company, number=number).exists():
            raise ValidationError("Mã đối chiếu đã tồn tại.")
        return number

    prefix = f"REC{document_date:%Y%m%d}"
    last = (
        PurchaseReconciliation.objects.filter(company=company, number__startswith=prefix)
        .order_by("-number")
        .values_list("number", flat=True)
        .first()
    )
    sequence = int(last[len(prefix):]) + 1 if last and last[len(prefix):].isdigit() else 1
    return f"{prefix}{sequence:04d}"


def get_eligible_invoices(company, branch=None, supplier=None):
    queryset = SupplierInvoice.objects.filter(
        company=company,
        validation_status="VALID",
        is_replaced=False,
    ).exclude(match_status="MATCHED")
    if branch:
        queryset = queryset.filter(branch=branch)
    if supplier:
        queryset = queryset.filter(supplier=supplier)
    return queryset


def get_eligible_documents(company, invoice, method=None):
    supplier = invoice.supplier
    branch = invoice.branch

    orders_qs = PurchaseOrder.objects.filter(
        company=company,
        supplier=supplier,
        status__in=["APPROVED", "SENT", "IN_PROGRESS", "COMPLETED"],
    ).exclude(invoicing_status=InvoicingProgressStatus.FULLY_INVOICED)
    if branch:
        orders_qs = orders_qs.filter(branch=branch)

    receipts_qs = PurchaseReceipt.objects.filter(
        company=company,
        status="CONFIRMED",
        order__supplier=supplier,
        order__status__in=["APPROVED", "SENT", "IN_PROGRESS", "COMPLETED"],
    )

    purchases_qs = GoodsPurchase.objects.filter(
        company=company,
        supplier=supplier,
        status="POSTED",
    ).exclude(invoice_status="INVOICED")
    if branch:
        purchases_qs = purchases_qs.filter(branch=branch)

    return {
        "purchase_orders": orders_qs,
        "purchase_receipts": receipts_qs,
        "goods_purchases": purchases_qs,
    }


def build_candidate_lines(invoice, purchase_order=None, purchase_receipt=None, goods_purchase=None, method="THREE_WAY"):
    candidates = []
    inv_lines = invoice.lines.select_related("item", "uom", "tax_rate").order_by("line_no")

    order_lines = (
        list(purchase_order.lines.select_related("item", "uom", "tax_rate").all())
        if purchase_order
        else []
    )
    receipt_lines = (
        list(purchase_receipt.lines.select_related("order_line__item", "order_line__uom", "order_line__tax_rate").all())
        if purchase_receipt
        else []
    )
    purchase_lines = (
        list(goods_purchase.lines.select_related("item", "uom", "tax_rate").all())
        if goods_purchase
        else []
    )

    for inv_line in inv_lines:
        c = {
            "invoice_line": str(inv_line.id),
            "line_no": inv_line.line_no,
            "item": str(inv_line.item_id) if inv_line.item_id else None,
            "item_name": inv_line.item.name if inv_line.item else inv_line.description,
            "uom": str(inv_line.uom_id) if inv_line.uom_id else None,
            "uom_name": inv_line.uom.name if inv_line.uom else "",
            "invoice_quantity": str(inv_line.quantity),
            "invoice_unit_price": str(inv_line.unit_price),
            "invoice_tax_rate": str(inv_line.tax_rate_percent or Decimal("0")),
            "invoice_pre_tax_amount": str(inv_line.taxable_amount),
            "order_line": None,
            "order_quantity": "0",
            "order_unit_price": "0",
            "expected_tax_rate": "0",
            "receipt_line": None,
            "received_quantity": "0",
            "purchase_line": None,
            "document_pre_tax_amount": "0",
            "matched_quantity": str(inv_line.quantity),
            "auto_matched": False,
        }

        if method == MatchingMethod.THREE_WAY:
            # Match via receipt line and order line
            matched_rcpt = next(
                (r for r in receipt_lines if r.order_line and r.order_line.item_id == inv_line.item_id),
                None,
            )
            if matched_rcpt:
                ord_line = matched_rcpt.order_line
                tax_rate_val = ord_line.tax_rate.rate_percent if ord_line.tax_rate else Decimal("0")
                c["receipt_line"] = str(matched_rcpt.id)
                c["received_quantity"] = str(matched_rcpt.quantity or Decimal("0"))
                c["order_line"] = str(ord_line.id)
                c["order_quantity"] = str(ord_line.quantity)
                c["order_unit_price"] = str(ord_line.unit_price)
                c["expected_tax_rate"] = str(tax_rate_val)
                doc_pre = (inv_line.quantity * ord_line.unit_price).quantize(Decimal("0.0001"))
                c["document_pre_tax_amount"] = str(doc_pre)
                c["auto_matched"] = True

        elif method == MatchingMethod.TWO_WAY:
            matched_ord = next(
                (o for o in order_lines if o.item_id == inv_line.item_id),
                None,
            )
            if matched_ord:
                tax_rate_val = matched_ord.tax_rate.rate_percent if matched_ord.tax_rate else Decimal("0")
                c["order_line"] = str(matched_ord.id)
                c["order_quantity"] = str(matched_ord.quantity)
                c["order_unit_price"] = str(matched_ord.unit_price)
                c["expected_tax_rate"] = str(tax_rate_val)
                doc_pre = (inv_line.quantity * matched_ord.unit_price).quantize(Decimal("0.0001"))
                c["document_pre_tax_amount"] = str(doc_pre)
                c["auto_matched"] = True

        elif method == MatchingMethod.DIRECT:
            matched_pur = next(
                (p for p in purchase_lines if p.item_id == inv_line.item_id),
                None,
            )
            if matched_pur:
                tax_rate_val = matched_pur.tax_rate.rate_percent if matched_pur.tax_rate else Decimal("0")
                c["purchase_line"] = str(matched_pur.id)
                c["received_quantity"] = str(matched_pur.quantity)
                c["order_unit_price"] = str(matched_pur.unit_price)
                c["expected_tax_rate"] = str(tax_rate_val)
                doc_pre = (inv_line.quantity * matched_pur.unit_price).quantize(Decimal("0.0001"))
                c["document_pre_tax_amount"] = str(doc_pre)
                c["auto_matched"] = True

        candidates.append(c)

    return candidates


def validate_source_documents(
    company,
    invoice,
    method,
    purchase_order=None,
    purchase_receipt=None,
    goods_purchase=None,
):
    if invoice.company_id != company.id:
        raise ValidationError("Hóa đơn không thuộc doanh nghiệp đang làm việc.")
    if invoice.validation_status != "VALID" or invoice.is_replaced:
        raise ValidationError("Hóa đơn không còn đủ điều kiện đối chiếu.")
    if invoice.match_status == "MATCHED":
        raise ValidationError("Hóa đơn đã được đối chiếu đầy đủ.")

    if method == MatchingMethod.THREE_WAY:
        if not purchase_order:
            raise ValidationError("Đơn mua hàng là bắt buộc khi đối chiếu ba bên.")
        if not purchase_receipt:
            raise ValidationError("Chứng từ nhận hàng là bắt buộc khi đối chiếu ba bên.")
        if purchase_order.company_id != company.id or purchase_order.supplier_id != invoice.supplier_id:
            raise ValidationError("Nhà cung cấp trên các chứng từ không khớp.")
        if purchase_order.status not in ["APPROVED", "SENT", "IN_PROGRESS", "COMPLETED"]:
            raise ValidationError("Chứng từ nguồn đã thay đổi trạng thái và không thể đối chiếu.")
        if purchase_receipt.order_id != purchase_order.id:
            raise ValidationError("Chứng từ nhận hàng không thuộc Đơn mua hàng đã chọn.")
        if purchase_receipt.status != "CONFIRMED":
            raise ValidationError("Chứng từ nguồn đã thay đổi trạng thái và không thể đối chiếu.")

    elif method == MatchingMethod.TWO_WAY:
        if not purchase_order:
            raise ValidationError("Đơn mua hàng là bắt buộc khi đối chiếu hai bên.")
        if purchase_order.company_id != company.id or purchase_order.supplier_id != invoice.supplier_id:
            raise ValidationError("Nhà cung cấp trên các chứng từ không khớp.")
        if purchase_order.status not in ["APPROVED", "SENT", "IN_PROGRESS", "COMPLETED"]:
            raise ValidationError("Chứng từ nguồn đã thay đổi trạng thái và không thể đối chiếu.")

    elif method == MatchingMethod.DIRECT:
        if not goods_purchase:
            raise ValidationError("Chứng từ mua hàng là bắt buộc khi đối chiếu trực tiếp.")
        if goods_purchase.company_id != company.id or goods_purchase.supplier_id != invoice.supplier_id:
            raise ValidationError("Nhà cung cấp trên các chứng từ không khớp.")
        if goods_purchase.status != "POSTED":
            raise ValidationError("Chứng từ nguồn đã thay đổi trạng thái và không thể đối chiếu.")


def compute_comparison(
    company,
    invoice,
    method,
    lines_data,
    purchase_order=None,
    purchase_receipt=None,
    goods_purchase=None,
):
    validate_source_documents(
        company, invoice, method, purchase_order, purchase_receipt, goods_purchase
    )

    inv_lines = {str(line.id): line for line in invoice.lines.all()}
    if not lines_data:
        raise ValidationError("Vui lòng ghép đầy đủ các dòng cần đối chiếu.")

    mapped_inv_line_ids = set()
    computed_lines = []
    is_mismatch = False
    is_partial = False

    total_invoice_calc = Decimal("0")
    total_matched_calc = Decimal("0")
    total_diff_calc = Decimal("0")

    is_vnd = (invoice.currency and invoice.currency.code == "VND") or True
    rounding_limit = Decimal("1.0") if is_vnd else Decimal("0.0001")

    for idx, row in enumerate(lines_data, start=1):
        inv_line_id = str(row.get("invoice_line") or "")
        inv_line = inv_lines.get(inv_line_id)
        if not inv_line:
            raise ValidationError("Dòng hóa đơn không tồn tại hoặc không hợp lệ.")
        mapped_inv_line_ids.add(inv_line_id)

        matched_qty = Decimal(str(row.get("matched_quantity", inv_line.quantity)))
        if matched_qty < 0:
            raise ValidationError("Số lượng đối chiếu không thể âm.")

        line_mismatch_reasons = []
        order_line = None
        receipt_line = None
        purchase_line = None

        order_qty = Decimal("0")
        rcpt_qty = Decimal("0")
        order_price = Decimal("0")
        expected_tax = Decimal("0")

        if method == MatchingMethod.THREE_WAY:
            rcpt_id = row.get("receipt_line")
            if not rcpt_id:
                raise ValidationError("Vui lòng ghép đầy đủ các dòng cần đối chiếu.")
            receipt_line = PurchaseReceiptLine.objects.select_related(
                "order_line__tax_rate", "order_line__item", "receipt"
            ).filter(pk=rcpt_id, receipt__company=company).first()
            if not receipt_line or (purchase_receipt and receipt_line.receipt_id != purchase_receipt.id):
                raise ValidationError("Chứng từ nhận hàng không thuộc Đơn mua hàng đã chọn.")
            order_line = receipt_line.order_line
            rcpt_qty = receipt_line.quantity or Decimal("0")
            order_qty = order_line.quantity
            order_price = order_line.unit_price
            expected_tax = (
                order_line.tax_rate.rate_percent if order_line.tax_rate else Decimal("0")
            )

            # Check quantity
            already_invoiced_rcpt = (
                PurchaseReconciliationLine.objects.filter(
                    receipt_line=receipt_line,
                    reconciliation__status__in=[
                        ReconciliationStatus.MATCHED,
                        ReconciliationStatus.PARTIALLY_MATCHED,
                        ReconciliationStatus.RESOLVED,
                    ],
                ).aggregate(total=Sum("matched_quantity"))["total"]
                or Decimal("0")
            )
            remaining_rcpt = rcpt_qty - already_invoiced_rcpt
            if inv_line.quantity > remaining_rcpt or matched_qty > remaining_rcpt:
                line_mismatch_reasons.append("Số lượng hóa đơn vượt số lượng đã nhận còn lại.")

        elif method == MatchingMethod.TWO_WAY:
            ord_id = row.get("order_line")
            if not ord_id:
                raise ValidationError("Vui lòng ghép đầy đủ các dòng cần đối chiếu.")
            order_line = PurchaseOrderLine.objects.select_related("tax_rate", "item").filter(
                pk=ord_id, order__company=company
            ).first()
            if not order_line or (purchase_order and order_line.order_id != purchase_order.id):
                raise ValidationError("Dòng đơn mua không tồn tại hoặc không khớp.")
            order_qty = order_line.quantity
            order_price = order_line.unit_price
            expected_tax = (
                order_line.tax_rate.rate_percent if order_line.tax_rate else Decimal("0")
            )

            already_invoiced_ord = order_line.invoiced_quantity
            remaining_ord = order_qty - already_invoiced_ord
            if inv_line.quantity > remaining_ord or matched_qty > remaining_ord:
                line_mismatch_reasons.append("Số lượng hóa đơn vượt số lượng đặt còn lại.")

        elif method == MatchingMethod.DIRECT:
            pur_id = row.get("purchase_line")
            if not pur_id:
                raise ValidationError("Vui lòng ghép đầy đủ các dòng cần đối chiếu.")
            purchase_line = GoodsPurchaseLine.objects.select_related("tax_rate", "item").filter(
                pk=pur_id, purchase__company=company
            ).first()
            if not purchase_line or (goods_purchase and purchase_line.purchase_id != goods_purchase.id):
                raise ValidationError("Dòng chứng từ mua không tồn tại hoặc không khớp.")
            rcpt_qty = purchase_line.quantity
            order_price = purchase_line.unit_price
            expected_tax = (
                purchase_line.tax_rate.rate_percent if purchase_line.tax_rate else Decimal("0")
            )

            already_matched_pur = (
                PurchaseInvoiceMatch.objects.filter(purchase_line=purchase_line).aggregate(
                    total=Sum("quantity")
                )["total"]
                or Decimal("0")
            )
            remaining_pur = purchase_line.quantity - already_matched_pur
            if inv_line.quantity > remaining_pur or matched_qty > remaining_pur:
                line_mismatch_reasons.append("Số lượng hóa đơn vượt số lượng mua còn lại.")

        # Unit price and discount check
        inv_price = inv_line.unit_price
        disc_rate = Decimal("0")
        if order_line and hasattr(order_line, "discount_rate") and order_line.discount_rate:
            disc_rate = order_line.discount_rate
        elif purchase_line and hasattr(purchase_line, "discount_rate") and purchase_line.discount_rate:
            disc_rate = purchase_line.discount_rate

        effective_order_price = (order_price * (Decimal("1") - disc_rate / Decimal("100"))).quantize(Decimal("0.0001"))
        price_matches = (abs(inv_price - order_price) <= Decimal("0.0001")) or (
            abs(inv_price - effective_order_price) <= Decimal("0.0001")
        )
        if not price_matches:
            line_mismatch_reasons.append(
                f"Đơn giá hóa đơn ({inv_price}) không khớp đơn giá thỏa thuận ({order_price})."
            )

        # Tax rate check
        inv_tax_rate = inv_line.tax_rate_percent or Decimal("0")
        if abs(inv_tax_rate - expected_tax) > Decimal("0.0001"):
            line_mismatch_reasons.append(
                f"Thuế suất hóa đơn ({inv_tax_rate}%) không khớp thuế suất dự kiến ({expected_tax}%)."
            )

        # Amounts with discount
        doc_discount = (matched_qty * order_price * disc_rate / Decimal("100")).quantize(Decimal("0.0001"))
        doc_pre_tax = (matched_qty * order_price - doc_discount).quantize(Decimal("0.0001"))
        inv_pre_tax = (matched_qty * inv_price).quantize(Decimal("0.0001"))

        doc_tax = (doc_pre_tax * expected_tax / Decimal("100")).quantize(Decimal("0.0001"))
        inv_tax = (inv_pre_tax * inv_tax_rate / Decimal("100")).quantize(Decimal("0.0001"))

        pre_tax_diff = abs(inv_pre_tax - doc_pre_tax)
        tax_diff = inv_tax - doc_tax
        if abs(tax_diff) > rounding_limit:
            line_mismatch_reasons.append(
                f"Tiền thuế chênh lệch ({tax_diff}) vượt ngưỡng cho phép ({rounding_limit})."
            )
        if pre_tax_diff > rounding_limit:
            line_mismatch_reasons.append(
                f"Tiền trước thuế chênh lệch ({pre_tax_diff}) vượt ngưỡng cho phép ({rounding_limit})."
            )

        total_doc = doc_pre_tax + doc_tax
        total_inv = inv_pre_tax + inv_tax
        line_total_diff = total_inv - total_doc

        total_invoice_calc += total_inv
        total_matched_calc += total_doc
        total_diff_calc += line_total_diff

        # Line result
        if line_mismatch_reasons:
            line_result = ReconciliationLineResult.MISMATCH
            is_mismatch = True
            diff_reason = "; ".join(line_mismatch_reasons)
        elif matched_qty < inv_line.quantity or (order_qty > 0 and matched_qty < order_qty):
            line_result = ReconciliationLineResult.PARTIALLY_MATCHED
            is_partial = True
            diff_reason = row.get("difference_reason", "")
        else:
            line_result = ReconciliationLineResult.MATCHED
            diff_reason = ""

        computed_lines.append(
            {
                "line_no": idx,
                "invoice_line": inv_line,
                "order_line": order_line,
                "receipt_line": receipt_line,
                "purchase_line": purchase_line,
                "item": inv_line.item,
                "uom": inv_line.uom,
                "description": inv_line.description or (inv_line.item.name if inv_line.item else ""),
                "order_quantity": order_qty,
                "received_quantity": rcpt_qty,
                "invoice_quantity": inv_line.quantity,
                "matched_quantity": matched_qty,
                "order_unit_price": order_price,
                "invoice_unit_price": inv_price,
                "expected_tax_rate": expected_tax,
                "invoice_tax_rate": inv_tax_rate,
                "document_pre_tax_amount": doc_pre_tax,
                "invoice_pre_tax_amount": inv_pre_tax,
                "tax_difference": tax_diff,
                "total_difference": line_total_diff,
                "line_result": line_result,
                "difference_reason": diff_reason,
            }
        )

    # Check if all invoice lines are mapped
    if len(mapped_inv_line_ids) < len(inv_lines):
        raise ValidationError("Vui lòng ghép đầy đủ các dòng cần đối chiếu.")

    if is_mismatch:
        overall_status = ReconciliationStatus.MISMATCH
    elif is_partial or total_invoice_calc < invoice.total_amount:
        overall_status = ReconciliationStatus.PARTIALLY_MATCHED
    else:
        overall_status = ReconciliationStatus.MATCHED

    return {
        "status": overall_status,
        "total_invoice_amount": total_invoice_calc,
        "total_matched_amount": total_matched_calc,
        "total_difference_amount": total_diff_calc,
        "lines": computed_lines,
        "is_mismatch": is_mismatch,
    }


@transaction.atomic
def execute_reconciliation(
    company,
    invoice,
    method,
    lines_data,
    user,
    request,
    purchase_order=None,
    purchase_receipt=None,
    goods_purchase=None,
    notes="",
    reconciliation_date=None,
):
    branch = invoice.branch or (purchase_order.branch if purchase_order else None)
    check_scope(request, company, branch.id if branch else None, "PUR.RECONCILIATION.MATCH")

    computed = compute_comparison(
        company,
        invoice,
        method,
        lines_data,
        purchase_order=purchase_order,
        purchase_receipt=purchase_receipt,
        goods_purchase=goods_purchase,
    )

    rec_date = reconciliation_date or timezone.now().date()
    code = number_for(company, rec_date, branch=branch)

    reconciliation = PurchaseReconciliation.objects.create(
        company=company,
        branch=branch,
        number=code,
        reconciliation_date=rec_date,
        matching_method=method,
        supplier=invoice.supplier,
        invoice=invoice,
        purchase_order=purchase_order,
        purchase_receipt=purchase_receipt,
        goods_purchase=goods_purchase,
        status=computed["status"],
        notes=notes,
        total_invoice_amount=computed["total_invoice_amount"],
        total_matched_amount=computed["total_matched_amount"],
        total_difference_amount=computed["total_difference_amount"],
        difference_reason="; ".join(
            line["difference_reason"] for line in computed["lines"] if line["difference_reason"]
        )[:500],
        created_by=user.iam_account,
    )

    for line_info in computed["lines"]:
        PurchaseReconciliationLine.objects.create(
            reconciliation=reconciliation,
            line_no=line_info["line_no"],
            item=line_info["item"],
            uom=line_info["uom"],
            description=line_info["description"],
            invoice_line=line_info["invoice_line"],
            order_line=line_info["order_line"],
            receipt_line=line_info["receipt_line"],
            purchase_line=line_info["purchase_line"],
            order_quantity=line_info["order_quantity"],
            received_quantity=line_info["received_quantity"],
            invoice_quantity=line_info["invoice_quantity"],
            matched_quantity=line_info["matched_quantity"],
            order_unit_price=line_info["order_unit_price"],
            invoice_unit_price=line_info["invoice_unit_price"],
            expected_tax_rate=line_info["expected_tax_rate"],
            invoice_tax_rate=line_info["invoice_tax_rate"],
            document_pre_tax_amount=line_info["document_pre_tax_amount"],
            invoice_pre_tax_amount=line_info["invoice_pre_tax_amount"],
            tax_difference=line_info["tax_difference"],
            total_difference=line_info["total_difference"],
            line_result=line_info["line_result"],
            difference_reason=line_info["difference_reason"],
        )

    # If status is MATCHED or PARTIALLY_MATCHED, update source document progresses
    if computed["status"] in [ReconciliationStatus.MATCHED, ReconciliationStatus.PARTIALLY_MATCHED]:
        apply_source_document_progress(reconciliation, user)

    audit(
        request,
        reconciliation,
        "MATCH",
        after={
            "number": reconciliation.number,
            "status": reconciliation.status,
            "invoice": invoice.invoice_number,
            "total_matched_amount": str(reconciliation.total_matched_amount),
            "total_difference_amount": str(reconciliation.total_difference_amount),
        },
    )

    return reconciliation


def apply_source_document_progress(reconciliation, user):
    invoice = reconciliation.invoice

    for line in reconciliation.lines.all():
        inv_line = line.invoice_line

        if line.order_line:
            ord_line = PurchaseOrderLine.objects.select_for_update().get(pk=line.order_line_id)
            ord_line.invoiced_quantity = F("invoiced_quantity") + line.matched_quantity
            ord_line.save(update_fields=("invoiced_quantity",))
            inv_line.purchase_order_line = ord_line

        if line.receipt_line:
            inv_line.receipt_line = line.receipt_line

        inv_line.save(update_fields=("purchase_order_line", "receipt_line"))

        if line.purchase_line:
            pur_line = GoodsPurchaseLine.objects.select_for_update().get(pk=line.purchase_line_id)
            line_amt = line.document_pre_tax_amount + (
                line.document_pre_tax_amount * (line.expected_tax_rate or Decimal("0")) / Decimal("100")
            )
            PurchaseInvoiceMatch.objects.create(
                invoice_line=inv_line,
                purchase_line=pur_line,
                quantity=line.matched_quantity,
                amount=line_amt.quantize(Decimal("0.0001")),
                created_by=user.iam_account,
            )

    if reconciliation.purchase_order:
        order = PurchaseOrder.objects.select_for_update().get(pk=reconciliation.purchase_order_id)
        order.invoiced_amount = F("invoiced_amount") + reconciliation.total_matched_amount
        order.save(update_fields=("invoiced_amount",))
        order.refresh_from_db()

        # Update order invoicing status
        all_lines_done = not order.lines.filter(invoiced_quantity__lt=F("quantity")).exists()
        order.invoicing_status = (
            InvoicingProgressStatus.FULLY_INVOICED
            if all_lines_done
            else InvoicingProgressStatus.PARTIALLY_INVOICED
        )
        order.save(update_fields=("invoicing_status",))

    if reconciliation.goods_purchase:
        gp = GoodsPurchase.objects.select_for_update().get(pk=reconciliation.goods_purchase_id)
        if not gp.supplier_invoice_id:
            gp.supplier_invoice = invoice
        gp.invoice_status = "INVOICED"
        gp.save(update_fields=("supplier_invoice", "invoice_status", "updated_at"))

    # Update invoice linked amount & match status
    invoice.linked_amount = F("linked_amount") + reconciliation.total_matched_amount
    invoice.save(update_fields=("linked_amount",))
    invoice.refresh_from_db()

    if reconciliation.status == ReconciliationStatus.MATCHED:
        invoice.match_status = "MATCHED"
    elif reconciliation.status == ReconciliationStatus.PARTIALLY_MATCHED:
        invoice.match_status = "PARTIALLY_MATCHED"
    elif reconciliation.status == ReconciliationStatus.RESOLVED:
        invoice.match_status = "ACCEPTED_VARIANCE"
    elif reconciliation.status == ReconciliationStatus.MISMATCH:
        invoice.match_status = "VARIANCE"

    invoice.save(update_fields=("match_status", "updated_at"))


def rollback_source_document_progress(reconciliation):
    invoice = reconciliation.invoice

    for line in reconciliation.lines.all():
        if line.order_line:
            PurchaseOrderLine.objects.filter(pk=line.order_line_id).update(
                invoiced_quantity=F("invoiced_quantity") - line.matched_quantity
            )
        if line.purchase_line:
            PurchaseInvoiceMatch.objects.filter(
                invoice_line=line.invoice_line,
                purchase_line=line.purchase_line,
            ).delete()

    if reconciliation.purchase_order:
        order = PurchaseOrder.objects.select_for_update().get(pk=reconciliation.purchase_order_id)
        order.invoiced_amount = F("invoiced_amount") - reconciliation.total_matched_amount
        order.save(update_fields=("invoiced_amount",))
        order.refresh_from_db()
        any_invoiced = order.lines.filter(invoiced_quantity__gt=0).exists()
        order.invoicing_status = (
            InvoicingProgressStatus.PARTIALLY_INVOICED
            if any_invoiced
            else InvoicingProgressStatus.NOT_INVOICED
        )
        order.save(update_fields=("invoicing_status",))

    if reconciliation.goods_purchase:
        gp = GoodsPurchase.objects.select_for_update().get(pk=reconciliation.goods_purchase_id)
        if gp.supplier_invoice_id == invoice.id:
            gp.supplier_invoice = None
        gp.invoice_status = "NOT_INVOICED"
        gp.save(update_fields=("supplier_invoice", "invoice_status", "updated_at"))

    invoice.linked_amount = max(Decimal("0"), invoice.linked_amount - reconciliation.total_matched_amount)
    invoice.match_status = "UNMATCHED" if invoice.linked_amount == 0 else "PARTIALLY_MATCHED"
    invoice.save(update_fields=("linked_amount", "match_status", "updated_at"))


@transaction.atomic
def request_variance_resolution(reconciliation, reason, request):
    check_scope(
        request,
        reconciliation.company,
        reconciliation.branch_id,
        "PUR.RECONCILIATION.MATCH",
    )
    if reconciliation.status != ReconciliationStatus.MISMATCH:
        raise ValidationError("Chỉ có thể đề nghị chấp nhận chênh lệch khi đối chiếu có sai lệch.")
    if not reason or not reason.strip():
        raise ValidationError("Nguyên nhân chênh lệch là bắt buộc.")
    if len(reason.strip()) > 500:
        raise ValidationError("Nguyên nhân chênh lệch không được vượt quá 500 ký tự.")

    previous = reconciliation.status
    reconciliation.difference_reason = reason.strip()
    reconciliation.version += 1
    reconciliation.save(update_fields=("difference_reason", "version", "updated_at"))

    audit(
        request,
        reconciliation,
        "REQUEST_RESOLVE",
        before={"status": previous},
        after={"status": reconciliation.status, "reason": reconciliation.difference_reason},
        reason=reason,
    )
    return reconciliation


@transaction.atomic
def resolve_variance(reconciliation, note, request):
    if not request.user.is_superuser and not has_effective_permission(
        request.user.iam_account,
        reconciliation.company,
        "PUR.RECONCILIATION.APPROVE",
        branch_id=reconciliation.branch_id,
    ):
        raise ValidationError("Bạn không có quyền phê duyệt chênh lệch đối chiếu.")

    if reconciliation.status != ReconciliationStatus.MISMATCH:
        raise ValidationError("Chỉ có thể chấp thuận chênh lệch cho đối chiếu có sai lệch.")
    if not reconciliation.difference_reason:
        raise ValidationError("Cần có nguyên nhân chênh lệch trước khi chấp nhận.")

    previous = reconciliation.status
    reconciliation.status = ReconciliationStatus.RESOLVED
    reconciliation.resolved_by = request.user.iam_account
    reconciliation.resolved_at = timezone.now()
    reconciliation.resolution_note = (note or "").strip()[:500]
    reconciliation.version += 1
    reconciliation.save(
        update_fields=("status", "resolved_by", "resolved_at", "resolution_note", "version", "updated_at")
    )

    # Now apply source progress
    apply_source_document_progress(reconciliation, request.user)

    audit(
        request,
        reconciliation,
        "RESOLVE",
        before={"status": previous},
        after={"status": reconciliation.status, "resolution_note": reconciliation.resolution_note},
        reason=note or "",
    )
    return reconciliation


@transaction.atomic
def recalculate_reconciliation(reconciliation, request):
    check_scope(
        request,
        reconciliation.company,
        reconciliation.branch_id,
        "PUR.RECONCILIATION.MATCH",
    )
    if reconciliation.status in [ReconciliationStatus.RESOLVED, ReconciliationStatus.CANCELLED]:
        raise ValidationError("Không thể đối chiếu lại chứng từ đã hoàn tất hoặc đã hủy.")

    # Re-run comparison with current source documents
    invoice = reconciliation.invoice
    po = reconciliation.purchase_order
    rcpt = reconciliation.purchase_receipt
    gp = reconciliation.goods_purchase

    lines_data = []
    for line in reconciliation.lines.all():
        lines_data.append(
            {
                "invoice_line": str(line.invoice_line_id),
                "order_line": str(line.order_line_id) if line.order_line_id else None,
                "receipt_line": str(line.receipt_line_id) if line.receipt_line_id else None,
                "purchase_line": str(line.purchase_line_id) if line.purchase_line_id else None,
                "matched_quantity": str(line.matched_quantity),
            }
        )

    computed = compute_comparison(
        reconciliation.company,
        invoice,
        reconciliation.matching_method,
        lines_data,
        purchase_order=po,
        purchase_receipt=rcpt,
        goods_purchase=gp,
    )

    previous = reconciliation.status
    reconciliation.status = computed["status"]
    reconciliation.total_invoice_amount = computed["total_invoice_amount"]
    reconciliation.total_matched_amount = computed["total_matched_amount"]
    reconciliation.total_difference_amount = computed["total_difference_amount"]
    reconciliation.version += 1
    reconciliation.save(
        update_fields=(
            "status",
            "total_invoice_amount",
            "total_matched_amount",
            "total_difference_amount",
            "version",
            "updated_at",
        )
    )

    # Update lines
    for idx, line_info in enumerate(computed["lines"], start=1):
        line = reconciliation.lines.filter(line_no=idx).first()
        if line:
            line.order_quantity = line_info["order_quantity"]
            line.received_quantity = line_info["received_quantity"]
            line.order_unit_price = line_info["order_unit_price"]
            line.invoice_unit_price = line_info["invoice_unit_price"]
            line.expected_tax_rate = line_info["expected_tax_rate"]
            line.invoice_tax_rate = line_info["invoice_tax_rate"]
            line.document_pre_tax_amount = line_info["document_pre_tax_amount"]
            line.invoice_pre_tax_amount = line_info["invoice_pre_tax_amount"]
            line.tax_difference = line_info["tax_difference"]
            line.total_difference = line_info["total_difference"]
            line.line_result = line_info["line_result"]
            line.difference_reason = line_info["difference_reason"]
            line.save()

    if previous == ReconciliationStatus.MISMATCH and computed["status"] in [
        ReconciliationStatus.MATCHED,
        ReconciliationStatus.PARTIALLY_MATCHED,
    ]:
        apply_source_document_progress(reconciliation, request.user)

    audit(
        request,
        reconciliation,
        "RECALCULATE",
        before={"status": previous},
        after={"status": reconciliation.status},
    )
    return reconciliation


@transaction.atomic
def cancel_reconciliation(reconciliation, reason, request):
    check_scope(
        request,
        reconciliation.company,
        reconciliation.branch_id,
        "PUR.RECONCILIATION.CANCEL",
    )
    if reconciliation.status == ReconciliationStatus.CANCELLED:
        raise ValidationError("Kết quả đối chiếu đã bị hủy trước đó.")

    previous = reconciliation.status
    if previous in [
        ReconciliationStatus.MATCHED,
        ReconciliationStatus.PARTIALLY_MATCHED,
        ReconciliationStatus.RESOLVED,
    ]:
        rollback_source_document_progress(reconciliation)

    reconciliation.status = ReconciliationStatus.CANCELLED
    reconciliation.difference_reason = (
        f"{reconciliation.difference_reason}; Hủy: {reason}".strip("; ")
        if reason
        else reconciliation.difference_reason
    )[:500]
    reconciliation.version += 1
    reconciliation.save(update_fields=("status", "difference_reason", "version", "updated_at"))

    audit(
        request,
        reconciliation,
        "CANCEL",
        before={"status": previous},
        after={"status": reconciliation.status},
        reason=reason or "",
    )
    return reconciliation
