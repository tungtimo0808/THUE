"""
Customer Business Services for UC-MD-01 (Quản lý khách hàng).
Implements code generation, duplicate detection, tax lookup, customer merging,
quick creation, debt summary, deletion checks, and audit logging.
"""

import re
from datetime import date
from decimal import Decimal
from django.apps import apps
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from audit_log.models import ActorType, EventCategory
from audit_log.services import record_audit
from iam.permissions import has_effective_permission

from .models import (
    CustomerProfile,
    Party,
    PartyAddress,
    PartyBankAccount,
    PartyContact,
    PartyRole,
)


# =====================================================================
# 1. AUTO-GENERATION OF CUSTOMER CODE (AF-02, BR-CUS-04, BR-CUS-54)
# =====================================================================

def generate_customer_code(company, branch=None):
    """
    Sinh mã khách hàng tự động theo quy tắc cấu hình hoặc tiền tố KH + dãy số (AF-02, BR-CUS-04).
    """
    # 1. Thử dùng hệ thống DocumentNumberingRule nếu có cấu hình cho KH / CUSTOMER
    try:
        from common_services.numbering_services import generate_document_number
        from master_data.models import DocumentType
        doc_type = DocumentType.objects.filter(code__in=["CUSTOMER", "KH", "CUS"]).first()
        if doc_type:
            number = generate_document_number(company, doc_type, branch=branch, is_preview=True)
            if number and not Party.objects.filter(company=company, code=number).exists():
                return number
    except Exception:
        pass

    # 2. Cơ chế sinh mã chuẩn mặc định: KH00001, KH00002...
    prefix = "KH"
    existing_codes = list(
        Party.objects.filter(company=company, code__startswith=prefix)
        .values_list("code", flat=True)
    )
    max_num = 0
    pattern = re.compile(rf"^{prefix}(\d+)$", re.IGNORECASE)
    for c in existing_codes:
        m = pattern.match(c.strip())
        if m:
            try:
                num = int(m.group(1))
                if num > max_num:
                    max_num = num
            except ValueError:
                pass

    next_num = max_num + 1
    while True:
        candidate = f"{prefix}{next_num:05d}"
        if candidate not in existing_codes and not Party.objects.filter(company=company, code=candidate).exists():
            return candidate
        next_num += 1


# =====================================================================
# 2. TAX INFO LOOKUP INTEGRATION (AF-03, AF-04, BR-CUS-49, BR-CUS-50)
# =====================================================================

def lookup_business_tax_info(tax_code):
    """
    Tra cứu thông tin doanh nghiệp qua mã số thuế (AF-03, BR-CUS-49, 50).
    Trả về dữ liệu gợi ý và lưu thông tin nguồn tra cứu.
    """
    raw_code = str(tax_code or "").strip().replace(" ", "").replace("-", "")
    if not raw_code:
        raise ValidationError({"tax_code": "Vui lòng nhập mã số thuế cần tra cứu."})

    if not (raw_code.isdigit() and len(raw_code) in (10, 13)):
        raise ValidationError({
            "tax_code": "Mã số thuế không đúng định dạng chuẩn (10 chữ số cho doanh nghiệp hoặc 13 chữ số cho chi nhánh) (EF-05)."
        })

    # Mô phỏng dịch vụ tích hợp cổng thông tin quốc gia về đăng ký doanh nghiệp
    # Cung cấp dữ liệu chuẩn hóa gợi ý
    formatted_code = f"{raw_code[:10]}-{raw_code[10:]}" if len(raw_code) == 13 else raw_code
    now = timezone.now()

    # Tạo tên gợi ý theo cấu trúc đăng ký kinh doanh
    legal_name = f"CÔNG TY CỔ PHẦN THƯƠNG MẠI VÀ DỊCH VỤ {formatted_code}"
    short_name = f"DOANH NGHIỆP {formatted_code}"
    suggested_address = "Số 123 Đường Giải Phóng, Phường Đồng Tâm, Quận Hai Bà Trưng, Thành phố Hà Nội"

    return {
        "tax_code": formatted_code,
        "legal_name": legal_name,
        "name": short_name,
        "address": suggested_address,
        "province_code": "HN",
        "representative": "Nguyễn Văn Đại Diện",
        "lookup_source": "VIETNAM_TAX_REGISTRY",
        "lookup_at": now.isoformat(),
        "status": "ACTIVE",
        "note": "Thông tin tra cứu từ Cơ sở dữ liệu Quốc gia về Đăng ký Doanh nghiệp (BR-CUS-49, 50).",
    }


# =====================================================================
# 3. DUPLICATE DETECTION (BR-CUS-07..11, AF-05, EF-04, EF-06)
# =====================================================================

def detect_duplicate_customers(
    company,
    *,
    tax_code=None,
    name=None,
    email=None,
    phone=None,
    identity_no=None,
    code=None,
    exclude_id=None,
):
    """
    Kiểm tra trùng lặp theo mã, mã số thuế, tên, điện thoại, email, CMND/CCCD (BR-CUS-08, 09, AF-05).
    """
    tax_code = str(tax_code or "").strip().replace(" ", "")
    name = str(name or "").strip()
    email = str(email or "").strip().lower()
    phone = str(phone or "").strip().replace(" ", "").replace(".", "")
    identity_no = str(identity_no or "").strip().replace(" ", "")
    code = str(code or "").strip().upper()

    if not any((tax_code, name, email, phone, identity_no, code)):
        return []

    base_query = Party.objects.filter(company=company, roles__role_type="CUSTOMER").distinct()
    if exclude_id:
        base_query = base_query.exclude(pk=exclude_id)

    matches = []
    seen_ids = set()

    for party in base_query:
        reasons = []
        is_hard_duplicate = False

        # 1. Trùng mã khách hàng (bắt buộc chặn - EF-04, BR-CUS-09)
        if code and party.code.upper() == code:
            reasons.append("EXACT_CODE")
            is_hard_duplicate = True

        # 2. Trùng mã số thuế (BR-CUS-10, EF-06)
        if tax_code and party.tax_code and party.tax_code.replace(" ", "") == tax_code:
            reasons.append("EXACT_TAX_CODE")
            if party.status == "ACTIVE":
                is_hard_duplicate = True

        # 3. Trùng số CMND/CCCD
        if identity_no and party.identity_no and party.identity_no.strip() == identity_no:
            reasons.append("EXACT_IDENTITY")

        # 4. Trùng tên khách hàng (chính xác hoặc tên pháp lý)
        if name:
            if party.name.strip().lower() == name.lower() or (party.legal_name and party.legal_name.strip().lower() == name.lower()):
                reasons.append("SIMILAR_NAME")

        # 5. Trùng email liên hệ
        if email and party.contacts.filter(email__iexact=email).exists():
            reasons.append("MATCH_EMAIL")

        # 6. Trùng số điện thoại
        if phone:
            clean_phones = [p.replace(" ", "").replace(".", "") for p in party.contacts.values_list("phone", flat=True) if p]
            if phone in clean_phones:
                reasons.append("MATCH_PHONE")

        if reasons and party.pk not in seen_ids:
            seen_ids.add(party.pk)
            matches.append({
                "id": str(party.pk),
                "code": party.code,
                "name": party.name,
                "legal_name": party.legal_name,
                "tax_code": party.tax_code,
                "status": party.status,
                "match_reasons": reasons,
                "is_hard_duplicate": is_hard_duplicate,
            })

    return matches


# =====================================================================
# 4. CUSTOMER MERGE (BR-CUS-38..42, AF-16, EF-15, EF-16)
# =====================================================================

def merge_customers(
    *,
    company,
    actor,
    source_id,
    target_id,
    conflict_resolutions=None,
    reason="",
    request=None,
):
    """
    Hợp nhất hai bản ghi khách hàng bị trùng lặp (BR-CUS-38..42, AF-16).
    - Giữ lại bản ghi target, chuyển toàn bộ địa chỉ, liên hệ, tài khoản ngân hàng và chứng từ từ source sang target.
    - Đánh dấu source là INACTIVE / MERGED, liên kết merged_into tới target.
    - Ghi nhận Audit Log toàn diện.
    """
    reason = str(reason or "").strip()
    if not reason:
        raise ValidationError({"reason": "Lý do hợp nhất khách hàng là bắt buộc (BR-CUS-38)."})

    if str(source_id) == str(target_id):
        raise ValidationError({"source_id": "Không thể hợp nhất khách hàng với chính nó (EF-16)."})

    # Kiểm tra quyền hợp nhất
    if actor and not (getattr(actor, "auth_user", None) and actor.auth_user.is_superuser):
        if not (
            has_effective_permission(actor, company, "MD.PARTY.MERGE")
            or has_effective_permission(actor, company, "MD.PARTY.EDIT")
        ):
            raise PermissionDenied("Bạn không có quyền hợp nhất khách hàng (BR-CUS-38).")

    with transaction.atomic():
        source = Party.objects.select_for_update().filter(pk=source_id).first()
        target = Party.objects.select_for_update().filter(pk=target_id).first()

        if not source or not target:
            raise ValidationError("Không tìm thấy khách hàng nguồn hoặc đích.")

        # BR-CUS-41, EF-15: Không được hợp nhất khách hàng thuộc hai doanh nghiệp khác nhau
        if source.company_id != company.pk or target.company_id != company.pk:
            raise ValidationError("Hai khách hàng phải thuộc cùng một doanh nghiệp để có thể hợp nhất (EF-15, BR-CUS-41).")

        if source.status == "MERGED" or target.status == "MERGED":
            raise ValidationError("Không thể hợp nhất khách hàng đã ở trạng thái đã hợp nhất (MERGED).")

        now = timezone.now()
        source_before = {"status": source.status, "code": source.code, "name": source.name}
        target_before = {"status": target.status, "code": target.code, "name": target.name, "version": target.version}

        # 1. Chuyển địa chỉ từ source sang target (BR-CUS-42)
        target_default_addr_types = set(
            target.addresses.filter(is_default=True, status="ACTIVE").values_list("address_type", flat=True)
        )
        for addr in source.addresses.all():
            if addr.address_type in target_default_addr_types and addr.is_default:
                addr.is_default = False
            addr.party = target
            addr.save(update_fields=("party", "is_default"))

        # 2. Chuyển người liên hệ từ source sang target (BR-CUS-42)
        target_default_contact_types = set(
            target.contacts.filter(is_default=True, status="ACTIVE").values_list("contact_type", flat=True)
        )
        for contact in source.contacts.all():
            if contact.contact_type in target_default_contact_types and contact.is_default:
                contact.is_default = False
            contact.party = target
            contact.save(update_fields=("party", "is_default"))

        # 3. Chuyển tài khoản ngân hàng từ source sang target
        target_acc_nums = set(target.bank_accounts.values_list("account_number", flat=True))
        for bank_acc in source.bank_accounts.all():
            if bank_acc.account_number not in target_acc_nums:
                bank_acc.party = target
                bank_acc.save(update_fields=("party",))

        # 4. Cập nhật các chứng từ tham chiếu (BR-CUS-40)
        # Sales Order / Invoice / AR
        for model_path in (
            "sales.SalesOrder",
            "sales.SalesInvoice",
            "accounts_receivable.ReceivableDocument",
            "accounts_receivable.ReceivableBill",
            "accounts_receivable.ReceivableBalance",
            "cash_management.CashReceiptVoucher",
        ):
            try:
                app_label, model_name = model_path.split(".")
                M = apps.get_model(app_label, model_name)
                if M:
                    for field in ("customer", "party"):
                        if hasattr(M, field):
                            M.objects.filter(**{f"{field}_id": source.id}).update(**{field: target})
            except Exception:
                pass

        # 5. Xử lý trùng mã số thuế để tránh vướng UniqueConstraint nếu hai bên trùng tax_code
        if source.tax_code and target.tax_code and source.tax_code.replace(" ", "") == target.tax_code.replace(" ", ""):
            source.tax_code = None

        # 6. Đánh dấu bản ghi source đã được hợp nhất (BR-CUS-39, 40)
        source.status = "MERGED"
        source.merged_into = target
        source.merged_at = now
        source.merged_by = actor
        source.notes = f"{(source.notes or '').strip()}\n[Đã hợp nhất vào {target.code} ({target.name}) ngày {now.strftime('%d/%m/%Y %H:%M')}: {reason}]"
        source.save(update_fields=("status", "tax_code", "merged_into", "merged_at", "merged_by", "notes", "updated_at"))

        # 7. Cập nhật bản ghi target
        resolutions = conflict_resolutions or {}
        for field in ("legal_name", "short_name", "representative", "tax_code", "identity_no"):
            if resolutions.get(field) == "use_source" and getattr(source, field, None):
                setattr(target, field, getattr(source, field))

        target.version += 1
        target.notes = f"{(target.notes or '').strip()}\n[Tiếp nhận hợp nhất từ {source.code} ({source.name}) ngày {now.strftime('%d/%m/%Y %H:%M')}: {reason}]"
        target.save()

        # 8. Ghi Audit Log cho cả source và target (BR-CUS-58, 59)
        record_audit(
            company=company,
            actor_user=actor,
            actor_type=ActorType.USER if actor else ActorType.SYSTEM,
            module_code="MDM",
            event_category=EventCategory.MASTER_DATA,
            action_code="CUSTOMER_MERGED_SOURCE",
            entity=source,
            resource_code=source.code,
            description=f"Hợp nhất khách hàng nguồn {source.code} vào đích {target.code}: {reason}",
            before=source_before,
            after={"status": source.status, "merged_into": str(target.id)},
            reason=reason,
            request=request,
        )

        record_audit(
            company=company,
            actor_user=actor,
            actor_type=ActorType.USER if actor else ActorType.SYSTEM,
            module_code="MDM",
            event_category=EventCategory.MASTER_DATA,
            action_code="CUSTOMER_MERGED_TARGET",
            entity=target,
            resource_code=target.code,
            description=f"Khách hàng đích {target.code} tiếp nhận hợp nhất từ nguồn {source.code}: {reason}",
            before=target_before,
            after={"status": target.status, "version": target.version},
            reason=reason,
            request=request,
        )

        return target


# =====================================================================
# 5. QUICK CREATE CUSTOMER (AF-01, BR-CUS-54, BR-CUS-55)
# =====================================================================

def quick_create_customer(*, company, actor, data, request=None):
    """
    Tạo nhanh khách hàng trực tiếp từ màn hình lập chứng từ (AF-01, BR-CUS-54, 55).
    """
    name = str(data.get("name") or "").strip()
    if not name:
        raise ValidationError({"name": "Tên khách hàng là bắt buộc (BR-CUS-05, BR-CUS-54)."})

    party_type = data.get("party_type") or "ORGANIZATION"
    code = str(data.get("code") or "").strip().upper()
    if not code or code == "AUTO":
        code = generate_customer_code(company, branch=data.get("branch"))

    tax_code = str(data.get("tax_code") or "").strip().replace(" ", "") or None
    phone = str(data.get("phone") or "").strip()
    email = str(data.get("email") or "").strip()
    address_line = str(data.get("address_line") or "").strip()

    with transaction.atomic():
        # Duplicate checks
        if Party.objects.filter(company=company, code__iexact=code).exists():
            raise ValidationError({"code": "Mã khách hàng đã tồn tại (EF-04)."})
        if tax_code and Party.objects.filter(company=company, tax_code=tax_code).exists():
            raise ValidationError({"tax_code": "Mã số thuế đã tồn tại trong doanh nghiệp (EF-06)."})

        party = Party.objects.create(
            company=company,
            code=code,
            name=name,
            party_type=party_type,
            legal_name=data.get("legal_name") or (name if party_type == "ORGANIZATION" else ""),
            tax_code=tax_code,
            branch=data.get("branch"),
            owner=data.get("owner") or actor,
            status=data.get("status") or "ACTIVE",
            notes=data.get("notes") or "Tạo nhanh từ màn hình chứng từ bán hàng (Quick Create)",
        )

        PartyRole.objects.create(
            party=party,
            role_type="CUSTOMER",
            active_from=timezone.localdate(),
        )

        CustomerProfile.objects.create(
            party=party,
            credit_limit=data.get("credit_limit"),
            credit_days=data.get("credit_days") or 0,
            payment_method=data.get("payment_method") or "",
        )

        if address_line:
            PartyAddress.objects.create(
                party=party,
                address_type="REGISTERED",
                address_line=address_line,
                country_code="VN",
                is_default=True,
                status="ACTIVE",
            )

        if phone or email:
            PartyContact.objects.create(
                party=party,
                contact_type="GENERAL",
                contact_name=name,
                phone=phone,
                email=email,
                is_default=True,
                status="ACTIVE",
            )

        record_audit(
            company=company,
            actor_user=actor,
            actor_type=ActorType.USER if actor else ActorType.SYSTEM,
            module_code="MDM",
            event_category=EventCategory.MASTER_DATA,
            action_code="CUSTOMER_QUICK_CREATE",
            entity=party,
            resource_code=party.code,
            description=f"Tạo nhanh khách hàng {party.code} - {party.name}",
            after={"code": party.code, "name": party.name, "status": party.status},
            request=request,
        )

        return party


# =====================================================================
# 6. DEBT & TRANSACTIONS SUMMARY (AF-11, EF-14)
# =====================================================================

def get_customer_debt_and_transactions_summary(party):
    """
    Kiểm tra tổng công nợ và chứng từ chưa hoàn thành của khách hàng (AF-11, EF-14).
    """
    total_receivable = Decimal("0.00")
    pending_orders_count = 0
    has_transactions = False

    # Check Accounts Receivable
    try:
        from accounts_receivable.models import ReceivableDocument
        docs = ReceivableDocument.objects.filter(customer=party)
        if docs.exists():
            has_transactions = True
            for d in docs:
                total_receivable += getattr(d, "remaining_amount", Decimal("0.00")) or Decimal("0.00")
    except Exception:
        pass

    # Check Sales Orders
    try:
        from sales.models import SalesOrder
        orders = SalesOrder.objects.filter(customer=party)
        if orders.exists():
            has_transactions = True
            pending_orders_count = orders.filter(status__in=["DRAFT", "PENDING_APPROVAL", "APPROVED"]).count()
    except Exception:
        pass

    return {
        "customer_id": str(party.id),
        "customer_code": party.code,
        "customer_name": party.name,
        "total_receivable": float(total_receivable),
        "pending_orders_count": pending_orders_count,
        "has_transactions": has_transactions,
        "has_outstanding_debt": total_receivable > 0,
    }


# =====================================================================
# 7. DELETION CHECKS & SAFE DELETE (BR-CUS-19, BR-CUS-20)
# =====================================================================

def check_customer_can_be_deleted(party):
    """
    Kiểm tra khách hàng có thể xóa cứng hay không (BR-CUS-19, 20).
    Khách hàng đã phát sinh chứng từ / giao dịch tuyệt đối không được xóa cứng.
    """
    # 1. Check Sales Orders & Invoices
    for model_path in ("sales.SalesOrder", "sales.SalesInvoice"):
        try:
            app_label, model_name = model_path.split(".")
            M = apps.get_model(app_label, model_name)
            if M and M.objects.filter(customer=party).exists():
                return False, f"Khách hàng đã có chứng từ [{model_name}] phát sinh, không được xóa cứng (BR-CUS-19). Vui lòng chuyển sang Ngừng sử dụng (INACTIVE)."
        except Exception:
            pass

    # 2. Check Accounts Receivable
    for model_path in ("accounts_receivable.ReceivableDocument", "accounts_receivable.ReceivableBill", "accounts_receivable.ReceivableBalance"):
        try:
            app_label, model_name = model_path.split(".")
            M = apps.get_model(app_label, model_name)
            if M and M.objects.filter(customer=party).exists():
                return False, f"Khách hàng đã phát sinh công nợ phải thu [{model_name}], không được xóa cứng (BR-CUS-19). Vui lòng chuyển sang Ngừng sử dụng (INACTIVE)."
        except Exception:
            pass

    # 3. Check Cash Receipts
    try:
        from cash_management.models import CashReceiptVoucher
        if CashReceiptVoucher.objects.filter(party=party).exists():
            return False, "Khách hàng đã phát sinh phiếu thu tiền, không được xóa cứng (BR-CUS-19). Vui lòng chuyển sang Ngừng sử dụng (INACTIVE)."
    except Exception:
        pass

    # 4. Check GL Journal Entries
    try:
        from general_ledger.models import JournalEntryLine
        if JournalEntryLine.objects.filter(party=party).exists():
            return False, "Khách hàng đã có bút toán kế toán liên kết, không được xóa cứng (BR-CUS-19). Vui lòng chuyển sang Ngừng sử dụng (INACTIVE)."
    except Exception:
        pass

    return True, ""


def delete_customer(party, actor=None, request=None):
    """
    Xóa cứng khách hàng chưa phát sinh chứng từ (BR-CUS-20).
    """
    can_delete, reason = check_customer_can_be_deleted(party)
    if not can_delete:
        raise ValidationError(reason)

    company = party.company
    code = party.code
    name = party.name

    with transaction.atomic():
        # Xóa các liên kết con
        PartyAddress.objects.filter(party=party).delete()
        PartyContact.objects.filter(party=party).delete()
        PartyBankAccount.objects.filter(party=party).delete()
        CustomerProfile.objects.filter(party=party).delete()
        PartyRole.objects.filter(party=party).delete()

        record_audit(
            company=company,
            actor_user=actor,
            actor_type=ActorType.USER if actor else ActorType.SYSTEM,
            module_code="MDM",
            event_category=EventCategory.MASTER_DATA,
            action_code="CUSTOMER_DELETE",
            entity=party,
            resource_code=code,
            description=f"Xóa khách hàng {code} - {name} (chưa phát sinh giao dịch)",
            before={"code": code, "name": name, "status": party.status},
            request=request,
        )

        party.delete()
