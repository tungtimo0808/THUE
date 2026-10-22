"""UC-FA-06 – Đánh giá lại tài sản cố định: validation, posting, unposting and attachments of a revaluation document."""
import os
import re
import uuid
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from . import models
from .services import _closed, _snapshot, actor, audit

ZERO = Decimal("0")
NUMBER_PATTERN = re.compile(r"^[\w\-./]{1,50}$")
# BR07/BR08: kinds of revaluation that need a valuation record, a council and a conclusion.
RECORD_REQUIRED = {"STATE_DECISION", "RESTRUCTURE", "CONVERSION"}
CONCLUSION_REQUIRED = RECORD_REQUIRED | {"OTHER"}
ASSET_ACCOUNT_PREFIXES = ("211", "212", "213")
ACCUMULATED_PREFIX = "214"
REVALUATION_PREFIX = "412"
EXPENSE_PREFIXES = ("6", "8")
ATTACHMENT_MAX_SIZE = 5 * 1024 * 1024
ATTACHMENT_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".gif", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt", ".zip", ".rar"}

MESSAGES = {
    "EF01": "Bạn không có quyền đánh giá lại tài sản cố định.",
    "EF02": "Số chứng từ đánh giá lại không hợp lệ hoặc đã tồn tại.",
    "EF03": "Vui lòng nhập số biên bản đánh giá lại.",
    "EF04": "Ngày biên bản không hợp lệ. Vui lòng kiểm tra lại.",
    "EF05": "Vui lòng nhập ngày chứng từ và ngày hạch toán hợp lệ.",
    "EF06": "Kỳ kế toán đã khóa, không thể ghi nhận đánh giá lại tài sản.",
    "EF07": "Vui lòng chọn lý do đánh giá lại tài sản.",
    "EF08": "Chưa có căn cứ hợp lệ để điều chỉnh tài sản cố định.",
    "EF09": "Vui lòng khai báo đầy đủ thông tin thành viên tham gia đánh giá.",
    "EF10": "Vui lòng nhập kết luận đánh giá tài sản.",
    "EF11": "Vui lòng chọn ít nhất một tài sản cần đánh giá lại.",
    "EF12": "Tài sản {code} không hợp lệ.",
    "EF13": "Tài sản {code} không đủ điều kiện đánh giá lại tại ngày đã chọn.",
    "EF14": "Tài sản {code} đã được chọn trong chứng từ.",
    "EF15": "Dữ liệu tài sản {code} đã thay đổi. Vui lòng tải lại và kiểm tra.",
    "EF16": "Nguyên giá sau điều chỉnh không hợp lệ.",
    "EF17": "Hao mòn lũy kế sau điều chỉnh không hợp lệ.",
    "EF18": "Thời gian sử dụng còn lại sau điều chỉnh không hợp lệ.",
    "EF19": "Giá trị tính khấu hao sau điều chỉnh không hợp lệ.",
    "EF20": "Mức khấu hao tháng sau điều chỉnh không hợp lệ.",
    "EF21": "Tài khoản hạch toán không phù hợp với nghiệp vụ đánh giá lại.",
    "EF22": "Số tiền hạch toán không khớp với kết quả đánh giá lại.",
    "EF23": "Chưa có thông tin tài sản cần điều chỉnh.",
    "EF24": "Khoản điều chỉnh đã được ghi nhận tại chứng từ liên quan. Vui lòng kiểm tra lại.",
    "EF25": "Điều chỉnh ảnh hưởng đến dữ liệu kế toán đã ghi sổ. Vui lòng xử lý kỳ liên quan.",
    "EF26": "Thông tin tài sản đã thay đổi. Vui lòng tải lại dữ liệu.",
    "EF27": "Đánh giá lại tài sản cố định thất bại. Vui lòng thử lại.",
    "EF29": "Tệp đính kèm không hợp lệ hoặc vượt dung lượng tối đa 5MB.",
    "EF30": "Bạn không có quyền thực hiện nghiệp vụ đối với tài sản này.",
}


def fail(rule, field=None, **values):
    message = MESSAGES[rule].format(**values)
    raise ValidationError({field: message} if field else message)


def current_values(asset):
    """BR11/BR12: the values in force today; remaining life is what is left, not the original life."""
    return {
        "original_cost": asset.original_cost,
        "remaining_periods": max(asset.useful_life_periods - asset.periods_processed, 0),
        "accumulated_depreciation": asset.accumulated_depreciation,
        "depreciable_value": asset.original_cost - asset.salvage_value,
    }


def suggested_monthly(depreciable, accumulated, remaining):
    """Section 4.7: straight-line amount for a full month after the adjustment."""
    if remaining <= 0:
        return ZERO
    return ((depreciable - accumulated) / remaining).quantize(Decimal("1"))


def ineligibility(asset, company, effective_date):
    """BR10 / EF12 / EF13 / EF25 for one asset at the effective date; None when it may be revalued."""
    if asset.company_id != company.id:
        return "EF12"
    if asset.asset_type != "FIXED_ASSET" or asset.status != "ACTIVE" or asset.in_service_date > effective_date:
        return "EF13"
    later = models.AssetTransaction.objects.filter(asset=asset, status="POSTED", transaction_date__gt=effective_date).exclude(transaction_type="REVERSAL")
    if later.exists():
        return "EF25"
    return None


def candidates(company, effective_date):
    """Steps 16-17: fixed assets that can be revalued at the date, with the values before adjustment."""
    assets = models.AssetRecord.objects.filter(company=company, asset_type="FIXED_ASSET", status="ACTIVE").select_related(
        "department", "branch", "category__asset_account", "category__accumulated_account", "category__expense_account").order_by("code")
    rows = []
    for asset in assets:
        problem = ineligibility(asset, company, effective_date)
        if problem == "EF13":
            continue
        values = current_values(asset)
        category = asset.category
        rows.append({
            "id": str(asset.id), "code": asset.code, "name": asset.name, "branch": str(asset.branch_id),
            "department": str(asset.department_id) if asset.department_id else None,
            "department_name": asset.department.name if asset.department_id else "",
            **{key: str(value) for key, value in values.items()},
            "monthly_depreciation": str(suggested_monthly(values["depreciable_value"], values["accumulated_depreciation"], values["remaining_periods"])),
            "tax_monthly_depreciation": str(asset.tax_monthly_depreciation) if asset.tax_monthly_depreciation is not None else None,
            "asset_account_code": category.asset_account.code if category.asset_account_id else "",
            "accumulated_account_code": category.accumulated_account.code if category.accumulated_account_id else "",
            "expense_account_code": category.expense_account.code if category.expense_account_id else "",
            "blocked": MESSAGES[problem] if problem else "",
        })
    return rows


def next_number(company):
    """BR04: next number of the ĐGL series."""
    highest = 0
    for number in models.AssetRevaluation.objects.filter(company=company, number__startswith="ĐGL").values_list("number", flat=True):
        digits = re.sub(r"\D", "", number[3:])
        highest = max(highest, int(digits) if digits else 0)
    return f"ĐGL{highest + 1:05d}"


def _may(request, company, code, **scope):
    if getattr(request.user, "is_superuser", False):
        return True
    from iam.permissions import has_effective_permission
    return has_effective_permission(actor(request), company, code, **scope)


def _account_ok(account, company):
    return account.company_id == company.id and account.status == "ACTIVE" and account.is_postable


def check(revaluation, request, *, posting=False):
    """Steps 38-40: every rule of the document; `posting` re-reads the asset values under lock (EF26)."""
    company = revaluation.company
    if not NUMBER_PATTERN.match(revaluation.number or "") or models.AssetRevaluation.objects.filter(
            company=company, number=revaluation.number).exclude(pk=revaluation.pk).exists():
        fail("EF02", "number")
    if not revaluation.reason:
        fail("EF07", "reason")
    if not revaluation.document_date or not revaluation.posting_date:
        fail("EF05")
    if revaluation.record_number and not revaluation.record_date or revaluation.record_date and revaluation.record_date > revaluation.posting_date:
        fail("EF04", "record_date")
    if revaluation.effective_date > revaluation.posting_date:
        fail("EF04", "record_date")
    if revaluation.reason in RECORD_REQUIRED and not revaluation.record_number.strip():
        fail("EF03", "record_number")
    members = list(revaluation.members.all())
    if (revaluation.reason in RECORD_REQUIRED and not members) or any(
            not (member.full_name.strip() and member.title.strip() and member.representing.strip()) for member in members):
        fail("EF09", "members")
    if revaluation.reason in CONCLUSION_REQUIRED and not revaluation.conclusion.strip():
        fail("EF10", "conclusion")
    if not (revaluation.record_number.strip() or revaluation.references or revaluation.source_reference.strip()):
        fail("EF08")
    if revaluation.cost_booked_at_source:
        from general_ledger.models import JournalEntry
        if not JournalEntry.objects.filter(company=company, number=revaluation.source_reference.strip(), status="POSTED").exists():
            fail("EF08", "source_reference")

    lines = list(revaluation.lines.select_related("asset", "asset__category", "expense_account", "revaluation_account"))
    if not lines:
        fail("EF11", "lines")
    seen, changed = set(), False
    cost_difference = accumulated_difference = ZERO
    asset_accounts, accumulated_accounts = set(), set()
    for line in lines:
        asset = models.AssetRecord.objects.select_for_update().get(pk=line.asset_id) if posting else line.asset
        code = asset.code
        if asset.pk in seen:
            fail("EF14", "lines", code=code)
        seen.add(asset.pk)
        problem = ineligibility(asset, company, revaluation.effective_date)
        if problem:
            fail(problem, "lines", code=code)
        if not _may(request, company, "FA.REVALUATION.CREATE", branch_id=asset.branch_id):
            fail("EF30", "lines")
        values = current_values(asset)
        before = {"original_cost": line.before_original_cost, "remaining_periods": line.before_remaining_periods,
            "accumulated_depreciation": line.before_accumulated_depreciation, "depreciable_value": line.before_depreciable_value}
        if before != values:
            fail("EF26" if posting else "EF15", "lines", code=code)
        cost, accumulated = line.after_original_cost, line.after_accumulated_depreciation
        depreciable, remaining = line.after_depreciable_value, line.after_remaining_periods
        # BR20/BR21 (AF05): an upgrade adds to the asset and keeps the depreciation already recorded.
        if cost <= 0 or revaluation.reason == "UPGRADE" and cost < line.before_original_cost:
            fail("EF16", "lines")
        if accumulated < 0 or accumulated > cost or revaluation.reason == "UPGRADE" and accumulated != line.before_accumulated_depreciation:
            fail("EF17", "lines")
        if depreciable < 0 or depreciable > cost or depreciable < accumulated:
            fail("EF19", "lines")
        if remaining == 0 and depreciable > accumulated:
            fail("EF18", "lines")
        expected = suggested_monthly(depreciable, accumulated, remaining)
        if abs(line.monthly_depreciation_after - expected) > 1:
            fail("EF20", "lines")
        if line.tax_monthly_depreciation_after is not None and line.tax_monthly_depreciation_after < 0:
            fail("EF20", "lines")
        if line.expense_account and (not _account_ok(line.expense_account, company) or not line.expense_account.code.startswith(EXPENSE_PREFIXES)):
            fail("EF21", "lines")
        if line.revaluation_account and (not _account_ok(line.revaluation_account, company)
                or not line.revaluation_account.code.startswith(REVALUATION_PREFIX) or revaluation.reason == "UPGRADE"):
            fail("EF21", "lines")
        tax_changed = line.tax_monthly_depreciation_after is not None and line.tax_monthly_depreciation_after != asset.tax_monthly_depreciation
        changed = changed or tax_changed or any(before[key] != after for key, after in (
            ("original_cost", cost), ("remaining_periods", remaining), ("accumulated_depreciation", accumulated), ("depreciable_value", depreciable)))
        cost_difference += cost - line.before_original_cost
        accumulated_difference += accumulated - line.before_accumulated_depreciation
        if asset.category.asset_account_id:
            asset_accounts.add(asset.category.asset_account_id)
        if asset.category.accumulated_account_id:
            accumulated_accounts.add(asset.category.accumulated_account_id)
    if not changed:
        fail("EF23", "lines")

    # BR26/BR27: the entries carry exactly the cost and the accumulated-depreciation differences.
    is_asset = lambda account: account.pk in asset_accounts or account.code.startswith(ASSET_ACCOUNT_PREFIXES)
    is_accumulated = lambda account: account.pk in accumulated_accounts or account.code.startswith(ACCUMULATED_PREFIX)
    entries = list(revaluation.entries.select_related("debit_account", "credit_account", "party", "expense_item", "department"))
    net_asset = net_accumulated = ZERO
    for entry in entries:
        debit, credit = entry.debit_account, entry.credit_account
        if not _account_ok(debit, company) or not _account_ok(credit, company) or debit.pk == credit.pk:
            fail("EF21", "entries")
        if revaluation.reason == "UPGRADE" and (debit.code.startswith(REVALUATION_PREFIX) or credit.code.startswith(REVALUATION_PREFIX)):
            fail("EF21", "entries")
        if any(value is not None and value.company_id != company.id for value in (entry.party, entry.expense_item, entry.department)):
            fail("EF21", "entries")
        if entry.amount <= 0:
            fail("EF22", "entries")
        touches_asset = is_asset(debit) or is_asset(credit)
        if revaluation.cost_booked_at_source and touches_asset:
            fail("EF24", "entries")
        if not (touches_asset or is_accumulated(debit) or is_accumulated(credit)) or is_asset(debit) and is_asset(credit):
            fail("EF22", "entries")
        net_asset += entry.amount * ((1 if is_asset(debit) else 0) - (1 if is_asset(credit) else 0))
        net_accumulated += entry.amount * ((1 if is_accumulated(credit) else 0) - (1 if is_accumulated(debit) else 0))
    expected_cost = ZERO if revaluation.cost_booked_at_source else cost_difference
    if net_asset != expected_cost or net_accumulated != accumulated_difference:
        fail("EF22", "entries")
    if revaluation.cost_booked_at_source and models.AssetRevaluation.objects.filter(
            company=company, status="POSTED", cost_booked_at_source=True, source_reference=revaluation.source_reference,
            lines__asset__in=seen).exclude(pk=revaluation.pk).exists():
        fail("EF24", "source_reference")

    # BR06/BR31: the posting date must fall in an open accounting period and an open asset period.
    from general_ledger.models import AccountingPeriod
    period = AccountingPeriod.objects.filter(company=company, start_date__lte=revaluation.posting_date, end_date__gte=revaluation.posting_date).first()
    if period and period.status != "OPEN" or entries and not period or _closed(company, revaluation.posting_date):
        fail("EF06", "posting_date")
    return period


@transaction.atomic
def post(revaluation, request):
    """Steps 41-46: asset card, history and ledger are updated together or not at all (BR32/BR33)."""
    revaluation = models.AssetRevaluation.objects.select_for_update().get(pk=revaluation.pk)
    if revaluation.status == "POSTED":
        raise ValidationError("Chứng từ đánh giá lại đã được ghi sổ.")
    if revaluation.status != "DRAFT":
        raise ValidationError("Chứng từ đánh giá lại không ở trạng thái Chưa ghi sổ.")
    if not _may(request, revaluation.company, "FA.REVALUATION.POST"):
        fail("EF01")
    period = check(revaluation, request, posting=True)
    journal = None
    entries = list(revaluation.entries.select_related("debit_account", "credit_account"))
    lines = list(revaluation.lines.select_related("asset"))
    if entries:
        from general_ledger.models import JournalEntry, JournalLine
        from general_ledger.services import post as post_journal
        total = sum((entry.amount for entry in entries), ZERO)
        journal = JournalEntry.objects.create(
            company=revaluation.company, branch=revaluation.branch or lines[0].asset.branch, period=period,
            number=f"{revaluation.number}-GL", entry_type="SUBLEDGER", posting_date=revaluation.posting_date,
            document_date=revaluation.document_date, description=f"Đánh giá lại tài sản cố định {revaluation.number}",
            source_module="FA", source_event_id=f"FA.REVALUATION:{revaluation.pk}", source_entity_type="AssetRevaluation",
            source_entity_id=revaluation.pk, status="APPROVED", total_debit=total, total_credit=total,
            workflow_snapshot={"allow_creator_posting": True}, created_by=actor(request), approved_by=actor(request), approved_at=timezone.now(),
        )
        line_no = 0
        for entry in entries:
            dimensions = {"expense_item_id": str(entry.expense_item_id)} if entry.expense_item_id else {}
            for account, side in ((entry.debit_account, "debit"), (entry.credit_account, "credit")):
                line_no += 1
                JournalLine.objects.create(entry=journal, line_no=line_no, account=account, description=entry.description,
                    currency=revaluation.company.accounting_currency, party=entry.party, department=entry.department,
                    dimensions=dimensions, **{side: entry.amount})
        post_journal(journal, request)
    for line in lines:
        asset = models.AssetRecord.objects.select_for_update().get(pk=line.asset_id)
        before = {**_snapshot(asset), "tax_monthly_depreciation": str(asset.tax_monthly_depreciation) if asset.tax_monthly_depreciation is not None else None}
        # BR30: the new basis applies from now on; recorded depreciation is not rewritten.
        asset.original_cost = line.after_original_cost
        asset.accumulated_depreciation = line.after_accumulated_depreciation
        asset.salvage_value = line.after_original_cost - line.after_depreciable_value
        asset.useful_life_periods = max(asset.periods_processed + line.after_remaining_periods, 1)
        if line.tax_monthly_depreciation_after is not None:
            asset.tax_monthly_depreciation = line.tax_monthly_depreciation_after
        asset.save()
        history = models.AssetTransaction.objects.create(
            company=revaluation.company, asset=asset, number=_history_number(revaluation, line), transaction_type="REVALUATION",
            transaction_date=revaluation.effective_date, amount=abs(line.after_original_cost - line.before_original_cost),
            reason=revaluation.get_reason_display(), source_module="FA_REVAL", source_reference=revaluation.number,
            before_snapshot=before, after_snapshot=_snapshot(asset), status="POSTED", asset_applied=True,
            gl_status="POSTED" if journal else "NOT_REQUIRED", gl_reference=journal.number if journal else "",
            created_by=actor(request), approved_at=timezone.now(), posted_at=timezone.now(),
        )
        line.before_snapshot = before
        line.asset_transaction = history
        line.save(update_fields=("before_snapshot", "asset_transaction"))
    revaluation.status = "POSTED"
    revaluation.journal_entry = journal
    revaluation.posted_by = actor(request)
    revaluation.posted_at = timezone.now()
    revaluation.save(update_fields=("status", "journal_entry", "posted_by", "posted_at", "updated_at"))
    audit(request, revaluation, "POST", after={"number": revaluation.number, "lines": [
        {"asset": line.asset.code, "before": line.before_snapshot, "after": line.asset_transaction.after_snapshot} for line in lines],
        "journal": journal.number if journal else None})
    return revaluation


def _history_number(revaluation, line):
    number = f"{revaluation.number}-{line.line_no:02d}"
    while models.AssetTransaction.objects.filter(company=revaluation.company, number=number).exists():
        number = f"{number}.1"
    return number


@transaction.atomic
def reverse(revaluation, request, reason):
    """AF28: unposting restores the values before adjustment and reverses the entry, keeping the history."""
    revaluation = models.AssetRevaluation.objects.select_for_update().get(pk=revaluation.pk)
    if revaluation.status != "POSTED":
        raise ValidationError("Chỉ chứng từ đã ghi sổ mới được bỏ ghi sổ.")
    if not str(reason or "").strip():
        raise ValidationError({"reason": "Vui lòng nhập lý do bỏ ghi sổ."})
    for line in revaluation.lines.select_related("asset_transaction"):
        asset = models.AssetRecord.objects.select_for_update().get(pk=line.asset_id)
        history = line.asset_transaction
        later = models.AssetTransaction.objects.filter(asset=asset, status="POSTED").filter(
            Q(created_at__gt=history.created_at) | Q(transaction_date__gt=history.transaction_date)).exclude(pk=history.pk)
        if later.exists() or _snapshot(asset) != history.after_snapshot:
            raise ValidationError(f"Tài sản {asset.code} đã phát sinh nghiệp vụ sau đánh giá lại. Vui lòng xử lý các nghiệp vụ đó trước khi bỏ ghi sổ.")
        snapshot = line.before_snapshot
        asset.original_cost = Decimal(snapshot["original_cost"])
        asset.accumulated_depreciation = Decimal(snapshot["accumulated_depreciation"])
        asset.salvage_value = Decimal(snapshot["salvage_value"])
        asset.useful_life_periods = snapshot["useful_life_periods"]
        asset.tax_monthly_depreciation = Decimal(snapshot["tax_monthly_depreciation"]) if snapshot.get("tax_monthly_depreciation") else None
        asset.save()
        history.status = "REVERSED"
        history.save(update_fields=("status", "updated_at"))
    journal = revaluation.journal_entry
    if journal:
        from general_ledger.models import AccountingPeriod, JournalEntry, JournalLine
        from general_ledger.services import post as post_journal
        on = revaluation.posting_date
        period = AccountingPeriod.objects.filter(company=revaluation.company, start_date__lte=on, end_date__gte=on, status="OPEN").first()
        if not period:
            on = timezone.localdate()
            period = AccountingPeriod.objects.filter(company=revaluation.company, start_date__lte=on, end_date__gte=on, status="OPEN").first()
        if not period:
            fail("EF06")
        reversal = JournalEntry.objects.create(
            company=journal.company, branch=journal.branch, period=period, number=f"REV-{journal.number}", entry_type="REVERSAL",
            posting_date=on, document_date=on, description=f"Bỏ ghi sổ {revaluation.number}: {reason}", source_module="FA",
            source_event_id=f"FA.REVALUATION.REVERSE:{revaluation.pk}", original_entry=journal, status="APPROVED",
            total_debit=journal.total_credit, total_credit=journal.total_debit, created_by=actor(request),
            approved_by=actor(request), approved_at=timezone.now(), workflow_snapshot={"allow_creator_posting": True, "reversal": True},
        )
        for line in journal.lines.all():
            JournalLine.objects.create(entry=reversal, line_no=line.line_no, account=line.account, description=line.description,
                debit=line.credit, credit=line.debit, currency=line.currency, party=line.party, department=line.department, dimensions=line.dimensions)
        post_journal(reversal, request)
        journal.status = "REVERSED"
        journal.save(update_fields=("status", "updated_at"))
    revaluation.status = "REVERSED"
    revaluation.reversed_at = timezone.now()
    revaluation.reversal_reason = str(reason).strip()[:500]
    revaluation.save(update_fields=("status", "reversed_at", "reversal_reason", "updated_at"))
    audit(request, revaluation, "REVERSE", before={"status": "POSTED"}, after={"status": "REVERSED"}, reason=reason)
    return revaluation


def _attachment_path(revaluation, attachment_id, name):
    return f"fixed_assets/revaluations/{revaluation.pk}/{attachment_id}{os.path.splitext(name)[1].lower()}"


@transaction.atomic
def add_attachment(revaluation, request, upload):
    """AF24/EF29: files kept with the document; metadata lives in `attachments`."""
    from django.core.files.storage import default_storage
    revaluation = models.AssetRevaluation.objects.select_for_update().get(pk=revaluation.pk)
    if revaluation.status != "DRAFT":
        raise ValidationError("Chỉ đính kèm tệp cho chứng từ chưa ghi sổ.")
    if not upload or upload.size > ATTACHMENT_MAX_SIZE or os.path.splitext(upload.name)[1].lower() not in ATTACHMENT_EXTENSIONS:
        fail("EF29", "file")
    if len(revaluation.attachments) >= 20:
        raise ValidationError({"file": "Chỉ được đính kèm tối đa 20 tệp."})
    attachment_id = str(uuid.uuid4())
    default_storage.save(_attachment_path(revaluation, attachment_id, upload.name), upload)
    entry = {"id": attachment_id, "name": os.path.basename(upload.name)[:255], "size": upload.size,
        "content_type": getattr(upload, "content_type", "") or "", "uploaded_at": timezone.now().isoformat(), "uploaded_by": str(actor(request).pk)}
    revaluation.attachments = [*revaluation.attachments, entry]
    revaluation.save(update_fields=("attachments", "updated_at"))
    audit(request, revaluation, "ATTACH", after={"attachment": entry["name"], "size": entry["size"]})
    return revaluation


def attachment_file(revaluation, attachment_id):
    from django.core.files.storage import default_storage
    entry = next((row for row in revaluation.attachments if row.get("id") == attachment_id), None)
    if not entry:
        raise ValidationError("Không tìm thấy tệp đính kèm.")
    return entry, default_storage.open(_attachment_path(revaluation, attachment_id, entry["name"]), "rb")


@transaction.atomic
def remove_attachment(revaluation, request, attachment_id):
    from django.core.files.storage import default_storage
    revaluation = models.AssetRevaluation.objects.select_for_update().get(pk=revaluation.pk)
    if revaluation.status != "DRAFT":
        raise ValidationError("Không thể xóa tệp của chứng từ đã ghi sổ.")
    entry = next((row for row in revaluation.attachments if row.get("id") == attachment_id), None)
    if not entry:
        raise ValidationError("Không tìm thấy tệp đính kèm.")
    revaluation.attachments = [row for row in revaluation.attachments if row.get("id") != attachment_id]
    revaluation.save(update_fields=("attachments", "updated_at"))
    transaction.on_commit(lambda: default_storage.delete(_attachment_path(revaluation, attachment_id, entry["name"])))
    audit(request, revaluation, "DETACH", before={"attachment": entry["name"]})
    return revaluation
