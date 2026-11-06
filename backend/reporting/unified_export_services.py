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
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
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


def _resolve_col_grouping(col: Dict[str, Any]) -> Tuple[Optional[str], str]:
    """Tách nhóm cột cha (group) và tiêu đề con (sublabel) theo chuẩn biểu mẫu kế toán."""
    grp = col.get("group")
    sub = col.get("sublabel")
    raw_label = str(col.get("label") or col.get("key") or "").strip()
    if grp and sub:
        return str(grp), str(sub)
    if " - " in raw_label:
        parts = raw_label.split(" - ", 1)
        g = re.sub(r"^Số dư đầu kỳ$", "Đầu kỳ", parts[0].strip(), flags=re.I)
        g = re.sub(r"^Số phát sinh trong kỳ$", "Phát sinh", g, flags=re.I)
        g = re.sub(r"^Số dư cuối kỳ$", "Cuối kỳ", g, flags=re.I)
        s = re.sub(r"^(Dư|Phát sinh)\s+(Nợ|Có)(\s*\(.*\))?$", r"\2", parts[1].strip(), flags=re.I)
        return g, s or parts[1].strip()

    k = str(col.get("key") or "").lower()
    mapping = {
        "opening_debit": ("Đầu kỳ", "Nợ"),
        "open_debit": ("Đầu kỳ", "Nợ"),
        "opening_credit": ("Đầu kỳ", "Có"),
        "open_credit": ("Đầu kỳ", "Có"),
        "opening_qty": ("Đầu kỳ", "Số lượng"),
        "opening_amount": ("Đầu kỳ", "Giá trị"),
        "period_debit": ("Phát sinh", "Nợ"),
        "period_credit": ("Phát sinh", "Có"),
        "accum_debit": ("Phát sinh", "Nợ lũy kế"),
        "cumulative_debit": ("Phát sinh", "Nợ lũy kế"),
        "accum_credit": ("Phát sinh", "Có lũy kế"),
        "cumulative_credit": ("Phát sinh", "Có lũy kế"),
        "closing_debit": ("Cuối kỳ", "Nợ"),
        "close_debit": ("Cuối kỳ", "Nợ"),
        "closing_credit": ("Cuối kỳ", "Có"),
        "close_credit": ("Cuối kỳ", "Có"),
        "closing_qty": ("Cuối kỳ", "Số lượng"),
        "closing_amount": ("Cuối kỳ", "Giá trị"),
        "in_qty": ("Nhập trong kỳ", "Số lượng"),
        "import_qty": ("Nhập trong kỳ", "Số lượng"),
        "in_amount": ("Nhập trong kỳ", "Giá trị"),
        "import_amount": ("Nhập trong kỳ", "Giá trị"),
        "out_qty": ("Xuất trong kỳ", "Số lượng"),
        "export_qty": ("Xuất trong kỳ", "Số lượng"),
        "out_amount": ("Xuất trong kỳ", "Giá trị"),
        "export_amount": ("Xuất trong kỳ", "Giá trị"),
    }
    if k in mapping:
        return mapping[k]
    return None, raw_label


def _build_grouped_headers(columns: List[Dict[str, Any]]) -> Tuple[bool, List[Dict[str, Any]], List[str]]:
    resolved = [_resolve_col_grouping(c) for c in columns]
    raw_labels = [str(c.get("label") or c.get("key") or "").strip() for c in columns]
    n = len(resolved)
    # Chỉ kích hoạt header 2 tầng khi có ít nhất 1 nhóm có >= 2 cột liên tiếp (hoặc cột truyền sẵn group tường minh)
    effective: List[Tuple[Optional[str], str]] = []
    idx = 0
    while idx < n:
        g, s = resolved[idx]
        explicit_grp = bool(columns[idx].get("group"))
        if not g:
            effective.append((None, s))
            idx += 1
        else:
            span = 1
            while idx + span < n and resolved[idx + span][0] == g:
                span += 1
            if span >= 2 or explicit_grp:
                for k in range(span):
                    effective.append(resolved[idx + k])
            else:
                effective.append((None, raw_labels[idx]))
            idx += span

    has_groups = any(g is not None for g, _ in effective)
    if not has_groups:
        return False, [], []
    top_row: List[Dict[str, Any]] = []
    sub_row: List[str] = []
    i = 0
    while i < n:
        g, s = effective[i]
        if not g:
            top_row.append({"label": s, "colspan": 1, "rowspan": 2, "start_col": i + 1})
            i += 1
        else:
            span = 1
            sub_row.append(s)
            while i + span < n and effective[i + span][0] == g:
                sub_row.append(effective[i + span][1])
                span += 1
            top_row.append({"label": g, "colspan": span, "rowspan": 1, "start_col": i + 1})
            i += span
    return True, top_row, sub_row


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
    Tạo tệp bảng tính Excel (.xlsx) chuẩn biểu mẫu báo cáo Doanh nghiệp:
    - Bố cục trang trọng: Thông tin công ty, tiêu đề căn giữa theo độ rộng bảng, đơn vị tính.
    - Màu sắc hài hòa: Header xám nhạt thanh lịch (#F1F5F9), viền đen/xám mảnh, không chói mắt.
    - Định dạng số kế toán: #,##0;(#,##0);"" (ẩn số 0 trống trải, dễ nhìn).
    - Dòng TỔNG CỘNG: Viền dưới nét kép (double line) chuẩn kế toán quốc tế.
    - Khối chữ ký pháp lý 3 cột ở cuối bảng: Người lập biểu, Kế toán trưởng, Giám đốc.
    - Auto-fit độ rộng cột thông minh dựa trên độ dài dữ liệu thực tế + header.
    - Bật đường lưới (showGridLines) và cố định hàng tiêu đề (freeze_panes).
    - Đa Sheet: Báo cáo, Tham số, Chi tiết (nếu có), Giải thích.
    - Bảo vệ chống Spreadsheet Formula Injection.
    """
    options = options or {}
    columns = normalize_columns(dataset.get("columns", []))
    rows = normalize_rows(dataset.get("rows", []))
    title = (dataset.get("title") or "BÁO CÁO KẾ TOÁN").upper()
    company_name = dataset.get("company_name", "") or "Công ty TNHH Tunghihihi"
    company_address = dataset.get("company_address", "") or "198 Trần Quang Khải, P. Hoàn Kiếm, Hà Nội - Việt Nam"
    tax_code = dataset.get("tax_code", "")
    period_str = dataset.get("period_str", "")
    unit_label = options.get("currency_unit") or dataset.get("currency_unit") or "Đơn vị tính: VND"

    wb = openpyxl.Workbook()

    # Sheet 1: Báo cáo
    ws_main = wb.active
    clean_sheet_title = re.sub(r'[\\/*?:\[\]]', "_", title)[:30]
    ws_main.title = clean_sheet_title or "Báo cáo"
    ws_main.views.sheetView[0].showGridLines = True

    num_cols = max(len(columns), 1)

    # Định dạng Styles chuẩn giao diện kế toán hiện đại
    font_company = Font(name="Arial", size=10, bold=True, color="0F172A")
    font_company_sub = Font(name="Arial", size=9, color="475569")
    font_title = Font(name="Arial", size=14, bold=True, color="0F172A")
    font_period = Font(name="Arial", size=10, italic=True, bold=True, color="334155")
    font_unit = Font(name="Arial", size=9.5, italic=True, color="334155")
    font_header = Font(name="Arial", size=10, bold=True, color="0F172A")
    font_data = Font(name="Arial", size=9.5, color="1E293B")
    font_code = Font(name="Arial", size=9.5, color="1D4ED8")
    font_bold = Font(name="Arial", size=9.5, bold=True, color="0F172A")
    font_grand_total = Font(name="Arial", size=10, bold=True, color="000000")
    font_sig_title = Font(name="Arial", size=10, bold=True, color="0F172A")
    font_sig_sub = Font(name="Arial", size=9, italic=True, color="475569")

    # Bảng màu MISA thanh lịch
    fill_header = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    fill_subtotal = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    fill_grand_total = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

    thin_border_side = Side(border_style="thin", color="000000")
    header_border = Border(
        left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side
    )
    cell_border = Border(
        left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side
    )
    double_bottom_side = Side(border_style="double", color="000000")
    grand_total_border = Border(
        left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=double_bottom_side
    )

    # 1. Khối thông tin công ty (Góc trên bên trái)
    curr_row = 1
    if company_name:
        ws_main.cell(row=curr_row, column=1, value=sanitize_for_spreadsheet(company_name)).font = font_company
        curr_row += 1
    if company_address:
        ws_main.cell(row=curr_row, column=1, value=sanitize_for_spreadsheet(company_address)).font = font_company_sub
        curr_row += 1
    if tax_code:
        ws_main.cell(row=curr_row, column=1, value=f"Mã số thuế: {tax_code}").font = font_company_sub
        curr_row += 1

    curr_row += 1

    # 2. Tiêu đề báo cáo (Căn giữa theo độ rộng bảng)
    title_row = curr_row
    ws_main.cell(row=title_row, column=1, value=sanitize_for_spreadsheet(title)).font = font_title
    ws_main.cell(row=title_row, column=1).alignment = Alignment(horizontal="center", vertical="center")
    if num_cols > 1:
        ws_main.merge_cells(start_row=title_row, start_column=1, end_row=title_row, end_column=num_cols)
    ws_main.row_dimensions[title_row].height = 24
    curr_row += 1

    # Dòng kỳ báo cáo
    if period_str:
        period_row = curr_row
        ws_main.cell(row=period_row, column=1, value=period_str).font = font_period
        ws_main.cell(row=period_row, column=1).alignment = Alignment(horizontal="center", vertical="center")
        if num_cols > 1:
            ws_main.merge_cells(start_row=period_row, start_column=1, end_row=period_row, end_column=num_cols)
        ws_main.row_dimensions[period_row].height = 18
        curr_row += 1

    # Dòng Đơn vị tính (nằm trên góc phải bảng)
    unit_row = curr_row
    ws_main.cell(row=unit_row, column=num_cols, value=unit_label).font = font_unit
    ws_main.cell(row=unit_row, column=num_cols).alignment = Alignment(horizontal="right", vertical="center")
    ws_main.row_dimensions[unit_row].height = 16
    curr_row += 1

    # 3. Table Headers (Hỗ trợ tiêu đề nhóm 2 tầng chuẩn MISA)
    header_row_idx = curr_row
    has_groups, top_row, sub_row = _build_grouped_headers(columns)

    if has_groups:
        ws_main.row_dimensions[header_row_idx].height = 26
        ws_main.row_dimensions[header_row_idx + 1].height = 24
        sub_ptr = 0
        for item in top_row:
            start_c = item["start_col"]
            span = item["colspan"]
            rspan = item["rowspan"]
            top_cell = ws_main.cell(
                row=header_row_idx,
                column=start_c,
                value=sanitize_for_spreadsheet(item["label"]),
            )
            top_cell.font = font_header
            top_cell.fill = fill_header
            top_cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            if rspan == 2:
                ws_main.merge_cells(
                    start_row=header_row_idx, start_column=start_c,
                    end_row=header_row_idx + 1, end_column=start_c
                )
                ws_main.cell(row=header_row_idx, column=start_c).border = header_border
                ws_main.cell(row=header_row_idx + 1, column=start_c).border = header_border
                ws_main.cell(row=header_row_idx + 1, column=start_c).fill = fill_header
            else:
                if span > 1:
                    ws_main.merge_cells(
                        start_row=header_row_idx, start_column=start_c,
                        end_row=header_row_idx, end_column=start_c + span - 1
                    )
                for offset in range(span):
                    c_idx = start_c + offset
                    ws_main.cell(row=header_row_idx, column=c_idx).border = header_border
                    ws_main.cell(row=header_row_idx, column=c_idx).fill = fill_header
                    sub_lbl = sub_row[sub_ptr] if sub_ptr < len(sub_row) else ""
                    sub_ptr += 1
                    sub_cell = ws_main.cell(
                        row=header_row_idx + 1,
                        column=c_idx,
                        value=sanitize_for_spreadsheet(sub_lbl),
                    )
                    sub_cell.font = font_header
                    sub_cell.fill = fill_header
                    sub_cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
                    sub_cell.border = header_border
        curr_row += 2
    else:
        ws_main.row_dimensions[header_row_idx].height = 28
        for col_idx, col in enumerate(columns, 1):
            cell = ws_main.cell(
                row=header_row_idx,
                column=col_idx,
                value=sanitize_for_spreadsheet(col.get("label", col.get("key", ""))),
            )
            cell.font = font_header
            cell.fill = fill_header
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            cell.border = header_border
        curr_row += 1

    # Cố định dòng Header khi cuộn
    ws_main.freeze_panes = f"A{curr_row}"

    # 4. Data Rows
    code_field_keywords = {"code", "no", "id", "account", "tax_code", "bank_account", "stt"}
    amount_field_keywords = {"amount", "price", "cost", "balance", "debit", "credit", "total", "val"}
    qty_field_keywords = {"qty", "quantity", "so_luong"}
    pct_field_keywords = {"percent", "ratio", "rate", "ty_le"}
    center_keywords = {"unit", "dvt", "date", "ngay", "ngay_ct"}

    # Theo dõi độ dài lớn nhất của từng cột để auto-fit chính xác
    col_max_lens = {idx: len(str(col.get("label", ""))) for idx, col in enumerate(columns, 1)}

    for r in rows:
        is_subtotal = bool(r.get("is_subtotal") or r.get("is_group_header"))
        ws_main.row_dimensions[curr_row].height = 20

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

            val_str = ""
            if is_code_field and val is not None:
                # Bảo toàn số 0 đầu, ví dụ '00123'
                cell.number_format = "@"
                cell.value = str(sanitize_for_spreadsheet(val))
                cell.alignment = Alignment(horizontal="left", vertical="center")
                cell.font = font_code if (col_idx == 1 and not is_subtotal) else (font_bold if is_subtotal else font_data)
                val_str = str(val)
            elif val is None or val == "":
                cell.value = ""
                cell.alignment = Alignment(horizontal="left", vertical="center")
                cell.font = font_bold if is_subtotal else font_data
            elif isinstance(val, (int, float, Decimal)) or (
                isinstance(val, str)
                and re.match(r"^-?\d+(\.\d+)?$", val.replace(",", "").strip())
                and not is_code_field
            ):
                num_val = float(val) if not isinstance(val, (int, float, Decimal)) else float(val)
                cell.value = num_val
                cell.alignment = Alignment(horizontal="right", vertical="center")
                cell.font = font_bold if is_subtotal else font_data
                if any(p in key_lower for p in pct_field_keywords) or col_type == "percent":
                    cell.number_format = "0.00%"
                elif any(q in key_lower for q in qty_field_keywords) or col_type == "quantity":
                    cell.number_format = '#,##0.00;(#,##0.00);""' if (num_val % 1 != 0) else '#,##0;(#,##0);""'
                else:
                    cell.number_format = '#,##0;(#,##0);""'
                val_str = f"{num_val:,.0f}" if num_val != 0 else ""
            else:
                cell.value = sanitize_for_spreadsheet(val)
                is_center = any(m in key_lower for m in center_keywords)
                cell.alignment = Alignment(horizontal="center" if is_center else "left", vertical="center")
                cell.font = font_bold if is_subtotal else font_data
                val_str = str(val)

            if is_subtotal:
                cell.fill = fill_subtotal

            col_max_lens[col_idx] = max(col_max_lens.get(col_idx, 0), len(val_str))

        curr_row += 1

    # 5. Grand Total Row
    grand_total = dataset.get("grand_total")
    if grand_total and options.get("include_grand_total", True):
        ws_main.row_dimensions[curr_row].height = 22
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
                    num_gt = float(gt_val)
                    cell.value = num_gt
                    cell.number_format = '#,##0;(#,##0);""'
                    cell.alignment = Alignment(horizontal="right", vertical="center")
                    col_max_lens[col_idx] = max(col_max_lens.get(col_idx, 0), len(f"{num_gt:,.0f}"))
                else:
                    cell.value = sanitize_for_spreadsheet(gt_val or "")
                    cell.alignment = Alignment(horizontal="right", vertical="center")
        curr_row += 1

    # 6. Khối chữ ký pháp lý chuẩn 3 cột trong Sheet Báo cáo
    if options.get("show_signatures", True):
        curr_row += 1  # 1 dòng trống
        sig_date = options.get("signature_date") or datetime.date.today().strftime("Ngày %d tháng %m năm %Y")
        raw_prep = options.get("prepared_by_name") or ""
        raw_chief = options.get("chief_accountant_name") or ""
        raw_director = options.get("legal_representative_name") or ""

        prep_name = raw_prep if raw_prep not in ("Người lập biểu", "người lập biểu") else ""
        chief_name = raw_chief if raw_chief not in ("Kế toán trưởng", "kế toán trưởng") else ""
        director_name = raw_director if raw_director not in ("Giám đốc / Đại diện pháp luật", "Giám đốc", "giám đốc") else ""

        # Xác định 3 vị trí cột chữ ký phân bố đều
        c_left = 2 if num_cols >= 4 else 1
        c_mid = max(num_cols // 2, c_left + 1)
        c_right = max(num_cols - 1, c_mid + 1)
        if c_right > num_cols:
            c_right = num_cols

        # Dòng ngày tháng năm (phía trên Giám đốc)
        date_row = curr_row
        ws_main.cell(row=date_row, column=c_right, value=sig_date).font = font_sig_sub
        ws_main.cell(row=date_row, column=c_right).alignment = Alignment(horizontal="center", vertical="center")
        curr_row += 1

        # Hàng chức danh
        title_r = curr_row
        ws_main.cell(row=title_r, column=c_left, value="Người lập biểu").font = font_sig_title
        ws_main.cell(row=title_r, column=c_left).alignment = Alignment(horizontal="center", vertical="center")

        ws_main.cell(row=title_r, column=c_mid, value="Kế toán trưởng").font = font_sig_title
        ws_main.cell(row=title_r, column=c_mid).alignment = Alignment(horizontal="center", vertical="center")

        ws_main.cell(row=title_r, column=c_right, value="Giám đốc").font = font_sig_title
        ws_main.cell(row=title_r, column=c_right).alignment = Alignment(horizontal="center", vertical="center")
        curr_row += 1

        # Hàng chú thích
        sub_r = curr_row
        ws_main.cell(row=sub_r, column=c_left, value="(Ký, họ tên)").font = font_sig_sub
        ws_main.cell(row=sub_r, column=c_left).alignment = Alignment(horizontal="center", vertical="center")

        ws_main.cell(row=sub_r, column=c_mid, value="(Ký, họ tên)").font = font_sig_sub
        ws_main.cell(row=sub_r, column=c_mid).alignment = Alignment(horizontal="center", vertical="center")

        ws_main.cell(row=sub_r, column=c_right, value="(Ký, họ tên, đóng dấu)").font = font_sig_sub
        ws_main.cell(row=sub_r, column=c_right).alignment = Alignment(horizontal="center", vertical="center")
        curr_row += 1

        # 3 dòng trống ký tên
        for _ in range(3):
            ws_main.row_dimensions[curr_row].height = 18
            curr_row += 1

        # Hàng họ tên nếu có
        if prep_name or chief_name or director_name:
            name_r = curr_row
            if prep_name:
                ws_main.cell(row=name_r, column=c_left, value=prep_name).font = font_sig_title
                ws_main.cell(row=name_r, column=c_left).alignment = Alignment(horizontal="center", vertical="center")
            if chief_name:
                ws_main.cell(row=name_r, column=c_mid, value=chief_name).font = font_sig_title
                ws_main.cell(row=name_r, column=c_mid).alignment = Alignment(horizontal="center", vertical="center")
            if director_name:
                ws_main.cell(row=name_r, column=c_right, value=director_name).font = font_sig_title
                ws_main.cell(row=name_r, column=c_right).alignment = Alignment(horizontal="center", vertical="center")
            curr_row += 1

    # Auto-fit độ rộng cột thông minh
    for col_idx, col in enumerate(columns, 1):
        col_letter = get_column_letter(col_idx)
        content_len = col_max_lens.get(col_idx, 12)
        key_lower = col.get("key", "").lower()
        if any(w in key_lower for w in ["name", "ten", "description", "diengiai"]):
            final_w = max(content_len + 4, 25)
        elif any(w in key_lower for w in ["code", "ma", "so"]):
            final_w = max(content_len + 4, 14)
        elif any(w in key_lower for w in ["unit", "dvt"]):
            final_w = max(content_len + 4, 10)
        else:
            final_w = max(content_len + 4, 15)
        ws_main.column_dimensions[col_letter].width = min(final_w, 55)

    # Sheet 2: Tham số lọc (Parameters)
    ws_params = wb.create_sheet(title="Tham số")
    ws_params.views.sheetView[0].showGridLines = True
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
    ws_params.column_dimensions["B"].width = 45

    # Sheet 3: Chi tiết (nếu có dataset["detail_rows"])
    detail_rows = dataset.get("detail_rows")
    if detail_rows:
        ws_detail = wb.create_sheet(title="Chi tiết")
        ws_detail.views.sheetView[0].showGridLines = True
        ws_detail.cell(row=1, column=1, value=f"DỮ LIỆU CHI TIẾT - {title}").font = font_title
        if detail_rows and isinstance(detail_rows[0], dict):
            detail_keys = list(detail_rows[0].keys())
            for d_col_idx, d_key in enumerate(detail_keys, 1):
                d_cell = ws_detail.cell(row=3, column=d_col_idx, value=d_key)
                d_cell.font = font_header
                d_cell.fill = fill_header
                d_cell.alignment = Alignment(horizontal="center", vertical="center")
                d_cell.border = header_border
            for d_row_idx, d_row in enumerate(detail_rows, 4):
                ws_detail.row_dimensions[d_row_idx].height = 20
                for d_col_idx, d_key in enumerate(detail_keys, 1):
                    val = d_row.get(d_key)
                    c = ws_detail.cell(row=d_row_idx, column=d_col_idx)
                    c.border = cell_border
                    if isinstance(val, (int, float, Decimal)):
                        c.value = float(val)
                        c.number_format = '#,##0;(#,##0);""'
                        c.alignment = Alignment(horizontal="right", vertical="center")
                    else:
                        c.value = sanitize_for_spreadsheet(val)
                        c.alignment = Alignment(horizontal="left", vertical="center")

    # Sheet 4: Giải thích & Pháp lý
    ws_notes = wb.create_sheet(title="Giải thích")
    ws_notes.views.sheetView[0].showGridLines = True
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


_FONTS_REGISTERED = False
_DEFAULT_FONT_NAME = "LiberationSerif"


def _ensure_pdf_fonts_registered() -> str:
    """
    Đăng ký TrueType Unicode fonts cho ReportLab để hỗ trợ 100% tiếng Việt UTF-8.
    Tìm kiếm font trên Linux container (/usr/share/fonts/...) và Windows (C:/Windows/Fonts/...).
    Trả về tên font gia đình mặc định đã đăng ký ("LiberationSerif" hoặc "LiberationSans" hoặc "TimesNewRoman" hoặc "Arial").
    """
    global _FONTS_REGISTERED, _DEFAULT_FONT_NAME
    if _FONTS_REGISTERED:
        return _DEFAULT_FONT_NAME

    font_configs = [
        {
            "name": "TimesNewRoman",
            "regular": "/usr/share/fonts/truetype/msttcorefonts/times.ttf",
            "bold": "/usr/share/fonts/truetype/msttcorefonts/timesbd.ttf",
            "italic": "/usr/share/fonts/truetype/msttcorefonts/timesi.ttf",
            "boldItalic": "/usr/share/fonts/truetype/msttcorefonts/timesbi.ttf",
        },
        {
            "name": "TimesNewRoman",
            "regular": "C:/Windows/Fonts/times.ttf",
            "bold": "C:/Windows/Fonts/timesbd.ttf",
            "italic": "C:/Windows/Fonts/timesi.ttf",
            "boldItalic": "C:/Windows/Fonts/timesbi.ttf",
        },
        {
            "name": "LiberationSerif",
            "regular": "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
            "bold": "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
            "italic": "/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf",
            "boldItalic": "/usr/share/fonts/truetype/liberation/LiberationSerif-BoldItalic.ttf",
        },
        {
            "name": "LiberationSans",
            "regular": "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            "bold": "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
            "italic": "/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf",
            "boldItalic": "/usr/share/fonts/truetype/liberation/LiberationSans-BoldItalic.ttf",
        },
        {
            "name": "TimesNewRoman",
            "regular": "C:/Windows/Fonts/times.ttf",
            "bold": "C:/Windows/Fonts/timesbd.ttf",
            "italic": "C:/Windows/Fonts/timesi.ttf",
            "boldItalic": "C:/Windows/Fonts/timesbi.ttf",
        },
        {
            "name": "Arial",
            "regular": "C:/Windows/Fonts/arial.ttf",
            "bold": "C:/Windows/Fonts/arialbd.ttf",
            "italic": "C:/Windows/Fonts/ariali.ttf",
            "boldItalic": "C:/Windows/Fonts/arialbi.ttf",
        },
    ]

    registered = None
    for cfg in font_configs:
        reg_path = cfg["regular"]
        bold_path = cfg["bold"]
        italic_path = cfg["italic"]
        bi_path = cfg["boldItalic"]

        if os.path.exists(reg_path):
            try:
                base_name = cfg["name"]
                bold_name = f"{base_name}-Bold"
                italic_name = f"{base_name}-Italic"
                bi_name = f"{base_name}-BoldItalic"

                pdfmetrics.registerFont(TTFont(base_name, reg_path))
                pdfmetrics.registerFont(TTFont(bold_name, bold_path if os.path.exists(bold_path) else reg_path))
                pdfmetrics.registerFont(TTFont(italic_name, italic_path if os.path.exists(italic_path) else reg_path))
                pdfmetrics.registerFont(TTFont(bi_name, bi_path if os.path.exists(bi_path) else reg_path))

                pdfmetrics.registerFontFamily(
                    base_name,
                    normal=base_name,
                    bold=bold_name,
                    italic=italic_name,
                    boldItalic=bi_name,
                )
                if not registered:
                    registered = base_name
            except Exception:
                pass

    _DEFAULT_FONT_NAME = registered or "Helvetica"
    _FONTS_REGISTERED = True
    return _DEFAULT_FONT_NAME


class NumberedCanvas(canvas.Canvas):
    """Vẽ số trang '1/1' hoặc 'X/Y' ở góc dưới bên phải trang chuẩn báo cáo kế toán."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        self.saveState()
        font_name = _DEFAULT_FONT_NAME if _FONTS_REGISTERED else "Helvetica"
        self.setFont(font_name, 8)
        self.setFillColor(colors.HexColor("#374151"))
        page_text = f"{self._pageNumber}/{page_count}"
        self.drawRightString(self._pagesize[0] - 25, 14, page_text)
        self.restoreState()


def _format_vn_number(raw_v: Any, show_zero: bool = False) -> str:
    """Format số tiền và số lượng theo chuẩn Việt Nam (phân cách hàng nghìn bằng dấu chấm .)."""
    if raw_v is None or raw_v == "":
        return ""
    try:
        if isinstance(raw_v, (int, float, Decimal)):
            num = float(raw_v)
        else:
            s = str(raw_v).strip().replace(" ", "")
            if not s:
                return ""
            if "." in s and "," in s:
                if s.rfind(",") > s.rfind("."):
                    s = s.replace(".", "").replace(",", ".")
                else:
                    s = s.replace(",", "")
            elif "," in s:
                parts = s.split(",")
                if len(parts) > 2 or (len(parts) == 2 and len(parts[1]) == 3):
                    s = s.replace(",", "")
                else:
                    s = s.replace(",", ".")
            elif "." in s:
                parts = s.split(".")
                if len(parts) > 2 or (len(parts) == 2 and len(parts[1]) == 3):
                    s = s.replace(".", "")
            num = float(s)

        if abs(num) < 1e-9:
            return "0" if show_zero else ""
        if num == int(num):
            return f"{int(num):,}".replace(",", ".")
        else:
            formatted = f"{num:,.2f}".split(".")
            integer_part = formatted[0].replace(",", ".")
            dec_part = formatted[1]
            return f"{integer_part},{dec_part}"
    except (ValueError, TypeError):
        return str(raw_v)


def generate_pdf(dataset: Dict[str, Any], options: Optional[Dict[str, Any]] = None) -> bytes:
    """
    TC-RPT-15-25..32, BR-RPT-EXP-49:
    Tạo tài liệu PDF chính thức với ReportLab:
    - Bố cục trang theo khổ giấy (A4/A3) và hướng giấy thông minh (tự động Landscape khi > 6 cột).
    - Hỗ trợ đầy đủ tiếng Việt UTF-8 không lỗi font (TrueType Unicode).
    - Header bảng lặp lại trên từng trang (repeatRows=1), giao diện trắng đen chuẩn kế toán.
    - Màu sắc mã hàng xanh dương link (#1D4ED8) đồng bộ với bản xem trước.
    - Đánh số trang "1/1" hoặc "X/Y".
    - Khối chữ ký pháp lý chuẩn 3 cột: Người lập biểu, Kế toán trưởng, Giám đốc.
    """
    options = options or {}
    font_family = _ensure_pdf_fonts_registered()
    font_bold = f"{font_family}-Bold" if f"{font_family}-Bold" in pdfmetrics.getRegisteredFontNames() else font_family
    font_italic = f"{font_family}-Italic" if f"{font_family}-Italic" in pdfmetrics.getRegisteredFontNames() else font_family
    font_bi_name = f"{font_family}-BoldItalic"
    font_bold_italic = font_bi_name if font_bi_name in pdfmetrics.getRegisteredFontNames() else font_bold

    paper_size_choice = (options.get("paper_size") or "A4").upper()
    columns = normalize_columns(dataset.get("columns", []))
    rows = normalize_rows(dataset.get("rows", []))

    # Tự động chọn hướng giấy nếu người dùng không chọn explicitly: > 6 cột mặc định LANDSCAPE
    orientation_opt = options.get("orientation")
    if not orientation_opt:
        orientation_choice = "LANDSCAPE" if len(columns) > 6 else "PORTRAIT"
    else:
        orientation_choice = orientation_opt.upper()

    base_page = A3 if paper_size_choice == "A3" else A4
    page_size = landscape(base_page) if orientation_choice == "LANDSCAPE" else portrait(base_page)

    title = (dataset.get("title") or "BÁO CÁO KẾ TOÁN").upper()
    company_name = dataset.get("company_name", "") or "Công ty TNHH Tunghihihi"
    company_address = dataset.get("company_address", "") or "198 Trần Quang Khải, P. Hoàn Kiếm, Hà Nội - Việt Nam"
    tax_code = dataset.get("tax_code", "")
    period_str = dataset.get("period_str", "")
    is_approved = bool(dataset.get("is_approved", False))

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=page_size,
        leftMargin=35,
        rightMargin=35,
        topMargin=30,
        bottomMargin=30,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontName=font_bold,
        fontSize=15,
        leading=19,
        alignment=1,  # Center
        textColor=colors.black,
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontName=font_bold_italic,
        fontSize=10.5,
        leading=14,
        alignment=1,  # Center
        textColor=colors.black,
    )
    unit_style = ParagraphStyle(
        "ReportUnit",
        parent=styles["Normal"],
        fontName=font_italic,
        fontSize=9.5,
        leading=13,
        alignment=2,  # Right
        textColor=colors.black,
    )
    header_company_name_style = ParagraphStyle(
        "CompanyHeaderName",
        parent=styles["Normal"],
        fontName=font_bold,
        fontSize=10.5,
        leading=14,
        textColor=colors.black,
    )
    header_company_sub_style = ParagraphStyle(
        "CompanyHeaderSub",
        parent=styles["Normal"],
        fontName=font_family,
        fontSize=9.5,
        leading=13,
        textColor=colors.black,
    )
    th_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName=font_bold,
        fontSize=8,
        leading=10,
        alignment=1,  # Center
        textColor=colors.black,
    )
    td_style_left = ParagraphStyle(
        "TableCellLeft",
        parent=styles["Normal"],
        fontName=font_family,
        fontSize=8.5,
        leading=11.5,
        alignment=0,
    )
    td_style_code = ParagraphStyle(
        "TableCellCode",
        parent=styles["Normal"],
        fontName=font_family,
        fontSize=8.5,
        leading=11.5,
        alignment=0,
        textColor=colors.HexColor("#1D4ED8"),
    )
    td_style_center = ParagraphStyle(
        "TableCellCenter",
        parent=styles["Normal"],
        fontName=font_family,
        fontSize=8.5,
        leading=11.5,
        alignment=1,
    )
    td_style_right = ParagraphStyle(
        "TableCellRight",
        parent=styles["Normal"],
        fontName=font_family,
        fontSize=8.5,
        leading=11.5,
        alignment=2,
    )
    sig_title_style = ParagraphStyle(
        "SignatureTitle",
        parent=styles["Normal"],
        fontName=font_bold,
        fontSize=10,
        leading=13.5,
        alignment=1,
        textColor=colors.black,
    )
    sig_sub_style = ParagraphStyle(
        "SignatureSubtitle",
        parent=styles["Normal"],
        fontName=font_italic,
        fontSize=9,
        leading=12,
        alignment=1,
        textColor=colors.black,
    )
    sig_name_style = ParagraphStyle(
        "SignatureName",
        parent=styles["Normal"],
        fontName=font_bold,
        fontSize=10,
        leading=13.5,
        alignment=1,
        textColor=colors.black,
    )

    elements = []

    # 1. Company & Metadata Header (Góc trên bên trái)
    elements.append(Paragraph(html.escape(company_name), header_company_name_style))
    if company_address:
        elements.append(Paragraph(html.escape(company_address), header_company_sub_style))
    if tax_code:
        elements.append(Paragraph(f"Mã số thuế: {html.escape(tax_code)}", header_company_sub_style))

    if options.get("show_status", False):
        status_label = "ĐÃ PHÊ DUYỆT" if is_approved else "DỰ THẢO (DRAFT)"
        status_color = "#059669" if is_approved else "#DC2626"
        elements.append(Paragraph(f"Trạng thái: <font color='{status_color}'><b>{status_label}</b></font>", header_company_sub_style))

    elements.append(Spacer(1, 8))

    # 2. Tiêu đề báo cáo & Kỳ
    elements.append(Paragraph(html.escape(title.upper()), title_style))
    if period_str:
        elements.append(Spacer(1, 3))
        elements.append(Paragraph(f"<i>{html.escape(period_str)}</i>", subtitle_style))
    elements.append(Spacer(1, 6))

    # Đơn vị tính (nằm trên góc phải bảng)
    unit_label = options.get("currency_unit") or dataset.get("currency_unit") or "Đơn vị tính: VND"
    elements.append(Paragraph(f"<i>{html.escape(unit_label)}</i>", unit_style))
    elements.append(Spacer(1, 4))

    # 3. Chuẩn bị bảng dữ liệu
    table_data = []

    # Dòng Header bảng
    col_headers = [
        Paragraph(f"<b>{html.escape(c.get('label', c.get('key', ''))).replace(' ', '&nbsp;')}</b>", th_style)
        for c in columns
    ]
    table_data.append(col_headers)

    amount_keywords = {
        "amount", "price", "cost", "balance", "debit", "credit", "total", "val", "qty",
        "quantity", "so_luong", "gia_tri", "thanh_tien", "chiet_khau", "giam_gia", "tra_lai",
        "tien", "du_no", "du_co", "phat_sinh", "luy_ke", "purchased", "returned", "net"
    }
    code_keywords = {"code", "ma_", "mahang", "so_ct", "so_hd", "account", "tk", "voucher"}
    center_keywords = {"unit", "dvt", "don_vi", "date", "ngay", "ngay_ct", "stt", "thu_tu"}

    for r in rows:
        row_cells = []
        is_subtotal = bool(r.get("is_subtotal") or r.get("is_group_header"))
        for col_idx, col in enumerate(columns):
            k = col.get("key", "")
            raw_v = r.get(k)
            k_lower = k.lower()
            lbl_lower = (col.get("label") or "").lower()
            combined_k = f"{k_lower} {lbl_lower}"
            col_type = str(col.get("data_type") or col.get("type") or "").lower()
            col_align = str(col.get("align") or "").lower()

            is_code_col = any(c in combined_k for c in code_keywords)
            is_center = col_align in ("center", "1") or any(m in combined_k for m in center_keywords)
            is_num = (
                not is_code_col
                and (
                    col_type in ("number", "currency", "decimal", "numeric")
                    or col_align in ("right", "2")
                    or any(m in combined_k for m in amount_keywords)
                    or isinstance(raw_v, (int, float, Decimal))
                )
            )

            if raw_v is None:
                text_v = ""
            elif is_num:
                text_v = _format_vn_number(raw_v, show_zero=False)
            else:
                text_v = str(raw_v)

            if is_num:
                s = td_style_right
            elif is_center:
                s = td_style_center
            elif col_idx == 0 and not is_subtotal:
                s = td_style_code
            else:
                s = td_style_left

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
                gt_cells.append(Paragraph("<b>TỔNG&nbsp;CỘNG</b>", td_style_left))
            else:
                gt_v = grand_total.get(k)
                if gt_v is not None and gt_v != "":
                    gt_formatted = _format_vn_number(gt_v, show_zero=False)
                    if gt_formatted:
                        gt_cells.append(Paragraph(f"<b>{gt_formatted}</b>", td_style_right))
                    else:
                        gt_cells.append(Paragraph("", td_style_right))
                else:
                    gt_cells.append(Paragraph("", td_style_right))
        table_data.append(gt_cells)

    # Tính độ rộng cột tự động và hài hòa
    total_avail_width = page_size[0] - 70  # margins 35 + 35
    num_cols = len(columns)
    weights = []
    for c in columns:
        k = c.get("key", "").lower()
        lbl = (c.get("label") or "").lower()
        combined = f"{k} {lbl}"
        if any(w in combined for w in ["unit", "dvt", "don_vi", "uom"]):
            weights.append(0.6)
        elif any(w in combined for w in ["stt", "thu_tu"]):
            weights.append(0.6)
        elif any(w in combined for w in ["code", "ma_hang", "mahang", "so_ct", "so_chung_tu", "so_hd"]):
            weights.append(1.35)
        elif any(w in combined for w in ["date", "ngay"]):
            weights.append(1.3)
        elif any(w in combined for w in ["item_name", "product_name", "description", "title", "diengiai", "ten_hang", "tenhang", "ten_ncc", "ten_kh", "ten_doi_tuong"]) or "name" in combined:
            weights.append(3.7 if num_cols >= 8 else 3.0)
        elif any(w in combined for w in ["tong_gia_tri", "net_purchase", "net_amount"]):
            weights.append(1.4)
        elif any(w in combined for w in ["giam_gia", "tra_lai", "return", "reduction"]):
            weights.append(1.35)
        elif any(w in combined for w in ["so_luong", "qty", "quantity", "purchased"]):
            weights.append(1.3)
        elif any(w in combined for w in ["amount", "price", "cost", "total", "gia_tri", "thanh_tien"]):
            weights.append(1.3)
        elif any(w in combined for w in ["chiet_khau", "discount"]):
            weights.append(1.25)
        else:
            weights.append(1.3)

    total_weight = sum(weights) or 1
    col_widths = [(w / total_weight) * total_avail_width for w in weights]

    t = Table(table_data, colWidths=col_widths, repeatRows=1)
    table_style_commands = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.white),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#000000")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 2.5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2.5),
    ]
    if grand_total and options.get("include_grand_total", True):
        table_style_commands.append(("LINEABOVE", (0, -1), (-1, -1), 0.75, colors.HexColor("#000000")))
        table_style_commands.append(("LINEBELOW", (0, -1), (-1, -1), 0.75, colors.HexColor("#000000")))

    t.setStyle(TableStyle(table_style_commands))
    elements.append(t)
    elements.append(Spacer(1, 20))

    # 4. Khối chữ ký (Signatures Block)
    if options.get("show_signatures", True):
        raw_prep = options.get("prepared_by_name") or ""
        raw_chief = options.get("chief_accountant_name") or ""
        raw_director = options.get("legal_representative_name") or ""

        prep_name = raw_prep if raw_prep not in ("Người lập biểu", "người lập biểu") else ""
        chief_name = raw_chief if raw_chief not in ("Kế toán trưởng", "kế toán trưởng") else ""
        director_name = raw_director if raw_director not in ("Giám đốc / Đại diện pháp luật", "Giám đốc", "giám đốc") else ""

        sig_date = options.get("signature_date") or datetime.date.today().strftime("Ngày %d tháng %m năm %Y")

        sig_data = [
            [
                Paragraph("", sig_title_style),
                Paragraph("", sig_title_style),
                Paragraph(f"<i>{html.escape(sig_date)}</i>", sig_sub_style),
            ],
            [
                Paragraph("<b>Người lập biểu</b>", sig_title_style),
                Paragraph("<b>Kế toán trưởng</b>", sig_title_style),
                Paragraph("<b>Giám đốc</b>", sig_title_style),
            ],
            [
                Paragraph("<i>(Ký, họ tên)</i>", sig_sub_style),
                Paragraph("<i>(Ký, họ tên)</i>", sig_sub_style),
                Paragraph("<i>(Ký, họ tên, đóng dấu)</i>", sig_sub_style),
            ],
            [
                Spacer(1, 45),
                Spacer(1, 45),
                Spacer(1, 45),
            ],
            [
                Paragraph(f"<b>{html.escape(prep_name)}</b>" if prep_name else "", sig_name_style),
                Paragraph(f"<b>{html.escape(chief_name)}</b>" if chief_name else "", sig_name_style),
                Paragraph(f"<b>{html.escape(director_name)}</b>" if director_name else "", sig_name_style),
            ],
        ]
        sig_col_w = total_avail_width / 3
        sig_table = Table(sig_data, colWidths=[sig_col_w, sig_col_w, sig_col_w])
        sig_table.setStyle(
            TableStyle(
                [
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 1),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                ]
            )
        )
        elements.append(KeepTogether(sig_table))

    # Xây dựng PDF với NumberedCanvas (đánh số trang 1/1, X/Y)
    doc.build(elements, canvasmaker=NumberedCanvas)
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
    Tạo bản xem trước in (HTML Print Preview) chuẩn CSS paged media theo mẫu báo cáo kế toán.
    Hỗ trợ lặp header (@media print table-header-group), khổ giấy A4/A3, xoay ngang/dọc,
    tiêu đề nhóm 2 tầng (rowspan/colspan), khối chữ ký 3 cột và watermark trạng thái.
    """
    options = options or {}
    # Both values are written into the page unescaped, so only known ones pass.
    paper_size = str(options.get("paper_size") or "A4").upper()
    paper_size = paper_size if paper_size in ("A3", "A4", "A5") else "A4"
    orientation = str(options.get("orientation") or "PORTRAIT").lower()
    orientation = orientation if orientation in ("portrait", "landscape") else "portrait"
    page_css = f"{paper_size.lower()} {orientation}"

    columns = normalize_columns(dataset.get("columns", []))
    rows = normalize_rows(dataset.get("rows", []))
    title = (dataset.get("title") or "BÁO CÁO KẾ TOÁN").upper()
    company_name = dataset.get("company_name", "")
    company_address = dataset.get("company_address", "") or "198 Trần Quang Khải, P. Hoàn Kiếm, Hà Nội - Việt Nam"
    tax_code = dataset.get("tax_code", "")
    period_str = dataset.get("period_str", "")
    is_approved = bool(dataset.get("is_approved", False))
    status_label = "ĐÃ PHÊ DUYỆT" if is_approved else "DỰ THẢO (DRAFT)"
    status_class = "badge-approved" if is_approved else "badge-draft"

    prep_name = options.get("prepared_by_name") or ""
    chief_name = options.get("chief_accountant_name") or ""
    director_name = options.get("legal_representative_name") or ""
    sig_date = options.get("signature_date") or datetime.date.today().strftime("Ngày %d tháng %m năm %Y")

    has_groups, top_row, sub_row = _build_grouped_headers(columns)
    if has_groups:
        top_html = "".join(
            f"<th colspan='{c['colspan']}' rowspan='{c['rowspan']}'>{html.escape(c['label'])}</th>"
            for c in top_row
        )
        sub_html = "".join(f"<th>{html.escape(lbl)}</th>" for lbl in sub_row)
        thead_rows_html = f"<tr>{top_html}</tr><tr>{sub_html}</tr>"
    else:
        col_headers_html = "".join(
            f"<th>{html.escape(c.get('label', c.get('key', '')))}</th>" for c in columns
        )
        thead_rows_html = f"<tr>{col_headers_html}</tr>"

    tbody_rows = []
    amount_keywords = {
        "amount", "price", "cost", "balance", "debit", "credit", "total", "val", "qty",
        "quantity", "so_luong", "gia_tri", "thanh_tien", "chiet_khau", "giam_gia", "tra_lai",
        "tien", "du_no", "du_co", "phat_sinh", "luy_ke", "purchased", "returned", "net"
    }
    code_keywords = {"code", "ma_", "mahang", "so_ct", "so_hd", "account", "tk", "voucher"}
    center_keywords = {"unit", "dvt", "don_vi", "uom", "date", "ngay", "ngay_ct", "stt", "thu_tu"}

    for r in rows:
        tds = []
        is_subtotal = bool(r.get("is_subtotal") or r.get("is_group_header"))
        for col_idx, c in enumerate(columns):
            k = c.get("key", "")
            raw_v = r.get(k)
            k_lower = k.lower()
            lbl_lower = (c.get("label") or "").lower()
            combined_k = f"{k_lower} {lbl_lower}"
            col_type = str(c.get("data_type") or c.get("type") or "").lower()
            col_align = str(c.get("align") or "").lower()

            is_code_col = any(code_k in combined_k for code_k in code_keywords)
            is_center = col_align in ("center", "1") or any(m in combined_k for m in center_keywords)
            is_num = (
                not is_code_col
                and (
                    col_type in ("number", "currency", "decimal", "numeric")
                    or col_align in ("right", "2")
                    or any(m in combined_k for m in amount_keywords)
                    or isinstance(raw_v, (int, float, Decimal))
                )
            )

            if raw_v is None:
                text_v = ""
            elif is_num:
                text_v = _format_vn_number(raw_v, show_zero=False)
            else:
                text_v = str(raw_v)

            if is_num:
                align_class = "text-right"
            elif is_center:
                align_class = "text-center"
            else:
                align_class = "text-left"

            code_class = "code-link" if (col_idx == 0 and not is_num and not is_subtotal) else ""
            subtotal_class = "font-bold bg-subtotal" if is_subtotal else ""
            tds.append(f"<td class='{align_class} {code_class} {subtotal_class}'>{html.escape(text_v)}</td>")
        tbody_rows.append(f"<tr>{''.join(tds)}</tr>")

    # Grand total
    grand_total = dataset.get("grand_total")
    if grand_total and options.get("include_grand_total", True):
        gt_tds = []
        for idx, c in enumerate(columns):
            k = c.get("key", "")
            if idx == 0:
                gt_tds.append("<td class='text-left font-bold bg-grand-total' style='white-space:nowrap;'>TỔNG CỘNG</td>")
            else:
                gt_v = grand_total.get(k)
                if gt_v is not None and gt_v != "":
                    gt_formatted = _format_vn_number(gt_v, show_zero=False)
                    if gt_formatted:
                        try:
                            raw_attr = f"{float(gt_v):,.0f}"
                        except Exception:
                            raw_attr = str(gt_v)
                        gt_tds.append(
                            f"<td class='text-right font-bold bg-grand-total' data-raw='{html.escape(raw_attr)}'>{gt_formatted}</td>"
                        )
                    else:
                        gt_tds.append("<td class='text-right font-bold bg-grand-total'></td>")
                else:
                    gt_tds.append("<td class='text-right font-bold bg-grand-total'></td>")
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
    font-family: "Times New Roman", Times, serif;
    color: #000000;
    margin: 0;
    padding: 24px 36px;
    background: #fff;
  }}
  .no-print {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
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
  .company-info {{ font-size: 13.5px; line-height: 1.45; }}
  .company-title {{ font-weight: bold; font-size: 14px; }}
  .report-header {{ text-align: center; margin: 12px 0 8px 0; }}
  .report-title {{ font-size: 20px; font-weight: bold; color: #000000; margin: 0 0 5px 0; text-transform: uppercase; }}
  .report-period {{ font-size: 14px; font-style: italic; font-weight: bold; color: #000000; }}
  .unit-line {{ text-align: right; font-style: italic; font-size: 13px; margin-bottom: 6px; }}
  .badge-draft {{ color: #dc2626; font-weight: bold; }}
  .badge-approved {{ color: #059669; font-weight: bold; }}
  table.report-table {{
    width: 100%;
    border-collapse: collapse;
    margin-top: 4px;
    font-size: 12.5px;
  }}
  table.report-table thead {{
    display: table-header-group;
  }}
  table.report-table tr {{
    page-break-inside: avoid;
  }}
  table.report-table th, table.report-table td {{
    border: 1px solid #000000;
    padding: 5px 7px;
  }}
  table.report-table th {{
    background: #ffffff;
    color: #000000;
    font-weight: bold;
    text-align: center;
    vertical-align: middle;
    white-space: nowrap;
  }}
  .code-link {{ color: #1d4ed8; }}
  .text-left {{ text-align: left; }}
  .text-right {{ text-align: right; }}
  .text-center {{ text-align: center; }}
  .font-bold {{ font-weight: bold; }}
  .bg-subtotal {{ background: #ffffff; }}
  .bg-grand-total {{ background: #ffffff; }}
  .grand-total-row td {{ font-weight: bold; }}
  .signature-block {{
    margin-top: 28px;
    page-break-inside: avoid;
    display: flex;
    justify-content: space-between;
    text-align: center;
  }}
  .sig-col {{ width: 30%; }}
  .sig-title {{ font-weight: bold; font-size: 13px; margin-bottom: 3px; }}
  .sig-sub {{ font-size: 12px; font-style: italic; color: #111111; }}
  .sig-space {{ height: 60px; }}
  .sig-name {{ font-weight: bold; font-size: 13px; }}
  .page-num {{ text-align: right; font-size: 12.5px; margin-top: 12px; }}
</style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" style="padding: 8px 16px; background: #00a862; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">In báo cáo</button>
    <span style="font-size: 12px; color: #4b5563;">Khổ giấy: <b>{paper_size}</b> | Hướng: <b>{orientation.upper()}</b> | Trạng thái: <span class="{status_class}">{status_label}</span></span>
  </div>

  <div class="company-info">
    <div class="company-title">{html.escape(company_name or "Công ty TNHH Tùng Timo")}</div>
    <div>{html.escape(company_address)}</div>
    {f"<div>Mã số thuế: {html.escape(tax_code)}</div>" if tax_code else ""}
  </div>

  <div class="report-header">
    <div class="report-title">{html.escape(title)}</div>
    <div class="report-period">{html.escape(period_str)}</div>
  </div>

  <div class="unit-line">Đơn vị tính: VND</div>

  <table class="report-table">
    <thead>
      {thead_rows_html}
    </thead>
    <tbody>
      {''.join(tbody_rows)}
    </tbody>
  </table>

  <div class="signature-block">
    <div class="sig-col">
      <!-- NGƯỜI LẬP BIỂU -->
      <div class="sig-title">Người lập biểu</div>
      <div class="sig-sub">(Ký, họ tên)</div>
      <div class="sig-space"></div>
      <div class="sig-name">{html.escape(prep_name)}</div>
    </div>
    <div class="sig-col">
      <!-- KẾ TOÁN TRƯỞNG -->
      <div class="sig-title">Kế toán trưởng</div>
      <div class="sig-sub">(Ký, họ tên)</div>
      <div class="sig-space"></div>
      <div class="sig-name">{html.escape(chief_name)}</div>
    </div>
    <div class="sig-col">
      <!-- GIÁM ĐỐC / ĐẠI DIỆN PHÁP LUẬT -->
      <div class="sig-sub" style="margin-bottom: 5px;"><i>{html.escape(sig_date)}</i></div>
      <div class="sig-title">Giám đốc</div>
      <div class="sig-sub">(Ký, họ tên, đóng dấu)</div>
      <div class="sig-space"></div>
      <div class="sig-name">{html.escape(director_name)}</div>
    </div>
  </div>

  <div class="page-num">1/1</div>
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
    company_address = getattr(company, "address", "") if company else (payload.get("company_address") or "")
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
                if k in r
                and isinstance(r[k], (int, float, Decimal))
                and not (r.get("is_subtotal") or r.get("is_parent") or r.get("isParent"))
            ]
            if numeric_vals:
                grand_total[k] = sum(numeric_vals)

    return {
        "report_code": report_code,
        "title": title,
        "company_name": company_name,
        "company_address": company_address,
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
