from .goods_views import GoodsPurchaseViewSet
from .service_serializers import ServicePurchaseSerializer


class ServicePurchaseViewSet(GoodsPurchaseViewSet):
    serializer_class = ServicePurchaseSerializer
    permission_resource = "PUR.SERVICE"
    purchase_type_filter = "SERVICE"
    iam_permissions = {"GET": "PUR.SERVICE.VIEW", "POST": "PUR.SERVICE.CREATE",
                       "PUT": "PUR.SERVICE.EDIT", "PATCH": "PUR.SERVICE.EDIT", "DELETE": "PUR.SERVICE.CANCEL"}
    action_permissions = {"submit": "PUR.SERVICE.SUBMIT", "approve": "PUR.SERVICE.APPROVE",
                          "reject": "PUR.SERVICE.APPROVE", "request_revision": "PUR.SERVICE.APPROVE",
                          "post": "PUR.SERVICE.POST", "unpost": "PUR.SERVICE.UNPOST",
                          "cancel": "PUR.SERVICE.CANCEL"}
