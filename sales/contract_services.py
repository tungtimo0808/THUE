import uuid
from datetime import date
from decimal import Decimal

from django.db import transaction
from django.db.models import F, Q, Sum
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from audit_log.services import record_audit
from approval_workflows.submission import configured_snapshot
from approval_workflows.execution import approval_progress
from . import models


def actor_for(request):
    """Retrieve the IAM account of current user."""
    if not request:
        from iam.models import UserAccount
        return UserAccount.objects.first()
    if hasattr(request, "iam_account"):
        return request.iam_account
    user = getattr(request, "user", None)
    if user and hasattr(user, "iam_account"):
        return user.iam_account
    from iam.models import UserAccount
    return UserAccount.objects.first()


def audit_contract(request, obj, action, before=None, after=None, reason=""):
    """Record an audit log entry for SalesContract or its Annex."""
    actor = actor_for(request)
    company = getattr(obj, "company", None)
    if not company and hasattr(obj, "contract"):
        company = obj.contract.company
    req = request if request and hasattr(request, "user") else None
    record_audit(
        company=company,
        actor_user=actor,
        module_code="SAL",
        action_code=f"CONTRACT_{action}",
        entity=obj,
        before=before or {},
        after=after or {},
        request=req,
        reason=reason,
    )


@transaction.atomic
def generate_contract_code(company, document_date=None):
    """Generate next contract internal document number, e.g. HD-2026-00001 (BR-SAL-12-02)."""
    doc_date = document_date or timezone.localdate()
    year = doc_date.year
    counter, _ = models.SalesContractCounter.objects.select_for_update().get_or_create(
        company=company,
        year=year,
        defaults={"value": 0},
    )
    counter.value += 1
    counter.save(update_fields=["value"])
    return f"HD-{year}-{counter.value:05d}"


def get_contract_validity(contract, on_date=None):
    """
    Determine validity string for a contract based on effective dates:
    - 'NOT_YET_EFFECTIVE': before start_date
    - 'EFFECTIVE': within [start_date, effective_end_date]
    - 'EXPIRED': after effective_end_date
    Takes signed and effective annexes into account (Table 3, BR-SAL-12-09).
    """
    if contract.status != models.DocumentStatus.SIGNED:
        return None

    check_date = on_date or timezone.localdate()

    # Determine effective end date from signed annexes whose effective_date <= check_date
    effective_end_date = contract.end_date
    active_annexes = (
        contract.annexes.filter(
            status=models.AnnexStatus.SIGNED,
            effective_date__lte=check_date,
            new_end_date__isnull=False,
        )
        .order_by("-effective_date", "-created_at")
    )
    latest_annex = active_annexes.first()
    if latest_annex and latest_annex.new_end_date:
        effective_end_date = latest_annex.new_end_date

    if check_date < contract.start_date:
        return "NOT_YET_EFFECTIVE"
    elif check_date <= effective_end_date:
        return "EFFECTIVE"
    else:
        return "EXPIRED"


def get_contract_validity_display(validity_code):
    mapping = {
        "NOT_YET_EFFECTIVE": "Chưa đến hiệu lực",
        "EFFECTIVE": "Đang hiệu lực",
        "EXPIRED": "Hết hiệu lực",
    }
    return mapping.get(validity_code, "")


def calculate_contract_allocations(contract):
    """
    Calculate allocated and remaining quantity/amount for contract and each line (Table 2.2, BR-SAL-12-06, BR-SAL-12-07).
    Orders cancelled or closed release unfulfilled quantities/amounts.
    Does NOT double count goods deliveries or sales invoices (BR-SAL-12-07).
    """
    # Active orders linked to this contract
    active_orders = contract.orders.exclude(status=models.DocumentStatus.CANCELLED)
    
    line_data = {}
    for line in contract.lines.all():
        committed_qty = Decimal(str(line.quantity or line.maximum_quantity or 0))
        unit_price = Decimal(str(line.unit_price or 0))
        line_total = Decimal(str(line.line_total or 0))

        # Query order lines for this contract line
        order_lines = line.order_lines.exclude(order__status=models.DocumentStatus.CANCELLED)
        allocated_qty = Decimal("0")
        allocated_amt = Decimal("0")
        for o_line in order_lines:
            # Committed active quantity from order line
            o_qty = Decimal(str(o_line.quantity or 0))
            o_closed = Decimal(str(o_line.closed_quantity or 0))
            o_canc = Decimal(str(o_line.cancelled_quantity or 0))
            active_line_qty = max(Decimal("0"), o_qty - o_closed - o_canc)
            allocated_qty += active_line_qty

            # Amount allocation
            if o_line.line_total:
                # Proportional to active line qty
                if o_qty > 0:
                    allocated_amt += (Decimal(str(o_line.line_total)) * active_line_qty) / o_qty
                else:
                    allocated_amt += Decimal(str(o_line.line_total))
            else:
                allocated_amt += active_line_qty * unit_price

        rem_qty = max(Decimal("0"), committed_qty - allocated_qty)
        rem_amt = max(Decimal("0"), line_total - allocated_amt)

        line_data[str(line.id)] = {
            "committed_quantity": committed_qty,
            "allocated_quantity": allocated_qty,
            "remaining_quantity": rem_qty,
            "line_total": line_total,
            "allocated_amount": allocated_amt,
            "remaining_amount": rem_amt,
        }

    # Contract level summary
    if contract.value_type == models.ContractValueType.LIMIT:
        limit = Decimal(str(contract.contract_limit or contract.maximum_value or 0))
        allocated_amount = (
            active_orders.aggregate(tot=Sum("total_amount"))["tot"] or Decimal("0")
        )
        remaining_limit = max(Decimal("0"), limit - allocated_amount)
        summary = {
            "value_type": models.ContractValueType.LIMIT,
            "contract_limit": limit,
            "allocated_amount": allocated_amount,
            "remaining_limit": remaining_limit,
            "lines": line_data,
        }
    else:
        total_committed = Decimal(str(contract.total_amount or 0))
        total_allocated = sum((d["allocated_amount"] for d in line_data.values()), Decimal("0"))
        total_remaining = max(Decimal("0"), total_committed - total_allocated)
        summary = {
            "value_type": models.ContractValueType.FIXED,
            "total_amount": total_committed,
            "allocated_amount": total_allocated,
            "remaining_amount": total_remaining,
            "lines": line_data,
        }

    return summary


@transaction.atomic
def save_contract(request, company, data, instance=None):
    """
    Create or update a SalesContract enforcing all validation and business rules:
    - BR-SAL-12-01: Company and branch scope checks
    - BR-SAL-12-02: Unique contract_number, customer, signers
    - BR-SAL-12-03: Dates, value > 0, at least 1 line for FIXED
    - BR-SAL-12-08, EF-09: No direct edit of SIGNED contracts
    - EF-10, BR-SAL-12-14: Optimistic concurrency locking
    """
    actor = actor_for(request)
    if not actor:
        raise PermissionDenied("Không tìm thấy tài khoản người dùng.")

    # Optimistic locking check for update (EF-10)
    if instance:
        req_version = data.get("version")
        if req_version is not None and int(req_version) != instance.version:
            raise ValidationError({
                "version": "Hợp đồng vừa được người khác cập nhật. Vui lòng tải lại trang (EF-10)."
            })
        if instance.status == models.DocumentStatus.SIGNED:
            raise ValidationError(
                "Không được sửa trực tiếp nội dung hợp đồng Đã ký. Vui lòng lập phụ lục hợp đồng (BR-SAL-12-08, EF-09)."
            )
        if instance.status not in (
            models.DocumentStatus.DRAFT,
            models.DocumentStatus.REVISION_REQUIRED,
            models.DocumentStatus.REJECTED,
        ):
            raise ValidationError(
                f"Không thể chỉnh sửa hợp đồng ở trạng thái '{instance.get_status_display()}' (AF-03)."
            )

    # 1. Validate contract_number (BR-SAL-12-02, EF-02)
    contract_number = str(data.get("contract_number") or "").strip()
    if not contract_number:
        raise ValidationError({"contract_number": "Số hợp đồng là bắt buộc (BR-SAL-12-02)."})
    
    dup_qs = models.SalesContract.objects.filter(company=company, contract_number=contract_number)
    if instance:
        dup_qs = dup_qs.exclude(pk=instance.pk)
    if dup_qs.exists():
        raise ValidationError({"contract_number": "Số hợp đồng đã tồn tại trong doanh nghiệp (BR-SAL-12-02, EF-02)."})

    # 2. Title (Table 2.1)
    title = str(data.get("title") or "").strip()
    if not title:
        raise ValidationError({"title": "Tên hợp đồng là bắt buộc."})

    # 3. Customer (BR-SAL-12-02)
    customer_id = data.get("customer") or (data.get("customer_id") if isinstance(data, dict) else None)
    if not customer_id and instance:
        customer_id = instance.customer_id
    if not customer_id:
        raise ValidationError({"customer": "Khách hàng là bắt buộc."})
    
    from master_data.models import Party
    customer = Party.objects.filter(pk=customer_id, company=company).first()
    if not customer:
        raise ValidationError({"customer": "Khách hàng không tồn tại hoặc không thuộc doanh nghiệp."})
    if getattr(customer, "status", "ACTIVE") != "ACTIVE":
        raise ValidationError({"customer": "Khách hàng phải đang hoạt động."})

    # 4. Signer info on both sides (BR-SAL-12-02)
    cust_rep = str(data.get("customer_representative") or (instance.customer_representative if instance else "")).strip()
    cust_rep_pos = str(data.get("customer_representative_position") or (instance.customer_representative_position if instance else "")).strip()
    if not cust_rep:
        # Prepopulate from customer default contact if available
        default_contact = (
            customer.contacts.filter(status="ACTIVE").order_by("-is_default", "id").first()
            if hasattr(customer, "contacts")
            else None
        )
        if default_contact:
            cust_rep = default_contact.contact_name or ""
            cust_rep_pos = getattr(default_contact, "job_title", "") or getattr(default_contact, "position", "") or cust_rep_pos
    if not cust_rep:
        raise ValidationError({"customer_representative": "Người đại diện khách hàng là bắt buộc (BR-SAL-12-02)."})
    if not cust_rep_pos:
        raise ValidationError({"customer_representative_position": "Chức vụ người đại diện khách hàng là bắt buộc (BR-SAL-12-02)."})

    company_signer_id = data.get("company_signer") or (instance.company_signer_id if instance else None)
    company_signer_name = str(data.get("company_signer_name") or (instance.company_signer_name if instance else "")).strip()
    company_signer_pos = str(data.get("company_signer_position") or (instance.company_signer_position if instance else "")).strip()
    
    company_signer = None
    if company_signer_id:
        from organization.models import Employee
        company_signer = Employee.objects.filter(pk=company_signer_id, company=company).first()
        if not company_signer:
            raise ValidationError({"company_signer": "Người ký phía doanh nghiệp không tồn tại."})
        if not company_signer_name:
            company_signer_name = company_signer.full_name
        if not company_signer_pos and company_signer.position:
            company_signer_pos = company_signer.position.name
    elif not company_signer_name:
        raise ValidationError({"company_signer": "Người ký phía doanh nghiệp là bắt buộc (BR-SAL-12-02)."})
    if not company_signer_pos:
        raise ValidationError({"company_signer_position": "Chức vụ người ký phía doanh nghiệp là bắt buộc (BR-SAL-12-02)."})

    # 5. Assigned Employee (Table 2.1)
    assigned_employee_id = data.get("assigned_employee")
    assigned_employee = None
    if assigned_employee_id:
        from organization.models import Employee
        assigned_employee = Employee.objects.filter(pk=assigned_employee_id, company=company).first()
        if not assigned_employee:
            raise ValidationError({"assigned_employee": "Nhân viên phụ trách không tồn tại trong doanh nghiệp."})
    elif not instance:
        # Default to employee linked with current user if active
        user_emp = getattr(actor, "employee", None)
        if user_emp and user_emp.status == "ACTIVE" and user_emp.company_id == company.id:
            assigned_employee = user_emp

    # 6. Branch
    branch_id = data.get("branch") or (instance.branch_id if instance else None)
    branch = None
    if branch_id:
        from organization.models import Branch
        branch = Branch.objects.filter(pk=branch_id, company=company).first()
        if not branch:
            raise ValidationError({"branch": "Chi nhánh phải thuộc cùng doanh nghiệp."})

    # 7. Dates (BR-SAL-12-03, EF-03)
    start_date = data.get("start_date") or (instance.start_date if instance else None)
    end_date = data.get("end_date") or (instance.end_date if instance else None)
    if not start_date or not end_date:
        raise ValidationError({"dates": "Ngày bắt đầu và ngày kết thúc hợp đồng là bắt buộc."})
    if isinstance(start_date, str):
        start_date = date.fromisoformat(start_date)
    if isinstance(end_date, str):
        end_date = date.fromisoformat(end_date)
    if end_date < start_date:
        raise ValidationError({"end_date": "Ngày kết thúc không được trước ngày bắt đầu (BR-SAL-12-03, EF-03)."})

    # 8. Currency
    currency_id = data.get("currency") or (instance.currency_id if instance else None)
    from master_data.models import Currency
    if currency_id:
        currency = Currency.objects.filter(pk=currency_id).first()
    else:
        currency = Currency.objects.filter(code="VND").first()
    if not currency:
        raise ValidationError({"currency": "Loại tiền không hợp lệ."})

    exchange_rate = Decimal(str(data.get("exchange_rate") or (instance.exchange_rate if instance else "1")))
    if exchange_rate <= 0:
        raise ValidationError({"exchange_rate": "Tỷ giá phải lớn hơn 0."})

    # 9. Payment & Delivery terms (Table 2.1)
    payment_terms_text = str(data.get("payment_terms_text") or (instance.payment_terms_text if instance else "")).strip()
    if not payment_terms_text:
        raise ValidationError({"payment_terms_text": "Điều khoản thanh toán là bắt buộc (Table 2.1)."})

    delivery_terms = str(data.get("delivery_terms") or (instance.delivery_terms if instance else "")).strip()
    if not delivery_terms:
        raise ValidationError({"delivery_terms": "Điều kiện giao hàng/nghiệm thu là bắt buộc (Table 2.1)."})

    payment_term_id = data.get("payment_term") or (instance.payment_term_id if instance else None)
    payment_term = None
    if payment_term_id:
        from master_data.models import PaymentTerm
        payment_term = PaymentTerm.objects.filter(pk=payment_term_id, company=company).first()

    # 10. Value Type & Amounts (BR-SAL-12-03)
    value_type = data.get("value_type") or (instance.value_type if instance else models.ContractValueType.FIXED)
    if value_type not in (models.ContractValueType.FIXED, models.ContractValueType.LIMIT):
        raise ValidationError({"value_type": "Hình thức giá trị không hợp lệ."})

    raw_lines = data.get("lines")
    if raw_lines is None and instance:
        raw_lines = None  # keep lines

    subtotal = Decimal("0")
    discount_amount = Decimal("0")
    tax_amount = Decimal("0")
    total_amount = Decimal("0")
    contract_limit = None
    parsed_lines = []

    if value_type == models.ContractValueType.LIMIT:
        limit_val = data.get("contract_limit") or data.get("maximum_value")
        if limit_val is None and instance:
            limit_val = instance.contract_limit or instance.maximum_value
        if limit_val is None or Decimal(str(limit_val)) <= 0:
            raise ValidationError({"contract_limit": "Hạn mức hợp đồng phải lớn hơn 0 (BR-SAL-12-03, EF-03)."})
        contract_limit = Decimal(str(limit_val))
        total_amount = contract_limit
    else:
        # FIXED: must have at least one line (BR-SAL-12-03)
        if raw_lines is not None and len(raw_lines) == 0:
            raise ValidationError({"lines": "Hợp đồng giá trị cố định phải có ít nhất một dòng hợp lệ (BR-SAL-12-03)."})
        if not instance and raw_lines is None:
            raise ValidationError({"lines": "Hợp đồng giá trị cố định phải có ít nhất một dòng hợp lệ (BR-SAL-12-03)."})

    # Parse and validate lines if provided
    if raw_lines is not None:
        from master_data.models import Item, UnitOfMeasure, TaxRate
        for index, row in enumerate(raw_lines, 1):
            item_id = row.get("item") or row.get("item_id")
            item = Item.objects.filter(pk=item_id, company=company).first()
            if not item:
                raise ValidationError({"lines": f"Dòng {index}: Hàng hóa/dịch vụ không tồn tại."})
            if getattr(item, "status", "ACTIVE") != "ACTIVE":
                raise ValidationError({"lines": f"Dòng {index}: Hàng hóa/dịch vụ phải đang hoạt động."})

            uom_id = row.get("uom") or row.get("uom_id") or getattr(item, "sales_uom_id", None) or getattr(item, "base_uom_id", None)
            uom = UnitOfMeasure.objects.filter(pk=uom_id).first()
            if not uom:
                raise ValidationError({"lines": f"Dòng {index}: Đơn vị tính không hợp lệ."})

            qty = Decimal(str(row.get("quantity") or row.get("maximum_quantity") or 0))
            if value_type == models.ContractValueType.FIXED and qty <= 0:
                raise ValidationError({"lines": f"Dòng {index}: Số lượng cam kết phải lớn hơn 0 (BR-SAL-12-03)."})

            price = Decimal(str(row.get("unit_price") or 0))
            if price < 0:
                raise ValidationError({"lines": f"Dòng {index}: Đơn giá không được âm."})

            disc_rate = Decimal(str(row.get("discount_rate") or 0))
            if disc_rate < 0 or disc_rate > 100:
                raise ValidationError({"lines": f"Dòng {index}: Tỷ lệ chiết khấu phải từ 0% đến 100%."})

            line_gross = qty * price
            line_disc = Decimal(str(row.get("discount_amount") or (line_gross * disc_rate / Decimal("100"))))
            if line_disc > line_gross:
                raise ValidationError({"lines": f"Dòng {index}: Tiền chiết khấu không được vượt thành tiền của dòng."})

            tax_rate_id = row.get("tax_rate") or row.get("tax_rate_id") or getattr(item, "tax_rate_id", None)
            tax_rate = TaxRate.objects.filter(pk=tax_rate_id).first() if tax_rate_id else None
            rate_val = Decimal(str(getattr(tax_rate, "rate_percent", None) if getattr(tax_rate, "rate_percent", None) is not None else (getattr(tax_rate, "rate", 0) or 0)))
            line_tax = Decimal(str(row.get("tax_amount") or ((line_gross - line_disc) * rate_val / Decimal("100"))))
            line_tot = line_gross - line_disc + line_tax

            # Check expected delivery date (Table 2.2, EF-03)
            exp_date = row.get("expected_delivery_date")
            if exp_date:
                if isinstance(exp_date, str):
                    exp_date = date.fromisoformat(exp_date)
                if exp_date < start_date or exp_date > end_date:
                    raise ValidationError({
                        "lines": f"Dòng {index}: Ngày giao dự kiến phải nằm trong thời gian thực hiện hợp đồng [{start_date} - {end_date}]."
                    })

            quotation_line_id = row.get("quotation_line") or row.get("quotation_line_id")

            parsed_lines.append({
                "line_no": row.get("line_no", index),
                "item": item,
                "description": row.get("description") or item.name,
                "uom": uom,
                "quantity": qty,
                "maximum_quantity": qty,
                "unit_price": price,
                "discount_rate": disc_rate,
                "discount_amount": line_disc,
                "tax_rate": tax_rate,
                "tax_amount": line_tax,
                "line_total": line_tot,
                "expected_delivery_date": exp_date,
                "quotation_line_id": quotation_line_id,
            })

            subtotal += (line_gross - line_disc)
            discount_amount += line_disc
            tax_amount += line_tax
            if value_type == models.ContractValueType.FIXED:
                total_amount += line_tot

    if value_type == models.ContractValueType.FIXED:
        if raw_lines is not None and total_amount <= 0:
            raise ValidationError({"lines": "Tổng giá trị hợp đồng cố định phải lớn hơn 0 (BR-SAL-12-03)."})

    # Source quotation check (Table 2.1, AF-02)
    quotation_id = data.get("quotation") or (instance.quotation_id if instance else None)
    quotation = None
    if quotation_id:
        quotation = models.SalesQuotation.objects.filter(pk=quotation_id, company=company).first()
        if not quotation:
            raise ValidationError({"quotation": "Báo giá nguồn không tồn tại."})
        if quotation.customer_id != customer.id:
            raise ValidationError({"quotation": "Báo giá nguồn phải thuộc cùng khách hàng với hợp đồng (BR-SAL-12-02)."})

    # Construct / update contract record
    before_data = {}
    if instance:
        before_data = {
            "title": instance.title,
            "status": instance.status,
            "contract_number": instance.contract_number,
            "total_amount": str(instance.total_amount),
            "version": instance.version,
        }
        contract = instance
        contract.version += 1
    else:
        doc_date = data.get("document_date") or timezone.localdate()
        if isinstance(doc_date, str):
            doc_date = date.fromisoformat(doc_date)
        internal_code = generate_contract_code(company, doc_date)
        contract = models.SalesContract(
            company=company,
            number=internal_code,
            document_date=doc_date,
            created_by=actor,
            status=models.DocumentStatus.DRAFT,
            version=1,
        )

    # Assign fields
    contract.contract_number = contract_number
    contract.title = title
    contract.branch = branch
    contract.customer = customer
    contract.customer_representative = cust_rep
    contract.customer_representative_position = cust_rep_pos
    contract.company_signer = company_signer
    contract.company_signer_name = company_signer_name
    contract.company_signer_position = company_signer_pos
    contract.assigned_employee = assigned_employee
    contract.quotation = quotation
    contract.start_date = start_date
    contract.end_date = end_date
    contract.currency = currency
    contract.exchange_rate = exchange_rate
    contract.value_type = value_type
    contract.contract_limit = contract_limit
    contract.maximum_value = contract_limit or total_amount
    contract.payment_terms_text = payment_terms_text
    contract.payment_term = payment_term
    contract.delivery_terms = delivery_terms
    contract.notes = data.get("notes") or contract.notes or ""
    contract.attachments = data.get("attachments") or contract.attachments or []
    
    if value_type == models.ContractValueType.LIMIT:
        contract.total_amount = contract_limit
        if raw_lines is not None:
            contract.subtotal = subtotal
            contract.discount_amount = discount_amount
            contract.tax_amount = tax_amount
    elif raw_lines is not None:
        contract.subtotal = subtotal
        contract.discount_amount = discount_amount
        contract.tax_amount = tax_amount
        contract.total_amount = total_amount

    contract.save()

    # Recreate lines if new lines provided
    if raw_lines is not None:
        contract.lines.all().delete()
        for l_data in parsed_lines:
            models.SalesContractLine.objects.create(
                contract=contract,
                line_no=l_data["line_no"],
                item=l_data["item"],
                description=l_data["description"],
                uom=l_data["uom"],
                quantity=l_data["quantity"],
                maximum_quantity=l_data["maximum_quantity"],
                unit_price=l_data["unit_price"],
                discount_rate=l_data["discount_rate"],
                discount_amount=l_data["discount_amount"],
                tax_rate=l_data["tax_rate"],
                tax_amount=l_data["tax_amount"],
                line_total=l_data["line_total"],
                expected_delivery_date=l_data["expected_delivery_date"],
                quotation_line_id=l_data["quotation_line_id"],
            )

    action = "EDIT" if instance else "CREATE"
    after_data = {
        "title": contract.title,
        "status": contract.status,
        "contract_number": contract.contract_number,
        "total_amount": str(contract.total_amount),
        "version": contract.version,
    }
    audit_contract(request, contract, action, before_data, after_data)

    return contract


@transaction.atomic
def create_from_quotation(request, company, quotation_id, extra_data=None):
    """
    Create a SalesContract initialized from an ACCEPTED or APPROVED SalesQuotation (AF-02).
    Prefills customer, currency, branch, items, rates, discounts, taxes.
    """
    actor = actor_for(request)
    extra = extra_data or {}

    quotation = (
        models.SalesQuotation.objects.filter(pk=quotation_id, company=company)
        .prefetch_related("lines__item", "lines__uom", "lines__tax_rate")
        .first()
    )
    if not quotation:
        raise NotFound("Báo giá nguồn không tồn tại.")
    if quotation.status not in (
        models.DocumentStatus.ACCEPTED,
        models.DocumentStatus.APPROVED,
        models.DocumentStatus.SENT,
    ):
        raise ValidationError("Báo giá phải ở trạng thái được chấp thuận để lập hợp đồng (AF-02).")

    # Inherit data
    data = {
        "contract_number": extra.get("contract_number"),
        "title": extra.get("title") or f"Hợp đồng bán hàng theo báo giá {quotation.number}",
        "customer": quotation.customer_id,
        "branch": quotation.branch_id,
        "currency": quotation.currency_id,
        "exchange_rate": str(quotation.exchange_rate),
        "start_date": extra.get("start_date") or timezone.localdate().isoformat(),
        "end_date": extra.get("end_date") or (timezone.localdate() + timezone.timedelta(days=365)).isoformat(),
        "payment_terms_text": extra.get("payment_terms_text") or quotation.payment_terms_text or "Thanh toán theo tiến độ thỏa thuận.",
        "delivery_terms": extra.get("delivery_terms") or quotation.delivery_terms or "Giao hàng tại địa điểm chỉ định.",
        "customer_representative": extra.get("customer_representative"),
        "customer_representative_position": extra.get("customer_representative_position"),
        "company_signer": extra.get("company_signer"),
        "company_signer_name": extra.get("company_signer_name"),
        "company_signer_position": extra.get("company_signer_position"),
        "quotation": quotation.id,
        "value_type": models.ContractValueType.FIXED,
        "lines": [],
    }

    # Inherit lines
    for index, q_line in enumerate(quotation.lines.all(), 1):
        data["lines"].append({
            "line_no": index,
            "item": q_line.item_id,
            "description": q_line.description or q_line.item.name,
            "uom": q_line.uom_id or q_line.item.sales_uom_id or q_line.item.base_uom_id,
            "quantity": str(q_line.quantity or 1),
            "unit_price": str(q_line.unit_price or 0),
            "discount_rate": str(q_line.discount_rate or 0),
            "tax_rate": q_line.tax_rate_id,
            "quotation_line": q_line.id,
        })

    # Merge any other extra overrides
    for k, v in extra.items():
        if k not in ("lines",) and v is not None:
            data[k] = v

    contract = save_contract(request, company, data)
    return contract


@transaction.atomic
def submit_contract(request, contract):
    """
    Submit contract for internal approval workflow (Step 7, BR-SAL-08).
    Transitions DRAFT / REVISION_REQUIRED / REJECTED -> PENDING_APPROVAL or APPROVED.
    """
    contract = models.SalesContract.objects.select_for_update().get(pk=contract.pk)
    if contract.status not in (
        models.DocumentStatus.DRAFT,
        models.DocumentStatus.REVISION_REQUIRED,
        models.DocumentStatus.REJECTED,
    ):
        raise ValidationError(f"Trạng thái '{contract.get_status_display()}' không cho phép gửi duyệt.")

    configured = configured_snapshot(contract, "SAL.CONTRACT")
    if configured is not None:
        contract.workflow_snapshot = configured
        contract.approval_required = configured.get("approval_required", True)

    before = contract.status
    if contract.approval_required:
        contract.status = models.DocumentStatus.PENDING_APPROVAL
    else:
        contract.status = models.DocumentStatus.APPROVED
        contract.approved_at = timezone.now()

    contract.submitted_at = timezone.now()
    contract.save(update_fields=["status", "approval_required", "workflow_snapshot", "submitted_at", "approved_at", "updated_at"])

    actor = actor_for(request)
    models.ApprovalDecision.objects.create(
        company=contract.company,
        document_type="CONTRACT",
        document_id=contract.pk,
        decision="SUBMITTED",
        actor=actor,
        comment=request.data.get("comment", ""),
    )
    audit_contract(request, contract, "SUBMIT", {"status": before}, {"status": contract.status})
    return contract


@transaction.atomic
def revoke_contract_submission(request, contract, reason=""):
    """
    Revoke pending approval submission back to DRAFT (AF-03).
    """
    contract = models.SalesContract.objects.select_for_update().get(pk=contract.pk)
    if contract.status != models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Chỉ có thể thu hồi hợp đồng đang Chờ duyệt (AF-03).")

    before = contract.status
    contract.status = models.DocumentStatus.DRAFT
    contract.withdrawal_reason = reason
    contract.save(update_fields=["status", "withdrawal_reason", "updated_at"])

    actor = actor_for(request)
    models.ApprovalDecision.objects.create(
        company=contract.company,
        document_type="CONTRACT",
        document_id=contract.pk,
        decision="WITHDRAWN",
        actor=actor,
        comment=reason,
    )
    audit_contract(request, contract, "REVOKE", {"status": before}, {"status": contract.status}, reason)
    return contract


@transaction.atomic
def return_contract_to_draft(request, contract):
    """
    Revert an APPROVED contract back to DRAFT for amendment and re-approval (Status table: Đã duyệt).
    """
    contract = models.SalesContract.objects.select_for_update().get(pk=contract.pk)
    if contract.status != models.DocumentStatus.APPROVED:
        raise ValidationError("Chỉ hợp đồng Đã duyệt được đưa về Nháp để sửa (Trạng thái table).")

    before = contract.status
    contract.status = models.DocumentStatus.DRAFT
    contract.save(update_fields=["status", "updated_at"])
    audit_contract(request, contract, "RETURN_TO_DRAFT", {"status": before}, {"status": contract.status})
    return contract


@transaction.atomic
def sign_contract(request, contract, signed_date, signed_file):
    """
    Record execution / signing of contract (Step 8-9, BR-SAL-12-04, EF-04).
    Validates mandatory signed_date and signed_file.
    Allowed from APPROVED (or DRAFT if workflow is not used).
    """
    contract = models.SalesContract.objects.select_for_update().get(pk=contract.pk)
    
    if contract.status not in (models.DocumentStatus.APPROVED, models.DocumentStatus.DRAFT):
        raise ValidationError(
            f"Hợp đồng ở trạng thái '{contract.get_status_display()}' không thể ghi nhận ký kết (Step 8-9)."
        )

    # Validate signed_date (EF-04, BR-SAL-12-04)
    if not signed_date:
        raise ValidationError({"signed_date": "Ngày ký là bắt buộc khi ghi nhận ký kết (BR-SAL-12-04, EF-04)."})
    if isinstance(signed_date, str):
        try:
            signed_date = date.fromisoformat(signed_date)
        except (ValueError, TypeError):
            raise ValidationError({"signed_date": "Ngày ký không hợp lệ."})

    # Validate signed_file (EF-04, BR-SAL-12-04)
    if not signed_file or (isinstance(signed_file, dict) and not signed_file.get("url") and not signed_file.get("name")):
        raise ValidationError({"signed_file": "Tệp hợp đồng đã ký là bắt buộc khi ghi nhận ký kết (BR-SAL-12-04, EF-04)."})

    before = contract.status
    contract.status = models.DocumentStatus.SIGNED
    contract.signed_date = signed_date
    contract.signed_file = signed_file if isinstance(signed_file, dict) else {"url": str(signed_file)}
    contract.save(update_fields=["status", "signed_date", "signed_file", "updated_at"])

    audit_contract(
        request,
        contract,
        "SIGN",
        {"status": before},
        {"status": contract.status, "signed_date": str(signed_date)},
    )
    return contract


@transaction.atomic
def create_annex(request, contract, data):
    """
    Create an annex for a SIGNED contract (AF-06, BR-SAL-12-08, BR-SAL-12-10, EF-08).
    """
    actor = actor_for(request)
    contract = models.SalesContract.objects.select_for_update().get(pk=contract.pk)

    if contract.status != models.DocumentStatus.SIGNED:
        raise ValidationError("Chỉ được lập phụ lục cho hợp đồng Đã ký (AF-06, BR-SAL-12-08).")

    annex_number = str(data.get("annex_number") or "").strip()
    if not annex_number:
        raise ValidationError({"annex_number": "Số phụ lục là bắt buộc."})
    if contract.annexes.filter(annex_number=annex_number).exists():
        raise ValidationError({"annex_number": "Số phụ lục đã tồn tại trong hợp đồng này."})

    change_content = str(data.get("change_content") or "").strip()
    if not change_content:
        raise ValidationError({"change_content": "Nội dung thay đổi là bắt buộc."})

    new_end_date = data.get("new_end_date")
    if new_end_date:
        if isinstance(new_end_date, str):
            new_end_date = date.fromisoformat(new_end_date)
        if new_end_date < contract.start_date:
            raise ValidationError({"new_end_date": "Ngày kết thúc mới không được trước ngày bắt đầu hợp đồng."})

    allocations = calculate_contract_allocations(contract)

    # Validate new_contract_limit cannot reduce below currently allocated amount (BR-SAL-12-10, EF-08)
    new_contract_limit = data.get("new_contract_limit")
    if new_contract_limit is not None:
        new_contract_limit = Decimal(str(new_contract_limit))
        if new_contract_limit <= 0:
            raise ValidationError({"new_contract_limit": "Hạn mức mới phải lớn hơn 0."})
        allocated_amt = allocations["allocated_amount"]
        if new_contract_limit < allocated_amt:
            raise ValidationError({
                "new_contract_limit": f"Phụ lục không được giảm hạn mức ({new_contract_limit:,.0f}) xuống dưới phần đang ràng buộc ({allocated_amt:,.0f}) (BR-SAL-12-10, EF-08)."
            })

    # Validate line adjustments (BR-SAL-12-10, EF-08)
    line_adjustments = data.get("line_adjustments") or []
    for adj in line_adjustments:
        line_id = str(adj.get("line_id"))
        line_alloc = allocations["lines"].get(line_id)
        if not line_alloc:
            raise ValidationError({"line_adjustments": f"Dòng hợp đồng {line_id} không tồn tại."})
        new_qty = adj.get("new_quantity")
        if new_qty is not None:
            new_qty = Decimal(str(new_qty))
            if new_qty < line_alloc["allocated_quantity"]:
                raise ValidationError({
                    "line_adjustments": f"Số lượng điều chỉnh ({new_qty}) nhỏ hơn số lượng đã phân bổ ({line_alloc['allocated_quantity']}) trên dòng {line_id} (BR-SAL-12-10, EF-08)."
                })

    annex = models.SalesContractAnnex.objects.create(
        contract=contract,
        annex_number=annex_number,
        change_content=change_content,
        new_end_date=new_end_date,
        new_contract_limit=new_contract_limit,
        line_adjustments=line_adjustments,
        notes=data.get("notes") or "",
        status=models.AnnexStatus.DRAFT,
        created_by=actor,
    )
    audit_contract(request, annex, "ANNEX_CREATE", {}, {"annex_number": annex.annex_number})
    return annex


@transaction.atomic
def sign_annex(request, annex, signed_date, effective_date, signed_file):
    """
    Sign and activate an annex (AF-06, BR-SAL-12-09).
    Applies modifications to the contract when effective date arrives.
    """
    annex = models.SalesContractAnnex.objects.select_for_update().get(pk=annex.pk)
    contract = annex.contract

    if not effective_date:
        raise ValidationError({"effective_date": "Ngày hiệu lực của phụ lục là bắt buộc."})
    if isinstance(effective_date, str):
        effective_date = date.fromisoformat(effective_date)

    if not signed_date:
        signed_date = timezone.localdate()
    elif isinstance(signed_date, str):
        signed_date = date.fromisoformat(signed_date)

    if not signed_file:
        raise ValidationError({"signed_file": "Tệp phụ lục đã ký là bắt buộc."})

    annex.signed_date = signed_date
    annex.effective_date = effective_date
    annex.signed_file = signed_file if isinstance(signed_file, dict) else {"url": str(signed_file)}
    annex.status = models.AnnexStatus.SIGNED

    # Apply adjustments if effective on or before today (BR-SAL-12-09)
    today = timezone.localdate()
    if effective_date <= today:
        apply_annex_changes(contract, annex)
        annex.applied_at = timezone.now()

    annex.save()
    audit_contract(
        request,
        annex,
        "ANNEX_SIGN",
        {"status": models.AnnexStatus.DRAFT},
        {"status": annex.status, "effective_date": str(effective_date)},
    )
    return annex


def apply_annex_changes(contract, annex):
    """Apply verified changes from an active signed annex to the contract."""
    contract = models.SalesContract.objects.select_for_update().get(pk=contract.pk)
    
    if annex.new_end_date:
        contract.end_date = annex.new_end_date

    if annex.new_contract_limit:
        contract.contract_limit = annex.new_contract_limit
        contract.maximum_value = annex.new_contract_limit
        if contract.value_type == models.ContractValueType.LIMIT:
            contract.total_amount = annex.new_contract_limit

    if annex.line_adjustments:
        for adj in annex.line_adjustments:
            line_id = adj.get("line_id")
            line = contract.lines.filter(pk=line_id).first()
            if line:
                if adj.get("new_quantity") is not None:
                    line.quantity = Decimal(str(adj["new_quantity"]))
                    line.maximum_quantity = line.quantity
                if adj.get("new_unit_price") is not None:
                    line.unit_price = Decimal(str(adj["new_unit_price"]))
                
                # Recalculate line total
                gross = line.quantity * (line.unit_price or Decimal("0"))
                disc = line.discount_amount or Decimal("0")
                tax = line.tax_amount or Decimal("0")
                line.line_total = gross - disc + tax
                line.save()

        # Recalculate total if fixed
        if contract.value_type == models.ContractValueType.FIXED:
            new_tot = contract.lines.aggregate(tot=Sum("line_total"))["tot"] or Decimal("0")
            contract.total_amount = new_tot

    contract.save()


def get_open_transactions(contract):
    """
    Inspect open obligations for liquidation/termination:
    - Open sales orders (not cancelled, not closed)
    - Open receivables
    - Open customer advances
    (AF-07, BR-SAL-12-11)
    """
    open_orders = (
        contract.orders.exclude(
            status__in=[models.DocumentStatus.CANCELLED, models.DocumentStatus.CLOSED]
        )
        .values("id", "number", "document_date", "status", "total_amount")
    )
    
    # Check open receivables
    open_receivables = []
    if hasattr(contract, "receivables"):
        try:
            rc_mgr = getattr(contract, "receivables")
            rc_model = getattr(rc_mgr, "model", None)
            if rc_model and hasattr(rc_model, "balance"):
                open_receivables = list(rc_mgr.filter(balance__gt=0).values("id", "number", "balance", "status"))
            elif rc_model and hasattr(rc_model, "remaining_amount"):
                open_receivables = list(rc_mgr.filter(remaining_amount__gt=0).values("id", "number", "remaining_amount", "status"))
        except Exception:
            pass

    # Check open advances
    open_advances = []
    if hasattr(contract, "advances"):
        try:
            adv_mgr = getattr(contract, "advances")
            adv_model = getattr(adv_mgr, "model", None)
            if adv_model and hasattr(adv_model, "remaining_amount"):
                open_advances = list(adv_mgr.filter(remaining_amount__gt=0).values("id", "number", "remaining_amount"))
            elif adv_model and hasattr(adv_model, "balance"):
                open_advances = list(adv_mgr.filter(balance__gt=0).values("id", "number", "balance"))
        except Exception:
            pass

    return {
        "has_open": bool(open_orders.exists() or open_receivables or open_advances),
        "open_orders_count": open_orders.count(),
        "open_orders": list(open_orders),
        "open_receivables_count": len(open_receivables),
        "open_receivables": open_receivables,
        "open_advances_count": len(open_advances),
        "open_advances": open_advances,
    }


@transaction.atomic
def liquidate_contract(request, contract, liquidation_date, reason, liquidation_file=None, open_settlement_notes=""):
    """
    Liquidate an active contract (AF-07, BR-SAL-12-11).
    Contract must be SIGNED.
    Does NOT cancel open orders or delete receivables automatically (BR-SAL-12-11).
    Mandates settlement notes if open transactions exist.
    """
    contract = models.SalesContract.objects.select_for_update().get(pk=contract.pk)
    if contract.status != models.DocumentStatus.SIGNED:
        raise ValidationError("Chỉ hợp đồng Đã ký mới có thể thanh lý (AF-07, BR-SAL-12-13).")

    reason = str(reason or "").strip()
    if not reason:
        raise ValidationError({"reason": "Lý do thanh lý là bắt buộc (AF-07)."})

    open_items = get_open_transactions(contract)
    if open_items["has_open"] and not str(open_settlement_notes or "").strip():
        raise ValidationError({
            "open_settlement_notes": "Hợp đồng còn đơn bán hoặc công nợ mở; bắt buộc ghi rõ phương án xử lý từng khoản (AF-07, BR-SAL-12-11)."
        })

    before = contract.status
    contract.status = models.DocumentStatus.LIQUIDATED
    contract.liquidation_reason = reason
    contract.liquidated_at = timezone.now()
    if liquidation_file:
        contract.liquidation_file = liquidation_file if isinstance(liquidation_file, dict) else {"url": str(liquidation_file)}
    contract.open_settlement_notes = open_settlement_notes or ""
    contract.save(update_fields=["status", "liquidation_reason", "liquidated_at", "liquidation_file", "open_settlement_notes", "updated_at"])

    audit_contract(
        request,
        contract,
        "LIQUIDATE",
        {"status": before},
        {"status": contract.status},
        reason,
    )
    return contract


@transaction.atomic
def terminate_contract(request, contract, reason, open_settlement_notes=""):
    """
    Terminate an active contract early (AF-07, BR-SAL-12-11).
    Contract must be SIGNED.
    """
    contract = models.SalesContract.objects.select_for_update().get(pk=contract.pk)
    if contract.status != models.DocumentStatus.SIGNED:
        raise ValidationError("Chỉ hợp đồng Đã ký mới có thể chấm dứt (AF-07, BR-SAL-12-13).")

    reason = str(reason or "").strip()
    if not reason:
        raise ValidationError({"reason": "Lý do chấm dứt trước hạn là bắt buộc (AF-07)."})

    open_items = get_open_transactions(contract)
    if open_items["has_open"] and not str(open_settlement_notes or "").strip():
        raise ValidationError({
            "open_settlement_notes": "Hợp đồng còn đơn bán hoặc công nợ mở; bắt buộc ghi rõ phương án xử lý từng khoản (AF-07, BR-SAL-12-11)."
        })

    before = contract.status
    contract.status = models.DocumentStatus.TERMINATED
    contract.termination_reason = reason
    contract.terminated_at = timezone.now()
    contract.open_settlement_notes = open_settlement_notes or ""
    contract.save(update_fields=["status", "termination_reason", "terminated_at", "open_settlement_notes", "updated_at"])

    audit_contract(
        request,
        contract,
        "TERMINATE",
        {"status": before},
        {"status": contract.status},
        reason,
    )
    return contract


@transaction.atomic
def cancel_contract(request, contract, reason):
    """
    Cancel an unsigned contract (AF-08, BR-SAL-12-13).
    Signed contracts cannot be cancelled; they must be liquidated or terminated (BR-SAL-12-13).
    """
    contract = models.SalesContract.objects.select_for_update().get(pk=contract.pk)
    if contract.status == models.DocumentStatus.SIGNED:
        raise ValidationError("Hợp đồng đã ký không được hủy; phải thực hiện thanh lý hoặc chấm dứt (BR-SAL-12-13).")

    reason = str(reason or "").strip()
    if not reason:
        raise ValidationError({"reason": "Lý do hủy hợp đồng là bắt buộc (AF-08)."})

    before = contract.status
    contract.status = models.DocumentStatus.CANCELLED
    contract.cancellation_reason = reason
    contract.save(update_fields=["status", "cancellation_reason", "updated_at"])

    audit_contract(
        request,
        contract,
        "CANCEL",
        {"status": before},
        {"status": contract.status},
        reason,
    )
    return contract


@transaction.atomic
def delete_contract(request, contract):
    """
    Delete a contract (AF-08, BR-SAL-12-13).
    Only permitted for DRAFT contracts with no business links (no orders, no annexes).
    """
    contract = models.SalesContract.objects.select_for_update().get(pk=contract.pk)
    if contract.status != models.DocumentStatus.DRAFT:
        raise ValidationError("Chỉ được xóa hợp đồng ở trạng thái Nháp (AF-08, BR-SAL-12-13).")

    if contract.orders.exists():
        raise ValidationError("Không thể xóa hợp đồng đã có đơn bán liên kết (BR-SAL-12-13).")

    if contract.annexes.exists():
        raise ValidationError("Không thể xóa hợp đồng đã có phụ lục (BR-SAL-12-13).")

    code = contract.number
    audit_contract(request, contract, "DELETE", {"number": code}, {})
    contract.lines.all().delete()
    contract.delete()
    return True


def prepare_order_from_contract(contract, on_date=None):
    """
    Prepare SalesOrder prefill payload from a signed, effective contract (AF-05, BR-SAL-12-05, BR-SAL-12-06, EF-06, EF-07).
    """
    if contract.status != models.DocumentStatus.SIGNED:
        raise ValidationError("Chỉ được lập đơn bán từ hợp đồng Đã ký (BR-SAL-12-05, EF-06).")

    validity = get_contract_validity(contract, on_date)
    if validity != "EFFECTIVE":
        raise ValidationError(
            f"Hợp đồng đang ở trạng thái hiệu lực '{get_contract_validity_display(validity)}'; không thể lập đơn bán mới (BR-SAL-12-05, EF-06)."
        )

    allocations = calculate_contract_allocations(contract)

    # Check capacity
    if contract.value_type == models.ContractValueType.LIMIT:
        if allocations["remaining_limit"] <= 0:
            raise ValidationError("Hạn mức hợp đồng đã được phân bổ hết; không thể lập đơn bán mới (EF-07).")
    else:
        # Check if all lines are exhausted
        any_remaining = any(d["remaining_quantity"] > 0 for d in allocations["lines"].values())
        if not any_remaining:
            raise ValidationError("Tất cả các dòng hợp đồng đã được phân bổ hết số lượng cam kết (EF-07).")

    contact = (
        contract.customer.contacts.filter(status="ACTIVE").order_by("-is_default", "id").first()
        if hasattr(contract.customer, "contacts")
        else None
    )
    address = (
        contract.customer.addresses.order_by("-is_default", "id").values_list("address_line", flat=True).first()
        if hasattr(contract.customer, "addresses")
        else ""
    )
    if not address:
        address = getattr(contract.customer, "address", "") or getattr(contract.customer, "name", "")

    lines_out = []
    for c_line in contract.lines.all():
        line_alloc = allocations["lines"].get(str(c_line.id), {})
        rem_qty = line_alloc.get("remaining_quantity", Decimal("0"))
        if rem_qty > 0 or contract.value_type == models.ContractValueType.LIMIT:
            lines_out.append({
                "contract_line": str(c_line.id),
                "item": str(c_line.item_id),
                "item_code": c_line.item.code,
                "item_name": c_line.item.name,
                "description": c_line.description or c_line.item.name,
                "uom": str(c_line.uom_id),
                "uom_name": c_line.uom.name,
                "quantity": str(rem_qty) if rem_qty > 0 else "1",
                "unit_price": str(c_line.unit_price or 0),
                "discount_rate": str(c_line.discount_rate or 0),
                "tax_rate": str(c_line.tax_rate_id) if c_line.tax_rate_id else None,
                "remaining_quantity": str(rem_qty),
                "committed_quantity": str(line_alloc.get("committed_quantity", 0)),
            })

    return {
        "company": str(contract.company_id),
        "branch": str(contract.branch_id) if contract.branch_id else None,
        "customer": str(contract.customer_id),
        "customer_name": contract.customer.name,
        "currency": str(contract.currency_id),
        "currency_code": contract.currency.code,
        "contract": str(contract.id),
        "contract_number": contract.contract_number,
        "delivery_address": contract.delivery_terms or address,
        "customer_address": address,
        "contact_name": contact.contact_name if contact else contract.customer_representative,
        "contact_phone": contact.phone if contact else "",
        "contact_email": contact.email if contact else "",
        "payment_term": str(contract.payment_term_id) if contract.payment_term_id else None,
        "delivery_terms": contract.delivery_terms,
        "value_type": contract.value_type,
        "remaining_limit": str(allocations.get("remaining_limit", 0)) if contract.value_type == models.ContractValueType.LIMIT else None,
        "lines": lines_out,
    }
