"""Company scoped tax catalogue API, separate from the legacy tax-rate endpoint."""
import csv
import io
from datetime import timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from audit_log.services import record_audit
from audit_log.models import AuditSource
from iam.permissions import HasIamPermission
from .models import TaxRate, TaxType


def _validate_model(instance):
    try:
        instance.full_clean()
    except DjangoValidationError as exc:
        raise ValidationError(exc.message_dict) from exc


class TaxTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxType
        fields = "__all__"
        read_only_fields = ("id", "source", "version", "created_at", "updated_at")

    def validate(self, attrs):
        instance = self.instance or TaxType(source="COMPANY")
        for key, value in attrs.items():
            setattr(instance, key, value)
        _validate_model(instance)
        return attrs


class TaxRateConfigSerializer(serializers.ModelSerializer):
    effective_status = serializers.SerializerMethodField()

    class Meta:
        model = TaxRate
        fields = "__all__"
        read_only_fields = ("id", "tax_type", "version", "created_at", "updated_at", "effective_status")

    def get_effective_status(self, obj):
        if obj.status != "ACTIVE" or (obj.tax_type_ref_id and obj.tax_type_ref.status != "ACTIVE"):
            return "INACTIVE"
        today = timezone.localdate()
        if obj.effective_from > today:
            return "FUTURE"
        if obj.effective_to and obj.effective_to < today:
            return "EXPIRED"
        return "EFFECTIVE"

    def validate(self, attrs):
        instance = self.instance or TaxRate()
        for key, value in attrs.items():
            setattr(instance, key, value)
        if not instance.tax_type_ref_id:
            raise ValidationError({"tax_type_ref": "Tax type is required."})
        if instance.tax_type_ref.status != "ACTIVE" and instance.status == "ACTIVE":
            raise ValidationError({"tax_type_ref": "Tax type is inactive."})
        instance.tax_type = instance.tax_type_ref.code
        _validate_model(instance)
        return attrs

    def create(self, validated_data):
        validated_data["tax_type"] = validated_data["tax_type_ref"].code
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data["tax_type"] = validated_data.get("tax_type_ref", instance.tax_type_ref).code
        return super().update(instance, validated_data)


class CatalogViewSet(ModelViewSet):
    permission_classes = (HasIamPermission,)
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = ("code", "name")
    ordering_fields = ("code", "name", "created_at")
    http_method_names = ("get", "post", "patch", "put", "head", "options")
    resource = None

    def get_permissions(self):
        self.iam_permissions = {"GET": f"{self.resource}.VIEW", "POST": f"{self.resource}.CREATE", "PATCH": f"{self.resource}.EDIT", "PUT": f"{self.resource}.EDIT"}
        self.action_permissions = {"activate": f"{self.resource}.DEACTIVATE", "deactivate": f"{self.resource}.DEACTIVATE", "export": f"{self.resource}.EXPORT", "resolve": f"{self.resource}.VIEW", "new_version": f"{self.resource}.CREATE", "import_preview": f"{self.resource}.IMPORT", "import_apply": f"{self.resource}.IMPORT"}
        return super().get_permissions()

    def company_id(self):
        value = self.request.query_params.get("company_id")
        if not value:
            raise ValidationError({"company_id": "Working company is required."})
        return value

    def _company_write(self, serializer):
        company_id = self.company_id()
        company = serializer.validated_data.get("company", getattr(serializer.instance, "company", None))
        if company is None or str(company.pk) != str(company_id):
            raise ValidationError({"company": "Company does not match working company."})
        if serializer.instance and str(self.request.data.get("version")) != str(serializer.instance.version):
            raise ValidationError({"version": "Record changed; reload before editing."})

    def audit(self, obj, action, before=None, after=None):
        record_audit(company=obj.company, actor_user=self.request.user.iam_account, module_code="MDM", action_code=action, entity=obj, before=before or {}, after=after or {}, request=self.request, source=AuditSource.IMPORT if action == "IMPORT" else AuditSource.API)

    @transaction.atomic
    def perform_create(self, serializer):
        self._company_write(serializer)
        try:
            obj = serializer.save()
        except IntegrityError as exc:
            raise ValidationError({"code": "Duplicate code or version."}) from exc
        self.audit(obj, "CREATE", after=serializer.data)

    @transaction.atomic
    def perform_update(self, serializer):
        self._company_write(serializer)
        obj = serializer.instance
        if isinstance(obj, TaxType) and obj.source != "COMPANY":
            raise PermissionDenied("System tax type cannot be edited.")
        before = self.get_serializer(obj).data
        if isinstance(obj, TaxRate) and obj.tax_type_ref.source != "COMPANY":
            raise PermissionDenied("System tax rate cannot be edited.")
        obj = serializer.save(version=obj.version + 1)
        self.audit(obj, "EDIT", before=before, after=self.get_serializer(obj).data)

    def _set_status(self, active):
        with transaction.atomic():
            obj = self.get_object()
            if str(self.request.data.get("version")) != str(obj.version):
                raise ValidationError({"version": "Record changed; reload before editing."})
            if not active and isinstance(obj, TaxType) and obj.rates.filter(status="ACTIVE").exists():
                raise ValidationError({"rates": "Deactivate active rates first."})
            before = self.get_serializer(obj).data
            obj.status = "ACTIVE" if active else "INACTIVE"
            _validate_model(obj)
            obj.version += 1
            obj.save(update_fields=("status", "version", "updated_at"))
            self.audit(obj, "ACTIVATE" if active else "DEACTIVATE", before=before, after=self.get_serializer(obj).data)
            return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=("post",))
    def activate(self, request, pk=None):
        return self._set_status(True)

    @action(detail=True, methods=("post",))
    def deactivate(self, request, pk=None):
        return self._set_status(False)

    @action(detail=False, methods=("get",))
    def export(self, request):
        output = io.StringIO()
        writer = csv.writer(output)
        fields = ("id", "code", "name", "status") if self.resource.endswith("TYPE") else ("id", "code", "name", "tax_type_ref_id", "application_form", "rate_percent", "business_scope", "effective_from", "effective_to", "status")
        writer.writerow(fields)
        for item in self.filter_queryset(self.get_queryset()):
            writer.writerow([getattr(item, field) for field in fields])
        return HttpResponse(output.getvalue(), content_type="text/csv; charset=utf-8")

    def _import_rows(self, request):
        rows = request.data.get("rows")
        if rows is None and request.FILES.get("file"):
            if request.FILES["file"].size > 2 * 1024 * 1024:
                raise ValidationError({"file": "CSV file exceeds 2 MB."})
            try:
                content = request.FILES["file"].read().decode("utf-8-sig")
                reader = csv.DictReader(io.StringIO(content))
                if not reader.fieldnames:
                    raise ValueError("CSV header is required.")
                rows = list(reader)
                for row in rows:
                    for field in ("rate_percent", "effective_to"):
                        if field in row and row[field] == "":
                            row[field] = None
            except (UnicodeDecodeError, csv.Error, ValueError) as exc:
                raise ValidationError({"file": str(exc)}) from exc
        if not isinstance(rows, list) or not rows or len(rows) > 500:
            raise ValidationError({"rows": "Provide 1 to 500 records."})
        company_id = self.company_id()
        seen = set()
        serializers_list = []
        errors = []
        intervals = []
        for index, row in enumerate(rows, 1):
            if not isinstance(row, dict):
                errors.append({"row": index, "errors": {"detail": "Object required."}})
                continue
            data = dict(row)
            if str(data.get("company")) != str(company_id):
                errors.append({"row": index, "errors": {"company": "Company does not match working company."}})
                continue
            code = str(data.get("code", "")).strip().upper()
            key = (code, str(data.get("effective_from", ""))) if self.resource.endswith("RATE") else code
            if key in seen:
                errors.append({"row": index, "errors": {"code": "Duplicate in file."}})
                continue
            seen.add(key)
            serializer = self.get_serializer(data=data)
            if serializer.is_valid():
                if self.resource.endswith("RATE"):
                    values = serializer.validated_data
                    start, end = values["effective_from"], values.get("effective_to")
                    scope = values.get("business_scope", "BOTH")
                    tax_type_id = values["tax_type_ref"].pk
                    if any(existing_type == tax_type_id and (scope == "BOTH" or existing_scope == "BOTH" or scope == existing_scope) and (existing_end is None or existing_end >= start) and (end is None or end >= existing_start) for existing_type, existing_scope, existing_start, existing_end in intervals):
                        errors.append({"row": index, "errors": {"effective_from": "Effective period overlaps another row."}})
                        continue
                    intervals.append((tax_type_id, scope, start, end))
                serializers_list.append(serializer)
            else:
                errors.append({"row": index, "errors": serializer.errors})
        return serializers_list, errors

    @action(detail=False, methods=("post",), url_path="import-preview")
    def import_preview(self, request):
        valid, errors = self._import_rows(request)
        return Response({"valid_count": len(valid), "errors": errors})

    @action(detail=False, methods=("post",), url_path="import-apply")
    def import_apply(self, request):
        with transaction.atomic():
            valid, errors = self._import_rows(request)
            if errors:
                raise ValidationError({"rows": errors})
            created = []
            for serializer in valid:
                serializer.validate(serializer.validated_data)
                try:
                    obj = serializer.save()
                except IntegrityError as exc:
                    raise ValidationError({"rows": "Import conflicts with existing data."}) from exc
                self.audit(obj, "IMPORT", after=self.get_serializer(obj).data)
                created.append(self.get_serializer(obj).data)
            return Response({"created": created}, status=status.HTTP_201_CREATED)


class TaxTypeViewSet(CatalogViewSet):
    queryset = TaxType.objects.select_related("company", "input_account", "output_account")
    serializer_class = TaxTypeSerializer
    resource = "MD.TAX_TYPE"

    def get_queryset(self):
        company_id = self.company_id()
        queryset = self.queryset.filter(Q(company_id=company_id) | Q(company__isnull=True))
        if self.action not in ("list", "retrieve", "export"):
            queryset = queryset.filter(company_id=company_id)
        if value := self.request.query_params.get("status"):
            queryset = queryset.filter(status=value)
        return queryset


class TaxRateConfigViewSet(CatalogViewSet):
    queryset = TaxRate.objects.select_related("company", "tax_type_ref")
    serializer_class = TaxRateConfigSerializer
    resource = "MD.TAX_RATE"

    def get_queryset(self):
        queryset = self.queryset.filter(company_id=self.company_id(), tax_type_ref__isnull=False)
        for field in ("tax_type_ref_id", "business_scope", "status"):
            if value := self.request.query_params.get(field):
                queryset = queryset.filter(**{field: value})
        return queryset

    @action(detail=False, methods=("get",))
    def resolve(self, request):
        from django.utils.dateparse import parse_date
        on_date = parse_date(request.query_params.get("on_date", ""))
        scope = request.query_params.get("business_scope")
        if not on_date or scope not in ("INPUT", "OUTPUT"):
            raise ValidationError({"detail": "Valid on_date and business_scope are required."})
        queryset = self.get_queryset().filter(status="ACTIVE", tax_type_ref__status="ACTIVE", effective_from__lte=on_date).filter(Q(effective_to__isnull=True) | Q(effective_to__gte=on_date)).filter(business_scope__in=(scope, "BOTH"))
        if value := request.query_params.get("tax_type_ref_id"):
            queryset = queryset.filter(tax_type_ref_id=value)
        return Response(self.get_serializer(queryset, many=True).data)

    @action(detail=True, methods=("post",), url_path="new-version")
    def new_version(self, request, pk=None):
        old = self.get_object()
        if str(request.data.get("version")) != str(old.version):
            raise ValidationError({"version": "Record changed; reload before editing."})
        with transaction.atomic():
            data = dict(self.get_serializer(old).data)
            data.update(request.data)
            data["company"] = str(old.company_id)
            data["tax_type_ref"] = str(old.tax_type_ref_id)
            if old.effective_to is None:
                from django.utils.dateparse import parse_date
                new_start = parse_date(str(data.get("effective_from", "")))
                if not new_start:
                    raise ValidationError({"effective_from": "Valid start date is required."})
                if new_start <= old.effective_from:
                    raise ValidationError({"effective_from": "New version must start later."})
                old.effective_to = new_start - timedelta(days=1)
                old.version += 1
                old.save(update_fields=("effective_to", "version", "updated_at"))
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            obj = serializer.save()
            self.audit(obj, "NEW_VERSION", after=self.get_serializer(obj).data)
        return Response(self.get_serializer(obj).data, status=status.HTTP_201_CREATED)
