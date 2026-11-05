import datetime
from decimal import Decimal
import uuid
from django.core.management.base import BaseCommand
from django.utils import timezone

from organization.models import Company, Branch
from master_data.models import Currency, Party, Item, UnitOfMeasure
from iam.models import UserAccount
from tax_management.models import (
    TaxInvoice,
    TaxInvoiceLine,
    InvoiceValidationRun,
    InvoiceValidation,
    InvoiceStatusHistory,
    InvoiceDocumentLink,
    ConnectorConfig,
    TaxPeriod,
)
from purchases.models import (
    SupplierRiskConfig,
    SupplierRiskAssessment,
)


class Command(BaseCommand):
    help = "Tạo dữ liệu hóa đơn mẫu phong phú (đầu vào, đầu ra, phát hành, kiểm tra, rủi ro) cho các công ty."

    def handle(self, *args, **options):
        active_companies = Company.objects.all()
        for company in active_companies:
            self._seed_company_invoices(company)

    def _get_or_create_party(self, company: Company, code: str, name: str, tax_code: str) -> Party:
        p = Party.objects.filter(company=company, tax_code=tax_code).first()
        if not p:
            p = Party.objects.filter(company=company, code=code).first()
        if not p:
            p = Party.objects.create(
                company=company,
                code=code,
                name=name,
                tax_code=tax_code,
                party_type="ORGANIZATION",
            )
        return p

    def _seed_company_invoices(self, company: Company):
        # Kiểm tra xem công ty đã có TaxInvoice chưa
        existing_count = TaxInvoice.objects.filter(company=company).count()
        if existing_count > 0:
            self.stdout.write(f"Công ty {company.name} đã có {existing_count} hóa đơn, bỏ qua.")
            return

        branch = Branch.objects.filter(company=company).first()
        if not branch:
            self.stdout.write(f"Bỏ qua {company.name}: chưa có chi nhánh.")
            return

        vnd = Currency.objects.filter(code="VND").first()
        if not vnd:
            self.stdout.write("Bỏ qua: chưa có đơn vị tiền tệ VND.")
            return

        user = UserAccount.objects.first()
        if not user:
            self.stdout.write("Bỏ qua: chưa có tài khoản người dùng.")
            return

        # 1. Tạo ConnectorConfig MeInvoice nếu chưa có
        ConnectorConfig.objects.get_or_create(
            company=company,
            code="MEINVOICE",
            defaults={
                "provider": "MISA meInvoice.VN",
                "channel": "EINVOICE",
                "config": {
                    "tax_code": company.tax_code or "0110888999",
                    "username": "ketoan@soviet.vn",
                    "capabilities": ["INVOICE_SYNC_INPUT", "INVOICE_SYNC_OUTPUT", "INVOICE_ISSUE"],
                    "endpoint_url": "https://www.meinvoice.vn",
                },
                "is_active": True,
            },
        )

        today = datetime.date.today()
        d1 = today - datetime.timedelta(days=25)
        d2 = today - datetime.timedelta(days=18)
        d3 = today - datetime.timedelta(days=10)
        d4 = today - datetime.timedelta(days=5)
        d5 = today - datetime.timedelta(days=2)

        # 2. Tạo Đối tác Nhà cung cấp / Khách hàng nếu chưa có
        supplier_fpt = self._get_or_create_party(company, "NCC-FPT", "Công ty TNHH Công nghệ Viễn thông FPT", "0101248141")
        supplier_misa = self._get_or_create_party(company, "NCC-MISA", "Công ty Cổ phần Phần mềm MISA", "0101243150")
        supplier_tienphat = self._get_or_create_party(company, "NCC-TIENPHAT", "Công ty TNHH Thiết bị Văn phòng Tiến Phát", "0102345678")
        supplier_thanglong = self._get_or_create_party(company, "NCC-THANGLONG", "Công ty Cổ phần Dịch vụ Bảo vệ Thăng Long", "0103456789")
        supplier_hoangha = self._get_or_create_party(company, "NCC-HOANGHA", "Công ty TNHH Xây dựng & Thương mại Hoàng Hà", "0109876543")

        customer_saomai = self._get_or_create_party(company, "KH-SAOMAI", "Công ty Cổ phần Thương mại Sao Mai", "0108889991")
        customer_tanlong = self._get_or_create_party(company, "KH-TANLONG", "Công ty TNHH Tư vấn & Đầu tư Tân Long", "0107776662")
        customer_achau = self._get_or_create_party(company, "KH-ACHAU", "Công ty Cổ phần Logistics Á Châu", "0106665553")
        customer_haiphong = self._get_or_create_party(company, "KH-HAIPHONG", "Công ty TNHH Dịch vụ Vận tải Hải Phòng", "0105554445")

        # 3. Tạo Hóa đơn đầu vào (INPUT)
        # HĐ 1: FPT - Đã kiểm tra & Đã hạch toán / liên kết
        inv_in_1 = TaxInvoice.objects.create(
            company=company,
            branch=branch,
            direction="INPUT",
            invoice_series="1C26TDM",
            invoice_number="00000012",
            invoice_date=d1,
            seller_name=supplier_fpt.name,
            seller_tax_code=supplier_fpt.tax_code,
            buyer_name=company.name,
            buyer_tax_code=company.tax_code or "0110888999",
            party=supplier_fpt,
            currency=vnd,
            exchange_rate=Decimal("1"),
            subtotal=Decimal("2000000000"),
            tax_amount=Decimal("200000000"),
            total_amount=Decimal("2200000000"),
            source="API",
            status="VALIDATED",
            tax_eligible=True,
            validation_summary={"processing_status": "PASSED"},
            created_by=user,
        )
        TaxInvoiceLine.objects.create(
            invoice=inv_in_1,
            line_no=1,
            description="Máy tính xách tay ThinkPad X1 Carbon Gen 12",
            quantity=Decimal("100"),
            unit_price=Decimal("20000000"),
            taxable_amount=Decimal("2000000000"),
            tax_rate=Decimal("10"),
            tax_amount=Decimal("200000000"),
            total_amount=Decimal("2200000000"),
        )
        InvoiceDocumentLink.objects.create(
            company=company,
            invoice=inv_in_1,
            module_code="PURCHASES",
            entity_type="GOODS_PURCHASE",
            entity_id=uuid.uuid4(),
            document_number="MH-2026-0001",
            linked_amount=Decimal("2200000000"),
            allocated_amount_before_tax=Decimal("2000000000"),
            allocated_tax_amount=Decimal("200000000"),
            status="ACTIVE",
            created_by=user,
        )
        self._add_validation_run(inv_in_1, "PASS")

        # HĐ 2: MISA - Đã kiểm tra nhưng chưa liên kết
        inv_in_2 = TaxInvoice.objects.create(
            company=company,
            branch=branch,
            direction="INPUT",
            invoice_series="1C26TDM",
            invoice_number="00000045",
            invoice_date=d2,
            seller_name=supplier_misa.name,
            seller_tax_code=supplier_misa.tax_code,
            buyer_name=company.name,
            buyer_tax_code=company.tax_code or "0110888999",
            party=supplier_misa,
            currency=vnd,
            exchange_rate=Decimal("1"),
            subtotal=Decimal("15000000"),
            tax_amount=Decimal("1500000"),
            total_amount=Decimal("16500000"),
            source="FILE",
            status="VALIDATED",
            tax_eligible=True,
            validation_summary={"processing_status": "PASSED"},
            created_by=user,
        )
        TaxInvoiceLine.objects.create(
            invoice=inv_in_2,
            line_no=1,
            description="Phí thuê bao phần mềm kế toán quản trị doanh nghiệp Sổ Việt ERP",
            quantity=Decimal("1"),
            unit_price=Decimal("15000000"),
            taxable_amount=Decimal("15000000"),
            tax_rate=Decimal("10"),
            tax_amount=Decimal("1500000"),
            total_amount=Decimal("16500000"),
        )
        self._add_validation_run(inv_in_2, "PASS")

        # HĐ 3: Tiến Phát - Văn phòng phẩm chưa hạch toán
        inv_in_3 = TaxInvoice.objects.create(
            company=company,
            branch=branch,
            direction="INPUT",
            invoice_series="1C26TDM",
            invoice_number="00000078",
            invoice_date=d3,
            seller_name=supplier_tienphat.name,
            seller_tax_code=supplier_tienphat.tax_code,
            buyer_name=company.name,
            buyer_tax_code=company.tax_code or "0110888999",
            party=supplier_tienphat,
            currency=vnd,
            exchange_rate=Decimal("1"),
            subtotal=Decimal("4250000"),
            tax_amount=Decimal("340000"),
            total_amount=Decimal("4590000"),
            source="MANUAL",
            status="VALIDATED",
            tax_eligible=True,
            validation_summary={"processing_status": "PASSED"},
            created_by=user,
        )
        TaxInvoiceLine.objects.create(
            invoice=inv_in_3,
            line_no=1,
            description="Giấy in A4 Double A 70gsm & Mực in HP LaserJet",
            quantity=Decimal("50"),
            unit_price=Decimal("85000"),
            taxable_amount=Decimal("4250000"),
            tax_rate=Decimal("8"),
            tax_amount=Decimal("340000"),
            total_amount=Decimal("4590000"),
        )
        self._add_validation_run(inv_in_3, "PASS")

        # HĐ 4: Bảo vệ Thăng Long - Chờ kiểm tra
        inv_in_4 = TaxInvoice.objects.create(
            company=company,
            branch=branch,
            direction="INPUT",
            invoice_series="1C26TDM",
            invoice_number="00000102",
            invoice_date=d4,
            seller_name=supplier_thanglong.name,
            seller_tax_code=supplier_thanglong.tax_code,
            buyer_name=company.name,
            buyer_tax_code=company.tax_code or "0110888999",
            party=supplier_thanglong,
            currency=vnd,
            exchange_rate=Decimal("1"),
            subtotal=Decimal("12000000"),
            tax_amount=Decimal("1200000"),
            total_amount=Decimal("13200000"),
            source="FILE",
            status="RECEIVED",
            tax_eligible=False,
            validation_summary={"processing_status": "PENDING_CHECK"},
            created_by=user,
        )
        TaxInvoiceLine.objects.create(
            invoice=inv_in_4,
            line_no=1,
            description="Dịch vụ bảo vệ an ninh văn phòng tháng 10/2026",
            quantity=Decimal("1"),
            unit_price=Decimal("12000000"),
            taxable_amount=Decimal("12000000"),
            tax_rate=Decimal("10"),
            tax_amount=Decimal("1200000"),
            total_amount=Decimal("13200000"),
        )

        # HĐ 5: Hoàng Hà - Có cảnh báo rủi ro hóa đơn
        inv_in_5 = TaxInvoice.objects.create(
            company=company,
            branch=branch,
            direction="INPUT",
            invoice_series="1C26TDM",
            invoice_number="00000155",
            invoice_date=d5,
            seller_name=supplier_hoangha.name,
            seller_tax_code=supplier_hoangha.tax_code,
            buyer_name=company.name,
            buyer_tax_code=company.tax_code or "0110888999",
            party=supplier_hoangha,
            currency=vnd,
            exchange_rate=Decimal("1"),
            subtotal=Decimal("18000000"),
            tax_amount=Decimal("1800000"),
            total_amount=Decimal("19800000"),
            source="API",
            status="BLOCKED",
            tax_eligible=False,
            validation_summary={"processing_status": "WARNING", "intake_warnings": ["Nhà cung cấp có rủi ro cao về thuế"]},
            created_by=user,
        )
        TaxInvoiceLine.objects.create(
            invoice=inv_in_5,
            line_no=1,
            description="Vật liệu & phụ tùng sửa chữa hệ thống mạng",
            quantity=Decimal("1"),
            unit_price=Decimal("18000000"),
            taxable_amount=Decimal("18000000"),
            tax_rate=Decimal("10"),
            tax_amount=Decimal("1800000"),
            total_amount=Decimal("19800000"),
        )
        self._add_validation_run(inv_in_5, "WARNING", "Nhà cung cấp nằm trong danh sách rủi ro cao về thuế.")

        # 4. Tạo Hóa đơn đầu ra (OUTPUT)
        # HĐ Ra 1: Sao Mai - Đã phát hành (ISSUED)
        TaxInvoice.objects.create(
            company=company,
            branch=branch,
            direction="OUTPUT",
            invoice_series="1C26TDA",
            invoice_number="00000001",
            invoice_date=d1,
            seller_name=company.name,
            seller_tax_code=company.tax_code or "0110888999",
            buyer_name=customer_saomai.name,
            buyer_tax_code=customer_saomai.tax_code,
            party=customer_saomai,
            currency=vnd,
            exchange_rate=Decimal("1"),
            subtotal=Decimal("250000000"),
            tax_amount=Decimal("25000000"),
            total_amount=Decimal("275000000"),
            source="SALES",
            status="ISSUED",
            issued_at=timezone.now() - datetime.timedelta(days=24),
            external_status="SUCCESS",
            external_reference="T26M011088899900000001",
            created_by=user,
        )

        # HĐ Ra 2: Tân Long - Đã phát hành (ISSUED)
        TaxInvoice.objects.create(
            company=company,
            branch=branch,
            direction="OUTPUT",
            invoice_series="1C26TDA",
            invoice_number="00000002",
            invoice_date=d2,
            seller_name=company.name,
            seller_tax_code=company.tax_code or "0110888999",
            buyer_name=customer_tanlong.name,
            buyer_tax_code=customer_tanlong.tax_code,
            party=customer_tanlong,
            currency=vnd,
            exchange_rate=Decimal("1"),
            subtotal=Decimal("80000000"),
            tax_amount=Decimal("8000000"),
            total_amount=Decimal("88000000"),
            source="SALES",
            status="ISSUED",
            issued_at=timezone.now() - datetime.timedelta(days=17),
            external_status="SUCCESS",
            external_reference="T26M011088899900000002",
            created_by=user,
        )

        # HĐ Ra 3: Á Châu - Đang phát hành (ISSUING)
        TaxInvoice.objects.create(
            company=company,
            branch=branch,
            direction="OUTPUT",
            invoice_series="1C26TDA",
            invoice_number="00000003",
            invoice_date=d3,
            seller_name=company.name,
            seller_tax_code=company.tax_code or "0110888999",
            buyer_name=customer_achau.name,
            buyer_tax_code=customer_achau.tax_code,
            party=customer_achau,
            currency=vnd,
            exchange_rate=Decimal("1"),
            subtotal=Decimal("35000000"),
            tax_amount=Decimal("3500000"),
            total_amount=Decimal("38500000"),
            source="SALES",
            status="ISSUING",
            created_by=user,
        )

        # HĐ Ra 4: Hải Phòng - Bị điều chỉnh (ADJUSTED)
        inv_out_4 = TaxInvoice.objects.create(
            company=company,
            branch=branch,
            direction="OUTPUT",
            invoice_series="1C26TDA",
            invoice_number="00000004",
            invoice_date=d4,
            seller_name=company.name,
            seller_tax_code=company.tax_code or "0110888999",
            buyer_name=customer_haiphong.name,
            buyer_tax_code=customer_haiphong.tax_code,
            party=customer_haiphong,
            currency=vnd,
            exchange_rate=Decimal("1"),
            subtotal=Decimal("20000000"),
            tax_amount=Decimal("2000000"),
            total_amount=Decimal("22000000"),
            source="SALES",
            status="ADJUSTED",
            issued_at=timezone.now() - datetime.timedelta(days=4),
            created_by=user,
        )

        # HĐ Ra 5: Hải Phòng - Hóa đơn điều chỉnh thông tin (ADJUSTMENT)
        TaxInvoice.objects.create(
            company=company,
            branch=branch,
            direction="OUTPUT",
            invoice_type="ADJUSTMENT",
            adjustment_effect="INFO",
            original_invoice=inv_out_4,
            invoice_series="1C26TDA",
            invoice_number="00000005",
            invoice_date=d5,
            seller_name=company.name,
            seller_tax_code=company.tax_code or "0110888999",
            buyer_name=customer_haiphong.name,
            buyer_tax_code=customer_haiphong.tax_code,
            party=customer_haiphong,
            currency=vnd,
            exchange_rate=Decimal("1"),
            subtotal=Decimal("0"),
            tax_amount=Decimal("0"),
            total_amount=Decimal("0"),
            source="SALES",
            status="ISSUED",
            issued_at=timezone.now() - datetime.timedelta(days=1),
            created_by=user,
        )

        # HĐ Ra 6: Khách hàng mới - Bản nháp cần xử lý (DRAFT)
        TaxInvoice.objects.create(
            company=company,
            branch=branch,
            direction="OUTPUT",
            invoice_series="1C26TDA",
            invoice_number="",
            invoice_date=today,
            seller_name=company.name,
            seller_tax_code=company.tax_code or "0110888999",
            buyer_name="Công ty TNHH Đầu tư Thương mại Toàn Cầu",
            buyer_tax_code="",
            currency=vnd,
            exchange_rate=Decimal("1"),
            subtotal=Decimal("15000000"),
            tax_amount=Decimal("1500000"),
            total_amount=Decimal("16500000"),
            source="MANUAL",
            status="DRAFT",
            created_by=user,
        )

        # 5. Tạo cấu hình và đánh giá rủi ro nhà cung cấp
        SupplierRiskConfig.objects.get_or_create(
            company=company,
            defaults={
                "low_threshold": 20,
                "medium_threshold": 50,
            },
        )

        SupplierRiskAssessment.objects.create(
            company=company,
            supplier=supplier_hoangha,
            assessment_date=today,
            valid_until=today + datetime.timedelta(days=90),
            risk_level="HIGH",
            score=75,
            tax_status="SUSPENDED_OPERATION",
            tax_code_status_verified=True,
            is_blocked=True,
            criteria_breakdown=[
                {"code": "TAX_STATUS", "name": "Trạng thái mã số thuế", "points": 50, "description": "Tạm ngừng kinh doanh có thời hạn"},
                {"code": "INVOICE_ANOMALY", "name": "Bất thường hóa đơn", "points": 25, "description": "Hóa đơn phát hành trong thời gian tạm ngừng"},
            ],
            notes="Doanh nghiệp tạm ngừng hoạt động từ tháng 08/2026.",
            assessed_by=user,
        )

        SupplierRiskAssessment.objects.create(
            company=company,
            supplier=supplier_fpt,
            assessment_date=today,
            valid_until=today + datetime.timedelta(days=90),
            risk_level="LOW",
            score=5,
            tax_status="NORMAL",
            tax_code_status_verified=True,
            is_blocked=False,
            criteria_breakdown=[
                {"code": "TAX_STATUS", "name": "Trạng thái mã số thuế", "points": 0, "description": "Đang hoạt động bình thường, tuân thủ pháp luật thuế"},
            ],
            notes="Nhà cung cấp uy tín, tuân thủ tốt.",
            assessed_by=user,
        )

        self.stdout.write(f"Đã tạo thành công dữ liệu hóa đơn mẫu cho {company.name} ({company.tax_code}).")

    def _add_validation_run(self, invoice: TaxInvoice, overall: str, message: str = "Hợp lệ theo quy định"):
        user = invoice.created_by
        run = InvoiceValidationRun.objects.create(
            invoice=invoice,
            overall_status=overall,
            rule_set_version="TT78_2026",
            source_fingerprint="fp_demo",
            trigger_type="MANUAL",
            run_status="COMPLETED",
            completed_at=timezone.now(),
            triggered_by=user,
        )
        InvoiceValidation.objects.create(
            invoice=invoice,
            run=run,
            code="DIGITAL_SIGNATURE",
            severity="ERROR",
            result="PASS",
            message="Chữ ký số bên bán hợp lệ và còn hiệu lực.",
            source="MEINVOICE",
        )
        InvoiceValidation.objects.create(
            invoice=invoice,
            run=run,
            code="SELLER_TAX_CODE",
            severity="WARNING" if overall == "WARNING" else "INFO",
            result="WARNING" if overall == "WARNING" else "PASS",
            message=message,
            source="TCT",
        )
