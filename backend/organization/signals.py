import uuid

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Company, OrganizationUnit


@receiver(post_save, sender=Company)
def ensure_company_root(sender, instance, created, **kwargs):
    if not created:
        return
    actor_id = instance.created_by_user_id or uuid.uuid4()
    OrganizationUnit.objects.get_or_create(
        company=instance, unit_type=OrganizationUnit.UnitType.COMPANY,
        defaults={
            "code": instance.code, "name": instance.name, "short_name": instance.short_name,
            "start_date": instance.created_at.date(), "status": "ACTIVE",
            "created_by_user_id": actor_id, "updated_by_user_id": actor_id,
        },
    )
