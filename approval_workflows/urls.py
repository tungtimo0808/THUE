from rest_framework.routers import DefaultRouter
from django.urls import path

from .views import PolicyViewSet, VersionViewSet, WorkflowViewSet
from .request_views import (
    BulkDecisionView,
    DelegationDetailView,
    DelegationView,
    NotificationListView,
    TaskDetailView,
    TaskListView,
)


router = DefaultRouter()
router.register("policies", PolicyViewSet, basename="workflow-policy")
router.register("workflows", WorkflowViewSet, basename="workflow")
router.register("versions", VersionViewSet, basename="workflow-version")

urlpatterns = [
    path("tasks/", TaskListView.as_view(), name="approval-task-list"),
    path("tasks/bulk-decision/", BulkDecisionView.as_view(), name="approval-task-bulk-decision"),
    path("tasks/<uuid:pk>/", TaskDetailView.as_view(), name="approval-task-detail"),
    path("delegations/", DelegationView.as_view(), name="approval-delegation-list"),
    path("delegations/<uuid:pk>/", DelegationDetailView.as_view(), name="approval-delegation-detail"),
    path("notifications/", NotificationListView.as_view(), name="approval-notification-list"),
] + router.urls
