"""Keep bank statement originals outside the public Django media directory."""

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible


@deconstructible
class PrivateStatementStorage(FileSystemStorage):
    def __init__(self):
        super().__init__(location=settings.BASE_DIR / "private_bank_statements")

    def url(self, name):
        raise ValueError("Bank statement files are available through the authenticated API only.")
