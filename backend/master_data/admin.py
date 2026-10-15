from django.contrib import admin

from . import models


@admin.register(models.Currency)
class CurrencyAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "decimal_places", "is_active")
    search_fields = ("code", "name")
    list_filter = ("is_active",)


for model in (
    models.ExchangeRateType, models.ExchangeRate, models.PaymentTerm, models.PaymentMethod, models.TaxType, models.TaxRate,
    models.Project, models.CostCenter, models.Party, models.PartyRole,
    models.PartyAddress, models.Bank, models.PartyBankAccount, models.PartyContact,
    models.CustomerProfile, models.VendorProfile, models.ItemCategory,
    models.UnitOfMeasure, models.Item, models.ItemUomConversion, models.Warehouse,
    models.InventoryLocation, models.CompanyBankAccount, models.DocumentType,
    models.DocumentNumberingRule,
):
    admin.site.register(model)
