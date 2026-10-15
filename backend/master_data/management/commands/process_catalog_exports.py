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
                batch = CatalogExportBatch.objects.get(pk=batch_id)
                if batch.status != "QUEUED":
                    continue
                execute_export_batch(batch)
                self.stdout.write(f"Processed export batch {batch_id}: {batch.status}")
            except Exception as exc:
                self.stderr.write(f"Failed export batch {batch_id}: {exc}")
