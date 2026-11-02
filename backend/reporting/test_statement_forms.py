import io

from django.test import SimpleTestCase
from openpyxl import load_workbook

from .statement_forms import Row, Statement, build_pdf, build_xlsx, statement_columns


def sample():
    return Statement(
        company_name="Công ty Kiểm thử", company_address="Hà Nội", tax_code="0100000000", form_code="B02-DN",
        legal_basis="Thông tư 99/2025/TT-BTC", title="BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH", period="Năm 2026",
        columns=statement_columns("Năm nay", "Năm trước"),
        rows=[Row(["Doanh thu", "01", "", "1500000", "-200"], bold=True), Row(["Dòng trống", "02", "", None, None])],
        signature={"preparer_name": "Nguyễn A", "report_date": "2026-10-31"},
    )


class StatementFormTests(SimpleTestCase):
    def test_excel_keeps_amounts_numeric_and_prints_signature_block(self):
        sheet = load_workbook(io.BytesIO(build_xlsx(sample()))).active
        self.assertEqual(sheet["A5"].value, "BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH")
        self.assertEqual([sheet["D9"].value, sheet["E9"].value], [1500000, -200])
        self.assertIsNone(sheet["D10"].value)
        values = [cell.value for row in sheet.iter_rows() for cell in row]
        self.assertIn("Lập, ngày 31 tháng 10 năm 2026", values)
        self.assertIn("Nguyễn A", values)

    def test_pdf_is_produced_with_vietnamese_text(self):
        self.assertTrue(build_pdf(sample()).startswith(b"%PDF"))
