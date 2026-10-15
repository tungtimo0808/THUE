from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from audit_log.services import record_audit
from iam.models import ActiveStatus, CompanyMembership, UserAccount
from iam.permissions import has_effective_permission
from .company_information import VersionConflict
from .models import Company, CompanyStatus, OrganizationUnit, OrganizationUnitHistory


EDITABLE_FIELDS = (
    "code", "name", "short_name", "manager_membership", "phone", "email", "address",
    "tax_code", "business_location_code", "start_date", "end_date", "description",
)


def snapshot(unit):
    return {
        "id": str(unit.id), "parent": str(unit.parent_id) if unit.parent_id else None,
        "unit_type": unit.unit_type, "code": unit.code, "name": unit.name,
        "short_name": unit.short_name,
        "manager_membership": str(unit.manager_membership_id) if unit.manager_membership_id else None,
        "phone": unit.phone, "email": unit.email, "address": unit.address, "tax_code": unit.tax_code,
        "business_location_code": unit.business_location_code,
        "start_date": unit.start_date.isoformat() if unit.start_date else None,
        "end_date": unit.end_date.isoformat() if unit.end_date else None,
        "status": unit.status, "description": unit.description,
    }


def authorize(account, company, code):
    if not CompanyMembership.objects.filter(company=company, user=account, membership_status=ActiveStatus.ACTIVE).exists():
        raise PermissionDenied("Bạn không còn là thành viên ACTIVE của doanh nghiệp.")
    if not has_effective_permission(account, company, code):
        raise PermissionDenied("Bạn không có Permission phù hợp để quản lý cơ cấu tổ chức.")


def ensure_editable_company(company):
    if company.status not in {CompanyStatus.ACTIVE, CompanyStatus.PENDING_SETUP}:
        raise PermissionDenied("Trạng thái doanh nghiệp hiện tại không cho phép thay đổi cơ cấu tổ chức.")


def validate_manager(company, membership_id):
    if membership_id is None:
        return None
    membership = CompanyMembership.objects.select_related("user__auth_user").filter(
        pk=membership_id, company=company, membership_status=ActiveStatus.ACTIVE,
        user__auth_user__is_active=True,
    ).first()
    if not membership:
        raise ValidationError({"manager_membership": "Người phụ trách phải là thành viên ACTIVE và không bị khóa."})
    return membership


def validate_parent(company, parent, unit_type, start_date, unit=None):
    if parent.company_id != company.id:
        raise ValidationError({"parent": "Đơn vị cấp trên phải thuộc cùng doanh nghiệp."})
    if parent.end_date is not None:
        raise ValidationError({"parent": "Đơn vị cấp trên đã có lịch ngừng sử dụng; hãy chọn cấp trên khác."})
    if parent.status != "ACTIVE" or parent.start_date > start_date:
        raise ValidationError({"parent": "Đơn vị cấp trên không hoạt động tại ngày đơn vị con có hiệu lực."})
    allowed = {
        "BRANCH": {"COMPANY"}, "DEPARTMENT": {"COMPANY", "BRANCH", "DEPARTMENT"},
        "OTHER": {"COMPANY", "BRANCH", "DEPARTMENT", "OTHER"},
    }
    if parent.unit_type not in allowed[unit_type]:
        raise ValidationError({"parent": "Loại đơn vị cấp trên không phù hợp."})
    if unit:
        if parent.pk == unit.pk:
            raise ValidationError({"parent": "Không thể di chuyển đơn vị vào chính nó."})
        ancestor = parent
        visited = set()
        while ancestor:
            if ancestor.pk == unit.pk:
                raise ValidationError({"parent": "Không thể di chuyển đơn vị vào một đơn vị con của nó."})
            if ancestor.pk in visited:
                raise ValidationError({"parent": "Cơ cấu hiện tại đã có quan hệ vòng lặp."})
            visited.add(ancestor.pk)
            if ancestor.pending_parent_id and ancestor.pending_move_effective_from <= start_date:
                ancestor = ancestor.pending_parent
            else:
                ancestor = ancestor.parent


def record_history(unit, action, actor, before, after, request, effective_from=None):
    OrganizationUnitHistory.objects.create(
        unit=unit, action=action, effective_from=effective_from or timezone.localdate(),
        before=before, after=after, actor_user_id=actor.id,
    )
    record_audit(
        company=unit.company, actor_user=actor, module_code="SYS", action_code=f"ORG_UNIT_{action}",
        entity=unit, before=before, after=after, request=request,
    )


@transaction.atomic
def apply_due(unit, request=None):
    unit = OrganizationUnit.objects.select_for_update().select_related("company", "pending_parent").get(pk=unit.pk)
    today = timezone.localdate()
    if unit.pending_parent_id and unit.pending_move_effective_from <= today:
        effective_from = unit.pending_move_effective_from
        validate_parent(unit.company, unit.pending_parent, unit.unit_type, effective_from, unit)
        before = snapshot(unit)
        move = unit.history.filter(action="MOVE", effective_from=effective_from).order_by("-occurred_at").first()
        actor_id = move.actor_user_id if move else unit.updated_by_user_id
        unit.parent = unit.pending_parent; unit.pending_parent = None; unit.pending_move_effective_from = None
        unit.save(update_fields=("parent", "pending_parent", "pending_move_effective_from", "updated_at"))
        record_history(unit, "APPLY_MOVE", UserAccount.objects.get(pk=actor_id), before, snapshot(unit), request, effective_from)
    if unit.status == "ACTIVE" and unit.end_date and unit.end_date < today:
        before = snapshot(unit)
        stop = unit.history.filter(action="DEACTIVATE", effective_from=unit.end_date).order_by("-occurred_at").first()
        actor_id = stop.actor_user_id if stop else unit.updated_by_user_id
        unit.status = "INACTIVE"
        unit.save(update_fields=("status", "updated_at"))
        record_history(unit, "APPLY_DEACTIVATE", UserAccount.objects.get(pk=actor_id), before, snapshot(unit), request, unit.end_date)
    return unit


@transaction.atomic
def create_unit(company, actor, data, request):
    ensure_editable_company(company); authorize(actor, company, "SYS.ORG_STRUCTURE.CREATE")
    parent = OrganizationUnit.objects.select_for_update().filter(pk=data["parent"]).first()
    if not parent: raise ValidationError({"parent": "Đơn vị cấp trên không tồn tại."})
    validate_parent(company, parent, data["unit_type"], data["start_date"])
    manager = validate_manager(company, data.get("manager_membership"))
    values = {k: v for k, v in data.items() if k not in {"parent", "manager_membership", "version"}}
    try:
        unit = OrganizationUnit.objects.create(
            company=company, parent=parent, manager_membership=manager, status="ACTIVE",
            created_by_user_id=actor.id, updated_by_user_id=actor.id, **values,
        )
    except IntegrityError as exc:
        raise ValidationError({"code": "Mã đơn vị đã được sử dụng trong doanh nghiệp."}) from exc
    record_history(unit, "CREATE", actor, {}, snapshot(unit), request, unit.start_date)
    return unit


@transaction.atomic
def update_unit(unit_id, company, actor, data, request):
    ensure_editable_company(company); authorize(actor, company, "SYS.ORG_STRUCTURE.EDIT")
    unit = apply_due(OrganizationUnit.objects.select_for_update().get(pk=unit_id, company=company), request=request)
    if unit.unit_type == "COMPANY": raise ValidationError("Không được cập nhật nút doanh nghiệp tại chức năng này.")
    if unit.updated_at != data["version"]: raise VersionConflict({"version": "Đơn vị đã được User khác cập nhật."})
    before = snapshot(unit); values = dict(data); values.pop("version")
    if "unit_type" in values and values["unit_type"] != unit.unit_type:
        if unit.children.exists() or unit.dependencies.filter(is_active=True).exists():
            raise ValidationError({"unit_type": "Không thể đổi loại khi đơn vị còn quan hệ hoặc dữ liệu phụ thuộc."})
        validate_parent(company, unit.parent, values["unit_type"], values.get("start_date", unit.start_date), unit)
        unit.unit_type = values.pop("unit_type")
    if "start_date" in values and values["start_date"] != unit.start_date:
        validate_parent(company, unit.parent, unit.unit_type, values["start_date"], unit)
        if unit.children.filter(start_date__lt=values["start_date"]).exists():
            raise ValidationError({"start_date": "Ngày bắt đầu không được sau ngày bắt đầu của đơn vị con."})
    if "manager_membership" in values:
        unit.manager_membership = validate_manager(company, values.pop("manager_membership"))
    start = values.get("start_date", unit.start_date); end = values.get("end_date", unit.end_date)
    if end and end < start: raise ValidationError({"end_date": "Ngày kết thúc không được trước ngày bắt đầu."})
    for key, value in values.items(): setattr(unit, key, value)
    unit.updated_by_user_id = actor.id
    try: unit.save()
    except IntegrityError as exc: raise ValidationError({"code": "Mã đơn vị đã được sử dụng trong doanh nghiệp."}) from exc
    after = snapshot(unit)
    if before == after: raise ValidationError("Dữ liệu gửi lên không tạo ra thay đổi nào.")
    record_history(unit, "UPDATE", actor, before, after, request)
    return unit


@transaction.atomic
def move_unit(unit_id, company, actor, data, request):
    ensure_editable_company(company); authorize(actor, company, "SYS.ORG_STRUCTURE.MOVE")
    unit = OrganizationUnit.objects.select_for_update().get(pk=unit_id, company=company)
    if unit.unit_type == "COMPANY": raise ValidationError("Không được di chuyển nút doanh nghiệp.")
    if unit.updated_at != data["version"]: raise VersionConflict({"version": "Đơn vị đã được User khác cập nhật."})
    if unit.status != "ACTIVE" or unit.start_date > data["effective_from"] or (unit.end_date and unit.end_date < data["effective_from"]):
        raise ValidationError({"effective_from": "Đơn vị không hoạt động tại ngày di chuyển."})
    if unit.pending_parent_id:
        raise ValidationError({"parent": "Đơn vị đã có lịch di chuyển chờ hiệu lực."})
    if data["effective_from"] < timezone.localdate():
        raise ValidationError({"effective_from": "Ngày hiệu lực di chuyển không được nằm trong quá khứ."})
    parent = OrganizationUnit.objects.select_for_update().filter(pk=data["parent"]).first()
    if not parent: raise ValidationError({"parent": "Đơn vị cấp trên không tồn tại."})
    if parent.pk == unit.parent_id:
        raise ValidationError({"parent": "Đơn vị đã thuộc cấp trên này."})
    validate_parent(company, parent, unit.unit_type, data["effective_from"], unit)
    impacts = list(unit.dependencies.filter(is_active=True).values("dependency_type", "reference"))
    if unit.manager_membership_id:
        impacts.append({"dependency_type": "MANAGER", "reference": str(unit.manager_membership_id)})
    if impacts and not data.get("confirm_impact"):
        raise ValidationError({"impacts": impacts, "confirm_impact": "Hãy xác nhận ảnh hưởng trước khi di chuyển."})
    before = snapshot(unit)
    if data["effective_from"] > timezone.localdate():
        unit.pending_parent = parent; unit.pending_move_effective_from = data["effective_from"]
    else: unit.parent = parent; unit.pending_parent = None; unit.pending_move_effective_from = None
    unit.updated_by_user_id = actor.id; unit.save()
    record_history(unit, "MOVE", actor, before, snapshot(unit), request, data["effective_from"])
    return unit


@transaction.atomic
def deactivate_unit(unit_id, company, actor, data, request):
    ensure_editable_company(company); authorize(actor, company, "SYS.ORG_STRUCTURE.DEACTIVATE")
    unit = OrganizationUnit.objects.select_for_update().get(pk=unit_id, company=company)
    if unit.unit_type == "COMPANY": raise ValidationError("Không được ngừng nút doanh nghiệp.")
    if unit.updated_at != data["version"]: raise VersionConflict({"version": "Đơn vị đã được User khác cập nhật."})
    if unit.status != "ACTIVE" or unit.end_date is not None:
        raise ValidationError({"status": "Đơn vị đã ngừng hoặc đã có lịch ngừng sử dụng."})
    if not data["confirm"]: raise ValidationError({"confirm": "Bạn phải xác nhận ngừng sử dụng đơn vị."})
    if data["end_date"] < timezone.localdate():
        raise ValidationError({"end_date": "Ngày ngừng sử dụng không được nằm trong quá khứ."})
    active_children = list(unit.children.filter(status="ACTIVE").values("id", "code", "name"))
    if active_children: raise ValidationError({"children": active_children})
    pending_children = list(unit.pending_children.filter(status="ACTIVE").values("id", "code", "name"))
    if pending_children:
        raise ValidationError({"children": pending_children, "end_date": "Đơn vị đang là cấp trên chờ hiệu lực của đơn vị khác."})
    if unit.manager_membership_id:
        raise ValidationError({"assignments": [{"manager_membership": str(unit.manager_membership_id)}]})
    deps = list(unit.dependencies.filter(is_active=True).values("dependency_type", "reference"))
    if deps: raise ValidationError({"dependencies": deps})
    if data["end_date"] < unit.start_date: raise ValidationError({"end_date": "Ngày kết thúc không được trước ngày bắt đầu."})
    before = snapshot(unit); unit.end_date = data["end_date"]
    if data["end_date"] <= timezone.localdate(): unit.status = "INACTIVE"
    unit.updated_by_user_id = actor.id; unit.save(); record_history(unit, "DEACTIVATE", actor, before, snapshot(unit), request, data["end_date"])
    return unit


@transaction.atomic
def reactivate_unit(unit_id, company, actor, data, request):
    ensure_editable_company(company); authorize(actor, company, "SYS.ORG_STRUCTURE.REACTIVATE")
    unit = OrganizationUnit.objects.select_for_update().get(pk=unit_id, company=company)
    if unit.unit_type == "COMPANY": raise ValidationError("Không được kích hoạt lại nút doanh nghiệp tại chức năng này.")
    if unit.updated_at != data["version"]: raise VersionConflict({"version": "Đơn vị đã được User khác cập nhật."})
    if unit.status != "INACTIVE": raise ValidationError({"status": "Chỉ đơn vị INACTIVE mới được kích hoạt lại."})
    if data["start_date"] < timezone.localdate():
        raise ValidationError({"start_date": "Ngày kích hoạt lại không được nằm trong quá khứ."})
    validate_parent(company, unit.parent, unit.unit_type, data["start_date"], unit)
    before = snapshot(unit); unit.start_date = data["start_date"]; unit.end_date = None; unit.status = "ACTIVE"
    unit.updated_by_user_id = actor.id; unit.save(); record_history(unit, "REACTIVATE", actor, before, snapshot(unit), request, data["start_date"])
    return unit
