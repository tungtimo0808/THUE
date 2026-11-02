import io
import shutil
import tempfile

import openpyxl
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from iam.models import CompanyMembership
from master_data.models import Currency
from organization.models import Company

# The payload MisaReportCenterWorkspace builds from the preview table it shows.
PREVIEW = {
    "report_code": "Bảng kê mua hàng",
    "title": "Bảng kê mua hàng",
    "columns": [
        {"key": "col_0", "label": "Mã hàng", "type": "text"},
        {"key": "col_1", "label": "Tên hàng", "type": "text"},
        {"key": "col_2", "label": "Thành tiền"},
    ],
    "rows": [
        {"col_0": "001", "col_1": "Máy tính", "col_2": 217500000},
        {"col_0": "TỔNG CỘNG", "col_1": "", "col_2": 217500000, "is_subtotal": True},
    ],
    "options": {"include_grand_total": False},
}


class ReportCenterExportTests(TestCase):
    def setUp(self):
        media_root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, media_root, ignore_errors=True)
        media = override_settings(MEDIA_ROOT=media_root)
        media.enable()
        self.addCleanup(media.disable)
        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company = Company.objects.create(
            code="RCX", name="Công ty Xuất", legal_name="Công ty Xuất", tax_code="0100333333",
            accounting_currency=currency, legal_reporting_currency=currency,
        )
        admin = get_user_model().objects.create_superuser(username="rcx-admin", password="password-123")
        member = get_user_model().objects.create_user(username="rcx-member", password="password-123")
        CompanyMembership.objects.create(company=self.company, user=member.iam_account, created_by=admin.iam_account)
        self.client = APIClient()
        self.client.force_authenticate(member)

    def export(self, output_format):
        response = self.client.post(
            f"/api/v1/reports/export/jobs/?company_id={self.company.pk}",
            {**PREVIEW, "company_id": str(self.company.pk), "output_format": output_format}, format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        artifact = response.data["artifact"]
        return self.client.get(
            f"/api/v1/reports/export/artifacts/{artifact['artifact_id']}/download/?token={artifact['download_token']}"
        )

    def test_preview_table_exports_to_excel_with_amounts_as_numbers(self):
        download = self.export("XLSX")

        self.assertEqual(download.status_code, 200)
        sheet = openpyxl.load_workbook(io.BytesIO(download.content)).active
        values = [cell for row in sheet.iter_rows(values_only=True) for cell in row]
        self.assertIn(217500000, values)
        self.assertIn("001", values)
        self.assertEqual(values.count("TỔNG CỘNG"), 1)

    def test_preview_table_prints_as_html_page(self):
        download = self.export("PRINT")

        self.assertEqual(download.status_code, 200)
        self.assertIn("text/html", download["Content-Type"])
        self.assertIn("Máy tính", download.content.decode("utf-8"))
