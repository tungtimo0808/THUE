"""Product costing: collect 621/622/627 costs of a period, assign them to cost objects, transfer to 154 and accept."""
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from audit_log.services import record_audit
from general_ledger.models import Account, AccountingPeriod, JournalEntry, JournalLine
from general_ledger.services import post as post_journal

from . import models

ZERO = Decimal("0")
CENT = Decimal("1")
ELEMENT_ACCOUNTS = {"material": "621", "labor": "622", "overhead": "627"}


def actor(request):
    return request.user.iam_account


def audit(request, obj, action, after=None):
    record_audit(company=obj.company, actor_user=actor(request), module_code="COST", action_code=action, entity=obj,
                 before={}, after=after or {}, request=request)


def resolve_object(company, object_type, object_id):
    """(code, name) of a cost object from the catalog it lives in."""
    from master_data.models import CostCenter, Project
    from sales.models import SalesContract, SalesOrder

    source = {"COST_CENTER": CostCenter, "PROJECT": Project, "ORDER": SalesOrder, "CONTRACT": SalesContract}.get(object_type)
    if not source:
        raise ValidationError({"object_type": "Loại đối tượng tập hợp chi phí không hợp lệ."})
    obj = source.objects.filter(company=company, pk=object_id).first()
    if not obj:
        raise ValidationError({"objects": "Đối tượng tập hợp chi phí không thuộc doanh nghiệp."})
    code = getattr(obj, "code", "") or getattr(obj, "number", "") or getattr(obj, "contract_number", "")
    name = getattr(obj, "name", "") or getattr(obj, "title", "") or getattr(getattr(obj, "customer", None), "name", "") or code
    return str(code), str(name)


def _pools(period, objects):
    """Net debits of 621/622/627 in the period: direct to an object when the line carries its cost center/project."""
    direct = defaultdict(lambda: defaultdict(lambda: ZERO))
    shared = defaultdict(lambda: ZERO)
    by_center = {str(obj.object_id): obj for obj in objects if obj.object_type == "COST_CENTER"}
    by_project = {str(obj.object_id): obj for obj in objects if obj.object_type == "PROJECT"}
    for element, prefix in ELEMENT_ACCOUNTS.items():
        lines = (JournalLine.objects.filter(entry__company=period.company, entry__status="POSTED", account__code__startswith=prefix,
                                            entry__posting_date__range=(period.start_date, period.end_date))
                 .exclude(entry__source_event_id__startswith="COST:")
                 .values("cost_center_id", "project_id").annotate(debit=Sum("debit"), credit=Sum("credit")))
        for row in lines:
            amount = (row["debit"] or ZERO) - (row["credit"] or ZERO)
            target = by_center.get(str(row["cost_center_id"])) or by_project.get(str(row["project_id"]))
            if target:
                direct[target.pk][element] += amount
            else:
                shared[element] += amount
    return direct, shared


def _weights(objects):
    by_output = {obj.pk: obj.output_quantity * obj.coefficient for obj in objects}
    if sum(by_output.values(), ZERO) > 0:
        return by_output
    by_plan = {obj.pk: obj.planned_cost for obj in objects}
    if sum(by_plan.values(), ZERO) > 0:
        return by_plan
    return {obj.pk: Decimal("1") for obj in objects}


def _allocation_weights(objects, direct, basis):
    if basis == "MATERIAL":
        weights = {obj.pk: max(direct[obj.pk]["material"], ZERO) for obj in objects}
    elif basis == "LABOR":
        weights = {obj.pk: max(direct[obj.pk]["labor"], ZERO) for obj in objects}
    elif basis == "PLAN":
        weights = {obj.pk: max(obj.planned_cost, ZERO) for obj in objects}
    elif basis == "OUTPUT":
        weights = {obj.pk: max(obj.output_quantity * obj.coefficient, ZERO) for obj in objects}
    else:
        weights = _weights(objects)
    return weights if sum(weights.values(), ZERO) > 0 else _weights(objects)


def calculate(period):
    objects = list(period.cost_objects.all())
    direct, shared = _pools(period, objects)
    setting = models.CostAllocationSetting.objects.filter(company=period.company).first()
    allocated = {obj.pk: {} for obj in objects}
    for element, amount in shared.items():
        basis = setting.labor_basis if setting and element == "labor" else setting.overhead_basis if setting and element == "overhead" else "AUTO"
        weights = _allocation_weights(objects, direct, basis)
        total_weight = sum(weights.values(), ZERO)
        used = ZERO
        for index, obj in enumerate(objects):
            share = amount - used if index == len(objects) - 1 else (amount * weights[obj.pk] / total_weight).quantize(CENT, rounding=ROUND_HALF_UP)
            used += share
            allocated[obj.pk][element] = share
    for obj in objects:
        obj.direct_cost = {element: str(value) for element, value in direct[obj.pk].items()}
        obj.allocated_cost = {element: str(value) for element, value in allocated[obj.pk].items()}
        incurred = sum(direct[obj.pk].values(), ZERO) + sum(allocated[obj.pk].values(), ZERO)
        obj.total_cost = obj.opening_wip + incurred - obj.closing_wip
        obj.unit_cost = (obj.total_cost / obj.output_quantity).quantize(Decimal("0.0001")) if obj.output_quantity else ZERO
        obj.save(update_fields=("direct_cost", "allocated_cost", "total_cost", "unit_cost"))
    period.pools = {element: str(sum((direct[obj.pk][element] for obj in objects), ZERO) + shared[element]) for element in ELEMENT_ACCOUNTS}
    period.save(update_fields=("pools",))
    return period


@transaction.atomic
def create_period(company, data, request):
    code = str(data.get("code") or "").strip()
    if not code or models.CostPeriod.objects.filter(company=company, code=code).exists():
        raise ValidationError({"code": "Mã kỳ tính giá thành trống hoặc đã tồn tại."})
    if data.get("method") not in dict(models.METHODS):
        raise ValidationError({"method": "Phương pháp tính giá thành không hợp lệ."})
    rows = data.get("objects") or []
    if not rows:
        raise ValidationError({"objects": "Chọn ít nhất một đối tượng tập hợp chi phí."})
    period = models.CostPeriod.objects.create(
        company=company, code=code, name=str(data.get("name") or code)[:255], method=data["method"],
        start_date=data["start_date"], end_date=data["end_date"], created_by=actor(request),
    )
    if period.end_date < period.start_date:
        raise ValidationError({"end_date": "Ngày kết thúc phải sau ngày bắt đầu."})
    for row in rows:
        object_code, object_name = resolve_object(company, row.get("object_type"), row.get("object_id"))
        setting = models.CostObjectSetting.objects.filter(company=company, object_type=row["object_type"], object_id=row["object_id"]).first()
        models.CostPeriodObject.objects.create(
            period=period, object_type=row["object_type"], object_id=row["object_id"], object_code=object_code, object_name=object_name,
            output_quantity=Decimal(str(row.get("output_quantity") or 0)),
            coefficient=Decimal(str(row.get("coefficient") or (setting.coefficient if setting else 1))),
            planned_cost=Decimal(str(row.get("planned_cost") or (setting.planned_cost if setting else 0))),
            opening_wip=Decimal(str(row.get("opening_wip") if row.get("opening_wip") is not None else (setting.opening_wip if setting else 0))),
            closing_wip=Decimal(str(row.get("closing_wip") or 0)),
        )
    calculate(period)
    audit(request, period, "CREATE", after={"code": code, "objects": len(rows)})
    return period


def _account(company, code):
    for size in range(len(code), 2, -1):
        account = Account.objects.filter(company=company, code=code[:size], is_postable=True, status="ACTIVE").first()
        if account:
            return account
    account = Account.objects.filter(company=company, code__startswith=code, is_postable=True, status="ACTIVE").order_by("code").first()
    if not account:
        raise ValidationError(f"Thiếu tài khoản {code} trong hệ thống tài khoản.")
    return account


def _journal(period, kind, lines, request, warehouse=None):
    accounting_period = AccountingPeriod.objects.filter(company=period.company, start_date__lte=period.end_date,
                                                        end_date__gte=period.end_date, status="OPEN").first()
    if not accounting_period:
        raise ValidationError("Kỳ kế toán chứa ngày cuối kỳ tính giá thành chưa mở hoặc đã khóa.")
    lines = [line for line in lines if line[2]]
    if not lines:
        raise ValidationError("Không có số tiền nào để hạch toán.")
    total = sum((line[2] for line in lines), ZERO)
    number = f"{period.code}-{kind}"[:70]
    count = JournalEntry.objects.filter(company=period.company, number__startswith=number).count()
    entry = JournalEntry.objects.create(
        company=period.company, period=accounting_period, number=f"{number}{count + 1 if count else ''}",
        entry_type="CLOSING",
        posting_date=period.end_date, document_date=period.end_date,
        description=("Kết chuyển chi phí sản xuất " if kind == "KC" else "Nghiệm thu / nhập kho ") + period.name,
        source_module="COST", source_event_id=f"COST:{period.pk}:{kind}:{count}", status="APPROVED", total_debit=total, total_credit=total,
        created_by=actor(request), approved_by=actor(request), approved_at=timezone.now(), workflow_snapshot={"allow_creator_posting": True},
    )
    for index, (debit, credit, amount, text) in enumerate(lines):
        JournalLine.objects.create(entry=entry, line_no=index * 2 + 1, account=debit, debit=amount, currency=period.company.accounting_currency,
                                   description=text[:500], warehouse=warehouse if debit.requires_warehouse else None)
        JournalLine.objects.create(entry=entry, line_no=index * 2 + 2, account=credit, credit=amount, currency=period.company.accounting_currency, description=text[:500])
    post_journal(entry, request)
    return entry


@transaction.atomic
def transfer(period, request):
    """Kết chuyển chi phí: Nợ 154 / Có 621, 622, 627 for the period's collected costs."""
    period = models.CostPeriod.objects.select_for_update().get(pk=period.pk)
    if period.status != models.CostPeriod.Status.CALCULATED:
        raise ValidationError("Kỳ tính giá thành đã được kết chuyển.")
    calculate(period)
    wip = _account(period.company, "154")
    lines = []
    for element, prefix in ELEMENT_ACCOUNTS.items():
        amount = Decimal(period.pools.get(element, "0"))
        if amount > 0:
            lines.append((wip, _account(period.company, prefix), amount, f"Kết chuyển chi phí TK {prefix}"))
    period.transfer_entry = _journal(period, "KC", lines, request)
    period.status = models.CostPeriod.Status.TRANSFERRED
    period.save(update_fields=("transfer_entry", "status"))
    audit(request, period, "TRANSFER", after={"entry": period.transfer_entry.number})
    return period


def _finished_goods_receipt(period, objects, warehouse, request):
    """Draft receipt of the finished goods at their computed unit cost; its GL is the acceptance entry."""
    from inventory.models import InventoryTransaction, InventoryTransactionLine

    receipt = InventoryTransaction.objects.create(
        company=period.company, number=f"NKTP-{period.code}-{InventoryTransaction.objects.filter(company=period.company).count() + 1}"[:80],
        transaction_type="RECEIPT", transaction_date=period.end_date, destination_warehouse=warehouse,
        source_module="COST", source_reference=period.code, reason=f"Nhập kho thành phẩm {period.name}"[:500],
        gl_status="POSTED", gl_reference=period.acceptance_entry.number, created_by=actor(request),
    )
    for index, obj in enumerate(objects, start=1):
        item = obj.finished_item
        InventoryTransactionLine.objects.create(
            transaction=receipt, line_no=index, item=item, uom=item.base_uom, movement_direction="IN",
            quantity=obj.output_quantity, base_quantity=obj.output_quantity, unit_cost=obj.unit_cost, line_value=obj.total_cost,
        )
    return receipt


@transaction.atomic
def accept(period, request):
    """Nghiệm thu (Nợ 632) or nhập kho thành phẩm (Nợ 155) the finished cost of the chosen objects: Có 154."""
    period = models.CostPeriod.objects.select_for_update().get(pk=period.pk)
    if period.status != models.CostPeriod.Status.TRANSFERRED:
        raise ValidationError("Phải kết chuyển chi phí trước khi nghiệm thu.")
    finished_goods = request.data.get("target") == "FINISHED_GOODS"
    target_code = "155" if finished_goods else "632"
    ids = {str(value) for value in request.data.get("objects") or []}
    objects = [obj for obj in period.cost_objects.filter(accepted=False) if not ids or str(obj.pk) in ids or str(obj.object_id) in ids]
    if not objects:
        raise ValidationError({"objects": "Không còn đối tượng nào chưa nghiệm thu."})
    target, wip = _account(period.company, target_code), _account(period.company, "154")
    warehouse = None
    if finished_goods:
        from master_data.models import Warehouse
        warehouse = Warehouse.objects.filter(company=period.company, pk=request.data.get("warehouse")).first()             or Warehouse.objects.filter(company=period.company, status="ACTIVE").first()
        if not warehouse:
            raise ValidationError({"warehouse": "Chọn kho nhập thành phẩm."})
        settings = {(row.object_type, str(row.object_id)): row for row in models.CostObjectSetting.objects.filter(company=period.company)}
        for obj in objects:
            setting = settings.get((obj.object_type, str(obj.object_id)))
            if not setting or not setting.finished_item_id or obj.output_quantity <= 0:
                raise ValidationError({"objects": f"{obj.object_code}: khai báo mã thành phẩm trong định mức và nhập số lượng hoàn thành."})
            obj.finished_item = setting.finished_item
    lines = [(target, wip, obj.total_cost, f"{'Nhập kho thành phẩm' if finished_goods else 'Nghiệm thu'} {obj.object_code} - {obj.object_name}")
             for obj in objects if obj.total_cost > 0]
    period.acceptance_entry = _journal(period, "NT", lines, request, warehouse=warehouse)
    if finished_goods:
        _finished_goods_receipt(period, objects, warehouse, request)
    for obj in objects:
        obj.accepted = True
        obj.save(update_fields=("accepted",))
    if not period.cost_objects.filter(accepted=False).exists():
        period.status = models.CostPeriod.Status.ACCEPTED
    period.save(update_fields=("acceptance_entry", "status"))
    audit(request, period, "ACCEPT", after={"entry": period.acceptance_entry.number, "objects": len(objects)})
    return period
