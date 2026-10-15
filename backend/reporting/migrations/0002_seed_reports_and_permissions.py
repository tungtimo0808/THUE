import uuid

from django.db import migrations


RESOURCES = {
    "RPT.CENTER": ("Trung tâm báo cáo", ("VIEW",)),
    "RPT.CONFIG": ("Cấu hình báo cáo", ("VIEW", "CREATE", "EDIT", "DELETE")),
    "RPT.FINANCIAL": ("Báo cáo tài chính", ("VIEW", "EXPORT", "PRINT")),
    "RPT.LEDGER": ("Báo cáo sổ kế toán", ("VIEW", "EXPORT", "PRINT")),
    "RPT.COMMERCE": ("Báo cáo mua bán", ("VIEW", "EXPORT", "PRINT")),
    "RPT.DEBT": ("Báo cáo công nợ", ("VIEW", "EXPORT", "PRINT")),
    "RPT.MONEY": ("Báo cáo tiền", ("VIEW", "EXPORT", "PRINT")),
    "RPT.INVENTORY": ("Báo cáo kho", ("VIEW", "EXPORT", "PRINT")),
    "RPT.ASSET": ("Báo cáo tài sản", ("VIEW", "EXPORT", "PRINT")),
    "RPT.TAX": ("Báo cáo thuế", ("VIEW", "EXPORT", "PRINT")),
    "RPT.MANAGEMENT": ("Báo cáo quản trị", ("VIEW", "EXPORT", "PRINT")),
}


REPORTS = (
    ("B01-DN", "Báo cáo tình hình tài chính", "FINANCIAL", "RPT.FINANCIAL.VIEW", ["GL"], True, 10),
    ("B02-DN", "Báo cáo kết quả hoạt động kinh doanh", "FINANCIAL", "RPT.FINANCIAL.VIEW", ["GL"], True, 20),
    ("B03-DN", "Báo cáo lưu chuyển tiền tệ", "FINANCIAL", "RPT.FINANCIAL.VIEW", ["GL", "CASH", "BANK"], True, 30),
    ("B09-DN", "Bản thuyết minh Báo cáo tài chính", "FINANCIAL", "RPT.FINANCIAL.VIEW", ["GL"], True, 40),
    ("ACCOUNTING_BOOKS", "Sổ cái, sổ chi tiết và nhật ký", "LEDGER", "RPT.LEDGER.VIEW", ["GL"], False, 50),
    ("PURCHASE_SALES", "Báo cáo mua hàng và bán hàng", "COMMERCE", "RPT.COMMERCE.VIEW", ["PUR", "SAL"], True, 60),
    ("DEBT_AGING", "Công nợ phải thu, phải trả và tuổi nợ", "DEBT", "RPT.DEBT.VIEW", ["AR", "AP", "GL"], False, 70),
    ("CASH_BANK", "Tiền mặt, ngân hàng và dòng tiền", "MONEY", "RPT.MONEY.VIEW", ["CASH", "BANK", "GL"], True, 80),
    ("INVENTORY", "Nhập, xuất, tồn và giá trị hàng tồn", "INVENTORY", "RPT.INVENTORY.VIEW", ["INV", "GL"], False, 90),
    ("FIXED_ASSETS", "TSCĐ, CCDC, khấu hao và phân bổ", "ASSET", "RPT.ASSET.VIEW", ["FA", "GL"], False, 100),
    ("TAX_INVOICES", "Thuế và hóa đơn", "TAX", "RPT.TAX.VIEW", ["TAX", "GL"], False, 110),
    ("MANAGEMENT", "Doanh thu, chi phí và lợi nhuận quản trị", "MANAGEMENT", "RPT.MANAGEMENT.VIEW", ["GL"], True, 120),
)


LINES = {
    "B01-DN": (
        ("ASSETS", "Tài sản", ["1"], "DEBIT_MINUS_CREDIT", 10),
        ("LIABILITIES", "Nợ phải trả", ["3"], "CREDIT_MINUS_DEBIT", 20),
        ("EQUITY", "Vốn chủ sở hữu", ["4"], "CREDIT_MINUS_DEBIT", 30),
    ),
    "B02-DN": (
        ("REVENUE", "Doanh thu", ["5", "7"], "CREDIT_MINUS_DEBIT", 10),
        ("EXPENSE", "Chi phí", ["6", "8"], "DEBIT_MINUS_CREDIT", 20),
    ),
    "B03-DN": (("CASH_MOVEMENT", "Lưu chuyển tiền thuần", ["111", "112"], "DEBIT_MINUS_CREDIT", 10),),
}


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    Definition = apps.get_model("reporting", "ReportDefinition")
    Line = apps.get_model("reporting", "ReportLineMapping")
    names = {"VIEW": "Xem", "CREATE": "Tạo", "EDIT": "Cập nhật", "DELETE": "Ngừng sử dụng", "EXPORT": "Xuất file", "PRINT": "In"}
    actions = {}
    for code, name in names.items():
        actions[code], _ = Action.objects.get_or_create(code=code, defaults={"id": uuid.uuid4(), "name": name, "risk_level": "NORMAL"})
    for code, (name, action_codes) in RESOURCES.items():
        resource, _ = Resource.objects.get_or_create(code=code, defaults={"id": uuid.uuid4(), "module_code": "RPT", "name": name, "status": "ACTIVE"})
        for action_code in action_codes:
            Permission.objects.get_or_create(code=f"{code}.{action_code}", defaults={"id": uuid.uuid4(), "resource_id": resource.id, "action_id": actions[action_code].id, "description": f"{names[action_code]} - {name}", "status": "ACTIVE"})
    for code, name, group, permission, modules, comparison, sequence in REPORTS:
        report, _ = Definition.objects.get_or_create(code=code, defaults={
            "id": uuid.uuid4(), "name": name, "group": group, "permission_code": permission,
            "source_modules": modules, "supports_comparison": comparison, "sequence": sequence,
            "parameter_schema": {"required_one_of": ["period", ["date_from", "date_to"]]},
        })
        for line_code, line_name, prefixes, calculation, line_sequence in LINES.get(code, ()):
            Line.objects.get_or_create(report=report, code=line_code, defaults={"id": uuid.uuid4(), "name": line_name, "account_prefixes": prefixes, "calculation": calculation, "sequence": line_sequence})


class Migration(migrations.Migration):
    dependencies = [("reporting", "0001_initial"), ("iam", "0005_seed_uc_md")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
