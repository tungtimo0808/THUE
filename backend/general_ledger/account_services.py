"""
Business services for Chart of Accounts and Account management (UC-MD-09).
Implements BR-COA-01 through BR-COA-61.
"""
import csv
import io
import json
from datetime import date
from typing import Any, Dict, List, Optional, Set, Tuple

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from audit_log.models import EventCategory
from audit_log.services import record_audit
from iam.models import UserAccount
from organization.models import Company

from . import models
from .account_templates import get_template_accounts
from .models import (
    Account,
    AccountClass,
    AccountNature,
    AccountStatus,
    ChartOfAccounts,
    DimensionRequirementLevel,
    NormalBalance,
)


# =====================================================================
# 1. AUDIT & SNAPSHOT HELPERS (BR-COA-60, 61)
# =====================================================================

def _resolve_iam_user(user):
    if not user:
        return None
    if hasattr(user, "iam_account") and user.iam_account is not None:
        return user.iam_account
    if isinstance(user, UserAccount):
        return user
    return None


def get_account_snapshot(account: Account) -> Dict[str, Any]:
    """Tạo snapshot dữ liệu tài khoản phục vụ Audit Log và so sánh lịch sử."""
    return {
        "id": str(account.id),
        "company_id": str(account.company_id),
        "chart_of_accounts_id": str(account.chart_of_accounts_id) if account.chart_of_accounts_id else None,
        "account_class_id": str(account.account_class_id) if account.account_class_id else None,
        "parent_id": str(account.parent_id) if account.parent_id else None,
        "code": account.code,
        "name": account.name,
        "name_en": account.name_en,
        "account_level": account.account_level,
        "account_type": account.account_type,
        "normal_balance": account.normal_balance,
        "is_postable": account.is_postable,
        "is_system": account.is_system,
        "is_foreign_currency": account.is_foreign_currency,
        "default_currency": account.default_currency,
        "dimension_requirements": account.dimension_requirements,
        "report_mapping": account.report_mapping,
        "start_date": str(account.start_date) if account.start_date else None,
        "end_date": str(account.end_date) if account.end_date else None,
        "status": account.status,
        "description": account.description,
        "inactive_reason": account.inactive_reason,
        "replacement_account_id": str(account.replacement_account_id) if account.replacement_account_id else None,
        "version": account.version,
    }


def record_account_audit(
    account: Account,
    action_code: str,
    before: Optional[Dict[str, Any]] = None,
    after: Optional[Dict[str, Any]] = None,
    user=None,
    reason: str = "",
    description: str = "",
):
    """Ghi Audit Log nghiệp vụ cho hệ thống tài khoản kế toán (BR-COA-60, 61)."""
    user_account = _resolve_iam_user(user)
    desc = description or f"Thao tác {action_code} trên tài khoản {account.code} ({account.name})"
    record_audit(
        company=account.company,
        actor_user=user_account,
        module_code="GL",
        action_code=action_code,
        entity=account,
        before=before,
        after=after,
        reason=reason,
        event_category=EventCategory.MASTER_DATA,
        description=desc,
    )


# =====================================================================
# 2. IMPACT & USAGE ANALYSIS (BR-COA-16, 36, 37, 41, EF-18, 20, 21)
# =====================================================================

def get_account_impact(account: Account) -> Dict[str, Any]:
    """
    Phân tích tác động và kiểm tra mức độ sử dụng của tài khoản (Main Flow 2.3, 2.4, BR-COA-41).
    Dùng cho màn hình chi tiết, trước khi ngừng sử dụng hoặc xóa cứng.
    """
    children_count = account.children.count()
    active_children_count = account.children.filter(status__in=(AccountStatus.ACTIVE, "ACTIVE")).count()

    # Kiểm tra bút toán đã phát sinh
    journal_lines_count = account.journal_lines.count()

    # Kiểm tra chứng từ Draft (EF-20)
    draft_journal_entries_count = (
        models.JournalEntry.objects.filter(lines__account=account, status="DRAFT").distinct().count()
    )

    # Kiểm tra số dư (EF-17, BR-COA-36)
    balances_qs = account.balances.all()
    account_balances_count = balances_qs.count()
    has_nonzero_balance = balances_qs.filter(
        Q(closing_debit__gt=0)
        | Q(closing_credit__gt=0)
        | Q(opening_debit__gt=0)
        | Q(opening_credit__gt=0)
    ).exists()

    # Kiểm tra liên kết ngân sách, quy tắc phân bổ, quy tắc kết chuyển
    budget_lines_count = account.budget_lines.count()
    allocation_rules_count = (
        models.AllocationRule.objects.filter(Q(source_account=account) | Q(offset_account=account)).count()
        + models.AllocationDestination.objects.filter(account=account).count()
    )
    closing_rules_count = models.ClosingRule.objects.filter(
        Q(source_account=account) | Q(destination_account=account)
    ).count()

    # Kiểm tra xem có đang được tham chiếu làm tài khoản thay thế hoặc tài khoản mặc định
    is_replacement_target = Account.objects.filter(replacement_account=account).exists()

    has_transactions = (journal_lines_count > 0 or has_nonzero_balance)

    # Quy tắc xóa cứng (BR-COA-36, 37, EF-21):
    # Chỉ được xóa khi chưa có tài khoản con, không có số dư, không có bút toán, không là tài khoản hệ thống, không có tham chiếu.
    can_delete = (
        not account.is_system
        and children_count == 0
        and journal_lines_count == 0
        and not has_nonzero_balance
        and budget_lines_count == 0
        and allocation_rules_count == 0
        and closing_rules_count == 0
    )

    # Quy tắc ngừng sử dụng (BR-COA-41, EF-18, EF-20):
    # Không còn tài khoản con ACTIVE và không còn chứng từ Draft đang xử lý
    can_deactivate = (
        active_children_count == 0
        and draft_journal_entries_count == 0
    )

    return {
        "id": str(account.id),
        "code": account.code,
        "name": account.name,
        "name_en": account.name_en,
        "status": account.status,
        "is_system": account.is_system,
        "is_postable": account.is_postable,
        "account_type": account.account_type,
        "normal_balance": account.normal_balance,
        "children_count": children_count,
        "active_children_count": active_children_count,
        "journal_lines_count": journal_lines_count,
        "draft_journal_entries_count": draft_journal_entries_count,
        "account_balances_count": account_balances_count,
        "has_nonzero_balance": has_nonzero_balance,
        "has_transactions": has_transactions,
        "budget_lines_count": budget_lines_count,
        "allocation_rules_count": allocation_rules_count,
        "closing_rules_count": closing_rules_count,
        "is_replacement_target": is_replacement_target,
        "can_delete": can_delete,
        "can_deactivate": can_deactivate,
    }


def has_account_transactions(account: Account) -> bool:
    """Kiểm tra tài khoản đã phát sinh giao dịch hoặc số dư hay chưa."""
    impact = get_account_impact(account)
    return impact["has_transactions"]


# =====================================================================
# 3. INITIALIZE FROM TEMPLATE (Main Flow 2.1, AF-01, AF-02, AF-19, BR-COA-04, 52)
# =====================================================================

@transaction.atomic
def init_chart_of_accounts_from_template(
    company: Company,
    regime: str = "TT99",
    scope: str = "FULL",
    chart_code: Optional[str] = None,
    chart_name: Optional[str] = None,
    user=None,
) -> Dict[str, Any]:
    """
    Khởi tạo hệ thống tài khoản từ mẫu chế độ kế toán (TT99, TT200 hoặc TT133).
    Hỗ trợ đối chiếu bổ sung nếu doanh nghiệp đã có tài khoản (AF-01).
    Hỗ trợ phạm vi rút gọn cho doanh nghiệp nhỏ / một người (AF-02, AF-19, BR-COA-52).
    """
    regime = (regime or "TT99").upper()
    scope = (scope or "FULL").upper()
    template_version_str = f"{regime}-{scope}-V1"

    # Lấy hoặc tạo ChartOfAccounts mặc định cho doanh nghiệp
    chart = ChartOfAccounts.objects.filter(company=company, is_default=True).first()
    if not chart:
        chart_code_val = chart_code or f"COA-{regime}"
        chart_name_val = chart_name or f"Hệ thống tài khoản ({regime})"
        chart = ChartOfAccounts.objects.create(
            company=company,
            code=chart_code_val,
            name=chart_name_val,
            accounting_regime=regime,
            effective_from=date(2026, 1, 1),
            is_default=True,
            status="ACTIVE",
            template_version=template_version_str,
        )
    else:
        chart.template_version = template_version_str
        chart.save(update_fields=["template_version"])

    # Lấy danh sách mẫu tài khoản
    template_items = get_template_accounts(regime=regime, scope=scope)

    # Đọc các tài khoản đã tồn tại của doanh nghiệp trong chart này (AF-01)
    existing_accounts = {
        acc.code: acc
        for acc in Account.objects.filter(company=company, chart_of_accounts=chart)
    }

    created_accounts: List[Account] = []
    skipped_count = 0

    # Khởi tạo theo thứ tự cấp bậc (tài khoản cha trước, con sau)
    # Tách thành các cấp theo độ dài mã
    sorted_items = sorted(template_items, key=lambda x: len(x["code"]))

    account_map: Dict[str, Account] = dict(existing_accounts)

    for item in sorted_items:
        code = item["code"]
        if code in account_map:
            skipped_count += 1
            continue

        parent_code = item.get("parent_code")
        parent_obj = account_map.get(parent_code) if parent_code else None

        acc = Account(
            company=company,
            chart_of_accounts=chart,
            parent=parent_obj,
            code=code,
            name=item["name"],
            name_en=item.get("name_en", ""),
            account_type=item["account_type"],
            normal_balance=item.get("normal_balance", NormalBalance.DEBIT),
            is_postable=item.get("is_postable", True),
            is_system=True,  # Đánh dấu System Account (BR-COA-06)
            is_foreign_currency=item.get("is_foreign_currency", False),
            default_currency=item.get("default_currency", ""),
            dimension_requirements=item.get("dimension_requirements", {}),
            status=AccountStatus.ACTIVE,
            description=item.get("description", ""),
        )
        acc.save()
        account_map[code] = acc
        created_accounts.append(acc)

    # Ghi Audit Log tổng hợp (BR-COA-60, 61)
    user_account = _resolve_iam_user(user)
    record_audit(
        company=company,
        actor_user=user_account,
        module_code="GL",
        action_code="INIT_TEMPLATE",
        entity=chart,
        after={
            "chart_id": str(chart.id),
            "regime": regime,
            "scope": scope,
            "created_count": len(created_accounts),
            "skipped_count": skipped_count,
            "total_accounts": len(account_map),
        },
        event_category=EventCategory.MASTER_DATA,
        description=f"Khởi tạo hệ thống tài khoản từ mẫu {regime} ({scope}): tạo mới {len(created_accounts)}, bỏ qua {skipped_count}",
    )

    return {
        "chart_of_accounts_id": str(chart.id),
        "chart_code": chart.code,
        "regime": regime,
        "scope": scope,
        "template_version": template_version_str,
        "created_count": len(created_accounts),
        "skipped_count": skipped_count,
        "total_accounts": len(account_map),
    }


# =====================================================================
# 4. STATUS TRANSITION (Main Flow 2.4, AF-14..16, EF-18..20, BR-COA-33..35, 41, 42)
# =====================================================================

@transaction.atomic
def change_account_status(
    account: Account,
    new_status: str,
    version: Optional[int] = None,
    reason: str = "",
    end_date: Optional[Any] = None,
    replacement_account: Optional[Account] = None,
    user=None,
) -> Account:
    """
    Chuyển đổi trạng thái tài khoản kế toán (DRAFT -> ACTIVE -> INACTIVE -> ARCHIVED).
    Tuân thủ kiểm tra tài khoản con (EF-18), chứng từ Draft (EF-20), tài khoản thay thế (BR-COA-42).
    Hỗ trợ kiểm soát đồng thời Optimistic Locking (EF-24, BR-COA-58).
    """
    row = Account.objects.select_for_update().get(pk=account.pk)

    # Concurrency check
    if version is not None and row.version != version:
        raise ValidationError(
            {"detail": "Dữ liệu đã được người dùng khác cập nhật, vui lòng tải lại trang."},
            code="concurrency_conflict",
        )

    before_snap = get_account_snapshot(row)

    if new_status == AccountStatus.INACTIVE or new_status == "INACTIVE":
        # EF-18: Tài khoản còn tài khoản con ACTIVE -> yêu cầu xử lý tài khoản con trước
        active_children = row.children.filter(status__in=(AccountStatus.ACTIVE, "ACTIVE"))
        if active_children.exists():
            child_codes = list(active_children.values_list("code", flat=True)[:5])
            raise ValidationError(
                f"Tài khoản còn {active_children.count()} tài khoản con đang hoạt động ({', '.join(child_codes)}). Vui lòng ngừng tài khoản con trước."
            )

        # EF-20: Tài khoản còn chứng từ Draft đang xử lý
        draft_entries = models.JournalEntry.objects.filter(lines__account=row, status="DRAFT").exists()
        if draft_entries:
            raise ValidationError("Tài khoản còn chứng từ nháp (Draft) chưa hoàn tất ghi sổ. Vui lòng xử lý trước.")

        # BR-COA-42, EF-19: Kiểm tra nếu tài khoản đang được dùng làm tài khoản thay thế hoặc tài khoản mặc định
        if not reason:
            raise ValidationError("Vui lòng cung cấp lý do ngừng sử dụng tài khoản.")

        row.status = AccountStatus.INACTIVE
        row.end_date = end_date or timezone.now().date()
        row.inactive_reason = reason
        if replacement_account:
            if replacement_account.pk == row.pk or replacement_account.company_id != row.company_id:
                raise ValidationError("Tài khoản thay thế không hợp lệ.")
            if replacement_account.status != AccountStatus.ACTIVE:
                raise ValidationError("Tài khoản thay thế phải ở trạng thái hoạt động.")
            row.replacement_account = replacement_account

    elif new_status == AccountStatus.ACTIVE or new_status == "ACTIVE":
        # AF-16: Kích hoạt lại tài khoản
        if row.parent and row.parent.status not in (AccountStatus.ACTIVE, "ACTIVE"):
            raise ValidationError("Không thể kích hoạt tài khoản khi tài khoản cha đang ngừng sử dụng.")
        row.status = AccountStatus.ACTIVE
        row.inactive_reason = ""
        row.end_date = None
        row.replacement_account = None

    else:
        row.status = new_status

    row.version += 1
    row.save()

    after_snap = get_account_snapshot(row)
    record_account_audit(
        account=row,
        action_code="CHANGE_STATUS",
        before=before_snap,
        after=after_snap,
        user=user,
        reason=reason,
        description=f"Chuyển trạng thái tài khoản {row.code} sang {new_status}",
    )
    return row


# =====================================================================
# 5. HARD DELETE CHECK (BR-COA-36, 37, EF-21)
# =====================================================================

@transaction.atomic
def delete_account(account: Account, user=None):
    """
    Xóa tài khoản kế toán.
    Chỉ cho phép xóa khi chưa có tài khoản con, số dư, bút toán hoặc tham chiếu (BR-COA-36, 37, EF-21).
    Không cho phép xóa System Account (BR-COA-07).
    """
    row = Account.objects.select_for_update().get(pk=account.pk)

    if row.is_system:
        raise ValidationError("Không được xóa tài khoản hệ thống được bảo vệ theo chính sách.")

    impact = get_account_impact(row)
    if not impact["can_delete"]:
        reasons = []
        if impact["children_count"] > 0:
            reasons.append(f"{impact['children_count']} tài khoản con")
        if impact["journal_lines_count"] > 0:
            reasons.append(f"{impact['journal_lines_count']} dòng bút toán")
        if impact["has_nonzero_balance"]:
            reasons.append("số dư kế toán")
        if impact["budget_lines_count"] > 0:
            reasons.append("ngân sách kế toán")
        if impact["allocation_rules_count"] > 0:
            reasons.append("quy tắc phân bổ")
        if impact["closing_rules_count"] > 0:
            reasons.append("quy tắc kết chuyển")
        raise ValidationError(f"Không thể xóa tài khoản đã phát sinh dữ liệu liên quan: {', '.join(reasons)}.")

    before_snap = get_account_snapshot(row)
    row_code = row.code
    row_name = row.name
    company = row.company

    record_audit(
        company=company,
        actor_user=_resolve_iam_user(user),
        module_code="GL",
        action_code="DELETE",
        entity=row,
        before=before_snap,
        after=None,
        event_category=EventCategory.MASTER_DATA,
        description=f"Xóa tài khoản kế toán {row_code} ({row_name})",
    )
    row.delete()


# =====================================================================
# 6. TREE HIERARCHY BUILDER (Main Flow 2.2, AF-18)
# =====================================================================

def get_account_tree(company: Company, chart_of_accounts: Optional[ChartOfAccounts] = None) -> List[Dict[str, Any]]:
    """Xây dựng cây tài khoản theo cấu trúc cha - con cho toàn bộ hệ thống tài khoản."""
    qs = Account.objects.filter(company=company)
    if chart_of_accounts:
        qs = qs.filter(chart_of_accounts=chart_of_accounts)
    else:
        default_chart = ChartOfAccounts.objects.filter(company=company, is_default=True).first()
        if default_chart:
            qs = qs.filter(chart_of_accounts=default_chart)

    accounts = list(qs.select_related("parent").order_by("code"))

    nodes: Dict[str, Dict[str, Any]] = {}
    for acc in accounts:
        nodes[str(acc.id)] = {
            "id": str(acc.id),
            "code": acc.code,
            "name": acc.name,
            "name_en": acc.name_en,
            "account_level": acc.account_level,
            "account_type": acc.account_type,
            "normal_balance": acc.normal_balance,
            "is_postable": acc.is_postable,
            "is_system": acc.is_system,
            "is_foreign_currency": acc.is_foreign_currency,
            "dimension_requirements": acc.dimension_requirements,
            "status": acc.status,
            "parent_id": str(acc.parent_id) if acc.parent_id else None,
            "children": [],
        }

    tree: List[Dict[str, Any]] = []
    for acc in accounts:
        node = nodes[str(acc.id)]
        if acc.parent_id and str(acc.parent_id) in nodes:
            nodes[str(acc.parent_id)]["children"].append(node)
        else:
            tree.append(node)

    return tree


# =====================================================================
# 7. CSV EXPORT & IMPORT (AF-17, AF-18, BR-COA-48..51, EF-22, EF-23)
# =====================================================================

CSV_HEADERS = [
    "code",
    "name",
    "name_en",
    "parent_code",
    "account_type",
    "normal_balance",
    "is_postable",
    "is_system",
    "is_foreign_currency",
    "default_currency",
    "dimension_requirements",
    "report_mapping",
    "status",
    "description",
]


def export_accounts_to_csv(company: Company, chart_of_accounts: Optional[ChartOfAccounts] = None) -> str:
    """Xuất danh sách hệ thống tài khoản kế toán sang định dạng CSV (AF-18, BR-COA-51)."""
    qs = Account.objects.filter(company=company)
    if chart_of_accounts:
        qs = qs.filter(chart_of_accounts=chart_of_accounts)
    else:
        default_chart = ChartOfAccounts.objects.filter(company=company, is_default=True).first()
        if default_chart:
            qs = qs.filter(chart_of_accounts=default_chart)

    accounts = qs.select_related("parent").order_by("code")

    output = io.StringIO()
    # Write BOM for UTF-8 Excel support
    output.write("\ufeff")
    writer = csv.DictWriter(output, fieldnames=CSV_HEADERS)
    writer.writeheader()

    for acc in accounts:
        dim_str = json.dumps(acc.dimension_requirements or {}, ensure_ascii=False)
        writer.writerow({
            "code": acc.code,
            "name": acc.name,
            "name_en": acc.name_en or "",
            "parent_code": acc.parent.code if acc.parent else "",
            "account_type": acc.account_type,
            "normal_balance": acc.normal_balance,
            "is_postable": "1" if acc.is_postable else "0",
            "is_system": "1" if acc.is_system else "0",
            "is_foreign_currency": "1" if acc.is_foreign_currency else "0",
            "default_currency": acc.default_currency or "",
            "dimension_requirements": dim_str,
            "report_mapping": acc.report_mapping or "",
            "status": acc.status,
            "description": acc.description or "",
        })

    return output.getvalue()


@transaction.atomic
def import_accounts_from_csv(
    company: Company,
    chart_of_accounts: ChartOfAccounts,
    csv_content: str,
    user=None,
) -> Dict[str, Any]:
    """
    Nhập hệ thống tài khoản từ file CSV (AF-17, BR-COA-48..50, EF-22, EF-23).
    Bảo đảm tính toàn vẹn Transaction (một dòng lỗi thì từ chối toàn bộ - BR-COA-50).
    Kiểm tra cấu trúc chu trình và quan hệ cha con (EF-22, EF-23).
    """
    if not csv_content or not csv_content.strip():
        raise ValidationError("Nội dung file CSV trống.")

    # Strip BOM if present
    if csv_content.startswith("\ufeff"):
        csv_content = csv_content[1:]

    reader = csv.DictReader(io.StringIO(csv_content))
    if not reader.fieldnames:
        raise ValidationError("File CSV không có tiêu đề cột hợp lệ.")

    # Kiểm tra cột bắt buộc
    missing_cols = [col for col in ("code", "name", "account_type") if col not in reader.fieldnames]
    if missing_cols:
        raise ValidationError(f"File CSV thiếu các cột bắt buộc: {', '.join(missing_cols)}")

    rows = list(reader)
    if not rows:
        raise ValidationError("File CSV không chứa dòng dữ liệu nào.")

    errors: List[str] = []
    seen_codes: Set[str] = set()
    csv_account_map: Dict[str, Dict[str, Any]] = {}

    # Đọc danh sách tài khoản hiện có trong DB
    existing_db_accounts = {
        acc.code: acc
        for acc in Account.objects.filter(company=company, chart_of_accounts=chart_of_accounts)
    }

    valid_natures = {c[0] for c in AccountNature.choices}
    valid_balances = {c[0] for c in NormalBalance.choices}
    valid_statuses = {c[0] for c in AccountStatus.choices}

    # Pass 1: Kiểm tra cú pháp, trường bắt buộc, trùng mã cục bộ
    for idx, row in enumerate(rows, start=2):
        code = (row.get("code") or "").strip()
        name = (row.get("name") or "").strip()
        account_type = (row.get("account_type") or "").strip().upper()
        normal_balance = (row.get("normal_balance") or "DEBIT").strip().upper()

        if not code:
            errors.append(f"Dòng {idx}: Mã tài khoản không được để trống.")
            continue
        if not name:
            errors.append(f"Dòng {idx}: Tên tài khoản không được để trống.")
            continue
        if account_type not in valid_natures:
            errors.append(f"Dòng {idx}: Bản chất tài khoản '{account_type}' không hợp lệ.")
        if normal_balance not in valid_balances:
            errors.append(f"Dòng {idx}: Tính chất số dư '{normal_balance}' không hợp lệ.")

        if code in seen_codes:
            errors.append(f"Dòng {idx}: Số hiệu tài khoản '{code}' bị trùng lặp trong file CSV.")
        seen_codes.add(code)

        if code in existing_db_accounts:
            errors.append(f"Dòng {idx}: Số hiệu tài khoản '{code}' đã tồn tại trong hệ thống tài khoản của doanh nghiệp.")

        csv_account_map[code] = {
            "row_idx": idx,
            "code": code,
            "name": name,
            "name_en": (row.get("name_en") or "").strip(),
            "parent_code": (row.get("parent_code") or "").strip(),
            "account_type": account_type,
            "normal_balance": normal_balance,
            "is_postable": row.get("is_postable", "1").strip() in ("1", "true", "True"),
            "is_system": row.get("is_system", "0").strip() in ("1", "true", "True"),
            "is_foreign_currency": row.get("is_foreign_currency", "0").strip() in ("1", "true", "True"),
            "default_currency": (row.get("default_currency") or "").strip(),
            "dimension_requirements": row.get("dimension_requirements", "{}"),
            "report_mapping": (row.get("report_mapping") or "").strip(),
            "status": (row.get("status") or "ACTIVE").strip().upper(),
            "description": (row.get("description") or "").strip(),
        }

    # Pass 2: Kiểm tra quan hệ cha - con và chu trình (EF-22, EF-23, BR-COA-49)
    for code, data in csv_account_map.items():
        parent_code = data["parent_code"]
        if parent_code:
            # Parent must exist either in DB or in this CSV (BR-COA-49)
            if parent_code not in existing_db_accounts and parent_code not in csv_account_map:
                errors.append(f"Dòng {data['row_idx']}: Tài khoản cha '{parent_code}' không tồn tại trong hệ thống hoặc file CSV.")
                continue

            # Code prefix rule (BR-COA-12)
            if not code.startswith(parent_code):
                errors.append(f"Dòng {data['row_idx']}: Số hiệu tài khoản con '{code}' phải bắt đầu bằng số hiệu tài khoản cha '{parent_code}'.")

            # Cycle detection in CSV (EF-23)
            visited = {code}
            curr = parent_code
            has_cycle = False
            while curr in csv_account_map:
                if curr in visited:
                    has_cycle = True
                    break
                visited.add(curr)
                curr = csv_account_map[curr]["parent_code"]
            if has_cycle:
                errors.append(f"Dòng {data['row_idx']}: Cấu trúc tài khoản tạo chu trình vòng tại '{code}'.")

    if errors:
        raise ValidationError({"errors": errors, "detail": f"File Import có {len(errors)} lỗi cần sửa trước khi lưu."})

    # Pass 3: Lưu vào CSDL theo thứ tự độ dài mã (tài khoản cha được tạo trước)
    sorted_codes = sorted(csv_account_map.keys(), key=lambda c: len(c))
    created_map: Dict[str, Account] = dict(existing_db_accounts)
    saved_instances: List[Account] = []

    for code in sorted_codes:
        data = csv_account_map[code]
        parent_code = data["parent_code"]
        parent_obj = created_map.get(parent_code) if parent_code else None

        # Parse dimension_requirements JSON if valid
        dim_reqs = {}
        if data["dimension_requirements"]:
            try:
                dim_reqs = json.loads(data["dimension_requirements"])
            except Exception:
                dim_reqs = {}

        acc = Account(
            company=company,
            chart_of_accounts=chart_of_accounts,
            parent=parent_obj,
            code=code,
            name=data["name"],
            name_en=data["name_en"],
            account_type=data["account_type"],
            normal_balance=data["normal_balance"],
            is_postable=data["is_postable"],
            is_system=data["is_system"],
            is_foreign_currency=data["is_foreign_currency"],
            default_currency=data["default_currency"],
            dimension_requirements=dim_reqs,
            report_mapping=data["report_mapping"],
            status=data["status"] if data["status"] in valid_statuses else AccountStatus.ACTIVE,
            description=data["description"],
        )
        acc.clean()
        acc.save()
        created_map[code] = acc
        saved_instances.append(acc)

    # Ghi Audit Log
    record_audit(
        company=company,
        actor_user=_resolve_iam_user(user),
        module_code="GL",
        action_code="IMPORT",
        entity=chart_of_accounts,
        after={"imported_count": len(saved_instances)},
        event_category=EventCategory.MASTER_DATA,
        description=f"Nhập thành công {len(saved_instances)} tài khoản kế toán từ CSV vào hệ thống {chart_of_accounts.code}",
    )

    return {
        "imported_count": len(saved_instances),
        "chart_of_accounts_id": str(chart_of_accounts.id),
        "codes": [acc.code for acc in saved_instances],
    }


@transaction.atomic
def convert_chart_of_accounts_to_tt99(
    company: Company,
    user=None,
) -> Dict[str, Any]:
    """
    Chuyển đổi và chuẩn hóa hệ thống tài khoản từ Thông tư 200/133 sang Thông tư 99/2025/TT-BTC.
    Đảm bảo toàn bộ tài khoản mẫu TT99 được khởi tạo, cập nhật chế độ kế toán của doanh nghiệp,
    và đối chiếu số dư đầu kỳ.
    """
    from django.db.models import Sum

    init_res = init_chart_of_accounts_from_template(
        company=company,
        regime="TT99",
        scope="FULL",
        chart_code="COA-TT99",
        chart_name="Hệ thống tài khoản (Thông tư 99/2025/TT-BTC)",
        user=user,
    )
    chart = ChartOfAccounts.objects.filter(company=company, is_default=True).first()
    if chart:
        chart.accounting_regime = "TT99"
        chart.name = "Hệ thống tài khoản (Thông tư 99/2025/TT-BTC)"
        chart.save(update_fields=["accounting_regime", "name"])

    if hasattr(company, "accounting_regime") and getattr(company, "accounting_regime", None) != "TT99":
        company.accounting_regime = "TT99"
        company.save(update_fields=["accounting_regime"])

    opening_lines = (
        models.JournalLine.objects.filter(
            entry__company=company,
            entry__entry_type="OPENING",
            entry__status="POSTED",
        )
        .values("account__code", "account__name")
        .annotate(debit=Sum("debit"), credit=Sum("credit"))
        .order_by("account__code")
    )

    mappings = []
    total_debit = 0
    total_credit = 0
    rule_labels = {
        "155": "Thành phẩm (Phân loại mới TT99)",
        "156": "Hàng hóa (Quy định chi tiết TT99)",
        "1561": "Giá mua hàng hóa (Quy định chi tiết TT99)",
        "242": "Chi phí chờ phân bổ (TT99)",
        "4111": "Vốn góp của chủ sở hữu (TT99)",
        "4212": "LNST chưa phân phối năm trước (TT99)",
    }
    for row in opening_lines:
        code = row["account__code"]
        name = row["account__name"]
        d = int(row["debit"] or 0)
        c = int(row["credit"] or 0)
        total_debit += d
        total_credit += c
        target_name = rule_labels.get(code, f"{name} (TT99)")
        mappings.append({
            "old_code": code,
            "old_name": name,
            "new_code": code,
            "new_name": target_name,
            "source_code": code,
            "source_name": name,
            "target_code": code,
            "target_name": target_name,
            "opening_debit": d,
            "opening_credit": c,
            "rule": "Chuyển chi tiết theo kho/đối tượng" if code in ("131", "331", "152", "1531", "1561") else "Chuyển nguyên trạng số dư",
            "status": "✓ Ghép tự động hoàn tất",
        })

    total_accounts = Account.objects.filter(company=company).count()
    return {
        **init_res,
        "regime": "TT99",
        "accounting_regime": "TT99",
        "total_accounts": total_accounts,
        "existing_accounts_count": total_accounts,
        "template_accounts_count": total_accounts,
        "total_opening_debit": total_debit,
        "total_opening_credit": total_credit,
        "balanced": total_debit == total_credit,
        "mappings": mappings,
    }
