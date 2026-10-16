from django.core.management.base import BaseCommand

from approval_workflows.services import synchronize


class Command(BaseCommand):
    help = "Activate scheduled approval workflows and expire finished versions"

    def handle(self, *args, **options):
        synchronize()
        self.stdout.write(self.style.SUCCESS("Approval workflows synchronized."))
