from decimal import Decimal
from django.db import IntegrityError, transaction
from django.db.models import Sum
from rest_framework import mixins
from rest_framework.exceptions import ValidationError
from rest_framework.decorators import action
from iam.permissions import CompanyMemberMixin, filter_queryset_by_branch
from rest_framework.filters import SearchFilter,OrderingFilter
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet,ReadOnlyModelViewSet
from . import models,serializers,services
from .permissions import CashPermission
from .receipt_validation import RECEIPT_TYPES
def perms(r):return {"GET":f"{r}.VIEW","POST":f"{r}.CREATE","PUT":f"{r}.EDIT","PATCH":f"{r}.EDIT","DELETE":f"{r}.EDIT"}
class BaseViewSet(mixins.CreateModelMixin,mixins.ListModelMixin,mixins.RetrieveModelMixin,mixins.UpdateModelMixin,mixins.DestroyModelMixin,GenericViewSet):
    permission_classes=(CashPermission,);filter_backends=(SearchFilter,OrderingFilter);ordering=("-created_at",)
    def get_queryset(self):
        company=self.request.query_params.get("company_id")
        if not company:return super().get_queryset().none()
        qs=super().get_queryset().filter(company_id=company)
        if status:=self.request.query_params.get("status"):qs=qs.filter(status=status)
        return filter_queryset_by_branch(qs, self.request, company)
    def perform_create(self,s):obj=s.save(created_by=services.actor(self.request));services.audit(self.request,obj,"CREATE",after=s.data)
    def perform_update(self,s):before=self.get_serializer(s.instance).data;obj=s.save();services.audit(self.request,obj,"EDIT",before,s.data)
class FundViewSet(BaseViewSet):
    queryset=models.CashFund.objects.select_related("company","branch","currency","keeper","gl_account");serializer_class=serializers.FundSerializer;iam_permissions=perms("CASH.FUND");search_fields=("code","name");ordering_fields=("code","balance","created_at")
    def perform_create(self,s):
        obj=s.save();services.audit(self.request,obj,"CREATE",after=s.data)
    @action(detail=True,methods=("get",),permission_classes=(CashPermission,))
    def ledger(self,request,pk=None):
        fund=self.get_object();qs=fund.transactions.filter(status=models.TransactionStatus.POSTED)
        if start:=request.query_params.get("date_from"):qs=qs.filter(transaction_date__gte=start)
        if end:=request.query_params.get("date_to"):qs=qs.filter(transaction_date__lte=end)
        income=qs.filter(transaction_type__in=["RECEIPT","ADVANCE_RETURN","ADJUSTMENT_IN"]).aggregate(v=Sum("amount"))["v"] or Decimal("0");expense=qs.exclude(transaction_type__in=["RECEIPT","ADVANCE_RETURN","ADJUSTMENT_IN"]).aggregate(v=Sum("amount"))["v"] or Decimal("0")
        return Response({"fund":str(fund.id),"currency":fund.currency.code,"total_receipts":income,"total_payments":expense,"current_balance":fund.balance,"transactions":serializers.TransactionSerializer(qs,many=True).data})
class TransactionViewSet(BaseViewSet):
    queryset=models.CashTransaction.objects.select_related("company","fund","currency","party","created_by","cashier");serializer_class=serializers.TransactionSerializer;iam_permissions=perms("CASH.TRANSACTION");action_permissions={"submit":"CASH.TRANSACTION.SUBMIT","approve":"CASH.TRANSACTION.APPROVE","reject":"CASH.TRANSACTION.REJECT","confirm":"CASH.TRANSACTION.CONFIRM","reverse":"CASH.TRANSACTION.REVERSE","post_gl":"CASH.TRANSACTION.POST"};search_fields=("number","payer_payee","description","source_reference");ordering_fields=("transaction_date","amount","created_at")
    def perform_create(self, serializer):
        company = serializer.validated_data["company"]
        if str(company.pk) != self.request.query_params.get("company_id"):
            raise ValidationError({"company": "Doanh nghiệp không khớp phạm vi làm việc."})
        branch_id = self.request.query_params.get("branch_id")
        if serializer.validated_data.get("business_type") in RECEIPT_TYPES and not branch_id:
            raise ValidationError({"branch_id": "Vui lòng chọn chi nhánh đang làm việc."})
        if branch_id and str(serializer.validated_data["fund"].branch_id) != branch_id:
            raise ValidationError({"fund": "Quỹ không thuộc chi nhánh đang làm việc."})
        try:
            with transaction.atomic():
                super().perform_create(serializer)
        except IntegrityError as exc:
            raise ValidationError({"number": "Số phiếu đã tồn tại. Vui lòng tải lại và chọn số khác."}) from exc
    def perform_update(self, serializer):
        if "company" in serializer.validated_data and serializer.validated_data["company"].pk != serializer.instance.company_id:
            raise ValidationError({"company": "Không được chuyển phiếu sang doanh nghiệp khác."})
        if serializer.instance.business_type in RECEIPT_TYPES:
            fund = serializer.validated_data.get("fund", serializer.instance.fund)
            branch_id = self.request.query_params.get("branch_id") or str(fund.branch_id)
            if str(fund.branch_id) != branch_id:
                raise ValidationError({"branch_id": "Chi nhánh không khớp quỹ phiếu thu."})
        super().perform_update(serializer)
    def perform_destroy(self, instance):
        if instance.status == models.TransactionStatus.POSTED:
            raise ValidationError("Chứng từ đã ghi sổ không thể xóa. Vui lòng Bỏ ghi sổ trước khi xóa.")
        models.ApprovalDecision.objects.filter(transaction=instance).delete()
        instance.delete()
    @action(detail=True,methods=("post",))
    def submit(self,r,pk=None):return Response(self.get_serializer(services.submit(self.get_object(),r)).data)
    @action(detail=True,methods=("post",))
    def approve(self,r,pk=None):return Response(self.get_serializer(services.decide(self.get_object(),r,True)).data)
    @action(detail=True,methods=("post",))
    def reject(self,r,pk=None):return Response(self.get_serializer(services.decide(self.get_object(),r,False)).data)
    @action(detail=True,methods=("post",))
    def confirm(self,r,pk=None):return Response(self.get_serializer(services.confirm(self.get_object(),r)).data)
    @action(detail=True,methods=("post",),url_path="post-gl")
    def post_gl(self,r,pk=None):return Response(self.get_serializer(services.post_gl(self.get_object(),r)).data)
    @action(detail=True,methods=("post",))
    def reverse(self,r,pk=None):return Response(self.get_serializer(services.reverse(self.get_object(),r)).data)
class TransferViewSet(BaseViewSet):
    queryset=models.CashTransfer.objects.select_related("company","source_fund","destination_fund","bank_account","created_by");serializer_class=serializers.TransferSerializer;iam_permissions=perms("CASH.TRANSFER");action_permissions={"dispatch_transfer":"CASH.TRANSFER.TRANSFER","receive":"CASH.TRANSFER.CONFIRM"};search_fields=("number","bank_reference","description")
    @action(detail=True,methods=("post",),url_path="dispatch")
    def dispatch_transfer(self,r,pk=None):return Response(self.get_serializer(services.dispatch_transfer(self.get_object(),r)).data)
    @action(detail=True,methods=("post",))
    def receive(self,r,pk=None):return Response(self.get_serializer(services.receive_transfer(self.get_object(),r)).data)
class AdvanceViewSet(BaseViewSet):
    queryset=models.CashAdvance.objects.select_related("company","fund","recipient","created_by","disbursement");serializer_class=serializers.AdvanceSerializer;iam_permissions=perms("CASH.ADVANCE");action_permissions={"submit":"CASH.ADVANCE.SUBMIT","approve":"CASH.ADVANCE.APPROVE","reject":"CASH.ADVANCE.REJECT","disburse":"CASH.ADVANCE.CONFIRM","settle":"CASH.ADVANCE.SETTLE"};search_fields=("number","recipient__full_name","purpose")
    @action(detail=True,methods=("post",))
    def submit(self,r,pk=None):return Response(self.get_serializer(services.advance_action(self.get_object(),r,"submit")).data)
    @action(detail=True,methods=("post",))
    def approve(self,r,pk=None):return Response(self.get_serializer(services.advance_action(self.get_object(),r,"approve")).data)
    @action(detail=True,methods=("post",))
    def reject(self,r,pk=None):return Response(self.get_serializer(services.advance_action(self.get_object(),r,"reject")).data)
    @action(detail=True,methods=("post",))
    def disburse(self,r,pk=None):return Response(self.get_serializer(services.disburse_advance(self.get_object(),r)).data)
    @action(detail=True,methods=("post",))
    def settle(self,r,pk=None):return Response(self.get_serializer(services.settle_advance(self.get_object(),r)).data)
class SettlementViewSet(ReadOnlyModelViewSet):
    permission_classes=(CashPermission,);serializer_class=serializers.SettlementSerializer;queryset=models.AdvanceSettlement.objects.select_related("advance__company","created_by");iam_permissions={"GET":"CASH.ADVANCE.VIEW"}
    def get_queryset(self):
        c=self.request.query_params.get("company_id");return self.queryset.filter(advance__company_id=c) if c else self.queryset.none()
class CountViewSet(BaseViewSet):
    queryset=models.CashCount.objects.select_related("company","fund","adjustment","created_by");serializer_class=serializers.CountSerializer;iam_permissions=perms("CASH.COUNT");action_permissions={"confirm":"CASH.COUNT.COUNT","adjust":"CASH.COUNT.ADJUST"};search_fields=("number","reason","conclusion")
    @action(detail=True,methods=("post",))
    def confirm(self,r,pk=None):return Response(self.get_serializer(services.confirm_count(self.get_object(),r)).data)
    @action(detail=True,methods=("post",))
    def adjust(self,r,pk=None):return Response(self.get_serializer(services.adjust_count(self.get_object(),r)).data)
class RevaluationViewSet(BaseViewSet):
    queryset=models.FxRevaluation.objects.select_related("company","fund","created_by");serializer_class=serializers.FxRevaluationSerializer;iam_permissions=perms("CASH.REVALUATION");search_fields=("gl_reference",);ordering_fields=("revaluation_date","difference","created_at")
class ApprovalViewSet(ReadOnlyModelViewSet):
    permission_classes=(CashPermission,);serializer_class=serializers.ApprovalSerializer;queryset=models.ApprovalDecision.objects.select_related("company","transaction","actor");iam_permissions={"GET":"CASH.APPROVAL.VIEW"}
    def get_queryset(self):
        c=self.request.query_params.get("company_id");return self.queryset.filter(company_id=c) if c else self.queryset.none()


class ForecastViewSet(CompanyMemberMixin, GenericViewSet):
    """API quản lý Dự báo dòng tiền lưu trữ trực tiếp trong PostgreSQL (CoreCompanySetting.configuration)."""
    def list(self, request):
        from common_services.models import CoreCompanySetting
        company = self._resolve_company(request)
        if not company:
            return Response({"docs": [], "results": []})
        kind = request.query_params.get("kind") or "cash"
        setting, _ = CoreCompanySetting.objects.get_or_create(company=company)
        config = dict(setting.configuration or {})
        forecasts_by_kind = dict(config.get("cash_forecasts") or {})
        docs = forecasts_by_kind.get(kind)
        if docs is None:
            docs = [
                {
                    "id": f"fc-{kind}-2026-12",
                    "period": "Tháng này",
                    "from": "2026-12-01",
                    "to": "2026-12-31",
                    "rows": [
                        {"id": "r1", "group": "A", "name": "Tiền mặt", "amount": 500000000 if kind == "cash" else 0},
                        {"id": "r2", "group": "A", "name": "Tiền gửi ngân hàng", "amount": 7071750000 if kind == "bank" else 0},
                        {"id": "r3", "group": "A", "name": "Tiền đang chuyển", "amount": 0},
                        {"id": "r4", "group": "B", "name": "Thu nợ từ bán hàng", "amount": 389760000},
                        {"id": "r5", "group": "C", "name": "Chi trả nợ từ mua hàng", "amount": 258380000},
                    ],
                }
            ]
        return Response({"docs": docs, "results": docs})

    def create(self, request):
        from common_services.models import CoreCompanySetting
        company = self._resolve_company(request)
        if not company:
            return Response({"detail": "Chưa có doanh nghiệp."}, status=400)
        kind = request.query_params.get("kind") or request.data.get("kind") or "cash"
        with transaction.atomic():
            setting, _ = CoreCompanySetting.objects.select_for_update().get_or_create(company=company)
            config = dict(setting.configuration or {})
            forecasts_by_kind = dict(config.get("cash_forecasts") or {})
            if isinstance(request.data.get("docs"), list):
                forecasts_by_kind[kind] = request.data["docs"]
            elif isinstance(request.data.get("doc"), dict):
                doc = request.data["doc"]
                existing = list(forecasts_by_kind.get(kind) or [])
                forecasts_by_kind[kind] = [d for d in existing if d.get("id") != doc.get("id")] + [doc]
            config["cash_forecasts"] = forecasts_by_kind
            setting.configuration = config
            setting.save(update_fields=["configuration", "updated_at"])
        docs = forecasts_by_kind.get(kind, [])
        return Response({"docs": docs, "results": docs})


class DenominationCountViewSet(CompanyMemberMixin, GenericViewSet):
    """API quản lý Kiểm kê quỹ tiền mặt theo mệnh giá lưu trữ trực tiếp trong PostgreSQL."""
    def list(self, request):
        from common_services.models import CoreCompanySetting
        company = self._resolve_company(request)
        if not company:
            return Response({"docs": [], "results": []})
        setting, _ = CoreCompanySetting.objects.get_or_create(company=company)
        config = dict(setting.configuration or {})
        docs = config.get("cash_denomination_counts")
        if docs is None:
            docs = [
                {
                    "id": "kkq-2026-00001",
                    "code": "KKQ00001",
                    "date": "31/12/2026",
                    "cutoff": "31/12/2026",
                    "time": "17:00:00",
                    "currency": "VND",
                    "purpose": "Kiểm kê tiền mặt tại quỹ định kỳ cuối năm tài chính 2026",
                    "reference": "OPEN-2026-001",
                    "members": [
                        {"name": "Trần Thị Hương", "role": "Giám đốc", "represent": "Ban Giám đốc"},
                        {"name": "Lê Thị Hồng", "role": "Kế toán trưởng", "represent": "Phòng Kế toán"},
                        {"name": "Đỗ Thị Mai", "role": "Thủ quỹ", "represent": "Quỹ tiền mặt"},
                    ],
                    "counts": [
                        {"denomination": 500000, "quantity": 800, "note": "Loại mệnh giá 500000"},
                        {"denomination": 200000, "quantity": 400, "note": "Loại mệnh giá 200000"},
                        {"denomination": 100000, "quantity": 200, "note": "Loại mệnh giá 100000"},
                        {"denomination": 50000, "quantity": 0, "note": "Loại mệnh giá 50000"},
                        {"denomination": 20000, "quantity": 0, "note": "Loại mệnh giá 20000"},
                        {"denomination": 10000, "quantity": 0, "note": "Loại mệnh giá 10000"},
                        {"denomination": 5000, "quantity": 0, "note": "Loại mệnh giá 5000"},
                        {"denomination": 2000, "quantity": 0, "note": "Loại mệnh giá 2000"},
                        {"denomination": 1000, "quantity": 0, "note": "Loại mệnh giá 1000"},
                    ],
                    "bookBalance": 500000000,
                    "reason": "",
                    "conclusion": "Tiền kiểm kê thực tế khớp sổ kế toán (500.000.000 VND).",
                    "resolved": True,
                    "files": [],
                }
            ]
        return Response({"docs": docs, "results": docs})

    def create(self, request):
        from common_services.models import CoreCompanySetting
        company = self._resolve_company(request)
        if not company:
            return Response({"detail": "Chưa có doanh nghiệp."}, status=400)
        with transaction.atomic():
            setting, _ = CoreCompanySetting.objects.select_for_update().get_or_create(company=company)
            config = dict(setting.configuration or {})
            existing = list(config.get("cash_denomination_counts") or [])
            if isinstance(request.data.get("docs"), list):
                existing = request.data["docs"]
            elif isinstance(request.data.get("doc"), dict):
                doc = request.data["doc"]
                existing = [d for d in existing if d.get("id") != doc.get("id")] + [doc]
            config["cash_denomination_counts"] = existing
            setting.configuration = config
            setting.save(update_fields=["configuration", "updated_at"])
        return Response({"docs": existing, "results": existing})


def _default_payment_requests(company):
    from organization.models import Branch
    branches = list(Branch.objects.filter(company=company).order_by("-is_head_office", "code"))
    hq_id = str(branches[0].id) if branches else ""
    hcm = next((b for b in branches if "HCM" in b.code.upper()), None)
    dn = next((b for b in branches if "DN" in b.code.upper()), None)
    hcm_id = str(hcm.id) if hcm else hq_id
    dn_id = str(dn.id) if dn else hq_id
    return [
        {
            "id": "dnc-01",
            "code": "ĐNC00012",
            "date": "18/12/2026",
            "requester": "Nguyễn Văn Hải",
            "dept": "Phòng Kinh doanh",
            "beneficiary": "Công ty CP Minh Khang",
            "paymentMethod": "Tiền mặt",
            "purpose": "Chi tiếp khách đoàn đối tác Công ty CP Minh Khang ký kết HĐ",
            "amount": 4500000,
            "status": "approved",
            "voucherCode": "",
            "branchId": hq_id,
        },
        {
            "id": "dnc-02",
            "code": "ĐNC00011",
            "date": "15/12/2026",
            "requester": "Lê Hoàng Yến",
            "dept": "Phòng Hành chính - Nhân sự",
            "beneficiary": "Công ty VPP Hồng Hà",
            "paymentMethod": "Tiền mặt",
            "purpose": "Mua văn phòng phẩm và vật dụng tiêu hao quý 4/2026",
            "amount": 3200000,
            "status": "paid",
            "voucherCode": "PC00004",
            "branchId": hq_id,
        },
        {
            "id": "dnc-03",
            "code": "ĐNC00010",
            "date": "12/12/2026",
            "requester": "Trần Quốc Tuấn",
            "dept": "Phòng Kỹ thuật",
            "beneficiary": "Trung tâm Kỹ thuật Điện lạnh",
            "paymentMethod": "Tiền mặt",
            "purpose": "Bảo dưỡng sửa chữa đột xuất hệ thống máy in và điều hòa",
            "amount": 5800000,
            "status": "pending",
            "voucherCode": "",
            "branchId": "",
        },
        {
            "id": "dnc-04",
            "code": "ĐNC00009",
            "date": "10/12/2026",
            "requester": "Phạm Hải Đăng",
            "dept": "Ban Giám đốc",
            "beneficiary": "Phạm Hải Đăng",
            "paymentMethod": "Chuyển khoản",
            "purpose": "Chi phí công tác phí dự hội thảo chuyển đổi số tại TP.HCM",
            "amount": 12000000,
            "status": "approved",
            "voucherCode": "",
            "branchId": hq_id,
        },
        {
            "id": "dnc-05",
            "code": "ĐNC00008",
            "date": "05/12/2026",
            "requester": "Vũ Thị Mai",
            "dept": "Phòng Kế toán",
            "beneficiary": "Ngân hàng TMCP Ngoại thương",
            "paymentMethod": "Tiền mặt",
            "purpose": "Chi nộp phí dịch vụ ngân hàng và chứng thư số điện tử",
            "amount": 1540000,
            "status": "paid",
            "voucherCode": "PC00002",
            "branchId": hq_id,
        },
        {
            "id": "dnc-hcm-01",
            "code": "ĐNC-HCM-001",
            "date": "18/12/2026",
            "requester": "Trần Minh Khoa",
            "dept": "Chi nhánh TP. Hồ Chí Minh",
            "beneficiary": "Ban quản lý tòa nhà Nguyễn Huệ",
            "paymentMethod": "Tiền mặt",
            "purpose": "Đề nghị chi thanh toán tiền thuê mặt bằng & điện nước CN TP.HCM T12/2026",
            "amount": 48000000,
            "status": "paid",
            "voucherCode": "PC-HCM-2026-001",
            "branchId": hcm_id,
        },
        {
            "id": "dnc-hcm-02",
            "code": "ĐNC-HCM-002",
            "date": "20/12/2026",
            "requester": "Lê Thảo Vy",
            "dept": "Kinh doanh CN TP.HCM",
            "beneficiary": "Công ty TNHH Quảng cáo Sài Gòn",
            "paymentMethod": "Chuyển khoản",
            "purpose": "Đề nghị chi phí tổ chức sự kiện tri ân khách hàng khu vực miền Nam",
            "amount": 18500000,
            "status": "approved",
            "voucherCode": "",
            "branchId": hcm_id,
        },
        {
            "id": "dnc-dn-01",
            "code": "ĐNC-DN-001",
            "date": "18/12/2026",
            "requester": "Nguyễn Hữu Phước",
            "dept": "Chi nhánh Đà Nẵng",
            "beneficiary": "Ban quản lý tòa nhà Đà Nẵng",
            "paymentMethod": "Tiền mặt",
            "purpose": "Đề nghị chi thanh toán mặt bằng & điện nước Chi nhánh Đà Nẵng T12/2026",
            "amount": 31200000,
            "status": "paid",
            "voucherCode": "PC-DN-2026-001",
            "branchId": dn_id,
        },
    ]


def _default_advance_settlements(company):
    from organization.models import Branch
    branches = list(Branch.objects.filter(company=company).order_by("-is_head_office", "code"))
    hq_id = str(branches[0].id) if branches else ""
    hcm = next((b for b in branches if "HCM" in b.code.upper()), None)
    dn = next((b for b in branches if "DN" in b.code.upper()), None)
    hcm_id = str(hcm.id) if hcm else hq_id
    dn_id = str(dn.id) if dn else hq_id
    return [
        {
            "id": "qt-01",
            "code": "QT00005",
            "date": "16/12/2026",
            "person": "Hoàng Thiên Bảo",
            "dept": "Phòng Triển khai",
            "reason": "Quyết toán tạm ứng công tác phí triển khai dự án miền Trung",
            "advanceAmount": 25000000,
            "spentAmount": 20000000,
            "refundAmount": 5000000,
            "status": "settled",
            "receiptCode": "PT00005",
            "branchId": hq_id,
        },
        {
            "id": "qt-02",
            "code": "QT00004",
            "date": "12/12/2026",
            "person": "Nguyễn Văn Hải",
            "dept": "Phòng Kỹ thuật",
            "reason": "Tạm ứng mua sắm vật tư linh kiện thay thế phòng lab",
            "advanceAmount": 15000000,
            "spentAmount": 15000000,
            "refundAmount": 0,
            "status": "settled",
            "receiptCode": "-",
            "branchId": hq_id,
        },
        {
            "id": "qt-03",
            "code": "QT00003",
            "date": "08/12/2026",
            "person": "Trương Thị Bích",
            "dept": "Phòng Kinh doanh",
            "reason": "Tạm ứng chi phí tiếp khách và hội nghị khách hàng thường niên",
            "advanceAmount": 30000000,
            "spentAmount": 28500000,
            "refundAmount": 1500000,
            "status": "pending",
            "receiptCode": "",
            "branchId": "",
        },
        {
            "id": "qt-hcm-01",
            "code": "QT-HCM-001",
            "date": "17/12/2026",
            "person": "Trần Minh Khoa",
            "dept": "Chi nhánh TP. Hồ Chí Minh",
            "reason": "Quyết toán tạm ứng chi phí khảo sát & lắp đặt thiết bị tại TP.HCM",
            "advanceAmount": 20000000,
            "spentAmount": 17500000,
            "refundAmount": 2500000,
            "status": "settled",
            "receiptCode": "PT-HCM-2026-002",
            "branchId": hcm_id,
        },
        {
            "id": "qt-dn-01",
            "code": "QT-DN-001",
            "date": "17/12/2026",
            "person": "Nguyễn Hữu Phước",
            "dept": "Chi nhánh Đà Nẵng",
            "reason": "Quyết toán tạm ứng công tác phí triển khai khách hàng Đà Nẵng",
            "advanceAmount": 12000000,
            "spentAmount": 10500000,
            "refundAmount": 1500000,
            "status": "settled",
            "receiptCode": "PT-DN-2026-002",
            "branchId": dn_id,
        },
    ]


class PaymentRequestViewSet(CompanyMemberMixin, GenericViewSet):
    """API quản lý Đề nghị chi tiền lưu trữ trực tiếp trong PostgreSQL (CoreCompanySetting.configuration)."""
    def list(self, request):
        from common_services.models import CoreCompanySetting
        company = self._resolve_company(request)
        if not company:
            return Response({"docs": [], "results": []})
        setting, _ = CoreCompanySetting.objects.get_or_create(company=company)
        config = dict(setting.configuration or {})
        docs = config.get("payment_requests")
        if not docs:
            docs = _default_payment_requests(company)
            config["payment_requests"] = docs
            setting.configuration = config
            setting.save(update_fields=["configuration", "updated_at"])
        branch_id = (request.query_params.get("branch_id") or "").strip()
        if branch_id and branch_id != "all":
            filtered = [
                d for d in docs
                if not d.get("branchId")
                or str(d.get("branchId")) == branch_id
                or d.get("code") in ("ĐNC00010", "QT00003")
                or str(d.get("status") or "").lower() == "pending"
            ]
        else:
            filtered = docs
        return Response({"docs": filtered, "results": filtered})

    def create(self, request):
        from common_services.models import CoreCompanySetting, Notification
        from django.db.models import Q
        from django.utils import timezone
        company = self._resolve_company(request)
        if not company:
            return Response({"detail": "Chưa có doanh nghiệp."}, status=400)
        with transaction.atomic():
            setting, _ = CoreCompanySetting.objects.select_for_update().get_or_create(company=company)
            config = dict(setting.configuration or {})
            existing = list(config.get("payment_requests") or _default_payment_requests(company))
            if isinstance(request.data.get("docs"), list):
                existing = request.data["docs"]
            elif isinstance(request.data.get("doc"), dict):
                doc = request.data["doc"]
                idx = next(
                    (
                        i for i, d in enumerate(existing)
                        if d.get("id") == doc.get("id") or (doc.get("code") and d.get("code") == doc.get("code"))
                    ),
                    -1,
                )
                if idx >= 0:
                    existing[idx] = doc
                else:
                    existing.insert(0, doc)
            config["payment_requests"] = existing
            setting.configuration = config
            setting.save(update_fields=["configuration", "updated_at"])

            has_pending = any(str(d.get("status") or "").lower() == "pending" for d in existing)
            pr_notifs = Notification.objects.filter(company=company).filter(
                Q(entity_type__icontains="Request") | Q(link__icontains="payment-request") | Q(title__icontains="Đề nghị chi")
            )
            if has_pending:
                pr_notifs.update(read_at=None)
            else:
                pr_notifs.update(read_at=timezone.now())

        branch_id = (request.query_params.get("branch_id") or "").strip()
        if branch_id and branch_id != "all":
            filtered = [
                d for d in existing
                if not d.get("branchId")
                or str(d.get("branchId")) == branch_id
                or d.get("code") in ("ĐNC00010", "QT00003")
                or str(d.get("status") or "").lower() == "pending"
            ]
        else:
            filtered = existing
        return Response({"docs": filtered, "results": filtered})


class AdvanceSettlementDocViewSet(CompanyMemberMixin, GenericViewSet):
    """API quản lý Đề nghị quyết toán tạm ứng lưu trữ trực tiếp trong PostgreSQL."""
    def list(self, request):
        from common_services.models import CoreCompanySetting
        company = self._resolve_company(request)
        if not company:
            return Response({"docs": [], "results": []})
        setting, _ = CoreCompanySetting.objects.get_or_create(company=company)
        config = dict(setting.configuration or {})
        docs = config.get("advance_settlement_docs")
        if not docs:
            docs = _default_advance_settlements(company)
            config["advance_settlement_docs"] = docs
            setting.configuration = config
            setting.save(update_fields=["configuration", "updated_at"])
        branch_id = (request.query_params.get("branch_id") or "").strip()
        if branch_id and branch_id != "all":
            filtered = [
                d for d in docs
                if not d.get("branchId")
                or str(d.get("branchId")) == branch_id
                or d.get("code") in ("ĐNC00010", "QT00003")
                or str(d.get("status") or "").lower() == "pending"
            ]
        else:
            filtered = docs
        return Response({"docs": filtered, "results": filtered})

    def create(self, request):
        from common_services.models import CoreCompanySetting, Notification
        from django.db.models import Q
        from django.utils import timezone
        company = self._resolve_company(request)
        if not company:
            return Response({"detail": "Chưa có doanh nghiệp."}, status=400)
        with transaction.atomic():
            setting, _ = CoreCompanySetting.objects.select_for_update().get_or_create(company=company)
            config = dict(setting.configuration or {})
            existing = list(config.get("advance_settlement_docs") or _default_advance_settlements(company))
            if isinstance(request.data.get("docs"), list):
                existing = request.data["docs"]
            elif isinstance(request.data.get("doc"), dict):
                doc = request.data["doc"]
                idx = next(
                    (
                        i for i, d in enumerate(existing)
                        if d.get("id") == doc.get("id") or (doc.get("code") and d.get("code") == doc.get("code"))
                    ),
                    -1,
                )
                if idx >= 0:
                    existing[idx] = doc
                else:
                    existing.insert(0, doc)
            config["advance_settlement_docs"] = existing
            setting.configuration = config
            setting.save(update_fields=["configuration", "updated_at"])

            has_pending = any(str(d.get("status") or "").lower() == "pending" for d in existing)
            as_notifs = Notification.objects.filter(company=company).filter(
                Q(entity_type__icontains="Settlement") | Q(link__icontains="advance-settlement") | Q(title__icontains="quyết toán tạm ứng")
            )
            if has_pending:
                as_notifs.update(read_at=None)
            else:
                as_notifs.update(read_at=timezone.now())

        branch_id = (request.query_params.get("branch_id") or "").strip()
        if branch_id and branch_id != "all":
            filtered = [
                d for d in existing
                if not d.get("branchId")
                or str(d.get("branchId")) == branch_id
                or d.get("code") in ("ĐNC00010", "QT00003")
                or str(d.get("status") or "").lower() == "pending"
            ]
        else:
            filtered = existing
        return Response({"docs": filtered, "results": filtered})
