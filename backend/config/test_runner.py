import os
import pkgutil
import importlib
from django.apps import apps as django_apps
from django.conf import settings
from django.db import connections, transaction
from django.db.migrations.operations.special import RunPython
from django.test.runner import DiscoverRunner


class _DisableMigrations:
    def __contains__(self, item):
        return True

    def __getitem__(self, item):
        return None


def _run_seed_migrations_fast(using="default"):
    """
    Chạy toàn bộ các bước RunPython (seed permissions, report definitions, module catalog...)
    trực tiếp trên django_apps thực tế sau khi bảng đã được tạo bằng syncdb.
    Giúp bỏ qua việc dựng lại StateApps 367 lần (tiết kiệm ~12-14 phút khởi tạo test DB).
    """
    connection = connections[using]
    skip_apps = {"auth", "contenttypes", "admin", "sessions", "messages", "staticfiles"}

    seed_ops = []
    for app_config in django_apps.get_app_configs():
        if app_config.label in skip_apps:
            continue
        migrations_pkg_name = f"{app_config.name}.migrations"
        try:
            migrations_pkg = importlib.import_module(migrations_pkg_name)
        except ImportError:
            continue
        if not hasattr(migrations_pkg, "__path__"):
            continue

        module_names = sorted(
            name
            for _, name, is_pkg in pkgutil.iter_modules(migrations_pkg.__path__)
            if not is_pkg and not name.startswith("_")
        )
        for mod_name in module_names:
            try:
                mod = importlib.import_module(f"{migrations_pkg_name}.{mod_name}")
            except Exception:
                continue
            mig_cls = getattr(mod, "Migration", None)
            if mig_cls is None:
                continue
            for op in getattr(mig_cls, "operations", []):
                if isinstance(op, RunPython) and callable(op.code):
                    seed_ops.append((app_config.label, mod_name, op.code))

    with transaction.atomic(using=using):
        with connection.schema_editor() as schema_editor:
            for _app_label, _mod_name, code_fn in seed_ops:
                try:
                    with transaction.atomic(using=using):
                        code_fn(django_apps, schema_editor)
                except Exception:
                    # Bỏ qua nếu hàm backfill lịch sử tham chiếu cột đã đổi tên ở migration sau
                    pass


class FastTestRunner(DiscoverRunner):
    """
    Test runner tối ưu tốc độ cho CI/CD và local:
    - Tạo bảng trực tiếp từ model hiện hành (syncdb) thay vì replay 367 migrations tuần tự.
    - Thực thi toàn bộ RunPython seed (permissions, mẫu biểu báo cáo, phân hệ...) trong 1 transaction.
    - Có thể tắt bằng biến môi trường FULL_MIGRATION_TESTS=1 nếu cần kiểm tra lịch sử migration.
    """

    def setup_databases(self, **kwargs):
        use_fast_syncdb = os.getenv("FULL_MIGRATION_TESTS", "0") != "1"
        original_migration_modules = getattr(settings, "MIGRATION_MODULES", {})
        if use_fast_syncdb:
            settings.MIGRATION_MODULES = _DisableMigrations()
            # Khởi tạo bảng trên default DB trước khi nhân bản sang các worker --parallel
            from django.db.models.signals import post_migrate

            def _on_post_migrate(sender, **sig_kwargs):
                # Chỉ chạy 1 lần ở app cuối cùng
                pass

            try:
                # Nếu dùng --parallel, cần seed vào DB gốc trước khi clone_test_db chạy
                from django.db.backends.base.creation import BaseDatabaseCreation

                orig_create_test_db = BaseDatabaseCreation.create_test_db

                def _patched_create_test_db(creation_self, verbosity=1, autoclobber=False, serialize=True, keepdb=False):
                    test_db_name = orig_create_test_db(
                        creation_self,
                        verbosity=verbosity,
                        autoclobber=autoclobber,
                        serialize=False,
                        keepdb=keepdb,
                    )
                    _run_seed_migrations_fast(using=creation_self.connection.alias)
                    return test_db_name

                BaseDatabaseCreation.create_test_db = _patched_create_test_db
                try:
                    return super().setup_databases(**kwargs)
                finally:
                    BaseDatabaseCreation.create_test_db = orig_create_test_db
            finally:
                settings.MIGRATION_MODULES = original_migration_modules
        return super().setup_databases(**kwargs)

