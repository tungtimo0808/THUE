"""Render the saved supplier reconciliation snapshot as a printable PDF."""
import io
from decimal import Decimal
from html import escape
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def _font():
    name = "SupplierReconciliationArial"
    if name not in pdfmetrics.getRegisteredFontNames():
        candidates = (
            Path("C:/Windows/Fonts/arial.ttf"),
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        )
        font_path = next((path for path in candidates if path.exists()), None)
        if font_path:
            pdfmetrics.registerFont(TTFont(name, str(font_path)))
        else:
            return "Helvetica"
    return name


def render_reconciliation_pdf(record):
    data = record.snapshot
    supplier = data["supplier"]
    font = _font()
    normal = ParagraphStyle("NormalVN", fontName=font, fontSize=9, leading=13)
    small = ParagraphStyle("SmallVN", parent=normal, fontSize=7.5, leading=10)
    title = ParagraphStyle("TitleVN", parent=normal, fontSize=16, leading=21, alignment=TA_CENTER,
                           textColor=colors.HexColor("#17324d"), spaceAfter=12)
    right = ParagraphStyle("RightVN", parent=small, alignment=TA_RIGHT)
    bold = ParagraphStyle("BoldVN", parent=normal, fontSize=10, leading=14,
                          textColor=colors.HexColor("#17324d"))
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A4), leftMargin=15 * mm, rightMargin=15 * mm,
                            topMargin=15 * mm, bottomMargin=16 * mm, title=record.number)

    def p(value, style=small):
        return Paragraph(escape(str(value or "")), style)

    def money(value):
        return f"{Decimal(str(value)):,.4f}"

    story = [
        Paragraph("BIÊN BẢN ĐỐI CHIẾU CÔNG NỢ NHÀ CUNG CẤP", title),
        p(f"Số biên bản: {record.number}", bold),
        p(f"Kỳ đối chiếu: {record.period_start:%d/%m/%Y} - {record.period_end:%d/%m/%Y}    |    Loại tiền: {data['currency']['code']}", normal),
        Spacer(1, 4 * mm),
        p(f"Nhà cung cấp: {supplier['code']} - {supplier['name']}", normal),
        p(f"Mã số thuế: {supplier['tax_code']}    |    Địa chỉ: {supplier['address']}", normal),
        Spacer(1, 4 * mm),
        p(record.content, normal),
        Spacer(1, 5 * mm),
    ]
    summary = [
        [p("Số dư đầu kỳ", bold), p("Phát sinh tăng", bold), p("Phát sinh giảm", bold), p("Số dư cuối kỳ", bold)],
        [p(money(data["opening_balance"]), right), p(money(data["period_increase"]), right),
         p(money(data["period_decrease"]), right), p(money(data["closing_balance"]), right)],
    ]
    table = Table(summary, colWidths=[66 * mm] * 4, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eff5")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#8ba0b2")),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#b7c5d0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.extend([table, Spacer(1, 6 * mm), p("Chi tiết phát sinh", bold), Spacer(1, 2 * mm)])
    headers = ["Ngày", "Số chứng từ", "Nghiệp vụ", "Diễn giải", "Phát sinh tăng", "Phát sinh giảm", "Số dư sau GD"]
    rows = [[p(h, small) for h in headers]]
    for item in data["transactions"]:
        rows.append([
            p(item["date"]), p(item["number"]), p(item["kind"]), p(item["description"]),
            p(money(item["increase"]), right), p(money(item["decrease"]), right),
            p(money(item["balance_after"]), right),
        ])
    if len(rows) == 1:
        rows.append([p("Không phát sinh giao dịch trong kỳ"), "", "", "", "", "", ""])
    details = Table(rows, colWidths=[25 * mm, 39 * mm, 38 * mm, 58 * mm, 34 * mm, 34 * mm, 36 * mm],
                    repeatRows=1, hAlign="LEFT")
    details.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eff5")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#c4ced7")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("SPAN", (0, 1), (-1, 1)) if len(data["transactions"]) == 0 else ("TOPPADDING", (0, 0), (0, 0), 5),
    ]))
    story.extend([details, Spacer(1, 6 * mm)])
    if record.status in ("MATCHED", "DIFFERENT"):
        story.extend([
            p(f"Nhà cung cấp xác nhận ngày {record.confirmation_date:%d/%m/%Y} bởi {record.confirmed_by_name}", bold),
            p(f"Số dư xác nhận: {money(record.supplier_balance)}    |    Chênh lệch: {money(record.difference)}    |    Kết quả: {record.get_status_display()}", normal),
        ])
        if record.difference:
            story.extend([p(f"Nguyên nhân: {record.difference_reason}", normal),
                          p(f"Hướng xử lý: {record.resolution}", normal)])
    else:
        story.append(p(f"Trạng thái: {record.get_status_display()}", normal))

    def footer(canvas, pdf_doc):
        canvas.setFont(font, 8)
        canvas.setFillColor(colors.HexColor("#66788a"))
        canvas.drawString(15 * mm, 10 * mm, record.number)
        canvas.drawRightString(282 * mm, 10 * mm, f"Trang {pdf_doc.page}")

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()
