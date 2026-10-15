import re

from drf_spectacular.extensions import OpenApiAuthenticationExtension
from drf_spectacular.openapi import AutoSchema


def _titleize_path_part(value):
    """Turn an URL path part into a readable Swagger section label."""
    return value.replace("-", " ").replace("_", " ").title()


class ResourceGroupedAutoSchema(AutoSchema):
    """Group operations by both module and resource in Swagger/ReDoc.

    drf-spectacular normally only uses the first path part as a tag. That puts
    every accounts-payable endpoint, for example, in one very large section.
    Including the next path part keeps all operations for a resource together.
    """

    def get_tags(self):
        path_parts = [part for part in self._tokenize_path() if not part.startswith("{")]
        if path_parts and path_parts[0].lower() == "api":
            path_parts.pop(0)
        if path_parts and re.fullmatch(r"v\d+(?:\.\d+)?", path_parts[0], re.IGNORECASE):
            path_parts.pop(0)
        if not path_parts:
            return super().get_tags()

        module, *resource = path_parts
        label = _titleize_path_part(module)
        if resource:
            label = f"{label} / {_titleize_path_part(resource[0])}"
        return [label]


class RevocableJWTAuthenticationScheme(OpenApiAuthenticationExtension):
    target_class = "common_services.authentication.RevocableJWTAuthentication"
    name = "jwtAuth"

    def get_security_definition(self, auto_schema):
        return {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
