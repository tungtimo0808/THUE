import calendar
from datetime import date, datetime, timedelta
import uuid

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from audit_log.models import AuditLog
from iam.permissions import has_effective_permission

from .models import (
    FiscalPeriod,
    FiscalPeriodStatus,
    FiscalPeriodType,
    FiscalYear,
    FiscalYearStatus,
    FiscalYearType,
    PeriodStructure,
)


def log_period_audit(company, actor, action_code, entity_id, entity_type, before_data=None, after_data=None, reason=""):
    """Helper to record audit logs for fiscal year / period modifications (BR-PERIOD-52, 53, EF-20)."""
    try:
        from audit_log.models import AuditChange
        from audit_log.services import _json_value
        log = AuditLog.objects.create(
            company=company,
            actor_user=actor,
            module_code="SYS",
            action_code=action_code,
            entity_type=entity_type,
            entity_id=entity_id,
            reason=reason or f"Thao tác {action_code} trên {entity_type}",
        )
        if before_data or after_data:
            before, after = before_data or {}, after_data or {}
            changes = []
            for field_name in sorted(set(before) | set(after)):
                old_val = _json_value(before.get(field_name))
                new_val = _json_value(after.get(field_name))
                if old_val != new_val:
                    changes.append(AuditChange(audit_log=log, field_name=field_name, old_value_json=old_val, new_value_json=new_val))
            if changes:
                AuditChange.objects.bulk_create(changes)
        return log
    except Exception as e:
        raise ValidationError(f"Không thể ghi Audit Log cho thao tác kỳ kế toán: {str(e)} (EF-20).")


def generate_suggested_periods(
    year_type,
    start_date,
    end_date,
    period_structure,
    has_adjustment_period=False,
    code_prefix="FY",
):
    """Generate suggested periods for a fiscal year (Steps 6-8, AF-04, AF-05, AF-07)."""
    if end_date < start_date:
        raise ValidationError({"end_date": "Ngày kết thúc không được nhỏ hơn ngày bắt đầu (BR-PERIOD-04, EF-03)."})

    periods = []

    if period_structure == PeriodStructure.MONTHLY:
        curr_start = start_date
        period_idx = 1
        while curr_start <= end_date:
            # Last day of current month
            _, last_day = calendar.monthrange(curr_start.year, curr_start.month)
            curr_month_end = date(curr_start.year, curr_start.month, last_day)
            period_end = min(curr_month_end, end_date)

            periods.append({
                "code": f"{code_prefix}-M{period_idx:02d}",
                "name": f"Tháng {curr_start.month:02d}/{curr_start.year}",
                "period_number": period_idx,
                "start_date": curr_start,
                "end_date": period_end,
                "period_type": FiscalPeriodType.MONTH,
                "status": FiscalPeriodStatus.FUTURE,
                "allow_adjustment": False,
            })
            curr_start = period_end + timedelta(days=1)
            period_idx += 1

    elif period_structure == PeriodStructure.QUARTERLY:
        curr_start = start_date
        period_idx = 1
        while curr_start <= end_date:
            # Quarter calculation: 3 months span
            m = curr_start.month
            y = curr_start.year
            # Determine end of 3-month block
            target_month = m + 2
            target_year = y
            while target_month > 12:
                target_month -= 12
                target_year += 1
            _, last_day = calendar.monthrange(target_year, target_month)
            curr_quarter_end = date(target_year, target_month, last_day)
            period_end = min(curr_quarter_end, end_date)

            periods.append({
                "code": f"{code_prefix}-Q{period_idx}",
                "name": f"Quý {period_idx}/{curr_start.year}",
                "period_number": period_idx,
                "start_date": curr_start,
                "end_date": period_end,
                "period_type": FiscalPeriodType.QUARTER,
                "status": FiscalPeriodStatus.FUTURE,
                "allow_adjustment": False,
            })
            curr_start = period_end + timedelta(days=1)
            period_idx += 1

    elif period_structure == PeriodStructure.CUSTOM:
        # Defaults to a single custom period spanning whole year
        periods.append({
            "code": f"{code_prefix}-P01",
            "name": f"Kỳ 01/{start_date.year}",
            "period_number": 1,
            "start_date": start_date,
            "end_date": end_date,
            "period_type": FiscalPeriodType.CUSTOM,
            "status": FiscalPeriodStatus.FUTURE,
            "allow_adjustment": False,
        })

    if has_adjustment_period:
        adj_idx = len(periods) + 1
        periods.append({
            "code": f"{code_prefix}-ADJ",
            "name": f"Kỳ điều chỉnh {end_date.year}",
            "period_number": adj_idx,
            "start_date": end_date,
            "end_date": end_date,
            "period_type": FiscalPeriodType.ADJUSTMENT,
            "status": FiscalPeriodStatus.FUTURE,
            "allow_adjustment": True,
        })

    return periods


def validate_fiscal_year_and_periods(
    company,
    year_type,
    start_date,
    end_date,
    period_structure,
    has_adjustment_period,
    periods_data,
    exclude_fiscal_year_id=None,
):
    """Deep validation of FiscalYear and its child FiscalPeriods (Steps 9-14, BR-PERIOD-03..16, EF-03..11)."""
    # 1. Dates validation (BR-PERIOD-04, EF-03)
    if end_date < start_date:
        raise ValidationError({"end_date": "Ngày kết thúc không được nhỏ hơn ngày bắt đầu (BR-PERIOD-04, EF-03)."})

    # 2. Year type validation (EF-05, AF-01)
    if year_type == FiscalYearType.CALENDAR_YEAR:
        if not (start_date.month == 1 and start_date.day == 1 and end_date.month == 12 and end_date.day == 31 and start_date.year == end_date.year):
            raise ValidationError({
                "year_type": f"Loại năm tài chính CALENDAR_YEAR bắt buộc khoảng thời gian từ 01/01 đến 31/12 của cùng năm (EF-05)."
            })

    # 3. Fiscal Year overlap check (BR-PERIOD-05, EF-04)
    qs = FiscalYear.objects.filter(
        company=company,
        status__in=(FiscalYearStatus.DRAFT, FiscalYearStatus.ACTIVE, FiscalYearStatus.CLOSED),
    )
    if exclude_fiscal_year_id:
        qs = qs.exclude(pk=exclude_fiscal_year_id)

    for fy in qs:
        if max(start_date, fy.start_date) <= min(end_date, fy.end_date):
            raise ValidationError({
                "start_date": f"Khoảng thời gian [{start_date} -> {end_date}] bị chồng chéo với năm tài chính [{fy.code}] ({fy.start_date} -> {fy.end_date}) (BR-PERIOD-05, EF-04)."
            })

    # 4. Periods list validation
    if not periods_data:
        raise ValidationError({"periods": "Năm tài chính phải có ít nhất một kỳ kế toán."})

    normal_periods = []
    adjustment_periods = []

    codes_seen = set()
    numbers_seen = set()

    for p in periods_data:
        p_code = p.get("code")
        p_num = p.get("period_number")
        if not p_code:
            raise ValidationError({"periods": "Mã kỳ kế toán là bắt buộc."})
        if p_code in codes_seen:
            raise ValidationError({"periods": f"Mã kỳ [{p_code}] bị trùng trong cùng năm tài chính (BR-PERIOD-10, EF-10)."})
        codes_seen.add(p_code)

        if p_num is None:
            raise ValidationError({"periods": f"Số thứ tự cho kỳ [{p_code}] là bắt buộc."})
        if p_num in numbers_seen:
            raise ValidationError({"periods": f"Số thứ tự kỳ [{p_num}] bị trùng trong cùng năm tài chính (BR-PERIOD-11, EF-10)."})
        numbers_seen.add(p_num)

        p_start = p.get("start_date")
        p_end = p.get("end_date")
        if isinstance(p_start, str):
            p_start = datetime.strptime(p_start, "%Y-%m-%d").date()
        if isinstance(p_end, str):
            p_end = datetime.strptime(p_end, "%Y-%m-%d").date()

        if p_end < p_start:
            raise ValidationError({"periods": f"Kỳ [{p_code}] có ngày kết thúc nhỏ hơn ngày bắt đầu ({p_start} -> {p_end}) (EF-03)."})

        p_type = p.get("period_type", FiscalPeriodType.MONTH)
        parsed_p = {
            **p,
            "code": p_code,
            "period_number": p_num,
            "start_date": p_start,
            "end_date": p_end,
            "period_type": p_type,
        }

        if p_type == FiscalPeriodType.ADJUSTMENT:
            adjustment_periods.append(parsed_p)
        else:
            normal_periods.append(parsed_p)

    if not normal_periods:
        raise ValidationError({"periods": "Năm tài chính phải có ít nhất một kỳ thông thường."})

    # 5. Check normal periods bounds (BR-PERIOD-06, EF-09)
    normal_periods.sort(key=lambda x: (x["start_date"], x["period_number"]))

    first_p = normal_periods[0]
    last_p = normal_periods[-1]

    if first_p["start_date"] < start_date or last_p["end_date"] > end_date:
        raise ValidationError({"periods": "Các kỳ thông thường phải nằm hoàn toàn trong năm tài chính (BR-PERIOD-06, EF-09)."})

    if first_p["start_date"] > start_date:
        raise ValidationError({
            "periods": f"Có khoảng trống đầu năm: Năm tài chính bắt đầu ngày {start_date}, nhưng kỳ đầu tiên [{first_p['code']}] bắt đầu ngày {first_p['start_date']} (BR-PERIOD-08, EF-08)."
        })

    if last_p["end_date"] < end_date:
        raise ValidationError({
            "periods": f"Có khoảng trống cuối năm: Năm tài chính kết thúc ngày {end_date}, nhưng kỳ cuối cùng [{last_p['code']}] kết thúc ngày {last_p['end_date']} (BR-PERIOD-08, EF-08)."
        })

    # 6. Check sequence, continuity & non-overlapping of normal periods (BR-PERIOD-07, BR-PERIOD-08, EF-07, EF-08, EF-11)
    for i in range(len(normal_periods) - 1):
        p1 = normal_periods[i]
        p2 = normal_periods[i + 1]

        if p2["start_date"] <= p1["end_date"]:
            raise ValidationError({
                "periods": f"Hai kỳ [{p1['code']}] ({p1['start_date']} -> {p1['end_date']}) và [{p2['code']}] ({p2['start_date']} -> {p2['end_date']}) bị chồng chéo ngày (BR-PERIOD-07, EF-07, EF-11)."
            })

        expected_next_start = p1["end_date"] + timedelta(days=1)
        if p2["start_date"] > expected_next_start:
            raise ValidationError({
                "periods": f"Có khoảng trống giữa kỳ [{p1['code']}] và [{p2['code']}]: Khoảng ngày từ {expected_next_start} đến {p2['start_date'] - timedelta(days=1)} không thuộc kỳ nào (BR-PERIOD-08, EF-08)."
            })

        if p2["period_number"] <= p1["period_number"]:
            raise ValidationError({
                "periods": f"Số thứ tự kỳ phải tăng dần theo thời gian: Kỳ [{p2['code']}] ({p2['period_number']}) sau kỳ [{p1['code']}] ({p1['period_number']}) (BR-PERIOD-11)."
            })

    # 7. Check adjustment periods (BR-PERIOD-15, 16)
    if adjustment_periods and not has_adjustment_period:
        raise ValidationError({"periods": "Cấu hình năm tài chính không cho phép kỳ điều chỉnh (has_adjustment_period=False)."})

    for adj in adjustment_periods:
        if adj["start_date"] < start_date or adj["end_date"] > end_date:
            raise ValidationError({"periods": f"Kỳ điều chỉnh [{adj['code']}] phải nằm trong năm tài chính ({start_date} -> {end_date}) (BR-PERIOD-06)."})

    return normal_periods + adjustment_periods


@transaction.atomic
def create_fiscal_year(company, data, actor):
    """Create a new fiscal year with periods in DRAFT status (Main Flow 2.1 steps 1-11)."""
    code = data.get("code")
    if not code:
        raise ValidationError({"code": "Mã năm tài chính là bắt buộc."})

    if FiscalYear.objects.filter(company=company, code=code).exists():
        raise ValidationError({"code": f"Mã năm tài chính [{code}] đã tồn tại trong doanh nghiệp (BR-PERIOD-03, EF-02)."})

    name = data.get("name", code)
    year_type = data.get("year_type", FiscalYearType.CALENDAR_YEAR)
    start_date = data.get("start_date")
    end_date = data.get("end_date")
    period_structure = data.get("period_structure", PeriodStructure.MONTHLY)
    has_adjustment_period = bool(data.get("has_adjustment_period", False))
    notes = data.get("notes", "")

    if isinstance(start_date, str):
        start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
    if isinstance(end_date, str):
        end_date = datetime.strptime(end_date, "%Y-%m-%d").date()

    periods_data = data.get("periods")
    if not periods_data:
        periods_data = generate_suggested_periods(
            year_type=year_type,
            start_date=start_date,
            end_date=end_date,
            period_structure=period_structure,
            has_adjustment_period=has_adjustment_period,
            code_prefix=code,
        )

    validated_periods = validate_fiscal_year_and_periods(
        company=company,
        year_type=year_type,
        start_date=start_date,
        end_date=end_date,
        period_structure=period_structure,
        has_adjustment_period=has_adjustment_period,
        periods_data=periods_data,
    )

    fiscal_year = FiscalYear.objects.create(
        company=company,
        code=code,
        name=name,
        year_type=year_type,
        start_date=start_date,
        end_date=end_date,
        period_structure=period_structure,
        has_adjustment_period=has_adjustment_period,
        status=FiscalYearStatus.DRAFT,
        notes=notes,
        created_by=actor,
        updated_by=actor,
    )

    for p in validated_periods:
        FiscalPeriod.objects.create(
            company=company,
            fiscal_year=fiscal_year,
            code=p["code"],
            name=p.get("name", p["code"]),
            period_number=p["period_number"],
            start_date=p["start_date"],
            end_date=p["end_date"],
            period_type=p["period_type"],
            status=p.get("status", FiscalPeriodStatus.FUTURE),
            allow_adjustment=p.get("allow_adjustment", False),
            notes=p.get("notes", ""),
        )

    log_period_audit(
        company=company,
        actor=actor,
        action_code="FISCAL_YEAR_CREATE",
        entity_id=fiscal_year.id,
        entity_type="FiscalYear",
        after_data={"code": code, "name": name, "periods_count": len(validated_periods)},
    )
    return fiscal_year


@transaction.atomic
def update_fiscal_year_draft(fiscal_year, data, actor):
    """Update a draft fiscal year and its periods (AF-11)."""
    if fiscal_year.status != FiscalYearStatus.DRAFT:
        raise ValidationError("Chỉ có thể chỉnh sửa cấu trúc năm tài chính ở trạng thái DRAFT (BR-PERIOD-27, AF-11).")

    company = fiscal_year.company
    code = data.get("code", fiscal_year.code)
    if code != fiscal_year.code and FiscalYear.objects.filter(company=company, code=code).exclude(pk=fiscal_year.pk).exists():
        raise ValidationError({"code": f"Mã năm tài chính [{code}] đã tồn tại."})

    name = data.get("name", fiscal_year.name)
    year_type = data.get("year_type", fiscal_year.year_type)
    start_date = data.get("start_date", fiscal_year.start_date)
    end_date = data.get("end_date", fiscal_year.end_date)
    period_structure = data.get("period_structure", fiscal_year.period_structure)
    has_adjustment_period = data.get("has_adjustment_period", fiscal_year.has_adjustment_period)
    notes = data.get("notes", fiscal_year.notes)

    if isinstance(start_date, str):
        start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
    if isinstance(end_date, str):
        end_date = datetime.strptime(end_date, "%Y-%m-%d").date()

    periods_data = data.get("periods")
    if periods_data is None:
        # Keep existing periods or regenerate if dates/structure changed
        if start_date != fiscal_year.start_date or end_date != fiscal_year.end_date or period_structure != fiscal_year.period_structure:
            periods_data = generate_suggested_periods(
                year_type, start_date, end_date, period_structure, has_adjustment_period, code_prefix=code
            )
        else:
            periods_data = list(fiscal_year.periods.values(
                "code", "name", "period_number", "start_date", "end_date", "period_type", "status", "allow_adjustment", "notes"
            ))

    validated_periods = validate_fiscal_year_and_periods(
        company=company,
        year_type=year_type,
        start_date=start_date,
        end_date=end_date,
        period_structure=period_structure,
        has_adjustment_period=has_adjustment_period,
        periods_data=periods_data,
        exclude_fiscal_year_id=fiscal_year.pk,
    )

    fiscal_year.code = code
    fiscal_year.name = name
    fiscal_year.year_type = year_type
    fiscal_year.start_date = start_date
    fiscal_year.end_date = end_date
    fiscal_year.period_structure = period_structure
    fiscal_year.has_adjustment_period = has_adjustment_period
    fiscal_year.notes = notes
    fiscal_year.updated_by = actor
    fiscal_year.save()

    # Recreate periods
    fiscal_year.periods.all().delete()
    for p in validated_periods:
        FiscalPeriod.objects.create(
            company=company,
            fiscal_year=fiscal_year,
            code=p["code"],
            name=p.get("name", p["code"]),
            period_number=p["period_number"],
            start_date=p["start_date"],
            end_date=p["end_date"],
            period_type=p["period_type"],
            status=p.get("status", FiscalPeriodStatus.FUTURE),
            allow_adjustment=p.get("allow_adjustment", False),
            notes=p.get("notes", ""),
        )

    log_period_audit(
        company=company,
        actor=actor,
        action_code="FISCAL_YEAR_UPDATE",
        entity_id=fiscal_year.id,
        entity_type="FiscalYear",
        after_data={"code": code, "periods_count": len(validated_periods)},
    )
    return fiscal_year


@transaction.atomic
def activate_fiscal_year(fiscal_year, actor, open_first_period=False, open_current_period=False):
    """Activate fiscal year and set initial period states (Main Flow steps 15-25, BR-PERIOD-17)."""
    if fiscal_year.status in (FiscalYearStatus.ACTIVE, FiscalYearStatus.CLOSED, FiscalYearStatus.ARCHIVED):
        raise ValidationError(f"Năm tài chính đang ở trạng thái {fiscal_year.get_status_display()}, không thể kích hoạt lại.")

    company = fiscal_year.company

    # Final overlap check
    other_active = FiscalYear.objects.filter(
        company=company,
        status=FiscalYearStatus.ACTIVE,
    ).exclude(pk=fiscal_year.pk)
    for other in other_active:
        if max(fiscal_year.start_date, other.start_date) <= min(fiscal_year.end_date, other.end_date):
            raise ValidationError(f"Đã có năm tài chính [{other.code}] đang ACTIVE trong khoảng thời gian ({other.start_date} -> {other.end_date}) (BR-PERIOD-05, EF-04).")

    # Re-validate existing periods
    periods = list(fiscal_year.periods.all().order_by("period_number"))
    if not periods:
        raise ValidationError("Không thể kích hoạt năm tài chính không có kỳ kế toán.")

    validate_fiscal_year_and_periods(
        company=company,
        year_type=fiscal_year.year_type,
        start_date=fiscal_year.start_date,
        end_date=fiscal_year.end_date,
        period_structure=fiscal_year.period_structure,
        has_adjustment_period=fiscal_year.has_adjustment_period,
        periods_data=[
            {
                "code": p.code,
                "period_number": p.period_number,
                "start_date": p.start_date,
                "end_date": p.end_date,
                "period_type": p.period_type,
                "status": p.status,
                "allow_adjustment": p.allow_adjustment,
            }
            for p in periods
        ],
        exclude_fiscal_year_id=fiscal_year.pk,
    )

    fiscal_year.status = FiscalYearStatus.ACTIVE
    fiscal_year.updated_by = actor
    fiscal_year.save(update_fields=("status", "updated_by", "updated_at"))

    today = timezone.localdate()
    # Configure initial periods: FUTURE by default (BR-PERIOD-17)
    for p in periods:
        target_status = FiscalPeriodStatus.FUTURE
        if open_first_period and p.period_number == 1:
            target_status = FiscalPeriodStatus.OPEN
        elif open_current_period and p.start_date <= today <= p.end_date and p.period_type != FiscalPeriodType.ADJUSTMENT:
            target_status = FiscalPeriodStatus.OPEN

        if p.status != target_status:
            p.status = target_status
            p.save(update_fields=("status", "updated_at"))

    log_period_audit(
        company=company,
        actor=actor,
        action_code="FISCAL_YEAR_ACTIVATE",
        entity_id=fiscal_year.id,
        entity_type="FiscalYear",
        after_data={"status": fiscal_year.status, "open_first_period": open_first_period},
    )
    return fiscal_year


@transaction.atomic
def close_fiscal_year(fiscal_year, actor):
    """Close fiscal year after year-end processing."""
    if fiscal_year.status != FiscalYearStatus.ACTIVE:
        raise ValidationError("Chỉ có thể đóng năm tài chính đang ở trạng thái ACTIVE.")

    fiscal_year.status = FiscalYearStatus.CLOSED
    fiscal_year.updated_by = actor
    fiscal_year.save(update_fields=("status", "updated_by", "updated_at"))

    # Lock all child periods
    fiscal_year.periods.exclude(status=FiscalPeriodStatus.LOCKED).update(
        status=FiscalPeriodStatus.LOCKED,
        locked_by=actor,
        locked_at=timezone.now(),
    )

    log_period_audit(
        company=fiscal_year.company,
        actor=actor,
        action_code="FISCAL_YEAR_CLOSE",
        entity_id=fiscal_year.id,
        entity_type="FiscalYear",
        after_data={"status": fiscal_year.status},
    )
    return fiscal_year


@transaction.atomic
def copy_fiscal_year_structure(source_fiscal_year, new_code, new_name, new_start_date, new_end_date, actor):
    """Copy period structure from an existing fiscal year to a new fiscal year (AF-09, BR-PERIOD-46, 47)."""
    company = source_fiscal_year.company
    if FiscalYear.objects.filter(company=company, code=new_code).exists():
        raise ValidationError({"code": f"Mã năm tài chính [{new_code}] đã tồn tại trong doanh nghiệp (BR-PERIOD-03, EF-02)."})

    if isinstance(new_start_date, str):
        new_start_date = datetime.strptime(new_start_date, "%Y-%m-%d").date()
    if isinstance(new_end_date, str):
        new_end_date = datetime.strptime(new_end_date, "%Y-%m-%d").date()

    if new_end_date < new_start_date:
        raise ValidationError({"end_date": "Ngày kết thúc không được nhỏ hơn ngày bắt đầu (BR-PERIOD-04, EF-03)."})

    new_periods = generate_suggested_periods(
        year_type=source_fiscal_year.year_type,
        start_date=new_start_date,
        end_date=new_end_date,
        period_structure=source_fiscal_year.period_structure,
        has_adjustment_period=source_fiscal_year.has_adjustment_period,
        code_prefix=new_code,
    )

    new_fy = FiscalYear.objects.create(
        company=company,
        code=new_code,
        name=new_name,
        year_type=source_fiscal_year.year_type,
        start_date=new_start_date,
        end_date=new_end_date,
        period_structure=source_fiscal_year.period_structure,
        has_adjustment_period=source_fiscal_year.has_adjustment_period,
        status=FiscalYearStatus.DRAFT,
        notes=f"Sao chép cấu trúc từ năm {source_fiscal_year.code}",
        created_by=actor,
        updated_by=actor,
    )

    for p in new_periods:
        FiscalPeriod.objects.create(
            company=company,
            fiscal_year=new_fy,
            code=p["code"],
            name=p["name"],
            period_number=p["period_number"],
            start_date=p["start_date"],
            end_date=p["end_date"],
            period_type=p["period_type"],
            status=FiscalPeriodStatus.FUTURE,
            allow_adjustment=p.get("allow_adjustment", False),
        )

    log_period_audit(
        company=company,
        actor=actor,
        action_code="FISCAL_YEAR_COPY",
        entity_id=new_fy.id,
        entity_type="FiscalYear",
        before_data={"source_code": source_fiscal_year.code},
        after_data={"new_code": new_code},
    )
    return new_fy


@transaction.atomic
def change_period_status(period, new_status, actor, reason=""):
    """Change fiscal period status between FUTURE, OPEN, SOFT_CLOSED, LOCKED (BR-PERIOD-18..23, BR-PERIOD-53)."""
    if new_status not in FiscalPeriodStatus.values:
        raise ValidationError(f"Trạng thái kỳ [{new_status}] không hợp lệ.")

    if period.status == new_status:
        return period

    old_status = period.status
    now = timezone.now()

    if new_status == FiscalPeriodStatus.SOFT_CLOSED:
        period.closed_by = actor
        period.closed_at = now
    elif new_status == FiscalPeriodStatus.LOCKED:
        period.locked_by = actor
        period.locked_at = now
    elif new_status == FiscalPeriodStatus.OPEN and old_status in (FiscalPeriodStatus.SOFT_CLOSED, FiscalPeriodStatus.LOCKED):
        if not reason:
            raise ValidationError({"reason": "Mở lại kỳ đã đóng/khóa bắt buộc phải cung cấp lý do (BR-PERIOD-23, BR-PERIOD-53)."})
        period.reopened_by = actor
        period.reopened_at = now
        period.reopen_reason = reason

    period.status = new_status
    period.save()

    # Sync with general ledger period if linked
    if period.gl_period:
        gl = period.gl_period
        if new_status in (FiscalPeriodStatus.SOFT_CLOSED, FiscalPeriodStatus.LOCKED):
            gl.status = "CLOSED"
            gl.closed_by = actor
            gl.closed_at = now
        elif new_status == FiscalPeriodStatus.OPEN:
            gl.status = "OPEN"
            gl.reopened_by = actor
            gl.reopened_at = now
            gl.reopen_reason = reason
        gl.save()

    log_period_audit(
        company=period.company,
        actor=actor,
        action_code="FISCAL_PERIOD_STATUS_CHANGE",
        entity_id=period.id,
        entity_type="FiscalPeriod",
        before_data={"status": old_status},
        after_data={"status": new_status, "reason": reason},
        reason=reason or f"Đổi trạng thái kỳ [{period.code}] từ {old_status} sang {new_status}",
    )
    return period


def update_period_metadata(period, name=None, notes=None, allow_adjustment=None, actor=None):
    """Update period display name, notes, or adjustment settings without modifying dates (BR-PERIOD-31)."""
    update_fields = ["updated_at"]
    if name is not None:
        period.name = name
        update_fields.append("name")
    if notes is not None:
        period.notes = notes
        update_fields.append("notes")
    if allow_adjustment is not None and period.period_type == FiscalPeriodType.ADJUSTMENT:
        period.allow_adjustment = allow_adjustment
        update_fields.append("allow_adjustment")

    period.save(update_fields=update_fields)
    return period


def determine_period_for_date(company, target_date, date_type="DOCUMENT_DATE"):
    """Identify the active fiscal year and accounting period for a transaction date (Section 2.2, BR-PERIOD-24, 25, 41)."""
    if isinstance(target_date, str):
        try:
            target_date = datetime.strptime(target_date, "%Y-%m-%d").date()
        except ValueError:
            raise ValidationError({"date": "Định dạng ngày không hợp lệ (yêu cầu YYYY-MM-DD)."})

    # 1. Find ACTIVE FiscalYear covering target_date
    fy = FiscalYear.objects.filter(
        company=company,
        status=FiscalYearStatus.ACTIVE,
        start_date__lte=target_date,
        end_date__gte=target_date,
    ).first()

    if not fy:
        # Check if exists in SCHEDULED/DRAFT/FUTURE fiscal year
        future_fy = FiscalYear.objects.filter(
            company=company,
            start_date__lte=target_date,
            end_date__gte=target_date,
        ).first()
        if future_fy:
            raise ValidationError({
                "date": f"Ngày hạch toán/chứng từ {target_date} thuộc năm tài chính [{future_fy.code}] đang ở trạng thái {future_fy.get_status_display()}, chưa được KÍCH HOẠT (BR-PERIOD-25, EF-15)."
            })
        raise ValidationError({
            "date": f"Không tìm thấy năm tài chính và kỳ kế toán ACTIVE phù hợp cho ngày {target_date} (BR-PERIOD-24, BR-PERIOD-25, EF-15)."
        })

    # 2. Find normal period covering target_date
    period = FiscalPeriod.objects.filter(
        fiscal_year=fy,
        start_date__lte=target_date,
        end_date__gte=target_date,
    ).exclude(period_type=FiscalPeriodType.ADJUSTMENT).first()

    if not period:
        raise ValidationError({
            "date": f"Ngày {target_date} nằm trong năm tài chính [{fy.code}] nhưng không thuộc bất kỳ kỳ kế toán thông thường nào (EF-15)."
        })

    is_open = (period.status == FiscalPeriodStatus.OPEN)
    can_draft = period.status in (FiscalPeriodStatus.OPEN, FiscalPeriodStatus.FUTURE, FiscalPeriodStatus.SOFT_CLOSED)
    can_post = (period.status == FiscalPeriodStatus.OPEN)

    return {
        "fiscal_year": fy,
        "period": period,
        "status": period.status,
        "is_open": is_open,
        "can_draft": can_draft,
        "can_post": can_post,
    }


def check_posting_allowed(period, user_account=None, action="POST"):
    """Verify if voucher posting is allowed in the period (BR-PERIOD-20, 21, 22, 26, EF-16)."""
    if period.status == FiscalPeriodStatus.LOCKED:
        raise ValidationError(
            f"Kỳ kế toán [{period.code}] đang bị KHÓA (LOCKED). Không cho phép ghi sổ, sửa, xóa hoặc hủy dữ liệu kế toán (BR-PERIOD-22, EF-16)."
        )

    if period.status == FiscalPeriodStatus.FUTURE:
        raise ValidationError(
            f"Kỳ kế toán [{period.code}] chưa được mở (FUTURE). Không thể ghi sổ chứng từ vào kỳ tương lai chưa mở (BR-PERIOD-20)."
        )

    if period.status == FiscalPeriodStatus.SOFT_CLOSED:
        # Check if user has SYS.PERIOD.CLOSE permission to adjust closed period
        has_perm = False
        if user_account:
            has_perm = has_effective_permission(user_account, period.company, "SYS.PERIOD.CLOSE")
        if not has_perm:
            raise PermissionDenied(
                f"Kỳ kế toán [{period.code}] đang ở trạng thái ĐÓNG TẠM THỜI (SOFT_CLOSED). Chỉ người dùng có thẩm quyền mới được điều chỉnh (BR-PERIOD-21, AF-15)."
            )

    if period.status == FiscalPeriodStatus.ARCHIVED:
        raise ValidationError(f"Kỳ kế toán [{period.code}] đã lưu trữ (ARCHIVED), không thể ghi sổ.")

    return True


@transaction.atomic
def create_default_fiscal_year_for_company(company, actor, year=None):
    """Bootstrap a standard calendar year for single-member / simple enterprises (BR-PERIOD-44, 45)."""
    current_year = year or timezone.localdate().year
    code = f"FY{current_year}"
    start_date = date(current_year, 1, 1)
    end_date = date(current_year, 12, 31)

    existing = FiscalYear.objects.filter(company=company, code=code).first()
    if existing:
        return existing

    fy = create_fiscal_year(
        company=company,
        data={
            "code": code,
            "name": f"Năm tài chính {current_year}",
            "year_type": FiscalYearType.CALENDAR_YEAR,
            "start_date": start_date,
            "end_date": end_date,
            "period_structure": PeriodStructure.MONTHLY,
            "has_adjustment_period": False,
            "notes": "Năm tài chính mặc định",
        },
        actor=actor,
    )
    activate_fiscal_year(fy, actor, open_current_period=True)
    return fy
