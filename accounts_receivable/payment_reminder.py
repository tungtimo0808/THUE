import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from rest_framework.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from general_ledger.models import Account
from master_data.models import CompanyBankAccount, Currency, Party
from organization.models import Branch, Company, Employee
from iam.models import UserAccount

from .models import (
    CustomerPaymentReminder,
    CustomerPaymentReminderLine,
    CustomerPaymentReminderSendLog,
    Receivable,
    ReceivableSchedule,
    ReceivableStatus,
    ReminderPaymentMethod,
    ReminderSendChannel,
    ReminderStatus,
)


def generate_reminder_number(company: Company, notice_date: Optional[date] = None) -> str:
    """
    Sinh số thông báo theo định dạng: AR-REM-YYYY-00001 (tự tăng theo doanh nghiệp và năm).
    """
    target_year = (notice_date or timezone.localdate()).year
    prefix = f"AR-REM-{target_year}-"
    existing = (
        CustomerPaymentReminder.objects.filter(company=company, notice_number__startswith=prefix)
        .values_list("notice_number", flat=True)
    )
    max_seq = 0
    for num in existing:
        parts = num.split("-")
        if len(parts) >= 4:
            try:
                seq = int(parts[-1])
                if seq > max_seq:
                    max_seq = seq
            except ValueError:
                pass
    return f"{prefix}{max_seq + 1:05d}"


def resolve_invoice_info(receivable: Receivable) -> Dict[str, Any]:
    """
    Hiển thị số, ký hiệu và ngày hóa đơn nếu khoản phải thu có liên kết hóa đơn;
    không suy đoán theo số chứng từ (BR03 / Spec).
    """
    try:
        from tax_management.models import TaxInvoice
        if receivable.document_id and receivable.document:
            doc = receivable.document
            if doc.invoice_request_id and doc.invoice_request:
                inv = TaxInvoice.objects.filter(
                    company=receivable.company,
                    source_reference=doc.invoice_request.number,
                ).first()
                if inv:
                    return {
                        "invoice_series": inv.invoice_series or "",
                        "invoice_number": inv.invoice_number or "",
                        "invoice_date": inv.invoice_date,
                    }
            if doc.document_type == "SALES_INVOICE":
                inv = TaxInvoice.objects.filter(
                    company=receivable.company,
                    source_reference=doc.number,
                ).first()
                if inv:
                    return {
                        "invoice_series": inv.invoice_series or "",
                        "invoice_number": inv.invoice_number or "",
                        "invoice_date": inv.invoice_date,
                    }

        if receivable.source_document_type in ("TAX_INVOICE", "INVOICE") and receivable.source_document_id:
            try:
                inv = TaxInvoice.objects.filter(
                    company=receivable.company,
                    pk=receivable.source_document_id,
                ).first()
                if inv:
                    return {
                        "invoice_series": inv.invoice_series or "",
                        "invoice_number": inv.invoice_number or "",
                        "invoice_date": inv.invoice_date,
                    }
            except Exception:
                pass
    except Exception:
        pass

    return {
        "invoice_series": "",
        "invoice_number": "",
        "invoice_date": None,
    }


def get_default_customer_info(customer: Party) -> Dict[str, str]:
    """
    Lấy thông tin người liên hệ, email, địa chỉ mặc định từ danh mục khách hàng.
    """
    contact = (
        customer.contacts.filter(status="ACTIVE")
        .order_by("-is_default")
        .first()
    )
    address = (
        customer.addresses.filter(status="ACTIVE")
        .order_by("-is_default")
        .first()
    )
    return {
        "recipient_name": contact.contact_name if contact else "",
        "recipient_email": contact.email if contact else "",
        "customer_address": address.address_line if address else (getattr(customer, "address", "") or ""),
    }


def extract_eligible_receivables(
    company: Company,
    customer: Party,
    currency: Currency,
    receivable_account: Account,
    branch: Optional[Branch] = None,
) -> List[Dict[str, Any]]:
    """
    Lấy các khoản phải thu đủ điều kiện để lập thông báo đề nghị thanh toán:
    - Đã ghi sổ, còn dư (balance > 0), không bị đảo (reversed_at is null).
    - Cùng khách hàng, cùng loại tiền, cùng tài khoản phải thu (BR02, BR03).
    - Kiểm tra xem khoản nợ đã từng xuất hiện trong thông báo ĐÃ GỬI (chưa hủy) hay chưa (BR09).
    """
    today = timezone.localdate()

    query = Q(
        company=company,
        customer=customer,
        currency=currency,
        account=receivable_account,
        status__in=[ReceivableStatus.OPEN, ReceivableStatus.PARTIALLY_PAID],
        balance__gt=0,
        reversed_at__isnull=True,
    )
    if branch:
        query &= Q(branch=branch) | Q(branch__isnull=True)

    receivables = (
        Receivable.objects.filter(query)
        .select_related("document", "payment_term", "sales_order", "sales_contract")
        .prefetch_related("schedules")
        .order_by("due_date", "posting_date", "code")
    )

    items = []
    for rec in receivables:
        invoice_info = resolve_invoice_info(rec)

        # Check BR09: Prior sent reminder
        prior_line = (
            CustomerPaymentReminderLine.objects.filter(
                notice__company=company,
                notice__status=ReminderStatus.SENT,
                receivable=rec,
            )
            .select_related("notice")
            .order_by("-notice__last_sent_at", "-notice__notice_date")
            .first()
        )
        prior_sent_info = None
        if prior_line and prior_line.notice:
            sent_date_val = (
                prior_line.notice.last_sent_at.date()
                if prior_line.notice.last_sent_at
                else prior_line.notice.notice_date
            )
            prior_sent_info = {
                "notice_number": prior_line.notice.notice_number,
                "sent_date": sent_date_val.isoformat() if sent_date_val else None,
            }

        schedules = [s for s in rec.schedules.all() if s.balance > 0]
        if schedules:
            schedules.sort(key=lambda s: s.installment_no)
            for sch in schedules:
                orig_due = sch.due_date
                days_overdue = max(0, (today - orig_due).days) if orig_due else None
                items.append({
                    "receivable_id": str(rec.id),
                    "receivable_code": rec.code,
                    "receivable_schedule_id": str(sch.id),
                    "installment_no": sch.installment_no,
                    "source_document_number": rec.source_document_number or rec.code,
                    "source_document_date": rec.posting_date or rec.document_date,
                    "invoice_series": invoice_info["invoice_series"],
                    "invoice_number": invoice_info["invoice_number"],
                    "invoice_date": invoice_info["invoice_date"],
                    "original_due_date": orig_due,
                    "remaining_balance": sch.balance,
                    "suggested_amount": sch.balance,
                    "days_overdue": days_overdue,
                    "prior_sent_reminder": prior_sent_info,
                })
        else:
            orig_due = rec.due_date
            days_overdue = max(0, (today - orig_due).days) if orig_due else None
            items.append({
                "receivable_id": str(rec.id),
                "receivable_code": rec.code,
                "receivable_schedule_id": None,
                "installment_no": 1,
                "source_document_number": rec.source_document_number or rec.code,
                "source_document_date": rec.posting_date or rec.document_date,
                "invoice_series": invoice_info["invoice_series"],
                "invoice_number": invoice_info["invoice_number"],
                "invoice_date": invoice_info["invoice_date"],
                "original_due_date": orig_due,
                "remaining_balance": rec.balance,
                "suggested_amount": rec.balance,
                "days_overdue": days_overdue,
                "prior_sent_reminder": prior_sent_info,
            })

    return items


def validate_reminder_data(company: Company, data: Dict[str, Any], instance: Optional[CustomerPaymentReminder] = None) -> Dict[str, Any]:
    """
    Xác thực toàn diện thông báo đề nghị thanh toán theo BR01-BR14, EF01-EF09.
    """
    errors: Dict[str, Any] = {}

    # EF08: Không cho sửa thông báo đã gửi
    if instance and instance.status != ReminderStatus.DRAFT:
        raise ValidationError("Không thể sửa thông báo đã gửi hoặc đã hủy. Vui lòng lập thông báo mới.")

    # EF09: Optimistic concurrency lock
    if instance and "version" in data and data["version"] is not None:
        try:
            req_version = int(data["version"])
            if req_version != instance.version:
                raise ValidationError("Thông báo đã được người khác cập nhật. Vui lòng tải lại trước khi tiếp tục.")
        except (ValueError, TypeError):
            pass

    # Ngày lập
    notice_date_val = data.get("notice_date")
    if isinstance(notice_date_val, str):
        try:
            notice_date = date.fromisoformat(notice_date_val)
        except ValueError:
            errors["notice_date"] = "Định dạng ngày lập không hợp lệ (YYYY-MM-DD)."
            notice_date = timezone.localdate()
    elif isinstance(notice_date_val, date):
        notice_date = notice_date_val
    else:
        notice_date = timezone.localdate()

    # Hạn thanh toán đề nghị
    requested_due_date_val = data.get("requested_due_date")
    if not requested_due_date_val:
        errors["requested_due_date"] = "Hạn thanh toán đề nghị là bắt buộc."
        requested_due_date = None
    elif isinstance(requested_due_date_val, str):
        try:
            requested_due_date = date.fromisoformat(requested_due_date_val)
        except ValueError:
            errors["requested_due_date"] = "Định dạng hạn đề nghị không hợp lệ (YYYY-MM-DD)."
            requested_due_date = None
    elif isinstance(requested_due_date_val, date):
        requested_due_date = requested_due_date_val
    else:
        errors["requested_due_date"] = "Hạn thanh toán đề nghị không hợp lệ."
        requested_due_date = None

    # EF06: Hạn đề nghị không trước ngày lập
    if requested_due_date and requested_due_date < notice_date:
        errors["requested_due_date"] = "Hạn thanh toán đề nghị không được trước ngày lập thông báo."

    # Khách hàng
    customer_id = data.get("customer") or data.get("customer_id")
    if not customer_id:
        errors["customer"] = "Khách hàng là bắt buộc."
        customer = None
    else:
        customer = Party.objects.filter(pk=customer_id, company=company).first()
        if not customer:
            errors["customer"] = "Khách hàng không tồn tại hoặc không thuộc doanh nghiệp."

    # Loại tiền
    currency_id = data.get("currency") or data.get("currency_id")
    if not currency_id:
        errors["currency"] = "Loại tiền là bắt buộc."
        currency = None
    else:
        currency = Currency.objects.filter(pk=currency_id).first()
        if not currency:
            errors["currency"] = "Loại tiền không hợp lệ."

    # Tài khoản phải thu
    receivable_account_id = data.get("receivable_account") or data.get("receivable_account_id")
    if not receivable_account_id:
        errors["receivable_account"] = "Tài khoản phải thu là bắt buộc."
        receivable_account = None
    else:
        receivable_account = Account.objects.filter(pk=receivable_account_id, company=company).first()
        if not receivable_account:
            errors["receivable_account"] = "Tài khoản phải thu không hợp lệ hoặc không thuộc doanh nghiệp."

    # Người nhận
    recipient_name = data.get("recipient_name")
    if not recipient_name or not str(recipient_name).strip():
        errors["recipient_name"] = "Người nhận là bắt buộc."

    # Phương thức nhận thanh toán
    payment_method = data.get("payment_method", ReminderPaymentMethod.BANK_TRANSFER)
    if payment_method not in dict(ReminderPaymentMethod.choices):
        errors["payment_method"] = "Phương thức nhận thanh toán không hợp lệ."

    company_bank_account = None
    if payment_method == ReminderPaymentMethod.BANK_TRANSFER:
        bank_acc_id = data.get("company_bank_account") or data.get("company_bank_account_id")
        if not bank_acc_id:
            errors["company_bank_account"] = "Tài khoản ngân hàng nhận tiền là bắt buộc khi chọn chuyển khoản."
        else:
            company_bank_account = CompanyBankAccount.objects.filter(pk=bank_acc_id, company=company).select_related("bank", "currency").first()
            if not company_bank_account:
                errors["company_bank_account"] = "Tài khoản ngân hàng không tồn tại hoặc không thuộc doanh nghiệp."
            else:
                # EF07: Tài khoản ngân hàng phải ACTIVE và cùng loại tiền
                if company_bank_account.status != "ACTIVE":
                    errors["company_bank_account"] = "Tài khoản ngân hàng nhận tiền đang không hoạt động."
                if currency and company_bank_account.currency_id != currency.id:
                    errors["company_bank_account"] = "Tài khoản ngân hàng không cùng loại tiền với thông báo."

    elif payment_method == ReminderPaymentMethod.CASH:
        cash_loc = data.get("cash_location", "")
        if not cash_loc or not str(cash_loc).strip():
            errors["cash_location"] = "Địa điểm nhận tiền mặt là bắt buộc khi chọn phương thức tiền mặt."

    # Người ký (EF07 / Spec: Không mặc định người tạo là người ký)
    signer_employee = None
    signer_user = None
    signer_employee_id = data.get("signer_employee") or data.get("signer_employee_id")
    signer_user_id = data.get("signer_user") or data.get("signer_user_id")
    signer_name = data.get("signer_name", "").strip()
    signer_title = data.get("signer_title", "").strip()

    if signer_employee_id:
        signer_employee = Employee.objects.filter(pk=signer_employee_id, company=company).select_related("position").first()
        if not signer_employee:
            errors["signer_employee"] = "Nhân viên ký thông báo không tồn tại hoặc không thuộc doanh nghiệp."
        else:
            # EF07: Kiểm tra người ký đủ điều kiện (status ACTIVE)
            if signer_employee.status != "ACTIVE":
                errors["signer_employee"] = "Nhân viên ký thông báo không còn đủ điều kiện ký (không hoạt động)."
            signer_name = signer_employee.full_name
            if not signer_title:
                signer_title = signer_employee.position.name if signer_employee.position else ""
    elif signer_user_id:
        signer_user = UserAccount.objects.filter(pk=signer_user_id).first()
        if not signer_user:
            errors["signer_user"] = "Người ký không hợp lệ."
        else:
            if not signer_name:
                signer_name = getattr(signer_user, "full_name", "") or signer_user.username
    elif not signer_name:
        errors["signer"] = "Vui lòng chọn hoặc nhập người ký thông báo (không mặc định người tạo)."

    # Chi tiết dòng công nợ (EF02, EF03, EF04, EF05, BR02, BR03, BR04, BR05)
    lines_data = data.get("lines")
    if not lines_data or not isinstance(lines_data, list):
        errors["lines"] = "Thông báo đề nghị thanh toán phải có ít nhất một khoản công nợ."
    else:
        seen_keys = set()
        validated_lines = []
        for idx, l in enumerate(lines_data, start=1):
            line_rec_id = l.get("receivable") or l.get("receivable_id")
            line_sch_id = l.get("receivable_schedule") or l.get("receivable_schedule_id")

            if not line_rec_id:
                errors[f"line_{idx}_receivable"] = f"Dòng {idx}: Chưa chọn khoản phải thu."
                continue

            # BR04: Không chọn trùng cùng khoản phải thu và đợt thanh toán
            dup_key = (str(line_rec_id), str(line_sch_id or ""))
            if dup_key in seen_keys:
                errors[f"line_{idx}_duplicate"] = f"Dòng {idx}: Không được chọn trùng cùng một khoản phải thu và đợt thanh toán trong thông báo."
            seen_keys.add(dup_key)

            rec = (
                Receivable.objects.filter(pk=line_rec_id)
                .select_related("document", "account", "customer", "currency")
                .first()
            )
            if not rec:
                errors[f"line_{idx}_receivable"] = f"Dòng {idx}: Khoản phải thu không tồn tại."
                continue

            # EF04 & BR02: Cùng doanh nghiệp, khách hàng, loại tiền, tài khoản
            if rec.company_id != company.id:
                errors[f"line_{idx}_company"] = f"Dòng {idx}: Khoản phải thu không thuộc doanh nghiệp."
            if customer and rec.customer_id != customer.id:
                errors[f"line_{idx}_customer"] = f"Dòng {idx}: Khoản phải thu không cùng khách hàng đã chọn."
            if currency and rec.currency_id != currency.id:
                errors[f"line_{idx}_currency"] = f"Dòng {idx}: Khoản phải thu không cùng loại tiền với thông báo."
            if receivable_account and rec.account_id != receivable_account.id:
                errors[f"line_{idx}_account"] = f"Dòng {idx}: Khoản phải thu không cùng tài khoản phải thu với thông báo."

            # EF05 & BR03: Đã ghi sổ, còn dư, đang có hiệu lực
            if rec.reversed_at or rec.status == ReceivableStatus.REVERSED:
                errors[f"line_{idx}_status"] = f"Dòng {idx}: Khoản phải thu {rec.code} đã bị đảo/hủy."
            if rec.balance <= 0 or rec.status == ReceivableStatus.PAID:
                errors[f"line_{idx}_balance"] = f"Dòng {idx}: Khoản phải thu {rec.code} đã thanh toán hết số dư."

            sch = None
            max_allowed = rec.balance
            orig_due = rec.due_date
            installment_no = 1

            if line_sch_id:
                sch = ReceivableSchedule.objects.filter(pk=line_sch_id, receivable=rec).first()
                if not sch:
                    errors[f"line_{idx}_schedule"] = f"Dòng {idx}: Đợt thanh toán không thuộc khoản phải thu {rec.code}."
                else:
                    if sch.balance <= 0:
                        errors[f"line_{idx}_schedule_balance"] = f"Dòng {idx}: Đợt thanh toán {sch.installment_no} đã thanh toán hết số dư."
                    max_allowed = sch.balance
                    orig_due = sch.due_date
                    installment_no = sch.installment_no

            # EF03 & BR05: Số tiền đề nghị > 0 và <= remaining_balance
            raw_req = l.get("requested_amount")
            if raw_req is None:
                errors[f"line_{idx}_amount"] = f"Dòng {idx}: Chưa nhập số tiền đề nghị."
            else:
                try:
                    req_amount = Decimal(str(raw_req))
                    if req_amount <= 0:
                        errors[f"line_{idx}_amount"] = f"Dòng {idx}: Số tiền đề nghị phải lớn hơn 0."
                    elif req_amount > max_allowed:
                        errors[f"line_{idx}_amount"] = (
                            f"Dòng {idx}: Số tiền đề nghị ({req_amount}) vượt quá số dư còn lại ({max_allowed}). "
                            f"Số tiền tối đa được đề nghị là {max_allowed}."
                        )
                except Exception:
                    errors[f"line_{idx}_amount"] = f"Dòng {idx}: Số tiền đề nghị không hợp lệ."

    if errors:
        raise ValidationError(errors)

    return {
        "notice_date": notice_date,
        "requested_due_date": requested_due_date,
        "customer": customer,
        "currency": currency,
        "receivable_account": receivable_account,
        "recipient_name": str(recipient_name).strip(),
        "recipient_email": str(data.get("recipient_email", "")).strip(),
        "customer_address": str(data.get("customer_address", "")).strip(),
        "title": str(data.get("title", "Thông báo đề nghị thanh toán công nợ")).strip(),
        "content": str(data.get("content", "")).strip(),
        "payment_method": payment_method,
        "company_bank_account": company_bank_account,
        "cash_location": str(data.get("cash_location", "")).strip(),
        "transfer_note": str(data.get("transfer_note", "")).strip(),
        "signer_employee": signer_employee,
        "signer_user": signer_user,
        "signer_name": signer_name,
        "signer_title": signer_title,
        "attachments": data.get("attachments", []),
        "lines": lines_data,
    }


@transaction.atomic
def save_payment_reminder(
    data: Dict[str, Any],
    instance: Optional[CustomerPaymentReminder] = None,
    user: Optional[UserAccount] = None,
) -> CustomerPaymentReminder:
    """
    Lưu thông báo đề nghị thanh toán (Thêm mới hoặc Cập nhật) ở trạng thái Nháp.
    Không giữ chỗ số dư, không phát sinh bút toán và không giảm công nợ (BR06).
    """
    company_id = data.get("company") or data.get("company_id")
    if instance:
        company = instance.company
    else:
        if not company_id:
            raise ValidationError({"company": "Doanh nghiệp là bắt buộc."})
        company = Company.objects.get(pk=company_id)

    validated = validate_reminder_data(company, data, instance)

    notice_date = validated["notice_date"]
    requested_due_date = validated["requested_due_date"]
    customer = validated["customer"]
    currency = validated["currency"]
    receivable_account = validated["receivable_account"]
    payment_method = validated["payment_method"]
    company_bank_account = validated["company_bank_account"]

    # Bank info snapshot
    bank_info_snapshot = {}
    if company_bank_account:
        bank_info_snapshot = {
            "bank_name": (
                company_bank_account.bank.name
                or company_bank_account.bank.code
            ) if company_bank_account.bank else "",
            "account_number": company_bank_account.account_number,
            "account_name": company_bank_account.account_name,
            "bank_branch": company_bank_account.bank_branch or "",
        }

    branch_id = data.get("branch") or data.get("branch_id")
    branch = Branch.objects.filter(pk=branch_id, company=company).first() if branch_id else None

    # Tự sinh số thông báo nếu thêm mới
    if instance:
        reminder = instance
        reminder.version += 1
    else:
        notice_num = data.get("notice_number")
        if not notice_num or not str(notice_num).strip():
            notice_num = generate_reminder_number(company, notice_date)
        from iam.models import UserAccount
        if isinstance(user, UserAccount):
            creator = user
        elif hasattr(user, "iam_account"):
            creator = user.iam_account
        else:
            creator = UserAccount.objects.first()
        reminder = CustomerPaymentReminder(
            id=uuid.uuid4(),
            company=company,
            notice_number=notice_num,
            created_by=creator,
            status=ReminderStatus.DRAFT,
        )

    # Defaults for text content
    content_text = validated["content"]
    if not content_text:
        content_text = f"Kính đề nghị Quý khách hàng thanh toán các khoản công nợ được liệt kê dưới đây trước hạn {requested_due_date.strftime('%d/%m/%Y')}."

    transfer_note_text = validated["transfer_note"]
    if not transfer_note_text:
        transfer_note_text = f"[{customer.code}] thanh toán theo [{reminder.notice_number}]"

    reminder.branch = branch
    reminder.notice_date = notice_date
    reminder.customer = customer
    reminder.recipient_name = validated["recipient_name"]
    reminder.recipient_email = validated["recipient_email"]
    reminder.customer_address = validated["customer_address"]
    reminder.currency = currency
    reminder.receivable_account = receivable_account
    reminder.requested_due_date = requested_due_date
    reminder.title = validated["title"]
    reminder.content = content_text
    reminder.payment_method = payment_method
    reminder.company_bank_account = company_bank_account
    reminder.bank_info_snapshot = bank_info_snapshot
    reminder.cash_location = validated["cash_location"]
    reminder.transfer_note = transfer_note_text
    reminder.signer_employee = validated["signer_employee"]
    reminder.signer_user = validated["signer_user"]
    reminder.signer_name = validated["signer_name"]
    reminder.signer_title = validated["signer_title"]
    reminder.attachments = validated["attachments"]
    reminder.data_extracted_at = timezone.now()

    reminder.save()

    # Recreate lines
    if instance:
        reminder.lines.all().delete()

    total_amount = Decimal("0")
    for idx, l in enumerate(validated["lines"], start=1):
        line_rec_id = l.get("receivable") or l.get("receivable_id")
        line_sch_id = l.get("receivable_schedule") or l.get("receivable_schedule_id")

        rec = Receivable.objects.get(pk=line_rec_id)
        sch = ReceivableSchedule.objects.get(pk=line_sch_id) if line_sch_id else None

        orig_due = sch.due_date if sch else rec.due_date
        installment_no = sch.installment_no if sch else 1
        rem_balance = sch.balance if sch else rec.balance
        req_amount = Decimal(str(l["requested_amount"]))
        total_amount += req_amount

        # Calculate days overdue: notice_date - original_due_date if > 0 else 0 (or None if no due date)
        if orig_due:
            overdue_diff = (notice_date - orig_due).days
            days_overdue = max(0, overdue_diff)
        else:
            days_overdue = None

        invoice_info = resolve_invoice_info(rec)
        inv_series = l.get("invoice_series") or invoice_info["invoice_series"]
        inv_number = l.get("invoice_number") or invoice_info["invoice_number"]
        inv_date = l.get("invoice_date") or invoice_info["invoice_date"]

        CustomerPaymentReminderLine.objects.create(
            id=uuid.uuid4(),
            notice=reminder,
            line_no=idx,
            receivable=rec,
            receivable_schedule=sch,
            installment_no=installment_no,
            source_document_number=l.get("source_document_number") or rec.source_document_number or rec.code,
            source_document_date=l.get("source_document_date") or rec.posting_date or rec.document_date,
            invoice_series=inv_series,
            invoice_number=inv_number,
            invoice_date=inv_date,
            original_due_date=orig_due,
            remaining_balance=rem_balance,
            requested_amount=req_amount,
            days_overdue=days_overdue,
            line_note=l.get("line_note", "") or "",
        )

    reminder.total_requested_amount = total_amount
    reminder.save(update_fields=["total_requested_amount"])

    return reminder


def refresh_reminder_balances(reminder: CustomerPaymentReminder, user: Optional[UserAccount] = None) -> Dict[str, Any]:
    """
    AF05: Cập nhật số dư công nợ cho thông báo khi còn ở trạng thái Nháp.
    Chỉ rõ dòng đã hết dư hoặc có số tiền đề nghị vượt số dư để người dùng chỉnh sửa.
    """
    if reminder.status != ReminderStatus.DRAFT:
        raise ValidationError("Chỉ có thể cập nhật số dư cho thông báo ở trạng thái Nháp.")

    discrepancies = []
    lines = reminder.lines.select_related("receivable", "receivable_schedule").order_by("line_no")

    for line in lines:
        if line.receivable_schedule:
            sch = ReceivableSchedule.objects.get(pk=line.receivable_schedule_id)
            current_balance = sch.balance
            is_invalid = sch.receivable.reversed_at or sch.receivable.status == ReceivableStatus.REVERSED
        else:
            rec = Receivable.objects.get(pk=line.receivable_id)
            current_balance = rec.balance
            is_invalid = rec.reversed_at or rec.status == ReceivableStatus.REVERSED

        line.remaining_balance = current_balance
        line.save(update_fields=["remaining_balance"])

        if is_invalid or current_balance <= 0:
            discrepancies.append({
                "line_no": line.line_no,
                "source_document_number": line.source_document_number,
                "status": "ZERO_OR_INVALID",
                "message": f"Dòng {line.line_no}: Khoản nợ [{line.source_document_number}] đã hết dư hoặc không còn hiệu lực.",
                "current_balance": str(current_balance),
                "requested_amount": str(line.requested_amount),
            })
        elif current_balance < line.requested_amount:
            discrepancies.append({
                "line_no": line.line_no,
                "source_document_number": line.source_document_number,
                "status": "EXCEEDS_BALANCE",
                "message": f"Dòng {line.line_no}: Số tiền đề nghị ({line.requested_amount}) vượt quá số dư hiện tại ({current_balance}).",
                "current_balance": str(current_balance),
                "requested_amount": str(line.requested_amount),
            })

    reminder.data_extracted_at = timezone.now()
    reminder.save(update_fields=["data_extracted_at"])

    return {
        "reminder": reminder,
        "discrepancies": discrepancies,
    }


@transaction.atomic
def record_notice_sent(
    reminder: CustomerPaymentReminder,
    data: Dict[str, Any],
    user: Optional[UserAccount] = None,
) -> CustomerPaymentReminder:
    """
    Step 8 & AF06: Ghi nhận đã gửi thông báo cho khách hàng qua kênh bên ngoài.
    Lưu lịch sử gửi, khóa nội dung và chuyển sang Đã gửi (nếu đang là Nháp).
    """
    if reminder.status == ReminderStatus.CANCELLED:
        raise ValidationError("Không thể ghi nhận gửi cho thông báo đã bị hủy.")

    sent_date_val = data.get("sent_date")
    if not sent_date_val:
        raise ValidationError({"sent_date": "Ngày gửi là bắt buộc."})

    if isinstance(sent_date_val, str):
        try:
            sent_date = date.fromisoformat(sent_date_val)
        except ValueError:
            raise ValidationError({"sent_date": "Định dạng ngày gửi không hợp lệ (YYYY-MM-DD)."})
    elif isinstance(sent_date_val, date):
        sent_date = sent_date_val
    else:
        raise ValidationError({"sent_date": "Ngày gửi không hợp lệ."})

    today = timezone.localdate()
    # EF06: Không trước ngày lập và không sau ngày hiện tại
    if sent_date < reminder.notice_date:
        raise ValidationError({"sent_date": "Ngày gửi không được trước ngày lập thông báo."})
    if sent_date > today:
        raise ValidationError({"sent_date": "Ngày gửi không được sau ngày hiện tại."})

    sent_channel = data.get("sent_channel")
    if not sent_channel or sent_channel not in dict(ReminderSendChannel.choices):
        raise ValidationError({"sent_channel": "Kênh gửi không hợp lệ (EMAIL, PAPER, OTHER)."})

    channel_other_name = data.get("channel_other_name", "").strip()
    if sent_channel == ReminderSendChannel.OTHER and not channel_other_name:
        raise ValidationError({"channel_other_name": "Vui lòng nhập tên kênh gửi khác khi chọn kênh Khác."})

    actual_recipient = data.get("actual_recipient", "").strip()
    if not actual_recipient:
        actual_recipient = reminder.recipient_name

    proof_documents = data.get("proof_documents", [])
    if not isinstance(proof_documents, list):
        proof_documents = []

    note = data.get("note", "").strip()

    # Lưu log gửi
    CustomerPaymentReminderSendLog.objects.create(
        id=uuid.uuid4(),
        notice=reminder,
        sent_date=sent_date,
        sent_channel=sent_channel,
        channel_other_name=channel_other_name,
        actual_recipient=actual_recipient,
        proof_documents=proof_documents,
        note=note,
        sent_by=user,
    )

    # Chuyển trạng thái sang SENT, cập nhật lần gửi cuối
    reminder.status = ReminderStatus.SENT
    reminder.last_sent_at = timezone.now()
    reminder.last_sent_channel = sent_channel
    reminder.send_count += 1
    reminder.save(update_fields=["status", "last_sent_at", "last_sent_channel", "send_count", "updated_at"])

    return reminder


@transaction.atomic
def re_notice(reminder: CustomerPaymentReminder, user: Optional[UserAccount] = None) -> CustomerPaymentReminder:
    """
    AF07: Thay đổi thông báo đã gửi bằng cách lập thông báo mới.
    Sao chép nội dung, lấy số dư mới và liên kết với thông báo trước đó.
    """
    if reminder.status != ReminderStatus.SENT:
        raise ValidationError("Chỉ có thể lập thông báo mới từ thông báo đã gửi.")

    today = timezone.localdate()
    new_due_date = max(today, reminder.requested_due_date)
    new_number = generate_reminder_number(reminder.company, today)

    new_reminder = CustomerPaymentReminder.objects.create(
        id=uuid.uuid4(),
        company=reminder.company,
        branch=reminder.branch,
        notice_number=new_number,
        notice_date=today,
        customer=reminder.customer,
        recipient_name=reminder.recipient_name,
        recipient_email=reminder.recipient_email,
        customer_address=reminder.customer_address,
        currency=reminder.currency,
        receivable_account=reminder.receivable_account,
        requested_due_date=new_due_date,
        title=reminder.title,
        content=reminder.content,
        payment_method=reminder.payment_method,
        company_bank_account=reminder.company_bank_account,
        bank_info_snapshot=reminder.bank_info_snapshot,
        cash_location=reminder.cash_location,
        transfer_note=f"[{reminder.customer.code}] thanh toán theo [{new_number}]",
        total_requested_amount=Decimal("0"),
        signer_employee=reminder.signer_employee,
        signer_user=reminder.signer_user,
        signer_name=reminder.signer_name,
        signer_title=reminder.signer_title,
        attachments=reminder.attachments,
        data_extracted_at=timezone.now(),
        status=ReminderStatus.DRAFT,
        previous_notice=reminder,
        created_by=user,
    )

    total_amount = Decimal("0")
    valid_lines_count = 0

    for idx, line in enumerate(reminder.lines.all(), start=1):
        if line.receivable_schedule:
            sch = ReceivableSchedule.objects.get(pk=line.receivable_schedule_id)
            current_balance = sch.balance
            is_valid = not sch.receivable.reversed_at and sch.receivable.status != ReceivableStatus.REVERSED and current_balance > 0
        else:
            rec = Receivable.objects.get(pk=line.receivable_id)
            current_balance = rec.balance
            is_valid = not rec.reversed_at and rec.status != ReceivableStatus.REVERSED and current_balance > 0

        if is_valid:
            valid_lines_count += 1
            req_amount = min(line.requested_amount, current_balance)
            total_amount += req_amount

            orig_due = line.original_due_date
            days_overdue = max(0, (today - orig_due).days) if orig_due else None

            CustomerPaymentReminderLine.objects.create(
                id=uuid.uuid4(),
                notice=new_reminder,
                line_no=valid_lines_count,
                receivable=line.receivable,
                receivable_schedule=line.receivable_schedule,
                installment_no=line.installment_no,
                source_document_number=line.source_document_number,
                source_document_date=line.source_document_date,
                invoice_series=line.invoice_series,
                invoice_number=line.invoice_number,
                invoice_date=line.invoice_date,
                original_due_date=orig_due,
                remaining_balance=current_balance,
                requested_amount=req_amount,
                days_overdue=days_overdue,
                line_note=line.line_note,
            )

    if valid_lines_count == 0:
        raise ValidationError("Tất cả các khoản công nợ của thông báo trước đã được thanh toán hết. Không thể lập thông báo mới.")

    new_reminder.total_requested_amount = total_amount
    new_reminder.save(update_fields=["total_requested_amount"])

    return new_reminder


@transaction.atomic
def cancel_notice(
    reminder: CustomerPaymentReminder,
    reason: str,
    user: Optional[UserAccount] = None,
) -> CustomerPaymentReminder:
    """
    AF08: Hủy thông báo đề nghị thanh toán. Lưu lý do, người hủy và thời điểm hủy.
    """
    if reminder.status == ReminderStatus.CANCELLED:
        raise ValidationError("Thông báo đã ở trạng thái Đã hủy.")

    if not reason or not str(reason).strip():
        raise ValidationError({"reason": "Lý do hủy là bắt buộc."})

    reminder.status = ReminderStatus.CANCELLED
    reminder.cancel_reason = str(reason).strip()
    reminder.cancelled_by = user
    reminder.cancelled_at = timezone.now()
    reminder.save(update_fields=["status", "cancel_reason", "cancelled_by", "cancelled_at", "updated_at"])

    return reminder


def export_pdf_payload(reminder: CustomerPaymentReminder) -> Dict[str, Any]:
    """
    Step 7 & EF05 & BR14:
    Kiểm tra lại số dư; nếu các khoản vẫn đáp ứng số tiền đề nghị, tạo payload PDF.
    Nếu số dư giảm dưới số tiền đề nghị, yêu cầu cập nhật thông báo trước khi xuất.
    """
    if reminder.status == ReminderStatus.DRAFT:
        for line in reminder.lines.all():
            if line.receivable_schedule:
                current_balance = line.receivable_schedule.balance
            else:
                current_balance = line.receivable.balance

            if current_balance < line.requested_amount:
                raise ValidationError(
                    f"Số dư công nợ của khoản [{line.source_document_number}] đã thay đổi "
                    f"(hiện còn {current_balance}, số tiền đề nghị {line.requested_amount}). "
                    f"Vui lòng cập nhật lại thông báo trước khi xuất."
                )

    company = reminder.company
    customer = reminder.customer

    lines_payload = []
    for line in reminder.lines.all():
        lines_payload.append({
            "line_no": line.line_no,
            "source_document_number": line.source_document_number,
            "source_document_date": line.source_document_date.isoformat() if line.source_document_date else None,
            "invoice_series": line.invoice_series or "",
            "invoice_number": line.invoice_number or "",
            "invoice_date": line.invoice_date.isoformat() if line.invoice_date else None,
            "original_due_date": line.original_due_date.isoformat() if line.original_due_date else None,
            "remaining_balance": str(line.remaining_balance),
            "requested_amount": str(line.requested_amount),
            "days_overdue": line.days_overdue if line.days_overdue is not None else "Chưa có hạn",
            "line_note": line.line_note or "",
        })

    send_history = []
    for log in reminder.send_logs.all():
        send_history.append({
            "sent_date": log.sent_date.isoformat(),
            "sent_channel": log.sent_channel,
            "channel_other_name": log.channel_other_name,
            "actual_recipient": log.actual_recipient,
            "sent_by": log.sent_by.username if log.sent_by else "",
            "sent_at": log.sent_at.isoformat(),
            "note": log.note,
        })

    return {
        "notice_number": reminder.notice_number,
        "notice_date": reminder.notice_date.isoformat(),
        "requested_due_date": reminder.requested_due_date.isoformat(),
        "title": reminder.title,
        "content": reminder.content,
        "status": reminder.status,
        "company": {
            "name": company.legal_name or company.name,
            "code": company.code,
            "tax_code": company.tax_code,
            "address": getattr(company, "address", "") or "",
            "phone": getattr(company, "phone", "") or "",
            "email": getattr(company, "email", "") or "",
        },
        "customer": {
            "code": customer.code,
            "name": customer.name,
            "tax_code": getattr(customer, "tax_code", "") or "",
            "address": reminder.customer_address,
            "recipient_name": reminder.recipient_name,
            "recipient_email": reminder.recipient_email,
        },
        "currency": {
            "code": reminder.currency.code,
            "name": getattr(reminder.currency, "name", reminder.currency.code),
        },
        "payment_method": reminder.payment_method,
        "bank_info": reminder.bank_info_snapshot if reminder.payment_method == ReminderPaymentMethod.BANK_TRANSFER else None,
        "cash_location": reminder.cash_location if reminder.payment_method == ReminderPaymentMethod.CASH else None,
        "transfer_note": reminder.transfer_note,
        "total_requested_amount": str(reminder.total_requested_amount),
        "total_in_words": f"{int(reminder.total_requested_amount):,} {reminder.currency.code}",
        "signer": {
            "name": reminder.signer_name,
            "title": reminder.signer_title,
        },
        "lines": lines_payload,
        "send_history": send_history,
        "data_extracted_at": reminder.data_extracted_at.isoformat() if reminder.data_extracted_at else None,
        "exported_at": timezone.now().isoformat(),
    }


def create_from_due_tracking(
    company: Company,
    items: List[Dict[str, Any]],
    user: Optional[UserAccount] = None,
) -> Dict[str, Any]:
    """
    AF01: Lập thông báo đề nghị thanh toán từ danh sách các khoản nợ được chọn tại UC-AR-08 (Công nợ đến hạn).
    Kiểm tra tính nhất quán (cùng khách hàng, loại tiền, tài khoản) và điền sẵn dữ liệu.
    """
    if not items:
        raise ValidationError("Chưa chọn khoản công nợ nào từ danh sách đến hạn.")

    first_rec = None
    common_customer_id = None
    common_currency_id = None
    common_account_id = None

    lines_draft = []
    for item in items:
        rec_id = item.get("receivable_id")
        sch_id = item.get("schedule_id") or item.get("receivable_schedule_id")

        rec = (
            Receivable.objects.filter(pk=rec_id, company=company)
            .select_related("customer", "currency", "account")
            .first()
        )
        if not rec:
            raise ValidationError(f"Khoản phải thu {rec_id} không tồn tại hoặc không thuộc doanh nghiệp.")

        if common_customer_id is None:
            common_customer_id = rec.customer_id
            common_currency_id = rec.currency_id
            common_account_id = rec.account_id
            first_rec = rec
        else:
            # EF04: Kiểm tra tính nhất quán
            if rec.customer_id != common_customer_id or rec.currency_id != common_currency_id or rec.account_id != common_account_id:
                raise ValidationError("Tất cả các khoản nợ được chọn phải cùng một khách hàng, một loại tiền và một tài khoản phải thu.")

        sch = None
        rem_balance = rec.balance
        orig_due = rec.due_date
        installment_no = 1
        if sch_id:
            sch = ReceivableSchedule.objects.filter(pk=sch_id, receivable=rec).first()
            if sch:
                rem_balance = sch.balance
                orig_due = sch.due_date
                installment_no = sch.installment_no

        custom_amount = item.get("requested_amount")
        req_amount = Decimal(str(custom_amount)) if custom_amount is not None else rem_balance

        lines_draft.append({
            "receivable_id": str(rec.id),
            "receivable_schedule_id": str(sch.id) if sch else None,
            "installment_no": installment_no,
            "source_document_number": rec.source_document_number or rec.code,
            "source_document_date": rec.posting_date or rec.document_date,
            "original_due_date": orig_due,
            "remaining_balance": rem_balance,
            "requested_amount": req_amount,
            "line_note": item.get("line_note", ""),
        })

    customer_info = get_default_customer_info(first_rec.customer)
    today = timezone.localdate()

    return {
        "company_id": str(company.id),
        "customer_id": str(first_rec.customer_id),
        "customer_name": first_rec.customer.name,
        "currency_id": str(first_rec.currency_id),
        "currency_code": first_rec.currency.code,
        "receivable_account_id": str(first_rec.account_id),
        "receivable_account_code": first_rec.account.code if first_rec.account else "",
        "notice_date": today.isoformat(),
        "requested_due_date": today.isoformat(),
        "recipient_name": customer_info["recipient_name"],
        "recipient_email": customer_info["recipient_email"],
        "customer_address": customer_info["customer_address"],
        "title": "Thông báo đề nghị thanh toán công nợ",
        "payment_method": ReminderPaymentMethod.BANK_TRANSFER,
        "lines": lines_draft,
    }
