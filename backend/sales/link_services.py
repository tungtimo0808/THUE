import logging
from decimal import Decimal
from typing import Any, Dict, List, Optional

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from audit_log.services import record_audit
from inventory.models import InventoryTransaction, InventoryTransactionLine
from organization.models import Company
from sales import models

logger = logging.getLogger(__name__)

DOC_CONFIG = {
    "QUOTATION": {
        "model": models.SalesQuotation,
        "line_model": models.SalesQuotationLine,
        "line_fk": "quotation",
        "has_customer": True,
        "has_currency": True,
        "qty_field": "quantity",
        "amount_field": "subtotal",
    },
    "ORDER": {
        "model": models.SalesOrder,
        "line_model": models.SalesOrderLine,
        "line_fk": "order",
        "has_customer": True,
        "has_currency": True,
        "qty_field": "quantity",
        "amount_field": "line_total",
    },
    "CONTRACT": {
        "model": models.SalesContract,
        "line_model": models.SalesContractLine,
        "line_fk": "contract",
        "has_customer": True,
        "has_currency": True,
        "qty_field": "quantity",
        "amount_field": "line_total",
    },
    "DELIVERY": {
        "model": models.SalesDelivery,
        "line_model": models.SalesDeliveryLine,
        "line_fk": "delivery",
        "has_customer": True,
        "has_currency": True,
        "qty_field": "quantity",
        "amount_field": "accepted_value",
    },
    "GOODS_SALE": {
        "model": models.GoodsSale,
        "line_model": models.GoodsSaleLine,
        "line_fk": "sale",
        "has_customer": True,
        "has_currency": True,
        "qty_field": "quantity",
        "amount_field": "line_total",
    },
    "SERVICE_SALE": {
        "model": models.ServiceSale,
        "line_model": models.ServiceSaleLine,
        "line_fk": "sale",
        "has_customer": True,
        "has_currency": True,
        "qty_field": "quantity",
        "amount_field": "line_total",
    },
    "SALES_RETURN": {
        "model": models.SalesReturn,
        "line_model": models.SalesReturnLine,
        "line_fk": "sale_return",
        "has_customer": True,
        "has_currency": True,
        "qty_field": "return_quantity",
        "amount_field": "line_total",
    },
    "SALES_ALLOWANCE": {
        "model": models.SalesAllowance,
        "line_model": models.SalesAllowanceLine,
        "line_fk": "allowance",
        "has_customer": True,
        "has_currency": True,
        "qty_field": None,
        "amount_field": "allowance_amount",
    },
    "SALES_INVOICE": {
        "model": models.SalesInvoice,
        "line_model": models.SalesInvoiceLine,
        "line_fk": "invoice",
        "has_customer": True,
        "has_currency": True,
        "qty_field": "quantity",
        "amount_field": "amount",
    },
    "COGS": {
        "model": models.CostOfGoodsSold,
        "line_model": models.CostOfGoodsSoldLine,
        "line_fk": "cogs",
        "has_customer": True,
        "has_currency": True,
        "qty_field": "quantity",
        "amount_field": "cogs_amount",
    },
    "DISCOUNT_INVOICE": {
        "model": models.SalesDiscountInvoice,
        "line_model": models.SalesDiscountInvoiceLine,
        "line_fk": "invoice",
        "has_customer": True,
        "has_currency": True,
        "qty_field": None,
        "amount_field": "line_total",
    },
    "COMMERCIAL_INVOICE": {
        "model": models.SalesCommercialInvoice,
        "line_model": models.SalesCommercialInvoiceLine,
        "line_fk": "invoice",
        "has_customer": True,
        "has_currency": True,
        "qty_field": "quantity",
        "amount_field": "line_total",
    },
    "INVENTORY_TRANSACTION": {
        "model": InventoryTransaction,
        "line_model": InventoryTransactionLine,
        "line_fk": "transaction",
        "has_customer": False,
        "has_currency": False,
        "qty_field": "quantity",
        "amount_field": "line_value",
    },
}

SUPPORTED_PAIRS = {
    "DATA_INHERITANCE": {
        ("QUOTATION", "ORDER"),
        ("ORDER", "GOODS_SALE"),
        ("ORDER", "SERVICE_SALE"),
        ("ORDER", "SALES_INVOICE"),
        ("ORDER", "COMMERCIAL_INVOICE"),
        ("CONTRACT", "ORDER"),
        ("CONTRACT", "GOODS_SALE"),
        ("CONTRACT", "SERVICE_SALE"),
        ("CONTRACT", "SALES_INVOICE"),
        ("CONTRACT", "COMMERCIAL_INVOICE"),
        ("GOODS_SALE", "COMMERCIAL_INVOICE"),
        ("SERVICE_SALE", "COMMERCIAL_INVOICE"),
        ("INVENTORY_TRANSACTION", "COGS"),
    },
    "FULFILLMENT": {
        ("ORDER", "DELIVERY"),
        ("ORDER", "GOODS_SALE"),
        ("ORDER", "SERVICE_SALE"),
        ("DELIVERY", "GOODS_SALE"),
        ("INVENTORY_TRANSACTION", "GOODS_SALE"),
        ("INVENTORY_TRANSACTION", "DELIVERY"),
    },
    "INVOICING": {
        ("ORDER", "SALES_INVOICE"),
        ("DELIVERY", "SALES_INVOICE"),
        ("GOODS_SALE", "SALES_INVOICE"),
        ("SERVICE_SALE", "SALES_INVOICE"),
        ("CONTRACT", "SALES_INVOICE"),
        ("ORDER", "COMMERCIAL_INVOICE"),
        ("CONTRACT", "COMMERCIAL_INVOICE"),
        ("GOODS_SALE", "COMMERCIAL_INVOICE"),
        ("SERVICE_SALE", "COMMERCIAL_INVOICE"),
        ("COMMERCIAL_INVOICE", "SALES_INVOICE"),
    },
    "RETURN": {
        ("GOODS_SALE", "SALES_RETURN"),
        ("INVENTORY_TRANSACTION", "SALES_RETURN"),
    },
    "ALLOWANCE": {
        ("GOODS_SALE", "SALES_ALLOWANCE"),
        ("SERVICE_SALE", "SALES_ALLOWANCE"),
    },
}

INVALID_DOC_STATUSES = {
    models.DocumentStatus.CANCELLED,
    models.DocumentStatus.TERMINATED,
    models.DocumentStatus.REJECTED,
    models.DocumentStatus.EXPIRED,
    "CANCELLED",
    "TERMINATED",
    "REJECTED",
    "EXPIRED",
}


def actor_for(request):
    """Retrieve actor UserAccount from request."""
    if not request or not hasattr(request, "user") or not request.user.is_authenticated:
        return None
    return getattr(request.user, "iam_account", None) or getattr(request.user, "account", None)


def audit(request, link, action, before=None, after=None, reason=""):
    """Write an audit log entry for sales link operations."""
    actor = actor_for(request)
    if actor and hasattr(actor, "id"):
        record_audit(
            company=link.company,
            actor_user=actor,
            module_code="SAL",
            action_code=action,
            entity=link,
            before=before or {},
            after=after or {},
            request=request,
            reason=reason,
        )


def generate_link_number(company, document_date=None) -> str:
    """Generate unique link number (LNK-YYYY-NNNNN)."""
    ref_date = document_date or timezone.localdate()
    year = ref_date.year
    with transaction.atomic():
        counter, _ = models.SalesDocumentLinkCounter.objects.select_for_update().get_or_create(
            company=company, year=year, defaults={"value": 0}
        )
        counter.value += 1
        counter.save(update_fields=["value"])
        return f"LNK-{year}-{counter.value:05d}"


def get_document_info(doc_type: str, doc_id: Any, company: Optional[Company] = None) -> Dict[str, Any]:
    """Resolve document instance and common metadata."""
    cfg = DOC_CONFIG.get(doc_type)
    if not cfg:
        raise ValidationError(f"Loại chứng từ '{doc_type}' không được hỗ trợ.")

    qs = cfg["model"].objects.all()
    if company:
        qs = qs.filter(company=company)
    doc = qs.filter(pk=doc_id).first()
    if not doc:
        raise ValidationError(f"Không tìm thấy chứng từ {doc_type} với mã '{doc_id}'.")

    customer = None
    if doc_type == "DELIVERY":
        customer = getattr(getattr(doc, "order", None), "customer", None)
    elif hasattr(doc, "customer"):
        customer = doc.customer
    elif hasattr(doc, "supplier"):
        customer = doc.supplier

    currency = None
    if doc_type == "DELIVERY":
        currency = getattr(getattr(doc, "order", None), "currency", None)
    elif hasattr(doc, "currency"):
        currency = doc.currency

    number = getattr(doc, "number", str(doc.id))
    status = getattr(doc, "status", None)
    version = getattr(doc, "version", 1)

    return {
        "instance": doc,
        "doc_type": doc_type,
        "id": doc.id,
        "number": number,
        "company": doc.company,
        "customer": customer,
        "currency": currency,
        "status": status,
        "version": version,
    }


def get_document_line_info(doc_type: str, line_id: Any) -> Optional[Dict[str, Any]]:
    """Resolve line instance and common item/qty metadata."""
    cfg = DOC_CONFIG.get(doc_type)
    if not cfg:
        return None

    line = cfg["line_model"].objects.filter(pk=line_id).first()
    if not line:
        return None

    item = None
    if doc_type == "DELIVERY":
        item = getattr(getattr(line, "order_line", None), "item", None)
    elif hasattr(line, "item"):
        item = line.item

    uom = None
    if doc_type == "DELIVERY":
        uom = getattr(getattr(line, "order_line", None), "uom", None)
    elif hasattr(line, "uom"):
        uom = line.uom

    qty_field = cfg.get("qty_field")
    qty = getattr(line, qty_field, Decimal(0)) if qty_field else Decimal(0)

    amt_field = cfg.get("amount_field")
    amt = getattr(line, amt_field, Decimal(0)) if amt_field else Decimal(0)

    return {
        "instance": line,
        "id": line.id,
        "line_no": getattr(line, "line_no", 1),
        "item": item,
        "uom": uom,
        "quantity": Decimal(str(qty or 0)),
        "amount": Decimal(str(amt or 0)),
    }


def get_matchable_lines(
    company: Company,
    source_type: str,
    source_id: Any,
    target_type: str,
    target_id: Any,
    relation_type: str,
) -> Dict[str, Any]:
    """
    Get lines from source and target with remaining matchable capacities (Activity Flow step 5).
    """
    source_info = get_document_info(source_type, source_id, company=company)
    target_info = get_document_info(target_type, target_id, company=company)

    source_cfg = DOC_CONFIG[source_type]
    target_cfg = DOC_CONFIG[target_type]

    source_lines_qs = source_cfg["line_model"].objects.filter(
        **{f"{source_cfg['line_fk']}_id": source_info["id"]}
    ).order_by("line_no" if hasattr(source_cfg["line_model"], "line_no") else "id")

    target_lines_qs = target_cfg["line_model"].objects.filter(
        **{f"{target_cfg['line_fk']}_id": target_info["id"]}
    ).order_by("line_no" if hasattr(target_cfg["line_model"], "line_no") else "id")

    source_lines_data = []
    for s_line in source_lines_qs:
        info = get_document_line_info(source_type, s_line.id)
        if not info:
            continue
        # Active linked quantities/amounts
        alloc_qty = models.SalesDocumentLinkLine.objects.filter(
            link__status=models.LinkStatus.ACTIVE,
            link__relation_type=relation_type,
            source_line_id=s_line.id,
        ).aggregate(total=Sum("linked_quantity"))["total"] or Decimal(0)

        alloc_amt = models.SalesDocumentLinkLine.objects.filter(
            link__status=models.LinkStatus.ACTIVE,
            link__relation_type=relation_type,
            source_line_id=s_line.id,
        ).aggregate(total=Sum("linked_amount"))["total"] or Decimal(0)

        rem_qty = max(Decimal(0), info["quantity"] - Decimal(str(alloc_qty)))
        rem_amt = max(Decimal(0), info["amount"] - Decimal(str(alloc_amt)))

        source_lines_data.append({
            "line_id": str(s_line.id),
            "line_no": info["line_no"],
            "item_id": str(info["item"].id) if info["item"] else None,
            "item_code": getattr(info["item"], "code", ""),
            "item_name": getattr(info["item"], "name", ""),
            "uom_id": str(info["uom"].id) if info["uom"] else None,
            "uom_name": getattr(info["uom"], "name", ""),
            "quantity": info["quantity"],
            "allocated_quantity": Decimal(str(alloc_qty)),
            "remaining_quantity": rem_qty,
            "amount": info["amount"],
            "allocated_amount": Decimal(str(alloc_amt)),
            "remaining_amount": rem_amt,
        })

    target_lines_data = []
    for t_line in target_lines_qs:
        info = get_document_line_info(target_type, t_line.id)
        if not info:
            continue
        alloc_qty = models.SalesDocumentLinkLine.objects.filter(
            link__status=models.LinkStatus.ACTIVE,
            link__relation_type=relation_type,
            target_line_id=t_line.id,
        ).aggregate(total=Sum("linked_quantity"))["total"] or Decimal(0)

        alloc_amt = models.SalesDocumentLinkLine.objects.filter(
            link__status=models.LinkStatus.ACTIVE,
            link__relation_type=relation_type,
            target_line_id=t_line.id,
        ).aggregate(total=Sum("linked_amount"))["total"] or Decimal(0)

        rem_qty = max(Decimal(0), info["quantity"] - Decimal(str(alloc_qty)))
        rem_amt = max(Decimal(0), info["amount"] - Decimal(str(alloc_amt)))

        target_lines_data.append({
            "line_id": str(t_line.id),
            "line_no": info["line_no"],
            "item_id": str(info["item"].id) if info["item"] else None,
            "item_code": getattr(info["item"], "code", ""),
            "item_name": getattr(info["item"], "name", ""),
            "uom_id": str(info["uom"].id) if info["uom"] else None,
            "uom_name": getattr(info["uom"], "name", ""),
            "quantity": info["quantity"],
            "allocated_quantity": Decimal(str(alloc_qty)),
            "remaining_quantity": rem_qty,
            "amount": info["amount"],
            "allocated_amount": Decimal(str(alloc_amt)),
            "remaining_amount": rem_amt,
        })

    return {
        "source": {
            "document_type": source_type,
            "document_id": str(source_info["id"]),
            "document_number": source_info["number"],
            "lines": source_lines_data,
        },
        "target": {
            "document_type": target_type,
            "document_id": str(target_info["id"]),
            "document_number": target_info["number"],
            "lines": target_lines_data,
        },
    }


def validate_relation_and_documents(
    source_info: Dict[str, Any],
    target_info: Dict[str, Any],
    relation_type: str,
):
    """Validate document pairing, company, customer, currency, and statuses."""
    # BR-SAL-11-08: Cannot link doc to itself
    if source_info["id"] == target_info["id"] and source_info["doc_type"] == target_info["doc_type"]:
        raise ValidationError("Không thể liên kết chứng từ với chính nó.")

    # Same company
    if source_info["company"].id != target_info["company"].id:
        raise ValidationError("Hai chứng từ không thuộc cùng một doanh nghiệp.")

    # EF-07: Inactive / cancelled documents
    if source_info["status"] in INVALID_DOC_STATUSES:
        raise ValidationError(
            f"Chứng từ nguồn đang ở trạng thái {source_info['status']}, không còn hiệu lực để tạo liên kết."
        )
    if target_info["status"] in INVALID_DOC_STATUSES:
        raise ValidationError(
            f"Chứng từ đích đang ở trạng thái {target_info['status']}, không còn hiệu lực để tạo liên kết."
        )

    # BR-SAL-11-03: Pair check
    if relation_type != models.LinkRelationType.REFERENCE:
        pairs = SUPPORTED_PAIRS.get(relation_type, set())
        if (source_info["doc_type"], target_info["doc_type"]) not in pairs:
            raise ValidationError("Loại quan hệ không phù hợp với cặp chứng từ đã chọn.")

    # BR-SAL-11-02: Same customer for business relations
    if relation_type != models.LinkRelationType.REFERENCE:
        s_cust = source_info.get("customer")
        t_cust = target_info.get("customer")
        if s_cust and t_cust and s_cust.id != t_cust.id:
            raise ValidationError("Chứng từ nguồn và đích phải cùng một khách hàng.")

        # Same currency if amount-based
        if relation_type == models.LinkRelationType.ALLOWANCE:
            s_curr = source_info.get("currency")
            t_curr = target_info.get("currency")
            if s_curr and t_curr and s_curr.id != t_curr.id:
                raise ValidationError("Chứng từ nguồn và đích phải cùng loại tiền khi liên kết theo giá trị.")


def create_document_link(request, data: Dict[str, Any]) -> models.SalesDocumentLink:
    """
    Establish a sales document link with full validation (Activity Flow steps 1-7).
    """
    company_id = data.get("company") or data.get("company_id")
    if not company_id:
        raise ValidationError("Doanh nghiệp là bắt buộc.")
    try:
        company = Company.objects.get(pk=company_id)
    except Company.DoesNotExist:
        raise ValidationError("Doanh nghiệp không tồn tại.")

    source_type = data.get("source_document_type")
    source_id = data.get("source_document_id")
    target_type = data.get("target_document_type")
    target_id = data.get("target_document_id")
    relation_type = data.get("relation_type")

    if not source_type or not source_id:
        raise ValidationError("Loại và mã chứng từ nguồn là bắt buộc.")
    if not target_type or not target_id:
        raise ValidationError("Loại và mã chứng từ đích là bắt buộc.")
    if not relation_type:
        raise ValidationError("Loại quan hệ là bắt buộc.")

    if relation_type not in models.LinkRelationType.values:
        raise ValidationError(f"Loại quan hệ '{relation_type}' không hợp lệ.")

    source_info = get_document_info(source_type, source_id, company=company)
    target_info = get_document_info(target_type, target_id, company=company)

    validate_relation_and_documents(source_info, target_info, relation_type)

    lines_data = data.get("lines", [])

    # BR-SAL-11-04: Non-reference links must match line-level
    if relation_type != models.LinkRelationType.REFERENCE and not lines_data:
        raise ValidationError("Liên kết nghiệp vụ phải có ít nhất một dòng đối chiếu chi tiết.")

    # Validate lines
    validated_lines = []
    seen_line_pairs = set()

    for idx, l_item in enumerate(lines_data, start=1):
        s_line_id = l_item.get("source_line_id")
        t_line_id = l_item.get("target_line_id")

        if relation_type != models.LinkRelationType.REFERENCE:
            if not s_line_id:
                raise ValidationError(f"Dòng {idx}: Dòng nguồn là bắt buộc.")
            if not t_line_id:
                raise ValidationError(f"Dòng {idx}: Dòng đích là bắt buộc.")

        s_line_info = get_document_line_info(source_type, s_line_id) if s_line_id else None
        t_line_info = get_document_line_info(target_type, t_line_id) if t_line_id else None

        if s_line_id and not s_line_info:
            raise ValidationError(f"Dòng {idx}: Không tìm thấy dòng nguồn '{s_line_id}'.")
        if t_line_id and not t_line_info:
            raise ValidationError(f"Dòng {idx}: Không tìm thấy dòng đích '{t_line_id}'.")

        # BR-SAL-11-05: Item match
        if s_line_info and t_line_info:
            if s_line_info["item"] and t_line_info["item"] and s_line_info["item"].id != t_line_info["item"].id:
                raise ValidationError(f"Dòng {idx}: Hàng hóa/dịch vụ giữa dòng nguồn và dòng đích không khớp.")

        # Unit conversion
        conv_rate = Decimal(str(l_item.get("conversion_rate") or 1))
        if conv_rate <= 0:
            raise ValidationError(f"Dòng {idx}: Tỷ lệ quy đổi đơn vị tính phải lớn hơn 0.")

        linked_qty = Decimal(str(l_item.get("linked_quantity") or 0)) if l_item.get("linked_quantity") is not None else None
        linked_amt = Decimal(str(l_item.get("linked_amount") or 0)) if l_item.get("linked_amount") is not None else None

        if relation_type == models.LinkRelationType.ALLOWANCE:
            if linked_amt is None or linked_amt <= 0:
                raise ValidationError(f"Dòng {idx}: Giá trị liên kết phải lớn hơn 0.")
        elif relation_type != models.LinkRelationType.REFERENCE:
            if linked_qty is None or linked_qty <= 0:
                raise ValidationError(f"Dòng {idx}: Số lượng liên kết phải lớn hơn 0.")

        # Duplicate check (EF-06 / BR-SAL-11-08)
        if s_line_id and t_line_id:
            pair_key = (str(s_line_id), str(t_line_id))
            if pair_key in seen_line_pairs:
                raise ValidationError(f"Dòng {idx}: Cặp dòng nguồn–đích này bị trùng lặp trong yêu cầu.")
            seen_line_pairs.add(pair_key)

            existing_active = models.SalesDocumentLinkLine.objects.filter(
                link__status=models.LinkStatus.ACTIVE,
                link__relation_type=relation_type,
                link__source_document_id=source_info["id"],
                link__target_document_id=target_info["id"],
                source_line_id=s_line_id,
                target_line_id=t_line_id,
            ).exists()
            if existing_active:
                raise ValidationError(f"Dòng {idx}: Liên kết giữa dòng nguồn và dòng đích đã tồn tại.")

            # Remaining capacities check (BR-SAL-11-06, BR-SAL-11-07, EF-05)
            if linked_qty is not None and linked_qty > 0 and s_line_info and t_line_info:
                # Source line remaining check
                cur_s_alloc = models.SalesDocumentLinkLine.objects.filter(
                    link__status=models.LinkStatus.ACTIVE,
                    link__relation_type=relation_type,
                    source_line_id=s_line_id,
                ).aggregate(total=Sum("linked_quantity"))["total"] or Decimal(0)
                rem_s_qty = s_line_info["quantity"] - Decimal(str(cur_s_alloc))
                if linked_qty > rem_s_qty:
                    raise ValidationError(
                        f"Dòng {idx}: Số lượng liên kết ({linked_qty}) vượt quá phần nguồn còn lại ({rem_s_qty})."
                    )

                # Target line remaining check
                cur_t_alloc = models.SalesDocumentLinkLine.objects.filter(
                    link__status=models.LinkStatus.ACTIVE,
                    link__relation_type=relation_type,
                    target_line_id=t_line_id,
                ).aggregate(total=Sum("linked_quantity"))["total"] or Decimal(0)
                rem_t_qty = t_line_info["quantity"] - Decimal(str(cur_t_alloc))
                if linked_qty > rem_t_qty:
                    raise ValidationError(
                        f"Dòng {idx}: Số lượng liên kết ({linked_qty}) vượt quá phần đích chưa liên kết ({rem_t_qty})."
                    )

            if linked_amt is not None and linked_amt > 0 and s_line_info and t_line_info:
                # Source line remaining amount check
                cur_s_amt_alloc = models.SalesDocumentLinkLine.objects.filter(
                    link__status=models.LinkStatus.ACTIVE,
                    link__relation_type=relation_type,
                    source_line_id=s_line_id,
                ).aggregate(total=Sum("linked_amount"))["total"] or Decimal(0)
                rem_s_amt = s_line_info["amount"] - Decimal(str(cur_s_amt_alloc))
                if linked_amt > rem_s_amt:
                    raise ValidationError(
                        f"Dòng {idx}: Giá trị liên kết ({linked_amt}) vượt quá phần giá trị nguồn còn lại ({rem_s_amt})."
                    )

                # Target line remaining amount check
                cur_t_amt_alloc = models.SalesDocumentLinkLine.objects.filter(
                    link__status=models.LinkStatus.ACTIVE,
                    link__relation_type=relation_type,
                    target_line_id=t_line_id,
                ).aggregate(total=Sum("linked_amount"))["total"] or Decimal(0)
                rem_t_amt = t_line_info["amount"] - Decimal(str(cur_t_amt_alloc))
                if linked_amt > rem_t_amt:
                    raise ValidationError(
                        f"Dòng {idx}: Giá trị liên kết ({linked_amt}) vượt quá phần giá trị đích chưa liên kết ({rem_t_amt})."
                    )

        validated_lines.append({
            "line_no": idx,
            "source_line_id": s_line_id,
            "target_line_id": t_line_id,
            "item": s_line_info["item"] if s_line_info else (t_line_info["item"] if t_line_info else None),
            "source_uom": s_line_info["uom"] if s_line_info else None,
            "target_uom": t_line_info["uom"] if t_line_info else None,
            "conversion_rate": conv_rate,
            "linked_quantity": linked_qty,
            "linked_amount": linked_amt,
            "notes": l_item.get("notes", ""),
        })

    actor = None
    if request:
        if hasattr(request, "iam_account") and request.iam_account:
            actor = request.iam_account
        elif hasattr(request, "user") and request.user:
            if hasattr(request.user, "iam_account") and request.user.iam_account:
                actor = request.user.iam_account
            else:
                from iam.models import UserAccount
                actor = UserAccount.objects.filter(user=request.user).first()
    if not actor:
        from iam.models import UserAccount
        actor = UserAccount.objects.first()
    if not actor:
        raise ValidationError("Không xác định được tài khoản người dùng.")

    link_mode = data.get("link_mode", models.LinkMode.MANUAL)
    if link_mode not in models.LinkMode.values:
        link_mode = models.LinkMode.MANUAL

    with transaction.atomic():
        link_num = generate_link_number(company)
        link = models.SalesDocumentLink.objects.create(
            company=company,
            link_number=link_num,
            source_document_type=source_type,
            source_document_id=source_info["id"],
            source_document_number=source_info["number"],
            target_document_type=target_type,
            target_document_id=target_info["id"],
            target_document_number=target_info["number"],
            relation_type=relation_type,
            customer=source_info.get("customer") or target_info.get("customer"),
            currency=source_info.get("currency") or target_info.get("currency"),
            notes=data.get("notes", ""),
            status=models.LinkStatus.ACTIVE,
            link_mode=link_mode,
            created_by=actor,
        )

        for l_data in validated_lines:
            models.SalesDocumentLinkLine.objects.create(
                link=link,
                line_no=l_data["line_no"],
                source_line_id=l_data["source_line_id"],
                target_line_id=l_data["target_line_id"],
                item=l_data["item"],
                source_uom=l_data["source_uom"],
                target_uom=l_data["target_uom"],
                conversion_rate=l_data["conversion_rate"],
                linked_quantity=l_data["linked_quantity"],
                linked_amount=l_data["linked_amount"],
                notes=l_data["notes"],
            )

        audit(request, link, "CREATE", after={"link_number": link.link_number, "status": link.status})

    return link


def unlink_document(request, link: models.SalesDocumentLink, reason: str) -> models.SalesDocumentLink:
    """
    Unlink an active sales document link with rule validations (AF-06, BR-SAL-11-09, BR-SAL-11-10, EF-09).
    """
    if link.status == models.LinkStatus.UNLINKED:
        raise ValidationError("Liên kết này đã được gỡ trước đó.")

    if not reason or not str(reason).strip():
        raise ValidationError("Lý do gỡ liên kết là bắt buộc.")

    # BR-SAL-11-09: AUTO links cannot be unlinked manually directly
    if link.link_mode == models.LinkMode.AUTO:
        raise ValidationError("Không thể gỡ liên kết tự động trực tiếp. Vui lòng xử lý qua chứng từ liên quan.")

    # BR-SAL-11-10: Only unlink manual allocation links if target document is still in DRAFT
    if link.relation_type != models.LinkRelationType.REFERENCE:
        target_info = get_document_info(link.target_document_type, link.target_document_id, link.company)
        target_status = target_info.get("status")
        if target_status and target_status not in [models.DocumentStatus.DRAFT, "DRAFT"]:
            raise ValidationError(
                f"Không thể gỡ liên kết vì chứng từ đích đang ở trạng thái '{target_status}' "
                f"(chỉ cho phép gỡ khi chứng từ đích còn ở trạng thái Bản nháp)."
            )

    actor = actor_for(request)
    if not actor:
        from iam.models import UserAccount
        actor = UserAccount.objects.filter(user=request.user).first()

    with transaction.atomic():
        before_state = {"status": link.status}
        link.status = models.LinkStatus.UNLINKED
        link.unlinked_by = actor
        link.unlinked_at = timezone.now()
        link.unlinked_reason = reason.strip()
        link.version += 1
        link.save(update_fields=["status", "unlinked_by", "unlinked_at", "unlinked_reason", "version"])

        after_state = {
            "status": link.status,
            "unlinked_at": link.unlinked_at.isoformat() if link.unlinked_at else None,
            "reason": link.unlinked_reason,
        }
        audit(request, link, "UNLINK", before=before_state, after=after_state, reason=reason)

    return link


def get_document_links(company: Company, document_type: str, document_id: Any):
    """
    Query all links where document is source or target (AF-01).
    """
    return models.SalesDocumentLink.objects.filter(
        company=company
    ).filter(
        Q(source_document_type=document_type, source_document_id=document_id)
        | Q(target_document_type=document_type, target_document_id=document_id)
    ).select_related("customer", "currency", "created_by", "unlinked_by").prefetch_related("lines__item")
