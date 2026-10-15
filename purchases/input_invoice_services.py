import hashlib
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from xml.etree import ElementTree

from django.db import IntegrityError, transaction
from django.db.models import F, Sum
from rest_framework.exceptions import ValidationError

from accounts_payable.models import SupplierInvoice, SupplierInvoiceLine
from audit_log.services import record_audit
from iam.permissions import has_effective_permission
from master_data.models import Item, UnitOfMeasure
from organization.models import Company

from .models import GoodsPurchase, GoodsPurchaseLine, PurchaseInvoiceFile, PurchaseInvoiceMatch, PurchaseOrder, PurchaseOrderLine

MONEY = Decimal("0.0001")
MAX_FILE_SIZE = 10 * 1024 * 1024


def audit(request, invoice, action, before=None, after=None):
    record_audit(company=invoice.company, actor_user=request.user.iam_account,
        module_code="PUR", action_code=action, entity=invoice,
        before=before or {}, after=after or {}, request=request)


def _tag(element):
    return element.tag.rsplit("}", 1)[-1]


def _find(element, *names):
    if element is None:
        return None
    for name in names:
        for child in element.iter():
            if _tag(child) == name and child.text and child.text.strip():
                return child.text.strip()
    return None


def _section(root, name):
    return next((element for element in root.iter() if _tag(element) == name), None)


def _money(value, default="0"):
    try:
        return Decimal(str(value or default).replace(",", "")).quantize(MONEY, ROUND_HALF_UP)
    except Exception:
        raise ValidationError("Dữ liệu số tiền trong file XML không hợp lệ.")


def parse_xml(content):
    if len(content) > MAX_FILE_SIZE:
        raise ValidationError("Dung lượng file không được vượt quá 10 MB.")
    if b"<!DOCTYPE" in content.upper() or b"<!ENTITY" in content.upper():
        raise ValidationError("Không thể đọc dữ liệu hóa đơn từ file XML.")
    try:
        root = ElementTree.fromstring(content)
    except ElementTree.ParseError:
        raise ValidationError("Không thể đọc dữ liệu hóa đơn từ file XML.")
    common = _section(root, "TTChung") or root
    seller = _section(root, "NBan")
    buyer = _section(root, "NMua")
    totals = _section(root, "TToan") or root
    raw_date = _find(common, "NLap", "invoiceDate")
    try:
        invoice_date = date.fromisoformat(raw_date) if raw_date and "-" in raw_date else datetime.strptime(raw_date, "%d/%m/%Y").date()
    except (TypeError, ValueError):
        raise ValidationError("Ngày hóa đơn trong file XML không hợp lệ.")
    lines = []
    for index, node in enumerate((item for item in root.iter() if _tag(item) == "HHDVu"), 1):
        quantity_text = _find(node, "SLuong")
        price_text = _find(node, "DGia")
        taxable = _money(_find(node, "ThTien", "TTruocThue"))
        tax_text = _find(node, "TSuat")
        try:
            tax_rate = Decimal(tax_text.replace("%", "")) if tax_text and "%" in tax_text or tax_text and tax_text.replace(".", "", 1).isdigit() else None
        except Exception:
            tax_rate = None
        tax_amount = _money(_find(node, "TThue"))
        lines.append({"line_no": index, "description": _find(node, "THHDVu", "Ten") or "",
            "tracks_quantity": bool(quantity_text and price_text),
            "quantity": quantity_text or "1", "unit_price": price_text or str(taxable),
            "discount_amount": str(_money(_find(node, "STCKhau"))),
            "taxable_amount": str(taxable), "tax_rate_percent": str(tax_rate) if tax_rate is not None else None,
            "tax_amount": str(tax_amount), "total_amount": str(taxable + tax_amount)})
    return {"source": "IMPORT", "invoice_type": "ORIGINAL",
        "invoice_template": _find(common, "KHMSHDon") or "",
        "invoice_series": _find(common, "KHHDon") or "",
        "invoice_number": _find(common, "SHDon") or "",
        "invoice_date": str(invoice_date), "seller_name": _find(seller, "Ten") or "",
        "supplier_tax_code": _find(seller, "MST") or "", "seller_address": _find(seller, "DChi") or "",
        "buyer_name": _find(buyer, "Ten") or "", "buyer_tax_code": _find(buyer, "MST") or "",
        "buyer_address": _find(buyer, "DChi") or "",
        "subtotal": str(_money(_find(totals, "TgTCThue", "TgTTTruocThue"))),
        "tax_amount": str(_money(_find(totals, "TgTThue"))),
        "total_amount": str(_money(_find(totals, "TgTTTBSo", "TgTThanhToan"))),
        "lines": lines}


def read_upload(upload, *, xml=False):
    if not upload:
        raise ValidationError("File hóa đơn là bắt buộc.")
    name = upload.name or ""
    extension = name.rsplit(".", 1)[-1].lower()
    if xml and extension != "xml":
        raise ValidationError("Định dạng file không được hỗ trợ. Vui lòng chọn file XML.")
    if not xml and extension not in {"pdf", "png", "jpg", "jpeg"}:
        raise ValidationError("File thể hiện hóa đơn phải là PDF hoặc hình ảnh.")
    if upload.size > MAX_FILE_SIZE:
        raise ValidationError("Dung lượng file không được vượt quá 10 MB.")
    content = upload.read(MAX_FILE_SIZE + 1)
    if len(content) > MAX_FILE_SIZE:
        raise ValidationError("Dung lượng file không được vượt quá 10 MB.")
    if xml:
        parse_xml(content)
    return content


def validate_data(data, company, *, exclude=None):
    if not company.tax_code or not company.legal_name:
        raise ValidationError("Doanh nghiệp chưa có thông tin pháp lý hoặc Mã số thuế.")
    supplier = data["supplier"]
    branch = data["branch"]
    if supplier.company_id != company.pk or supplier.status != "ACTIVE" or branch.company_id != company.pk or branch.status != "ACTIVE":
        raise ValidationError("Nhà cung cấp hoặc chi nhánh không hợp lệ.")
    if not supplier.tax_code or supplier.tax_code.strip() != data["supplier_tax_code"].strip():
        raise ValidationError("Mã số thuế nhà cung cấp không khớp danh mục.")
    if data["buyer_tax_code"].strip() != company.tax_code.strip():
        raise ValidationError("Mã số thuế người mua không trùng với doanh nghiệp đang làm việc.")
    if data["invoice_type"] in {"ADJUSTMENT", "REPLACEMENT"}:
        original = data.get("original_invoice")
        if not original or original.company_id != company.pk or original.supplier_id != supplier.pk or original.invoice_type != "ORIGINAL":
            raise ValidationError("Hóa đơn điều chỉnh hoặc thay thế phải liên kết hóa đơn gốc cùng nhà cung cấp.")
        if data["invoice_type"] == "ADJUSTMENT" and data.get("adjustment_effect") not in {"INCREASE", "DECREASE"}:
            raise ValidationError("Hóa đơn điều chỉnh cần phương thức tăng hoặc giảm.")
    if data.get("purchase_order"):
        order = PurchaseOrder.objects.filter(pk=data["purchase_order"], company=company, supplier=supplier, branch=branch).first()
        if not order:
            raise ValidationError("Đơn mua hàng không khớp hóa đơn.")
    duplicate = SupplierInvoice.objects.filter(company=company, supplier_tax_code=data["supplier_tax_code"],
        invoice_series=data["invoice_series"], invoice_number=data["invoice_number"])
    if exclude:
        duplicate = duplicate.exclude(pk=exclude)
    if duplicate.exists():
        raise ValidationError("Hóa đơn đã tồn tại trên hệ thống.")
    if not data["lines"]:
        raise ValidationError("Hóa đơn thiếu thông tin bắt buộc.")
    tolerance = Decimal("1") if company.accounting_currency.code == "VND" else Decimal("0.01")
    subtotal = tax_total = discount_total = Decimal("0")
    seen = set()
    for line in data["lines"]:
        if line["line_no"] in seen or not line["description"].strip():
            raise ValidationError("Dòng hóa đơn thiếu thông tin hoặc bị lặp.")
        seen.add(line["line_no"])
        if line["taxable_amount"] < 0 or line["discount_amount"] < 0 or line["tax_amount"] < 0:
            raise ValidationError("Số tiền dòng hóa đơn không hợp lệ.")
        if line["tracks_quantity"]:
            if line.get("quantity") is None or line.get("unit_price") is None or line["quantity"] <= 0 or line["unit_price"] < 0:
                raise ValidationError("Dòng hóa đơn thiếu Số lượng hoặc Đơn giá.")
            calculated = (line["quantity"] * line["unit_price"] - line["discount_amount"]).quantize(MONEY, ROUND_HALF_UP)
            if abs(calculated - line["taxable_amount"]) > tolerance:
                raise ValidationError("Tiền trước thuế của dòng không khớp Số lượng, Đơn giá và Chiết khấu.")
        rate = line.get("tax_rate_percent")
        if rate is not None:
            if rate < 0 or rate > 100 or abs((line["taxable_amount"] * rate / 100).quantize(MONEY, ROUND_HALF_UP) - line["tax_amount"]) > tolerance:
                raise ValidationError("Tiền thuế của dòng không khớp thuế suất.")
        elif line["tax_amount"]:
            raise ValidationError("Dòng có tiền thuế phải có thuế suất.")
        if abs(line["taxable_amount"] + line["tax_amount"] - line["total_amount"]) > tolerance:
            raise ValidationError("Thành tiền dòng hóa đơn không khớp.")
        if line.get("item") and not Item.objects.filter(pk=line["item"], company=company, status="ACTIVE").exists():
            raise ValidationError("Hàng hóa trên hóa đơn không hợp lệ.")
        if line.get("uom") and not UnitOfMeasure.objects.filter(pk=line["uom"], company=company, status="ACTIVE").exists():
            raise ValidationError("Đơn vị tính trên hóa đơn không hợp lệ.")
        subtotal += line["taxable_amount"]
        tax_total += line["tax_amount"]
        discount_total += line["discount_amount"]
    if (abs(subtotal - data["subtotal"]) > tolerance or abs(tax_total - data["tax_amount"]) > tolerance or
            abs(subtotal + tax_total - data["total_amount"]) > tolerance or
            abs(discount_total - data["discount_amount"]) > tolerance):
        raise ValidationError("Tổng tiền hóa đơn không khớp với chi tiết các dòng.")


def check_scope(request, company, branch_id, code):
    if request.user.is_superuser:
        return
    if not has_effective_permission(request.user.iam_account, company, code, branch_id=branch_id):
        raise ValidationError("Quyền truy cập của bạn đã thay đổi. Vui lòng tải lại trang.")


def _purchase_state(purchase):
    lines = list(purchase.lines.all())
    total = sum((line.total_amount for line in lines), Decimal("0"))
    linked = PurchaseInvoiceMatch.objects.filter(purchase_line__purchase=purchase,
        invoice_line__invoice__validation_status="VALID",
        invoice_line__invoice__is_replaced=False).aggregate(total=Sum("amount"))["total"] or Decimal("0")
    purchase.invoice_status = "NOT_INVOICED" if linked == 0 else "INVOICED" if linked >= total else "PARTIALLY_INVOICED"
    purchase.save(update_fields=("invoice_status", "updated_at"))


def _recalculate_match_status(invoice):
    linked = PurchaseInvoiceMatch.objects.filter(invoice_line__invoice=invoice).aggregate(
        total=Sum("amount"))["total"] or Decimal("0")
    invoice.linked_amount = linked
    invoice.match_status = "UNMATCHED" if linked == 0 else "MATCHED" if linked >= invoice.total_amount else "PARTIALLY_MATCHED"
    invoice.save(update_fields=("linked_amount", "match_status", "updated_at"))


def _remove_links(invoice, rows):
    affected = set()
    for match in rows:
        line = GoodsPurchaseLine.objects.select_for_update().get(pk=match.purchase_line_id)
        affected.add(line.purchase_id)
        if line.order_line_id and match.quantity:
            PurchaseOrderLine.objects.filter(pk=line.order_line_id).update(invoiced_quantity=F("invoiced_quantity") - match.quantity)
        if line.purchase.purchase_order_id:
            PurchaseOrder.objects.filter(pk=line.purchase.purchase_order_id).update(invoiced_amount=F("invoiced_amount") - match.amount)
        match.delete()
    _recalculate_match_status(invoice)
    for purchase_id in affected:
        purchase = GoodsPurchase.objects.select_for_update().get(pk=purchase_id)
        _purchase_state(purchase)
        if purchase.supplier_invoice_id == invoice.pk and not PurchaseInvoiceMatch.objects.filter(
                purchase_line__purchase=purchase, invoice_line__invoice=invoice).exists():
            purchase.supplier_invoice = None
            purchase.save(update_fields=("supplier_invoice", "updated_at"))


def link_lines(invoice, rows, request):
    if invoice.validation_status != "VALID" or invoice.is_replaced:
        raise ValidationError("Hóa đơn không hợp lệ hoặc đã được thay thế.")
    if not rows:
        return invoice
    seen = set()
    for row in rows:
        key = (row["invoice_line_no"], row["purchase_line"].pk)
        if key in seen:
            raise ValidationError("Liên kết dòng hóa đơn bị lặp.")
        seen.add(key)
        invoice_line = SupplierInvoiceLine.objects.select_for_update().filter(invoice=invoice,
            line_no=row["invoice_line_no"]).first()
        if not invoice_line:
            raise ValidationError("Dòng hóa đơn không tồn tại.")
        purchase_line = GoodsPurchaseLine.objects.select_for_update().select_related("purchase", "item").get(pk=row["purchase_line"].pk)
        purchase = GoodsPurchase.objects.select_for_update().get(pk=purchase_line.purchase_id)
        check_scope(request, invoice.company, purchase.branch_id, "PUR.INPUT_INVOICE.LINK")
        if (purchase.status != "POSTED" or purchase.company_id != invoice.company_id or
                purchase.supplier_id != invoice.supplier_id or purchase.branch_id != invoice.branch_id):
            raise ValidationError("Nhà cung cấp hoặc chứng từ mua hàng không khớp hóa đơn.")
        if invoice_line.item_id and invoice_line.item_id != purchase_line.item_id:
            raise ValidationError("Hàng hóa trên hóa đơn không khớp chứng từ mua.")
        if row["amount"] <= 0 or row["quantity"] < 0:
            raise ValidationError("Giá trị hoặc số lượng liên kết không hợp lệ.")
        if PurchaseInvoiceMatch.objects.filter(invoice_line=invoice_line, purchase_line=purchase_line).exists():
            raise ValidationError("Dòng hóa đơn đã liên kết với dòng mua này.")
        purchased_linked = PurchaseInvoiceMatch.objects.filter(purchase_line=purchase_line,
            invoice_line__invoice__validation_status="VALID", invoice_line__invoice__is_replaced=False).aggregate(
                total=Sum("amount"))["total"] or Decimal("0")
        invoice_line_linked = PurchaseInvoiceMatch.objects.filter(invoice_line=invoice_line).aggregate(
            total=Sum("amount"))["total"] or Decimal("0")
        if (row["amount"] > purchase_line.total_amount - purchased_linked or
                row["amount"] > invoice_line.total_amount - invoice_line_linked or
                invoice.linked_amount + row["amount"] > invoice.total_amount):
            raise ValidationError("Giá trị hóa đơn vượt quá giá trị còn chưa hóa đơn của chứng từ mua hàng.")
        qty_linked = PurchaseInvoiceMatch.objects.filter(purchase_line=purchase_line).aggregate(
            total=Sum("quantity"))["total"] or Decimal("0")
        if row["quantity"] > purchase_line.quantity - qty_linked:
            raise ValidationError("Số lượng liên kết vượt số lượng còn chưa hóa đơn.")
        if invoice_line.tax_rate_percent is not None and purchase_line.tax_rate_id:
            if abs(invoice_line.tax_rate_percent - purchase_line.tax_rate.rate_percent) > Decimal("0.0001"):
                invoice.match_details = {**invoice.match_details, "variance": "TAX_RATE"}
                invoice.save(update_fields=("match_details", "updated_at"))
        PurchaseInvoiceMatch.objects.create(invoice_line=invoice_line, purchase_line=purchase_line,
            quantity=row["quantity"], amount=row["amount"], created_by=request.user.iam_account)
        if purchase_line.order_line_id and row["quantity"]:
            PurchaseOrderLine.objects.filter(pk=purchase_line.order_line_id).update(
                invoiced_quantity=F("invoiced_quantity") + row["quantity"])
        if purchase.purchase_order_id:
            PurchaseOrder.objects.filter(pk=purchase.purchase_order_id).update(invoiced_amount=F("invoiced_amount") + row["amount"])
        if not purchase.supplier_invoice_id:
            purchase.supplier_invoice = invoice
            purchase.save(update_fields=("supplier_invoice", "updated_at"))
        _purchase_state(purchase)
        invoice.linked_amount += row["amount"]
    _recalculate_match_status(invoice)
    audit(request, invoice, "LINK", after={"linked_amount": str(invoice.linked_amount),
        "match_status": invoice.match_status, "number": invoice.invoice_number})
    return invoice


@transaction.atomic
def unlink(invoice, match, request):
    invoice = SupplierInvoice.objects.select_for_update().get(pk=invoice.pk)
    item = PurchaseInvoiceMatch.objects.select_related("purchase_line").filter(
        pk=match, invoice_line__invoice=invoice).first()
    if not item:
        raise ValidationError("Liên kết không tồn tại.")
    check_scope(request, invoice.company, item.purchase_line.purchase.branch_id, "PUR.INPUT_INVOICE.UNLINK")
    before = {"linked_amount": str(invoice.linked_amount), "match_status": invoice.match_status}
    _remove_links(invoice, [item])
    audit(request, invoice, "UNLINK", before=before, after={"linked_amount": str(invoice.linked_amount),
        "match_status": invoice.match_status, "number": invoice.invoice_number})
    return invoice


def _stored_data(invoice):
    lines = []
    for line in invoice.lines.all():
        lines.append({"line_no": line.line_no, "description": line.description,
            "item": line.item_id, "uom": line.uom_id,
            "tracks_quantity": line.tracks_quantity, "quantity": line.quantity,
            "unit_price": line.unit_price, "discount_amount": line.discount_amount,
            "taxable_amount": line.taxable_amount, "tax_rate_percent": line.tax_rate_percent,
            "tax_amount": line.tax_amount, "total_amount": line.total_amount})
    return {"branch": invoice.branch, "supplier": invoice.supplier, "source": invoice.source,
        "invoice_type": invoice.invoice_type, "adjustment_effect": invoice.adjustment_effect,
        "original_invoice": invoice.original_invoice, "invoice_template": invoice.invoice_template,
        "invoice_series": invoice.invoice_series, "invoice_number": invoice.invoice_number,
        "invoice_date": invoice.invoice_date, "seller_name": invoice.seller_name,
        "supplier_tax_code": invoice.supplier_tax_code, "seller_address": invoice.seller_address,
        "buyer_name": invoice.buyer_name, "buyer_tax_code": invoice.buyer_tax_code,
        "buyer_address": invoice.buyer_address, "purchase_order": invoice.purchase_order_id,
        "subtotal": invoice.subtotal, "discount_amount": invoice.discount_amount,
        "tax_amount": invoice.tax_amount, "total_amount": invoice.total_amount, "lines": lines}


@transaction.atomic
def create_invoice(data, company, request, *, xml_content=None, xml_name=None, preview_content=None, preview_name=None):
    Company.objects.select_for_update().get(pk=company.pk)
    check_scope(request, company, data["branch"].pk, "PUR.INPUT_INVOICE.RECEIVE")
    validate_data(data, company)
    if data["source"] == "IMPORT" and xml_content is None:
        raise ValidationError("File XML là bắt buộc khi tiếp nhận bằng XML.")
    if data["source"] != "MANUAL" and data.get("save_draft"):
        raise ValidationError("Chỉ hóa đơn nhập thủ công được lưu nháp.")
    if data["invoice_type"] == "REPLACEMENT" and data["original_invoice"].is_replaced:
        raise ValidationError("Hóa đơn gốc đã được thay thế.")
    confirmed = not data.get("save_draft") and data["source"] != "EINVOICE"
    try:
        invoice = SupplierInvoice.objects.create(company=company, branch=data["branch"], supplier=data["supplier"],
            source=data["source"], received_via_purchase=True, invoice_type=data["invoice_type"], adjustment_effect=data.get("adjustment_effect", ""),
            original_invoice=data.get("original_invoice"), invoice_template=data["invoice_template"],
            invoice_series=data["invoice_series"], invoice_number=data["invoice_number"],
            invoice_date=data["invoice_date"], seller_name=data["seller_name"],
            supplier_tax_code=data["supplier_tax_code"], seller_address=data["seller_address"],
            buyer_name=data["buyer_name"], buyer_tax_code=data["buyer_tax_code"],
            buyer_address=data.get("buyer_address", ""), purchase_order_id=data.get("purchase_order"),
            notes=data.get("notes", ""), currency=company.accounting_currency,
            subtotal=data["subtotal"], discount_amount=data["discount_amount"],
            tax_amount=data["tax_amount"], total_amount=data["total_amount"],
            validation_status="VALID" if confirmed else "PENDING_VALIDATION",
            approval_required=False, created_by=request.user.iam_account)
    except IntegrityError:
        raise ValidationError("Hóa đơn đã tồn tại trên hệ thống.")
    for line in data["lines"]:
        quantity = line.get("quantity") or Decimal("1")
        unit_price = line.get("unit_price")
        if unit_price is None:
            unit_price = line["taxable_amount"] + line["discount_amount"]
        SupplierInvoiceLine.objects.create(invoice=invoice, line_no=line["line_no"],
            description=line["description"], item_id=line.get("item"), uom_id=line.get("uom"),
            tracks_quantity=line["tracks_quantity"], quantity=quantity, unit_price=unit_price,
            discount_amount=line["discount_amount"], taxable_amount=line["taxable_amount"],
            tax_rate_percent=line.get("tax_rate_percent"), tax_amount=line["tax_amount"],
            total_amount=line["total_amount"])
    if xml_content is not None:
        PurchaseInvoiceFile.objects.create(invoice=invoice, kind="XML", filename=xml_name,
            content_type="application/xml", size=len(xml_content), sha256=hashlib.sha256(xml_content).hexdigest(),
            content=xml_content)
        invoice.original_file = {"name": xml_name, "size": len(xml_content),
            "sha256": hashlib.sha256(xml_content).hexdigest()}
        invoice.save(update_fields=("original_file", "updated_at"))
    if preview_content is not None:
        PurchaseInvoiceFile.objects.create(invoice=invoice, kind="PREVIEW", filename=preview_name,
            content_type="application/pdf" if preview_name.lower().endswith(".pdf") else "image/jpeg",
            size=len(preview_content), sha256=hashlib.sha256(preview_content).hexdigest(), content=preview_content)
    if confirmed:
        if invoice.invoice_type == "REPLACEMENT":
            original = SupplierInvoice.objects.select_for_update().get(pk=invoice.original_invoice_id)
            _remove_links(original, list(PurchaseInvoiceMatch.objects.filter(invoice_line__invoice=original)))
            original.is_replaced = True
            original.save(update_fields=("is_replaced", "updated_at"))
        link_lines(invoice, data.get("links", []), request)
    audit(request, invoice, "RECEIVE" if confirmed else "DRAFT", after={"source": invoice.source,
        "supplier": str(invoice.supplier_id), "series": invoice.invoice_series,
        "number": invoice.invoice_number, "validation_status": invoice.validation_status})
    return invoice


@transaction.atomic
def confirm_invoice(invoice, request, rows=None):
    invoice = SupplierInvoice.objects.select_for_update().prefetch_related("lines").get(pk=invoice.pk)
    check_scope(request, invoice.company, invoice.branch_id, "PUR.INPUT_INVOICE.RECEIVE")
    if invoice.validation_status not in {"PENDING_VALIDATION", "INVALID"} or invoice.is_replaced:
        raise ValidationError("Hóa đơn không ở trạng thái chờ xác nhận.")
    data = _stored_data(invoice)
    validate_data(data, invoice.company, exclude=invoice.pk)
    if invoice.source == "IMPORT" and not invoice.purchase_files.filter(kind="XML").exists():
        raise ValidationError("File XML gốc không tồn tại.")
    if invoice.invoice_type == "REPLACEMENT":
        original = SupplierInvoice.objects.select_for_update().get(pk=invoice.original_invoice_id)
        if original.is_replaced:
            raise ValidationError("Hóa đơn gốc đã được thay thế.")
        _remove_links(original, list(PurchaseInvoiceMatch.objects.filter(invoice_line__invoice=original)))
        original.is_replaced = True
        original.save(update_fields=("is_replaced", "updated_at"))
    invoice.validation_status = "VALID"
    invoice.save(update_fields=("validation_status", "updated_at"))
    link_lines(invoice, rows or [], request)
    audit(request, invoice, "CONFIRM", after={"source": invoice.source,
        "supplier": str(invoice.supplier_id), "series": invoice.invoice_series,
        "number": invoice.invoice_number, "validation_status": "VALID"})
    return invoice
