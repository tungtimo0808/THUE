"""Read-only, source-backed reconciliation for the two existing tax reports."""
import hashlib
import json
from decimal import Decimal

from django.db import transaction
from rest_framework.exceptions import ValidationError

from general_ledger.models import JournalLine

from . import models, services, vat


RULE_VERSION = "TAX10-MVP-1"
TYPES = {
    "VAT_GL": "Bảng đối chiếu bảng kê thuế GTGT và sổ cái",
    "OBLIGATION_PAYMENT": "Bảng đối chiếu số thuế đã nộp và số thuế phải nộp",
}


def _hash(payload):
    return hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str).encode("utf-8")).hexdigest()


def _vat_gl(period):
    calculation = models.VatCalculation.objects.filter(period=period).order_by("-version").first()
    ledger = list(models.VatLedgerEntry.objects.filter(period=period).select_related("invoice").order_by("source_key"))
    gl = list(JournalLine.objects.filter(entry__company=period.company,
        entry__posting_date__range=(period.start_date, period.end_date), entry__status="POSTED")
        .select_related("account", "entry").order_by("entry__number", "line_no"))
    gl_vat = [line for line in gl if line.account.code.startswith(("133", "3331"))]
    included = [entry for entry in ledger if entry.decision == "INCLUDED"]
    input_ledger = sum((row.deductible_tax_amount for row in included if row.direction == "INPUT"), Decimal("0"))
    output_ledger = sum((row.tax_amount for row in included if row.direction == "OUTPUT"), Decimal("0"))
    input_gl = sum((line.debit - line.credit for line in gl_vat if line.account.code.startswith("133")), Decimal("0"))
    output_gl = sum((line.credit - line.debit for line in gl_vat if line.account.code.startswith("3331")), Decimal("0"))
    missing = not calculation or not ledger or not gl_vat
    stale = bool(calculation and not vat.is_current(calculation))
    warnings = []
    if not calculation or not ledger:
        warnings.append("Chưa có nguồn VAT Ledger/kết quả UC-TAX-07 đủ để đối chiếu.")
    if stale:
        warnings.append("Kết quả VAT đã cũ so với nguồn hóa đơn; cần tính lại.")
    if not gl_vat:
        warnings.append("Chưa có dòng sổ cái đã ghi sổ ở tài khoản nhóm 133/3331 trong kỳ.")
    warnings.append("Đây là đối chiếu tổng theo nhóm tài khoản; chưa có ánh xạ chính thức từng hóa đơn với bút toán GL.")
    rows = []
    for code, label, left, right in (("INPUT", "VAT đầu vào được khấu trừ ↔ TK 133", input_ledger, input_gl),
                                      ("OUTPUT", "VAT đầu ra ↔ TK 3331", output_ledger, output_gl)):
        diff = left - right
        rows.append({"key": code, "label": label, "source_a": str(left), "source_b": str(right),
                     "difference": str(diff), "status": "MISSING_SOURCE" if missing or stale else
                     "VARIANCE" if diff else "REVIEW_REQUIRED", "difference_type": "MISSING_GL" if not gl_vat else
                     "SOURCE_CHANGED" if stale else "TAX_MISMATCH" if diff else "REVIEW_REQUIRED",
                     "source_refs": {"vat_ledger": [str(item.id) for item in included if item.direction == code],
                                     "journal_lines": [str(item.id) for item in gl_vat if item.account.code.startswith("133" if code == "INPUT" else "3331")]}})
    snapshot = {"calculation_id": str(calculation.id) if calculation else None,
        "calculation_version": calculation.version if calculation else None,
        "calculation_current": not stale if calculation else False,
        "ledger": [(str(row.id), row.decision, str(row.tax_amount), str(row.deductible_tax_amount), row.source_fingerprint) for row in ledger],
        "gl": [(str(row.id), row.entry.status, row.entry.number, row.account.code, str(row.debit), str(row.credit)) for row in gl_vat]}
    return rows, warnings, snapshot


def _obligation_payment(period):
    obligations = list(models.TaxObligation.objects.filter(period=period).select_related("source_declaration")
        .prefetch_related("payment_links", "payment_order_lines__order").order_by("id"))
    rows = []
    warnings = []
    snapshot = []
    for obligation in obligations:
        links = list(obligation.payment_links.all())
        orders = list(obligation.payment_order_lines.all())
        linked = sum((link.amount for link in links), Decimal("0"))
        diff = obligation.paid_amount - linked
        pending = [line for line in orders if line.order.status == "DRAFT"]
        if links:
            warnings.append("Có khoản nộp từ liên kết BANK/CASH cũ; chưa có bằng chứng settlement để kết luận đã nộp NSNN.")
        status = "VARIANCE" if diff else "REVIEW_REQUIRED"
        rows.append({"key": str(obligation.id), "label": f"{obligation.tax_type} · {period.code}",
                     "source_a": str(obligation.paid_amount), "source_b": str(linked),
                     "difference": str(diff), "status": status,
                     "difference_type": "PAYMENT_MISMATCH" if diff else "SETTLEMENT_UNVERIFIED",
                     "assessed": str(obligation.assessed_amount + obligation.adjustment_amount),
                     "remaining": str(obligation.outstanding_amount), "draft_orders": len(pending),
                     "source_refs": {"obligation": str(obligation.id),
                                     "declaration": str(obligation.source_declaration_id) if obligation.source_declaration_id else None,
                                     "payment_links": [str(link.id) for link in links],
                                     "payment_orders": [str(line.order_id) for line in orders]}})
        snapshot.append((str(obligation.id), str(obligation.assessed_amount), str(obligation.adjustment_amount),
                         str(obligation.paid_amount), [(str(link.id), str(link.amount)) for link in links],
                         [(str(line.order_id), line.order.status, str(line.amount)) for line in orders]))
    if not obligations:
        warnings.append("Chưa có nghĩa vụ thuế trong kỳ; không thể kết luận các nguồn khớp nhau.")
    else:
        warnings.append("Chưa có nguồn xác nhận khoản nộp đã được NSNN hạch toán; kết quả cần kiểm tra chứng từ settlement.")
    return rows, list(dict.fromkeys(warnings)), snapshot


def evaluate(period, reconciliation_type):
    if reconciliation_type not in TYPES:
        raise ValidationError({"reconciliation_type": "Loại đối chiếu chưa được hỗ trợ trong MVP."})
    if period.tax_type != "VAT" and reconciliation_type == "VAT_GL":
        raise ValidationError({"period": "Bảng kê GTGT chỉ đối chiếu với kỳ thuế GTGT."})
    rows, warnings, snapshot = (_vat_gl(period) if reconciliation_type == "VAT_GL"
                                else _obligation_payment(period))
    variance_count = sum(row["status"] == "VARIANCE" for row in rows)
    missing_count = sum(row["status"] == "MISSING_SOURCE" for row in rows)
    result_status = ("VARIANCE" if variance_count else "REVIEW_REQUIRED" if warnings or missing_count or
                     any(row["status"] == "REVIEW_REQUIRED" for row in rows) else "MATCHED")
    summary = {"row_count": len(rows), "variance_count": variance_count, "missing_count": missing_count,
               "review_count": sum(row["status"] == "REVIEW_REQUIRED" for row in rows)}
    return result_status, summary, {"rows": rows, "warnings": warnings}, _hash(snapshot)


@transaction.atomic
def run(period, reconciliation_type, request):
    status, summary, details, fingerprint = evaluate(period, reconciliation_type)
    obj = models.ReconciliationRun.objects.create(company=period.company, period=period,
        reconciliation_type=reconciliation_type, rule_version=RULE_VERSION, result_status=status,
        source_snapshot_hash=fingerprint, summary=summary, details=details,
        discrepancy_count=summary["variance_count"] + summary["missing_count"],
        created_by=services.actor(request))
    services.audit(request, obj, "RECONCILE", after={"type": reconciliation_type, "status": status,
        "summary": summary, "rule_version": RULE_VERSION})
    return obj


def is_current(run):
    if run.reconciliation_type not in TYPES:
        return None
    return run.source_snapshot_hash == evaluate(run.period, run.reconciliation_type)[3]
