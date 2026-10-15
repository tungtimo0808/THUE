import csv
import io
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from audit_log.models import EventCategory
from audit_log.services import record_audit
from general_ledger.models import Account, JournalLine
from iam.models import UserAccount
from organization.models import Company

from .models import CatalogStatus, ExpenseItem, ExpenseItemType, _validate_tree


def _resolve_iam_user(user):
    if not user:
        return None
    if hasattr(user, "iam_account") and user.iam_account is not None:
        return user.iam_account
    if isinstance(user, UserAccount):
        return user
    return None


# =====================================================================
# 1. AUDIT & SNAPSHOT HELPERS (BR-MD-EXP-23)
# =====================================================================

def get_expense_item_snapshot(item: ExpenseItem) -> Dict[str, Any]:
    """Tạo snapshot dữ liệu phục vụ audit và so sánh lịch sử."""
    return {
        "id": str(item.id),
        "company_id": str(item.company_id),
        "code": item.code,
        "name": item.name,
        "parent_id": str(item.parent_id) if item.parent_id else None,
        "expense_type": item.expense_type,
        "default_account_id": str(item.default_account_id) if item.default_account_id else None,
        "applicable_scope": item.applicable_scope,
        "start_date": str(item.start_date) if item.start_date else None,
        "end_date": str(item.end_date) if item.end_date else None,
        "description": item.description,
        "status": item.status,
        "version": item.version,
    }


def record_expense_item_audit(
    item: ExpenseItem,
    action_code: str,
    before: Optional[Dict[str, Any]] = None,
    after: Optional[Dict[str, Any]] = None,
    user=None,
    reason: str = "",
):
    """Ghi Audit Log nghiệp vụ cho khoản mục chi phí (BR-MD-EXP-23)."""
    user_account = _resolve_iam_user(user)
    record_audit(
        company=item.company,
        actor_user=user_account,
        module_code="MD",
        action_code=action_code,
        entity=item,
        before=before,
        after=after,
        reason=reason,
        event_category=EventCategory.MASTER_DATA,
        description=f"Thao tác {action_code} trên khoản mục chi phí {item.code} ({item.name})",
    )


# =====================================================================
# 2. IMPACT & USAGE ANALYSIS (BR-MD-EXP-12, 13, 14, EF-08, EF-09)
# =====================================================================

def get_expense_item_impact(item: ExpenseItem) -> Dict[str, Any]:
    """
    Phân tích tác động và kiểm tra mức độ sử dụng của khoản mục chi phí.
    Dùng cho màn hình chi tiết, trước khi xóa hoặc đổi trạng thái (EF-09, BR-MD-EXP-12, 13).
    """
    children_count = item.children.count()
    active_children_count = item.children.filter(status=CatalogStatus.ACTIVE).count()

    # Kiểm tra liên kết trong sổ cái kế toán
    journal_lines_count = (
        JournalLine.objects.filter(dimensions__expense_item_id=str(item.id)).count()
        + JournalLine.objects.filter(dimensions__expense_item=item.code).count()
        + JournalLine.objects.filter(dimensions__cost_item_id=str(item.id)).count()
        + JournalLine.objects.filter(dimensions__cost_item=item.code).count()
    )

    can_delete = (children_count == 0 and journal_lines_count == 0)
    can_deactivate = True

    return {
        "id": str(item.id),
        "code": item.code,
        "name": item.name,
        "status": item.status,
        "children_count": children_count,
        "active_children_count": active_children_count,
        "journal_lines_count": journal_lines_count,
        "can_delete": can_delete,
        "can_deactivate": can_deactivate,
    }


def has_expense_item_transactions(item: ExpenseItem) -> bool:
    """Kiểm tra khoản mục đã phát sinh dữ liệu trong các chứng từ / giao dịch hay chưa."""
    impact = get_expense_item_impact(item)
    return impact["journal_lines_count"] > 0


# =====================================================================
# 3. STATUS TRANSITION (AF-10, AF-11, AF-12, EF-10, BR-MD-EXP-10..17)
# =====================================================================

def change_expense_item_status(
    item: ExpenseItem,
    new_status: str,
    version: Optional[int] = None,
    reason: str = "",
    deactivate_children: bool = False,
    user=None,
) -> ExpenseItem:
    """
    Chuyển trạng thái khoản mục chi phí (ACTIVE / INACTIVE).
    Xử lý các quy tắc về khoản mục con và khoản mục cha (BR-MD-EXP-16, 17, AF-12, EF-10).
    """
    if version is not None and item.version != version:
        raise ValidationError({"version": "Dữ liệu đã bị thay đổi bởi người dùng khác. Vui lòng tải lại trang."})

    if new_status == item.status:
        return item

    if new_status not in (CatalogStatus.ACTIVE, CatalogStatus.INACTIVE):
        raise ValidationError({"status": f"Trạng thái '{new_status}' không hợp lệ."})

    with transaction.atomic():
        if new_status == CatalogStatus.INACTIVE:
            # Kiểm tra khoản mục con đang hoạt động
            active_children = item.children.filter(status=CatalogStatus.ACTIVE)
            if active_children.exists():
                if not deactivate_children:
                    raise ValidationError({
                        "deactivate_children": (
                            "Khoản mục có khoản mục con đang sử dụng. "
                            "Cần xử lý các khoản mục con trước hoặc xác nhận ngừng toàn bộ cây khoản mục."
                        )
                    })
                # Ngừng đệ quy toàn bộ con cháu
                def _deact_descendants(parent_node):
                    iam_user = _resolve_iam_user(user)
                    for child in parent_node.children.filter(status=CatalogStatus.ACTIVE):
                        c_before = get_expense_item_snapshot(child)
                        child.status = CatalogStatus.INACTIVE
                        child.version += 1
                        child.updated_by = iam_user
                        child.save()
                        record_expense_item_audit(
                            child,
                            "EXPENSE_ITEM_DEACTIVATE_CASCADE",
                            before=c_before,
                            after=get_expense_item_snapshot(child),
                            user=iam_user,
                            reason=f"Ngừng sử dụng theo khoản mục cha {item.code}: {reason}",
                        )
                        _deact_descendants(child)

                _deact_descendants(item)

        elif new_status == CatalogStatus.ACTIVE:
            # Không được kích hoạt nếu cha đang INACTIVE (BR-MD-EXP-16)
            if item.parent and item.parent.status != CatalogStatus.ACTIVE:
                raise ValidationError({
                    "parent": "Không thể kích hoạt khoản mục khi khoản mục cha đang ngừng sử dụng."
                })

        iam_user = _resolve_iam_user(user)
        before = get_expense_item_snapshot(item)
        item.status = new_status
        item.version += 1
        item.updated_by = iam_user
        item.save()
        after = get_expense_item_snapshot(item)

        action_code = "EXPENSE_ITEM_ACTIVATE" if new_status == CatalogStatus.ACTIVE else "EXPENSE_ITEM_DEACTIVATE"
        record_expense_item_audit(item, action_code, before=before, after=after, user=iam_user, reason=reason)

    return item


# =====================================================================
# 4. AI SUGGESTION SERVICE (BR-MD-EXP-24, 25, 26, AF-04)
# =====================================================================

AI_CLASSIFICATION_RULES = [
    (
        ExpenseItemType.LABOR,
        ["lương", "nhân công", "phụ cấp", "bảo hiểm", "thưởng", "trích theo lương", "tiền lương", "nhân viên", "lao động", "công nhật"],
        ["622", "6411", "6421"],
    ),
    (
        ExpenseItemType.MATERIAL,
        ["nguyên liệu", "vật liệu", "bao bì", "phụ liệu", "nguyên vật liệu", "vật tư"],
        ["621", "642"],
    ),
    (
        ExpenseItemType.GENERAL_PRODUCTION,
        ["sản xuất chung", "máy móc", "xưởng", "phân xưởng", "thiết bị sản xuất", "điện sản xuất", "bảo trì máy"],
        ["627"],
    ),
    (
        ExpenseItemType.SELLING,
        ["bán hàng", "vận chuyển", "giao hàng", "quảng cáo", "tiếp thị", "marketing", "hoa hồng", "showroom", "khuyến mại", "hội chợ"],
        ["641"],
    ),
    (
        ExpenseItemType.ADMIN,
        ["quản lý", "văn phòng", "tiền điện", "tiền nước", "internet", "văn phòng phẩm", "tiếp khách", "công tác phí", "thuê văn phòng"],
        ["642"],
    ),
    (
        ExpenseItemType.FINANCIAL,
        ["tài chính", "lãi vay", "phí chuyển tiền", "phí ngân hàng", "chênh lệch tỷ giá", "lỗ tỷ giá"],
        ["635"],
    ),
    (
        ExpenseItemType.OTHER,
        ["khác", "thanh lý", "tiền phạt", "bồi thường"],
        ["811"],
    ),
]


def ai_suggest_expense_item(company: Company, name: str, description: str = "") -> Dict[str, Any]:
    """
    AI Assistant gợi ý loại khoản mục chi phí và tài khoản kế toán mặc định (BR-MD-EXP-24..26).
    Chỉ mang tính chất gợi ý tham khảo; User có quyền chấp nhận, chỉnh sửa hoặc bỏ qua.
    """
    text = f"{name} {description}".lower().strip()
    matched_type = ExpenseItemType.OTHER
    candidate_account_prefixes = ["642", "811"]
    confidence = 0.5
    matched_keyword = None

    for exp_type, keywords, prefixes in AI_CLASSIFICATION_RULES:
        for kw in keywords:
            if kw in text:
                matched_type = exp_type
                candidate_account_prefixes = prefixes
                confidence = 0.85
                matched_keyword = kw
                break
        if matched_keyword:
            break

    # Tìm tài khoản kế toán phù hợp nhất trong doanh nghiệp
    suggested_account = None
    for prefix in candidate_account_prefixes:
        acc = (
            Account.objects.filter(
                company=company,
                status="ACTIVE",
                is_postable=True,
                code__startswith=prefix,
            )
            .order_by("code")
            .first()
        )
        if acc:
            suggested_account = acc
            break

    reasoning = (
        f"Gợi ý nhóm '{matched_type}' dựa trên từ khóa nhận diện '{matched_keyword}' trong tên/mô tả khoản mục."
        if matched_keyword
        else "Gợi ý nhóm chi phí mặc định dựa trên thông tin mô tả."
    )

    return {
        "suggested_expense_type": matched_type,
        "suggested_account_id": str(suggested_account.id) if suggested_account else None,
        "suggested_account_code": suggested_account.code if suggested_account else None,
        "suggested_account_name": suggested_account.name if suggested_account else None,
        "confidence": confidence,
        "reasoning": reasoning,
    }


# =====================================================================
# 5. CSV IMPORT & EXPORT (BR-MD-EXP-21, 22, AF-08, AF-09, EF-11, EF-12)
# =====================================================================

def export_expense_items_to_csv(queryset) -> str:
    """Xuất danh sách khoản mục chi phí ra file CSV (AF-09, BR-MD-EXP-21)."""
    output = io.StringIO()
    # Write UTF-8 BOM so Excel opens it with correct Vietnamese accents
    output.write("\ufeff")
    writer = csv.writer(output)
    writer.writerow([
        "code",
        "name",
        "parent_code",
        "expense_type",
        "default_account_code",
        "applicable_scope",
        "start_date",
        "end_date",
        "status",
        "description",
    ])

    for item in queryset.select_related("parent", "default_account").order_by("code"):
        writer.writerow([
            item.code,
            item.name,
            item.parent.code if item.parent_id else "",
            item.expense_type,
            item.default_account.code if item.default_account_id else "",
            item.applicable_scope,
            str(item.start_date) if item.start_date else "",
            str(item.end_date) if item.end_date else "",
            item.status,
            item.description,
        ])

    return output.getvalue()


def import_expense_items_from_csv(company: Company, file_content: bytes, user=None) -> Dict[str, Any]:
    """
    Nhập danh sách khoản mục chi phí từ file CSV (AF-08, BR-MD-EXP-21, 22).
    Xác thực từng dòng, báo cáo lỗi chi tiết theo dòng (EF-11, EF-12).
    """
    try:
        decoded_content = file_content.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            decoded_content = file_content.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise ValidationError("File không đúng định dạng mã hóa UTF-8.") from exc

    reader = csv.DictReader(io.StringIO(decoded_content))
    if not reader.fieldnames:
        raise ValidationError("File CSV rỗng hoặc không có tiêu đề cột.")

    required_headers = {"code", "name"}
    missing = required_headers - set(h.strip() for h in reader.fieldnames if h)
    if missing:
        raise ValidationError(f"File CSV thiếu các cột bắt buộc: {', '.join(missing)}.")

    imported_items = []
    errors = []
    seen_codes = set()

    rows = list(reader)
    if not rows:
        return {"imported_count": 0, "failed_count": 0, "errors": []}

    with transaction.atomic():
        for line_no, row in enumerate(rows, start=2):
            raw_code = (row.get("code") or "").strip().upper()
            raw_name = (row.get("name") or "").strip()
            parent_code = (row.get("parent_code") or "").strip().upper()
            expense_type = (row.get("expense_type") or "").strip()
            default_account_code = (row.get("default_account_code") or "").strip()
            applicable_scope = (row.get("applicable_scope") or "").strip()
            start_date_str = (row.get("start_date") or "").strip()
            end_date_str = (row.get("end_date") or "").strip()
            status = (row.get("status") or "").strip().upper() or CatalogStatus.ACTIVE
            description = (row.get("description") or "").strip()

            line_errors = []

            # 1. Bắt buộc code và name
            if not raw_code:
                line_errors.append("Mã khoản mục chi phí không được để trống.")
            if not raw_name:
                line_errors.append("Tên khoản mục chi phí không được để trống.")

            # 2. Kiểm tra trùng mã trong file
            if raw_code in seen_codes:
                line_errors.append(f"Mã khoản mục '{raw_code}' bị trùng lặp trong file import.")
            else:
                seen_codes.add(raw_code)

            # 3. Kiểm tra trùng mã trong CSDL
            if raw_code and ExpenseItem.objects.filter(company=company, code__iexact=raw_code).exists():
                line_errors.append(f"Mã khoản mục '{raw_code}' đã tồn tại trong doanh nghiệp.")

            # 4. Kiểm tra khoản mục cha
            parent_obj = None
            if parent_code:
                parent_obj = ExpenseItem.objects.filter(company=company, code__iexact=parent_code).first()
                if not parent_obj:
                    line_errors.append(f"Khoản mục cha '{parent_code}' không tồn tại trong doanh nghiệp.")
                elif parent_obj.status != CatalogStatus.ACTIVE:
                    line_errors.append(f"Khoản mục cha '{parent_code}' đã ngừng sử dụng.")

            # 5. Kiểm tra tài khoản mặc định
            account_obj = None
            if default_account_code:
                account_obj = Account.objects.filter(company=company, code=default_account_code).first()
                if not account_obj:
                    line_errors.append(f"Tài khoản kế toán '{default_account_code}' không tồn tại trong doanh nghiệp.")
                elif account_obj.status != "ACTIVE":
                    line_errors.append(f"Tài khoản kế toán '{default_account_code}' đã ngừng sử dụng.")
                elif not account_obj.is_postable:
                    line_errors.append(f"Tài khoản kế toán '{default_account_code}' không cho phép hạch toán trực tiếp.")

            # 6. Kiểm tra ngày hiệu lực
            start_date, end_date = None, None
            if start_date_str:
                try:
                    start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
                except ValueError:
                    line_errors.append(f"Định dạng ngày bắt đầu '{start_date_str}' không hợp lệ (chuẩn: YYYY-MM-DD).")
            if end_date_str:
                try:
                    end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
                except ValueError:
                    line_errors.append(f"Định dạng ngày kết thúc '{end_date_str}' không hợp lệ (chuẩn: YYYY-MM-DD).")

            if start_date and end_date and end_date < start_date:
                line_errors.append("Ngày kết thúc hiệu lực phải lớn hơn hoặc bằng ngày bắt đầu.")

            if status not in (CatalogStatus.ACTIVE, CatalogStatus.INACTIVE):
                line_errors.append(f"Trạng thái '{status}' không hợp lệ (phải là ACTIVE hoặc INACTIVE).")

            if line_errors:
                errors.append({"line": line_no, "code": raw_code, "errors": line_errors})
                continue

            iam_user = _resolve_iam_user(user)
            item = ExpenseItem.objects.create(
                company=company,
                code=raw_code,
                name=raw_name,
                parent=parent_obj,
                expense_type=expense_type,
                default_account=account_obj,
                applicable_scope=applicable_scope,
                start_date=start_date,
                end_date=end_date,
                status=status,
                description=description,
                created_by=iam_user,
            )
            imported_items.append(item)
            record_expense_item_audit(
                item,
                "EXPENSE_ITEM_IMPORT",
                before=None,
                after=get_expense_item_snapshot(item),
                user=iam_user,
                reason="Import từ file CSV",
            )

    return {
        "imported_count": len(imported_items),
        "failed_count": len(errors),
        "errors": errors,
    }
