from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from audit_log.services import record_audit
from iam.models import ActiveStatus, CompanyMembership, UserAccount
from iam.permissions import has_effective_permission

from .models import Company, CompanyInformationVersion, CompanyStatus


INFORMATION_FIELDS = (
    "legal_name", "short_name", "name", "business_type", "legal_representative",
    "representative_title", "country_code", "province", "district", "ward", "address",
    "phone", "email", "website", "timezone", "default_locale",
)
LEGAL_FIELDS = {
    "legal_name", "business_type", "legal_representative", "representative_title",
    "country_code", "province", "district", "ward", "address",
}


class VersionConflict(ValidationError):
    status_code = 409
    default_code = "version_conflict"


def snapshot(company):
    result = {field: getattr(company, field) for field in INFORMATION_FIELDS}
    result["logo"] = company.logo.name if company.logo else ""
    return result


def authorize(account, company, permission_code):
    if not CompanyMembership.objects.filter(
        company=company, user=account, membership_status=ActiveStatus.ACTIVE
    ).exists():
        raise PermissionDenied("Bạn không còn tư cách thành viên ACTIVE tại doanh nghiệp này.")
    if not has_effective_permission(account, company, permission_code):
        raise PermissionDenied("Bạn không có Permission phù hợp với thông tin doanh nghiệp.")


def _apply_snapshot(company, data):
    selected_fields = data.get("_changed_fields", INFORMATION_FIELDS)
    for field in selected_fields:
        if field in data:
            setattr(company, field, data[field])
    if "logo" in selected_fields and "logo" in data:
        company.logo = data["logo"]
    update_fields = [field for field in selected_fields if field in INFORMATION_FIELDS]
    if "logo" in selected_fields:
        update_fields.append("logo")
    company.save(update_fields=(*update_fields, "updated_at"))


@transaction.atomic
def apply_due_versions(company, request=None):
    company = Company.objects.select_for_update().get(pk=company.pk)
    due = list(company.information_versions.select_for_update().filter(
        status=CompanyInformationVersion.VersionStatus.PENDING,
        effective_from__lte=timezone.localdate(),
    ).order_by("effective_from", "created_at"))
    for version in due:
        before = snapshot(company)
        company.information_versions.filter(status=CompanyInformationVersion.VersionStatus.ACTIVE).update(
            status=CompanyInformationVersion.VersionStatus.SUPERSEDED
        )
        _apply_snapshot(company, version.data)
        version.status = CompanyInformationVersion.VersionStatus.ACTIVE
        version.applied_at = timezone.now()
        version.save(update_fields=("status", "applied_at"))
        actor = UserAccount.objects.get(pk=version.created_by_user_id)
        record_audit(
            company=company, actor_user=actor, module_code="SYS", action_code="APPLY_COMPANY_INFORMATION",
            entity=company, before=before, after=snapshot(company), request=request,
        )
    return company


def update_company_information(*, company_id, account, data, request):
    new_logo_name = None
    new_logo_requested = data.get("logo") is not None
    old_logo_name = ""
    company = None
    try:
        with transaction.atomic():
            company = Company.objects.select_for_update().get(pk=company_id)
            old_logo_name = company.logo.name if company.logo else ""
            authorize(account, company, "SYS.COMPANY_PROFILE.EDIT")
            if company.status == CompanyStatus.INACTIVE:
                raise PermissionDenied("Doanh nghiệp INACTIVE không được cập nhật theo luồng thông thường.")
            if company.status == CompanyStatus.SUSPENDED:
                authorize(account, company, "SYS.COMPANY_PROFILE.EDIT_SUSPENDED")
            if company.updated_at != data["version"]:
                raise VersionConflict({
                    "version": "Thông tin đã được User khác cập nhật. Vui lòng tải phiên bản mới."
                })

            values = dict(data)
            expected_version = values.pop("version")
            effective_from = values.pop("effective_from", None)
            remove_logo = values.pop("remove_logo", False)
            logo = values.pop("logo", None)
            changed = {field: value for field, value in values.items() if getattr(company, field) != value}
            if logo is not None or (remove_logo and company.logo):
                changed["logo"] = "" if remove_logo else "[new logo]"
            if not changed:
                raise ValidationError("Dữ liệu gửi lên không tạo ra thay đổi nào.")

            legal_changed = bool(LEGAL_FIELDS & set(changed))
            if legal_changed and effective_from is None:
                raise ValidationError({"effective_from": "Ngày bắt đầu áp dụng là bắt buộc với thay đổi pháp lý."})
            if effective_from and effective_from < timezone.localdate():
                raise ValidationError({"effective_from": "Ngày bắt đầu áp dụng không được nằm trong quá khứ."})

            before = snapshot(company)
            proposed = {**before, **{key: value for key, value in changed.items() if key != "logo"}}
            required_fields = {
                "legal_name": "Tên pháp lý",
                "name": "Tên hiển thị",
                "business_type": "Loại hình doanh nghiệp",
                "legal_representative": "Người đại diện theo pháp luật",
                "country_code": "Quốc gia",
                "province": "Tỉnh/Thành phố",
                "address": "Địa chỉ chi tiết",
                "timezone": "Múi giờ",
                "default_locale": "Ngôn ngữ mặc định",
            }
            missing = {
                field: f"{label} là bắt buộc."
                for field, label in required_fields.items()
                if not proposed.get(field)
            }
            if missing:
                raise ValidationError(missing)
            if effective_from and effective_from > timezone.localdate():
                if company.information_versions.filter(
                    status=CompanyInformationVersion.VersionStatus.PENDING,
                    effective_from=effective_from,
                ).exists():
                    raise ValidationError({"effective_from": "Đã có phiên bản chờ hiệu lực tại ngày này."})
                if legal_changed:
                    deferred = {field: value for field, value in changed.items() if field in LEGAL_FIELDS}
                    immediate = {field: value for field, value in values.items() if field not in LEGAL_FIELDS and field in changed}
                else:
                    if "logo" in changed:
                        raise ValidationError({"logo": "Logo không hỗ trợ thay đổi chờ hiệu lực; hãy cập nhật riêng."})
                    deferred = dict(changed)
                    immediate = {}
                if immediate or "logo" in changed:
                    if not company.information_versions.exists():
                        CompanyInformationVersion.objects.create(
                            company=company, effective_from=company.created_at.date(),
                            status=CompanyInformationVersion.VersionStatus.SUPERSEDED, data=before,
                            based_on_updated_at=company.updated_at, created_by_user_id=account.id,
                            applied_at=company.created_at,
                        )
                    company.information_versions.filter(status=CompanyInformationVersion.VersionStatus.ACTIVE).update(
                        status=CompanyInformationVersion.VersionStatus.SUPERSEDED
                    )
                    for field, value in immediate.items():
                        setattr(company, field, value)
                    if logo is not None:
                        company.logo = logo
                    elif remove_logo:
                        company.logo = ""
                    changed_now = [*immediate]
                    if "logo" in changed:
                        changed_now.append("logo")
                    company.save(update_fields=(*changed_now, "updated_at"))
                    if logo is not None:
                        new_logo_name = company.logo.name
                    current = snapshot(company)
                    CompanyInformationVersion.objects.create(
                        company=company, effective_from=timezone.localdate(),
                        status=CompanyInformationVersion.VersionStatus.ACTIVE, data=current,
                        based_on_updated_at=expected_version, created_by_user_id=account.id,
                        applied_at=timezone.now(),
                    )
                    record_audit(
                        company=company, actor_user=account, module_code="SYS",
                        action_code="UPDATE_COMPANY_INFORMATION", entity=company,
                        before=before, after=current, request=request,
                    )
                current = snapshot(company)
                proposed = {**current, **deferred, "_changed_fields": sorted(deferred)}
                version = CompanyInformationVersion.objects.create(
                    company=company, effective_from=effective_from,
                    status=CompanyInformationVersion.VersionStatus.PENDING, data=proposed,
                    based_on_updated_at=company.updated_at, created_by_user_id=account.id,
                )
                record_audit(
                    company=company, actor_user=account, module_code="SYS",
                    action_code="SCHEDULE_COMPANY_INFORMATION", entity=company,
                    before=current, after=proposed, request=request,
                )
                return company, version, True

            if not company.information_versions.exists():
                CompanyInformationVersion.objects.create(
                    company=company, effective_from=company.created_at.date(),
                    status=CompanyInformationVersion.VersionStatus.SUPERSEDED, data=before,
                    based_on_updated_at=company.updated_at, created_by_user_id=account.id,
                    applied_at=company.created_at,
                )
            company.information_versions.filter(status=CompanyInformationVersion.VersionStatus.ACTIVE).update(
                status=CompanyInformationVersion.VersionStatus.SUPERSEDED
            )
            for field, value in values.items():
                setattr(company, field, value)
            if logo is not None:
                company.logo = logo
            elif remove_logo:
                company.logo = ""
            company.save(update_fields=(*values.keys(), "logo", "updated_at"))
            if logo is not None:
                new_logo_name = company.logo.name
            after = snapshot(company)
            version = CompanyInformationVersion.objects.create(
                company=company, effective_from=effective_from or timezone.localdate(),
                status=CompanyInformationVersion.VersionStatus.ACTIVE, data=after,
                based_on_updated_at=expected_version, created_by_user_id=account.id,
                applied_at=timezone.now(),
            )
            record_audit(
                company=company, actor_user=account, module_code="SYS", action_code="UPDATE_COMPANY_INFORMATION",
                entity=company, before=before, after=after, request=request,
            )
            return company, version, False
    except Exception:
        candidate_logo_name = new_logo_name
        if not candidate_logo_name and new_logo_requested and company and company.logo:
            candidate_logo_name = company.logo.name
        if candidate_logo_name and candidate_logo_name != old_logo_name:
            company.logo.storage.delete(candidate_logo_name)
        raise
