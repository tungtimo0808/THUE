"""UC-INV-07: approve and post one variance treatment at a time."""

from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from . import models, services


CAUSES = {"SURPLUS", "DOCUMENT", "WRONG_WAREHOUSE", "MISCOUNT", "OTHER", "UNKNOWN"}
ACTIVE = {"PENDING", "APPROVED", "COMPLETED"}


def _remaining(line, exclude=None):
    used = line.resolutions.filter(status__in=ACTIVE)
    if exclude:
        used = used.exclude(pk=exclude)
    allocated = used.aggregate(total=Sum("quantity"))["total"] or Decimal("0")
    return abs(line.variance_quantity) - allocated


def validate_resolution(attrs, instance, request):
    line = attrs.get("count_line", instance.count_line if instance else None)
    if not line:
        raise ValidationError({"count_line": "Chọn một dòng chênh lệch."})
    count = line.stock_count
    if count.status != "COUNTED" or count.warehouse.company_id != count.company_id:
        raise ValidationError("Biên bản kiểm kê chưa xác nhận hoặc không còn hiệu lực.")
    if instance and instance.status not in {"DRAFT", "NEEDS_INFO"}:
        raise ValidationError("Phương án đã gửi duyệt không thể sửa.")
    if instance and line.pk != instance.count_line_id:
        raise ValidationError("Không thể đổi dòng kiểm kê của phương án.")
    method = attrs.get("method", instance.method if instance else "")
    cause = attrs.get("reason_code", instance.reason_code if instance else "")
    quantity = attrs.get("quantity", instance.quantity if instance else Decimal("0"))
    cost = attrs.get("proposed_unit_cost", instance.proposed_unit_cost if instance else Decimal("0"))
    explanation = attrs.get("explanation", instance.explanation if instance else "")
    basis = attrs.get("valuation_basis", instance.valuation_basis if instance else "")
    if cause not in CAUSES or not str(explanation).strip():
        raise ValidationError("Chọn nguyên nhân và nhập diễn giải xác minh.")
    if method == "WAIT":
        if cause != "UNKNOWN" or quantity != 0:
            raise ValidationError("Phương án chờ xử lý chỉ dùng khi chưa xác định nguyên nhân và không phân bổ số lượng.")
    elif method not in {"INCREASE", "DECREASE"} or (line.variance_quantity > 0) != (method == "INCREASE"):
        raise ValidationError("Phương án tăng/giảm phải phù hợp chiều chênh lệch.")
    elif cause not in {"SURPLUS", "OTHER"} or cause == "SURPLUS" and method != "INCREASE":
        raise ValidationError("Nguyên nhân này cần xử lý qua chứng từ gốc hoặc kiểm đếm lại, không lập phiếu điều chỉnh mới.")
    elif quantity <= 0 or quantity > abs(line.variance_quantity):
        raise ValidationError("Số lượng xử lý phải lớn hơn 0 và không vượt chênh lệch đã xác nhận.")
    if cost < 0 or method == "INCREASE" and (cost <= 0 or not str(basis).strip()):
        raise ValidationError("Nhập đơn giá và căn cứ xác định giá trị hợp lệ.")
    if str(line.stock_count.company_id) != request.query_params.get("company_id", str(line.stock_count.company_id)) and not request.user.is_superuser:
        raise ValidationError("Dữ liệu kiểm kê không thuộc doanh nghiệp đang chọn.")
    return attrs


@transaction.atomic
def confirm_count(count, request):
    count = models.StockCount.objects.select_for_update().get(pk=count.pk)
    if count.status != "DRAFT" or not count.lines.exists():
        raise ValidationError("Chỉ biên bản nháp có dòng kiểm kê mới được xác nhận.")
    if count.lines.filter(actual_quantity__isnull=True).exists():
        raise ValidationError("Nhập đủ số lượng thực tế trước khi xác nhận.")
    count.status = "COUNTED" if count.lines.exclude(variance_quantity=0).exists() else "ADJUSTED"
    count.save(update_fields=("status",))
    services.audit(request, count, "COUNT", after={"status": count.status})
    return count


@transaction.atomic
def submit(resolution, request):
    line = models.StockCountLine.objects.select_for_update().get(pk=resolution.count_line_id)
    resolution = models.CountResolution.objects.select_for_update().get(pk=resolution.pk)
    if resolution.status not in {"DRAFT", "NEEDS_INFO"} or line.stock_count.status != "COUNTED":
        raise ValidationError("Phương án không ở trạng thái có thể gửi duyệt.")
    if resolution.method == "WAIT":
        raise ValidationError("Chưa xác định nguyên nhân nên chưa thể gửi phê duyệt.")
    if resolution.quantity > _remaining(line, resolution.pk):
        raise ValidationError("Số lượng đã được phân bổ cho phương án khác.")
    resolution.status = "PENDING"
    resolution.submitted_at = timezone.now()
    resolution.save(update_fields=("status", "submitted_at", "updated_at"))
    services.audit(request, resolution, "SUBMIT", after={"quantity": str(resolution.quantity)})
    return resolution


@transaction.atomic
def decide(resolution, request, decision, note=""):
    line = models.StockCountLine.objects.select_for_update().get(pk=resolution.count_line_id)
    resolution = models.CountResolution.objects.select_for_update().get(pk=resolution.pk)
    if resolution.status != "PENDING":
        raise ValidationError("Phương án không chờ phê duyệt.")
    if resolution.created_by_id == services.actor(request).pk:
        raise ValidationError("Người lập phương án không được tự phê duyệt.")
    if decision not in {"APPROVED", "REJECTED", "NEEDS_INFO"} or decision != "APPROVED" and not str(note).strip():
        raise ValidationError("Nhập lý do từ chối hoặc nội dung cần bổ sung.")
    if decision == "APPROVED" and resolution.quantity > _remaining(line, resolution.pk):
        raise ValidationError("Số lượng chênh lệch còn lại không đủ để phê duyệt.")
    resolution.status = decision
    resolution.decision_note = str(note).strip()
    resolution.approved_by = services.actor(request) if decision == "APPROVED" else None
    resolution.approved_at = timezone.now() if decision == "APPROVED" else None
    resolution.save(update_fields=("status", "decision_note", "approved_by", "approved_at", "updated_at"))
    services.audit(request, resolution, decision, after={"status": decision}, reason=note)
    return resolution


@transaction.atomic
def create_voucher(resolution, request):
    from general_ledger.models import Account

    line = models.StockCountLine.objects.select_for_update().select_related("stock_count", "item").get(pk=resolution.count_line_id)
    resolution = models.CountResolution.objects.select_for_update().get(pk=resolution.pk)
    if resolution.status != "APPROVED" or resolution.adjustment_transaction_id or line.stock_count.status != "COUNTED":
        raise ValidationError("Chỉ phương án đã duyệt, chưa lập chứng từ mới được điều chỉnh.")
    number = str(request.data.get("number", "")).strip()
    date = request.data.get("transaction_date")
    if not number or not date:
        raise ValidationError("Nhập số chứng từ và ngày hạch toán.")
    if models.InventoryTransaction.objects.filter(company=resolution.company, number=number).exists():
        raise ValidationError("Số chứng từ đã tồn tại.")
    try:
        from django.utils.dateparse import parse_date
        date = parse_date(date)
    except (TypeError, ValueError):
        date = None
    if not date or date < line.stock_count.count_date:
        raise ValidationError("Ngày hạch toán phải từ ngày kiểm kê trở đi.")
    debit = Account.objects.filter(pk=request.data.get("debit_account"), company=resolution.company, status="ACTIVE", is_postable=True).first()
    credit = Account.objects.filter(pk=request.data.get("credit_account"), company=resolution.company, status="ACTIVE", is_postable=True).first()
    if not debit or not credit or debit.pk == credit.pk:
        raise ValidationError("Chọn đầy đủ hai tài khoản hạch toán khác nhau.")
    inventory_account = debit if resolution.method == "INCREASE" else credit
    if not inventory_account.code.startswith("15"):
        raise ValidationError("Tài khoản hàng tồn kho phải là tài khoản 15x.")
    warehouse = line.stock_count.warehouse
    incoming = resolution.method == "INCREASE"
    obj = models.InventoryTransaction.objects.create(
        company=resolution.company, number=number, transaction_type="ADJUSTMENT_IN" if incoming else "ADJUSTMENT_OUT",
        transaction_date=date, document_date=date, source_warehouse=None if incoming else warehouse,
        destination_warehouse=warehouse if incoming else None, source_module="INV_COUNT_RESOLUTION",
        source_reference=str(resolution.pk), reason=resolution.explanation, status="DRAFT",
        created_by=services.actor(request), document_metadata={"stock_count": str(line.stock_count_id), "count_line": str(line.pk)},
    )
    quantity = resolution.quantity
    cost = resolution.proposed_unit_cost if incoming else Decimal("0")
    models.InventoryTransactionLine.objects.create(
        transaction=obj, line_no=1, item=line.item, uom=line.item.base_uom,
        location=line.location if not incoming else None, destination_location=line.location if incoming else None,
        lot_serial=line.lot_serial, quantity=quantity, base_quantity=quantity,
        unit_cost=cost, line_value=quantity * cost, debit_account=debit, credit_account=credit,
    )
    resolution.adjustment_transaction = obj
    resolution.save(update_fields=("adjustment_transaction", "updated_at"))
    services.audit(request, resolution, "CREATE_VOUCHER", after={"voucher": str(obj.pk)})
    return obj


def validate_post(obj):
    resolution = models.CountResolution.objects.select_for_update().select_related("count_line__stock_count").filter(adjustment_transaction=obj).first()
    if not resolution or resolution.status != "APPROVED" or resolution.count_line.stock_count.status != "COUNTED":
        raise ValidationError("Phương án kiểm kê không còn hiệu lực để ghi sổ.")
    if obj.lines.count() != 1 or obj.lines.first().base_quantity != resolution.quantity:
        raise ValidationError("Số lượng chứng từ không khớp phương án đã duyệt.")
    if resolution.quantity > _remaining(resolution.count_line, resolution.pk):
        raise ValidationError("Số lượng xử lý vượt chênh lệch còn lại.")
    return resolution


def finish_post(resolution, request):
    resolution.status = "COMPLETED"
    resolution.save(update_fields=("status", "updated_at"))
    count = resolution.count_line.stock_count
    lines = list(count.lines.exclude(variance_quantity=0))
    if lines and all((line.resolutions.filter(status="COMPLETED").aggregate(total=Sum("quantity"))["total"] or Decimal("0"))
                     == abs(line.variance_quantity) for line in lines):
        count.status = "ADJUSTED"
        count.save(update_fields=("status",))
    services.audit(request, resolution, "COMPLETE", after={"voucher": str(resolution.adjustment_transaction_id)})
