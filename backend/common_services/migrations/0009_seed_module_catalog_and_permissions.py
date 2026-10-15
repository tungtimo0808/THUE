import uuid
from django.db import migrations


MODULE_CATALOG_DATA = [
    {
        "code": "SYS", "name": "Quản trị hệ thống", "category": "SYSTEM_REQUIRED",
        "description": "Quản lý doanh nghiệp, người dùng, phân quyền và nhật ký kiểm toán.",
        "icon": "Shield", "dependencies": [], "menu_group": "Thiết lập", "display_order": 1,
    },
    {
        "code": "COM", "name": "Chức năng dùng chung", "category": "SYSTEM_REQUIRED",
        "description": "Xác thực, tìm kiếm toàn cục, bảng điều khiển và thiết lập cơ bản.",
        "icon": "Grid", "dependencies": ["SYS"], "menu_group": "Hệ thống", "display_order": 2,
    },
    {
        "code": "MD", "name": "Danh mục tổng thể", "category": "SYSTEM_REQUIRED",
        "description": "Quản lý đối tác, tài khoản, tiền tệ, đơn vị tính và danh mục kế toán.",
        "icon": "Database", "dependencies": ["SYS", "COM"], "menu_group": "Danh mục", "display_order": 3,
    },
    {
        "code": "GL", "name": "Kế toán tổng hợp / Sổ cái", "category": "CORE",
        "description": "Bút toán sổ nhật ký chung, sổ cái, khóa sổ và số dư tài khoản.",
        "icon": "BookOpen", "dependencies": ["MD"], "menu_group": "Kế toán", "display_order": 4,
    },
    {
        "code": "TAX", "name": "Quản lý thuế", "category": "CORE",
        "description": "Kê khai thuế GTGT, quyết toán thuế TNDN, thuế TNCN và tờ khai.",
        "icon": "FileText", "dependencies": ["GL"], "menu_group": "Thuế", "display_order": 5,
    },
    {
        "code": "RPT", "name": "Báo cáo tài chính & quản trị", "category": "CORE",
        "description": "Bảng cân đối kế toán, kết quả kinh doanh, lưu chuyển tiền tệ.",
        "icon": "BarChart2", "dependencies": ["GL"], "menu_group": "Báo cáo", "display_order": 6,
    },
    {
        "code": "CASH", "name": "Tiền mặt", "category": "OPTIONAL",
        "description": "Phiếu thu, phiếu chi, sổ quỹ tiền mặt và kiểm kê quỹ.",
        "icon": "DollarSign", "dependencies": ["GL"], "menu_group": "Tiền mặt", "display_order": 7,
    },
    {
        "code": "BANK", "name": "Tiền gửi ngân hàng", "category": "OPTIONAL",
        "description": "Thu tiền gửi, chi tiền gửi, séc, đối chiếu sổ phụ ngân hàng.",
        "icon": "Landmark", "dependencies": ["GL"], "menu_group": "Ngân hàng", "display_order": 8,
    },
    {
        "code": "AP", "name": "Phải trả người bán", "category": "OPTIONAL",
        "description": "Hóa đơn mua, theo dõi công nợ phải trả, thanh toán công nợ.",
        "icon": "CreditCard", "dependencies": ["GL"], "menu_group": "Mua hàng", "display_order": 9,
    },
    {
        "code": "PUR", "name": "Mua hàng", "category": "OPTIONAL",
        "description": "Yêu cầu mua, đơn mua hàng, nhận hàng và quản lý hợp đồng mua.",
        "icon": "ShoppingCart", "dependencies": ["GL", "AP"], "menu_group": "Mua hàng", "display_order": 10,
    },
    {
        "code": "AR", "name": "Phải thu khách hàng", "category": "OPTIONAL",
        "description": "Hóa đơn bán, theo dõi công nợ phải thu, đối chiếu công nợ.",
        "icon": "Receipt", "dependencies": ["GL"], "menu_group": "Bán hàng", "display_order": 11,
    },
    {
        "code": "SAL", "name": "Bán hàng", "category": "OPTIONAL",
        "description": "Báo giá, đơn đặt hàng, giao hàng và hợp đồng bán lẻ/buôn.",
        "icon": "TrendingUp", "dependencies": ["GL", "AR"], "menu_group": "Bán hàng", "display_order": 12,
    },
    {
        "code": "INV", "name": "Quản lý kho", "category": "OPTIONAL",
        "description": "Nhập kho, xuất kho, điều chuyển kho, thẻ kho và tính giá vốn.",
        "icon": "Archive", "dependencies": ["GL"], "menu_group": "Kho", "display_order": 13,
    },
    {
        "code": "FA", "name": "Tài sản cố định", "category": "OPTIONAL",
        "description": "Ghi tăng TSCĐ, trích khấu hao, điều chuyển, đánh giá lại, thanh lý.",
        "icon": "Truck", "dependencies": ["GL"], "menu_group": "Tài sản", "display_order": 14,
    },
    {
        "code": "WF", "name": "Workflow phê duyệt nhiều cấp", "category": "OPTIONAL",
        "description": "Định nghĩa quy trình duyệt chứng từ nhiều cấp, song song, tuần tự.",
        "icon": "GitFork", "dependencies": ["SYS"], "menu_group": "Thiết lập", "display_order": 15,
    },
    {
        "code": "AI", "name": "Trợ lý AI & Hỗ trợ thông minh", "category": "AI_ASSISTED",
        "description": "Trích xuất hóa đơn, gợi ý định khoản, phát hiện bất thường và hỏi đáp AVA.",
        "icon": "Cpu", "dependencies": ["COM"], "menu_group": "AI Assistant", "display_order": 16,
    },
    {
        "code": "EINVOICE", "name": "Hóa đơn điện tử", "category": "INTEGRATION",
        "description": "Phát hành hóa đơn điện tử, truyền nhận dữ liệu với Cơ quan Thuế.",
        "icon": "Send", "dependencies": ["SAL", "TAX"], "menu_group": "Hóa đơn", "display_order": 17,
    },
    {
        "code": "EBANK", "name": "Ngân hàng điện tử", "category": "INTEGRATION",
        "description": "Kết nối ngân hàng, chuyển tiền trực tuyến, đối chiếu tự động.",
        "icon": "Wifi", "dependencies": ["BANK"], "menu_group": "Ngân hàng", "display_order": 18,
    },
]


def seed(apps, schema_editor):
    ModuleCatalog = apps.get_model("common_services", "ModuleCatalog")
    for item in MODULE_CATALOG_DATA:
        ModuleCatalog.objects.update_or_create(
            code=item["code"],
            defaults=item,
        )

    # Seed Permissions for Module Management
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    Role = apps.get_model("iam", "Role")
    RolePermission = apps.get_model("iam", "RolePermission")

    view_act, _ = Action.objects.get_or_create(code="VIEW", defaults={"id": uuid.uuid4(), "name": "Xem", "risk_level": "NORMAL"})
    cfg_act, _ = Action.objects.get_or_create(code="CONFIGURE", defaults={"id": uuid.uuid4(), "name": "Cấu hình", "risk_level": "HIGH"})

    res, _ = Resource.objects.get_or_create(code="SYS.MODULE", defaults={
        "id": uuid.uuid4(), "module_code": "SYS", "name": "Cấu hình phân hệ", "status": "ACTIVE",
    })

    perm_view, _ = Permission.objects.get_or_create(code="SYS.MODULE.VIEW", defaults={
        "id": uuid.uuid4(), "resource_id": res.pk, "action_id": view_act.pk, "description": "Xem cấu hình phân hệ", "status": "ACTIVE",
    })
    perm_cfg, _ = Permission.objects.get_or_create(code="SYS.MODULE.CONFIGURE", defaults={
        "id": uuid.uuid4(), "resource_id": res.pk, "action_id": cfg_act.pk, "description": "Bật/ngừng và cấu hình phân hệ", "status": "ACTIVE",
    })

    for role in Role.objects.filter(is_system_admin=True):
        RolePermission.objects.get_or_create(role=role, permission=perm_view, defaults={"effect": "ALLOW"})
        RolePermission.objects.get_or_create(role=role, permission=perm_cfg, defaults={"effect": "ALLOW"})


def unseed(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("common_services", "0008_modulecatalog_companymoduleconfig"),
        ("iam", "0005_seed_uc_md"),
    ]
    operations = [
        migrations.RunPython(seed, unseed),
    ]
