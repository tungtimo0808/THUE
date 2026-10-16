from rest_framework.routers import DefaultRouter
from . import (
    views, goods_views, service_views, sales_return_views,
    sales_allowance_views, sales_invoice_views, tracking_views, cogs_views, link_views,
    contract_views, discount_invoice_views, commercial_invoice_views
)

router = DefaultRouter()
router.register("quotations", views.QuotationViewSet, basename="sal-quotation")
router.register("contracts", contract_views.SalesContractViewSet, basename="sal-contract")
router.register("orders", views.OrderViewSet, basename="sal-order")
router.register("deliveries", views.DeliveryViewSet, basename="sal-delivery")
router.register("invoice-requests", views.InvoiceRequestViewSet, basename="sal-invoice-request")
router.register("approvals", views.ApprovalViewSet, basename="sal-approval")
router.register("goods-sales", goods_views.GoodsSaleViewSet, basename="sal-goods-sale")
router.register("service-sales", service_views.ServiceSaleViewSet, basename="sal-service-sale")
router.register("sales-returns", sales_return_views.SalesReturnViewSet, basename="sal-sales-return")
router.register("sales-allowances", sales_allowance_views.SalesAllowanceViewSet, basename="sal-sales-allowance")
router.register("sales-invoices", sales_invoice_views.SalesInvoiceViewSet, basename="sal-sales-invoice")
router.register("discount-invoices", discount_invoice_views.SalesDiscountInvoiceViewSet, basename="sal-discount-invoice")
router.register("commercial-invoices", commercial_invoice_views.SalesCommercialInvoiceViewSet, basename="sal-commercial-invoice")
router.register("tracking", tracking_views.SalesOrderTrackingViewSet, basename="sal-tracking")
router.register("cogs", cogs_views.CostOfGoodsSoldViewSet, basename="sal-cogs")
router.register("links", link_views.SalesDocumentLinkViewSet, basename="sal-link")
urlpatterns = router.urls


