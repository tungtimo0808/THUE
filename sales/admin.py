from django.contrib import admin
from . import models


class QuotationLineInline(admin.TabularInline): model=models.SalesQuotationLine; extra=0
class ContractLineInline(admin.TabularInline): model=models.SalesContractLine; extra=0
class OrderLineInline(admin.TabularInline): model=models.SalesOrderLine; extra=0
class DeliveryLineInline(admin.TabularInline): model=models.SalesDeliveryLine; extra=0
class InvoiceRequestLineInline(admin.TabularInline): model=models.InvoiceRequestLine; extra=0


@admin.register(models.SalesQuotation)
class QuotationAdmin(admin.ModelAdmin): list_display=("number","company","customer","document_date","valid_until","status","total_amount"); list_filter=("status","company"); search_fields=("number","customer__name"); inlines=(QuotationLineInline,)
@admin.register(models.SalesContract)
class ContractAdmin(admin.ModelAdmin): list_display=("number","company","customer","start_date","end_date","status"); list_filter=("status","company"); search_fields=("number","customer__name"); inlines=(ContractLineInline,)
@admin.register(models.SalesOrder)
class OrderAdmin(admin.ModelAdmin): list_display=("number","company","customer","document_date","status","total_amount"); list_filter=("status","company"); search_fields=("number","customer__name"); inlines=(OrderLineInline,)
@admin.register(models.SalesDelivery)
class DeliveryAdmin(admin.ModelAdmin): list_display=("number","company","order","delivery_date","delivery_type","status"); list_filter=("status","delivery_type","company"); inlines=(DeliveryLineInline,)
@admin.register(models.InvoiceRequest)
class InvoiceRequestAdmin(admin.ModelAdmin): list_display=("number","company","customer","order","request_date","status","total_amount"); list_filter=("status","company"); search_fields=("number","customer__name"); inlines=(InvoiceRequestLineInline,)
admin.site.register(models.ApprovalDecision)
