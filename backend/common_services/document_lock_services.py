"""Book locks per document type, set by hand or derived from the monthly auto-lock rule."""
import calendar
from datetime import date

from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import CoreCompanySetting

LOCK_TYPES = {
    "PKT": "Chứng từ nghiệp vụ khác",
    "QTU": "Quyết toán tạm ứng",
    "KCLL": "Kết chuyển lãi lỗ",
    "PT": "Phiếu thu tiền mặt",
    "PC": "Phiếu chi tiền mặt",
    "BC": "Thu tiền gửi (Báo Có)",
    "BN": "Chi tiền gửi (Báo Nợ)",
    "HDBH": "Hóa đơn bán hàng",
}
AUTO_LOCK_DAYS = {15, 20, 25, "END"}


def _configuration(company):
    setting, _ = CoreCompanySetting.objects.get_or_create(company=company)
    return setting, dict(setting.configuration or {})


def _month_end(year, month):
    return date(year, month, calendar.monthrange(year, month)[1])


def auto_lock_date(config, today=None):
    """Last day of the latest month whose lock day (in the following month) has passed."""
    rule = config.get("auto_lock") or {}
    if not rule.get("enabled"):
        return None
    today = today or timezone.localdate()
    day = rule.get("day", 20)
    year, month = today.year, today.month
    lock_day = calendar.monthrange(year, month)[1] if day == "END" else int(day)
    # In this month we lock the previous month once the lock day is reached; otherwise the month before.
    back = 1 if today.day >= lock_day else 2
    month -= back
    while month < 1:
        month += 12
        year -= 1
    return _month_end(year, month)


def lock_settings(company):
    _, config = _configuration(company)
    manual = config.get("document_locks") or {}
    auto_locked = auto_lock_date(config)
    return {
        "locks": [
            {"code": code, "name": name, "locked": bool(manual.get(code)), "lock_date": manual.get(code)}
            for code, name in LOCK_TYPES.items()
        ],
        "auto_lock": {"enabled": False, "day": 20, **(config.get("auto_lock") or {})},
        "auto_lock_date": auto_locked.isoformat() if auto_locked else None,
    }


def save_lock_settings(company, data):
    setting, config = _configuration(company)
    locks = {}
    for row in data.get("locks", []):
        code = row.get("code")
        if code not in LOCK_TYPES:
            raise ValidationError({"locks": f"Loại chứng từ {code} không hỗ trợ khóa sổ."})
        if row.get("locked"):
            try:
                locks[code] = date.fromisoformat(str(row.get("lock_date"))).isoformat()
            except ValueError as exc:
                raise ValidationError({"locks": f"Ngày khóa của {code} không hợp lệ."}) from exc
    config["document_locks"] = locks
    if "auto_lock" in data:
        rule = data["auto_lock"] or {}
        day = rule.get("day", 20)
        day = "END" if day in ("END", "cuoi_thang") else int(day)
        if day not in AUTO_LOCK_DAYS:
            raise ValidationError({"auto_lock": "Ngày tự động khóa sổ chỉ được là 15, 20, 25 hoặc cuối tháng."})
        config["auto_lock"] = {"enabled": bool(rule.get("enabled")), "day": day}
    setting.configuration = config
    setting.save()
    return lock_settings(company)


def _extract_period_locked_doc_date(period, code):
    """
    UC-GL-12 (AF-02, BR-GL-LOCK-10, 47..51):
    Kiểm tra xem loại chứng từ `code` có nằm trong phạm vi bị khóa của kỳ `period` hay không,
    trả về ngày khóa hiệu lực (date) nếu bị khóa, hoặc None nếu không bị khóa.
    """
    eff_period_lock_date = period.lock_to_date or period.end_date
    if period.status == "CLOSED":
        return eff_period_lock_date
    if period.status != "PARTIALLY_LOCKED":
        return None
    raw_locked = period.locked_document_types or []
    if isinstance(raw_locked, dict):
        info = raw_locked.get(code) or raw_locked.get("ALL")
        if not info:
            return None
        if isinstance(info, dict) and info.get("lock_to_date"):
            try:
                return date.fromisoformat(str(info["lock_to_date"])[:10])
            except ValueError:
                return eff_period_lock_date
        if isinstance(info, str):
            try:
                return date.fromisoformat(info[:10])
            except ValueError:
                return eff_period_lock_date
        return eff_period_lock_date
    if isinstance(raw_locked, list):
        for item in raw_locked:
            if isinstance(item, str) and item.upper() in (str(code or "").upper(), "ALL"):
                return eff_period_lock_date
            if isinstance(item, dict) and str(item.get("code") or "").upper() in (str(code or "").upper(), "ALL"):
                if item.get("lock_to_date"):
                    try:
                        return date.fromisoformat(str(item["lock_to_date"])[:10])
                    except ValueError:
                        pass
                return eff_period_lock_date
    return None


def assert_not_locked(company, code, document_date):
    """
    Refuse to create/edit/post/unpost a document dated on or before its type's effective lock date
    or belonging to a CLOSED / PARTIALLY_LOCKED AccountingPeriod (UC-GL-12, BR-GL-LOCK-06, 10..12, 43..50).
    """
    if not document_date or not company:
        return
    if isinstance(document_date, str):
        try:
            document_date = date.fromisoformat(document_date[:10])
        except ValueError:
            return

    # 1. Kiểm tra Period Lock trên AccountingPeriod (UC-GL-12, BR-GL-LOCK-10..12, 43..50)
    try:
        from general_ledger.models import AccountingPeriod

        periods = AccountingPeriod.objects.filter(
            company=company,
            start_date__lte=document_date,
            end_date__gte=document_date,
            status__in=("CLOSED", "PARTIALLY_LOCKED"),
        )
        for period in periods:
            if period.status == "CLOSED":
                eff_date = period.lock_to_date or period.end_date
                if document_date <= eff_date:
                    raise ValidationError({
                        "period": (
                            f"Kỳ kế toán {period.code} đã khóa sổ đến ngày {eff_date.strftime('%d/%m/%Y')}; "
                            f"không thể thực hiện nghiệp vụ ngày hạch toán {document_date.strftime('%d/%m/%Y')} (BR-GL-LOCK-10..12, 43)."
                        ),
                        "error_code": "PERIOD_LOCKED",
                    })
            elif period.status == "PARTIALLY_LOCKED" and code:
                doc_lock_date = _extract_period_locked_doc_date(period, code)
                if doc_lock_date and document_date <= doc_lock_date:
                    doc_label = LOCK_TYPES.get(code, code)
                    raise ValidationError({
                        "period": (
                            f"{doc_label} ({code}) trong kỳ {period.code} đã bị khóa sổ một phần đến ngày "
                            f"{doc_lock_date.strftime('%d/%m/%Y')}; không thể thực hiện nghiệp vụ ngày {document_date.strftime('%d/%m/%Y')} (BR-GL-LOCK-47, 48)."
                        ),
                        "error_code": "DOCUMENT_TYPE_LOCKED_IN_PERIOD",
                    })
    except ValidationError:
        raise
    except Exception:
        pass

    # 2. Kiểm tra khóa sổ theo loại chứng từ trong CoreCompanySetting
    if code not in LOCK_TYPES:
        return
    _, config = _configuration(company)
    dates = [d for d in (
        (config.get("document_locks") or {}).get(code) and date.fromisoformat(config["document_locks"][code]),
        auto_lock_date(config),
    ) if d]
    if not dates:
        return
    locked_until = max(dates)
    if document_date <= locked_until:
        raise ValidationError(
            f"{LOCK_TYPES[code]} đã khóa sổ đến ngày {locked_until.strftime('%d/%m/%Y')}; "
            f"không thể ghi sổ chứng từ ngày {document_date.strftime('%d/%m/%Y')}."
        )


def journal_lock_code(entry):
    """Map a GL entry to the document type the lock screen manages (UC-GL-12, AF-02)."""
    if getattr(entry, "source_entity_type", "") == "AdvanceSettlementVoucher" or str(getattr(entry, "number", "")).upper().startswith("QT"):
        return "QTU"
    if entry.entry_type == "CLOSING":
        return "KCLL"
    src_mod = (entry.source_module or "").upper()
    ev = str(entry.source_event_id or "").upper()
    num = str(getattr(entry, "number", "") or "").upper()
    if src_mod == "CASH":
        if "RECEIPT" in ev or num.startswith("PT"):
            return "PT"
        return "PC"
    if src_mod == "BANK":
        if "RECEIPT" in ev or "CREDIT" in ev or num.startswith("BC"):
            return "BC"
        return "BN"
    if ev.startswith(("SAL.GOODS", "SAL.SERVICE")) or src_mod in ("SAL", "AR"):
        return "HDBH"
    if src_mod == "GL" or not src_mod:
        return "PKT"
    return src_mod
