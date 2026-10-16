from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ReportDefinitionViewSet, ReportEngineViewSet, ReportExportViewSet, ReportLineMappingViewSet, ReportRunViewSet


router = DefaultRouter(trailing_slash=True)
router.register("definitions", ReportDefinitionViewSet, basename="report-definition")
router.register("line-mappings", ReportLineMappingViewSet, basename="report-line-mapping")
router.register("engine", ReportEngineViewSet, basename="report-engine")
router.register("runs", ReportRunViewSet, basename="report-run")
router.register("exports", ReportExportViewSet, basename="report-export")

urlpatterns = [path("", include(router.urls))]
