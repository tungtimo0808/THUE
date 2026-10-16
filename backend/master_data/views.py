from rest_framework import mixins
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_datetime
from iam.permissions import has_effective_permission
import csv
import io
from django.db.models import Q
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.viewsets import GenericViewSet
from rest_framework.exceptions import PermissionDenied, ValidationError

from audit_log.services import record_audit
from iam.permissions import HasIamPermission, assignment_permission_codes, effective_assignments
from organization.models import Company

from . import bank_account_services, expense_item_services, statistical_code_services, models, serializers
from .models import item_category_max_depth


def permission_map(resource):
    return {
        "GET": f"{resource}.VIEW",
        "POST": f"{resource}.CREATE",
        "PUT": f"{resource}.EDIT",
        "PATCH": f"{resource}.EDIT",
    }


class MasterDataViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    permission_classes = (HasIamPermission,)
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = ("code", "name")
    ordering_fields = ("code", "name")
    company_lookup = "company_id"

    def _scope_party_queryset(self, queryset):
        if self.iam_permissions.get("GET") != "MD.PARTY.VIEW" or self.request.user.is_superuser:
            return queryset
        company_id = self.request.query_params.get("company_id")
        if not company_id:
            return queryset.none()
        branches, owned = set(), False
        for assignment in effective_assignments(self.request.user.iam_account, Company.objects.get(pk=company_id)):
            code = "MD.PARTY.EDIT" if self.request.method in ("PUT", "PATCH") else "MD.PARTY.VIEW"
            if code not in assignment_permission_codes(assignment):
                continue
            scope = assignment.data_scope_set
            if scope is None or scope.allow_all_company_data:
                return queryset
            branches.update(scope.branch_scopes.values_list("branch_id", flat=True))
            owned |= scope.allow_owned_records
        prefix = "" if queryset.model is models.Party else "party__"
        condition = Q(**{f"{prefix}branch_id__in": branches})
        if owned:
            condition |= Q(**{f"{prefix}owner": self.request.user.iam_account})
        return queryset.filter(condition)

    def get_queryset(self):
        queryset = super().get_queryset()
        company_id = self.request.query_params.get("company_id")
        if self.company_lookup and company_id:
            queryset = queryset.filter(**{self.company_lookup: company_id})
            branch_id = self.request.query_params.get("branch_id")
            warehouse_id = self.request.query_params.get("warehouse_id")
            bank_account_id = self.request.query_params.get("bank_account_id")
            project_id = self.request.query_params.get("project_id")
            cost_center_id = self.request.query_params.get("cost_center_id")
            model = queryset.model
            if branch_id and any(field.name == "branch" for field in model._meta.fields):
                queryset = queryset.filter(branch_id=branch_id)
            if warehouse_id:
                queryset = queryset.filter(pk=warehouse_id) if model is models.Warehouse else queryset.filter(warehouse_id=warehouse_id)
            if bank_account_id and model is models.CompanyBankAccount:
                queryset = queryset.filter(pk=bank_account_id)
            if project_id and model is models.Project:
                queryset = queryset.filter(pk=project_id)
            if cost_center_id and model is models.CostCenter:
                queryset = queryset.filter(pk=cost_center_id)
            return self._scope_party_queryset(queryset)
        if self.company_lookup:
            return queryset.none()
        return queryset

    def _company(self, instance):
        current = instance
        for path in ("company", "party.company", "warehouse.company", "item.company", "data_scope_set.company"):
            current = instance
            try:
                for part in path.split("."):
                    current = getattr(current, part)
                if current:
                    return current
            except (AttributeError, models.Party.DoesNotExist):
                continue
        company_id = self.request.query_params.get("company_id") or self.request.data.get("company")
        return Company.objects.filter(pk=company_id).first() if company_id else None

    def _audit(self, instance, action, before=None, after=None):
        company = self._company(instance)
        if company:
            record_audit(
                company=company,
                actor_user=self.request.user.iam_account,
                module_code="MDM",
                action_code=action,
                entity=instance,
                before=before,
                after=after,
                request=self.request,
                reason=self.request.headers.get("X-Audit-Reason", ""),
            )

    def perform_create(self, serializer):
        if self.iam_permissions.get("POST") == "MD.PARTY.CREATE":
            company_id = self.request.query_params.get("company_id")
            party = serializer.validated_data.get("party")
            company = serializer.validated_data.get("company") or (party.company if party else None)
            if not company or str(company.pk) != str(company_id):
                raise ValidationError({"company": "Đối tượng phải thuộc doanh nghiệp đang chọn."})
            if not self.request.user.is_superuser:
                branches, owned = set(), False
                for assignment in effective_assignments(self.request.user.iam_account, company):
                    if "MD.PARTY.CREATE" not in assignment_permission_codes(assignment):
                        continue
                    scope = assignment.data_scope_set
                    if scope is None or scope.allow_all_company_data:
                        break
                    branches.update(scope.branch_scopes.values_list("branch_id", flat=True))
                    owned |= scope.allow_owned_records
                else:
                    branch_id = party.branch_id if party else getattr(serializer.validated_data.get("branch"), "pk", None)
                    owner = party.owner if party else serializer.validated_data.get("owner")
                    if branch_id not in branches and not (owned and owner == self.request.user.iam_account):
                        raise PermissionDenied("Đối tượng nằm ngoài phạm vi dữ liệu.")
        instance = serializer.save()
        self._audit(instance, "CREATE", after=serializer.data)

    def perform_update(self, serializer):
        before = type(serializer)(serializer.instance, context=self.get_serializer_context()).data
        instance = serializer.save()
        self._audit(instance, "EDIT", before=before, after=serializer.data)


class CurrencyViewSet(MasterDataViewSet):
    queryset = models.Currency.objects.all()
    serializer_class = serializers.CurrencySerializer
    company_lookup = None
    iam_permissions = permission_map("MD.COMMON")


class BankViewSet(MasterDataViewSet):
    queryset = models.Bank.objects.all()
    serializer_class = serializers.BankSerializer
    company_lookup = None
    iam_permissions = permission_map("MD.COMMON")


class DocumentTypeViewSet(MasterDataViewSet):
    queryset = models.DocumentType.objects.all()
    serializer_class = serializers.DocumentTypeSerializer
    company_lookup = None
    iam_permissions = permission_map("MD.COMMON")


def _viewset(name, model, serializer, resource, company_lookup="company_id", search=("code", "name")):
    return type(name, (MasterDataViewSet,), {
        "queryset": model.objects.all(),
        "serializer_class": serializer,
        "iam_permissions": permission_map(resource),
        "company_lookup": company_lookup,
        "search_fields": search,
        "__module__": __name__,
    })


ExchangeRateTypeViewSet = _viewset("ExchangeRateTypeViewSet", models.ExchangeRateType, serializers.ExchangeRateTypeSerializer, "MD.COMMON")
ExchangeRateViewSet = _viewset("ExchangeRateViewSet", models.ExchangeRate, serializers.ExchangeRateSerializer, "MD.COMMON", search=("source_description",))
from .payment_terms import PaymentTermViewSet
from .payment_methods import PaymentMethodViewSet
TaxRateViewSet = _viewset("TaxRateViewSet", models.TaxRate, serializers.TaxRateSerializer, "MD.COMMON")
ProjectViewSet = _viewset("ProjectViewSet", models.Project, serializers.ProjectSerializer, "MD.ORGANIZATION")
CostCenterViewSet = _viewset("CostCenterViewSet", models.CostCenter, serializers.CostCenterSerializer, "MD.ORGANIZATION")
PartyViewSet = _viewset("PartyViewSet", models.Party, serializers.PartySerializer, "MD.PARTY", search=("code", "name", "legal_name", "tax_code", "identity_no"))
PartyRoleViewSet = _viewset("PartyRoleViewSet", models.PartyRole, serializers.PartyRoleSerializer, "MD.PARTY", "party__company_id", ("party__code", "party__name"))
PartyAddressViewSet = _viewset("PartyAddressViewSet", models.PartyAddress, serializers.PartyAddressSerializer, "MD.PARTY", "party__company_id", ("party__code", "address_line"))
PartyBankAccountViewSet = _viewset("PartyBankAccountViewSet", models.PartyBankAccount, serializers.PartyBankAccountSerializer, "MD.PARTY", "party__company_id", ("party__code", "account_number", "account_name"))
PartyContactViewSet = _viewset("PartyContactViewSet", models.PartyContact, serializers.PartyContactSerializer, "MD.PARTY", "party__company_id", ("party__code", "contact_name", "email", "phone"))
CustomerProfileViewSet = _viewset("CustomerProfileViewSet", models.CustomerProfile, serializers.CustomerProfileSerializer, "MD.PARTY", "party__company_id", ("party__code", "party__name"))
VendorProfileViewSet = _viewset("VendorProfileViewSet", models.VendorProfile, serializers.VendorProfileSerializer, "MD.PARTY", "party__company_id", ("party__code", "party__name"))
class ItemCategoryViewSet(mixins.DestroyModelMixin, MasterDataViewSet):
    queryset = models.ItemCategory.objects.select_related("company", "parent", "branch")
    serializer_class = serializers.ItemCategorySerializer
    iam_permissions = permission_map("MD.ITEM_GROUP")
    action_permissions = {
        "move": "MD.ITEM_GROUP.MOVE", "change_status": "MD.ITEM_GROUP.DEACTIVATE",
        "destroy": "MD.ITEM_GROUP.DELETE", "bulk_assign": "MD.ITEM_GROUP.BULK",
        "import_csv": "MD.ITEM_GROUP.IMPORT", "export_csv": "MD.ITEM_GROUP.EXPORT",
    }
    allow_scoped_list_permission = True
    ordering_fields = ("sort_order", "code", "name")

    def _allowed(self, category, code):
        return self.request.user.is_superuser or has_effective_permission(self.request.user.iam_account, category.company, code, branch_id=category.branch_id)

    def get_queryset(self):
        queryset = super().get_queryset()
        for field in ("parent_id", "status", "branch_id"):
            value = self.request.query_params.get(field)
            if value:
                queryset = queryset.filter(**{field: value})
        if self.request.user.is_superuser:
            return queryset
        code = "MD.ITEM_GROUP.EDIT" if self.request.method in ("PUT", "PATCH") else "MD.ITEM_GROUP.VIEW"
        return queryset.filter(pk__in=[category.pk for category in queryset if self._allowed(category, code)])

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)

    def _snapshot(self, category):
        return {"code": category.code, "name": category.name, "parent": str(category.parent_id) if category.parent_id else None, "status": category.status, "path": category.path, "applicable_types": category.applicable_types, "sort_order": category.sort_order}

    def _version(self, category):
        version = self.request.data.get("version")
        if not version:
            raise ValidationError({"version": "Cần gửi phiên bản dữ liệu hiện tại."})
        if parse_datetime(str(version)) != category.updated_at:
            from rest_framework.exceptions import APIException
            error = APIException("Nhóm đã được cập nhật. Hãy tải lại.")
            error.status_code = 409
            raise error

    @transaction.atomic
    def perform_create(self, serializer):
        company = serializer.validated_data["company"]
        branch = serializer.validated_data.get("branch")
        parent = serializer.validated_data.get("parent")
        if company.status != "ACTIVE" or str(company.pk) != str(self.request.query_params.get("company_id") or self.request.data.get("company")):
            raise ValidationError({"company": "Doanh nghiệp không hợp lệ hoặc chưa hoạt động."})
        if not self.request.user.is_superuser and not has_effective_permission(self.request.user.iam_account, company, "MD.ITEM_GROUP.CREATE", branch_id=getattr(branch, "pk", None)):
            raise PermissionDenied("Nhóm nằm ngoài Data Scope.")
        if parent and not self._allowed(parent, "MD.ITEM_GROUP.VIEW"):
            raise PermissionDenied("Nhóm cha nằm ngoài Data Scope.")
        category = serializer.save()
        self._audit(category, "ITEM_GROUP_CREATE", after=self._snapshot(category))

    @transaction.atomic
    def perform_update(self, serializer):
        category = models.ItemCategory.objects.select_for_update().get(pk=serializer.instance.pk)
        serializer.instance = category
        self._version(category)
        before = self._snapshot(category)
        category = serializer.save()
        self._audit(category, "ITEM_GROUP_UPDATE", before=before, after=self._snapshot(category))

    @action(detail=True, methods=("post",))
    @transaction.atomic
    def move(self, request, pk=None):
        category = self.get_object()
        if not self._allowed(category, "MD.ITEM_GROUP.MOVE"):
            raise PermissionDenied("Không có quyền di chuyển nhóm.")
        category = models.ItemCategory.objects.select_for_update().get(pk=category.pk)
        self._version(category)
        parent_id = request.data.get("parent")
        parent = get_object_or_404(models.ItemCategory.objects.select_for_update(), pk=parent_id, company=category.company) if parent_id else None
        if parent and not self._allowed(parent, "MD.ITEM_GROUP.MOVE"):
            raise PermissionDenied("Nhóm cha mới nằm ngoài Data Scope.")
        before = self._snapshot(category)
        category.parent = parent
        try:
            category.full_clean()
        except Exception as exc:
            from django.core.exceptions import ValidationError as DjangoValidationError
            if isinstance(exc, DjangoValidationError):
                raise ValidationError(exc.message_dict) from exc
            raise
        def check_depth(node, level):
            if level >= item_category_max_depth(category.company_id):
                raise ValidationError({"parent": "Cây nhóm vượt quá độ sâu tối đa được cấu hình."})
            for child in node.children.all():
                check_depth(child, level + 1)
        check_depth(category, parent.depth + 1 if parent else 0)
        category.save(update_fields=("parent",))
        def refresh_children(node):
            for child in node.children.all():
                child.save(update_fields=("path", "depth"))
                refresh_children(child)
        refresh_children(category)
        self._audit(category, "ITEM_GROUP_MOVE", before=before, after=self._snapshot(category))
        return Response(self.get_serializer(category).data)

    @action(detail=True, methods=("post",), url_path="change-status")
    @transaction.atomic
    def change_status(self, request, pk=None):
        category = self.get_object()
        if not self._allowed(category, "MD.ITEM_GROUP.DEACTIVATE"):
            raise PermissionDenied("Không có quyền đổi trạng thái nhóm.")
        category = models.ItemCategory.objects.select_for_update().get(pk=category.pk)
        self._version(category)
        new_status = request.data.get("status")
        if new_status not in {"ACTIVE", "INACTIVE", "ARCHIVED"}:
            raise ValidationError({"status": "Trạng thái không hợp lệ."})
        if new_status != "ACTIVE" and (category.children.filter(status="ACTIVE").exists() or category.items.filter(status="ACTIVE").exists()):
            raise ValidationError({"status": "Nhóm còn nhóm con hoặc đối tượng ACTIVE."})
        before = self._snapshot(category)
        category.status = new_status
        try:
            category.full_clean()
        except Exception as exc:
            from django.core.exceptions import ValidationError as DjangoValidationError
            if isinstance(exc, DjangoValidationError):
                raise ValidationError(exc.message_dict) from exc
            raise
        category.save(update_fields=("status",))
        self._audit(category, "ITEM_GROUP_STATUS", before=before, after=self._snapshot(category))
        return Response(self.get_serializer(category).data)

    @transaction.atomic
    def perform_destroy(self, instance):
        if not self._allowed(instance, "MD.ITEM_GROUP.DELETE"):
            raise PermissionDenied("Không có quyền xóa nhóm.")
        instance = models.ItemCategory.objects.select_for_update().get(pk=instance.pk)
        if instance.children.exists() or instance.items.exists():
            raise ValidationError("Chỉ được xóa nhóm chưa có nhóm con hoặc đối tượng.")
        before = self._snapshot(instance)
        self._audit(instance, "ITEM_GROUP_DELETE", before=before)
        instance.delete()

    @action(detail=True, methods=("get",))
    def history(self, request, pk=None):
        category = self.get_object()
        from audit_log.models import AuditLog
        return Response(list(AuditLog.objects.filter(company=category.company, entity_type="master_data.ItemCategory", entity_id=category.pk).values("action_code", "occurred_at", "actor_name_snapshot")))

    @action(detail=True, methods=("get",))
    def impact(self, request, pk=None):
        category = self.get_object()
        return Response({"active_children": category.children.filter(status="ACTIVE").count(), "active_items": category.items.filter(status="ACTIVE").count(), "all_items": category.items.count()})

    @action(detail=True, methods=("post",), url_path="bulk-assign")
    def bulk_assign(self, request, pk=None):
        category = self.get_object()
        if not self._allowed(category, "MD.ITEM_GROUP.BULK") or category.status != "ACTIVE":
            raise PermissionDenied("Không có quyền chuyển đối tượng vào nhóm này.")
        item_ids = request.data.get("item_ids", [])
        if not isinstance(item_ids, list) or len(item_ids) > 1000:
            raise ValidationError({"item_ids": "Cần danh sách tối đa 1000 đối tượng."})
        dry_run = request.data.get("dry_run", True) is not False
        results = {"dry_run": dry_run, "updated": [], "proposed": [], "errors": []}
        for item_id in item_ids:
            try:
                item = models.Item.objects.filter(pk=item_id, company=category.company).first()
            except (ValueError, TypeError, DjangoValidationError):
                item = None
            if not item or item.item_type not in category.applicable_types or category.branch_id and item.branch_id != category.branch_id or not self.request.user.is_superuser and not has_effective_permission(self.request.user.iam_account, category.company, "MD.ITEM.EDIT", branch_id=item.branch_id):
                results["errors"].append({"item_id": str(item_id), "error": "Đối tượng không hợp lệ hoặc ngoài phạm vi."})
                continue
            previous = str(item.category_id) if item.category_id else None
            results["proposed"].append({"item_id": str(item.pk), "from_category": previous, "to_category": str(category.pk)})
            if dry_run:
                continue
            try:
                with transaction.atomic():
                    item.category = category
                    item.full_clean()
                    item.save(update_fields=("category", "updated_at"))
                    self._audit(category, "ITEM_GROUP_ASSIGN", before={"item": str(item.pk), "category": previous}, after={"item": str(item.pk), "category": str(category.pk)})
            except Exception as exc:
                from django.core.exceptions import ValidationError as DjangoValidationError
                if isinstance(exc, DjangoValidationError):
                    results["errors"].append({"item_id": str(item_id), "error": exc.message_dict})
                    continue
                raise
            results["updated"].append(str(item.pk))
        return Response(results)

    @action(detail=False, methods=("get",))
    def tree(self, request):
        categories = list(self.get_queryset().order_by("depth", "sort_order", "code"))
        visible = {category.pk: {**self.get_serializer(category).data, "children": []} for category in categories}
        roots = []
        for category in categories:
            if category.parent_id in visible:
                visible[category.parent_id]["children"].append(visible[category.pk])
            else:
                roots.append(visible[category.pk])
        return Response(roots)

    @action(detail=False, methods=("get",), url_path="export-csv")
    def export_csv(self, request):
        categories = [category for category in self.get_queryset().order_by("path") if self._allowed(category, "MD.ITEM_GROUP.EXPORT")]
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(("code", "name", "parent_code", "applicable_types", "status", "sort_order", "depth", "path"))
        for category in categories:
            writer.writerow((category.code, category.name, category.parent.code if category.parent_id else "", "|".join(category.applicable_types), category.status, category.sort_order, category.depth, category.path))
        response = HttpResponse(output.getvalue(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="item-groups.csv"'
        return response

    @action(detail=False, methods=("post",), url_path="import-csv")
    def import_csv(self, request):
        company = get_object_or_404(Company, pk=request.data.get("company"))
        if company.status != "ACTIVE":
            raise ValidationError({"company": "Doanh nghiệp chưa hoạt động."})
        uploaded = request.FILES.get("file")
        if not uploaded:
            raise ValidationError({"file": "Cần tải lên tệp CSV."})
        try:
            reader = csv.DictReader(io.StringIO(uploaded.read().decode("utf-8-sig")))
            if not {"code", "name", "applicable_types"}.issubset(reader.fieldnames or []):
                raise ValidationError({"file": "Thiếu cột code, name hoặc applicable_types."})
            rows = list(reader)
        except UnicodeDecodeError as exc:
            raise ValidationError({"file": "Tệp phải dùng UTF-8."}) from exc
        if len(rows) > 1000:
            raise ValidationError({"file": "Tối đa 1000 dòng mỗi lần nhập."})
        results = {"created": [], "errors": []}
        for number, row in enumerate(rows, start=2):
            parent_code = row.get("parent_code", "").strip().upper()
            parent = models.ItemCategory.objects.filter(company=company, code=parent_code).first() if parent_code else None
            if parent_code and not parent:
                results["errors"].append({"row": number, "error": "Nhóm cha chưa tồn tại; đặt nhóm cha trước nhóm con."})
                continue
            if parent and not self._allowed(parent, "MD.ITEM_GROUP.VIEW"):
                results["errors"].append({"row": number, "error": "Nhóm cha nằm ngoài Data Scope."})
                continue
            branch_id = row.get("branch_id") or getattr(parent, "branch_id", None)
            if not self.request.user.is_superuser and not has_effective_permission(self.request.user.iam_account, company, "MD.ITEM_GROUP.IMPORT", branch_id=branch_id):
                results["errors"].append({"row": number, "error": "Nhóm nằm ngoài Data Scope."})
                continue
            payload = {"company": str(company.pk), "code": row.get("code", ""), "name": row.get("name", ""), "applicable_types": [part.strip().upper() for part in row.get("applicable_types", "").split("|") if part.strip()]}
            if parent:
                payload["parent"] = str(parent.pk)
            if branch_id:
                payload["branch"] = str(branch_id)
            serializer = self.get_serializer(data=payload)
            if not serializer.is_valid():
                results["errors"].append({"row": number, "error": serializer.errors})
                continue
            with transaction.atomic():
                category = serializer.save()
                self._audit(category, "ITEM_GROUP_IMPORT", after=self._snapshot(category))
            results["created"].append(str(category.pk))
        return Response(results)
class UnitOfMeasureViewSet(mixins.DestroyModelMixin, MasterDataViewSet):
    queryset = models.UnitOfMeasure.objects.select_related("company", "reference_uom")
    serializer_class = serializers.UnitOfMeasureSerializer
    iam_permissions = permission_map("MD.UOM")
    action_permissions = {"change_status": "MD.UOM.DEACTIVATE", "destroy": "MD.UOM.DELETE", "import_csv": "MD.UOM.IMPORT", "export_csv": "MD.UOM.EXPORT"}
    ordering_fields = ("measurement_type", "sort_order", "code", "name")

    def get_queryset(self):
        queryset = super().get_queryset()
        for field in ("measurement_type", "status"):
            value = self.request.query_params.get(field)
            if value:
                queryset = queryset.filter(**{field: value})
        return queryset

    def _snapshot(self, uom):
        return {"code": uom.code, "name": uom.name, "symbol": uom.symbol, "measurement_type": uom.measurement_type, "decimal_places": uom.decimal_places, "integer_only": uom.integer_only, "is_reference": uom.is_reference, "reference_uom": str(uom.reference_uom_id) if uom.reference_uom_id else None, "factor_to_reference": str(uom.factor_to_reference) if uom.factor_to_reference is not None else None, "status": uom.status}

    def _check_version(self, uom):
        version = self.request.data.get("version")
        if not version:
            raise ValidationError({"version": "Cần gửi phiên bản dữ liệu hiện tại."})
        if parse_datetime(str(version)) != uom.updated_at:
            from rest_framework.exceptions import APIException
            error = APIException("Đơn vị tính đã được cập nhật. Hãy tải lại.")
            error.status_code = 409
            raise error

    @transaction.atomic
    def perform_create(self, serializer):
        company = serializer.validated_data["company"]
        if company.status != "ACTIVE" or str(company.pk) != str(self.request.query_params.get("company_id") or self.request.data.get("company")):
            raise ValidationError({"company": "Doanh nghiệp không hợp lệ hoặc chưa hoạt động."})
        uom = serializer.save()
        self._audit(uom, "UOM_CREATE", after=self._snapshot(uom))

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        uom = models.UnitOfMeasure.objects.select_for_update().get(pk=serializer.instance.pk)
        serializer.instance = uom
        self._check_version(uom)
        before = self._snapshot(uom)
        uom = serializer.save()
        self._audit(uom, "UOM_UPDATE", before=before, after=self._snapshot(uom))

    def _impact(self, uom):
        return {"base_items": uom.items.count(), "purchase_items": uom.purchase_items.count(), "sales_items": uom.sales_items.count(), "fixed_conversions": uom.fixed_conversions.count(), "item_conversions": uom.conversions_from.count() + uom.conversions_to.count()}

    @action(detail=True, methods=("get",))
    def impact(self, request, pk=None):
        return Response(self._impact(self.get_object()))

    @action(detail=True, methods=("post",), url_path="change-status")
    @transaction.atomic
    def change_status(self, request, pk=None):
        uom = self.get_object()
        uom = models.UnitOfMeasure.objects.select_for_update().get(pk=uom.pk)
        self._check_version(uom)
        new_status = request.data.get("status")
        if new_status not in {"ACTIVE", "INACTIVE", "ARCHIVED"}:
            raise ValidationError({"status": "Trạng thái không hợp lệ."})
        impact = self._impact(uom)
        if new_status != "ACTIVE" and (impact["base_items"] or impact["purchase_items"] or impact["sales_items"] or impact["fixed_conversions"]):
            raise ValidationError({"status": "Đơn vị còn được Item hoặc quy đổi cố định sử dụng."})
        before = self._snapshot(uom)
        uom.status = new_status
        try:
            uom.full_clean()
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict) from exc
        uom.save(update_fields=("status",))
        self._audit(uom, "UOM_STATUS", before=before, after=self._snapshot(uom))
        return Response(self.get_serializer(uom).data)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        from django.db.models.deletion import ProtectedError
        uom = models.UnitOfMeasure.objects.select_for_update().get(pk=instance.pk)
        if any(self._impact(uom).values()) or uom.item_barcodes.exists():
            raise ValidationError("Chỉ được xóa đơn vị tính chưa được sử dụng.")
        before = self._snapshot(uom)
        try:
            uom.delete()
        except ProtectedError as exc:
            raise ValidationError("Đơn vị tính đã có dữ liệu tham chiếu.") from exc
        self._audit(uom, "UOM_DELETE", before=before)

    @action(detail=True, methods=("get",))
    def history(self, request, pk=None):
        uom = self.get_object()
        from audit_log.models import AuditLog
        return Response(list(AuditLog.objects.filter(company=uom.company, entity_type="master_data.UnitOfMeasure", entity_id=uom.pk).values("action_code", "occurred_at", "actor_name_snapshot")))

    @action(detail=False, methods=("get",), url_path="export-csv")
    def export_csv(self, request):
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(("code", "name", "symbol", "measurement_type", "decimal_places", "integer_only", "is_reference", "reference_code", "factor_to_reference", "status"))
        for uom in self.get_queryset().order_by("measurement_type", "sort_order", "code"):
            writer.writerow((uom.code, uom.name, uom.symbol, uom.measurement_type, uom.decimal_places, uom.integer_only, uom.is_reference, uom.reference_uom.code if uom.reference_uom_id else "", uom.factor_to_reference if uom.factor_to_reference is not None else "", uom.status))
        response = HttpResponse(output.getvalue(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="units-of-measure.csv"'
        return response

    @action(detail=False, methods=("post",), url_path="import-csv")
    def import_csv(self, request):
        company = get_object_or_404(Company, pk=request.data.get("company"))
        if request.query_params.get("company_id") and str(company.pk) != request.query_params["company_id"]:
            raise ValidationError({"company": "Doanh nghiệp nhập không khớp doanh nghiệp đang chọn."})
        if company.status != "ACTIVE":
            raise ValidationError({"company": "Doanh nghiệp chưa hoạt động."})
        uploaded = request.FILES.get("file")
        if not uploaded:
            raise ValidationError({"file": "Cần tải lên tệp CSV."})
        try:
            reader = csv.DictReader(io.StringIO(uploaded.read().decode("utf-8-sig")))
            if not {"code", "name", "symbol", "measurement_type", "decimal_places"}.issubset(reader.fieldnames or []):
                raise ValidationError({"file": "Thiếu cột bắt buộc của đơn vị tính."})
            rows = list(reader)
        except UnicodeDecodeError as exc:
            raise ValidationError({"file": "Tệp phải dùng UTF-8."}) from exc
        if len(rows) > 1000:
            raise ValidationError({"file": "Tối đa 1000 dòng mỗi lần nhập."})
        result = {"created": [], "errors": []}
        for number, row in enumerate(rows, start=2):
            if None in row:
                result["errors"].append({"row": number, "error": "Số cột CSV không hợp lệ."})
                continue
            row = {key: value or "" for key, value in row.items()}
            reference_code = row.get("reference_code", "").strip().upper()
            reference = models.UnitOfMeasure.objects.filter(company=company, code=reference_code, status="ACTIVE", is_reference=True).first() if reference_code else None
            if reference_code and not reference:
                result["errors"].append({"row": number, "error": "Đơn vị tham chiếu chưa tồn tại; đặt dòng tham chiếu trước."})
                continue
            payload = {"company": str(company.pk), "code": row.get("code", ""), "name": row.get("name", ""), "symbol": row.get("symbol", ""), "measurement_type": row.get("measurement_type", ""), "decimal_places": row.get("decimal_places", ""), "integer_only": row.get("integer_only", "").lower() in {"true", "1", "yes"}, "is_reference": row.get("is_reference", "").lower() in {"true", "1", "yes"}}
            if row.get("status"):
                payload["status"] = row["status"]
            if reference:
                payload["reference_uom"] = str(reference.pk)
                payload["factor_to_reference"] = row.get("factor_to_reference", "")
            serializer = self.get_serializer(data=payload)
            if not serializer.is_valid():
                result["errors"].append({"row": number, "error": serializer.errors})
                continue
            with transaction.atomic():
                uom = serializer.save()
                self._audit(uom, "UOM_IMPORT", after=self._snapshot(uom))
            result["created"].append(str(uom.pk))
        return Response(result)
class ItemViewSet(MasterDataViewSet):
    queryset = models.Item.objects.select_related("company", "branch", "category", "base_uom")
    serializer_class = serializers.ItemSerializer
    iam_permissions = permission_map("MD.ITEM")
    action_permissions = {"change_status": "MD.ITEM.DEACTIVATE", "history": "MD.ITEM.VIEW", "barcodes": "MD.ITEM.EDIT", "import_csv": "MD.ITEM.IMPORT", "export_csv": "MD.ITEM.EXPORT"}
    allow_scoped_list_permission = True
    search_fields = ("code", "name", "alternate_name", "barcodes__code")

    def _allowed(self, item, code):
        if self.request.user.is_superuser:
            return True
        return has_effective_permission(self.request.user.iam_account, item.company, code, branch_id=item.branch_id)

    def get_queryset(self):
        queryset = super().get_queryset()
        for field in ("status", "item_type", "category_id", "branch_id"):
            value = self.request.query_params.get(field)
            if value:
                queryset = queryset.filter(**{field: value})
        if self.request.user.is_superuser:
            return queryset
        code = "MD.ITEM.EDIT" if self.request.method in ("PUT", "PATCH") else "MD.ITEM.VIEW"
        return queryset.filter(pk__in=[item.pk for item in queryset if self._allowed(item, code)])

    @transaction.atomic
    def perform_create(self, serializer):
        company = serializer.validated_data["company"]
        branch = serializer.validated_data.get("branch")
        if str(company.pk) != str(self.request.query_params.get("company_id") or self.request.data.get("company")):
            raise ValidationError({"company": "Đối tượng phải thuộc doanh nghiệp đang chọn."})
        if company.status != "ACTIVE":
            raise ValidationError({"company": "Doanh nghiệp chưa hoạt động."})
        if not self.request.user.is_superuser and not has_effective_permission(self.request.user.iam_account, company, "MD.ITEM.CREATE", branch_id=getattr(branch, "pk", None)):
            raise PermissionDenied("Đối tượng nằm ngoài phạm vi dữ liệu.")
        conversions = self.request.data.get("conversions", [])
        barcodes = self.request.data.get("barcodes", [])
        if not isinstance(conversions, list) or not isinstance(barcodes, list):
            raise ValidationError("conversions và barcodes phải là danh sách.")
        item = serializer.save()
        for index, conversion in enumerate(conversions, start=1):
            if not isinstance(conversion, dict):
                raise ValidationError({"conversions": {index: "Dòng không hợp lệ."}})
            nested = serializers.ItemUomConversionSerializer(data={**conversion, "item": str(item.pk)})
            if not nested.is_valid():
                raise ValidationError({"conversions": {index: nested.errors}})
            nested.save()
        for index, barcode in enumerate(barcodes, start=1):
            if not isinstance(barcode, dict):
                raise ValidationError({"barcodes": {index: "Dòng không hợp lệ."}})
            nested = serializers.ItemBarcodeSerializer(data={**barcode, "item": str(item.pk), "company": str(company.pk)})
            if not nested.is_valid():
                raise ValidationError({"barcodes": {index: nested.errors}})
            nested.save()
        self._audit(item, "ITEM_CREATE", after={"code": item.code, "name": item.name, "status": item.status})

    @transaction.atomic
    def perform_update(self, serializer):
        item = serializer.instance
        if not self._allowed(item, "MD.ITEM.EDIT"):
            raise PermissionDenied("Đối tượng nằm ngoài phạm vi dữ liệu.")
        version = self.request.data.get("version")
        if not version:
            raise ValidationError({"version": "Cần gửi phiên bản dữ liệu hiện tại."})
        if parse_datetime(str(version)) != item.updated_at:
            from rest_framework.exceptions import APIException
            error = APIException("Đối tượng đã được cập nhật. Hãy tải lại.")
            error.status_code = 409
            raise error
        before = {"code": item.code, "name": item.name, "status": item.status}
        item = serializer.save()
        if not self._allowed(item, "MD.ITEM.EDIT"):
            raise PermissionDenied("Đơn vị mới nằm ngoài phạm vi dữ liệu.")
        self._audit(item, "ITEM_UPDATE", before=before, after={"code": item.code, "name": item.name, "status": item.status})

    @action(detail=True, methods=("post",), url_path="change-status")
    @transaction.atomic
    def change_status(self, request, pk=None):
        item = self.get_object()
        if not self._allowed(item, "MD.ITEM.DEACTIVATE"):
            raise PermissionDenied("Không có quyền đổi trạng thái đối tượng.")
        new_status = request.data.get("status")
        if new_status not in {"ACTIVE", "INACTIVE", "ARCHIVED"}:
            raise ValidationError({"status": "Trạng thái không hợp lệ."})
        version = request.data.get("version")
        if not version:
            raise ValidationError({"version": "Cần gửi phiên bản dữ liệu hiện tại."})
        if parse_datetime(str(version)) != item.updated_at:
            from rest_framework.exceptions import APIException
            error = APIException("Đối tượng đã được cập nhật. Hãy tải lại.")
            error.status_code = 409
            raise error
        if new_status == "ACTIVE" and models.ItemBarcode.objects.filter(code__in=item.barcodes.values_list("code", flat=True), item__company=item.company, item__status="ACTIVE").exclude(item=item).exists():
            raise ValidationError({"status": "Mã vạch trùng với đối tượng ACTIVE khác."})
        impact = self._impact(item)
        if new_status in {"INACTIVE", "ARCHIVED"} and (impact["open_purchase_orders"] or impact["open_sales_orders"]):
            raise ValidationError({"status": "Đối tượng còn đơn mua hoặc đơn bán chưa hoàn tất."})
        before = {"status": item.status}
        item.status = new_status
        try:
            item.full_clean()
        except Exception as exc:
            from django.core.exceptions import ValidationError as DjangoValidationError
            if isinstance(exc, DjangoValidationError):
                raise ValidationError(exc.message_dict) from exc
            raise
        item.save(update_fields=("status", "updated_at"))
        self._audit(item, "ITEM_STATUS", before=before, after={"status": item.status})
        return Response(self.get_serializer(item).data)

    def _impact(self, item):
        from purchases.models import PurchaseOrderLine
        from sales.models import SalesOrderLine
        return {
            "open_purchase_orders": PurchaseOrderLine.objects.filter(item=item).exclude(order__status__in=("COMPLETED", "FULLY_RECEIVED", "CANCELLED")).count(),
            "open_sales_orders": SalesOrderLine.objects.filter(item=item).exclude(order__status__in=("COMPLETED", "FULLY_DELIVERED", "CANCELLED", "TERMINATED")).count(),
            "stock_locations": item.stock_balances.exclude(quantity=0).count(),
        }

    @action(detail=True, methods=("get",))
    def impact(self, request, pk=None):
        return Response(self._impact(self.get_object()))

    @action(detail=True, methods=("get",))
    def history(self, request, pk=None):
        item = self.get_object()
        from audit_log.models import AuditLog
        return Response(list(AuditLog.objects.filter(company=item.company, entity_type="master_data.Item", entity_id=item.pk).values("action_code", "occurred_at", "actor_name_snapshot")))

    @action(detail=True, methods=("get", "post"))
    @transaction.atomic
    def barcodes(self, request, pk=None):
        item = self.get_object()
        if request.method == "GET":
            return Response(serializers.ItemBarcodeSerializer(item.barcodes.all(), many=True).data)
        if not self._allowed(item, "MD.ITEM.EDIT"):
            raise PermissionDenied("Không có quyền thêm mã vạch.")
        serializer = serializers.ItemBarcodeSerializer(data={**request.data, "item": str(item.pk), "company": str(item.company_id)})
        serializer.is_valid(raise_exception=True)
        barcode = serializer.save()
        self._audit(item, "ITEM_BARCODE_ADD", after={"barcode": barcode.code})
        return Response(serializers.ItemBarcodeSerializer(barcode).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=("get",), url_path="export-csv")
    def export_csv(self, request):
        items = [item for item in self.get_queryset() if self._allowed(item, "MD.ITEM.EXPORT")]
        output = io.StringIO()
        writer = csv.writer(output)
        fields = ("code", "name", "item_type", "status", "base_uom_id", "track_inventory", "allow_purchase", "allow_sale")
        writer.writerow(fields)
        for item in items:
            writer.writerow([getattr(item, field) for field in fields])
        response = HttpResponse(output.getvalue(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="items.csv"'
        return response

    @action(detail=False, methods=("post",), url_path="import-csv")
    def import_csv(self, request):
        company = get_object_or_404(Company, pk=request.data.get("company"))
        if company.status != "ACTIVE":
            raise ValidationError({"company": "Doanh nghiệp chưa hoạt động."})
        uploaded = request.FILES.get("file")
        if not uploaded:
            raise ValidationError({"file": "Cần tải lên tệp CSV."})
        try:
            reader = csv.DictReader(io.StringIO(uploaded.read().decode("utf-8-sig")))
            if not {"code", "name", "item_type", "base_uom_id"}.issubset(reader.fieldnames or []):
                raise ValidationError({"file": "Thiếu cột code, name, item_type hoặc base_uom_id."})
            rows = list(reader)
        except UnicodeDecodeError as exc:
            raise ValidationError({"file": "Tệp phải dùng UTF-8."}) from exc
        if len(rows) > 1000:
            raise ValidationError({"file": "Tối đa 1000 dòng mỗi lần nhập."})
        created, errors = [], []
        for number, row in enumerate(rows, start=2):
            branch_id = row.get("branch_id") or None
            if not self.request.user.is_superuser and not has_effective_permission(self.request.user.iam_account, company, "MD.ITEM.IMPORT", branch_id=branch_id):
                errors.append({"row": number, "error": "Dòng nằm ngoài Data Scope."})
                continue
            payload = {"company": str(company.pk), "code": row.get("code", ""), "name": row.get("name", ""), "item_type": row.get("item_type", ""), "base_uom": row.get("base_uom_id", ""), "track_inventory": row.get("item_type") != "SERVICE"}
            if branch_id:
                payload["branch"] = branch_id
            for field in ("category", "purchase_tax_rate", "sales_tax_rate", "inventory_account", "cogs_account", "revenue_account", "expense_account"):
                if row.get(field):
                    payload[field] = row[field]
            serializer = self.get_serializer(data=payload)
            if not serializer.is_valid():
                errors.append({"row": number, "error": serializer.errors})
                continue
            try:
                with transaction.atomic():
                    item = serializer.save()
                    if row.get("barcode"):
                        barcode = serializers.ItemBarcodeSerializer(data={"company": str(company.pk), "item": str(item.pk), "uom": row.get("barcode_uom_id") or str(item.base_uom_id), "code": row["barcode"]})
                        barcode.is_valid(raise_exception=True)
                        barcode.save()
                    self._audit(item, "ITEM_IMPORT", after={"code": item.code})
            except ValidationError as exc:
                errors.append({"row": number, "error": exc.detail})
                continue
            created.append(str(item.pk))
        return Response({"created": created, "errors": errors})
class ItemUomConversionViewSet(MasterDataViewSet):
    queryset = models.ItemUomConversion.objects.select_related("item", "from_uom", "to_uom")
    serializer_class = serializers.ItemUomConversionSerializer
    iam_permissions = permission_map("MD.ITEM")
    allow_scoped_list_permission = True
    company_lookup = "item__company_id"
    search_fields = ("item__code", "item__name")

    def get_queryset(self):
        queryset = super().get_queryset()
        item_id = self.request.query_params.get("item_id")
        if item_id:
            queryset = queryset.filter(item_id=item_id)
        if self.request.user.is_superuser:
            return queryset
        account = self.request.user.iam_account
        code = "MD.ITEM.EDIT" if self.request.method in ("PUT", "PATCH") else "MD.ITEM.VIEW"
        return queryset.filter(pk__in=[conversion.pk for conversion in queryset if has_effective_permission(account, conversion.item.company, code, branch_id=conversion.item.branch_id)])

    @transaction.atomic
    def perform_create(self, serializer):
        item = serializer.validated_data["item"]
        if str(item.company_id) != str(self.request.query_params.get("company_id") or self.request.data.get("company_id")):
            raise ValidationError({"item": "Đối tượng phải thuộc doanh nghiệp đang chọn."})
        if not self.request.user.is_superuser and not has_effective_permission(self.request.user.iam_account, item.company, "MD.ITEM.EDIT", branch_id=item.branch_id):
            raise PermissionDenied("Đối tượng nằm ngoài phạm vi dữ liệu.")
        conversion = serializer.save()
        self._audit(item, "ITEM_UOM_ADD", after={"from_uom": str(conversion.from_uom_id), "factor": str(conversion.factor)})

    @transaction.atomic
    def perform_update(self, serializer):
        item = serializer.instance.item
        if not self.request.user.is_superuser and not has_effective_permission(self.request.user.iam_account, item.company, "MD.ITEM.EDIT", branch_id=item.branch_id):
            raise PermissionDenied("Đối tượng nằm ngoài phạm vi dữ liệu.")
        if "item" in serializer.validated_data and serializer.validated_data["item"].pk != item.pk:
            raise ValidationError({"item": "Không thể chuyển quy đổi sang đối tượng khác."})
        conversion = serializer.save()
        self._audit(item, "ITEM_UOM_UPDATE", after={"from_uom": str(conversion.from_uom_id), "factor": str(conversion.factor)})
def _warehouse_module_active(company):
    from common_services.module_services import check_module_active
    if not check_module_active(company, "INV"):
        raise PermissionDenied("Phân hệ Kho chưa được kích hoạt.")


def _warehouse_version(request, instance):
    version = request.data.get("version")
    if not version:
        raise ValidationError({"version": "Cần gửi phiên bản dữ liệu hiện tại."})
    if parse_datetime(str(version)) != instance.updated_at:
        from rest_framework.exceptions import APIException
        error = APIException("Dữ liệu đã thay đổi. Hãy tải lại.")
        error.status_code = 409
        raise error


class WarehouseViewSet(mixins.DestroyModelMixin, MasterDataViewSet):
    queryset = models.Warehouse.objects.select_related("company", "branch", "project", "keeper_employee", "keeper_user", "cost_center")
    serializer_class = serializers.WarehouseSerializer
    iam_permissions = permission_map("MD.WAREHOUSE")
    action_permissions = {"change_status": "MD.WAREHOUSE.DEACTIVATE", "set_default": "MD.WAREHOUSE.EDIT", "destroy": "MD.WAREHOUSE.DELETE", "import_csv": "MD.WAREHOUSE.IMPORT", "export_csv": "MD.WAREHOUSE.EXPORT"}
    allow_scoped_list_permission = True
    ordering_fields = ("code", "name", "warehouse_type", "status")

    def _code(self):
        return self.action_permissions.get(self.action) or self.iam_permissions.get(self.request.method)

    def _allowed(self, warehouse, code=None):
        return self.request.user.is_superuser or has_effective_permission(self.request.user.iam_account, warehouse.company, code or self._code(), branch_id=warehouse.branch_id, warehouse_id=warehouse.pk)

    def _require_create_scope(self, company, branch, code="MD.WAREHOUSE.CREATE"):
        if not self.request.user.is_superuser and not has_effective_permission(self.request.user.iam_account, company, code, branch_id=getattr(branch, "pk", None)):
            raise PermissionDenied("Kho nằm ngoài phạm vi dữ liệu được tạo.")

    def get_queryset(self):
        queryset = super().get_queryset()
        company = Company.objects.filter(pk=self.request.query_params.get("company_id")).first()
        if company:
            _warehouse_module_active(company)
        for field in ("warehouse_type", "warehouse_scope", "status"):
            if value := self.request.query_params.get(field):
                queryset = queryset.filter(**{field: value})
        if self.request.user.is_superuser:
            return queryset
        return queryset.filter(pk__in=[row.pk for row in queryset if self._allowed(row)])

    def _snapshot(self, row):
        return {"code": row.code, "name": row.name, "status": row.status, "warehouse_type": row.warehouse_type, "warehouse_scope": row.warehouse_scope, "branch": str(row.branch_id) if row.branch_id else None, "project": str(row.project_id) if row.project_id else None, "is_default": row.is_default, "allow_receipt": row.allow_receipt, "allow_issue": row.allow_issue, "allow_transfer": row.allow_transfer}

    def _impact(self, row):
        from inventory.models import InventoryTransaction
        from purchases.models import PurchaseOrder, PurchaseOrderLine, PurchaseReceipt
        from sales.models import SalesDelivery, SalesOrder, SalesOrderLine
        open_purchase = PurchaseOrder.objects.filter(receiving_warehouse=row).exclude(status__in=("FULLY_RECEIVED", "COMPLETED", "CANCELLED")).count()
        open_purchase += PurchaseOrderLine.objects.filter(warehouse=row).exclude(order__status__in=("FULLY_RECEIVED", "COMPLETED", "CANCELLED")).count()
        open_purchase += PurchaseReceipt.objects.filter(warehouse=row, status="DRAFT").count()
        open_sales = SalesOrder.objects.filter(default_warehouse=row).exclude(status__in=("FULLY_DELIVERED", "COMPLETED", "CANCELLED", "TERMINATED")).count()
        open_sales += SalesOrderLine.objects.filter(warehouse=row).exclude(order__status__in=("FULLY_DELIVERED", "COMPLETED", "CANCELLED", "TERMINATED")).count()
        open_sales += SalesDelivery.objects.filter(warehouse=row, status="DRAFT").count()
        return {"locations": row.locations.count(), "stock_balances": row.stock_balances.count(), "nonzero_balances": row.stock_balances.exclude(quantity=0).count(), "open_transactions": InventoryTransaction.objects.filter(Q(source_warehouse=row) | Q(destination_warehouse=row)).exclude(status__in=("POSTED", "CANCELLED", "REVERSED")).count() + open_purchase + open_sales, "transactions": row.inventory_transactions_in.count() + row.inventory_transactions_out.count(), "stock_movements": row.stock_movements.count(), "inventory_policies": row.inventory_policies.count(), "purchase_orders": row.purchase_orders.count(), "sales_orders": row.sales_orders.count()}

    @transaction.atomic
    def perform_create(self, serializer):
        company = serializer.validated_data["company"]
        if company.status != "ACTIVE" or str(company.pk) != str(self.request.query_params.get("company_id") or self.request.data.get("company")):
            raise ValidationError({"company": "Doanh nghiệp không hợp lệ hoặc chưa hoạt động."})
        _warehouse_module_active(company)
        self._require_create_scope(company, serializer.validated_data.get("branch"))
        if serializer.validated_data.get("is_default"):
            raise ValidationError({"is_default": "Tạo kho trước, sau đó dùng thao tác đặt mặc định."})
        row = serializer.save()
        self._audit(row, "WAREHOUSE_CREATE", after=self._snapshot(row))

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        row = models.Warehouse.objects.select_for_update().get(pk=serializer.instance.pk)
        _warehouse_version(self.request, row)
        before = self._snapshot(row)
        serializer.instance = row
        row = serializer.save()
        if not self._allowed(row, "MD.WAREHOUSE.EDIT"):
            raise PermissionDenied("Kho sau cập nhật nằm ngoài phạm vi dữ liệu.")
        self._audit(row, "WAREHOUSE_UPDATE", before=before, after=self._snapshot(row))

    @action(detail=True, methods=("get",))
    def impact(self, request, pk=None):
        return Response(self._impact(self.get_object()))

    @action(detail=True, methods=("post",), url_path="set-default")
    @transaction.atomic
    def set_default(self, request, pk=None):
        row = models.Warehouse.objects.select_for_update().get(pk=self.get_object().pk)
        _warehouse_version(request, row)
        if row.status != "ACTIVE":
            raise ValidationError({"status": "Kho mặc định phải ACTIVE."})
        Company.objects.select_for_update().get(pk=row.company_id)
        current = models.Warehouse.objects.filter(company=row.company, warehouse_scope=row.warehouse_scope, branch_id=row.branch_id, project_id=row.project_id, is_default=True).exclude(pk=row.pk)
        if current.exists() and request.data.get("confirm_replace") is not True:
            raise ValidationError({"confirm_replace": "Cần xác nhận thay kho mặc định hiện tại."})
        for previous in current.select_for_update():
            before = self._snapshot(previous)
            previous.is_default = False
            previous.save(update_fields=("is_default",))
            self._audit(previous, "WAREHOUSE_DEFAULT", before=before, after=self._snapshot(previous))
        if not row.is_default:
            before = self._snapshot(row)
            row.is_default = True
            row.full_clean()
            row.save(update_fields=("is_default",))
            self._audit(row, "WAREHOUSE_DEFAULT", before=before, after=self._snapshot(row))
        return Response(self.get_serializer(row).data)

    @action(detail=True, methods=("post",), url_path="change-status")
    @transaction.atomic
    def change_status(self, request, pk=None):
        row = models.Warehouse.objects.select_for_update().get(pk=self.get_object().pk)
        _warehouse_version(request, row)
        target = request.data.get("status")
        if target not in {"ACTIVE", "INACTIVE", "ARCHIVED"}:
            raise ValidationError({"status": "Trạng thái không hợp lệ."})
        if target != "ACTIVE":
            if not request.data.get("reason", "").strip():
                raise ValidationError({"reason": "Cần nêu lý do ngừng kho."})
            impact = self._impact(row)
            if row.is_default or impact["nonzero_balances"] or impact["open_transactions"]:
                raise ValidationError({"status": "Kho còn là mặc định, còn tồn hoặc chứng từ chưa hoàn thành."})
        before = self._snapshot(row)
        row.status = target
        try:
            row.full_clean()
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict) from exc
        row.save(update_fields=("status",))
        self._audit(row, "WAREHOUSE_STATUS", before=before, after=self._snapshot(row))
        return Response(self.get_serializer(row).data)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        from django.db.models.deletion import ProtectedError
        row = models.Warehouse.objects.select_for_update().get(pk=instance.pk)
        if row.is_default or any(self._impact(row).values()):
            raise ValidationError("Chỉ được xóa kho chưa có vị trí, tồn hoặc chứng từ tham chiếu.")
        before = self._snapshot(row)
        try:
            row.delete()
        except ProtectedError as exc:
            raise ValidationError("Kho đã có dữ liệu tham chiếu.") from exc
        self._audit(row, "WAREHOUSE_DELETE", before=before)

    @action(detail=True, methods=("get",))
    def history(self, request, pk=None):
        from audit_log.models import AuditLog
        row = self.get_object()
        return Response(list(AuditLog.objects.filter(company=row.company, entity_type="master_data.Warehouse", entity_id=row.pk).values("action_code", "occurred_at", "actor_name_snapshot")))

    @action(detail=False, methods=("get",), url_path="export-csv")
    def export_csv(self, request):
        output = io.StringIO()
        writer = csv.writer(output)
        fields = ("code", "name", "warehouse_type", "warehouse_scope", "branch", "project", "address", "keeper_employee", "phone", "email", "is_default", "allow_receipt", "allow_issue", "allow_transfer", "status")
        writer.writerow(fields)
        for row in self.get_queryset().order_by("code"):
            writer.writerow((row.code, row.name, row.warehouse_type, row.warehouse_scope, row.branch.code if row.branch_id else "", row.project.code if row.project_id else "", row.address, row.keeper_employee.employee_code if row.keeper_employee_id else "", row.phone, row.email, row.is_default, row.allow_receipt, row.allow_issue, row.allow_transfer, row.status))
        response = HttpResponse(output.getvalue(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="warehouses.csv"'
        return response

    @action(detail=False, methods=("post",), url_path="import-csv")
    def import_csv(self, request):
        from organization.models import Branch, Employee
        company = get_object_or_404(Company, pk=request.data.get("company"))
        if request.query_params.get("company_id") and str(company.pk) != request.query_params["company_id"]:
            raise ValidationError({"company": "Doanh nghiệp nhập không khớp doanh nghiệp đang chọn."})
        _warehouse_module_active(company)
        uploaded = request.FILES.get("file")
        if not uploaded:
            raise ValidationError({"file": "Cần tải lên tệp CSV."})
        try:
            reader = csv.DictReader(io.StringIO(uploaded.read().decode("utf-8-sig")))
            if not {"code", "name", "warehouse_type", "warehouse_scope"}.issubset(reader.fieldnames or []):
                raise ValidationError({"file": "Thiếu cột bắt buộc."})
            rows = list(reader)
        except UnicodeDecodeError as exc:
            raise ValidationError({"file": "Tệp phải dùng UTF-8."}) from exc
        if len(rows) > 1000:
            raise ValidationError({"file": "Tối đa 1000 dòng."})
        result = {"created": [], "errors": []}
        for number, row in enumerate(rows, 2):
            if None in row:
                result["errors"].append({"row": number, "error": "Số cột CSV không hợp lệ."})
                continue
            row = {key: value or "" for key, value in row.items()}
            branch = Branch.objects.filter(company=company, code=row.get("branch", "").strip().upper()).first() if row.get("branch") else None
            project = models.Project.objects.filter(company=company, code=row.get("project", "").strip().upper()).first() if row.get("project") else None
            keeper = Employee.objects.filter(company=company, employee_code=row.get("keeper_employee", "").strip().upper()).first() if row.get("keeper_employee") else None
            if (row.get("branch") and not branch) or (row.get("project") and not project) or (row.get("keeper_employee") and not keeper):
                result["errors"].append({"row": number, "error": "Chi nhánh, dự án hoặc người phụ trách không tồn tại."})
                continue
            try:
                self._require_create_scope(company, branch, "MD.WAREHOUSE.IMPORT")
            except PermissionDenied:
                result["errors"].append({"row": number, "error": "Ngoài phạm vi dữ liệu."})
                continue
            payload = {"company": str(company.pk), "code": row["code"], "name": row["name"], "warehouse_type": row["warehouse_type"], "warehouse_scope": row["warehouse_scope"], "address": row.get("address", ""), "branch": str(branch.pk) if branch else None, "project": str(project.pk) if project else None, "keeper_employee": str(keeper.pk) if keeper else None, "status": row.get("status") or "ACTIVE"}
            for field in ("allow_receipt", "allow_issue", "allow_transfer"):
                if row.get(field):
                    payload[field] = row[field].lower() in {"true", "1", "yes"}
            serializer = self.get_serializer(data=payload)
            if not serializer.is_valid():
                result["errors"].append({"row": number, "error": serializer.errors})
                continue
            with transaction.atomic():
                warehouse = serializer.save()
                self._audit(warehouse, "WAREHOUSE_IMPORT", after=self._snapshot(warehouse))
            result["created"].append(str(warehouse.pk))
        return Response(result)


class InventoryLocationViewSet(mixins.DestroyModelMixin, MasterDataViewSet):
    queryset = models.InventoryLocation.objects.select_related("warehouse", "warehouse__company", "parent")
    serializer_class = serializers.InventoryLocationSerializer
    iam_permissions = permission_map("MD.WAREHOUSE")
    action_permissions = {"change_status": "MD.WAREHOUSE.DEACTIVATE", "destroy": "MD.WAREHOUSE.DELETE"}
    company_lookup = "warehouse__company_id"
    allow_scoped_list_permission = True

    def _allowed(self, warehouse, code):
        return self.request.user.is_superuser or has_effective_permission(self.request.user.iam_account, warehouse.company, code, branch_id=warehouse.branch_id, warehouse_id=warehouse.pk)

    def get_queryset(self):
        queryset = super().get_queryset()
        company = Company.objects.filter(pk=self.request.query_params.get("company_id")).first()
        if company:
            _warehouse_module_active(company)
        if self.request.user.is_superuser:
            return queryset
        code = self.action_permissions.get(self.action) or self.iam_permissions.get(self.request.method)
        return queryset.filter(pk__in=[row.pk for row in queryset if self._allowed(row.warehouse, code)])

    @transaction.atomic
    def perform_create(self, serializer):
        warehouse = serializer.validated_data["warehouse"]
        if str(warehouse.company_id) != str(self.request.query_params.get("company_id") or self.request.data.get("company_id")):
            raise ValidationError({"warehouse": "Kho phải thuộc doanh nghiệp đang chọn."})
        _warehouse_module_active(warehouse.company)
        if not self._allowed(warehouse, "MD.WAREHOUSE.CREATE"):
            raise PermissionDenied("Kho nằm ngoài phạm vi dữ liệu.")
        if warehouse.status != "ACTIVE":
            raise ValidationError({"warehouse": "Chỉ được thêm vị trí cho kho ACTIVE."})
        row = serializer.save()
        self._audit(row, "WAREHOUSE_LOCATION_CREATE", after={"warehouse": str(row.warehouse_id), "code": row.code, "parent": str(row.parent_id) if row.parent_id else None})

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        row = models.InventoryLocation.objects.select_for_update().get(pk=serializer.instance.pk)
        before = {"code": row.code, "name": row.name, "parent": str(row.parent_id) if row.parent_id else None, "can_store": row.can_store}
        serializer.instance = row
        row = serializer.save()
        self._audit(row, "WAREHOUSE_LOCATION_UPDATE", before=before, after={"code": row.code, "name": row.name, "parent": str(row.parent_id) if row.parent_id else None, "can_store": row.can_store})

    @action(detail=True, methods=("post",), url_path="change-status")
    @transaction.atomic
    def change_status(self, request, pk=None):
        from inventory.models import StockBalance
        row = models.InventoryLocation.objects.select_for_update().get(pk=self.get_object().pk)
        target = request.data.get("status")
        if target not in {"ACTIVE", "INACTIVE"}:
            raise ValidationError({"status": "Trạng thái không hợp lệ."})
        if target == "INACTIVE" and (StockBalance.objects.filter(location=row).exclude(quantity=0).exists() or row.children.filter(status="ACTIVE").exists()):
            raise ValidationError({"status": "Vị trí còn tồn hoặc vị trí con đang hoạt động."})
        before = {"status": row.status}
        row.status = target
        row.full_clean()
        row.save(update_fields=("status",))
        self._audit(row, "WAREHOUSE_LOCATION_STATUS", before=before, after={"status": row.status})
        return Response(self.get_serializer(row).data)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        from django.db.models.deletion import ProtectedError
        row = models.InventoryLocation.objects.select_for_update().get(pk=instance.pk)
        if row.children.exists() or any(relation.related_model.objects.filter(**{relation.field.name: row}).exists() for relation in row._meta.related_objects if relation.field.name != "parent"):
            raise ValidationError("Vị trí đã được sử dụng.")
        try:
            row.delete()
        except ProtectedError as exc:
            raise ValidationError("Vị trí đã có dữ liệu tham chiếu.") from exc
        self._audit(row, "WAREHOUSE_LOCATION_DELETE", before={"warehouse": str(row.warehouse_id), "code": row.code})
class CompanyBankAccountViewSet(mixins.DestroyModelMixin, MasterDataViewSet):
    queryset = models.CompanyBankAccount.objects.select_related("company", "bank", "currency", "branch", "gl_account", "project", "cost_center")
    serializer_class = serializers.CompanyBankAccountSerializer
    iam_permissions = permission_map("MD.BANK_ACCOUNT")
    action_permissions = {
        "change_status": "MD.BANK_ACCOUNT.DEACTIVATE",
        "set_default": "MD.BANK_ACCOUNT.EDIT",
        "destroy": "MD.BANK_ACCOUNT.DELETE",
        "import_csv": "MD.BANK_ACCOUNT.IMPORT",
        "export_csv": "MD.BANK_ACCOUNT.EXPORT",
        "connect_bank": "MD.BANK_ACCOUNT.CONNECT",
        "disconnect_bank": "MD.BANK_ACCOUNT.CONNECT",
        "impact": "MD.BANK_ACCOUNT.VIEW",
        "history": "MD.BANK_ACCOUNT.VIEW",
    }
    allow_scoped_list_permission = True
    ordering_fields = ("code", "account_number", "account_name", "status", "created_at")
    search_fields = ("code", "account_number", "account_name", "bank__name", "bank__code")

    def _code(self):
        return self.action_permissions.get(self.action) or self.iam_permissions.get(self.request.method)

    def _allowed(self, account, code=None):
        return (
            self.request.user.is_superuser
            or has_effective_permission(
                self.request.user.iam_account,
                account.company,
                code or self._code(),
                branch_id=account.branch_id,
                bank_account_id=account.pk,
            )
        )

    def _require_create_scope(self, company, branch, code="MD.BANK_ACCOUNT.CREATE"):
        if not self.request.user.is_superuser and not has_effective_permission(
            self.request.user.iam_account, company, code, branch_id=getattr(branch, "pk", None)
        ):
            raise PermissionDenied("Tài khoản ngân hàng nằm ngoài phạm vi dữ liệu được tạo.")

    def get_queryset(self):
        queryset = super().get_queryset()
        for field in ("account_type", "account_scope", "status", "connection_status", "currency_id", "bank_id"):
            if value := self.request.query_params.get(field):
                queryset = queryset.filter(**{field: value})
        if self.request.user.is_superuser:
            return queryset
        return queryset.filter(pk__in=[row.pk for row in queryset if self._allowed(row)])

    def _version_check(self, row):
        client_version = self.request.data.get("version") or self.request.headers.get("If-Match")
        if client_version:
            import datetime
            if isinstance(client_version, str) and client_version.startswith('"') and client_version.endswith('"'):
                client_version = client_version[1:-1]
            try:
                dt = datetime.datetime.fromisoformat(client_version.replace("Z", "+00:00"))
                if row.updated_at and abs((row.updated_at - dt).total_seconds()) > 1:
                    raise ValidationError({"version": "Dữ liệu đã bị thay đổi bởi người dùng khác. Vui lòng tải lại trang."})
            except (ValueError, TypeError):
                pass

    @transaction.atomic
    def perform_create(self, serializer):
        company = serializer.validated_data["company"]
        if company.status != "ACTIVE":
            raise ValidationError({"company": "Doanh nghiệp không hợp lệ hoặc chưa hoạt động."})
        self._require_create_scope(company, serializer.validated_data.get("branch"))
        row = serializer.save()
        self._audit(row, "BANK_ACCOUNT_CREATE", after=bank_account_services.get_bank_account_snapshot(row))

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        row = models.CompanyBankAccount.objects.select_for_update().get(pk=serializer.instance.pk)
        self._version_check(row)
        before = bank_account_services.get_bank_account_snapshot(row)
        serializer.instance = row
        row = serializer.save()
        if not self._allowed(row, "MD.BANK_ACCOUNT.EDIT"):
            raise PermissionDenied("Tài khoản ngân hàng sau cập nhật nằm ngoài phạm vi dữ liệu.")
        self._audit(row, "BANK_ACCOUNT_UPDATE", before=before, after=bank_account_services.get_bank_account_snapshot(row))

    @action(detail=True, methods=("get",))
    def impact(self, request, pk=None):
        row = self.get_object()
        return Response(bank_account_services.get_bank_account_impact(row))

    @action(detail=True, methods=("get",))
    def history(self, request, pk=None):
        from audit_log.models import AuditLog
        row = self.get_object()
        return Response(list(
            AuditLog.objects.filter(
                company=row.company,
                entity_type="master_data.CompanyBankAccount",
                entity_id=row.pk,
            ).values("action_code", "occurred_at", "actor_name_snapshot", "description", "reason")
        ))

    @action(detail=True, methods=("post",), url_path="set-default")
    @transaction.atomic
    def set_default(self, request, pk=None):
        row = models.CompanyBankAccount.objects.select_for_update().get(pk=self.get_object().pk)
        self._version_check(row)
        confirm_replace = request.data.get("confirm_replace") is True
        try:
            row = bank_account_services.set_default_bank_account(row, confirm_replace=confirm_replace, user=request.user)
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages) from exc
        return Response(self.get_serializer(row).data)

    @action(detail=True, methods=("post",), url_path="change-status")
    @transaction.atomic
    def change_status(self, request, pk=None):
        row = models.CompanyBankAccount.objects.select_for_update().get(pk=self.get_object().pk)
        self._version_check(row)
        target = request.data.get("status")
        reason = request.data.get("reason", "")
        effective_date = request.data.get("effective_date")
        replacement_account_id = request.data.get("replacement_account")
        confirm_balance = request.data.get("confirm_balance") is True
        try:
            row = bank_account_services.change_bank_account_status(
                row,
                new_status=target,
                reason=reason,
                effective_date=effective_date,
                replacement_account_id=replacement_account_id,
                confirm_balance=confirm_balance,
                user=request.user,
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages) from exc
        return Response(self.get_serializer(row).data)

    @action(detail=True, methods=("post",), url_path="connect-bank")
    @transaction.atomic
    def connect_bank(self, request, pk=None):
        row = models.CompanyBankAccount.objects.select_for_update().get(pk=self.get_object().pk)
        provider = request.data.get("provider", "BANK_DIRECT")
        connection_id = request.data.get("connection_id", f"CONN-{row.code}")
        sync_scope = request.data.get("sync_scope", "STATEMENT")
        auth_expires_at = request.data.get("auth_expires_at")
        try:
            row = bank_account_services.connect_bank_account(
                row,
                provider=provider,
                connection_id=connection_id,
                sync_scope=sync_scope,
                auth_expires_at=auth_expires_at,
                user=request.user,
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages) from exc
        return Response(self.get_serializer(row).data)

    @action(detail=True, methods=("post",), url_path="disconnect-bank")
    @transaction.atomic
    def disconnect_bank(self, request, pk=None):
        row = models.CompanyBankAccount.objects.select_for_update().get(pk=self.get_object().pk)
        reason = request.data.get("reason", "")
        try:
            row = bank_account_services.disconnect_bank_account(row, reason=reason, user=request.user)
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages) from exc
        return Response(self.get_serializer(row).data)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        from django.db.models.deletion import ProtectedError
        row = models.CompanyBankAccount.objects.select_for_update().get(pk=instance.pk)
        impact = bank_account_services.get_bank_account_impact(row)
        if not impact["can_delete"]:
            raise ValidationError("Chỉ được xóa tài khoản ngân hàng chưa có số dư, giao dịch, sao kê hoặc liên kết.")
        before = bank_account_services.get_bank_account_snapshot(row)
        try:
            row.delete()
        except ProtectedError as exc:
            raise ValidationError("Tài khoản đã có dữ liệu tham chiếu không thể xóa.") from exc
        self._audit(row, "BANK_ACCOUNT_DELETE", before=before)

    @action(detail=False, methods=("get",), url_path="export-csv")
    def export_csv(self, request):
        company_id = request.query_params.get("company_id")
        if not company_id:
            raise ValidationError({"company_id": "Cần truyền company_id."})
        company = Company.objects.filter(pk=company_id).first()
        queryset = self.get_queryset()
        csv_content = bank_account_services.export_bank_accounts_to_csv(queryset, user=request.user, company=company)
        response = HttpResponse(csv_content, content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="company_bank_accounts.csv"'
        return response

    @action(detail=False, methods=("post",), url_path="import-csv")
    def import_csv(self, request):
        company = get_object_or_404(Company, pk=request.data.get("company"))
        if request.query_params.get("company_id") and str(company.pk) != request.query_params["company_id"]:
            raise ValidationError({"company": "Doanh nghiệp nhập không khớp doanh nghiệp đang chọn."})
        uploaded = request.FILES.get("file")
        if not uploaded:
            raise ValidationError({"file": "Cần tải lên tệp CSV."})
        result = bank_account_services.import_bank_accounts_from_csv(company, uploaded, user=request.user)
        return Response(result)


def _expense_item_version(request, instance):
    version = request.data.get("version")
    if version is not None and int(version) != instance.version:
        from rest_framework.exceptions import APIException
        error = APIException("Dữ liệu đã thay đổi bởi người dùng khác. Hãy tải lại.")
        error.status_code = 409
        raise error


class ExpenseItemViewSet(mixins.DestroyModelMixin, MasterDataViewSet):
    queryset = models.ExpenseItem.objects.select_related("company", "parent", "default_account")
    serializer_class = serializers.ExpenseItemSerializer
    iam_permissions = permission_map("MD.EXPENSE_ITEM")
    action_permissions = {
        "change_status": "MD.EXPENSE_ITEM.DEACTIVATE",
        "destroy": "MD.EXPENSE_ITEM.DELETE",
        "import_csv": "MD.EXPENSE_ITEM.IMPORT",
        "export_csv": "MD.EXPENSE_ITEM.EXPORT",
        "impact": "MD.EXPENSE_ITEM.VIEW",
        "history": "MD.EXPENSE_ITEM.VIEW",
        "ai_suggest": "MD.EXPENSE_ITEM.VIEW",
    }
    ordering_fields = ("code", "name", "expense_type", "status", "created_at")
    search_fields = ("code", "name", "description")

    def _code(self):
        return self.action_permissions.get(self.action) or self.iam_permissions.get(self.request.method)

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get("parent_id"):
            qs = qs.filter(parent_id=params["parent_id"])
        if params.get("root_only") == "true":
            qs = qs.filter(parent__isnull=True)
        if params.get("expense_type"):
            qs = qs.filter(expense_type=params["expense_type"])
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        return qs

    @transaction.atomic
    def perform_create(self, serializer):
        user = getattr(self.request.user, "iam_account", None) if hasattr(self.request.user, "iam_account") else None
        item = serializer.save(created_by=user)
        expense_item_services.record_expense_item_audit(
            item,
            "EXPENSE_ITEM_CREATE",
            before=None,
            after=expense_item_services.get_expense_item_snapshot(item),
            user=user,
        )

    @transaction.atomic
    def perform_update(self, serializer):
        row = models.ExpenseItem.objects.select_for_update().get(pk=serializer.instance.pk)
        _expense_item_version(self.request, row)
        before = expense_item_services.get_expense_item_snapshot(row)
        user = getattr(self.request.user, "iam_account", None) if hasattr(self.request.user, "iam_account") else None
        serializer.instance = row
        item = serializer.save(version=row.version + 1, updated_by=user)
        expense_item_services.record_expense_item_audit(
            item,
            "EXPENSE_ITEM_UPDATE",
            before=before,
            after=expense_item_services.get_expense_item_snapshot(item),
            user=user,
        )

    @transaction.atomic
    def perform_destroy(self, instance):
        from django.db.models.deletion import ProtectedError
        row = models.ExpenseItem.objects.select_for_update().get(pk=instance.pk)
        impact = expense_item_services.get_expense_item_impact(row)
        if not impact["can_delete"]:
            if impact["children_count"] > 0:
                raise ValidationError({"detail": "Không thể xóa khoản mục chi phí đang có khoản mục con. Vui lòng xử lý khoản mục con trước."})
            raise ValidationError({"detail": "Không thể xóa khoản mục chi phí đã phát sinh dữ liệu giao dịch. Vui lòng chuyển sang ngừng sử dụng."})
        before = expense_item_services.get_expense_item_snapshot(row)
        try:
            row.delete()
        except ProtectedError as exc:
            raise ValidationError("Khoản mục đã có dữ liệu tham chiếu không thể xóa.") from exc
        user = getattr(self.request.user, "iam_account", None) if hasattr(self.request.user, "iam_account") else None
        expense_item_services.record_expense_item_audit(
            row,
            "EXPENSE_ITEM_DELETE",
            before=before,
            after=None,
            user=user,
        )

    @action(detail=True, methods=("post",), url_path="change-status")
    def change_status(self, request, pk=None):
        item = self.get_object()
        new_status = request.data.get("status")
        if not new_status:
            raise ValidationError({"status": "Cần cung cấp trạng thái mới."})
        version = request.data.get("version")
        reason = request.data.get("reason", "")
        deactivate_children = request.data.get("deactivate_children", False)
        if isinstance(deactivate_children, str):
            deactivate_children = deactivate_children.lower() in ("true", "1", "yes")

        try:
            updated = expense_item_services.change_expense_item_status(
                item=item,
                new_status=new_status,
                version=int(version) if version is not None else None,
                reason=reason,
                deactivate_children=deactivate_children,
                user=getattr(request.user, "iam_account", None) if hasattr(request.user, "iam_account") else None,
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)

        return Response(serializers.ExpenseItemSerializer(updated, context={"request": request}).data)

    @action(detail=True, methods=("get",), url_path="impact")
    def impact(self, request, pk=None):
        item = self.get_object()
        data = expense_item_services.get_expense_item_impact(item)
        return Response(data)

    @action(detail=True, methods=("get",), url_path="history")
    def history(self, request, pk=None):
        from audit_log.models import AuditLog
        from audit_log.serializers import AuditLogSerializer
        item = self.get_object()
        logs = AuditLog.objects.filter(company=item.company, module_code="MD", entity_id=str(item.id)).order_by("-occurred_at")
        return Response(AuditLogSerializer(logs, many=True).data)

    @action(detail=False, methods=("post",), url_path="ai-suggest")
    def ai_suggest(self, request):
        company_id = request.data.get("company") or request.query_params.get("company_id")
        if not company_id:
            raise ValidationError({"company": "Cần cung cấp mã doanh nghiệp (company)."})
        company = get_object_or_404(Company, pk=company_id)
        name = request.data.get("name", "")
        if not name or not name.strip():
            raise ValidationError({"name": "Cần cung cấp tên khoản mục để AI phân tích và gợi ý."})
        description = request.data.get("description", "")
        suggestion = expense_item_services.ai_suggest_expense_item(company, name, description)
        return Response(suggestion)

    @action(detail=False, methods=("get",), url_path="export-csv")
    def export_csv(self, request):
        company_id = request.query_params.get("company_id")
        if not company_id:
            raise ValidationError({"company_id": "Cần truyền company_id."})
        queryset = self.get_queryset()
        csv_content = expense_item_services.export_expense_items_to_csv(queryset)
        response = HttpResponse(csv_content, content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="expense_items.csv"'
        return response

    @action(detail=False, methods=("post",), url_path="import-csv")
    def import_csv(self, request):
        company_id = request.data.get("company") or request.query_params.get("company_id")
        if not company_id:
            raise ValidationError({"company": "Cần cung cấp mã doanh nghiệp (company)."})
        company = get_object_or_404(Company, pk=company_id)
        uploaded = request.FILES.get("file")
        if not uploaded:
            raise ValidationError({"file": "Cần tải lên tệp CSV."})
        file_bytes = uploaded.read()
        try:
            result = expense_item_services.import_expense_items_from_csv(
                company, file_bytes, user=getattr(request.user, "iam_account", None) if hasattr(request.user, "iam_account") else None
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)
        return Response(result)


def _statistical_code_version(request, instance):
    version = request.data.get("version")
    if version is not None and int(version) != instance.version:
        from rest_framework.exceptions import APIException
        error = APIException("Dữ liệu đã thay đổi bởi người dùng khác. Hãy tải lại.")
        error.status_code = 409
        raise error


class StatisticalCodeViewSet(mixins.DestroyModelMixin, MasterDataViewSet):
    queryset = models.StatisticalCode.objects.select_related("company", "parent")
    serializer_class = serializers.StatisticalCodeSerializer
    iam_permissions = permission_map("MD.STATISTICAL_CODE")
    action_permissions = {
        "change_status": "MD.STATISTICAL_CODE.DEACTIVATE",
        "destroy": "MD.STATISTICAL_CODE.DELETE",
        "import_csv": "MD.STATISTICAL_CODE.IMPORT",
        "export_csv": "MD.STATISTICAL_CODE.EXPORT",
        "impact": "MD.STATISTICAL_CODE.VIEW",
        "history": "MD.STATISTICAL_CODE.VIEW",
        "ai_suggest": "MD.STATISTICAL_CODE.VIEW",
        "quick_create": "MD.STATISTICAL_CODE.CREATE",
        "tree": "MD.STATISTICAL_CODE.VIEW",
        "summary": "MD.STATISTICAL_CODE.VIEW",
    }
    ordering_fields = ("code", "name", "category", "status", "created_at")
    search_fields = ("code", "name", "category", "description")

    def _code(self):
        return self.action_permissions.get(self.action) or self.iam_permissions.get(self.request.method)

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get("parent_id"):
            qs = qs.filter(parent_id=params["parent_id"])
        if params.get("root_only") == "true":
            qs = qs.filter(parent__isnull=True)
        if params.get("category"):
            qs = qs.filter(category=params["category"])
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        if params.get("allow_voucher_selection") is not None:
            val = params["allow_voucher_selection"].lower() in ("true", "1", "yes")
            qs = qs.filter(allow_voucher_selection=val)
        return qs

    @transaction.atomic
    def perform_create(self, serializer):
        user = getattr(self.request.user, "iam_account", None) if hasattr(self.request.user, "iam_account") else None
        item = serializer.save(created_by=user)
        statistical_code_services.record_statistical_code_audit(
            item,
            "STATISTICAL_CODE_CREATE",
            before=None,
            after=statistical_code_services.get_statistical_code_snapshot(item),
            user=user,
        )

    @transaction.atomic
    def perform_update(self, serializer):
        row = models.StatisticalCode.objects.select_for_update().get(pk=serializer.instance.pk)
        _statistical_code_version(self.request, row)
        before = statistical_code_services.get_statistical_code_snapshot(row)
        user = getattr(self.request.user, "iam_account", None) if hasattr(self.request.user, "iam_account") else None
        serializer.instance = row
        item = serializer.save(version=row.version + 1, updated_by=user)
        statistical_code_services.record_statistical_code_audit(
            item,
            "STATISTICAL_CODE_UPDATE",
            before=before,
            after=statistical_code_services.get_statistical_code_snapshot(item),
            user=user,
        )

    @transaction.atomic
    def perform_destroy(self, instance):
        from django.db.models.deletion import ProtectedError
        row = models.StatisticalCode.objects.select_for_update().get(pk=instance.pk)
        impact = statistical_code_services.get_statistical_code_impact(row)
        if not impact["can_delete"]:
            if impact["children_count"] > 0:
                raise ValidationError({"detail": "Không thể xóa mã thống kê đang có mã con. Vui lòng xử lý mã con trước."})
            raise ValidationError({"detail": "Không thể xóa mã thống kê đã phát sinh dữ liệu giao dịch. Vui lòng chuyển sang ngừng sử dụng."})
        before = statistical_code_services.get_statistical_code_snapshot(row)
        try:
            row.delete()
        except ProtectedError as exc:
            raise ValidationError("Mã thống kê đã có dữ liệu tham chiếu không thể xóa.") from exc
        user = getattr(self.request.user, "iam_account", None) if hasattr(self.request.user, "iam_account") else None
        statistical_code_services.record_statistical_code_audit(
            row,
            "STATISTICAL_CODE_DELETE",
            before=before,
            after=None,
            user=user,
        )

    @action(detail=True, methods=("post",), url_path="change-status")
    def change_status(self, request, pk=None):
        item = self.get_object()
        new_status = request.data.get("status")
        if not new_status:
            raise ValidationError({"status": "Cần cung cấp trạng thái mới."})
        version = request.data.get("version")
        reason = request.data.get("reason", "")
        deactivate_children = request.data.get("deactivate_children", False)
        if isinstance(deactivate_children, str):
            deactivate_children = deactivate_children.lower() in ("true", "1", "yes")

        try:
            updated = statistical_code_services.change_statistical_code_status(
                item=item,
                new_status=new_status,
                version=int(version) if version is not None else None,
                reason=reason,
                deactivate_children=deactivate_children,
                user=getattr(request.user, "iam_account", None) if hasattr(request.user, "iam_account") else None,
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)

        return Response(serializers.StatisticalCodeSerializer(updated, context={"request": request}).data)

    @action(detail=True, methods=("get",), url_path="impact")
    def impact(self, request, pk=None):
        item = self.get_object()
        data = statistical_code_services.get_statistical_code_impact(item)
        return Response(data)

    @action(detail=True, methods=("get",), url_path="history")
    def history(self, request, pk=None):
        from audit_log.models import AuditLog
        from audit_log.serializers import AuditLogSerializer
        item = self.get_object()
        logs = AuditLog.objects.filter(company=item.company, module_code="MD", entity_id=str(item.id)).order_by("-occurred_at")
        return Response(AuditLogSerializer(logs, many=True).data)

    @action(detail=False, methods=("post",), url_path="quick-create")
    def quick_create(self, request):
        company_id = request.data.get("company") or request.query_params.get("company_id")
        if not company_id:
            raise ValidationError({"company": "Cần cung cấp mã doanh nghiệp (company)."})
        company = get_object_or_404(Company, pk=company_id)
        code = request.data.get("code", "")
        name = request.data.get("name", "")
        category = request.data.get("category", "")
        if not code or not code.strip():
            raise ValidationError({"code": "Mã thống kê không được để trống."})
        if not name or not name.strip():
            raise ValidationError({"name": "Tên mã thống kê không được để trống."})

        try:
            item = statistical_code_services.quick_create_statistical_code(
                company=company,
                code=code,
                name=name,
                category=category,
                user=getattr(request.user, "iam_account", None) if hasattr(request.user, "iam_account") else None,
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)

        return Response(serializers.StatisticalCodeSerializer(item, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=("post",), url_path="ai-suggest")
    def ai_suggest(self, request):
        company_id = request.data.get("company") or request.query_params.get("company_id")
        if not company_id:
            raise ValidationError({"company": "Cần cung cấp mã doanh nghiệp (company)."})
        company = get_object_or_404(Company, pk=company_id)
        description = request.data.get("description", "")
        context = request.data.get("context", "")
        suggestion = statistical_code_services.ai_suggest_statistical_code(company, description, context)
        return Response(suggestion)

    @action(detail=False, methods=("get",), url_path="export-csv")
    def export_csv(self, request):
        company_id = request.query_params.get("company_id")
        if not company_id:
            raise ValidationError({"company_id": "Cần truyền company_id."})
        queryset = self.get_queryset()
        csv_content = statistical_code_services.export_statistical_codes_to_csv(queryset)
        response = HttpResponse(csv_content, content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="statistical_codes.csv"'
        return response

    @action(detail=False, methods=("post",), url_path="import-csv")
    def import_csv(self, request):
        company_id = request.data.get("company") or request.query_params.get("company_id")
        if not company_id:
            raise ValidationError({"company": "Cần cung cấp mã doanh nghiệp (company)."})
        company = get_object_or_404(Company, pk=company_id)
        uploaded = request.FILES.get("file")
        if not uploaded:
            raise ValidationError({"file": "Cần tải lên tệp CSV."})
        file_bytes = uploaded.read()
        try:
            result = statistical_code_services.import_statistical_codes_from_csv(
                company, file_bytes, user=getattr(request.user, "iam_account", None) if hasattr(request.user, "iam_account") else None
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)
        return Response(result)

    @action(detail=False, methods=("get",), url_path="tree")
    def tree(self, request):
        company_id = request.query_params.get("company_id")
        if not company_id:
            raise ValidationError({"company_id": "Cần truyền company_id."})
        company = get_object_or_404(Company, pk=company_id)
        status_filter = request.query_params.get("status")
        tree_data = statistical_code_services.get_statistical_code_tree(company, status=status_filter)
        return Response(tree_data)

    @action(detail=False, methods=("get",), url_path="summary")
    def summary(self, request):
        company_id = request.query_params.get("company_id")
        if not company_id:
            raise ValidationError({"company_id": "Cần truyền company_id."})
        company = get_object_or_404(Company, pk=company_id)
        code_id = request.query_params.get("code_id") or request.query_params.get("code")
        from_date = request.query_params.get("from_date")
        to_date = request.query_params.get("to_date")
        from datetime import datetime
        fd = datetime.strptime(from_date, "%Y-%m-%d").date() if from_date else None
        td = datetime.strptime(to_date, "%Y-%m-%d").date() if to_date else None
        summary_data = statistical_code_services.get_statistical_code_summary(
            company=company,
            code_id=code_id,
            from_date=fd,
            to_date=td,
        )
        return Response(summary_data)


DocumentNumberingRuleViewSet = _viewset("DocumentNumberingRuleViewSet", models.DocumentNumberingRule, serializers.DocumentNumberingRuleSerializer, "MD.COMMON")
