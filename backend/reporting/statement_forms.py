"""Excel and PDF files laid out as the printed financial statement forms."""

import base64
import io
import re
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import LongTable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from rest_framework.exceptions import ValidationError

XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
FONT_DIRECTORIES = (Path("/usr/share/fonts/truetype/liberation"), Path("/usr/share/fonts/truetype/liberation2"))
WINDOWS_FONTS = Path("C:/Windows/Fonts")
AMOUNT_FORMAT = '#,##0;(#,##0);"-"'
HEADER_FILL = "D9E2F3"


@dataclass
class Column:
    label: str
    width: float
    numeric: bool = False


@dataclass
class Row:
    cells: list
    bold: bool = False
    indent: int = 0


@dataclass
class Statement:
    company_name: str
    company_address: str
    tax_code: str
    form_code: str
    legal_basis: str
    title: str
    period: str
    columns: list
    rows: list
    signature: dict = field(default_factory=dict)
    landscape: bool = False
    unit: str = "Đồng Việt Nam"


def _amount(value):
    """A Decimal for figures, None for an empty cell; negative values print in parentheses."""
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _display(value):
    amount = _amount(value)
    if amount is None:
        return ""
    text = f"{abs(amount):,.0f}".replace(",", ".")
    return f"({text})" if amount < 0 else text


def _signed_on(signature):
    text = str(signature.get("report_date") or "")
    match = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", text)
    if not match:
        return "Lập, ngày ... tháng ... năm ......"
    year, month, day = match.groups()
    return f"Lập, ngày {day} tháng {month} năm {year}"


def _signers(signature):
    return (
        ("Người lập biểu", signature.get("preparer_name") or ""),
        ("Kế toán trưởng", signature.get("chief_accountant_name") or ""),
        ("Người đại diện theo pháp luật", signature.get("representative_name") or ""),
    )


def build_xlsx(statement):
    book = Workbook()
    sheet = book.active
    sheet.title = re.sub(r"[^\w-]", "", statement.form_code)[:31] or "BCTC"
    count = len(statement.columns)
    thin = Side(style="thin", color="808080")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    font = "Times New Roman"
    last = get_column_letter(count)
    middle = max(1, count // 2)

    def merged(row, start, end, value, **style):
        sheet.merge_cells(start_row=row, start_column=start, end_row=row, end_column=end)
        cell = sheet.cell(row=row, column=start, value=value)
        cell.font = Font(name=font, size=style.get("size", 11), bold=style.get("bold", False), italic=style.get("italic", False))
        cell.alignment = Alignment(horizontal=style.get("align", "left"), vertical="center", wrap_text=True)
        return cell

    merged(1, 1, middle, statement.company_name, bold=True)
    merged(1, middle + 1, count, f"Mẫu số {statement.form_code}", bold=True, align="center")
    merged(2, 1, middle, statement.company_address)
    merged(2, middle + 1, count, statement.legal_basis, italic=True, align="center", size=10)
    merged(3, 1, middle, f"Mã số thuế: {statement.tax_code or ''}")
    sheet.row_dimensions[2].height = 30
    merged(5, 1, count, statement.title, bold=True, size=15, align="center")
    merged(6, 1, count, statement.period, italic=True, align="center")
    merged(7, 1, count, f"Đơn vị tính: {statement.unit}", italic=True, align="right", size=10)

    header_row = 8
    for index, column in enumerate(statement.columns, 1):
        cell = sheet.cell(row=header_row, column=index, value=column.label)
        cell.font = Font(name=font, size=11, bold=True)
        cell.fill = PatternFill("solid", fgColor=HEADER_FILL)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = border
        sheet.column_dimensions[get_column_letter(index)].width = column.width
    sheet.freeze_panes = f"A{header_row + 1}"

    row_number = header_row
    for row in statement.rows:
        row_number += 1
        for index, (column, value) in enumerate(zip(statement.columns, row.cells), 1):
            cell = sheet.cell(row=row_number, column=index)
            cell.font = Font(name=font, size=11, bold=row.bold)
            cell.border = border
            if column.numeric:
                amount = _amount(value)
                cell.value = None if amount is None else float(amount)
                cell.number_format = AMOUNT_FORMAT
                cell.alignment = Alignment(horizontal="right", vertical="center")
            else:
                cell.value = value
                cell.alignment = Alignment(
                    horizontal="left" if index == 1 else "center", vertical="center",
                    wrap_text=True, indent=row.indent if index == 1 else 0,
                )

    sign_row = row_number + 2
    merged(sign_row, 1, count, _signed_on(statement.signature), italic=True, align="right")
    signers = _signers(statement.signature)
    span = max(1, count // len(signers))
    for index, (title, name) in enumerate(signers):
        start = index * span + 1
        end = count if index == len(signers) - 1 else start + span - 1
        merged(sign_row + 1, start, end, title, bold=True, align="center")
        merged(sign_row + 2, start, end, "(Ký, họ tên)", italic=True, align="center", size=10)
        merged(sign_row + 6, start, end, name, align="center")

    sheet.page_setup.orientation = "landscape" if statement.landscape else "portrait"
    sheet.page_setup.paperSize = sheet.PAPERSIZE_A4
    sheet.page_setup.fitToWidth = 1
    sheet.page_setup.fitToHeight = 0
    sheet.sheet_properties.pageSetUpPr.fitToPage = True
    sheet.print_title_rows = f"{header_row}:{header_row}"
    sheet.print_area = f"A1:{last}{sign_row + 6}"
    output = io.BytesIO()
    book.save(output)
    return output.getvalue()


def _font_files():
    for directory in FONT_DIRECTORIES:
        if (directory / "LiberationSerif-Regular.ttf").exists():
            return {
                style: directory / f"LiberationSerif-{name}.ttf"
                for style, name in (("regular", "Regular"), ("bold", "Bold"), ("italic", "Italic"), ("boldItalic", "BoldItalic"))
            }
    dejavu_dir = Path("/usr/share/fonts/truetype/dejavu")
    if (dejavu_dir / "DejaVuSans.ttf").exists():
        bold_ttf = dejavu_dir / ("DejaVuSans-Bold.ttf" if (dejavu_dir / "DejaVuSans-Bold.ttf").exists() else "DejaVuSans.ttf")
        return {
            "regular": dejavu_dir / "DejaVuSans.ttf",
            "bold": bold_ttf,
            "italic": dejavu_dir / "DejaVuSans.ttf",
            "boldItalic": bold_ttf,
        }
    if (WINDOWS_FONTS / "times.ttf").exists():
        return {
            style: WINDOWS_FONTS / name
            for style, name in (("regular", "times.ttf"), ("bold", "timesbd.ttf"), ("italic", "timesi.ttf"), ("boldItalic", "timesbi.ttf"))
        }
    return None


def _register_fonts():
    if "StatementSerif" in pdfmetrics.getRegisteredFontNames():
        return True
    files = _font_files()
    if not files:
        return False
    for name, style in (
        ("StatementSerif", "regular"), ("StatementSerif-Bold", "bold"),
        ("StatementSerif-Italic", "italic"), ("StatementSerif-BoldItalic", "boldItalic"),
    ):
        pdfmetrics.registerFont(TTFont(name, str(files[style])))
    pdfmetrics.registerFontFamily(
        "StatementSerif", normal="StatementSerif", bold="StatementSerif-Bold",
        italic="StatementSerif-Italic", boldItalic="StatementSerif-BoldItalic",
    )
    return True


def _escape(value):
    return str(value if value is not None else "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def build_pdf(statement):
    has_custom_font = _register_fonts()
    base_font = "StatementSerif" if has_custom_font else "Times-Roman"
    bold_font = "StatementSerif-Bold" if has_custom_font else "Times-Bold"
    italic_font = "StatementSerif-Italic" if has_custom_font else "Times-Italic"
    page = landscape(A4) if statement.landscape else A4
    output = io.BytesIO()
    document = SimpleDocTemplate(
        output, pagesize=page, leftMargin=15 * mm, rightMargin=12 * mm, topMargin=12 * mm, bottomMargin=12 * mm,
        title=f"{statement.form_code} - {statement.title}", author=statement.company_name,
    )
    usable = page[0] - 27 * mm

    def style(**options):
        return ParagraphStyle("statement", fontName=options.pop("fontName", base_font), fontSize=options.pop("fontSize", 10), leading=options.pop("leading", 12.5), **options)

    body, bold = style(), style(fontName=bold_font)
    centered = style(alignment=TA_CENTER)
    title = style(fontName=bold_font, fontSize=15, leading=19, alignment=TA_CENTER, spaceBefore=6)
    italic_center = style(fontName=italic_font, alignment=TA_CENTER)
    right_italic = style(fontName=italic_font, alignment=TA_RIGHT, fontSize=9)

    heading = Table([[
        [Paragraph(_escape(statement.company_name), bold), Paragraph(_escape(statement.company_address), body),
         Paragraph(f"Mã số thuế: {_escape(statement.tax_code)}", body)],
        [Paragraph(f"Mẫu số {_escape(statement.form_code)}", style(fontName=bold_font, alignment=TA_CENTER)),
         Paragraph(_escape(statement.legal_basis), style(fontName=italic_font, alignment=TA_CENTER, fontSize=9))],
    ]], colWidths=[usable * 0.55, usable * 0.45])
    story = [
        heading, Spacer(1, 6), Paragraph(_escape(statement.title), title), Paragraph(_escape(statement.period), italic_center),
        Paragraph(f"Đơn vị tính: {_escape(statement.unit)}", right_italic), Spacer(1, 3),
    ]

    total_width = sum(column.width for column in statement.columns)
    widths = [usable * column.width / total_width for column in statement.columns]
    data = [[Paragraph(_escape(column.label), style(fontName=bold_font, alignment=TA_CENTER)) for column in statement.columns]]
    number_style = style(alignment=TA_RIGHT)
    number_bold = style(alignment=TA_RIGHT, fontName=bold_font)
    for row in statement.rows:
        cells = []
        for index, (column, value) in enumerate(zip(statement.columns, row.cells)):
            if column.numeric:
                cells.append(Paragraph(_display(value), number_bold if row.bold else number_style))
            elif index == 0:
                cells.append(Paragraph(_escape(value), style(leftIndent=row.indent * 8, fontName=bold_font if row.bold else base_font)))
            else:
                cells.append(Paragraph(_escape(value), centered))
        data.append(cells)
    table = LongTable(data, colWidths=widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(f"#{HEADER_FILL}")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(table)

    signers = _signers(statement.signature)
    story += [Spacer(1, 12), Paragraph(_signed_on(statement.signature), style(fontName=italic_font, alignment=TA_RIGHT))]
    block = Table(
        [
            [Paragraph(_escape(item[0]), style(fontName=bold_font, alignment=TA_CENTER)) for item in signers],
            [Paragraph("(Ký, họ tên)", italic_center) for _ in signers],
            ["", "", ""],
            [Paragraph(_escape(item[1]), centered) for item in signers],
        ],
        colWidths=[usable / 3] * 3, rowHeights=[None, None, 48, None],
    )
    story.append(block)
    document.build(story)
    return output.getvalue()


def attach_file(payload, statement, export_format, file_stem):
    """Adds the rendered file to an export response; other formats keep their existing payload."""
    kind = str(export_format or "").upper()
    if kind in ("EXCEL", "XLSX"):
        content, content_type, extension = build_xlsx(statement), XLSX_TYPE, "xlsx"
    elif kind == "PDF":
        content, content_type, extension = build_pdf(statement), "application/pdf", "pdf"
    else:
        return payload
    payload.update({
        "file_name": f"{file_stem}.{extension}", "content_type": content_type,
        "file_base64": base64.b64encode(content).decode("ascii"),
    })
    return payload


def signature_from(data):
    return {
        key: str(data.get(key) or "").strip()[:200]
        for key in ("preparer_name", "chief_accountant_name", "representative_name", "report_date")
    }


def statement_columns(first_amount, second_amount):
    return [
        Column("Chỉ tiêu", 62), Column("Mã số", 8), Column("Thuyết minh", 11),
        Column(first_amount, 19, True), Column(second_amount, 19, True),
    ]


def statement_row(name, code, note, first, second, level=1, bold=False):
    return Row([name, code, note or "", first, second], bold=bold, indent=max(0, int(level or 0)))


def attach_run_file(payload, run, company, lines, data, *, title, period, labels, keys, export_format):
    """Renders a TT99 statement run; `keys` name the two amount fields of the serialized lines."""
    rows = [
        statement_row(
            line["indicator_name"], line["indicator_code"], line.get("note_reference"),
            line.get(keys[0]), line.get(keys[1]), line.get("level") or 0,
            bold=line.get("line_type") in ("SUBTOTAL", "TOTAL", "SECTION", "HEADER") or not line.get("level"),
        )
        for line in lines
    ]
    statement = Statement(
        company_name=company.name, company_address=company.address or "", tax_code=company.tax_code or "",
        form_code=run.template.legal_form_code, legal_basis=run.template_version.legal_circular or "",
        title=title, period=period, columns=statement_columns(*labels), rows=rows, signature=signature_from(data),
    )
    method = "_GT" if getattr(run, "cash_flow_method", "") == "INDIRECT" else ""
    stem = f"{run.template.legal_form_code}{method}_{company.code}_{run.fiscal_year}_v{run.run_version}"
    return attach_file(payload, statement, export_format, stem)
