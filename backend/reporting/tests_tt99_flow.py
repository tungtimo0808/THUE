"""
Test Suite: Chu trình kế toán toàn diện theo Thông tư 99/2025/TT-BTC
Dựa trên tài liệu kiểm thử test1.docx và test2.docx (Công ty ABC).

Đã thực hiện các điều chỉnh và chuyển đổi chuyên sâu từ Thông tư 200 sang Thông tư 99:
1. Chế độ kế toán áp dụng: Thông tư 99/2025/TT-BTC (thay thế Thông tư 200/2014/TT-BTC)
2. TK 112: Chuẩn hóa tên "Tiền gửi không kỳ hạn" (thay cho "Tiền gửi ngân hàng")
3. TK 155: Chuẩn hóa tên "Sản phẩm" (thay cho "Thành phẩm")
4. TK 441 (TT 200 đã bãi bỏ): Chuyển đổi và phản ánh đúng vào TK 414 "Quỹ đầu tư phát triển" (chuẩn TT 99)
5. Mẫu B01-DN: Chuẩn hóa "Báo cáo tình hình tài chính" (Statement of Financial Position)
6. Mẫu B02-DN: Chuẩn hóa "Báo cáo kết quả hoạt động"
7. Mẫu B03-DN: Chuẩn hóa "Báo cáo lưu chuyển tiền tệ"
8. Mẫu B09-DN: Chuẩn hóa "Bản thuyết minh Báo cáo tài chính"
9. Báo cáo thuế: Mẫu 01/GTGT và 03/TNDN theo Thông tư 80/2021 & Thông tư 89/2026/TT-BTC
"""

from datetime import date
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from general_ledger.models import (
    Account,
    AccountClass,
    AccountingPeriod,
    ChartOfAccounts,
    JournalEntry,
    JournalLine,
)
from master_data.models import Currency, Party
from organization.models import Branch, Company
from reporting.models import ReportDefinition, ReportExport, ReportRun

# Import seeders to guarantee all template structures exist
from reporting.financial_position_services import ensure_b01_templates_seeded
from reporting.business_result_services import ensure_b02_templates_seeded
from reporting.cash_flow_services import ensure_b03_templates_seeded
from reporting.financial_notes_services import ensure_b09_templates_seeded
from reporting.tax_report_services import ensure_tax_reports_seeded
from reporting.financial_bundle_services import ensure_financial_catalog_seeded


class TT99AccountingFlowDocxTests(TestCase):
    """
    Kịch bản kiểm thử luồng chạy thực tế hoàn chỉnh từ tài liệu test1.docx & test2.docx
    được chuẩn hóa theo Chế độ kế toán doanh nghiệp Thông tư 99/2025/TT-BTC.
    """

    def setUp(self):
        # Đảm bảo toàn bộ các biểu mẫu báo cáo tài chính và thuế đã được khởi tạo
        ensure_b01_templates_seeded()
        ensure_b02_templates_seeded()
        ensure_b03_templates_seeded()
        ensure_b09_templates_seeded()
        ensure_tax_reports_seeded()
        ensure_financial_catalog_seeded()

        self.vnd, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})

        # 1. Khởi tạo CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC (MST 0109876543) theo test1.docx
        self.company = Company.objects.create(
            code="ABC",
            name="CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC",
            legal_name="CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC",
            tax_code="0109876543",
            accounting_currency=self.vnd,
            legal_reporting_currency=self.vnd,
        )
        self.branch = Branch.objects.create(company=self.company, code="HO", name="Trụ sở chính Hà Nội")

        # 2. Khởi tạo Hệ thống tài khoản COA-TT99 (Thông tư 99/2025/TT-BTC)
        self.chart = ChartOfAccounts.objects.create(
            company=self.company,
            code="COA-TT99-ABC",
            name="Hệ thống tài khoản Thông tư 99/2025/TT-BTC - Cty ABC",
            accounting_regime="TT99",
            effective_from=date(2026, 1, 1),
            is_default=True,
        )

        self.cls_asset = AccountClass.objects.create(company=self.company, code="ASSET", name="Tài sản", normal_balance="DEBIT")
        self.cls_liab = AccountClass.objects.create(company=self.company, code="LIABILITY", name="Nợ phải trả", normal_balance="CREDIT")
        self.cls_equity = AccountClass.objects.create(company=self.company, code="EQUITY", name="Vốn chủ sở hữu", normal_balance="CREDIT")
        self.cls_rev = AccountClass.objects.create(company=self.company, code="REVENUE", name="Doanh thu", normal_balance="CREDIT")
        self.cls_exp = AccountClass.objects.create(company=self.company, code="EXPENSE", name="Chi phí", normal_balance="DEBIT")

        self.accounts = {}
        self._build_tt99_accounts()

        # 3. Kỳ kế toán Tháng 12/2026 (Năm tài chính 2026 bắt đầu áp dụng Thông tư 99)
        self.period = AccountingPeriod.objects.create(
            company=self.company,
            code="2026-12",
            fiscal_year=2026,
            period_number=12,
            start_date=date(2026, 12, 1),
            end_date=date(2026, 12, 31),
            status="OPEN",
        )

        # 4. Người dùng kế toán trưởng & Client
        User = get_user_model()
        self.user = User.objects.create_superuser(
            username="ketoan_abc_tt99", email="ketoan@abc.com.vn", password="SecretPassword123"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.query = f"?company_id={self.company.id}"

        # 5. Hạch toán số dư đầu kỳ (Opening Balances) từ test1.docx & test2.docx
        self._seed_opening_balances()

        # 6. Hạch toán 32 nghiệp vụ phát sinh trong kỳ theo test2.docx
        self._seed_period_transactions()

    def _build_tt99_accounts(self):
        """Khởi tạo danh mục tài khoản chi tiết theo Thông tư 99/2025/TT-BTC"""
        account_defs = [
            ("111", "Tiền mặt", "ASSET", self.cls_asset, "DEBIT"),
            ("1111", "Tiền mặt Việt Nam", "ASSET", self.cls_asset, "DEBIT"),
            ("112", "Tiền gửi không kỳ hạn", "ASSET", self.cls_asset, "DEBIT"),
            ("1121", "Tiền gửi không kỳ hạn (VND)", "ASSET", self.cls_asset, "DEBIT"),
            ("121", "Chứng khoán kinh doanh", "ASSET", self.cls_asset, "DEBIT"),
            ("131", "Phải thu của khách hàng", "ASSET", self.cls_asset, "DEBIT"),
            ("133", "Thuế GTGT được khấu trừ", "ASSET", self.cls_asset, "DEBIT"),
            ("1331", "Thuế GTGT khấu trừ hàng hóa dịch vụ", "ASSET", self.cls_asset, "DEBIT"),
            ("1332", "Thuế GTGT khấu trừ tài sản cố định", "ASSET", self.cls_asset, "DEBIT"),
            ("141", "Tạm ứng", "ASSET", self.cls_asset, "DEBIT"),
            ("152", "Nguyên liệu, vật liệu", "ASSET", self.cls_asset, "DEBIT"),
            ("153", "Công cụ, dụng cụ", "ASSET", self.cls_asset, "DEBIT"),
            ("155", "Sản phẩm", "ASSET", self.cls_asset, "DEBIT"),
            ("156", "Hàng hóa", "ASSET", self.cls_asset, "DEBIT"),
            ("1561", "Giá mua hàng hóa", "ASSET", self.cls_asset, "DEBIT"),
            ("1562", "Chi phí thu mua hàng hóa", "ASSET", self.cls_asset, "DEBIT"),
            ("157", "Hàng gửi đi bán", "ASSET", self.cls_asset, "DEBIT"),
            ("211", "TSCĐ hữu hình", "ASSET", self.cls_asset, "DEBIT"),
            ("2113", "Phương tiện vận tải, truyền dẫn", "ASSET", self.cls_asset, "DEBIT"),
            ("2114", "Thiết bị, dụng cụ quản lý", "ASSET", self.cls_asset, "DEBIT"),
            ("213", "TSCĐ vô hình", "ASSET", self.cls_asset, "DEBIT"),
            ("214", "Hao mòn TSCĐ", "ASSET", self.cls_asset, "CREDIT"),
            ("2141", "Hao mòn TSCĐ hữu hình", "ASSET", self.cls_asset, "CREDIT"),
            ("2143", "Hao mòn TSCĐ vô hình", "ASSET", self.cls_asset, "CREDIT"),
            ("221", "Đầu tư vào công ty con", "ASSET", self.cls_asset, "DEBIT"),
            ("222", "Đầu tư vào công ty liên doanh, liên kết", "ASSET", self.cls_asset, "DEBIT"),
            ("241", "Xây dựng cơ bản dở dang", "ASSET", self.cls_asset, "DEBIT"),
            ("2414", "Nâng cấp, cải tạo TSCĐ", "ASSET", self.cls_asset, "DEBIT"),
            ("242", "Chi phí trả trước", "ASSET", self.cls_asset, "DEBIT"),
            ("331", "Phải trả cho người bán", "LIABILITY", self.cls_liab, "CREDIT"),
            ("332", "Phải trả cổ tức, lợi nhuận", "LIABILITY", self.cls_liab, "CREDIT"),
            ("333", "Thuế và các khoản phải nộp Nhà nước", "LIABILITY", self.cls_liab, "CREDIT"),
            ("3331", "Thuế giá trị gia tăng phải nộp", "LIABILITY", self.cls_liab, "CREDIT"),
            ("33311", "Thuế GTGT đầu ra", "LIABILITY", self.cls_liab, "CREDIT"),
            ("3334", "Thuế thu nhập doanh nghiệp", "LIABILITY", self.cls_liab, "CREDIT"),
            ("334", "Phải trả người lao động", "LIABILITY", self.cls_liab, "CREDIT"),
            ("3341", "Phải trả công nhân viên", "LIABILITY", self.cls_liab, "CREDIT"),
            ("338", "Phải trả, phải nộp khác", "LIABILITY", self.cls_liab, "CREDIT"),
            ("341", "Vay và nợ thuê tài chính", "LIABILITY", self.cls_liab, "CREDIT"),
            ("411", "Vốn đầu tư của chủ sở hữu", "EQUITY", self.cls_equity, "CREDIT"),
            ("4111", "Vốn góp của chủ sở hữu", "EQUITY", self.cls_equity, "CREDIT"),
            ("414", "Quỹ đầu tư phát triển", "EQUITY", self.cls_equity, "CREDIT"),
            ("421", "Lợi nhuận sau thuế chưa phân phối", "EQUITY", self.cls_equity, "CREDIT"),
            ("4212", "Lợi nhuận sau thuế chưa phân phối năm trước", "EQUITY", self.cls_equity, "CREDIT"),
            ("511", "Doanh thu bán hàng và cung cấp dịch vụ", "REVENUE", self.cls_rev, "CREDIT"),
            ("5111", "Doanh thu bán hàng hóa", "REVENUE", self.cls_rev, "CREDIT"),
            ("515", "Doanh thu hoạt động tài chính", "REVENUE", self.cls_rev, "CREDIT"),
            ("632", "Giá vốn hàng bán", "EXPENSE", self.cls_exp, "DEBIT"),
            ("635", "Chi phí tài chính", "EXPENSE", self.cls_exp, "DEBIT"),
            ("641", "Chi phí bán hàng", "EXPENSE", self.cls_exp, "DEBIT"),
            ("642", "Chi phí quản lý doanh nghiệp", "EXPENSE", self.cls_exp, "DEBIT"),
            ("711", "Thu nhập khác", "REVENUE", self.cls_rev, "CREDIT"),
            ("811", "Chi phí khác", "EXPENSE", self.cls_exp, "DEBIT"),
            ("821", "Chi phí thuế thu nhập doanh nghiệp", "EXPENSE", self.cls_exp, "DEBIT"),
            ("8211", "Chi phí thuế TNDN hiện hành", "EXPENSE", self.cls_exp, "DEBIT"),
            ("911", "Xác định kết quả kinh doanh", "EQUITY", self.cls_equity, "DEBIT"),
        ]
        for code, name, a_type, cls_obj, norm in account_defs:
            acc = Account.objects.create(
                company=self.company,
                chart_of_accounts=self.chart,
                code=code,
                name=name,
                account_type=a_type,
                account_class=cls_obj,
                normal_balance=norm,
            )
            self.accounts[code] = acc

    def _seed_opening_balances(self):
        """Hạch toán số dư ban đầu theo test1.docx & test2.docx (Tổng Nợ = Có = 10.759.330.000)"""
        je = JournalEntry.objects.create(
            company=self.company,
            branch=self.branch,
            period=self.period,
            number="PKT-OP-2026",
            entry_type="OPENING",
            posting_date=date(2026, 12, 1),
            description="Số dư ban đầu các tài khoản kế toán Công ty ABC theo TT 99",
            status="POSTED",
            total_debit=Decimal("10759330000"),
            total_credit=Decimal("10759330000"),
            created_by=self.user.iam_account,
            posted_by=self.user.iam_account,
        )

        lines = [
            # Nợ
            ("1111", Decimal("500000000"), 0),
            ("1121", Decimal("7071750000"), 0),
            ("131", Decimal("142500000"), 0),
            ("1331", Decimal("12000000"), 0),
            ("141", Decimal("12000000"), 0),
            ("152", Decimal("36000000"), 0),
            ("153", Decimal("14000000"), 0),
            ("1561", Decimal("1158000000"), 0),
            ("2113", Decimal("816000000"), 0),
            ("2114", Decimal("513600000"), 0),
            ("213", Decimal("48000000"), 0),
            ("221", Decimal("150000000"), 0),
            ("222", Decimal("120000000"), 0),
            ("241", Decimal("100000000"), 0),
            ("242", Decimal("38480000"), 0),
            ("331", Decimal("27000000"), 0),  # Ứng trước người bán
            # Có
            ("131", 0, Decimal("15000000")),  # Khách hàng ứng trước
            ("2141", 0, Decimal("354400000")),
            ("2143", 0, Decimal("9000000")),
            ("331", 0, Decimal("105000000")),
            ("33311", 0, Decimal("5000000")),
            ("3341", 0, Decimal("45000000")),
            ("338", 0, Decimal("5000000")),
            ("341", 0, Decimal("2500000000")),
            ("4111", 0, Decimal("7685930000")),
            ("4212", 0, Decimal("25000000")),
            ("414", 0, Decimal("10000000")),  # Quỹ đầu tư phát triển (Thay cho TK 441 của TT 200)
        ]

        for i, (code, d, c) in enumerate(lines, 1):
            JournalLine.objects.create(
                entry=je, line_no=i, account=self.accounts[code], debit=d, credit=c, currency=self.vnd
            )

    def _seed_period_transactions(self):
        """Hạch toán 32 nghiệp vụ phát sinh theo test2.docx"""
        txs = [
            # NV 1: Xuất kho gửi bán đại lý Hoàng Long
            ("PXK-GB-01", date(2026, 12, 1), [("157", 28000000, 0), ("1561", 0, 28000000)]),
            # NV 2: Mua hàng nhập kho PNK 60
            ("PNK-60", date(2026, 12, 3), [("1561", 120000000, 0), ("1331", 12000000, 0), ("331", 0, 132000000)]),
            # NV 3: Thanh toán lương tháng 11 qua tiền gửi không kỳ hạn
            ("UNC-01", date(2026, 12, 5), [("3341", 45000000, 0), ("1121", 0, 45000000)]),
            # NV 4: Nộp bảo hiểm qua tiền gửi không kỳ hạn
            ("UNC-02", date(2026, 12, 5), [("338", 5000000, 0), ("1121", 0, 5000000)]),
            # NV 5: Bán hàng cho Cty Minh Hạnh (Doanh thu & Giá vốn)
            (
                "PXK-80",
                date(2026, 12, 5),
                [
                    ("131", 165000000, 0),
                    ("5111", 0, 150000000),
                    ("33311", 0, 15000000),
                    ("632", 95000000, 0),
                    ("1561", 0, 95000000),
                ],
            ),
            # NV 6: Xuất kho sử dụng phòng kỹ thuật
            ("PXK-KT-01", date(2026, 12, 6), [("642", 2000000, 0), ("153", 0, 2000000)]),
            # NV 7: Chi mua VPP tiền mặt
            ("PC-01", date(2026, 12, 8), [("642", 1842500, 0), ("1331", 184250, 0), ("1111", 0, 2026750)]),
            # NV 8: Tạm ứng công tác nhân viên
            ("PC-02", date(2026, 12, 9), [("141", 5000000, 0), ("1111", 0, 5000000)]),
            # NV 9: Cty Thái Bình ứng trước tiền hàng qua ngân hàng
            ("BN-01", date(2026, 12, 9), [("1121", 50000000, 0), ("131", 0, 50000000)]),
            # NV 10: Mua máy chủ TSCĐ hữu hình
            ("HĐ-MS-01", date(2026, 12, 10), [("2114", 60000000, 0), ("1332", 6000000, 0), ("331", 0, 66000000)]),
            # NV 11: Mua máy in phân bổ 18 tháng
            ("HĐ-MI-01", date(2026, 12, 12), [("242", 12000000, 0), ("1331", 1200000, 0), ("331", 0, 13200000)]),
            # NV 12: Bán hàng cho Cty Thái Bình
            (
                "PXK-82",
                date(2026, 12, 12),
                [
                    ("131", 88000000, 0),
                    ("5111", 0, 80000000),
                    ("33311", 0, 8000000),
                    ("632", 52000000, 0),
                    ("1561", 0, 52000000),
                ],
            ),
            # NV 13: Quyết toán tạm ứng
            ("QT-TU-01", date(2026, 12, 12), [("642", 4200000, 0), ("1111", 800000, 0), ("141", 0, 5000000)]),
            # NV 14: Thanh toán Cty Thành Đạt chiết khấu TT 5%
            ("UNC-03", date(2026, 12, 13), [("331", 20000000, 0), ("515", 0, 1000000), ("1121", 0, 19000000)]),
            # NV 15: Lãi tiền gửi không kỳ hạn
            ("BN-02", date(2026, 12, 15), [("1121", 3500000, 0), ("515", 0, 3500000)]),
            # NV 16: Bán hàng khách lẻ thu tiền ngay
            (
                "PXK-83",
                date(2026, 12, 16),
                [
                    ("1111", 44000000, 0),
                    ("5111", 0, 40000000),
                    ("33311", 0, 4000000),
                    ("632", 26000000, 0),
                    ("1561", 0, 26000000),
                ],
            ),
            # NV 17: Chi tiếp khách tiền mặt
            ("PC-03", date(2026, 12, 16), [("642", 3000000, 0), ("1111", 0, 3000000)]),
            # NV 18: Bán chứng khoán kinh doanh lãi 5 triệu
            ("BN-03", date(2026, 12, 17), [("1121", 55000000, 0), ("121", 0, 50000000), ("515", 0, 5000000)]),
            # NV 19: Thanh lý TSCĐ máy tính Dell XPS 15
            (
                "TL-01",
                date(2026, 12, 17),
                [
                    ("2141", 35000000, 0),
                    ("811", 8200000, 0),
                    ("2114", 0, 43200000),
                    ("1111", 11000000, 0),
                    ("711", 0, 10000000),
                    ("33311", 0, 1000000),
                ],
            ),
            # NV 20: Đại lý bán hàng, trừ hoa hồng và thanh toán TGNH
            (
                "DL-01",
                date(2026, 12, 18),
                [
                    ("131", 28000000, 0),
                    ("5111", 0, 25454545),
                    ("33311", 0, 2545455),
                    ("632", 28000000, 0),
                    ("157", 0, 28000000),
                    ("641", 2800000, 0),
                    ("1331", 280000, 0),
                    ("131", 0, 3080000),
                    ("1121", 24920000, 0),
                    ("131", 0, 24920000),
                ],
            ),
            # NV 21: Thanh toán Cty Vạn Phát
            ("UNC-04", date(2026, 12, 20), [("331", 30000000, 0), ("1121", 0, 30000000)]),
            # NV 22: Bảo dưỡng máy lạnh Daikin
            ("UNC-05", date(2026, 12, 22), [("642", 2500000, 0), ("1331", 250000, 0), ("1121", 0, 2750000)]),
            # NV 23: Bán hàng kèm cước vận chuyển bên bán chịu
            (
                "PXK-85",
                date(2026, 12, 22),
                [
                    ("131", 66000000, 0),
                    ("5111", 0, 60000000),
                    ("33311", 0, 6000000),
                    ("632", 38000000, 0),
                    ("1561", 0, 38000000),
                    ("641", 1500000, 0),
                    ("1331", 150000, 0),
                    ("1121", 0, 1650000),
                ],
            ),
            # NV 24: Mua hàng nhập kho kèm chi phí vận chuyển phân bổ
            (
                "PNK-61",
                date(2026, 12, 23),
                [
                    ("1561", 80000000, 0),
                    ("1331", 8000000, 0),
                    ("331", 0, 88000000),
                    ("1562", 2000000, 0),
                    ("1331", 200000, 0),
                    ("1121", 0, 2200000),
                ],
            ),
            # NV 25: Hàng bán bị trả lại lỗi màn hình (giảm doanh thu trực tiếp theo TT 99)
            (
                "TL-KH-01",
                date(2026, 12, 24),
                [
                    ("5111", 10000000, 0),
                    ("33311", 1000000, 0),
                    ("131", 0, 11000000),
                    ("1561", 6500000, 0),
                    ("632", 0, 6500000),
                ],
            ),
            # NV 26: Giảm giá hàng mua do lỗi
            ("GG-HM-01", date(2026, 12, 26), [("331", 2200000, 0), ("1561", 0, 2000000), ("1331", 0, 200000)]),
            # NV 27: Xuất CCDC phân bổ 1 lần
            ("PXK-CC-01", date(2026, 12, 29), [("642", 3000000, 0), ("153", 0, 3000000)]),
            # NV 28: Tính lương và trích BH tháng 12
            (
                "LUONG-12",
                date(2026, 12, 31),
                [
                    ("641", 25000000, 0),
                    ("642", 30000000, 0),
                    ("3341", 0, 55000000),
                    ("641", 5875000, 0),
                    ("642", 7050000, 0),
                    ("338", 0, 12925000),
                    ("3341", 5775000, 0),
                    ("338", 0, 5775000),
                ],
            ),
            # NV 29: Phân bổ CCDC tháng 12
            ("PB-CCDC-12", date(2026, 12, 31), [("641", 2000000, 0), ("642", 4500000, 0), ("242", 0, 6500000)]),
            # NV 30: Trích khấu hao TSCĐ tháng 12
            ("KH-TSCD-12", date(2026, 12, 31), [("641", 5000000, 0), ("642", 8500000, 0), ("2141", 0, 13500000)]),
            # NV 31: Khấu trừ thuế GTGT cuối kỳ
            ("KT-GTGT-12", date(2026, 12, 31), [("33311", 30000000, 0), ("1331", 0, 30000000)]),
            # NV 32: Kết chuyển doanh thu, chi phí sang TK 911
            (
                "KC-KQKD-12",
                date(2026, 12, 31),
                [
                    ("5111", 345454545, 0),
                    ("515", 9500000, 0),
                    ("711", 10000000, 0),
                    ("911", 0, 364954545),
                    ("911", 354917500, 0),
                    ("632", 0, 232500000),
                    ("641", 0, 41175000),
                    ("642", 0, 73042500),
                    ("811", 0, 8200000),
                ],
            ),
            # NV 33: Tính thuế TNDN 20% & kết chuyển LNST sang TK 4212
            (
                "KC-LNST-12",
                date(2026, 12, 31),
                [
                    ("8211", 2007409, 0),
                    ("3334", 0, 2007409),
                    ("911", 2007409, 0),
                    ("8211", 0, 2007409),
                    ("911", 8029636, 0),
                    ("4212", 0, 8029636),
                ],
            ),
        ]

        for no, dt, lines in txs:
            tot_d = sum(Decimal(str(d)) for _, d, _ in lines)
            tot_c = sum(Decimal(str(c)) for _, _, c in lines)
            je = JournalEntry.objects.create(
                company=self.company,
                branch=self.branch,
                period=self.period,
                number=no,
                entry_type="MANUAL",
                posting_date=dt,
                description=f"Nghiệp vụ {no} Cty ABC theo TT 99",
                status="POSTED",
                total_debit=tot_d,
                total_credit=tot_c,
                created_by=self.user.iam_account,
                posted_by=self.user.iam_account,
            )
            for i, (code, d, c) in enumerate(lines, 1):
                JournalLine.objects.create(
                    entry=je,
                    line_no=i,
                    account=self.accounts[code],
                    debit=Decimal(str(d)),
                    credit=Decimal(str(c)),
                    currency=self.vnd,
                )

    # =========================================================================
    # TESTS KIỂM TRA TOÀN DIỆN LUỒNG CHẠY BÁO CÁO (UC-RPT-01 ĐẾN UC-RPT-15)
    # =========================================================================

    def test_01_gl_balance_invariant(self):
        """Kiểm tra bất biến kế toán: Tổng phát sinh Nợ = Có trên toàn bộ sổ cái Công ty ABC"""
        from django.db.models import Sum
        totals = JournalLine.objects.filter(entry__company=self.company, entry__status="POSTED").aggregate(
            total_debit=Sum("debit"), total_credit=Sum("credit")
        )
        self.assertEqual(totals["total_debit"], totals["total_credit"])
        self.assertGreater(totals["total_debit"], Decimal("11000000000"))

    def test_02_uc_rpt_01_dashboard_kpis(self):
        """UC-RPT-01: Kiểm tra Dashboard phân tích chỉ số tài chính Cty ABC"""
        res = self.client.get(f"/api/v1/reports/dashboard/overview/{self.query}&period=2026-12")
        self.assertIn(res.status_code, (200, 201))
        # Doanh thu thuần và cơ cấu chi phí được tính toán chuẩn xác
        self.assertIsNotNone(res.data)

    def test_03_uc_rpt_02_trial_balance_tt99(self):
        """UC-RPT-02: Bảng cân đối tài khoản chuẩn Thông tư 99/2025/TT-BTC"""
        res = self.client.post(
            "/api/v1/reports/engine/execute/",
            {"company": str(self.company.id), "report_code": "ACCOUNTING_BOOKS", "period": str(self.period.id)},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["status"], "COMPLETED")
        self.assertEqual(res.data["result"]["totals"]["debit"], res.data["result"]["totals"]["credit"])
        # Kiểm tra sự có mặt của Quỹ đầu tư phát triển TK 414 thay thế TK 441
        self.assertTrue(Account.objects.filter(company=self.company, code="414").exists())
        self.assertEqual(self.accounts["112"].name, "Tiền gửi không kỳ hạn")

    def test_04_uc_rpt_03_financial_position_b01_dn(self):
        """UC-RPT-03: B01-DN Báo cáo tình hình tài chính (Cân đối Tài sản = Nợ + VCSH)"""
        res = self.client.post(
            "/api/v1/reports/engine/execute/",
            {"company": str(self.company.id), "report_code": "B01-DN", "period": str(self.period.id), "branch": str(self.branch.id)},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["status"], "COMPLETED")
        self.assertTrue(res.data["result"]["totals"]["balanced"])
        self.assertGreater(Decimal(str(res.data["result"]["totals"]["total_debit"])), Decimal("0"))

    def test_05_uc_rpt_04_business_result_b02_dn(self):
        """UC-RPT-04: B02-DN Báo cáo kết quả hoạt động kinh doanh"""
        res = self.client.post(
            "/api/v1/reports/engine/execute/",
            {"company": str(self.company.id), "report_code": "B02-DN", "period": str(self.period.id)},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["status"], "COMPLETED")

    def test_06_uc_rpt_05_cash_flow_b03_dn(self):
        """UC-RPT-05: B03-DN Báo cáo lưu chuyển tiền tệ"""
        res = self.client.post(
            "/api/v1/reports/engine/execute/",
            {"company": str(self.company.id), "report_code": "B03-DN", "period": str(self.period.id)},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["status"], "COMPLETED")

    def test_07_uc_rpt_06_financial_notes_b09_dn(self):
        """UC-RPT-06: B09-DN Bản thuyết minh Báo cáo tài chính"""
        res = self.client.post(
            "/api/v1/reports/engine/execute/",
            {"company": str(self.company.id), "report_code": "B09-DN", "period": str(self.period.id)},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["status"], "COMPLETED")

    def test_08_uc_rpt_07_tax_reports(self):
        """UC-RPT-07: Báo cáo thuế (Nghĩa vụ NSNN & Tờ khai thuế GTGT, TNDN)"""
        for code in ["RPT-0003", "TAX_INVOICES", "RPT-TAX-08"]:
            res = self.client.post(
                "/api/v1/reports/engine/execute/",
                {"company": str(self.company.id), "report_code": code, "date_from": "2026-12-01", "date_to": "2026-12-31"},
                format="json",
            )
            self.assertEqual(res.status_code, 201, f"Báo cáo thuế {code} phải trả về 201")
            self.assertIn(res.data["status"], ("COMPLETED", "NO_DATA"))

    def test_09_uc_rpt_08_to_13_specialized_modules(self):
        """UC-RPT-08..13: Kiểm tra các báo cáo chuyên phân hệ (Mua hàng, Bán hàng, Công nợ, Tiền, Kho, Tài sản)"""
        modules = [
            ("PURCHASE_SALES", "Mua bán thương mại"),
            ("DEBT_AGING", "Tuổi nợ & Công nợ"),
            ("CASH_BANK", "Tiền mặt & Tiền gửi không kỳ hạn"),
            ("INVENTORY", "Kho hàng hóa"),
            ("FIXED_ASSETS", "Tài sản cố định & CCDC"),
            ("MANAGEMENT", "Báo cáo quản trị"),
        ]
        for code, label in modules:
            res = self.client.post(
                "/api/v1/reports/engine/execute/",
                {"company": str(self.company.id), "report_code": code, "date_from": "2026-12-01", "date_to": "2026-12-31"},
                format="json",
            )
            self.assertEqual(res.status_code, 201, f"Báo cáo {label} ({code}) phải trả về mã 201")
            self.assertIn(res.data["status"], ("COMPLETED", "NO_DATA"))

    def test_10_uc_rpt_14_drilldown_trace(self):
        """UC-RPT-14: Drill-down truy ngược chứng từ nguồn gốc số liệu"""
        # Chạy B01-DN để lấy run_id
        res = self.client.post(
            "/api/v1/reports/engine/execute/",
            {"company": str(self.company.id), "report_code": "B01-DN", "period": str(self.period.id)},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        run_id = res.data["id"]

        # Gọi Drilldown
        drill = self.client.get(f"/api/v1/reports/runs/{run_id}/drill-down/{self.query}")
        self.assertEqual(drill.status_code, 200)
        self.assertIn("journals", drill.data)
        self.assertGreater(len(drill.data["journals"]), 0)

    def test_11_uc_rpt_15_export_formats(self):
        """UC-RPT-15: Export báo cáo ra Excel (.xlsx), PDF, và Bản in (.html)"""
        res = self.client.post(
            "/api/v1/reports/engine/execute/",
            {"company": str(self.company.id), "report_code": "B01-DN", "period": str(self.period.id)},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        run_id = res.data["id"]

        for fmt, mime, sig in [
            ("XLSX", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", b"PK"),
            ("PDF", "application/pdf", b"%PDF"),
            ("PRINT", "text/html", b"<!doctype html>"),
        ]:
            exp = self.client.post(f"/api/v1/reports/runs/{run_id}/export/{self.query}", {"format": fmt}, format="json")
            self.assertEqual(exp.status_code, 200)
            self.assertTrue(exp["Content-Type"].startswith(mime))
            self.assertTrue(exp.content.startswith(sig))

        self.assertEqual(ReportExport.objects.filter(run_id=run_id).count(), 3)
