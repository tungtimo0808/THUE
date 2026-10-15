from rest_framework.routers import DefaultRouter
from django.urls import path

from .views import (
    BranchViewSet,
    CompanyViewSet,
    DepartmentViewSet,
    EmployeeAssignmentViewSet,
    EmployeeViewSet,
    PositionViewSet,
    CompanyInformationView,
    OrganizationStructureViewSet,
)

router = DefaultRouter()
router.register("companies", CompanyViewSet, basename="company")
router.register("branches", BranchViewSet, basename="branch")
router.register("departments", DepartmentViewSet, basename="department")
router.register("positions", PositionViewSet, basename="position")
router.register("employees", EmployeeViewSet, basename="employee")
router.register("employee-assignments", EmployeeAssignmentViewSet, basename="employee-assignment")
router.register("structure/units", OrganizationStructureViewSet, basename="organization-unit")

urlpatterns = [
    path("companies/<uuid:company_id>/information/", CompanyInformationView.as_view(), name="company-information"),
] + router.urls
