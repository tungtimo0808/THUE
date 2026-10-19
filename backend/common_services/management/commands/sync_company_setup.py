"""Re-run the idempotent initial setup on active companies (enables newly added workspace modules, default fund…)."""
from django.core.management.base import BaseCommand

from common_services.setup_services import complete_company_setup
from iam.models import CompanyMembership, UserAccount
from organization.models import Company, CompanyStatus


class Command(BaseCommand):
    help = "Bổ sung thiết lập ban đầu (phân hệ, quỹ tiền mặt, kỳ kế toán…) cho các doanh nghiệp đang hoạt động."

    def handle(self, *args, **options):
        for company in Company.objects.filter(status=CompanyStatus.ACTIVE).order_by("name"):
            membership = CompanyMembership.objects.filter(company=company, membership_status="ACTIVE").order_by("joined_at").first()
            actor = membership.user if membership else UserAccount.objects.order_by("created_at").first()
            if actor is None:
                self.stdout.write(f"Bỏ qua {company.name}: chưa có người dùng.")
                continue
            complete_company_setup(company, actor)
            self.stdout.write(f"Đã đồng bộ thiết lập cho {company.name}.")
