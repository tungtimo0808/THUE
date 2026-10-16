from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import UserAccount


@receiver(post_save, sender=get_user_model())
def ensure_iam_user_account(sender, instance, created, **kwargs):
    if created:
        UserAccount.objects.get_or_create(
            auth_user=instance,
            defaults={"display_name": instance.get_full_name() or instance.get_username()},
        )
