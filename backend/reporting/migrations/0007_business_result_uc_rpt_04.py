# Generated for UC-RPT-04 – Xem báo cáo kết quả kinh doanh

import django.db.models.deletion
from django.db import migrations, models
from reporting.business_result_services import seed_business_result_uc_rpt_04


class Migration(migrations.Migration):

    dependencies = [
        ("reporting", "0006_balance_sheet_uc_rpt_03"),
    ]

    operations = [
        migrations.AddField(
            model_name="financialstatementrun",
            name="calculation_method",
            field=models.CharField(default="ACTIVITY_BASED", max_length=30),
        ),
        migrations.AddField(
            model_name="financialstatementrun",
            name="comparative_adjustment_reference",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="financialstatementrun",
            name="comparative_note",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="financialstatementrun",
            name="comparative_status",
            field=models.CharField(default="COMPARABLE", max_length=30),
        ),
        migrations.AddField(
            model_name="financialstatementrun",
            name="comparison_end_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="financialstatementrun",
            name="comparison_start_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="financialstatementrun",
            name="eps_metadata_json",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="financialstatementrun",
            name="legal_or_management",
            field=models.CharField(default="LEGAL", max_length=20),
        ),
        migrations.AddField(
            model_name="financialstatementrun",
            name="period_type",
            field=models.CharField(default="YEAR", max_length=20),
        ),
        migrations.AddField(
            model_name="financialstatementrun",
            name="restatement_version",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="financialstatementrun",
            name="source_status",
            field=models.CharField(
                choices=[
                    ("COMPLETE", "Nguồn đầy đủ theo Rule"),
                    ("PRELIMINARY", "Số liệu tạm tính"),
                    ("PARTIAL", "Nguồn chưa đầy đủ"),
                    ("STALE", "Nguồn/Mapping thay đổi"),
                    ("UNAVAILABLE", "Không tải được nguồn"),
                ],
                default="COMPLETE",
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name="financialstatementrunvalidation",
            name="slot_code",
            field=models.CharField(blank=True, default="", max_length=50),
        ),
        migrations.AddField(
            model_name="financialstatementrunvalidation",
            name="statement_line",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="run_validations",
                to="reporting.financialstatementline",
            ),
        ),
        migrations.AddField(
            model_name="financialstatementvalueslot",
            name="end_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="financialstatementvalueslot",
            name="start_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="financialstatementline",
            name="line_type",
            field=models.CharField(
                choices=[
                    ("DETAIL", "Chi tiết"),
                    ("SUBTOTAL", "Tổng nhóm"),
                    ("TOTAL", "Tổng cộng"),
                    ("FORMULA", "Công thức tổng hợp"),
                    ("MEMO", "Thông tin chi tiết (Trong đó)"),
                    ("EPS", "Lãi trên cổ phiếu"),
                    ("SECTION_HEADER", "Tiêu đề phần"),
                    ("NOTE_TEXT", "Thuyết minh văn bản"),
                    ("NOTE_TABLE", "Thuyết minh bảng"),
                    ("NOTE_NUMBER", "Thuyết minh số liệu"),
                ],
                default="DETAIL",
                max_length=30,
            ),
        ),
        migrations.AlterField(
            model_name="financialstatementrun",
            name="run_status",
            field=models.CharField(
                choices=[
                    ("DRAFT", "Nháp"),
                    ("GENERATED", "Đã lập"),
                    ("VALIDATING", "Đang kiểm tra"),
                    ("REVIEW_REQUIRED", "Cần rà soát"),
                    ("READY_FOR_APPROVAL", "Sẵn sàng trình duyệt"),
                    ("APPROVED", "Đã duyệt"),
                    ("SUPERSEDED", "Đã bị thay thế"),
                    ("ARCHIVED", "Lưu lịch sử"),
                    ("FAILED", "Lỗi"),
                ],
                default="GENERATED",
                max_length=30,
            ),
        ),
        migrations.RunPython(seed_business_result_uc_rpt_04, migrations.RunPython.noop),
    ]
