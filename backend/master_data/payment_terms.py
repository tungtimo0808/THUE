"""Payment term catalogue operations and deterministic due-date calculation."""
import csv
import io
import calendar
from copy import copy
from datetime import date, timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from audit_log.models import AuditSource
from audit_log.services import record_audit
from iam.permissions import HasIamPermission
from organization.models import Company
from .models import Party, PaymentTerm


def validate_term(term):
    try:
        term.full_clean()
    except DjangoValidationError as exc:
        raise ValidationError(exc.message_dict) from exc


def resolve_payment_term(*, company, scope, on_date, party=None):
    """Explicit party term wins, then the active company default."""
    if party is not None and party.company_id == company.pk and party.payment_term_id:
        term = party.payment_term
        if term.is_available(on_date, scope):
            return term
    field = "default_purchase" if scope == "PURCHASE" else "default_sale"
    return PaymentTerm.objects.filter(company=company, status="ACTIVE", **{field: True}).filter(
        Q(effective_from__isnull=True) | Q(effective_from__lte=on_date)
    ).filter(Q(effective_to__isnull=True) | Q(effective_to__gte=on_date)).first()


def validate_payment_term_selection(term, *, company, scope, on_date, previous=None):
    if term is None:
        return
    if term.company_id != company.pk:
        raise ValidationError({"payment_term": "Payment term belongs to another company."})
    if previous is None or previous.pk != term.pk:
        if not term.is_available(on_date, scope):
            raise ValidationError({"payment_term": "Payment term is inactive, expired or outside this scope."})


def calculate_payment_dates(term, *, document_date=None, invoice_date=None, delivery_date=None, acceptance_date=None, actual_payment_date=None):
    anchor = {"DOCUMENT": document_date, "INVOICE": invoice_date, "DELIVERY": delivery_date, "ACCEPTANCE": acceptance_date}[term.due_base]
    if anchor is None:
        raise ValidationError({"date": f"{term.due_base.lower()}_date is required."})
    discount_until = anchor + timedelta(days=term.discount_days) if term.has_discount else None
    if term.due_mode == "MONTHLY":
        month_index = anchor.year * 12 + anchor.month - 1 + term.due_after_months
        year, month_zero = divmod(month_index, 12)
        month = month_zero + 1
        due_date = date(year, month, min(term.due_day_of_month, calendar.monthrange(year, month)[1]))
    else:
        due_date = anchor + timedelta(days=term.due_days)
    return {"base_date": anchor, "due_date": due_date, "discount_until": discount_until,
            "discount_eligible": bool(discount_until and actual_payment_date and actual_payment_date <= discount_until)}


class PaymentTermSerializer(serializers.ModelSerializer):
    effective_status = serializers.SerializerMethodField()

    class Meta:
        model = PaymentTerm
        fields = "__all__"
        read_only_fields = ("id", "version", "created_at", "updated_at", "effective_status")
        extra_kwargs = {"scope": {"required": True}, "due_base": {"required": True}, "due_days": {"required": True}, "has_discount": {"required": True}}

    def get_effective_status(self, obj):
        today = timezone.localdate()
        if obj.status != "ACTIVE":
            return "INACTIVE"
        if obj.effective_from and obj.effective_from > today:
            return "FUTURE"
        if obj.effective_to and obj.effective_to < today:
            return "EXPIRED"
        return "EFFECTIVE"

    def validate(self, attrs):
        term = copy(self.instance) if self.instance else PaymentTerm()
        for name, value in attrs.items():
            setattr(term, name, value)
        validate_term(term)
        return attrs


class PaymentTermViewSet(ModelViewSet):
    queryset = PaymentTerm.objects.select_related("company")
    serializer_class = PaymentTermSerializer
    permission_classes = (HasIamPermission,)
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = ("code", "name", "description")
    ordering_fields = ("code", "name", "due_days", "effective_from", "created_at")
    http_method_names = ("get", "post", "patch", "put", "head", "options")

    def get_permissions(self):
        self.iam_permissions = {"GET": "MD.PAYMENT_TERM.VIEW", "POST": "MD.PAYMENT_TERM.CREATE", "PUT": "MD.PAYMENT_TERM.EDIT", "PATCH": "MD.PAYMENT_TERM.EDIT"}
        self.action_permissions = {"copy": "MD.PAYMENT_TERM.CREATE", "activate": "MD.PAYMENT_TERM.DEACTIVATE", "deactivate": "MD.PAYMENT_TERM.DEACTIVATE", "set_default": "MD.PAYMENT_TERM.EDIT", "import_preview": "MD.PAYMENT_TERM.IMPORT", "import_apply": "MD.PAYMENT_TERM.IMPORT", "export": "MD.PAYMENT_TERM.EXPORT", "calculate": "MD.PAYMENT_TERM.VIEW", "suggest": "MD.PAYMENT_TERM.VIEW"}
        return super().get_permissions()

    def company_id(self):
        value = self.request.query_params.get("company_id")
        if not value:
            raise ValidationError({"company_id": "Working company is required."})
        return value

    def get_queryset(self):
        queryset = self.queryset.filter(company_id=self.company_id())
        for field in ("scope", "status", "due_base"):
            if value := self.request.query_params.get(field):
                queryset = queryset.filter(**{field: value})
        return queryset

    def _audit(self, obj, action, before=None, after=None):
        record_audit(company=obj.company, actor_user=self.request.user.iam_account, module_code="MDM", action_code=action,
                     entity=obj, before=before or {}, after=after or {}, request=self.request,
                     source=AuditSource.IMPORT if action == "IMPORT" else AuditSource.API)

    def _check_company(self, serializer):
        company = serializer.validated_data.get("company") or getattr(serializer.instance, "company", None)
        if not company or str(company.pk) != str(self.company_id()):
            raise ValidationError({"company": "Company does not match working company."})

    def _check_version(self, term):
        if str(self.request.data.get("version")) != str(term.version):
            raise ValidationError({"version": "Record changed; reload before editing."})

    def _referenced_in_documents(self, term):
        from purchases.models import PurchaseOrder
        from sales.models import SalesQuotation, SalesContract, SalesOrder
        return any(model.objects.filter(payment_term=term).exists() for model in (PurchaseOrder, SalesQuotation, SalesContract, SalesOrder))

    def _assign_defaults(self, term):
        for field in ("default_purchase", "default_sale"):
            if getattr(term, field):
                for previous in PaymentTerm.objects.filter(company=term.company, **{field: True}).exclude(pk=term.pk):
                    before = self.get_serializer(previous).data
                    setattr(previous, field, False)
                    previous.version += 1
                    previous.save(update_fields=(field, "version", "updated_at"))
                    self._audit(previous, "UNSET_DEFAULT", before=before, after=self.get_serializer(previous).data)

    @transaction.atomic
    def perform_create(self, serializer):
        self._check_company(serializer)
        Company.objects.select_for_update().get(pk=self.company_id())
        try:
            term = serializer.save()
            self._assign_defaults(term)
        except IntegrityError as exc:
            raise ValidationError({"code": "Duplicate payment term code."}) from exc
        self._audit(term, "CREATE", after=self.get_serializer(term).data)

    @transaction.atomic
    def perform_update(self, serializer):
        self._check_company(serializer)
        term = serializer.instance
        self._check_version(term)
        Company.objects.select_for_update().get(pk=self.company_id())
        if serializer.validated_data.get("code", term.code).strip().upper() != term.code and self._referenced_in_documents(term):
            raise ValidationError({"code": "Code cannot change after a document uses this term."})
        before = self.get_serializer(term).data
        term = serializer.save(version=term.version + 1)
        self._assign_defaults(term)
        self._audit(term, "EDIT", before=before, after=self.get_serializer(term).data)

    @action(detail=True, methods=("post",))
    def copy(self, request, pk=None):
        source = self.get_object()
        data = dict(self.get_serializer(source).data)
        data.update(request.data)
        data["company"] = str(source.company_id)
        data["default_purchase"] = False
        data["default_sale"] = False
        if not request.data.get("code"):
            raise ValidationError({"code": "New code is required."})
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def _status_change(self, active):
        with transaction.atomic():
            term = self.get_object()
            self._check_version(term)
            if not active and (term.default_purchase or term.default_sale) and self.request.data.get("clear_default") is not True:
                raise ValidationError({"clear_default": "Confirm removing this default."})
            before = self.get_serializer(term).data
            term.status = "ACTIVE" if active else "INACTIVE"
            if not active:
                term.default_purchase = term.default_sale = False
            if active and not term.is_available(timezone.localdate(), "PURCHASE") and not term.is_available(timezone.localdate(), "SALE"):
                raise ValidationError({"effective_to": "Term is outside its effective period."})
            validate_term(term)
            term.version += 1
            term.save()
            self._audit(term, "ACTIVATE" if active else "DEACTIVATE", before=before, after=self.get_serializer(term).data)
            return Response(self.get_serializer(term).data)

    @action(detail=True, methods=("post",))
    def activate(self, request, pk=None):
        return self._status_change(True)

    @action(detail=True, methods=("post",))
    def deactivate(self, request, pk=None):
        return self._status_change(False)

    @action(detail=True, methods=("post",), url_path="set-default")
    def set_default(self, request, pk=None):
        scope = request.data.get("scope")
        if scope not in ("PURCHASE", "SALE"):
            raise ValidationError({"scope": "PURCHASE or SALE is required."})
        with transaction.atomic():
            Company.objects.select_for_update().get(pk=self.company_id())
            term = self.get_object()
            self._check_version(term)
            if not term.is_available(timezone.localdate(), scope):
                raise ValidationError({"scope": "Term is not available for this scope today."})
            before = self.get_serializer(term).data
            setattr(term, "default_purchase" if scope == "PURCHASE" else "default_sale", True)
            term.version += 1
            term.save()
            self._assign_defaults(term)
            self._audit(term, "SET_DEFAULT", before=before, after=self.get_serializer(term).data)
            return Response(self.get_serializer(term).data)

    @action(detail=True, methods=("get",))
    def calculate(self, request, pk=None):
        term = self.get_object()
        values = {}
        for field in ("document_date", "invoice_date", "delivery_date", "acceptance_date", "actual_payment_date"):
            raw = request.query_params.get(field)
            if raw:
                values[field] = parse_date(raw)
                if values[field] is None:
                    raise ValidationError({field: "Invalid ISO date."})
        result = calculate_payment_dates(term, **values)
        return Response(result)

    @action(detail=False, methods=("get",))
    def suggest(self, request):
        scope = request.query_params.get("scope")
        on_date = parse_date(request.query_params.get("on_date", ""))
        if scope not in ("PURCHASE", "SALE") or on_date is None:
            raise ValidationError({"detail": "scope and on_date are required."})
        party = None
        if party_id := request.query_params.get("party_id"):
            party = Party.objects.filter(pk=party_id, company_id=self.company_id()).first()
            if party is None:
                raise ValidationError({"party_id": "Party not found in this company."})
        term = resolve_payment_term(company=Company.objects.get(pk=self.company_id()), scope=scope, on_date=on_date, party=party)
        return Response(self.get_serializer(term).data if term else None)

    @action(detail=False, methods=("get",))
    def export(self, request):
        output = io.StringIO()
        fields = ("code", "name", "scope", "due_base", "due_mode", "due_days", "due_day_of_month", "due_after_months", "has_discount", "discount_days", "discount_rate", "default_purchase", "default_sale", "effective_from", "effective_to", "status")
        writer = csv.writer(output)
        writer.writerow(fields)
        for term in self.filter_queryset(self.get_queryset()):
            writer.writerow([getattr(term, field) for field in fields])
        return HttpResponse(output.getvalue(), content_type="text/csv; charset=utf-8")

    def _import_rows(self, request):
        rows = request.data.get("rows")
        if rows is None and request.FILES.get("file"):
            upload = request.FILES["file"]
            if upload.size > 2 * 1024 * 1024:
                raise ValidationError({"file": "CSV file exceeds 2 MB."})
            try:
                reader = csv.DictReader(io.StringIO(upload.read().decode("utf-8-sig")))
                if not reader.fieldnames:
                    raise ValueError("CSV header is required.")
                rows = list(reader)
                for row in rows:
                    for field in ("discount_days", "discount_rate", "effective_from", "effective_to"):
                        if row.get(field) == "":
                            row[field] = None
            except (UnicodeDecodeError, csv.Error, ValueError) as exc:
                raise ValidationError({"file": str(exc)}) from exc
        if not isinstance(rows, list) or not rows or len(rows) > 500:
            raise ValidationError({"rows": "Provide 1 to 500 rows."})
        seen, valid, errors = set(), [], []
        for number, row in enumerate(rows, 1):
            if not isinstance(row, dict):
                errors.append({"row": number, "errors": {"detail": "Object required."}})
                continue
            data = dict(row)
            if str(data.get("company")) != str(self.company_id()):
                errors.append({"row": number, "errors": {"company": "Company does not match working company."}})
                continue
            code = str(data.get("code", "")).strip().upper()
            if code in seen:
                errors.append({"row": number, "errors": {"code": "Duplicate code in file."}})
                continue
            seen.add(code)
            existing = PaymentTerm.objects.filter(company_id=self.company_id(), code__iexact=code).first()
            if existing and str(data.get("version")) != str(existing.version):
                errors.append({"row": number, "errors": {"version": "Current version is required to update."}})
                continue
            serializer = self.get_serializer(existing, data=data, partial=bool(existing))
            if serializer.is_valid():
                valid.append(serializer)
            else:
                errors.append({"row": number, "errors": serializer.errors})
        return valid, errors

    @action(detail=False, methods=("post",), url_path="import-preview")
    def import_preview(self, request):
        valid, errors = self._import_rows(request)
        return Response({"valid_count": len(valid), "errors": errors})

    @action(detail=False, methods=("post",), url_path="import-apply")
    def import_apply(self, request):
        with transaction.atomic():
            Company.objects.select_for_update().get(pk=self.company_id())
            valid, errors = self._import_rows(request)
            if errors:
                raise ValidationError({"rows": errors})
            result = []
            for serializer in valid:
                serializer.validate(serializer.validated_data)
                if serializer.instance and serializer.validated_data.get("code", serializer.instance.code).strip().upper() != serializer.instance.code and self._referenced_in_documents(serializer.instance):
                    raise ValidationError({"code": "Code cannot change after a document uses this term."})
                old = self.get_serializer(serializer.instance).data if serializer.instance else None
                try:
                    term = serializer.save(version=serializer.instance.version + 1) if serializer.instance else serializer.save()
                except IntegrityError as exc:
                    raise ValidationError({"rows": "Import conflicts with existing data."}) from exc
                self._assign_defaults(term)
                self._audit(term, "IMPORT", before=old, after=self.get_serializer(term).data)
                result.append(self.get_serializer(term).data)
            return Response({"items": result}, status=status.HTTP_201_CREATED)
