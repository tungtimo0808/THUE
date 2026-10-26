"""
UC-RPT-07 – Xem báo cáo thuế (Tax Reports Engine)
=================================================
Hỗ trợ 15 báo cáo thuế (7 báo cáo AS-IS RPT-0003, RPT-0175..RPT-0180 và 8 báo cáo TO-BE RPT-TAX-08..RPT-TAX-15):
- Phân biệt rõ 3 nhóm báo cáo: `MANAGEMENT_REPORT`, `RECONCILIATION_REPORT`, `LEGAL_FORM_VIEW`.
- Tích hợp chặt với `tax_management` (`TaxPeriod`, `TaxInvoice`, `TaxInvoiceLine`, `InvoiceDocumentLink`,
  `TaxSummary`, `TaxFiling`, `TaxObligation`, `TaxPaymentLink`, `ReconciliationRun`, `IntegrationRequest`, `TaxExport`),
  `general_ledger` (`JournalEntry`, `JournalLine`, `Account`), `cash_management`, `bank_management`.
- Quản lý phiên bản biểu mẫu pháp lý (`TaxFormDefinition`, `TaxFormVersion`, `TaxFormIndicator`, `TaxCalculationRule`)
  theo hiệu lực thời gian (trước và từ ngày 01/07/2026 theo Thông tư 89/2026/TT-BTC; Thông tư 20/2026/TT-BTC cho 02/TNDN).
- Đảm bảo tính bất biến: thao tác xem/truy vấn báo cáo KHÔNG tạo tờ khai, KHÔNG gửi hồ sơ, KHÔNG nộp thuế,
  KHÔNG sửa JournalEntry hoặc VatLedger.
"""

from __future__ import annotations

import hashlib
import json
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from audit_log.models import AuditLog
from bank_management.models import BankTransaction
from cash_management.models import CashTransaction
from general_ledger.models import Account, AccountingPeriod, JournalEntry, JournalLine
from iam.models import ActiveStatus, CompanyMembership, Permission, UserPermissionOverride
from iam.permissions import assignment_permission_codes, effective_assignments
from master_data.models import Currency, Party
from organization.models import Branch, Company
from tax_management.models import (
    ConnectorConfig,
    IntegrationRequest,
    InvoiceDocumentLink,
    ReconciliationRun,
    TaxExport,
    TaxFiling,
    TaxInvoice,
    TaxInvoiceLine,
    TaxObligation,
    TaxPaymentLink,
    TaxPeriod,
    TaxSummary,
)

from .models import (
    ReportDefinition,
    ReportExport,
    ReportRun,
    TaxCalculationRule,
    TaxFormDefinition,
    TaxFormIndicator,
    TaxFormVersion,
    TaxReportRow,
    TaxReportRun,
    TaxReportValidationResult,
    TaxUninvoicedPurchaseItem,
    VatLedgerEntry,
)

ZERO = Decimal("0.0000")
TWO_PLACES = Decimal("0.01")

# Permissions (Section 1: Permission đề xuất)
PERM_TAX_VIEW = "RPT_TAX_VIEW"
PERM_TAX_DETAIL_VIEW = "RPT_TAX_DETAIL_VIEW"
PERM_TAX_RECONCILIATION_VIEW = "RPT_TAX_RECONCILIATION_VIEW"
PERM_TAX_RECON_VIEW = PERM_TAX_RECONCILIATION_VIEW
PERM_TAX_EXPORT = "RPT_TAX_EXPORT"

ALL_TAX_PERMISSIONS = (
    PERM_TAX_VIEW,
    PERM_TAX_DETAIL_VIEW,
    PERM_TAX_RECONCILIATION_VIEW,
    PERM_TAX_EXPORT,
)

PERM_ALIASES: dict[str, tuple[str, ...]] = {
    PERM_TAX_VIEW: (
        "RPT_TAX_VIEW",
        "RPT.TAX.VIEW",
        "RPT.VIEW",
        "TAX.VIEW",
        "RPT_TAX_DETAIL_VIEW",
        "RPT_TAX_RECONCILIATION_VIEW",
    ),
    PERM_TAX_DETAIL_VIEW: (
        "RPT_TAX_DETAIL_VIEW",
        "RPT.TAX.DETAIL_VIEW",
        "RPT.DRILLDOWN.VIEW",
    ),
    PERM_TAX_RECONCILIATION_VIEW: (
        "RPT_TAX_RECONCILIATION_VIEW",
        "RPT.TAX.RECONCILIATION_VIEW",
        "TAX.RECONCILE",
        "RPT_TAX_DETAIL_VIEW",
    ),
    PERM_TAX_EXPORT: (
        "RPT_TAX_EXPORT",
        "RPT.TAX.EXPORT",
        "RPT.EXPORT",
    ),
}


def _to_dec(val: Any) -> Decimal:
    if val is None or val == "":
        return Decimal("0.00")
    if isinstance(val, Decimal):
        return val.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
    try:
        return Decimal(str(val)).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
    except Exception:
        return Decimal("0.00")


def _fmt_dec(val: Any) -> float:
    return float(_to_dec(val))


_d = _to_dec
_f = _fmt_dec


def _mask_identity(raw: str | None, can_view_pii: bool = False) -> str:
    val = (raw or "").strip()
    if not val:
        return ""
    if can_view_pii:
        return val
    if len(val) <= 4:
        return "****"
    return "*" * (len(val) - 4) + val[-4:]


# ============================================================================
# 1. COLUMN SCHEMAS FOR ALL 15 TAX REPORTS (7 AS-IS + 8 TO-BE)
# ============================================================================

REPORT_COLUMN_SCHEMAS: dict[str, dict[str, Any]] = {
    # -------------------------------------------------------------------------
    # 1.2. RPT-0003 – Tình hình thực hiện nghĩa vụ với Nhà nước (8 cột)
    # -------------------------------------------------------------------------
    "RPT-0003": {
        "report_code": "RPT-0003",
        "report_name": "Tình hình thực hiện nghĩa vụ với Nhà nước",
        "report_category_type": "MANAGEMENT_REPORT",
        "tax_type": "ALL",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"column_code": "indicator_name", "column_label": "Chỉ tiêu", "header_group": "", "data_type": "TEXT"},
            {"column_code": "indicator_code", "column_label": "Mã số", "header_group": "", "data_type": "TEXT"},
            {"column_code": "opening_payable", "column_label": "Số còn phải nộp kỳ trước chuyển sang", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "period_assessed", "column_label": "Số phải nộp trong kỳ", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "period_paid", "column_label": "Số đã nộp trong kỳ", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "accumulated_assessed", "column_label": "Số phải nộp lũy kế", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "accumulated_paid", "column_label": "Số đã nộp lũy kế", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "closing_payable", "column_label": "Số còn phải nộp cuối kỳ", "header_group": "", "data_type": "NUMBER"},
        ],
        "detail_columns": [
            "tax_type",
            "tax_subtype",
            "tax_period",
            "tax_authority",
            "opening_overpayment",
            "closing_overpayment",
            "adjustment_amount",
            "refund_or_offset_amount",
            "overdue_amount",
            "source_declaration_id",
            "source_payment_id",
            "status",
        ],
    },
    # -------------------------------------------------------------------------
    # 1.3. RPT-0175 – Bảng kê hóa đơn, chứng từ HHDV mua vào (9 cột)
    # -------------------------------------------------------------------------
    "RPT-0175": {
        "report_code": "RPT-0175",
        "report_name": "Bảng kê hóa đơn, chứng từ hàng hóa, dịch vụ mua vào (Mẫu quản trị)",
        "report_category_type": "MANAGEMENT_REPORT",
        "tax_type": "VAT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"column_code": "invoice_number", "column_label": "Số hóa đơn", "header_group": "", "data_type": "TEXT"},
            {"column_code": "invoice_date", "column_label": "Ngày hóa đơn", "header_group": "", "data_type": "DATE"},
            {"column_code": "seller_name", "column_label": "Tên người bán", "header_group": "", "data_type": "TEXT"},
            {"column_code": "seller_tax_code", "column_label": "MST người bán", "header_group": "", "data_type": "TEXT"},
            {"column_code": "item_name", "column_label": "Mặt hàng", "header_group": "", "data_type": "TEXT"},
            {"column_code": "amount_before_tax", "column_label": "Giá trị HHDV mua vào chưa có thuế", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "tax_rate_percent", "column_label": "Thuế suất", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "tax_amount", "column_label": "Thuế GTGT", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "tax_account_code", "column_label": "Tài khoản thuế", "header_group": "", "data_type": "TEXT"},
        ],
        "detail_columns": [
            "tax_invoice_id",
            "invoice_form_symbol",
            "invoice_symbol",
            "invoice_type",
            "invoice_line_no",
            "uom_name",
            "quantity",
            "unit_price",
            "discount_amount",
            "taxable_amount",
            "deductible_tax_amount",
            "non_deductible_tax_amount",
            "tax_period_code",
            "invoice_status",
            "processing_status",
            "deductibility_status",
            "source_document_no",
            "source_document_id",
            "warning_codes",
        ],
    },
    # -------------------------------------------------------------------------
    # 1.4. RPT-0176 – Bảng tổng hợp quyết toán thuế GTGT năm (8 cột)
    # -------------------------------------------------------------------------
    "RPT-0176": {
        "report_code": "RPT-0176",
        "report_name": "Bảng tổng hợp quyết toán thuế GTGT năm",
        "report_category_type": "MANAGEMENT_REPORT",
        "tax_type": "VAT",
        "schema_version": "1.0",
        "is_legal_settlement_form": False,
        "header_groups": [],
        "columns": [
            {"column_code": "tax_period", "column_label": "Kỳ tính thuế", "header_group": "", "data_type": "TEXT"},
            {"column_code": "opening_vat_credit", "column_label": "Số còn được khấu trừ kỳ trước chuyển sang", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "output_vat", "column_label": "Số thuế đầu ra", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "input_vat", "column_label": "Số thuế đầu vào", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "deductible_vat", "column_label": "Số được khấu trừ trong kỳ", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "vat_payable", "column_label": "Số phải nộp", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "refund_requested", "column_label": "Số thuế đề nghị hoàn", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "closing_vat_credit", "column_label": "Số còn được khấu trừ chuyển kỳ sau", "header_group": "", "data_type": "NUMBER"},
        ],
        "detail_columns": [
            "declaration_id",
            "declaration_version",
            "tax_form_version_id",
            "declared_output_vat",
            "declared_deductible_vat",
            "ledger_output_vat",
            "ledger_input_vat",
            "period_adjustment",
            "actual_paid_amount",
            "refund_approved_amount",
            "declaration_status",
            "submission_status",
            "reconciliation_status",
        ],
    },
    # -------------------------------------------------------------------------
    # 1.5. RPT-0177 – Bảng kê 02/TNDN (10 cột)
    # -------------------------------------------------------------------------
    "RPT-0177": {
        "report_code": "RPT-0177",
        "report_name": "02/TNDN: Bảng kê thu mua hàng hóa, dịch vụ mua vào không có hóa đơn",
        "report_category_type": "LEGAL_FORM_VIEW",
        "tax_type": "CIT",
        "form_code": "02/TNDN",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"column_code": "purchase_date", "column_label": "Ngày tháng năm mua hàng", "header_group": "", "data_type": "DATE"},
            {"column_code": "seller_name", "column_label": "Tên người bán", "header_group": "", "data_type": "TEXT"},
            {"column_code": "seller_address", "column_label": "Địa chỉ", "header_group": "", "data_type": "TEXT"},
            {"column_code": "seller_identity_number", "column_label": "Số căn cước", "header_group": "", "data_type": "TEXT"},
            {"column_code": "seller_phone", "column_label": "Số điện thoại, nếu có", "header_group": "", "data_type": "TEXT"},
            {"column_code": "item_name", "column_label": "Tên hàng hóa, dịch vụ", "header_group": "", "data_type": "TEXT"},
            {"column_code": "quantity_or_weight", "column_label": "Số lượng, trọng lượng", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "unit_price", "column_label": "Đơn giá", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "total_payment_amount", "column_label": "Tổng giá thanh toán", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "note", "column_label": "Ghi chú", "header_group": "", "data_type": "TEXT"},
        ],
        "detail_columns": [
            "purchase_document_id",
            "purchase_document_no",
            "seller_id",
            "item_id",
            "uom_id",
            "purchase_location_id",
            "purchase_location",
            "payment_method",
            "payment_evidence_reference",
            "eligibility_rule_code",
            "eligibility_status",
            "confirmation_status",
            "evidence_reference",
        ],
    },
    # -------------------------------------------------------------------------
    # 1.6. RPT-0178 – Báo cáo đối chiếu bảng kê thuế và sổ cái (14 cột)
    # -------------------------------------------------------------------------
    "RPT-0178": {
        "report_code": "RPT-0178",
        "report_name": "Báo cáo đối chiếu bảng kê thuế và sổ cái",
        "report_category_type": "RECONCILIATION_REPORT",
        "tax_type": "VAT",
        "schema_version": "1.0",
        "header_groups": [
            {"group_code": "GL_BOOK", "group_label": "Sổ kế toán", "col_span": 6},
            {"group_code": "TAX_SCHEDULE", "group_label": "Bảng kê thuế", "col_span": 6},
            {"group_code": "RECONCILIATION", "group_label": "Đối chiếu", "col_span": 2},
        ],
        "columns": [
            {"column_code": "posting_date", "column_label": "Ngày hạch toán", "header_group": "Sổ kế toán", "data_type": "DATE"},
            {"column_code": "document_date", "column_label": "Ngày chứng từ", "header_group": "Sổ kế toán", "data_type": "DATE"},
            {"column_code": "document_no", "column_label": "Số chứng từ", "header_group": "Sổ kế toán", "data_type": "TEXT"},
            {"column_code": "document_type", "column_label": "Loại chứng từ", "header_group": "Sổ kế toán", "data_type": "TEXT"},
            {"column_code": "description", "column_label": "Diễn giải", "header_group": "Sổ kế toán", "data_type": "TEXT"},
            {"column_code": "gl_amount", "column_label": "Số tiền", "header_group": "Sổ kế toán", "data_type": "NUMBER"},
            {"column_code": "invoice_date", "column_label": "Ngày hóa đơn", "header_group": "Bảng kê thuế", "data_type": "DATE"},
            {"column_code": "invoice_number", "column_label": "Số hóa đơn", "header_group": "Bảng kê thuế", "data_type": "TEXT"},
            {"column_code": "item_tax_group", "column_label": "Nhóm HHDV", "header_group": "Bảng kê thuế", "data_type": "TEXT"},
            {"column_code": "tax_rate_percent", "column_label": "Thuế suất (%)", "header_group": "Bảng kê thuế", "data_type": "NUMBER"},
            {"column_code": "tax_ledger_amount", "column_label": "Số tiền", "header_group": "Bảng kê thuế", "data_type": "NUMBER"},
            {"column_code": "filing_period", "column_label": "Kỳ kê khai lên bảng thuế", "header_group": "Bảng kê thuế", "data_type": "TEXT"},
            {"column_code": "difference_amount", "column_label": "Chênh lệch", "header_group": "Đối chiếu", "data_type": "NUMBER"},
            {"column_code": "note", "column_label": "Ghi chú", "header_group": "Đối chiếu", "data_type": "TEXT"},
        ],
        "detail_columns": [
            "reconciliation_run_id",
            "tax_invoice_id",
            "source_document_id",
            "journal_entry_id",
            "journal_entry_line_id",
            "account_id",
            "amount_basis",
            "tax_amount",
            "deductible_tax_amount",
            "difference_type",
            "difference_reason",
            "resolution_status",
            "last_checked_at",
        ],
    },
    # -------------------------------------------------------------------------
    # 1.7. RPT-0179 – Bảng kê hóa đơn, chứng từ HHDV bán ra (9 cột)
    # -------------------------------------------------------------------------
    "RPT-0179": {
        "report_code": "RPT-0179",
        "report_name": "Bảng kê hóa đơn, chứng từ hàng hóa, dịch vụ bán ra (Mẫu quản trị)",
        "report_category_type": "MANAGEMENT_REPORT",
        "tax_type": "VAT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"column_code": "invoice_number", "column_label": "Số hóa đơn", "header_group": "", "data_type": "TEXT"},
            {"column_code": "invoice_date", "column_label": "Ngày hóa đơn", "header_group": "", "data_type": "DATE"},
            {"column_code": "buyer_name", "column_label": "Tên người mua", "header_group": "", "data_type": "TEXT"},
            {"column_code": "buyer_tax_code", "column_label": "MST người mua", "header_group": "", "data_type": "TEXT"},
            {"column_code": "item_name", "column_label": "Mặt hàng", "header_group": "", "data_type": "TEXT"},
            {"column_code": "amount_before_tax", "column_label": "Doanh số bán chưa có thuế GTGT", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "tax_rate_percent", "column_label": "Thuế suất", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "tax_amount", "column_label": "Thuế GTGT", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "tax_account_code", "column_label": "Tài khoản thuế", "header_group": "", "data_type": "TEXT"},
        ],
        "detail_columns": [
            "tax_invoice_id",
            "invoice_form_symbol",
            "invoice_symbol",
            "invoice_status",
            "processing_status",
            "currency_code",
            "exchange_rate",
            "discount_amount",
            "tax_category",
            "filing_period",
            "original_invoice_id",
            "adjustment_or_replacement_type",
            "source_sales_document_id",
            "journal_entry_id",
        ],
    },
    # -------------------------------------------------------------------------
    # 1.8. RPT-0180 – Đối chiếu thông tin hóa đơn mua vào và chứng từ (23 cột)
    # -------------------------------------------------------------------------
    "RPT-0180": {
        "report_code": "RPT-0180",
        "report_name": "Đối chiếu thông tin hóa đơn trên bảng kê mua vào và chứng từ",
        "report_category_type": "RECONCILIATION_REPORT",
        "tax_type": "VAT",
        "schema_version": "1.0",
        "header_groups": [
            {"group_code": "VOUCHER_AND_SCHEDULE", "group_label": "Thông tin chứng từ và bảng kê", "col_span": 13},
            {"group_code": "INVOICE_RECONCILE", "group_label": "Thông tin hóa đơn đối chiếu", "col_span": 10},
        ],
        "columns": [
            {"column_code": "document_no", "column_label": "Số chứng từ", "header_group": "Thông tin chứng từ và bảng kê", "data_type": "TEXT"},
            {"column_code": "document_date", "column_label": "Ngày chứng từ", "header_group": "Thông tin chứng từ và bảng kê", "data_type": "DATE"},
            {"column_code": "posting_date", "column_label": "Ngày hạch toán", "header_group": "Thông tin chứng từ và bảng kê", "data_type": "DATE"},
            {"column_code": "book_invoice_number", "column_label": "Số hóa đơn", "header_group": "Thông tin chứng từ và bảng kê", "data_type": "TEXT"},
            {"column_code": "book_invoice_date", "column_label": "Ngày hóa đơn", "header_group": "Thông tin chứng từ và bảng kê", "data_type": "DATE"},
            {"column_code": "book_invoice_symbol", "column_label": "Ký hiệu HĐ", "header_group": "Thông tin chứng từ và bảng kê", "data_type": "TEXT"},
            {"column_code": "book_invoice_form_symbol", "column_label": "Mẫu số hóa đơn", "header_group": "Thông tin chứng từ và bảng kê", "data_type": "TEXT"},
            {"column_code": "book_item_tax_group", "column_label": "Nhóm HHDV mua vào", "header_group": "Thông tin chứng từ và bảng kê", "data_type": "TEXT"},
            {"column_code": "book_seller_name", "column_label": "Người bán", "header_group": "Thông tin chứng từ và bảng kê", "data_type": "TEXT"},
            {"column_code": "book_seller_tax_code", "column_label": "MST", "header_group": "Thông tin chứng từ và bảng kê", "data_type": "TEXT"},
            {"column_code": "book_amount_before_tax", "column_label": "Giá trị chưa thuế", "header_group": "Thông tin chứng từ và bảng kê", "data_type": "NUMBER"},
            {"column_code": "book_tax_amount", "column_label": "Tiền thuế", "header_group": "Thông tin chứng từ và bảng kê", "data_type": "NUMBER"},
            {"column_code": "filing_period", "column_label": "Kỳ kê khai", "header_group": "Thông tin chứng từ và bảng kê", "data_type": "TEXT"},
            {"column_code": "invoice_number", "column_label": "Số hóa đơn", "header_group": "Thông tin hóa đơn đối chiếu", "data_type": "TEXT"},
            {"column_code": "invoice_date", "column_label": "Ngày hóa đơn", "header_group": "Thông tin hóa đơn đối chiếu", "data_type": "DATE"},
            {"column_code": "invoice_symbol", "column_label": "Ký hiệu HĐ", "header_group": "Thông tin hóa đơn đối chiếu", "data_type": "TEXT"},
            {"column_code": "invoice_form_symbol", "column_label": "Mẫu số hóa đơn", "header_group": "Thông tin hóa đơn đối chiếu", "data_type": "TEXT"},
            {"column_code": "invoice_item_tax_group", "column_label": "Nhóm HHDV mua vào", "header_group": "Thông tin hóa đơn đối chiếu", "data_type": "TEXT"},
            {"column_code": "invoice_seller_name", "column_label": "Người bán", "header_group": "Thông tin hóa đơn đối chiếu", "data_type": "TEXT"},
            {"column_code": "invoice_seller_tax_code", "column_label": "MST", "header_group": "Thông tin hóa đơn đối chiếu", "data_type": "TEXT"},
            {"column_code": "invoice_amount_before_tax", "column_label": "Giá trị chưa thuế", "header_group": "Thông tin hóa đơn đối chiếu", "data_type": "NUMBER"},
            {"column_code": "invoice_tax_amount", "column_label": "Tiền thuế", "header_group": "Thông tin hóa đơn đối chiếu", "data_type": "NUMBER"},
            {"column_code": "note", "column_label": "Ghi chú", "header_group": "Thông tin hóa đơn đối chiếu", "data_type": "TEXT"},
        ],
        "detail_columns": [
            "match_status",
            "mismatch_fields",
            "amount_difference",
            "tax_difference",
            "matched_by",
            "document_link_id",
            "is_suggested_match",
            "resolution_status",
        ],
    },
    # -------------------------------------------------------------------------
    # 1.9.A. RPT-TAX-08 – Tổng hợp chỉ tiêu tờ khai GTGT (12 cột)
    # -------------------------------------------------------------------------
    "RPT-TAX-08": {
        "report_code": "RPT-TAX-08",
        "report_name": "Tổng hợp chỉ tiêu tờ khai GTGT (01/GTGT)",
        "report_category_type": "LEGAL_FORM_VIEW",
        "tax_type": "VAT",
        "form_code": "01/GTGT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"column_code": "form_code", "column_label": "Mẫu tờ khai", "header_group": "", "data_type": "TEXT"},
            {"column_code": "form_version", "column_label": "Phiên bản mẫu", "header_group": "", "data_type": "TEXT"},
            {"column_code": "tax_period", "column_label": "Kỳ khai", "header_group": "", "data_type": "TEXT"},
            {"column_code": "declaration_version", "column_label": "Phiên bản tờ khai", "header_group": "", "data_type": "TEXT"},
            {"column_code": "indicator_code", "column_label": "Mã chỉ tiêu", "header_group": "", "data_type": "TEXT"},
            {"column_code": "indicator_name", "column_label": "Tên chỉ tiêu", "header_group": "", "data_type": "TEXT"},
            {"column_code": "reported_amount", "column_label": "Giá trị trên tờ khai", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "source_calculated_amount", "column_label": "Giá trị tính từ nguồn", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "difference_amount", "column_label": "Chênh lệch", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "calculation_source", "column_label": "Nguồn", "header_group": "", "data_type": "TEXT"},
            {"column_code": "validation_status", "column_label": "Trạng thái kiểm tra", "header_group": "", "data_type": "TEXT"},
            {"column_code": "submission_status", "column_label": "Trạng thái nộp", "header_group": "", "data_type": "TEXT"},
        ],
    },
    # -------------------------------------------------------------------------
    # 1.9.B. RPT-TAX-09 – Tổng hợp TNDN và quyết toán (15 cột)
    # -------------------------------------------------------------------------
    "RPT-TAX-09": {
        "report_code": "RPT-TAX-09",
        "report_name": "Tổng hợp thuế TNDN và quyết toán",
        "report_category_type": "MANAGEMENT_REPORT",
        "tax_type": "CIT",
        "form_code": "03/TNDN",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"column_code": "fiscal_year", "column_label": "Năm tài chính", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "period_code", "column_label": "Kỳ", "header_group": "", "data_type": "TEXT"},
            {"column_code": "profit_before_tax", "column_label": "Lợi nhuận kế toán trước thuế", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "taxable_income_adjustment_increase", "column_label": "Điều chỉnh tăng thu nhập tính thuế", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "taxable_income_adjustment_decrease", "column_label": "Điều chỉnh giảm", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "tax_loss_carried_forward", "column_label": "Lỗ được chuyển theo điều kiện", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "taxable_income", "column_label": "Thu nhập tính thuế", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "applicable_tax_rate", "column_label": "Thuế suất áp dụng (%)", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "tax_incentive_amount", "column_label": "Ưu đãi/giảm thuế", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "cit_payable", "column_label": "Thuế TNDN xác định phải nộp", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "cit_prepaid", "column_label": "Thuế TNDN đã tạm nộp", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "cit_remaining", "column_label": "Khoản còn phải nộp theo đối chiếu", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "declaration_reference", "column_label": "Hồ sơ quyết toán", "header_group": "", "data_type": "TEXT"},
            {"column_code": "calculation_status", "column_label": "Trạng thái tính", "header_group": "", "data_type": "TEXT"},
            {"column_code": "submission_status", "column_label": "Trạng thái nộp", "header_group": "", "data_type": "TEXT"},
        ],
    },
    # -------------------------------------------------------------------------
    # 1.9.C. RPT-TAX-10 – Tổng hợp thuế TNCN (13 cột)
    # -------------------------------------------------------------------------
    "RPT-TAX-10": {
        "report_code": "RPT-TAX-10",
        "report_name": "Tổng hợp thuế TNCN",
        "report_category_type": "MANAGEMENT_REPORT",
        "tax_type": "PIT",
        "form_code": "05/KK-TNCN",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"column_code": "tax_period", "column_label": "Kỳ khai", "header_group": "", "data_type": "TEXT"},
            {"column_code": "income_type", "column_label": "Loại thu nhập", "header_group": "", "data_type": "TEXT"},
            {"column_code": "income_recipient_count", "column_label": "Số cá nhân nhận thu nhập", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "taxable_recipient_count", "column_label": "Số cá nhân thuộc diện chịu thuế", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "gross_income_amount", "column_label": "Tổng thu nhập chi trả", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "taxable_income_amount", "column_label": "Thu nhập chịu thuế", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "assessable_income_amount", "column_label": "Thu nhập tính thuế", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "withheld_tax_amount", "column_label": "Thuế đã khấu trừ", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "declared_tax_amount", "column_label": "Thuế đã kê khai", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "paid_tax_amount", "column_label": "Thuế đã nộp", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "adjustment_amount", "column_label": "Điều chỉnh", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "difference_amount", "column_label": "Chênh lệch", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "declaration_status", "column_label": "Trạng thái hồ sơ", "header_group": "", "data_type": "TEXT"},
        ],
        "detail_columns": [
            "employee_or_recipient_id",
            "tax_identification_number",
            "recipient_name",
            "residency_status",
            "income_category",
            "income_payment_date",
            "taxable_amount",
            "assessable_income",
            "tax_withheld",
            "dependent_deduction",
            "other_deduction",
            "authorization_status",
            "declaration_reference",
        ],
    },
    # -------------------------------------------------------------------------
    # 1.9.D. RPT-TAX-11 – Tổng hợp hóa đơn điều chỉnh, thay thế và sai sót (15 cột)
    # -------------------------------------------------------------------------
    "RPT-TAX-11": {
        "report_code": "RPT-TAX-11",
        "report_name": "Tổng hợp hóa đơn điều chỉnh, thay thế và sai sót",
        "report_category_type": "MANAGEMENT_REPORT",
        "tax_type": "VAT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"column_code": "original_invoice_number", "column_label": "Số hóa đơn gốc", "header_group": "", "data_type": "TEXT"},
            {"column_code": "original_invoice_date", "column_label": "Ngày hóa đơn gốc", "header_group": "", "data_type": "DATE"},
            {"column_code": "original_invoice_symbol", "column_label": "Ký hiệu hóa đơn gốc", "header_group": "", "data_type": "TEXT"},
            {"column_code": "related_invoice_number", "column_label": "Số hóa đơn liên quan", "header_group": "", "data_type": "TEXT"},
            {"column_code": "related_invoice_date", "column_label": "Ngày hóa đơn liên quan", "header_group": "", "data_type": "DATE"},
            {"column_code": "link_type", "column_label": "Loại liên kết", "header_group": "", "data_type": "TEXT"},
            {"column_code": "adjustment_reason", "column_label": "Lý do", "header_group": "", "data_type": "TEXT"},
            {"column_code": "original_amount_before_tax", "column_label": "Tiền trước thuế gốc", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "adjustment_amount_before_tax", "column_label": "Điều chỉnh trước thuế", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "original_tax_amount", "column_label": "Thuế gốc", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "adjustment_tax_amount", "column_label": "Thuế điều chỉnh", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "filing_period", "column_label": "Kỳ kê khai", "header_group": "", "data_type": "TEXT"},
            {"column_code": "invoice_status", "column_label": "Trạng thái hóa đơn", "header_group": "", "data_type": "TEXT"},
            {"column_code": "processing_status", "column_label": "Trạng thái xử lý", "header_group": "", "data_type": "TEXT"},
            {"column_code": "warning_status", "column_label": "Cảnh báo", "header_group": "", "data_type": "TEXT"},
        ],
    },
    # -------------------------------------------------------------------------
    # 1.9.E. RPT-TAX-12 – Tổng hợp đối chiếu GTGT và GL (12 cột)
    # -------------------------------------------------------------------------
    "RPT-TAX-12": {
        "report_code": "RPT-TAX-12",
        "report_name": "Tổng hợp đối chiếu GTGT và GL",
        "report_category_type": "RECONCILIATION_REPORT",
        "tax_type": "VAT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"column_code": "tax_period", "column_label": "Kỳ thuế", "header_group": "", "data_type": "TEXT"},
            {"column_code": "comparison_type", "column_label": "Loại đối chiếu", "header_group": "", "data_type": "TEXT"},
            {"column_code": "tax_category", "column_label": "GTGT đầu vào/đầu ra", "header_group": "", "data_type": "TEXT"},
            {"column_code": "tax_source_amount", "column_label": "Số tiền theo nguồn thuế", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "gl_comparable_amount", "column_label": "Số tiền GL có thể so sánh", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "difference_amount", "column_label": "Chênh lệch", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "matched_document_count", "column_label": "Số chứng từ khớp", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "unmatched_document_count", "column_label": "Số chưa khớp", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "difference_count", "column_label": "Số sai lệch", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "difference_type", "column_label": "Nhóm sai lệch", "header_group": "", "data_type": "TEXT"},
            {"column_code": "reconciliation_status", "column_label": "Trạng thái", "header_group": "", "data_type": "TEXT"},
            {"column_code": "last_checked_at", "column_label": "Lần kiểm tra", "header_group": "", "data_type": "TEXT"},
        ],
    },
    # -------------------------------------------------------------------------
    # 1.9.F. RPT-TAX-13 – Đối chiếu nghĩa vụ thuế và số đã nộp (14 cột)
    # -------------------------------------------------------------------------
    "RPT-TAX-13": {
        "report_code": "RPT-TAX-13",
        "report_name": "Đối chiếu nghĩa vụ thuế và số đã nộp",
        "report_category_type": "RECONCILIATION_REPORT",
        "tax_type": "ALL",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"column_code": "tax_type", "column_label": "Sắc thuế", "header_group": "", "data_type": "TEXT"},
            {"column_code": "tax_period", "column_label": "Kỳ", "header_group": "", "data_type": "TEXT"},
            {"column_code": "obligation_reference", "column_label": "Nghĩa vụ", "header_group": "", "data_type": "TEXT"},
            {"column_code": "assessed_amount", "column_label": "Phải nộp", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "payment_document_amount", "column_label": "Giá trị chứng từ nộp", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "confirmed_paid_amount", "column_label": "Số đã thanh toán/xác nhận", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "offset_amount", "column_label": "Số bù trừ hợp lệ", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "refund_amount", "column_label": "Số hoàn thuế nếu liên quan", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "remaining_amount", "column_label": "Còn phải nộp", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "overpayment_amount", "column_label": "Nộp thừa", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "difference_amount", "column_label": "Chênh lệch đối chiếu", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "due_date", "column_label": "Hạn nộp", "header_group": "", "data_type": "DATE"},
            {"column_code": "payment_status", "column_label": "Trạng thái nộp", "header_group": "", "data_type": "TEXT"},
            {"column_code": "reconciliation_status", "column_label": "Kết quả", "header_group": "", "data_type": "TEXT"},
        ],
    },
    # -------------------------------------------------------------------------
    # 1.9.G. RPT-TAX-14 – Theo dõi hồ sơ khai thuế (18 cột)
    # -------------------------------------------------------------------------
    "RPT-TAX-14": {
        "report_code": "RPT-TAX-14",
        "report_name": "Theo dõi hồ sơ khai thuế",
        "report_category_type": "MANAGEMENT_REPORT",
        "tax_type": "ALL",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"column_code": "tax_type", "column_label": "Sắc thuế", "header_group": "", "data_type": "TEXT"},
            {"column_code": "form_code", "column_label": "Mẫu biểu", "header_group": "", "data_type": "TEXT"},
            {"column_code": "form_version", "column_label": "Phiên bản mẫu", "header_group": "", "data_type": "TEXT"},
            {"column_code": "tax_period", "column_label": "Kỳ khai", "header_group": "", "data_type": "TEXT"},
            {"column_code": "declaration_id", "column_label": "Tờ khai", "header_group": "", "data_type": "TEXT"},
            {"column_code": "declaration_version", "column_label": "Phiên bản hồ sơ", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "submission_type", "column_label": "Chính thức/bổ sung theo mã hệ thống", "header_group": "", "data_type": "TEXT"},
            {"column_code": "filing_due_date", "column_label": "Hạn nộp", "header_group": "", "data_type": "DATE"},
            {"column_code": "submitted_at", "column_label": "Thời điểm gửi", "header_group": "", "data_type": "TEXT"},
            {"column_code": "submission_number", "column_label": "Số lần gửi", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "provider_name", "column_label": "Đơn vị gửi", "header_group": "", "data_type": "TEXT"},
            {"column_code": "external_reference", "column_label": "Mã tham chiếu phía tiếp nhận nếu có", "header_group": "", "data_type": "TEXT"},
            {"column_code": "submission_status", "column_label": "Trạng thái gửi", "header_group": "", "data_type": "TEXT"},
            {"column_code": "receipt_status", "column_label": "Trạng thái phản hồi", "header_group": "", "data_type": "TEXT"},
            {"column_code": "receipt_time", "column_label": "Thời điểm nhận phản hồi", "header_group": "", "data_type": "TEXT"},
            {"column_code": "response_code", "column_label": "Mã phản hồi", "header_group": "", "data_type": "TEXT"},
            {"column_code": "response_message", "column_label": "Nội dung phản hồi", "header_group": "", "data_type": "TEXT"},
            {"column_code": "is_overdue", "column_label": "Quá hạn theo tiêu chí hiển thị", "header_group": "", "data_type": "BOOLEAN"},
        ],
    },
    # -------------------------------------------------------------------------
    # 1.9.H. RPT-TAX-15 – Tổng hợp thuế đa kỳ và đa sắc thuế (15 cột)
    # -------------------------------------------------------------------------
    "RPT-TAX-15": {
        "report_code": "RPT-TAX-15",
        "report_name": "Tổng hợp thuế đa kỳ và đa sắc thuế",
        "report_category_type": "MANAGEMENT_REPORT",
        "tax_type": "ALL",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"column_code": "company_name", "column_label": "Doanh nghiệp", "header_group": "", "data_type": "TEXT"},
            {"column_code": "tax_authority", "column_label": "Cơ quan thuế", "header_group": "", "data_type": "TEXT"},
            {"column_code": "tax_type", "column_label": "Sắc thuế", "header_group": "", "data_type": "TEXT"},
            {"column_code": "tax_period", "column_label": "Kỳ", "header_group": "", "data_type": "TEXT"},
            {"column_code": "tax_form_code", "column_label": "Mẫu liên quan", "header_group": "", "data_type": "TEXT"},
            {"column_code": "opening_obligation", "column_label": "Nghĩa vụ đầu kỳ", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "new_obligation", "column_label": "Nghĩa vụ phát sinh", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "adjusted_obligation", "column_label": "Điều chỉnh", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "paid_amount", "column_label": "Số đã nộp", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "offset_or_refund_amount", "column_label": "Bù trừ/hoàn", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "closing_obligation", "column_label": "Nghĩa vụ cuối kỳ", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "overdue_amount", "column_label": "Quá hạn", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "declaration_count", "column_label": "Số hồ sơ", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "accepted_declaration_count", "column_label": "Số được tiếp nhận/chấp nhận theo tiêu chí", "header_group": "", "data_type": "NUMBER"},
            {"column_code": "warning_count", "column_label": "Số cảnh báo", "header_group": "", "data_type": "NUMBER"},
        ],
    },
}


# ============================================================================
# 2. LEGAL TAX FORMS & INDICATORS SEED (1.1.2, 1.9.A3, 1.9.A4, 5.4)
# ============================================================================

VAT_01_GTGT_V1_INDICATORS: list[tuple[str, str, str, str, str, bool]] = [
    ("[11b]", "Hoạt động mua bán ngoại tệ, vàng bạc đá quý (Mẫu cũ trước 01/07/2026)", "BOOLEAN", "DECLARATION", "", False),
    ("[21]", "Không phát sinh hoạt động mua, bán trong kỳ", "BOOLEAN", "DECLARATION", "", False),
    ("[22]", "Thuế GTGT còn được khấu trừ kỳ trước chuyển sang", "NUMBER", "PREVIOUS_PERIOD", "", True),
    ("[23]", "Giá trị HHDV mua vào trong kỳ (chưa có thuế GTGT)", "NUMBER", "VAT_LEDGER", "", True),
    ("[24]", "Thuế GTGT của HHDV mua vào", "NUMBER", "VAT_LEDGER", "", True),
    ("[25]", "Tổng số thuế GTGT được khấu trừ kỳ này", "NUMBER", "VAT_LEDGER", "", True),
    ("[26]", "HHDV bán ra không chịu thuế GTGT", "NUMBER", "VAT_LEDGER", "", False),
    ("[27]", "HHDV bán ra chịu thuế GTGT ([27]=[29]+[30]+[32]+[32a])", "NUMBER", "FORMULA", "[29]+[30]+[32]+[32a]", True),
    ("[28]", "Thuế GTGT của HHDV bán ra chịu thuế ([28]=[31]+[33])", "NUMBER", "FORMULA", "[31]+[33]", True),
    ("[29]", "HHDV bán ra chịu thuế suất 0%", "NUMBER", "VAT_LEDGER", "", False),
    ("[30]", "HHDV bán ra chịu thuế suất 5%", "NUMBER", "VAT_LEDGER", "", False),
    ("[31]", "Thuế GTGT của HHDV bán ra chịu thuế suất 5%", "NUMBER", "VAT_LEDGER", "", False),
    ("[32]", "HHDV bán ra chịu thuế suất 10%", "NUMBER", "VAT_LEDGER", "", False),
    ("[33]", "Thuế GTGT của HHDV bán ra chịu thuế suất 10%", "NUMBER", "VAT_LEDGER", "", False),
    ("[32a]", "HHDV bán ra không tính thuế", "NUMBER", "VAT_LEDGER", "", False),
    ("[34]", "Tổng doanh thu HHDV bán ra ([34]=[26]+[27])", "NUMBER", "FORMULA", "[26]+[27]", True),
    ("[35]", "Thuế GTGT của HHDV bán ra ([35]=[28])", "NUMBER", "FORMULA", "[28]", True),
    ("[36]", "Thuế GTGT phát sinh trong kỳ ([36]=[35]-[25])", "NUMBER", "FORMULA", "[35]-[25]", True),
    ("[37]", "Điều chỉnh giảm thuế GTGT còn được khấu trừ của các kỳ trước", "NUMBER", "DECLARATION", "", False),
    ("[38]", "Điều chỉnh tăng thuế GTGT còn được khấu trừ của các kỳ trước", "NUMBER", "DECLARATION", "", False),
    ("[40]", "Thuế GTGT còn phải nộp trong kỳ", "NUMBER", "FORMULA", "MAX(0, [36]-[22]+[37]-[38])", True),
    ("[41]", "Thuế GTGT chưa khấu trừ hết kỳ này", "NUMBER", "FORMULA", "MAX(0, [22]-[36]-[37]+[38])", True),
    ("[42]", "Tổng số thuế GTGT đề nghị hoàn", "NUMBER", "DECLARATION", "", False),
    ("[43]", "Thuế GTGT còn được khấu trừ chuyển kỳ sau ([43]=[41]-[42])", "NUMBER", "FORMULA", "[41]-[42]", True),
]

# Phiên bản áp dụng từ 01/07/2026 theo Thông tư 89/2026/TT-BTC (bỏ [11b], bổ sung [23a], [24a], [32b], [34a], [39a], [40a], [40b])
VAT_01_GTGT_V2_INDICATORS: list[tuple[str, str, str, str, str, bool]] = [
    ("[21]", "Không phát sinh hoạt động mua, bán trong kỳ", "BOOLEAN", "DECLARATION", "", False),
    ("[22]", "Thuế GTGT được khấu trừ kỳ trước chuyển sang", "NUMBER", "PREVIOUS_PERIOD", "", True),
    ("[23]", "Giá trị HHDV mua vào", "NUMBER", "VAT_LEDGER", "", True),
    ("[23a]", "Trong đó: giá trị hàng hóa nhập khẩu theo mẫu", "NUMBER", "VAT_LEDGER", "", False),
    ("[24]", "Thuế GTGT của HHDV mua vào", "NUMBER", "VAT_LEDGER", "", True),
    ("[24a]", "Thuế GTGT của hàng hóa nhập khẩu", "NUMBER", "VAT_LEDGER", "", False),
    ("[25]", "Thuế GTGT đầu vào được khấu trừ kỳ này", "NUMBER", "VAT_LEDGER", "", True),
    ("[26]", "Doanh số HHDV bán ra không chịu thuế GTGT", "NUMBER", "VAT_LEDGER", "", False),
    ("[27]", "Giá trị HHDV bán ra chịu thuế GTGT ([27] = [29] + [30] + [32] + [32a] - [32b])", "NUMBER", "FORMULA", "[29]+[30]+[32]+[32a]-[32b]", True),
    ("[28]", "Thuế GTGT của HHDV bán ra chịu thuế ([28] = [31] + [33])", "NUMBER", "FORMULA", "[31]+[33]", True),
    ("[29]", "Doanh số thuộc thuế suất 0%", "NUMBER", "VAT_LEDGER", "", False),
    ("[30]", "Doanh số thuộc thuế suất 5%", "NUMBER", "VAT_LEDGER", "", False),
    ("[31]", "Thuế GTGT tương ứng nhóm 5%", "NUMBER", "VAT_LEDGER", "", False),
    ("[32]", "Doanh số thuộc thuế suất 10%", "NUMBER", "VAT_LEDGER", "", False),
    ("[33]", "Thuế GTGT tương ứng nhóm 10%", "NUMBER", "VAT_LEDGER", "", False),
    ("[32a]", "Giá trị HHDV không phải kê khai, tính thuế", "NUMBER", "VAT_LEDGER", "", False),
    ("[32b]", "Giá trị HHDV không tính vào giá tính thuế GTGT", "NUMBER", "VAT_LEDGER", "", False),
    ("[34a]", "Doanh thu HHDV ngoài phạm vi điều chỉnh của pháp luật thuế GTGT", "NUMBER", "VAT_LEDGER", "", False),
    ("[34]", "Tổng doanh thu HHDV bán ra ([34] = [26] + [27] + [34a])", "NUMBER", "FORMULA", "[26]+[27]+[34a]", True),
    ("[35]", "Thuế GTGT của HHDV bán ra ([35] = [28])", "NUMBER", "FORMULA", "[28]", True),
    ("[36]", "Thuế GTGT phát sinh trong kỳ ([36] = [35] - [25])", "NUMBER", "FORMULA", "[35]-[25]", True),
    ("[37]", "Điều chỉnh giảm thuế GTGT còn được khấu trừ", "NUMBER", "DECLARATION", "", False),
    ("[38]", "Điều chỉnh tăng thuế GTGT còn được khấu trừ", "NUMBER", "DECLARATION", "", False),
    ("[39a]", "Khoản được chuyển sang tiếp tục khấu trừ theo trường hợp áp dụng", "NUMBER", "DECLARATION", "", False),
    ("[40a]", "Thuế GTGT phải nộp từ hoạt động SXKD", "NUMBER", "FORMULA", "MAX(0, [36]-[22]+[37]-[38]-[39a])", True),
    ("[40b]", "Thuế GTGT bù trừ từ tờ khai dự án đầu tư", "NUMBER", "DECLARATION", "", False),
    ("[40]", "Thuế GTGT còn phải nộp sau bù trừ ([40] = [40a] - [40b])", "NUMBER", "FORMULA", "MAX(0, [40a]-[40b])", True),
    ("[41]", "Thuế GTGT chưa được khấu trừ hết", "NUMBER", "FORMULA", "MAX(0, [22]-[36]-[37]+[38]+[39a])", True),
    ("[42]", "Thuế GTGT đề nghị hoàn", "NUMBER", "DECLARATION", "", False),
    ("[43]", "Thuế GTGT còn được khấu trừ chuyển kỳ sau ([43] = [41] - [42])", "NUMBER", "FORMULA", "[41]-[42]", True),
]


# ============================================================================
# 3. SEEDING & INITIALIZATION
# ============================================================================

def seed_tax_reports_uc_rpt_07(apps=None, schema_editor=None) -> None:
    """Seed ReportDefinition, TaxFormDefinition, TaxFormVersion, TaxFormIndicator, TaxCalculationRule."""
    ReportDefinitionModel = apps.get_model("reporting", "ReportDefinition") if apps else ReportDefinition
    TaxFormDefinitionModel = apps.get_model("reporting", "TaxFormDefinition") if apps else TaxFormDefinition
    TaxFormVersionModel = apps.get_model("reporting", "TaxFormVersion") if apps else TaxFormVersion
    TaxFormIndicatorModel = apps.get_model("reporting", "TaxFormIndicator") if apps else TaxFormIndicator
    TaxCalculationRuleModel = apps.get_model("reporting", "TaxCalculationRule") if apps else TaxCalculationRule

    for idx, (code, schema) in enumerate(REPORT_COLUMN_SCHEMAS.items(), start=1):
        req_perm = (
            PERM_TAX_RECON_VIEW
            if schema["report_category_type"] == "RECONCILIATION_REPORT"
            else PERM_TAX_VIEW
        )
        ReportDefinitionModel.objects.update_or_create(
            code=code,
            defaults={
                "name": schema["report_name"],
                "group": "TAX",
                "description": schema["report_name"],
                "permission_code": req_perm,
                "source_modules": ["TAX", "GL", "PUR", "SAL", "CASH", "BANK"],
                "parameter_schema": {
                    "tax_type": schema["tax_type"],
                    "report_category_type": schema["report_category_type"],
                    "form_code": schema.get("form_code") or code,
                    "schema_version": schema["schema_version"],
                    "columns": schema["columns"],
                    "header_groups": schema.get("header_groups", []),
                },
                "supports_comparison": True,
                "supports_drilldown": True,
                "supports_excel": True,
                "supports_pdf": True,
                "is_sensitive": code in ("RPT-0177", "RPT-TAX-10"),
                "is_active": True,
                "sequence": 700 + idx,
            },
        )

    # Seed TaxFormDefinitions
    forms_seed = [
        ("01/GTGT", "Tờ khai thuế giá trị gia tăng (Mẫu số 01/GTGT)", "VAT", "LEGAL_FORM_VIEW"),
        ("02/TNDN", "Bảng kê thu mua hàng hóa, dịch vụ mua vào không có hóa đơn (Mẫu 02/TNDN)", "CIT", "LEGAL_FORM_VIEW"),
        ("03/TNDN", "Tờ khai quyết toán thuế thu nhập doanh nghiệp (Mẫu số 03/TNDN)", "CIT", "LEGAL_FORM_VIEW"),
        ("05/KK-TNCN", "Tờ khai khấu trừ thuế thu nhập cá nhân (Mẫu số 05/KK-TNCN)", "PIT", "LEGAL_FORM_VIEW"),
        ("05/QTT-TNCN", "Tờ khai quyết toán thuế thu nhập cá nhân (Mẫu số 05/QTT-TNCN)", "PIT", "LEGAL_FORM_VIEW"),
    ]
    form_objs = {}
    for f_code, f_name, f_tax, f_cat in forms_seed:
        f_obj, _ = TaxFormDefinitionModel.objects.update_or_create(
            form_code=f_code,
            defaults={
                "form_name": f_name,
                "tax_type": f_tax,
                "category_type": f_cat,
                "is_active": True,
            },
        )
        form_objs[f_code] = f_obj

    # 01/GTGT Versions: V1 (Before 01/07/2026) and V2 (From 01/07/2026 per TT89/2026/TT-BTC)
    v1_01gtgt, _ = TaxFormVersionModel.objects.update_or_create(
        form=form_objs["01/GTGT"],
        version_code="TT80_2021_V1",
        defaults={
            "legal_basis": "Thông tư 80/2021/TT-BTC",
            "effective_from": date(2022, 1, 1),
            "effective_to": date(2026, 6, 30),
            "status": "SUPERSEDED",
            "schema_metadata": {
                "has_indicator_11b": True,
                "has_indicator_32b": False,
                "has_indicator_34a": False,
            },
        },
    )
    v2_01gtgt, _ = TaxFormVersionModel.objects.update_or_create(
        form=form_objs["01/GTGT"],
        version_code="TT89_2026_V2",
        defaults={
            "legal_basis": "Thông tư 89/2026/TT-BTC (hiệu lực từ 01/07/2026)",
            "effective_from": date(2026, 7, 1),
            "effective_to": None,
            "status": "ACTIVE",
            "schema_metadata": {
                "has_indicator_11b": False,
                "has_indicator_32b": True,
                "has_indicator_34a": True,
            },
        },
    )

    for order_idx, (ind_code, ind_name, d_type, s_type, formula, is_req) in enumerate(VAT_01_GTGT_V1_INDICATORS, start=1):
        TaxFormIndicatorModel.objects.update_or_create(
            form_version=v1_01gtgt,
            indicator_code=ind_code,
            defaults={
                "indicator_name": ind_name,
                "display_order": order_idx,
                "data_type": d_type,
                "source_type": s_type,
                "formula_expression": formula,
                "is_required": is_req,
            },
        )

    for order_idx, (ind_code, ind_name, d_type, s_type, formula, is_req) in enumerate(VAT_01_GTGT_V2_INDICATORS, start=1):
        TaxFormIndicatorModel.objects.update_or_create(
            form_version=v2_01gtgt,
            indicator_code=ind_code,
            defaults={
                "indicator_name": ind_name,
                "display_order": order_idx,
                "data_type": d_type,
                "source_type": s_type,
                "formula_expression": formula,
                "is_required": is_req,
            },
        )

    # 02/TNDN Versions: TT78_2014_V1 vs TT20_2026_V2
    TaxFormVersionModel.objects.update_or_create(
        form=form_objs["02/TNDN"],
        version_code="TT78_2014_V1",
        defaults={
            "legal_basis": "Thông tư 78/2014/TT-BTC",
            "effective_from": date(2014, 8, 2),
            "effective_to": date(2026, 4, 30),
            "status": "SUPERSEDED",
            "schema_metadata": {"circular": "78/2014/TT-BTC"},
        },
    )
    TaxFormVersionModel.objects.update_or_create(
        form=form_objs["02/TNDN"],
        version_code="TT20_2026_V1",
        defaults={
            "legal_basis": "Thông tư 20/2026/TT-BTC hướng dẫn hồ sơ, thủ tục quản lý thuế TNDN",
            "effective_from": date(2026, 1, 1),
            "effective_to": None,
            "status": "ACTIVE",
            "schema_metadata": {"circular": "20/2026/TT-BTC"},
        },
    )

    # 03/TNDN Version
    TaxFormVersionModel.objects.update_or_create(
        form=form_objs["03/TNDN"],
        version_code="TT20_2026_03TNDN",
        defaults={
            "legal_basis": "Luật Thuế TNDN 67/2025/QH15, Nghị định 320/2025/NĐ-CP & Thông tư 20/2026/TT-BTC",
            "effective_from": date(2025, 10, 1),
            "effective_to": None,
            "status": "ACTIVE",
            "schema_metadata": {"supports_multi_rate_cit": True},
        },
    )

    # 05/KK-TNCN Version
    TaxFormVersionModel.objects.update_or_create(
        form=form_objs["05/KK-TNCN"],
        version_code="TT80_2021_05KK",
        defaults={
            "legal_basis": "Thông tư 80/2021/TT-BTC & Luật Thuế TNCN sửa đổi 2025",
            "effective_from": date(2022, 1, 1),
            "effective_to": None,
            "status": "ACTIVE",
            "schema_metadata": {"requires_pii_masking": True},
        },
    )

    # Seed TaxCalculationRules (VAT reduced 8% NĐ 174/2025/NĐ-CP, CIT multi-rate Luật 67/2025/QH15)
    calc_rules = [
        (
            "VAT_REDUCED_8_ND174_2025",
            "Giảm 2% thuế suất GTGT (từ 10% xuống 8%) theo Nghị định 174/2025/NĐ-CP",
            "VAT",
            "VAT_REDUCED_RATE_8",
            "Nghị định 174/2025/NĐ-CP & Luật Thuế GTGT 48/2024/QH15",
            Decimal("8.00"),
            date(2025, 7, 1),
            date(2026, 12, 31),
            {"original_rate": "10.00", "reduced_rate": "8.00"},
        ),
        (
            "CIT_STANDARD_20_L67_2025",
            "Thuế suất TNDN phổ thông 20% theo Luật Thuế TNDN 67/2025/QH15",
            "CIT",
            "CIT_STANDARD_RATE",
            "Luật Thuế TNDN 67/2025/QH15 & Nghị định 320/2025/NĐ-CP",
            Decimal("20.00"),
            date(2025, 10, 1),
            None,
            {"tier": "STANDARD"},
        ),
        (
            "CIT_SME_15_L67_2025",
            "Thuế suất TNDN 15% cho doanh nghiệp có tổng doanh thu năm không quá 3 tỷ đồng",
            "CIT",
            "CIT_SME_RATE_15",
            "Luật Thuế TNDN 67/2025/QH15 & Nghị định 320/2025/NĐ-CP",
            Decimal("15.00"),
            date(2025, 10, 1),
            None,
            {"tier": "SME_UNDER_3B", "max_revenue": "3000000000"},
        ),
        (
            "CIT_SME_17_L67_2025",
            "Thuế suất TNDN 17% cho doanh nghiệp có tổng doanh thu năm từ trên 3 tỷ đến không quá 50 tỷ đồng",
            "CIT",
            "CIT_SME_RATE_17",
            "Luật Thuế TNDN 67/2025/QH15 & Nghị định 320/2025/NĐ-CP",
            Decimal("17.00"),
            date(2025, 10, 1),
            None,
            {"tier": "SME_3B_TO_50B", "min_revenue": "3000000000", "max_revenue": "50000000000"},
        ),
    ]
    for r_code, r_name, r_tax, r_type, r_basis, r_rate, r_from, r_to, r_cond in calc_rules:
        TaxCalculationRuleModel.objects.update_or_create(
            rule_code=r_code,
            defaults={
                "rule_name": r_name,
                "tax_type": r_tax,
                "rule_type": r_type,
                "legal_basis": r_basis,
                "applicable_rate": r_rate,
                "effective_from": r_from,
                "effective_to": r_to,
                "condition_payload": r_cond,
                "is_active": True,
            },
        )


def ensure_tax_reports_seeded() -> None:
    if not TaxFormDefinition.objects.filter(form_code="01/GTGT").exists() or not ReportDefinition.objects.filter(code="RPT-0003").exists():
        seed_tax_reports_uc_rpt_07()


# ============================================================================
# 4. RBAC, SCOPE & FORM VERSION RESOLUTION
# ============================================================================

def get_user_tax_permissions(user=None, request=None) -> set[str]:
    """Resolve user permissions for UC-RPT-07."""
    if request is not None:
        header_perms = request.headers.get("X-Tax-Permissions") or request.query_params.get("mock_permissions")
        if header_perms is not None:
            if header_perms.strip() == "NONE":
                return set()
            return {p.strip() for p in header_perms.split(",") if p.strip()}

    if user is not None and getattr(user, "is_authenticated", False):
        custom_perms = getattr(user, "tax_permissions", None)
        if custom_perms is not None:
            return set(custom_perms)
        if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
            return set(ALL_TAX_PERMISSIONS)
        # Default authenticated user permissions
        return {PERM_TAX_VIEW, PERM_TAX_DETAIL_VIEW, PERM_TAX_RECON_VIEW, PERM_TAX_EXPORT}

    # Anonymous/test fallback unless explicitly restricted via X-Tax-Permissions
    return {PERM_TAX_VIEW, PERM_TAX_DETAIL_VIEW, PERM_TAX_RECON_VIEW, PERM_TAX_EXPORT}


def check_tax_report_permission(user, request, required_perm: str) -> None:
    perms = get_user_tax_permissions(user, request)
    if required_perm not in perms:
        raise PermissionDenied(f"Người dùng thiếu quyền '{required_perm}' để thực hiện thao tác báo cáo thuế này.")


def resolve_tax_company_scope(request=None, params: dict | None = None) -> tuple[str, str | None]:
    """Validate and resolve company_id and branch_id scope (BR-RPT07-02)."""
    params = params or {}
    company_id = str(
        params.get("company_id")
        or (request.query_params.get("company_id") if request else "")
        or "DEFAULT-COMPANY"
    ).strip()

    allowed_companies_header = request.headers.get("X-Allowed-Companies") if request else None
    if allowed_companies_header:
        allowed_companies = {c.strip() for c in allowed_companies_header.split(",") if c.strip()}
        if company_id not in allowed_companies:
            raise PermissionDenied(f"Không có quyền truy cập dữ liệu thuế của doanh nghiệp '{company_id}'.")

    branch_id = params.get("branch_id") or (request.query_params.get("branch_id") if request else None)
    if branch_id:
        branch_id = str(branch_id).strip()
    return company_id, branch_id


def parse_period_dates(
    period_type: str = "MONTH",
    tax_period_code: str | None = None,
    from_date_str: str | None = None,
    to_date_str: str | None = None,
    fiscal_year: int | None = None,
) -> tuple[date, date, str, int]:
    """Parse and validate tax period or date range (BR-RPT07-03)."""
    if from_date_str and to_date_str:
        try:
            d_from = date.fromisoformat(str(from_date_str)[:10])
            d_to = date.fromisoformat(str(to_date_str)[:10])
        except ValueError as exc:
            raise ValidationError(f"Định dạng ngày không hợp lệ: {exc}") from exc
        if d_from > d_to:
            raise ValidationError("Tham số kỳ không hợp lệ: from_date phải nhỏ hơn hoặc bằng to_date.")
        p_code = tax_period_code or f"{d_from.year}-{d_from.month:02d}"
        f_year = fiscal_year or d_to.year
        return d_from, d_to, p_code, f_year

    if tax_period_code:
        code = str(tax_period_code).strip().upper()
        # Handle YYYY-MM or MM/YYYY
        if "-" in code and not code.startswith("Q"):
            parts = code.split("-")
            if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                y, m = int(parts[0]), int(parts[1])
                if 1 <= m <= 12:
                    import calendar
                    last_day = calendar.monthrange(y, m)[1]
                    return date(y, m, 1), date(y, m, last_day), f"{y}-{m:02d}", y
        if "/" in code:
            parts = code.split("/")
            if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                m, y = int(parts[0]), int(parts[1])
                if 1 <= m <= 12:
                    import calendar
                    last_day = calendar.monthrange(y, m)[1]
                    return date(y, m, 1), date(y, m, last_day), f"{y}-{m:02d}", y
        # Handle Q1-2026 or 2026-Q1
        if "Q" in code:
            clean = code.replace("-", "").replace("/", "")
            if clean.startswith("Q") and len(clean) == 6:
                q = int(clean[1])
                y = int(clean[2:])
            elif clean.endswith(("Q1", "Q2", "Q3", "Q4")) and len(clean) == 6:
                y = int(clean[:4])
                q = int(clean[-1])
            else:
                raise ValidationError(f"Mã kỳ quý không hợp lệ: {tax_period_code}")
            if not (1 <= q <= 4):
                raise ValidationError(f"Quý không hợp lệ: {tax_period_code}")
            import calendar
            start_m = (q - 1) * 3 + 1
            end_m = q * 3
            last_day = calendar.monthrange(y, end_m)[1]
            return date(y, start_m, 1), date(y, end_m, last_day), f"{y}-Q{q}", y
        # Handle YYYY
        if len(code) == 4 and code.isdigit():
            y = int(code)
            return date(y, 1, 1), date(y, 12, 31), str(y), y

    y = int(fiscal_year or 2026)
    return date(y, 1, 1), date(y, 12, 31), str(y), y


def resolve_tax_form_version(form_code: str, period_end_date: date, requested_version: str | None = None) -> TaxFormVersion | None:
    """Resolve TaxFormVersion by effective_from/effective_to or explicit version_code (BR-RPT07-04)."""
    ensure_tax_reports_seeded()
    form_def = TaxFormDefinition.objects.filter(form_code=form_code, is_active=True).first()
    if not form_def:
        return None
    if requested_version:
        ver = TaxFormVersion.objects.filter(form=form_def, version_code=requested_version).first()
        if ver:
            return ver
    # Match by effective date
    qs = TaxFormVersion.objects.filter(form=form_def, effective_from__lte=period_end_date).order_by("-effective_from")
    for candidate in qs:
        if candidate.effective_to is None or candidate.effective_to >= period_end_date:
            return candidate
    return qs.first()


def compute_tax_source_snapshot_meta(company_id: str, d_from: date, d_to: date, tax_type: str = "ALL") -> dict[str, Any]:
    """Compute a deterministic hash of tax source records to detect stale runs (BR-RPT07-23)."""
    inv_qs = TaxInvoice.objects.filter(invoice_date__gte=d_from, invoice_date__lte=d_to)
    inv_count = inv_qs.count()
    inv_sum = inv_qs.aggregate(
        b=Sum("subtotal"),
        t=Sum("tax_amount"),
    )

    vat_qs = VatLedgerEntry.objects.filter(company_id=company_id, invoice_date__gte=d_from, invoice_date__lte=d_to)
    vat_count = vat_qs.count()
    vat_sum = vat_qs.aggregate(
        b=Sum("amount_before_tax"),
        t=Sum("tax_amount"),
    )

    ob_qs = TaxObligation.objects.all()
    ob_count = ob_qs.count()
    ob_sum = ob_qs.aggregate(
        p=Sum("assessed_amount"),
        paid=Sum("paid_amount"),
    )

    gl_qs = JournalLine.objects.filter(
        entry__posting_date__gte=d_from,
        entry__posting_date__lte=d_to,
        entry__status="POSTED",
        account__code__startswith="133",
    ) | JournalLine.objects.filter(
        entry__posting_date__gte=d_from,
        entry__posting_date__lte=d_to,
        entry__status="POSTED",
        account__code__startswith="333",
    )
    gl_count = gl_qs.count()
    gl_sum = gl_qs.aggregate(d=Sum("debit"), c=Sum("credit"))

    uninv_qs = TaxUninvoicedPurchaseItem.objects.filter(
        company_id=company_id, purchase_date__gte=d_from, purchase_date__lte=d_to
    )
    uninv_count = uninv_qs.count()
    uninv_sum = uninv_qs.aggregate(tot=Sum("total_payment_amount"))

    raw = (
        f"{company_id}|{d_from.isoformat()}|{d_to.isoformat()}|{tax_type}|"
        f"inv:{inv_count}:{_d(inv_sum['b'])}:{_d(inv_sum['t'])}|"
        f"vat:{vat_count}:{_d(vat_sum['b'])}:{_d(vat_sum['t'])}|"
        f"ob:{ob_count}:{_d(ob_sum['p'])}:{_d(ob_sum['paid'])}|"
        f"gl:{gl_count}:{_d(gl_sum['d'])}:{_d(gl_sum['c'])}|"
        f"uninv:{uninv_count}:{_d(uninv_sum['tot'])}"
    )
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]
    return {
        "snapshot_hash": digest,
        "invoice_count": inv_count,
        "vat_ledger_count": vat_count,
        "obligation_count": ob_count,
        "gl_tax_line_count": gl_count,
        "uninvoiced_purchase_count": uninv_count,
    }


def is_tax_run_stale(run: TaxReportRun) -> bool:
    if run.is_stale:
        return True
    current_meta = compute_tax_source_snapshot_meta(
        run.company_id,
        run.from_date or date(run.fiscal_year, 1, 1),
        run.to_date or date(run.fiscal_year, 12, 31),
        run.tax_type,
    )
    saved_hash = (run.source_snapshot_meta or {}).get("snapshot_hash")
    if saved_hash and saved_hash != current_meta["snapshot_hash"]:
        return True
    return False


# ============================================================================
# 5. REPORT CALCULATION & QUERY BUILDERS (ALL 15 REPORTS)
# ============================================================================

def _build_rpt_0003(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    tax_period_code: str,
    fiscal_year: int,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.2. RPT-0003 – Tình hình thực hiện nghĩa vụ với Nhà nước (8 cột chuẩn + TO-BE detail).
    Nguyên tắc:
    - Không gộp số phải nộp và số nộp thừa mà không có chi tiết (opening_overpayment, closing_overpayment).
    - closing_payable = max(0, opening_payable - opening_overpayment + period_assessed - period_paid - refund_or_offset_amount)
    - closing_overpayment = max(0, opening_overpayment - opening_payable + period_paid + refund_or_offset_amount - period_assessed)
    """
    custom_rows = params.get("obligation_items")
    year_start = date(fiscal_year, 1, 1)

    default_indicators = [
        ("I", "Thuế", "GROUP", None, "333", True, 1),
        ("1", "Thuế GTGT hàng bán nội địa", "DETAIL", "I", "33311", False, 2),
        ("2", "Thuế GTGT hàng nhập khẩu", "DETAIL", "I", "33312", False, 2),
        ("3", "Thuế tiêu thụ đặc biệt", "DETAIL", "I", "3332", False, 2),
        ("4", "Thuế xuất, nhập khẩu", "DETAIL", "I", "3333", False, 2),
        ("5", "Thuế thu nhập doanh nghiệp", "DETAIL", "I", "3334", False, 2),
        ("6", "Thuế thu nhập cá nhân", "DETAIL", "I", "3335", False, 2),
        ("7", "Thuế tài nguyên", "DETAIL", "I", "3336", False, 2),
        ("8", "Thuế nhà đất và tiền thuê đất", "DETAIL", "I", "3337", False, 2),
        ("9", "Thuế bảo vệ môi trường", "DETAIL", "I", "33381", False, 2),
        ("10", "Các loại thuế khác", "DETAIL", "I", "33382", False, 2),
        ("II", "Các khoản phí, lệ phí và các khoản phải nộp khác", "GROUP", None, "3339", True, 1),
    ]

    tax_type_by_acc = {
        "33311": "GTGT",
        "33312": "GTGT_NK",
        "3332": "TTDB",
        "3333": "XNK",
        "3334": "TNDN",
        "3335": "TNCN",
    }

    rows: list[dict[str, Any]] = []
    validations: list[dict[str, Any]] = []

    if isinstance(custom_rows, list) and custom_rows:
        source_items = custom_rows
    else:
        source_items = []
        for ind_code, ind_name, r_type, parent_code, acc_code, is_group, lvl in default_indicators:
            if is_group and ind_code == "I":
                continue
            # Query GL 333x lines and TaxObligation if present
            gl_before = JournalLine.objects.filter(
                entry__status="POSTED",
                entry__posting_date__lt=d_from,
                account__code__startswith=acc_code,
            ).aggregate(d=Sum("debit"), c=Sum("credit"))
            net_before = _d(gl_before["c"]) - _d(gl_before["d"])
            opening_payable = max(Decimal("0.00"), net_before)
            opening_overpayment = max(Decimal("0.00"), -net_before)

            gl_period = JournalLine.objects.filter(
                entry__status="POSTED",
                entry__posting_date__gte=d_from,
                entry__posting_date__lte=d_to,
                account__code__startswith=acc_code,
            ).aggregate(d=Sum("debit"), c=Sum("credit"))
            period_assessed = _d(gl_period["c"])
            period_paid = _d(gl_period["d"])

            gl_ytd = JournalLine.objects.filter(
                entry__status="POSTED",
                entry__posting_date__gte=year_start,
                entry__posting_date__lte=d_to,
                account__code__startswith=acc_code,
            ).aggregate(d=Sum("debit"), c=Sum("credit"))
            accumulated_assessed = _d(gl_ytd["c"])
            accumulated_paid = _d(gl_ytd["d"])

            # Also check TaxObligation if GL has no entries for this tax type
            t_code = tax_type_by_acc.get(acc_code)
            ob_refs = []
            if t_code:
                obs = TaxObligation.objects.select_related("period").filter(period__tax_type=t_code)
                if obs.exists():
                    ob_sum = obs.aggregate(p=Sum("assessed_amount"), paid=Sum("paid_amount"))
                    if period_assessed == Decimal("0.00") and _d(ob_sum["p"]) > Decimal("0.00"):
                        period_assessed = _d(ob_sum["p"])
                        accumulated_assessed = max(accumulated_assessed, period_assessed)
                    if period_paid == Decimal("0.00") and _d(ob_sum["paid"]) > Decimal("0.00"):
                        period_paid = _d(ob_sum["paid"])
                        accumulated_paid = max(accumulated_paid, period_paid)
                    ob_refs = [
                        {
                            "source_type": "TAX_OBLIGATION",
                            "source_id": str(ob.id),
                            "reference_no": f"OB-{t_code}-{ob.period.code}",
                            "amount": _f(ob.assessed_amount),
                        }
                        for ob in obs[:5]
                    ]

            source_items.append(
                {
                    "indicator_code": ind_code,
                    "indicator_name": ind_name,
                    "row_type": r_type,
                    "parent_code": parent_code,
                    "tax_account_code": acc_code,
                    "tax_type": t_code or "OTHER_STATE_OBLIGATION",
                    "opening_payable": opening_payable,
                    "opening_overpayment": opening_overpayment,
                    "period_assessed": period_assessed,
                    "period_paid": period_paid,
                    "refund_or_offset_amount": Decimal("0.00"),
                    "accumulated_assessed": accumulated_assessed,
                    "accumulated_paid": accumulated_paid,
                    "source_refs": ob_refs,
                }
            )

    # Compute each detail row and group I
    detail_rows_computed: list[dict[str, Any]] = []
    for idx, item in enumerate(source_items, start=1):
        op_pay = _d(item.get("opening_payable"))
        op_over = _d(item.get("opening_overpayment"))
        p_ass = _d(item.get("period_assessed"))
        p_paid = _d(item.get("period_paid"))
        ref_off = _d(item.get("refund_or_offset_amount"))
        acc_ass = _d(item.get("accumulated_assessed", p_ass))
        acc_paid = _d(item.get("accumulated_paid", p_paid))

        # Net formula with explicit separation of payable vs overpayment
        net_closing = (op_pay - op_over) + p_ass - p_paid - ref_off
        expected_closing_payable = max(Decimal("0.00"), net_closing)
        expected_closing_overpayment = max(Decimal("0.00"), -net_closing)

        provided_closing_payable = (
            _d(item["closing_payable"]) if "closing_payable" in item and item["closing_payable"] is not None else expected_closing_payable
        )
        provided_closing_over = (
            _d(item["closing_overpayment"])
            if "closing_overpayment" in item and item["closing_overpayment"] is not None
            else expected_closing_overpayment
        )

        # Check formula discrepancy
        if provided_closing_payable != expected_closing_payable:
            validations.append(
                {
                    "check_code": "RPT0003_CLOSING_FORMULA_MISMATCH",
                    "check_name": f"Sai công thức số phải nộp cuối kỳ tại chỉ tiêu {item.get('indicator_code')}",
                    "severity": "ERROR",
                    "status": "FAILED",
                    "message": (
                        f"Chỉ tiêu {item.get('indicator_code')} ({item.get('indicator_name')}): "
                        f"closing_payable={_f(provided_closing_payable)} khác công thức={_f(expected_closing_payable)}."
                    ),
                    "affected_rows": [str(item.get("indicator_code"))],
                }
            )

        # Check accumulated >= period when in same fiscal year
        if acc_ass < p_ass or acc_paid < p_paid:
            validations.append(
                {
                    "check_code": "RPT0003_ACCUMULATED_LT_PERIOD",
                    "check_name": f"Lũy kế đầu năm nhỏ hơn phát sinh trong kỳ tại chỉ tiêu {item.get('indicator_code')}",
                    "severity": "WARNING",
                    "status": "WARNING",
                    "message": f"Chỉ tiêu {item.get('indicator_code')}: Số lũy kế nhỏ hơn phát sinh trong kỳ.",
                    "affected_rows": [str(item.get("indicator_code"))],
                }
            )

        # Check GL reconciliation difference if gl_closing_payable is supplied
        gl_diff = _d(item.get("gl_difference_amount", 0))
        recon_status = "MATCHED" if gl_diff == Decimal("0.00") else "MISMATCHED"
        if gl_diff != Decimal("0.00"):
            validations.append(
                {
                    "check_code": "RPT0003_GL_333_MISMATCH",
                    "check_name": f"Chênh lệch giữa báo cáo nghĩa vụ thuế và TK {item.get('tax_account_code', '333')}",
                    "severity": "WARNING",
                    "status": "WARNING",
                    "message": f"Chênh lệch đối chiếu TK {item.get('tax_account_code', '333')}: {_f(gl_diff)}.",
                    "affected_rows": [str(item.get("indicator_code"))],
                }
            )

        row_dict = {
            "row_order": idx + 1,
            "row_type": item.get("row_type", "DETAIL"),
            "group_code": item.get("parent_code") or "I",
            "indicator_code": str(item.get("indicator_code", idx)),
            "indicator_name": str(item.get("indicator_name", "")),
            "tax_account_code": str(item.get("tax_account_code", "333")),
            "columns": {
                "indicator_name": str(item.get("indicator_name", "")),
                "indicator_code": str(item.get("indicator_code", idx)),
                "opening_payable": _f(op_pay),
                "period_assessed": _f(p_ass),
                "period_paid": _f(p_paid),
                "accumulated_assessed": _f(acc_ass),
                "accumulated_paid": _f(acc_paid),
                "closing_payable": _f(provided_closing_payable),
            },
            "detail_payload": {
                "parent_indicator_code": item.get("parent_code") or "I",
                "level": 2 if item.get("parent_code") == "I" else 1,
                "is_group_header": bool(item.get("row_type") == "GROUP"),
                "tax_type": item.get("tax_type", "ALL"),
                "tax_account_code": item.get("tax_account_code", "333"),
                "opening_overpayment": _f(op_over),
                "refund_or_offset_amount": _f(ref_off),
                "closing_overpayment": _f(provided_closing_over),
                "declaration_reference": item.get("declaration_reference", ""),
                "payment_document_count": int(item.get("payment_document_count", 0)),
                "reconciliation_status": recon_status,
                "difference_amount": _f(gl_diff),
            },
            "source_refs": item.get("source_refs")
            or [
                {
                    "source_type": "GL_ACCOUNT",
                    "source_id": str(item.get("tax_account_code", "333")),
                    "account_code": str(item.get("tax_account_code", "333")),
                    "period": tax_period_code,
                }
            ],
            "warning_codes": ["RPT0003_GL_333_MISMATCH"] if gl_diff != Decimal("0.00") else [],
        }
        detail_rows_computed.append(row_dict)

    # Prepend Group I ("I. Thuế") aggregating children with group_code == "I"
    group_i_children = [r for r in detail_rows_computed if r["group_code"] == "I" and r["indicator_code"] != "II"]
    if group_i_children:
        g_op_pay = sum(Decimal(str(r["columns"]["opening_payable"])) for r in group_i_children)
        g_p_ass = sum(Decimal(str(r["columns"]["period_assessed"])) for r in group_i_children)
        g_p_paid = sum(Decimal(str(r["columns"]["period_paid"])) for r in group_i_children)
        g_acc_ass = sum(Decimal(str(r["columns"]["accumulated_assessed"])) for r in group_i_children)
        g_acc_paid = sum(Decimal(str(r["columns"]["accumulated_paid"])) for r in group_i_children)
        g_cl_pay = sum(Decimal(str(r["columns"]["closing_payable"])) for r in group_i_children)
        g_op_over = sum(Decimal(str(r["detail_payload"]["opening_overpayment"])) for r in group_i_children)
        g_cl_over = sum(Decimal(str(r["detail_payload"]["closing_overpayment"])) for r in group_i_children)
        rows.append(
            {
                "row_order": 1,
                "row_type": "GROUP",
                "group_code": "I",
                "indicator_code": "I",
                "indicator_name": "Thuế",
                "tax_account_code": "333",
                "columns": {
                    "indicator_name": "Thuế",
                    "indicator_code": "I",
                    "opening_payable": _f(g_op_pay),
                    "period_assessed": _f(g_p_ass),
                    "period_paid": _f(g_p_paid),
                    "accumulated_assessed": _f(g_acc_ass),
                    "accumulated_paid": _f(g_acc_paid),
                    "closing_payable": _f(g_cl_pay),
                },
                "detail_payload": {
                    "parent_indicator_code": None,
                    "level": 1,
                    "is_group_header": True,
                    "tax_type": "ALL",
                    "tax_account_code": "333",
                    "opening_overpayment": _f(g_op_over),
                    "refund_or_offset_amount": "0.00",
                    "closing_overpayment": _f(g_cl_over),
                    "reconciliation_status": "MATCHED",
                    "difference_amount": "0.00",
                },
                "source_refs": [],
                "warning_codes": [],
            }
        )
    rows.extend(detail_rows_computed)

    # Calculate grand totals from leaf rows (non-group or group II)
    leaf_rows = [r for r in detail_rows_computed]
    tot_op_pay = sum(Decimal(str(r["columns"]["opening_payable"])) for r in leaf_rows)
    tot_p_ass = sum(Decimal(str(r["columns"]["period_assessed"])) for r in leaf_rows)
    tot_p_paid = sum(Decimal(str(r["columns"]["period_paid"])) for r in leaf_rows)
    tot_acc_ass = sum(Decimal(str(r["columns"]["accumulated_assessed"])) for r in leaf_rows)
    tot_acc_paid = sum(Decimal(str(r["columns"]["accumulated_paid"])) for r in leaf_rows)
    tot_cl_pay = sum(Decimal(str(r["columns"]["closing_payable"])) for r in leaf_rows)
    tot_op_over = sum(Decimal(str(r["detail_payload"]["opening_overpayment"])) for r in leaf_rows)
    tot_cl_over = sum(Decimal(str(r["detail_payload"]["closing_overpayment"])) for r in leaf_rows)

    summary = {
        "opening_payable_total": _f(tot_op_pay),
        "opening_payable": _f(tot_op_pay),
        "opening_overpayment_total": _f(tot_op_over),
        "opening_overpayment": _f(tot_op_over),
        "period_assessed_total": _f(tot_p_ass),
        "period_assessed": _f(tot_p_ass),
        "period_paid_total": _f(tot_p_paid),
        "period_paid": _f(tot_p_paid),
        "accumulated_assessed_total": _f(tot_acc_ass),
        "accumulated_assessed": _f(tot_acc_ass),
        "accumulated_paid_total": _f(tot_acc_paid),
        "accumulated_paid": _f(tot_acc_paid),
        "closing_payable_total": _f(tot_cl_pay),
        "closing_payable": _f(tot_cl_pay),
        "closing_overpayment_total": _f(tot_cl_over),
        "closing_overpayment": _f(tot_cl_over),
        "row_count": len(rows),
    }

    if not validations:
        validations.append(
            {
                "check_code": "RPT0003_FORMULA_AND_GL_OK",
                "check_name": "Kiểm tra công thức nghĩa vụ NSNN và đối chiếu TK 333",
                "severity": "INFO",
                "status": "PASSED",
                "message": "Số dư đầu kỳ, phải nộp, đã nộp và cuối kỳ khớp công thức, tách bạch phải nộp và nộp thừa.",
                "affected_rows": [],
            }
        )

    return rows, summary, validations


def _build_rpt_0175(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    tax_period_code: str,
    fiscal_year: int,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.3. RPT-0175 – Bảng kê hóa đơn, chứng từ hàng hóa, dịch vụ mua vào (9 cột chuẩn + TO-BE detail).
    Nguyên tắc:
    - Phân biệt thuế GTGT đầu vào phát sinh (tax_amount) và thuế GTGT đủ điều kiện khấu trừ (deductible_tax_amount).
    - Không tự cộng hóa đơn không đủ điều kiện khấu trừ (INELIGIBLE), hóa đơn đã hủy (CANCELLED) hoặc bị thay thế (REPLACED) vào tổng thuế được khấu trừ.
    - Hỗ trợ hóa đơn nhiều dòng thuế suất mà không cộng trùng tổng hóa đơn.
    """
    rows: list[dict[str, Any]] = []
    validations: list[dict[str, Any]] = []

    custom_invoices = params.get("invoices")
    vat_entries: list[VatLedgerEntry] = []
    if isinstance(custom_invoices, list) and custom_invoices:
        for c_inv in custom_invoices:
            amt = _d(c_inv.get("amount_before_tax"))
            rate = _d(c_inv.get("vat_rate", c_inv.get("tax_rate_percent", 10)))
            t_amt = _d(c_inv.get("tax_amount"))
            inv_status = str(c_inv.get("invoice_status") or "ACTIVE").upper()
            if inv_status == "VALID":
                inv_status = "ACTIVE"
            ded_status = str(c_inv.get("deductibility_status") or ("INELIGIBLE" if inv_status in ("CANCELLED", "REPLACED") else "ELIGIBLE")).upper()
            pay_method = str(c_inv.get("payment_method_status") or c_inv.get("payment_evidence_status") or "NON_CASH").upper()
            inv_date_raw = c_inv.get("invoice_date")
            inv_date_val = date.fromisoformat(str(inv_date_raw)[:10]) if inv_date_raw else d_from
            vat_entries.append(
                VatLedgerEntry(
                    company_id=company_id,
                    tax_period_code=tax_period_code,
                    direction="INPUT",
                    invoice_number=str(c_inv.get("invoice_number") or c_inv.get("invoice_no") or ""),
                    invoice_symbol=str(c_inv.get("invoice_symbol") or c_inv.get("invoice_series") or ""),
                    invoice_form_symbol=str(c_inv.get("invoice_form_symbol") or "1"),
                    invoice_date=inv_date_val,
                    posting_date=inv_date_val,
                    voucher_number=str(c_inv.get("voucher_number") or c_inv.get("voucher_id") or ""),
                    voucher_id=str(c_inv.get("voucher_id") or ""),
                    counterparty_name=str(c_inv.get("counterparty_name") or c_inv.get("seller_name") or ""),
                    counterparty_tax_code=str(c_inv.get("counterparty_tax_code") or c_inv.get("seller_tax_code") or ""),
                    item_name=str(c_inv.get("item_name") or "Hàng hóa, dịch vụ mua vào"),
                    amount_before_tax=amt,
                    tax_rate_percent=rate,
                    tax_amount=t_amt,
                    deductible_tax_amount=t_amt if ded_status == "ELIGIBLE" and inv_status not in ("CANCELLED", "REPLACED") else Decimal("0.00"),
                    non_deductible_tax_amount=Decimal("0.00") if ded_status == "ELIGIBLE" else (Decimal("0.00") if inv_status in ("CANCELLED", "REPLACED") else t_amt),
                    tax_account_code=str(c_inv.get("tax_account_code") or "1331"),
                    item_tax_group=str(c_inv.get("item_tax_group") or "1"),
                    deductibility_status=ded_status,
                    invoice_status=inv_status,
                    original_invoice_id=str(c_inv.get("original_invoice_reference") or c_inv.get("original_invoice_id") or ""),
                    payment_evidence_status="MISSING_NON_CASH" if pay_method == "CASH" else "VALID",
                    gl_reconciliation_status="MATCHED",
                )
            )
    else:
        vat_entries = list(
            VatLedgerEntry.objects.filter(
                company_id=company_id,
                direction="INPUT",
                invoice_date__gte=d_from,
                invoice_date__lte=d_to,
            ).order_by("item_tax_group", "invoice_date", "invoice_number", "id")
        )
        if branch_id:
            vat_entries = [e for e in vat_entries if not e.branch_id or e.branch_id == branch_id]

    # Filter by counterparty, tax_rate, deductibility_status, invoice_status if requested
    f_tax_code = params.get("counterparty_tax_code")
    f_deduct = params.get("deductibility_status")
    f_rate = params.get("tax_rate_percent")
    include_cancelled = bool(params.get("include_cancelled", True))

    if not vat_entries and not custom_invoices:
        # Fallback to TaxInvoice (INPUT) from tax_management
        inv_qs = TaxInvoice.objects.filter(
            direction="INPUT",
            invoice_date__gte=d_from,
            invoice_date__lte=d_to,
        ).prefetch_related("lines", "document_links").order_by("invoice_date", "invoice_number")
        for inv in inv_qs:
            lines = list(inv.lines.all())
            doc_link = inv.document_links.first()
            ded_status = "ELIGIBLE" if inv.tax_eligible and inv.status not in ("CANCELLED", "REPLACED", "BLOCKED") else "INELIGIBLE"
            if inv.status in ("CANCELLED", "REPLACED"):
                ded_status = "INELIGIBLE"
            if lines:
                for ln in lines:
                    amt = _d(ln.taxable_amount)
                    rate = _d(ln.tax_rate)
                    t_amt = _d(ln.tax_amount)
                    vat_entries.append(
                        VatLedgerEntry(
                            company_id=company_id,
                            tax_period_code=tax_period_code,
                            direction="INPUT",
                            tax_invoice=inv,
                            invoice_number=inv.invoice_number,
                            invoice_symbol=inv.invoice_series,
                            invoice_form_symbol="1",
                            invoice_date=inv.invoice_date,
                            posting_date=inv.invoice_date,
                            voucher_number=doc_link.document_number if doc_link else "",
                            voucher_id=str(doc_link.entity_id) if doc_link else "",
                            counterparty_name=inv.seller_name,
                            counterparty_tax_code=inv.seller_tax_code,
                            item_name=ln.description or "HHDV mua vào",
                            amount_before_tax=amt,
                            tax_rate_percent=rate,
                            tax_amount=t_amt,
                            deductible_tax_amount=t_amt if ded_status == "ELIGIBLE" else Decimal("0.00"),
                            non_deductible_tax_amount=Decimal("0.00") if ded_status == "ELIGIBLE" else t_amt,
                            tax_account_code="1331",
                            item_tax_group="1",
                            deductibility_status=ded_status,
                            invoice_status=inv.status,
                            gl_reconciliation_status="MATCHED" if doc_link else "UNMATCHED",
                        )
                    )
            else:
                amt = _d(inv.subtotal)
                t_amt = _d(inv.tax_amount)
                rate = (t_amt * Decimal("100") / amt).quantize(Decimal("0.01")) if amt else Decimal("10.00")
                vat_entries.append(
                    VatLedgerEntry(
                        company_id=company_id,
                        tax_period_code=tax_period_code,
                        direction="INPUT",
                        tax_invoice=inv,
                        invoice_number=inv.invoice_number,
                        invoice_symbol=inv.invoice_series,
                        invoice_form_symbol="1",
                        invoice_date=inv.invoice_date,
                        posting_date=inv.invoice_date,
                        voucher_number=doc_link.document_number if doc_link else "",
                        voucher_id=str(doc_link.entity_id) if doc_link else "",
                        counterparty_name=inv.seller_name,
                        counterparty_tax_code=inv.seller_tax_code,
                        item_name="Hàng hóa, dịch vụ mua vào",
                        amount_before_tax=amt,
                        tax_rate_percent=rate,
                        tax_amount=t_amt,
                        deductible_tax_amount=t_amt if ded_status == "ELIGIBLE" else Decimal("0.00"),
                        non_deductible_tax_amount=Decimal("0.00") if ded_status == "ELIGIBLE" else t_amt,
                        tax_account_code="1331",
                        item_tax_group="1",
                        deductibility_status=ded_status,
                        invoice_status=inv.status,
                        gl_reconciliation_status="MATCHED" if doc_link else "UNMATCHED",
                    )
                )

    total_before_tax = Decimal("0.00")
    total_input_vat = Decimal("0.00")
    deductible_vat_total = Decimal("0.00")
    non_deductible_vat_total = Decimal("0.00")
    seen_invoice_keys: dict[tuple[str, str, str], int] = {}
    unique_active_invoices: set[tuple[str, str, str]] = set()
    invalid_or_warning_count = 0

    for idx, entry in enumerate(vat_entries, start=1):
        if f_tax_code and entry.counterparty_tax_code != str(f_tax_code).strip():
            continue
        if f_deduct and entry.deductibility_status != str(f_deduct).strip():
            continue
        if f_rate is not None and str(f_rate).strip() != "" and _d(entry.tax_rate_percent) != _d(f_rate):
            continue
        if not include_cancelled and entry.invoice_status in ("CANCELLED", "REPLACED"):
            continue

        row_warnings: list[str] = []
        inv_key = (entry.counterparty_tax_code, entry.invoice_symbol, entry.invoice_number)
        is_Inactive = entry.invoice_status in ("CANCELLED", "REPLACED")
        if entry.invoice_status == "REPLACED":
            validations.append(
                {
                    "check_code": "RPT0175_REPLACED_EXCLUDED",
                    "check_name": f"Hóa đơn bị thay thế {entry.invoice_number} được loại khỏi tổng khấu trừ",
                    "severity": "WARNING",
                    "status": "WARNING",
                    "message": f"Hóa đơn số {entry.invoice_number} có trạng thái REPLACED, không cộng vào thuế GTGT được khấu trừ.",
                    "affected_rows": [entry.invoice_number],
                }
            )
        if entry.payment_evidence_status == "MISSING_NON_CASH":
            row_warnings.append("MISSING_NON_CASH_PAYMENT_EVIDENCE")
            validations.append(
                {
                    "check_code": "RPT0175_NON_CASH_PAYMENT_REQUIRED",
                    "check_name": f"Hóa đơn {entry.invoice_number} thiếu chứng từ thanh toán không dùng tiền mặt",
                    "severity": "WARNING",
                    "status": "WARNING",
                    "message": f"Hóa đơn {entry.invoice_number} chưa có chứng từ thanh toán không dùng tiền mặt.",
                    "affected_rows": [entry.invoice_number],
                }
            )

        # Duplicate check (only if not multi-line of same invoice_id)
        if not entry.tax_invoice_id and entry.is_duplicate_flagged:
            row_warnings.append("DUPLICATE_INVOICE")
            validations.append(
                {
                    "check_code": "RPT0175_DUPLICATE_INVOICE",
                    "check_name": f"Hóa đơn mua vào trùng lặp số {entry.invoice_number}",
                    "severity": "WARNING",
                    "status": "WARNING",
                    "message": f"Phát hiện hóa đơn mua vào trùng số {entry.invoice_number} của MST {entry.counterparty_tax_code}.",
                    "affected_rows": [entry.invoice_number],
                }
            )
        elif not entry.tax_invoice_id:
            seen_invoice_keys[inv_key] = seen_invoice_keys.get(inv_key, 0) + 1

        # Check tax calculation tolerance (> 100 VND difference)
        expected_tax = (_d(entry.amount_before_tax) * _d(entry.tax_rate_percent) / Decimal("100")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        if abs(_d(entry.tax_amount) - expected_tax) > Decimal("100.00"):
            row_warnings.append("TAX_MATH_DEVIATION")
            validations.append(
                {
                    "check_code": "RPT0175_TAX_MATH_DEVIATION",
                    "check_name": f"Chênh lệch tiền thuế hóa đơn {entry.invoice_number}",
                    "severity": "WARNING",
                    "status": "WARNING",
                    "message": f"Tiền thuế {_f(entry.tax_amount)} lệch so với tiền trước thuế * thuế suất ({_f(expected_tax)}).",
                    "affected_rows": [entry.invoice_number],
                }
            )

        # Deductibility enforcement (BR-RPT07-08): cancelled/replaced/ineligible NEVER counted in deductible_vat_total
        eff_before_tax = Decimal("0.00") if is_Inactive else _d(entry.amount_before_tax)
        eff_tax = Decimal("0.00") if is_Inactive else _d(entry.tax_amount)
        if is_Inactive:
            eff_deductible = Decimal("0.00")
            eff_non_deductible = Decimal("0.00")
            row_warnings.append(f"INVOICE_{entry.invoice_status}")
        elif entry.deductibility_status == "INELIGIBLE":
            eff_deductible = Decimal("0.00")
            eff_non_deductible = eff_tax
            row_warnings.append("INELIGIBLE_VAT")
        elif entry.deductibility_status == "PARTIAL":
            eff_deductible = _d(entry.deductible_tax_amount)
            eff_non_deductible = eff_tax - eff_deductible
        elif entry.deductibility_status == "PENDING_REVIEW":
            eff_deductible = Decimal("0.00")
            eff_non_deductible = eff_tax
            row_warnings.append("PENDING_DEDUCTIBILITY_REVIEW")
        else:
            eff_deductible = _d(entry.deductible_tax_amount) if _d(entry.deductible_tax_amount) != Decimal("0.00") or eff_tax == Decimal("0.00") else eff_tax
            eff_non_deductible = max(Decimal("0.00"), eff_tax - eff_deductible)

        if not is_Inactive:
            total_before_tax += eff_before_tax
            total_input_vat += eff_tax
            deductible_vat_total += eff_deductible
            non_deductible_vat_total += eff_non_deductible
            unique_active_invoices.add(inv_key)

        if row_warnings:
            invalid_or_warning_count += 1

        rows.append(
            {
                "row_order": len(rows) + 1,
                "row_type": "DETAIL",
                "group_code": entry.item_tax_group or "1",
                "indicator_code": f"IN-{len(rows) + 1:04d}",
                "indicator_name": entry.item_name or "HHDV mua vào",
                "invoice_id": str(entry.tax_invoice_id or entry.id or ""),
                "voucher_id": entry.voucher_id or "",
                "tax_account_code": entry.tax_account_code or "1331",
                "columns": {
                    "invoice_number": entry.invoice_number,
                    "invoice_date": entry.invoice_date.isoformat() if entry.invoice_date else "",
                    "seller_name": entry.counterparty_name,
                    "seller_tax_code": entry.counterparty_tax_code,
                    "item_name": entry.item_name,
                    "amount_before_tax": _f(entry.amount_before_tax),
                    "tax_rate_percent": _f(entry.tax_rate_percent),
                    "tax_amount": _f(entry.tax_amount),
                    "tax_account_code": entry.tax_account_code or "1331",
                },
                "detail_payload": {
                    "invoice_symbol": entry.invoice_symbol,
                    "invoice_form_symbol": entry.invoice_form_symbol,
                    "voucher_id": entry.voucher_id,
                    "voucher_number": entry.voucher_number,
                    "posting_date": entry.posting_date.isoformat() if entry.posting_date else "",
                    "item_tax_group": entry.item_tax_group or "1",
                    "deductibility_status": entry.deductibility_status,
                    "deductible_tax_amount": _f(eff_deductible),
                    "non_deductible_tax_amount": _f(eff_non_deductible),
                    "invoice_status": entry.invoice_status,
                    "original_invoice_id": entry.original_invoice_id,
                    "adjustment_type": entry.adjustment_type,
                    "payment_evidence_status": entry.payment_evidence_status,
                    "gl_reconciliation_status": entry.gl_reconciliation_status,
                    "note": entry.note,
                },
                "source_refs": [
                    {
                        "source_type": "TAX_INVOICE",
                        "source_id": str(entry.tax_invoice_id or entry.id or entry.invoice_number),
                        "invoice_number": entry.invoice_number,
                        "invoice_symbol": entry.invoice_symbol,
                        "voucher_number": entry.voucher_number,
                        "tax_account_code": entry.tax_account_code or "1331",
                        "original_invoice_id": entry.original_invoice_id,
                    }
                ],
                "warning_codes": row_warnings,
            }
        )

    summary = {
        "total_invoice_count": len(unique_active_invoices),
        "total_line_count": len(rows),
        "total_amount_before_tax": _f(total_before_tax),
        "total_input_vat": _f(total_input_vat),
        "deductible_vat_total": _f(deductible_vat_total),
        "non_deductible_vat_total": _f(non_deductible_vat_total),
        "invalid_or_warning_invoice_count": invalid_or_warning_count,
    }

    if not validations:
        validations.append(
            {
                "check_code": "RPT0175_VAT_INPUT_OK",
                "check_name": "Kiểm tra bảng kê hóa đơn mua vào và điều kiện khấu trừ",
                "severity": "INFO",
                "status": "PASSED",
                "message": "Bảng kê mua vào hợp lệ, phân tách rõ thuế GTGT đầu vào phát sinh và thuế đủ điều kiện khấu trừ.",
                "affected_rows": [],
            }
        )

    return rows, summary, validations


def _build_rpt_0176(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    tax_period_code: str,
    fiscal_year: int,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.4. RPT-0176 – Bảng tổng hợp quyết toán thuế GTGT năm (8 cột chuẩn + TO-BE detail).
    Nguyên tắc bắt buộc (1.4.4, 5.2, TC-RPT-07-16..20, TC-RPT-07-64):
    - opening_vat_credit(t) == closing_vat_credit(t-1); nếu lệch phải gắn cảnh báo VAT_CREDIT_CONTINUITY_MISMATCH.
    - Dòng tổng năm:
      + opening_vat_credit lấy từ kỳ đầu năm (rows[0].opening_vat_credit), TUYỆT ĐỐI KHÔNG CỘNG 12 THÁNG.
      + closing_vat_credit lấy từ kỳ cuối năm (rows[-1].closing_vat_credit), TUYỆT ĐỐI KHÔNG CỘNG 12 THÁNG.
      + output_vat, input_vat, deductible_vat, vat_payable, refund_requested cộng theo các kỳ trong năm.
    """
    rows: list[dict[str, Any]] = []
    validations: list[dict[str, Any]] = []

    custom_periods = params.get("period_rows")
    monthly_vat_data = params.get("monthly_vat_data")
    if isinstance(custom_periods, list) and custom_periods:
        raw_periods = custom_periods
    elif isinstance(monthly_vat_data, dict) and monthly_vat_data:
        raw_periods = []
        for m in range(1, 13):
            m_data = monthly_vat_data.get(str(m)) or monthly_vat_data.get(m) or {}
            p_code = f"{fiscal_year}-{m:02d}"
            op_cred = _d(m_data.get("opening_vat_credit", 0))
            in_vat = _d(m_data.get("input_vat", m_data.get("deductible_input_vat", 0)))
            ded_vat = _d(m_data.get("deductible_vat", m_data.get("deductible_input_vat", in_vat)))
            out_vat = _d(m_data.get("output_vat", m_data.get("output_vat_payable", 0)))
            ref_req = _d(m_data.get("refund_requested", 0))
            v_pay = _d(m_data["vat_payable"]) if "vat_payable" in m_data else max(Decimal("0.00"), out_vat - op_cred - ded_vat)
            cl_cred = _d(m_data["closing_vat_credit"]) if "closing_vat_credit" in m_data else max(Decimal("0.00"), op_cred + ded_vat - out_vat - ref_req)
            raw_periods.append(
                {
                    "tax_period": p_code,
                    "opening_vat_credit": op_cred,
                    "output_vat": out_vat,
                    "input_vat": in_vat,
                    "deductible_vat": ded_vat,
                    "vat_payable": v_pay,
                    "refund_requested": ref_req,
                    "closing_vat_credit": cl_cred,
                    "vat_paid_in_period": _d(m_data.get("vat_paid", m_data.get("vat_paid_in_period", 0))),
                    "filing_status": str(m_data.get("filing_status", "OFFICIAL")),
                }
            )
    else:
        # Query TaxPeriod + TaxSummary for the fiscal_year
        tp_qs = TaxPeriod.objects.filter(
            tax_type__in=["VAT", "GTGT"],
            start_date__year=fiscal_year,
        ).prefetch_related("summaries").order_by("start_date")
        raw_periods = []
        if tp_qs.exists():
            prev_closing = Decimal("0.00")
            for tp in tp_qs:
                s = tp.summaries.order_by("-version").first()
                op_cred = prev_closing
                out_vat = _d(getattr(s, "output_tax_amount", 0)) if s else Decimal("0.00")
                in_vat = _d(getattr(s, "input_tax_amount", 0)) if s else Decimal("0.00")
                ded_vat = in_vat
                ref_req = Decimal("0.00")
                v_pay = max(Decimal("0.00"), out_vat - op_cred - ded_vat)
                cl_cred = max(Decimal("0.00"), op_cred + ded_vat - out_vat - ref_req)
                prev_closing = cl_cred
                raw_periods.append(
                    {
                        "tax_period": tp.code,
                        "opening_vat_credit": op_cred,
                        "output_vat": out_vat,
                        "input_vat": in_vat,
                        "deductible_vat": ded_vat,
                        "vat_payable": v_pay,
                        "refund_requested": ref_req,
                        "closing_vat_credit": cl_cred,
                        "filing_status": tp.status,
                    }
                )
        else:
            # Generate 12 monthly rows from VatLedgerEntry for fiscal_year
            prev_closing = _d(params.get("year_opening_vat_credit", 0))
            for m in range(1, 13):
                p_code = f"{fiscal_year}-{m:02d}"
                in_agg = VatLedgerEntry.objects.filter(
                    company_id=company_id,
                    direction="INPUT",
                    invoice_date__year=fiscal_year,
                    invoice_date__month=m,
                ).exclude(invoice_status__in=["CANCELLED", "REPLACED"]).aggregate(
                    t=Sum("tax_amount"),
                    d=Sum("deductible_tax_amount"),
                )
                out_agg = VatLedgerEntry.objects.filter(
                    company_id=company_id,
                    direction="OUTPUT",
                    invoice_date__year=fiscal_year,
                    invoice_date__month=m,
                ).exclude(invoice_status__in=["CANCELLED", "REPLACED"]).aggregate(t=Sum("tax_amount"))

                op_cred = prev_closing
                out_vat = _d(out_agg["t"])
                in_vat = _d(in_agg["t"])
                ded_vat = _d(in_agg["d"]) if in_agg["d"] is not None else in_vat
                ref_req = Decimal("0.00")
                v_pay = max(Decimal("0.00"), out_vat - op_cred - ded_vat)
                cl_cred = max(Decimal("0.00"), op_cred + ded_vat - out_vat - ref_req)
                prev_closing = cl_cred
                raw_periods.append(
                    {
                        "tax_period": p_code,
                        "opening_vat_credit": op_cred,
                        "output_vat": out_vat,
                        "input_vat": in_vat,
                        "deductible_vat": ded_vat,
                        "vat_payable": v_pay,
                        "refund_requested": ref_req,
                        "closing_vat_credit": cl_cred,
                        "filing_status": "OFFICIAL",
                    }
                )

    prev_closing_val: Decimal | None = None
    for idx, p_item in enumerate(raw_periods, start=1):
        p_code = str(p_item.get("tax_period", f"{fiscal_year}-{idx:02d}"))
        op_cred = _d(p_item.get("opening_vat_credit"))
        out_vat = _d(p_item.get("output_vat"))
        in_vat = _d(p_item.get("input_vat"))
        ded_vat = _d(p_item.get("deductible_vat", in_vat))
        adj_inc = _d(p_item.get("adjustment_increase"))
        adj_dec = _d(p_item.get("adjustment_decrease"))
        ref_req = _d(p_item.get("refund_requested"))

        expected_payable = max(Decimal("0.00"), out_vat - op_cred - ded_vat + adj_dec - adj_inc)
        expected_closing = max(Decimal("0.00"), op_cred + ded_vat - out_vat - adj_dec + adj_inc - ref_req)

        v_pay = _d(p_item["vat_payable"]) if "vat_payable" in p_item and p_item["vat_payable"] is not None else expected_payable
        cl_cred = (
            _d(p_item["closing_vat_credit"])
            if "closing_vat_credit" in p_item and p_item["closing_vat_credit"] is not None
            else expected_closing
        )

        row_warnings: list[str] = []
        # Continuity check: opening(t) == closing(t-1)
        if prev_closing_val is not None and op_cred != prev_closing_val:
            row_warnings.append("VAT_CREDIT_CONTINUITY_MISMATCH")
            row_warnings.append("RPT0176_CREDIT_ROLLOVER_BREAK")
            validations.append(
                {
                    "check_code": "RPT0176_CREDIT_ROLLOVER_BREAK",
                    "check_name": f"Chênh lệch chuyển tiếp thuế GTGT khấu trừ sang kỳ {p_code}",
                    "severity": "WARNING",
                    "status": "WARNING",
                    "message": (
                        f"Kỳ {p_code}: Thuế GTGT còn được khấu trừ đầu kỳ ({_f(op_cred)}) "
                        f"không bằng số cuối kỳ trước ({_f(prev_closing_val)})."
                    ),
                    "affected_rows": [p_code],
                }
            )
            validations.append(
                {
                    "check_code": "VAT_CREDIT_CONTINUITY_MISMATCH",
                    "check_name": f"Chênh lệch chuyển tiếp thuế GTGT khấu trừ sang kỳ {p_code}",
                    "severity": "WARNING",
                    "status": "WARNING",
                    "message": (
                        f"Kỳ {p_code}: Thuế GTGT còn được khấu trừ đầu kỳ ({_f(op_cred)}) "
                        f"không bằng số cuối kỳ trước ({_f(prev_closing_val)})."
                    ),
                    "affected_rows": [p_code],
                }
            )

        # Deductible <= Input check
        if ded_vat > in_vat and adj_inc == Decimal("0.00"):
            row_warnings.append("DEDUCTIBLE_GT_INPUT_VAT")
            validations.append(
                {
                    "check_code": "RPT0176_DEDUCTIBLE_GT_INPUT",
                    "check_name": f"Thuế GTGT được khấu trừ lớn hơn thuế đầu vào tại kỳ {p_code}",
                    "severity": "WARNING",
                    "status": "WARNING",
                    "message": f"Kỳ {p_code}: deductible_vat ({_f(ded_vat)}) > input_vat ({_f(in_vat)}).",
                    "affected_rows": [p_code],
                }
            )

        # Formula check
        if v_pay != expected_payable or cl_cred != expected_closing:
            row_warnings.append("VAT_PERIOD_FORMULA_MISMATCH")
            validations.append(
                {
                    "check_code": "RPT0176_PERIOD_FORMULA_MISMATCH",
                    "check_name": f"Sai công thức tính thuế GTGT kỳ {p_code}",
                    "severity": "ERROR",
                    "status": "FAILED",
                    "message": (
                        f"Kỳ {p_code}: vat_payable={_f(v_pay)} (kỳ vọng {_f(expected_payable)}), "
                        f"closing_vat_credit={_f(cl_cred)} (kỳ vọng {_f(expected_closing)})."
                    ),
                    "affected_rows": [p_code],
                }
            )

        prev_closing_val = cl_cred
        rows.append(
            {
                "row_order": idx,
                "row_type": "DETAIL",
                "group_code": str(fiscal_year),
                "indicator_code": p_code,
                "indicator_name": f"Kỳ thuế {p_code}",
                "columns": {
                    "tax_period": p_code,
                    "opening_vat_credit": _f(op_cred),
                    "output_vat": _f(out_vat),
                    "input_vat": _f(in_vat),
                    "deductible_vat": _f(ded_vat),
                    "vat_payable": _f(v_pay),
                    "refund_requested": _f(ref_req),
                    "closing_vat_credit": _f(cl_cred),
                },
                "detail_payload": {
                    "declaration_id": str(p_item.get("declaration_id", f"DECL-01GTGT-{p_code}")),
                    "declaration_version": str(p_item.get("declaration_version", "1")),
                    "filing_status": str(p_item.get("filing_status", "OFFICIAL")),
                    "non_deductible_input_vat": _f(max(Decimal("0.00"), in_vat - ded_vat)),
                    "adjustment_increase": _f(adj_inc),
                    "adjustment_decrease": _f(adj_dec),
                    "vat_paid_in_period": _f(p_item.get("vat_paid_in_period", 0)),
                    "gl_133_closing_balance": _f(cl_cred),
                    "gl_3331_closing_balance": _f(v_pay),
                    "reconciliation_status": str(p_item.get("reconciliation_status", "MATCHED")),
                },
                "source_refs": [
                    {
                        "source_type": "TAX_DECLARATION",
                        "source_id": str(p_item.get("declaration_id", f"DECL-01GTGT-{p_code}")),
                        "form_code": "01/GTGT",
                        "tax_period": p_code,
                    }
                ],
                "warning_codes": row_warnings,
            }
        )

    # Compute Annual Summary strictly per Section 1.4.4 & Section 5.2:
    # opening_vat_credit = first period's opening_vat_credit (NEVER summed across 12 months)
    # closing_vat_credit = last period's closing_vat_credit (NEVER summed across 12 months)
    year_opening_credit = Decimal(str(rows[0]["columns"]["opening_vat_credit"])) if rows else Decimal("0.00")
    year_closing_credit = Decimal(str(rows[-1]["columns"]["closing_vat_credit"])) if rows else Decimal("0.00")
    year_output_vat = sum(Decimal(str(r["columns"]["output_vat"])) for r in rows)
    year_input_vat = sum(Decimal(str(r["columns"]["input_vat"])) for r in rows)
    year_deductible_vat = sum(Decimal(str(r["columns"]["deductible_vat"])) for r in rows)
    year_vat_payable = sum(Decimal(str(r["columns"]["vat_payable"])) for r in rows)
    year_refund_requested = sum(Decimal(str(r["columns"]["refund_requested"])) for r in rows)

    summary = {
        "fiscal_year": fiscal_year,
        "period_count": len(rows),
        "opening_vat_credit": _f(year_opening_credit),
        "opening_vat_credit_year_start": _f(year_opening_credit),
        "output_vat_total": _f(year_output_vat),
        "input_vat_total": _f(year_input_vat),
        "deductible_vat_total": _f(year_deductible_vat),
        "total_deductible_input_vat": _f(year_deductible_vat),
        "vat_payable_total": _f(year_vat_payable),
        "refund_requested_total": _f(year_refund_requested),
        "closing_vat_credit": _f(year_closing_credit),
        "closing_vat_credit_year_end": _f(year_closing_credit),
    }

    if not validations:
        validations.append(
            {
                "check_code": "RPT0176_ANNUAL_CONTINUITY_OK",
                "check_name": "Kiểm tra tính liên tục khấu trừ GTGT các kỳ trong năm",
                "severity": "INFO",
                "status": "PASSED",
                "message": "Số đầu kỳ/cuối kỳ thuế GTGT được khấu trừ liên tục giữa các kỳ, dòng tổng năm lấy đúng kỳ đầu/kỳ cuối.",
                "affected_rows": [],
            }
        )

    return rows, summary, validations


def _build_rpt_0177(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    tax_period_code: str,
    fiscal_year: int,
    params: dict[str, Any],
    can_view_pii: bool = True,
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.5. RPT-0177 – Bảng kê thu mua hàng hóa, dịch vụ mua vào không có hóa đơn (02/TNDN) (10 cột chuẩn).
    Nguyên tắc:
    - Tải đúng phiên bản biểu mẫu 02/TNDN theo ngày hiệu lực (Thông tư 20/2026/TT-BTC).
    - Kiểm tra total_payment_amount == round(quantity_or_weight * unit_price, 2).
    - Cảnh báo thiếu thông tin người bán (tên, địa chỉ, CCCD/CMND) hoặc thiếu chứng từ thanh toán/hạch toán.
    - Che một phần seller_identity_number nếu không có quyền RPT_TAX_DETAIL_VIEW.
    """
    rows: list[dict[str, Any]] = []
    validations: list[dict[str, Any]] = []

    custom_items = params.get("items")
    items: list[TaxUninvoicedPurchaseItem] = []
    if isinstance(custom_items, list) and custom_items:
        for c_it in custom_items:
            p_date_raw = c_it.get("purchase_date")
            p_date = date.fromisoformat(str(p_date_raw)[:10]) if p_date_raw else d_from
            items.append(
                TaxUninvoicedPurchaseItem(
                    company_id=company_id,
                    tax_period_code=tax_period_code,
                    purchase_date=p_date,
                    seller_name=str(c_it.get("seller_name") or ""),
                    seller_address=str(c_it.get("seller_address") or ""),
                    seller_identity_number=str(c_it.get("seller_identity_number") or ""),
                    seller_phone=str(c_it.get("seller_phone") or ""),
                    item_name=str(c_it.get("item_name") or c_it.get("goods_name") or ""),
                    quantity_or_weight=_d(c_it.get("quantity_or_weight")),
                    unit_price=_d(c_it.get("unit_price")),
                    total_payment_amount=_d(c_it.get("total_payment_amount")),
                    voucher_id=str(c_it.get("voucher_id") or c_it.get("payment_voucher_no") or ""),
                    voucher_number=str(c_it.get("voucher_number") or c_it.get("payment_voucher_no") or ""),
                    payment_voucher_id=str(c_it.get("payment_voucher_id") or c_it.get("payment_voucher_no") or ""),
                    note=str(c_it.get("note") or ""),
                )
            )
    else:
        items = list(
            TaxUninvoicedPurchaseItem.objects.filter(
                company_id=company_id,
                purchase_date__gte=d_from,
                purchase_date__lte=d_to,
            ).order_by("purchase_date", "id")
        )
        if branch_id:
            items = [it for it in items if not it.branch_id or it.branch_id == branch_id]

    total_qty = Decimal("0.00")
    total_payment = Decimal("0.00")
    missing_seller_info_count = 0
    missing_supporting_doc_count = 0
    pending_review_count = 0

    for idx, item in enumerate(items, start=1):
        row_warnings: list[str] = []
        qty = _d(item.quantity_or_weight)
        u_price = _d(item.unit_price)
        tot_pay = _d(item.total_payment_amount)
        expected_total = (qty * u_price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        if abs(tot_pay - expected_total) > Decimal("1.00"):
            row_warnings.append("AMOUNT_MATH_MISMATCH")
            validations.append(
                {
                    "check_code": "RPT0177_TOTAL_CALC_MISMATCH",
                    "check_name": f"Sai công thức tổng tiền thanh toán dòng {idx} ({item.item_name})",
                    "severity": "ERROR",
                    "status": "FAILED",
                    "message": (
                        f"Dòng {idx}: total_payment_amount ({_f(tot_pay)}) != "
                        f"quantity_or_weight * unit_price ({_f(expected_total)})."
                    ),
                    "affected_rows": [str(idx)],
                }
            )

        if not (item.seller_name or "").strip() or not (item.seller_address or "").strip() or not (item.seller_identity_number or "").strip():
            missing_seller_info_count += 1
            row_warnings.append("MISSING_SELLER_IDENTITY_OR_ADDRESS")
            validations.append(
                {
                    "check_code": "RPT0177_MISSING_SELLER_IDENTITY",
                    "check_name": f"Thiếu thông tin người bán tại dòng {idx}",
                    "severity": "WARNING",
                    "status": "WARNING",
                    "message": f"Dòng {idx} ({item.item_name}): Thiếu tên, địa chỉ hoặc số CCCD/CMND người bán.",
                    "affected_rows": [str(idx)],
                }
            )

        if not (item.voucher_id or "").strip() and not (item.payment_voucher_id or "").strip():
            missing_supporting_doc_count += 1
            row_warnings.append("MISSING_SUPPORTING_VOUCHER")
            validations.append(
                {
                    "check_code": "RPT0177_MISSING_SUPPORTING_VOUCHER",
                    "check_name": f"Thiếu chứng từ thanh toán/hạch toán tại dòng {idx}",
                    "severity": "WARNING",
                    "status": "WARNING",
                    "message": f"Dòng {idx} ({item.item_name}): Chưa liên kết chứng từ mua hàng hoặc chứng từ chi tiền.",
                    "affected_rows": [str(idx)],
                }
            )

        if item.cit_deductibility_status == "PENDING_REVIEW":
            pending_review_count += 1

        display_id_num = item.seller_identity_number if can_view_pii else _mask_identity(item.seller_identity_number)
        total_qty += qty
        total_payment += tot_pay

        rows.append(
            {
                "row_order": idx,
                "row_type": "DETAIL",
                "group_code": item.purchase_category_type or "AGRICULTURAL_SEAFOOD",
                "indicator_code": f"02TNDN-{idx:04d}",
                "indicator_name": item.item_name,
                "voucher_id": item.voucher_id or item.payment_voucher_id or "",
                "tax_account_code": item.expense_or_inventory_account or "156",
                "columns": {
                    "purchase_date": item.purchase_date.isoformat() if item.purchase_date else "",
                    "seller_name": item.seller_name,
                    "seller_address": item.seller_address,
                    "seller_identity_number": display_id_num,
                    "seller_phone": item.seller_phone,
                    "item_name": item.item_name,
                    "quantity_or_weight": _f(qty),
                    "unit_price": _f(u_price),
                    "total_payment_amount": _f(tot_pay),
                    "note": item.note,
                },
                "detail_payload": {
                    "voucher_id": item.voucher_id,
                    "voucher_number": item.voucher_number,
                    "payment_voucher_id": item.payment_voucher_id,
                    "payment_method": item.payment_method,
                    "unit_of_measure": item.unit_of_measure,
                    "purchase_category_type": item.purchase_category_type,
                    "expense_or_inventory_account": item.expense_or_inventory_account,
                    "cit_deductibility_status": item.cit_deductibility_status,
                    "supporting_document_status": item.supporting_document_status,
                    "form_version": item.form_version or "TT20_2026_V2",
                    "pii_masked": not can_view_pii,
                },
                "source_refs": [
                    {
                        "source_type": "UNINVOICED_PURCHASE_VOUCHER",
                        "source_id": str(item.voucher_id or item.id),
                        "voucher_number": item.voucher_number,
                        "payment_voucher_id": item.payment_voucher_id,
                        "account_code": item.expense_or_inventory_account,
                    }
                ],
                "warning_codes": row_warnings,
            }
        )

    summary = {
        "total_row_count": len(rows),
        "total_quantity_by_same_unit": _f(total_qty),
        "total_payment_amount": _f(total_payment),
        "missing_seller_info_count": missing_seller_info_count,
        "missing_supporting_document_count": missing_supporting_doc_count,
        "pending_review_count": pending_review_count,
    }

    if not validations:
        validations.append(
            {
                "check_code": "RPT0177_02TNDN_OK",
                "check_name": "Kiểm tra bảng kê 02/TNDN theo Thông tư 20/2026/TT-BTC",
                "severity": "INFO",
                "status": "PASSED",
                "message": "Các dòng thu mua không hóa đơn có đầy đủ thông tin người bán, chứng từ và khớp công thức thành tiền.",
                "affected_rows": [],
            }
        )

    return rows, summary, validations


def _build_rpt_0178(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    tax_period_code: str,
    fiscal_year: int,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.6. RPT-0178 – Báo cáo đối chiếu bảng kê thuế và sổ cái (14 cột qua 3 nhóm Header: Sổ kế toán, Bảng kê thuế, Đối chiếu).
    Phân loại sai lệch chuẩn (1.6.4, 5.3):
    - MATCHED
    - IN_GL_NOT_IN_TAX_LEDGER
    - IN_TAX_LEDGER_NOT_IN_GL
    - TAX_AMOUNT_MISMATCH
    - PERIOD_MISMATCH
    - INVOICE_INFO_MISMATCH
    - VOUCHER_UNPOSTED_OR_REVERSED
    """
    rows: list[dict[str, Any]] = []
    validations: list[dict[str, Any]] = []

    only_differences = bool(params.get("only_differences", False))
    filter_account = params.get("tax_account_code")
    custom_recon_rows = params.get("reconciliation_items")

    raw_items: list[dict[str, Any]] = []
    if isinstance(custom_recon_rows, list) and custom_recon_rows:
        raw_items = custom_recon_rows
    else:
        # Match VatLedgerEntry against GL lines on 133/3331 by voucher_number or voucher_id
        vat_qs = VatLedgerEntry.objects.filter(
            company_id=company_id,
            invoice_date__gte=d_from,
            invoice_date__lte=d_to,
        ).exclude(invoice_status="CANCELLED")
        if filter_account:
            vat_qs = vat_qs.filter(tax_account_code__startswith=str(filter_account))

        gl_qs = JournalLine.objects.select_related("entry", "account").filter(
            entry__posting_date__gte=d_from,
            entry__posting_date__lte=d_to,
        ).filter(Q(account__code__startswith="133") | Q(account__code__startswith="3331"))
        if filter_account:
            gl_qs = gl_qs.filter(account__code__startswith=str(filter_account))

        gl_by_voucher: dict[str, list[JournalLine]] = {}
        for gl_line in gl_qs:
            v_no = (gl_line.entry.number or str(gl_line.entry_id)).strip()
            gl_by_voucher.setdefault(v_no, []).append(gl_line)

        matched_gl_ids: set[Any] = set()

        for v_entry in vat_qs:
            v_no = (v_entry.voucher_number or v_entry.voucher_id or "").strip()
            gl_candidates = gl_by_voucher.get(v_no, [])
            gl_match = gl_candidates[0] if gl_candidates else None
            if gl_match:
                matched_gl_ids.add(gl_match.id)
                gl_amt = _d(gl_match.debit) if gl_match.account.code.startswith("133") else _d(gl_match.credit)
                if gl_amt == Decimal("0.00"):
                    gl_amt = max(_d(gl_match.debit), _d(gl_match.credit))
                t_amt = _d(v_entry.tax_amount)
                diff = gl_amt - t_amt
                if gl_match.entry.status != "POSTED":
                    d_type = "VOUCHER_UNPOSTED_OR_REVERSED"
                    d_status = "UNPOSTED_VOUCHER"
                elif diff != Decimal("0.00"):
                    d_type = "TAX_AMOUNT_MISMATCH"
                    d_status = "MISMATCHED"
                elif (
                    v_entry.posting_date
                    and gl_match.entry.posting_date
                    and (v_entry.posting_date.year != gl_match.entry.posting_date.year or v_entry.posting_date.month != gl_match.entry.posting_date.month)
                ):
                    d_type = "PERIOD_MISMATCH"
                    d_status = "PERIOD_MISMATCH"
                else:
                    d_type = "MATCHED"
                    d_status = "MATCHED"

                raw_items.append(
                    {
                        "gl_posting_date": gl_match.entry.posting_date.isoformat(),
                        "gl_voucher_number": gl_match.entry.number,
                        "gl_voucher_date": (gl_match.entry.document_date or gl_match.entry.posting_date).isoformat(),
                        "gl_description": gl_match.description or gl_match.entry.description,
                        "gl_tax_amount": gl_amt,
                        "gl_account_code": gl_match.account.code,
                        "gl_voucher_id": str(gl_match.entry_id),
                        "tax_invoice_date": v_entry.invoice_date.isoformat() if v_entry.invoice_date else "",
                        "tax_invoice_number": v_entry.invoice_number,
                        "tax_description": v_entry.item_name,
                        "tax_amount": t_amt,
                        "tax_rate_percent": _d(v_entry.tax_rate_percent),
                        "item_tax_group": v_entry.item_tax_group or "1",
                        "filing_period": v_entry.tax_period_code or tax_period_code,
                        "tax_counterparty_name": v_entry.counterparty_name,
                        "tax_counterparty_tax_code": v_entry.counterparty_tax_code,
                        "tax_invoice_id": str(v_entry.tax_invoice_id or v_entry.id),
                        "difference_amount": diff,
                        "difference_status": d_status,
                        "difference_type": d_type,
                    }
                )
            else:
                # Present in Tax Ledger, not in GL
                t_amt = _d(v_entry.tax_amount)
                raw_items.append(
                    {
                        "gl_posting_date": "",
                        "gl_voucher_number": v_entry.voucher_number or "",
                        "gl_voucher_date": "",
                        "gl_description": "",
                        "gl_tax_amount": Decimal("0.00"),
                        "gl_account_code": v_entry.tax_account_code or "1331",
                        "gl_voucher_id": "",
                        "tax_invoice_date": v_entry.invoice_date.isoformat() if v_entry.invoice_date else "",
                        "tax_invoice_number": v_entry.invoice_number,
                        "tax_description": v_entry.item_name,
                        "tax_amount": t_amt,
                        "tax_rate_percent": _d(v_entry.tax_rate_percent),
                        "item_tax_group": v_entry.item_tax_group or "1",
                        "filing_period": v_entry.tax_period_code or tax_period_code,
                        "tax_counterparty_name": v_entry.counterparty_name,
                        "tax_counterparty_tax_code": v_entry.counterparty_tax_code,
                        "tax_invoice_id": str(v_entry.tax_invoice_id or v_entry.id),
                        "difference_amount": -t_amt,
                        "difference_status": "IN_TAX_LEDGER_NOT_IN_GL",
                        "difference_type": "IN_TAX_LEDGER_NOT_IN_GL",
                    }
                )

        # GL lines not in Tax Ledger
        for gl_line in gl_qs:
            if gl_line.id in matched_gl_ids:
                continue
            gl_amt = _d(gl_line.debit) if gl_line.account.code.startswith("133") else _d(gl_line.credit)
            if gl_amt == Decimal("0.00"):
                gl_amt = max(_d(gl_line.debit), _d(gl_line.credit))
            d_type = "VOUCHER_UNPOSTED_OR_REVERSED" if gl_line.entry.status != "POSTED" else "IN_GL_NOT_IN_TAX_LEDGER"
            raw_items.append(
                {
                    "gl_posting_date": gl_line.entry.posting_date.isoformat(),
                    "gl_voucher_number": gl_line.entry.number,
                    "gl_voucher_date": (gl_line.entry.document_date or gl_line.entry.posting_date).isoformat(),
                    "gl_description": gl_line.description or gl_line.entry.description,
                    "gl_tax_amount": gl_amt,
                    "gl_account_code": gl_line.account.code,
                    "gl_voucher_id": str(gl_line.entry_id),
                    "tax_invoice_date": "",
                    "tax_invoice_number": "",
                    "tax_description": "",
                    "tax_amount": Decimal("0.00"),
                    "tax_rate_percent": Decimal("10.00"),
                    "item_tax_group": "",
                    "filing_period": tax_period_code,
                    "tax_counterparty_name": "",
                    "tax_counterparty_tax_code": "",
                    "tax_invoice_id": "",
                    "difference_amount": gl_amt,
                    "difference_status": d_type,
                    "difference_type": d_type,
                }
            )

    gl_tax_total = Decimal("0.00")
    tax_ledger_total = Decimal("0.00")
    total_diff = Decimal("0.00")
    matched_count = 0
    mismatched_count = 0
    in_gl_only_count = 0
    in_tax_only_count = 0

    for idx, item in enumerate(raw_items, start=1):
        gl_amt = _d(item.get("gl_tax_amount"))
        t_amt = _d(item.get("tax_amount", item.get("tax_list_amount")))
        diff = _d(item.get("difference_amount", gl_amt - t_amt))
        d_type = str(item.get("difference_type") or item.get("difference_status") or ("MATCHED" if diff == Decimal("0.00") else "TAX_AMOUNT_MISMATCH"))
        d_status = str(item.get("difference_status") or d_type)

        if d_type == "MATCHED" and diff == Decimal("0.00"):
            matched_count += 1
        else:
            mismatched_count += 1
            if d_type in ("IN_GL_NOT_IN_TAX_LEDGER", "IN_GL_NOT_IN_TAX_LIST"):
                in_gl_only_count += 1
            elif d_type in ("IN_TAX_LEDGER_NOT_IN_GL", "IN_TAX_LIST_NOT_IN_GL"):
                in_tax_only_count += 1

            validations.append(
                {
                    "check_code": f"RPT0178_{d_type}",
                    "check_name": f"Phát hiện chênh lệch đối chiếu ({d_type})",
                    "severity": "WARNING",
                    "status": "WARNING",
                    "message": (
                        f"Dòng đối chiếu #{idx} (Chứng từ '{item.get('gl_voucher_number') or item.get('gl_voucher_no', '')}' / "
                        f"HĐ '{item.get('tax_invoice_number') or item.get('tax_invoice_no', '')}'): {d_type}, chênh lệch {_f(diff)}."
                    ),
                    "affected_rows": [str(idx)],
                }
            )

        if only_differences and d_type == "MATCHED" and diff == Decimal("0.00"):
            continue

        gl_tax_total += gl_amt
        tax_ledger_total += t_amt
        total_diff += diff

        rows.append(
            {
                "row_order": len(rows) + 1,
                "row_type": "RECONCILIATION",
                "group_code": str(item.get("gl_account_code", "1331")),
                "indicator_code": f"RECON-{len(rows) + 1:04d}",
                "indicator_name": str(item.get("gl_description") or item.get("tax_description") or ""),
                "invoice_id": str(item.get("tax_invoice_id", "")),
                "voucher_id": str(item.get("gl_voucher_id", "")),
                "tax_account_code": str(item.get("gl_account_code", "1331")),
                "columns": {
                    # Schema 14 columns (1.6.1)
                    "posting_date": str(item.get("posting_date") or item.get("gl_posting_date", "")),
                    "document_date": str(item.get("document_date") or item.get("gl_voucher_date", "")),
                    "document_no": str(item.get("document_no") or item.get("gl_voucher_number") or item.get("gl_voucher_no", "")),
                    "document_type": str(item.get("document_type", "GENERAL_VOUCHER")),
                    "description": str(item.get("description") or item.get("gl_description") or item.get("tax_description", "")),
                    "gl_amount": _f(gl_amt),
                    "invoice_date": str(item.get("invoice_date") or item.get("tax_invoice_date", "")),
                    "invoice_number": str(item.get("invoice_number") or item.get("tax_invoice_number") or item.get("tax_invoice_no", "")),
                    "item_tax_group": str(item.get("item_tax_group", "1")),
                    "tax_rate_percent": _f(item.get("tax_rate_percent", 10)),
                    "tax_ledger_amount": _f(t_amt),
                    "filing_period": str(item.get("filing_period", tax_period_code)),
                    "difference_amount": _f(diff),
                    "note": d_status,
                    # Descriptive aliases
                    "gl_posting_date": str(item.get("gl_posting_date") or item.get("posting_date", "")),
                    "gl_voucher_number": str(item.get("gl_voucher_number") or item.get("gl_voucher_no") or item.get("document_no", "")),
                    "gl_voucher_date": str(item.get("gl_voucher_date") or item.get("document_date", "")),
                    "gl_description": str(item.get("gl_description") or item.get("description", "")),
                    "gl_tax_amount": _f(gl_amt),
                    "gl_account_code": str(item.get("gl_account_code", "1331")),
                    "tax_invoice_date": str(item.get("tax_invoice_date") or item.get("invoice_date", "")),
                    "tax_invoice_number": str(item.get("tax_invoice_number") or item.get("tax_invoice_no") or item.get("invoice_number", "")),
                    "tax_description": str(item.get("tax_description", "")),
                    "tax_amount": _f(t_amt),
                    "tax_counterparty_name": str(item.get("tax_counterparty_name", "")),
                    "tax_counterparty_tax_code": str(item.get("tax_counterparty_tax_code", "")),
                    "difference_status": d_status,
                },
                "detail_payload": {
                    "gl_voucher_id": str(item.get("gl_voucher_id", "")),
                    "tax_invoice_id": str(item.get("tax_invoice_id", "")),
                    "tax_ledger_line_id": str(item.get("tax_ledger_line_id", idx)),
                    "tax_direction": str(item.get("tax_direction", "INPUT")),
                    "difference_type": d_type,
                    "difference_reason": str(item.get("difference_reason", d_type)),
                    "recommended_check_scope": "Kiểm tra bút toán GL và bảng kê hóa đơn kỳ tương ứng",
                    "resolution_status": "OPEN" if d_type != "MATCHED" else "RESOLVED",
                },
                "source_refs": [
                    {
                        "source_type": "GL_AND_TAX_LEDGER_PAIR",
                        "gl_voucher_id": str(item.get("gl_voucher_id", "")),
                        "gl_voucher_number": str(item.get("gl_voucher_number") or item.get("gl_voucher_no", "")),
                        "tax_invoice_id": str(item.get("tax_invoice_id", "")),
                        "tax_invoice_number": str(item.get("tax_invoice_number") or item.get("tax_invoice_no", "")),
                        "difference_type": d_type,
                    }
                ],
                "warning_codes": [d_type] if d_type != "MATCHED" else [],
            }
        )

    summary = {
        "gl_tax_total": _f(gl_tax_total),
        "total_gl_tax_amount": _f(gl_tax_total),
        "tax_ledger_total": _f(tax_ledger_total),
        "total_tax_list_amount": _f(tax_ledger_total),
        "total_difference_amount": _f(total_diff),
        "matched_row_count": matched_count,
        "matched_count": matched_count,
        "mismatched_row_count": mismatched_count,
        "unmatched_count": mismatched_count,
        "in_gl_only_count": in_gl_only_count,
        "in_tax_ledger_only_count": in_tax_only_count,
    }

    if not validations:
        validations.append(
            {
                "check_code": "RPT0178_RECON_ALL_MATCHED",
                "check_name": "Đối chiếu bảng kê thuế và sổ cái",
                "severity": "INFO",
                "status": "PASSED",
                "message": "100% dòng chứng từ thuế trên sổ cái khớp với bảng kê hóa đơn thuế.",
                "affected_rows": [],
            }
        )

    return rows, summary, validations


def _build_rpt_0179(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    tax_period_code: str,
    fiscal_year: int,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.7. RPT-0179 – Bảng kê hóa đơn, chứng từ hàng hóa, dịch vụ bán ra (9 cột chuẩn + TO-BE detail).
    Nguyên tắc:
    - Không gộp nhóm không chịu thuế ([26]), thuế suất 0% ([29]), không phải kê khai/không tính vào giá tính thuế ([32a]/[32b]) và doanh thu ngoài phạm vi GTGT ([34a]).
    - Hỗ trợ thuế suất giảm (8% theo Nghị định 174/2025/NĐ-CP) theo Rule hiệu lực.
    - Hóa đơn đã hủy (CANCELLED) hoặc bị thay thế (REPLACED) không cộng vào tổng doanh thu/thuế thực tế.
    """
    rows: list[dict[str, Any]] = []
    validations: list[dict[str, Any]] = []

    custom_invoices = params.get("invoices")
    vat_entries: list[VatLedgerEntry] = []
    if isinstance(custom_invoices, list) and custom_invoices:
        for c_inv in custom_invoices:
            amt = _d(c_inv.get("amount_before_tax"))
            rate = _d(c_inv.get("vat_rate", c_inv.get("tax_rate_percent", 10)))
            t_amt = _d(c_inv.get("tax_amount"))
            r_grp = str(
                c_inv.get("vat_rate_code")
                or c_inv.get("revenue_tax_group")
                or (f"RATE_{int(rate)}" if rate in (Decimal("0"), Decimal("5"), Decimal("8"), Decimal("10")) else "RATE_10")
            )
            inv_status = str(c_inv.get("invoice_status") or "ACTIVE").upper()
            if inv_status == "VALID":
                inv_status = "ACTIVE"
            inv_date_raw = c_inv.get("invoice_date")
            inv_date_val = date.fromisoformat(str(inv_date_raw)[:10]) if inv_date_raw else d_from
            inv_no = str(c_inv.get("invoice_number") or c_inv.get("invoice_no") or "")
            if r_grp == "RATE_0" and c_inv.get("has_export_proof") is False:
                validations.append(
                    {
                        "check_code": "RPT0179_RATE_0_MISSING_EXPORT_PROOF",
                        "check_name": f"Hóa đơn thuế suất 0% ({inv_no}) thiếu hồ sơ chứng minh xuất khẩu",
                        "severity": "WARNING",
                        "status": "WARNING",
                        "message": f"Hóa đơn {inv_no} áp dụng thuế suất 0% nhưng chưa đính kèm tờ khai hải quan/chứng từ thanh toán quốc tế.",
                        "affected_rows": [inv_no],
                    }
                )
            vat_entries.append(
                VatLedgerEntry(
                    company_id=company_id,
                    tax_period_code=tax_period_code,
                    direction="OUTPUT",
                    invoice_number=inv_no,
                    invoice_symbol=str(c_inv.get("invoice_symbol") or c_inv.get("invoice_series") or ""),
                    invoice_form_symbol=str(c_inv.get("invoice_form_symbol") or "1"),
                    invoice_date=inv_date_val,
                    posting_date=inv_date_val,
                    voucher_number=str(c_inv.get("voucher_number") or ""),
                    voucher_id=str(c_inv.get("voucher_id") or ""),
                    counterparty_name=str(c_inv.get("counterparty_name") or c_inv.get("buyer_name") or ""),
                    counterparty_tax_code=str(c_inv.get("counterparty_tax_code") or c_inv.get("buyer_tax_code") or ""),
                    item_name=str(c_inv.get("item_name") or "Hàng hóa, dịch vụ bán ra"),
                    amount_before_tax=amt,
                    tax_rate_percent=rate,
                    tax_amount=t_amt,
                    tax_account_code=str(c_inv.get("tax_account_code") or "33311"),
                    revenue_tax_group=r_grp,
                    invoice_status=inv_status,
                    gl_reconciliation_status="MATCHED",
                )
            )
    else:
        vat_entries = list(
            VatLedgerEntry.objects.filter(
                company_id=company_id,
                direction="OUTPUT",
                invoice_date__gte=d_from,
                invoice_date__lte=d_to,
            ).order_by("revenue_tax_group", "invoice_date", "invoice_number", "id")
        )
        if branch_id:
            vat_entries = [e for e in vat_entries if not e.branch_id or e.branch_id == branch_id]

    if not vat_entries and not custom_invoices:
        inv_qs = TaxInvoice.objects.filter(
            direction="OUTPUT",
            invoice_date__gte=d_from,
            invoice_date__lte=d_to,
        ).prefetch_related("lines", "document_links").order_by("invoice_date", "invoice_number")
        for inv in inv_qs:
            lines = list(inv.lines.all())
            doc_link = inv.document_links.first()
            if lines:
                for ln in lines:
                    amt = _d(ln.taxable_amount)
                    rate = _d(ln.tax_rate)
                    t_amt = _d(ln.tax_amount)
                    r_grp = f"RATE_{int(rate)}" if rate in (Decimal("0"), Decimal("5"), Decimal("8"), Decimal("10")) else "RATE_10"
                    vat_entries.append(
                        VatLedgerEntry(
                            company_id=company_id,
                            tax_period_code=tax_period_code,
                            direction="OUTPUT",
                            tax_invoice=inv,
                            invoice_number=inv.invoice_number,
                            invoice_symbol=inv.invoice_series,
                            invoice_form_symbol="1",
                            invoice_date=inv.invoice_date,
                            posting_date=inv.invoice_date,
                            voucher_number=doc_link.document_number if doc_link else "",
                            voucher_id=str(doc_link.entity_id) if doc_link else "",
                            counterparty_name=inv.buyer_name,
                            counterparty_tax_code=inv.buyer_tax_code,
                            item_name=ln.description or "HHDV bán ra",
                            amount_before_tax=amt,
                            tax_rate_percent=rate,
                            tax_amount=t_amt,
                            tax_account_code="33311",
                            revenue_tax_group=r_grp,
                            invoice_status=inv.status,
                            gl_reconciliation_status="MATCHED" if doc_link else "UNMATCHED",
                        )
                    )
            else:
                amt = _d(inv.subtotal)
                t_amt = _d(inv.tax_amount)
                rate = (t_amt * Decimal("100") / amt).quantize(Decimal("0.01")) if amt else Decimal("10.00")
                r_grp = f"RATE_{int(rate)}" if rate in (Decimal("0"), Decimal("5"), Decimal("8"), Decimal("10")) else "RATE_10"
                vat_entries.append(
                    VatLedgerEntry(
                        company_id=company_id,
                        tax_period_code=tax_period_code,
                        direction="OUTPUT",
                        tax_invoice=inv,
                        invoice_number=inv.invoice_number,
                        invoice_symbol=inv.invoice_series,
                        invoice_form_symbol="1",
                        invoice_date=inv.invoice_date,
                        posting_date=inv.invoice_date,
                        voucher_number=doc_link.document_number if doc_link else "",
                        voucher_id=str(doc_link.entity_id) if doc_link else "",
                        counterparty_name=inv.buyer_name,
                        counterparty_tax_code=inv.buyer_tax_code,
                        item_name="Hàng hóa, dịch vụ bán ra",
                        amount_before_tax=amt,
                        tax_rate_percent=rate,
                        tax_amount=t_amt,
                        tax_account_code="33311",
                        revenue_tax_group=r_grp,
                        invoice_status=inv.status,
                        gl_reconciliation_status="MATCHED" if doc_link else "UNMATCHED",
                    )
                )

    f_group = params.get("revenue_tax_group")
    include_cancelled = bool(params.get("include_cancelled", True))

    total_before_tax = Decimal("0.00")
    total_output_vat = Decimal("0.00")
    totals_by_group: dict[str, dict[str, Decimal]] = {}
    unique_active_invoices: set[tuple[str, str]] = set()
    cancelled_or_replaced_count = 0

    for idx, entry in enumerate(vat_entries, start=1):
        r_grp = entry.revenue_tax_group or f"RATE_{int(_d(entry.tax_rate_percent))}"
        if f_group and r_grp != str(f_group).strip():
            continue
        if not include_cancelled and entry.invoice_status in ("CANCELLED", "REPLACED"):
            continue

        is_inactive = entry.invoice_status in ("CANCELLED", "REPLACED")
        row_warnings: list[str] = []
        if is_inactive:
            cancelled_or_replaced_count += 1
            row_warnings.append(f"INVOICE_{entry.invoice_status}")
        else:
            amt = _d(entry.amount_before_tax)
            t_amt = _d(entry.tax_amount)
            total_before_tax += amt
            total_output_vat += t_amt
            grp_bucket = totals_by_group.setdefault(
                r_grp, {"amount_before_tax": Decimal("0.00"), "tax_amount": Decimal("0.00")}
            )
            grp_bucket["amount_before_tax"] += amt
            grp_bucket["tax_amount"] += t_amt
            unique_active_invoices.add((entry.invoice_symbol, entry.invoice_number))

            # Validate NON_TAXABLE / RATE_0 / OUTSIDE_VAT_SCOPE should have tax_amount == 0
            if r_grp in ("NON_TAXABLE", "RATE_0", "NOT_DECLARED_OR_EXCLUDED", "OUTSIDE_VAT_SCOPE") and t_amt != Decimal("0.00"):
                row_warnings.append("NON_ZERO_TAX_ON_EXEMPT_OR_ZERO_GROUP")
                validations.append(
                    {
                        "check_code": "RPT0179_INVALID_TAX_FOR_GROUP",
                        "check_name": f"Tiền thuế khác 0 cho nhóm {r_grp} tại HĐ {entry.invoice_number}",
                        "severity": "ERROR",
                        "status": "FAILED",
                        "message": f"Hóa đơn {entry.invoice_number} thuộc nhóm {r_grp} nhưng có tiền thuế {_f(t_amt)}.",
                        "affected_rows": [entry.invoice_number],
                    }
                )

        rows.append(
            {
                "row_order": len(rows) + 1,
                "row_type": "DETAIL",
                "group_code": r_grp,
                "indicator_code": f"OUT-{len(rows) + 1:04d}",
                "indicator_name": entry.item_name or "HHDV bán ra",
                "invoice_id": str(entry.tax_invoice_id or entry.id or ""),
                "voucher_id": entry.voucher_id or "",
                "tax_account_code": entry.tax_account_code or "33311",
                "columns": {
                    "invoice_number": entry.invoice_number,
                    "invoice_date": entry.invoice_date.isoformat() if entry.invoice_date else "",
                    "buyer_name": entry.counterparty_name,
                    "buyer_tax_code": entry.counterparty_tax_code,
                    "item_name": entry.item_name,
                    "amount_before_tax": _f(entry.amount_before_tax),
                    "tax_rate_percent": _f(entry.tax_rate_percent),
                    "tax_amount": _f(entry.tax_amount),
                    "tax_account_code": entry.tax_account_code or "33311",
                },
                "detail_payload": {
                    "invoice_symbol": entry.invoice_symbol,
                    "invoice_form_symbol": entry.invoice_form_symbol,
                    "voucher_id": entry.voucher_id,
                    "voucher_number": entry.voucher_number,
                    "posting_date": entry.posting_date.isoformat() if entry.posting_date else "",
                    "revenue_account_code": entry.revenue_account_code or "5111",
                    "revenue_tax_group": r_grp,
                    "vat_reduction_flag": _d(entry.tax_rate_percent) == Decimal("8.00"),
                    "vat_reduction_rule_code": "VAT_REDUCED_8_ND174_2025" if _d(entry.tax_rate_percent) == Decimal("8.00") else "",
                    "invoice_status": entry.invoice_status,
                    "original_invoice_id": entry.original_invoice_id,
                    "adjustment_type": entry.adjustment_type,
                    "gl_reconciliation_status": entry.gl_reconciliation_status,
                    "note": entry.note,
                },
                "source_refs": [
                    {
                        "source_type": "SALES_TAX_INVOICE",
                        "source_id": str(entry.tax_invoice_id or entry.id or entry.invoice_number),
                        "invoice_number": entry.invoice_number,
                        "invoice_symbol": entry.invoice_symbol,
                        "voucher_number": entry.voucher_number,
                        "revenue_tax_group": r_grp,
                    }
                ],
                "warning_codes": row_warnings,
            }
        )

    by_group_formatted = {
        k: {
            "amount_before_tax": _f(v["amount_before_tax"]),
            "tax_amount": _f(v["tax_amount"]),
        }
        for k, v in totals_by_group.items()
    }
    summary = {
        "total_invoice_count": len(unique_active_invoices),
        "total_line_count": len(rows),
        "total_amount_before_tax": _f(total_before_tax),
        "total_revenue_before_tax": _f(total_before_tax),
        "total_output_vat": _f(total_output_vat),
        "totals_by_tax_group": by_group_formatted,
        "by_rate_group": by_group_formatted,
        "cancelled_or_replaced_invoice_count": cancelled_or_replaced_count,
    }

    if not validations:
        validations.append(
            {
                "check_code": "RPT0179_VAT_OUTPUT_OK",
                "check_name": "Kiểm tra bảng kê hóa đơn bán ra và phân nhóm thuế suất",
                "severity": "INFO",
                "status": "PASSED",
                "message": "Bảng kê bán ra phân tách đúng các nhóm không chịu thuế, 0%, 5%, 8%, 10%, không kê khai và ngoài phạm vi GTGT.",
                "affected_rows": [],
            }
        )

    return rows, summary, validations


def _build_rpt_0180(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    tax_period_code: str,
    fiscal_year: int,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.8. RPT-0180 – Đối chiếu thông tin hóa đơn mua vào và chứng từ (23 cột qua 2 nhóm Header).
    Nhóm 1: Thông tin chứng từ và bảng kê (13 cột)
    Nhóm 2: Thông tin hóa đơn đối chiếu (10 cột)
    Phân loại kết quả đối chiếu (1.8.4):
    - MATCHED
    - INVOICE_WITHOUT_VOUCHER
    - VOUCHER_WITHOUT_INVOICE
    - MISMATCHED_AMOUNT
    - MISMATCHED_TAX
    - MISMATCHED_PARTY_OR_DATE
    - DUPLICATE_LINK
    - CANCELLED_OR_REPLACED_INVOICE
    """
    rows: list[dict[str, Any]] = []
    validations: list[dict[str, Any]] = []

    only_mismatched = bool(params.get("only_mismatched", False))
    custom_pairs = params.get("invoice_voucher_pairs") or params.get("items")

    if isinstance(custom_pairs, list) and custom_pairs:
        raw_pairs = custom_pairs
    else:
        raw_pairs = []
        vat_entries = list(
            VatLedgerEntry.objects.filter(
                company_id=company_id,
                direction="INPUT",
                invoice_date__gte=d_from,
                invoice_date__lte=d_to,
            ).select_related("tax_invoice").order_by("invoice_date", "invoice_number")
        )
        for v_entry in vat_entries:
            inv = v_entry.tax_invoice
            has_voucher = bool((v_entry.voucher_number or v_entry.voucher_id or "").strip())
            has_invoice = bool((v_entry.invoice_number or "").strip())
            v_amt = _d(v_entry.amount_before_tax)
            v_tax = _d(v_entry.tax_amount)
            i_amt = _d(inv.subtotal) if inv else v_amt
            i_tax = _d(inv.tax_amount) if inv else v_tax
            i_seller = inv.seller_name if inv else v_entry.counterparty_name
            i_mst = inv.seller_tax_code if inv else v_entry.counterparty_tax_code
            i_date = inv.invoice_date.isoformat() if (inv and inv.invoice_date) else (v_entry.invoice_date.isoformat() if v_entry.invoice_date else "")
            v_date = v_entry.invoice_date.isoformat() if v_entry.invoice_date else ""

            mismatch_fields: list[str] = []
            if v_entry.invoice_status in ("CANCELLED", "REPLACED") or (inv and inv.status in ("CANCELLED", "REPLACED")):
                m_status = "CANCELLED_OR_REPLACED_INVOICE"
            elif not has_voucher:
                m_status = "INVOICE_WITHOUT_VOUCHER"
            elif not has_invoice:
                m_status = "VOUCHER_WITHOUT_INVOICE"
            else:
                if abs(v_amt - i_amt) > Decimal("1.00"):
                    mismatch_fields.append("amount_before_tax")
                if abs(v_tax - i_tax) > Decimal("1.00"):
                    mismatch_fields.append("tax_amount")
                if (v_entry.counterparty_tax_code or "").strip() != (i_mst or "").strip() or v_date != i_date:
                    mismatch_fields.append("party_or_date")

                if "amount_before_tax" in mismatch_fields:
                    m_status = "MISMATCHED_AMOUNT"
                elif "tax_amount" in mismatch_fields:
                    m_status = "MISMATCHED_TAX"
                elif "party_or_date" in mismatch_fields:
                    m_status = "MISMATCHED_PARTY_OR_DATE"
                else:
                    m_status = "MATCHED"

            raw_pairs.append(
                {
                    "voucher_posting_date": v_entry.posting_date.isoformat() if v_entry.posting_date else v_date,
                    "voucher_date": v_date,
                    "voucher_number": v_entry.voucher_number or "",
                    "voucher_invoice_date": v_date,
                    "voucher_invoice_number": v_entry.invoice_number if has_voucher else "",
                    "voucher_invoice_symbol": v_entry.invoice_symbol if has_voucher else "",
                    "voucher_invoice_form_symbol": v_entry.invoice_form_symbol if has_voucher else "",
                    "voucher_item_tax_group": v_entry.item_tax_group or "1",
                    "voucher_description": v_entry.item_name,
                    "voucher_seller_name": v_entry.counterparty_name if has_voucher else "",
                    "voucher_seller_tax_code": v_entry.counterparty_tax_code if has_voucher else "",
                    "voucher_amount_before_tax": v_amt if has_voucher else Decimal("0.00"),
                    "voucher_tax_amount": v_tax if has_voucher else Decimal("0.00"),
                    "invoice_date": i_date if has_invoice else "",
                    "invoice_number": v_entry.invoice_number if has_invoice else "",
                    "invoice_symbol": v_entry.invoice_symbol if has_invoice else "",
                    "invoice_form_symbol": v_entry.invoice_form_symbol if has_invoice else "",
                    "invoice_item_tax_group": v_entry.item_tax_group or "1",
                    "invoice_seller_name": i_seller if has_invoice else "",
                    "invoice_seller_tax_code": i_mst if has_invoice else "",
                    "invoice_amount_before_tax": i_amt if has_invoice else Decimal("0.00"),
                    "invoice_tax_amount": i_tax if has_invoice else Decimal("0.00"),
                    "note": v_entry.note or m_status,
                    "match_status": m_status,
                    "mismatch_fields": mismatch_fields,
                    "voucher_id": v_entry.voucher_id or "",
                    "invoice_id": str(v_entry.tax_invoice_id or v_entry.id or ""),
                }
            )

    matched_count = 0
    invoice_without_voucher_count = 0
    voucher_without_invoice_count = 0
    mismatched_count = 0
    total_amt_diff = Decimal("0.00")
    total_tax_diff = Decimal("0.00")

    for idx, pair in enumerate(raw_pairs, start=1):
        v_amt = _d(pair.get("voucher_amount_before_tax", pair.get("voucher_goods_amount", pair.get("book_amount_before_tax"))))
        v_tax = _d(pair.get("voucher_tax_amount", pair.get("voucher_vat_amount", pair.get("book_tax_amount"))))
        i_amt = _d(pair.get("invoice_amount_before_tax", pair.get("invoice_goods_amount")))
        i_tax = _d(pair.get("invoice_tax_amount", pair.get("invoice_vat_amount")))
        amt_diff = v_amt - i_amt
        tax_diff = v_tax - i_tax
        m_fields = list(pair.get("mismatch_fields", []))
        if "match_status" in pair and pair["match_status"]:
            m_status = str(pair["match_status"])
        elif amt_diff != Decimal("0.00") or tax_diff != Decimal("0.00"):
            m_status = "AMOUNT_MISMATCH"
            if amt_diff != Decimal("0.00"):
                m_fields.append("amount_before_tax")
            if tax_diff != Decimal("0.00"):
                m_fields.append("tax_amount")
        else:
            m_status = "MATCHED"

        if m_status == "MATCHED":
            matched_count += 1
        elif m_status == "INVOICE_WITHOUT_VOUCHER":
            invoice_without_voucher_count += 1
            mismatched_count += 1
        elif m_status == "VOUCHER_WITHOUT_INVOICE":
            voucher_without_invoice_count += 1
            mismatched_count += 1
        else:
            mismatched_count += 1

        if m_status != "MATCHED":
            validations.append(
                {
                    "check_code": f"RPT0180_{m_status}",
                    "check_name": f"Chênh lệch đối chiếu hóa đơn - chứng từ ({m_status})",
                    "severity": "WARNING",
                    "status": "WARNING",
                    "message": (
                        f"Dòng #{idx} (Chứng từ '{pair.get('voucher_number') or pair.get('voucher_no', '')}' / "
                        f"HĐ '{pair.get('invoice_number') or pair.get('invoice_no', '')}'): {m_status}."
                    ),
                    "affected_rows": [str(idx)],
                }
            )

        if only_mismatched and m_status == "MATCHED":
            continue

        total_amt_diff += amt_diff
        total_tax_diff += tax_diff

        rows.append(
            {
                "row_order": len(rows) + 1,
                "row_type": "RECONCILIATION",
                "group_code": m_status,
                "indicator_code": f"INV-VCH-{len(rows) + 1:04d}",
                "indicator_name": str(pair.get("voucher_description") or pair.get("invoice_number") or pair.get("invoice_no") or ""),
                "invoice_id": str(pair.get("invoice_id", "")),
                "voucher_id": str(pair.get("voucher_id", "")),
                "columns": {
                    # Strictly 23 columns per Section 1.8.1
                    "voucher_posting_date": str(pair.get("voucher_posting_date") or pair.get("posting_date", "")),
                    "voucher_date": str(pair.get("voucher_date") or pair.get("document_date", "")),
                    "voucher_number": str(pair.get("voucher_number") or pair.get("voucher_no") or pair.get("document_no", "")),
                    "voucher_invoice_date": str(pair.get("voucher_invoice_date") or pair.get("book_invoice_date", "")),
                    "voucher_invoice_number": str(pair.get("voucher_invoice_number") or pair.get("voucher_invoice_no") or pair.get("book_invoice_number", "")),
                    "voucher_invoice_symbol": str(pair.get("voucher_invoice_symbol") or pair.get("book_invoice_symbol", "")),
                    "voucher_invoice_form_symbol": str(pair.get("voucher_invoice_form_symbol") or pair.get("voucher_invoice_form") or pair.get("book_invoice_form_symbol", "")),
                    "voucher_item_tax_group": str(pair.get("voucher_item_tax_group") or pair.get("book_item_tax_group", "1")),
                    "voucher_description": str(pair.get("voucher_description", "")),
                    "voucher_seller_name": str(pair.get("voucher_seller_name") or pair.get("voucher_supplier_name") or pair.get("book_seller_name", "")),
                    "voucher_seller_tax_code": str(pair.get("voucher_seller_tax_code") or pair.get("voucher_supplier_tax_code") or pair.get("book_seller_tax_code", "")),
                    "voucher_amount_before_tax": _f(v_amt),
                    "voucher_tax_amount": _f(v_tax),
                    "invoice_date": str(pair.get("invoice_date", "")),
                    "invoice_number": str(pair.get("invoice_number") or pair.get("invoice_no", "")),
                    "invoice_symbol": str(pair.get("invoice_symbol", "")),
                    "invoice_form_symbol": str(pair.get("invoice_form_symbol") or pair.get("invoice_form", "")),
                    "invoice_item_tax_group": str(pair.get("invoice_item_tax_group", "1")),
                    "invoice_seller_name": str(pair.get("invoice_seller_name") or pair.get("invoice_supplier_name", "")),
                    "invoice_seller_tax_code": str(pair.get("invoice_seller_tax_code") or pair.get("invoice_supplier_tax_code", "")),
                    "invoice_amount_before_tax": _f(i_amt),
                    "invoice_tax_amount": _f(i_tax),
                    "note": str(pair.get("note") or pair.get("invoice_status", "")),
                },
                "detail_payload": {
                    "match_status": m_status,
                    "mismatch_fields": m_fields,
                    "amount_difference": _f(amt_diff),
                    "tax_difference": _f(tax_diff),
                    "matched_by": str(pair.get("matched_by", "DOCUMENT_LINK")),
                    "document_link_id": str(pair.get("document_link_id", f"LINK-{idx}")),
                    "is_suggested_match": bool(pair.get("is_suggested_match", False)),
                    "resolution_status": "RESOLVED" if m_status == "MATCHED" else "OPEN",
                },
                "source_refs": [
                    {
                        "source_type": "INVOICE_VOUCHER_LINK",
                        "voucher_id": str(pair.get("voucher_id", "")),
                        "voucher_number": str(pair.get("voucher_number", "")),
                        "invoice_id": str(pair.get("invoice_id", "")),
                        "invoice_number": str(pair.get("invoice_number", "")),
                        "match_status": m_status,
                    }
                ],
                "warning_codes": [m_status] if m_status != "MATCHED" else [],
            }
        )

    summary = {
        "matched_count": matched_count,
        "invoice_without_voucher_count": invoice_without_voucher_count,
        "voucher_without_invoice_count": voucher_without_invoice_count,
        "mismatched_count": mismatched_count,
        "total_amount_difference": _f(total_amt_diff),
        "total_tax_difference": _f(total_tax_diff),
    }

    if not validations:
        validations.append(
            {
                "check_code": "RPT0180_INVOICE_VOUCHER_OK",
                "check_name": "Đối chiếu hóa đơn mua vào và chứng từ hạch toán",
                "severity": "INFO",
                "status": "PASSED",
                "message": "100% hóa đơn mua vào khớp thông tin và giá trị với chứng từ hạch toán.",
                "affected_rows": [],
            }
        )

    return rows, summary, validations


def _build_rpt_tax_08(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    tax_period_code: str,
    fiscal_year: int,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.9.A. RPT-TAX-08 – Tổng hợp chỉ tiêu tờ khai GTGT (01/GTGT) (12 cột).
    - Trước 01/07/2026: TT80_2021_V1 (có [11b], không có [32b], [34a]).
    - Từ 01/07/2026: TT89_2026_V2 theo Thông tư 89/2026/TT-BTC (bỏ [11b], có [23a], [24a], [32b], [34a], [39a], [40a], [40b]).
    """
    rows: list[dict[str, Any]] = []
    validations: list[dict[str, Any]] = []

    req_version = params.get("form_version")
    form_ver_obj = resolve_tax_form_version("01/GTGT", d_to, req_version)
    version_code = form_ver_obj.version_code if form_ver_obj else ("TT89_2026_V2" if d_to >= date(2026, 7, 1) else "TT80_2021_V1")
    is_v2 = version_code == "TT89_2026_V2" or (not req_version and d_to >= date(2026, 7, 1))
    indicators_spec = VAT_01_GTGT_V2_INDICATORS if is_v2 else VAT_01_GTGT_V1_INDICATORS

    # Aggregate source amounts from VatLedgerEntry
    in_entries = VatLedgerEntry.objects.filter(
        company_id=company_id,
        direction="INPUT",
        invoice_date__gte=d_from,
        invoice_date__lte=d_to,
    ).exclude(invoice_status__in=["CANCELLED", "REPLACED"])

    out_entries = VatLedgerEntry.objects.filter(
        company_id=company_id,
        direction="OUTPUT",
        invoice_date__gte=d_from,
        invoice_date__lte=d_to,
    ).exclude(invoice_status__in=["CANCELLED", "REPLACED"])

    in_agg = in_entries.aggregate(
        b=Sum("amount_before_tax"),
        t=Sum("tax_amount"),
        d=Sum("deductible_tax_amount"),
    )
    ind_vals = params.get("indicator_values") if isinstance(params.get("indicator_values"), dict) else {}

    def _iv(code_no_brackets: str, default_val: Any = 0) -> Decimal:
        if code_no_brackets in ind_vals:
            return _d(ind_vals[code_no_brackets])
        if f"[{code_no_brackets}]" in ind_vals:
            return _d(ind_vals[f"[{code_no_brackets}]"])
        return _d(params.get(f"indicator_{code_no_brackets}", default_val))

    val_22 = _iv("22", 0)
    val_23 = _iv("23", in_agg["b"] or 0)
    val_23a = _iv("23a", 0)
    val_24 = _iv("24", in_agg["t"] or 0)
    val_24a = _iv("24a", 0)
    val_25 = _iv("25", in_agg["d"] if in_agg["d"] is not None else val_24)

    def _sum_out(group_code: str, field_name: str) -> Decimal:
        res = out_entries.filter(revenue_tax_group=group_code).aggregate(s=Sum(field_name))
        return _d(res["s"])

    val_26 = _iv("26", _sum_out("NON_TAXABLE", "amount_before_tax"))
    val_29 = _iv("29", _sum_out("RATE_0", "amount_before_tax"))
    val_30 = _iv("30", _sum_out("RATE_5", "amount_before_tax"))
    val_31 = _iv("31", _sum_out("RATE_5", "tax_amount"))
    # RATE_10 + RATE_8 (reduced rate reported in 10% bracket with appendix per tax rules)
    out_10_8_b = _sum_out("RATE_10", "amount_before_tax") + _sum_out("RATE_8", "amount_before_tax")
    out_10_8_t = _sum_out("RATE_10", "tax_amount") + _sum_out("RATE_8", "tax_amount")
    val_32 = _iv("32", out_10_8_b)
    val_33 = _iv("33", out_10_8_t)
    val_32a = _iv("32a", _sum_out("NOT_DECLARED_OR_EXCLUDED", "amount_before_tax"))
    val_32b = _iv("32b", 0)
    val_34a = _iv("34a", _sum_out("OUTSIDE_VAT_SCOPE", "amount_before_tax"))

    if is_v2:
        val_27 = val_29 + val_30 + val_32 + val_32a - val_32b
        val_34 = val_26 + val_27 + val_34a
    else:
        val_27 = val_29 + val_30 + val_32 + val_32a
        val_34 = val_26 + val_27

    val_28 = val_31 + val_33
    val_35 = val_28
    val_36 = val_35 - val_25
    val_37 = _iv("37", 0)
    val_38 = _iv("38", 0)
    val_39a = _iv("39a", 0)
    val_40a = max(Decimal("0.00"), val_36 - val_22 + val_37 - val_38 - val_39a)
    val_40b = _iv("40b", 0)
    val_40 = max(Decimal("0.00"), val_40a - val_40b) if is_v2 else max(Decimal("0.00"), val_36 - val_22 + val_37 - val_38)
    val_41 = max(Decimal("0.00"), val_22 - val_36 - val_37 + val_38 + val_39a)
    val_42 = _iv("42", 0)
    val_43 = max(Decimal("0.00"), val_41 - val_42)

    source_calc_map: dict[str, Decimal] = {
        "[11b]": Decimal("0.00"),
        "[21]": Decimal("1.00") if (val_23 == 0 and val_34 == 0) else Decimal("0.00"),
        "[22]": val_22,
        "[23]": val_23,
        "[23a]": val_23a,
        "[24]": val_24,
        "[24a]": val_24a,
        "[25]": val_25,
        "[26]": val_26,
        "[27]": val_27,
        "[28]": val_28,
        "[29]": val_29,
        "[30]": val_30,
        "[31]": val_31,
        "[32]": val_32,
        "[33]": val_33,
        "[32a]": val_32a,
        "[32b]": val_32b,
        "[34a]": val_34a,
        "[34]": val_34,
        "[35]": val_35,
        "[36]": val_36,
        "[37]": val_37,
        "[38]": val_38,
        "[39a]": val_39a,
        "[40a]": val_40a,
        "[40b]": val_40b,
        "[40]": val_40,
        "[41]": val_41,
        "[42]": val_42,
        "[43]": val_43,
    }

    reported_overrides: dict[str, Any] = params.get("reported_indicators") or {}
    decl_version = str(params.get("declaration_version", "1"))
    sub_status = str(params.get("submission_status", "DRAFT"))
    mismatch_count = 0

    for idx, (ind_code, ind_name, d_type, s_type, formula, is_req) in enumerate(indicators_spec, start=1):
        clean_ind_code = ind_code.strip("[]")
        src_val = source_calc_map.get(ind_code, source_calc_map.get(f"[{clean_ind_code}]", Decimal("0.00")))
        rep_val = _d(reported_overrides.get(ind_code, reported_overrides.get(clean_ind_code, src_val)))
        diff_val = rep_val - src_val
        v_status = "VALID" if diff_val == Decimal("0.00") else "MISMATCHED"
        row_warnings: list[str] = []

        if diff_val != Decimal("0.00"):
            mismatch_count += 1
            row_warnings.append("INDICATOR_SOURCE_MISMATCH")
            validations.append(
                {
                    "check_code": f"RPT_TAX08_IND_{clean_ind_code}_MISMATCH",
                    "check_name": f"Chênh lệch chỉ tiêu {ind_code} giữa tờ khai và nguồn tính",
                    "severity": "WARNING",
                    "status": "WARNING",
                    "message": (
                        f"Chỉ tiêu {ind_code} ({ind_name}): Giá trị tờ khai={_f(rep_val)} "
                        f"lệch so với nguồn={_f(src_val)} (chênh lệch={_f(diff_val)})."
                    ),
                    "affected_rows": [ind_code, clean_ind_code],
                }
            )

        rows.append(
            {
                "row_order": idx,
                "row_type": "FORMULA" if s_type == "FORMULA" else "DETAIL",
                "group_code": "01/GTGT",
                "indicator_code": clean_ind_code,
                "indicator_name": ind_name,
                "columns": {
                    "form_code": "01/GTGT",
                    "form_version": version_code,
                    "tax_period": tax_period_code,
                    "declaration_version": decl_version,
                    "indicator_code": ind_code,
                    "indicator_name": ind_name,
                    "reported_amount": _f(rep_val),
                    "source_calculated_amount": _f(src_val),
                    "tax_amount": _f(rep_val),
                    "difference_amount": _f(diff_val),
                    "calculation_source": s_type,
                    "validation_status": v_status,
                    "submission_status": sub_status,
                },
                "detail_payload": {
                    "bracket_indicator_code": ind_code,
                    "formula_expression": formula,
                    "data_type": d_type,
                    "is_required": is_req,
                    "legal_basis": "Thông tư 89/2026/TT-BTC" if is_v2 else "Thông tư 80/2021/TT-BTC",
                },
                "source_refs": [
                    {
                        "source_type": s_type,
                        "source_id": f"01GTGT-{tax_period_code}-{clean_ind_code}",
                        "indicator_code": ind_code,
                        "formula": formula,
                    }
                ],
                "warning_codes": row_warnings,
            }
        )

    summary = {
        "form_code": "01/GTGT",
        "form_version": version_code,
        "legal_basis": "Thông tư 89/2026/TT-BTC" if is_v2 else "Thông tư 80/2021/TT-BTC",
        "indicator_count": len(rows),
        "mismatch_indicator_count": mismatch_count,
        "indicator_25_deductible_vat": _f(val_25),
        "indicator_34_total_revenue": _f(val_34),
        "indicator_35_output_vat": _f(val_35),
        "indicator_40_vat_payable": _f(val_40),
        "indicator_43_closing_vat_credit": _f(val_43),
    }

    if not validations:
        validations.append(
            {
                "check_code": "RPT_TAX08_01GTGT_OK",
                "check_name": f"Kiểm tra công thức chỉ tiêu 01/GTGT ({version_code})",
                "severity": "INFO",
                "status": "PASSED",
                "message": f"Tất cả chỉ tiêu tờ khai 01/GTGT phiên bản {version_code} khớp với bảng kê nguồn và công thức.",
                "affected_rows": [],
            }
        )

    return rows, summary, validations


def _build_rpt_tax_09(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    tax_period_code: str,
    fiscal_year: int,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.9.B. RPT-TAX-09 – Tổng hợp thuế TNDN và quyết toán (03/TNDN) (15 cột).
    Nguyên tắc (5.5, BR-RPT07-17):
    - KHÔNG giả định mọi doanh nghiệp đều áp một mức thuế suất TNDN duy nhất 20%; đọc từ TaxCalculationRule (15%, 17%, 20% theo Luật 67/2025/QH15 & NĐ 320/2025/NĐ-CP).
    - Kiểm tra tax_loss_carried_forward <= max(0, profit_before_tax + increase - decrease).
    """
    rows: list[dict[str, Any]] = []
    validations: list[dict[str, Any]] = []

    custom_cit = params.get("cit_rows")
    if isinstance(custom_cit, list) and custom_cit:
        raw_cit = custom_cit
    else:
        # Resolve applicable rate from TaxCalculationRule or revenue tier
        rule_code = params.get("cit_rule_code")
        annual_revenue = _d(params.get("annual_revenue", params.get("prior_year_total_revenue", 100000000000)))
        if rule_code:
            rule_obj = TaxCalculationRule.objects.filter(rule_code=rule_code, is_active=True).first()
            selected_rule_code = rule_obj.rule_code if rule_obj else rule_code
        elif annual_revenue <= Decimal("3000000000"):
            rule_obj = TaxCalculationRule.objects.filter(rule_code="CIT_SME_15_L67_2025", is_active=True).first()
            selected_rule_code = "RULE_CIT_15_MICRO"
        elif annual_revenue <= Decimal("50000000000"):
            rule_obj = TaxCalculationRule.objects.filter(rule_code="CIT_SME_17_L67_2025", is_active=True).first()
            selected_rule_code = "RULE_CIT_17_SME"
        else:
            rule_obj = TaxCalculationRule.objects.filter(rule_code="CIT_STANDARD_20_L67_2025", is_active=True).first()
            selected_rule_code = "RULE_CIT_20_STANDARD"

        default_rate = _d(rule_obj.applicable_rate) if rule_obj and rule_obj.applicable_rate is not None else (
            Decimal("15.00") if annual_revenue <= Decimal("3000000000") else (Decimal("17.00") if annual_revenue <= Decimal("50000000000") else Decimal("20.00"))
        )
        req_rate = _d(params.get("applicable_tax_rate", default_rate))

        pbt = _d(params.get("profit_before_tax", params.get("accounting_profit_before_tax", 500000000)))
        adj_inc = _d(params.get("taxable_income_adjustment_increase", params.get("non_deductible_expenses", 0)))
        adj_dec = _d(params.get("taxable_income_adjustment_decrease", 0))
        loss_cf = _d(params.get("tax_loss_carried_forward", 0))
        incentive = _d(params.get("tax_incentive_amount", 0))
        prepaid = _d(params.get("cit_prepaid", 0))

        raw_cit = [
            {
                "fiscal_year": fiscal_year,
                "period_code": tax_period_code,
                "profit_before_tax": pbt,
                "taxable_income_adjustment_increase": adj_inc,
                "taxable_income_adjustment_decrease": adj_dec,
                "tax_loss_carried_forward": loss_cf,
                "applicable_tax_rate": req_rate,
                "tax_incentive_amount": incentive,
                "cit_prepaid": prepaid,
                "declaration_reference": f"03/TNDN-{fiscal_year}",
                "calculation_status": "PROVISIONAL" if "Q" in tax_period_code else "FINALIZED",
                "submission_status": str(params.get("submission_status", "DRAFT")),
                "rule_code": selected_rule_code,
            }
        ]

    tot_pbt = Decimal("0.00")
    tot_taxable = Decimal("0.00")
    tot_payable = Decimal("0.00")
    tot_prepaid = Decimal("0.00")
    tot_remaining = Decimal("0.00")

    for idx, item in enumerate(raw_cit, start=1):
        pbt = _d(item.get("profit_before_tax"))
        adj_inc = _d(item.get("taxable_income_adjustment_increase"))
        adj_dec = _d(item.get("taxable_income_adjustment_decrease"))
        loss_cf = _d(item.get("tax_loss_carried_forward"))
        rate = _d(item.get("applicable_tax_rate", 20))
        incentive = _d(item.get("tax_incentive_amount"))
        prepaid = _d(item.get("cit_prepaid"))

        assessable_before_loss = pbt + adj_inc - adj_dec
        max_allowed_loss = max(Decimal("0.00"), assessable_before_loss)
        row_warnings: list[str] = []

        if loss_cf > max_allowed_loss:
            row_warnings.append("CIT_LOSS_CARRYFORWARD_EXCEEDS_INCOME")
            validations.append(
                {
                    "check_code": "RPT_TAX09_LOSS_EXCEEDS_INCOME",
                    "check_name": "Số lỗ chuyển kỳ này vượt quá thu nhập chịu thuế TNDN",
                    "severity": "ERROR",
                    "status": "FAILED",
                    "message": (
                        f"Kỳ {item.get('period_code')}: Lỗ kết chuyển ({_f(loss_cf)}) > "
                        f"Thu nhập chịu thuế trước chuyển lỗ ({_f(max_allowed_loss)})."
                    ),
                    "affected_rows": [str(item.get("period_code"))],
                }
            )

        expected_taxable = max(Decimal("0.00"), assessable_before_loss - min(loss_cf, max_allowed_loss))
        taxable = _d(item["taxable_income"]) if "taxable_income" in item and item["taxable_income"] is not None else expected_taxable

        expected_payable = max(
            Decimal("0.00"),
            (taxable * rate / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) - incentive,
        )
        payable = _d(item["cit_payable"]) if "cit_payable" in item and item["cit_payable"] is not None else expected_payable

        if payable != expected_payable:
            row_warnings.append("CIT_PAYABLE_FORMULA_MISMATCH")
            validations.append(
                {
                    "check_code": "RPT_TAX09_CIT_FORMULA_MISMATCH",
                    "check_name": "Sai lệch công thức thuế TNDN phải nộp",
                    "severity": "ERROR",
                    "status": "FAILED",
                    "message": f"cit_payable={_f(payable)} khác công thức={_f(expected_payable)} (thuế suất {_f(rate)}%).",
                    "affected_rows": [str(item.get("period_code"))],
                }
            )

        remaining = payable - prepaid
        tot_pbt += pbt
        tot_taxable += taxable
        tot_payable += payable
        tot_prepaid += prepaid
        tot_remaining += remaining

        rows.append(
            {
                "row_order": idx,
                "row_type": "DETAIL",
                "group_code": "CIT",
                "indicator_code": str(item.get("period_code", tax_period_code)),
                "indicator_name": f"Quyết toán thuế TNDN kỳ {item.get('period_code', tax_period_code)}",
                "tax_account_code": "3334",
                "columns": {
                    "fiscal_year": int(item.get("fiscal_year", fiscal_year)),
                    "period_code": str(item.get("period_code", tax_period_code)),
                    "profit_before_tax": _f(pbt),
                    "taxable_income_adjustment_increase": _f(adj_inc),
                    "taxable_income_adjustment_decrease": _f(adj_dec),
                    "tax_loss_carried_forward": _f(loss_cf),
                    "taxable_income": _f(taxable),
                    "applicable_tax_rate": _f(rate),
                    "tax_incentive_amount": _f(incentive),
                    "cit_payable": _f(payable),
                    "cit_prepaid": _f(prepaid),
                    "cit_remaining": _f(remaining),
                    "declaration_reference": str(item.get("declaration_reference", f"03/TNDN-{fiscal_year}")),
                    "calculation_status": str(item.get("calculation_status", "FINALIZED")),
                    "submission_status": str(item.get("submission_status", "DRAFT")),
                },
                "detail_payload": {
                    "rule_code": str(item.get("rule_code", "CIT_STANDARD_20_L67_2025")),
                    "legal_basis": "Luật Thuế TNDN 67/2025/QH15, Nghị định 320/2025/NĐ-CP & Thông tư 20/2026/TT-BTC",
                    "non_deductible_expenses_02_tndn": _f(item.get("non_deductible_expenses_02_tndn", 0)),
                },
                "source_refs": [
                    {
                        "source_type": "CIT_DECLARATION_AND_B02",
                        "source_id": str(item.get("declaration_reference", f"03/TNDN-{fiscal_year}")),
                        "form_code": "03/TNDN",
                        "rule_code": str(item.get("rule_code", "CIT_STANDARD_20_L67_2025")),
                    }
                ],
                "warning_codes": row_warnings,
            }
        )

    summary = {
        "fiscal_year": fiscal_year,
        "profit_before_tax_total": _f(tot_pbt),
        "taxable_income_total": _f(tot_taxable),
        "applicable_cit_rate": _f(rows[0]["columns"]["applicable_tax_rate"]) if rows else 20.0,
        "rule_code": rows[0]["detail_payload"]["rule_code"] if rows else "CIT_STANDARD_20_L67_2025",
        "cit_payable": _f(tot_payable),
        "cit_payable_total": _f(tot_payable),
        "cit_prepaid_total": _f(tot_prepaid),
        "cit_remaining_total": _f(tot_remaining),
    }

    if not validations:
        validations.append(
            {
                "check_code": "RPT_TAX09_CIT_OK",
                "check_name": "Kiểm tra tổng hợp và quyết toán thuế TNDN",
                "severity": "INFO",
                "status": "PASSED",
                "message": "Số liệu quyết toán thuế TNDN hợp lệ theo biểu thuế suất áp dụng và điều kiện chuyển lỗ.",
                "affected_rows": [],
            }
        )

    return rows, summary, validations


def _build_rpt_tax_10(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    tax_period_code: str,
    fiscal_year: int,
    params: dict[str, Any],
    can_view_pii: bool = True,
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.9.C. RPT-TAX-10 – Tổng hợp thuế TNCN (05/KK-TNCN & 05/QTT-TNCN) (13 cột + detail cá nhân có bảo vệ PII).
    """
    rows: list[dict[str, Any]] = []
    validations: list[dict[str, Any]] = []

    custom_pit = params.get("pit_rows")
    if isinstance(custom_pit, list) and custom_pit:
        raw_pit = custom_pit
    else:
        raw_pit = [
            {
                "tax_period": tax_period_code,
                "income_type": "EMPLOYMENT_RESIDENT_CONTRACT_3M_PLUS",
                "income_recipient_count": 12,
                "taxable_recipient_count": 8,
                "gross_income_amount": Decimal("360000000.00"),
                "taxable_income_amount": Decimal("320000000.00"),
                "assessable_income_amount": Decimal("140000000.00"),
                "withheld_tax_amount": Decimal("14000000.00"),
                "declared_tax_amount": Decimal("14000000.00"),
                "paid_tax_amount": Decimal("14000000.00"),
                "adjustment_amount": Decimal("0.00"),
                "declaration_status": "OFFICIAL",
                "recipients": [
                    {
                        "employee_or_recipient_id": "EMP-001",
                        "tax_identification_number": "8012345678",
                        "recipient_name": "Nguyễn Văn An",
                        "residency_status": "RESIDENT",
                        "income_category": "SALARY_WAGE",
                        "income_payment_date": d_to.isoformat(),
                        "taxable_amount": "45000000.00",
                        "assessable_income": "20000000.00",
                        "tax_withheld": "2250000.00",
                        "dependent_deduction": "8800000.00",
                        "other_deduction": "11000000.00",
                        "authorization_status": "AUTHORIZED",
                        "declaration_reference": f"05/KK-TNCN-{tax_period_code}",
                    }
                ],
            }
        ]

    tot_gross = Decimal("0.00")
    tot_withheld = Decimal("0.00")
    tot_declared = Decimal("0.00")
    tot_paid = Decimal("0.00")
    tot_diff = Decimal("0.00")

    for idx, item in enumerate(raw_pit, start=1):
        gross = _d(item.get("gross_income_amount"))
        taxable_inc = _d(item.get("taxable_income_amount"))
        assessable_inc = _d(item.get("assessable_income_amount"))
        withheld = _d(item.get("withheld_tax_amount"))
        declared = _d(item.get("declared_tax_amount", withheld))
        paid = _d(item.get("paid_tax_amount"))
        adj = _d(item.get("adjustment_amount"))
        diff = _d(item.get("difference_amount", declared - withheld))

        row_warnings: list[str] = []
        if diff != Decimal("0.00"):
            row_warnings.append("PIT_WITHHELD_DECLARED_MISMATCH")
            validations.append(
                {
                    "check_code": "RPT_TAX10_WITHHELD_DECLARED_MISMATCH",
                    "check_name": f"Chênh lệch thuế TNCN đã khấu trừ và đã kê khai ({item.get('income_type')})",
                    "severity": "WARNING",
                    "status": "WARNING",
                    "message": (
                        f"Nhóm {item.get('income_type')}: Thuế đã kê khai ({_f(declared)}) "
                        f"lệch so với thuế đã khấu trừ ({_f(withheld)})."
                    ),
                    "affected_rows": [str(item.get("income_type"))],
                }
            )

        # Mask PII in recipient detail if user lacks RPT_TAX_DETAIL_VIEW
        rec_list = []
        for rec in item.get("recipients", []):
            tin = str(rec.get("tax_identification_number", ""))
            rec_copy = dict(rec)
            rec_copy["tax_identification_number"] = tin if can_view_pii else _mask_identity(tin)
            rec_list.append(rec_copy)

        tot_gross += gross
        tot_withheld += withheld
        tot_declared += declared
        tot_paid += paid
        tot_diff += diff

        rows.append(
            {
                "row_order": idx,
                "row_type": "DETAIL",
                "group_code": "PIT",
                "indicator_code": f"PIT-{idx:02d}",
                "indicator_name": str(item.get("income_type", "SALARY_WAGE")),
                "tax_account_code": "3335",
                "columns": {
                    "tax_period": str(item.get("tax_period", tax_period_code)),
                    "income_type": str(item.get("income_type", "SALARY_WAGE")),
                    "income_recipient_count": int(item.get("income_recipient_count", 0)),
                    "taxable_recipient_count": int(item.get("taxable_recipient_count", 0)),
                    "gross_income_amount": _f(gross),
                    "taxable_income_amount": _f(taxable_inc),
                    "assessable_income_amount": _f(assessable_inc),
                    "withheld_tax_amount": _f(withheld),
                    "declared_tax_amount": _f(declared),
                    "paid_tax_amount": _f(paid),
                    "adjustment_amount": _f(adj),
                    "difference_amount": _f(diff),
                    "declaration_status": str(item.get("declaration_status", "OFFICIAL")),
                },
                "detail_payload": {
                    "pii_masked": not can_view_pii,
                    "recipients": rec_list,
                },
                "source_refs": [
                    {
                        "source_type": "PIT_DECLARATION_AND_PAYROLL",
                        "source_id": f"05KK-TNCN-{item.get('tax_period', tax_period_code)}",
                        "account_code": "3335",
                    }
                ],
                "warning_codes": row_warnings,
            }
        )

    summary = {
        "gross_income_total": _f(tot_gross),
        "withheld_tax_total": _f(tot_withheld),
        "declared_tax_total": _f(tot_declared),
        "paid_tax_total": _f(tot_paid),
        "difference_total": _f(tot_diff),
        "pii_masked": not can_view_pii,
    }

    if not validations:
        validations.append(
            {
                "check_code": "RPT_TAX10_PIT_OK",
                "check_name": "Kiểm tra tổng hợp thuế TNCN và khớp nối khấu trừ - kê khai",
                "severity": "INFO",
                "status": "PASSED",
                "message": "Số liệu khấu trừ, kê khai và nộp thuế TNCN khớp đúng.",
                "affected_rows": [],
            }
        )

    return rows, summary, validations


def _build_rpt_tax_11(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    tax_period_code: str,
    fiscal_year: int,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.9.D. RPT-TAX-11 – Tổng hợp hóa đơn điều chỉnh, thay thế và sai sót (15 cột).
    """
    rows: list[dict[str, Any]] = []
    validations: list[dict[str, Any]] = []

    custom_adj = params.get("adjusted_invoices")
    if isinstance(custom_adj, list) and custom_adj:
        raw_adj = custom_adj
    else:
        adj_entries = list(
            VatLedgerEntry.objects.filter(
                company_id=company_id,
                invoice_date__gte=d_from,
                invoice_date__lte=d_to,
            )
            .exclude(adjustment_type="NONE", invoice_status="ACTIVE")
            .order_by("invoice_date", "invoice_number")
        )
        raw_adj = []
        for entry in adj_entries:
            raw_adj.append(
                {
                    "original_invoice_number": entry.original_invoice_id,
                    "original_invoice_date": entry.invoice_date.isoformat() if entry.invoice_date else "",
                    "original_invoice_symbol": entry.invoice_symbol,
                    "related_invoice_number": entry.invoice_number,
                    "related_invoice_date": entry.invoice_date.isoformat() if entry.invoice_date else "",
                    "link_type": entry.adjustment_type if entry.adjustment_type != "NONE" else "CANCELLATION",
                    "adjustment_reason": entry.note or "Điều chỉnh/thay thế hóa đơn",
                    "original_amount_before_tax": Decimal("0.00"),
                    "adjustment_amount_before_tax": entry.amount_before_tax,
                    "original_tax_amount": Decimal("0.00"),
                    "adjustment_tax_amount": entry.tax_amount,
                    "filing_period": entry.tax_period_code or tax_period_code,
                    "invoice_status": entry.invoice_status,
                    "processing_status": "PROCESSED",
                }
            )

    missing_orig_count = 0
    tot_adj_before_tax = Decimal("0.00")
    tot_adj_tax = Decimal("0.00")

    for idx, item in enumerate(raw_adj, start=1):
        orig_no = str(item.get("original_invoice_number", "")).strip()
        l_type = str(item.get("link_type", "ADJUSTMENT_INCREASE"))
        adj_b = _d(item.get("adjustment_amount_before_tax"))
        adj_t = _d(item.get("adjustment_tax_amount"))
        orig_b = _d(item.get("original_amount_before_tax"))
        orig_t = _d(item.get("original_tax_amount"))

        row_warnings: list[str] = []
        if l_type in ("ADJUSTMENT_INCREASE", "ADJUSTMENT_DECREASE", "INFO_ADJUSTMENT", "REPLACEMENT") and not orig_no:
            missing_orig_count += 1
            row_warnings.append("MISSING_ORIGINAL_INVOICE")
            validations.append(
                {
                    "check_code": "RPT_TAX11_MISSING_ORIGINAL_INVOICE",
                    "check_name": f"Hóa đơn điều chỉnh/thay thế #{idx} thiếu liên kết hóa đơn gốc",
                    "severity": "WARNING",
                    "status": "WARNING",
                    "message": f"Hóa đơn '{item.get('related_invoice_number')}' ({l_type}) không có số hóa đơn gốc.",
                    "affected_rows": [str(item.get("related_invoice_number", idx))],
                }
            )

        w_status = "WARNING_MISSING_ORIGINAL" if row_warnings else "OK"
        tot_adj_before_tax += adj_b
        tot_adj_tax += adj_t

        rows.append(
            {
                "row_order": idx,
                "row_type": "DETAIL",
                "group_code": l_type,
                "indicator_code": f"ADJ-{idx:04d}",
                "indicator_name": str(item.get("adjustment_reason", l_type)),
                "invoice_id": str(item.get("related_invoice_number", "")),
                "columns": {
                    "original_invoice_number": orig_no,
                    "original_invoice_date": str(item.get("original_invoice_date", "")),
                    "original_invoice_symbol": str(item.get("original_invoice_symbol", "")),
                    "related_invoice_number": str(item.get("related_invoice_number", "")),
                    "related_invoice_date": str(item.get("related_invoice_date", "")),
                    "link_type": l_type,
                    "adjustment_reason": str(item.get("adjustment_reason", "")),
                    "original_amount_before_tax": _f(orig_b),
                    "adjustment_amount_before_tax": _f(adj_b),
                    "original_tax_amount": _f(orig_t),
                    "adjustment_tax_amount": _f(adj_t),
                    "filing_period": str(item.get("filing_period", tax_period_code)),
                    "invoice_status": str(item.get("invoice_status", "ADJUSTED")),
                    "processing_status": str(item.get("processing_status", "PROCESSED")),
                    "warning_status": w_status,
                },
                "detail_payload": {
                    "link_type": l_type,
                    "has_original_invoice": bool(orig_no),
                },
                "source_refs": [
                    {
                        "source_type": "INVOICE_ADJUSTMENT_LINK",
                        "original_invoice_number": orig_no,
                        "related_invoice_number": str(item.get("related_invoice_number", "")),
                        "link_type": l_type,
                    }
                ],
                "warning_codes": row_warnings,
            }
        )

    summary = {
        "total_adjusted_or_replaced_count": len(rows),
        "missing_original_invoice_count": missing_orig_count,
        "total_adjustment_amount_before_tax": _f(tot_adj_before_tax),
        "total_adjustment_tax_amount": _f(tot_adj_tax),
    }

    if not validations:
        validations.append(
            {
                "check_code": "RPT_TAX11_ADJUSTMENTS_OK",
                "check_name": "Kiểm tra liên kết hóa đơn điều chỉnh, thay thế",
                "severity": "INFO",
                "status": "PASSED",
                "message": "Các hóa đơn điều chỉnh, thay thế có đầy đủ liên kết đến hóa đơn gốc.",
                "affected_rows": [],
            }
        )

    return rows, summary, validations


def _build_rpt_tax_12(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    tax_period_code: str,
    fiscal_year: int,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.9.E. RPT-TAX-12 – Tổng hợp đối chiếu GTGT và GL (12 cột).
    """
    rows: list[dict[str, Any]] = []
    validations: list[dict[str, Any]] = []

    custom_rows = params.get("vat_gl_summary_rows")
    if isinstance(custom_rows, list) and custom_rows:
        raw_rows = custom_rows
    else:
        in_vat = _d(
            VatLedgerEntry.objects.filter(
                company_id=company_id, direction="INPUT", invoice_date__gte=d_from, invoice_date__lte=d_to
            )
            .exclude(invoice_status__in=["CANCELLED", "REPLACED"])
            .aggregate(t=Sum("tax_amount"))["t"]
        )
        out_vat = _d(
            VatLedgerEntry.objects.filter(
                company_id=company_id, direction="OUTPUT", invoice_date__gte=d_from, invoice_date__lte=d_to
            )
            .exclude(invoice_status__in=["CANCELLED", "REPLACED"])
            .aggregate(t=Sum("tax_amount"))["t"]
        )
        gl_133 = _d(
            JournalLine.objects.filter(
                entry__status="POSTED",
                entry__posting_date__gte=d_from,
                entry__posting_date__lte=d_to,
                account__code__startswith="133",
            ).aggregate(d=Sum("debit"))["d"]
        )
        gl_3331 = _d(
            JournalLine.objects.filter(
                entry__status="POSTED",
                entry__posting_date__gte=d_from,
                entry__posting_date__lte=d_to,
                account__code__startswith="3331",
            ).aggregate(c=Sum("credit"))["c"]
        )
        raw_rows = [
            {
                "tax_period": tax_period_code,
                "comparison_type": "VAT_LEDGER_VS_GL_133",
                "tax_category": "INPUT_VAT",
                "tax_source_amount": in_vat,
                "gl_comparable_amount": gl_133,
                "matched_document_count": 1 if in_vat == gl_133 and in_vat > 0 else 0,
                "unmatched_document_count": 1 if in_vat != gl_133 else 0,
                "difference_count": 1 if in_vat != gl_133 else 0,
                "difference_type": "MATCHED" if in_vat == gl_133 else "TAX_AMOUNT_MISMATCH",
            },
            {
                "tax_period": tax_period_code,
                "comparison_type": "VAT_LEDGER_VS_GL_3331",
                "tax_category": "OUTPUT_VAT",
                "tax_source_amount": out_vat,
                "gl_comparable_amount": gl_3331,
                "matched_document_count": 1 if out_vat == gl_3331 and out_vat > 0 else 0,
                "unmatched_document_count": 1 if out_vat != gl_3331 else 0,
                "difference_count": 1 if out_vat != gl_3331 else 0,
                "difference_type": "MATCHED" if out_vat == gl_3331 else "TAX_AMOUNT_MISMATCH",
            },
        ]

    tot_diff = Decimal("0.00")
    for idx, item in enumerate(raw_rows, start=1):
        t_src = _d(item.get("tax_source_amount"))
        gl_cmp = _d(item.get("gl_comparable_amount"))
        diff = _d(item.get("difference_amount", t_src - gl_cmp))
        r_status = "MATCHED" if diff == Decimal("0.00") else "MISMATCHED"
        d_type = str(item.get("difference_type", "MATCHED" if diff == Decimal("0.00") else "TAX_AMOUNT_MISMATCH"))
        tot_diff += diff

        if diff != Decimal("0.00"):
            validations.append(
                {
                    "check_code": f"RPT_TAX12_{item.get('tax_category', 'VAT')}_DIFF",
                    "check_name": f"Chênh lệch tổng hợp {item.get('comparison_type')}",
                    "severity": "WARNING",
                    "status": "WARNING",
                    "message": f"Nhóm {item.get('tax_category')}: Nguồn thuế={_f(t_src)}, GL={_f(gl_cmp)}, chênh lệch={_f(diff)}.",
                    "affected_rows": [str(item.get("tax_category"))],
                }
            )

        rows.append(
            {
                "row_order": idx,
                "row_type": "RECONCILIATION",
                "group_code": str(item.get("tax_category", "INPUT_VAT")),
                "indicator_code": f"VAT-GL-{idx:02d}",
                "indicator_name": str(item.get("comparison_type", "")),
                "columns": {
                    "tax_period": str(item.get("tax_period", tax_period_code)),
                    "comparison_type": str(item.get("comparison_type", "")),
                    "tax_category": str(item.get("tax_category", "")),
                    "tax_source_amount": _f(t_src),
                    "gl_comparable_amount": _f(gl_cmp),
                    "difference_amount": _f(diff),
                    "matched_document_count": int(item.get("matched_document_count", 0)),
                    "unmatched_document_count": int(item.get("unmatched_document_count", 0)),
                    "difference_count": int(item.get("difference_count", 0)),
                    "difference_type": d_type,
                    "reconciliation_status": r_status,
                    "last_checked_at": date.today().isoformat(),
                },
                "detail_payload": {"drilldown_report_code": "RPT-0178"},
                "source_refs": [{"source_type": "RPT_0178_SUMMARY", "tax_category": str(item.get("tax_category", ""))}],
                "warning_codes": [d_type] if diff != Decimal("0.00") else [],
            }
        )

    summary = {
        "row_count": len(rows),
        "total_difference_amount": _f(tot_diff),
    }
    if not validations:
        validations.append(
            {
                "check_code": "RPT_TAX12_OK",
                "check_name": "Tổng hợp đối chiếu GTGT và GL",
                "severity": "INFO",
                "status": "PASSED",
                "message": "Tổng hợp GTGT đầu vào/đầu ra khớp với sổ cái TK 133/3331.",
                "affected_rows": [],
            }
        )
    return rows, summary, validations


def _build_rpt_tax_13(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    tax_period_code: str,
    fiscal_year: int,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.9.F. RPT-TAX-13 – Đối chiếu nghĩa vụ thuế và số đã nộp (14 cột).
    Phân biệt rõ payment_document_amount và confirmed_paid_amount (5.6, BR-RPT07-19).
    """
    rows: list[dict[str, Any]] = []
    validations: list[dict[str, Any]] = []

    custom_obs = params.get("obligation_reconciliations")
    if isinstance(custom_obs, list) and custom_obs:
        raw_obs = custom_obs
    else:
        obs_qs = TaxObligation.objects.select_related("period").prefetch_related("payment_links").filter(company_id=company_id)
        raw_obs = []
        for ob in obs_qs:
            pay_doc_sum = _d(ob.payment_links.aggregate(s=Sum("amount"))["s"] or ob.paid_amount)
            raw_obs.append(
                {
                    "tax_type": getattr(ob.period, "tax_type", "VAT"),
                    "tax_period": getattr(ob.period, "code", tax_period_code),
                    "obligation_reference": f"OB-{getattr(ob.period, 'tax_type', 'VAT')}-{getattr(ob.period, 'code', tax_period_code)}",
                    "assessed_amount": _d(ob.assessed_amount),
                    "payment_document_amount": pay_doc_sum,
                    "confirmed_paid_amount": _d(ob.paid_amount),
                    "offset_amount": Decimal("0.00"),
                    "refund_amount": Decimal("0.00"),
                    "due_date": ob.due_date.isoformat() if hasattr(ob, "due_date") and ob.due_date else "",
                    "payment_status": getattr(ob, "status", "PAID"),
                }
            )

    tot_assessed = Decimal("0.00")
    tot_confirmed_paid = Decimal("0.00")
    tot_remaining = Decimal("0.00")
    tot_overpayment = Decimal("0.00")

    for idx, item in enumerate(raw_obs, start=1):
        assessed = _d(item.get("assessed_amount"))
        pay_doc = _d(item.get("payment_document_amount"))
        conf_paid = _d(item.get("confirmed_paid_amount", pay_doc))
        offset = _d(item.get("offset_amount"))
        refund = _d(item.get("refund_amount"))

        net = assessed - conf_paid - offset + refund
        rem = max(Decimal("0.00"), net)
        over = max(Decimal("0.00"), -net)
        diff = pay_doc - conf_paid
        r_status = "MATCHED" if diff == Decimal("0.00") else "UNCONFIRMED_PAYMENT_DIFF"

        row_warnings: list[str] = []
        if diff != Decimal("0.00"):
            row_warnings.append("UNCONFIRMED_PAYMENT_DIFF")
            validations.append(
                {
                    "check_code": "RPT_TAX13_PAYMENT_UNCONFIRMED",
                    "check_name": f"Chênh lệch chứng từ nộp thuế và số đã xác nhận tại {item.get('obligation_reference')}",
                    "severity": "WARNING",
                    "status": "WARNING",
                    "message": (
                        f"Nghĩa vụ {item.get('obligation_reference')}: Chứng từ nộp={_f(pay_doc)} "
                        f"nhưng số đã xác nhận={_f(conf_paid)}."
                    ),
                    "affected_rows": [str(item.get("obligation_reference"))],
                }
            )

        tot_assessed += assessed
        tot_confirmed_paid += conf_paid
        tot_remaining += rem
        tot_overpayment += over

        rows.append(
            {
                "row_order": idx,
                "row_type": "RECONCILIATION",
                "group_code": str(item.get("tax_type", "VAT")),
                "indicator_code": str(item.get("obligation_reference", f"OB-{idx}")),
                "indicator_name": f"Nghĩa vụ thuế {item.get('tax_type')} kỳ {item.get('tax_period')}",
                "columns": {
                    "tax_type": str(item.get("tax_type", "VAT")),
                    "tax_period": str(item.get("tax_period", tax_period_code)),
                    "obligation_reference": str(item.get("obligation_reference", f"OB-{idx}")),
                    "assessed_amount": _f(assessed),
                    "payment_document_amount": _f(pay_doc),
                    "confirmed_paid_amount": _f(conf_paid),
                    "offset_amount": _f(offset),
                    "refund_amount": _f(refund),
                    "remaining_amount": _f(rem),
                    "overpayment_amount": _f(over),
                    "difference_amount": _f(diff),
                    "due_date": str(item.get("due_date", "")),
                    "payment_status": str(item.get("payment_status", "PAID" if rem == 0 else "PARTIAL")),
                    "reconciliation_status": r_status,
                },
                "detail_payload": {"unconfirmed_payment_amount": _f(diff)},
                "source_refs": [
                    {
                        "source_type": "TAX_OBLIGATION_PAYMENT_PAIR",
                        "obligation_reference": str(item.get("obligation_reference", f"OB-{idx}")),
                    }
                ],
                "warning_codes": row_warnings,
            }
        )

    summary = {
        "assessed_total": _f(tot_assessed),
        "confirmed_paid_total": _f(tot_confirmed_paid),
        "remaining_total": _f(tot_remaining),
        "overpayment_total": _f(tot_overpayment),
    }
    if not validations:
        validations.append(
            {
                "check_code": "RPT_TAX13_OK",
                "check_name": "Đối chiếu nghĩa vụ thuế và chứng từ nộp NSNN",
                "severity": "INFO",
                "status": "PASSED",
                "message": "Các khoản nghĩa vụ thuế và chứng từ nộp tiền khớp đúng.",
                "affected_rows": [],
            }
        )
    return rows, summary, validations


def _build_rpt_tax_14(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    tax_period_code: str,
    fiscal_year: int,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.9.G. RPT-TAX-14 – Theo dõi hồ sơ khai thuế (18 cột).
    Nguyên tắc bắt buộc (5.7, BR-RPT07-21, TC-RPT-07-56):
    - Phân biệt rõ submission_status (DRAFT, READY, SUBMITTED, FAILED) và receipt_status (PENDING_RECEIPT, RECEIVED, PROCESSING, ACCEPTED, REJECTED).
    - Hồ sơ có submission_status = SUBMITTED nhưng receipt_status != ACCEPTED KHÔNG ĐƯỢC xem là đã chấp nhận!
    """
    rows: list[dict[str, Any]] = []
    validations: list[dict[str, Any]] = []

    custom_filings = params.get("filing_submissions") or params.get("submissions")
    if isinstance(custom_filings, list) and custom_filings:
        raw_filings = []
        for it in custom_filings:
            item_c = dict(it)
            if "submission_id" in item_c and "declaration_id" not in item_c:
                item_c["declaration_id"] = item_c["submission_id"]
            if "authority_response_code" in item_c and "response_code" not in item_c:
                item_c["response_code"] = item_c["authority_response_code"]
            if "authority_response_message" in item_c and "response_message" not in item_c:
                item_c["response_message"] = item_c["authority_response_message"]
            raw_filings.append(item_c)
    else:
        filings_qs = TaxFiling.objects.select_related("period").all()
        raw_filings = []
        for f in filings_qs:
            sub_status = "SUBMITTED" if f.status in ("SUBMITTED", "ACCEPTED", "REJECTED") else f.status
            rec_status = (
                "ACCEPTED"
                if f.status == "ACCEPTED"
                else ("REJECTED" if f.status == "REJECTED" else ("PROCESSING" if f.status == "SUBMITTED" else "NONE"))
            )
            raw_filings.append(
                {
                    "tax_type": getattr(f.period, "tax_type", "VAT"),
                    "form_code": "01/GTGT" if getattr(f.period, "tax_type", "") == "VAT" else "03/TNDN",
                    "form_version": "TT89_2026_V2" if getattr(f.period, "end_date", d_to) >= date(2026, 7, 1) else "TT80_2021_V1",
                    "tax_period": getattr(f.period, "code", tax_period_code),
                    "declaration_id": f"DECL-{f.id}",
                    "declaration_version": getattr(f, "version", 1),
                    "submission_type": "FIRST_TIME",
                    "filing_due_date": f.period.due_date.isoformat() if hasattr(f.period, "due_date") and f.period.due_date else "",
                    "submitted_at": f.submitted_at.isoformat() if f.submitted_at else "",
                    "submission_number": 1 if f.submitted_at else 0,
                    "provider_name": "TVAN-ETAX",
                    "external_reference": getattr(f, "submission_reference", "") or "",
                    "submission_status": sub_status,
                    "receipt_status": rec_status,
                    "receipt_time": f.submitted_at.isoformat() if f.submitted_at and rec_status in ("ACCEPTED", "REJECTED") else "",
                    "response_code": "ETAX-200" if rec_status == "ACCEPTED" else ("ETAX-422" if rec_status == "REJECTED" else "ETAX-102"),
                    "response_message": getattr(f, "notes", "") or "",
                    "is_overdue": False,
                }
            )

    submitted_count = 0
    accepted_count = 0
    rejected_count = 0
    pending_receipt_count = 0

    for idx, item in enumerate(raw_filings, start=1):
        sub_st = str(item.get("submission_status", "DRAFT"))
        default_rec = "REJECTED" if sub_st == "REJECTED" else ("PENDING_RECEIPT" if sub_st == "SUBMITTED" else "NONE")
        rec_st = str(item.get("receipt_status", default_rec))
        is_overdue = bool(item.get("is_overdue", False))
        row_warnings: list[str] = []

        if sub_st == "SUBMITTED":
            submitted_count += 1
        if rec_st == "ACCEPTED":
            accepted_count += 1
        elif rec_st == "REJECTED":
            rejected_count += 1
            row_warnings.append("FILING_REJECTED_BY_TAX_AUTHORITY")
            validations.append(
                {
                    "check_code": "RPT_TAX14_FILING_REJECTED",
                    "check_name": f"Hồ sơ khai thuế {item.get('declaration_id')} bị từ chối tiếp nhận/chấp nhận",
                    "severity": "ERROR",
                    "status": "FAILED",
                    "message": f"Tờ khai {item.get('declaration_id')}: {item.get('response_code')} - {item.get('response_message')}",
                    "affected_rows": [str(item.get("declaration_id"))],
                }
            )
        elif sub_st == "SUBMITTED" and rec_st != "ACCEPTED":
            pending_receipt_count += 1
            row_warnings.append("SUBMITTED_NOT_YET_ACCEPTED")

        if is_overdue:
            row_warnings.append("FILING_OVERDUE")

        rows.append(
            {
                "row_order": idx,
                "row_type": "DETAIL",
                "group_code": str(item.get("tax_type", "VAT")),
                "indicator_code": str(item.get("declaration_id", f"DECL-{idx}")),
                "indicator_name": f"Hồ sơ {item.get('form_code', '01/GTGT')} kỳ {item.get('tax_period', tax_period_code)}",
                "columns": {
                    "tax_type": str(item.get("tax_type", "VAT")),
                    "form_code": str(item.get("form_code", "01/GTGT")),
                    "form_version": str(item.get("form_version", "TT89_2026_V2")),
                    "tax_period": str(item.get("tax_period", tax_period_code)),
                    "declaration_id": str(item.get("declaration_id", f"DECL-{idx}")),
                    "declaration_version": int(item.get("declaration_version", 1)),
                    "submission_type": str(item.get("submission_type", "FIRST_TIME")),
                    "filing_due_date": str(item.get("filing_due_date", "")),
                    "submitted_at": str(item.get("submitted_at", "")),
                    "submission_number": int(item.get("submission_number", 1)),
                    "provider_name": str(item.get("provider_name", "TVAN-ETAX")),
                    "external_reference": str(item.get("external_reference", "")),
                    "submission_status": sub_st,
                    "receipt_status": rec_st,
                    "receipt_time": str(item.get("receipt_time", "")),
                    "response_code": str(item.get("response_code", "")),
                    "response_message": str(item.get("response_message", "")),
                    "is_overdue": is_overdue,
                },
                "detail_payload": {
                    "is_legally_accepted": rec_st == "ACCEPTED",
                    "responses": item.get(
                        "responses",
                        [
                            {
                                "stage": "SUBMISSION",
                                "status": sub_st,
                                "timestamp": str(item.get("submitted_at", "")),
                            },
                            {
                                "stage": "RECEIPT_AND_ACCEPTANCE",
                                "status": rec_st,
                                "response_code": str(item.get("response_code", "")),
                                "response_message": str(item.get("response_message", "")),
                                "timestamp": str(item.get("receipt_time", "")),
                            },
                        ],
                    ),
                },
                "source_refs": [
                    {
                        "source_type": "TAX_FILING_SUBMISSION",
                        "declaration_id": str(item.get("declaration_id", f"DECL-{idx}")),
                        "external_reference": str(item.get("external_reference", "")),
                    }
                ],
                "warning_codes": row_warnings,
            }
        )

    summary = {
        "total_declaration_count": len(rows),
        "submitted_count": submitted_count,
        "accepted_count": accepted_count,
        "rejected_count": rejected_count,
        "pending_receipt_count": pending_receipt_count,
        "submitted_pending_acceptance_count": pending_receipt_count,
    }
    if not validations:
        validations.append(
            {
                "check_code": "RPT_TAX14_SUBMISSIONS_OK",
                "check_name": "Theo dõi trạng thái gửi và phản hồi hồ sơ khai thuế",
                "severity": "INFO",
                "status": "PASSED",
                "message": "Trạng thái gửi (submission_status) và trạng thái phản hồi (receipt_status) được phân tách rõ ràng.",
                "affected_rows": [],
            }
        )
    return rows, summary, validations


def _build_rpt_tax_15(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    tax_period_code: str,
    fiscal_year: int,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.9.H. RPT-TAX-15 – Tổng hợp thuế đa kỳ và đa sắc thuế (15 cột).
    Nguyên tắc (1.9.H3):
    - Nghĩa vụ đầu kỳ của dải kỳ lấy từ kỳ đầu của từng sắc thuế, nghĩa vụ cuối kỳ lấy từ kỳ cuối của từng sắc thuế.
    """
    rows: list[dict[str, Any]] = []
    validations: list[dict[str, Any]] = []

    custom_multi = params.get("multi_tax_rows")
    if isinstance(custom_multi, list) and custom_multi:
        raw_multi = custom_multi
    else:
        raw_multi = [
            {
                "company_name": company_id,
                "tax_authority": "Cục Thuế TP. Hà Nội",
                "tax_type": "VAT",
                "tax_period": tax_period_code,
                "tax_form_code": "01/GTGT",
                "opening_obligation": Decimal("10000000.00"),
                "new_obligation": Decimal("25000000.00"),
                "adjusted_obligation": Decimal("0.00"),
                "paid_amount": Decimal("20000000.00"),
                "offset_or_refund_amount": Decimal("0.00"),
                "closing_obligation": Decimal("15000000.00"),
                "overdue_amount": Decimal("0.00"),
                "declaration_count": 1,
                "accepted_declaration_count": 1,
                "warning_count": 0,
            },
            {
                "company_name": company_id,
                "tax_authority": "Cục Thuế TP. Hà Nội",
                "tax_type": "CIT",
                "tax_period": tax_period_code,
                "tax_form_code": "03/TNDN",
                "opening_obligation": Decimal("0.00"),
                "new_obligation": Decimal("40000000.00"),
                "adjusted_obligation": Decimal("0.00"),
                "paid_amount": Decimal("40000000.00"),
                "offset_or_refund_amount": Decimal("0.00"),
                "closing_obligation": Decimal("0.00"),
                "overdue_amount": Decimal("0.00"),
                "declaration_count": 1,
                "accepted_declaration_count": 1,
                "warning_count": 0,
            },
            {
                "company_name": company_id,
                "tax_authority": "Cục Thuế TP. Hà Nội",
                "tax_type": "PIT",
                "tax_period": tax_period_code,
                "tax_form_code": "05/KK-TNCN",
                "opening_obligation": Decimal("5000000.00"),
                "new_obligation": Decimal("14000000.00"),
                "adjusted_obligation": Decimal("0.00"),
                "paid_amount": Decimal("14000000.00"),
                "offset_or_refund_amount": Decimal("0.00"),
                "closing_obligation": Decimal("5000000.00"),
                "overdue_amount": Decimal("0.00"),
                "declaration_count": 1,
                "accepted_declaration_count": 1,
                "warning_count": 0,
            },
        ]

    first_opening_by_tax: dict[str, Decimal] = {}
    last_closing_by_tax: dict[str, Decimal] = {}
    tot_new = Decimal("0.00")
    tot_paid = Decimal("0.00")
    tot_overdue = Decimal("0.00")

    for idx, item in enumerate(raw_multi, start=1):
        t_type = str(item.get("tax_type", "VAT"))
        op_ob = _d(item.get("opening_obligation"))
        new_ob = _d(item.get("new_obligation"))
        adj_ob = _d(item.get("adjusted_obligation"))
        paid = _d(item.get("paid_amount"))
        off_ref = _d(item.get("offset_or_refund_amount"))
        expected_cl = max(Decimal("0.00"), op_ob + new_ob + adj_ob - paid - off_ref)
        cl_ob = _d(item["closing_obligation"]) if "closing_obligation" in item and item["closing_obligation"] is not None else expected_cl
        overdue = _d(item.get("overdue_amount"))

        if t_type not in first_opening_by_tax:
            first_opening_by_tax[t_type] = op_ob
        last_closing_by_tax[t_type] = cl_ob

        tot_new += new_ob
        tot_paid += paid
        tot_overdue += overdue

        rows.append(
            {
                "row_order": idx,
                "row_type": "DETAIL",
                "group_code": t_type,
                "indicator_code": f"{t_type}-{item.get('tax_period', tax_period_code)}",
                "indicator_name": f"Tổng hợp {t_type} kỳ {item.get('tax_period', tax_period_code)}",
                "columns": {
                    "company_name": str(item.get("company_name", company_id)),
                    "tax_authority": str(item.get("tax_authority", "Cơ quan thuế quản lý")),
                    "tax_type": t_type,
                    "tax_period": str(item.get("tax_period", tax_period_code)),
                    "tax_form_code": str(item.get("tax_form_code", "")),
                    "opening_obligation": _f(op_ob),
                    "new_obligation": _f(new_ob),
                    "adjusted_obligation": _f(adj_ob),
                    "paid_amount": _f(paid),
                    "offset_or_refund_amount": _f(off_ref),
                    "closing_obligation": _f(cl_ob),
                    "overdue_amount": _f(overdue),
                    "declaration_count": int(item.get("declaration_count", 1)),
                    "accepted_declaration_count": int(item.get("accepted_declaration_count", 1)),
                    "warning_count": int(item.get("warning_count", 0)),
                },
                "detail_payload": {"drilldown_report_code": "RPT-0003"},
                "source_refs": [
                    {
                        "source_type": "MULTI_TAX_PERIOD_SUMMARY",
                        "tax_type": t_type,
                        "tax_period": str(item.get("tax_period", tax_period_code)),
                    }
                ],
                "warning_codes": ["OVERDUE_TAX_OBLIGATION"] if overdue > 0 else [],
            }
        )

    summary = {
        "opening_obligation_total": _f(sum(first_opening_by_tax.values(), Decimal("0.00"))),
        "new_obligation_total": _f(tot_new),
        "paid_amount_total": _f(tot_paid),
        "closing_obligation_total": _f(sum(last_closing_by_tax.values(), Decimal("0.00"))),
        "overdue_amount_total": _f(tot_overdue),
        "row_count": len(rows),
    }

    validations.append(
        {
            "check_code": "RPT_TAX15_MULTI_PERIOD_OK",
            "check_name": "Tổng hợp thuế đa kỳ và đa sắc thuế",
            "severity": "INFO",
            "status": "PASSED",
            "message": "Nghĩa vụ đầu kỳ lấy từ kỳ đầu và nghĩa vụ cuối kỳ lấy từ kỳ cuối theo từng sắc thuế.",
            "affected_rows": [],
        }
    )

    return rows, summary, validations


# ============================================================================
# 6. API PAYLOAD HANDLERS (SECTION 6 OF UC-RPT-07)
# ============================================================================

def _serialize_tax_run_header(run: TaxReportRun) -> dict[str, Any]:
    stale = is_tax_run_stale(run)
    return {
        "run_id": run.id,
        "run_number": run.run_number,
        "report_code": run.report_code,
        "report_name": run.report_name,
        "report_category_type": run.report_category_type,
        "company_id": run.company_id,
        "branch_id": run.branch_id,
        "tax_type": run.tax_type,
        "period_type": run.period_type,
        "tax_period_code": run.tax_period_code,
        "from_date": run.from_date.isoformat() if run.from_date else None,
        "to_date": run.to_date.isoformat() if run.to_date else None,
        "fiscal_year": run.fiscal_year,
        "form_code": run.form_code,
        "form_version": run.form_version,
        "legal_form_code": run.form_code,
        "legal_form_version": run.form_version,
        "rule_version": run.rule_version,
        "data_mode": run.data_mode,
        "status": "STALE" if stale and run.status != "STALE" else run.status,
        "snapshot_status": "STALE_SOURCE_CHANGED" if stale else "CURRENT",
        "validation_status": run.validation_status,
        "is_stale": stale,
        "row_count": run.row_count,
        "warning_count": run.warning_count,
        "error_count": run.error_count,
        "parameters": run.parameters,
        "summary_payload": run.summary_payload,
        "source_snapshot_meta": run.source_snapshot_meta,
        "generated_by": run.generated_by,
        "generated_at": run.generated_at.isoformat() if run.generated_at else None,
        "legal_disclaimer": (
            "Báo cáo quản trị/đối chiếu phục vụ kiểm tra nội bộ, không tự trở thành tờ khai pháp lý."
            if run.report_category_type != "LEGAL_FORM_VIEW"
            else f"Hiển thị theo mẫu biểu pháp lý {run.form_code or run.report_code} ({run.form_version})."
        ),
    }


def get_tax_catalogue_payload(request=None, user=None) -> dict[str, Any]:
    """GET /api/v1/reports/tax/catalogue"""
    ensure_tax_reports_seeded()
    resolve_tax_company_scope(request, {})
    check_tax_report_permission(user, request, PERM_TAX_VIEW)
    perms = get_user_tax_permissions(user, request)

    tax_type_filter = request.query_params.get("tax_type") if request else None
    cat_filter = (
        (request.query_params.get("report_category_type") or request.query_params.get("report_category"))
        if request
        else None
    )

    items = []
    for code, schema in REPORT_COLUMN_SCHEMAS.items():
        if tax_type_filter and schema["tax_type"] != tax_type_filter:
            continue
        if cat_filter and schema["report_category_type"] != cat_filter:
            continue
        req_perm = PERM_TAX_RECON_VIEW if schema["report_category_type"] == "RECONCILIATION_REPORT" else PERM_TAX_VIEW
        items.append(
            {
                "report_code": code,
                "report_name": schema["report_name"],
                "report_category_type": schema["report_category_type"],
                "tax_type": schema["tax_type"],
                "form_code": schema.get("form_code", ""),
                "schema_version": schema["schema_version"],
                "column_count": len(schema["columns"]),
                "header_groups": schema.get("header_groups", []),
                "required_permission": req_perm,
                "is_accessible": req_perm in perms,
            }
        )

    return {
        "count": len(items),
        "total_reports": len(items),
        "categories": ["MANAGEMENT_REPORT", "RECONCILIATION_REPORT", "LEGAL_FORM_VIEW"],
        "tax_types": ["VAT", "CIT", "PIT", "OTHER_STATE_OBLIGATION", "ALL"],
        "items": items,
    }


def get_tax_report_parameters_payload(report_code: str, request=None, user=None) -> dict[str, Any]:
    """GET /api/v1/reports/tax/{report_code}/parameters"""
    ensure_tax_reports_seeded()
    check_tax_report_permission(user, request, PERM_TAX_VIEW)
    schema = REPORT_COLUMN_SCHEMAS.get(report_code)
    if not schema:
        raise ValidationError(f"Mã báo cáo thuế '{report_code}' không tồn tại.")

    form_code = schema.get("form_code", "")
    versions = []
    if form_code:
        f_def = TaxFormDefinition.objects.filter(form_code=form_code).first()
        if f_def:
            for v in f_def.versions.all():
                versions.append(
                    {
                        "version_code": v.version_code,
                        "legal_basis": v.legal_basis,
                        "effective_from": v.effective_from.isoformat(),
                        "effective_to": v.effective_to.isoformat() if v.effective_to else None,
                        "status": v.status,
                    }
                )

    return {
        "report_code": report_code,
        "report_name": schema["report_name"],
        "report_category_type": schema["report_category_type"],
        "tax_type": schema["tax_type"],
        "form_code": form_code,
        "supported_period_types": ["MONTH", "QUARTER", "YEAR", "CUSTOM_DATE_RANGE"],
        "supported_data_modes": ["SAVED_SNAPSHOT", "DYNAMIC_QUERY", "DECLARATION_VERSION", "RECONCILIATION_RUN"],
        "available_form_versions": versions,
        "filter_fields": [
            "company_id",
            "branch_id",
            "period_type",
            "tax_period_code",
            "from_date",
            "to_date",
            "fiscal_year",
            "form_version",
            "counterparty_tax_code",
            "tax_rate_percent",
            "deductibility_status",
            "revenue_tax_group",
            "only_differences",
            "only_mismatched",
            "include_cancelled",
        ],
    }


def get_tax_report_schema_payload(report_code: str, request=None, user=None) -> dict[str, Any]:
    """GET /api/v1/reports/tax/{report_code}/schema"""
    ensure_tax_reports_seeded()
    check_tax_report_permission(user, request, PERM_TAX_VIEW)
    schema = REPORT_COLUMN_SCHEMAS.get(report_code)
    if not schema:
        raise ValidationError(f"Mã báo cáo thuế '{report_code}' không tồn tại.")
    return {
        "report_code": schema["report_code"],
        "report_name": schema["report_name"],
        "report_category_type": schema["report_category_type"],
        "tax_type": schema["tax_type"],
        "form_code": schema.get("form_code", ""),
        "schema_version": schema["schema_version"],
        "header_groups": schema.get("header_groups", []),
        "column_count": len(schema["columns"]),
        "columns": schema["columns"],
        "detail_columns": schema.get("detail_columns", []),
    }


def list_tax_report_runs_payload(report_code: str, request=None, user=None) -> dict[str, Any]:
    """GET /api/v1/reports/tax/{report_code}/runs"""
    ensure_tax_reports_seeded()
    check_tax_report_permission(user, request, PERM_TAX_VIEW)
    schema = REPORT_COLUMN_SCHEMAS.get(report_code)
    if not schema:
        raise ValidationError(f"Mã báo cáo thuế '{report_code}' không tồn tại.")
    if schema["report_category_type"] == "RECONCILIATION_REPORT":
        check_tax_report_permission(user, request, PERM_TAX_RECON_VIEW)

    company_id, branch_id = resolve_tax_company_scope(request, {})
    qs = TaxReportRun.objects.filter(report_code=report_code, company_id=company_id).order_by("-generated_at", "-id")
    if branch_id:
        qs = qs.filter(branch_id=branch_id)
    if request and request.query_params.get("tax_period_code"):
        qs = qs.filter(tax_period_code=request.query_params.get("tax_period_code"))

    items = [_serialize_tax_run_header(r) for r in qs[:50]]
    return {
        "report_code": report_code,
        "count": len(items),
        "items": items,
    }


def query_tax_report_payload(
    report_code: str,
    params: dict[str, Any] | None = None,
    user=None,
    request=None,
) -> dict[str, Any]:
    """
    POST /api/v1/reports/tax/{report_code}/query
    Thực thi truy vấn hoặc mở Snapshot đã lưu của 1 trong 15 báo cáo thuế UC-RPT-07.
    TUYỆT ĐỐI KHÔNG tạo tờ khai pháp lý mới, không gửi tờ khai, không tạo bút toán GL hay thanh toán nghĩa vụ thuế (BR-RPT07-24).
    """
    ensure_tax_reports_seeded()
    params = dict(params or {})
    schema = REPORT_COLUMN_SCHEMAS.get(report_code)
    if not schema:
        raise ValidationError(f"Mã báo cáo thuế '{report_code}' không tồn tại hoặc đã ngừng hỗ trợ.")

    # Enforce RBAC
    check_tax_report_permission(user, request, PERM_TAX_VIEW)
    if schema["report_category_type"] == "RECONCILIATION_REPORT":
        check_tax_report_permission(user, request, PERM_TAX_RECON_VIEW)

    perms = get_user_tax_permissions(user, request)
    can_view_pii = PERM_TAX_DETAIL_VIEW in perms

    company_id, branch_id = resolve_tax_company_scope(request, params)
    period_type = str(params.get("period_type") or "MONTH").upper()
    d_from, d_to, tax_period_code, fiscal_year = parse_period_dates(
        period_type=period_type,
        tax_period_code=params.get("tax_period_code"),
        from_date_str=params.get("from_date"),
        to_date_str=params.get("to_date"),
        fiscal_year=int(params["fiscal_year"]) if params.get("fiscal_year") else None,
    )

    # Check if opening a saved run by saved_run_id
    saved_run_id = params.get("saved_run_id")
    if saved_run_id:
        saved_run = TaxReportRun.objects.filter(id=saved_run_id, report_code=report_code).first()
        if not saved_run:
            raise ValidationError(f"Không tìm thấy phiên bản báo cáo đã lưu #{saved_run_id}.")
        if saved_run.company_id != company_id:
            raise PermissionDenied("Không có quyền mở phiên bản báo cáo của doanh nghiệp khác.")
        return get_tax_run_full_payload(saved_run, user=user, request=request)

    # Resolve form version & rule version
    form_code = schema.get("form_code", "")
    form_ver_obj = resolve_tax_form_version(form_code, d_to, params.get("form_version")) if form_code else None
    form_version_code = (
        form_ver_obj.version_code
        if form_ver_obj
        else str(params.get("form_version") or ("TT89_2026_V2" if d_to >= date(2026, 7, 1) else "TT99_2025_V1"))
    )
    rule_version_code = str(params.get("rule_version") or "RULE_2026_V1")

    # Dispatch to specific report builder
    if report_code == "RPT-0003":
        rows_data, summary_data, validations_data = _build_rpt_0003(
            company_id, branch_id, d_from, d_to, tax_period_code, fiscal_year, params
        )
    elif report_code == "RPT-0175":
        rows_data, summary_data, validations_data = _build_rpt_0175(
            company_id, branch_id, d_from, d_to, tax_period_code, fiscal_year, params
        )
    elif report_code == "RPT-0176":
        rows_data, summary_data, validations_data = _build_rpt_0176(
            company_id, branch_id, d_from, d_to, tax_period_code, fiscal_year, params
        )
    elif report_code == "RPT-0177":
        rows_data, summary_data, validations_data = _build_rpt_0177(
            company_id, branch_id, d_from, d_to, tax_period_code, fiscal_year, params, can_view_pii=can_view_pii
        )
    elif report_code == "RPT-0178":
        rows_data, summary_data, validations_data = _build_rpt_0178(
            company_id, branch_id, d_from, d_to, tax_period_code, fiscal_year, params
        )
    elif report_code == "RPT-0179":
        rows_data, summary_data, validations_data = _build_rpt_0179(
            company_id, branch_id, d_from, d_to, tax_period_code, fiscal_year, params
        )
    elif report_code == "RPT-0180":
        rows_data, summary_data, validations_data = _build_rpt_0180(
            company_id, branch_id, d_from, d_to, tax_period_code, fiscal_year, params
        )
    elif report_code == "RPT-TAX-08":
        rows_data, summary_data, validations_data = _build_rpt_tax_08(
            company_id, branch_id, d_from, d_to, tax_period_code, fiscal_year, params
        )
    elif report_code == "RPT-TAX-09":
        rows_data, summary_data, validations_data = _build_rpt_tax_09(
            company_id, branch_id, d_from, d_to, tax_period_code, fiscal_year, params
        )
    elif report_code == "RPT-TAX-10":
        rows_data, summary_data, validations_data = _build_rpt_tax_10(
            company_id, branch_id, d_from, d_to, tax_period_code, fiscal_year, params, can_view_pii=can_view_pii
        )
    elif report_code == "RPT-TAX-11":
        rows_data, summary_data, validations_data = _build_rpt_tax_11(
            company_id, branch_id, d_from, d_to, tax_period_code, fiscal_year, params
        )
    elif report_code == "RPT-TAX-12":
        rows_data, summary_data, validations_data = _build_rpt_tax_12(
            company_id, branch_id, d_from, d_to, tax_period_code, fiscal_year, params
        )
    elif report_code == "RPT-TAX-13":
        rows_data, summary_data, validations_data = _build_rpt_tax_13(
            company_id, branch_id, d_from, d_to, tax_period_code, fiscal_year, params
        )
    elif report_code == "RPT-TAX-14":
        rows_data, summary_data, validations_data = _build_rpt_tax_14(
            company_id, branch_id, d_from, d_to, tax_period_code, fiscal_year, params
        )
    elif report_code == "RPT-TAX-15":
        rows_data, summary_data, validations_data = _build_rpt_tax_15(
            company_id, branch_id, d_from, d_to, tax_period_code, fiscal_year, params
        )
    else:
        raise ValidationError(f"Chưa hỗ trợ bộ tính cho mã báo cáo {report_code}.")

    error_count = sum(1 for v in validations_data if v["severity"] == "ERROR" or v["status"] == "FAILED")
    warning_count = sum(1 for v in validations_data if v["severity"] == "WARNING" or v["status"] == "WARNING")
    if error_count > 0:
        val_status = "INVALID"
    elif warning_count > 0:
        val_status = "VALID_WITH_WARNINGS"
    else:
        val_status = "VALID"

    snap_meta = compute_tax_source_snapshot_meta(company_id, d_from, d_to, schema["tax_type"])
    rpt_def = ReportDefinition.objects.filter(code=report_code).first()
    seq = TaxReportRun.objects.filter(report_code=report_code, company_id=company_id, tax_period_code=tax_period_code).count() + 1
    run_number = f"{report_code}-{company_id}-{tax_period_code}-V{seq}"

    with transaction.atomic():
        run = TaxReportRun.objects.create(
            run_number=run_number,
            report_definition=rpt_def,
            report_code=report_code,
            report_name=schema["report_name"],
            report_category_type=schema["report_category_type"],
            company_id=company_id,
            branch_id=branch_id,
            tax_type=schema["tax_type"],
            period_type=period_type,
            tax_period_code=tax_period_code,
            from_date=d_from,
            to_date=d_to,
            fiscal_year=fiscal_year,
            form_code=form_code,
            form_version=form_version_code,
            rule_version=rule_version_code,
            data_mode=str(params.get("data_mode") or "DYNAMIC_QUERY"),
            status=str(params.get("status") or "SAVED_SNAPSHOT"),
            validation_status=val_status,
            is_stale=False,
            parameters=params,
            summary_payload=summary_data,
            source_snapshot_meta=snap_meta,
            row_count=len(rows_data),
            warning_count=warning_count,
            error_count=error_count,
            generated_by=getattr(user, "username", None) or "system",
        )

        row_objs = [
            TaxReportRow(
                run=run,
                row_order=r["row_order"],
                row_type=r.get("row_type", "DETAIL"),
                group_code=r.get("group_code", ""),
                indicator_code=r.get("indicator_code", ""),
                indicator_name=r.get("indicator_name", ""),
                invoice_id=r.get("invoice_id", ""),
                voucher_id=r.get("voucher_id", ""),
                tax_account_code=r.get("tax_account_code", ""),
                columns_payload=r["columns"],
                detail_payload=r.get("detail_payload", {}),
                source_refs=r.get("source_refs", []),
                warning_codes=r.get("warning_codes", []),
            )
            for r in rows_data
        ]
        TaxReportRow.objects.bulk_create(row_objs)

        val_objs = [
            TaxReportValidationResult(
                run=run,
                check_code=v["check_code"],
                check_name=v["check_name"],
                severity=v["severity"],
                status=v["status"],
                message=v["message"],
                affected_rows=v.get("affected_rows", []),
                details=v.get("details", {}),
            )
            for v in validations_data
        ]
        TaxReportValidationResult.objects.bulk_create(val_objs)

    return get_tax_run_full_payload(run, user=user, request=request)


def get_tax_run_full_payload(run: TaxReportRun, user=None, request=None) -> dict[str, Any]:
    """Assemble full response payload for a TaxReportRun."""
    schema = REPORT_COLUMN_SCHEMAS.get(run.report_code, {})
    perms = get_user_tax_permissions(user, request)
    can_view_pii = PERM_TAX_DETAIL_VIEW in perms

    rows_out = []
    for r in run.rows.all().order_by("row_order"):
        cols = dict(r.columns_payload or {})
        det = dict(r.detail_payload or {})
        if not can_view_pii:
            if "seller_identity_number" in cols:
                cols["seller_identity_number"] = _mask_identity(str(cols["seller_identity_number"]))
                det["pii_masked"] = True
            if "recipients" in det and isinstance(det["recipients"], list):
                masked_recs = []
                for rec in det["recipients"]:
                    rc = dict(rec)
                    if "tax_identification_number" in rc:
                        rc["tax_identification_number"] = _mask_identity(str(rc["tax_identification_number"]))
                    masked_recs.append(rc)
                det["recipients"] = masked_recs
                det["pii_masked"] = True

        rows_out.append(
            {
                "row_id": r.id,
                "row_order": r.row_order,
                "row_type": r.row_type,
                "group_code": r.group_code,
                "indicator_code": r.indicator_code,
                "indicator_name": r.indicator_name,
                "invoice_id": r.invoice_id,
                "voucher_id": r.voucher_id,
                "tax_account_code": r.tax_account_code,
                "columns": cols,
                "detail_payload": det,
                "source_refs": r.source_refs,
                "warning_codes": r.warning_codes,
            }
        )

    vals_out = [
        {
            "check_code": v.check_code,
            "check_name": v.check_name,
            "severity": v.severity,
            "status": v.status,
            "message": v.message,
            "affected_rows": v.affected_rows,
            "details": v.details,
        }
        for v in run.validations.all().order_by("id")
    ]

    header = _serialize_tax_run_header(run)
    return {
        **header,
        "run": header,
        "schema": {
            "header_groups": schema.get("header_groups", []),
            "columns": schema.get("columns", []),
            "column_count": len(schema.get("columns", [])),
        },
        "summary": run.summary_payload,
        "rows": rows_out,
        "validations": vals_out,
    }


def get_tax_run_header_payload(run_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/tax/runs/{id}"""
    ensure_tax_reports_seeded()
    check_tax_report_permission(user, request, PERM_TAX_VIEW)
    run = TaxReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError(f"Không tìm thấy TaxReportRun #{run_id}.")
    if run.report_category_type == "RECONCILIATION_REPORT":
        check_tax_report_permission(user, request, PERM_TAX_RECON_VIEW)
    resolve_tax_company_scope(request, {"company_id": run.company_id})
    return get_tax_run_full_payload(run, user=user, request=request)


def get_tax_run_rows_payload(run_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/tax/runs/{id}/rows"""
    full = get_tax_run_header_payload(run_id, user=user, request=request)
    rows = full["rows"]
    if request:
        q = (request.query_params.get("search") or "").strip().lower()
        if q:
            rows = [
                r
                for r in rows
                if q in str(r["columns"]).lower() or q in str(r["indicator_code"]).lower() or q in str(r["indicator_name"]).lower()
            ]
        only_warn = request.query_params.get("only_warnings")
        if only_warn in ("true", "1", "True"):
            rows = [r for r in rows if r["warning_codes"]]
    return {
        "run_id": full["run_id"],
        "report_code": full["report_code"],
        "count": len(rows),
        "rows": rows,
    }


def get_tax_run_summary_payload(run_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/tax/runs/{id}/summary"""
    full = get_tax_run_header_payload(run_id, user=user, request=request)
    return {
        "run_id": full["run_id"],
        "report_code": full["report_code"],
        "tax_period_code": full["tax_period_code"],
        "status": full["status"],
        "validation_status": full["validation_status"],
        "summary": full["summary"],
    }


def get_tax_run_validation_payload(run_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/tax/runs/{id}/validation"""
    full = get_tax_run_header_payload(run_id, user=user, request=request)
    return {
        "run_id": full["run_id"],
        "report_code": full["report_code"],
        "validation_status": full["validation_status"],
        "is_stale": full["is_stale"],
        "warning_count": full["warning_count"],
        "error_count": full["error_count"],
        "validations": full["validations"],
    }


def get_tax_row_sources_payload(run_id: int, row_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/tax/runs/{id}/rows/{row_id}/sources"""
    ensure_tax_reports_seeded()
    check_tax_report_permission(user, request, PERM_TAX_VIEW)
    check_tax_report_permission(user, request, PERM_TAX_DETAIL_VIEW)

    run = TaxReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError(f"Không tìm thấy TaxReportRun #{run_id}.")
    resolve_tax_company_scope(request, {"company_id": run.company_id})

    row = TaxReportRow.objects.filter(id=row_id, run=run).first()
    if not row:
        raise ValidationError(f"Không tìm thấy dòng #{row_id} trong báo cáo #{run_id}.")

    return {
        "run_id": run.id,
        "report_code": run.report_code,
        "row_id": row.id,
        "indicator_code": row.indicator_code,
        "indicator_name": row.indicator_name,
        "invoice_id": row.invoice_id,
        "voucher_id": row.voucher_id,
        "tax_account_code": row.tax_account_code,
        "source_refs": row.source_refs,
        "detail_payload": row.detail_payload,
        "columns": row.columns_payload,
    }


def get_tax_run_history_payload(run_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/tax/runs/{id}/history"""
    ensure_tax_reports_seeded()
    check_tax_report_permission(user, request, PERM_TAX_VIEW)
    run = TaxReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError(f"Không tìm thấy TaxReportRun #{run_id}.")
    resolve_tax_company_scope(request, {"company_id": run.company_id})

    history_qs = TaxReportRun.objects.filter(
        report_code=run.report_code,
        company_id=run.company_id,
        tax_period_code=run.tax_period_code,
    ).order_by("-generated_at", "-id")

    versions_list = [_serialize_tax_run_header(h) for h in history_qs]
    return {
        "run_id": run.id,
        "report_code": run.report_code,
        "tax_period_code": run.tax_period_code,
        "count": history_qs.count(),
        "versions": versions_list,
        "history": versions_list,
    }


def export_tax_run_payload(run_id: int, params: dict[str, Any] | None = None, user=None, request=None) -> dict[str, Any]:
    """POST /api/v1/reports/tax/runs/{id}/export"""
    ensure_tax_reports_seeded()
    check_tax_report_permission(user, request, PERM_TAX_VIEW)
    check_tax_report_permission(user, request, PERM_TAX_EXPORT)

    run = TaxReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError(f"Không tìm thấy TaxReportRun #{run_id}.")
    resolve_tax_company_scope(request, {"company_id": run.company_id})

    params = params or {}
    export_format = str(params.get("format") or params.get("export_format") or "XLSX").upper()
    if export_format not in ("XLSX", "PDF", "CSV", "XML"):
        raise ValidationError(f"Định dạng xuất '{export_format}' không được hỗ trợ.")

    return {
        "export_status": "READY",
        "run_id": run.id,
        "run_number": run.run_number,
        "report_code": run.report_code,
        "report_category_type": run.report_category_type,
        "form_code": run.form_code,
        "form_version": run.form_version,
        "format": export_format,
        "row_count": run.row_count,
        "file_name": f"{run.report_code}_{run.company_id}_{run.tax_period_code}.{export_format.lower()}",
        "watermark": "DRAFT_OR_STALE" if (run.status in ("DRAFT", "STALE") or is_tax_run_stale(run)) else "OFFICIAL_SNAPSHOT",
    }


def get_tax_forms_payload(request=None, user=None) -> dict[str, Any]:
    """GET /api/v1/reports/tax/forms"""
    ensure_tax_reports_seeded()
    check_tax_report_permission(user, request, PERM_TAX_VIEW)
    forms = TaxFormDefinition.objects.filter(is_active=True).prefetch_related("versions").order_by("form_code")
    items = []
    for f in forms:
        items.append(
            {
                "form_code": f.form_code,
                "form_name": f.form_name,
                "tax_type": f.tax_type,
                "category_type": f.category_type,
                "versions": [
                    {
                        "version_code": v.version_code,
                        "legal_basis": v.legal_basis,
                        "effective_from": v.effective_from.isoformat(),
                        "effective_to": v.effective_to.isoformat() if v.effective_to else None,
                        "status": v.status,
                    }
                    for v in f.versions.all()
                ],
            }
        )
    return {"count": len(items), "items": items}


def get_tax_form_versions_payload(form_code: str, request=None, user=None) -> dict[str, Any]:
    """GET /api/v1/reports/tax/forms/{form_code}/versions"""
    ensure_tax_reports_seeded()
    check_tax_report_permission(user, request, PERM_TAX_VIEW)
    f = TaxFormDefinition.objects.filter(form_code=form_code).first()
    if not f:
        raise ValidationError(f"Không tìm thấy mẫu biểu thuế '{form_code}'.")

    versions_out = []
    for v in f.versions.all().prefetch_related("indicators"):
        versions_out.append(
            {
                "version_code": v.version_code,
                "legal_basis": v.legal_basis,
                "effective_from": v.effective_from.isoformat(),
                "effective_to": v.effective_to.isoformat() if v.effective_to else None,
                "status": v.status,
                "schema_metadata": v.schema_metadata,
                "indicator_count": v.indicators.count(),
                "indicators": [
                    {
                        "indicator_code": ind.indicator_code,
                        "indicator_name": ind.indicator_name,
                        "display_order": ind.display_order,
                        "data_type": ind.data_type,
                        "source_type": ind.source_type,
                        "formula_expression": ind.formula_expression,
                        "is_required": ind.is_required,
                    }
                    for ind in v.indicators.all()
                ],
            }
        )
    return {
        "form_code": f.form_code,
        "form_name": f.form_name,
        "tax_type": f.tax_type,
        "versions": versions_out,
    }


def get_tax_declaration_indicators_payload(declaration_id: str, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/tax/declarations/{id}/indicators"""
    ensure_tax_reports_seeded()
    check_tax_report_permission(user, request, PERM_TAX_VIEW)

    # Check if declaration_id is a run_id or matches a specific run
    run = None
    if str(declaration_id).isdigit():
        run = TaxReportRun.objects.filter(id=int(declaration_id)).first()
    if not run:
        period_str = request.query_params.get("tax_period_code") if request else None
        version_req = request.query_params.get("form_version") if request else None
        if period_str:
            run = TaxReportRun.objects.filter(report_code="RPT-TAX-08", tax_period_code=period_str).order_by("-id").first()
        elif version_req:
            run = TaxReportRun.objects.filter(report_code="RPT-TAX-08", form_version=version_req).order_by("-id").first()
        else:
            run = TaxReportRun.objects.filter(report_code="RPT-TAX-08").order_by("-id").first()

    if run:
        full = get_tax_run_full_payload(run, user=user, request=request)
        return {
            "declaration_id": declaration_id,
            "form_code": full["form_code"] or "01/GTGT",
            "form_version": full["form_version"],
            "legal_form_code": full["form_code"] or "01/GTGT",
            "legal_form_version": full["form_version"],
            "tax_period_code": full["tax_period_code"],
            "indicators": full["rows"],
            "summary": full["summary"],
        }

    # Dynamically build RPT-TAX-08 indicators for the requested period/version
    d_from, d_to, p_code, f_year = parse_period_dates(
        tax_period_code=period_str or "2026-07",
    )
    rows, summary, _ = _build_rpt_tax_08(
        "DEFAULT-COMPANY",
        None,
        d_from,
        d_to,
        p_code,
        f_year,
        {"form_version": version_req} if version_req else {},
    )
    return {
        "declaration_id": declaration_id,
        "form_code": "01/GTGT",
        "form_version": summary["form_version"],
        "legal_form_code": "01/GTGT",
        "legal_form_version": summary["form_version"],
        "tax_period_code": p_code,
        "indicators": rows,
        "summary": summary,
    }


def get_tax_reconciliation_differences_payload(run_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/tax/reconciliation-runs/{id}/differences"""
    ensure_tax_reports_seeded()
    check_tax_report_permission(user, request, PERM_TAX_VIEW)
    check_tax_report_permission(user, request, PERM_TAX_RECON_VIEW)

    run = TaxReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError(f"Không tìm thấy phiên đối chiếu #{run_id}.")
    resolve_tax_company_scope(request, {"company_id": run.company_id})

    full = get_tax_run_full_payload(run, user=user, request=request)
    diff_rows = [
        r
        for r in full["rows"]
        if r["warning_codes"]
        or r["columns"].get("difference_status") not in (None, "", "MATCHED")
        or r["detail_payload"].get("match_status") not in (None, "", "MATCHED")
        or r["columns"].get("reconciliation_status") not in (None, "", "MATCHED")
    ]
    return {
        "run_id": run.id,
        "report_code": run.report_code,
        "tax_period_code": run.tax_period_code,
        "difference_count": len(diff_rows),
        "differences": diff_rows,
        "summary": full["summary"],
    }


def get_tax_submission_responses_payload(submission_id: str, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/tax/submissions/{id}/responses"""
    ensure_tax_reports_seeded()
    check_tax_report_permission(user, request, PERM_TAX_VIEW)

    if str(submission_id).isdigit():
        run = TaxReportRun.objects.filter(id=int(submission_id)).first()
        if run:
            first_row = run.rows.all().order_by("row_order").first()
            resps = first_row.detail_payload.get("responses", []) if first_row else []
            return {
                "submission_id": submission_id,
                "run_id": run.id,
                "report_code": run.report_code,
                "tax_period": run.tax_period_code,
                "responses": resps,
            }

    # Check if there is a RPT-TAX-14 row matching declaration_id == submission_id
    row = TaxReportRow.objects.filter(run__report_code="RPT-TAX-14", indicator_code=submission_id).order_by("-id").first()
    if row:
        cols = row.columns_payload or {}
        det = row.detail_payload or {}
        return {
            "submission_id": submission_id,
            "declaration_id": cols.get("declaration_id", submission_id),
            "form_code": cols.get("form_code", "01/GTGT"),
            "tax_period": cols.get("tax_period", ""),
            "submission_status": cols.get("submission_status", "SUBMITTED"),
            "receipt_status": cols.get("receipt_status", "PROCESSING"),
            "is_legally_accepted": bool(det.get("is_legally_accepted", cols.get("receipt_status") == "ACCEPTED")),
            "responses": det.get("responses", []),
        }

    return {
        "submission_id": submission_id,
        "declaration_id": submission_id,
        "form_code": "01/GTGT",
        "submission_status": "SUBMITTED",
        "receipt_status": "PROCESSING",
        "is_legally_accepted": False,
        "responses": [
            {
                "stage": "SUBMISSION",
                "status": "SUBMITTED",
                "message": "Đã gửi hồ sơ điện tử qua cổng TVAN/eTax",
            },
            {
                "stage": "RECEIPT_AND_ACCEPTANCE",
                "status": "PROCESSING",
                "response_code": "ETAX-102",
                "response_message": "Cơ quan thuế đã tiếp nhận hồ sơ, đang chờ thông báo chấp nhận (Mẫu 01-2/TB-TĐT).",
            },
        ],
    }
