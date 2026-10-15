"""Process queued catalogue imports; run regularly as a separate worker."""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from common_services.services import create_notification
from master_data.catalog_imports import execute_batch
from master_data.models import CatalogImportBatch
from organization.models import Company


class Command(BaseCommand):
    help = "Process queued catalogue import batches"

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=10)

    def handle(self, *args, **options):
        for batch_id in CatalogImportBatch.objects.filter(status="QUEUED").order_by("started_at").values_list("pk", flat=True)[:options["limit"]]:
            try:
                with transaction.atomic():
                    batch = CatalogImportBatch.objects.select_for_update().get(pk=batch_id)
                    if batch.status != "QUEUED":
                        continue
                    Company.objects.select_for_update().get(pk=batch.company_id)
                    execute_batch(batch)
                    create_notification(batch.created_by, "Catalogue import finished", f"Batch {batch.pk}: {batch.status}",
                        company=batch.company, level="SUCCESS" if batch.status == "COMPLETED" else "WARNING",
                        source_module="MDM", entity_type="CatalogImportBatch", entity_id=batch.pk,
                        link=f"/api/v1/master-data/catalog-imports/{batch.pk}/?company_id={batch.company_id}",
                        event_key=f"catalog-import-{batch.pk}")
                self.stdout.write(f"Completed {batch_id}")
            except Exception as exc:
                state = "ERROR" if isinstance(exc, ValidationError) else "FAILED"
                CatalogImportBatch.objects.filter(pk=batch_id, status="QUEUED").update(status=state, error_message=str(exc)[:2000], finished_at=timezone.now())
                batch = CatalogImportBatch.objects.select_related("company", "created_by").get(pk=batch_id)
                create_notification(batch.created_by, "Catalogue import needs attention", f"Batch {batch.pk}: {state}",
                    company=batch.company, level="WARNING", source_module="MDM", entity_type="CatalogImportBatch",
                    entity_id=batch.pk, link=f"/api/v1/master-data/catalog-imports/{batch.pk}/?company_id={batch.company_id}",
                    event_key=f"catalog-import-{batch.pk}")
                self.stderr.write(f"Failed {batch_id}: {exc}")
