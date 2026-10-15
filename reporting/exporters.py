import html
import io
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image, ImageDraw, ImageFont


def _columns(run):
    rows = run.result.get("rows", [])
    return list(rows[0].keys()) if rows else ["message"]


def _table(run):
    columns = _columns(run)
    rows = run.result.get("rows", []) or [{"message": "Không có dữ liệu"}]
    title_rows = [
        [run.result.get("company", {}).get("name", "")],
        [run.result.get("report", {}).get("name", run.report.name)],
        [f"Từ {run.result.get('date_from', '')} đến {run.result.get('date_to', '')}"],
        [], columns,
    ]
    return title_rows + [[row.get(column, "") for column in columns] for row in rows]


def _excel_column(index):
    result = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        result = chr(65 + remainder) + result
    return result


def build_xlsx(run):
    rows = _table(run)
    sheet_rows = []
    for row_index, row in enumerate(rows, 1):
        cells = []
        for column_index, value in enumerate(row, 1):
            reference = f"{_excel_column(column_index)}{row_index}"
            text = "" if value is None else str(value)
            cells.append(f'<c r="{reference}" t="inlineStr"><is><t>{escape(text)}</t></is></c>')
        sheet_rows.append(f'<row r="{row_index}">{"".join(cells)}</row>')
    worksheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + "".join(sheet_rows) + "</sheetData></worksheet>"
    files = {
        "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
        "_rels/.rels": '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        "xl/workbook.xml": '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels": '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
        "xl/worksheets/sheet1.xml": worksheet,
    }
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in files.items():
            archive.writestr(name, content.encode("utf-8"))
    return output.getvalue()


def _font(size=18):
    candidates = (
        Path("C:/Windows/Fonts/arial.ttf"), Path("C:/Windows/Fonts/segoeui.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    )
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def build_pdf(run):
    table = _table(run)
    pages = []
    font, title_font = _font(17), _font(23)
    lines_per_page = 38
    for offset in range(0, len(table), lines_per_page):
        image = Image.new("RGB", (1654, 2339), "white")
        draw = ImageDraw.Draw(image)
        y = 80
        for index, row in enumerate(table[offset:offset + lines_per_page]):
            line = " | ".join(str(value) for value in row)
            draw.text((70, y), line[:170], fill="black", font=title_font if offset == 0 and index < 3 else font)
            y += 50
        pages.append(image)
    output = io.BytesIO()
    pages[0].save(output, format="PDF", save_all=True, append_images=pages[1:], resolution=150)
    return output.getvalue()


def build_print_html(run):
    columns = _columns(run)
    rows = run.result.get("rows", [])
    headers = "".join(f"<th>{html.escape(str(column))}</th>" for column in columns)
    body = "".join("<tr>" + "".join(f"<td>{html.escape(str(row.get(column, '')))}</td>" for column in columns) + "</tr>" for row in rows)
    return f'''<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>{html.escape(run.report.name)}</title><style>body{{font-family:Arial;margin:32px}}table{{border-collapse:collapse;width:100%}}th,td{{border:1px solid #777;padding:6px;text-align:left}}@media print{{button{{display:none}}}}</style></head><body><button onclick="window.print()">In</button><h2>{html.escape(run.company.name)}</h2><h1>{html.escape(run.report.name)}</h1><p>Từ {run.result.get('date_from', '')} đến {run.result.get('date_to', '')}</p><table><thead><tr>{headers}</tr></thead><tbody>{body}</tbody></table></body></html>'''.encode("utf-8")
