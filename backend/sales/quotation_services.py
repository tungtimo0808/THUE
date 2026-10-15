"""UC-SAL-01 operations on quotations, without inventory or accounting effects."""
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.core.mail import EmailMessage
from django.db import transaction
from django.db.models import Max, Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from master_data.models import Currency, Item, Party, TaxRate, UnitOfMeasure
from . import models, services, serializers
from .quotation_pdf import render_quotation_pdf


def _date(value, field, missing):
    if not value:
        raise ValidationError({field: missing})
    try:
        return value if isinstance(value, date) else date.fromisoformat(str(value))
    except ValueError:
        raise ValidationError({field: "Ngày không hợp lệ."})


def _payload(company, data):
    payload = dict(data)
    if not payload.get("customer"):
        raise ValidationError({"customer": "Vui lòng chọn Khách hàng."})
    try:
        customer = Party.objects.get(pk=payload["customer"], company=company)
    except (Party.DoesNotExist, ValueError):
        raise ValidationError({"customer": "Khách hàng không hợp lệ."})
    quote_date = _date(payload.get("document_date", timezone.localdate()), "document_date", "Vui lòng nhập Ngày báo giá.")
    validity = models.SalesQuotationSettings.objects.filter(company=company).values_list("validity_days", flat=True).first() or 15
    valid_until = _date(payload.get("valid_until", quote_date + timedelta(days=validity)), "valid_until", "Vui lòng nhập Ngày hết hiệu lực.")
    if valid_until < quote_date:
        raise ValidationError({"valid_until": "Ngày hết hiệu lực không được nhỏ hơn Ngày báo giá."})
    currency_id = payload.get("currency")
    if currency_id is None:
        currency_id = Currency.objects.filter(code="VND", is_active=True).values_list("id", flat=True).first()
    if not currency_id:
        raise ValidationError({"currency": "Vui lòng chọn Loại tiền."})
    try:
        currency = Currency.objects.get(pk=currency_id, is_active=True)
    except (Currency.DoesNotExist, ValueError):
        raise ValidationError({"currency": "Loại tiền không hoạt động hoặc không tồn tại."})
    payload.update({"company": str(company.id), "document_date": quote_date.isoformat(),
                    "valid_until": valid_until.isoformat(), "currency": str(currency.id),
                    "title": payload.get("title") or f"Báo giá hàng hóa/dịch vụ cho {customer.name}"})
    if len(payload["title"]) > 255:
        raise ValidationError({"title": "Tiêu đề báo giá không được vượt quá 255 ký tự."})
    if len(str(payload.get("payment_terms_text", ""))) > 500 or len(str(payload.get("delivery_terms", ""))) > 500:
        raise ValidationError({"terms": "Điều khoản không được vượt quá 500 ký tự."})
    if len(str(payload.get("notes", ""))) > 1000:
        raise ValidationError({"notes": "Ghi chú không được vượt quá 1.000 ký tự."})
    return payload, customer, currency, quote_date


def _calc_lines(company, lines, quote_date, currency, strict):
    if not isinstance(lines, list) or not lines:
        raise ValidationError({"lines": "Vui lòng thêm ít nhất một hàng hóa hoặc dịch vụ."})
    quantum = Decimal(1).scaleb(-currency.decimal_places)
    totals = [Decimal("0")] * 4
    normalized = []
    for number, raw in enumerate(lines, 1):
        if not raw.get("item"):
            raise ValidationError({"lines": f"Vui lòng chọn Hàng hóa/Dịch vụ tại dòng {number}."})
        try:
            item = Item.objects.get(pk=raw["item"], company=company)
        except (Item.DoesNotExist, ValueError):
            raise ValidationError({"lines": f"Hàng hóa/Dịch vụ tại dòng {number} không hợp lệ."})
        if item.status != "ACTIVE" or not item.allow_sale:
            raise ValidationError({"lines": f"Hàng hóa/Dịch vụ tại dòng {number} đã ngừng hoạt động."})
        uom_id = raw.get("uom") or (item.sales_uom_id or item.base_uom_id)
        if not uom_id and strict:
            raise ValidationError({"lines": f"Vui lòng chọn Đơn vị tính tại dòng {number}."})
        uom = None
        if uom_id:
            try:
                uom = UnitOfMeasure.objects.get(pk=uom_id, company=company)
            except (UnitOfMeasure.DoesNotExist, ValueError):
                raise ValidationError({"lines": f"Đơn vị tính tại dòng {number} không hợp lệ."})
        quantity_raw = raw.get("quantity")
        if quantity_raw in (None, "") and strict:
            raise ValidationError({"lines": f"Vui lòng nhập Số lượng tại dòng {number}."})
        quantity = None
        if quantity_raw not in (None, ""):
            try:
                quantity = Decimal(str(quantity_raw))
            except Exception:
                raise ValidationError({"lines": f"Số lượng tại dòng {number} phải lớn hơn 0."})
            if not quantity.is_finite() or quantity <= 0 or quantity.as_tuple().exponent < -6:
                raise ValidationError({"lines": f"Số lượng tại dòng {number} phải lớn hơn 0 và tối đa 6 chữ số thập phân."})
        price_raw = raw.get("unit_price", item.sales_price)
        if price_raw in (None, "") and strict:
            raise ValidationError({"lines": f"Vui lòng nhập Đơn giá tại dòng {number}."})
        price = None
        if price_raw not in (None, ""):
            try:
                price = Decimal(str(price_raw))
            except Exception:
                raise ValidationError({"lines": f"Đơn giá tại dòng {number} không hợp lệ."})
            if not price.is_finite() or price < 0:
                raise ValidationError({"lines": f"Đơn giá tại dòng {number} không được nhỏ hơn 0."})
        try:
            discount = Decimal(str(raw.get("discount_rate", "0")))
        except Exception:
            discount = Decimal("-1")
        if not discount.is_finite() or not 0 <= discount <= 100:
            raise ValidationError({"lines": f"Tỷ lệ chiết khấu tại dòng {number} phải từ 0% đến 100%."})
        tax_id = raw.get("tax_rate") or item.sales_tax_rate_id or item.default_tax_rate_id
        if strict and not tax_id:
            raise ValidationError({"lines": f"Vui lòng chọn Thuế suất GTGT tại dòng {number}."})
        tax = None
        if tax_id:
            try:
                tax = TaxRate.objects.get(pk=tax_id, company=company, status="ACTIVE",
                                          effective_from__lte=quote_date)
            except (TaxRate.DoesNotExist, ValueError):
                if strict:
                    raise ValidationError({"lines": f"Thuế suất GTGT tại dòng {number} không hợp lệ."})
            if tax and ((tax.effective_to and tax.effective_to < quote_date) or tax.business_scope not in ("OUTPUT", "BOTH")):
                if strict:
                    raise ValidationError({"lines": f"Thuế suất GTGT tại dòng {number} không còn hiệu lực."})
                tax = None
        if quantity is not None and price is not None:
            gross = (quantity * price).quantize(quantum, rounding=ROUND_HALF_UP)
            discount_amount = (gross * discount / 100).quantize(quantum, rounding=ROUND_HALF_UP)
            before_tax = gross - discount_amount
            tax_amount = (before_tax * (tax.rate_percent or 0) / 100).quantize(quantum, rounding=ROUND_HALF_UP) if tax and tax.application_form == "PERCENT" else Decimal("0")
            for i, amount in enumerate((gross, discount_amount, tax_amount, before_tax+tax_amount)):
                totals[i] += amount
        normalized.append({"line_no": number, "item": str(item.id), "description": raw.get("description") or item.name,
                           "uom": str(uom.id) if uom else None, "quantity": str(quantity) if quantity is not None else None,
                           "unit_price": str(price) if price is not None else None,
                           "discount_rate": str(discount), "tax_rate": str(tax.id) if tax else None})
    return normalized, totals


def _number(company, year):
    counter, _ = models.SalesQuotationCounter.objects.select_for_update().get_or_create(company=company, year=year)
    counter.value += 1
    counter.save(update_fields=("value",))
    return f"BG-{year}-{counter.value:06d}"


def form_defaults(company, params):
    quote_date = _date(params.get("document_date", timezone.localdate()), "document_date", "Vui lòng nhập Ngày báo giá.")
    days = models.SalesQuotationSettings.objects.filter(company=company).values_list("validity_days", flat=True).first() or 15
    vnd = Currency.objects.filter(code="VND", is_active=True).first()
    result = {"document_date": quote_date.isoformat(), "valid_until": (quote_date + timedelta(days=days)).isoformat(),
              "currency_id": str(vnd.id) if vnd else None,
              "tax_rates": list(TaxRate.objects.filter(company=company, status="ACTIVE", effective_from__lte=quote_date)
                                .filter(Q(effective_to__isnull=True) | Q(effective_to__gte=quote_date))
                                .filter(business_scope__in=("OUTPUT", "BOTH"))
                                .values("id", "code", "name", "rate_percent", "application_form"))}
    customer_id = params.get("customer_id")
    if customer_id:
        try:
            customer = Party.objects.get(pk=customer_id, company=company, status="ACTIVE")
        except (Party.DoesNotExist, ValueError):
            raise ValidationError({"customer_id": "Khách hàng không hợp lệ."})
        contact = customer.contacts.filter(status="ACTIVE").order_by("-is_default", "id").first()
        address = customer.addresses.order_by("id").values_list("address_line", flat=True).first() or ""
        result["customer"] = {"id": str(customer.id), "name": customer.name,
                              "tax_code": customer.tax_code or "", "address": address,
                              "contact_name": contact.contact_name if contact else "",
                              "email": contact.email if contact else "", "phone": contact.phone if contact else ""}
        result["title"] = f"Báo giá hàng hóa/dịch vụ cho {customer.name}"
    item_id = params.get("item_id")
    if item_id:
        try:
            item = Item.objects.get(pk=item_id, company=company, status="ACTIVE", allow_sale=True)
        except (Item.DoesNotExist, ValueError):
            raise ValidationError({"item_id": "Hàng hóa/Dịch vụ không hợp lệ."})
        rate = item.sales_tax_rate or item.default_tax_rate
        if rate and (rate.status != "ACTIVE" or rate.effective_from > quote_date or
                     (rate.effective_to and rate.effective_to < quote_date) or rate.business_scope not in ("OUTPUT", "BOTH")):
            rate = None
        result["item"] = {"id": str(item.id), "name": item.name,
                          "uom_id": str(item.sales_uom_id or item.base_uom_id) if (item.sales_uom_id or item.base_uom_id) else None,
                          "unit_price": item.sales_price, "tax_rate_id": str(rate.id) if rate else None}
    return result


@transaction.atomic
def save_new(request, company, data, issue=False, original=None):
    payload, customer, currency, quote_date = _payload(company, data)
    if issue and date.fromisoformat(payload["valid_until"]) < timezone.localdate():
        raise ValidationError({"valid_until": "Báo giá đã hết hiệu lực."})
    if issue and customer.status != "ACTIVE":
        raise ValidationError({"customer": "Khách hàng đã ngừng hoạt động. Vui lòng chọn khách hàng khác."})
    lines, values = _calc_lines(company, payload.get("lines"), quote_date, currency, issue)
    payload["lines"] = lines
    payload["number"] = _number(company, quote_date.year)
    root_id = original.original_quotation_id or original.id if original else None
    if root_id:
        root = models.SalesQuotation.objects.select_for_update().get(pk=root_id)
        latest = models.SalesQuotation.objects.filter(original_quotation=root).aggregate(value=Max("version"))["value"] or root.version
        next_version = latest + 1
    else:
        next_version = 1
    payload["version"] = next_version
    payload["original_quotation"] = str(root_id) if root_id else None
    serializer = serializers.QuotationSerializer(data=payload, context={"request": request})
    serializer.is_valid(raise_exception=True)
    quote = serializer.save(created_by=request.user.iam_account)
    if original:
        quote.original_quotation_id = root_id
        quote.version = next_version
    quote.subtotal, quote.discount_amount, quote.tax_amount, quote.total_amount = values
    quote.fee_amount = 0
    if issue:
        quote.status = models.DocumentStatus.ISSUED
        quote.pdf_content = render_quotation_pdf(quote)
    quote.save(update_fields=("subtotal", "discount_amount", "tax_amount", "total_amount", "fee_amount", "status", "pdf_content", "original_quotation", "version", "updated_at"))
    services.audit(request, quote, "ISSUE" if issue else "CREATE", after={"number": quote.number,
                    "customer": str(customer.id), "total_amount": str(quote.total_amount), "status": quote.status})
    return quote


@transaction.atomic
def issue_draft(request, quote):
    quote = models.SalesQuotation.objects.select_for_update().select_related("customer", "currency").get(pk=quote.pk)
    if quote.status != models.DocumentStatus.DRAFT:
        raise ValidationError("Chỉ báo giá Nháp được phát hành.")
    data = {"company": str(quote.company_id), "customer": str(quote.customer_id),
            "document_date": str(quote.document_date), "valid_until": str(quote.valid_until),
            "currency": str(quote.currency_id), "title": quote.title, "payment_terms_text": quote.payment_terms_text,
            "delivery_terms": quote.delivery_terms, "notes": quote.notes,
            "lines": [{"item": str(line.item_id), "uom": str(line.uom_id), "quantity": str(line.quantity),
                       "unit_price": str(line.unit_price), "discount_rate": str(line.discount_rate),
                       "tax_rate": str(line.tax_rate_id) if line.tax_rate_id else None,
                       "description": line.description} for line in quote.lines.all()]}
    _, customer, currency, quote_date = _payload(quote.company, data)
    if quote.valid_until < timezone.localdate():
        raise ValidationError({"valid_until": "Báo giá đã hết hiệu lực."})
    if customer.status != "ACTIVE":
        raise ValidationError({"customer": "Khách hàng đã ngừng hoạt động. Vui lòng chọn khách hàng khác."})
    _, values = _calc_lines(quote.company, data["lines"], quote_date, currency, True)
    quote.subtotal, quote.discount_amount, quote.tax_amount, quote.total_amount = values
    quote.title = quote.title or f"Báo giá hàng hóa/dịch vụ cho {customer.name}"
    quote.status = models.DocumentStatus.ISSUED
    quote.pdf_content = render_quotation_pdf(quote)
    quote.save(update_fields=("subtotal", "discount_amount", "tax_amount", "total_amount", "title", "status", "pdf_content", "updated_at"))
    services.audit(request, quote, "ISSUE", after={"number": quote.number, "total_amount": str(quote.total_amount), "status": quote.status})
    return quote


def quote_payload(quote):
    return {"company": str(quote.company_id), "branch": str(quote.branch_id) if quote.branch_id else None,
            "customer": str(quote.customer_id), "document_date": str(timezone.localdate()),
            "currency": str(quote.currency_id), "title": quote.title,
            "payment_terms_text": quote.payment_terms_text, "delivery_terms": quote.delivery_terms,
            "notes": quote.notes, "lines": [{"item": str(line.item_id), "uom": str(line.uom_id) if line.uom_id else None,
            "quantity": str(line.quantity) if line.quantity is not None else None,
            "unit_price": str(line.unit_price) if line.unit_price is not None else None,
            "discount_rate": str(line.discount_rate), "tax_rate": str(line.tax_rate_id) if line.tax_rate_id else None,
            "description": line.description} for line in quote.lines.all()]}


@transaction.atomic
def record_response(request, quote, accepted):
    quote = models.SalesQuotation.objects.select_for_update().get(pk=quote.pk)
    if quote.status != models.DocumentStatus.ISSUED:
        raise ValidationError("Báo giá không ở trạng thái Đã phát hành.")
    response_date = _date(request.data.get("response_date"), "response_date", "Vui lòng nhập đầy đủ Ngày phản hồi và Nội dung phản hồi.")
    content = str(request.data.get("response_content") or request.data.get("reason") or "").strip()
    if not content:
        raise ValidationError({"response_content": "Vui lòng nhập đầy đủ Ngày phản hồi và Nội dung phản hồi." if accepted else "Vui lòng nhập Lý do khách hàng từ chối."})
    quote.status = models.DocumentStatus.ACCEPTED if accepted else models.DocumentStatus.DECLINED
    quote.response_date, quote.response_content = response_date, content
    quote.save(update_fields=("status", "response_date", "response_content", "updated_at"))
    services.audit(request, quote, "ACCEPT" if accepted else "DECLINE", after={"status": quote.status, "response_date": str(response_date)})
    return quote


@transaction.atomic
def cancel_quote(request, quote):
    quote = models.SalesQuotation.objects.select_for_update().get(pk=quote.pk)
    reason = str(request.data.get("reason") or "").strip()
    if not reason:
        raise ValidationError({"reason": "Vui lòng nhập Lý do hủy."})
    if quote.status not in (models.DocumentStatus.DRAFT, models.DocumentStatus.ISSUED):
        raise ValidationError("Chỉ báo giá Nháp hoặc Đã phát hành được hủy.")
    quote.status, quote.cancellation_reason = models.DocumentStatus.CANCELLED, reason
    quote.save(update_fields=("status", "cancellation_reason", "updated_at"))
    services.audit(request, quote, "CANCEL", after={"status": quote.status}, reason=reason)
    return quote


def order_prefill(quote):
    if quote.status != models.DocumentStatus.ACCEPTED:
        raise ValidationError("Chỉ báo giá được khách hàng chấp nhận mới được chuyển thành đơn bán hàng.")
    order = models.SalesOrder.objects.filter(quotation=quote).first()
    if order:
        raise ValidationError(f"Báo giá đã được chuyển thành đơn bán hàng {order.number}.")
    return {"quotation": str(quote.id), "company": str(quote.company_id), "customer": str(quote.customer_id),
            "currency": str(quote.currency_id), "payment_term": str(quote.payment_term_id) if quote.payment_term_id else None,
            "lines": [{"quotation_line": str(line.id), "item": str(line.item_id), "uom": str(line.uom_id),
                       "quantity": str(line.quantity), "unit_price": str(line.unit_price),
                       "discount_rate": str(line.discount_rate), "tax_rate": str(line.tax_rate_id) if line.tax_rate_id else None}
                      for line in quote.lines.all()]}


def email_quote(request, quote):
    if quote.status != models.DocumentStatus.ISSUED:
        raise ValidationError("Chỉ báo giá Đã phát hành được gửi email.")
    email = str(request.data.get("email") or quote.customer.contacts.filter(status="ACTIVE").exclude(email="").values_list("email", flat=True).first() or "").strip()
    if not email:
        raise ValidationError("Khách hàng chưa có địa chỉ email để nhận báo giá.")
    message = EmailMessage(quote.title, f"Kính gửi {quote.customer.name}, vui lòng xem báo giá {quote.number} đính kèm.",
                           settings.DEFAULT_FROM_EMAIL, [email])
    message.attach(f"{quote.number}.pdf", bytes(quote.pdf_content or render_quotation_pdf(quote)), "application/pdf")
    message.send(fail_silently=False)
    quote.sent_at = timezone.now()
    quote.save(update_fields=("sent_at", "updated_at"))
    services.audit(request, quote, "SEND", after={"sent_at": quote.sent_at.isoformat(), "email": email})
    return quote
