"""Printable export for the currently filtered UC-AP-09 rows."""
from io import BytesIO
from html import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Table, TableStyle, Spacer

from .reconciliation_pdf import _font


def render_due_payables_pdf(data):
    font = _font()
    normal = ParagraphStyle("DueNormal", fontName=font, fontSize=7, leading=10)
    title = ParagraphStyle("DueTitle", parent=normal, fontSize=15, leading=20, textColor=colors.HexColor("#18344d"))
    def p(value):
        return Paragraph(escape(str(value if value is not None else "")), normal)
    def money(value):
        return f"{value:,.4f}"
    output = BytesIO()
    doc = SimpleDocTemplate(output, pagesize=landscape(A4), leftMargin=12*mm, rightMargin=12*mm,
                            topMargin=12*mm, bottomMargin=12*mm, title="Công nợ đến hạn")
    story = [Paragraph("CÔNG NỢ ĐẾN HẠN", title),
             p(f"Ngày xác định: {data['filters']['as_of_date']}   |   Loại tiền: {data['filters']['currency_code']}"),
             Spacer(1, 5*mm)]
    header = ["Nhà cung cấp", "Số chứng từ", "Số hóa đơn", "Ngày CT", "Hạn TT", "Tổng công nợ", "Đã thanh toán", "Còn phải trả", "Nhóm thời hạn", "Số ngày"]
    values = [[p(v) for v in header]]
    for row in data["rows"]:
        values.append([p(row["supplier_name"]), p(row["document_number"]), p(row["invoice_number"]),
                       p(row["document_date"]), p(row["due_date"]), p(money(row["total_debt"])),
                       p(money(row["paid_amount"])), p(money(row["remaining_amount"])),
                       p(row["due_group_name"]), p(row["days"])])
    if not data["rows"]:
        values.append([p(data["message"])] + [p("") for _ in header[1:]])
    table = Table(values, colWidths=[width*mm for width in (38, 31, 27, 20, 20, 30, 30, 30, 31, 16)], repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), colors.HexColor("#e8eff5")),
                               ("GRID", (0,0), (-1,-1), .3, colors.HexColor("#b7c5d0")),
                               ("VALIGN", (0,0), (-1,-1), "TOP"),
                               ("TOPPADDING", (0,0), (-1,-1), 5), ("BOTTOMPADDING", (0,0), (-1,-1), 5)]))
    story.extend([table, Spacer(1, 5*mm)])
    labels = [("Tổng còn phải trả", "remaining_amount"), ("Tổng quá hạn", "overdue"),
              ("Tổng đến hạn hôm nay", "due_today"), ("Tổng sắp đến hạn", "due_soon"),
              ("Tổng chưa đến hạn", "not_due"), ("Tổng chưa xác định hạn", "no_due_date")]
    for label, key in labels:
        story.append(p(f"{label}: {money(data['totals'][key])} {data['filters']['currency_code']}"))
    doc.build(story)
    return output.getvalue()
