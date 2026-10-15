import logging
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from audit_log.services import record_audit
from general_ledger.models import Account, AccountingPeriod, JournalEntry, JournalLine
from general_ledger.services import post as post_journal
from inventory.models import InventoryTransaction, InventoryTransactionLine, TransactionStatus, TransactionType
from master_data.models import DocumentType
from sales import models

logger = logging.getLogger(__name__)


def actor_for(request):
    """Retrieve actor UserAccount from request."""
    if not request or not hasattr(request, "user") or not request.user.is_authenticated:
        return None
    return getattr(request.user, "iam_account", None) or getattr(request.user, "account", None)


def audit(request, cogs, action, before=None, after=None, reason=""):
    """Write an audit log entry for COGS operations (BR-SAL-10-13)."""
    actor = actor_for(request)
    if actor and hasattr(actor, "id"):
        record_audit(
            company=cogs.company,
            actor_user=actor,
            module_code="SAL",
            action_code=action,
            entity=cogs,
            before=before or {},
            after=after or {},
            request=request,
            reason=reason,
        )


def generate_cogs_number(company, branch=None, document_date=None):
    """Generate unique COGS voucher number (e.g., GV2026-00001)."""
    ref_date = document_date or timezone.localdate()
    try:
        from common_services.numbering_services import generate_document_number
        doc_type = DocumentType.objects.filter(code__in=["SAL.COGS", "GV", "COGS"]).first()
        if doc_type:
            num = generate_document_number(company, doc_type, branch=branch, document_date=ref_date)
            if num:
                return num
    except Exception:
        pass

    year = ref_date.year
    with transaction.atomic():
        counter, _ = models.CostOfGoodsSoldCounter.objects.select_for_update().get_or_create(
            company=company, year=year, defaults={"value": 0}
        )
        counter.value += 1
        counter.save()
        return f"GV{year}-{counter.value:05d}"


def get_eligible_outward_lines(company, branch=None, warehouse=None, costing_period=None, inventory_transaction_id=None):
    """
    Truy vấn các dòng phiếu xuất kho đủ điều kiện ghi nhận giá vốn (BR-SAL-10-02, BR-SAL-10-03, EF-02..04).
    Điều kiện:
    1. Phiếu xuất kho thuộc công ty, branch/warehouse (nếu chỉ định).
    2. Loại giao dịch là ISSUE (loại trừ TRANSFER, ADJUSTMENT, ASSEMBLY...).
    3. Trạng thái phiếu xuất kho là POSTED (có hiệu lực).
    4. Đã hoàn tất tính giá xuất kho: unit_cost > 0 và line_value > 0 (EF-02).
    5. Chưa ghi nhận giá vốn qua chứng từ bán hàng GoodsSale trực tiếp (BR-SAL-10-03).
    6. Chưa nằm trong chứng từ giá vốn khác đang xử lý hoặc đã ghi sổ (BR-SAL-10-05, EF-03).
    """
    qs = InventoryTransactionLine.objects.filter(
        transaction__company=company,
        transaction__transaction_type=TransactionType.ISSUE,
        transaction__status=TransactionStatus.POSTED,
    ).select_related(
        "transaction", "transaction__source_warehouse", "item", "uom", "location"
    )

    if branch:
        qs = qs.filter(transaction__branch=branch)
    if warehouse:
        qs = qs.filter(Q(transaction__source_warehouse=warehouse) | Q(transaction__source_warehouse__isnull=True))
    if inventory_transaction_id:
        qs = qs.filter(transaction_id=inventory_transaction_id)

    # Lấy IDs các dòng đã bị khóa bởi CostOfGoodsSold khác (không phải CANCELLED)
    locked_lines = models.CostOfGoodsSoldLine.objects.filter(
        cogs__company=company,
    ).exclude(
        cogs__status=models.DocumentStatus.CANCELLED
    ).values("inventory_transaction_line_id", "cogs__number", "cogs__status")

    locked_map = {item["inventory_transaction_line_id"]: item for item in locked_lines}

    # Lấy IDs các dòng đã được ghi nhận giá vốn qua GoodsSale trực tiếp (BR-SAL-10-03)
    goods_sale_cogs_line_ids = set(
        models.GoodsSaleLine.objects.filter(
            sale__company=company,
            sale__status=models.DocumentStatus.POSTED,
            cogs_amount__gt=0,
            inventory_transaction_line__isnull=False,
        ).values_list("inventory_transaction_line_id", flat=True)
    )

    results = []
    for line in qs:
        # Kiểm tra đã hoàn tất tính giá xuất kho (EF-02)
        has_costing = bool(line.unit_cost and line.unit_cost > Decimal("0") and line.line_value and line.line_value > Decimal("0"))

        # Kiểm tra ghi nhận qua GoodsSale
        recorded_in_goods_sale = line.id in goods_sale_cogs_line_ids

        # Kiểm tra nằm trong voucher COGS khác
        lock_info = locked_map.get(line.id)
        is_locked = bool(lock_info)

        # Mặc định lấy tài khoản giá vốn và tài khoản tồn kho từ Item
        item = line.item
        default_cogs_account = getattr(item, "cogs_account", None)
        default_inv_account = getattr(item, "inventory_account", None)

        # Trạng thái dòng nguồn
        if recorded_in_goods_sale or (lock_info and lock_info["cogs__status"] == models.DocumentStatus.POSTED):
            source_status = "RECORDED"
            eligibility_status = "ALREADY_RECORDED"
            eligibility_reason = f"Đã ghi nhận giá vốn tại {lock_info['cogs__number'] if lock_info else 'chứng từ bán hàng'}"
        elif lock_info and lock_info["cogs__status"] != models.DocumentStatus.POSTED:
            source_status = "PROCESSING"
            eligibility_status = "PROCESSING_IN_OTHER_VOUCHER"
            eligibility_reason = f"Đang được xử lý tại chứng từ giá vốn {lock_info['cogs__number']}"
        elif not has_costing:
            source_status = "UNRECORDED"
            eligibility_status = "WAITING_FOR_COSTING"
            eligibility_reason = "Chờ hoàn tất tính giá xuất kho (đơn giá bằng 0)"
        else:
            source_status = "UNRECORDED"
            eligibility_status = "ELIGIBLE"
            eligibility_reason = "Đủ điều kiện ghi nhận giá vốn"

        results.append({
            "line_id": str(line.id),
            "line_no": line.line_no,
            "transaction_id": str(line.transaction_id),
            "transaction_number": line.transaction.number,
            "transaction_date": str(line.transaction.transaction_date),
            "item_id": str(line.item_id),
            "item_code": line.item.code,
            "item_name": line.item.name,
            "item_type": getattr(line.item, "item_type", "GOODS"),
            "warehouse_id": str(line.transaction.source_warehouse_id) if line.transaction.source_warehouse_id else None,
            "warehouse_name": line.transaction.source_warehouse.name if line.transaction.source_warehouse else "",
            "uom_id": str(line.uom_id),
            "uom_name": line.uom.name,
            "quantity": str(line.quantity),
            "costing_method": getattr(line.transaction, "valuation_method", "MOVING_AVERAGE") or "MOVING_AVERAGE",
            "unit_cost": str(line.unit_cost or Decimal("0")),
            "cogs_amount": str(line.line_value or Decimal("0")),
            "cogs_account_id": str(default_cogs_account.id) if default_cogs_account else None,
            "cogs_account_code": default_cogs_account.code if default_cogs_account else "",
            "cogs_account_name": default_cogs_account.name if default_cogs_account else "",
            "inventory_account_id": str(default_inv_account.id) if default_inv_account else None,
            "inventory_account_code": default_inv_account.code if default_inv_account else "",
            "inventory_account_name": default_inv_account.name if default_inv_account else "",
            "costing_version": 1,
            "source_status": source_status,
            "eligibility_status": eligibility_status,
            "eligibility_reason": eligibility_reason,
            "is_eligible": (eligibility_status == "ELIGIBLE"),
        })

    return results


@transaction.atomic
def create_cogs_voucher(request, data):
    """
    Tạo chứng từ giá vốn hàng bán mới (Step 6, BR-SAL-10-04, BR-SAL-10-05, EF-03, EF-05).
    """
    company = data["company"]
    branch = data.get("branch")
    warehouse = data.get("warehouse")
    document_date = data.get("document_date") or timezone.localdate()
    posting_date = data.get("posting_date") or document_date
    costing_period = data.get("costing_period", "")
    description = data.get("description") or "Ghi nhận giá vốn hàng bán"
    inventory_transaction = data.get("inventory_transaction")
    goods_sale = data.get("goods_sale")
    currency = (
        data.get("currency")
        or getattr(company, "accounting_currency", None)
        or getattr(company, "legal_reporting_currency", None)
        or getattr(company, "base_currency", None)
    )
    if not currency:
        from master_data.models import Currency
        currency = Currency.objects.filter(code="VND").first() or Currency.objects.first()
    lines_data = data.get("lines", [])

    if not lines_data:
        raise ValidationError({"lines": "Chứng từ giá vốn phải có ít nhất một dòng hàng hóa."})

    # Kiểm tra tiền điều kiện các dòng được chọn
    cogs_lines_to_create = []
    total_cogs_amount = Decimal("0")

    for idx, item_data in enumerate(lines_data, start=1):
        inv_line = item_data.get("inventory_transaction_line")
        if isinstance(inv_line, str):
            inv_line = InventoryTransactionLine.objects.select_related("transaction", "item", "uom").get(pk=inv_line)

        # 1. Kiểm tra thuộc cùng công ty
        if inv_line.transaction.company_id != company.id:
            raise ValidationError({"lines": f"Dòng xuất kho {inv_line.id} không thuộc doanh nghiệp đang làm việc."})

        # 2. Kiểm tra phiếu xuất có hiệu lực và loại ISSUE (EF-04)
        if inv_line.transaction.transaction_type != TransactionType.ISSUE or inv_line.transaction.status != TransactionStatus.POSTED:
            raise ValidationError({"lines": f"Phiếu xuất kho {inv_line.transaction.number} không phải là phiếu xuất bán có hiệu lực."})

        # 3. Kiểm tra kết quả tính giá (EF-02, BR-SAL-10-04)
        if not inv_line.unit_cost or inv_line.unit_cost <= Decimal("0") or not inv_line.line_value or inv_line.line_value <= Decimal("0"):
            raise ValidationError({"lines": f"Dòng xuất kho {inv_line.item.code} chưa hoàn tất tính giá xuất kho (EF-02)."})

        # 4. Kiểm tra đã ghi nhận giá vốn qua GoodsSale chưa (BR-SAL-10-03)
        if models.GoodsSaleLine.objects.filter(
            sale__company=company,
            sale__status=models.DocumentStatus.POSTED,
            cogs_amount__gt=0,
            inventory_transaction_line=inv_line,
        ).exists():
            raise ValidationError({"lines": f"Dòng xuất kho {inv_line.item.code} đã được hạch toán giá vốn qua chứng từ bán hàng (BR-SAL-10-03)."})

        # 5. Kiểm tra trùng lặp với chứng từ COGS khác đang xử lý hoặc đã ghi sổ (BR-SAL-10-05, EF-03)
        existing_cogs_line = models.CostOfGoodsSoldLine.objects.filter(
            cogs__company=company,
            inventory_transaction_line=inv_line,
        ).exclude(cogs__status=models.DocumentStatus.CANCELLED).select_related("cogs").first()

        if existing_cogs_line:
            if existing_cogs_line.cogs.status == models.DocumentStatus.POSTED:
                raise ValidationError({"lines": f"Dòng xuất kho {inv_line.item.code} đã được ghi nhận giá vốn tại chứng từ {existing_cogs_line.cogs.number} (EF-03)."})
            else:
                raise ValidationError({"lines": f"Dòng xuất kho {inv_line.item.code} đang được xử lý tại chứng từ giá vốn {existing_cogs_line.cogs.number} (BR-SAL-10-05)."})

        # 6. Kiểm tra tài khoản giá vốn và tài khoản tồn kho (EF-05)
        cogs_account = item_data.get("cogs_account") or getattr(inv_line.item, "cogs_account", None)
        inventory_account = item_data.get("inventory_account") or getattr(inv_line.item, "inventory_account", None)

        if not cogs_account:
            raise ValidationError({"lines": f"Thiếu tài khoản giá vốn cho mặt hàng {inv_line.item.code} (EF-05)."})
        if not inventory_account:
            raise ValidationError({"lines": f"Thiếu tài khoản hàng tồn kho cho mặt hàng {inv_line.item.code} (EF-05)."})

        if not cogs_account.is_postable or cogs_account.status != "ACTIVE":
            raise ValidationError({"lines": f"Tài khoản giá vốn {cogs_account.code} không hoạt động hoặc không cho phép hạch toán (EF-05)."})
        if not inventory_account.is_postable or inventory_account.status != "ACTIVE":
            raise ValidationError({"lines": f"Tài khoản hàng tồn kho {inventory_account.code} không hoạt động hoặc không cho phép hạch toán (EF-05)."})

        line_qty = inv_line.quantity
        line_cost = inv_line.unit_cost
        line_val = inv_line.line_value
        total_cogs_amount += line_val

        line_warehouse = inv_line.transaction.source_warehouse or warehouse
        if not line_warehouse:
            raise ValidationError({"lines": f"Dòng xuất kho {inv_line.item.code} không xác định được kho xuất."})

        cogs_lines_to_create.append({
            "line_no": idx,
            "inventory_transaction_line": inv_line,
            "item": inv_line.item,
            "warehouse": line_warehouse,
            "uom": inv_line.uom,
            "quantity": line_qty,
            "costing_method": getattr(inv_line.transaction, "valuation_method", "MOVING_AVERAGE") or "MOVING_AVERAGE",
            "unit_cost": line_cost,
            "cogs_amount": line_val,
            "cogs_account": cogs_account,
            "inventory_account": inventory_account,
            "costing_version": 1,
            "source_status": models.CostOfGoodsSoldLine.SourceStatus.PROCESSING,
        })

    # Sinh mã chứng từ duy nhất
    number = generate_cogs_number(company, branch=branch, document_date=document_date)

    primary_warehouse = warehouse or (cogs_lines_to_create[0]["warehouse"] if cogs_lines_to_create else None)
    primary_trx = inventory_transaction or (cogs_lines_to_create[0]["inventory_transaction_line"].transaction if cogs_lines_to_create else None)

    cogs = models.CostOfGoodsSold.objects.create(
        company=company,
        branch=branch,
        warehouse=primary_warehouse,
        number=number,
        document_date=document_date,
        posting_date=posting_date,
        costing_period=costing_period,
        inventory_transaction=primary_trx,
        goods_sale=goods_sale,
        currency=currency,
        exchange_rate=Decimal("1.0"),
        description=description,
        total_cogs_amount=total_cogs_amount,
        status=models.DocumentStatus.DRAFT,
        created_by=actor_for(request),
        attachments=data.get("attachments", []),
    )

    for l_data in cogs_lines_to_create:
        models.CostOfGoodsSoldLine.objects.create(
            cogs=cogs,
            **l_data,
        )

    audit(request, cogs, "CREATE", after={"status": cogs.status, "number": cogs.number, "total_cogs": str(cogs.total_cogs_amount)})
    return cogs


@transaction.atomic
def update_cogs_voucher(request, cogs, data):
    """
    Cập nhật chứng từ giá vốn hàng bán (AF-04, BR-SAL-10-12, EF-08, EF-09).
    """
    cogs = models.CostOfGoodsSold.objects.select_for_update().get(pk=cogs.pk)

    # 1. Kiểm tra trạng thái cho phép sửa (BR-SAL-10-12)
    if cogs.status in [models.DocumentStatus.POSTED, models.DocumentStatus.CANCELLED]:
        raise ValidationError(f"Không thể sửa chứng từ ở trạng thái {cogs.status} (EF-09).")
    if cogs.status == models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Chứng từ đang Chờ duyệt. Vui lòng thu hồi trước khi chỉnh sửa (AF-04, BR-SAL-10-12).")

    # 2. Concurrency check (EF-08)
    expected_version = data.get("version")
    if expected_version is not None and expected_version != cogs.version:
        raise ValidationError("Chứng từ vừa được người khác cập nhật. Vui lòng tải lại trang (EF-08).")

    before_snapshot = {"status": cogs.status, "total_cogs": str(cogs.total_cogs_amount)}

    # Cập nhật thông tin chung
    if "posting_date" in data:
        cogs.posting_date = data["posting_date"]
    if "document_date" in data:
        cogs.document_date = data["document_date"]
    if "costing_period" in data:
        cogs.costing_period = data["costing_period"]
    if "description" in data:
        cogs.description = data["description"]
    if "attachments" in data:
        cogs.attachments = data["attachments"]

    # Cập nhật chi tiết dòng nếu có truyền
    if "lines" in data:
        lines_data = data["lines"]
        if not lines_data:
            raise ValidationError({"lines": "Chứng từ giá vốn phải có ít nhất một dòng hàng hóa."})

        # Xóa các dòng cũ và tạo dòng mới (giải phóng dòng cũ về UNRECORDED)
        cogs.lines.all().delete()

        total_cogs_amount = Decimal("0")
        for idx, item_data in enumerate(lines_data, start=1):
            inv_line = item_data.get("inventory_transaction_line")
            if isinstance(inv_line, str):
                inv_line = InventoryTransactionLine.objects.select_related("transaction", "item", "uom").get(pk=inv_line)

            # Kiểm tra trùng lặp với chứng từ khác
            conflict = models.CostOfGoodsSoldLine.objects.filter(
                cogs__company=cogs.company,
                inventory_transaction_line=inv_line,
            ).exclude(cogs_id=cogs.id).exclude(cogs__status=models.DocumentStatus.CANCELLED).select_related("cogs").first()

            if conflict:
                raise ValidationError({"lines": f"Dòng xuất kho {inv_line.item.code} đang nằm trong chứng từ {conflict.cogs.number} (EF-03)."})

            cogs_account = item_data.get("cogs_account") or getattr(inv_line.item, "cogs_account", None)
            inventory_account = item_data.get("inventory_account") or getattr(inv_line.item, "inventory_account", None)

            if not cogs_account or not inventory_account:
                raise ValidationError({"lines": f"Thiếu tài khoản giá vốn hoặc hàng tồn kho cho mặt hàng {inv_line.item.code} (EF-05)."})

            line_warehouse = inv_line.transaction.source_warehouse or cogs.warehouse
            models.CostOfGoodsSoldLine.objects.create(
                cogs=cogs,
                line_no=idx,
                inventory_transaction_line=inv_line,
                item=inv_line.item,
                warehouse=line_warehouse,
                uom=inv_line.uom,
                quantity=inv_line.quantity,
                costing_method=getattr(inv_line.transaction, "valuation_method", "MOVING_AVERAGE") or "MOVING_AVERAGE",
                unit_cost=inv_line.unit_cost,
                cogs_amount=inv_line.line_value,
                cogs_account=cogs_account,
                inventory_account=inventory_account,
                costing_version=1,
                source_status=models.CostOfGoodsSoldLine.SourceStatus.PROCESSING,
            )
            total_cogs_amount += inv_line.line_value

        cogs.total_cogs_amount = total_cogs_amount

    cogs.version += 1
    cogs.save()

    audit(request, cogs, "UPDATE", before=before_snapshot, after={"status": cogs.status, "total_cogs": str(cogs.total_cogs_amount)})
    return cogs


@transaction.atomic
def delete_cogs_voucher(request, cogs):
    """
    Xóa chứng từ giá vốn ở trạng thái Nháp (AF-06, BR-SAL-10-12).
    Giải phóng toàn bộ dòng nguồn về UNRECORDED.
    """
    cogs = models.CostOfGoodsSold.objects.select_for_update().get(pk=cogs.pk)
    if cogs.status != models.DocumentStatus.DRAFT:
        raise ValidationError(f"Chỉ cho phép xóa chứng từ ở trạng thái Nháp (BR-SAL-10-12). Hiện tại: {cogs.status}")

    audit(request, cogs, "DELETE", before={"number": cogs.number, "total_cogs": str(cogs.total_cogs_amount)})
    cogs.lines.all().delete()
    cogs.delete()
    return True


@transaction.atomic
def cancel_cogs_voucher(request, cogs, reason=""):
    """
    Hủy chứng từ giá vốn chưa ghi sổ (AF-06, BR-SAL-10-12, EF-09).
    Giải phóng toàn bộ dòng nguồn về UNRECORDED.
    """
    cogs = models.CostOfGoodsSold.objects.select_for_update().get(pk=cogs.pk)
    if cogs.status == models.DocumentStatus.POSTED:
        raise ValidationError("Không thể hủy trực tiếp chứng từ Đã ghi sổ. Vui lòng xử lý qua quy trình điều chỉnh (EF-09).")
    if cogs.status == models.DocumentStatus.CANCELLED:
        raise ValidationError("Chứng từ đã bị hủy trước đó.")

    before_status = cogs.status
    cogs.status = models.DocumentStatus.CANCELLED
    cogs.cancellation_reason = reason
    cogs.version += 1
    cogs.save()

    # Cập nhật trạng thái dòng nguồn về UNRECORDED
    cogs.lines.update(source_status=models.CostOfGoodsSoldLine.SourceStatus.UNRECORDED)

    audit(request, cogs, "CANCEL", before={"status": before_status}, after={"status": cogs.status, "reason": reason}, reason=reason)
    return cogs


@transaction.atomic
def submit_cogs_voucher(request, cogs):
    """Gửi duyệt chứng từ giá vốn (Step 7, BR-SAL-10-06)."""
    cogs = models.CostOfGoodsSold.objects.select_for_update().get(pk=cogs.pk)
    if cogs.status not in [models.DocumentStatus.DRAFT, models.DocumentStatus.REVISION_REQUIRED, models.DocumentStatus.REJECTED]:
        raise ValidationError(f"Không thể gửi duyệt chứng từ ở trạng thái {cogs.status}.")

    cogs.status = models.DocumentStatus.PENDING_APPROVAL
    cogs.submitted_at = timezone.now()
    cogs.version += 1
    cogs.save()

    models.ApprovalDecision.objects.create(
        company=cogs.company,
        document_type="COGS",
        document_id=cogs.id,
        document_version=cogs.version,
        decision="SUBMITTED",
        actor=actor_for(request),
        comment="Gửi duyệt chứng từ giá vốn",
    )

    audit(request, cogs, "SUBMIT", after={"status": cogs.status})
    return cogs


@transaction.atomic
def withdraw_cogs_voucher(request, cogs, reason=""):
    """Thu hồi chứng từ giá vốn đang Chờ duyệt về Nháp (AF-04, BR-SAL-10-12)."""
    cogs = models.CostOfGoodsSold.objects.select_for_update().get(pk=cogs.pk)
    if cogs.status != models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Chỉ có thể thu hồi chứng từ đang ở trạng thái Chờ duyệt.")

    cogs.status = models.DocumentStatus.DRAFT
    cogs.withdrawal_reason = reason
    cogs.version += 1
    cogs.save()

    models.ApprovalDecision.objects.create(
        company=cogs.company,
        document_type="COGS",
        document_id=cogs.id,
        document_version=cogs.version,
        decision="WITHDRAWN",
        actor=actor_for(request),
        comment=reason or "Thu hồi chứng từ",
    )

    audit(request, cogs, "WITHDRAW", after={"status": cogs.status, "reason": reason}, reason=reason)
    return cogs


@transaction.atomic
def approve_cogs_voucher(request, cogs, comment=""):
    """Phê duyệt chứng từ giá vốn (AF-05, BR-SAL-10-06)."""
    cogs = models.CostOfGoodsSold.objects.select_for_update().get(pk=cogs.pk)
    if cogs.status != models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Chỉ có thể phê duyệt chứng từ đang ở trạng thái Chờ duyệt.")

    cogs.status = models.DocumentStatus.APPROVED
    cogs.approved_at = timezone.now()
    cogs.version += 1
    cogs.save()

    models.ApprovalDecision.objects.create(
        company=cogs.company,
        document_type="COGS",
        document_id=cogs.id,
        document_version=cogs.version,
        decision="APPROVED",
        actor=actor_for(request),
        comment=comment or "Phê duyệt chứng từ giá vốn",
    )

    audit(request, cogs, "APPROVE", after={"status": cogs.status, "comment": comment})
    return cogs


@transaction.atomic
def request_revision_cogs_voucher(request, cogs, comment):
    """Yêu cầu chỉnh sửa chứng từ giá vốn (AF-05, BR-SAL-10-06)."""
    if not comment or not comment.strip():
        raise ValidationError("Vui lòng nhập nội dung yêu cầu chỉnh sửa.")

    cogs = models.CostOfGoodsSold.objects.select_for_update().get(pk=cogs.pk)
    if cogs.status != models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Chỉ có thể yêu cầu chỉnh sửa chứng từ đang ở trạng thái Chờ duyệt.")

    cogs.status = models.DocumentStatus.REVISION_REQUIRED
    cogs.rejection_reason = comment.strip()
    cogs.version += 1
    cogs.save()

    models.ApprovalDecision.objects.create(
        company=cogs.company,
        document_type="COGS",
        document_id=cogs.id,
        document_version=cogs.version,
        decision="REVISION_REQUIRED",
        actor=actor_for(request),
        comment=comment.strip(),
    )

    audit(request, cogs, "REQUEST_REVISION", after={"status": cogs.status, "comment": comment})
    return cogs


@transaction.atomic
def reject_cogs_voucher(request, cogs, comment):
    """Từ chối phê duyệt chứng từ giá vốn (AF-05, BR-SAL-10-06)."""
    if not comment or not comment.strip():
        raise ValidationError("Vui lòng nhập lý do từ chối.")

    cogs = models.CostOfGoodsSold.objects.select_for_update().get(pk=cogs.pk)
    if cogs.status != models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Chỉ có thể từ chối chứng từ đang ở trạng thái Chờ duyệt.")

    cogs.status = models.DocumentStatus.REJECTED
    cogs.rejection_reason = comment.strip()
    cogs.version += 1
    cogs.save()

    models.ApprovalDecision.objects.create(
        company=cogs.company,
        document_type="COGS",
        document_id=cogs.id,
        document_version=cogs.version,
        decision="REJECTED",
        actor=actor_for(request),
        comment=comment.strip(),
    )

    audit(request, cogs, "REJECT", after={"status": cogs.status, "comment": comment})
    return cogs


@transaction.atomic
def post_cogs_voucher(request, cogs):
    """
    Ghi sổ chứng từ giá vốn hàng bán (Step 8-9, BR-SAL-10-06..10, BR-SAL-10-13, EF-05..07, EF-10).
    Tạo bút toán General Ledger: Nợ 632 / Có 156.
    Cập nhật nguồn Đã ghi nhận giá vốn (RECORDED).
    """
    cogs = models.CostOfGoodsSold.objects.select_for_update().get(pk=cogs.pk)

    # 1. Kiểm tra trạng thái được phép ghi sổ (BR-SAL-10-06)
    if cogs.status == models.DocumentStatus.POSTED:
        raise ValidationError("Chứng từ này đã được ghi sổ trước đó.")
    if cogs.status not in [models.DocumentStatus.APPROVED, models.DocumentStatus.DRAFT]:
        raise ValidationError(f"Chứng từ ở trạng thái {cogs.status} không được phép ghi sổ. Cần phê duyệt hoặc hoàn tất nháp (BR-SAL-10-06).")

    lines = list(cogs.lines.select_related("inventory_transaction_line", "item", "warehouse", "cogs_account", "inventory_account").all())
    if not lines:
        raise ValidationError("Chứng từ giá vốn không có dòng chi tiết để ghi sổ.")

    # 2. Kiểm tra phiên bản tính giá mới nhất (BR-SAL-10-07, EF-07)
    for line in lines:
        inv_line = line.inventory_transaction_line
        inv_line.refresh_from_db()
        if inv_line.unit_cost != line.unit_cost or inv_line.line_value != line.cogs_amount:
            raise ValidationError(
                f"Kết quả tính giá xuất kho của mặt hàng {line.item.code} đã thay đổi (giá cũ: {line.unit_cost}, giá mới: {inv_line.unit_cost}). "
                "Vui lòng cập nhật lại chứng từ giá vốn trước khi ghi sổ (EF-07)."
            )

    # 3. Kiểm tra kỳ kế toán đang mở (BR-SAL-10-08, EF-06)
    period = AccountingPeriod.objects.filter(
        company=cogs.company,
        start_date__lte=cogs.posting_date,
        end_date__gte=cogs.posting_date,
        status="OPEN",
    ).first()
    if not period:
        raise ValidationError("Kỳ kế toán chứa ngày hạch toán đã bị khóa hoặc chưa được mở (EF-06).")

    # 4. Kiểm tra tài khoản hợp lệ (BR-SAL-10-08, EF-05)
    for line in lines:
        if not line.cogs_account or not line.cogs_account.is_postable or line.cogs_account.status != "ACTIVE":
            raise ValidationError(f"Tài khoản giá vốn {line.cogs_account.code if line.cogs_account else ''} không cho phép hạch toán (EF-05).")
        if not line.inventory_account or not line.inventory_account.is_postable or line.inventory_account.status != "ACTIVE":
            raise ValidationError(f"Tài khoản hàng tồn kho {line.inventory_account.code if line.inventory_account else ''} không cho phép hạch toán (EF-05).")

    # 5. Tạo JournalEntry (BR-SAL-10-09, BR-SAL-10-10)
    total_debit = cogs.total_cogs_amount
    total_credit = cogs.total_cogs_amount

    journal = JournalEntry.objects.create(
        company=cogs.company,
        branch=cogs.branch,
        period=period,
        number=f"{cogs.number}-GL",
        entry_type="SUBLEDGER",
        posting_date=cogs.posting_date,
        document_date=cogs.document_date,
        description=cogs.description or f"Giá vốn hàng bán {cogs.number}",
        source_module="SAL",
        source_event_id=f"SAL.COGS:{cogs.pk}:{cogs.version}",
        source_entity_type="CostOfGoodsSold",
        source_entity_id=cogs.pk,
        status="APPROVED",
        total_debit=total_debit,
        total_credit=total_credit,
        workflow_snapshot={"allow_creator_posting": True},
        created_by=actor_for(request),
        approved_by=actor_for(request),
        approved_at=timezone.now(),
    )

    gl_line_no = 0
    for line in lines:
        # Nợ TK Giá vốn (632)
        gl_line_no += 1
        JournalLine.objects.create(
            entry=journal,
            line_no=gl_line_no,
            account=line.cogs_account,
            description=f"Giá vốn {line.item.code} - {cogs.number}",
            debit=line.cogs_amount,
            credit=Decimal("0"),
            currency=cogs.currency,
            warehouse=line.warehouse,
        )

        # Có TK Hàng tồn kho (156)
        gl_line_no += 1
        JournalLine.objects.create(
            entry=journal,
            line_no=gl_line_no,
            account=line.inventory_account,
            description=f"Xuất kho {line.item.code} - {cogs.number}",
            debit=Decimal("0"),
            credit=line.cogs_amount,
            currency=cogs.currency,
            warehouse=line.warehouse,
        )

    # Post journal entry into GL
    post_journal(journal, request)

    # 6. Cập nhật trạng thái chứng từ COGS và dòng nguồn
    cogs.journal_entry = journal
    cogs.status = models.DocumentStatus.POSTED
    cogs.posted_at = timezone.now()
    cogs.posted_by = actor_for(request)
    cogs.version += 1
    cogs.save()

    # Đánh dấu nguồn đã ghi nhận giá vốn (RECORDED)
    cogs.lines.update(source_status=models.CostOfGoodsSoldLine.SourceStatus.RECORDED)

    audit(request, cogs, "POST", after={"status": cogs.status, "journal_id": str(journal.id)})
    return cogs


def check_cogs_differences(cogs):
    """
    So sánh giá trị đã ghi nhận với kết quả tính giá xuất kho hiện tại (AF-07, BR-SAL-10-11).
    Phục vụ quy trình xử lý chênh lệch giá vốn sau khi tính lại giá xuất kho.
    """
    differences = []
    total_difference = Decimal("0")

    for line in cogs.lines.select_related("inventory_transaction_line", "item", "warehouse"):
        inv_line = line.inventory_transaction_line
        current_unit_cost = inv_line.unit_cost or Decimal("0")
        current_line_value = inv_line.line_value or Decimal("0")

        recorded_unit_cost = line.unit_cost
        recorded_cogs_amount = line.cogs_amount

        diff_amount = current_line_value - recorded_cogs_amount
        total_difference += diff_amount

        differences.append({
            "line_id": str(line.id),
            "item_code": line.item.code,
            "item_name": line.item.name,
            "warehouse_name": line.warehouse.name if line.warehouse else "",
            "quantity": str(line.quantity),
            "recorded_unit_cost": str(recorded_unit_cost),
            "recorded_cogs_amount": str(recorded_cogs_amount),
            "current_unit_cost": str(current_unit_cost),
            "current_line_value": str(current_line_value),
            "difference_amount": str(diff_amount),
            "has_difference": (diff_amount != Decimal("0")),
        })

    return {
        "cogs_id": str(cogs.id),
        "cogs_number": cogs.number,
        "is_posted": (cogs.status == models.DocumentStatus.POSTED),
        "total_recorded_amount": str(cogs.total_cogs_amount),
        "total_difference": str(total_difference),
        "has_difference": (total_difference != Decimal("0")),
        "differences": differences,
    }
