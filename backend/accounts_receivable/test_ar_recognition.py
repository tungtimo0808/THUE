from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from audit_log.models import AuditLog
from master_data.models import Currency, Party, PartyRole, PaymentTerm
from organization.models import Branch, Company
from general_ledger.models import Account, AccountNature, AccountStatus, AccountingPeriod, ChartOfAccounts, JournalEntry, JournalLine, NormalBalance
from iam.models import CompanyMembership, Permission, Role, RolePermission, UserAccount, UserRoleAssignment
from .models import DocumentStatus, Receivable, ReceivableSchedule, ReceivableScheduleHistory, ReceivableStatus


class ArRecognitionTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.currency = Currency.objects.get(code="VND")
        self.company = Company.objects.create(
            code="TEST_AR_CO",
            name="Test AR Company",
            legal_name="Test AR Company Ltd",
            tax_code="0109999888",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="B1", name="Chi nhánh 1")
        self.customer = Party.objects.create(
            company=self.company,
            code="KH_TEST_01",
            name="Công ty TNHH Khách Hàng Test",
            tax_code="0108888777",
            default_currency=self.currency,
        )
        PartyRole.objects.create(party=self.customer, role_type="CUSTOMER", active_from=self.today)

        # Accounts & Chart of Accounts
        self.chart = ChartOfAccounts.objects.create(
            company=self.company,
            code="COA-TEST",
            name="Hệ thống tài khoản kiểm thử",
            effective_from=self.today,
            is_default=True,
        )
        self.account_131 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            code="131",
            name="Phải thu của khách hàng",
            account_type=AccountNature.ASSET,
            normal_balance=NormalBalance.DEBIT,
            status=AccountStatus.ACTIVE,
        )
        self.account_511 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            code="511",
            name="Doanh thu bán hàng",
            account_type=AccountNature.REVENUE,
            normal_balance=NormalBalance.CREDIT,
            status=AccountStatus.ACTIVE,
        )

        # Period for GL
        self.period = AccountingPeriod.objects.create(
            company=self.company,
            code=f"P-{self.today.year}-{self.today.month:02d}",
            fiscal_year=self.today.year,
            period_number=self.today.month,
            start_date=self.today.replace(day=1),
            end_date=self.today.replace(day=28),
            status="OPEN",
        )

        # Users
        self.maker_user = get_user_model().objects.create_superuser(
            username="ar_maker", email="ar_maker@example.com", password="pass"
        )
        self.approver_user = get_user_model().objects.create_superuser(
            username="ar_approver", email="ar_approver@example.com", password="pass"
        )
        self.admin_user = self.maker_user
        self.staff_user = get_user_model().objects.create_user(
            username="ar_staff", email="ar_staff@example.com", password="pass"
        )
        self.staff_account = self.staff_user.iam_account
        self.staff_membership = CompanyMembership.objects.create(
            company=self.company, user=self.staff_account, created_by=self.maker_user.iam_account
        )

        self.client = APIClient()
        self.client.force_authenticate(self.maker_user)
        self.query = f"?company_id={self.company.id}"

    def create_posted_receivable_document(self, number="DOC-001", amount=Decimal("1000000"), due_days=30):
        self.client.force_authenticate(self.maker_user)
        doc = self.client.post(
            f"/api/v1/accounts-receivable/documents/{self.query}",
            {
                "company": str(self.company.id),
                "branch": str(self.branch.id),
                "number": number,
                "document_type": "SALES_INVOICE",
                "document_date": str(self.today),
                "posting_date": str(self.today),
                "due_date": str(self.today + timedelta(days=due_days)),
                "customer": str(self.customer.id),
                "currency": str(self.currency.id),
                "exchange_rate": "1",
                "amount": str(amount),
                "description": f"Hóa đơn bán hàng {number}",
            },
            format="json",
        )
        self.assertEqual(doc.status_code, 201, doc.data)
        doc_id = doc.data["id"]

        submitted = self.client.post(f"/api/v1/accounts-receivable/documents/{doc_id}/submit/{self.query}", {}, format="json")
        self.assertEqual(submitted.status_code, 200, submitted.data)
        self.client.force_authenticate(self.approver_user)
        approved = self.client.post(f"/api/v1/accounts-receivable/documents/{doc_id}/approve/{self.query}", {"comment": "OK"}, format="json")
        self.assertEqual(approved.status_code, 200, approved.data)
        posted = self.client.post(f"/api/v1/accounts-receivable/documents/{doc_id}/post/{self.query}", {"posting_reference": f"GL-{number}"}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        self.client.force_authenticate(self.maker_user)
        return doc_id

    def create_posted_journal_entry(self, number="JE-001", amount=Decimal("2000000")):
        je = JournalEntry.objects.create(
            company=self.company,
            branch=self.branch,
            period=self.period,
            number=number,
            entry_type="MANUAL",
            posting_date=self.today,
            document_date=self.today,
            description=f"Chứng từ kế toán bán hàng {number}",
            status="POSTED",
            total_debit=amount,
            total_credit=amount,
            created_by=self.maker_user.iam_account,
        )
        JournalLine.objects.create(
            entry=je,
            line_no=1,
            account=self.account_131,
            description=f"Phải thu khách hàng {number}",
            debit=amount,
            credit=Decimal("0"),
            currency=self.currency,
            exchange_rate=Decimal("1"),
            party=self.customer,
        )
        JournalLine.objects.create(
            entry=je,
            line_no=2,
            account=self.account_511,
            description=f"Doanh thu {number}",
            debit=Decimal("0"),
            credit=amount,
            currency=self.currency,
            exchange_rate=Decimal("1"),
        )
        return je

    def test_unrecognized_sources_listing_and_filtering(self):
        """
        UC-AR-01 Luồng chính Bước 1-3:
        Kiểm tra danh sách chứng từ nguồn đã ghi sổ nhưng chưa ghi nhận công nợ.
        """
        # Create posted document and posted journal entry
        doc_id = self.create_posted_receivable_document("DOC-UNREC-01", amount=Decimal("1500000"))
        # Auto-recognition from post_document creates a receivable, so delete it to simulate unrecorded state
        Receivable.objects.filter(document_id=doc_id).delete()

        je = self.create_posted_journal_entry("JE-UNREC-01", amount=Decimal("2500000"))

        res = self.client.get(f"/api/v1/accounts-receivable/receivables/unrecognized-sources/{self.query}")
        self.assertEqual(res.status_code, 200)
        sources = res.data
        self.assertGreaterEqual(len(sources), 2)

        doc_source = next((s for s in sources if s["source_document_id"] == str(doc_id)), None)
        self.assertIsNotNone(doc_source)
        self.assertEqual(doc_source["source_document_type"], "AR_DOCUMENT")
        self.assertEqual(Decimal(doc_source["original_amount"]), Decimal("1500000"))
        self.assertEqual(doc_source["customer_id"], str(self.customer.id))

        je_source = next((s for s in sources if s["source_document_id"] == str(je.id)), None)
        self.assertIsNotNone(je_source)
        self.assertEqual(je_source["source_document_type"], "JOURNAL_ENTRY")
        self.assertEqual(Decimal(je_source["original_amount"]), Decimal("2500000"))
        self.assertEqual(je_source["account_code"], "131")

        # Test search filter
        search_res = self.client.get(f"/api/v1/accounts-receivable/receivables/unrecognized-sources/{self.query}&search=JE-UNREC-01")
        self.assertEqual(search_res.status_code, 200)
        self.assertEqual(len(search_res.data), 1)
        self.assertEqual(search_res.data[0]["source_document_number"], "JE-UNREC-01")

    def test_recognize_from_receivable_document_single_and_split_schedule(self):
        """
        UC-AR-01 Luồng chính Bước 4-7:
        Ghi nhận từ chứng từ có 1 đợt hoặc chia nhiều đợt thanh toán.
        BR-AR-01-04, BR-AR-01-05, BR-AR-01-06, BR-AR-01-14, BR-AR-01-15.
        """
        doc_id = self.create_posted_receivable_document("DOC-MANUAL-01", amount=Decimal("1000000"))
        Receivable.objects.filter(document_id=doc_id).delete()

        # Step 4-6: Recognize with split payment schedules (2 đợt: 600k and 400k)
        payload = {
            "company": str(self.company.id),
            "source_document_type": "AR_DOCUMENT",
            "source_document_id": str(doc_id),
            "description": "Ghi nhận công nợ đơn hàng 01",
            "schedules": [
                {
                    "installment_no": 1,
                    "amount": "600000",
                    "due_date": str(self.today + timedelta(days=15)),
                    "notes": "Đợt 1 - 60%",
                },
                {
                    "installment_no": 2,
                    "amount": "400000",
                    "due_date": str(self.today + timedelta(days=30)),
                    "notes": "Đợt 2 - 40%",
                },
            ],
        }
        res = self.client.post(f"/api/v1/accounts-receivable/receivables/recognize/{self.query}", payload, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        data = res.data
        self.assertTrue(data["code"].startswith(f"AR-{self.today.year}-"))
        self.assertEqual(Decimal(str(data["original_amount"])), Decimal("1000000"))
        self.assertEqual(Decimal(str(data["balance"])), Decimal("1000000"))
        self.assertEqual(data["status"], "OPEN")
        self.assertEqual(len(data["schedules"]), 2)
        self.assertEqual(Decimal(str(data["schedules"][0]["amount"])), Decimal("600000"))
        self.assertEqual(Decimal(str(data["schedules"][1]["amount"])), Decimal("400000"))

        # Verify Audit Log recorded (BR-AR-01-15)
        self.assertTrue(AuditLog.objects.filter(company=self.company, action_code="RECOGNIZE").exists())

    def test_recognize_from_journal_entry(self):
        """
        UC-AR-01: Ghi nhận công nợ từ chứng từ sổ cái (JournalEntry).
        BR-AR-01-02, BR-AR-01-04, BR-AR-01-14.
        """
        je = self.create_posted_journal_entry("JE-REC-01", amount=Decimal("3000000"))
        line = je.lines.filter(debit__gt=0).first()

        payload = {
            "company": str(self.company.id),
            "source_document_type": "JOURNAL_ENTRY",
            "source_document_id": str(je.id),
            "source_line_id": str(line.id),
            "due_date": str(self.today + timedelta(days=20)),
            "description": "Công nợ từ sổ cái bán lẻ",
        }
        res = self.client.post(f"/api/v1/accounts-receivable/receivables/recognize/{self.query}", payload, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(Decimal(str(res.data["original_amount"])), Decimal("3000000"))
        self.assertEqual(str(res.data["journal_entry"]), str(je.id))
        self.assertEqual(str(res.data["account"]), str(self.account_131.id))
        # 1 default installment
        self.assertEqual(len(res.data["schedules"]), 1)
        self.assertEqual(Decimal(str(res.data["schedules"][0]["amount"])), Decimal("3000000"))

    def test_auto_recognition_on_post_document_af01(self):
        """
        AF-01: Ghi nhận tự động khi User ghi sổ chứng từ bán hàng.
        """
        doc_id = self.create_posted_receivable_document("DOC-AUTO-01", amount=Decimal("5000000"))
        # Verify receivable auto created
        rec = Receivable.objects.filter(document_id=doc_id).first()
        self.assertIsNotNone(rec)
        self.assertEqual(rec.original_amount, Decimal("5000000"))
        self.assertEqual(rec.status, ReceivableStatus.OPEN)
        self.assertTrue(rec.code.startswith(f"AR-{self.today.year}-"))
        self.assertEqual(rec.schedules.count(), 1)
        self.assertEqual(rec.schedules.first().amount, Decimal("5000000"))

        # Check it does NOT appear in unrecognized sources
        unrec = self.client.get(f"/api/v1/accounts-receivable/receivables/unrecognized-sources/{self.query}")
        doc_ids = [s["source_document_id"] for s in unrec.data]
        self.assertNotIn(str(doc_id), doc_ids)

    def test_by_source_lookup_af02(self):
        """
        AF-02: Mở từ chứng từ nguồn (Xem công nợ).
        """
        doc_id = self.create_posted_receivable_document("DOC-BYSOURCE-01", amount=Decimal("700000"))
        Receivable.objects.filter(document_id=doc_id).delete()

        # Before recognition -> exists: False, can_recognize: True
        res_before = self.client.get(
            f"/api/v1/accounts-receivable/receivables/by-source/{self.query}&source_type=AR_DOCUMENT&source_id={doc_id}"
        )
        self.assertEqual(res_before.status_code, 200)
        self.assertFalse(res_before.data["exists"])
        self.assertTrue(res_before.data["can_recognize"])
        self.assertEqual(res_before.data["source_data"]["source_document_id"], str(doc_id))

        # Recognize
        self.client.post(
            f"/api/v1/accounts-receivable/receivables/recognize/{self.query}",
            {
                "company": str(self.company.id),
                "source_document_type": "AR_DOCUMENT",
                "source_document_id": str(doc_id),
            },
            format="json",
        )

        # After recognition -> exists: True, receivable provided
        res_after = self.client.get(
            f"/api/v1/accounts-receivable/receivables/by-source/{self.query}&source_type=AR_DOCUMENT&source_id={doc_id}"
        )
        self.assertEqual(res_after.status_code, 200)
        self.assertTrue(res_after.data["exists"])
        self.assertEqual(Decimal(str(res_after.data["receivable"]["original_amount"])), Decimal("700000"))

    def test_bulk_recognize_af04(self):
        """
        AF-04: Ghi nhận nhiều chứng từ (Bulk recognize).
        """
        doc1 = self.create_posted_receivable_document("DOC-BULK-01", amount=Decimal("1000000"))
        Receivable.objects.filter(document_id=doc1).delete()

        doc2 = self.create_posted_receivable_document("DOC-BULK-02", amount=Decimal("2000000"))
        Receivable.objects.filter(document_id=doc2).delete()

        # First recognize doc1
        self.client.post(
            f"/api/v1/accounts-receivable/receivables/recognize/{self.query}",
            {"company": str(self.company.id), "source_document_type": "AR_DOCUMENT", "source_document_id": str(doc1)},
            format="json",
        )

        # Bulk submit both doc1 (duplicate) and doc2 (new)
        payload = {
            "company": str(self.company.id),
            "items": [
                {"company": str(self.company.id), "source_document_type": "AR_DOCUMENT", "source_document_id": str(doc1)},
                {"company": str(self.company.id), "source_document_type": "AR_DOCUMENT", "source_document_id": str(doc2)},
            ],
        }
        res = self.client.post(f"/api/v1/accounts-receivable/receivables/bulk-recognize/{self.query}", payload, format="json")
        self.assertEqual(res.status_code, 200)
        results = res.data["results"]
        self.assertEqual(len(results), 2)
        # First failed (duplicate)
        self.assertFalse(results[0]["success"])
        self.assertIn("đã được ghi nhận", str(results[0]["error"]))
        # Second succeeded
        self.assertTrue(results[1]["success"])
        self.assertIsNotNone(results[1]["receivable_id"])

    def test_update_payment_schedule_and_history_af05(self):
        """
        AF-05 & BR-AR-01-07: Sửa lịch thanh toán, lưu lịch sử, kiểm tra bảo toàn số tiền.
        """
        doc_id = self.create_posted_receivable_document("DOC-SCHED-01", amount=Decimal("1200000"))
        rec = Receivable.objects.get(document_id=doc_id)

        # Update into 3 installments (500k, 400k, 300k) with reason
        payload = {
            "reason": "Khách hàng thỏa thuận lại tiến độ thanh toán theo hợp đồng sửa đổi",
            "schedules": [
                {"installment_no": 1, "amount": "500000", "due_date": str(self.today + timedelta(days=10)), "notes": "Đợt 1"},
                {"installment_no": 2, "amount": "400000", "due_date": str(self.today + timedelta(days=20)), "notes": "Đợt 2"},
                {"installment_no": 3, "amount": "300000", "due_date": str(self.today + timedelta(days=30)), "notes": "Đợt 3"},
            ],
        }
        res = self.client.post(f"/api/v1/accounts-receivable/receivables/{rec.id}/update-schedule/{self.query}", payload, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(len(res.data["schedules"]), 3)

        # Verify history is saved
        hist = ReceivableScheduleHistory.objects.filter(receivable=rec).first()
        self.assertIsNotNone(hist)
        self.assertEqual(hist.reason, payload["reason"])
        self.assertEqual(len(hist.new_schedule), 3)

        # Rejection when sum does not match (EF-05)
        bad_sum_payload = {
            "reason": "Điều chỉnh sai tổng",
            "schedules": [
                {"installment_no": 1, "amount": "500000", "due_date": str(self.today + timedelta(days=10))},
                {"installment_no": 2, "amount": "500000", "due_date": str(self.today + timedelta(days=20))},
            ],
        }
        bad_res = self.client.post(f"/api/v1/accounts-receivable/receivables/{rec.id}/update-schedule/{self.query}", bad_sum_payload, format="json")
        self.assertEqual(bad_res.status_code, 400)
        self.assertIn("Tổng số tiền các đợt", str(bad_res.data))

        # Rejection when reason is missing (BR-AR-01-07)
        no_reason_payload = {
            "reason": "   ",
            "schedules": payload["schedules"],
        }
        no_res = self.client.post(f"/api/v1/accounts-receivable/receivables/{rec.id}/update-schedule/{self.query}", no_reason_payload, format="json")
        self.assertEqual(no_res.status_code, 400)

    def test_receipt_allocation_updates_installments_af06(self):
        """
        AF-06 & BR-AR-01-08: Thu tiền cập nhật tuần tự các đợt của lịch thanh toán.
        """
        doc_id = self.create_posted_receivable_document("DOC-ALLOC-01", amount=Decimal("1000000"))
        rec = Receivable.objects.get(document_id=doc_id)

        # Split into 2 installments: 400k and 600k
        self.client.post(
            f"/api/v1/accounts-receivable/receivables/{rec.id}/update-schedule/{self.query}",
            {
                "reason": "Chia đợt",
                "schedules": [
                    {"installment_no": 1, "amount": "400000", "due_date": str(self.today + timedelta(days=10))},
                    {"installment_no": 2, "amount": "600000", "due_date": str(self.today + timedelta(days=20))},
                ],
            },
            format="json",
        )

        # Create Receipt for 500k and allocate to receivable
        receipt = self.client.post(
            f"/api/v1/accounts-receivable/receipts/{self.query}",
            {
                "company": str(self.company.id),
                "customer": str(self.customer.id),
                "currency": str(self.currency.id),
                "receipt_date": str(self.today),
                "amount": "500000",
                "external_type": "BANK",
                "external_reference": "BANK-ALLOC-01",
            },
            format="json",
        )
        self.assertEqual(receipt.status_code, 201)
        receipt_id = receipt.data["id"]

        alloc = self.client.post(
            f"/api/v1/accounts-receivable/receipts/{receipt_id}/allocate/{self.query}",
            {"allocations": [{"receivable": str(rec.id), "amount": "500000"}]},
            format="json",
        )
        self.assertEqual(alloc.status_code, 200)

        # Refresh and verify schedules
        rec.refresh_from_db()
        self.assertEqual(rec.collected_amount, Decimal("500000"))
        self.assertEqual(rec.balance, Decimal("500000"))
        self.assertEqual(rec.status, ReceivableStatus.PARTIALLY_PAID)

        schedules = list(rec.schedules.all().order_by("installment_no"))
        # Installment 1 (400k) paid completely
        self.assertEqual(schedules[0].collected_amount, Decimal("400000"))
        self.assertEqual(schedules[0].balance, Decimal("0"))
        self.assertEqual(schedules[0].status, ReceivableStatus.PAID)

        # Installment 2 (600k) partially paid with 100k
        self.assertEqual(schedules[1].collected_amount, Decimal("100000"))
        self.assertEqual(schedules[1].balance, Decimal("500000"))
        self.assertEqual(schedules[1].status, ReceivableStatus.PARTIALLY_PAID)

        # Attempt to reduce installment 1 below collected amount -> rejected (AF-05 constraint)
        reduce_res = self.client.post(
            f"/api/v1/accounts-receivable/receivables/{rec.id}/update-schedule/{self.query}",
            {
                "reason": "Thử giảm dưới mức đã thu",
                "schedules": [
                    {"installment_no": 1, "amount": "300000", "due_date": str(self.today + timedelta(days=10))},
                    {"installment_no": 2, "amount": "700000", "due_date": str(self.today + timedelta(days=20))},
                ],
            },
            format="json",
        )
        self.assertEqual(reduce_res.status_code, 400)
        self.assertIn("không được nhỏ hơn số đã thu", str(reduce_res.data))

    def test_reverse_receivable_and_ef08_constraint(self):
        """
        AF-07 & EF-08: Hủy ghi nhận và chặn hủy khi đã có thu tiền/đối trừ.
        """
        doc_id = self.create_posted_receivable_document("DOC-REV-01", amount=Decimal("800000"))
        rec = Receivable.objects.get(document_id=doc_id)

        # Collect 200k
        receipt = self.client.post(
            f"/api/v1/accounts-receivable/receipts/{self.query}",
            {
                "company": str(self.company.id),
                "customer": str(self.customer.id),
                "currency": str(self.currency.id),
                "receipt_date": str(self.today),
                "amount": "200000",
                "external_type": "BANK",
                "external_reference": "BANK-REV-01",
            },
            format="json",
        )
        self.client.post(
            f"/api/v1/accounts-receivable/receipts/{receipt.data['id']}/allocate/{self.query}",
            {"allocations": [{"receivable": str(rec.id), "amount": "200000"}]},
            format="json",
        )

        # Attempt to reverse -> must be rejected with EF-08 error
        rev_fail = self.client.post(
            f"/api/v1/accounts-receivable/receivables/{rec.id}/reverse/{self.query}",
            {"reason": "Hủy giao dịch"},
            format="json",
        )
        self.assertEqual(rev_fail.status_code, 400)
        self.assertIn("Không thể hủy hoặc bỏ ghi nhận khoản phải thu khi đã có khoản thanh toán", str(rev_fail.data))

        # Reversing a receivable without payments -> succeeds
        doc_id2 = self.create_posted_receivable_document("DOC-REV-02", amount=Decimal("500000"))
        rec2 = Receivable.objects.get(document_id=doc_id2)
        rev_ok = self.client.post(
            f"/api/v1/accounts-receivable/receivables/{rec2.id}/reverse/{self.query}",
            {"reason": "Hóa đơn sai thông tin đã bị hủy"},
            format="json",
        )
        self.assertEqual(rev_ok.status_code, 200)
        rec2.refresh_from_db()
        self.assertEqual(rec2.status, ReceivableStatus.REVERSED)
        self.assertEqual(rec2.balance, Decimal("0"))
        self.assertEqual(rec2.schedules.first().status, ReceivableStatus.REVERSED)

    def test_rejection_unposted_source_ef02(self):
        """
        EF-02: Nguồn chưa ghi sổ hoặc không còn hiệu lực.
        """
        # Create DRAFT document
        created = self.client.post(
            f"/api/v1/accounts-receivable/documents/{self.query}",
            {
                "company": str(self.company.id),
                "branch": str(self.branch.id),
                "number": "DOC-DRAFT-01",
                "document_type": "SALES_INVOICE",
                "document_date": str(self.today),
                "posting_date": str(self.today),
                "due_date": str(self.today + timedelta(days=30)),
                "customer": str(self.customer.id),
                "currency": str(self.currency.id),
                "exchange_rate": "1",
                "amount": "1000000",
                "description": "Bản nháp",
            },
            format="json",
        )
        draft_id = created.data["id"]

        res = self.client.post(
            f"/api/v1/accounts-receivable/receivables/recognize/{self.query}",
            {
                "company": str(self.company.id),
                "source_document_type": "AR_DOCUMENT",
                "source_document_id": draft_id,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("Chứng từ nguồn chưa được ghi sổ", str(res.data))

    def test_duplicate_recognition_prevention_ef04_br05(self):
        """
        EF-04 & BR-AR-01-05: Chống ghi nhận trùng theo nguồn.
        """
        doc_id = self.create_posted_receivable_document("DOC-DUP-01", amount=Decimal("1000000"))
        # Auto-created once. Trying to recognize again manually:
        res = self.client.post(
            f"/api/v1/accounts-receivable/receivables/recognize/{self.query}",
            {
                "company": str(self.company.id),
                "source_document_type": "AR_DOCUMENT",
                "source_document_id": str(doc_id),
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("đã được ghi nhận", str(res.data))

    def test_overdue_warning_br12(self):
        """
        BR-AR-01-12: Cảnh báo quá hạn khi ngày hiện tại sau hạn của đợt còn phải thu > 0.
        Khoản đã tất toán không cảnh báo quá hạn.
        """
        doc_id = self.create_posted_receivable_document("DOC-OVERDUE-01", amount=Decimal("500000"), due_days=10)
        rec = Receivable.objects.get(document_id=doc_id)

        # Set due_date in past
        rec.due_date = self.today - timedelta(days=5)
        rec.save(update_fields=("due_date",))
        rec.schedules.update(due_date=self.today - timedelta(days=5))

        self.assertTrue(rec.is_overdue)

        # Pay completely
        receipt = self.client.post(
            f"/api/v1/accounts-receivable/receipts/{self.query}",
            {
                "company": str(self.company.id),
                "customer": str(self.customer.id),
                "currency": str(self.currency.id),
                "receipt_date": str(self.today),
                "amount": "500000",
                "external_type": "BANK",
                "external_reference": "BANK-OVERDUE-01",
            },
            format="json",
        )
        self.client.post(
            f"/api/v1/accounts-receivable/receipts/{receipt.data['id']}/allocate/{self.query}",
            {"allocations": [{"receivable": str(rec.id), "amount": "500000"}]},
            format="json",
        )

        rec.refresh_from_db()
        self.assertEqual(rec.status, ReceivableStatus.PAID)
        self.assertFalse(rec.is_overdue)

    def test_permission_checks_ef01_br01(self):
        """
        EF-01 & BR-AR-01-01: Kiểm tra quyền phân quyền IAM.
        """
        doc_id = self.create_posted_receivable_document("DOC-PERM-01", amount=Decimal("1000000"))
        Receivable.objects.filter(document_id=doc_id).delete()

        staff_client = APIClient()
        staff_client.force_authenticate(self.staff_user)

        # Staff has no AR.RECEIVABLE.CREATE -> 403 Forbidden
        denied = staff_client.post(
            f"/api/v1/accounts-receivable/receivables/recognize/{self.query}",
            {
                "company": str(self.company.id),
                "source_document_type": "AR_DOCUMENT",
                "source_document_id": str(doc_id),
            },
            format="json",
        )
        self.assertEqual(denied.status_code, 403)

        # Grant AR.RECEIVABLE.CREATE permission to staff
        role = Role.objects.create(company=self.company, name="AR Accountant", code="AR_ACC", status="ACTIVE")
        perm = Permission.objects.get(code="AR.RECEIVABLE.CREATE")
        RolePermission.objects.create(role=role, permission=perm, effect="ALLOW")
        UserRoleAssignment.objects.create(
            company_membership=self.staff_membership,
            role=role,
            status="ACTIVE",
            assigned_by=self.maker_user.iam_account,
            valid_from=timezone.now() - timedelta(minutes=1),
        )

        # Try again -> 201 Created
        allowed = staff_client.post(
            f"/api/v1/accounts-receivable/receivables/recognize/{self.query}",
            {
                "company": str(self.company.id),
                "source_document_type": "AR_DOCUMENT",
                "source_document_id": str(doc_id),
            },
            format="json",
        )
        self.assertEqual(allowed.status_code, 201)
