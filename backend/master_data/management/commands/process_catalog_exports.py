"""Process queued catalogue export batches; run regularly as a background worker."""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from master_data.catalog_exports import execute_export_batch
from master_data.models import CatalogExportBatch


class Command(BaseCommand):
    help = "Process queued catalogue export batches"

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=10)

    def handle(self, *args, **options):
        queued_ids = list(
            CatalogExportBatch.objects.filter(status="QUEUED")
            .order_by("started_at")
            .values_list("pk", flat=True)[:options["limit"]]
        )
        for batch_id in queued_ids:
            try:
                with transaction.atomic():
                    # Audit 2026-10-27 (P1): khóa dòng để nhiều worker không xử lý trùng một batch.
                    batch = (
                        CatalogExportBatch.objects.select_for_update(skip_locked=True)
                        .filter(pk=batch_id, status="QUEUED")
                        .first()
                    )
                    if batch is None:
                        continue
                    execute_export_batch(batch)
                self.stdout.write(f"Processed export batch {batch_id}: {batch.status}")
            except Exception as exc:
                CatalogExportBatch.objects.filter(pk=batch_id, status="QUEUED").update(
                    status="FAILED", error_message=str(exc)[:2000], finished_at=timezone.now()
                )
                self.stderr.write(f"Failed export batch {batch_id}: {exc}")
