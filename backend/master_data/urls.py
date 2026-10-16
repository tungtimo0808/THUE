from rest_framework.routers import DefaultRouter

from general_ledger.views import AccountViewSet, ChartOfAccountsViewSet
from . import views
from .customers import CustomerViewSet
from .tax_catalog import TaxTypeViewSet, TaxRateConfigViewSet
from .catalog_imports import CatalogImportViewSet
from .catalog_exports import CatalogExportViewSet

router = DefaultRouter()
routes = {
    "customers": CustomerViewSet,
    "currencies": views.CurrencyViewSet,
    "banks": views.BankViewSet,
    "document-types": views.DocumentTypeViewSet,
    "exchange-rate-types": views.ExchangeRateTypeViewSet,
    "exchange-rates": views.ExchangeRateViewSet,
    "payment-terms": views.PaymentTermViewSet,
    "payment-methods": views.PaymentMethodViewSet,
    "catalog-imports": CatalogImportViewSet,
    "catalog-exports": CatalogExportViewSet,
    "tax-rates": views.TaxRateViewSet,
    "tax-types": TaxTypeViewSet,
    "tax-rate-configs": TaxRateConfigViewSet,
    "projects": views.ProjectViewSet,
    "cost-centers": views.CostCenterViewSet,
    "parties": views.PartyViewSet,
    "party-roles": views.PartyRoleViewSet,
    "party-addresses": views.PartyAddressViewSet,
    "party-bank-accounts": views.PartyBankAccountViewSet,
    "party-contacts": views.PartyContactViewSet,
    "customer-profiles": views.CustomerProfileViewSet,
    "vendor-profiles": views.VendorProfileViewSet,
    "item-categories": views.ItemCategoryViewSet,
    "units-of-measure": views.UnitOfMeasureViewSet,
    "items": views.ItemViewSet,
    "item-uom-conversions": views.ItemUomConversionViewSet,
    "warehouses": views.WarehouseViewSet,
    "inventory-locations": views.InventoryLocationViewSet,
    "company-bank-accounts": views.CompanyBankAccountViewSet,
    "expense-items": views.ExpenseItemViewSet,
    "statistical-codes": views.StatisticalCodeViewSet,
    "accounts": AccountViewSet,
    "charts-of-accounts": ChartOfAccountsViewSet,
    "document-numbering-rules": views.DocumentNumberingRuleViewSet,
}
for prefix, viewset in routes.items():
    router.register(prefix, viewset, basename=prefix)

urlpatterns = router.urls
