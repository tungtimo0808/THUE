"""Hàm dùng chung khi ghi sổ / bỏ ghi sổ chứng từ bán hàng: bút toán GL, phiếu kho, đơn vị tính."""

from __future__ import annotations

from decimal import Decimal

from django.db.models import Q, Sum
from rest_framework.exceptions import ValidationError

from general_ledger.models import JournalEntry
from general_ledger.services import source_module_request, unpost as unpost_journal
from inventory.models import InventoryTransaction, InventoryTransactionLine
from master_data.models import ItemUomConversion, fixed_uom_factor

from . import models


def source_journal(**fields):
    """Tạo bút toán cho chứng từ, hoặc dùng lại bút toán cũ đã bị bỏ ghi sổ (đang DRAFT/APPROVED).

    Dùng lại thay vì tạo mới để giữ số bút toán và lịch sử ghi sổ/bỏ ghi sổ của chứng từ.
    """
    existing = (
        JournalEntry.objects.select_for_update()
        .filter(company=fields["company"], number=fields["number"])
        .first()
    )
    if existing is None:
        return JournalEntry.objects.create(**fields)
    if existing.status not in ("DRAFT", "APPROVED") or str(existing.source_entity_id) != str(fields["source_entity_id"]):
        raise ValidationError(f"Số bút toán {fields['number']} đã được dùng cho chứng từ khác.")
    existing.lines.all().delete()
    for name, value in fields.items():
        setattr(existing, name, value)
    existing.save()
    return existing


def unpost_source_journal(request, entry, reason):
    """Bỏ ghi sổ bút toán qua Sổ cái: hoàn số dư (kể cả các kỳ sau), kiểm tra kỳ/khóa, giữ lịch sử."""
    unpost_journal(entry, source_module_request(request, from_source_module=True, reason=reason))


def ensure_sale_has_no_dependents(sale):
    """Chặn bỏ ghi sổ chứng từ bán khi đã có chứng từ phụ thuộc đã ghi sổ hoặc hóa đơn đã phát hành."""
    if isinstance(sale, models.GoodsSale) and sale.sales_returns.filter(status=models.DocumentStatus.POSTED).exists():
        raise ValidationError("Chứng từ đã có phiếu trả hàng được ghi sổ; hãy bỏ ghi sổ phiếu trả hàng trước.")
    if sale.sales_allowances.filter(status=models.DocumentStatus.POSTED).exists():
        raise ValidationError("Chứng từ đã có chứng từ giảm giá được ghi sổ; hãy bỏ ghi sổ chứng từ giảm giá trước.")
    line_filter = Q(goods_sale_line__sale=sale) if isinstance(sale, models.GoodsSale) else Q(service_sale_line__sale=sale)
    if sale.tax_invoice_id or models.SalesInvoiceLine.objects.filter(line_filter, invoice__status="ISSUED").exists():
        raise ValidationError("Chứng từ đã có hóa đơn được phát hành; hãy điều chỉnh/hủy hóa đơn trước khi bỏ ghi sổ.")
    receivable = sale.receivable
    if receivable and (receivable.collected_amount or receivable.netted_amount or receivable.adjustment_amount):
        raise ValidationError("Khoản phải thu đã phát sinh thu tiền, cấn trừ hoặc điều chỉnh, không thể bỏ ghi sổ.")


def base_quantity(item, uom, quantity):
    """Quy đổi số lượng theo ĐVT trên chứng từ về ĐVT cơ sở của mặt hàng (đơn vị của tồn kho và giá vốn)."""
    if not item.base_uom_id or uom.pk == item.base_uom_id:
        return quantity
    conversion = ItemUomConversion.objects.filter(item=item, from_uom=uom, to_uom_id=item.base_uom_id).first()
    factor = conversion.factor if conversion else fixed_uom_factor(uom, item.base_uom)
    if not factor:
        raise ValidationError(f"Hàng {item.code}: chưa khai báo quy đổi từ ĐVT {uom.code} về ĐVT cơ sở.")
    return quantity * factor


def free_inventory_number(company, base):
    """Số phiếu kho chưa dùng: `base`, rồi `base-2`, `base-3`... khi phiếu cũ (đã đảo) còn giữ số."""
    number, suffix = base, 1
    while InventoryTransaction.objects.filter(company=company, number=number).exists():
        suffix += 1
        number = f"{base}-{suffix}"
    return number


def issued_unit_cost(sale_line):
    """Giá vốn thực tế trên mỗi ĐVT cơ sở khi hàng của dòng bán xuất kho (phiếu xuất kèm, riêng, hoặc liên kết).

    Trả về None nếu chưa có phiếu xuất đã ghi sổ mang giá trị.
    """
    issued = InventoryTransactionLine.objects.filter(
        Q(pk=sale_line.inventory_transaction_line_id) | Q(sale_line=sale_line),
        transaction__transaction_type="ISSUE",
        transaction__status="POSTED",
    ).aggregate(qty=Sum("base_quantity"), value=Sum("line_value"))
    if not issued["qty"] or not issued["value"]:
        return None
    return issued["value"] / issued["qty"]


def posted_allowance_totals(goods_sale_line):
    """(Giá trị giảm giá, thuế giảm theo) đã ghi sổ trên một dòng bán hàng hóa."""
    totals = models.SalesAllowanceLine.objects.filter(
        goods_sale_line=goods_sale_line, allowance__status=models.DocumentStatus.POSTED
    ).aggregate(net=Sum("allowance_amount"), tax=Sum("tax_amount"))
    return totals["net"] or Decimal("0"), totals["tax"] or Decimal("0")


PAYMENT_ACCOUNT_PREFIX = {"UNPAID": ("131", "phải thu khách hàng"), "CASH": ("111", "tiền mặt"), "BANK": ("112", "tiền gửi ngân hàng")}


def check_payment_account(line_no, account, payment_type, first_account):
    """Tài khoản Nợ phải khớp hình thức thanh toán và giống nhau trên mọi dòng (bút toán dùng một dòng Nợ)."""
    prefix, label = PAYMENT_ACCOUNT_PREFIX.get(str(payment_type), (None, None))
    if prefix and not account.code.startswith(prefix):
        raise ValidationError(f"Dòng {line_no}: Hình thức thanh toán này phải dùng tài khoản {label} ({prefix}), không phải {account.code}.")
    if first_account is not None and account.pk != first_account.pk:
        raise ValidationError(f"Dòng {line_no}: Mọi dòng phải dùng cùng một tài khoản thanh toán/phải thu ({first_account.code}).")


def convert_to_accounting_currency(journal, exchange_rate):
    """Quy đổi các dòng bút toán ghi theo nguyên tệ của chứng từ sang đồng tiền hạch toán trước khi ghi sổ.

    Dòng giữ nguyên tệ và tỷ giá; chênh lệch làm tròn khi quy đổi dồn vào dòng lớn nhất để bút toán cân.
    Dòng đã ghi bằng đồng tiền hạch toán (giá vốn, kho) giữ nguyên.
    """
    accounting_currency_id = journal.company.accounting_currency_id
    lines = [line for line in journal.lines.all() if accounting_currency_id and line.currency_id != accounting_currency_id]
    if not lines:
        return
    if not exchange_rate or exchange_rate <= 0:
        raise ValidationError("Chứng từ ngoại tệ phải có tỷ giá lớn hơn 0.")
    for line in lines:
        amount = line.debit or line.credit
        line.foreign_amount = amount
        line.exchange_rate = exchange_rate
        converted = (amount * exchange_rate).quantize(Decimal("0.0001"))
        if line.debit:
            line.debit = converted
        else:
            line.credit = converted
    all_lines = {line.pk: line for line in journal.lines.all()}
    all_lines.update({line.pk: line for line in lines})
    difference = sum(line.debit for line in all_lines.values()) - sum(line.credit for line in all_lines.values())
    if difference:
        largest = max(lines, key=lambda line: line.debit or line.credit)
        if largest.debit:
            largest.debit -= difference
        else:
            largest.credit += difference
    for line in lines:
        line.save(update_fields=["debit", "credit", "foreign_amount", "exchange_rate"])


def check_adjustment_invoice(document, invoice):
    """Hóa đơn gắn vào trả hàng/giảm giá phải là hóa đơn đầu ra điều chỉnh giảm của đúng khách và đúng số tiền."""
    if invoice.direction != "OUTPUT" or invoice.invoice_type != "ADJUSTMENT" or invoice.adjustment_effect != "DECREASE":
        raise ValidationError("Chỉ được liên kết hóa đơn đầu ra loại điều chỉnh giảm.")
    if document.original_tax_invoice_id and invoice.original_invoice_id and invoice.original_invoice_id != document.original_tax_invoice_id:
        raise ValidationError("Hóa đơn điều chỉnh không điều chỉnh cho hóa đơn gốc của chứng từ.")
    customer = document.customer
    if invoice.tax_code and customer.tax_code:
        buyer_matches = invoice.tax_code == customer.tax_code
    else:
        buyer_matches = not invoice.buyer_name or customer.name in invoice.buyer_name
    if not buyer_matches:
        raise ValidationError("Thông tin người mua trên hóa đơn không khớp với khách hàng của chứng từ.")
    if abs(invoice.tax_amount - document.tax_amount) > Decimal("1") or abs(invoice.total_amount - document.total_amount) > Decimal("1"):
        raise ValidationError(
            f"Số tiền trên hóa đơn ({invoice.total_amount}, thuế {invoice.tax_amount}) không khớp chứng từ "
            f"({document.total_amount}, thuế {document.tax_amount})."
        )


def apply_order_delivery(order_line_quantities, sign):
    """Cộng (sign=1) / trừ (sign=-1) số đã giao trên dòng đơn hàng và cập nhật trạng thái giao của đơn.

    `order_line_quantities`: [(order_line_id, quantity)]. Chứng từ bán có xuất kho kèm là một lần giao hàng.
    """
    order_ids = set()
    for order_line_id, quantity in order_line_quantities:
        if not order_line_id:
            continue
        line = models.SalesOrderLine.objects.select_for_update().get(pk=order_line_id)
        line.delivered_quantity = max(Decimal("0"), line.delivered_quantity + sign * quantity)
        line.save(update_fields=["delivered_quantity"])
        order_ids.add(line.order_id)
    delivery_states = {models.DocumentStatus.APPROVED, models.DocumentStatus.PARTIALLY_DELIVERED, models.DocumentStatus.FULLY_DELIVERED}
    for order in models.SalesOrder.objects.select_for_update().filter(pk__in=order_ids, status__in=delivery_states):
        lines = list(order.lines.all())
        if all(l.remaining_quantity <= 0 for l in lines):
            order.status = models.DocumentStatus.FULLY_DELIVERED
        elif any(l.delivered_quantity > 0 for l in lines):
            order.status = models.DocumentStatus.PARTIALLY_DELIVERED
        else:
            order.status = models.DocumentStatus.APPROVED
        order.save(update_fields=["status", "updated_at"])
