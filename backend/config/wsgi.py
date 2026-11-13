"""
WSGI config for config project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.1/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application
from django.urls import get_resolver

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_wsgi_application()

# Eagerly import all URLconfs, views, and serializers at master startup
# to eliminate the 5-6s lazy-import freeze on the first incoming HTTP request.
try:
    get_resolver()._populate()
except Exception:
    pass
