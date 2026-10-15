import uuid

from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from master_data.models import DocumentType
from organization.models import Branch, Company, CompanyStatus

from .models import (
    DocumentNumberHistory,
    DocumentNumberingRule,
    NumberingRuleStatus,
    NumberingSequenceTracker,
)
from .module_views import get_actor_user
from .numbering_serializers import (
    DocumentNumberHistorySerializer,
    DocumentNumberingRuleCreateSerializer,
    DocumentNumberingRuleSerializer,
    DocumentNumberingRuleUpdateSerializer,
    GenerateDocumentNumberRequestSerializer,
    ManualNumberValidationRequestSerializer,
    NumberingRuleActivateRequestSerializer,
    NumberingRuleCopyRequestSerializer,
    NumberingRuleDeactivateRequestSerializer,
    NumberingRulePreviewRequestSerializer,
    NumberingSequenceTrackerSerializer,
)
from .numbering_services import (
    activate_numbering_rule,
    copy_rule,
    create_new_version,
    create_numbering_rule,
    deactivate_numbering_rule,
    generate_document_number,
    preview_number_patterns,
    update_draft_rule,
    validate_and_record_manual_number,
)
from .permissions import CommonCompanyPermission


def resolve_company(request, rule_pk=None):
    company_id = (
        request.query_params.get("company_id")
        or request.query_params.get("company")
        or (request.data.get("company") if isinstance(request.data, dict) else None)
        or (request.data.get("company_id") if isinstance(request.data, dict) else None)
    )
    if not company_id and rule_pk:
        company_id = DocumentNumberingRule.objects.filter(pk=rule_pk).values_list("company_id", flat=True).first()
    if not company_id and hasattr(request.user, "iam_account"):
        company_id = request.user.iam_account.memberships.filter(membership_status="ACTIVE").values_list("company_id", flat=True).first()
    if not company_id:
        raise ValidationError({"company": "Tham số doanh nghiệp (company hoặc company_id) là bắt buộc."})
    try:
        company = Company.objects.get(pk=company_id)
    except (Company.DoesNotExist, ValueError):
        raise ValidationError({"company": "Doanh nghiệp không tồn tại."})
    if company.status == CompanyStatus.INACTIVE:
        raise ValidationError({"company": "Doanh nghiệp hiện đang ngừng hoạt động."})
    return company


def get_rule_or_404(pk, company=None):
    qs = DocumentNumberingRule.objects.all()
    if company:
        qs = qs.filter(company=company)
    rule = qs.filter(pk=pk).first()
    if not rule:
        raise NotFound("Không tìm thấy quy tắc đánh số chứng từ tương ứng.")
    return rule


class NumberingRuleListView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"GET": "SYS.NUMBERING.VIEW", "POST": "SYS.NUMBERING.CONFIGURE"}

    def get(self, request):
        company = resolve_company(request)
        qs = DocumentNumberingRule.objects.filter(company=company).select_related(
            "document_type", "branch", "created_by", "updated_by"
        )
        if doc_type := request.query_params.get("document_type"):
            qs = qs.filter(document_type_id=doc_type)
        if st := request.query_params.get("status"):
            qs = qs.filter(status=st)
        if q := request.query_params.get("q"):
            qs = qs.filter(code__icontains=q) | qs.filter(name__icontains=q)

        serializer = DocumentNumberingRuleSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        company = resolve_company(request)
        actor = get_actor_user(request)
        serializer = DocumentNumberingRuleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        rule = create_numbering_rule(company, serializer.validated_data, actor)
        return Response(
            DocumentNumberingRuleSerializer(rule).data,
            status=status.HTTP_201_CREATED,
        )


class NumberingRuleDetailView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {
        "GET": "SYS.NUMBERING.VIEW",
        "PATCH": "SYS.NUMBERING.CONFIGURE",
        "PUT": "SYS.NUMBERING.CONFIGURE",
        "DELETE": "SYS.NUMBERING.CONFIGURE",
    }

    def get(self, request, pk):
        company = resolve_company(request, rule_pk=pk)
        rule = get_rule_or_404(pk, company)
        return Response(DocumentNumberingRuleSerializer(rule).data)

    def patch(self, request, pk):
        company = resolve_company(request, rule_pk=pk)
        actor = get_actor_user(request)
        rule = get_rule_or_404(pk, company)
        serializer = DocumentNumberingRuleUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        updated_rule = update_draft_rule(rule, serializer.validated_data, actor)
        return Response(DocumentNumberingRuleSerializer(updated_rule).data)

    def put(self, request, pk):
        return self.patch(request, pk)

    def delete(self, request, pk):
        company = resolve_company(request, rule_pk=pk)
        rule = get_rule_or_404(pk, company)
        if rule.status != NumberingRuleStatus.DRAFT:
            raise ValidationError("Chỉ có thể xóa quy tắc ở trạng thái DRAFT. Quy tắc đã kích hoạt không được xóa cứng (BR-NUM-34).")
        rule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class NumberingRulePreviewView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"POST": "SYS.NUMBERING.VIEW"}

    def post(self, request):
        company = resolve_company(request)
        serializer = NumberingRulePreviewRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = preview_number_patterns(company, serializer.validated_data)
        return Response(result)


class NumberingRuleActivateView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"POST": "SYS.NUMBERING.CONFIGURE"}

    def post(self, request, pk):
        company = resolve_company(request, rule_pk=pk)
        actor = get_actor_user(request)
        rule = get_rule_or_404(pk, company)

        serializer = NumberingRuleActivateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        activated_rule = activate_numbering_rule(
            rule, actor, effective_from=serializer.validated_data.get("effective_from")
        )
        return Response({
            "detail": "Kích hoạt quy tắc đánh số thành công.",
            "data": DocumentNumberingRuleSerializer(activated_rule).data,
        })


class NumberingRuleDeactivateView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"POST": "SYS.NUMBERING.CONFIGURE"}

    def post(self, request, pk):
        company = resolve_company(request, rule_pk=pk)
        actor = get_actor_user(request)
        rule = get_rule_or_404(pk, company)

        serializer = NumberingRuleDeactivateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        deactivated_rule = deactivate_numbering_rule(
            rule,
            actor,
            reason=serializer.validated_data["reason"],
            effective_to=serializer.validated_data.get("effective_to"),
        )
        return Response({
            "detail": "Ngừng áp dụng quy tắc đánh số thành công.",
            "data": DocumentNumberingRuleSerializer(deactivated_rule).data,
        })


class NumberingRuleNewVersionView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"POST": "SYS.NUMBERING.CONFIGURE"}

    def post(self, request, pk):
        company = resolve_company(request, rule_pk=pk)
        actor = get_actor_user(request)
        rule = get_rule_or_404(pk, company)

        new_rule = create_new_version(rule, actor)
        return Response(
            DocumentNumberingRuleSerializer(new_rule).data,
            status=status.HTTP_201_CREATED,
        )


class NumberingRuleCopyView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"POST": "SYS.NUMBERING.CONFIGURE"}

    def post(self, request, pk):
        company = resolve_company(request, rule_pk=pk)
        actor = get_actor_user(request)
        source_rule = get_rule_or_404(pk, company)

        serializer = NumberingRuleCopyRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target_doc_type = None
        if target_id := serializer.validated_data.get("document_type"):
            target_doc_type = DocumentType.objects.filter(pk=target_id).first()

        copied = copy_rule(
            source_rule=source_rule,
            new_code=serializer.validated_data["code"],
            new_name=serializer.validated_data.get("name"),
            actor=actor,
            target_document_type=target_doc_type,
        )
        return Response(
            DocumentNumberingRuleSerializer(copied).data,
            status=status.HTTP_201_CREATED,
        )


class NumberingRuleCountersView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"GET": "SYS.NUMBERING.VIEW"}

    def get(self, request, pk):
        company = resolve_company(request, rule_pk=pk)
        rule = get_rule_or_404(pk, company)
        trackers = NumberingSequenceTracker.objects.filter(rule=rule).order_by("scope_key", "period_key")
        return Response(NumberingSequenceTrackerSerializer(trackers, many=True).data)


class NumberingHistoryListView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"GET": "SYS.NUMBERING.VIEW"}

    def get(self, request):
        company = resolve_company(request)
        qs = DocumentNumberHistory.objects.filter(company=company).select_related(
            "document_type", "branch", "issued_by"
        )
        if doc_type := request.query_params.get("document_type"):
            qs = qs.filter(document_type_id=doc_type)
        if st := request.query_params.get("status"):
            qs = qs.filter(status=st)
        if q := request.query_params.get("q"):
            qs = qs.filter(document_number__icontains=q)

        serializer = DocumentNumberHistorySerializer(qs[:100], many=True)
        return Response(serializer.data)


def find_document_type(doc_type_val):
    if not doc_type_val:
        return None
    pk_val = None
    if isinstance(doc_type_val, uuid.UUID):
        pk_val = doc_type_val
    else:
        try:
            pk_val = uuid.UUID(str(doc_type_val))
        except (ValueError, AttributeError):
            pk_val = None
    if pk_val:
        found = DocumentType.objects.filter(pk=pk_val).first()
        if found:
            return found
    return DocumentType.objects.filter(code=str(doc_type_val)).first()


class GenerateDocumentNumberView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"POST": "SYS.NUMBERING.VIEW"}

    def post(self, request):
        company = resolve_company(request)
        actor = get_actor_user(request)
        serializer = GenerateDocumentNumberRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        doc_type_val = data["document_type"]
        doc_type = find_document_type(doc_type_val)

        if not doc_type:
            raise ValidationError({"document_type": f"Loại chứng từ '{doc_type_val}' không tồn tại."})

        branch = None
        if branch_id := data.get("branch"):
            branch = Branch.objects.filter(pk=branch_id, company=company).first()

        doc_number = generate_document_number(
            company=company,
            document_type=doc_type,
            document_date=data.get("document_date"),
            branch=branch,
            accounting_book=data.get("accounting_book", ""),
            custom_scope_key=data.get("custom_scope_key", ""),
            actor=actor,
            entity_type=data.get("entity_type", ""),
            entity_id=data.get("entity_id"),
            event=data.get("event"),
        )
        return Response({"document_number": doc_number})


class ValidateManualNumberView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"POST": "SYS.NUMBERING.MANUAL_OVERRIDE"}

    def post(self, request):
        company = resolve_company(request)
        actor = get_actor_user(request)
        serializer = ManualNumberValidationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        doc_type_val = data["document_type"]
        doc_type = find_document_type(doc_type_val)

        if not doc_type:
            raise ValidationError({"document_type": f"Loại chứng từ '{doc_type_val}' không tồn tại."})

        branch = None
        if branch_id := data.get("branch"):
            branch = Branch.objects.filter(pk=branch_id, company=company).first()

        history = validate_and_record_manual_number(
            company=company,
            document_type=doc_type,
            document_number=data["document_number"],
            actor=actor,
            branch=branch,
            entity_type=data.get("entity_type", ""),
            entity_id=data.get("entity_id"),
        )
        return Response({
            "detail": "Số chứng từ thủ công hợp lệ và đã được ghi nhận.",
            "data": DocumentNumberHistorySerializer(history).data,
        })
