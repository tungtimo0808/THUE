from rest_framework.routers import DefaultRouter
from django.urls import path

from . import views

router = DefaultRouter()
router.register("object-settings", views.CostObjectSettingViewSet, basename="cost-object-setting")
router.register("periods", views.CostPeriodViewSet, basename="cost-period")

urlpatterns = [path("allocation-settings/", views.CostAllocationSettingView.as_view(), name="cost-allocation-settings")] + router.urls
