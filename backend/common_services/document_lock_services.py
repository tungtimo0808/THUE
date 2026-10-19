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


def assert_not_locked(company, code, document_date):
    """Refuse to post a document dated on or before its type's effective lock date."""
    if code not in LOCK_TYPES or not document_date:
        return
    _, config = _configuration(company)
    dates = [d for d in (
        (config.get("document_locks") or {}).get(code) and date.fromisoformat(config["document_locks"][code]),
        auto_lock_date(config),
    ) if d]
    if not dates:
        return
    locked_until = max(dates)
    if isinstance(document_date, str):
        document_date = date.fromisoformat(document_date[:10])
    if document_date <= locked_until:
        raise ValidationError(
            f"{LOCK_TYPES[code]} đã khóa sổ đến ngày {locked_until.strftime('%d/%m/%Y')}; "
            f"không thể ghi sổ chứng từ ngày {document_date.strftime('%d/%m/%Y')}."
        )


def journal_lock_code(entry):
    """Map a GL entry to the document type the lock screen manages."""
    if entry.source_module == "GL" or not entry.source_module:
        return "KCLL" if entry.entry_type == "CLOSING" else "PKT"
    if str(entry.source_event_id or "").startswith(("SAL.GOODS", "SAL.SERVICE")):
        return "HDBH"
    return None
