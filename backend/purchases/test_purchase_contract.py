from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from general_ledger.models import JournalEntry
from master_data.models import Currency, Item, Party, PaymentTerm, TaxRate, UnitOfMeasure
from organization.models import Branch, Company, Department
from purchases import test_goods_purchase
from purchases.models import DocumentStatus, PurchaseContract, PurchaseContractLine, PurchaseOrder


class PurchaseContractTests(TestCase):
    def setUp(self):
        test_goods_purchase.GoodsPurchaseTests.setUp(self)
        self.url = f"/api/v1/purchases/purchase-contracts/?company_id={self.company.pk}"

        # Tax rate 10%
        self.tax_rate = TaxRate.objects.create(
            company=self.company,
            code="VAT10",
            name="10%",
            tax_type="VAT",
            rate_percent=Decimal("10.0000"),
            effective_from=self.day,
            status="ACTIVE",
        )

        # Payment term
        self.payment_term = PaymentTerm.objects.create(
            company=self.company,
            code="NET30",
            name="Thanh toán trong 30 ngày",
            due_days=30,
            status="ACTIVE",
        )

        # USD currency
        self.usd_currency, _ = Currency.objects.get_or_create(
            code="USD",
            defaults={"name": "US Dollar", "is_active": True},
        )

        # Department
        self.department = Department.objects.create(
            company=self.company,
            branch=self.branch,
            code="DEPT-PUR",
            name="Phòng Mua hàng",
            status="ACTIVE",
        )

    def contract_payload(self, **kwargs):
        line = {
            "item": str(self.item.pk),
            "uom": str(self.uom.pk),
            "quantity": "10.0000",
            "unit_price": "100.0000",
            "discount_rate": "10.0000",
            "tax_rate": str(self.tax_rate.pk),
            "expected_delivery_date": str(self.day + timedelta(days=15)),
            "description": "Dòng hàng kiểm thử",
        }
        data = {
            "company": str(self.company.pk),
            "branch": str(self.branch.pk),
            "department": str(self.department.pk),
            "title": "Hợp đồng cung cấp vật tư Q4/2026",
            "supplier": str(self.supplier.pk),
            "signed_date": str(self.day),
            "start_date": str(self.day),
            "end_date": str(self.day + timedelta(days=60)),
            "currency": str(self.company.accounting_currency.pk),
            "exchange_rate": "1",
            "payment_term": str(self.payment_term.pk),
            "delivery_place": "Kho tổng Hà Nội",
            "delivery_term": "DAP",
            "content": "Điều khoản hợp đồng mua sắm",
            "notes": "Hợp đồng ưu tiên",
            "lines": [line],
        }
        data.update(kwargs)
        return data

    def test_01_create_draft_and_auto_numbering(self):
        """BR01-BR04, Step 3-4, Step 23-24: Tạo hợp đồng Nháp và tự sinh số HDMH-YYYY-00001."""
        res = self.client.post(self.url, self.contract_payload(), format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["status"], DocumentStatus.DRAFT)
        self.assertEqual(res.data["message"], "Lưu hợp đồng mua hàng thành công.")
        number_1 = res.data["number"]
        year = self.day.year
        self.assertTrue(number_1.startswith(f"HDMH-{year}-"))
        self.assertEqual(number_1, f"HDMH-{year}-00001")

        # 2nd contract increments sequence
        res2 = self.client.post(self.url, self.contract_payload(title="Hợp đồng đợt 2"), format="json")
        self.assertEqual(res2.status_code, 201)
        self.assertEqual(res2.data["number"], f"HDMH-{year}-00002")

    def test_02_cancelled_number_not_reused(self):
        """BR05: Số hợp đồng của hợp đồng đã hủy không được cấp lại cho hợp đồng khác."""
        res1 = self.client.post(self.url, self.contract_payload(), format="json")
        self.assertEqual(res1.status_code, 201)
        cid = res1.data["id"]

        # Cancel contract 1
        detail_url = f"/api/v1/purchases/purchase-contracts/{cid}/?company_id={self.company.pk}"
        cancel_res = self.client.post(
            detail_url.replace("/?", "/cancel/?"),
            {"reason": "Hủy để kiểm tra sinh số"},
            format="json",
        )
        self.assertEqual(cancel_res.status_code, 200)

        # Create contract 2 -> should be 00002, not 00001
        res2 = self.client.post(self.url, self.contract_payload(title="Hợp đồng đợt 2"), format="json")
        self.assertEqual(res2.status_code, 201)
        year = self.day.year
        self.assertEqual(res2.data["number"], f"HDMH-{year}-00002")

    def test_03_mandatory_fields_validation_ex01(self):
        """BR06, EX01: Bắt buộc Tên hợp đồng, Nhà cung cấp, Ngày ký, Ngày bắt đầu, Ngày kết thúc, Loại tiền, Điều khoản thanh toán."""
        for field in ["title", "supplier", "signed_date", "start_date", "end_date", "payment_term"]:
            payload = self.contract_payload()
            payload[field] = ""
            res = self.client.post(self.url, payload, format="json")
            self.assertEqual(res.status_code, 400, f"Field {field} should be required")
            self.assertIn(field, res.data)

    def test_04_dates_validation_ex02(self):
        """BR10, EX02: Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu."""
        payload = self.contract_payload(
            start_date=str(self.day + timedelta(days=10)),
            end_date=str(self.day),
        )
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.", str(res.data))

    def test_05_inactive_supplier_ex03(self):
        """EX03: Nhà cung cấp đã ngừng hoạt động."""
        inactive_supplier = Party.objects.create(
            company=self.company,
            code="S-INACTIVE",
            name="Supplier Inactive",
            status="INACTIVE",
        )
        payload = self.contract_payload(supplier=str(inactive_supplier.pk))
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Nhà cung cấp đã ngừng hoạt động", str(res.data))

    def test_06_lines_required_ex04(self):
        """BR07, EX04: Hợp đồng phải có ít nhất một hàng hóa hoặc dịch vụ."""
        payload = self.contract_payload(lines=[])
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Hợp đồng phải có ít nhất một hàng hóa hoặc dịch vụ.", str(res.data))

    def test_07_line_field_validations_ex05_ex06_ex07_ex08(self):
        """BR08, BR09, EX05-EX08: Kiểm tra chi tiết dòng."""
        # EX05: Thiếu Hàng hóa
        p_missing_item = self.contract_payload(lines=[{"uom": str(self.uom.pk), "tax_rate": str(self.tax_rate.pk), "quantity": "1", "unit_price": "10"}])
        res = self.client.post(self.url, p_missing_item, format="json")
        self.assertEqual(res.status_code, 400)

        # EX06: Số lượng <= 0
        p_zero_qty = self.contract_payload(lines=[{
            "item": str(self.item.pk),
            "uom": str(self.uom.pk),
            "tax_rate": str(self.tax_rate.pk),
            "quantity": "0",
            "unit_price": "10",
        }])
        res = self.client.post(self.url, p_zero_qty, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Vui lòng nhập số lượng lớn hơn 0.", str(res.data))

        # EX07: Đơn giá âm
        p_neg_price = self.contract_payload(lines=[{
            "item": str(self.item.pk),
            "uom": str(self.uom.pk),
            "tax_rate": str(self.tax_rate.pk),
            "quantity": "5",
            "unit_price": "-10",
        }])
        res = self.client.post(self.url, p_neg_price, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Vui lòng nhập lại đơn giá.", str(res.data))

        # EX08: Chiết khấu ngoài [0, 100]
        p_bad_discount = self.contract_payload(lines=[{
            "item": str(self.item.pk),
            "uom": str(self.uom.pk),
            "tax_rate": str(self.tax_rate.pk),
            "quantity": "5",
            "unit_price": "10",
            "discount_rate": "150",
        }])
        res = self.client.post(self.url, p_bad_discount, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Vui lòng nhập lại tỷ lệ chiết khấu.", str(res.data))

    def test_08_foreign_currency_exchange_rate_ex09_br11(self):
        """BR11, EX09: Loại tiền khác VND yêu cầu tỷ giá > 0."""
        payload_no_rate = self.contract_payload(
            currency=str(self.usd_currency.pk),
            exchange_rate="",
        )
        res = self.client.post(self.url, payload_no_rate, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Vui lòng nhập tỷ giá lớn hơn 0.", str(res.data))

        payload_zero_rate = self.contract_payload(
            currency=str(self.usd_currency.pk),
            exchange_rate="0",
        )
        res2 = self.client.post(self.url, payload_zero_rate, format="json")
        self.assertEqual(res2.status_code, 400)
        self.assertIn("Vui lòng nhập tỷ giá lớn hơn 0.", str(res2.data))

        payload_valid_rate = self.contract_payload(
            currency=str(self.usd_currency.pk),
            exchange_rate="25000",
        )
        res3 = self.client.post(self.url, payload_valid_rate, format="json")
        self.assertEqual(res3.status_code, 201)
        self.assertEqual(Decimal(res3.data["exchange_rate"]), Decimal("25000"))

    def test_09_financial_calculations(self):
        """Steps 12-16: Tính Thành tiền, Chiết khấu, Trước thuế, Thuế GTGT, Tổng hợp đồng."""
        # Qty=10, Price=100 -> Subtotal=1000
        # Discount=10% -> DiscountAmount=100, PreTax=900
        # VAT=10% -> TaxAmount=90, Total=990
        res = self.client.post(self.url, self.contract_payload(), format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Decimal(res.data["subtotal"]), Decimal("1000.0000"))
        self.assertEqual(Decimal(res.data["discount_amount"]), Decimal("100.0000"))
        self.assertEqual(Decimal(res.data["tax_amount"]), Decimal("90.0000"))
        self.assertEqual(Decimal(res.data["total_amount"]), Decimal("990.0000"))
        self.assertEqual(Decimal(res.data["remaining_amount"]), Decimal("990.0000"))
        self.assertEqual(Decimal(res.data["progress_percent"]), Decimal("0"))

        line = res.data["lines"][0]
        self.assertEqual(Decimal(line["discount_amount"]), Decimal("100.0000"))
        self.assertEqual(Decimal(line["pre_tax_amount"]), Decimal("900.0000"))
        self.assertEqual(Decimal(line["tax_amount"]), Decimal("90.0000"))
        self.assertEqual(Decimal(line["total_amount"]), Decimal("990.0000"))

    def test_10_payment_schedules_validation_ex10_br12(self):
        """BR12, EX10: Tổng tiền các đợt thanh toán không vượt Tổng giá trị hợp đồng."""
        # Total contract is 990
        schedules_exceed = [
            {"stage_name": "Đợt 1", "amount": "600", "due_date": str(self.day + timedelta(days=10))},
            {"stage_name": "Đợt 2", "amount": "500", "due_date": str(self.day + timedelta(days=20))},
        ]
        payload = self.contract_payload(payment_schedules=schedules_exceed)
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Tổng tiền các đợt thanh toán không được vượt Tổng giá trị hợp đồng.", str(res.data))

        # Valid schedules (sum = 800 <= 990)
        schedules_valid = [
            {"stage_name": "Tạm ứng đợt 1", "amount": "300", "due_date": str(self.day + timedelta(days=10))},
            {"stage_name": "Thanh toán đợt 2", "amount": "500", "due_date": str(self.day + timedelta(days=20))},
        ]
        payload2 = self.contract_payload(payment_schedules=schedules_valid)
        res2 = self.client.post(self.url, payload2, format="json")
        self.assertEqual(res2.status_code, 201)
        self.assertEqual(len(res2.data["payment_schedules"]), 2)

    def test_11_attachments_validation_ex16(self):
        """EX16: Kiểm tra định dạng và dung lượng file đính kèm."""
        bad_ext = self.contract_payload(attachments=[{"file_name": "contract.exe", "file_size": 1024}])
        res1 = self.client.post(self.url, bad_ext, format="json")
        self.assertEqual(res1.status_code, 400)
        self.assertIn("Định dạng tệp", str(res1.data))

        oversized = self.contract_payload(attachments=[{"file_name": "scan.pdf", "file_size": 15 * 1024 * 1024}])
        res2 = self.client.post(self.url, oversized, format="json")
        self.assertEqual(res2.status_code, 400)
        self.assertIn("vượt quá 10 MB", str(res2.data))

        valid_att = self.contract_payload(attachments=[{"file_name": "contract_signed.pdf", "file_size": 2 * 1024 * 1024}])
        res3 = self.client.post(self.url, valid_att, format="json")
        self.assertEqual(res3.status_code, 201)
        self.assertEqual(len(res3.data["attachments"]), 1)

    def test_12_confirm_contract_without_workflow_af04(self):
        """AF04: Xác nhận hợp đồng trực tiếp khi không sử dụng Workflow."""
        # 1. Start date today -> becomes IN_PROGRESS
        res1 = self.client.post(self.url, self.contract_payload(), format="json")
        cid1 = res1.data["id"]
        detail1 = f"/api/v1/purchases/purchase-contracts/{cid1}/?company_id={self.company.pk}"
        confirm_res1 = self.client.post(detail1.replace("/?", "/confirm/?"), format="json")
        self.assertEqual(confirm_res1.status_code, 200)
        self.assertEqual(confirm_res1.data["status"], DocumentStatus.IN_PROGRESS)

        # 2. Start date in future -> becomes APPROVED
        future_start = timezone.now().date() + timedelta(days=10)
        res2 = self.client.post(
            self.url,
            self.contract_payload(
                start_date=str(future_start),
                end_date=str(future_start + timedelta(days=60)),
            ),
            format="json",
        )
        cid2 = res2.data["id"]
        detail2 = f"/api/v1/purchases/purchase-contracts/{cid2}/?company_id={self.company.pk}"
        confirm_res2 = self.client.post(detail2.replace("/?", "/confirm/?"), format="json")
        self.assertEqual(confirm_res2.status_code, 200)
        self.assertEqual(confirm_res2.data["status"], DocumentStatus.APPROVED)

    def test_13_submit_approve_and_reject_flow(self):
        """Steps 25-28, AF03: Gửi duyệt, Phê duyệt, Từ chối phê duyệt."""
        # Create contract
        res = self.client.post(self.url, self.contract_payload(), format="json")
        cid = res.data["id"]
        detail = f"/api/v1/purchases/purchase-contracts/{cid}/?company_id={self.company.pk}"

        # Submit
        contract = PurchaseContract.objects.get(pk=cid)
        contract.workflow_snapshot = {"approval_required": True, "steps": [{"approvers": [str(self.actor.pk)]}]}
        contract.save()

        sub_res = self.client.post(detail.replace("/?", "/submit/?"), format="json")
        self.assertEqual(sub_res.status_code, 200)
        self.assertEqual(sub_res.data["status"], DocumentStatus.PENDING_APPROVAL)

        # Reject without reason -> error AF03 Bước 1-2
        rej_no_reason = self.client.post(detail.replace("/?", "/reject/?"), {"reason": ""}, format="json")
        self.assertEqual(rej_no_reason.status_code, 400)
        self.assertIn("Vui lòng nhập lý do từ chối.", str(rej_no_reason.data))

        # Reject with reason -> REJECTED
        rej_res = self.client.post(detail.replace("/?", "/reject/?"), {"reason": "Đơn giá chưa hợp lý"}, format="json")
        self.assertEqual(rej_res.status_code, 200)
        self.assertEqual(rej_res.data["status"], DocumentStatus.REJECTED)

        # Edit rejected contract -> resets to DRAFT (AF03 Bước 4, AF02)
        edit_payload = self.contract_payload(title="Hợp đồng đã điều chỉnh")
        edit_res = self.client.put(detail, edit_payload, format="json")
        self.assertEqual(edit_res.status_code, 200)
        self.assertEqual(edit_res.data["status"], DocumentStatus.DRAFT)
        self.assertEqual(edit_res.data["title"], "Hợp đồng đã điều chỉnh")

        # Submit and Approve
        contract = PurchaseContract.objects.get(pk=cid)
        contract.workflow_snapshot = {"approval_required": True, "steps": [{"approvers": [str(self.actor.pk)]}]}
        contract.save()
        self.client.post(detail.replace("/?", "/submit/?"), format="json")

        app_res = self.client.post(detail.replace("/?", "/approve/?"), format="json")
        self.assertEqual(app_res.status_code, 200)
        self.assertEqual(app_res.data["status"], DocumentStatus.IN_PROGRESS)

    def test_14_optimistic_locking_and_immutable_approved_contract_br18_ex15(self):
        """BR18, EX15: Khóa lạc quan và Hợp đồng đã duyệt không được sửa."""
        res = self.client.post(self.url, self.contract_payload(), format="json")
        cid = res.data["id"]
        detail = f"/api/v1/purchases/purchase-contracts/{cid}/?company_id={self.company.pk}"

        # EX15: Version mismatch
        p_wrong_version = self.contract_payload(version=99)
        err_ver = self.client.put(detail, p_wrong_version, format="json")
        self.assertEqual(err_ver.status_code, 400)
        self.assertIn("Hợp đồng đã được User khác cập nhật.", str(err_ver.data))

        # Confirm contract -> IN_PROGRESS
        self.client.post(detail.replace("/?", "/confirm/?"), format="json")

        # BR18: Cannot edit approved/in-progress contract
        err_edit = self.client.put(detail, self.contract_payload(title="Sửa sau duyệt"), format="json")
        self.assertEqual(err_edit.status_code, 400)
        self.assertIn("Chỉ hợp đồng Chưa phê duyệt mới được sửa", str(err_edit.data))

    def test_15_create_order_from_contract_steps_29_31_br15_br17_ex12(self):
        """Steps 29-31, BR15-17, EX12: Tạo đơn mua hàng từ hợp đồng."""
        res = self.client.post(self.url, self.contract_payload(), format="json")
        cid = res.data["id"]
        detail = f"/api/v1/purchases/purchase-contracts/{cid}/?company_id={self.company.pk}"
        order_url = detail.replace("/?", "/create-order/?")

        # 1. DRAFT contract cannot create order (BR15)
        res_draft = self.client.post(order_url, {"lines": [{"contract_line_id": res.data["lines"][0]["id"], "quantity": "5"}]}, format="json")
        self.assertEqual(res_draft.status_code, 400)
        self.assertIn("Chỉ hợp đồng đã được phê duyệt", str(res_draft.data))

        # Confirm contract
        self.client.post(detail.replace("/?", "/confirm/?"), format="json")

        # GET orderable lines (Step 29)
        get_order_info = self.client.get(order_url)
        self.assertEqual(get_order_info.status_code, 200)
        self.assertEqual(len(get_order_info.data["lines"]), 1)
        self.assertEqual(Decimal(get_order_info.data["lines"][0]["remaining_quantity"]), Decimal("10.0000"))

        # EX12: Order quantity exceeds contract line quantity
        line_id = res.data["lines"][0]["id"]
        res_exceed_qty = self.client.post(order_url, {"lines": [{"contract_line_id": line_id, "quantity": "15"}]}, format="json")
        self.assertEqual(res_exceed_qty.status_code, 400)
        self.assertIn("vượt quá số lượng còn lại", str(res_exceed_qty.data))

        # Valid order creation (Order 6 out of 10)
        res_po = self.client.post(order_url, {"lines": [{"contract_line_id": line_id, "quantity": "6"}]}, format="json")
        self.assertEqual(res_po.status_code, 201)
        po_number = res_po.data["number"]
        self.assertTrue(po_number)

        # Check contract progress updated (Step 31)
        refreshed = self.client.get(detail)
        # Unit price 100, disc 10% -> 90 each, VAT 10% -> 99 each * 6 = 594
        self.assertEqual(Decimal(refreshed.data["ordered_amount"]), Decimal("594.0000"))
        self.assertEqual(Decimal(refreshed.data["remaining_amount"]), Decimal("396.0000"))
        self.assertEqual(Decimal(refreshed.data["lines"][0]["ordered_quantity"]), Decimal("6.0000"))
        self.assertEqual(Decimal(refreshed.data["lines"][0]["remaining_quantity"]), Decimal("4.0000"))

        # BR16: Supplier and currency on PO match contract
        po = PurchaseOrder.objects.get(number=po_number)
        self.assertEqual(po.supplier, self.supplier)
        self.assertEqual(po.currency, self.company.accounting_currency)

    def test_16_contract_execution_summary_step_32(self):
        """Step 32: Theo dõi quá trình thực hiện hợp đồng."""
        res = self.client.post(self.url, self.contract_payload(), format="json")
        cid = res.data["id"]
        detail = f"/api/v1/purchases/purchase-contracts/{cid}/?company_id={self.company.pk}"
        self.client.post(detail.replace("/?", "/confirm/?"), format="json")

        line_id = res.data["lines"][0]["id"]
        order_url = detail.replace("/?", "/create-order/?")
        self.client.post(order_url, {"lines": [{"contract_line_id": line_id, "quantity": "5"}]}, format="json")

        exec_url = detail.replace("/?", "/execution/?")
        exec_res = self.client.get(exec_url)
        self.assertEqual(exec_res.status_code, 200)
        self.assertEqual(Decimal(exec_res.data["total_amount"]), Decimal("990.0000"))
        self.assertEqual(Decimal(exec_res.data["ordered_amount"]), Decimal("495.0000"))
        self.assertEqual(Decimal(exec_res.data["remaining_amount"]), Decimal("495.0000"))
        self.assertEqual(Decimal(exec_res.data["progress_percent"]), Decimal("50.00"))
        self.assertEqual(len(exec_res.data["orders"]), 1)
        self.assertEqual(len(exec_res.data["lines"]), 1)

    def test_17_complete_contract_af05(self):
        """AF05: Hoàn thành hợp đồng và yêu cầu lý do nếu chưa thực hiện hết."""
        res = self.client.post(self.url, self.contract_payload(), format="json")
        cid = res.data["id"]
        detail = f"/api/v1/purchases/purchase-contracts/{cid}/?company_id={self.company.pk}"
        self.client.post(detail.replace("/?", "/confirm/?"), format="json")

        complete_url = detail.replace("/?", "/complete/?")

        # Ordered amount is 0 < total amount 990 -> Reason is required
        err_no_reason = self.client.post(complete_url, {"reason": ""}, format="json")
        self.assertEqual(err_no_reason.status_code, 400)
        self.assertIn("Vui lòng nhập lý do hoàn thành trước hạn.", str(err_no_reason.data))

        # Complete with reason
        comp_res = self.client.post(complete_url, {"reason": "Hai bên thỏa thuận dừng cung cấp"}, format="json")
        self.assertEqual(comp_res.status_code, 200)
        self.assertEqual(comp_res.data["status"], DocumentStatus.COMPLETED)

        # Completed contract cannot create orders (AF05 Bước 4)
        order_url = detail.replace("/?", "/create-order/?")
        res_blocked = self.client.post(order_url, {"lines": [{"contract_line_id": res.data["lines"][0]["id"], "quantity": "1"}]}, format="json")
        self.assertEqual(res_blocked.status_code, 400)

    def test_18_cancel_contract_af06_ex13(self):
        """AF06, EX13: Hủy hợp đồng yêu cầu lý do và chặn nếu đã có đơn mua hàng."""
        res = self.client.post(self.url, self.contract_payload(), format="json")
        cid = res.data["id"]
        detail = f"/api/v1/purchases/purchase-contracts/{cid}/?company_id={self.company.pk}"
        cancel_url = detail.replace("/?", "/cancel/?")

        # Missing reason -> error
        err_no_reason = self.client.post(cancel_url, {"reason": ""}, format="json")
        self.assertEqual(err_no_reason.status_code, 400)
        self.assertIn("Vui lòng nhập lý do hủy.", str(err_no_reason.data))

        # Confirm and create order
        self.client.post(detail.replace("/?", "/confirm/?"), format="json")
        order_url = detail.replace("/?", "/create-order/?")
        self.client.post(order_url, {"lines": [{"contract_line_id": res.data["lines"][0]["id"], "quantity": "2"}]}, format="json")

        # Cancel blocked because linked active order exists (EX13)
        err_has_order = self.client.post(cancel_url, {"reason": "Hủy hợp đồng"}, format="json")
        self.assertEqual(err_has_order.status_code, 400)
        self.assertIn("Không thể hủy hợp đồng đã có đơn mua hàng liên quan", str(err_has_order.data))

    def test_19_delete_contract_af07_br19(self):
        """AF07, BR19: Xóa hợp đồng chỉ áp dụng cho Chưa phê duyệt và chưa có đơn mua."""
        # 1. Successful deletion of DRAFT
        res = self.client.post(self.url, self.contract_payload(), format="json")
        cid = res.data["id"]
        detail = f"/api/v1/purchases/purchase-contracts/{cid}/?company_id={self.company.pk}"

        del_res = self.client.delete(detail)
        self.assertEqual(del_res.status_code, 200)
        self.assertEqual(del_res.data["message"], "Xóa hợp đồng mua hàng thành công.")
        self.assertFalse(PurchaseContract.objects.filter(pk=cid).exists())

        # 2. Approved contract cannot be deleted
        res2 = self.client.post(self.url, self.contract_payload(), format="json")
        cid2 = res2.data["id"]
        detail2 = f"/api/v1/purchases/purchase-contracts/{cid2}/?company_id={self.company.pk}"
        self.client.post(detail2.replace("/?", "/confirm/?"), format="json")

        del_app = self.client.delete(detail2)
        self.assertEqual(del_app.status_code, 400)
        self.assertIn("Chỉ hợp đồng Chưa phê duyệt mới được xóa.", str(del_app.data))

    def test_20_expired_contract_br20(self):
        """BR20: Hợp đồng quá hạn chuyển sang Hết hiệu lực."""
        past_date = self.day - timedelta(days=20)
        res = self.client.post(
            self.url,
            self.contract_payload(
                start_date=str(past_date - timedelta(days=10)),
                end_date=str(past_date),
            ),
            format="json",
        )
        cid = res.data["id"]
        detail = f"/api/v1/purchases/purchase-contracts/{cid}/?company_id={self.company.pk}"
        # Set to approved directly
        contract = PurchaseContract.objects.get(pk=cid)
        contract.status = DocumentStatus.APPROVED
        contract.save()

        # Querying contracts triggers expiration check
        list_res = self.client.get(self.url)
        contract.refresh_from_db()
        self.assertEqual(contract.status, DocumentStatus.EXPIRED)

        # Expired contract cannot create order
        order_url = detail.replace("/?", "/create-order/?")
        res_blocked = self.client.post(order_url, {"lines": [{"contract_line_id": res.data["lines"][0]["id"], "quantity": "1"}]}, format="json")
        self.assertEqual(res_blocked.status_code, 400)

    def test_21_search_and_filter_af01(self):
        """AF01: Tìm kiếm và lọc hợp đồng."""
        res1 = self.client.post(self.url, self.contract_payload(title="Hợp đồng xi măng"), format="json")
        res2 = self.client.post(self.url, self.contract_payload(title="Hợp đồng sắt thép"), format="json")

        # Search by title keyword
        search_res = self.client.get(f"{self.url}&q=xi+măng")
        self.assertEqual(search_res.status_code, 200)
        results = search_res.data["results"] if "results" in search_res.data else search_res.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["title"], "Hợp đồng xi măng")

        # Filter by status
        status_res = self.client.get(f"{self.url}&status=DRAFT")
        self.assertEqual(status_res.status_code, 200)
        results = status_res.data["results"] if "results" in status_res.data else status_res.data
        self.assertGreaterEqual(len(results), 2)

    def test_22_iam_permission_enforcement_ex14(self):
        """EX14: Từ chối thao tác và hiển thị 'Bạn không có quyền thực hiện chức năng này.'"""
        # Unauthenticated -> 401
        anon_client = APIClient()
        res_anon = anon_client.get(self.url)
        self.assertEqual(res_anon.status_code, 401)

        # User without contract permissions -> 403 with message EX14
        user_noperm = get_user_model().objects.create_user(
            username="noperm-user",
            email="noperm@example.test",
            password="password",
        )
        noperm_client = APIClient()
        noperm_client.force_authenticate(user_noperm)

        res_noperm_view = noperm_client.get(self.url)
        self.assertEqual(res_noperm_view.status_code, 403)
        self.assertEqual(res_noperm_view.data["detail"], "Bạn không có quyền thực hiện chức năng này.")

        res_noperm_create = noperm_client.post(self.url, self.contract_payload(), format="json")
        self.assertEqual(res_noperm_create.status_code, 403)
        self.assertEqual(res_noperm_create.data["detail"], "Bạn không có quyền thực hiện chức năng này.")

    def test_23_no_accounting_entries_br21(self):
        """BR21: Hợp đồng mua hàng không tạo bút toán kế toán."""
        entries_before = JournalEntry.objects.filter(company=self.company).count()
        res = self.client.post(self.url, self.contract_payload(), format="json")
        cid = res.data["id"]
        detail = f"/api/v1/purchases/purchase-contracts/{cid}/?company_id={self.company.pk}"
        self.client.post(detail.replace("/?", "/confirm/?"), format="json")

        entries_after = JournalEntry.objects.filter(company=self.company).count()
        self.assertEqual(entries_before, entries_after)
