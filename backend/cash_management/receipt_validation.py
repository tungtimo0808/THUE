"""Validation for UC-CASH-01 receipts saved before approval or posting."""

from decimal import Decimal, InvalidOperation

from rest_framework import serializers

from accounts_receivable.models import Receivable
from general_ledger.models import Account, AccountingPeriod
from master_data.models import CompanyBankAccount
from organization.models import Employee


RECEIPT_TYPES = {"CUSTOMER_ADVANCE", "CUSTOMER_INVOICE", "EMPLOYEE_RETURN", "BANK_WITHDRAWAL", "OTHER_RECEIPT"}


def positive(value, field):
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise serializers.ValidationError({field: "Giá trị phải là số hợp lệ."})
    if not result.is_finite() or result <= 0:
        raise serializers.ValidationError({field: "Giá trị phải lớn hơn 0."})
    return result


def validate_receipt(attrs, instance=None):
    kind = attrs.get("business_type", getattr(instance, "business_type", ""))
    if kind not in RECEIPT_TYPES:
        return attrs
    if attrs.get("transaction_type", getattr(instance, "transaction_type", "")) != "RECEIPT":
        raise serializers.ValidationError({"transaction_type": "Loại nghiệp vụ này chỉ dùng cho phiếu thu."})
    company = attrs.get("company", getattr(instance, "company", None))
    fund = attrs.get("fund", getattr(instance, "fund", None))
    currency = attrs.get("currency", getattr(instance, "currency", None))
    party = attrs.get("party", getattr(instance, "party", None))
    details = attrs.get("receipt_details", getattr(instance, "receipt_details", None))
    if not isinstance(details, dict):
        raise serializers.ValidationError({"receipt_details": "Thiếu chi tiết phiếu thu."})
    if not str(attrs.get("description", getattr(instance, "description", ""))).strip():
        raise serializers.ValidationError({"description": "Vui lòng nhập lý do nộp."})
    if not fund or fund.company_id != company.pk or fund.branch.status != "ACTIVE":
        raise serializers.ValidationError({"fund": "Chọn quỹ thuộc chi nhánh đang hoạt động."})
    if kind in {"CUSTOMER_ADVANCE", "CUSTOMER_INVOICE"}:
        if not party or party.company_id != company.pk:
            raise serializers.ValidationError({"party": "Vui lòng chọn khách hàng."})
    if kind == "EMPLOYEE_RETURN":
        employee = Employee.objects.filter(pk=details.get("employee"), company=company, status="ACTIVE").first()
        if not employee:
            raise serializers.ValidationError({"receipt_details": "Vui lòng chọn nhân viên hoàn ứng."})
    if kind == "BANK_WITHDRAWAL":
        bank = CompanyBankAccount.objects.filter(pk=details.get("bank_account"), company=company, status="ACTIVE").first()
        if not bank or bank.currency_id != currency.pk:
            raise serializers.ValidationError({"receipt_details": "Vui lòng chọn tài khoản ngân hàng nguồn cùng loại tiền."})
    date_value = details.get("posting_date")
    from django.utils.dateparse import parse_date
    posting_date = parse_date(date_value) if isinstance(date_value, str) else None
    if posting_date is None:
        raise serializers.ValidationError({"receipt_details": "Ngày hạch toán không hợp lệ."})
    if AccountingPeriod.objects.filter(company=company, start_date__lte=posting_date, end_date__gte=posting_date, status="CLOSED").exists():
        raise serializers.ValidationError({"receipt_details": "Kỳ kế toán của ngày hạch toán đã khóa."})
    rate = positive(attrs.get("exchange_rate", getattr(instance, "exchange_rate", None)), "exchange_rate")
    if currency.pk == company.accounting_currency_id and rate != 1:
        raise serializers.ValidationError({"exchange_rate": "Tỷ giá tiền hạch toán phải bằng 1."})

    lines = details.get("lines")
    if not isinstance(lines, list) or not lines:
        raise serializers.ValidationError({"receipt_details": "Phiếu thu cần ít nhất một dòng hạch toán."})
    total = Decimal("0")
    for index, line in enumerate(lines, 1):
        prefix = f"Dòng {index}"
        if not isinstance(line, dict) or not str(line.get("description", "")).strip():
            raise serializers.ValidationError({"receipt_details": f"{prefix}: Vui lòng nhập diễn giải."})
        debit = Account.objects.filter(pk=line.get("debit_account"), company=company, status="ACTIVE", is_postable=True).first()
        credit = Account.objects.filter(pk=line.get("credit_account"), company=company, status="ACTIVE", is_postable=True).first()
        if not debit or not debit.code.startswith("111"):
            raise serializers.ValidationError({"receipt_details": f"{prefix}: TK Nợ phải là tài khoản tiền mặt chi tiết thuộc 111."})
        if not credit or credit.pk == debit.pk:
            raise serializers.ValidationError({"receipt_details": f"{prefix}: TK Có không hợp lệ hoặc trùng TK Nợ."})
        amount = positive(line.get("amount"), "receipt_details")
        total += amount
        dimensions = line.get("dimensions") or {}
        required = {key for account in (debit, credit) for key, level in (account.dimension_requirements or {}).items() if level == "REQUIRED"}
        if debit.requires_party or credit.requires_party:
            required.add("PARTY")
        for key in required:
            present = party if key in {"CUSTOMER", "SUPPLIER", "PARTY"} else details.get("employee") if key == "EMPLOYEE" else details.get("bank_account") if key == "BANK_ACCOUNT" else dimensions.get(key)
            if not present:
                raise serializers.ValidationError({"receipt_details": f"{prefix}: tài khoản yêu cầu {key}."})
        if kind in {"CUSTOMER_ADVANCE", "CUSTOMER_INVOICE"} and not credit.code.startswith("131"):
            raise serializers.ValidationError({"receipt_details": f"{prefix}: TK Có phải thuộc 131 cho khoản thu khách hàng."})
        if kind == "EMPLOYEE_RETURN" and not credit.code.startswith("141"):
            raise serializers.ValidationError({"receipt_details": f"{prefix}: TK Có phải thuộc 141 cho hoàn ứng."})
        if kind == "BANK_WITHDRAWAL" and not credit.code.startswith("112"):
            raise serializers.ValidationError({"receipt_details": f"{prefix}: TK Có phải thuộc 112 khi rút tiền gửi."})
    if total != attrs.get("amount", getattr(instance, "amount", None)):
        raise serializers.ValidationError({"amount": "Tổng tiền phải bằng tổng các dòng hạch toán."})

    allocations = details.get("allocations") or []
    if kind == "CUSTOMER_INVOICE":
        if not isinstance(allocations, list) or not allocations:
            raise serializers.ValidationError({"receipt_details": "Vui lòng chọn chứng từ công nợ."})
        allocated = Decimal("0")
        seen = set()
        for allocation in allocations:
            doc_id = allocation.get("receivable") if isinstance(allocation, dict) else None
            if not doc_id or doc_id in seen:
                raise serializers.ValidationError({"receipt_details": "Chứng từ công nợ bị thiếu hoặc trùng."})
            seen.add(doc_id)
            debt = Receivable.objects.filter(pk=doc_id, company=company, customer=party, currency=currency, balance__gt=0, status__in=["OPEN", "PARTIALLY_PAID"]).first()
            if not debt:
                raise serializers.ValidationError({"receipt_details": "Chứng từ công nợ không còn hợp lệ hoặc khác loại tiền."})
            value = positive(allocation.get("amount"), "receipt_details")
            if value > debt.balance:
                raise serializers.ValidationError({"receipt_details": f"{debt.code or debt.source_document_number}: số tiền thu vượt số còn phải thu."})
            if debt.account_id and any(str(debt.account_id) != str(line.get("credit_account")) for line in lines):
                raise serializers.ValidationError({"receipt_details": "TK Có phải khớp tài khoản phải thu của chứng từ."})
            allocated += value
        if allocated != total:
            raise serializers.ValidationError({"receipt_details": "Tổng thu theo hóa đơn phải bằng tổng dòng hạch toán."})
    elif allocations:
        raise serializers.ValidationError({"receipt_details": "Loại thu này không chọn chứng từ công nợ."})
    return attrs
