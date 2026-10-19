from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("profiles", views.PayProfileViewSet, basename="payroll-profile")
router.register("attendance-sheets", views.AttendanceSheetViewSet, basename="payroll-attendance-sheet")
router.register("salary-sheets", views.SalarySheetViewSet, basename="payroll-salary-sheet")

urlpatterns = [path("settings/", views.PayrollSettingView.as_view(), name="payroll-settings")] + router.urls
