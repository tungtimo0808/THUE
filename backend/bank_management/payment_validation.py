"""Validate bank payment drafts without changing bank or payable balances."""

from decimal import Decimal, InvalidOperation

from django.utils.dateparse import parse_date
from rest_framework import serializers

from accounts_payable.models import Payable
from general_ledger.models import Account, AccountingPeriod
from organization.models import Employee


PAYMENT_TYPES = {"SUPPLIER_ADVANCE", "SUPPLIER_INVOICE", "EMPLOYEE_ADVANCE", "OTHER_PAYMENT"}


def positive(value, field):
    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise serializers.ValidationError({field: "Giá trị phải là số hợp lệ."})
    if not number.is_finite() or number <= 0:
        raise serializers.ValidationError({field: "Giá trị phải lớn hơn 0."})
    return number


def validate_payment(attrs, instance=None):
    kind = attrs.get("business_type", getattr(instance, "business_type", ""))
    if kind not in PAYMENT_TYPES:
        return attrs
    if attrs.get("transaction_type", getattr(instance, "transaction_type", "")) != "PAYMENT":
        raise serializers.ValidationError({"transaction_type": "Loại nghiệp vụ này chỉ dùng cho chi tiền gửi."})
    company = attrs.get("company", getattr(instance, "company", None))
    profile = attrs.get("account", getattr(instance, "account", None))
    currency = attrs.get("currency", getattr(instance, "currency", None))
    party = attrs.get("party", getattr(instance, "party", None))
    details = attrs.get("payment_details", getattr(instance, "payment_details", None))
    if not isinstance(details, dict):
        raise serializers.ValidationError({"payment_details": "Thiếu chi tiết chứng từ chi."})
    if not str(attrs.get("description", getattr(instance, "description", ""))).strip():
        raise serializers.ValidationError({"description": "Vui lòng nhập nội dung thanh toán."})
    bank_account = profile.account
    if (bank_account.company_id != company.pk or bank_account.status != "ACTIVE" or
            bank_account.currency_id != currency.pk or not bank_account.allow_payment or not bank_account.gl_account_id):
        raise serializers.ValidationError({"account": "Tài khoản ngân hàng không cho phép chi hoặc chưa gắn tài khoản kế toán."})
    reference = str(attrs.get("bank_reference", getattr(instance, "bank_reference", "")) or "").strip()
    if reference:
        from .models import BankTransaction
        duplicates = BankTransaction.objects.filter(account=profile, bank_reference=reference).exclude(status="CANCELLED")
        if instance:
            duplicates = duplicates.exclude(pk=instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError({"bank_reference": "Mã giao dịch ngân hàng đã được ghi nhận."})
    if kind in {"SUPPLIER_ADVANCE", "SUPPLIER_INVOICE"} and (not party or party.status != "ACTIVE"):
        raise serializers.ValidationError({"party": "Vui lòng chọn nhà cung cấp đang hoạt động."})
    if kind == "EMPLOYEE_ADVANCE" and not Employee.objects.filter(
        pk=details.get("employee"), company=company, status="ACTIVE"
    ).exists():
        raise serializers.ValidationError({"payment_details": "Vui lòng chọn nhân viên tạm ứng."})
    if details.get("bank_fee") and kind != "OTHER_PAYMENT":
        raise serializers.ValidationError({"payment_details": "Chỉ khoản chi khác mới được chọn phí ngân hàng tự trích."})
    posting_date = parse_date(details.get("posting_date", "")) if isinstance(details.get("posting_date"), str) else None
    if posting_date is None:
        raise serializers.ValidationError({"payment_details": "Ngày hạch toán không hợp lệ."})
    if AccountingPeriod.objects.filter(
        company=company, start_date__lte=posting_date, end_date__gte=posting_date, status="CLOSED"
    ).exists():
        raise serializers.ValidationError({"payment_details": "Kỳ kế toán của ngày hạch toán đã khóa."})
    rate = positive(attrs.get("exchange_rate", getattr(instance, "exchange_rate", None)), "exchange_rate")
    if currency.pk == company.accounting_currency_id and rate != 1:
        raise serializers.ValidationError({"exchange_rate": "Tỷ giá tiền hạch toán phải bằng 1."})
    if not details.get("bank_fee"):
        for field, label in (
            ("beneficiary_name", "Tên người thụ hưởng"),
            ("beneficiary_account", "Số tài khoản thụ hưởng"),
            ("beneficiary_bank", "Ngân hàng thụ hưởng"),
        ):
            if not str(details.get(field, "")).strip():
                raise serializers.ValidationError({"payment_details": f"Vui lòng nhập {label}."})
    lines = details.get("lines")
    if not isinstance(lines, list) or not lines:
        raise serializers.ValidationError({"payment_details": "Cần ít nhất một dòng hạch toán."})
    total = Decimal("0")
    for index, line in enumerate(lines, 1):
        prefix = f"Dòng {index}"
        if not isinstance(line, dict) or not str(line.get("description", "")).strip():
            raise serializers.ValidationError({"payment_details": f"{prefix}: vui lòng nhập diễn giải."})
        debit = Account.objects.filter(pk=line.get("debit_account"), company=company, status="ACTIVE", is_postable=True).first()
        credit = Account.objects.filter(pk=line.get("credit_account"), company=company, status="ACTIVE", is_postable=True).first()
        if not debit or not credit or debit.pk == credit.pk:
            raise serializers.ValidationError({"payment_details": f"{prefix}: tài khoản Nợ/Có không hợp lệ."})
        if credit.pk != bank_account.gl_account_id or not credit.code.startswith("112"):
            raise serializers.ValidationError({"payment_details": f"{prefix}: TK Có phải là tài khoản tiền gửi của tài khoản chi."})
        if kind in {"SUPPLIER_ADVANCE", "SUPPLIER_INVOICE"} and not debit.code.startswith("331"):
            raise serializers.ValidationError({"payment_details": f"{prefix}: TK Nợ phải thuộc 331."})
        if kind == "EMPLOYEE_ADVANCE" and not debit.code.startswith("141"):
            raise serializers.ValidationError({"payment_details": f"{prefix}: TK Nợ phải thuộc 141."})
        required = {key for account in (debit, credit) for key, level in
                    (account.dimension_requirements or {}).items() if level == "REQUIRED"}
        if debit.requires_party or credit.requires_party:
            required.add("PARTY")
        dimensions = line.get("dimensions") or {}
        for key in required:
            present = (details.get("employee") if kind == "EMPLOYEE_ADVANCE" else party) if key == "PARTY" else (
                party if key in {"SUPPLIER", "CUSTOMER"} else (
                details.get("employee") if key == "EMPLOYEE" else dimensions.get(key)
            ))
            if not present:
                raise serializers.ValidationError({"payment_details": f"{prefix}: tài khoản yêu cầu {key}."})
        total += positive(line.get("amount"), "payment_details")
    if total != attrs.get("amount", getattr(instance, "amount", None)):
        raise serializers.ValidationError({"amount": "Tổng tiền phải bằng tổng các dòng."})
    allocations = details.get("allocations") or []
    if kind == "SUPPLIER_INVOICE":
        if not isinstance(allocations, list) or not allocations:
            raise serializers.ValidationError({"payment_details": "Vui lòng chọn công nợ cần trả."})
        if len(lines) != len(allocations):
            raise serializers.ValidationError({"payment_details": "Mỗi chứng từ công nợ cần một dòng hạch toán tương ứng."})
        allocated = Decimal("0")
        seen = set()
        for index, item in enumerate(allocations):
            debt_id = item.get("payable") if isinstance(item, dict) else None
            if not debt_id or debt_id in seen:
                raise serializers.ValidationError({"payment_details": "Chứng từ công nợ bị thiếu hoặc trùng."})
            seen.add(debt_id)
            debt = Payable.objects.filter(pk=debt_id, company=company, supplier=party, currency=currency,
                                          balance__gt=0, status__in=["OPEN", "PARTIALLY_PAID", "OVERDUE"]).first()
            if not debt:
                raise serializers.ValidationError({"payment_details": "Công nợ không còn hợp lệ hoặc khác loại tiền."})
            if (debt.document_id and debt.document.status != "POSTED") or (debt.invoice_id and debt.invoice.status != "POSTED"):
                raise serializers.ValidationError({"payment_details": "Chứng từ công nợ chưa được ghi sổ."})
            if (debt.goods_purchase_id and debt.goods_purchase.status != "POSTED") or (
                debt.purchase_cost_id and debt.purchase_cost.status != "POSTED"
            ):
                raise serializers.ValidationError({"payment_details": "Chứng từ mua hàng chưa được ghi sổ."})
            if debt.document_id and str(debt.document.payable_account_id) != str(lines[index].get("debit_account")):
                raise serializers.ValidationError({"payment_details": "TK Nợ phải khớp tài khoản phải trả của chứng từ."})
            if positive(lines[index].get("amount"), "payment_details") != positive(item.get("amount"), "payment_details"):
                raise serializers.ValidationError({"payment_details": "Số tiền dòng hạch toán phải khớp số trả chứng từ."})
            paid = positive(item.get("amount"), "payment_details")
            try:
                discount = Decimal(str(item.get("discount") or "0"))
            except (InvalidOperation, TypeError, ValueError):
                raise serializers.ValidationError({"payment_details": "Chiết khấu phải là số hợp lệ."})
            if not discount.is_finite() or discount < 0 or paid + discount > debt.balance:
                raise serializers.ValidationError({"payment_details": "Số trả và chiết khấu vượt số còn phải trả."})
            allocated += paid
        if allocated != total:
            raise serializers.ValidationError({"payment_details": "Tổng số trả phải bằng tổng tiền chi ngân hàng."})
    elif allocations:
        raise serializers.ValidationError({"payment_details": "Loại chi này không chọn công nợ theo hóa đơn."})
    return attrs
