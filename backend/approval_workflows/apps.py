from django.apps import AppConfig


class ApprovalWorkflowsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "approval_workflows"
    verbose_name = "Quản lý Workflow phê duyệt"

    def ready(self):
        from django.apps import apps
        from django.db.models.signals import post_save
        from .requests import sync_source_decision

        def handle_decision(sender, instance, created, **kwargs):
            if created:
                sync_source_decision(instance)

        for app_label in ("purchases", "accounts_payable", "sales", "accounts_receivable",
                          "cash_management", "bank_management", "inventory", "fixed_assets"):
            post_save.connect(handle_decision, sender=apps.get_model(app_label, "ApprovalDecision"),
                              weak=False, dispatch_uid=f"wf_decision_{app_label}")
        post_save.connect(handle_decision, sender=apps.get_model("general_ledger", "JournalApproval"),
                          weak=False, dispatch_uid="wf_decision_general_ledger")
