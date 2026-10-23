"""UC-TAX-08 MVP: registered forms and traceable VAT declaration drafts."""
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from audit_log.services import record_audit

from . import models, services, vat


FORM_CATALOG = {
    "01/GTGT": "Theo tháng",
    "02/GTGT": "Theo tháng",
    "03/GTGT": "Theo tháng",
    "05/KK-TNCN": "Theo tháng",
    "05/QTT-TNCN": "Theo năm",
    "DS-TNCN": "Theo từng lần phát sinh",
    "03/TNDN": "Theo năm",
    "01/TTĐB": "Theo tháng",
    "01/TAIN": "Theo tháng",
}


def registrations(company):
    return list(models.CompanyTaxFormRegistration.objects.filter(company=company, is_active=True)
                .order_by("form_code").values("form_code", "frequency"))


@transaction.atomic
def save_registrations(company, forms, request):
    if not isinstance(forms, list) or len(forms) != len(set(forms)) or any(code not in FORM_CATALOG for code in forms):
        raise ValidationError({"forms": "Danh sách mã tờ khai không hợp lệ hoặc bị trùng."})
    models.CompanyTaxFormRegistration.objects.filter(company=company).exclude(form_code__in=forms).update(is_active=False)
    for code in forms:
        models.CompanyTaxFormRegistration.objects.update_or_create(company=company, form_code=code,
            defaults={"frequency": FORM_CATALOG[code], "is_active": True})
    record_audit(company=company, actor_user=services.actor(request), module_code="TAX",
                 action_code="REGISTER_TAX_FORMS", entity=company, after={"forms": forms}, request=request)
    return registrations(company)


def source_current(declaration):
    return (declaration.source_calculation.source_snapshot_hash == declaration.source_snapshot_hash
            and vat.is_current(declaration.source_calculation))


def snapshot(calculation):
    return {
        "input_tax": str(calculation.input_tax_amount),
        "input_deductible": str(calculation.input_deductible_amount),
        "output_tax": str(calculation.output_tax_amount),
        "deducted": str(calculation.deducted_amount),
        "payable": str(calculation.payable_amount),
        "carry_forward": str(calculation.carry_forward_out),
    }


@transaction.atomic
def create_declaration(company, period_id, request):
    period = models.TaxPeriod.objects.select_for_update().filter(pk=period_id, company=company, tax_type="VAT").first()
    if not period or period.status != "OPEN":
        raise ValidationError({"period": "Kỳ thuế GTGT không hợp lệ hoặc đã khóa."})
    if not models.CompanyTaxFormRegistration.objects.filter(company=company, form_code="01/GTGT", is_active=True).exists():
        raise ValidationError({"form_code": "Hãy đăng ký mẫu 01/GTGT trước khi lập hồ sơ."})
    existing = models.TaxDeclaration.objects.filter(period=period, form_code="01/GTGT", version=1).first()
    if existing:
        return existing, False
    calculation = models.VatCalculation.objects.filter(period=period).order_by("-version").first()
    if not calculation:
        raise ValidationError({"calculation": "Chưa có kết quả tổng hợp GTGT cho kỳ này."})
    if not vat.is_current(calculation):
        raise ValidationError({"calculation": "Kết quả tổng hợp GTGT đã cũ; hãy tính lại ở UC-TAX-07."})
    declaration = models.TaxDeclaration.objects.create(company=company, period=period,
        form_code="01/GTGT", source_calculation=calculation,
        source_snapshot_hash=calculation.source_snapshot_hash,
        indicators=snapshot(calculation) if calculation.status == "CALCULATED" else {},
        warnings=calculation.warnings, preparation_status="REVIEW_REQUIRED" if calculation.status != "CALCULATED" else "DRAFT",
        created_by=services.actor(request))
    services.audit(request, declaration, "CREATE", after={"calculation": str(calculation.id), "version": 1})
    return declaration, True


@transaction.atomic
def refresh(declaration, request):
    declaration = models.TaxDeclaration.objects.select_for_update().get(pk=declaration.pk)
    if declaration.preparation_status == "READY_TO_SUBMIT":
        raise ValidationError("Hồ sơ đã xác nhận; không thể lấy lại dữ liệu vào bản cố định.")
    calculation = models.VatCalculation.objects.filter(period=declaration.period).order_by("-version").first()
    if not calculation or not vat.is_current(calculation):
        raise ValidationError("Chưa có kết quả GTGT mới còn hiệu lực; hãy tính lại ở UC-TAX-07.")
    declaration.source_calculation = calculation
    declaration.source_snapshot_hash = calculation.source_snapshot_hash
    declaration.indicators = snapshot(calculation) if calculation.status == "CALCULATED" else {}
    declaration.warnings = calculation.warnings
    declaration.preparation_status = "DRAFT" if calculation.status == "CALCULATED" else "REVIEW_REQUIRED"
    declaration.row_version += 1
    declaration.save(update_fields=("source_calculation", "source_snapshot_hash", "indicators", "warnings",
                                    "preparation_status", "row_version", "updated_at"))
    services.audit(request, declaration, "REFRESH_SOURCE", after={"calculation": str(calculation.id),
        "version": calculation.version, "status": declaration.preparation_status})
    return declaration


@transaction.atomic
def save_draft(declaration, data, request):
    declaration = models.TaxDeclaration.objects.select_for_update().get(pk=declaration.pk)
    if declaration.preparation_status == "READY_TO_SUBMIT":
        raise ValidationError("Hồ sơ đã xác nhận; không thể sửa bản cố định.")
    if data.get("row_version") != declaration.row_version:
        raise ValidationError({"row_version": "Hồ sơ đã được thay đổi ở phiên khác; hãy tải lại."})
    declaration.notes = str(data.get("notes", declaration.notes)).strip()[:2000]
    declaration.row_version += 1
    declaration.save(update_fields=("notes", "row_version", "updated_at"))
    services.audit(request, declaration, "SAVE_DRAFT", after={"row_version": declaration.row_version})
    return declaration


@transaction.atomic
def confirm(declaration, request):
    declaration = models.TaxDeclaration.objects.select_for_update().select_related("source_calculation", "period").get(pk=declaration.pk)
    if declaration.preparation_status == "READY_TO_SUBMIT":
        return declaration
    if declaration.period.status != "OPEN" or not source_current(declaration):
        raise ValidationError("Nguồn GTGT đã thay đổi hoặc kỳ đã khóa; hãy lập lại kết quả và rà soát hồ sơ.")
    if declaration.source_calculation.status != "CALCULATED" or declaration.warnings:
        raise ValidationError("Kết quả GTGT còn cảnh báo cần rà soát; chưa thể xác nhận hồ sơ.")
    if declaration.indicators != snapshot(declaration.source_calculation):
        raise ValidationError("Chỉ tiêu không khớp kết quả tổng hợp GTGT.")
    declaration.preparation_status = "READY_TO_SUBMIT"
    declaration.confirmed_at = timezone.now()
    declaration.confirmed_by = services.actor(request)
    declaration.row_version += 1
    declaration.save(update_fields=("preparation_status", "confirmed_at", "confirmed_by", "row_version", "updated_at"))
    services.audit(request, declaration, "CONFIRM", after={"version": declaration.version, "status": declaration.preparation_status})
    return declaration
