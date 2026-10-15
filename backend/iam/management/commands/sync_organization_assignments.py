from django.core.management.base import BaseCommand

from iam.models import CompanyMembership
from iam.organization_assignment_services import refresh_membership


class Command(BaseCommand):
    help = "Đồng bộ trạng thái phân công User theo ngày hiệu lực và Membership"

    def handle(self, *args, **options):
        memberships = CompanyMembership.objects.filter(organization_assignments__isnull=False).distinct()
        count = 0
        for membership in memberships.iterator():
            refresh_membership(membership)
            count += 1
        self.stdout.write(self.style.SUCCESS(f"Synced {count} memberships."))
