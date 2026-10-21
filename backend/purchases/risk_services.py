import re
import uuid
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts_payable.models import SupplierInvoice
from iam.permissions import has_effective_permission
from master_data.models import Party
from purchases import models
from purchases.models import RiskLevel, SupplierIncident, SupplierRiskAssessment, SupplierRiskConfig, SupplierRiskOverrideLog


TAX_CODE_REGEX = re.compile(r"^\d{10}(-\d{3})?$|^\d{13}$")


def validate_tax_code_format(tax_code: str) -> bool:
    """Validate standard Vietnamese tax code format (10 or 13 digits with optional hyphen)."""
    if not tax_code:
        return False
    clean_code = tax_code.strip()
    return bool(TAX_CODE_REGEX.match(clean_code))


def get_or_create_risk_config(company) -> SupplierRiskConfig:
    """Retrieve or create default risk configuration for the company."""
    config, _ = SupplierRiskConfig.objects.get_or_create(
        company=company,
        defaults={
            "validity_days": 30,
            "low_threshold": 19,
            "medium_threshold": 39,
            "invalid_invoice_points": 40,
            "duplicate_invoice_points": 30,
            "late_delivery_tier1_points": 10,
            "late_delivery_tier2_points": 20,
            "return_ratio_tier1_points": 10,
            "return_ratio_tier2_points": 20,
            "incident_points": 20,
            "require_high_risk_workflow": False,
        },
    )
    return config


def get_active_assessment(company, supplier: Party) -> SupplierRiskAssessment | None:
    """Get the latest non-expired risk assessment for a supplier (BR03)."""
    now = timezone.now()
    return (
        SupplierRiskAssessment.objects.filter(
            company=company,
            supplier=supplier,
            valid_until__gte=now,
        )
        .order_by("-version", "-created_at")
        .first()
    )


def assess_supplier_risk(
    company,
    supplier: Party,
    user,
    notes: str = "",
    external_tax_status: str | None = None,
    simulate_external_failure: bool = False,
) -> SupplierRiskAssessment:
    """
    Core risk evaluation engine adhering to UC-PUR-14 requirements and business rules.
    Does NOT create accounting vouchers or journal entries (BR23).
    Always creates a new record, never overwrites previous history (BR01, BR02).
    """
    if not supplier:
        raise ValidationError("Vui lòng chọn nhà cung cấp.")  # EX01

    if supplier.company_id != company.id:
        raise ValidationError("Nhà cung cấp không thuộc doanh nghiệp này.")

    config = get_or_create_risk_config(company)
    now = timezone.now()
    cutoff_date = (now - timedelta(days=365)).date()

    criteria_breakdown = []
    total_score = 0
    warnings = []

    # 1. Check Legal & Tax Code (EX02, EX03, EX04, BR11, BR22)
    tax_code = (supplier.tax_code or "").strip()
    tax_status = "UNVERIFIED"
    tax_code_status_verified = False

    if not tax_code:
        # EX02: Missing tax code -> check internal only, mark tax unverified
        criteria_breakdown.append({
            "code": "TAX_CODE_CHECK",
            "name": "Mã số thuế",
            "source": "INTERNAL",
            "status": "UNVERIFIED",
            "points": 0,
            "verified": False,
            "description": "Nhà cung cấp chưa có Mã số thuế trên hệ thống (chỉ kiểm tra dữ liệu nội bộ).",
            "related_items": [],
        })
    else:
        # EX03: Validate format
        is_format_valid = validate_tax_code_format(tax_code)
        if not is_format_valid:
            warnings.append("Mã số thuế không đúng định dạng.")
            criteria_breakdown.append({
                "code": "TAX_CODE_FORMAT",
                "name": "Định dạng mã số thuế",
                "source": "INTERNAL",
                "status": "INVALID_FORMAT",
                "points": 10,
                "verified": True,
                "description": f"Mã số thuế '{tax_code}' không đúng định dạng quy chuẩn.",
                "related_items": [],
            })
            total_score += 10

        # EX04: Check tax code duplicates across suppliers in company
        clean_digits = re.sub(r"\D", "", tax_code)
        base_tax = clean_digits[:10] if len(clean_digits) >= 10 else clean_digits
        dup_filter = Q(tax_code=tax_code)
        if len(base_tax) >= 10:
            dup_filter |= Q(tax_code__startswith=base_tax)

        duplicate_suppliers = Party.objects.filter(
            company=company
        ).exclude(pk=supplier.pk).filter(dup_filter)

        if duplicate_suppliers.exists():
            dup_names = list(duplicate_suppliers.values_list("name", flat=True)[:3])
            warnings.append(f"Mã số thuế trùng với nhà cung cấp khác: {', '.join(dup_names)}")
            criteria_breakdown.append({
                "code": "TAX_CODE_DUPLICATE",
                "name": "Trùng mã số thuế nội bộ",
                "source": "INTERNAL",
                "status": "DUPLICATE",
                "points": 10,
                "verified": True,
                "description": f"Mã số thuế trùng với các nhà cung cấp: {', '.join(dup_names)}",
                "related_items": list(duplicate_suppliers.values_list("code", flat=True)),
            })
            total_score += 10

        # External Tax source lookup (BR11, BR22, AF02, EX05)
        if simulate_external_failure or external_tax_status is None:
            # AF02, EX05: External source unavailable
            tax_status = "UNVERIFIED"
            tax_code_status_verified = False
            criteria_breakdown.append({
                "code": "EXTERNAL_TAX_STATUS",
                "name": "Trạng thái Mã số thuế từ nguồn thuế",
                "source": "EXTERNAL",
                "status": "UNVERIFIED",
                "points": 0,
                "verified": False,
                "description": "Không kết nối được nguồn dữ liệu bên ngoài. Chưa xác minh từ nguồn bên ngoài.",
                "related_items": [],
            })
        else:
            tax_code_status_verified = True
            tax_status = external_tax_status or "ACTIVE"
            if tax_status.upper() in ["INACTIVE", "CLOSED", "WARNED", "CEASED", "SUSPENDED", "NOT_EXIST"]:
                criteria_breakdown.append({
                    "code": "EXTERNAL_TAX_STATUS",
                    "name": "Trạng thái Mã số thuế từ nguồn thuế",
                    "source": "EXTERNAL",
                    "status": "WARNED",
                    "points": 50,
                    "verified": True,
                    "description": f"Mã số thuế {tax_status.upper()} (không tồn tại, ngừng hoạt động hoặc bị cơ quan thuế cảnh báo).",
                    "related_items": [tax_code],
                })
                total_score += 50
            else:
                criteria_breakdown.append({
                    "code": "EXTERNAL_TAX_STATUS",
                    "name": "Trạng thái Mã số thuế từ nguồn thuế",
                    "source": "EXTERNAL",
                    "status": "NORMAL",
                    "points": 0,
                    "verified": True,
                    "description": "Mã số thuế đang hoạt động bình thường trên hệ thống thuế.",
                    "related_items": [tax_code],
                })

    # 2. Check Supplier Operating Status (BR10, BR21)
    is_blocked_status = (supplier.status == "BLOCKED")
    if is_blocked_status:
        criteria_breakdown.append({
            "code": "INTERNAL_BLOCK_LIST",
            "name": "Danh sách chặn nội bộ",
            "source": "INTERNAL",
            "status": "BLOCKED",
            "points": 100,
            "verified": True,
            "description": "Nhà cung cấp nằm trong danh sách khóa/chặn giao dịch nội bộ.",
            "related_items": [supplier.code],
        })
        total_score += 100

    # 3. Check Input Invoices in 12 Months (BR12, BR13, Step 10-11)
    invoices_12m = SupplierInvoice.objects.filter(
        company=company,
        supplier=supplier,
        invoice_date__gte=cutoff_date,
    )
    total_invoices_count = invoices_12m.count()

    # Invalid / cancelled / replaced invoices (BR12)
    invalid_invoices = invoices_12m.filter(
        Q(validation_status="INVALID")
        | Q(status__in=["CANCELLED", "REJECTED"])
        | Q(is_replaced=True)
    )
    invalid_invoices_count = invalid_invoices.count()
    if invalid_invoices_count > 0:
        inv_points = config.invalid_invoice_points  # default +40
        total_score += inv_points
        criteria_breakdown.append({
            "code": "INVALID_INVOICES",
            "name": "Hóa đơn không hợp lệ trong 12 tháng",
            "source": "INTERNAL",
            "status": "DETECTED",
            "points": inv_points,
            "verified": True,
            "description": f"Phát hiện {invalid_invoices_count} hóa đơn không hợp lệ, bị hủy hoặc bị thay thế.",
            "related_items": list(invalid_invoices.values_list("invoice_number", flat=True)[:5]),
        })

    # Duplicate input invoices (BR13)
    # Check if any invoices sharing invoice_number and invoice_series
    duplicate_invoices = (
        invoices_12m.values("invoice_series", "invoice_number")
        .order_by()
    )
    invoice_identities = set()
    dup_identities = set()
    for inv in duplicate_invoices:
        ident = (inv["invoice_series"], inv["invoice_number"])
        if ident in invoice_identities:
            dup_identities.add(ident)
        else:
            invoice_identities.add(ident)

    duplicate_invoices_count = len(dup_identities)
    if duplicate_invoices_count > 0:
        dup_points = config.duplicate_invoice_points  # default +30
        total_score += dup_points
        criteria_breakdown.append({
            "code": "DUPLICATE_INVOICES",
            "name": "Hóa đơn trùng lặp trong 12 tháng",
            "source": "INTERNAL",
            "status": "DETECTED",
            "points": dup_points,
            "verified": True,
            "description": f"Phát hiện {duplicate_invoices_count} cặp hóa đơn trùng số và ký hiệu.",
            "related_items": [f"{s}-{n}" for s, n in list(dup_identities)[:5]],
        })

    # 4. Check Purchase Orders Performance in 12 Months (BR14, Step 12)
    orders_12m = models.PurchaseOrder.objects.filter(
        company=company,
        supplier=supplier,
        document_date__gte=cutoff_date,
    ).exclude(status__in=["DRAFT", "CANCELLED"])
    total_orders_count = orders_12m.count()

    late_orders_count = 0
    late_order_numbers = []
    for order in orders_12m:
        is_late = False
        # Delivery date passed and not fully received
        if order.delivery_date and order.delivery_date < now.date():
            if order.receiving_status != models.ReceivingProgressStatus.FULLY_RECEIVED:
                is_late = True
        # Or check if any lines have received_quantity < quantity
        if not is_late and order.delivery_date and order.delivery_date < now.date():
            for line in order.lines.all():
                if line.received_quantity < (line.quantity - line.cancelled_quantity):
                    is_late = True
                    break
        if is_late:
            late_orders_count += 1
            late_order_numbers.append(order.number)

    late_delivery_rate = (
        round((late_orders_count / total_orders_count) * 100, 2)
        if total_orders_count > 0
        else 0.0
    )

    if late_delivery_rate >= 30.0:
        late_points = config.late_delivery_tier2_points  # default +20
        total_score += late_points
        criteria_breakdown.append({
            "code": "LATE_DELIVERY",
            "name": "Tỷ lệ giao hàng chậm / không hoàn thành",
            "source": "INTERNAL",
            "status": "HIGH_LATE_RATE",
            "points": late_points,
            "verified": True,
            "description": f"Tỷ lệ giao chậm là {late_delivery_rate}% ({late_orders_count}/{total_orders_count} đơn, >= 30%).",
            "related_items": late_order_numbers[:5],
        })
    elif late_delivery_rate >= 10.0:
        late_points = config.late_delivery_tier1_points  # default +10
        total_score += late_points
        criteria_breakdown.append({
            "code": "LATE_DELIVERY",
            "name": "Tỷ lệ giao hàng chậm / không hoàn thành",
            "source": "INTERNAL",
            "status": "MODERATE_LATE_RATE",
            "points": late_points,
            "verified": True,
            "description": f"Tỷ lệ giao chậm là {late_delivery_rate}% ({late_orders_count}/{total_orders_count} đơn, 10% - <30%).",
            "related_items": late_order_numbers[:5],
        })

    # 5. Check Returns and Discounts in 12 Months (BR15, Step 13)
    total_purchase_val = orders_12m.aggregate(total=Sum("total_amount"))["total"] or Decimal("0")
    
    returns_12m = models.PurchaseReturn.objects.filter(
        company=company,
        supplier=supplier,
        document_date__gte=cutoff_date,
    ).exclude(status__in=["DRAFT", "CANCELLED"])
    total_return_val = returns_12m.aggregate(total=Sum("total_amount"))["total"] or Decimal("0")

    discounts_12m = models.PurchaseDiscount.objects.filter(
        company=company,
        supplier=supplier,
        document_date__gte=cutoff_date,
    ).exclude(status__in=["DRAFT", "CANCELLED"])
    total_discount_val = discounts_12m.aggregate(total=Sum("total_amount"))["total"] or Decimal("0")

    total_return_discount_val = total_return_val + total_discount_val
    return_discount_rate = 0.0
    if total_purchase_val > Decimal("0"):
        return_discount_rate = float(
            round((total_return_discount_val / total_purchase_val) * 100, 2)
        )
    elif total_return_discount_val > Decimal("0"):
        return_discount_rate = 100.0

    if return_discount_rate >= 20.0:
        ret_points = config.return_ratio_tier2_points  # default +20
        total_score += ret_points
        criteria_breakdown.append({
            "code": "RETURN_DISCOUNT_RATIO",
            "name": "Tỷ lệ hàng trả lại và giảm giá",
            "source": "INTERNAL",
            "status": "HIGH_RATIO",
            "points": ret_points,
            "verified": True,
            "description": f"Tỷ lệ hàng trả lại / giảm giá là {return_discount_rate}% (>= 20%).",
            "related_items": list(returns_12m.values_list("number", flat=True)[:3]) + list(discounts_12m.values_list("number", flat=True)[:3]),
        })
    elif return_discount_rate >= 5.0:
        ret_points = config.return_ratio_tier1_points  # default +10
        total_score += ret_points
        criteria_breakdown.append({
            "code": "RETURN_DISCOUNT_RATIO",
            "name": "Tỷ lệ hàng trả lại và giảm giá",
            "source": "INTERNAL",
            "status": "MODERATE_RATIO",
            "points": ret_points,
            "verified": True,
            "description": f"Tỷ lệ hàng trả lại / giảm giá là {return_discount_rate}% (5% - <20%).",
            "related_items": list(returns_12m.values_list("number", flat=True)[:3]) + list(discounts_12m.values_list("number", flat=True)[:3]),
        })

    # 6. Check Unresolved Incidents, Complaints, Breaches (BR16, Step 14)
    open_incidents = SupplierIncident.objects.filter(
        company=company,
        supplier=supplier,
        status=SupplierIncident.Status.OPEN,
    )
    open_incidents_count = open_incidents.count()
    if open_incidents_count > 0:
        inc_points = open_incidents_count * config.incident_points  # +20 per incident
        total_score += inc_points
        criteria_breakdown.append({
            "code": "UNRESOLVED_INCIDENTS",
            "name": "Khiếu nại / vi phạm chưa xử lý",
            "source": "INTERNAL",
            "status": "HAS_OPEN_INCIDENTS",
            "points": inc_points,
            "verified": True,
            "description": f"Có {open_incidents_count} sự cố, khiếu nại hoặc vi phạm chưa xử lý (+{config.incident_points} điểm/sự cố).",
            "related_items": list(open_incidents.values_list("title", flat=True)[:5]),
        })

    # Clamp total score between 0 and 100 (BR05, BR16)
    clamped_score = min(max(total_score, 0), 100)

    # 7. Determine Risk Level (BR06 - BR11, EX06, BR09)
    # Check if insufficient data (BR09, EX06): no orders, invoices, returns, discounts, incidents
    has_history = (
        total_orders_count > 0
        or total_invoices_count > 0
        or returns_12m.count() > 0
        or discounts_12m.count() > 0
        or open_incidents_count > 0
    )

    if is_blocked_status:
        # BR10: internal block list -> HIGH risk and transaction blocked
        risk_level = RiskLevel.HIGH
    elif tax_status.upper() in ["INACTIVE", "CLOSED", "WARNED", "CEASED", "SUSPENDED", "NOT_EXIST"]:
        # BR11: tax authority warning / ceased -> HIGH risk
        risk_level = RiskLevel.HIGH
    elif not has_history:
        # BR09, EX06: insufficient data must NOT be low
        risk_level = RiskLevel.INSUFFICIENT_DATA
    elif clamped_score >= config.medium_threshold + 1:  # 40 - 100 -> HIGH (BR08)
        risk_level = RiskLevel.HIGH
    elif clamped_score >= config.low_threshold + 1:  # 20 - 39 -> MEDIUM (BR07)
        risk_level = RiskLevel.MEDIUM
    else:  # 0 - 19 -> LOW (BR06)
        risk_level = RiskLevel.LOW

    # Calculate version and valid until (BR02, BR03, BR04)
    last_assessment = SupplierRiskAssessment.objects.filter(
        company=company,
        supplier=supplier,
    ).order_by("-version").first()
    next_version = (last_assessment.version + 1) if last_assessment else 1

    validity_days = config.validity_days or 30
    valid_until = now + timedelta(days=validity_days)

    data_summary = {
        "total_orders": total_orders_count,
        "late_orders": late_orders_count,
        "late_delivery_rate": late_delivery_rate,
        "total_invoices": total_invoices_count,
        "invalid_invoices": invalid_invoices_count,
        "duplicate_invoices": duplicate_invoices_count,
        "total_purchase_amount": float(total_purchase_val),
        "total_return_discount_amount": float(total_return_discount_val),
        "return_discount_rate": return_discount_rate,
        "open_incidents_count": open_incidents_count,
        "warnings": warnings,
    }

    # Save assessment (BR01, BR02, BR24, Step 20)
    with transaction.atomic():
        assessment = SupplierRiskAssessment.objects.create(
            company=company,
            supplier=supplier,
            valid_until=valid_until,
            score=clamped_score,
            risk_level=risk_level,
            is_blocked=is_blocked_status or (risk_level == RiskLevel.HIGH and is_blocked_status),
            tax_status=tax_status,
            tax_code_status_verified=tax_code_status_verified,
            criteria_breakdown=criteria_breakdown,
            data_summary=data_summary,
            assessed_by=user.iam_account if hasattr(user, "iam_account") else None,
            notes=notes,
            version=next_version,
        )

    return assessment


def check_transaction_allowed(
    company,
    supplier: Party,
    user,
    document_type: str,
    document_id: str = "",
    reason: str | None = None,
    allow_override: bool = False,
) -> dict:
    """
    Validates if creating a contract, purchase order, or voucher with this supplier is permitted.
    Enforces AF01, AF03, AF04, EX07, EX08, BR18 - BR21, BR25.
    Returns:
        {
            "allowed": bool,
            "status": "ALLOWED" | "REASON_REQUIRED" | "OVERRIDE_REQUIRED" | "BLOCKED" | "ASSESSMENT_REQUIRED",
            "message": str,
            "risk_level": str,
            "assessment": SupplierRiskAssessment | None,
        }
    """
    if not supplier:
        return {
            "allowed": False,
            "status": "BLOCKED",
            "message": "Vui lòng chọn nhà cung cấp.",
            "risk_level": "UNKNOWN",
            "assessment": None,
        }

    # EX07, BR21: Blocked supplier or ceased tax code is strictly disallowed
    if supplier.status == "BLOCKED":
        return {
            "allowed": False,
            "status": "BLOCKED",
            "message": "Nhà cung cấp đã bị chặn giao dịch trên hệ thống.",
            "risk_level": RiskLevel.HIGH,
            "assessment": None,
        }

    assessment = get_active_assessment(company, supplier)
    if not assessment:
        # AF01: No active valid risk assessment
        return {
            "allowed": False,
            "status": "ASSESSMENT_REQUIRED",
            "message": "Nhà cung cấp chưa có kết quả kiểm tra rủi ro còn hiệu lực.",
            "risk_level": "NONE",
            "assessment": None,
        }

    # BR21: Inactive / Ceased tax code cannot transact even if reason entered
    if assessment.tax_status.upper() in ["INACTIVE", "CLOSED", "WARNED", "CEASED", "SUSPENDED", "NOT_EXIST"]:
        return {
            "allowed": False,
            "status": "BLOCKED",
            "message": "Nhà cung cấp có mã số thuế không còn hoạt động hoặc bị cảnh báo, không thể thực hiện giao dịch.",
            "risk_level": assessment.risk_level,
            "assessment": assessment,
        }

    if assessment.is_blocked:
        return {
            "allowed": False,
            "status": "BLOCKED",
            "message": "Nhà cung cấp bị chặn giao dịch.",
            "risk_level": assessment.risk_level,
            "assessment": assessment,
        }

    # BR18: Low risk -> allowed normally
    if assessment.risk_level == RiskLevel.LOW:
        return {
            "allowed": True,
            "status": "ALLOWED",
            "message": "Nhà cung cấp có mức rủi ro Thấp, được phép giao dịch.",
            "risk_level": assessment.risk_level,
            "assessment": assessment,
        }

    # AF03, BR19, BR25: Medium risk -> requires confirmation reason
    if assessment.risk_level == RiskLevel.MEDIUM:
        if not reason or not reason.strip():
            return {
                "allowed": False,
                "status": "REASON_REQUIRED",
                "message": "Nhà cung cấp có mức rủi ro Trung bình. Vui lòng nhập lý do tiếp tục giao dịch.",
                "risk_level": assessment.risk_level,
                "assessment": assessment,
            }
        # Save override log (BR25)
        if allow_override:
            record_risk_override(
                company=company,
                supplier=supplier,
                user=user,
                assessment=assessment,
                risk_level=assessment.risk_level,
                document_type=document_type,
                document_id=document_id,
                reason=reason.strip(),
                is_exception_approved=True,
            )
        return {
            "allowed": True,
            "status": "ALLOWED",
            "message": "Đã ghi nhận lý do tiếp tục giao dịch với nhà cung cấp rủi ro trung bình.",
            "risk_level": assessment.risk_level,
            "assessment": assessment,
        }

    # AF04, EX08, BR20, BR25: High risk -> requires override permission and reason
    if assessment.risk_level == RiskLevel.HIGH:
        has_override_perm = (
            user.is_superuser
            or (
                hasattr(user, "iam_account")
                and has_effective_permission(user.iam_account, company, "PUR.SUPPLIER_RISK.OVERRIDE")
            )
        )
        if not has_override_perm:
            return {
                "allowed": False,
                "status": "OVERRIDE_REQUIRED",
                "message": "Bạn không có quyền cho phép giao dịch với nhà cung cấp rủi ro cao. Vui lòng gửi phê duyệt ngoại lệ.",
                "risk_level": assessment.risk_level,
                "assessment": assessment,
            }

        if not reason or not reason.strip():
            return {
                "allowed": False,
                "status": "REASON_REQUIRED",
                "message": "Nhà cung cấp có mức rủi ro Cao. Vui lòng nhập lý do tiếp tục giao dịch.",
                "risk_level": assessment.risk_level,
                "assessment": assessment,
            }

        if allow_override:
            record_risk_override(
                company=company,
                supplier=supplier,
                user=user,
                assessment=assessment,
                risk_level=assessment.risk_level,
                document_type=document_type,
                document_id=document_id,
                reason=reason.strip(),
                is_exception_approved=True,
                approved_by=user,
            )
        return {
            "allowed": True,
            "status": "ALLOWED",
            "message": "Đã phê duyệt ngoại lệ và ghi nhận lý do giao dịch với nhà cung cấp rủi ro cao.",
            "risk_level": assessment.risk_level,
            "assessment": assessment,
        }

    # INSUFFICIENT_DATA (BR09): Warning, can proceed with caution
    return {
        "allowed": True,
        "status": "ALLOWED",
        "message": "Nhà cung cấp chưa đủ dữ liệu đánh giá lịch sử. Đề nghị thận trọng khi giao dịch.",
        "risk_level": assessment.risk_level,
        "assessment": assessment,
    }


def record_risk_override(
    company,
    supplier: Party,
    user,
    assessment: SupplierRiskAssessment | None,
    risk_level: str,
    document_type: str,
    document_id: str,
    reason: str,
    is_exception_approved: bool = False,
    approved_by=None,
    approval_notes: str = "",
) -> SupplierRiskOverrideLog:
    """Save audit trail of override per BR25."""
    user_account = user.iam_account if hasattr(user, "iam_account") else None
    approver_account = (
        approved_by.iam_account
        if (approved_by and hasattr(approved_by, "iam_account"))
        else user_account
    )
    return SupplierRiskOverrideLog.objects.create(
        company=company,
        supplier=supplier,
        assessment=assessment,
        risk_level=risk_level,
        document_type=document_type,
        document_id=document_id,
        reason=reason,
        override_by=user_account,
        is_exception_approved=is_exception_approved,
        approved_by=approver_account if is_exception_approved else None,
        approval_notes=approval_notes,
    )
