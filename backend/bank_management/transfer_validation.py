"""Checks for a direct transfer between two company bank accounts."""

from decimal import Decimal

from rest_framework import serializers

from general_ledger.models import AccountingPeriod


def validate_transfer(attrs, instance=None):
    company = attrs.get("company", getattr(instance, "company", None))
    source = attrs.get("source_account", getattr(instance, "source_account", None)).account
    destination = attrs.get("destination_account", getattr(instance, "destination_account", None)).account
    details = attrs.get("details", getattr(instance, "details", None))
    posting_date = attrs.get("posting_date", getattr(instance, "posting_date", None))
    amount = attrs.get("source_amount", getattr(instance, "source_amount", None))
    received = attrs.get("destination_amount", getattr(instance, "destination_amount", None))
    rate = attrs.get("exchange_rate", getattr(instance, "exchange_rate", None))
    if not str(attrs.get("description", getattr(instance, "description", "")) or "").strip():
        raise serializers.ValidationError({"description": "Vui lòng nhập lý do chuyển."})
    if source.status != "ACTIVE" or destination.status != "ACTIVE" or not source.allow_payment or not destination.allow_receipt:
        raise serializers.ValidationError({"source_account": "Tài khoản đi/đến chưa hoạt động hoặc không cho phép chuyển tiền."})
    if source.branch_id != destination.branch_id:
        raise serializers.ValidationError({"destination_account": "Hai tài khoản khác đơn vị hạch toán; hãy dùng nghiệp vụ chuyển giữa chi nhánh."})
    if source.currency_id != destination.currency_id:
        raise serializers.ValidationError({"destination_account": f"Khác loại tiền ({source.currency.code}/{destination.currency.code}); hãy dùng nghiệp vụ mua bán ngoại tệ."})
    if source.currency_id != company.accounting_currency_id:
        raise serializers.ValidationError({"source_account": "Chuyển cùng ngoại tệ cần chính sách định giá riêng; hiện chỉ hỗ trợ đồng tiền hạch toán."})
    if amount != received or rate != Decimal("1"):
        raise serializers.ValidationError({"source_amount": "Chuyển cùng loại tiền phải bằng số nhận và tỷ giá bằng 1; phí lập chứng từ riêng."})
    if not source.gl_account_id or not destination.gl_account_id:
        raise serializers.ValidationError({"source_account": "Hai tài khoản ngân hàng phải gắn TK kế toán tiền gửi."})
    for bank in (source, destination):
        gl = bank.gl_account
        if gl.company_id != company.pk or gl.status != "ACTIVE" or not gl.is_postable or not gl.code.startswith("112"):
            raise serializers.ValidationError({"source_account": "TK kế toán của ngân hàng phải là TK tiền gửi chi tiết đang hoạt động."})
    if not posting_date:
        raise serializers.ValidationError({"posting_date": "Vui lòng chọn ngày hạch toán."})
    if AccountingPeriod.objects.filter(company=company, start_date__lte=posting_date, end_date__gte=posting_date, status="CLOSED").exists():
        raise serializers.ValidationError({"posting_date": "Kỳ kế toán của ngày hạch toán đã khóa."})
    if not isinstance(details, dict) or not isinstance(details.get("lines"), list) or not details["lines"]:
        raise serializers.ValidationError({"details": "Cần ít nhất một dòng hạch toán."})
    total = Decimal("0")
    for index, line in enumerate(details["lines"], 1):
        if not isinstance(line, dict) or not str(line.get("description") or "").strip():
            raise serializers.ValidationError({"details": f"Dòng {index}: thiếu diễn giải."})
        if str(line.get("debit_account")) != str(destination.gl_account_id) or str(line.get("credit_account")) != str(source.gl_account_id):
            raise serializers.ValidationError({"details": f"Dòng {index}: TK Nợ/Có phải theo tài khoản ngân hàng đến/đi."})
        try:
            line_amount = Decimal(str(line.get("amount")))
        except (ValueError, TypeError):
            line_amount = Decimal("0")
        if not line_amount.is_finite() or line_amount <= 0:
            raise serializers.ValidationError({"details": f"Dòng {index}: số tiền phải lớn hơn 0."})
        total += line_amount
    if total != amount:
        raise serializers.ValidationError({"details": "Tổng dòng hạch toán phải bằng tổng tiền chuyển."})
    return attrs
