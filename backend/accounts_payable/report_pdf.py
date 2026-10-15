"""PDF exports for UC-AP-10."""
from html import escape
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .reconciliation_pdf import _font
from .report_services import COLS


def render_report_pdf(report):
    font = _font()
    normal = ParagraphStyle("ReportNormal", fontName=font, fontSize=7, leading=10)
    title = ParagraphStyle("ReportTitle", parent=normal, fontSize=15, leading=20, textColor=colors.HexColor("#17324d"))
    def p(value):
        return Paragraph(escape(str(value if value is not None else "")), normal)
    def money(value):
        return f"{value:,.4f}"
    output = BytesIO()
    f = report["filters"]
    doc = SimpleDocTemplate(output, pagesize=landscape(A4), leftMargin=12*mm, rightMargin=12*mm,
                            topMargin=12*mm, bottomMargin=12*mm, title="Báo cáo công nợ phải trả")
    story = [Paragraph("BÁO CÁO CÔNG NỢ PHẢI TRẢ", title),
             p(report["company_name"]),
             p(f"Kỳ báo cáo: {f['start_date']} đến {f['end_date']}   |   Loại tiền: {f['currency_code']}"),
             p(f"Nhà cung cấp: {report['supplier_filter']}"), Spacer(1, 5*mm)]
    if f["report_type"] == "SUMMARY":
        headers = ["Mã NCC", "Tên nhà cung cấp", "Số dư đầu kỳ", "Phát sinh tăng", "Phát sinh giảm", "Số dư cuối kỳ"]
        widths = (35, 70, 42, 42, 42, 42)
        rows = [[p(item) for item in headers]]
        for row in report["rows"]:
            rows.append([p(row["supplier_code"]), p(row["supplier_name"]),
                         *[p(money(row[key])) for key in COLS]])
        rows.append([p("Tổng cộng"), p(""), *[p(money(report["totals"][key])) for key in COLS]])
    else:
        headers = ["Mã NCC", "Tên nhà cung cấp", "Ngày hạch toán", "Số chứng từ", "Loại nghiệp vụ",
                   "Diễn giải", "Phát sinh tăng", "Phát sinh giảm", "Số dư sau GD"]
        widths = (20, 32, 23, 25, 31, 54, 29, 29, 30)
        rows = [[p(item) for item in headers]]
        for row in report["rows"]:
            rows.append([p(row["supplier_code"]), p(row["supplier_name"]), p(row["posting_date"]),
                         p(row["document_number"]), p(row.get("transaction_type_display", row["transaction_type"])), p(row["description"]),
                         p(money(row["increase"])), p(money(row["decrease"])), p(money(row["balance_after"]))])
        rows.append([p("Tổng cộng"), p(""), p(""), p(""), p(""), p(""),
                     p(money(report["totals"]["period_increase"])),
                     p(money(report["totals"]["period_decrease"])),
                     p(money(report["totals"]["closing_balance"]))])
    table = Table(rows, colWidths=[w*mm for w in widths], repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eff5")),
                               ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#edf2f6")),
                               ("GRID", (0, 0), (-1, -1), .3, colors.HexColor("#b7c5d0")),
                               ("VALIGN", (0, 0), (-1, -1), "TOP"),
                               ("TOPPADDING", (0, 0), (-1, -1), 5),
                               ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    story.append(table)
    if not report["rows"]:
        story.extend([Spacer(1, 5*mm), p(report["message"])])
    if f["report_type"] == "DETAIL":
        story.extend([Spacer(1, 4*mm), p(f"Tổng số dư đầu kỳ: {money(report['totals']['opening_balance'])} {f['currency_code']}")])
    doc.build(story)
    return output.getvalue()
