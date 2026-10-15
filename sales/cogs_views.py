from django.core.exceptions import ValidationError
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from general_ledger.models import Account
from inventory.models import InventoryTransaction, InventoryTransactionLine
from master_data.models import Warehouse
from organization.models import Branch, Company
from sales import cogs_serializers, cogs_services, models
from sales.permissions import SalesPermission


class CostOfGoodsSoldViewSet(viewsets.ModelViewSet):
    """
    Không gian làm việc và API chứng từ Giá vốn hàng bán (UC-SAL-10).
    """
    queryset = models.CostOfGoodsSold.objects.all()
    permission_classes = [IsAuthenticated, SalesPermission]

    action_permissions = {
        "list": "SAL.COGS.VIEW",
        "retrieve": "SAL.COGS.VIEW",
        "eligible_lines": "SAL.COGS.VIEW",
        "check_difference": "SAL.COGS.VIEW",
        "create": "SAL.COGS.CREATE",
        "update": "SAL.COGS.EDIT",
        "partial_update": "SAL.COGS.EDIT",
        "destroy": "SAL.COGS.DELETE",
        "submit": "SAL.COGS.EDIT",
        "withdraw": "SAL.COGS.EDIT",
        "approve": "SAL.COGS.APPROVE",
        "request_revision": "SAL.COGS.APPROVE",
        "reject": "SAL.COGS.APPROVE",
        "post": "SAL.COGS.POST",
        "cancel": "SAL.COGS.CANCEL",
    }

    def get_serializer_class(self):
        if self.action == "list":
            return cogs_serializers.CostOfGoodsSoldListSerializer
        if self.action in ["retrieve", "check_difference"]:
            return cogs_serializers.CostOfGoodsSoldDetailSerializer
        if self.action in ["create", "update", "partial_update"]:
            return cogs_serializers.CostOfGoodsSoldCreateUpdateSerializer
        return cogs_serializers.CostOfGoodsSoldDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        company_id = self.request.query_params.get("company_id")
        if not company_id and isinstance(self.request.data, dict):
            company_id = self.request.data.get("company") or self.request.data.get("company_id")

        if not company_id:
            if self.kwargs.get("pk"):
                return qs.filter(pk=self.kwargs["pk"]).select_related("branch", "warehouse", "journal_entry", "created_by", "posted_by").prefetch_related("lines__item", "lines__warehouse", "lines__uom", "lines__cogs_account", "lines__inventory_account")
            return qs.none()

        qs = qs.filter(company_id=company_id)

        branch_id = self.request.query_params.get("branch_id")
        if branch_id:
            qs = qs.filter(branch_id=branch_id)

        warehouse_id = self.request.query_params.get("warehouse_id")
        if warehouse_id:
            qs = qs.filter(warehouse_id=warehouse_id)

        costing_period = self.request.query_params.get("costing_period")
        if costing_period:
            qs = qs.filter(costing_period=costing_period)

        cogs_status = self.request.query_params.get("status")
        if cogs_status:
            qs = qs.filter(status=cogs_status)

        date_from = self.request.query_params.get("date_from")
        if date_from:
            qs = qs.filter(document_date__gte=date_from)

        date_to = self.request.query_params.get("date_to")
        if date_to:
            qs = qs.filter(document_date__lte=date_to)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(number__icontains=search) | Q(description__icontains=search)
            )

        return qs.select_related("branch", "warehouse", "journal_entry", "created_by", "posted_by").prefetch_related("lines__item", "lines__warehouse", "lines__uom", "lines__cogs_account", "lines__inventory_account")

    def create(self, request, *args, **kwargs):
        serializer = cogs_serializers.CostOfGoodsSoldCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            company = Company.objects.get(pk=data["company"])
        except Company.DoesNotExist:
            return Response({"error": "Không tìm thấy doanh nghiệp."}, status=status.HTTP_404_NOT_FOUND)

        branch = Branch.objects.filter(pk=data.get("branch")).first() if data.get("branch") else None
        warehouse = Warehouse.objects.filter(pk=data.get("warehouse")).first() if data.get("warehouse") else None
        inv_trx = InventoryTransaction.objects.filter(pk=data.get("inventory_transaction")).first() if data.get("inventory_transaction") else None
        goods_sale = models.GoodsSale.objects.filter(pk=data.get("goods_sale")).first() if data.get("goods_sale") else None

        prepared_lines = []
        for l_item in data["lines"]:
            try:
                inv_line = InventoryTransactionLine.objects.select_related("transaction", "item", "uom").get(pk=l_item["inventory_transaction_line"])
            except InventoryTransactionLine.DoesNotExist:
                return Response({"error": f"Không tìm thấy dòng xuất kho {l_item['inventory_transaction_line']}."}, status=status.HTTP_404_NOT_FOUND)

            cogs_acc = Account.objects.filter(pk=l_item.get("cogs_account")).first() if l_item.get("cogs_account") else None
            inv_acc = Account.objects.filter(pk=l_item.get("inventory_account")).first() if l_item.get("inventory_account") else None

            prepared_lines.append({
                "inventory_transaction_line": inv_line,
                "cogs_account": cogs_acc,
                "inventory_account": inv_acc,
            })

        payload = {
            "company": company,
            "branch": branch,
            "warehouse": warehouse,
            "document_date": data.get("document_date"),
            "posting_date": data.get("posting_date"),
            "costing_period": data.get("costing_period", ""),
            "description": data.get("description", "Ghi nhận giá vốn hàng bán"),
            "inventory_transaction": inv_trx,
            "goods_sale": goods_sale,
            "attachments": data.get("attachments", []),
            "lines": prepared_lines,
        }

        try:
            cogs = cogs_services.create_cogs_voucher(request, payload)
        except ValidationError as e:
            return Response(getattr(e, "message_dict", {"error": str(e)}), status=status.HTTP_400_BAD_REQUEST)

        detail_serializer = cogs_serializers.CostOfGoodsSoldDetailSerializer(cogs)
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        cogs = self.get_object()
        serializer = cogs_serializers.CostOfGoodsSoldCreateUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        prepared_data = dict(data)
        if "lines" in data:
            prepared_lines = []
            for l_item in data["lines"]:
                try:
                    inv_line = InventoryTransactionLine.objects.select_related("transaction", "item", "uom").get(pk=l_item["inventory_transaction_line"])
                except InventoryTransactionLine.DoesNotExist:
                    return Response({"error": f"Không tìm thấy dòng xuất kho {l_item['inventory_transaction_line']}."}, status=status.HTTP_404_NOT_FOUND)

                cogs_acc = Account.objects.filter(pk=l_item.get("cogs_account")).first() if l_item.get("cogs_account") else None
                inv_acc = Account.objects.filter(pk=l_item.get("inventory_account")).first() if l_item.get("inventory_account") else None

                prepared_lines.append({
                    "inventory_transaction_line": inv_line,
                    "cogs_account": cogs_acc,
                    "inventory_account": inv_acc,
                })
            prepared_data["lines"] = prepared_lines

        try:
            updated_cogs = cogs_services.update_cogs_voucher(request, cogs, prepared_data)
        except ValidationError as e:
            return Response(getattr(e, "message_dict", {"error": str(e)}), status=status.HTTP_400_BAD_REQUEST)

        detail_serializer = cogs_serializers.CostOfGoodsSoldDetailSerializer(updated_cogs)
        return Response(detail_serializer.data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        cogs = self.get_object()
        try:
            cogs_services.delete_cogs_voucher(request, cogs)
        except ValidationError as e:
            return Response(getattr(e, "message_dict", {"error": str(e)}), status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], url_path="eligible-lines")
    def eligible_lines(self, request):
        company_id = request.query_params.get("company_id")
        if not company_id:
            return Response({"error": "Vui lòng cung cấp company_id."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            company = Company.objects.get(pk=company_id)
        except Company.DoesNotExist:
            return Response({"error": "Không tìm thấy doanh nghiệp."}, status=status.HTTP_404_NOT_FOUND)

        branch = Branch.objects.filter(pk=request.query_params.get("branch_id")).first() if request.query_params.get("branch_id") else None
        warehouse = Warehouse.objects.filter(pk=request.query_params.get("warehouse_id")).first() if request.query_params.get("warehouse_id") else None
        costing_period = request.query_params.get("costing_period")
        inv_trx_id = request.query_params.get("inventory_transaction_id")

        lines = cogs_services.get_eligible_outward_lines(
            company=company,
            branch=branch,
            warehouse=warehouse,
            costing_period=costing_period,
            inventory_transaction_id=inv_trx_id,
        )
        return Response({"count": len(lines), "results": lines}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        cogs = self.get_object()
        try:
            cogs = cogs_services.submit_cogs_voucher(request, cogs)
        except ValidationError as e:
            return Response(getattr(e, "message_dict", {"error": str(e)}), status=status.HTTP_400_BAD_REQUEST)
        return Response(cogs_serializers.CostOfGoodsSoldDetailSerializer(cogs).data)

    @action(detail=True, methods=["post"], url_path="withdraw")
    def withdraw(self, request, pk=None):
        cogs = self.get_object()
        serializer = cogs_serializers.OptionalCommentActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data.get("comment", "")
        try:
            cogs = cogs_services.withdraw_cogs_voucher(request, cogs, reason=reason)
        except ValidationError as e:
            return Response(getattr(e, "message_dict", {"error": str(e)}), status=status.HTTP_400_BAD_REQUEST)
        return Response(cogs_serializers.CostOfGoodsSoldDetailSerializer(cogs).data)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        cogs = self.get_object()
        serializer = cogs_serializers.OptionalCommentActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = serializer.validated_data.get("comment", "")
        try:
            cogs = cogs_services.approve_cogs_voucher(request, cogs, comment=comment)
        except ValidationError as e:
            return Response(getattr(e, "message_dict", {"error": str(e)}), status=status.HTTP_400_BAD_REQUEST)
        return Response(cogs_serializers.CostOfGoodsSoldDetailSerializer(cogs).data)

    @action(detail=True, methods=["post"], url_path="request-revision")
    def request_revision(self, request, pk=None):
        cogs = self.get_object()
        serializer = cogs_serializers.CommentActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = serializer.validated_data["comment"]
        try:
            cogs = cogs_services.request_revision_cogs_voucher(request, cogs, comment=comment)
        except ValidationError as e:
            return Response(getattr(e, "message_dict", {"error": str(e)}), status=status.HTTP_400_BAD_REQUEST)
        return Response(cogs_serializers.CostOfGoodsSoldDetailSerializer(cogs).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        cogs = self.get_object()
        serializer = cogs_serializers.CommentActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = serializer.validated_data["comment"]
        try:
            cogs = cogs_services.reject_cogs_voucher(request, cogs, comment=comment)
        except ValidationError as e:
            return Response(getattr(e, "message_dict", {"error": str(e)}), status=status.HTTP_400_BAD_REQUEST)
        return Response(cogs_serializers.CostOfGoodsSoldDetailSerializer(cogs).data)

    @action(detail=True, methods=["post"], url_path="post")
    def post(self, request, pk=None):
        cogs = self.get_object()
        try:
            cogs = cogs_services.post_cogs_voucher(request, cogs)
        except ValidationError as e:
            return Response(getattr(e, "message_dict", {"error": str(e)}), status=status.HTTP_400_BAD_REQUEST)
        return Response(cogs_serializers.CostOfGoodsSoldDetailSerializer(cogs).data)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        cogs = self.get_object()
        serializer = cogs_serializers.CancelActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data["reason"]
        try:
            cogs = cogs_services.cancel_cogs_voucher(request, cogs, reason=reason)
        except ValidationError as e:
            return Response(getattr(e, "message_dict", {"error": str(e)}), status=status.HTTP_400_BAD_REQUEST)
        return Response(cogs_serializers.CostOfGoodsSoldDetailSerializer(cogs).data)

    @action(detail=True, methods=["get"], url_path="check-difference")
    def check_difference(self, request, pk=None):
        cogs = self.get_object()
        diff_data = cogs_services.check_cogs_differences(cogs)
        return Response(diff_data, status=status.HTTP_200_OK)
