"""
Bank Account Business Services for UC-MD-08 (Quản lý tài khoản ngân hàng).
Implements code generation, normalization, masking, impact calculation,
default management, status changes, connection management, import/export, and audit logging.
"""

import csv
import io
import re
from datetime import date
from decimal import Decimal
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from audit_log.models import ActorType, EventCategory
from audit_log.services import record_audit
from iam.permissions import has_effective_permission

from .models import (
    Bank,
    BankAccountScope,
    BankAccountStatus,
    BankAccountType,
    BankConnectionStatus,
    CompanyBankAccount,
    Currency,
)


# =====================================================================
# 1. NORMALIZATION & MASKING (BR-BANK-ACC-05, BR-BANK-ACC-39)
# =====================================================================

def normalize_account_number(account_number: str) -> str:
    """Chuẩn hóa số tài khoản: loại bỏ khoảng trắng và chuyển chữ hoa."""
    if not account_number:
        return ""
    return re.sub(r"\s+", "", str(account_number)).upper()


def mask_account_number(account_number: str) -> str:
    """
    Che một phần số tài khoản ngân hàng đối với User không có quyền xem đầy đủ (BR-BANK-ACC-39, EF-23).
    Ví dụ: '19000001' -> '****0001', '1234567890' -> '******7890'
    """
    cleaned = normalize_account_number(account_number)
    if not cleaned:
        return ""
    if len(cleaned) <= 4:
        return "*" * len(cleaned)
    return "*" * (len(cleaned) - 4) + cleaned[-4:]


def generate_bank_account_code(company, prefix="TKNH") -> str:
    """
    Sinh mã tài khoản nội bộ tự động theo tiền tố TKNH + dãy số 4 chữ số (BR-BANK-ACC-02).
    """
    existing_codes = list(
        CompanyBankAccount.objects.filter(company=company, code__startswith=prefix)
        .values_list("code", flat=True)
    )
    max_num = 0
    pattern = re.compile(rf"^{prefix}(\d+)$", re.IGNORECASE)
    for c in existing_codes:
        m = pattern.match(c.strip())
        if m:
            val = int(m.group(1))
            if val > max_num:
                max_num = val
    next_num = max_num + 1
    return f"{prefix}{next_num:04d}"


def get_bank_account_snapshot(account: CompanyBankAccount) -> dict:
    """Trả về snapshot dữ liệu tài khoản ngân hàng không chứa thông tin nhạy cảm."""
    return {
        "id": str(account.pk),
        "code": account.code,
        "account_number": account.account_number,
        "account_name": account.account_name,
        "bank": str(account.bank_id),
        "bank_name": account.bank.name if account.bank_id else "",
        "bank_branch": account.bank_branch,
        "account_type": account.account_type,
        "currency": str(account.currency_id),
        "currency_code": account.currency.code if account.currency_id else "",
        "swift_bic": account.swift_bic,
        "iban_routing_code": account.iban_routing_code,
        "account_scope": account.account_scope,
        "branch": str(account.branch_id) if account.branch_id else None,
        "project": str(account.project_id) if account.project_id else None,
        "gl_account": str(account.gl_account_id) if account.gl_account_id else None,
        "cost_center": str(account.cost_center_id) if account.cost_center_id else None,
        "is_default": account.is_default,
        "allow_receipt": account.allow_receipt,
        "allow_payment": account.allow_payment,
        "status": account.status,
        "connection_status": account.connection_status,
        "connection_provider": account.connection_provider,
        "connection_id": account.connection_id,
        "sync_scope": account.sync_scope,
        "opened_date": str(account.opened_date) if account.opened_date else None,
        "closed_date": str(account.closed_date) if account.closed_date else None,
    }


def record_bank_account_audit(account: CompanyBankAccount, action_code: str, before=None, after=None, user=None, reason=""):
    """Ghi Audit Log nghiệp vụ cho tài khoản ngân hàng (BR-BANK-ACC-55, BR-BANK-ACC-56)."""
    user_account = getattr(user, "iam_account", None) if user and hasattr(user, "iam_account") else None
    diff = {}
    if before and after:
        for k, v in after.items():
            if before.get(k) != v:
                diff[k] = {"before": before.get(k), "after": v}

    record_audit(
        company=account.company,
        actor_user=user_account,
        module_code="MD",
        action_code=action_code,
        entity=account,
        before=before,
        after=after,
        reason=reason,
        event_category=EventCategory.MASTER_DATA,
        description=f"Thao tác {action_code} trên tài khoản ngân hàng {account.code} ({account.account_number})",
    )


# =====================================================================
# 2. IMPACT REPORT & DEPENDENCY CHECK (BR-BANK-ACC-33, EF-16, EF-17)
# =====================================================================

def get_bank_account_impact(account: CompanyBankAccount) -> dict:
    """
    Báo cáo ảnh hưởng khi thay đổi trạng thái, ngừng hoặc đóng tài khoản ngân hàng.
    Kiểm tra số dư, giao dịch chờ, sao kê, đối chiếu và tài khoản mặc định (Section 2.3 Step 4).
    """
    bank_balance = Decimal("0")
    transactions_count = 0
    open_transactions = 0
    unreconciled_lines = 0
    statements_count = 0

    # 1. Kiểm tra từ phân hệ bank_management nếu có gắn profile
    if hasattr(account, "bank_profile"):
        profile = account.bank_profile
        bank_balance = getattr(profile, "balance", Decimal("0"))
        transactions_count = profile.transactions.count()
        open_transactions = profile.transactions.filter(status__in=("DRAFT", "PENDING_APPROVAL")).count()
        statements_count = profile.statement_imports.count()
        
        # Unreconciled statement lines
        from bank_management.models import StatementLine
        unreconciled_lines = StatementLine.objects.filter(
            statement__account=profile
        ).exclude(match_status="MATCHED").count()

        # Thêm transfers
        transactions_count += profile.incoming_transfers.count() + profile.outgoing_transfers.count()
        open_transactions += profile.outgoing_transfers.filter(status="DRAFT").count()

    # 2. Kiểm tra từ phân hệ cash_management (rút / nộp tiền mặt vào ngân hàng)
    try:
        from cash_management.models import CashTransfer
        cash_transfers = CashTransfer.objects.filter(bank_account=account)
        transactions_count += cash_transfers.count()
        open_transactions += cash_transfers.filter(status="DRAFT").count()
    except Exception:
        pass

    # 3. Kiểm tra số dư sổ cái kế toán
    gl_balance = Decimal("0")
    if account.gl_account_id:
        try:
            from general_ledger.models import AccountBalance
            gl_bal = AccountBalance.objects.filter(account=account.gl_account).order_by("-period__end_date").first()
            if gl_bal:
                gl_balance = gl_bal.ending_debit - gl_bal.ending_credit
        except Exception:
            pass

    data_scopes_count = account.data_scopes.count()

    can_delete = (
        transactions_count == 0
        and bank_balance == 0
        and gl_balance == 0
        and statements_count == 0
        and not account.is_default
        and data_scopes_count == 0
    )

    can_close = (
        open_transactions == 0
        and unreconciled_lines == 0
        and bank_balance == 0
    )

    return {
        "bank_balance": str(bank_balance),
        "gl_balance": str(gl_balance),
        "transactions_count": transactions_count,
        "open_transactions": open_transactions,
        "unreconciled_lines": unreconciled_lines,
        "statements_count": statements_count,
        "is_default": account.is_default,
        "connection_status": account.connection_status,
        "data_scopes_count": data_scopes_count,
        "can_delete": can_delete,
        "can_close": can_close,
    }


# =====================================================================
# 3. DEFAULT ACCOUNT MANAGEMENT (BR-BANK-ACC-11, AF-07, AF-08, BR-BANK-ACC-53)
# =====================================================================

def set_default_bank_account(account: CompanyBankAccount, confirm_replace=False, user=None) -> CompanyBankAccount:
    """
    Đặt tài khoản làm mặc định trong cùng phạm vi và đồng tiền (BR-BANK-ACC-11).
    Yêu cầu xác nhận confirm_replace nếu đã có tài khoản mặc định khác đang hoạt động (AF-08).
    """
    if account.status != BankAccountStatus.ACTIVE:
        raise ValidationError({"status": "Tài khoản mặc định phải ở trạng thái ACTIVE."})

    # Tìm tài khoản mặc định hiện tại cùng scope, branch, project và currency
    current_default = CompanyBankAccount.objects.filter(
        company=account.company,
        currency=account.currency,
        account_scope=account.account_scope,
        branch=account.branch,
        project=account.project,
        is_default=True,
    ).exclude(pk=account.pk)

    if current_default.exists() and not confirm_replace:
        raise ValidationError({"confirm_replace": "Đã có tài khoản mặc định cùng phạm vi và đồng tiền. Cần xác nhận thay thế."})

    with transaction.atomic():
        for prev in current_default.select_for_update():
            prev_before = get_bank_account_snapshot(prev)
            prev.is_default = False
            prev.save(update_fields=("is_default",))
            record_bank_account_audit(prev, "BANK_ACCOUNT_UNSET_DEFAULT", before=prev_before, after=get_bank_account_snapshot(prev), user=user)

        if not account.is_default:
            before = get_bank_account_snapshot(account)
            account.is_default = True
            account.full_clean()
            account.save(update_fields=("is_default",))
            record_bank_account_audit(account, "BANK_ACCOUNT_SET_DEFAULT", before=before, after=get_bank_account_snapshot(account), user=user)

    return account


# =====================================================================
# 4. STATUS CHANGE & CLOSE ACCOUNT (Section 2.3, BR-BANK-ACC-21..25, EF-16..18)
# =====================================================================

def change_bank_account_status(
    account: CompanyBankAccount,
    new_status: str,
    reason: str = "",
    effective_date: date = None,
    replacement_account_id: str = None,
    confirm_balance: bool = False,
    user=None,
) -> CompanyBankAccount:
    """
    Thay đổi trạng thái tài khoản ngân hàng: ACTIVE, INACTIVE, BLOCKED, CLOSED, ARCHIVED.
    Kiểm tra số dư, giao dịch chờ, sao kê, và tài khoản mặc định thay thế (Section 2.3, Main Flow 2.3).
    """
    if new_status not in BankAccountStatus.values:
        raise ValidationError({"status": "Trạng thái không hợp lệ."})

    if new_status != BankAccountStatus.ACTIVE and not (reason and reason.strip()):
        raise ValidationError({"reason": "Cần nêu lý do khi ngừng hoặc đóng tài khoản."})

    impact = get_bank_account_impact(account)

    if new_status == BankAccountStatus.CLOSED:
        # EF-16, BR-BANK-ACC-34: Số dư kế toán hoặc ngân hàng khác 0
        if (Decimal(impact["bank_balance"]) != 0 or Decimal(impact["gl_balance"]) != 0) and not confirm_balance:
            raise ValidationError({"status": "Tài khoản còn số dư khác 0. Cần tất toán số dư trước khi đóng tài khoản."})

        # EF-17, BR-BANK-ACC-34: Giao dịch chờ xử lý hoặc chưa đối chiếu
        if impact["open_transactions"] > 0 or impact["unreconciled_lines"] > 0:
            raise ValidationError({"status": "Tài khoản còn giao dịch chờ xử lý hoặc chưa đối chiếu."})

    # EF-18: Tài khoản mặc định duy nhất khi ngừng/đóng
    if account.is_default and new_status in (BankAccountStatus.INACTIVE, BankAccountStatus.CLOSED, BankAccountStatus.BLOCKED):
        other_active = CompanyBankAccount.objects.filter(
            company=account.company,
            currency=account.currency,
            account_scope=account.account_scope,
            branch=account.branch,
            project=account.project,
            status=BankAccountStatus.ACTIVE,
        ).exclude(pk=account.pk)

        if other_active.exists() and not replacement_account_id:
            raise ValidationError({"replacement_account": "Đây là tài khoản mặc định. Cần chọn tài khoản thay thế trước khi đóng hoặc ngừng sử dụng."})

    with transaction.atomic():
        # Xử lý tài khoản thay thế nếu có
        if replacement_account_id and account.is_default:
            replacement = CompanyBankAccount.objects.select_for_update().get(pk=replacement_account_id, company=account.company)
            set_default_bank_account(replacement, confirm_replace=True, user=user)
            account.is_default = False

        if new_status in (BankAccountStatus.INACTIVE, BankAccountStatus.CLOSED, BankAccountStatus.BLOCKED):
            account.is_default = False
            # BR-BANK-ACC-24, BR-BANK-ACC-45: Ngắt kết nối ngân hàng hoặc dừng đồng bộ mới
            if account.connection_status == BankConnectionStatus.CONNECTED:
                account.connection_status = BankConnectionStatus.DISCONNECTED

        if new_status == BankAccountStatus.CLOSED:
            account.closed_date = effective_date or timezone.localdate()

        before = get_bank_account_snapshot(account)
        account.status = new_status
        account.full_clean()
        account.save()
        action_code = "BANK_ACCOUNT_CLOSE" if new_status == BankAccountStatus.CLOSED else "BANK_ACCOUNT_STATUS"
        record_bank_account_audit(account, action_code, before=before, after=get_bank_account_snapshot(account), user=user, reason=reason)

    return account


# =====================================================================
# 5. BANK INTEGRATION CONNECTION (Section 2.4, BR-BANK-ACC-40..45, 56)
# =====================================================================

def connect_bank_account(
    account: CompanyBankAccount,
    provider: str,
    connection_id: str,
    sync_scope: str = "STATEMENT",
    auth_expires_at=None,
    user=None,
) -> CompanyBankAccount:
    """
    Liên kết tài khoản ngân hàng với dịch vụ kết nối ngân hàng (Section 2.4).
    Không lưu hoặc hiển thị mật khẩu/Token/Secret dạng đọc được (BR-BANK-ACC-40, 56).
    """
    if account.status not in (BankAccountStatus.ACTIVE, BankAccountStatus.DRAFT):
        raise ValidationError({"status": "Chỉ tài khoản ACTIVE hoặc DRAFT mới được phép kết nối ngân hàng."})

    with transaction.atomic():
        before = get_bank_account_snapshot(account)
        account.connection_provider = provider
        account.connection_id = connection_id
        account.connection_status = BankConnectionStatus.CONNECTED
        account.sync_scope = sync_scope
        account.auth_expires_at = auth_expires_at
        account.last_sync_at = timezone.now()
        account.last_error = ""
        account.save()
        record_bank_account_audit(account, "BANK_ACCOUNT_CONNECT", before=before, after=get_bank_account_snapshot(account), user=user)

    return account


def disconnect_bank_account(account: CompanyBankAccount, reason: str = "", user=None) -> CompanyBankAccount:
    """
    Ngắt kết nối ngân hàng. Bảo toàn dữ liệu giao dịch và sao kê đã đồng bộ (BR-BANK-ACC-45).
    """
    with transaction.atomic():
        before = get_bank_account_snapshot(account)
        account.connection_status = BankConnectionStatus.DISCONNECTED
        account.save(update_fields=("connection_status",))
        record_bank_account_audit(account, "BANK_ACCOUNT_DISCONNECT", before=before, after=get_bank_account_snapshot(account), user=user, reason=reason)

    return account


# =====================================================================
# 6. IMPORT & EXPORT CSV (AF-17, AF-18, EF-22, EF-23, BR-BANK-ACC-46..48)
# =====================================================================

def import_bank_accounts_from_csv(company, file_obj, user=None) -> dict:
    """
    Import danh sách tài khoản ngân hàng từ file CSV (AF-17, BR-BANK-ACC-46, 47).
    Kiểm tra mã nội bộ, số tài khoản, ngân hàng, đồng tiền, tài khoản kế toán.
    Báo lỗi theo từng dòng, chỉ tạo các dòng hợp lệ.
    """
    try:
        content = file_obj.read().decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValidationError({"file": "Tệp phải dùng định dạng UTF-8."}) from exc

    reader = csv.DictReader(io.StringIO(content))
    required_columns = {"account_number", "account_name", "bank", "currency"}
    if not required_columns.issubset(set(reader.fieldnames or [])):
        raise ValidationError({"file": f"Thiếu cột bắt buộc trong CSV: {required_columns - set(reader.fieldnames or [])}"})

    rows = list(reader)
    if len(rows) > 1000:
        raise ValidationError({"file": "Tệp CSV tối đa 1000 dòng."})

    from general_ledger.models import Account
    from organization.models import Branch

    result = {"created": [], "errors": []}

    for idx, row in enumerate(rows, start=2):
        acc_num = normalize_account_number(row.get("account_number", ""))
        acc_name = (row.get("account_name") or "").strip()
        bank_code = (row.get("bank") or "").strip()
        curr_code = (row.get("currency") or "").strip().upper()
        code = (row.get("code") or "").strip() or None

        if not acc_num or not acc_name or not bank_code or not curr_code:
            result["errors"].append({"row": idx, "error": "Thiếu thông tin bắt buộc: số TK, tên TK, ngân hàng hoặc đồng tiền."})
            continue

        bank = Bank.objects.filter(code__iexact=bank_code).first()
        if not bank or bank.status != "ACTIVE":
            result["errors"].append({"row": idx, "error": f"Ngân hàng '{bank_code}' không tồn tại hoặc đã ngừng hoạt động."})
            continue

        currency = Currency.objects.filter(code__iexact=curr_code).first()
        if not currency or not currency.is_active:
            result["errors"].append({"row": idx, "error": f"Đồng tiền '{curr_code}' không tồn tại hoặc bị ngừng."})
            continue

        # Check existing (bank, account_number, currency)
        if CompanyBankAccount.objects.filter(company=company, bank=bank, account_number=acc_num, currency=currency).exists():
            result["errors"].append({"row": idx, "error": f"Số tài khoản '{acc_num}' đã tồn tại với cùng ngân hàng và đồng tiền."})
            continue

        # GL account
        gl_code = (row.get("gl_account") or "").strip()
        gl_account = None
        if gl_code:
            gl_account = Account.objects.filter(company=company, code=gl_code, status="ACTIVE", is_postable=True).first()
            if not gl_account:
                result["errors"].append({"row": idx, "error": f"Tài khoản kế toán '{gl_code}' không hợp lệ hoặc không cho phép hạch toán."})
                continue

        # Branch
        branch_code = (row.get("branch") or "").strip()
        branch = None
        if branch_code:
            branch = Branch.objects.filter(company=company, code=branch_code, status="ACTIVE").first()
            if not branch:
                result["errors"].append({"row": idx, "error": f"Chi nhánh '{branch_code}' không tồn tại hoặc đã ngừng hoạt động."})
                continue

        account_type = row.get("account_type", BankAccountType.PAYMENT).strip().upper()
        if account_type not in BankAccountType.values:
            account_type = BankAccountType.PAYMENT

        account_scope = row.get("account_scope", BankAccountScope.COMPANY_SHARED).strip().upper()
        if account_scope not in BankAccountScope.values:
            account_scope = BankAccountScope.COMPANY_SHARED
        if account_scope == BankAccountScope.BRANCH and not branch:
            result["errors"].append({"row": idx, "error": "Tài khoản chi nhánh bắt buộc phải có chi nhánh quản lý hợp lệ."})
            continue

        status = row.get("status", BankAccountStatus.ACTIVE).strip().upper()
        if status not in BankAccountStatus.values:
            status = BankAccountStatus.ACTIVE

        allow_receipt = str(row.get("allow_receipt", "true")).lower() in ("true", "1", "yes", "t")
        allow_payment = str(row.get("allow_payment", "true")).lower() in ("true", "1", "yes", "t")

        try:
            with transaction.atomic():
                acc = CompanyBankAccount(
                    company=company,
                    code=code or "",
                    account_number=acc_num,
                    account_name=acc_name,
                    bank=bank,
                    bank_branch=(row.get("bank_branch") or "").strip(),
                    currency=currency,
                    gl_account=gl_account,
                    branch=branch,
                    account_type=account_type,
                    account_scope=account_scope,
                    status=status,
                    allow_receipt=allow_receipt,
                    allow_payment=allow_payment,
                    swift_bic=(row.get("swift_bic") or "").strip(),
                )
                acc.full_clean()
                acc.save()
                record_bank_account_audit(acc, "BANK_ACCOUNT_IMPORT", after=get_bank_account_snapshot(acc), user=user)
                result["created"].append({"id": str(acc.pk), "code": acc.code, "account_number": acc.account_number})
        except Exception as exc:
            result["errors"].append({"row": idx, "error": str(exc)})

    return result


def export_bank_accounts_to_csv(queryset, user=None, company=None) -> str:
    """
    Xuất danh sách tài khoản ngân hàng ra định dạng CSV (AF-18, BR-BANK-ACC-48).
    Che số tài khoản nếu user không có quyền xem đầy đủ (BR-BANK-ACC-39, EF-23).
    """
    if not company:
        first_acc = queryset.first()
        company = getattr(first_acc, "company", None)

    can_view_unmasked = (
        user is not None
        and (
            user.is_superuser
            or (
                company is not None
                and hasattr(user, "iam_account")
                and user.iam_account is not None
                and has_effective_permission(user.iam_account, company, "MD.BANK_ACCOUNT.VIEW_UNMASKED")
            )
        )
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "code",
        "account_number",
        "account_name",
        "bank_code",
        "bank_name",
        "bank_branch",
        "currency",
        "account_type",
        "account_scope",
        "branch",
        "gl_account",
        "is_default",
        "allow_receipt",
        "allow_payment",
        "status",
        "connection_status",
    ])

    for acc in queryset.select_related("bank", "currency", "branch", "gl_account").order_by("code"):
        acc_num = acc.account_number if can_view_unmasked else mask_account_number(acc.account_number)
        writer.writerow([
            acc.code,
            acc_num,
            acc.account_name,
            acc.bank.code if acc.bank_id else "",
            acc.bank.name if acc.bank_id else "",
            acc.bank_branch,
            acc.currency.code if acc.currency_id else "",
            acc.account_type,
            acc.account_scope,
            acc.branch.code if acc.branch_id else "",
            acc.gl_account.code if acc.gl_account_id else "",
            acc.is_default,
            acc.allow_receipt,
            acc.allow_payment,
            acc.status,
            acc.connection_status,
        ])

    return output.getvalue()
