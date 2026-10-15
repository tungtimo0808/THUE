from datetime import date, timedelta
import re
import uuid

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from audit_log.services import record_audit
from common_services.models import (
    DateSource,
    DocumentNumberHistory,
    DocumentNumberingRule,
    GenerationEvent,
    NumberingMode,
    NumberingRuleStatus,
    NumberingSequenceTracker,
    OverflowStrategy,
    ResetCycle,
    SequenceScope,
)
from common_services.module_services import check_module_active
from iam.permissions import has_effective_permission
from master_data.models import DocumentType
from organization.models import Branch, Company


SUPPORTED_TOKENS = {
    "Prefix", "BranchCode", "DocumentType",
    "Year", "YY", "Month", "MM",
    "Separator", "Sequence", "Suffix",
}

TOKEN_PATTERN_REGEX = re.compile(r"\{([a-zA-Z0-9_]+)(?::(\d+))?\}")


def parse_pattern_tokens(pattern):
    """Extract and validate all {Token} tags in the pattern string."""
    tokens = []
    for match in TOKEN_PATTERN_REGEX.finditer(pattern):
        token_name = match.group(1)
        length_spec = match.group(2)
        tokens.append((token_name, int(length_spec) if length_spec else None))
    return tokens


def validate_rule_syntax(pattern, numbering_mode, reset_cycle, padding_length=6):
    """Validate format pattern, tokens, and reset cycle consistency (EF-05, EF-06, EF-09)."""
    if numbering_mode in (NumberingMode.AUTO, NumberingMode.HYBRID):
        if not pattern or not pattern.strip():
            raise ValidationError({"pattern": "Mẫu số chứng từ không được để trống đối với phương thức tự động hoặc kết hợp."})

        parsed = parse_pattern_tokens(pattern)
        token_names = [t[0] for t in parsed]

        # 1. Check unsupported tokens (EF-05)
        for t_name in token_names:
            if t_name not in SUPPORTED_TOKENS:
                raise ValidationError({"pattern": f"Mẫu số chứa thành phần không được hỗ trợ: {{{t_name}}} (EF-05)."})

        # 2. Check Sequence token presence (BR-NUM-06, EF-06)
        if "Sequence" not in token_names:
            raise ValidationError({"pattern": "Mẫu số cho chế độ đánh số tự động bắt buộc phải chứa thành phần {Sequence} (BR-NUM-06, EF-06)."})

        # 3. Check Reset Cycle safety (BR-NUM-23, BR-NUM-24, BR-NUM-25, EF-09)
        has_year = "Year" in token_names or "YY" in token_names
        has_month = "Month" in token_names or "MM" in token_names

        if reset_cycle == ResetCycle.YEARLY and not has_year:
            raise ValidationError({
                "reset_cycle": "Chu kỳ đặt lại hàng năm yêu cầu mẫu số phải chứa thành phần {Year} hoặc {YY} để tránh trùng số giữa các năm (BR-NUM-24, EF-09)."
            })

        if reset_cycle == ResetCycle.MONTHLY and (not has_year or not has_month):
            raise ValidationError({
                "reset_cycle": "Chu kỳ đặt lại hàng tháng yêu cầu mẫu số phải chứa cả năm ({Year}/{YY}) và tháng ({Month}/{MM}) để tránh trùng số (BR-NUM-25, EF-09)."
            })


def check_rule_conflicts(company, document_type, sequence_scope, branch=None, accounting_book="",
                         effective_from=None, effective_to=None, exclude_rule_id=None, exclude_rule_ids=None):
    """Prevent overlapping ACTIVE or SCHEDULED rules for same document type & scope (BR-NUM-05, EF-10)."""
    qs = DocumentNumberingRule.objects.filter(
        company=company,
        document_type=document_type,
        sequence_scope=sequence_scope,
        status__in=(NumberingRuleStatus.ACTIVE, NumberingRuleStatus.SCHEDULED),
    )
    if branch:
        qs = qs.filter(branch=branch)
    else:
        qs = qs.filter(branch__isnull=True)

    if accounting_book:
        qs = qs.filter(accounting_book=accounting_book)

    exclude_ids = set()
    if exclude_rule_id:
        exclude_ids.add(exclude_rule_id)
    if exclude_rule_ids:
        exclude_ids.update(exclude_rule_ids)
    if exclude_ids:
        qs = qs.exclude(pk__in=exclude_ids)

    eff_from = effective_from or timezone.localdate()
    for rule in qs:
        r_from = rule.effective_from
        r_to = rule.effective_to or date(9999, 12, 31)
        target_to = effective_to or date(9999, 12, 31)
        # Check date overlap
        if max(eff_from, r_from) <= min(target_to, r_to):
            raise ValidationError({
                "effective_from": f"Đã có quy tắc [{rule.code}] đang {rule.get_status_display().upper()} trong cùng phạm vi và khoảng thời gian hiệu lực ({r_from} -> {rule.effective_to or 'vô thời hạn'}) (BR-NUM-05, EF-10)."
            })


def preview_number_patterns(company, data, sample_count=3):
    """Generate sample document numbers for verification before saving/activating (Step 11, AF-14)."""
    pattern = data.get("pattern", "{Prefix}-{Year}-{Sequence:6}")
    numbering_mode = data.get("numbering_mode", NumberingMode.AUTO)
    reset_cycle = data.get("reset_cycle", ResetCycle.YEARLY)
    padding_length = int(data.get("padding_length") or 6)
    prefix = data.get("prefix", "DOC")
    suffix = data.get("suffix", "")
    separator = data.get("separator", "-")
    start_number = int(data.get("start_number") or 1)
    increment_by = int(data.get("increment_by") or 1)

    validate_rule_syntax(pattern, numbering_mode, reset_cycle, padding_length)

    branch_code = data.get("branch_code", "HN")
    doc_type_code = data.get("document_type_code", "PC")
    ref_date = timezone.localdate()

    samples = []
    current_seq = start_number
    for i in range(sample_count):
        num_str = format_document_number(
            pattern=pattern,
            prefix=prefix,
            suffix=suffix,
            separator=separator,
            branch_code=branch_code,
            doc_type_code=doc_type_code,
            ref_date=ref_date,
            sequence_number=current_seq,
            default_padding=padding_length,
            overflow_strategy=data.get("overflow_strategy", OverflowStrategy.AUTO_EXPAND),
        )
        samples.append({"sequence": current_seq, "sample_number": num_str, "date": ref_date.isoformat()})
        current_seq += increment_by

    # Also preview next cycle if reset cycle is active
    next_cycle_samples = []
    if reset_cycle == ResetCycle.YEARLY:
        next_date = date(ref_date.year + 1, 1, 15)
        next_cycle_samples.append({
            "cycle": f"Năm {next_date.year}",
            "sample_number": format_document_number(
                pattern=pattern, prefix=prefix, suffix=suffix, separator=separator,
                branch_code=branch_code, doc_type_code=doc_type_code, ref_date=next_date,
                sequence_number=start_number, default_padding=padding_length,
            )
        })
    elif reset_cycle == ResetCycle.MONTHLY:
        next_month = ref_date.month + 1 if ref_date.month < 12 else 1
        next_year = ref_date.year if ref_date.month < 12 else ref_date.year + 1
        next_date = date(next_year, next_month, 1)
        next_cycle_samples.append({
            "cycle": f"Tháng {next_month:02d}/{next_year}",
            "sample_number": format_document_number(
                pattern=pattern, prefix=prefix, suffix=suffix, separator=separator,
                branch_code=branch_code, doc_type_code=doc_type_code, ref_date=next_date,
                sequence_number=start_number, default_padding=padding_length,
            )
        })

    return {
        "pattern": pattern,
        "sample_branch": branch_code,
        "sample_doc_type": doc_type_code,
        "samples": samples,
        "next_cycle_preview": next_cycle_samples,
    }


def format_document_number(
    pattern, prefix, suffix, separator, branch_code, doc_type_code,
    ref_date, sequence_number, default_padding=6, overflow_strategy=OverflowStrategy.AUTO_EXPAND,
):
    """Render full formatted document number from pattern and context tokens."""
    tokens = parse_pattern_tokens(pattern)
    result = pattern

    # Determine sequence string
    seq_str = str(sequence_number)

    for token_name, length_spec in tokens:
        full_match = f"{{{token_name}:{length_spec}}}" if length_spec is not None else f"{{{token_name}}}"
        replacement = ""

        if token_name == "Prefix":
            replacement = prefix or ""
        elif token_name == "Suffix":
            replacement = suffix or ""
        elif token_name == "Separator":
            replacement = separator or ""
        elif token_name == "BranchCode":
            replacement = branch_code or ""
        elif token_name == "DocumentType":
            replacement = doc_type_code or ""
        elif token_name == "Year":
            replacement = str(ref_date.year)
        elif token_name == "YY":
            replacement = f"{ref_date.year % 100:02d}"
        elif token_name in ("Month", "MM"):
            replacement = f"{ref_date.month:02d}"
        elif token_name == "Sequence":
            req_padding = length_spec if length_spec is not None else default_padding
            if len(seq_str) > req_padding:
                if overflow_strategy == OverflowStrategy.BLOCK:
                    raise ValidationError("Số thứ tự đã vượt giới hạn độ dài cho phép của quy tắc (EF-16).")
                replacement = seq_str  # AUTO_EXPAND (BR-NUM-29, AF-16)
            else:
                replacement = seq_str.zfill(req_padding)

        result = result.replace(full_match, replacement)

    # Clean double separators if prefix/suffix were empty
    if separator:
        double_sep = f"{separator}{separator}"
        while double_sep in result:
            result = result.replace(double_sep, separator)
        result = result.strip(separator)

    return result


@transaction.atomic
def create_numbering_rule(company, data, actor):
    """Create a new numbering rule in DRAFT status (Main Flow 2.1, steps 1-12)."""
    code = (data.get("code") or "").strip().upper()
    if not code:
        raise ValidationError({"code": "Mã quy tắc là bắt buộc."})

    # Check unique code in company (BR-NUM-03, EF-02)
    if DocumentNumberingRule.objects.filter(company=company, code=code).exists():
        raise ValidationError({"code": f"Mã quy tắc '{code}' đã tồn tại trong doanh nghiệp (EF-02)."})

    doc_type_id = data.get("document_type")
    doc_type = DocumentType.objects.filter(pk=doc_type_id).first()
    if not doc_type:
        raise ValidationError({"document_type": "Loại chứng từ không tồn tại."})
    if doc_type.status != "ACTIVE":
        raise ValidationError({"document_type": "Loại chứng từ chưa được kích hoạt (EF-03)."})

    # Check module active for this document type (UC-SYS-12 integration)
    if not check_module_active(company, doc_type.module_code):
        raise ValidationError({
            "document_type": f"Phân hệ [{doc_type.module_code}] của loại chứng từ này hiện đang bị ngừng hoặc chưa được kích hoạt trong doanh nghiệp (UC-SYS-12)."
        })

    branch = None
    branch_id = data.get("branch")
    if branch_id:
        branch = Branch.objects.filter(pk=branch_id, company=company).first()
        if not branch:
            raise ValidationError({"branch": "Chi nhánh không thuộc doanh nghiệp (EF-04)."})

    start_num = int(data.get("start_number") or 1)
    padding_len = int(data.get("padding_length") or 6)
    increment_by = int(data.get("increment_by") or 1)
    if start_num < 0 or padding_len <= 0 or increment_by <= 0:
        raise ValidationError({"start_number": "Số bắt đầu, độ dài và bước tăng phải là số nguyên dương hợp lệ (EF-07)."})

    pattern = data.get("pattern", "{Prefix}-{Year}-{Sequence:6}")
    numbering_mode = data.get("numbering_mode", NumberingMode.AUTO)
    reset_cycle = data.get("reset_cycle", ResetCycle.YEARLY)
    validate_rule_syntax(pattern, numbering_mode, reset_cycle, padding_len)

    effective_from = data.get("effective_from") or timezone.localdate()
    effective_to = data.get("effective_to")

    rule = DocumentNumberingRule.objects.create(
        company=company,
        code=code,
        name=data.get("name", code),
        document_type=doc_type,
        numbering_mode=numbering_mode,
        sequence_scope=data.get("sequence_scope", SequenceScope.COMPANY),
        branch=branch,
        accounting_book=data.get("accounting_book", ""),
        custom_scope_key=data.get("custom_scope_key", ""),
        pattern=pattern,
        prefix=data.get("prefix", ""),
        suffix=data.get("suffix", ""),
        separator=data.get("separator", "-"),
        start_number=start_num,
        padding_length=padding_len,
        increment_by=increment_by,
        reset_cycle=reset_cycle,
        date_source=data.get("date_source", DateSource.DOCUMENT_DATE),
        generation_event=data.get("generation_event", GenerationEvent.ON_CREATE),
        overflow_strategy=data.get("overflow_strategy", OverflowStrategy.AUTO_EXPAND),
        effective_from=effective_from,
        effective_to=effective_to,
        status=NumberingRuleStatus.DRAFT,
        version=1,
        notes=data.get("notes", ""),
        created_by=actor,
        updated_by=actor,
    )

    record_audit(
        company=company,
        actor_user=actor,
        module_code="SYS",
        action_code="NUMBERING_RULE_CREATE",
        entity=rule,
        after={"code": rule.code, "status": rule.status, "version": rule.version},
    )
    return rule


@transaction.atomic
def update_draft_rule(rule, data, actor):
    """Update a rule in DRAFT status. ACTIVE/SCHEDULED rules must create a new version (BR-NUM-30, AF-12)."""
    if rule.status != NumberingRuleStatus.DRAFT:
        raise ValidationError(
            "Quy tắc đã kích hoạt không được chỉnh sửa trực tiếp. Vui lòng sử dụng chức năng 'Tạo phiên bản mới' (BR-NUM-30, AF-12)."
        )

    branch = rule.branch
    if "branch" in data:
        branch_id = data.get("branch")
        branch = Branch.objects.filter(pk=branch_id, company=rule.company).first() if branch_id else None
        if branch_id and not branch:
            raise ValidationError({"branch": "Chi nhánh không thuộc doanh nghiệp (EF-04)."})

    pattern = data.get("pattern", rule.pattern)
    numbering_mode = data.get("numbering_mode", rule.numbering_mode)
    reset_cycle = data.get("reset_cycle", rule.reset_cycle)
    padding_len = int(data.get("padding_length", rule.padding_length))
    start_num = int(data.get("start_number", rule.start_number))
    increment_by = int(data.get("increment_by", rule.increment_by))

    if start_num < 0 or padding_len <= 0 or increment_by <= 0:
        raise ValidationError({"start_number": "Số bắt đầu, độ dài và bước tăng không hợp lệ (EF-07)."})

    validate_rule_syntax(pattern, numbering_mode, reset_cycle, padding_len)

    rule.name = data.get("name", rule.name)
    rule.pattern = pattern
    rule.numbering_mode = numbering_mode
    rule.sequence_scope = data.get("sequence_scope", rule.sequence_scope)
    rule.branch = branch
    rule.accounting_book = data.get("accounting_book", rule.accounting_book)
    rule.custom_scope_key = data.get("custom_scope_key", rule.custom_scope_key)
    rule.prefix = data.get("prefix", rule.prefix)
    rule.suffix = data.get("suffix", rule.suffix)
    rule.separator = data.get("separator", rule.separator)
    rule.start_number = start_num
    rule.padding_length = padding_len
    rule.increment_by = increment_by
    rule.reset_cycle = reset_cycle
    rule.date_source = data.get("date_source", rule.date_source)
    rule.generation_event = data.get("generation_event", rule.generation_event)
    rule.overflow_strategy = data.get("overflow_strategy", rule.overflow_strategy)
    rule.effective_from = data.get("effective_from", rule.effective_from)
    rule.effective_to = data.get("effective_to", rule.effective_to)
    rule.notes = data.get("notes", rule.notes)
    rule.updated_by = actor
    rule.save()

    record_audit(
        company=rule.company,
        actor_user=actor,
        module_code="SYS",
        action_code="NUMBERING_RULE_UPDATE",
        entity=rule,
        after={"code": rule.code, "version": rule.version},
    )
    return rule


@transaction.atomic
def activate_numbering_rule(rule, actor, effective_from=None):
    """Activate a rule following Main Flow 2.1 steps 15-25."""
    if rule.status in (NumberingRuleStatus.ACTIVE, NumberingRuleStatus.ARCHIVED):
        raise ValidationError(f"Quy tắc đang ở trạng thái {rule.get_status_display()}, không thể kích hoạt lại.")

    today = timezone.localdate()
    eff_from = effective_from or rule.effective_from or today

    exclude_ids = {rule.pk}
    if rule.previous_version_id:
        exclude_ids.add(rule.previous_version_id)

    # 1. Check conflicts with other active rules (BR-NUM-05, EF-10)
    check_rule_conflicts(
        company=rule.company,
        document_type=rule.document_type,
        sequence_scope=rule.sequence_scope,
        branch=rule.branch,
        accounting_book=rule.accounting_book,
        effective_from=eff_from,
        effective_to=rule.effective_to,
        exclude_rule_ids=exclude_ids,
    )

    # 2. Check module still active (Pre-condition, EF-03)
    if not check_module_active(rule.company, rule.document_type.module_code):
        raise ValidationError(f"Phân hệ [{rule.document_type.module_code}] hiện đang bị tắt trong doanh nghiệp.")

    # 3. If replacing a previous version, close previous version (Step 22, BR-NUM-33)
    if rule.previous_version:
        prev = rule.previous_version
        prev.effective_to = eff_from - timedelta(days=1)
        if prev.status == NumberingRuleStatus.ACTIVE:
            prev.status = NumberingRuleStatus.INACTIVE
        prev.save(update_fields=("effective_to", "status", "updated_at"))

    # 4. Determine status based on effective_from (Step 21, BR-NUM-32, AF-10)
    target_status = NumberingRuleStatus.ACTIVE if eff_from <= today else NumberingRuleStatus.SCHEDULED

    rule.status = target_status
    rule.effective_from = eff_from
    rule.updated_by = actor
    rule.save(update_fields=("status", "effective_from", "updated_by", "updated_at"))

    # 5. Initialize sequence tracker (Step 20, EF-13)
    scope_key = resolve_scope_key(rule.sequence_scope, branch=rule.branch, accounting_book=rule.accounting_book, custom_key=rule.custom_scope_key)
    period_key = resolve_period_key(rule.reset_cycle, eff_from)
    NumberingSequenceTracker.objects.get_or_create(
        rule=rule,
        scope_key=scope_key,
        period_key=period_key,
        defaults={"company": rule.company, "current_number": max(0, rule.start_number - 1)},
    )

    # 6. Record Audit Log (Step 24, BR-NUM-46)
    record_audit(
        company=rule.company,
        actor_user=actor,
        module_code="SYS",
        action_code="NUMBERING_RULE_ACTIVATE",
        entity=rule,
        after={"code": rule.code, "status": target_status, "effective_from": str(eff_from), "version": rule.version},
    )
    return rule


@transaction.atomic
def create_new_version(rule, actor):
    """Create a new DRAFT version from an active/used rule (BR-NUM-30, AF-12)."""
    new_version_num = rule.version + 1
    new_rule = DocumentNumberingRule.objects.create(
        company=rule.company,
        code=rule.code,
        name=rule.name,
        document_type=rule.document_type,
        numbering_mode=rule.numbering_mode,
        sequence_scope=rule.sequence_scope,
        branch=rule.branch,
        accounting_book=rule.accounting_book,
        custom_scope_key=rule.custom_scope_key,
        pattern=rule.pattern,
        prefix=rule.prefix,
        suffix=rule.suffix,
        separator=rule.separator,
        start_number=rule.start_number,
        padding_length=rule.padding_length,
        increment_by=rule.increment_by,
        reset_cycle=rule.reset_cycle,
        date_source=rule.date_source,
        generation_event=rule.generation_event,
        overflow_strategy=rule.overflow_strategy,
        effective_from=timezone.localdate() + timedelta(days=1),
        effective_to=None,
        status=NumberingRuleStatus.DRAFT,
        version=new_version_num,
        previous_version=rule,
        notes=f"Phiên bản mới tạo từ phiên bản {rule.version}",
        created_by=actor,
        updated_by=actor,
    )
    record_audit(
        company=rule.company,
        actor_user=actor,
        module_code="SYS",
        action_code="NUMBERING_RULE_NEW_VERSION",
        entity=new_rule,
        after={"code": new_rule.code, "version": new_version_num, "source_version": rule.version},
    )
    return new_rule


@transaction.atomic
def copy_rule(source_rule, new_code, new_name, actor, target_document_type=None):
    """Copy an existing rule into a new DRAFT configuration (AF-11)."""
    new_code = (new_code or "").strip().upper()
    if not new_code:
        raise ValidationError({"code": "Mã quy tắc mới là bắt buộc."})
    if DocumentNumberingRule.objects.filter(company=source_rule.company, code=new_code).exists():
        raise ValidationError({"code": f"Mã quy tắc '{new_code}' đã tồn tại trong doanh nghiệp (EF-02)."})

    doc_type = target_document_type or source_rule.document_type
    copied_rule = DocumentNumberingRule.objects.create(
        company=source_rule.company,
        code=new_code,
        name=new_name or f"Sao chép từ {source_rule.name}",
        document_type=doc_type,
        numbering_mode=source_rule.numbering_mode,
        sequence_scope=source_rule.sequence_scope,
        branch=source_rule.branch,
        accounting_book=source_rule.accounting_book,
        custom_scope_key=source_rule.custom_scope_key,
        pattern=source_rule.pattern,
        prefix=source_rule.prefix,
        suffix=source_rule.suffix,
        separator=source_rule.separator,
        start_number=source_rule.start_number,
        padding_length=source_rule.padding_length,
        increment_by=source_rule.increment_by,
        reset_cycle=source_rule.reset_cycle,
        date_source=source_rule.date_source,
        generation_event=source_rule.generation_event,
        overflow_strategy=source_rule.overflow_strategy,
        effective_from=timezone.localdate(),
        effective_to=None,
        status=NumberingRuleStatus.DRAFT,
        version=1,
        previous_version=None,
        notes=f"Sao chép từ quy tắc [{source_rule.code}]",
        created_by=actor,
        updated_by=actor,
    )
    record_audit(
        company=source_rule.company,
        actor_user=actor,
        module_code="SYS",
        action_code="NUMBERING_RULE_COPY",
        entity=copied_rule,
        after={"code": new_code, "source_code": source_rule.code},
    )
    return copied_rule


@transaction.atomic
def deactivate_numbering_rule(rule, actor, reason, effective_to=None):
    """Deactivate a rule with reason; preserving historical numbers (AF-13, BR-NUM-34)."""
    if not reason or not reason.strip():
        raise ValidationError({"reason": "Lý do ngừng quy tắc đánh số là bắt buộc (AF-13)."})

    today = timezone.localdate()
    eff_to = effective_to or today
    if eff_to <= today:
        rule.status = NumberingRuleStatus.INACTIVE
        rule.effective_to = eff_to
    else:
        # Stop in future (remains ACTIVE until eff_to)
        rule.effective_to = eff_to

    rule.deactivation_reason = reason.strip()
    rule.updated_by = actor
    rule.save(update_fields=("status", "effective_to", "deactivation_reason", "updated_by", "updated_at"))

    record_audit(
        company=rule.company,
        actor_user=actor,
        module_code="SYS",
        action_code="NUMBERING_RULE_DEACTIVATE",
        entity=rule,
        after={"code": rule.code, "status": rule.status, "reason": reason.strip(), "effective_to": str(eff_to)},
    )
    return rule


def resolve_scope_key(sequence_scope, branch=None, accounting_book="", custom_key=""):
    """Compute the scope_key string for a sequence counter."""
    if sequence_scope == SequenceScope.BRANCH:
        return f"BRANCH:{branch.code if branch else 'HQ'}"
    if sequence_scope == SequenceScope.BRANCH_DOCUMENT_TYPE:
        return f"BRANCH:{branch.code if branch else 'HQ'}"
    if sequence_scope == SequenceScope.ACCOUNTING_BOOK:
        return f"BOOK:{accounting_book or 'MAIN'}"
    if sequence_scope == SequenceScope.CUSTOM_SCOPE:
        return f"CUSTOM:{custom_key or 'DEFAULT'}"
    return "COMPANY"


def resolve_period_key(reset_cycle, ref_date):
    """Compute period_key string based on reset cycle and date."""
    if reset_cycle == ResetCycle.YEARLY:
        return str(ref_date.year)
    if reset_cycle == ResetCycle.MONTHLY:
        return f"{ref_date.year}-{ref_date.month:02d}"
    if reset_cycle == ResetCycle.ACCOUNTING_PERIOD:
        return f"{ref_date.year}-P{ref_date.month:02d}"
    return "ALL"


@transaction.atomic
def generate_document_number(
    company,
    document_type,
    *,
    document_date=None,
    branch=None,
    accounting_book="",
    custom_scope_key="",
    actor=None,
    entity_type="",
    entity_id=None,
    event=GenerationEvent.ON_CREATE,
    is_preview=False,
):
    """Generate official document number with concurrency lock, formatting, and history logging (Section 2.2)."""
    # 1. Resolve date
    doc_date = document_date or timezone.localdate()

    # 2. Find matching ACTIVE rule (Step 2, EF-14)
    # Search hierarchy: BRANCH_DOCUMENT_TYPE -> BRANCH -> DOCUMENT_TYPE -> COMPANY
    base_qs = DocumentNumberingRule.objects.filter(
        company=company,
        document_type=document_type,
        status=NumberingRuleStatus.ACTIVE,
        effective_from__lte=doc_date,
    ).filter(
        Q(effective_to__isnull=True) | Q(effective_to__gte=doc_date)
    )

    rule = None
    if branch:
        rule = base_qs.filter(sequence_scope__in=(SequenceScope.BRANCH, SequenceScope.BRANCH_DOCUMENT_TYPE), branch=branch).first()
    if not rule and accounting_book:
        rule = base_qs.filter(sequence_scope=SequenceScope.ACCOUNTING_BOOK, accounting_book=accounting_book).first()
    if not rule:
        rule = base_qs.filter(sequence_scope__in=(SequenceScope.DOCUMENT_TYPE, SequenceScope.COMPANY)).first()

    if not rule:
        raise ValidationError(f"Không tìm thấy quy tắc đánh số ACTIVE phù hợp cho loại chứng từ '{document_type.name}' tại ngày {doc_date} (EF-14).")

    if rule.numbering_mode == NumberingMode.MANUAL:
        raise ValidationError("Quy tắc đánh số của loại chứng từ này yêu cầu nhập số thủ công (AF-01).")

    # If generation event does not match and event is before required, return temporary Draft ID (BR-NUM-22)
    if event != rule.generation_event and event == GenerationEvent.ON_CREATE:
        return f"TEMP-{document_type.code}-{uuid.uuid4().hex[:8].upper()}"

    # Determine reference date based on rule's date_source
    ref_date = doc_date if rule.date_source == DateSource.DOCUMENT_DATE else timezone.localdate()

    scope_key = resolve_scope_key(rule.sequence_scope, branch=branch, accounting_book=accounting_book, custom_key=custom_scope_key)
    period_key = resolve_period_key(rule.reset_cycle, ref_date)

    # 3. Lock sequence counter (Step 3, BR-NUM-09, BR-NUM-10, BR-NUM-11, EF-15)
    tracker, _ = NumberingSequenceTracker.objects.select_for_update().get_or_create(
        rule=rule,
        scope_key=scope_key,
        period_key=period_key,
        defaults={"company": company, "current_number": max(0, rule.start_number - 1)},
    )

    branch_code = branch.code if branch else "HQ"
    doc_type_code = document_type.code.split(".")[-1]

    # 4. Generate next sequence with uniqueness retry
    next_seq = tracker.current_number
    max_retries = 100
    full_number = ""

    for _ in range(max_retries):
        if next_seq < rule.start_number:
            next_seq = rule.start_number
        else:
            next_seq += rule.increment_by

        full_number = format_document_number(
            pattern=rule.pattern,
            prefix=rule.prefix,
            suffix=rule.suffix,
            separator=rule.separator,
            branch_code=branch_code,
            doc_type_code=doc_type_code,
            ref_date=ref_date,
            sequence_number=next_seq,
            default_padding=rule.padding_length,
            overflow_strategy=rule.overflow_strategy,
        )

        # 5. Check uniqueness in company & document type (Step 5, BR-NUM-07, BR-NUM-08)
        exists = DocumentNumberHistory.objects.filter(
            company=company,
            document_type=document_type,
            document_number=full_number,
        ).exists()

        if not exists:
            break
    else:
        raise ValidationError(f"Không thể cấp số chứng từ duy nhất sau {max_retries} lần thử (EF-17).")

    # 6. Update tracker and record history (Step 6, 7, BR-NUM-45)
    if not is_preview:
        tracker.current_number = next_seq
        tracker.last_issued_number = full_number
        tracker.last_issued_at = timezone.now()
        tracker.save(update_fields=("current_number", "last_issued_number", "last_issued_at", "updated_at"))

        DocumentNumberHistory.objects.create(
            company=company,
            rule=rule,
            document_type=document_type,
            document_number=full_number,
            status=DocumentNumberHistory.Status.ISSUED,
            sequence_number=next_seq,
            entity_type=entity_type,
            entity_id=entity_id,
            branch=branch,
            is_manual=False,
            issued_by=actor,
            issued_at=timezone.now(),
        )

    return full_number


@transaction.atomic
def validate_and_record_manual_number(company, document_type, document_number, actor, branch=None, entity_type="", entity_id=None):
    """Validate and record manual document number entry (BR-NUM-13, BR-NUM-14, AF-17, EF-19)."""
    doc_number = (document_number or "").strip()
    if not doc_number:
        raise ValidationError({"document_number": "Số chứng từ không được để trống."})

    # Check permission for manual numbering (BR-NUM-13)
    if actor and not has_effective_permission(actor, company, "SYS.NUMBERING.MANUAL_OVERRIDE"):
        if not getattr(actor.auth_user, "is_superuser", False):
            raise PermissionDenied("Bạn không có quyền nhập hoặc điều chỉnh số chứng từ thủ công (BR-NUM-13).")

    # Check uniqueness (BR-NUM-14, EF-19)
    if DocumentNumberHistory.objects.filter(company=company, document_type=document_type, document_number=doc_number).exists():
        raise ValidationError({"document_number": f"Số chứng từ '{doc_number}' đã tồn tại trong doanh nghiệp (EF-19)."})

    history = DocumentNumberHistory.objects.create(
        company=company,
        rule=None,
        document_type=document_type,
        document_number=doc_number,
        status=DocumentNumberHistory.Status.ISSUED,
        entity_type=entity_type,
        entity_id=entity_id,
        branch=branch,
        is_manual=True,
        issued_by=actor,
        issued_at=timezone.now(),
    )
    return history


@transaction.atomic
def cancel_document_number(company, document_type, document_number, reason, actor):
    """Mark a document number as CANCELLED so it is never reused (BR-NUM-17, AF-15)."""
    hist = DocumentNumberHistory.objects.filter(
        company=company,
        document_type=document_type,
        document_number=document_number,
    ).first()
    if not hist:
        hist = DocumentNumberHistory.objects.create(
            company=company,
            document_type=document_type,
            document_number=document_number,
            status=DocumentNumberHistory.Status.CANCELLED,
            notes=reason,
            issued_by=actor,
            issued_at=timezone.now(),
        )
    else:
        hist.status = DocumentNumberHistory.Status.CANCELLED
        hist.notes = f"{hist.notes} | Lý do hủy: {reason}".strip(" |")
        hist.save(update_fields=("status", "notes"))

    record_audit(
        company=company,
        actor_user=actor,
        module_code="SYS",
        action_code="DOCUMENT_NUMBER_CANCEL",
        entity=hist,
        after={"document_number": document_number, "reason": reason},
    )
    return hist


@transaction.atomic
def record_skipped_number(company, document_type, skipped_number, reason, actor, rule=None):
    """Log an intentionally or technically skipped sequence number (BR-NUM-18, 19, 20)."""
    return DocumentNumberHistory.objects.create(
        company=company,
        rule=rule,
        document_type=document_type,
        document_number=skipped_number,
        status=DocumentNumberHistory.Status.SKIPPED,
        notes=reason,
        issued_by=actor,
        issued_at=timezone.now(),
    )


@transaction.atomic
def create_default_numbering_rules_for_company(company, actor):
    """Seed standard starter numbering rules for single-member / simple enterprises (BR-NUM-40, BR-NUM-41)."""
    templates = [
        ("GL.JOURNAL_ENTRY", "PKT", "Phiếu kế toán", "{Prefix}-{Year}-{Sequence:6}"),
        ("CASH.PAYMENT", "PC", "Phiếu chi tiền mặt", "{Prefix}-{Year}-{Sequence:6}"),
        ("CASH.RECEIPT", "PT", "Phiếu thu tiền mặt", "{Prefix}-{Year}-{Sequence:6}"),
        ("BANK.PAYMENT", "UNC", "Ủy nhiệm chi ngân hàng", "{Prefix}-{Year}-{Sequence:6}"),
        ("BANK.RECEIPT", "GBN", "Giấy báo có ngân hàng", "{Prefix}-{Year}-{Sequence:6}"),
        ("PUR.ORDER", "PO", "Đơn mua hàng", "{Prefix}-{Year}-{Sequence:6}"),
        ("AP.INVOICE", "HDM", "Hóa đơn mua hàng", "{Prefix}-{Year}-{Sequence:6}"),
        ("SAL.ORDER", "SO", "Đơn bán hàng", "{Prefix}-{Year}-{Sequence:6}"),
        ("AR.INVOICE", "HDB", "Hóa đơn bán lẻ", "{Prefix}-{Year}-{Sequence:6}"),
        ("INV.INWARD", "NK", "Phiếu nhập kho", "{Prefix}-{Year}-{Sequence:6}"),
        ("INV.OUTWARD", "XK", "Phiếu xuất kho", "{Prefix}-{Year}-{Sequence:6}"),
    ]
    created = []
    today = timezone.localdate()
    for doc_code, prefix, name, pattern in templates:
        doc_type = DocumentType.objects.filter(code=doc_code).first()
        if not doc_type:
            continue
        rule_code = f"RULE_{prefix}"
        if DocumentNumberingRule.objects.filter(company=company, code=rule_code).exists():
            continue

        rule = DocumentNumberingRule.objects.create(
            company=company,
            code=rule_code,
            name=f"Quy tắc {name}",
            document_type=doc_type,
            numbering_mode=NumberingMode.AUTO,
            sequence_scope=SequenceScope.COMPANY,
            pattern=pattern,
            prefix=prefix,
            separator="-",
            start_number=1,
            padding_length=6,
            increment_by=1,
            reset_cycle=ResetCycle.YEARLY,
            date_source=DateSource.DOCUMENT_DATE,
            generation_event=GenerationEvent.ON_CREATE,
            overflow_strategy=OverflowStrategy.AUTO_EXPAND,
            effective_from=today,
            status=NumberingRuleStatus.ACTIVE,
            version=1,
            notes="Quy tắc mặc định khởi tạo tự động",
            created_by=actor,
            updated_by=actor,
        )
        # Initialize tracker
        NumberingSequenceTracker.objects.get_or_create(
            rule=rule,
            scope_key="COMPANY",
            period_key=str(today.year),
            defaults={"company": company, "current_number": 0},
        )
        created.append(rule)
    return created
