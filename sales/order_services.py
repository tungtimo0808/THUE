"""UC-SAL-02: Sales Order Management services.

Covers creation, editing, optimistic concurrency, workflow submission/approval/revision/rejection,
withdrawal, cancellation, closing, source prefill, feasibility evaluation (stock, credit, pricing),
and invoice request creation.
"""
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import F, Q, Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from approval_workflows.execution import approval_progress
from approval_workflows.submission import configured_snapshot
from audit_log.services import record_audit
from master_data.models import Currency, DocumentType, Item, ItemUomConversion, Party, PartyContact, TaxRate, UnitOfMeasure, Warehouse, fixed_uom_factor
from . import models


def actor_for(request):
    if hasattr(request, "user") and hasattr(request.user, "iam_account"):
        return request.user.iam_account
    return getattr(request, "user", None)


def audit(request, order, action, before=None, after=None, reason=""):
    actor = actor_for(request)
    if actor and hasattr(actor, "id"):
        record_audit(
            company=order.company,
            actor_user=actor,
            module_code="SAL",
            action_code=action,
            entity=order,
            before=before or {},
            after=after or {},
            request=request,
            reason=reason,
        )


def _date(value, field, missing_msg="Vui lòng nhập ngày."):
    if not value:
        raise ValidationError({field: missing_msg})
    try:
        return value if isinstance(value, date) else date.fromisoformat(str(value))
    except (ValueError, TypeError):
        raise ValidationError({field: "Ngày không hợp lệ."})


def generate_order_number(company, branch=None, document_date=None):
    """Generate unique sales order number using DocumentNumberingRule or SalesOrderCounter."""
    ref_date = document_date or timezone.localdate()
    try:
        from common_services.numbering_services import generate_document_number
        doc_type = DocumentType.objects.filter(code__in=["SAL.ORDER", "SO", "SALES_ORDER"]).first()
        if doc_type:
            num = generate_document_number(company, doc_type, branch=branch, document_date=ref_date)
            if num and not models.SalesOrder.objects.filter(company=company, number=num).exists():
                return num
    except Exception:
        pass

    with transaction.atomic():
        counter, _ = models.SalesOrderCounter.objects.select_for_update().get_or_create(company=company, year=ref_date.year)
        counter.value += 1
        counter.save(update_fields=("value",))
        return f"SO-{ref_date.year}-{counter.value:06d}"


def get_order_defaults(company, customer_id=None, currency_id=None, document_date=None, user=None):
    """Retrieve form defaults for creating a sales order (Luồng chính Bước 2 - 5)."""
    doc_date = _date(document_date or timezone.localdate(), "document_date")
    vnd = Currency.objects.filter(code="VND", is_active=True).first()
    active_currency = Currency.objects.filter(pk=currency_id, is_active=True).first() if currency_id else vnd

    # Resolve active employee for user
    assigned_employee = None
    if user and hasattr(user, "iam_account"):
        from iam.models import CompanyMembership
        membership = CompanyMembership.objects.filter(company=company, user=user.iam_account).first()
        if membership and membership.employee and membership.employee.status == "ACTIVE":
            assigned_employee = {
                "id": str(membership.employee.id),
                "employee_code": membership.employee.employee_code,
                "full_name": membership.employee.full_name,
            }

    result = {
        "document_date": doc_date.isoformat(),
        "currency": {
            "id": str(active_currency.id) if active_currency else None,
            "code": active_currency.code if active_currency else "VND",
            "decimal_places": active_currency.decimal_places if active_currency else 0,
        },
        "exchange_rate": "1",
        "assigned_employee": assigned_employee,
        "tax_rates": list(
            TaxRate.objects.filter(company=company, status="ACTIVE", effective_from__lte=doc_date)
            .filter(Q(effective_to__isnull=True) | Q(effective_to__gte=doc_date))
            .filter(business_scope__in=("OUTPUT", "BOTH"))
            .values("id", "code", "name", "rate_percent", "application_form")
        ),
    }

    # Exchange rate logic
    if active_currency and active_currency.id != company.accounting_currency_id:
        from master_data.models import ExchangeRate
        rate_obj = ExchangeRate.objects.filter(
            company=company, from_currency=active_currency, to_currency=company.accounting_currency, effective_date__lte=doc_date
        ).order_by("-effective_date").first()
        result["exchange_rate"] = str(rate_obj.rate) if rate_obj else None

    if customer_id:
        customer = Party.objects.filter(pk=customer_id, company=company).first()
        if not customer:
            raise ValidationError({"customer_id": "Khách hàng không tồn tại."})
        contact = customer.contacts.filter(status="ACTIVE").order_by("-is_default", "id").first() if hasattr(customer, "contacts") else None
        address = customer.addresses.order_by("-is_default", "id").values_list("address_line", flat=True).first() if hasattr(customer, "addresses") else ""
        if not address:
            address = getattr(customer, "address", "") or getattr(customer, "legal_address", "") or getattr(customer, "name", "")

        # Payment term preference: customer profile payment term
        payment_term = None
        if hasattr(customer, "customer_profile") and customer.customer_profile:
            # Check default payment term if available
            pass
        default_pt = customer.company.payment_terms.filter(status="ACTIVE", scope__in=["SALE", "BOTH"]).first()

        result["customer"] = {
            "id": str(customer.id),
            "code": customer.code,
            "name": customer.name,
            "status": customer.status,
            "tax_code": customer.tax_code or "",
            "contact_name": contact.contact_name if contact else "",
            "contact_phone": contact.phone if contact else "",
            "contact_email": contact.email if contact else "",
            "customer_address": address,
            "delivery_address": address,
            "payment_term_id": str(default_pt.id) if default_pt else None,
        }

        # Check restriction warnings (BR-SAL-22)
        warnings = []
        if customer.status != "ACTIVE":
            warnings.append("Khách hàng đã ngừng hoạt động.")
        result["warnings"] = warnings

    return result


def _validate_uom_conversion(item, uom):
    """Verify that uom has a valid conversion to item.base_uom (BR-SAL-17)."""
    if uom.id == item.base_uom_id:
        return Decimal("1")
    conversion = ItemUomConversion.objects.filter(item=item, from_uom=uom, to_uom=item.base_uom).first()
    if conversion:
        return conversion.factor
    phys = fixed_uom_factor(uom, item.base_uom)
    if phys is not None:
        return phys
    return None


def calculate_and_validate_lines(company, lines_data, currency, default_warehouse=None):
    """Validate lines and calculate gross, discount, tax, total with proper currency rounding (BR-SAL-02-01)."""
    if not isinstance(lines_data, list) or not lines_data:
        raise ValidationError({"lines": "Đơn bán hàng phải có ít nhất một dòng hàng hóa/dịch vụ."})

    quantum = Decimal(1).scaleb(-currency.decimal_places)
    validated_lines = []
    tot_subtotal = Decimal("0")
    tot_discount = Decimal("0")
    tot_tax = Decimal("0")
    has_goods = False

    for idx, raw in enumerate(lines_data, start=1):
        item_id = raw.get("item")
        if not item_id:
            raise ValidationError({"lines": f"Vui lòng chọn Hàng hóa/Dịch vụ tại dòng {idx}."})
        item = Item.objects.filter(pk=item_id, company=company).first()
        if not item:
            raise ValidationError({"lines": f"Hàng hóa/Dịch vụ tại dòng {idx} không hợp lệ."})
        if item.status != "ACTIVE" or not item.allow_sale:
            raise ValidationError({"lines": f"Hàng hóa/Dịch vụ '{item.name}' tại dòng {idx} đã ngừng hoạt động hoặc không cho phép bán."})

        if item.item_type == "GOODS":
            has_goods = True

        # UOM
        uom_id = raw.get("uom") or item.sales_uom_id or item.base_uom_id
        if not uom_id:
            raise ValidationError({"lines": f"Vui lòng chọn Đơn vị tính tại dòng {idx}."})
        uom = UnitOfMeasure.objects.filter(pk=uom_id, company=company).first()
        if not uom:
            raise ValidationError({"lines": f"Đơn vị tính tại dòng {idx} không hợp lệ."})
        if uom.status != "ACTIVE":
            raise ValidationError({"lines": f"Đơn vị tính '{uom.name}' tại dòng {idx} đã ngừng sử dụng."})

        factor = _validate_uom_conversion(item, uom)
        if factor is None:
            raise ValidationError({"lines": f"Đơn vị tính '{uom.name}' không có quy đổi hợp lệ về đơn vị cơ sở cho '{item.name}'."})

        # Warehouse validation (BR-SAL-19)
        wh_id = raw.get("warehouse") or (default_warehouse.id if default_warehouse else None)
        warehouse = None
        if item.track_inventory:
            if not wh_id:
                raise ValidationError({"lines": f"Hàng hóa quản lý tồn kho tại dòng {idx} ({item.name}) phải chọn kho xuất."})
            warehouse = Warehouse.objects.filter(pk=wh_id, company=company).first()
            if not warehouse:
                raise ValidationError({"lines": f"Kho xuất tại dòng {idx} không hợp lệ."})
        else:
            # Service must NOT have warehouse
            warehouse = None

        # Quantity
        try:
            qty = Decimal(str(raw.get("quantity", "")))
        except Exception:
            raise ValidationError({"lines": f"Số lượng tại dòng {idx} không hợp lệ."})
        if not qty.is_finite() or qty <= 0:
            raise ValidationError({"lines": f"Số lượng tại dòng {idx} phải lớn hơn 0."})

        # Unit price
        price_raw = raw.get("unit_price")
        if price_raw is None or price_raw == "":
            price_raw = item.sales_price if item.sales_price is not None else Decimal("0")
        try:
            unit_price = Decimal(str(price_raw))
        except Exception:
            raise ValidationError({"lines": f"Đơn giá tại dòng {idx} không hợp lệ."})
        if not unit_price.is_finite() or unit_price < 0:
            raise ValidationError({"lines": f"Đơn giá tại dòng {idx} không được nhỏ hơn 0."})

        # Gross
        gross = (qty * unit_price).quantize(quantum, rounding=ROUND_HALF_UP)

        # Discount
        discount_rate_raw = raw.get("discount_rate", 0)
        discount_amount_raw = raw.get("discount_amount")
        if discount_amount_raw is not None and str(discount_amount_raw).strip() != "":
            try:
                line_discount = Decimal(str(discount_amount_raw)).quantize(quantum, rounding=ROUND_HALF_UP)
            except Exception:
                raise ValidationError({"lines": f"Tiền chiết khấu tại dòng {idx} không hợp lệ."})
            if line_discount < 0 or line_discount > gross:
                raise ValidationError({"lines": f"Tiền chiết khấu tại dòng {idx} không được vượt quá thành tiền ({gross})."})
            line_disc_rate = ((line_discount / gross) * 100).quantize(Decimal("0.0001")) if gross > 0 else Decimal("0")
        else:
            try:
                line_disc_rate = Decimal(str(discount_rate_raw or 0))
            except Exception:
                raise ValidationError({"lines": f"Tỷ lệ chiết khấu tại dòng {idx} không hợp lệ."})
            if line_disc_rate < 0 or line_disc_rate > 100:
                raise ValidationError({"lines": f"Tỷ lệ chiết khấu tại dòng {idx} phải từ 0% đến 100%."})
            line_discount = (gross * line_disc_rate / Decimal("100")).quantize(quantum, rounding=ROUND_HALF_UP)

        net = gross - line_discount

        # Tax
        tax_rate_id = raw.get("tax_rate") or item.sales_tax_rate_id or item.default_tax_rate_id
        tax_rate = None
        tax_amount = Decimal("0")
        if tax_rate_id:
            tax_rate = TaxRate.objects.filter(pk=tax_rate_id, company=company).first()
            if tax_rate and tax_rate.status == "ACTIVE" and tax_rate.business_scope in ("OUTPUT", "BOTH"):
                if tax_rate.application_form == "PERCENT" and tax_rate.rate_percent is not None:
                    tax_amount = (net * tax_rate.rate_percent / Decimal("100")).quantize(quantum, rounding=ROUND_HALF_UP)
            else:
                tax_rate = None

        line_total = net + tax_amount

        tot_subtotal += gross
        tot_discount += line_discount
        tot_tax += tax_amount

        validated_lines.append({
            "line_no": raw.get("line_no", idx),
            "item": item,
            "description": raw.get("description") or item.name,
            "uom": uom,
            "warehouse": warehouse,
            "quantity": qty,
            "unit_price": unit_price,
            "discount_rate": line_disc_rate,
            "discount_amount": line_discount,
            "tax_rate": tax_rate,
            "tax_amount": tax_amount,
            "line_total": line_total,
            "tax_group": raw.get("tax_group", ""),
            "quotation_line": raw.get("quotation_line"),
            "contract_line": raw.get("contract_line"),
        })

    return {
        "lines": validated_lines,
        "subtotal": tot_subtotal,
        "discount_amount": tot_discount,
        "tax_amount": tot_tax,
        "total_amount": tot_subtotal - tot_discount + tot_tax,
        "has_goods": has_goods,
    }


def prepare_order_from_sources(company, quotation_ids=None, contract_id=None):
    """Synthesize source quotations or contract into sales order prefill data (AF-02, BR-SAL-30)."""
    if not quotation_ids and not contract_id:
        raise ValidationError("Vui lòng chọn báo giá hoặc hợp đồng nguồn.")

    quotations = []
    if quotation_ids:
        if isinstance(quotation_ids, str):
            quotation_ids = [q.strip() for q in quotation_ids.split(",") if q.strip()]
        quotations = list(models.SalesQuotation.objects.filter(pk__in=quotation_ids, company=company).prefetch_related("lines__item", "lines__uom", "lines__tax_rate"))
        if len(quotations) != len(quotation_ids):
            raise ValidationError("Một số báo giá nguồn không tồn tại trong doanh nghiệp.")

        # BR-SAL-15: Quotes must be ACCEPTED
        for q in quotations:
            if q.status != models.DocumentStatus.ACCEPTED:
                raise ValidationError(f"Báo giá {q.number} chưa được khách hàng chấp nhận.")

        # BR-SAL-30: Multiple quotations must share same customer, currency, payment term
        cust_id = quotations[0].customer_id
        curr_id = quotations[0].currency_id
        term_id = quotations[0].payment_term_id
        for q in quotations[1:]:
            if q.customer_id != cust_id or q.currency_id != curr_id or q.payment_term_id != term_id:
                raise ValidationError("Các báo giá tổng hợp phải cùng khách hàng, loại tiền và điều khoản thanh toán.")

        primary_quote = quotations[0]
        contact = primary_quote.customer.contacts.filter(status="ACTIVE").order_by("-is_default", "id").first() if hasattr(primary_quote.customer, "contacts") else None
        address = primary_quote.customer.addresses.order_by("-is_default", "id").values_list("address_line", flat=True).first() if hasattr(primary_quote.customer, "addresses") else ""
        if not address:
            address = getattr(primary_quote.customer, "address", "") or getattr(primary_quote.customer, "legal_address", "") or getattr(primary_quote.customer, "name", "")

        lines_out = []
        for q in quotations:
            for q_line in q.lines.all():
                used_qty = q_line.order_lines.exclude(order__status=models.DocumentStatus.CANCELLED).aggregate(tot=Sum("quantity"))["tot"] or Decimal("0")
                rem_qty = q_line.quantity - used_qty
                if rem_qty > 0:
                    lines_out.append({
                        "quotation_line": str(q_line.id),
                        "quotation_number": q.number,
                        "item": str(q_line.item_id),
                        "item_code": q_line.item.code,
                        "item_name": q_line.item.name,
                        "description": q_line.description,
                        "uom": str(q_line.uom_id) if q_line.uom_id else None,
                        "quantity": str(rem_qty),
                        "unit_price": str(q_line.unit_price) if q_line.unit_price is not None else "0",
                        "discount_rate": str(q_line.discount_rate),
                        "tax_rate": str(q_line.tax_rate_id) if q_line.tax_rate_id else None,
                    })

        return {
            "company": str(company.id),
            "customer": str(primary_quote.customer_id),
            "currency": str(primary_quote.currency_id),
            "payment_term": str(term_id) if term_id else None,
            "quotation": str(primary_quote.id) if len(quotations) == 1 else None,
            "quotation_ids": [str(q.id) for q in quotations],
            "delivery_address": address,
            "customer_address": address,
            "contact_name": contact.contact_name if contact else "",
            "contact_phone": contact.phone if contact else "",
            "contact_email": contact.email if contact else "",
            "lines": lines_out,
        }

    if contract_id:
        contract = models.SalesContract.objects.filter(pk=contract_id, company=company).prefetch_related("lines__item", "lines__uom").first()
        if not contract:
            raise ValidationError("Hợp đồng nguồn không tồn tại.")
        if contract.status in {models.DocumentStatus.CANCELLED, models.DocumentStatus.TERMINATED}:
            raise ValidationError("Hợp đồng nguồn đã bị hủy hoặc chấm dứt.")

        contact = contract.customer.contacts.filter(status="ACTIVE").order_by("-is_default", "id").first() if hasattr(contract.customer, "contacts") else None
        address = contract.customer.addresses.order_by("-is_default", "id").values_list("address_line", flat=True).first() if hasattr(contract.customer, "addresses") else ""
        if not address:
            address = getattr(contract.customer, "address", "") or getattr(contract.customer, "legal_address", "") or getattr(contract.customer, "name", "")

        lines_out = []
        for c_line in contract.lines.all():
            used_qty = c_line.order_lines.exclude(order__status=models.DocumentStatus.CANCELLED).aggregate(tot=Sum("quantity"))["tot"] or Decimal("0")
            max_qty = c_line.maximum_quantity if c_line.maximum_quantity is not None else Decimal("999999")
            rem_qty = max(max_qty - used_qty, Decimal("0"))
            if rem_qty > 0:
                lines_out.append({
                    "contract_line": str(c_line.id),
                    "item": str(c_line.item_id),
                    "item_code": c_line.item.code,
                    "item_name": c_line.item.name,
                    "description": c_line.description,
                    "uom": str(c_line.uom_id),
                    "quantity": str(rem_qty) if c_line.maximum_quantity is not None else "1",
                    "unit_price": str(c_line.unit_price) if c_line.unit_price is not None else "0",
                    "discount_rate": "0",
                })

        return {
            "company": str(company.id),
            "customer": str(contract.customer_id),
            "currency": str(contract.currency_id),
            "contract": str(contract.id),
            "payment_term": str(contract.payment_term_id) if contract.payment_term_id else None,
            "delivery_address": address,
            "customer_address": address,
            "contact_name": contact.contact_name if contact else "",
            "contact_phone": contact.phone if contact else "",
            "contact_email": contact.email if contact else "",
            "lines": lines_out,
        }


def evaluate_order_feasibility(order):
    """Evaluate inventory available stock, credit limit, and pricing compliance (BR-SAL-23 -> 27)."""
    company = order.company
    customer = order.customer
    from accounts_receivable.services import evaluate_credit
    from inventory.models import InventoryPolicy, StockBalance

    # 1. Stock check (BR-SAL-23, BR-SAL-24)
    stock_results = []
    has_stock_block = False
    has_stock_warn = False

    for line in order.lines.select_related("item", "uom", "warehouse"):
        if not line.item.track_inventory:
            stock_results.append({
                "line_no": line.line_no,
                "item_code": line.item.code,
                "item_name": line.item.name,
                "track_inventory": False,
                "status": "NOT_APPLICABLE",
            })
            continue

        wh = line.warehouse or order.default_warehouse
        if not wh:
            stock_results.append({
                "line_no": line.line_no,
                "item_code": line.item.code,
                "error": "Chưa chọn kho xuất.",
                "status": "BLOCKED",
            })
            has_stock_block = True
            continue

        # Available base stock at warehouse
        balances = StockBalance.objects.filter(company=company, warehouse=wh, item=line.item)
        base_available = sum((b.available_quantity for b in balances), Decimal("0"))

        # Conversion to line uom
        conv_factor = _validate_uom_conversion(line.item, line.uom) or Decimal("1")
        # available in line uom
        available_in_line_uom = base_available / conv_factor if conv_factor > 0 else base_available

        shortage = max(Decimal("0"), line.quantity - available_in_line_uom)
        policy = InventoryPolicy.objects.filter(company=company, warehouse=wh, item=line.item, is_active=True).first()
        policy_action = policy.threshold_action if policy else "WARN"

        is_insufficient = shortage > 0
        status = "OK"
        if is_insufficient:
            if policy_action == "BLOCK":
                status = "BLOCKED"
                has_stock_block = True
            else:
                status = "WARNING"
                has_stock_warn = True

        stock_results.append({
            "line_no": line.line_no,
            "item_code": line.item.code,
            "item_name": line.item.name,
            "warehouse_code": wh.code,
            "requested_quantity": str(line.quantity),
            "available_quantity": str(available_in_line_uom),
            "shortage": str(shortage),
            "status": status,
            "action": policy_action if is_insufficient else "OK",
        })

    # 2. Credit check (BR-SAL-25, BR-SAL-26)
    credit_eval = evaluate_credit(
        company=company,
        customer=customer,
        amount=order.total_amount,
        branch=order.branch,
        currency=order.currency,
        exclude_order=order,
    )

    # 3. Pricing policy check (BR-SAL-27)
    pricing_warnings = []
    for line in order.lines.all():
        if line.unit_price == 0:
            pricing_warnings.append(f"Dòng {line.line_no} ({line.item.code}) có đơn giá bằng 0 (hàng tặng/mẫu). Cần phê duyệt.")
        if line.discount_rate > 50:
            pricing_warnings.append(f"Dòng {line.line_no} ({line.item.code}) có mức chiết khấu {line.discount_rate}% vượt ngưỡng thông thường.")

    return {
        "stock_check": {
            "allowed": not has_stock_block,
            "warning": has_stock_warn,
            "lines": stock_results,
        },
        "credit_check": credit_eval,
        "pricing_check": {
            "requires_special_approval": len(pricing_warnings) > 0,
            "warnings": pricing_warnings,
        },
        "can_confirm_directly": not has_stock_block and credit_eval.get("allowed", True) and not credit_eval.get("approval_required", False) and len(pricing_warnings) == 0,
    }


@transaction.atomic
def submit_order(request, order, comment=""):
    """Submit sales order for approval or directly confirm if no approval required (Luồng chính Bước 8, 9)."""
    order = models.SalesOrder.objects.select_for_update().get(pk=order.pk)
    if order.status not in {models.DocumentStatus.DRAFT, models.DocumentStatus.REVISION_REQUIRED, models.DocumentStatus.REJECTED}:
        raise ValidationError(f"Chỉ đơn bán hàng ở trạng thái Nháp, Yêu cầu chỉnh sửa hoặc Từ chối mới được gửi duyệt (trạng thái hiện tại: {order.status}).")

    # Feasibility evaluation
    feasibility = evaluate_order_feasibility(order)
    order.inventory_check = feasibility["stock_check"]
    order.credit_check = feasibility["credit_check"]

    # EF-05: Block if credit or stock hard block
    if not feasibility["stock_check"]["allowed"]:
        raise ValidationError("Kiểm tra tồn kho: Mặt hàng không đủ tồn khả dụng và bị chặn theo cấu hình kho.")
    if not feasibility["credit_check"].get("allowed", True):
        raise ValidationError("Kiểm soát tín dụng: Khách hàng vượt hạn mức công nợ hoặc có nợ quá hạn và bị chặn theo chính sách tín dụng.")

    # Check workflow requirement
    workflow_needed = False
    if feasibility["credit_check"].get("approval_required") or feasibility["pricing_check"]["requires_special_approval"]:
        workflow_needed = True

    configured = configured_snapshot(order, "SAL.ORDER")
    if configured is not None:
        order.workflow_snapshot = configured
        order.approval_required = configured.get("approval_required", False) or workflow_needed
    else:
        order.approval_required = bool(order.approval_required or workflow_needed)

    before = order.status
    if order.approval_required:
        order.status = models.DocumentStatus.PENDING_APPROVAL
        order.submitted_at = timezone.now()
        models.ApprovalDecision.objects.create(
            company=order.company,
            document_type="ORDER",
            document_id=order.pk,
            decision="SUBMITTED",
            actor=actor_for(request),
            comment=comment,
        )
    else:
        order.status = models.DocumentStatus.APPROVED
        order.submitted_at = timezone.now()
        order.approved_at = timezone.now()
        models.ApprovalDecision.objects.create(
            company=order.company,
            document_type="ORDER",
            document_id=order.pk,
            decision="APPROVED",
            actor=actor_for(request),
            comment="Tự động xác nhận (không yêu cầu phê duyệt)",
        )

    order.version += 1
    order.save()
    audit(request, order, "SUBMIT", {"status": before, "version": order.version - 1}, {"status": order.status, "version": order.version}, reason=comment)
    return order


@transaction.atomic
def confirm_order_direct(request, order, comment=""):
    """Directly confirm order for authorized users (Bước 9)."""
    order = models.SalesOrder.objects.select_for_update().get(pk=order.pk)
    if order.status not in {models.DocumentStatus.DRAFT, models.DocumentStatus.REVISION_REQUIRED, models.DocumentStatus.PENDING_APPROVAL}:
        raise ValidationError("Đơn bán hàng không ở trạng thái có thể xác nhận.")

    feasibility = evaluate_order_feasibility(order)
    if not feasibility["stock_check"]["allowed"]:
        raise ValidationError("Không thể xác nhận đơn: Thiếu tồn kho khả dụng.")
    if not feasibility["credit_check"].get("allowed", True):
        raise ValidationError("Không thể xác nhận đơn: Vượt hạn mức tín dụng.")

    before = order.status
    order.status = models.DocumentStatus.APPROVED
    order.approved_at = timezone.now()
    order.inventory_check = feasibility["stock_check"]
    order.credit_check = feasibility["credit_check"]
    order.version += 1
    order.save()

    models.ApprovalDecision.objects.create(
        company=order.company,
        document_type="ORDER",
        document_id=order.pk,
        decision="APPROVED",
        actor=actor_for(request),
        comment=comment or "Xác nhận trực tiếp",
    )
    audit(request, order, "CONFIRM", {"status": before, "version": order.version - 1}, {"status": order.status, "version": order.version}, reason=comment)
    return order


@transaction.atomic
def withdraw_order(request, order, reason):
    """Withdraw pending order back to draft (AF-04, BR-SAL-29)."""
    order = models.SalesOrder.objects.select_for_update().get(pk=order.pk)
    if order.status != models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Chỉ đơn bán hàng đang Chờ duyệt mới được thu hồi.")
    clean_reason = str(reason or "").strip()
    if not clean_reason:
        raise ValidationError({"reason": "Lý do thu hồi là bắt buộc."})

    before = order.status
    order.status = models.DocumentStatus.DRAFT
    order.withdrawal_reason = clean_reason
    order.version += 1
    order.save(update_fields=("status", "withdrawal_reason", "version", "updated_at"))

    models.ApprovalDecision.objects.create(
        company=order.company,
        document_type="ORDER",
        document_id=order.pk,
        decision="WITHDRAWN",
        actor=actor_for(request),
        comment=clean_reason,
    )
    audit(request, order, "WITHDRAW", {"status": before, "version": order.version - 1}, {"status": order.status, "version": order.version}, reason=clean_reason)
    return order


@transaction.atomic
def decide_order(request, order, decision_type, comment=""):
    """Process approval decision: APPROVE, REQUEST_REVISION, REJECT (AF-05)."""
    order = models.SalesOrder.objects.select_for_update().get(pk=order.pk)
    if order.status != models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Đơn bán hàng không ở trạng thái Chờ duyệt.")

    actor = actor_for(request)
    allow_self = order.workflow_snapshot.get("allow_self_approval", False) if order.workflow_snapshot else False
    if order.created_by_id == getattr(actor, "id", None) and not allow_self:
        raise ValidationError("Không được tự phê duyệt đơn do chính mình tạo.")

    comment_clean = str(comment or "").strip()
    if decision_type in {"REJECT", "REQUEST_REVISION"} and not comment_clean:
        raise ValidationError({"comment": "Ý kiến xử lý là bắt buộc khi từ chối hoặc yêu cầu chỉnh sửa."})

    decisions = models.ApprovalDecision.objects.filter(document_type="ORDER", document_id=order.pk)
    level = decisions.filter(decision="APPROVED").count() + 1
    final = False

    if decision_type == "APPROVE":
        progress = approval_progress(order, actor, True, decisions)
        if progress is not None:
            level, final = progress["level"], progress["final"]
        else:
            total_levels = int(order.workflow_snapshot.get("levels", 1)) if order.workflow_snapshot else 1
            final = level >= total_levels

    before = order.status
    if decision_type == "APPROVE":
        order.status = models.DocumentStatus.APPROVED if final else models.DocumentStatus.PENDING_APPROVAL
        if final:
            order.approved_at = timezone.now()
    elif decision_type == "REQUEST_REVISION":
        order.status = models.DocumentStatus.REVISION_REQUIRED
        order.rejection_reason = comment_clean
    elif decision_type == "REJECT":
        order.status = models.DocumentStatus.REJECTED
        order.rejection_reason = comment_clean
    else:
        raise ValidationError(f"Quyết định '{decision_type}' không hợp lệ.")

    order.version += 1
    order.save()

    decision_map = {
        "APPROVE": "APPROVED",
        "REQUEST_REVISION": "REVISION_REQUIRED",
        "REJECT": "REJECTED",
    }
    models.ApprovalDecision.objects.create(
        company=order.company,
        document_type="ORDER",
        document_id=order.pk,
        level=level,
        decision=decision_map[decision_type],
        actor=actor,
        comment=comment_clean,
    )
    audit(request, order, decision_type, {"status": before, "version": order.version - 1}, {"status": order.status, "version": order.version}, reason=comment_clean)
    return order


@transaction.atomic
def cancel_order(request, order, reason):
    """Cancel order when conditions are met (AF-06, BR-SAL-02-02)."""
    order = models.SalesOrder.objects.select_for_update().get(pk=order.pk)
    if order.status in {models.DocumentStatus.CANCELLED, models.DocumentStatus.COMPLETED, models.DocumentStatus.CLOSED}:
        raise ValidationError("Đơn bán hàng đã hoàn tất hoặc đã hủy.")

    clean_reason = str(reason or "").strip()
    if not clean_reason:
        raise ValidationError({"reason": "Lý do hủy đơn là bắt buộc."})

    # Check confirmed execution
    has_confirmed_deliveries = order.deliveries.filter(status=models.DeliveryStatus.CONFIRMED).exists()
    has_processed_invoices = order.invoice_requests.exclude(status=models.InvoiceRequestStatus.CANCELLED).exists()
    if has_confirmed_deliveries or has_processed_invoices:
        raise ValidationError("Đơn đã thực hiện một phần; không được hủy đơn toàn bộ. Vui lòng đóng phần còn lại (AF-07).")

    # Check pending draft executions (EF-09)
    if order.deliveries.filter(status=models.DeliveryStatus.DRAFT).exists():
        raise ValidationError("Đơn có phiếu giao hàng nháp chưa xử lý. Vui lòng xóa hoặc hủy phiếu giao trước khi hủy đơn.")
    if order.invoice_requests.filter(status=models.InvoiceRequestStatus.DRAFT).exists():
        raise ValidationError("Đơn có đề nghị hóa đơn nháp chưa xử lý. Vui lòng hủy đề nghị hóa đơn trước khi hủy đơn.")

    before = order.status
    order.status = models.DocumentStatus.CANCELLED
    order.cancellation_reason = clean_reason
    order.version += 1
    order.save(update_fields=("status", "cancellation_reason", "version", "updated_at"))

    audit(request, order, "CANCEL", {"status": before, "version": order.version - 1}, {"status": order.status, "version": order.version}, reason=clean_reason)
    return order


@transaction.atomic
def close_order(request, order, reason):
    """Close completed or unfulfilled remainder of order (AF-07, BR-SAL-02-03)."""
    order = models.SalesOrder.objects.select_for_update().prefetch_related("lines").get(pk=order.pk)
    if order.status not in {models.DocumentStatus.APPROVED, models.DocumentStatus.PARTIALLY_DELIVERED, models.DocumentStatus.FULLY_DELIVERED}:
        raise ValidationError(f"Chỉ đơn bán hàng Đã xác nhận mới được đóng (trạng thái hiện tại: {order.status}).")

    clean_reason = str(reason or "").strip()
    has_remaining = any(line.remaining_quantity > 0 for line in order.lines.all())
    if has_remaining and not clean_reason:
        raise ValidationError({"reason": "Đơn chưa thực hiện đủ số lượng; lý do đóng đơn là bắt buộc."})

    # Check transactions in progress (EF-09)
    if order.deliveries.filter(status=models.DeliveryStatus.DRAFT).exists():
        raise ValidationError("Đơn bán hàng đang có phiếu giao hàng nháp chưa hoàn tất.")
    if order.invoice_requests.filter(status=models.InvoiceRequestStatus.DRAFT).exists():
        raise ValidationError("Đơn bán hàng đang có đề nghị hóa đơn nháp chưa hoàn tất.")

    # Close remaining quantities
    for line in order.lines.all():
        rem = line.remaining_quantity
        if rem > 0:
            line.closed_quantity += rem
            line.cancelled_quantity += rem
            line.save(update_fields=("closed_quantity", "cancelled_quantity"))

    before = order.status
    order.status = models.DocumentStatus.COMPLETED
    order.closed_at = timezone.now()
    order.closed_by = actor_for(request)
    order.close_reason = clean_reason
    order.version += 1
    order.save(update_fields=("status", "closed_at", "closed_by", "close_reason", "version", "updated_at"))

    audit(request, order, "CLOSE", {"status": before, "version": order.version - 1}, {"status": order.status, "version": order.version}, reason=clean_reason)
    return order


@transaction.atomic
def delete_draft_order(request, order):
    """Delete draft order when no business relations exist (AF-08, BR-SAL-02-02)."""
    order = models.SalesOrder.objects.select_for_update().get(pk=order.pk)
    if order.status != models.DocumentStatus.DRAFT:
        raise ValidationError("Chỉ đơn bán hàng ở trạng thái Nháp mới được xóa.")

    if order.deliveries.exists() or order.invoice_requests.exists():
        raise ValidationError("Đơn bán hàng đã có chứng từ phát sinh liên kết; không thể xóa.")

    # Revert quotation status if it was converted
    if order.quotation_id:
        q = order.quotation
        q.status = models.DocumentStatus.ACCEPTED
        q.save(update_fields=("status", "updated_at"))

    audit(request, order, "DELETE", {"status": order.status, "number": order.number}, {})
    order.lines.all().delete()
    order.delete()
    return True


def get_invoice_eligible_lines(order):
    """Calculate eligible lines and remaining quantities for invoice request (AF-09, BR-SAL-02-04, 02-05)."""
    if order.status not in {models.DocumentStatus.APPROVED, models.DocumentStatus.PARTIALLY_DELIVERED, models.DocumentStatus.FULLY_DELIVERED}:
        raise ValidationError("Chỉ đơn bán hàng Đã xác nhận mới đủ điều kiện tạo đề nghị lập hóa đơn.")

    result = []
    for line in order.lines.select_related("item", "uom", "tax_rate"):
        # Eligible quantity according to invoicing policy
        if order.invoicing_policy == "DELIVERY":
            eligible = line.delivered_quantity
        else:
            eligible = line.quantity - line.closed_quantity

        # Quantities already in submitted/processed invoice requests
        active_requests_qty = line.invoice_request_lines.exclude(request__status=models.InvoiceRequestStatus.CANCELLED).aggregate(tot=Sum("quantity"))["tot"] or Decimal("0")

        remaining = max(Decimal("0"), eligible - active_requests_qty)

        result.append({
            "order_line_id": str(line.id),
            "line_no": line.line_no,
            "item_id": str(line.item_id),
            "item_code": line.item.code,
            "item_name": line.item.name,
            "uom_id": str(line.uom_id),
            "uom_name": line.uom.name,
            "ordered_quantity": str(line.quantity),
            "delivered_quantity": str(line.delivered_quantity),
            "closed_quantity": str(line.closed_quantity),
            "eligible_quantity": str(eligible),
            "invoiced_quantity": str(line.invoiced_quantity),
            "active_requested_quantity": str(active_requests_qty),
            "remaining_eligible_quantity": str(remaining),
            "unit_price": str(line.unit_price),
            "tax_rate_id": str(line.tax_rate_id) if line.tax_rate_id else None,
        })
    return result


@transaction.atomic
def create_invoice_request_from_order(request, order, lines_payload, number=None):
    """Create invoice request from eligible order lines (AF-09, BR-SAL-02-04, 02-05)."""
    order = models.SalesOrder.objects.select_for_update().get(pk=order.pk)
    if order.status not in {models.DocumentStatus.APPROVED, models.DocumentStatus.PARTIALLY_DELIVERED, models.DocumentStatus.FULLY_DELIVERED}:
        raise ValidationError("Chỉ đơn bán hàng Đã xác nhận mới đủ điều kiện lập đề nghị hóa đơn.")

    if not isinstance(lines_payload, list) or not lines_payload:
        raise ValidationError({"lines": "Vui lòng chọn ít nhất một dòng hàng để đề nghị lập hóa đơn."})

    req_number = number or f"DXHD-{timezone.localdate().strftime('%Y%m%d')}-{models.InvoiceRequest.objects.filter(company=order.company).count() + 1:04d}"
    inv_request = models.InvoiceRequest.objects.create(
        company=order.company,
        number=req_number,
        order=order,
        customer=order.customer,
        currency=order.currency,
        request_date=timezone.localdate(),
        buyer_name=order.contact_name or order.customer.name,
        buyer_tax_code=order.customer.tax_code or "",
        buyer_address=order.customer_address or order.delivery_address,
        buyer_email=order.contact_email,
        created_by=actor_for(request),
    )

    tot_amount = Decimal("0")
    tot_tax = Decimal("0")

    for raw in lines_payload:
        line_id = raw.get("order_line")
        line = models.SalesOrderLine.objects.select_for_update().get(pk=line_id, order=order)

        # Invoicing policy
        eligible = line.delivered_quantity if order.invoicing_policy == "DELIVERY" else (line.quantity - line.closed_quantity)
        active_requests_qty = line.invoice_request_lines.exclude(request__status=models.InvoiceRequestStatus.CANCELLED).aggregate(tot=Sum("quantity"))["tot"] or Decimal("0")
        remaining = max(Decimal("0"), eligible - active_requests_qty)

        req_qty = Decimal(str(raw.get("quantity", 0)))
        if req_qty <= 0:
            raise ValidationError({"lines": f"Số lượng đề nghị dòng {line.line_no} phải lớn hơn 0."})
        if req_qty > remaining:
            raise ValidationError({"lines": f"Số lượng đề nghị dòng {line.line_no} ({req_qty}) vượt số lượng còn được phép ({remaining}) (EF-10)."})

        tax_amt = Decimal("0")
        if line.tax_rate and line.tax_rate.rate_percent:
            tax_amt = (req_qty * line.unit_price * line.tax_rate.rate_percent / Decimal("100")).quantize(Decimal("0.0001"))

        delivery_line_id = raw.get("delivery_line")

        models.InvoiceRequestLine.objects.create(
            request=inv_request,
            order_line=line,
            delivery_line_id=delivery_line_id,
            quantity=req_qty,
            unit_price=line.unit_price,
            tax_rate=line.tax_rate,
            tax_amount=tax_amt,
        )

        tot_amount += (req_qty * line.unit_price) + tax_amt
        tot_tax += tax_amt

    inv_request.total_amount = tot_amount
    inv_request.tax_amount = tot_tax
    inv_request.save(update_fields=("total_amount", "tax_amount"))

    audit(request, order, "CREATE_INVOICE_REQUEST", after={"invoice_request": str(inv_request.id), "number": inv_request.number})
    return inv_request
