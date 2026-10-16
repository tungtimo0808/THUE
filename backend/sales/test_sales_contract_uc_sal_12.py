import uuid
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from iam.models import CompanyMembership, Permission, Role, RolePermission, UserRoleAssignment
from master_data.models import Currency, Item, ItemCategory, Party, PartyContact, TaxRate, UnitOfMeasure
from organization.models import Branch, Company, Department, Employee, Position
from sales import models, contract_services


class SalesContractUcSal12Tests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.unauth_client = APIClient()

        self.today = timezone.localdate()
        self.currency, _ = Currency.objects.get_or_create(
            code="VND", defaults={"name": "Việt Nam Đồng", "is_active": True}
        )
        self.usd, _ = Currency.objects.get_or_create(
            code="USD", defaults={"name": "Đô la Mỹ", "is_active": True}
        )

        # 1. Doanh nghiệp & Chi nhánh
        self.company = Company.objects.create(
            code="CTY_CTR",
            name="Công Ty Hợp Đồng Bán Hàng",
            tax_code="0109998888",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
            status="ACTIVE",
        )
        self.other_company = Company.objects.create(
            code="CTY_OTHER",
            name="Công Ty Khác",
            tax_code="0109990000",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
            status="ACTIVE",
        )
        self.branch = Branch.objects.create(
            company=self.company,
            code="CN_CTR",
            name="Chi Nhánh Hà Nội",
        )

        # 2. Người dùng & Quyền hạn
        auth_user = get_user_model().objects.create_user(username="contract-mgr-usr", password="password")
        self.user_account = auth_user.iam_account
        self.membership = CompanyMembership.objects.create(
            company=self.company, user=self.user_account, created_by=self.user_account
        )

        auth_unauth = get_user_model().objects.create_user(username="contract-guest-usr", password="password")
        self.unauth_user = auth_unauth.iam_account
        self.unauth_membership = CompanyMembership.objects.create(
            company=self.company, user=self.unauth_user, created_by=self.unauth_user
        )

        self.role = Role.objects.create(
            company=self.company,
            code="ROLE_SAL_CONTRACT",
            name="Quản trị hợp đồng bán hàng",
            status="ACTIVE",
        )
        UserRoleAssignment.objects.create(
            company_membership=self.membership, role=self.role, assigned_by=self.user_account
        )

        self.guest_role = Role.objects.create(company=self.company, code="ROLE_GUEST", name="Khách")
        UserRoleAssignment.objects.create(
            company_membership=self.unauth_membership, role=self.guest_role, assigned_by=self.unauth_user
        )

        for perm_code in [
            "SAL.CONTRACT.VIEW", "SAL.CONTRACT.CREATE", "SAL.CONTRACT.EDIT",
            "SAL.CONTRACT.SUBMIT", "SAL.CONTRACT.APPROVE", "SAL.CONTRACT.REJECT",
            "SAL.CONTRACT.EXTEND", "SAL.CONTRACT.TERMINATE", "SAL.CONTRACT.SIGN",
            "SAL.CONTRACT.ANNEX", "SAL.CONTRACT.LIQUIDATE", "SAL.CONTRACT.CANCEL",
            "SAL.ORDER.VIEW", "SAL.ORDER.CREATE",
        ]:
            perm = Permission.objects.filter(code=perm_code).first()
            if perm:
                RolePermission.objects.get_or_create(role=self.role, permission=perm, defaults={"effect": "ALLOW"})

        self.client.force_authenticate(user=auth_user)
        self.unauth_client.force_authenticate(user=auth_unauth)

        # 3. Nhân viên & chức vụ
        self.dept = Department.objects.create(company=self.company, branch=self.branch, code="PB_SAL", name="Phòng Bán Hàng")
        self.pos_director = Position.objects.create(company=self.company, code="GDKD", name="Giám đốc kinh doanh")
        self.pos_staff = Position.objects.create(company=self.company, code="NVKD", name="Nhân viên kinh doanh")

        self.signer_emp = Employee.objects.create(
            company=self.company,
            department=self.dept,
            position=self.pos_director,
            employee_code="EMP_DIR",
            full_name="Nguyễn Văn Giám Đốc",
            status="ACTIVE",
        )
        self.staff_emp = Employee.objects.create(
            company=self.company,
            department=self.dept,
            position=self.pos_staff,
            employee_code="EMP_STAFF",
            full_name="Trần Thị Chuyên Viên",
            status="ACTIVE",
        )

        # 4. Master data: Khách hàng & Hàng hóa
        self.customer = Party.objects.create(
            company=self.company,
            code="KH_CTR_01",
            name="Công Ty Khách Hàng Thử Nghiệm",
            status="ACTIVE",
        )
        PartyContact.objects.create(
            party=self.customer,
            contact_type="GENERAL",
            contact_name="Lê Đại Diện",
            job_title="Trưởng phòng mua hàng",
            phone="0912345678",
            is_default=True,
            status="ACTIVE",
        )

        self.uom_pcs = UnitOfMeasure.objects.create(company=self.company, code="CAI", name="Cái")
        self.tax_10 = TaxRate.objects.create(
            company=self.company,
            code="VAT10",
            name="Thuế GTGT 10%",
            tax_type="VAT",
            rate_percent=Decimal("10"),
            application_form="PERCENT",
            effective_from=self.today - timedelta(days=30),
            business_scope="OUTPUT",
            status="ACTIVE",
        )

        self.category = ItemCategory.objects.create(
            company=self.company,
            code="CAT_SP",
            name="Sản Phẩm",
        )
        self.item_goods = Item.objects.create(
            company=self.company,
            category=self.category,
            code="SP_G01",
            name="Máy tính xách tay Dell XPS",
            sales_uom=self.uom_pcs,
            base_uom=self.uom_pcs,
            status="ACTIVE",
        )
        self.item_service = Item.objects.create(
            company=self.company,
            category=self.category,
            code="DV_S01",
            name="Dịch vụ bảo trì phần mềm 1 năm",
            sales_uom=self.uom_pcs,
            base_uom=self.uom_pcs,
            status="ACTIVE",
        )

    def test_01_create_fixed_contract_success(self):
        """Step 1-6: Tạo hợp đồng cố định thành công, tự sinh mã, tính tiền và ghi Audit Log."""
        payload = {
            "company_id": str(self.company.id),
            "contract_number": "HD-2026/DELL-001",
            "title": "Hợp đồng cung cấp máy tính xách tay Dell",
            "customer": str(self.customer.id),
            "customer_representative": "Lê Đại Diện",
            "customer_representative_position": "Trưởng phòng mua hàng",
            "company_signer": str(self.signer_emp.id),
            "company_signer_name": self.signer_emp.full_name,
            "company_signer_position": "Giám đốc kinh doanh",
            "assigned_employee": str(self.staff_emp.id),
            "start_date": self.today.isoformat(),
            "end_date": (self.today + timedelta(days=180)).isoformat(),
            "currency": str(self.currency.id),
            "value_type": "FIXED",
            "payment_terms_text": "Thanh toán 50% khi ký, 50% sau khi bàn giao",
            "delivery_terms": "Giao hàng tại văn phòng bên mua trong vòng 15 ngày",
            "lines": [
                {
                    "line_no": 1,
                    "item": str(self.item_goods.id),
                    "quantity": "10",
                    "unit_price": "20000000",
                    "discount_rate": "5",
                    "tax_rate": str(self.tax_10.id),
                }
            ],
        }

        resp = self.client.post(f"/api/v1/sales/contracts/?company_id={self.company.id}", payload, format="json")
        self.assertEqual(resp.status_code, 201)
        data = resp.data
        self.assertTrue(data["number"].startswith("HD-"))
        self.assertEqual(data["contract_number"], "HD-2026/DELL-001")
        self.assertEqual(data["status"], "DRAFT")
        self.assertEqual(data["value_type"], "FIXED")
        
        # Tiền: 10 * 20M = 200M; Chiết khấu 5% = 10M -> Còn 190M; Thuế 10% = 19M -> Tổng = 209M
        self.assertEqual(Decimal(data["subtotal"]), Decimal("190000000"))
        self.assertEqual(Decimal(data["discount_amount"]), Decimal("10000000"))
        self.assertEqual(Decimal(data["tax_amount"]), Decimal("19000000"))
        self.assertEqual(Decimal(data["total_amount"]), Decimal("209000000"))
        self.assertEqual(len(data["lines"]), 1)

    def test_02_create_limit_contract_success(self):
        """Step 2, 5: Tạo hợp đồng hạn mức giá trị không cần khai báo trước dòng chi tiết."""
        payload = {
            "company_id": str(self.company.id),
            "contract_number": "HD-2026/LIMIT-999",
            "title": "Hợp đồng nguyên tắc hạn mức dịch vụ CNTT",
            "customer": str(self.customer.id),
            "customer_representative": "Lê Đại Diện",
            "customer_representative_position": "Trưởng phòng mua hàng",
            "company_signer": str(self.signer_emp.id),
            "company_signer_position": "Giám đốc kinh doanh",
            "start_date": self.today.isoformat(),
            "end_date": (self.today + timedelta(days=365)).isoformat(),
            "value_type": "LIMIT",
            "contract_limit": "500000000",
            "payment_terms_text": "Thanh toán theo từng đơn hàng phát sinh trong hạn mức",
            "delivery_terms": "Thực hiện theo từng phiếu yêu cầu dịch vụ",
        }

        resp = self.client.post(f"/api/v1/sales/contracts/?company_id={self.company.id}", payload, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["value_type"], "LIMIT")
        self.assertEqual(Decimal(resp.data["contract_limit"]), Decimal("500000000"))
        self.assertEqual(Decimal(resp.data["total_amount"]), Decimal("500000000"))

    def test_03_duplicate_contract_number_blocked(self):
        """BR-SAL-12-02, EF-02: Chặn tạo trùng số hợp đồng trong cùng doanh nghiệp."""
        contract_services.save_contract(
            None,
            self.company,
            {
                "contract_number": "HD-TRUNG-001",
                "title": "Hợp đồng số 1",
                "customer": str(self.customer.id),
                "customer_representative": "A",
                "customer_representative_position": "B",
                "company_signer_name": "C",
                "company_signer_position": "D",
                "start_date": self.today.isoformat(),
                "end_date": (self.today + timedelta(days=30)).isoformat(),
                "payment_terms_text": "Điều khoản 1",
                "delivery_terms": "Giao hàng 1",
                "value_type": "LIMIT",
                "contract_limit": "10000000",
            },
        )

        payload = {
            "company_id": str(self.company.id),
            "contract_number": "HD-TRUNG-001",
            "title": "Hợp đồng số 2 trùng số",
            "customer": str(self.customer.id),
            "customer_representative": "A",
            "customer_representative_position": "B",
            "company_signer_name": "C",
            "company_signer_position": "D",
            "start_date": self.today.isoformat(),
            "end_date": (self.today + timedelta(days=30)).isoformat(),
            "payment_terms_text": "Điều khoản 2",
            "delivery_terms": "Giao hàng 2",
            "value_type": "LIMIT",
            "contract_limit": "20000000",
        }
        resp = self.client.post(f"/api/v1/sales/contracts/?company_id={self.company.id}", payload, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("contract_number", resp.data)

    def test_04_validation_dates_and_amounts(self):
        """BR-SAL-12-03, EF-03: Ngày kết thúc không trước ngày bắt đầu; giá trị/hạn mức > 0; cố định phải có dòng."""
        # 1. Ngày kết thúc trước ngày bắt đầu
        payload_date = {
            "company_id": str(self.company.id),
            "contract_number": "HD-SAI-NGAY",
            "title": "Hợp đồng sai ngày",
            "customer": str(self.customer.id),
            "customer_representative": "A",
            "customer_representative_position": "B",
            "company_signer_name": "C",
            "company_signer_position": "D",
            "start_date": (self.today + timedelta(days=10)).isoformat(),
            "end_date": self.today.isoformat(),
            "payment_terms_text": "T",
            "delivery_terms": "G",
            "value_type": "LIMIT",
            "contract_limit": "10000000",
        }
        resp = self.client.post(f"/api/v1/sales/contracts/?company_id={self.company.id}", payload_date, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("end_date", resp.data)

        # 2. Hợp đồng cố định nhưng không có dòng
        payload_no_lines = {
            "company_id": str(self.company.id),
            "contract_number": "HD-KO-DONG",
            "title": "Hợp đồng cố định không có dòng",
            "customer": str(self.customer.id),
            "customer_representative": "A",
            "customer_representative_position": "B",
            "company_signer_name": "C",
            "company_signer_position": "D",
            "start_date": self.today.isoformat(),
            "end_date": (self.today + timedelta(days=30)).isoformat(),
            "payment_terms_text": "T",
            "delivery_terms": "G",
            "value_type": "FIXED",
            "lines": [],
        }
        resp2 = self.client.post(f"/api/v1/sales/contracts/?company_id={self.company.id}", payload_no_lines, format="json")
        self.assertEqual(resp2.status_code, 400)
        self.assertIn("lines", resp2.data)

        # 3. Hạn mức <= 0
        payload_zero_limit = {
            "company_id": str(self.company.id),
            "contract_number": "HD-LIMIT-0",
            "title": "Hợp đồng hạn mức 0",
            "customer": str(self.customer.id),
            "customer_representative": "A",
            "customer_representative_position": "B",
            "company_signer_name": "C",
            "company_signer_position": "D",
            "start_date": self.today.isoformat(),
            "end_date": (self.today + timedelta(days=30)).isoformat(),
            "payment_terms_text": "T",
            "delivery_terms": "G",
            "value_type": "LIMIT",
            "contract_limit": "0",
        }
        resp3 = self.client.post(f"/api/v1/sales/contracts/?company_id={self.company.id}", payload_zero_limit, format="json")
        self.assertEqual(resp3.status_code, 400)
        self.assertIn("contract_limit", resp3.data)

    def test_05_create_from_quotation_af_02(self):
        """AF-02: Lập hợp đồng từ báo giá nguồn đã được chấp thuận."""
        quote = models.SalesQuotation.objects.create(
            company=self.company,
            branch=self.branch,
            number="BG-2026-00088",
            document_date=self.today,
            customer=self.customer,
            currency=self.currency,
            valid_until=self.today + timedelta(days=30),
            status=models.DocumentStatus.ACCEPTED,
            created_by=self.user_account,
            payment_terms_text="Thanh toán 100% sau giao hàng",
            delivery_terms="Giao hàng tận nơi",
            subtotal=Decimal("40000000"),
            total_amount=Decimal("44000000"),
        )
        q_line = models.SalesQuotationLine.objects.create(
            quotation=quote,
            line_no=1,
            item=self.item_goods,
            uom=self.uom_pcs,
            quantity=Decimal("2"),
            unit_price=Decimal("20000000"),
            tax_rate=self.tax_10,
        )

        payload = {
            "company_id": str(self.company.id),
            "quotation_id": str(quote.id),
            "contract_number": "HD-KE-THUA-BG",
            "title": "Hợp đồng kế thừa báo giá",
            "customer_representative": "Lê Đại Diện",
            "customer_representative_position": "Trưởng phòng mua hàng",
            "company_signer": str(self.signer_emp.id),
            "company_signer_position": "Giám đốc kinh doanh",
            "start_date": self.today.isoformat(),
            "end_date": (self.today + timedelta(days=90)).isoformat(),
            "payment_terms_text": "Kế thừa thanh toán",
            "delivery_terms": "Kế thừa giao hàng",
        }
        resp = self.client.post(f"/api/v1/sales/contracts/from_quotation/?company_id={self.company.id}", payload, format="json")
        self.assertEqual(resp.status_code, 201)
        data = resp.data
        self.assertEqual(data["contract_number"], "HD-KE-THUA-BG")
        self.assertEqual(data["quotation"], quote.id)
        self.assertEqual(len(data["lines"]), 1)
        self.assertEqual(Decimal(data["total_amount"]), Decimal("44000000"))

    def test_06_submit_approve_and_revoke_workflow(self):
        """Step 7, AF-03, AF-04: Luồng gửi duyệt, thu hồi, duyệt hợp đồng."""
        contract = contract_services.save_contract(
            None,
            self.company,
            {
                "contract_number": "HD-DUYET-01",
                "title": "Hợp đồng kiểm tra duyệt",
                "customer": str(self.customer.id),
                "customer_representative": "A",
                "customer_representative_position": "B",
                "company_signer_name": "C",
                "company_signer_position": "D",
                "start_date": self.today.isoformat(),
                "end_date": (self.today + timedelta(days=60)).isoformat(),
                "payment_terms_text": "T",
                "delivery_terms": "G",
                "value_type": "LIMIT",
                "contract_limit": "50000000",
            },
        )
        self.assertEqual(contract.status, "DRAFT")

        # Gửi duyệt -> PENDING_APPROVAL
        resp_sub = self.client.post(f"/api/v1/sales/contracts/{contract.id}/submit/?company_id={self.company.id}")
        self.assertEqual(resp_sub.status_code, 200)
        self.assertEqual(resp_sub.data["status"], "PENDING_APPROVAL")

        # Thu hồi -> DRAFT (AF-03)
        resp_rev = self.client.post(
            f"/api/v1/sales/contracts/{contract.id}/revoke/?company_id={self.company.id}",
            {"reason": "Cần bổ sung điều khoản"},
            format="json",
        )
        self.assertEqual(resp_rev.status_code, 200)
        self.assertEqual(resp_rev.data["status"], "DRAFT")

        # Gửi duyệt lại
        self.client.post(f"/api/v1/sales/contracts/{contract.id}/submit/?company_id={self.company.id}")

        # Phê duyệt -> APPROVED
        resp_app = self.client.post(f"/api/v1/sales/contracts/{contract.id}/approve/?company_id={self.company.id}")
        self.assertEqual(resp_app.status_code, 200)
        self.assertEqual(resp_app.data["status"], "APPROVED")

        # Đưa về Nháp từ Đã duyệt để sửa (Trạng thái table)
        resp_rtd = self.client.post(f"/api/v1/sales/contracts/{contract.id}/return_to_draft/?company_id={self.company.id}")
        self.assertEqual(resp_rtd.status_code, 200)
        self.assertEqual(resp_rtd.data["status"], "DRAFT")

    def test_07_sign_contract_validation_and_success(self):
        """Step 8-9, BR-SAL-12-04, EF-04: Bắt buộc ngày ký và tệp đã ký; chuyển Đã ký."""
        contract = contract_services.save_contract(
            None,
            self.company,
            {
                "contract_number": "HD-KY-KET-01",
                "title": "Hợp đồng ký kết",
                "customer": str(self.customer.id),
                "customer_representative": "A",
                "customer_representative_position": "B",
                "company_signer_name": "C",
                "company_signer_position": "D",
                "start_date": self.today.isoformat(),
                "end_date": (self.today + timedelta(days=60)).isoformat(),
                "payment_terms_text": "T",
                "delivery_terms": "G",
                "value_type": "LIMIT",
                "contract_limit": "50000000",
            },
        )
        contract.status = models.DocumentStatus.APPROVED
        contract.save()

        # Thiếu ngày ký (EF-04)
        resp_err1 = self.client.post(
            f"/api/v1/sales/contracts/{contract.id}/sign/?company_id={self.company.id}",
            {"signed_file": {"name": "hop_dong_da_ky.pdf", "url": "/media/hd.pdf"}},
            format="json",
        )
        self.assertEqual(resp_err1.status_code, 400)
        self.assertIn("signed_date", resp_err1.data)

        # Thiếu tệp đã ký (EF-04)
        resp_err2 = self.client.post(
            f"/api/v1/sales/contracts/{contract.id}/sign/?company_id={self.company.id}",
            {"signed_date": self.today.isoformat()},
            format="json",
        )
        self.assertEqual(resp_err2.status_code, 400)
        self.assertIn("signed_file", resp_err2.data)

        # Ghi nhận ký kết hợp lệ
        resp_ok = self.client.post(
            f"/api/v1/sales/contracts/{contract.id}/sign/?company_id={self.company.id}",
            {
                "signed_date": self.today.isoformat(),
                "signed_file": {"name": "hop_dong_da_ky.pdf", "url": "/media/hd.pdf"},
            },
            format="json",
        )
        self.assertEqual(resp_ok.status_code, 200)
        self.assertEqual(resp_ok.data["status"], "SIGNED")
        self.assertEqual(resp_ok.data["validity"], "EFFECTIVE")
        self.assertEqual(resp_ok.data["validity_display"], "Đang hiệu lực")

    def test_08_contract_validity_calculation(self):
        """Table 3: Hiệu lực tính toán: Chưa đến hiệu lực, Đang hiệu lực, Hết hiệu lực."""
        c = models.SalesContract.objects.create(
            company=self.company,
            number="HD-TEST-VL",
            contract_number="HD-TEST-VL",
            title="Test hiệu lực",
            customer=self.customer,
            currency=self.currency,
            document_date=self.today,
            created_by=self.user_account,
            status=models.DocumentStatus.SIGNED,
            start_date=self.today + timedelta(days=5),
            end_date=self.today + timedelta(days=30),
            payment_terms_text="P",
            delivery_terms="D",
        )

        # 1. Chưa đến hiệu lực (today < start_date)
        self.assertEqual(contract_services.get_contract_validity(c, on_date=self.today), "NOT_YET_EFFECTIVE")

        # 2. Đang hiệu lực (start_date <= date <= end_date)
        eff_date = self.today + timedelta(days=10)
        self.assertEqual(contract_services.get_contract_validity(c, on_date=eff_date), "EFFECTIVE")

        # 3. Hết hiệu lực (date > end_date)
        exp_date = self.today + timedelta(days=35)
        self.assertEqual(contract_services.get_contract_validity(c, on_date=exp_date), "EXPIRED")

    def test_09_prepare_order_from_effective_contract(self):
        """AF-05, BR-SAL-12-05, EF-06: Chỉ lập đơn từ hợp đồng Đã ký, đang hiệu lực; lấy phần còn lại."""
        contract = contract_services.save_contract(
            None,
            self.company,
            {
                "contract_number": "HD-PREPARE-ORDER",
                "title": "Hợp đồng lập đơn bán",
                "customer": str(self.customer.id),
                "customer_representative": "Lê Đại Diện",
                "customer_representative_position": "TP Mua hàng",
                "company_signer_name": "GĐ",
                "company_signer_position": "Giám đốc",
                "start_date": self.today.isoformat(),
                "end_date": (self.today + timedelta(days=100)).isoformat(),
                "payment_terms_text": "Theo đợt",
                "delivery_terms": "Kho khách hàng",
                "value_type": "FIXED",
                "lines": [
                    {
                        "line_no": 1,
                        "item": str(self.item_goods.id),
                        "quantity": "5",
                        "unit_price": "15000000",
                        "tax_rate": str(self.tax_10.id),
                    }
                ],
            },
        )

        # Chưa ký -> Chặn lập đơn (BR-SAL-12-05, EF-06)
        resp_err = self.client.get(f"/api/v1/sales/contracts/{contract.id}/prepare_order/?company_id={self.company.id}")
        self.assertEqual(resp_err.status_code, 400)

        # Ký kết
        contract_services.sign_contract(None, contract, self.today, {"url": "file.pdf"})

        # Hợp đồng Đã ký & đang hiệu lực -> Trả về prefill đơn bán
        resp_ok = self.client.get(f"/api/v1/sales/contracts/{contract.id}/prepare_order/?company_id={self.company.id}")
        self.assertEqual(resp_ok.status_code, 200)
        data = resp_ok.data
        self.assertEqual(data["contract_number"], "HD-PREPARE-ORDER")
        self.assertEqual(len(data["lines"]), 1)
        self.assertEqual(data["lines"][0]["remaining_quantity"], "5.000000")

    def test_10_block_direct_edit_of_signed_contract(self):
        """AF-03, BR-SAL-12-08, EF-09: Chặn sửa trực tiếp nội dung hợp đồng Đã ký."""
        contract = contract_services.save_contract(
            None,
            self.company,
            {
                "contract_number": "HD-NO-EDIT-SIGNED",
                "title": "Hợp đồng chặn sửa",
                "customer": str(self.customer.id),
                "customer_representative": "A",
                "customer_representative_position": "B",
                "company_signer_name": "C",
                "company_signer_position": "D",
                "start_date": self.today.isoformat(),
                "end_date": (self.today + timedelta(days=30)).isoformat(),
                "payment_terms_text": "P",
                "delivery_terms": "D",
                "value_type": "LIMIT",
                "contract_limit": "20000000",
            },
        )
        contract_services.sign_contract(None, contract, self.today, {"url": "file.pdf"})

        # Cố gắng sửa trực tiếp
        resp = self.client.put(
            f"/api/v1/sales/contracts/{contract.id}/?company_id={self.company.id}",
            {
                "contract_number": "HD-NO-EDIT-SIGNED",
                "title": "Cố tình sửa tên hợp đồng",
                "contract_limit": "99999999",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("phụ lục", str(resp.data).lower())

    def test_11_annex_lifecycle_and_constraints(self):
        """AF-06, BR-SAL-12-08, BR-SAL-12-10, EF-08: Lập phụ lục, kiểm tra ràng buộc phân bổ và ký phụ lục."""
        contract = contract_services.save_contract(
            None,
            self.company,
            {
                "contract_number": "HD-PHU-LUC-01",
                "title": "Hợp đồng thử nghiệm phụ lục",
                "customer": str(self.customer.id),
                "customer_representative": "A",
                "customer_representative_position": "B",
                "company_signer_name": "C",
                "company_signer_position": "D",
                "start_date": self.today.isoformat(),
                "end_date": (self.today + timedelta(days=60)).isoformat(),
                "payment_terms_text": "P",
                "delivery_terms": "D",
                "value_type": "LIMIT",
                "contract_limit": "100000000",
            },
        )
        contract_services.sign_contract(None, contract, self.today, {"url": "signed.pdf"})

        # Tạo đơn bán liên kết sử dụng 60 triệu
        models.SalesOrder.objects.create(
            company=self.company,
            branch=self.branch,
            number="SO-2026-CTR-01",
            document_date=self.today,
            customer=self.customer,
            currency=self.currency,
            contract=contract,
            status=models.DocumentStatus.APPROVED,
            created_by=self.user_account,
            total_amount=Decimal("60000000"),
        )

        # 1. Cố tình lập phụ lục giảm hạn mức xuống 40 triệu (< 60 triệu đang ràng buộc) -> Chặn (BR-SAL-12-10, EF-08)
        resp_err = self.client.post(
            f"/api/v1/sales/contracts/{contract.id}/create_annex/?company_id={self.company.id}",
            {
                "annex_number": "PL-01",
                "change_content": "Giảm hạn mức",
                "new_contract_limit": "40000000",
            },
            format="json",
        )
        self.assertEqual(resp_err.status_code, 400)
        self.assertIn("new_contract_limit", resp_err.data)

        # 2. Lập phụ lục hợp lệ: Gia hạn đến 120 ngày và tăng hạn mức lên 150 triệu
        new_end = (self.today + timedelta(days=120)).isoformat()
        resp_annex = self.client.post(
            f"/api/v1/sales/contracts/{contract.id}/create_annex/?company_id={self.company.id}",
            {
                "annex_number": "PL-01",
                "change_content": "Gia hạn thời gian và tăng hạn mức hợp đồng",
                "new_end_date": new_end,
                "new_contract_limit": "150000000",
            },
            format="json",
        )
        self.assertEqual(resp_annex.status_code, 201)
        annex_id = resp_annex.data["id"]

        # 3. Ký phụ lục và kiểm tra cập nhật hợp đồng (BR-SAL-12-09)
        resp_sign_annex = self.client.post(
            f"/api/v1/sales/contracts/{contract.id}/annexes/{annex_id}/sign/?company_id={self.company.id}",
            {
                "signed_date": self.today.isoformat(),
                "effective_date": self.today.isoformat(),
                "signed_file": {"name": "pl01_signed.pdf", "url": "/media/pl01.pdf"},
            },
            format="json",
        )
        self.assertEqual(resp_sign_annex.status_code, 200)
        self.assertEqual(resp_sign_annex.data["status"], "SIGNED")

        contract.refresh_from_db()
        self.assertEqual(contract.end_date.isoformat(), new_end)
        self.assertEqual(contract.contract_limit, Decimal("150000000"))

    def test_12_liquidation_workflow_and_open_transactions(self):
        """AF-07, BR-SAL-12-11: Thanh lý yêu cầu phương án xử lý khoản còn mở; không tự hủy đơn."""
        contract = contract_services.save_contract(
            None,
            self.company,
            {
                "contract_number": "HD-THANH-LY-01",
                "title": "Hợp đồng chuẩn bị thanh lý",
                "customer": str(self.customer.id),
                "customer_representative": "A",
                "customer_representative_position": "B",
                "company_signer_name": "C",
                "company_signer_position": "D",
                "start_date": self.today.isoformat(),
                "end_date": (self.today + timedelta(days=60)).isoformat(),
                "payment_terms_text": "P",
                "delivery_terms": "D",
                "value_type": "LIMIT",
                "contract_limit": "50000000",
            },
        )
        contract_services.sign_contract(None, contract, self.today, {"url": "file.pdf"})

        # Tạo đơn bán còn mở
        order = models.SalesOrder.objects.create(
            company=self.company,
            branch=self.branch,
            number="SO-OPEN-01",
            document_date=self.today,
            customer=self.customer,
            currency=self.currency,
            contract=contract,
            status=models.DocumentStatus.APPROVED,
            created_by=self.user_account,
            total_amount=Decimal("30000000"),
        )

        # 1. Kiểm tra open_transactions API
        resp_open = self.client.get(f"/api/v1/sales/contracts/{contract.id}/open_transactions/?company_id={self.company.id}")
        self.assertEqual(resp_open.status_code, 200)
        self.assertTrue(resp_open.data["has_open"])
        self.assertEqual(resp_open.data["open_orders_count"], 1)

        # 2. Thanh lý mà KHÔNG ghi rõ phương án xử lý -> Bị chặn (BR-SAL-12-11)
        resp_err = self.client.post(
            f"/api/v1/sales/contracts/{contract.id}/liquidate/?company_id={self.company.id}",
            {
                "reason": "Hai bên thỏa thuận thanh lý",
                "liquidation_file": {"url": "bien_ban_thanh_ly.pdf"},
            },
            format="json",
        )
        self.assertEqual(resp_err.status_code, 400)
        self.assertIn("open_settlement_notes", resp_err.data)

        # 3. Thanh lý có ghi rõ phương án xử lý
        resp_ok = self.client.post(
            f"/api/v1/sales/contracts/{contract.id}/liquidate/?company_id={self.company.id}",
            {
                "reason": "Hai bên thỏa thuận thanh lý toàn bộ",
                "liquidation_file": {"name": "bb_tl.pdf", "url": "/media/tl.pdf"},
                "open_settlement_notes": "Đơn hàng SO-OPEN-01 tiếp tục hoàn tất giao nốt trong tháng này.",
            },
            format="json",
        )
        self.assertEqual(resp_ok.status_code, 200)
        self.assertEqual(resp_ok.data["status"], "LIQUIDATED")

        # Kiểm tra đơn bán vẫn tồn tại và không bị tự xóa/hủy (BR-SAL-12-11)
        order.refresh_from_db()
        self.assertEqual(order.status, models.DocumentStatus.APPROVED)

    def test_13_terminate_contract_workflow(self):
        """AF-07: Chấm dứt hợp đồng trước hạn."""
        contract = contract_services.save_contract(
            None,
            self.company,
            {
                "contract_number": "HD-CHAM-DUT-01",
                "title": "Hợp đồng chấm dứt",
                "customer": str(self.customer.id),
                "customer_representative": "A",
                "customer_representative_position": "B",
                "company_signer_name": "C",
                "company_signer_position": "D",
                "start_date": self.today.isoformat(),
                "end_date": (self.today + timedelta(days=60)).isoformat(),
                "payment_terms_text": "P",
                "delivery_terms": "D",
                "value_type": "LIMIT",
                "contract_limit": "20000000",
            },
        )
        contract_services.sign_contract(None, contract, self.today, {"url": "file.pdf"})

        resp = self.client.post(
            f"/api/v1/sales/contracts/{contract.id}/terminate/?company_id={self.company.id}",
            {"reason": "Khách hàng thay đổi kế hoạch sản xuất kinh doanh"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["status"], "TERMINATED")
        self.assertEqual(resp.data["termination_reason"], "Khách hàng thay đổi kế hoạch sản xuất kinh doanh")

    def test_14_cancel_unsigned_contract_and_block_cancel_signed(self):
        """AF-08, BR-SAL-12-13: Hủy hợp đồng chưa ký có lý do; chặn hủy hợp đồng Đã ký."""
        # 1. Hủy hợp đồng nháp thành công
        contract_draft = contract_services.save_contract(
            None,
            self.company,
            {
                "contract_number": "HD-HUY-DRAFT",
                "title": "Hợp đồng nháp cần hủy",
                "customer": str(self.customer.id),
                "customer_representative": "A",
                "customer_representative_position": "B",
                "company_signer_name": "C",
                "company_signer_position": "D",
                "start_date": self.today.isoformat(),
                "end_date": (self.today + timedelta(days=30)).isoformat(),
                "payment_terms_text": "P",
                "delivery_terms": "D",
                "value_type": "LIMIT",
                "contract_limit": "10000000",
            },
        )
        resp_cancel = self.client.post(
            f"/api/v1/sales/contracts/{contract_draft.id}/cancel/?company_id={self.company.id}",
            {"reason": "Đàm phán không thành công"},
            format="json",
        )
        self.assertEqual(resp_cancel.status_code, 200)
        self.assertEqual(resp_cancel.data["status"], "CANCELLED")

        # 2. Hợp đồng Đã ký -> Chặn hủy (phải dùng thanh lý hoặc chấm dứt)
        contract_signed = contract_services.save_contract(
            None,
            self.company,
            {
                "contract_number": "HD-CHAN-HUY-SIGNED",
                "title": "Hợp đồng đã ký chặn hủy",
                "customer": str(self.customer.id),
                "customer_representative": "A",
                "customer_representative_position": "B",
                "company_signer_name": "C",
                "company_signer_position": "D",
                "start_date": self.today.isoformat(),
                "end_date": (self.today + timedelta(days=30)).isoformat(),
                "payment_terms_text": "P",
                "delivery_terms": "D",
                "value_type": "LIMIT",
                "contract_limit": "10000000",
            },
        )
        contract_services.sign_contract(None, contract_signed, self.today, {"url": "file.pdf"})

        resp_err = self.client.post(
            f"/api/v1/sales/contracts/{contract_signed.id}/cancel/?company_id={self.company.id}",
            {"reason": "Cố tình hủy hợp đồng đã ký"},
            format="json",
        )
        self.assertEqual(resp_err.status_code, 400)
        self.assertIn("thanh lý hoặc chấm dứt", str(resp_err.data))

    def test_15_delete_draft_contract_and_block_delete_when_linked(self):
        """AF-08, BR-SAL-12-13: Xóa hợp đồng Nháp chưa có liên kết; chặn xóa khi đã có đơn bán."""
        # 1. Xóa nháp không liên kết thành công (204)
        c1 = contract_services.save_contract(
            None,
            self.company,
            {
                "contract_number": "HD-XOA-DRAFT",
                "title": "Hợp đồng xóa",
                "customer": str(self.customer.id),
                "customer_representative": "A",
                "customer_representative_position": "B",
                "company_signer_name": "C",
                "company_signer_position": "D",
                "start_date": self.today.isoformat(),
                "end_date": (self.today + timedelta(days=30)).isoformat(),
                "payment_terms_text": "P",
                "delivery_terms": "D",
                "value_type": "LIMIT",
                "contract_limit": "10000000",
            },
        )
        resp_del = self.client.delete(f"/api/v1/sales/contracts/{c1.id}/?company_id={self.company.id}")
        self.assertEqual(resp_del.status_code, 204)
        self.assertFalse(models.SalesContract.objects.filter(pk=c1.id).exists())

        # 2. Chặn xóa khi đã có đơn bán liên kết
        c2 = contract_services.save_contract(
            None,
            self.company,
            {
                "contract_number": "HD-KO-XOA-LINKED",
                "title": "Hợp đồng có liên kết",
                "customer": str(self.customer.id),
                "customer_representative": "A",
                "customer_representative_position": "B",
                "company_signer_name": "C",
                "company_signer_position": "D",
                "start_date": self.today.isoformat(),
                "end_date": (self.today + timedelta(days=30)).isoformat(),
                "payment_terms_text": "P",
                "delivery_terms": "D",
                "value_type": "LIMIT",
                "contract_limit": "10000000",
            },
        )
        models.SalesOrder.objects.create(
            company=self.company,
            branch=self.branch,
            number="SO-LINK-01",
            document_date=self.today,
            customer=self.customer,
            currency=self.currency,
            contract=c2,
            status=models.DocumentStatus.DRAFT,
            created_by=self.user_account,
        )
        resp_del_err = self.client.delete(f"/api/v1/sales/contracts/{c2.id}/?company_id={self.company.id}")
        self.assertEqual(resp_del_err.status_code, 400)
        self.assertTrue(models.SalesContract.objects.filter(pk=c2.id).exists())

    def test_16_allocation_and_release_when_order_cancelled(self):
        """BR-SAL-12-06, BR-SAL-12-07: Tính phần phân bổ và giải phóng khi đơn bán bị hủy."""
        contract = contract_services.save_contract(
            None,
            self.company,
            {
                "contract_number": "HD-ALLOC-TEST",
                "title": "Hợp đồng theo dõi phân bổ",
                "customer": str(self.customer.id),
                "customer_representative": "A",
                "customer_representative_position": "B",
                "company_signer_name": "C",
                "company_signer_position": "D",
                "start_date": self.today.isoformat(),
                "end_date": (self.today + timedelta(days=60)).isoformat(),
                "payment_terms_text": "P",
                "delivery_terms": "D",
                "value_type": "LIMIT",
                "contract_limit": "100000000",
            },
        )
        contract_services.sign_contract(None, contract, self.today, {"url": "file.pdf"})

        # Đơn 1: 40M (APPROVED)
        order = models.SalesOrder.objects.create(
            company=self.company,
            branch=self.branch,
            number="SO-AL-01",
            document_date=self.today,
            customer=self.customer,
            currency=self.currency,
            contract=contract,
            status=models.DocumentStatus.APPROVED,
            created_by=self.user_account,
            total_amount=Decimal("40000000"),
        )

        alloc1 = contract_services.calculate_contract_allocations(contract)
        self.assertEqual(alloc1["allocated_amount"], Decimal("40000000"))
        self.assertEqual(alloc1["remaining_limit"], Decimal("60000000"))

        # Hủy đơn bán (CANCELLED) -> giải phóng phần phân bổ (BR-SAL-12-07)
        order.status = models.DocumentStatus.CANCELLED
        order.save()

        alloc2 = contract_services.calculate_contract_allocations(contract)
        self.assertEqual(alloc2["allocated_amount"], Decimal("0"))
        self.assertEqual(alloc2["remaining_limit"], Decimal("100000000"))

    def test_17_optimistic_concurrency_locking(self):
        """EF-10, BR-SAL-12-14: Kiểm tra phiên bản (version), không ghi đè khi dữ liệu đã thay đổi."""
        contract = contract_services.save_contract(
            None,
            self.company,
            {
                "contract_number": "HD-VERSION-01",
                "title": "Hợp đồng kiểm tra version ban đầu",
                "customer": str(self.customer.id),
                "customer_representative": "A",
                "customer_representative_position": "B",
                "company_signer_name": "C",
                "company_signer_position": "D",
                "start_date": self.today.isoformat(),
                "end_date": (self.today + timedelta(days=30)).isoformat(),
                "payment_terms_text": "P",
                "delivery_terms": "D",
                "value_type": "LIMIT",
                "contract_limit": "10000000",
            },
        )
        self.assertEqual(contract.version, 1)

        # Cập nhật lần 1 thành công -> version lên 2
        contract_services.save_contract(
            None,
            self.company,
            {
                "contract_number": "HD-VERSION-01",
                "title": "Hợp đồng sửa lần 1",
                "version": 1,
            },
            instance=contract,
        )
        contract.refresh_from_db()
        self.assertEqual(contract.version, 2)

        # Cập nhật lần 2 gửi version cũ (1) -> Bị chặn EF-10
        resp = self.client.put(
            f"/api/v1/sales/contracts/{contract.id}/?company_id={self.company.id}",
            {
                "contract_number": "HD-VERSION-01",
                "title": "Hợp đồng sửa lần 2 gửi version cũ",
                "version": 1,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("version", resp.data)

    def test_18_permission_security_check(self):
        """BR-SAL-12-01, EF-01: Kiểm tra phân quyền truy cập và thao tác."""
        # User không có quyền gọi API tạo hợp đồng -> 403 Forbidden
        payload = {
            "company_id": str(self.company.id),
            "contract_number": "HD-UNAUTH",
            "title": "Hợp đồng người dùng không quyền",
            "customer": str(self.customer.id),
            "customer_representative": "A",
            "customer_representative_position": "B",
            "company_signer_name": "C",
            "company_signer_position": "D",
            "start_date": self.today.isoformat(),
            "end_date": (self.today + timedelta(days=30)).isoformat(),
            "payment_terms_text": "P",
            "delivery_terms": "D",
            "value_type": "LIMIT",
            "contract_limit": "10000000",
        }
        resp = self.unauth_client.post(
            f"/api/v1/sales/contracts/?company_id={self.company.id}", payload, format="json"
        )
        self.assertEqual(resp.status_code, 403)
