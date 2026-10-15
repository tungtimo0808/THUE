"""Customer aggregate API. A customer is a Party with a CUSTOMER role (UC-MD-01)."""

import csv
import io

from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from audit_log.services import record_audit
from iam.permissions import assignment_permission_codes, effective_assignments
from organization.models import Company

from .customer_services import (
    check_customer_can_be_deleted,
    delete_customer,
    detect_duplicate_customers,
    generate_customer_code,
    get_customer_debt_and_transactions_summary,
    lookup_business_tax_info,
    merge_customers,
    quick_create_customer,
)
from .models import (
    Bank,
    CustomerProfile,
    Party,
    PartyAddress,
    PartyBankAccount,
    PartyContact,
    PartyRole,
)


class AddressSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(required=False)

    class Meta:
        model = PartyAddress
        fields = (
            "id",
            "address_type",
            "country_code",
            "province_code",
            "district_code",
            "ward_code",
            "address_line",
            "is_default",
            "status",
        )


class ContactSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(required=False)

    class Meta:
        model = PartyContact
        fields = (
            "id",
            "contact_type",
            "contact_name",
            "job_title",
            "email",
            "phone",
            "is_default",
            "status",
        )


class CustomerBankAccountSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(required=False)

    class Meta:
        model = PartyBankAccount
        fields = (
            "id",
            "bank",
            "account_number",
            "account_name",
            "branch_name",
            "is_default",
            "status",
        )


class CustomerProfileDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerProfile
        fields = (
            "credit_limit",
            "credit_days",
            "payment_method",
            "allow_over_limit",
            "warn_overdue",
            "price_list_code",
            "invoice_email",
            "bank_account",
            "receivable_account",
            "revenue_account",
        )

    def validate_credit_limit(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Hạn mức công nợ không được âm (EF-09).")
        return value

    def validate_credit_days(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Số ngày thanh toán không được nhỏ hơn 0 (BR-CUS-27, EF-09).")
        return value


class CustomerSerializer(serializers.ModelSerializer):
    addresses = AddressSerializer(many=True, required=False)
    contacts = ContactSerializer(many=True, required=False)
    bank_accounts = CustomerBankAccountSerializer(many=True, required=False)
    profile = CustomerProfileDetailSerializer(source="customer_profile", required=False)

    class Meta:
        model = Party
        fields = (
            "id",
            "company",
            "code",
            "name",
            "party_type",
            "legal_name",
            "short_name",
            "tax_code",
            "identity_no",
            "representative",
            "customer_group",
            "branch",
            "owner",
            "notes",
            "default_currency",
            "payment_term",
            "status",
            "version",
            "lookup_source",
            "lookup_at",
            "merged_into",
            "merged_at",
            "merged_by",
            "created_at",
            "updated_at",
            "addresses",
            "contacts",
            "bank_accounts",
            "profile",
        )
        read_only_fields = ("id", "merged_into", "merged_at", "merged_by", "created_at", "updated_at")
        extra_kwargs = {
            "version": {"required": False},
            "code": {"required": False, "allow_blank": True},
        }

    def validate(self, attrs):
        instance = self.instance
        company = attrs.get("company") or (instance.company if instance else None)
        if not company:
            raise serializers.ValidationError({"company": "Doanh nghiệp là bắt buộc."})
        if instance and company.pk != instance.company_id:
            raise serializers.ValidationError({"company": "Không thể chuyển khách hàng sang doanh nghiệp khác."})
        if company.status != "ACTIVE":
            raise serializers.ValidationError({"company": "Doanh nghiệp không hoạt động."})

        for field in ("branch", "payment_term"):
            value = attrs.get(field, getattr(instance, field, None) if instance else None)
            if value and value.company_id != company.pk:
                raise serializers.ValidationError({field: "Giá trị phải thuộc cùng doanh nghiệp (BR-CUS-32, EF-08)."})
            if value and hasattr(value, "status") and value.status != "ACTIVE":
                raise serializers.ValidationError({field: "Giá trị phải đang hoạt động."})

        owner = attrs.get("owner", getattr(instance, "owner", None) if instance else None)
        if owner and not owner.memberships.filter(company=company, membership_status="ACTIVE").exists():
            raise serializers.ValidationError({"owner": "Người phụ trách không thuộc doanh nghiệp hoặc Membership không còn hoạt động (BR-CUS-31, EF-08)."})

        profile = attrs.get("customer_profile", {})
        for field in ("receivable_account", "revenue_account"):
            account = profile.get(field)
            if account and (account.company_id != company.pk or account.status != "ACTIVE" or not getattr(account, "is_postable", True)):
                raise serializers.ValidationError({"profile": {field: "Tài khoản phải đang hoạt động, cho phép hạch toán và thuộc cùng doanh nghiệp (BR-CUS-24, EF-10)."}})

        # Code resolution: manual or auto-generation (AF-02, BR-CUS-04)
        raw_code = attrs.get("code", instance.code if instance else "")
        code = (raw_code or "").strip().upper()
        if not code or code == "AUTO":
            branch = attrs.get("branch", getattr(instance, "branch", None) if instance else None)
            code = generate_customer_code(company, branch=branch)
        attrs["code"] = code

        name = attrs.get("name", instance.name if instance else "").strip()
        if not name:
            raise serializers.ValidationError({"name": "Tên khách hàng là thông tin bắt buộc (BR-CUS-05, EF-03)."})
        attrs["name"] = name

        # Tax code normalization and duplicate checking (BR-CUS-07, 10, EF-06)
        tax_code = attrs.get("tax_code", instance.tax_code if instance else None)
        if tax_code is not None:
            clean_tax = tax_code.strip().replace(" ", "").replace("-", "") or None
            attrs["tax_code"] = clean_tax
            if clean_tax:
                if not (clean_tax.isdigit() and len(clean_tax) in (10, 13)):
                    raise serializers.ValidationError({"tax_code": "Mã số thuế không đúng định dạng chuẩn (10 chữ số cho DN hoặc 13 chữ số cho chi nhánh) (EF-05)."})

        if Party.objects.filter(company=company, code__iexact=code).exclude(pk=instance.pk if instance else None).exists():
            raise serializers.ValidationError({"code": "Mã khách hàng đã tồn tại (EF-04)."})

        if attrs.get("tax_code") and Party.objects.filter(company=company, tax_code=attrs["tax_code"]).exclude(pk=instance.pk if instance else None).exists():
            raise serializers.ValidationError({"tax_code": "Mã số thuế đã tồn tại trong doanh nghiệp (EF-06, BR-CUS-10)."})

        party_type = attrs.get("party_type", instance.party_type if instance else "ORGANIZATION")
        current_status = attrs.get("status", instance.status if instance else "ACTIVE")
        if current_status == "ACTIVE" and party_type == "ORGANIZATION" and not (attrs.get("legal_name", instance.legal_name if instance else "") or "").strip():
            raise serializers.ValidationError({"legal_name": "Tên pháp lý là bắt buộc khi kích hoạt tổ chức (BR-CUS-06)."})

        for key, child_type, type_field in (
            ("addresses", PartyAddress, "address_type"),
            ("contacts", PartyContact, "contact_type"),
            ("bank_accounts", PartyBankAccount, "account_number"),
        ):
            if key not in attrs:
                continue
            current = (
                {
                    str(item.pk): {
                        type_field: getattr(item, type_field),
                        "is_default": item.is_default,
                        "status": item.status,
                    }
                    for item in child_type.objects.filter(party=instance)
                }
                if instance
                else {}
            )
            for row in attrs[key]:
                if row.get("id") and (not instance or not child_type.objects.filter(pk=row["id"], party=instance).exists()):
                    raise serializers.ValidationError({key: "Bản ghi con không thuộc khách hàng."})
                identifier = str(row.get("id") or len(current))
                current[identifier] = {**current.get(identifier, {}), **row}
            defaults = set()
            for row in current.values():
                if row.get("is_default") and row.get("status", "ACTIVE") == "ACTIVE":
                    category = row.get(type_field, "")
                    if category in defaults and type_field != "account_number":
                        raise serializers.ValidationError({key: "Mỗi loại chỉ được có một bản ghi mặc định (BR-CUS-12, BR-CUS-13)."})
                    defaults.add(category)

        if instance:
            expected = attrs.pop("version", None)
            if expected is None or expected != instance.version:
                raise serializers.ValidationError({"version": "Dữ liệu đã thay đổi; hãy tải lại trước khi lưu (BR-CUS-56, EF-12)."})

        return attrs

    def _save_children(self, party, key, model, rows):
        if rows is None:
            return
        for row in sorted(rows, key=lambda item: bool(item.get("is_default"))):
            row_id = row.pop("id", None)
            if row_id:
                item = model.objects.get(pk=row_id, party=party)
                for field, value in row.items():
                    setattr(item, field, value)
                item.full_clean()
                item.save()
            else:
                item = model(party=party, **row)
                item.full_clean()
                item.save()

    def _save_profile(self, party, data):
        if data is None:
            return
        profile, _ = CustomerProfile.objects.get_or_create(party=party)
        for field, value in data.items():
            setattr(profile, field, value)
        profile.full_clean()
        profile.save()

    def create(self, validated_data):
        addresses = validated_data.pop("addresses", None)
        contacts = validated_data.pop("contacts", None)
        bank_accounts = validated_data.pop("bank_accounts", None)
        profile = validated_data.pop("customer_profile", None)
        party = Party(**validated_data)
        party.full_clean()
        party.save()
        PartyRole.objects.get_or_create(party=party, role_type="CUSTOMER", defaults={"active_from": timezone.localdate()})
        self._save_profile(party, profile or {})
        self._save_children(party, "addresses", PartyAddress, addresses)
        self._save_children(party, "contacts", PartyContact, contacts)
        self._save_children(party, "bank_accounts", PartyBankAccount, bank_accounts)
        return party

    def update(self, instance, validated_data):
        addresses = validated_data.pop("addresses", None)
        contacts = validated_data.pop("contacts", None)
        bank_accounts = validated_data.pop("bank_accounts", None)
        profile = validated_data.pop("customer_profile", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.version += 1
        instance.full_clean()
        instance.save()
        self._save_profile(instance, profile)
        self._save_children(instance, "addresses", PartyAddress, addresses)
        self._save_children(instance, "contacts", PartyContact, contacts)
        self._save_children(instance, "bank_accounts", PartyBankAccount, bank_accounts)
        return instance


class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "post", "put", "patch", "delete", "head", "options")

    def _company(self):
        company_id = self.request.query_params.get("company_id") or self.request.data.get("company")
        try:
            return Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError, TypeError):
            raise serializers.ValidationError({"company_id": "Doanh nghiệp không hợp lệ."})

    def _allowed_scope(self, company, permission):
        if self.request.user.is_superuser:
            return None
        account = getattr(self.request.user, "iam_account", None)
        if account is None:
            raise PermissionDenied()
        branches, owned = set(), False
        for assignment in effective_assignments(account, company):
            codes = assignment_permission_codes(assignment)
            is_sys_admin = getattr(assignment.role, "is_system_admin", False)
            if not is_sys_admin and permission not in codes:
                # Permissive fallback: EDIT covers STATUS, DELETE, IMPORT, EXPORT if not assigned
                if permission in ("MD.PARTY.STATUS", "MD.PARTY.DELETE", "MD.PARTY.MERGE") and "MD.PARTY.EDIT" in codes:
                    pass
                elif permission in ("MD.PARTY.EXPORT", "MD.PARTY.IMPORT") and "MD.PARTY.EDIT" in codes:
                    pass
                else:
                    continue
            scope = assignment.data_scope_set
            if scope is None or scope.allow_all_company_data or is_sys_admin:
                return None
            branches.update(scope.branch_scopes.values_list("branch_id", flat=True))
            owned |= scope.allow_owned_records
        if not branches and not owned:
            raise PermissionDenied()
        return branches, owned

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Party.objects.none()
        company = self._company()
        permission = "MD.PARTY.EDIT" if self.action in ("update", "partial_update", "set_status", "destroy", "merge") else "MD.PARTY.VIEW"
        scope = self._allowed_scope(company, permission)
        query = (
            Party.objects.filter(company=company, roles__role_type="CUSTOMER")
            .prefetch_related("addresses", "contacts", "bank_accounts")
            .select_related("customer_profile")
        )
        if scope is not None:
            branches, owned = scope
            predicate = Q(branch_id__in=branches)
            if owned:
                predicate |= Q(owner=self.request.user.iam_account)
            query = query.filter(predicate)
        params = self.request.query_params
        if self.action == "list":
            if params.get("status"):
                query = query.filter(status=params["status"])
            if params.get("customer_group"):
                query = query.filter(customer_group=params["customer_group"])
            if params.get("party_type"):
                query = query.filter(party_type=params["party_type"])
            if params.get("search"):
                term = params["search"].strip()
                query = query.filter(
                    Q(code__icontains=term)
                    | Q(name__icontains=term)
                    | Q(legal_name__icontains=term)
                    | Q(tax_code__icontains=term)
                )
        if self.action in ("update", "partial_update", "set_status", "destroy", "merge"):
            query = query.select_for_update()
        return query.order_by("code")

    def _check_create_scope(self, company, branch, owner, permission="MD.PARTY.CREATE"):
        scope = self._allowed_scope(company, permission)
        if scope is not None:
            branches, owned = scope
            if branch not in branches and not (owned and owner == self.request.user.iam_account):
                raise PermissionDenied("Chi nhánh hoặc người phụ trách nằm ngoài phạm vi dữ liệu (BR-CUS-33, 35).")

    def _audit(self, party, action_code, before=None, after=None, reason=""):
        record_audit(
            company=party.company,
            actor_user=self.request.user.iam_account,
            module_code="MDM",
            action_code=action_code,
            entity=party,
            before=before,
            after=after,
            request=self.request,
            reason=reason,
        )

    @action(detail=False, methods=["get"], url_path="duplicates")
    def duplicates(self, request):
        company = self._company()
        params = request.query_params
        tax_code = (params.get("tax_code") or "").strip().replace(" ", "").replace("-", "")
        name = (params.get("name") or "").strip()
        email = (params.get("email") or "").strip()
        phone = (params.get("phone") or "").strip()
        identity_no = (params.get("identity_no") or "").strip()
        code = (params.get("code") or "").strip()
        exclude_id = params.get("exclude_id")

        if not any((tax_code, name, email, phone, identity_no, code)):
            raise serializers.ValidationError("Cần mã số thuế, tên, email, số điện thoại, CMND hoặc mã để kiểm tra trùng (BR-CUS-08).")

        matches = detect_duplicate_customers(
            company,
            tax_code=tax_code,
            name=name,
            email=email,
            phone=phone,
            identity_no=identity_no,
            code=code,
            exclude_id=exclude_id,
        )
        return Response(matches)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if request.query_params.get("company_id") and str(data["company"].pk) != request.query_params["company_id"]:
            raise serializers.ValidationError({"company": "Doanh nghiệp không khớp với phạm vi đang chọn."})
        self._check_create_scope(data["company"], data.get("branch").pk if data.get("branch") else None, data.get("owner"))
        party = serializer.save()
        output = self.get_serializer(party).data
        self._audit(party, "CREATE", after=output)
        return Response(output, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="quick-create")
    def quick_create(self, request):
        """Tạo nhanh khách hàng cho màn hình lập chứng từ bán hàng (AF-01, BR-CUS-54, 55)."""
        company = self._company()
        self._allowed_scope(company, "MD.PARTY.CREATE")
        actor = getattr(request.user, "iam_account", None)
        party = quick_create_customer(company=company, actor=actor, data=request.data, request=request)
        return Response(self.get_serializer(party).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="lookup-tax-info")
    def lookup_tax_info(self, request):
        """Tra cứu thông tin thuế/pháp lý doanh nghiệp trực tuyến (AF-03, BR-CUS-49, 50)."""
        tax_code = request.query_params.get("tax_code")
        info = lookup_business_tax_info(tax_code)
        return Response(info)

    @action(detail=True, methods=["post"], url_path="merge")
    def merge(self, request, pk=None):
        """Hợp nhất khách hàng bị trùng lặp (BR-CUS-38..42, AF-16)."""
        target = self.get_object()
        company = target.company
        source_id = request.data.get("source_id")
        reason = request.data.get("reason")
        conflict_resolutions = request.data.get("conflict_resolutions")
        actor = getattr(request.user, "iam_account", None)
        updated_target = merge_customers(
            company=company,
            actor=actor,
            source_id=source_id,
            target_id=target.pk,
            conflict_resolutions=conflict_resolutions,
            reason=reason,
            request=request,
        )
        return Response(self.get_serializer(updated_target).data)

    @action(detail=True, methods=["get"], url_path="debt-summary")
    def debt_summary(self, request, pk=None):
        """Xem tổng hợp công nợ và chứng từ chưa hoàn thành (AF-11, EF-14)."""
        party = self.get_object()
        summary = get_customer_debt_and_transactions_summary(party)
        return Response(summary)

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        company = self._company()
        scope = self._allowed_scope(company, "MD.PARTY.EXPORT")
        query = Party.objects.filter(company=company, roles__role_type="CUSTOMER")
        if scope is not None:
            branches, owned = scope
            predicate = Q(branch_id__in=branches)
            if owned:
                predicate |= Q(owner=request.user.iam_account)
            query = query.filter(predicate)
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="customers.csv"'
        response.write("\ufeff")
        writer = csv.writer(response)
        writer.writerow(("code", "name", "party_type", "legal_name", "tax_code", "customer_group", "status", "branch"))
        for item in query.order_by("code").iterator():
            writer.writerow((item.code, item.name, item.party_type, item.legal_name, item.tax_code or "", item.customer_group, item.status, str(item.branch_id or "")))
        return response

    @action(detail=False, methods=["post"], url_path="import")
    def import_customers(self, request):
        company = self._company()
        self._allowed_scope(company, "MD.PARTY.IMPORT")
        upload = request.FILES.get("file")
        if not upload or upload.size > 2_000_000:
            raise serializers.ValidationError({"file": "Cần tệp CSV UTF-8 không quá 2 MB (EF-17)."})
        try:
            reader = csv.DictReader(io.StringIO(upload.read().decode("utf-8-sig")))
        except UnicodeError as exc:
            raise serializers.ValidationError({"file": "Tệp phải dùng UTF-8."}) from exc
        required = {"code", "name", "party_type"}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise serializers.ValidationError({"file": "Thiếu cột code, name hoặc party_type (EF-17)."})
        preview = str(request.data.get("preview", "")).lower() in ("true", "1")
        results, seen = [], set()
        for number, row in enumerate(reader, 2):
            if number > 1001:
                raise serializers.ValidationError({"file": "Mỗi lần nhập tối đa 1.000 dòng."})
            code = (row.get("code") or "").strip().upper()
            if code in seen:
                results.append({"row": number, "code": code, "error": "Mã bị trùng trong tệp."})
                continue
            seen.add(code)
            data = {key: value for key, value in row.items() if key in {"code", "name", "party_type", "legal_name", "tax_code", "customer_group", "status", "branch"} and value not in (None, "")}
            data["company"] = str(company.pk)
            serializer = self.get_serializer(data=data)
            if not serializer.is_valid():
                results.append({"row": number, "code": code, "error": serializer.errors})
                continue
            values = serializer.validated_data
            try:
                self._check_create_scope(company, values.get("branch").pk if values.get("branch") else None, None, "MD.PARTY.IMPORT")
            except PermissionDenied:
                results.append({"row": number, "code": code, "error": "Ngoài phạm vi dữ liệu."})
                continue
            if preview:
                results.append({"row": number, "code": code, "status": "VALID"})
                continue
            with transaction.atomic():
                party = serializer.save()
                self._audit(party, "IMPORT", after=self.get_serializer(party).data)
            results.append({"row": number, "code": code, "status": "CREATED", "id": str(party.pk)})
        return Response({"preview": preview, "results": results})

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        party = self.get_object()
        before = self.get_serializer(party).data
        serializer = self.get_serializer(party, data=request.data, partial=kwargs.get("partial", False))
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        new_branch = data.get("branch", party.branch)
        if not request.user.is_superuser:
            scope = self._allowed_scope(party.company, "MD.PARTY.EDIT")
            if scope is not None:
                branches, owned = scope
                new_owner = data.get("owner", party.owner)
                if (new_branch.pk if new_branch else None) not in branches and not (owned and new_owner == request.user.iam_account):
                    raise PermissionDenied("Chi nhánh mới nằm ngoài phạm vi dữ liệu.")
        party = serializer.save()
        output = self.get_serializer(party).data
        self._audit(party, "EDIT", before=before, after=output)
        return Response(output)

    @action(detail=True, methods=["post"], url_path="set-status")
    @transaction.atomic
    def set_status(self, request, pk=None):
        party = self.get_object()
        new_status = request.data.get("status")
        reason = (request.data.get("reason") or "").strip()
        if new_status not in ("ACTIVE", "INACTIVE", "BLOCKED"):
            raise serializers.ValidationError({"status": "Trạng thái không hợp lệ."})
        if new_status in ("INACTIVE", "BLOCKED") and not reason:
            raise serializers.ValidationError({"reason": "Lý do là bắt buộc khi ngừng sử dụng hoặc khóa giao dịch (BR-CUS-21)."})

        warning = None
        if new_status == "INACTIVE":
            summary = get_customer_debt_and_transactions_summary(party)
            if summary.get("has_outstanding_debt") or summary.get("pending_orders_count", 0) > 0:
                warning = f"Khách hàng đang có công nợ ({summary.get('total_receivable')} VND) hoặc chứng từ chưa hoàn thành ({summary.get('pending_orders_count')} đơn). Nghiệp vụ thu nợ vẫn được phép (AF-11, EF-14)."

        before = self.get_serializer(party).data
        serializer = self.get_serializer(party, data={"status": new_status, "version": request.data.get("version")}, partial=True)
        serializer.is_valid(raise_exception=True)
        party = serializer.save()
        output = self.get_serializer(party).data
        if warning:
            output["warning"] = warning
        self._audit(party, new_status, before=before, after=output, reason=reason)
        return Response(output)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        """Xóa khách hàng (BR-CUS-19, 20). Chặn nếu đã phát sinh chứng từ."""
        party = self.get_object()
        can_delete, reason = check_customer_can_be_deleted(party)
        if not can_delete:
            raise serializers.ValidationError({"detail": reason})
        actor = getattr(request.user, "iam_account", None)
        delete_customer(party, actor=actor, request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)
