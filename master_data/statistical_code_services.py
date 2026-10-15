import csv
import io
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
import uuid

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from audit_log.models import EventCategory
from audit_log.services import record_audit
from general_ledger.models import JournalLine
from iam.models import UserAccount
from organization.models import Company

from .models import CatalogStatus, StatisticalCode, _validate_tree


# =====================================================================
# 1. AUDIT & SNAPSHOT HELPERS (BR-MD-STAT-26)
# =====================================================================

def _resolve_iam_user(user):
    if not user:
        return None
    if hasattr(user, "iam_account") and user.iam_account is not None:
        return user.iam_account
    if isinstance(user, UserAccount):
        return user
    return None


def get_statistical_code_snapshot(item: StatisticalCode) -> Dict[str, Any]:
    """Tạo snapshot dữ liệu phục vụ audit và so sánh lịch sử."""
    return {
        "id": str(item.id),
        "company_id": str(item.company_id),
        "code": item.code,
        "name": item.name,
        "parent_id": str(item.parent_id) if item.parent_id else None,
        "category": item.category,
        "allow_voucher_selection": item.allow_voucher_selection,
        "applicable_scope": item.applicable_scope,
        "start_date": str(item.start_date) if item.start_date else None,
        "end_date": str(item.end_date) if item.end_date else None,
        "description": item.description,
        "status": item.status,
        "version": item.version,
    }


def record_statistical_code_audit(
    item: StatisticalCode,
    action_code: str,
    before: Optional[Dict[str, Any]] = None,
    after: Optional[Dict[str, Any]] = None,
    user=None,
    reason: str = "",
):
    """Ghi Audit Log nghiệp vụ cho mã thống kê (BR-MD-STAT-26)."""
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
        description=f"Thao tác {action_code} trên mã thống kê {item.code} ({item.name})",
    )


# =====================================================================
# 2. IMPACT & USAGE ANALYSIS (BR-MD-STAT-12, 13, 14, EF-07, EF-08)
# =====================================================================

def get_statistical_code_impact(item: StatisticalCode) -> Dict[str, Any]:
    """
    Phân tích tác động và kiểm tra mức độ sử dụng của mã thống kê.
    Dùng cho màn hình chi tiết, trước khi xóa hoặc đổi trạng thái (EF-08, BR-MD-STAT-12, 13).
    """
    children_count = item.children.count()
    active_children_count = item.children.filter(status=CatalogStatus.ACTIVE).count()

    # Kiểm tra liên kết trong sổ cái kế toán
    journal_lines_count = (
        JournalLine.objects.filter(dimensions__statistical_code_id=str(item.id)).count()
        + JournalLine.objects.filter(dimensions__statistical_code=item.code).count()
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


def has_statistical_code_transactions(item: StatisticalCode) -> bool:
    """Kiểm tra mã thống kê đã phát sinh dữ liệu trong các chứng từ / giao dịch hay chưa."""
    impact = get_statistical_code_impact(item)
    return impact["journal_lines_count"] > 0


# =====================================================================
# 3. STATUS TRANSITION (AF-10, AF-11, AF-13, EF-09, BR-MD-STAT-10..17)
# =====================================================================

def change_statistical_code_status(
    item: StatisticalCode,
    new_status: str,
    version: Optional[int] = None,
    reason: str = "",
    deactivate_children: bool = False,
    user=None,
) -> StatisticalCode:
    """
    Chuyển trạng thái mã thống kê (ACTIVE / INACTIVE).
    Xử lý các quy tắc về mã con và mã cha (BR-MD-STAT-16, 17, AF-13, EF-09).
    """
    if version is not None and item.version != version:
        raise ValidationError({"version": "Dữ liệu đã bị thay đổi bởi người dùng khác. Vui lòng tải lại trang."})

    if new_status == item.status:
        return item

    if new_status not in (CatalogStatus.ACTIVE, CatalogStatus.INACTIVE):
        raise ValidationError({"status": f"Trạng thái '{new_status}' không hợp lệ."})

    with transaction.atomic():
        if new_status == CatalogStatus.INACTIVE:
            # Kiểm tra mã con đang hoạt động
            active_children = item.children.filter(status=CatalogStatus.ACTIVE)
            if active_children.exists():
                if not deactivate_children:
                    raise ValidationError({
                        "deactivate_children": (
                            "Mã thống kê có các mã con đang hoạt động. "
                            "Cần xử lý các mã con trước hoặc xác nhận ngừng toàn bộ cây mã."
                        )
                    })
                # Ngừng đệ quy toàn bộ con cháu
                def _deact_descendants(parent_node):
                    iam_user = _resolve_iam_user(user)
                    for child in parent_node.children.filter(status=CatalogStatus.ACTIVE):
                        c_before = get_statistical_code_snapshot(child)
                        child.status = CatalogStatus.INACTIVE
                        child.version += 1
                        child.updated_by = iam_user
                        child.save()
                        record_statistical_code_audit(
                            child,
                            "STATISTICAL_CODE_DEACTIVATE_CASCADE",
                            before=c_before,
                            after=get_statistical_code_snapshot(child),
                            user=iam_user,
                            reason=f"Ngừng sử dụng theo mã cha {item.code}: {reason}",
                        )
                        _deact_descendants(child)

                _deact_descendants(item)

        elif new_status == CatalogStatus.ACTIVE:
            # Không được kích hoạt nếu cha đang INACTIVE (BR-MD-STAT-16)
            if item.parent and item.parent.status != CatalogStatus.ACTIVE:
                raise ValidationError({
                    "parent": "Không thể kích hoạt mã thống kê khi mã cha đang ngừng sử dụng."
                })

        iam_user = _resolve_iam_user(user)
        before = get_statistical_code_snapshot(item)
        item.status = new_status
        item.version += 1
        item.updated_by = iam_user
        item.save()
        after = get_statistical_code_snapshot(item)

        action_code = "STATISTICAL_CODE_ACTIVATE" if new_status == CatalogStatus.ACTIVE else "STATISTICAL_CODE_DEACTIVATE"
        record_statistical_code_audit(item, action_code, before=before, after=after, user=iam_user, reason=reason)

    return item


# =====================================================================
# 4. QUICK CREATE (AF-07, BR-MD-STAT-22)
# =====================================================================

def quick_create_statistical_code(
    company: Company,
    code: str,
    name: str,
    category: str = "",
    user=None,
) -> StatisticalCode:
    """
    Thêm nhanh mã thống kê ngay trên màn hình chứng từ (AF-07, BR-MD-STAT-22).
    """
    iam_user = _resolve_iam_user(user)
    norm_code = code.strip().upper()
    norm_name = name.strip()

    item = StatisticalCode(
        company=company,
        code=norm_code,
        name=norm_name,
        category=category.strip(),
        allow_voucher_selection=True,
        status=CatalogStatus.ACTIVE,
        created_by=iam_user,
    )
    item.full_clean()
    item.save()

    record_statistical_code_audit(
        item,
        "STATISTICAL_CODE_QUICK_CREATE",
        before=None,
        after=get_statistical_code_snapshot(item),
        user=iam_user,
        reason="Thêm nhanh từ chứng từ",
    )
    return item


# =====================================================================
# 5. AI SUGGESTION SERVICE (BR-MD-STAT-27..29, AF-12)
# =====================================================================

def ai_suggest_statistical_code(
    company: Company,
    description: str,
    context: str = "",
) -> Dict[str, Any]:
    """
    AI Assistant gợi ý mã thống kê phù hợp dựa trên nội dung nghiệp vụ (BR-MD-STAT-27..29, AF-12).
    Chỉ đưa ra gợi ý, không tự động áp dụng vào chứng từ khi chưa có xác nhận của User.
    """
    text = f"{description} {context}".lower().strip()
    today = timezone.localdate()

    # Tìm các mã thống kê đang hoạt động và cho phép chọn trên chứng từ
    qs = StatisticalCode.objects.filter(
        company=company,
        status=CatalogStatus.ACTIVE,
        allow_voucher_selection=True,
    )

    suggested_code = None
    matched_keyword = None
    confidence = 0.5

    for item in qs:
        # Kiểm tra từ khóa trùng khớp trong tên hoặc mã
        item_text = f"{item.code} {item.name} {item.category}".lower()
        words = [w for w in item_text.replace("-", " ").replace("_", " ").split() if len(w) >= 3]
        for w in words:
            if w in text:
                suggested_code = item
                matched_keyword = w
                confidence = 0.85
                break
        if suggested_code:
            break

    # Nếu không tìm thấy bằng từ khóa trực tiếp, tìm mã phù hợp đầu tiên
    if not suggested_code:
        suggested_code = qs.first()
        confidence = 0.4

    reasoning = (
        f"Gợi ý mã thống kê '{suggested_code.code}' dựa trên từ khóa nhận diện '{matched_keyword}' trong nội dung chứng từ."
        if matched_keyword and suggested_code
        else "Gợi ý mã thống kê khả dụng theo danh mục doanh nghiệp."
    )

    return {
        "suggested_id": str(suggested_code.id) if suggested_code else None,
        "suggested_code": suggested_code.code if suggested_code else None,
        "suggested_name": suggested_code.name if suggested_code else None,
        "suggested_category": suggested_code.category if suggested_code else "",
        "confidence": confidence if suggested_code else 0.0,
        "reasoning": reasoning if suggested_code else "Không tìm thấy mã thống kê phù hợp.",
    }


# =====================================================================
# 6. CSV IMPORT & EXPORT (BR-MD-STAT-24, 25, AF-08, AF-09, EF-12, EF-13)
# =====================================================================

def export_statistical_codes_to_csv(queryset) -> str:
    """Xuất danh sách mã thống kê ra file CSV (AF-09, BR-MD-STAT-24)."""
    output = io.StringIO()
    # Write UTF-8 BOM so Excel opens it with correct Vietnamese accents
    output.write("\ufeff")
    writer = csv.writer(output)
    writer.writerow([
        "code",
        "name",
        "parent_code",
        "category",
        "allow_voucher_selection",
        "applicable_scope",
        "start_date",
        "end_date",
        "status",
        "description",
    ])

    for item in queryset.select_related("parent").order_by("code"):
        writer.writerow([
            item.code,
            item.name,
            item.parent.code if item.parent_id else "",
            item.category,
            "TRUE" if item.allow_voucher_selection else "FALSE",
            item.applicable_scope,
            str(item.start_date) if item.start_date else "",
            str(item.end_date) if item.end_date else "",
            item.status,
            item.description,
        ])

    return output.getvalue()


def import_statistical_codes_from_csv(company: Company, file_content: bytes, user=None) -> Dict[str, Any]:
    """
    Nhập danh sách mã thống kê từ file CSV (AF-08, BR-MD-STAT-24, 25).
    Xác thực từng dòng, báo cáo lỗi chi tiết theo dòng (EF-12, EF-13).
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

    iam_user = _resolve_iam_user(user)

    with transaction.atomic():
        for line_no, row in enumerate(rows, start=2):
            raw_code = (row.get("code") or "").strip().upper()
            raw_name = (row.get("name") or "").strip()
            parent_code = (row.get("parent_code") or "").strip().upper()
            category = (row.get("category") or "").strip()
            allow_voucher_raw = (row.get("allow_voucher_selection") or "TRUE").strip().upper()
            allow_voucher = allow_voucher_raw in ("TRUE", "1", "YES", "TRUE")
            applicable_scope = (row.get("applicable_scope") or "").strip()
            start_date_str = (row.get("start_date") or "").strip()
            end_date_str = (row.get("end_date") or "").strip()
            status = (row.get("status") or "").strip().upper() or CatalogStatus.ACTIVE
            description = (row.get("description") or "").strip()

            line_errors = []

            # 1. Bắt buộc code và name
            if not raw_code:
                line_errors.append("Mã thống kê không được để trống.")
            if not raw_name:
                line_errors.append("Tên mã thống kê không được để trống.")

            # 2. Kiểm tra trùng mã trong file
            if raw_code in seen_codes:
                line_errors.append(f"Mã thống kê '{raw_code}' bị trùng lặp trong file import.")
            else:
                seen_codes.add(raw_code)

            # 3. Kiểm tra trùng mã trong CSDL
            if raw_code and StatisticalCode.objects.filter(company=company, code__iexact=raw_code).exists():
                line_errors.append(f"Mã thống kê '{raw_code}' đã tồn tại trong doanh nghiệp.")

            # 4. Kiểm tra mã cha
            parent_obj = None
            if parent_code:
                parent_obj = StatisticalCode.objects.filter(company=company, code__iexact=parent_code).first()
                if not parent_obj:
                    line_errors.append(f"Mã thống kê cha '{parent_code}' không tồn tại trong doanh nghiệp.")
                elif parent_obj.status != CatalogStatus.ACTIVE:
                    line_errors.append(f"Mã thống kê cha '{parent_code}' đã ngừng sử dụng.")

            # 5. Kiểm tra ngày hiệu lực
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

            item = StatisticalCode.objects.create(
                company=company,
                code=raw_code,
                name=raw_name,
                parent=parent_obj,
                category=category,
                allow_voucher_selection=allow_voucher,
                applicable_scope=applicable_scope,
                start_date=start_date,
                end_date=end_date,
                status=status,
                description=description,
                created_by=iam_user,
            )
            imported_items.append(item)
            record_statistical_code_audit(
                item,
                "STATISTICAL_CODE_IMPORT",
                before=None,
                after=get_statistical_code_snapshot(item),
                user=iam_user,
                reason="Import từ file CSV",
            )

    return {
        "imported_count": len(imported_items),
        "failed_count": len(errors),
        "errors": errors,
    }


# =====================================================================
# 7. SELECTION VALIDATION (BR-MD-STAT-03, 07, 10, EF-10)
# =====================================================================

def validate_statistical_code_selection(
    company: Company,
    code_or_id: Any,
    voucher_type: Optional[str] = None,
    transaction_date: Optional[date] = None,
) -> StatisticalCode:
    """
    Xác thực mã thống kê khi người dùng chọn trên chứng từ / dòng hạch toán:
    - Bắt buộc thuộc doanh nghiệp hiện tại (BR-MD-STAT-03)
    - Trạng thái phải là ACTIVE (BR-MD-STAT-10, EF-10)
    - allow_voucher_selection phải là True (BR-MD-STAT-07, EF-10)
    - Ngày giao dịch nằm trong thời gian hiệu lực (BR-MD-STAT-10, EF-10)
    - Thuộc phạm vi nghiệp vụ nếu có cấu hình applicable_scope (BR-MD-STAT-10, EF-10)
    """
    if not code_or_id:
        raise ValidationError("Mã thống kê không được để trống.")

    item = None
    val_str = str(code_or_id).strip()
    try:
        val_uuid = uuid.UUID(val_str)
        item = StatisticalCode.objects.filter(company=company, pk=val_uuid).first()
    except (ValueError, AttributeError):
        pass

    if not item:
        item = StatisticalCode.objects.filter(company=company, code__iexact=val_str).first()

    if not item:
        raise ValidationError(f"Mã thống kê '{val_str}' không tồn tại trong doanh nghiệp.")

    # 1. Trạng thái hoạt động
    if item.status != CatalogStatus.ACTIVE:
        raise ValidationError(f"Mã thống kê '{item.code}' đã ngừng sử dụng.")

    # 2. Cờ cho phép chọn trên chứng từ
    if not item.allow_voucher_selection:
        raise ValidationError(
            f"Mã thống kê '{item.code}' được cấu hình chỉ dùng để tổng hợp, không được chọn trực tiếp trên chứng từ."
        )

    # 3. Thời gian hiệu lực
    if transaction_date:
        if isinstance(transaction_date, datetime):
            transaction_date = transaction_date.date()
        if item.start_date and transaction_date < item.start_date:
            raise ValidationError(
                f"Mã thống kê '{item.code}' chưa có hiệu lực tại ngày {transaction_date} (ngày bắt đầu: {item.start_date})."
            )
        if item.end_date and transaction_date > item.end_date:
            raise ValidationError(
                f"Mã thống kê '{item.code}' đã hết hiệu lực tại ngày {transaction_date} (ngày kết thúc: {item.end_date})."
            )

    # 4. Phạm vi nghiệp vụ áp dụng
    if voucher_type and item.applicable_scope:
        allowed = [s.strip().upper() for s in item.applicable_scope.replace(";", ",").split(",") if s.strip()]
        if allowed and "ALL" not in allowed and voucher_type.upper() not in allowed:
            raise ValidationError(
                f"Mã thống kê '{item.code}' không thuộc phạm vi nghiệp vụ '{voucher_type}' (phạm vi: {item.applicable_scope})."
            )

    return item


# =====================================================================
# 8. HIERARCHICAL TREE BUILDER (BR-MD-STAT-04, 30)
# =====================================================================

def get_statistical_code_tree(company: Company, status: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Trả về cấu trúc cây mã thống kê cha - con theo phân cấp cho doanh nghiệp (BR-MD-STAT-04, 30).
    Hỗ trợ cả cây đa cấp và danh mục phẳng.
    """
    qs = StatisticalCode.objects.filter(company=company)
    if status:
        qs = qs.filter(status=status)
    items = list(qs.order_by("code"))

    items_by_parent: Dict[Optional[uuid.UUID], List[StatisticalCode]] = {}
    for it in items:
        pid = it.parent_id
        items_by_parent.setdefault(pid, []).append(it)

    def _build_node(node: StatisticalCode) -> Dict[str, Any]:
        children = items_by_parent.get(node.id, [])
        return {
            "id": str(node.id),
            "code": node.code,
            "name": node.name,
            "category": node.category,
            "allow_voucher_selection": node.allow_voucher_selection,
            "applicable_scope": node.applicable_scope,
            "start_date": str(node.start_date) if node.start_date else None,
            "end_date": str(node.end_date) if node.end_date else None,
            "status": node.status,
            "version": node.version,
            "has_children": len(children) > 0,
            "children": [_build_node(child) for child in children],
        }

    root_items = items_by_parent.get(None, [])
    return [_build_node(root) for root in root_items]


# =====================================================================
# 9. FINANCIAL AGGREGATION & REPORTING (BR-MD-STAT-20, 21)
# =====================================================================

def get_statistical_code_summary(
    company: Company,
    code_id: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
) -> List[Dict[str, Any]]:
    """
    Tổng hợp phát sinh doanh thu, chi phí và số dư theo từng mã thống kê hoặc cây mã thống kê (BR-MD-STAT-20, 21).
    Khi tổng hợp theo mã cha, cộng dữ liệu của các mã con và không tính trùng số liệu.
    """
    items_qs = StatisticalCode.objects.filter(company=company)
    if code_id:
        target_item = items_qs.filter(pk=code_id).first()
        if not target_item:
            target_item = items_qs.filter(code__iexact=str(code_id).strip()).first()
        if not target_item:
            raise ValidationError("Mã thống kê không tồn tại.")
        all_descendants = []
        def _collect(curr):
            all_descendants.append(curr)
            for child in curr.children.all():
                _collect(child)
        _collect(target_item)
        items_list = all_descendants
    else:
        items_list = list(items_qs.order_by("code"))

    from general_ledger.models import JournalStatus
    lines_qs = JournalLine.objects.filter(
        entry__company=company,
        entry__status=JournalStatus.POSTED,
    ).select_related("account", "entry")

    if from_date:
        lines_qs = lines_qs.filter(entry__posting_date__gte=from_date)
    if to_date:
        lines_qs = lines_qs.filter(entry__posting_date__lte=to_date)

    code_to_id = {it.code.upper(): str(it.id) for it in items_qs}
    direct_stats: Dict[str, Dict[str, Decimal]] = {
        str(it.id): {
            "debit": Decimal("0"),
            "credit": Decimal("0"),
            "revenue": Decimal("0"),
            "expense": Decimal("0"),
        }
        for it in items_qs
    }

    for line in lines_qs:
        dims = line.dimensions or {}
        stat_id = dims.get("statistical_code_id")
        stat_code = (dims.get("statistical_code") or "").strip().upper()

        target_id = None
        if stat_id and str(stat_id) in direct_stats:
            target_id = str(stat_id)
        elif stat_code and stat_code in code_to_id:
            target_id = code_to_id[stat_code]

        if not target_id:
            continue

        st = direct_stats[target_id]
        debit = line.debit or Decimal("0")
        credit = line.credit or Decimal("0")
        st["debit"] += debit
        st["credit"] += credit

        acc_type = getattr(line.account, "account_type", "")
        if acc_type == "REVENUE":
            st["revenue"] += (credit - debit)
        elif acc_type == "EXPENSE":
            st["expense"] += (debit - credit)

    items_by_id = {str(it.id): it for it in items_qs}
    children_map: Dict[str, List[str]] = {}
    for it in items_qs:
        pid = str(it.parent_id) if it.parent_id else None
        if pid:
            children_map.setdefault(pid, []).append(str(it.id))

    def _calc_total(it_id: str) -> Dict[str, Decimal]:
        direct = direct_stats.get(it_id, {"debit": Decimal("0"), "credit": Decimal("0"), "revenue": Decimal("0"), "expense": Decimal("0")})
        tot_debit = direct["debit"]
        tot_credit = direct["credit"]
        tot_revenue = direct["revenue"]
        tot_expense = direct["expense"]

        for child_id in children_map.get(it_id, []):
            child_totals = _calc_total(child_id)
            tot_debit += child_totals["debit"]
            tot_credit += child_totals["credit"]
            tot_revenue += child_totals["revenue"]
            tot_expense += child_totals["expense"]

        return {
            "debit": tot_debit,
            "credit": tot_credit,
            "revenue": tot_revenue,
            "expense": tot_expense,
            "net": tot_revenue - tot_expense,
        }

    results = []
    for it in items_list:
        it_id = str(it.id)
        direct = direct_stats.get(it_id, {"debit": Decimal("0"), "credit": Decimal("0"), "revenue": Decimal("0"), "expense": Decimal("0")})
        totals = _calc_total(it_id)
        results.append({
            "id": it_id,
            "code": it.code,
            "name": it.name,
            "parent_id": str(it.parent_id) if it.parent_id else None,
            "category": it.category,
            "allow_voucher_selection": it.allow_voucher_selection,
            "status": it.status,
            "direct": {
                "debit": str(direct["debit"]),
                "credit": str(direct["credit"]),
                "revenue": str(direct["revenue"]),
                "expense": str(direct["expense"]),
                "net": str(direct["revenue"] - direct["expense"]),
            },
            "total": {
                "debit": str(totals["debit"]),
                "credit": str(totals["credit"]),
                "revenue": str(totals["revenue"]),
                "expense": str(totals["expense"]),
                "net": str(totals["net"]),
            },
        })

    return results

