from uuid import UUID

from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.viewsets import ViewSet

from organization.models import Company

from .permissions import ReportingPermission
from .models import TT133NoteText
from .tt133_reports import NOTE_SECTIONS, REPORTS, build_report


class TT133FinancialReportViewSet(ViewSet):
    permission_classes = (ReportingPermission,)
    iam_permissions = {"GET": "RPT.FINANCIAL.VIEW", "PATCH": "RPT.FINANCIAL_NOTES.PREPARE"}

    def _scope(self, request):
        try:
            company_id = UUID(request.query_params.get("company_id", ""))
        except (ValueError, TypeError):
            raise ValidationError({"company_id": "Doanh nghiệp không hợp lệ."})
        company = get_object_or_404(Company, pk=company_id)
        try:
            year = int(request.query_params.get("year", ""))
        except (ValueError, TypeError):
            raise ValidationError({"year": "Năm báo cáo không hợp lệ."})
        if not 1900 <= year <= 2100:
            raise ValidationError({"year": "Năm báo cáo phải từ 1900 đến 2100."})
        return company, year

    def list(self, request):
        company, year = self._scope(request)
        code = request.query_params.get("template_code", "B01a-DNN")
        if code not in REPORTS:
            raise ValidationError({"template_code": "Mẫu báo cáo TT133 không hợp lệ."})
        return Response(build_report(company, year, code))

    @action(detail=False, methods=["patch"], url_path="notes")
    def notes(self, request):
        company, year = self._scope(request)
        section = request.data.get("section_code")
        content = request.data.get("content")
        if section not in NOTE_SECTIONS:
            raise ValidationError({"section_code": "Mục thuyết minh không hợp lệ."})
        if not isinstance(content, str) or len(content) > 10000:
            raise ValidationError({"content": "Nội dung thuyết minh phải là văn bản tối đa 10.000 ký tự."})
        note, _ = TT133NoteText.objects.update_or_create(
            company=company, year=year, section_code=section,
            defaults={"content": content.strip(), "updated_by": request.user.iam_account},
        )
        return Response({"section_code": section, "content": note.content, "updated_at": note.updated_at})
