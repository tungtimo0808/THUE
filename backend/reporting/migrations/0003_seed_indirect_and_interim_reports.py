import uuid

from django.db import migrations

# Reports offered by the "Lập báo cáo tài chính" dialog that had no definition yet.
REPORTS = (
    ("B03-DN-GT", "Báo cáo lưu chuyển tiền tệ (phương pháp gián tiếp)", ["GL", "CASH", "BANK"], 35),
    ("B01a-DN", "Báo cáo tình hình tài chính giữa niên độ", ["GL"], 210),
    ("B02a-DN", "Báo cáo kết quả hoạt động kinh doanh giữa niên độ", ["GL"], 220),
    ("B03a-DN", "Báo cáo lưu chuyển tiền tệ giữa niên độ", ["GL", "CASH", "BANK"], 230),
    ("B03a-DN-GT", "Báo cáo lưu chuyển tiền tệ giữa niên độ (phương pháp gián tiếp)", ["GL", "CASH", "BANK"], 235),
    ("B09a-DN", "Bản thuyết minh Báo cáo tài chính chọn lọc", ["GL"], 240),
)

BALANCE_LINES = (
    ("ASSETS", "Tài sản", ["1", "2"], "DEBIT_MINUS_CREDIT", 10),
    ("LIABILITIES", "Nợ phải trả", ["3"], "CREDIT_MINUS_DEBIT", 20),
    ("EQUITY", "Vốn chủ sở hữu", ["4"], "CREDIT_MINUS_DEBIT", 30),
)
INCOME_LINES = (
    ("REVENUE", "Doanh thu và thu nhập", ["5", "7"], "CREDIT_MINUS_DEBIT", 10),
    ("EXPENSE", "Chi phí", ["6", "8"], "DEBIT_MINUS_CREDIT", 20),
)
# Indirect method: result of the period, adjusted for non-cash items and working-capital changes.
INDIRECT_CASH_LINES = (
    ("REVENUE", "Doanh thu và thu nhập", ["5", "7"], "CREDIT_MINUS_DEBIT", 10),
    ("EXPENSE", "Chi phí", ["6", "8"], "DEBIT_MINUS_CREDIT", 20),
    ("DEPRECIATION", "Khấu hao TSCĐ", ["214"], "CREDIT_MINUS_DEBIT", 30),
    ("RECEIVABLES", "Tăng, giảm các khoản phải thu", ["131", "133", "138", "141"], "DEBIT_MINUS_CREDIT", 40),
    ("INVENTORIES", "Tăng, giảm hàng tồn kho", ["15"], "DEBIT_MINUS_CREDIT", 50),
    ("PAYABLES", "Tăng, giảm các khoản phải trả", ["331", "333", "334", "338"], "CREDIT_MINUS_DEBIT", 60),
    ("NET_CASH", "Lưu chuyển tiền thuần trong kỳ", ["111", "112"], "DEBIT_MINUS_CREDIT", 70),
)
LINES = {
    "B03-DN-GT": INDIRECT_CASH_LINES,
    "B03a-DN-GT": INDIRECT_CASH_LINES,
    "B01a-DN": BALANCE_LINES,
    "B02a-DN": INCOME_LINES,
    "B03a-DN": (("CASH_MOVEMENT", "Lưu chuyển tiền thuần", ["111", "112"], "DEBIT_MINUS_CREDIT", 10),),
}


def seed(apps, schema_editor):
    Definition = apps.get_model("reporting", "ReportDefinition")
    Line = apps.get_model("reporting", "ReportLineMapping")
    # B01-DN only summed class 1; long-term assets (211, 214, 241…) are class 2.
    Line.objects.filter(report__code="B01-DN", code="ASSETS", account_prefixes=["1"]).update(account_prefixes=["1", "2"])
    for code, name, modules, sequence in REPORTS:
        report, _ = Definition.objects.get_or_create(code=code, defaults={
            "id": uuid.uuid4(), "name": name, "group": "FINANCIAL", "permission_code": "RPT.FINANCIAL.VIEW",
            "source_modules": modules, "supports_comparison": True, "sequence": sequence,
            "parameter_schema": {"required_one_of": ["period", ["date_from", "date_to"]]},
        })
        for line_code, line_name, prefixes, calculation, line_sequence in LINES.get(code, ()):
            Line.objects.get_or_create(report=report, code=line_code, defaults={
                "id": uuid.uuid4(), "name": line_name, "account_prefixes": prefixes,
                "calculation": calculation, "sequence": line_sequence,
            })


class Migration(migrations.Migration):
    dependencies = [("reporting", "0002_seed_reports_and_permissions")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
