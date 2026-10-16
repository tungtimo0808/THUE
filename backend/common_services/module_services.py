from datetime import timedelta
import logging
from django.apps import apps
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from audit_log.services import record_audit
from common_services.models import (
    CompanyModuleConfig,
    CoreCompanySetting,
    ModuleCatalog,
    ModuleCategory,
    ModuleStatus,
)
from iam.permissions import has_effective_permission

logger = logging.getLogger(__name__)

MODULE_MODEL_MAP = {
    "PUR": [("purchases", "PurchaseRequest"), ("purchases", "PurchaseOrder"), ("purchases", "PurchaseContract")],
    "AP": [("accounts_payable", "SupplierInvoice"), ("accounts_payable", "PaymentRequest")],
    "SAL": [("sales", "SalesQuotation"), ("sales", "SalesOrder"), ("sales", "SalesContract")],
    "AR": [("accounts_receivable", "CustomerInvoice")],
    "CASH": [("cash_management", "CashTransaction")],
    "BANK": [("bank_management", "BankTransaction")],
    "INV": [("inventory", "InventoryTransaction")],
    "FA": [("fixed_assets", "FixedAsset")],
    "GL": [("general_ledger", "JournalEntry")],
    "TAX": [("tax_management", "TaxDeclaration")],
    "WF": [("approval_workflows", "ApprovalRequest")],
}


def sync_company_enabled_modules(company):
    """Synchronize company's active modules into CoreCompanySetting.configuration["enabled_modules"].

    This guarantees seamless compatibility with iam/permissions.py, access_services, and search.
    """
    today = timezone.localdate()

    # Active configs where status is ENABLED and effective dates are current
    active_codes = set(
        CompanyModuleConfig.objects.filter(
            company=company,
            status=ModuleStatus.ENABLED,
        ).filter(
            Q(effective_from__isnull=True) | Q(effective_from__lte=today)
        ).filter(
            Q(effective_to__isnull=True) | Q(effective_to__gte=today)
        ).values_list("module_id", flat=True)
    )

    # SYSTEM_REQUIRED modules are always enabled
    system_required = set(
        ModuleCatalog.objects.filter(category=ModuleCategory.SYSTEM_REQUIRED).values_list("code", flat=True)
    )
    all_enabled = sorted(list(active_codes | system_required))

    setting, _ = CoreCompanySetting.objects.get_or_create(company=company)
    config = dict(setting.configuration or {})
    config["enabled_modules"] = all_enabled
    setting.configuration = config
    setting.ai_enabled = "AI" in all_enabled
    setting.save(update_fields=("configuration", "ai_enabled", "updated_at"))
    return all_enabled


def check_module_active(company, module_code):
    """Check if a module is currently active and usable in a company."""
    catalog = ModuleCatalog.objects.filter(code=module_code).first()
    if not catalog:
        return False
    if catalog.category == ModuleCategory.SYSTEM_REQUIRED:
        return True

    today = timezone.localdate()
    config = CompanyModuleConfig.objects.filter(company=company, module=catalog).first()
    if config:
        if config.status != ModuleStatus.ENABLED:
            return False
        if config.effective_from and config.effective_from > today:
            return False
        if config.effective_to and config.effective_to < today:
            return False
        return True

    # If unconfigured in CompanyModuleConfig, fallback to CoreCompanySetting
    setting = CoreCompanySetting.objects.filter(company=company).first()
    if setting and setting.configuration:
        enabled_list = setting.configuration.get("enabled_modules") or []
        if module_code in enabled_list:
            return True

    return False


def list_modules(company):
    """List all modules in catalog along with their configuration status for the company."""
    catalog_items = list(ModuleCatalog.objects.filter(is_active=True).order_by("display_order", "code"))
    configs = {
        cfg.module_id: cfg
        for cfg in CompanyModuleConfig.objects.filter(company=company).select_related("updated_by")
    }

    setting = CoreCompanySetting.objects.filter(company=company).first()
    enabled_in_setting = set(setting.configuration.get("enabled_modules") or []) if setting and setting.configuration else set()

    result = []
    for item in catalog_items:
        cfg = configs.get(item.code)
        if cfg:
            curr_status = cfg.status
            eff_from = cfg.effective_from
            eff_to = cfg.effective_to
            configuration = cfg.configuration or item.default_config
            reason = cfg.reason
            notes = cfg.notes
            version = cfg.version
            updated_at = cfg.updated_at
            updated_by = getattr(cfg.updated_by, "display_name", str(cfg.updated_by_id)) if cfg.updated_by else None
        else:
            is_sys = item.category == ModuleCategory.SYSTEM_REQUIRED
            is_in_setting = item.code in enabled_in_setting
            curr_status = ModuleStatus.ENABLED if (is_sys or is_in_setting) else ModuleStatus.NOT_CONFIGURED
            eff_from = None
            eff_to = None
            configuration = item.default_config
            reason = ""
            notes = ""
            version = 1
            updated_at = None
            updated_by = None

        result.append({
            "code": item.code,
            "name": item.name,
            "category": item.category,
            "description": item.description,
            "icon": item.icon,
            "dependencies": item.dependencies,
            "menu_group": item.menu_group,
            "status": curr_status,
            "effective_from": eff_from.isoformat() if eff_from else None,
            "effective_to": eff_to.isoformat() if eff_to else None,
            "configuration": configuration,
            "reason": reason,
            "notes": notes,
            "version": version,
            "updated_at": updated_at,
            "updated_by": updated_by,
        })
    return result


def module_impact_summary(company, module_code):
    """Analyze historical data, active dependent modules, and in-flight tasks before disabling."""
    catalog = ModuleCatalog.objects.filter(code=module_code).first()
    if not catalog:
        raise ValidationError(f"Phân hệ '{module_code}' không tồn tại trong Module Catalog.")

    # 1. Dependent modules currently enabled
    dependent_modules = []
    all_modules = ModuleCatalog.objects.filter(is_active=True)
    for m in all_modules:
        if module_code in m.dependencies and check_module_active(company, m.code):
            dependent_modules.append({"code": m.code, "name": m.name})

    # 2. Count records and pending workflows
    historical_count = 0
    pending_tasks_count = 0

    model_pairs = MODULE_MODEL_MAP.get(module_code, [])
    for app_label, model_name in model_pairs:
        try:
            model = apps.get_model(app_label, model_name)
            qs = model.objects.filter(company=company)
            historical_count += qs.count()
            if hasattr(model, "status"):
                pending_tasks_count += qs.filter(status__in=("PENDING_APPROVAL", "IN_PROGRESS", "DRAFT")).count()
        except LookupError:
            continue

    # Also check approval requests specifically
    try:
        from approval_workflows.models import ApprovalRequest
        wf_pending = ApprovalRequest.objects.filter(
            company=company,
            document_type__module_code=module_code,
            status__in=("PENDING_APPROVAL", "IN_PROGRESS"),
        ).count()
        pending_tasks_count += wf_pending
    except Exception:
        pass

    return {
        "module_code": catalog.code,
        "module_name": catalog.name,
        "category": catalog.category,
        "historical_records_count": historical_count,
        "pending_tasks_count": pending_tasks_count,
        "active_dependent_modules": dependent_modules,
        "can_disable": catalog.category != ModuleCategory.SYSTEM_REQUIRED and len(dependent_modules) == 0,
    }


def get_module_detail(company, module_code):
    """Get detailed module information, dependencies status, and current configuration."""
    catalog = ModuleCatalog.objects.filter(code=module_code).first()
    if not catalog:
        raise ValidationError(f"Phân hệ '{module_code}' không tồn tại trong Module Catalog.")

    cfg = CompanyModuleConfig.objects.filter(company=company, module=catalog).select_related("updated_by").first()
    today = timezone.localdate()

    # Check each dependency
    deps_status = []
    for dep_code in catalog.dependencies:
        dep_cat = ModuleCatalog.objects.filter(code=dep_code).first()
        is_active = check_module_active(company, dep_code)
        deps_status.append({
            "code": dep_code,
            "name": dep_cat.name if dep_cat else dep_code,
            "is_satisfied": is_active,
        })

    impact = module_impact_summary(company, module_code)

    if cfg:
        curr_status = cfg.status
        eff_from = cfg.effective_from
        eff_to = cfg.effective_to
        configuration = cfg.configuration or catalog.default_config
        reason = cfg.reason
        notes = cfg.notes
        version = cfg.version
        updated_at = cfg.updated_at
        updated_by = getattr(cfg.updated_by, "display_name", str(cfg.updated_by_id)) if cfg.updated_by else None
    else:
        is_sys = catalog.category == ModuleCategory.SYSTEM_REQUIRED
        setting = CoreCompanySetting.objects.filter(company=company).first()
        is_in_setting = catalog.code in (setting.configuration.get("enabled_modules") or []) if setting and setting.configuration else False
        curr_status = ModuleStatus.ENABLED if (is_sys or is_in_setting) else ModuleStatus.NOT_CONFIGURED
        eff_from = None
        eff_to = None
        configuration = catalog.default_config
        reason = ""
        notes = ""
        version = 1
        updated_at = None
        updated_by = None

    return {
        "code": catalog.code,
        "name": catalog.name,
        "category": catalog.category,
        "description": catalog.description,
        "icon": catalog.icon,
        "dependencies": deps_status,
        "menu_group": catalog.menu_group,
        "status": curr_status,
        "effective_from": eff_from.isoformat() if eff_from else None,
        "effective_to": eff_to.isoformat() if eff_to else None,
        "configuration": configuration,
        "reason": reason,
        "notes": notes,
        "version": version,
        "updated_at": updated_at,
        "updated_by": updated_by,
        "impact": impact,
    }


@transaction.atomic
def enable_module(company, module_code, actor, *, effective_from=None, configuration=None, notes="", version=None):
    """Enable a module for a company following Main Flow 2.1 and Business Rules."""
    catalog = ModuleCatalog.objects.filter(code=module_code).first()
    if not catalog:
        raise ValidationError(f"Phân hệ '{module_code}' không tồn tại trong Module Catalog (EF-02).")

    # 1. Check dependencies (BR-MOD-08, EF-03, AF-02)
    missing_deps = []
    for dep_code in catalog.dependencies:
        if not check_module_active(company, dep_code):
            dep_cat = ModuleCatalog.objects.filter(code=dep_code).first()
            missing_deps.append(f"{dep_cat.name if dep_cat else dep_code} ({dep_code})")
    if missing_deps:
        raise ValidationError({
            "dependencies": f"Không thể kích hoạt phân hệ [{catalog.name}] vì các phân hệ phụ thuộc sau chưa được bật: {', '.join(missing_deps)}."
        })

    today = timezone.localdate()
    if effective_from and effective_from < today:
        effective_from = today

    # 2. Lock configuration row (Optimistic locking: BR-MOD-40, EF-12)
    config = CompanyModuleConfig.objects.select_for_update().filter(company=company, module=catalog).first()
    if config and version is not None and config.version != version:
        raise ValidationError({"version": "Cấu hình phân hệ đã được thay đổi bởi người dùng khác; vui lòng tải lại."})

    # Determine status based on effective_from (AF-03, BR-MOD-35)
    target_status = ModuleStatus.ENABLING if effective_from and effective_from > today else ModuleStatus.ENABLED

    if config is None:
        config = CompanyModuleConfig(
            company=company,
            module=catalog,
            status=target_status,
            effective_from=effective_from or today,
            effective_to=None,
            configuration=configuration or catalog.default_config,
            notes=notes,
            version=1,
            updated_by=actor,
        )
    else:
        config.status = target_status
        config.effective_from = effective_from or today
        config.effective_to = None
        if configuration is not None:
            config.configuration = configuration
        if notes:
            config.notes = notes
        config.version += 1
        config.updated_by = actor

    config.save()

    # 3. Synchronize company settings and enabled_modules
    if target_status == ModuleStatus.ENABLED:
        sync_company_enabled_modules(company)

    # 4. Record Audit Log (BR-MOD-41, BR-MOD-42)
    record_audit(
        company=company,
        actor_user=actor,
        module_code="SYS",
        action_code="MODULE_ENABLE",
        entity=config,
        after={
            "module": catalog.code,
            "status": target_status,
            "effective_from": str(config.effective_from),
            "version": config.version,
        },
    )
    return config


@transaction.atomic
def disable_module(company, module_code, actor, *, reason, effective_to=None, notes="", force=False, version=None):
    """Disable a module for a company following Main Flow 2.2 and Business Rules."""
    catalog = ModuleCatalog.objects.filter(code=module_code).first()
    if not catalog:
        raise ValidationError(f"Phân hệ '{module_code}' không tồn tại trong Module Catalog (EF-02).")

    # 1. Cannot disable SYSTEM_REQUIRED modules (BR-MOD-03, EF-08)
    if catalog.category == ModuleCategory.SYSTEM_REQUIRED:
        raise ValidationError(f"Phân hệ [{catalog.name}] là nền tảng bắt buộc của hệ thống, không được phép ngừng sử dụng.")

    # 2. Reason is mandatory (section 1.5, BR-MOD-42, EF-04)
    if not reason or not reason.strip():
        raise ValidationError({"reason": "Lý do ngừng sử dụng phân hệ là bắt buộc."})

    # 3. Check reverse dependencies (BR-MOD-10, EF-09)
    dependent_modules = []
    all_modules = ModuleCatalog.objects.filter(is_active=True)
    for m in all_modules:
        if module_code in m.dependencies and check_module_active(company, m.code):
            dependent_modules.append(f"{m.name} ({m.code})")
    if dependent_modules:
        raise ValidationError({
            "dependencies": f"Không thể ngừng phân hệ [{catalog.name}] vì các phân hệ đang hoạt động sau phụ thuộc vào nó: {', '.join(dependent_modules)}."
        })

    # 4. Check pending/draft documents (BR-MOD-09, EF-10, EF-11)
    if not force:
        impact = module_impact_summary(company, module_code)
        if impact["pending_tasks_count"] > 0:
            raise ValidationError({
                "pending_tasks": f"Phân hệ đang có {impact['pending_tasks_count']} chứng từ/quy trình đang chờ xử lý. Vui lòng hoàn tất hoặc hủy trước khi ngừng sử dụng."
            })

    today = timezone.localdate()
    if effective_to and effective_to < today:
        effective_to = today

    # 5. Lock configuration row (Optimistic locking: BR-MOD-40, EF-12)
    config = CompanyModuleConfig.objects.select_for_update().filter(company=company, module=catalog).first()
    if config and version is not None and config.version != version:
        raise ValidationError({"version": "Cấu hình phân hệ đã được thay đổi bởi người dùng khác; vui lòng tải lại."})

    # Determine status based on effective_to (AF-09, BR-MOD-36)
    target_status = ModuleStatus.ENABLED if effective_to and effective_to > today else ModuleStatus.DISABLED

    if config is None:
        config = CompanyModuleConfig(
            company=company,
            module=catalog,
            status=target_status,
            effective_to=effective_to or today,
            reason=reason.strip(),
            notes=notes,
            version=1,
            updated_by=actor,
        )
    else:
        config.status = target_status
        config.effective_to = effective_to or today
        config.reason = reason.strip()
        if notes:
            config.notes = notes
        config.version += 1
        config.updated_by = actor

    config.save()

    # 6. Synchronize company settings and enabled_modules
    if target_status == ModuleStatus.DISABLED:
        sync_company_enabled_modules(company)

    # 7. Record Audit Log (BR-MOD-41, BR-MOD-42)
    record_audit(
        company=company,
        actor_user=actor,
        module_code="SYS",
        action_code="MODULE_DISABLE",
        entity=config,
        after={
            "module": catalog.code,
            "status": target_status,
            "reason": reason.strip(),
            "effective_to": str(config.effective_to),
            "version": config.version,
        },
    )
    return config


@transaction.atomic
def update_module_config(company, module_code, actor, *, configuration=None, notes=None, version=None):
    """Update module basic configuration without changing enabled/disabled state (AF-05, AF-13)."""
    catalog = ModuleCatalog.objects.filter(code=module_code).first()
    if not catalog:
        raise ValidationError(f"Phân hệ '{module_code}' không tồn tại trong Module Catalog.")

    config = CompanyModuleConfig.objects.select_for_update().filter(company=company, module=catalog).first()
    if not config:
        config = CompanyModuleConfig(
            company=company,
            module=catalog,
            status=ModuleStatus.NOT_CONFIGURED,
            configuration=configuration or catalog.default_config,
            notes=notes or "",
            version=1,
            updated_by=actor,
        )
    else:
        if version is not None and config.version != version:
            raise ValidationError({"version": "Cấu hình phân hệ đã thay đổi; vui lòng tải lại."})
        if configuration is not None:
            config.configuration = configuration
        if notes is not None:
            config.notes = notes
        config.version += 1
        config.updated_by = actor

    config.save()
    record_audit(
        company=company,
        actor_user=actor,
        module_code="SYS",
        action_code="MODULE_CONFIG_UPDATE",
        entity=config,
        after={"module": catalog.code, "configuration": config.configuration, "version": config.version},
    )
    return config


def synchronize_scheduled_modules(company=None):
    """Cron/Worker function to activate modules whose effective_from arrived, or deactivate when effective_to arrived."""
    today = timezone.localdate()
    qs = CompanyModuleConfig.objects.all()
    if company:
        qs = qs.filter(company=company)

    # 1. Activate ENABLING where effective_from <= today
    enabling = qs.filter(status=ModuleStatus.ENABLING, effective_from__lte=today)
    for item in enabling:
        item.status = ModuleStatus.ENABLED
        item.version += 1
        item.save(update_fields=("status", "version", "updated_at"))
        sync_company_enabled_modules(item.company)

    # 2. Deactivate ENABLED where effective_to <= today
    disabling = qs.filter(status=ModuleStatus.ENABLED, effective_to__lte=today)
    for item in disabling:
        item.status = ModuleStatus.DISABLED
        item.version += 1
        item.save(update_fields=("status", "version", "updated_at"))
        sync_company_enabled_modules(item.company)
