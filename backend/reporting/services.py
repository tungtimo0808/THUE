from datetime import date
from decimal import Decimal

from django.db.models import DecimalField, F, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError

from audit_log.services import record_audit
from general_ledger.models import AccountingPeriod, JournalEntry, JournalLine
from organization.models import Company

from .models import ReportDefinition, ReportRun


ZERO = Decimal("0")
MONEY = DecimalField(max_digits=24, decimal_places=4)


def actor(request):
    if not hasattr(request.user, "iam_account"):
        raise ValidationError("Tài khoản chưa được liên kết với IAM.")
    return request.user.iam_account


def json_value(value):
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (date,)):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(key): json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_value(item) for item in value]
    return str(value) if hasattr(value, "hex") else value


def _company_period(parameters):
    company = get_object_or_404(Company, pk=parameters["company"])
    period = None
    if parameters.get("period"):
        period = get_object_or_404(AccountingPeriod, pk=parameters["period"], company=company)
    date_from = parameters.get("date_from") or (period.start_date if period else None)
    date_to = parameters.get("date_to") or (period.end_date if period else None)
    if not date_from or not date_to:
        raise ValidationError("Phải chọn kỳ kế toán hoặc nhập đầy đủ từ ngày và đến ngày.")
    if date_from > date_to:
        raise ValidationError("Từ ngày không được lớn hơn đến ngày.")
    return company, period, date_from, date_to


def _journal_lines(company, date_from, date_to, parameters):
    queryset = JournalLine.objects.filter(
        entry__company=company,
        entry__status__in=("POSTED", "REVERSED"),
        entry__posting_date__range=(date_from, date_to),
    ).select_related("entry", "account", "currency", "party", "department", "project", "cost_center", "warehouse")
    for parameter, lookup in (
        ("branch", "entry__branch_id"), ("department", "department_id"), ("warehouse", "warehouse_id"),
        ("account", "account_id"), ("party", "party_id"),
    ):
        if parameters.get(parameter):
            queryset = queryset.filter(**{lookup: parameters[parameter]})
    return queryset


def _amount(debit, credit, calculation):
    if calculation == "CREDIT_MINUS_DEBIT":
        return credit - debit
    if calculation == "DEBIT":
        return debit
    if calculation == "CREDIT":
        return credit
    return debit - credit


def financial_report(definition, company, period, date_from, date_to, parameters):
    lines = _journal_lines(company, date_from, date_to, parameters)
    mappings = list(definition.line_mappings.filter(is_active=True))
    rows, trace = [], []
    if mappings:
        for mapping in mappings:
            selected = lines
            prefixes = mapping.account_prefixes
            if prefixes:
                account_filter = Q()
                for prefix in prefixes:
                    account_filter |= Q(account__code__startswith=prefix)
                selected = selected.filter(account_filter)
            totals = selected.aggregate(debit=Coalesce(Sum("debit"), Value(ZERO), output_field=MONEY), credit=Coalesce(Sum("credit"), Value(ZERO), output_field=MONEY))
            rows.append({"code": mapping.code, "name": mapping.name, "amount": _amount(totals["debit"], totals["credit"], mapping.calculation), "formula": mapping.formula})
    else:
        grouped = lines.values("account__account_class__code", "account__account_class__name").annotate(
            debit=Coalesce(Sum("debit"), Value(ZERO), output_field=MONEY),
            credit=Coalesce(Sum("credit"), Value(ZERO), output_field=MONEY),
        ).order_by("account__account_class__code")
        rows = [{"code": item["account__account_class__code"], "name": item["account__account_class__name"], "debit": item["debit"], "credit": item["credit"], "amount": item["debit"] - item["credit"]} for item in grouped]
    trace = [{"module": "GL", "entity_type": "JournalEntry", "entity_id": str(value)} for value in lines.values_list("entry_id", flat=True).distinct()]
    debit_credit = lines.aggregate(debit=Coalesce(Sum("debit"), Value(ZERO), output_field=MONEY), credit=Coalesce(Sum("credit"), Value(ZERO), output_field=MONEY))
    return rows, {"total_debit": debit_credit["debit"], "total_credit": debit_credit["credit"], "balanced": debit_credit["debit"] == debit_credit["credit"]}, trace


def ledger_report(company, date_from, date_to, parameters):
    lines = _journal_lines(company, date_from, date_to, parameters).order_by("entry__posting_date", "entry__number", "line_no")
    rows = [{
        "entry_id": str(line.entry_id), "number": line.entry.number, "posting_date": line.entry.posting_date,
        "account_code": line.account.code, "account_name": line.account.name,
        "description": line.description or line.entry.description, "debit": line.debit, "credit": line.credit,
        "currency": line.currency.code, "foreign_amount": line.foreign_amount,
        "source_module": line.entry.source_module, "source_entity_type": line.entry.source_entity_type,
        "source_entity_id": line.entry.source_entity_id,
    } for line in lines]
    totals = lines.aggregate(debit=Coalesce(Sum("debit"), Value(ZERO), output_field=MONEY), credit=Coalesce(Sum("credit"), Value(ZERO), output_field=MONEY))
    trace = [{"module": "GL", "entity_type": "JournalEntry", "entity_id": str(value)} for value in lines.values_list("entry_id", flat=True).distinct()]
    return rows, totals, trace


def commerce_report(company, date_from, date_to, parameters):
    from purchases.models import PurchaseOrder
    from sales.models import SalesOrder

    invalid = ("DRAFT", "REJECTED", "CANCELLED")
    purchases = PurchaseOrder.objects.filter(company=company, document_date__range=(date_from, date_to)).exclude(status__in=invalid).select_related("supplier", "currency", "branch")
    sales = SalesOrder.objects.filter(company=company, document_date__range=(date_from, date_to)).exclude(status__in=invalid).select_related("customer", "currency", "branch")
    if parameters.get("branch"):
        purchases, sales = purchases.filter(branch_id=parameters["branch"]), sales.filter(branch_id=parameters["branch"])
    if parameters.get("party"):
        purchases, sales = purchases.filter(supplier_id=parameters["party"]), sales.filter(customer_id=parameters["party"])
    rows = [
        {"module": "PUR", "entity_id": str(item.id), "number": item.number, "date": item.document_date, "party": item.supplier.name, "currency": item.currency.code, "amount": item.total_amount, "status": item.status}
        for item in purchases
    ] + [
        {"module": "SAL", "entity_id": str(item.id), "number": item.number, "date": item.document_date, "party": item.customer.name, "currency": item.currency.code, "amount": item.total_amount, "status": item.status}
        for item in sales
    ]
    purchase_total = purchases.aggregate(value=Coalesce(Sum("total_amount"), Value(ZERO), output_field=MONEY))["value"]
    sales_total = sales.aggregate(value=Coalesce(Sum("total_amount"), Value(ZERO), output_field=MONEY))["value"]
    trace = [{"module": row["module"], "entity_type": "PurchaseOrder" if row["module"] == "PUR" else "SalesOrder", "entity_id": row["entity_id"]} for row in rows]
    return rows, {"purchase_total": purchase_total, "sales_total": sales_total}, trace


def debt_report(company, date_from, date_to, parameters):
    from accounts_payable.models import Payable
    from accounts_receivable.models import Receivable

    as_of = parameters.get("as_of_date") or date_to
    payables = Payable.objects.filter(company=company, invoice__invoice_date__lte=as_of).exclude(status="REVERSED").select_related("supplier", "invoice", "currency")
    receivables = Receivable.objects.filter(company=company, document__document_date__lte=as_of).exclude(status="REVERSED").select_related("customer", "document", "currency")
    if parameters.get("branch"):
        payables, receivables = payables.filter(branch_id=parameters["branch"]), receivables.filter(branch_id=parameters["branch"])
    if parameters.get("party"):
        payables, receivables = payables.filter(supplier_id=parameters["party"]), receivables.filter(customer_id=parameters["party"])
    rows = []
    for kind, queryset, party_field, document_field in (("AP", payables, "supplier", "invoice"), ("AR", receivables, "customer", "document")):
        for item in queryset:
            due = item.due_date
            rows.append({
                "module": kind, "entity_id": str(item.id), "document_id": str(getattr(item, document_field).id),
                "party": getattr(item, party_field).name, "due_date": due,
                "age_days": max((as_of - due).days, 0) if due else 0,
                "original_amount": item.original_amount,
                "settled_amount": item.original_amount - item.balance, "balance": item.balance,
                "currency": item.currency.code, "status": item.status,
            })
    ap_total = payables.aggregate(value=Coalesce(Sum("balance"), Value(ZERO), output_field=MONEY))["value"]
    ar_total = receivables.aggregate(value=Coalesce(Sum("balance"), Value(ZERO), output_field=MONEY))["value"]
    trace = [{"module": row["module"], "entity_type": "Payable" if row["module"] == "AP" else "Receivable", "entity_id": row["entity_id"]} for row in rows]
    return rows, {"payable_balance": ap_total, "receivable_balance": ar_total}, trace


def money_report(company, date_from, date_to, parameters):
    from bank_management.models import BankTransaction
    from cash_management.models import CashTransaction

    cash = CashTransaction.objects.filter(company=company, transaction_date__range=(date_from, date_to), status__in=("POSTED", "REVERSED")).select_related("fund", "currency")
    bank = BankTransaction.objects.filter(company=company, transaction_date__range=(date_from, date_to), status__in=("POSTED", "REVERSED")).select_related("account__account", "currency")
    if parameters.get("branch"):
        cash = cash.filter(fund__branch_id=parameters["branch"])
    if parameters.get("bank_account"):
        bank = bank.filter(account__account_id=parameters["bank_account"])
    rows = []
    incoming = {"RECEIPT", "ADJUSTMENT_IN", "ADVANCE_RETURN", "INTEREST", "OTHER_IN"}
    for module, queryset, account_getter in (("CASH", cash, lambda x: x.fund.code), ("BANK", bank, lambda x: x.account.account.account_number)):
        for item in queryset:
            direction = "IN" if item.transaction_type in incoming else "OUT"
            rows.append({"module": module, "entity_id": str(item.id), "number": item.number, "date": item.transaction_date, "account": account_getter(item), "direction": direction, "amount": item.amount, "base_amount": item.base_amount, "currency": item.currency.code, "status": item.status})
    receipt = sum((row["base_amount"] for row in rows if row["direction"] == "IN"), ZERO)
    payment = sum((row["base_amount"] for row in rows if row["direction"] == "OUT"), ZERO)
    trace = [{"module": row["module"], "entity_type": "CashTransaction" if row["module"] == "CASH" else "BankTransaction", "entity_id": row["entity_id"]} for row in rows]
    return rows, {"receipt": receipt, "payment": payment, "net_cash_flow": receipt - payment}, trace


def inventory_report(company, date_from, date_to, parameters):
    from inventory.models import StockBalance, StockMovement

    balances = StockBalance.objects.filter(company=company).select_related("warehouse", "item", "location", "lot_serial")
    movements = StockMovement.objects.filter(company=company, movement_date__range=(date_from, date_to))
    if parameters.get("warehouse"):
        balances, movements = balances.filter(warehouse_id=parameters["warehouse"]), movements.filter(warehouse_id=parameters["warehouse"])
    if parameters.get("item"):
        balances, movements = balances.filter(item_id=parameters["item"]), movements.filter(item_id=parameters["item"])
    movement_totals = {item["item_id"]: item for item in movements.values("item_id").annotate(quantity=Sum("quantity_delta"), value=Sum("value_delta"))}
    rows = [{
        "entity_id": str(item.id), "warehouse": item.warehouse.code, "item_code": item.item.code,
        "item_name": item.item.name, "quantity": item.quantity, "reserved_quantity": item.reserved_quantity,
        "available_quantity": item.available_quantity, "inventory_value": item.inventory_value,
        "period_quantity_delta": movement_totals.get(item.item_id, {}).get("quantity", ZERO),
        "period_value_delta": movement_totals.get(item.item_id, {}).get("value", ZERO),
    } for item in balances]
    totals = balances.aggregate(quantity=Coalesce(Sum("quantity"), Value(ZERO), output_field=MONEY), value=Coalesce(Sum("inventory_value"), Value(ZERO), output_field=MONEY))
    trace = [{"module": "INV", "entity_type": "StockMovement", "entity_id": str(value)} for value in movements.values_list("id", flat=True)]
    return rows, totals, trace


def asset_report(company, date_from, date_to, parameters):
    from fixed_assets.models import AssetRecord, AssetTransaction

    assets = AssetRecord.objects.filter(company=company, acquisition_date__lte=date_to).select_related("category", "branch", "department")
    if parameters.get("branch"):
        assets = assets.filter(branch_id=parameters["branch"])
    if parameters.get("department"):
        assets = assets.filter(department_id=parameters["department"])
    if parameters.get("status"):
        assets = assets.filter(status=parameters["status"])
    rows = [{
        "entity_id": str(item.id), "code": item.code, "name": item.name, "asset_type": item.asset_type,
        "category": item.category.name, "branch": item.branch.code, "department": item.department.name if item.department else "",
        "original_cost": item.original_cost, "processed_value": item.processed_value,
        "remaining_value": item.remaining_value, "status": item.status,
    } for item in assets]
    original = sum((item.original_cost for item in assets), ZERO)
    processed = sum((item.processed_value for item in assets), ZERO)
    transactions = AssetTransaction.objects.filter(company=company, asset__in=assets, transaction_date__range=(date_from, date_to), status__in=("POSTED", "REVERSED"))
    trace = [{"module": "FA", "entity_type": "AssetTransaction", "entity_id": str(value)} for value in transactions.values_list("id", flat=True)]
    return rows, {"original_cost": original, "processed_value": processed, "remaining_value": original - processed}, trace


def tax_report(company, date_from, date_to, parameters):
    from tax_management.models import TaxInvoice

    invoices = TaxInvoice.objects.filter(company=company, invoice_date__range=(date_from, date_to)).exclude(status__in=("DRAFT", "CANCELLED", "REJECTED")).select_related("branch", "currency", "party")
    if parameters.get("branch"):
        invoices = invoices.filter(branch_id=parameters["branch"])
    if parameters.get("party"):
        invoices = invoices.filter(party_id=parameters["party"])
    if parameters.get("status"):
        invoices = invoices.filter(status=parameters["status"])
    rows = [{
        "entity_id": str(item.id), "direction": item.direction, "invoice_series": item.invoice_series,
        "invoice_number": item.invoice_number, "invoice_date": item.invoice_date,
        "party": item.party.name if item.party else (item.seller_name if item.direction == "INPUT" else item.buyer_name),
        "subtotal": item.subtotal, "tax_amount": item.tax_amount, "total_amount": item.total_amount,
        "currency": item.currency.code, "status": item.status,
        "linked": item.document_links.exists(), "posted": bool(item.document_links.filter(module_code="GL").exists()),
    } for item in invoices]
    input_tax = invoices.filter(direction="INPUT").aggregate(value=Coalesce(Sum("tax_amount"), Value(ZERO), output_field=MONEY))["value"]
    output_tax = invoices.filter(direction="OUTPUT").aggregate(value=Coalesce(Sum("tax_amount"), Value(ZERO), output_field=MONEY))["value"]
    trace = [{"module": "TAX", "entity_type": "TaxInvoice", "entity_id": str(item.id)} for item in invoices]
    return rows, {"input_tax": input_tax, "output_tax": output_tax, "tax_difference": output_tax - input_tax, "unlinked_count": sum(1 for row in rows if not row["linked"])}, trace


def management_report(company, date_from, date_to, parameters):
    lines = _journal_lines(company, date_from, date_to, parameters)
    grouped = lines.values("account__account_type").annotate(debit=Coalesce(Sum("debit"), Value(ZERO), output_field=MONEY), credit=Coalesce(Sum("credit"), Value(ZERO), output_field=MONEY))
    values = {item["account__account_type"]: item for item in grouped}
    revenue = values.get("REVENUE", {}).get("credit", ZERO) - values.get("REVENUE", {}).get("debit", ZERO)
    expense = values.get("EXPENSE", {}).get("debit", ZERO) - values.get("EXPENSE", {}).get("credit", ZERO)
    rows = [
        {"code": "REVENUE", "name": "Doanh thu", "amount": revenue, "source": "GL: account_type=REVENUE"},
        {"code": "EXPENSE", "name": "Chi phí", "amount": expense, "source": "GL: account_type=EXPENSE"},
        {"code": "PROFIT", "name": "Lợi nhuận", "amount": revenue - expense, "source": "REVENUE - EXPENSE"},
    ]
    trace = [{"module": "GL", "entity_type": "JournalEntry", "entity_id": str(value)} for value in lines.values_list("entry_id", flat=True).distinct()]
    return rows, {"revenue": revenue, "expense": expense, "profit": revenue - expense}, trace


REPORT_HANDLERS = {
    "FINANCIAL": lambda definition, company, period, start, end, params: financial_report(definition, company, period, start, end, params),
    "LEDGER": lambda definition, company, period, start, end, params: ledger_report(company, start, end, params),
    "COMMERCE": lambda definition, company, period, start, end, params: commerce_report(company, start, end, params),
    "DEBT": lambda definition, company, period, start, end, params: debt_report(company, start, end, params),
    "MONEY": lambda definition, company, period, start, end, params: money_report(company, start, end, params),
    "INVENTORY": lambda definition, company, period, start, end, params: inventory_report(company, start, end, params),
    "ASSET": lambda definition, company, period, start, end, params: asset_report(company, start, end, params),
    "TAX": lambda definition, company, period, start, end, params: tax_report(company, start, end, params),
    "MANAGEMENT": lambda definition, company, period, start, end, params: management_report(company, start, end, params),
}


def execute_report(parameters, request):
    definition = get_object_or_404(ReportDefinition, code=parameters["report_code"], is_active=True)
    company, period, date_from, date_to = _company_period(parameters)
    rows, totals, trace = REPORT_HANDLERS[definition.group](definition, company, period, date_from, date_to, parameters)
    comparison = None
    if parameters.get("comparison_period"):
        if not definition.supports_comparison:
            raise ValidationError("Báo cáo này không hỗ trợ so sánh kỳ.")
        comparison_period = get_object_or_404(AccountingPeriod, pk=parameters["comparison_period"], company=company)
        comparison_parameters = {**parameters, "period": comparison_period.id, "date_from": comparison_period.start_date, "date_to": comparison_period.end_date}
        comparison_rows, comparison_totals, _ = REPORT_HANDLERS[definition.group](
            definition, company, comparison_period, comparison_period.start_date, comparison_period.end_date, comparison_parameters,
        )
        comparison = {
            "period": {"id": str(comparison_period.id), "code": comparison_period.code},
            "date_from": comparison_period.start_date, "date_to": comparison_period.end_date,
            "totals": comparison_totals, "rows": comparison_rows,
        }
    has_data = bool(trace) if definition.group in {"FINANCIAL", "MANAGEMENT"} else bool(rows)
    result = {
        "company": {"id": str(company.id), "code": company.code, "name": company.name},
        "report": {"code": definition.code, "name": definition.name, "group": definition.group},
        "period": {"id": str(period.id), "code": period.code} if period else None,
        "date_from": date_from, "date_to": date_to, "currency": company.accounting_currency.code,
        "totals": totals, "rows": rows, "comparison": comparison, "has_data": has_data,
    }
    run = ReportRun.objects.create(
        company=company, report=definition, requested_by=actor(request), parameters=json_value(parameters),
        result=json_value(result), status=ReportRun.Status.COMPLETED if has_data else ReportRun.Status.NO_DATA,
        row_count=len(rows), source_trace=trace,
    )
    if definition.is_sensitive:
        record_audit(company=company, actor_user=actor(request), module_code="RPT", action_code="VIEW", entity=run, after={"report": definition.code, "parameters": parameters}, request=request)
    return run
