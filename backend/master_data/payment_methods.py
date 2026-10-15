"""Company-scoped payment method catalogue and transaction selection rules."""
import csv
import io
from copy import copy

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
from .models import PaymentMethod


def validate_method(method):
    try:
        method.full_clean()
    except DjangoValidationError as exc:
        raise ValidationError(exc.message_dict) from exc


def method_snapshot(method):
    return {"id": str(method.pk), "code": method.code, "name": method.name, "group": method.group} if method else {}


def resolve_payment_method(*, company, scope, on_date):
    field = "default_receipt" if scope == "RECEIPT" else "default_payment"
    return PaymentMethod.objects.filter(company=company, status="ACTIVE", **{field: True}).filter(
        Q(effective_from__isnull=True) | Q(effective_from__lte=on_date)
    ).filter(Q(effective_to__isnull=True) | Q(effective_to__gte=on_date)).first()


def validate_method_selection(method, *, company, scope, on_date, reference="", bank_account=None, cash_fund=None, previous=None):
    if method is None:
        return
    if method.company_id != company.pk:
        raise ValidationError({"payment_method_config": "Method belongs to another company."})
    if previous is None or previous.pk != method.pk:
        if not method.is_available(on_date, scope):
            raise ValidationError({"payment_method_config": "Method is inactive, expired or outside this scope."})
    if method.group == "NETTING":
        raise ValidationError({"payment_method_config": "Use the netting workflow for this method."})
    if method.requires_reference and not (reference or "").strip():
        raise ValidationError({"external_reference": "Transaction reference is required."})
    if method.group == "CASH":
        if not cash_fund:
            raise ValidationError({"cash_fund": "Cash fund is required."})
        if cash_fund.company_id != company.pk or cash_fund.status != "ACTIVE":
            raise ValidationError({"cash_fund": "Cash fund is not active in this company."})
        if bank_account:
            raise ValidationError({"company_bank_account": "Cash method cannot use a bank account."})
    elif cash_fund:
        raise ValidationError({"cash_fund": "Cash fund is only valid for a cash method."})
    if bank_account and (bank_account.company_id != company.pk or bank_account.status != "ACTIVE"):
        raise ValidationError({"company_bank_account": "Bank account is not active in this company."})
    if bank_account and ((scope == "RECEIPT" and not bank_account.allow_receipt) or (scope == "PAYMENT" and not bank_account.allow_payment)):
        raise ValidationError({"company_bank_account": "Bank account does not allow this direction."})
    if method.requires_bank_account and not bank_account:
        raise ValidationError({"company_bank_account": "Bank account is required."})


def validate_document_method(method, *, company, scope, on_date, previous=None):
    """A document records a planned method; transaction details are checked at payment time."""
    if method is None:
        return
    if method.company_id != company.pk:
        raise ValidationError({"payment_method_config": "Method belongs to another company."})
    if previous is None or previous.pk != method.pk:
        if not method.is_available(on_date, scope):
            raise ValidationError({"payment_method_config": "Method is inactive, expired or outside this scope."})


def prepare_document_method(attrs, instance, *, company, scope, on_date):
    """Validate a planned method and freeze its display values when selected."""
    previous = getattr(instance, "payment_method_config", None)
    method = attrs.get("payment_method_config", previous)
    validate_document_method(method, company=company, scope=scope, on_date=on_date, previous=previous)
    if "payment_method_config" in attrs:
        attrs["payment_method_snapshot"] = method_snapshot(method)
    return method


class PaymentMethodSerializer(serializers.ModelSerializer):
    effective_status = serializers.SerializerMethodField()

    class Meta:
        model = PaymentMethod
        fields = "__all__"
        read_only_fields = ("id", "version", "created_at", "updated_at", "effective_status")
        extra_kwargs = {"group": {"required": True}, "scope": {"required": True},
                        "requires_reference": {"required": True}, "requires_bank_account": {"required": True},
                        "supports_auto_reconcile": {"required": True}}

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
        method = copy(self.instance) if self.instance else PaymentMethod()
        for name, value in attrs.items():
            setattr(method, name, value)
        validate_method(method)
        return attrs


class PaymentMethodViewSet(ModelViewSet):
    queryset = PaymentMethod.objects.select_related("company", "default_cash_fund", "default_bank_account")
    serializer_class = PaymentMethodSerializer
    permission_classes = (HasIamPermission,)
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = ("code", "name", "description")
    ordering_fields = ("code", "name", "group", "created_at")
    http_method_names = ("get", "post", "patch", "put", "head", "options")

    def get_permissions(self):
        self.iam_permissions = {"GET": "MD.PAYMENT_METHOD.VIEW", "POST": "MD.PAYMENT_METHOD.CREATE", "PATCH": "MD.PAYMENT_METHOD.EDIT", "PUT": "MD.PAYMENT_METHOD.EDIT"}
        self.action_permissions = {"copy": "MD.PAYMENT_METHOD.CREATE", "activate": "MD.PAYMENT_METHOD.DEACTIVATE", "deactivate": "MD.PAYMENT_METHOD.DEACTIVATE", "set_default": "MD.PAYMENT_METHOD.EDIT", "suggest": "MD.PAYMENT_METHOD.VIEW", "export": "MD.PAYMENT_METHOD.EXPORT", "import_preview": "MD.PAYMENT_METHOD.IMPORT", "import_apply": "MD.PAYMENT_METHOD.IMPORT"}
        return super().get_permissions()

    def company_id(self):
        value = self.request.query_params.get("company_id")
        if not value:
            raise ValidationError({"company_id": "Working company is required."})
        return value

    def get_queryset(self):
        queryset = self.queryset.filter(company_id=self.company_id())
        for field in ("group", "scope", "status"):
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

    def _check_version(self, method):
        if str(self.request.data.get("version")) != str(method.version):
            raise ValidationError({"version": "Record changed; reload before editing."})

    def _used(self, method):
        from accounts_payable.models import Payment, SupplierInvoice
        from accounts_receivable.models import Receipt, ReceivableDocument
        from cash_management.models import CashTransaction
        from bank_management.models import BankTransaction
        from purchases.models import PurchaseOrder
        from sales.models import SalesQuotation, SalesContract, SalesOrder
        return any(model.objects.filter(payment_method_config=method).exists() for model in (
            Payment, Receipt, CashTransaction, BankTransaction, SupplierInvoice,
            ReceivableDocument, PurchaseOrder, SalesQuotation, SalesContract, SalesOrder,
        ))

    def _assign_defaults(self, method):
        for field in ("default_receipt", "default_payment"):
            if getattr(method, field):
                for previous in PaymentMethod.objects.filter(company=method.company, **{field: True}).exclude(pk=method.pk):
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
            method = serializer.save()
            self._assign_defaults(method)
        except IntegrityError as exc:
            raise ValidationError({"code": "Duplicate payment method code."}) from exc
        self._audit(method, "CREATE", after=self.get_serializer(method).data)

    @transaction.atomic
    def perform_update(self, serializer):
        self._check_company(serializer)
        method = serializer.instance
        self._check_version(method)
        Company.objects.select_for_update().get(pk=self.company_id())
        data = serializer.validated_data
        if self._used(method) and (data.get("code", method.code).strip().upper() != method.code or data.get("group", method.group) != method.group):
            raise ValidationError({"detail": "Code and group cannot change after use."})
        before = self.get_serializer(method).data
        method = serializer.save(version=method.version + 1)
        self._assign_defaults(method)
        self._audit(method, "EDIT", before=before, after=self.get_serializer(method).data)

    @action(detail=True, methods=("post",))
    def copy(self, request, pk=None):
        source = self.get_object()
        if not request.data.get("code"):
            raise ValidationError({"code": "New code is required."})
        data = dict(self.get_serializer(source).data)
        data.update(request.data)
        data["company"] = str(source.company_id)
        data["default_receipt"] = data["default_payment"] = False
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def _status_change(self, active):
        with transaction.atomic():
            method = self.get_object()
            self._check_version(method)
            if not active and (method.default_receipt or method.default_payment) and self.request.data.get("clear_default") is not True:
                raise ValidationError({"clear_default": "Confirm removing this default."})
            before = self.get_serializer(method).data
            method.status = "ACTIVE" if active else "INACTIVE"
            if not active:
                method.default_receipt = method.default_payment = False
            if active and not any(method.is_available(timezone.localdate(), scope) for scope in ("RECEIPT", "PAYMENT")):
                raise ValidationError({"effective_to": "Method is outside its effective period."})
            validate_method(method)
            method.version += 1
            method.save()
            self._audit(method, "ACTIVATE" if active else "DEACTIVATE", before=before, after=self.get_serializer(method).data)
            return Response(self.get_serializer(method).data)

    @action(detail=True, methods=("post",))
    def activate(self, request, pk=None):
        return self._status_change(True)

    @action(detail=True, methods=("post",))
    def deactivate(self, request, pk=None):
        return self._status_change(False)

    @action(detail=True, methods=("post",), url_path="set-default")
    def set_default(self, request, pk=None):
        scope = request.data.get("scope")
        if scope not in ("RECEIPT", "PAYMENT"):
            raise ValidationError({"scope": "RECEIPT or PAYMENT is required."})
        with transaction.atomic():
            Company.objects.select_for_update().get(pk=self.company_id())
            method = self.get_object()
            self._check_version(method)
            if not method.is_available(timezone.localdate(), scope):
                raise ValidationError({"scope": "Method is not available today."})
            before = self.get_serializer(method).data
            setattr(method, "default_receipt" if scope == "RECEIPT" else "default_payment", True)
            method.version += 1
            method.save()
            self._assign_defaults(method)
            self._audit(method, "SET_DEFAULT", before=before, after=self.get_serializer(method).data)
            return Response(self.get_serializer(method).data)

    @action(detail=False, methods=("get",))
    def suggest(self, request):
        scope = request.query_params.get("scope")
        on_date = parse_date(request.query_params.get("on_date", ""))
        if scope not in ("RECEIPT", "PAYMENT") or on_date is None:
            raise ValidationError({"detail": "scope and on_date are required."})
        method = resolve_payment_method(company=Company.objects.get(pk=self.company_id()), scope=scope, on_date=on_date)
        return Response(self.get_serializer(method).data if method else None)

    @action(detail=False, methods=("get",))
    def export(self, request):
        output = io.StringIO()
        fields = ("company", "code", "name", "group", "scope", "default_cash_fund", "default_bank_account", "requires_reference", "requires_bank_account", "supports_auto_reconcile", "integration_channel", "default_receipt", "default_payment", "effective_from", "effective_to", "status", "version")
        writer = csv.writer(output)
        writer.writerow(fields)
        for method in self.filter_queryset(self.get_queryset()):
            writer.writerow([getattr(method, f"{field}_id") if field in ("company", "default_cash_fund", "default_bank_account") else getattr(method, field) for field in fields])
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
                    for field in ("default_cash_fund", "default_bank_account", "effective_from", "effective_to"):
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
            existing = PaymentMethod.objects.filter(company_id=self.company_id(), code__iexact=code).first()
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
                if serializer.instance and self._used(serializer.instance) and serializer.validated_data.get("group", serializer.instance.group) != serializer.instance.group:
                    raise ValidationError({"group": "Group cannot change after use."})
                before = self.get_serializer(serializer.instance).data if serializer.instance else None
                try:
                    method = serializer.save(version=serializer.instance.version + 1) if serializer.instance else serializer.save()
                except IntegrityError as exc:
                    raise ValidationError({"rows": "Import conflicts with existing data."}) from exc
                self._assign_defaults(method)
                self._audit(method, "IMPORT", before=before, after=self.get_serializer(method).data)
                result.append(self.get_serializer(method).data)
            return Response({"items": result}, status=status.HTTP_201_CREATED)
