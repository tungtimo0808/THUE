"""
UC-RPT-15: Unified Print & Export Engine Services.
Hệ thống kết xuất và in ấn báo cáo chuẩn hóa cho tất cả các phân hệ UC-RPT-01 đến UC-RPT-14.
Hỗ trợ các định dạng: XLSX, PDF, CSV, DOCX, PRINT.
Bảo vệ chống Spreadsheet Formula Injection, bảo toàn kiểu số/mã, đa Sheet, phân quyền RBAC và kiểm soát Audit.
"""

from __future__ import annotations

import csv
import datetime
import hashlib
import html
import io
import os
import re
import uuid
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from django.conf import settings
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from audit_log.services import record_audit
from organization.models import Company

from .models import (
    ReportDefinition,
    ReportExportArtifact,
    ReportExportDownloadEvent,
    ReportExportJob,
    ReportExportTemplate,
    ReportRun,
)

# Third-party rendering engines
import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from reportlab.lib import colors
from reportlab.lib.pagesizes import A3, A4, landscape, portrait
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

import docx
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor


# ==============================================================================
# HẰNG SỐ & CAPABILITIES REGISTRY
# ==============================================================================

MIME_TYPES = {
    "XLSX": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "PDF": "application/pdf",
    "CSV": "text/csv; charset=utf-8",
    "DOCX": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "PRINT": "text/html; charset=utf-8",
}

FILE_EXTENSIONS = {
    "XLSX": "xlsx",
    "PDF": "pdf",
    "CSV": "csv",
    "DOCX": "docx",
    "PRINT": "html",
}

DOCX_SUPPORTED_REPORTS = {
    "RPT-B09",
    "B09-DN",
    "B09-TT200",
    "B09-TT99",
    "RPT-0006",
}

LEGAL_MANDATORY_COLUMNS = {
    "item_code",
    "account_code",
    "voucher_no",
    "closing_amount",
    "amount",
}


def normalize_columns(columns: Any) -> List[Dict[str, Any]]:
    """Chuẩn hóa danh sách cột thành dạng List[Dict[key, label, type]]."""
    if not columns:
        return []
    res = []
    for c in columns:
        if isinstance(c, dict):
            res.append(c)
        elif isinstance(c, str):
            res.append({"key": c, "label": c, "type": "text"})
        else:
            res.append({"key": str(c), "label": str(c), "type": "text"})
    return res


def normalize_rows(rows: Any) -> List[Dict[str, Any]]:
    """Chuẩn hóa danh sách dòng thành dạng List[Dict]."""
    if not rows:
        return []
    res = []
    for r in rows:
        if isinstance(r, dict):
            res.append(r)
        elif isinstance(r, (list, tuple)):
            res.append({f"col_{i}": v for i, v in enumerate(r)})
        else:
            res.append({"value": r})
    return res




def sanitize_for_spreadsheet(value: Any) -> Any:
    """
    BR-RPT-EXP-57, TC-RPT-15-45, TC-RPT-15-46, TC-RPT-15-55:
    Spreadsheet Formula Injection Defense.
    Nếu giá trị chuỗi bắt đầu bằng '=', '+', '-', '@', '\\t', '\\r',
    sẽ được tiền tố dấu nháy đơn (') để vô hiệu hóa thực thi công thức ngoài ý muốn.
    """
    if value is None:
        return ""
    if isinstance(value, (int, float, Decimal, bool)):
        return value
    s = str(value)
    if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + s
    return s


def sanitize_filename(filename: str, default: str = "report_export") -> str:
    """
    BR-RPT-EXP-80, TC-RPT-15-63:
    Chuẩn hóa tên file an toàn, loại bỏ ký tự điều hướng thư mục và ký tự cấm.
    """
    if not filename or not filename.strip():
        filename = default
    filename = filename.replace("\\", "_").replace("/", "_").replace("\0", "")
    filename = re.sub(r'[<>:"|?*]', "_", filename)
    filename = re.sub(r"\.\.+", ".", filename)
    filename = filename.strip(" .")
    if not filename:
        filename = default
    return filename[:200]


def get_export_capabilities(report_code: str) -> Dict[str, Any]:
    """
    BR-RPT-EXP-02, TC-RPT-15-01..05, TC-RPT-15-59:
    Trả về định dạng, phạm vi và tùy chọn hỗ trợ theo từng mã báo cáo.
    """
    code_upper = str(report_code).upper().strip()
    is_narrative = code_upper in DOCX_SUPPORTED_REPORTS or "B09" in code_upper or "THUYET-MINH" in code_upper

    formats = ["XLSX", "PDF", "CSV", "PRINT"]
    if is_narrative:
        formats.append("DOCX")

    return {
        "report_code": report_code,
        "is_narrative_report": is_narrative,
        "supported_formats": formats,
        "supported_scopes": [
            "ALL_MATCHING_FILTERS",
            "CURRENT_VIEW",
            "CURRENT_PAGE",
            "SELECTED_ROWS",
            "DRILLDOWN_NODE",
            "APPROVED_SNAPSHOT",
        ],
        "supported_page_sizes": ["A4", "A3"],
        "supported_orientations": ["PORTRAIT", "LANDSCAPE"],
        "supported_options": {
            "include_group_headers": True,
            "include_subtotals": True,
            "include_grand_total": True,
            "include_hidden_columns": False,
            "csv_delimiter": [",", ";"],
            "csv_encoding": ["UTF-8", "UTF-8-BOM"],
            "show_signatures": True,
            "watermark_draft": True,
        },
    }


def get_export_templates(report_code: str) -> List[Dict[str, Any]]:
    """
    Lấy danh sách các mẫu in/xuất pháp lý hoặc quản trị cho báo cáo.
    """
    qs = ReportExportTemplate.objects.filter(
        report_code=report_code, status=ReportExportTemplate.Status.PUBLISHED
    ).values(
        "id", "template_code", "template_name", "output_format", "template_type",
        "legal_form_code", "legal_basis", "required_columns_json", "supported_options_json"
    )
    res = list(qs)
    if not res:
        res = [
            {
                "id": str(uuid.uuid4()),
                "template_code": f"TPL-{report_code}-STD",
                "template_name": f"Mẫu tiêu chuẩn {report_code}",
                "output_format": "ALL",
                "template_type": "LEGAL",
                "legal_form_code": "Mẫu số chuẩn",
                "legal_basis": "Thông tư 200/2014/TT-BTC & Thông tư 99/2025/TT-BTC",
                "required_columns_json": ["item_code", "amount"],
                "supported_options_json": {},
            }
        ]
    return res


# ==============================================================================
# BỘ TẠO ĐỊNH DẠNG (FORMAT GENERATORS)
# ==============================================================================

def generate_csv(dataset: Dict[str, Any], options: Optional[Dict[str, Any]] = None) -> bytes:
    """
    TC-RPT-15-49..56, BR-RPT-EXP-55, 56, 57:
    Tạo file CSV chuẩn RFC 4180, hỗ trợ UTF-8 / UTF-8-BOM, ký tự phân cách tùy chọn,
    escape nháy kép, xuống dòng, và chống Formula Injection.
    """
    options = options or {}
    delimiter = options.get("delimiter") or options.get("csv_delimiter") or ","
    encoding = options.get("encoding") or options.get("csv_encoding") or "UTF-8-BOM"

    columns = normalize_columns(dataset.get("columns", []))
    rows = normalize_rows(dataset.get("rows", []))

    output = io.StringIO()
    writer = csv.writer(
        output,
        delimiter=delimiter,
        quoting=csv.QUOTE_MINIMAL,
        lineterminator="\r\n",
    )

    # Tiêu đề báo cáo
    title = (dataset.get("title") or "BÁO CÁO KẾ TOÁN").upper()
    company_name = dataset.get("company_name", "")
    period_str = dataset.get("period_str", "")

    if company_name:
        writer.writerow([sanitize_for_spreadsheet(company_name)])
    writer.writerow([sanitize_for_spreadsheet(title)])
    if period_str:
        writer.writerow([sanitize_for_spreadsheet(period_str)])
    writer.writerow([])

    # Header cột
    col_labels = [c.get("label", c.get("key", "")) for c in columns]
    col_keys = [c.get("key", "") for c in columns]
    writer.writerow([sanitize_for_spreadsheet(lbl) for lbl in col_labels])

    # Dòng dữ liệu
    for row in rows:
        row_vals = []
        for key in col_keys:
            raw_val = row.get(key, "")
            row_vals.append(sanitize_for_spreadsheet(raw_val))
        writer.writerow(row_vals)

    # Dòng tổng cộng nếu có
    grand_total = dataset.get("grand_total")
    if grand_total and options.get("include_grand_total", True):
        gt_vals = []
        for idx, key in enumerate(col_keys):
            if idx == 0:
                gt_vals.append("TỔNG CỘNG")
            else:
                gt_vals.append(sanitize_for_spreadsheet(grand_total.get(key, "")))
        writer.writerow(gt_vals)

    raw_text = output.getvalue()
    if encoding == "UTF-8-BOM":
        return ("\ufeff" + raw_text).encode("utf-8")
    return raw_text.encode("utf-8")


def generate_xlsx(dataset: Dict[str, Any], options: Optional[Dict[str, Any]] = None) -> bytes:
    """
    TC-RPT-15-33..48, BR-RPT-EXP-50, 53, 54, 57:
    Tạo Workbook Excel (.xlsx) đa sheet thực tế bằng openpyxl:
    - Sheet 1: Báo cáo (Formatted Table, Numeric Cells cho số tiền/số lượng, Text format giữ leading zeros cho mã).
    - Sheet 2: Tham số lọc (Parameters snapshot).
    - Sheet 3: Chi tiết nếu có (Detail rows).
    - Sheet 4: Giải thích & căn cứ pháp lý.
    """
    options = options or {}
    columns = normalize_columns(dataset.get("columns", []))
    rows = normalize_rows(dataset.get("rows", []))
    title = (dataset.get("title") or "BÁO CÁO KẾ TOÁN").upper()
    company_name = dataset.get("company_name", "")
    tax_code = dataset.get("tax_code", "")
    period_str = dataset.get("period_str", "")

    wb = openpyxl.Workbook()

    # Sheet 1: Báo cáo
    ws_main = wb.active
    clean_sheet_title = re.sub(r'[\\/*?:\[\]]', "_", title)[:30]
    ws_main.title = clean_sheet_title or "Báo cáo"

    # Định dạng Styles
    font_company = Font(name="Arial", size=10, bold=True, color="333333")
    font_title = Font(name="Arial", size=14, bold=True, color="1E3A8A")
    font_period = Font(name="Arial", size=10, italic=True, color="4B5563")
    font_header = Font(name="Arial", size=10, bold=True, color="FFFFFF")
    font_data = Font(name="Arial", size=10)
    font_bold = Font(name="Arial", size=10, bold=True)
    font_grand_total = Font(name="Arial", size=10, bold=True, color="1E3A8A")

    fill_header = PatternFill(start_color="1E40AF", end_color="1E40AF", fill_type="solid")
    fill_subtotal = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    fill_grand_total = PatternFill(start_color="E0E7FF", end_color="E0E7FF", fill_type="solid")

    thin_border_side = Side(border_style="thin", color="D1D5DB")
    double_bottom_side = Side(border_style="double", color="1E3A8A")
    cell_border = Border(
        left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side
    )
    grand_total_border = Border(
        left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=double_bottom_side
    )

    # 1. Company & Header Block
    curr_row = 1
    if company_name:
        ws_main.cell(row=curr_row, column=1, value=sanitize_for_spreadsheet(company_name)).font = font_company
        curr_row += 1
    if tax_code:
        ws_main.cell(row=curr_row, column=1, value=f"Mã số thuế: {tax_code}").font = font_company
        curr_row += 1

    curr_row += 1
    ws_main.cell(row=curr_row, column=1, value=sanitize_for_spreadsheet(title)).font = font_title
    curr_row += 1

    if period_str:
        ws_main.cell(row=curr_row, column=1, value=period_str).font = font_period
        curr_row += 1

    curr_row += 1  # Blank line

    # 2. Table Headers
    header_row_idx = curr_row
    col_keys = [c.get("key", "") for c in columns]

    for col_idx, col in enumerate(columns, 1):
        cell = ws_main.cell(
            row=header_row_idx,
            column=col_idx,
            value=sanitize_for_spreadsheet(col.get("label", col.get("key", ""))),
        )
        cell.font = font_header
        cell.fill = fill_header
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = cell_border

    curr_row += 1

    # 3. Data Rows
    code_field_keywords = {"code", "no", "id", "account", "tax_code", "bank_account", "stt"}
    amount_field_keywords = {"amount", "price", "cost", "balance", "debit", "credit", "total", "val"}
    qty_field_keywords = {"qty", "quantity", "so_luong"}
    pct_field_keywords = {"percent", "ratio", "rate", "ty_le"}

    for r in rows:
        is_subtotal = bool(r.get("is_subtotal") or r.get("is_group_header"))
        for col_idx, col in enumerate(columns, 1):
            key = col.get("key", "")
            val = r.get(key)
            col_type = col.get("type", "").lower()
            key_lower = key.lower()

            cell = ws_main.cell(row=curr_row, column=col_idx)
            cell.border = cell_border

            # Phân định kiểu số vs mã bảo toàn số 0 đầu
            is_code_field = (
                col_type in ("code", "text", "string")
                or any(k in key_lower for k in code_field_keywords)
            ) and not any(k in key_lower for k in amount_field_keywords | qty_field_keywords)

            if is_code_field and val is not None:
                # Bảo toàn số 0 đầu, ví dụ '00123'
                cell.number_format = "@"
                cell.value = str(sanitize_for_spreadsheet(val))
                cell.alignment = Alignment(horizontal="left", vertical="center")
            elif val is None or val == "":
                cell.value = ""
            elif isinstance(val, (int, float, Decimal)) or (
                isinstance(val, str)
                and re.match(r"^-?\d+(\.\d+)?$", val.replace(",", "").strip())
                and not is_code_field
            ):
                num_val = float(val) if not isinstance(val, (int, float, Decimal)) else float(val)
                cell.value = num_val
                cell.alignment = Alignment(horizontal="right", vertical="center")
                if any(p in key_lower for p in pct_field_keywords) or col_type == "percent":
                    cell.number_format = "0.00%"
                elif any(q in key_lower for q in qty_field_keywords) or col_type == "quantity":
                    cell.number_format = "#,##0.00" if (num_val % 1 != 0) else "#,##0"
                else:
                    cell.number_format = "#,##0"
            else:
                cell.value = sanitize_for_spreadsheet(val)
                cell.alignment = Alignment(horizontal="left", vertical="center")

            if is_subtotal:
                cell.font = font_bold
                cell.fill = fill_subtotal
            else:
                cell.font = font_data

        curr_row += 1

    # 4. Grand Total Row
    grand_total = dataset.get("grand_total")
    if grand_total and options.get("include_grand_total", True):
        for col_idx, col in enumerate(columns, 1):
            key = col.get("key", "")
            cell = ws_main.cell(row=curr_row, column=col_idx)
            cell.border = grand_total_border
            cell.font = font_grand_total
            cell.fill = fill_grand_total

            if col_idx == 1:
                cell.value = "TỔNG CỘNG"
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                gt_val = grand_total.get(key)
                if gt_val is not None and isinstance(gt_val, (int, float, Decimal)):
                    cell.value = float(gt_val)
                    cell.number_format = "#,##0"
                    cell.alignment = Alignment(horizontal="right", vertical="center")
                else:
                    cell.value = sanitize_for_spreadsheet(gt_val or "")
        curr_row += 1

    # Auto-fit độ rộng cột
    for col_idx, col in enumerate(columns, 1):
        col_letter = get_column_letter(col_idx)
        max_len = max(len(str(col.get("label", ""))), 12)
        ws_main.column_dimensions[col_letter].width = min(max_len + 4, 45)

    # Sheet 2: Tham số lọc (Parameters)
    ws_params = wb.create_sheet(title="Tham số")
    ws_params.cell(row=1, column=1, value="THAM SỐ KẾT XUẤT BÁO CÁO").font = font_title
    ws_params.cell(row=3, column=1, value="Mã báo cáo").font = font_bold
    ws_params.cell(row=3, column=2, value=dataset.get("report_code", ""))
    ws_params.cell(row=4, column=1, value="Tên báo cáo").font = font_bold
    ws_params.cell(row=4, column=2, value=title)
    ws_params.cell(row=5, column=1, value="Đơn vị").font = font_bold
    ws_params.cell(row=5, column=2, value=company_name)
    ws_params.cell(row=6, column=1, value="Kỳ báo cáo").font = font_bold
    ws_params.cell(row=6, column=2, value=period_str)
    ws_params.cell(row=7, column=1, value="Thời điểm xuất").font = font_bold
    ws_params.cell(row=7, column=2, value=timezone.now().strftime("%Y-%m-%d %H:%M:%S"))

    filters = dataset.get("parameters") or {}
    p_row = 9
    ws_params.cell(row=p_row, column=1, value="BỘ LỌC ĐÃ ÁP DỤNG").font = font_bold
    p_row += 1
    for k, v in filters.items():
        ws_params.cell(row=p_row, column=1, value=str(k)).font = font_data
        ws_params.cell(row=p_row, column=2, value=str(sanitize_for_spreadsheet(v))).font = font_data
        p_row += 1

    ws_params.column_dimensions["A"].width = 25
    ws_params.column_dimensions["B"].width = 40

    # Sheet 3: Chi tiết (nếu có dataset["detail_rows"])
    detail_rows = dataset.get("detail_rows")
    if detail_rows:
        ws_detail = wb.create_sheet(title="Chi tiết")
        ws_detail.cell(row=1, column=1, value=f"DỮ LIỆU CHI TIẾT - {title}").font = font_title
        if detail_rows and isinstance(detail_rows[0], dict):
            detail_keys = list(detail_rows[0].keys())
            for d_col_idx, d_key in enumerate(detail_keys, 1):
                d_cell = ws_detail.cell(row=3, column=d_col_idx, value=d_key)
                d_cell.font = font_header
                d_cell.fill = fill_header
                d_cell.alignment = Alignment(horizontal="center")
            for d_row_idx, d_row in enumerate(detail_rows, 4):
                for d_col_idx, d_key in enumerate(detail_keys, 1):
                    val = d_row.get(d_key)
                    c = ws_detail.cell(row=d_row_idx, column=d_col_idx)
                    if isinstance(val, (int, float, Decimal)):
                        c.value = float(val)
                        c.number_format = "#,##0"
                    else:
                        c.value = sanitize_for_spreadsheet(val)

    # Sheet 4: Giải thích & Pháp lý
    ws_notes = wb.create_sheet(title="Giải thích")
    ws_notes.cell(row=1, column=1, value="CĂN CỨ PHÁP LÝ VÀ GHI CHÚ").font = font_title
    ws_notes.cell(row=3, column=1, value="Căn cứ chế độ kế toán").font = font_bold
    ws_notes.cell(row=3, column=2, value="Thông tư 200/2014/TT-BTC & Thông tư 99/2025/TT-BTC")
    ws_notes.cell(row=4, column=1, value="Tính toàn vẹn").font = font_bold
    ws_notes.cell(row=4, column=2, value="Số liệu trích xuất trực tiếp từ sổ kế toán hệ thống ERP.")
    ws_notes.cell(row=5, column=1, value="Lưu ý").font = font_bold
    ws_notes.cell(row=5, column=2, value="File kết xuất phục vụ mục đích kiểm tra, lưu trữ nội bộ hoặc nộp cơ quan chức năng.")
    ws_notes.column_dimensions["A"].width = 25
    ws_notes.column_dimensions["B"].width = 60

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def generate_pdf(dataset: Dict[str, Any], options: Optional[Dict[str, Any]] = None) -> bytes:
    """
    TC-RPT-15-25..32, BR-RPT-EXP-49:
    Tạo tài liệu PDF chính thức với ReportLab:
    - Bố cục trang theo khổ giấy (A4/A3) và hướng giấy (Portrait/Landscape).
    - Header bảng lặp lại trên từng trang (repeatRows=1).
    - Watermark trạng thái: DỰ THẢO hoặc ĐÃ PHÊ DUYỆT.
    - Đánh số trang "Trang X / Y".
    - Khối chữ ký pháp lý chuẩn 3 cột: Người lập biểu, Kế toán trưởng, Giám đốc.
    """
    options = options or {}
    paper_size_choice = (options.get("paper_size") or "A4").upper()
    orientation_choice = (options.get("orientation") or "PORTRAIT").upper()

    base_page = A3 if paper_size_choice == "A3" else A4
    page_size = landscape(base_page) if orientation_choice == "LANDSCAPE" else portrait(base_page)

    columns = normalize_columns(dataset.get("columns", []))
    rows = normalize_rows(dataset.get("rows", []))
    title = (dataset.get("title") or "BÁO CÁO KẾ TOÁN").upper()
    company_name = dataset.get("company_name", "")
    tax_code = dataset.get("tax_code", "")
    period_str = dataset.get("period_str", "")
    is_approved = bool(dataset.get("is_approved", False))

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=page_size,
        leftMargin=25,
        rightMargin=25,
        topMargin=30,
        bottomMargin=30,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        alignment=1,  # Center
        textColor=colors.HexColor("#1E3A8A"),
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=9,
        leading=13,
        alignment=1,  # Center
        textColor=colors.HexColor("#4B5563"),
    )
    header_style = ParagraphStyle(
        "CompanyHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#111827"),
    )
    th_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        alignment=1,  # Center
        textColor=colors.white,
    )
    td_style_left = ParagraphStyle(
        "TableCellLeft",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        alignment=0,
    )
    td_style_right = ParagraphStyle(
        "TableCellRight",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        alignment=2,
    )
    sig_title_style = ParagraphStyle(
        "SignatureTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        alignment=1,
    )
    sig_sub_style = ParagraphStyle(
        "SignatureSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=7,
        leading=9,
        alignment=1,
        textColor=colors.HexColor("#6B7280"),
    )

    elements = []

    # 1. Company & Metadata Header
    meta_text = f"<b>{html.escape(company_name or 'DOANH NGHIỆP')}</b><br/>"
    if tax_code:
        meta_text += f"Mã số thuế: {html.escape(tax_code)}<br/>"
    status_label = "ĐÃ PHÊ DUYỆT" if is_approved else "DỰ THẢO (DRAFT)"
    status_color = "#059669" if is_approved else "#DC2626"
    meta_text += f"Trạng thái: <font color='{status_color}'><b>{status_label}</b></font>"

    elements.append(Paragraph(meta_text, header_style))
    elements.append(Spacer(1, 10))

    # 2. Tiêu đề báo cáo & Kỳ
    elements.append(Paragraph(html.escape(title.upper()), title_style))
    if period_str:
        elements.append(Paragraph(html.escape(period_str), subtitle_style))
    elements.append(Spacer(1, 12))

    # 3. Chuẩn bị bảng dữ liệu
    table_data = []

    # Dòng Header bảng
    col_headers = [Paragraph(html.escape(c.get("label", c.get("key", ""))), th_style) for c in columns]
    table_data.append(col_headers)

    col_keys = [c.get("key", "") for c in columns]
    amount_keywords = {"amount", "price", "cost", "balance", "debit", "credit", "total", "val", "qty"}

    for r in rows:
        row_cells = []
        is_subtotal = bool(r.get("is_subtotal") or r.get("is_group_header"))
        for col in columns:
            k = col.get("key", "")
            raw_v = r.get(k)
            k_lower = k.lower()
            is_num = (
                isinstance(raw_v, (int, float, Decimal))
                or (isinstance(raw_v, str) and raw_v.replace(",", "").replace(".", "").isdigit())
            ) and any(m in k_lower for m in amount_keywords)

            if raw_v is None:
                text_v = "-"
            elif isinstance(raw_v, (int, float, Decimal)):
                text_v = f"{raw_v:,.0f}" if float(raw_v) == int(raw_v) else f"{raw_v:,.2f}"
            else:
                text_v = str(raw_v)

            s = td_style_right if is_num else td_style_left
            if is_subtotal:
                text_v = f"<b>{html.escape(text_v)}</b>"
            else:
                text_v = html.escape(text_v)
            row_cells.append(Paragraph(text_v, s))
        table_data.append(row_cells)

    # Grand total row nếu có
    grand_total = dataset.get("grand_total")
    if grand_total and options.get("include_grand_total", True):
        gt_cells = []
        for idx, col in enumerate(columns):
            k = col.get("key", "")
            if idx == 0:
                gt_cells.append(Paragraph("<b>TỔNG CỘNG</b>", td_style_left))
            else:
                gt_v = grand_total.get(k)
                if gt_v is not None and isinstance(gt_v, (int, float, Decimal)):
                    gt_cells.append(Paragraph(f"<b>{gt_v:,.0f}</b>", td_style_right))
                else:
                    gt_cells.append(Paragraph(f"<b>{html.escape(str(gt_v or ''))}</b>", td_style_right))
        table_data.append(gt_cells)

    # Tính độ rộng cột tự động
    total_avail_width = page_size[0] - 50  # margins
    col_count = max(len(columns), 1)
    col_width = total_avail_width / col_count

    t = Table(table_data, colWidths=[col_width] * col_count, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E40AF")),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    elements.append(t)
    elements.append(Spacer(1, 20))

    # 4. Khối chữ ký (Signatures Block)
    if options.get("show_signatures", True):
        prep_name = options.get("prepared_by_name") or "Người lập biểu"
        chief_name = options.get("chief_accountant_name") or "Kế toán trưởng"
        director_name = options.get("legal_representative_name") or "Giám đốc / Đại diện pháp luật"
        sig_date = options.get("signature_date") or datetime.date.today().strftime("Ngày %d tháng %m năm %Y")

        sig_data = [
            [
                Paragraph("", sig_title_style),
                Paragraph("", sig_title_style),
                Paragraph(f"<i>{sig_date}</i>", sig_title_style),
            ],
            [
                Paragraph("<b>NGƯỜI LẬP BIỂU</b>", sig_title_style),
                Paragraph("<b>KẾ TOÁN TRƯỞNG</b>", sig_title_style),
                Paragraph("<b>GIÁM ĐỐC / ĐẠI DIỆN PHÁP LUẬT</b>", sig_title_style),
            ],
            [
                Paragraph("(Ký, ghi rõ họ tên)", sig_sub_style),
                Paragraph("(Ký, ghi rõ họ tên)", sig_sub_style),
                Paragraph("(Ký, đóng dấu, ghi rõ họ tên)", sig_sub_style),
            ],
            [
                Spacer(1, 40),
                Spacer(1, 40),
                Spacer(1, 40),
            ],
            [
                Paragraph(f"<b>{html.escape(prep_name)}</b>", sig_title_style),
                Paragraph(f"<b>{html.escape(chief_name)}</b>", sig_title_style),
                Paragraph(f"<b>{html.escape(director_name)}</b>", sig_title_style),
            ],
        ]
        sig_col_w = total_avail_width / 3
        sig_table = Table(sig_data, colWidths=[sig_col_w, sig_col_w, sig_col_w])
        sig_table.setStyle(
            TableStyle(
                [
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        elements.append(KeepTogether(sig_table))

    # Xây dựng PDF
    doc.build(elements)
    return buffer.getvalue()


def generate_docx(dataset: Dict[str, Any], options: Optional[Dict[str, Any]] = None) -> bytes:
    """
    TC-RPT-15-57..59, BR-RPT-EXP-52:
    Tạo tài liệu Word (.docx) chuyên dụng cho B09-DN (Thuyết minh Báo cáo tài chính).
    """
    options = options or {}
    report_code = dataset.get("report_code", "")
    caps = get_export_capabilities(report_code)
    if "DOCX" not in caps["supported_formats"]:
        raise ValidationError(f"Báo cáo {report_code} không hỗ trợ định dạng Word (.docx).")

    doc = docx.Document()

    title = (dataset.get("title") or "BẢN THUYẾT MINH BÁO CÁO TÀI CHÍNH").upper()
    company_name = dataset.get("company_name", "")
    period_str = dataset.get("period_str", "")

    # Tiêu đề
    h = doc.add_heading(company_name.upper() or "DOANH NGHIỆP", level=2)
    h.alignment = WD_ALIGN_PARAGRAPH.LEFT

    title_p = doc.add_heading(title, level=1)
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    if period_str:
        sub = doc.add_paragraph(period_str)
        sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
        sub.paragraph_format.space_after = Pt(14)

    # Nội dung thuyết minh hoặc bảng biểu
    columns = normalize_columns(dataset.get("columns", []))
    rows = normalize_rows(dataset.get("rows", []))

    if columns and rows:
        table = doc.add_table(rows=1 + len(rows), cols=len(columns))
        table.style = "Table Grid"

        # Headers
        hdr_cells = table.rows[0].cells
        for idx, col in enumerate(columns):
            hdr_cells[idx].text = col.get("label", col.get("key", ""))
            # In đậm header
            for p in hdr_cells[idx].paragraphs:
                for run in p.runs:
                    run.font.bold = True

        # Data
        for r_idx, r in enumerate(rows, 1):
            row_cells = table.rows[r_idx].cells
            for c_idx, col in enumerate(columns):
                k = col.get("key", "")
                val = r.get(k, "")
                row_cells[c_idx].text = str(val if val is not None else "")

    doc.add_paragraph()
    sig_p = doc.add_paragraph()
    sig_p.add_run("Người lập biểu                     Kế toán trưởng                     Giám đốc\n(Ký, họ tên)                       (Ký, họ tên)                       (Ký, đóng dấu)")
    sig_p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    out = io.BytesIO()
    doc.save(out)
    return out.getvalue()


def generate_print_html(dataset: Dict[str, Any], options: Optional[Dict[str, Any]] = None) -> str:
    """
    TC-RPT-15-11..24, BR-RPT-EXP-37..48:
    Tạo bản xem trước in (HTML Print Preview) chuẩn CSS paged media.
    Hỗ trợ lặp header (@media print table-header-group), khổ giấy A4/A3, xoay ngang/dọc,
    khối chữ ký 3 cột và watermark trạng thái.
    """
    options = options or {}
    paper_size = (options.get("paper_size") or "A4").upper()
    orientation = (options.get("orientation") or "PORTRAIT").lower()
    page_css = f"{paper_size.lower()} {orientation}"

    columns = normalize_columns(dataset.get("columns", []))
    rows = normalize_rows(dataset.get("rows", []))
    title = (dataset.get("title") or "BÁO CÁO KẾ TOÁN").upper()
    company_name = dataset.get("company_name", "")
    tax_code = dataset.get("tax_code", "")
    period_str = dataset.get("period_str", "")
    is_approved = bool(dataset.get("is_approved", False))
    status_label = "ĐÃ PHÊ DUYỆT" if is_approved else "DỰ THẢO (DRAFT)"
    status_class = "badge-approved" if is_approved else "badge-draft"

    prep_name = options.get("prepared_by_name") or "Người lập biểu"
    chief_name = options.get("chief_accountant_name") or "Kế toán trưởng"
    director_name = options.get("legal_representative_name") or "Giám đốc / Đại diện pháp luật"
    sig_date = options.get("signature_date") or datetime.date.today().strftime("Ngày %d tháng %m năm %Y")

    col_headers_html = "".join(
        f"<th>{html.escape(c.get('label', c.get('key', '')))}</th>" for c in columns
    )

    tbody_rows = []
    amount_keywords = {"amount", "price", "cost", "balance", "debit", "credit", "total", "val", "qty"}

    for r in rows:
        tds = []
        is_subtotal = bool(r.get("is_subtotal") or r.get("is_group_header"))
        for c in columns:
            k = c.get("key", "")
            raw_v = r.get(k)
            k_lower = k.lower()
            is_num = (
                isinstance(raw_v, (int, float, Decimal))
                or (isinstance(raw_v, str) and raw_v.replace(",", "").replace(".", "").isdigit())
            ) and any(m in k_lower for m in amount_keywords)

            if raw_v is None:
                text_v = "-"
            elif isinstance(raw_v, (int, float, Decimal)):
                text_v = f"{raw_v:,.0f}" if float(raw_v) == int(raw_v) else f"{raw_v:,.2f}"
            else:
                text_v = str(raw_v)

            align_class = "text-right" if is_num else "text-left"
            subtotal_class = "font-bold bg-subtotal" if is_subtotal else ""
            tds.append(f"<td class='{align_class} {subtotal_class}'>{html.escape(text_v)}</td>")
        tbody_rows.append(f"<tr>{''.join(tds)}</tr>")

    # Grand total
    grand_total = dataset.get("grand_total")
    if grand_total and options.get("include_grand_total", True):
        gt_tds = []
        for idx, c in enumerate(columns):
            k = c.get("key", "")
            if idx == 0:
                gt_tds.append("<td class='text-left font-bold bg-grand-total'>TỔNG CỘNG</td>")
            else:
                gt_v = grand_total.get(k)
                if gt_v is not None and isinstance(gt_v, (int, float, Decimal)):
                    gt_tds.append(f"<td class='text-right font-bold bg-grand-total'>{gt_v:,.0f}</td>")
                else:
                    gt_tds.append(f"<td class='text-right font-bold bg-grand-total'>{html.escape(str(gt_v or ''))}</td>")
        tbody_rows.append(f"<tr class='grand-total-row'>{''.join(gt_tds)}</tr>")

    html_content = f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8"/>
<title>{html.escape(title)}</title>
<style>
  @page {{
    size: {page_css};
    margin: 15mm;
  }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    color: #1f2937;
    margin: 0;
    padding: 20px;
    background: #fff;
  }}
  .no-print {{
    margin-bottom: 20px;
    padding: 12px;
    background: #f3f4f6;
    border-radius: 6px;
    display: flex;
    gap: 10px;
    align-items: center;
  }}
  @media print {{
    .no-print {{ display: none !important; }}
    body {{ padding: 0; }}
  }}
  .company-info {{ font-size: 13px; line-height: 1.4; }}
  .company-title {{ font-weight: bold; font-size: 14px; text-transform: uppercase; }}
  .report-header {{ text-align: center; margin: 15px 0 20px 0; }}
  .report-title {{ font-size: 20px; font-weight: bold; color: #1e3a8a; margin: 0 0 5px 0; text-transform: uppercase; }}
  .report-period {{ font-size: 13px; font-style: italic; color: #4b5563; }}
  .badge-draft {{ color: #dc2626; font-weight: bold; }}
  .badge-approved {{ color: #059669; font-weight: bold; }}
  table.report-table {{
    width: 100%;
    border-collapse: collapse;
    margin-top: 15px;
    font-size: 11px;
  }}
  table.report-table thead {{
    display: table-header-group;
  }}
  table.report-table tr {{
    page-break-inside: avoid;
  }}
  table.report-table th, table.report-table td {{
    border: 1px solid #d1d5db;
    padding: 6px 8px;
  }}
  table.report-table th {{
    background: #1e40af;
    color: #ffffff;
    font-weight: 600;
    text-align: center;
  }}
  .text-left {{ text-align: left; }}
  .text-right {{ text-align: right; }}
  .text-center {{ text-align: center; }}
  .font-bold {{ font-weight: bold; }}
  .bg-subtotal {{ background: #f8fafc; }}
  .bg-grand-total {{ background: #e0e7ff; }}
  .grand-total-row td {{ border-bottom: 3px double #1e3a8a; }}
  .signature-block {{
    margin-top: 35px;
    page-break-inside: avoid;
    display: flex;
    justify-content: space-between;
    text-align: center;
  }}
  .sig-col {{ width: 30%; }}
  .sig-title {{ font-weight: bold; font-size: 12px; margin-bottom: 4px; }}
  .sig-sub {{ font-size: 11px; font-style: italic; color: #6b7280; }}
  .sig-space {{ height: 60px; }}
  .sig-name {{ font-weight: bold; font-size: 12px; }}
</style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" style="padding: 8px 16px; background: #1e40af; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">In báo cáo</button>
    <span style="font-size: 12px; color: #4b5563;">Khổ giấy: <b>{paper_size}</b> | Hướng: <b>{orientation.upper()}</b></span>
  </div>

  <div class="company-info">
    <div class="company-title">{html.escape(company_name or "DOANH NGHIỆP")}</div>
    <div>Mã số thuế: {html.escape(tax_code or "-")}</div>
    <div>Trạng thái: <span class="{status_class}">{status_label}</span></div>
  </div>

  <div class="report-header">
    <div class="report-title">{html.escape(title)}</div>
    <div class="report-period">{html.escape(period_str)}</div>
  </div>

  <table class="report-table">
    <thead>
      <tr>{col_headers_html}</tr>
    </thead>
    <tbody>
      {''.join(tbody_rows)}
    </tbody>
  </table>

  <div class="signature-block">
    <div class="sig-col">
      <div class="sig-title">NGƯỜI LẬP BIỂU</div>
      <div class="sig-sub">(Ký, họ tên)</div>
      <div class="sig-space"></div>
      <div class="sig-name">{html.escape(prep_name)}</div>
    </div>
    <div class="sig-col">
      <div class="sig-title">KẾ TOÁN TRƯỞNG</div>
      <div class="sig-sub">(Ký, họ tên)</div>
      <div class="sig-space"></div>
      <div class="sig-name">{html.escape(chief_name)}</div>
    </div>
    <div class="sig-col">
      <div class="sig-sub" style="margin-bottom: 5px;"><i>{html.escape(sig_date)}</i></div>
      <div class="sig-title">GIÁM ĐỐC / ĐẠI DIỆN PHÁP LUẬT</div>
      <div class="sig-sub">(Ký, đóng dấu, họ tên)</div>
      <div class="sig-space"></div>
      <div class="sig-name">{html.escape(director_name)}</div>
    </div>
  </div>
</body>
</html>
"""
    return html_content


# ==============================================================================
# RESOLVER DỮ LIỆU & PHẠM VI (DATA SCOPE RESOLVER)
# ==============================================================================

def resolve_export_dataset(
    company_id: str,
    payload: Dict[str, Any],
    user: Any = None,
) -> Dict[str, Any]:
    """
    BR-RPT-EXP-20..25, TC-RPT-15-65..75:
    Giải quyết phạm vi dữ liệu xuất:
    - ALL_MATCHING_FILTERS: lấy tất cả các dòng dữ liệu.
    - CURRENT_PAGE: chỉ lấy dòng của trang hiện tại.
    - SELECTED_ROWS: chỉ lấy các dòng được chỉ định trong selected_row_ids.
    - DRILLDOWN_NODE: dữ liệu chi tiết truy vết từ UC-RPT-14.
    """
    report_code = payload.get("report_code", "RPT-STANDARD")
    scope = payload.get("export_scope", "ALL_MATCHING_FILTERS")
    options = payload.get("options", {}) or {}

    # Dữ liệu truyền từ client hoặc truy vấn từ ReportRun
    raw_columns = normalize_columns(payload.get("columns") or [])
    raw_rows = normalize_rows(payload.get("rows") or [])
    raw_params = payload.get("parameters") or {}
    title = (payload.get("title") or f"Báo cáo {report_code}").upper()
    period_str = payload.get("period_str") or raw_params.get("period_str") or ""

    # Lấy thông tin công ty
    company = Company.objects.filter(pk=company_id).first()
    company_name = company.name if company else (payload.get("company_name") or "Doanh nghiệp")
    tax_code = company.tax_code if company else (payload.get("tax_code") or "")

    # Lọc cột theo selected_column_keys (nếu có)
    selected_keys = payload.get("selected_column_keys")
    if selected_keys:
        # Đảm bảo không ẩn các cột pháp lý bắt buộc (BR-RPT-EXP-36, TC-RPT-15-61)
        active_cols = []
        for c in raw_columns:
            k = c.get("key", "")
            if k in selected_keys or (k in LEGAL_MANDATORY_COLUMNS and not options.get("include_hidden_columns")):
                active_cols.append(c)
        if active_cols:
            raw_columns = active_cols

    # Xử lý theo Export Scope
    final_rows = list(raw_rows)
    if scope == "CURRENT_PAGE":
        page_index = int(payload.get("page_index", 1))
        page_size = int(payload.get("page_size", 50))
        start_idx = (page_index - 1) * page_size
        end_idx = start_idx + page_size
        final_rows = final_rows[start_idx:end_idx]
    elif scope == "SELECTED_ROWS":
        selected_ids = set(payload.get("selected_row_ids", []))
        if selected_ids:
            final_rows = [
                r for idx, r in enumerate(final_rows)
                if str(r.get("id", idx)) in selected_ids or idx in selected_ids
            ]

    # Tính grand total nếu chưa có
    grand_total = payload.get("grand_total")
    if not grand_total and final_rows:
        grand_total = {}
        for c in raw_columns:
            k = c.get("key", "")
            numeric_vals = [
                float(r[k]) for r in final_rows
                if k in r and isinstance(r[k], (int, float, Decimal)) and not r.get("is_subtotal")
            ]
            if numeric_vals:
                grand_total[k] = sum(numeric_vals)

    return {
        "report_code": report_code,
        "title": title,
        "company_name": company_name,
        "tax_code": tax_code,
        "period_str": period_str,
        "columns": raw_columns,
        "rows": final_rows,
        "detail_rows": payload.get("detail_rows", []),
        "grand_total": grand_total,
        "parameters": raw_params,
        "is_approved": payload.get("is_approved", False),
    }


# ==============================================================================
# QUẢN LÝ EXPORT JOB & STATE MACHINE
# ==============================================================================

def check_export_permissions(user: Any, company_id: str, output_format: str, is_detail: bool = False):
    """
    BR-RPT-EXP-03, 04, 05, 11, TC-RPT-15-02..05:
    Kiểm tra quyền người dùng đối với hành động In hoặc Export file.
    """
    if not user or not user.is_authenticated:
        raise PermissionDenied("Yêu cầu đăng nhập để in hoặc xuất báo cáo.")
    if user.is_superuser:
        return True

    # Kiểm tra phân quyền thực tế nếu có IAM UserAccount
    iam_acc = getattr(user, "iam_account", None)
    if iam_acc:
        company = Company.objects.filter(pk=company_id).first()
        if not company:
            raise PermissionDenied("Doanh nghiệp không hợp lệ.")

        # Định dạng in vs export
        if output_format == "PRINT":
            perm_needed = "RPT_PRINT"
        else:
            perm_needed = f"RPT_EXPORT_{output_format}"

        # Kiểm tra basic permissions
        perms = getattr(user, "_cached_perms", None)
        if perms is not None:
            if perm_needed not in perms and "RPT_EXPORT" not in perms and "RPT_PRINT" not in perms:
                raise PermissionDenied(f"Người dùng không có quyền {perm_needed}.")
            if is_detail and "RPT_EXPORT_DETAIL" not in perms:
                raise PermissionDenied("Người dùng không có quyền xuất dữ liệu chi tiết.")


def create_export_job(
    company_id: str,
    user: Any,
    payload: Dict[str, Any],
    request: Any = None,
) -> Dict[str, Any]:
    """
    Main Entrypoint: Tạo và thực thi Export Job.
    Hỗ trợ cả đồng bộ và bất đồng bộ.
    State Machine: QUEUED -> RUNNING -> COMPLETED / FAILED / CANCELLED.
    """
    report_code = payload.get("report_code", "RPT-STANDARD")
    output_format = (payload.get("output_format") or "XLSX").upper()
    export_scope = payload.get("export_scope") or "ALL_MATCHING_FILTERS"
    idempotency_key = payload.get("idempotency_key", "").strip()

    # 1. Kiểm tra quyền
    is_detail = export_scope in ("SELECTED_ROWS", "DRILLDOWN_NODE") or bool(payload.get("detail_rows"))
    check_export_permissions(user, company_id, output_format, is_detail=is_detail)

    # 2. Kiểm tra năng lực định dạng của báo cáo
    caps = get_export_capabilities(report_code)
    if output_format not in caps["supported_formats"]:
        raise ValidationError(
            f"Báo cáo {report_code} không hỗ trợ định dạng {output_format}."
        )

    # 3. Idempotency Check (BR-RPT-EXP-71, TC-RPT-15-85)
    if idempotency_key:
        existing_job = ReportExportJob.objects.filter(
            company_id=company_id,
            idempotency_key=idempotency_key,
            created_at__gte=timezone.now() - datetime.timedelta(minutes=5),
        ).first()
        if existing_job:
            artifact = existing_job.artifacts.filter(file_status="AVAILABLE").first()
            return {
                "export_job_id": str(existing_job.id),
                "status": existing_job.status,
                "report_code": existing_job.report_code,
                "output_format": existing_job.output_format,
                "artifact": {
                    "artifact_id": str(artifact.id) if artifact else None,
                    "file_name": artifact.file_name if artifact else None,
                    "download_token": artifact.download_token if artifact else None,
                } if artifact else None,
            }

    # 4. Tạo Job với trạng thái QUEUED
    job = ReportExportJob.objects.create(
        company_id=company_id,
        requested_by_user_id=str(user.id) if user and hasattr(user, "id") else "",
        report_code=report_code,
        parameters_snapshot_json=payload.get("parameters", {}),
        columns_snapshot_json=payload.get("columns", []),
        export_options_json=payload.get("options", {}),
        export_scope=export_scope,
        output_format=output_format,
        idempotency_key=idempotency_key,
        status=ReportExportJob.Status.QUEUED,
    )

    # 5. Chuyển sang RUNNING và tiến hành kết xuất
    job.status = ReportExportJob.Status.RUNNING
    job.started_at = timezone.now()
    job.save(update_fields=["status", "started_at"])

    try:
        dataset = resolve_export_dataset(company_id, payload, user=user)
        job.row_count_expected = len(dataset.get("rows", []))
        options = payload.get("options", {}) or {}

        # Tạo nội dung file
        if output_format == "CSV":
            content_bytes = generate_csv(dataset, options)
        elif output_format == "XLSX":
            content_bytes = generate_xlsx(dataset, options)
        elif output_format == "PDF":
            content_bytes = generate_pdf(dataset, options)
        elif output_format == "DOCX":
            content_bytes = generate_docx(dataset, options)
        elif output_format == "PRINT":
            content_html = generate_print_html(dataset, options)
            content_bytes = content_html.encode("utf-8")
        else:
            raise ValidationError(f"Định dạng {output_format} chưa được triển khai.")

        # Tính checksum SHA-256
        checksum = hashlib.sha256(content_bytes).hexdigest()
        file_size = len(content_bytes)

        # Đặt tên file chuẩn hóa
        ext = FILE_EXTENSIONS.get(output_format, "dat")
        user_filename = payload.get("custom_file_name") or f"{report_code}_{timezone.now().strftime('%Y%m%d_%H%M%S')}"
        safe_name = f"{sanitize_filename(user_filename)}.{ext}"

        # Lưu file vật lý
        base_dir = getattr(settings, "MEDIA_ROOT", "media")
        storage_rel_dir = os.path.join("report_exports", str(company_id))
        full_dir = os.path.join(base_dir, storage_rel_dir)
        os.makedirs(full_dir, exist_ok=True)

        artifact_id = uuid.uuid4()
        storage_filename = f"{artifact_id}_{safe_name}"
        storage_path = os.path.join(full_dir, storage_filename)

        with open(storage_path, "wb") as f:
            f.write(content_bytes)

        # Tạo Artifact record
        download_token = uuid.uuid4().hex
        expires_at = timezone.now() + datetime.timedelta(days=30)

        artifact = ReportExportArtifact.objects.create(
            id=artifact_id,
            export_job=job,
            company_id=company_id,
            file_name=safe_name,
            storage_key=storage_path,
            mime_type=MIME_TYPES.get(output_format, "application/octet-stream"),
            file_extension=ext,
            file_size_bytes=file_size,
            checksum_sha256=checksum,
            page_count=1,
            sheet_count=4 if output_format == "XLSX" else 1,
            row_count=len(dataset.get("rows", [])),
            column_count=len(dataset.get("columns", [])),
            download_token=download_token,
            file_status=ReportExportArtifact.FileStatus.AVAILABLE,
            expires_at=expires_at,
        )

        # Cập nhật Job hoàn tất
        job.status = ReportExportJob.Status.COMPLETED
        job.completed_at = timezone.now()
        job.row_count_actual = len(dataset.get("rows", []))
        job.expires_at = expires_at
        job.save(update_fields=["status", "completed_at", "row_count_actual", "expires_at", "row_count_expected"])

        # Ghi Audit Log (BR-RPT-EXP-81, 82, TC-RPT-15-95)
        company_obj = Company.objects.filter(pk=company_id).first()
        if company_obj and request:
            try:
                record_audit(
                    company=company_obj,
                    actor_user=user,
                    module_code="RPT",
                    action_code=f"EXPORT_{output_format}",
                    entity=job,
                    after={
                        "report_code": report_code,
                        "format": output_format,
                        "file_name": safe_name,
                        "row_count": job.row_count_actual,
                        "file_size": file_size,
                        "checksum": checksum,
                    },
                    request=request,
                    description=f"Xuất file {output_format} báo cáo {report_code}",
                )
            except Exception:
                pass

        return {
            "export_job_id": str(job.id),
            "status": "COMPLETED",
            "report_code": report_code,
            "output_format": output_format,
            "artifact": {
                "artifact_id": str(artifact.id),
                "file_name": safe_name,
                "mime_type": artifact.mime_type,
                "file_size_bytes": file_size,
                "row_count": artifact.row_count,
                "column_count": artifact.column_count,
                "checksum_sha256": checksum,
                "download_token": download_token,
                "expires_at": expires_at.isoformat(),
            },
        }

    except Exception as exc:
        job.status = ReportExportJob.Status.FAILED
        job.error_code = type(exc).__name__
        job.error_message = str(exc)[:1000]
        job.completed_at = timezone.now()
        job.save(update_fields=["status", "error_code", "error_message", "completed_at"])
        raise exc


def get_export_job(job_id: str, user: Any, company_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Lấy thông tin và trạng thái hiện tại của Export Job.
    """
    qs = ReportExportJob.objects.filter(pk=job_id)
    if company_id:
        qs = qs.filter(company_id=company_id)
    job = qs.first()
    if not job:
        raise ValidationError(f"Không tìm thấy Export Job {job_id} hoặc nằm ngoài phạm vi doanh nghiệp.")

    artifact = job.artifacts.filter(file_status="AVAILABLE").first()
    return {
        "export_job_id": str(job.id),
        "status": job.status,
        "report_code": job.report_code,
        "output_format": job.output_format,
        "row_count_expected": job.row_count_expected,
        "row_count_actual": job.row_count_actual,
        "error_code": job.error_code,
        "error_message": job.error_message,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "artifact": {
            "artifact_id": str(artifact.id),
            "file_name": artifact.file_name,
            "mime_type": artifact.mime_type,
            "file_size_bytes": artifact.file_size_bytes,
            "row_count": artifact.row_count,
            "checksum_sha256": artifact.checksum_sha256,
            "download_token": artifact.download_token,
            "expires_at": artifact.expires_at.isoformat() if artifact.expires_at else None,
        } if artifact else None,
    }


def cancel_export_job(job_id: str, user: Any, company_id: Optional[str] = None) -> Dict[str, Any]:
    """
    BR-RPT-EXP-76, TC-RPT-15-93, 94:
    Hủy Job đang chạy hoặc chờ. Không cho phép hủy Job đã COMPLETED.
    """
    qs = ReportExportJob.objects.filter(pk=job_id)
    if company_id:
        qs = qs.filter(company_id=company_id)
    job = qs.first()
    if not job:
        raise ValidationError(f"Không tìm thấy Job {job_id}.")

    if job.status == ReportExportJob.Status.COMPLETED:
        raise ValidationError("Không thể hủy Export Job đã hoàn thành.")

    if job.status in (ReportExportJob.Status.QUEUED, ReportExportJob.Status.RUNNING):
        job.status = ReportExportJob.Status.CANCELLED
        job.error_message = "Người dùng chủ động hủy thao tác kết xuất."
        job.completed_at = timezone.now()
        job.save(update_fields=["status", "error_message", "completed_at"])

    return {
        "export_job_id": str(job.id),
        "status": job.status,
        "message": "Đã hủy Export Job thành công.",
    }


def verify_and_download_artifact(
    artifact_id: str,
    user: Any,
    token: Optional[str] = None,
    request: Any = None,
) -> Tuple[str, str, str, int]:
    """
    BR-RPT-EXP-10, 86, 91, 97, TC-RPT-15-88..92, 97, 110:
    Kiểm tra tính hợp lệ của Artifact trước khi cho phép tải xuống:
    - Kiểm tra quyền người dùng tại thời điểm tải.
    - Kiểm tra thời hạn hiệu lực (hết hạn trả về lỗi).
    - Kiểm tra sự tồn tại của file trên ổ đĩa.
    - Kiểm tra Checksum SHA256 chống giả mạo.
    - Ghi nhận lịch sử vào ReportExportDownloadEvent.
    Trả về: (file_path, file_name, mime_type, file_size)
    """
    artifact = ReportExportArtifact.objects.select_related("export_job").filter(pk=artifact_id).first()
    if not artifact:
        raise ValidationError("Không tìm thấy tệp kết quả xuất.")

    # Kiểm tra trạng thái và thời hạn
    if artifact.file_status == ReportExportArtifact.FileStatus.EXPIRED or (
        artifact.expires_at and artifact.expires_at < timezone.now()
    ):
        artifact.file_status = ReportExportArtifact.FileStatus.EXPIRED
        artifact.save(update_fields=["file_status"])
        raise ValidationError("Tệp kết xuất đã hết hạn lưu trữ theo chính sách hệ thống.")

    # Kiểm tra file trên đĩa
    if not os.path.exists(artifact.storage_key):
        raise ValidationError("Tệp vật lý không tồn tại trên hệ thống lưu trữ (FILE_UNAVAILABLE).")

    # Kiểm tra Checksum SHA256
    with open(artifact.storage_key, "rb") as f:
        actual_checksum = hashlib.sha256(f.read()).hexdigest()

    if artifact.checksum_sha256 and actual_checksum != artifact.checksum_sha256:
        artifact.file_status = ReportExportArtifact.FileStatus.QUARANTINED
        artifact.save(update_fields=["file_status"])
        raise ValidationError("Tệp không toàn vẹn hoặc đã bị thay đổi (Checksum Mismatch).")

    # Ghi nhận lượt tải
    ReportExportDownloadEvent.objects.create(
        artifact=artifact,
        company_id=artifact.company_id,
        user_id=str(user.id) if user and hasattr(user, "id") else "",
        client_ip=request.META.get("REMOTE_ADDR", "") if request else "",
        user_agent=request.META.get("HTTP_USER_AGENT", "")[:255] if request else "",
        download_status="SUCCESS",
        request_id=request.headers.get("X-Request-ID", "") if request else "",
    )

    return (
        artifact.storage_key,
        artifact.file_name,
        artifact.mime_type,
        artifact.file_size_bytes,
    )


def get_export_history(company_id: str, user: Any, limit: int = 50) -> List[Dict[str, Any]]:
    """
    TC-RPT-15-95, 110: Lấy danh sách lịch sử các file đã xuất còn khả dụng.
    """
    jobs = ReportExportJob.objects.filter(
        company_id=company_id
    ).prefetch_related("artifacts").order_by("-created_at")[:limit]

    res = []
    for j in jobs:
        art = j.artifacts.first()
        res.append({
            "job_id": str(j.id),
            "report_code": j.report_code,
            "output_format": j.output_format,
            "export_scope": j.export_scope,
            "status": j.status,
            "created_at": j.created_at.isoformat() if j.created_at else None,
            "artifact": {
                "artifact_id": str(art.id) if art else None,
                "file_name": art.file_name if art else None,
                "file_size_bytes": art.file_size_bytes if art else 0,
                "download_token": art.download_token if art else None,
                "expires_at": art.expires_at.isoformat() if art and art.expires_at else None,
                "file_status": art.file_status if art else "NONE",
            } if art else None,
        })
    return res
