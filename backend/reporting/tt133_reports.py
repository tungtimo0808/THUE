"""Read-only TT133 financial statements from posted general-ledger entries.

The report keeps unclassified cash flows and narrative notes visible as items
requiring review.  It never substitutes sample amounts for missing ledger data.
"""

from collections import defaultdict
from datetime import date
from decimal import Decimal

from django.utils import timezone
from accounts_receivable.models import Receivable
from accounts_payable.models import Payable
from general_ledger.models import ChartOfAccounts, JournalEntry, JournalLine
from .models import TT133NoteText

from .cash_flow_services import _compute_slot_cash_flow_data


ZERO = Decimal("0")

REPORTS = {
    "B01a-DNN": "Báo cáo tình hình tài chính",
    "B01b-DNN": "Báo cáo tình hình tài chính (phân loại ngắn hạn, dài hạn)",
    "B02-DNN": "Báo cáo kết quả hoạt động kinh doanh",
    "B03-DNN": "Báo cáo lưu chuyển tiền tệ (phương pháp trực tiếp)",
    "B03-DNN-GT": "Báo cáo lưu chuyển tiền tệ (phương pháp gián tiếp)",
    "B09-DNN": "Bản thuyết minh báo cáo tài chính",
    "F01-DNN": "Bảng cân đối tài khoản",
}


def _snapshot(company, year):
    """Return opening, period movement and closing by account and counterparty."""
    first, last = date(year, 1, 1), date(year, 12, 31)
    rows = JournalLine.objects.filter(
        entry__company=company,
        entry__status="POSTED",
        entry__posting_date__lte=last,
    ).values_list(
        "account__code", "account__name", "party_id", "entry__posting_date",
        "entry__entry_type", "debit", "credit",
    )
    result = defaultdict(lambda: {"name": "", "opening": ZERO, "debit": ZERO, "credit": ZERO, "income_debit": ZERO, "income_credit": ZERO})
    for code, name, party, posted, entry_type, debit, credit in rows.iterator():
        item = result[(code, party)]
        item["name"] = name
        if posted < first or entry_type == "OPENING":
            item["opening"] += debit - credit
        else:
            item["debit"] += debit
            item["credit"] += credit
            if entry_type != "CLOSING":
                item["income_debit"] += debit
                item["income_credit"] += credit
    for item in result.values():
        item["closing"] = item["opening"] + item["debit"] - item["credit"]
    return result


def _amount(snapshot, prefixes, slot="closing", side="DEBIT"):
    total = ZERO
    for (code, _party), item in snapshot.items():
        if any(code == prefix[1:] if prefix.startswith("=") else code.startswith(prefix) for prefix in prefixes):
            value = item[slot]
            if side == "CREDIT":
                value = -value
            if side == "DEBIT_POSITIVE" or side == "CREDIT_POSITIVE":
                value = max(value, ZERO)
            total += value
    return total


def _line(code, name, current, previous, level=1, status="COMPLETE"):
    def fmt(value):
        return None if value is None else str(value)

    return {
        "code": code, "name": name, "current": fmt(current),
        "previous": fmt(previous), "level": level, "status": status,
    }


def _maturity_split(company, year, snapshot):
    """Move only source balances that reconcile exactly with party-level GL."""
    if date(year, 12, 31) < timezone.localdate():
        return ZERO, ZERO, ["Kỳ so sánh cần số dư công nợ tại ngày khóa sổ để phân loại kỳ hạn."]
    cutoff = date(year + 1, 12, 31)
    long_receivable = long_payable = ZERO
    unresolved = set()
    for prefix, model, party_field, amount_side in (
        ("131", Receivable, "customer_id", "DEBIT"),
        ("331", Payable, "supplier_id", "CREDIT"),
    ):
        ledger = defaultdict(lambda: ZERO)
        for (account_code, party), item in snapshot.items():
            if account_code.startswith(prefix):
                value = item["closing"] if amount_side == "DEBIT" else -item["closing"]
                ledger[party] += max(value, ZERO)
        source = defaultdict(lambda: {"total": ZERO, "long": ZERO, "missing_due": False})
        queryset = model.objects.filter(company=company, balance__gt=0)
        if prefix == "131":
            queryset = queryset.filter(account__code__startswith="131", posting_date__lte=date(year, 12, 31)).prefetch_related("schedules")
        else:
            queryset = queryset.filter(created_at__date__lte=date(year, 12, 31))
        for item in queryset:
            party = getattr(item, party_field)
            source[party]["total"] += item.balance
            installments = [part for part in item.schedules.all() if part.balance > 0] if prefix == "131" else []
            if installments:
                if sum((part.balance for part in installments), ZERO) != item.balance:
                    source[party]["missing_due"] = True
                else:
                    source[party]["long"] += sum((part.balance for part in installments if part.due_date > cutoff), ZERO)
            elif item.due_date is None:
                source[party]["missing_due"] = True
            elif item.due_date > cutoff:
                source[party]["long"] += item.balance
        for party in set(ledger) | set(source):
            if source[party]["missing_due"] or source[party]["total"] != ledger[party]:
                if ledger[party] or source[party]["total"]:
                    unresolved.add(prefix)
                continue
            if prefix == "131":
                long_receivable += source[party]["long"]
            else:
                long_payable += source[party]["long"]
    warnings = [f"TK {prefix}: số dư hoặc hạn thanh toán ở sổ công nợ chưa khớp sổ cái; giữ phân loại tạm và cần rà soát." for prefix in sorted(unresolved)]
    return long_receivable, long_payable, warnings


def _balance_sheet(code, current, previous, company=None, year=None):
    """The B01 variants share account sources but use different grouping."""
    values = {}
    for key, prefixes, side in (
        ("cash", ("111", "112", "113"), "DEBIT"),
        ("investments", ("121", "128", "221", "222", "228", "2291", "2292"), "DEBIT"),
        ("receivables", ("131", "136", "138", "141", "331"), "DEBIT_POSITIVE"),
        ("inventory", ("151", "152", "153", "154", "155", "156", "157", "2294"), "DEBIT"),
        ("fixed_assets", ("211", "213", "=214", "2141", "2142", "2143", "2144", "2145", "2146"), "DEBIT"),
        ("investment_property", ("217", "2147"), "DEBIT"),
        ("construction", ("241",), "DEBIT"),
        ("other_assets", ("133", "242", "243", "244"), "DEBIT"),
        ("payables", ("131", "331", "333", "334", "335", "336", "338", "341", "342", "352", "353"), "CREDIT_POSITIVE"),
        ("equity", ("411", "412", "413", "414", "417", "418", "419", "421"), "CREDIT"),
    ):
        values[key] = (_amount(current, prefixes, side=side), _amount(previous, prefixes, side=side))
    values["receivables"] = tuple(
        values["receivables"][index] + _amount(snapshot, ("2293",))
        for index, snapshot in enumerate((current, previous))
    )

    def pair(key):
        return values[key]

    def total(*keys):
        return tuple(sum((values[key][i] for key in keys), ZERO) for i in (0, 1))

    assets = ("cash", "investments", "receivables", "inventory", "fixed_assets", "investment_property", "construction", "other_assets")
    rows = []
    if code == "B01a-DNN":
        specs = (
            ("110", "Tiền và các khoản tương đương tiền", "cash"),
            ("120", "Đầu tư tài chính", "investments"),
            ("130", "Các khoản phải thu", "receivables"),
            ("140", "Hàng tồn kho", "inventory"),
            ("150", "Tài sản cố định", "fixed_assets"),
            ("160", "Bất động sản đầu tư", "investment_property"),
            ("170", "Xây dựng cơ bản dở dang", "construction"),
            ("180", "Tài sản khác", "other_assets"),
        )
        rows.append(_line("A", "TÀI SẢN", *total(*assets), 0))
        details = {
            "120": (("121", "Chứng khoán kinh doanh", ("121",), "DEBIT"),
                    ("122", "Đầu tư nắm giữ đến ngày đáo hạn", ("128",), "DEBIT"),
                    ("123", "Đầu tư góp vốn vào đơn vị khác", ("221", "222", "228"), "DEBIT"),
                    ("124", "Dự phòng tổn thất đầu tư tài chính", ("2291", "2292"), "DEBIT")),
            "130": (("131", "Phải thu của khách hàng", ("131",), "DEBIT_POSITIVE"),
                    ("132", "Trả trước cho người bán", ("331",), "DEBIT_POSITIVE"),
                    ("133", "Vốn kinh doanh ở đơn vị trực thuộc", ("136",), "DEBIT_POSITIVE"),
                    ("134", "Phải thu khác", ("1388", "141"), "DEBIT_POSITIVE"),
                    ("135", "Tài sản thiếu chờ xử lý", ("1381",), "DEBIT_POSITIVE"),
                    ("136", "Dự phòng phải thu khó đòi", ("2293",), "DEBIT")),
            "140": (("141", "Hàng tồn kho", ("151", "152", "153", "154", "155", "156", "157"), "DEBIT"),
                    ("142", "Dự phòng giảm giá hàng tồn kho", ("2294",), "DEBIT")),
            "150": (("151", "Nguyên giá tài sản cố định", ("211", "213"), "DEBIT"),
                    ("152", "Giá trị hao mòn lũy kế", ("=214", "2141", "2142", "2143", "2144", "2145", "2146"), "DEBIT")),
            "160": (("161", "Nguyên giá bất động sản đầu tư", ("217",), "DEBIT"),
                    ("162", "Giá trị hao mòn lũy kế", ("2147",), "DEBIT")),
            "180": (("181", "Thuế GTGT được khấu trừ", ("133",), "DEBIT"),
                    ("182", "Tài sản khác", ("242", "243", "244"), "DEBIT")),
        }
        for line_code, label, key in specs:
            rows.append(_line(line_code, label, *pair(key)))
            for detail_code, detail_name, prefixes, side in details.get(line_code, ()):
                rows.append(_line(detail_code, detail_name,
                                  _amount(current, prefixes, side=side),
                                  _amount(previous, prefixes, side=side), 2))
        rows.append(_line("200", "TỔNG CỘNG TÀI SẢN", *total(*assets), 0))
        rows.append(_line("300", "Nợ phải trả", *pair("payables"), 0))
        for detail_code, detail_name, prefixes in (
            ("311", "Phải trả người bán", ("331",)),
            ("312", "Người mua trả tiền trước", ("131",)),
            ("313", "Thuế và các khoản phải nộp Nhà nước", ("333",)),
            ("314", "Phải trả người lao động", ("334",)),
            ("315", "Phải trả khác", ("335", "336", "338")),
            ("316", "Vay và nợ thuê tài chính", ("341", "342")),
            ("317", "Dự phòng phải trả", ("352",)),
            ("318", "Quỹ khen thưởng, phúc lợi", ("353",)),
        ):
            rows.append(_line(detail_code, detail_name,
                              _amount(current, prefixes, side="CREDIT_POSITIVE"),
                              _amount(previous, prefixes, side="CREDIT_POSITIVE"), 2))
        rows.append(_line("400", "Vốn chủ sở hữu", *pair("equity"), 0))
        liability_equity = total("payables", "equity")
        rows.append(_line("500", "TỔNG CỘNG NGUỒN VỐN", *liability_equity, 0))
    else:
        def classified(prefixes, side="DEBIT"):
            return (_amount(current, prefixes, side=side), _amount(previous, prefixes, side=side))

        def add_pairs(*pairs):
            return tuple(sum((item[index] for item in pairs), ZERO) for index in (0, 1))

        short_investment = classified(("121", "128", "2291"))
        long_investment = classified(("221", "222", "228", "2292"))
        long_ar, long_ap, maturity_warnings = _maturity_split(company, year, current)
        ar_unresolved = any("TK 131" in warning for warning in maturity_warnings)
        ap_unresolved = any("TK 331" in warning for warning in maturity_warnings)
        short_receivables = add_pairs(classified(("131", "136", "138", "141", "331"), "DEBIT_POSITIVE"), classified(("2293",)))
        short_receivables = (short_receivables[0] - long_ar, short_receivables[1])
        short_other = classified(("133", "242"))
        long_other = classified(("243", "244"))
        short_assets = add_pairs(pair("cash"), short_investment, short_receivables, pair("inventory"), short_other)
        long_assets = add_pairs(long_investment, pair("fixed_assets"), pair("investment_property"), pair("construction"), long_other, (long_ar, ZERO))
        short_payables = classified(("131", "331", "333", "334", "335", "336", "338"), "CREDIT_POSITIVE")
        short_payables = (short_payables[0] - long_ap, short_payables[1])
        long_payables = add_pairs(classified(("341", "342", "352", "353"), "CREDIT_POSITIVE"), (long_ap, ZERO))
        rows = [
            _line("100", "A - TÀI SẢN NGẮN HẠN", *short_assets, 0),
            _line("110", "Tiền và các khoản tương đương tiền", *pair("cash")),
            _line("120", "Đầu tư tài chính ngắn hạn", *short_investment),
            _line("130", "Các khoản phải thu ngắn hạn", *short_receivables, 1, "REQUIRES_INPUT" if ar_unresolved else "COMPLETE"),
            _line("140", "Hàng tồn kho", *pair("inventory")),
            _line("150", "Tài sản ngắn hạn khác", *short_other),
            _line("200", "B - TÀI SẢN DÀI HẠN", *long_assets, 0),
            _line("210", "Các khoản phải thu dài hạn", long_ar, None, 1, "REQUIRES_INPUT" if ar_unresolved else "COMPLETE"),
            _line("220", "Tài sản cố định", *pair("fixed_assets")),
            _line("230", "Bất động sản đầu tư", *pair("investment_property")),
            _line("240", "Xây dựng cơ bản dở dang", *pair("construction")),
            _line("250", "Đầu tư tài chính dài hạn", *long_investment),
            _line("260", "Tài sản dài hạn khác", *long_other),
            _line("300", "TỔNG CỘNG TÀI SẢN", *add_pairs(short_assets, long_assets), 0),
            _line("410", "Nợ ngắn hạn", *short_payables, 1, "REQUIRES_INPUT" if ap_unresolved else "COMPLETE"),
            _line("420", "Nợ dài hạn", *long_payables, 1, "REQUIRES_INPUT" if ap_unresolved else "COMPLETE"),
            _line("400", "NỢ PHẢI TRẢ", *add_pairs(short_payables, long_payables), 0),
            _line("500", "VỐN CHỦ SỞ HỮU", *pair("equity"), 0),
        ]
        liability_equity = add_pairs(short_payables, long_payables, pair("equity"))
        rows.append(_line("600", "TỔNG CỘNG NGUỒN VỐN", *liability_equity, 0))
    asset_total = total(*assets)
    warnings = []
    if code == "B01b-DNN":
        warnings.extend(maturity_warnings)
        warnings.append("B01b-DNN cần rà soát kỳ hạn của các khoản ngoài TK 131/331 và số liệu kỳ so sánh trước khi nộp.")
    if asset_total[0] != liability_equity[0]:
        warnings.append("Tổng tài sản chưa bằng tổng nguồn vốn; kiểm tra tài khoản chưa phân loại hoặc số dư lưỡng tính.")
    return rows, warnings


def _income(snapshot):
    def credit(*prefixes):
        return sum((item["income_credit"] - item["income_debit"] for (code, _), item in snapshot.items() if code.startswith(prefixes)), ZERO)

    def debit(*prefixes):
        return sum((item["income_debit"] - item["income_credit"] for (code, _), item in snapshot.items() if code.startswith(prefixes)), ZERO)

    # Closing transfers must not erase the year's operating results.
    return {
        "01": credit("511"), "02": debit("521"), "11": debit("632"),
        "21": credit("515"), "22": debit("635"), "24": debit("642"),
        "31": credit("711"), "32": debit("811"), "51": debit("821"),
    }


def _business_result(current, previous):
    def calc(snapshot):
        raw = _income(snapshot)
        raw["10"] = raw["01"] - raw["02"]
        raw["20"] = raw["10"] - raw["11"]
        raw["30"] = raw["20"] + raw["21"] - raw["22"] - raw["24"]
        raw["40"] = raw["31"] - raw["32"]
        raw["50"] = raw["30"] + raw["40"]
        raw["60"] = raw["50"] - raw["51"]
        return raw

    now, before = calc(current), calc(previous)
    labels = (
        ("01", "Doanh thu bán hàng và cung cấp dịch vụ"),
        ("02", "Các khoản giảm trừ doanh thu"),
        ("10", "Doanh thu thuần về bán hàng và cung cấp dịch vụ"),
        ("11", "Giá vốn hàng bán"),
        ("20", "Lợi nhuận gộp về bán hàng và cung cấp dịch vụ"),
        ("21", "Doanh thu hoạt động tài chính"),
        ("22", "Chi phí tài chính"),
        ("24", "Chi phí quản lý kinh doanh"),
        ("30", "Lợi nhuận thuần từ hoạt động kinh doanh"),
        ("31", "Thu nhập khác"), ("32", "Chi phí khác"),
        ("40", "Lợi nhuận khác"),
        ("50", "Tổng lợi nhuận kế toán trước thuế"),
        ("51", "Chi phí thuế thu nhập doanh nghiệp"),
        ("60", "Lợi nhuận sau thuế thu nhập doanh nghiệp"),
    )
    return [_line(key, label, now[key], before[key], 0 if key in {"10", "20", "30", "40", "50", "60"} else 1) for key, label in labels], []


def _trial_balance(current):
    by_code = defaultdict(lambda: {
        "name": "", "opening_debit": ZERO, "opening_credit": ZERO,
        "debit": ZERO, "credit": ZERO, "closing_debit": ZERO, "closing_credit": ZERO,
    })
    for (code, _party), item in current.items():
        target = by_code[code]
        target["name"] = item["name"]
        target["opening_debit"] += max(item["opening"], ZERO)
        target["opening_credit"] += max(-item["opening"], ZERO)
        target["debit"] += item["debit"]
        target["credit"] += item["credit"]
        target["closing_debit"] += max(item["closing"], ZERO)
        target["closing_credit"] += max(-item["closing"], ZERO)
    rows = []
    for code, item in sorted(by_code.items()):
        rows.append({
            "code": code, "name": item["name"],
            "opening_debit": str(item["opening_debit"]), "opening_credit": str(item["opening_credit"]),
            "period_debit": str(item["debit"]), "period_credit": str(item["credit"]),
            "closing_debit": str(item["closing_debit"]), "closing_credit": str(item["closing_credit"]),
            "status": "COMPLETE",
        })
    return rows, []


def _cash_flow(company, year, method):
    this = _compute_slot_cash_flow_data(company, date(year, 1, 1), date(year, 12, 31), cash_flow_method=method)
    prior = _compute_slot_cash_flow_data(company, date(year - 1, 1, 1), date(year - 1, 12, 31), cash_flow_method=method)
    labels = (
        ("01", "Tiền thu từ bán hàng, cung cấp dịch vụ và doanh thu khác"),
        ("02", "Tiền chi trả cho người cung cấp hàng hóa và dịch vụ"),
        ("03", "Tiền chi trả cho người lao động"),
        ("04", "Tiền lãi vay đã trả"), ("05", "Thuế thu nhập doanh nghiệp đã nộp"),
        ("06", "Tiền thu khác từ hoạt động kinh doanh"),
        ("07", "Tiền chi khác cho hoạt động kinh doanh"),
        ("20", "Lưu chuyển tiền thuần từ hoạt động kinh doanh"),
        ("21", "Tiền chi để mua sắm, xây dựng TSCĐ và các tài sản dài hạn khác"),
        ("22", "Tiền thu từ thanh lý, nhượng bán TSCĐ và các tài sản dài hạn khác"),
        ("23", "Tiền chi cho vay, mua công cụ nợ của đơn vị khác"),
        ("24", "Tiền thu hồi cho vay, bán lại công cụ nợ của đơn vị khác"),
        ("25", "Tiền chi đầu tư góp vốn vào đơn vị khác"),
        ("26", "Tiền thu hồi đầu tư góp vốn vào đơn vị khác"),
        ("27", "Tiền thu lãi cho vay, cổ tức và lợi nhuận được chia"),
        ("30", "Lưu chuyển tiền thuần từ hoạt động đầu tư"),
        ("31", "Tiền thu từ phát hành cổ phiếu, nhận vốn góp của chủ sở hữu"),
        ("32", "Tiền trả lại vốn góp cho chủ sở hữu, mua lại cổ phiếu"),
        ("33", "Tiền thu từ đi vay"), ("34", "Tiền trả nợ gốc vay"),
        ("35", "Tiền trả nợ gốc thuê tài chính"),
        ("36", "Cổ tức, lợi nhuận đã trả cho chủ sở hữu"),
        ("40", "Lưu chuyển tiền thuần từ hoạt động tài chính"),
        ("50", "Lưu chuyển tiền thuần trong kỳ"),
        ("60", "Tiền và tương đương tiền đầu kỳ"),
        ("61", "Ảnh hưởng của thay đổi tỷ giá hối đoái quy đổi ngoại tệ"),
        ("70", "Tiền và tương đương tiền cuối kỳ"),
    )
    if method == "INDIRECT":
        labels = (
            ("01", "Lợi nhuận trước thuế"), ("02", "Khấu hao TSCĐ và bất động sản đầu tư"),
            ("03", "Các khoản dự phòng"), ("04", "Lãi, lỗ chênh lệch tỷ giá hối đoái"),
            ("05", "Lãi, lỗ từ hoạt động đầu tư"), ("06", "Chi phí lãi vay"),
            ("08", "Lợi nhuận từ hoạt động kinh doanh trước thay đổi vốn lưu động"),
            ("09", "Tăng, giảm các khoản phải thu"),
            ("10", "Tăng, giảm hàng tồn kho"),
            ("11", "Tăng, giảm các khoản phải trả"),
            ("12", "Tăng, giảm chi phí trả trước"),
            ("14", "Tiền lãi vay đã trả"), ("15", "Thuế thu nhập doanh nghiệp đã nộp"),
            ("16", "Tiền thu khác từ hoạt động kinh doanh"),
            ("17", "Tiền chi khác cho hoạt động kinh doanh"),
            ("20", "Lưu chuyển tiền thuần từ hoạt động kinh doanh"),
        ) + tuple(item for item in labels if int(item[0]) >= 21)
    rows = [_line(key, label, this["values"].get(key, ZERO), prior["values"].get(key, ZERO), 0 if key in {"20", "30", "40", "50", "70"} else 1) for key, label in labels]
    warnings = []
    if this["unclassified_transactions"]:
        warnings.append(f"Có {len(this['unclassified_transactions'])} giao dịch tiền chưa phân loại; cần kiểm tra trước khi sử dụng B03.")
    if this["values"].get("70", ZERO) != this["closing_cash_actual"]:
        warnings.append("Tiền cuối kỳ trên B03 chưa khớp số dư tiền ở sổ cái.")
    return rows, warnings


NOTE_SECTIONS = {"I", "II", "III", "IV", "VII"}


def _notes(current, previous, text_by_section=None):
    text_by_section = text_by_section or {}
    rows = []
    for code, label in (
        ("I", "Đặc điểm hoạt động của doanh nghiệp"),
        ("II", "Kỳ kế toán, đơn vị tiền tệ sử dụng trong kế toán"),
        ("III", "Chuẩn mực và chế độ kế toán áp dụng"),
        ("IV", "Các chính sách kế toán áp dụng"),
    ):
        row = _line(code, label, None, None, 0, "COMPLETE" if text_by_section.get(code) else "REQUIRES_INPUT")
        row["narrative"] = text_by_section.get(code, "")
        rows.append(row)
    rows.append(_line("V.1", "Tiền và các khoản tương đương tiền", _amount(current, ("111", "112", "113")), _amount(previous, ("111", "112", "113"))))
    rows.append(_line("V.2", "Hàng tồn kho", _amount(current, ("151", "152", "153", "154", "155", "156", "157")), _amount(previous, ("151", "152", "153", "154", "155", "156", "157"))))
    rows.append(_line("V.3", "Các khoản phải thu", _amount(current, ("131", "136", "138"), side="DEBIT_POSITIVE"), _amount(previous, ("131", "136", "138"), side="DEBIT_POSITIVE")))
    rows.append(_line("V.4", "Các khoản phải trả", _amount(current, ("331", "333", "334", "338", "341"), side="CREDIT_POSITIVE"), _amount(previous, ("331", "333", "334", "338", "341"), side="CREDIT_POSITIVE")))
    now_income, before_income = _income(current), _income(previous)
    rows.append(_line("VI.1", "Doanh thu bán hàng và cung cấp dịch vụ", now_income["01"], before_income["01"]))
    rows.append(_line("VI.2", "Giá vốn hàng bán", now_income["11"], before_income["11"]))
    row = _line("VII", "Thông tin khác", None, None, 0, "COMPLETE" if text_by_section.get("VII") else "REQUIRES_INPUT")
    row["narrative"] = text_by_section.get("VII", "")
    rows.append(row)
    return rows, ([] if all(text_by_section.get(code) for code in NOTE_SECTIONS) else ["Các mục thuyết minh bằng lời cần được kế toán bổ sung và duyệt trước khi nộp báo cáo."])


def build_report(company, year, code):
    if code not in REPORTS:
        raise ValueError("Mẫu TT133 không hợp lệ.")
    current = _snapshot(company, year)
    previous = _snapshot(company, year - 1)
    if code.startswith("B01"):
        rows, warnings = _balance_sheet(code, current, previous, company, year)
    elif code == "B02-DNN":
        rows, warnings = _business_result(current, previous)
    elif code.startswith("B03"):
        rows, warnings = _cash_flow(company, year, "INDIRECT" if code.endswith("-GT") else "DIRECT")
    elif code == "B09-DNN":
        notes = dict(TT133NoteText.objects.filter(company=company, year=year).values_list("section_code", "content"))
        rows, warnings = _notes(current, previous, notes)
    else:
        rows, warnings = _trial_balance(current)
    chart = ChartOfAccounts.objects.filter(company=company, is_default=True).first()
    if chart and chart.accounting_regime != "TT133":
        warnings.insert(0, "Doanh nghiệp đang dùng chế độ kế toán khác TT133; cần kiểm tra lại trước khi sử dụng bộ mẫu này.")
    today = timezone.localdate()
    if date(year, 12, 31) > today:
        warnings.append("Năm báo cáo chưa kết thúc; số liệu hiện tại là bản tạm tính.")
    future_entries = JournalEntry.objects.filter(
        company=company, status="POSTED", posting_date__gt=today,
        posting_date__year=year,
    ).count()
    if future_entries:
        warnings.append(f"Có {future_entries} bút toán ghi sổ có ngày hạch toán sau hôm nay; cần kiểm tra trước khi sử dụng báo cáo.")
    return {
        "code": code, "title": REPORTS[code], "year": year,
        "company_id": str(company.pk), "company_name": company.name,
        "rows": rows, "warnings": warnings,
        "has_data": bool(current), "accounting_regime": chart.accounting_regime if chart else None,
    }
