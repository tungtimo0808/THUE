"""Long-running worker that drains queued catalogue imports/exports.

Audit 2026-10-27 (P1): import >= CATALOG_IMPORT_BACKGROUND_ROWS rows and large
exports are stored as QUEUED batches, but nothing ran the processing commands.
This command loops over them on a fixed interval so it can run as its own
Compose service / systemd unit without adding Celery or a message broker.
"""
import signal
import time

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import close_old_connections


class Command(BaseCommand):
    help = "Run catalogue import/export processing in a loop (background worker)."

    def add_arguments(self, parser):
        parser.add_argument("--interval", type=float, default=15.0, help="Seconds to sleep between polls.")
        parser.add_argument("--limit", type=int, default=10, help="Max batches per type per poll.")
        parser.add_argument("--once", action="store_true", help="Process one round and exit (for cron).")

    def handle(self, *args, **options):
        self._stop = False
        signal.signal(signal.SIGTERM, self._request_stop)
        signal.signal(signal.SIGINT, self._request_stop)

        interval = max(1.0, options["interval"])
        limit = max(1, options["limit"])
        self.stdout.write(f"Catalog worker started (interval={interval}s, limit={limit}).")

        while not self._stop:
            close_old_connections()
            for command in ("process_catalog_imports", "process_catalog_exports"):
                try:
                    call_command(command, limit=limit, stdout=self.stdout, stderr=self.stderr)
                except Exception as exc:  # keep the worker alive; each command already marks batch state
                    self.stderr.write(f"{command} crashed: {exc}")
            close_old_connections()
            if options["once"]:
                break
            slept = 0.0
            while slept < interval and not self._stop:
                time.sleep(0.5)
                slept += 0.5

        self.stdout.write("Catalog worker stopped.")

    def _request_stop(self, signum, frame):
        self._stop = True
