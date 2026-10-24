import uuid
import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


def seed_advance_request_permissions(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")

    names = {
        "VIEW": "Xem",
        "CREATE": "Tạo",
        "CREATE_FOR_OTHERS": "Tạo thay người khác",
        "EDIT": "Cập nhật",
        "DELETE": "Xóa",
        "SUBMIT": "Gửi duyệt",
        "APPROVE": "Phê duyệt",
    }
    actions = {}
    for code, name in names.items():
        actions[code], _ = Action.objects.get_or_create(
            code=code,
            defaults={
                "id": uuid.uuid4(),
                "name": name,
                "risk_level": "HIGH" if code in {"APPROVE", "CREATE_FOR_OTHERS"} else "NORMAL",
            },
        )
    resource, _ = Resource.objects.get_or_create(
        code="GL.ADVANCE_REQUEST",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "GL",
            "name": "Đề nghị quyết toán tạm ứng",
            "status": "ACTIVE",
        },
    )
    for action_code, action_name in names.items():
        Permission.objects.get_or_create(
            code=f"GL.ADVANCE_REQUEST.{action_code}",
            defaults={
                "id": uuid.uuid4(),
                "resource_id": resource.id,
                "action_id": actions[action_code].id,
                "description": f"{action_name} - Đề nghị quyết toán tạm ứng",
                "status": "ACTIVE",
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ("general_ledger", "0006_optional_dimensions_not_required"),
        ("organization", "0005_employee_address_employee_advance_account_and_more"),
        ("iam", "0005_seed_uc_md"),
    ]

    operations = [
        migrations.CreateModel(
            name="AdvanceSettlementRequest",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("number", models.CharField(max_length=80)),
                ("request_date", models.DateField(default=django.utils.timezone.localdate)),
                ("amount", models.DecimalField(decimal_places=4, max_digits=24)),
                ("purpose", models.TextField()),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("DRAFT", "Nháp"),
                            ("PENDING_APPROVAL", "Chờ duyệt"),
                            ("RETURNED", "Yêu cầu bổ sung"),
                            ("APPROVED", "Đã duyệt"),
                            ("REJECTED", "Từ chối"),
                            ("CANCELLED", "Đã hủy"),
                        ],
                        default="PENDING_APPROVAL",
                        max_length=32,
                    ),
                ),
                (
                    "sync_status",
                    models.CharField(
                        choices=[
                            ("NOT_SYNCED", "Chưa đồng bộ"),
                            ("SYNC_PENDING", "Chờ đồng bộ"),
                            ("SYNCED", "Đã đồng bộ"),
                            ("SYNC_ERROR", "Lỗi đồng bộ"),
                        ],
                        default="NOT_SYNCED",
                        max_length=32,
                    ),
                ),
                ("sync_error_message", models.TextField(blank=True, default="")),
                ("synced_at", models.DateTimeField(blank=True, null=True)),
                ("idempotency_key", models.CharField(blank=True, default="", max_length=120)),
                ("workflow_snapshot", models.JSONField(blank=True, default=dict)),
                ("current_approval_level", models.PositiveIntegerField(default=1)),
                ("submitted_at", models.DateTimeField(blank=True, null=True)),
                ("approved_at", models.DateTimeField(blank=True, null=True)),
                ("rejection_reason", models.TextField(blank=True, default="")),
                ("settlement_voucher_no", models.CharField(blank=True, default="", max_length=80)),
                ("version", models.PositiveIntegerField(default=1)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "approved_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="approved_advance_requests",
                        to="iam.useraccount",
                    ),
                ),
                (
                    "branch",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="advance_settlement_requests",
                        to="organization.branch",
                    ),
                ),
                (
                    "company",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="advance_settlement_requests",
                        to="organization.company",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="created_advance_requests",
                        to="iam.useraccount",
                    ),
                ),
                (
                    "department",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="advance_settlement_requests",
                        to="organization.department",
                    ),
                ),
                (
                    "requester",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="advance_settlement_requests",
                        to="organization.employee",
                    ),
                ),
                (
                    "settlement_entry",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="inherited_advance_requests",
                        to="general_ledger.journalentry",
                    ),
                ),
            ],
            options={
                "db_table": "gl_advance_settlement_request",
                "ordering": ("-request_date", "-created_at"),
                "indexes": [
                    models.Index(fields=["company", "status"], name="ix_gl_adv_req_comp_status"),
                    models.Index(fields=["company", "requester"], name="ix_gl_adv_req_comp_requester"),
                    models.Index(fields=["company", "idempotency_key"], name="ix_gl_adv_req_comp_idemp"),
                ],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("company", "number"),
                        name="uq_gl_adv_settlement_req_number",
                    ),
                ],
            },
        ),
        migrations.RunPython(seed_advance_request_permissions, migrations.RunPython.noop),
    ]

