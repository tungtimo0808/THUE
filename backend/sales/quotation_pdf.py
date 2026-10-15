"""Render an issued quotation from persisted values."""
from html import escape
from io import BytesIO
from decimal import Decimal, ROUND_HALF_UP

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from accounts_payable.reconciliation_pdf import _font


def render_quotation_pdf(quote):
    font = _font()
    normal = ParagraphStyle("QuoteNormal", fontName=font, fontSize=9, leading=13)
    title = ParagraphStyle("QuoteTitle", parent=normal, fontSize=17, leading=23, textColor=colors.HexColor("#17324d"))
    def p(value):
        return Paragraph(escape(str(value if value is not None else "")), normal)
    quantum = Decimal(1).scaleb(-quote.currency.decimal_places)
    def money(value):
        return f"{value:,.{quote.currency.decimal_places}f}"
    output = BytesIO()
    doc = SimpleDocTemplate(output, pagesize=A4, leftMargin=15*mm, rightMargin=15*mm,
                            topMargin=15*mm, bottomMargin=15*mm, title=quote.number)
    story = [Paragraph("BÁO GIÁ", title), p(quote.company.name), p(f"Số: {quote.number} — Phiên bản: {quote.version}"),
             p(f"Ngày báo giá: {quote.document_date} | Hiệu lực đến: {quote.valid_until}"),
             p(f"Khách hàng: {quote.customer.name}"), p(quote.title), Spacer(1, 5*mm)]
    rows = [[p(x) for x in ("STT", "Hàng hóa/Dịch vụ", "ĐVT", "Số lượng", "Đơn giá", "CK %", "Thuế %", "Tổng thanh toán")]]
    for line in quote.lines.select_related("item", "uom", "tax_rate").order_by("line_no"):
        gross = (line.quantity * line.unit_price).quantize(quantum, rounding=ROUND_HALF_UP)
        discount = (gross * line.discount_rate / Decimal("100")).quantize(quantum, rounding=ROUND_HALF_UP)
        tax = ((gross-discount) * (line.tax_rate.rate_percent or 0) / Decimal("100")).quantize(quantum, rounding=ROUND_HALF_UP) if line.tax_rate and line.tax_rate.application_form == "PERCENT" else Decimal("0")
        rows.append([p(line.line_no), p(line.item.name), p(line.uom.name), p(line.quantity), p(f"{line.unit_price:,.4f}"),
                     p(f"{line.discount_rate:.2f}"), p(f"{line.tax_rate.rate_percent:.2f}" if line.tax_rate and line.tax_rate.rate_percent is not None else "0"),
                     p(money(gross-discount+tax))])
    table = Table(rows, colWidths=[11*mm, 40*mm, 17*mm, 20*mm, 23*mm, 15*mm, 18*mm, 36*mm], repeatRows=1)
    table.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), colors.HexColor("#e8eff5")),
                               ("GRID", (0,0), (-1,-1), .3, colors.HexColor("#b7c5d0")),
                               ("VALIGN", (0,0), (-1,-1), "TOP"),
                               ("TOPPADDING", (0,0), (-1,-1), 5), ("BOTTOMPADDING", (0,0), (-1,-1), 5)]))
    story.extend([table, Spacer(1, 5*mm), p(f"Tổng tiền hàng: {money(quote.subtotal)} {quote.currency.code}"),
                  p(f"Tổng chiết khấu: {money(quote.discount_amount)} {quote.currency.code}"),
                  p(f"Tổng thuế GTGT: {money(quote.tax_amount)} {quote.currency.code}"),
                  p(f"Tổng thanh toán: {money(quote.total_amount)} {quote.currency.code}"),
                  p(f"Điều khoản thanh toán: {quote.payment_terms_text}"),
                  p(f"Điều khoản giao hàng: {quote.delivery_terms}"), p(f"Ghi chú: {quote.notes}")])
    doc.build(story)
    return output.getvalue()

