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
from general_ledger.models import Account, ChartOfAccounts, JournalEntry, JournalLine
from .models import TT133NoteText

from .business_result_services import _classify_b02_journal_line
from .cash_flow_services import _compute_slot_cash_flow_data
from .statement_forms import Column, Row, Statement, statement_columns, statement_row


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
            if side in ("CREDIT", "CREDIT_POSITIVE"):
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


# Position within the equity section; B01a numbers it from 411, B01b from 511.
EQUITY_LINES = (
    ("1", "1. Vốn góp của chủ sở hữu", ("=411", "4111")),
    ("2", "2. Thặng dư vốn cổ phần", ("4112",)),
    ("3", "3. Vốn khác của chủ sở hữu", ("4118",)),
    ("4", "4. Cổ phiếu quỹ", ("419",)),
    ("5", "5. Chênh lệch đánh giá lại tài sản", ("412",)),
    ("6", "6. Chênh lệch tỷ giá hối đoái", ("413",)),
    ("7", "7. Các quỹ thuộc vốn chủ sở hữu", ("414", "417", "418")),
    ("8", "8. Lợi nhuận sau thuế chưa phân phối", ("421",)),
)


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
        ("payables", ("131", "331", "333", "334", "335", "336", "338", "341", "342", "352", "353", "356"), "CREDIT_POSITIVE"),
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
        rows.append(_line("NV", "NGUỒN VỐN", None, None, 0))
        rows.append(_line("300", "A - NỢ PHẢI TRẢ", *pair("payables"), 0))
        for detail_code, detail_name, prefixes in (
            ("311", "Phải trả người bán", ("331",)),
            ("312", "Người mua trả tiền trước", ("131",)),
            ("313", "Thuế và các khoản phải nộp Nhà nước", ("333",)),
            ("314", "Phải trả người lao động", ("334",)),
            ("315", "Phải trả khác", ("335", "338")),
            ("316", "Vay và nợ thuê tài chính", ("341", "342")),
            ("317", "Phải trả nội bộ về vốn kinh doanh", ("336",)),
            ("318", "Dự phòng phải trả", ("352",)),
            ("319", "Quỹ khen thưởng, phúc lợi", ("353",)),
            ("320", "Quỹ phát triển khoa học và công nghệ", ("356",)),
        ):
            rows.append(_line(detail_code, detail_name,
                              _amount(current, prefixes, side="CREDIT_POSITIVE"),
                              _amount(previous, prefixes, side="CREDIT_POSITIVE"), 2))
        rows.append(_line("400", "B - VỐN CHỦ SỞ HỮU", *pair("equity"), 0))
        for detail_code, detail_name, prefixes in EQUITY_LINES:
            rows.append(_line(str(int(detail_code) + 410), detail_name,
                              _amount(current, prefixes, side="CREDIT"),
                              _amount(previous, prefixes, side="CREDIT"), 2))
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
        short_payables = classified(("131", "331", "333", "334", "335", "336", "338", "353"), "CREDIT_POSITIVE")
        short_payables = (short_payables[0] - long_ap, short_payables[1])
        long_payables = add_pairs(classified(("341", "342", "352", "356"), "CREDIT_POSITIVE"), (long_ap, ZERO))

        def rest(group, *parts):
            """The part of a group no listed line claims, so details always add up to their heading."""
            return tuple(group[index] - sum((part[index] for part in parts), ZERO) for index in (0, 1))

        ar_status = "REQUIRES_INPUT" if ar_unresolved else "COMPLETE"
        ap_status = "REQUIRES_INPUT" if ap_unresolved else "COMPLETE"
        customers = classified(("131",), "DEBIT_POSITIVE")
        customers = (customers[0] - long_ar, customers[1])
        advances = classified(("331",), "DEBIT_POSITIVE")
        shortages = classified(("1381",), "DEBIT_POSITIVE")
        doubtful = classified(("2293",))
        vendors = classified(("331",), "CREDIT_POSITIVE")
        vendors = (vendors[0] - long_ap, vendors[1])
        prepaid = classified(("131",), "CREDIT_POSITIVE")
        taxes = classified(("333",), "CREDIT_POSITIVE")
        staff = classified(("334",), "CREDIT_POSITIVE")
        bonus = classified(("353",), "CREDIT_POSITIVE")
        short_trading = classified(("121",))
        short_provision = classified(("2291",))

        def line(line_code, label, values, level=2, status="COMPLETE"):
            return _line(line_code, label, values[0], values[1], level, status)

        none = (ZERO, ZERO)
        rows = [
            _line("TS", "TÀI SẢN", None, None, 0),
            line("100", "A - TÀI SẢN NGẮN HẠN", short_assets, 0),
            line("110", "I. Tiền và các khoản tương đương tiền", pair("cash"), 1),
            line("120", "II. Đầu tư tài chính ngắn hạn", short_investment, 1),
            line("121", "1. Chứng khoán kinh doanh", short_trading),
            line("122", "2. Dự phòng giảm giá chứng khoán kinh doanh", short_provision),
            line("123", "3. Đầu tư nắm giữ đến ngày đáo hạn ngắn hạn", rest(short_investment, short_trading, short_provision)),
            line("130", "III. Các khoản phải thu ngắn hạn", short_receivables, 1, ar_status),
            line("131", "1. Phải thu ngắn hạn của khách hàng", customers, 2, ar_status),
            line("132", "2. Trả trước cho người bán ngắn hạn", advances),
            line("133", "3. Phải thu ngắn hạn khác", rest(short_receivables, customers, advances, shortages, doubtful)),
            line("134", "4. Tài sản thiếu chờ xử lý", shortages),
            line("135", "5. Dự phòng phải thu ngắn hạn khó đòi", doubtful),
            line("140", "IV. Hàng tồn kho", pair("inventory"), 1),
            line("141", "1. Hàng tồn kho", classified(("151", "152", "153", "154", "155", "156", "157"))),
            line("142", "2. Dự phòng giảm giá hàng tồn kho", classified(("2294",))),
            line("150", "V. Tài sản ngắn hạn khác", short_other, 1),
            line("151", "1. Thuế GTGT được khấu trừ", classified(("133",))),
            line("152", "2. Tài sản ngắn hạn khác", classified(("242",))),
            line("200", "B - TÀI SẢN DÀI HẠN", long_assets, 0),
            line("210", "I. Các khoản phải thu dài hạn", (long_ar, ZERO), 1, ar_status),
            line("211", "1. Phải thu dài hạn của khách hàng", (long_ar, ZERO), 2, ar_status),
            line("212", "2. Trả trước cho người bán dài hạn", none),
            line("213", "3. Vốn kinh doanh ở đơn vị trực thuộc", none),
            line("214", "4. Phải thu dài hạn khác", none),
            line("215", "5. Dự phòng phải thu dài hạn khó đòi", none),
            line("220", "II. Tài sản cố định", pair("fixed_assets"), 1),
            line("221", "- Nguyên giá", classified(("211", "213"))),
            line("222", "- Giá trị hao mòn lũy kế", classified(("=214", "2141", "2142", "2143", "2144", "2145", "2146"))),
            line("230", "III. Bất động sản đầu tư", pair("investment_property"), 1),
            line("231", "- Nguyên giá", classified(("217",))),
            line("232", "- Giá trị hao mòn lũy kế", classified(("2147",))),
            line("240", "IV. Xây dựng cơ bản dở dang", pair("construction"), 1),
            line("250", "V. Đầu tư tài chính dài hạn", long_investment, 1),
            line("251", "1. Đầu tư góp vốn vào đơn vị khác", classified(("221", "222", "228"))),
            line("252", "2. Dự phòng tổn thất đầu tư tài chính dài hạn", classified(("2292",))),
            line("260", "VI. Tài sản dài hạn khác", long_other, 1),
            line("300", "TỔNG CỘNG TÀI SẢN (300 = 100 + 200)", add_pairs(short_assets, long_assets), 0),
            _line("NV", "NGUỒN VỐN", None, None, 0),
            line("400", "C - NỢ PHẢI TRẢ", add_pairs(short_payables, long_payables), 0),
            line("410", "I. Nợ ngắn hạn", short_payables, 1, ap_status),
            line("411", "1. Phải trả người bán ngắn hạn", vendors, 2, ap_status),
            line("412", "2. Người mua trả tiền trước ngắn hạn", prepaid),
            line("413", "3. Thuế và các khoản phải nộp Nhà nước", taxes),
            line("414", "4. Phải trả người lao động", staff),
            line("415", "5. Phải trả ngắn hạn khác", rest(short_payables, vendors, prepaid, taxes, staff, bonus)),
            line("416", "6. Vay và nợ thuê tài chính ngắn hạn", none),
            line("417", "7. Dự phòng phải trả ngắn hạn", none),
            line("418", "8. Quỹ khen thưởng, phúc lợi", bonus),
            line("420", "II. Nợ dài hạn", long_payables, 1, ap_status),
            line("421", "1. Phải trả người bán dài hạn", (long_ap, ZERO), 2, ap_status),
            line("422", "2. Người mua trả tiền trước dài hạn", none),
            line("423", "3. Phải trả nội bộ về vốn kinh doanh", none),
            line("424", "4. Phải trả dài hạn khác", none),
            line("425", "5. Vay và nợ thuê tài chính dài hạn", classified(("341", "342"), "CREDIT_POSITIVE")),
            line("426", "6. Dự phòng phải trả dài hạn", classified(("352",), "CREDIT_POSITIVE")),
            line("427", "7. Quỹ phát triển khoa học và công nghệ", classified(("356",), "CREDIT_POSITIVE")),
            line("500", "D - VỐN CHỦ SỞ HỮU", pair("equity"), 0),
        ]
        for detail_code, detail_name, prefixes in EQUITY_LINES:
            rows.append(line(str(int(detail_code) + 510), detail_name, classified(prefixes, "CREDIT")))
        liability_equity = add_pairs(short_payables, long_payables, pair("equity"))
        rows.append(_line("600", "TỔNG CỘNG NGUỒN VỐN (600 = 400 + 500)", *liability_equity, 0))
    asset_total = total(*assets)
    warnings = []
    if code == "B01b-DNN":
        warnings.extend(maturity_warnings)
        warnings.append("B01b-DNN cần rà soát kỳ hạn của các khoản ngoài TK 131/331 và số liệu kỳ so sánh trước khi nộp.")
    if asset_total[0] != liability_equity[0]:
        warnings.append("Tổng tài sản chưa bằng tổng nguồn vốn; kiểm tra tài khoản chưa phân loại hoặc số dư lưỡng tính.")
    return rows, warnings


def _interest_expense(company, year):
    """Mã 23 of B02-DNN, using the same interest recognition as B02-DN."""
    total = ZERO
    lines = JournalLine.objects.filter(
        entry__company=company, entry__status="POSTED", entry__posting_date__year=year, account__code__startswith="635",
    ).exclude(entry__entry_type="CLOSING").select_related("entry", "account")
    for line in lines:
        if _classify_b02_journal_line(line)["is_borrowing_cost"]:
            total += line.debit - line.credit
    return total


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


def _business_result(current, previous, company, year):
    def calc(snapshot, report_year):
        raw = _income(snapshot)
        raw["23"] = _interest_expense(company, report_year)
        raw["10"] = raw["01"] - raw["02"]
        raw["20"] = raw["10"] - raw["11"]
        raw["30"] = raw["20"] + raw["21"] - raw["22"] - raw["24"]
        raw["40"] = raw["31"] - raw["32"]
        raw["50"] = raw["30"] + raw["40"]
        raw["60"] = raw["50"] - raw["51"]
        return raw

    now, before = calc(current, year), calc(previous, year - 1)
    labels = (
        ("01", "Doanh thu bán hàng và cung cấp dịch vụ"),
        ("02", "Các khoản giảm trừ doanh thu"),
        ("10", "Doanh thu thuần về bán hàng và cung cấp dịch vụ"),
        ("11", "Giá vốn hàng bán"),
        ("20", "Lợi nhuận gộp về bán hàng và cung cấp dịch vụ"),
        ("21", "Doanh thu hoạt động tài chính"),
        ("22", "Chi phí tài chính"),
        ("23", "- Trong đó: Chi phí lãi vay"),
        ("24", "Chi phí quản lý kinh doanh"),
        ("30", "Lợi nhuận thuần từ hoạt động kinh doanh"),
        ("31", "Thu nhập khác"), ("32", "Chi phí khác"),
        ("40", "Lợi nhuận khác"),
        ("50", "Tổng lợi nhuận kế toán trước thuế"),
        ("51", "Chi phí thuế thu nhập doanh nghiệp"),
        ("60", "Lợi nhuận sau thuế thu nhập doanh nghiệp"),
    )
    return [_line(key, label, now[key], before[key], 0 if key in {"10", "20", "30", "40", "50", "60"} else 1) for key, label in labels], []


def _trial_balance(current, company):
    fields = ("opening_debit", "opening_credit", "debit", "credit", "closing_debit", "closing_credit")
    by_code = {
        code: {"name": name, **dict.fromkeys(fields, ZERO)}
        for code, name in Account.objects.filter(company=company).values_list("code", "name")
    }
    for (code, _party), item in current.items():
        target = by_code.setdefault(code, {"name": item["name"], **dict.fromkeys(fields, ZERO)})
        target["opening_debit"] += max(item["opening"], ZERO)
        target["opening_credit"] += max(-item["opening"], ZERO)
        target["debit"] += item["debit"]
        target["credit"] += item["credit"]
        target["closing_debit"] += max(item["closing"], ZERO)
        target["closing_credit"] += max(-item["closing"], ZERO)
    for code in sorted(by_code, key=len, reverse=True):
        parent = next((code[:size] for size in range(len(code) - 1, 2, -1) if code[:size] in by_code), None)
        if parent:
            for field in fields:
                by_code[parent][field] += by_code[code][field]
    rows = []
    for code, item in sorted(by_code.items()):
        rows.append({
            "code": code, "name": item["name"], "level": 0 if len(code) == 3 else 1,
            "opening_debit": str(item["opening_debit"]), "opening_credit": str(item["opening_credit"]),
            "period_debit": str(item["debit"]), "period_credit": str(item["credit"]),
            "closing_debit": str(item["closing_debit"]), "closing_credit": str(item["closing_credit"]),
            "status": "COMPLETE",
        })
    return rows, []


def _cash_flow(company, year, method):
    this = _compute_slot_cash_flow_data(company, date(year, 1, 1), date(year, 12, 31), cash_flow_method=method)
    prior = _compute_slot_cash_flow_data(company, date(year - 1, 1, 1), date(year - 1, 12, 31), cash_flow_method=method)
    def financing_and_rest(values):
        return (
            ("H2", "II. Lưu chuyển tiền từ hoạt động đầu tư", None, 0),
            ("21", "1. Tiền chi để mua sắm, xây dựng TSCĐ, BĐSĐT và các tài sản dài hạn khác", values("21"), 1),
            ("22", "2. Tiền thu từ thanh lý, nhượng bán TSCĐ, BĐSĐT và các tài sản dài hạn khác", values("22"), 1),
            ("23", "3. Tiền chi cho vay, đầu tư góp vốn vào đơn vị khác", values("23", "25"), 1),
            ("24", "4. Tiền thu hồi cho vay, đầu tư góp vốn vào đơn vị khác", values("24", "26"), 1),
            ("25", "5. Tiền thu lãi cho vay, cổ tức và lợi nhuận được chia", values("27"), 1),
            ("30", "Lưu chuyển tiền thuần từ hoạt động đầu tư", values("30"), 0),
            ("H3", "III. Lưu chuyển tiền từ hoạt động tài chính", None, 0),
            ("31", "1. Tiền thu từ phát hành cổ phiếu, nhận vốn góp của chủ sở hữu", values("31"), 1),
            ("32", "2. Tiền trả lại vốn góp cho các chủ sở hữu, mua lại cổ phiếu của doanh nghiệp đã phát hành", values("32"), 1),
            ("33", "3. Tiền thu từ đi vay", values("33"), 1),
            ("34", "4. Tiền trả nợ gốc vay và nợ thuê tài chính", values("34", "35"), 1),
            ("35", "5. Cổ tức, lợi nhuận đã trả cho chủ sở hữu", values("36"), 1),
            ("40", "Lưu chuyển tiền thuần từ hoạt động tài chính", values("40"), 0),
            ("50", "Lưu chuyển tiền thuần trong kỳ (50 = 20 + 30 + 40)", values("50"), 0),
            ("60", "Tiền và tương đương tiền đầu kỳ", values("60"), 1),
            ("61", "Ảnh hưởng của thay đổi tỷ giá hối đoái quy đổi ngoại tệ", values("61"), 1),
            ("70", "Tiền và tương đương tiền cuối kỳ (70 = 50 + 60 + 61)", values("70"), 0),
        )

    def direct(values):
        return (
            ("H1", "I. Lưu chuyển tiền từ hoạt động kinh doanh", None, 0),
            ("01", "1. Tiền thu từ bán hàng, cung cấp dịch vụ và doanh thu khác", values("01"), 1),
            ("02", "2. Tiền chi trả cho người cung cấp hàng hóa, dịch vụ", values("02"), 1),
            ("03", "3. Tiền chi trả cho người lao động", values("03"), 1),
            ("04", "4. Tiền lãi vay đã trả", values("04"), 1),
            ("05", "5. Thuế thu nhập doanh nghiệp đã nộp", values("05"), 1),
            ("06", "6. Tiền thu khác từ hoạt động kinh doanh", values("06"), 1),
            ("07", "7. Tiền chi khác cho hoạt động kinh doanh", values("07"), 1),
            ("20", "Lưu chuyển tiền thuần từ hoạt động kinh doanh", values("20"), 0),
        )

    def indirect(values):
        return (
            ("H1", "I. Lưu chuyển tiền từ hoạt động kinh doanh", None, 0),
            ("01", "1. Lợi nhuận trước thuế", values("01"), 0),
            ("02", "2. Điều chỉnh cho các khoản", values("02", "03", "04", "05", "06", "07"), 0),
            ("03", "- Khấu hao TSCĐ và BĐSĐT", values("02"), 1),
            ("04", "- Các khoản dự phòng", values("03"), 1),
            ("05", "- Lãi, lỗ chênh lệch tỷ giá hối đoái do đánh giá lại các khoản mục tiền tệ có gốc ngoại tệ", values("04"), 1),
            ("06", "- Lãi, lỗ từ hoạt động đầu tư", values("05"), 1),
            ("07", "- Chi phí lãi vay", values("06"), 1),
            ("08", "- Các khoản điều chỉnh khác", values("07"), 1),
            ("09", "3. Lợi nhuận từ hoạt động kinh doanh trước thay đổi vốn lưu động", values("08"), 0),
            ("10", "- Tăng, giảm các khoản phải thu", values("09"), 1),
            ("11", "- Tăng, giảm hàng tồn kho", values("10"), 1),
            ("12", "- Tăng, giảm các khoản phải trả (không kể lãi vay phải trả, thuế thu nhập doanh nghiệp phải nộp)", values("11"), 1),
            ("13", "- Tăng, giảm chi phí trả trước", values("12"), 1),
            ("14", "- Tăng, giảm chứng khoán kinh doanh", values("13"), 1),
            ("15", "- Tiền lãi vay đã trả", values("14"), 1),
            ("16", "- Thuế thu nhập doanh nghiệp đã nộp", values("15"), 1),
            ("17", "- Tiền thu khác từ hoạt động kinh doanh", values("16"), 1),
            ("18", "- Tiền chi khác cho hoạt động kinh doanh", values("17"), 1),
            ("20", "Lưu chuyển tiền thuần từ hoạt động kinh doanh", values("20"), 0),
        )

    def picker(data):
        return lambda *codes: sum((data["values"].get(code) or ZERO for code in codes), ZERO)

    operating = indirect if method == "INDIRECT" else direct
    now_lines = operating(picker(this)) + financing_and_rest(picker(this))
    before_lines = operating(picker(prior)) + financing_and_rest(picker(prior))
    rows = [
        _line(key, label, value, earlier[2], level)
        for (key, label, value, level), earlier in zip(now_lines, before_lines)
    ]
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


LEGAL_BASIS = "(Ban hành theo Thông tư số 133/2016/TT-BTC ngày 26/8/2016 của Bộ Tài chính)"
UPPERCASE_TITLES = {
    "B01a-DNN": "BÁO CÁO TÌNH HÌNH TÀI CHÍNH", "B01b-DNN": "BÁO CÁO TÌNH HÌNH TÀI CHÍNH",
    "B02-DNN": "BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH", "B03-DNN": "BÁO CÁO LƯU CHUYỂN TIỀN TỆ",
    "B03-DNN-GT": "BÁO CÁO LƯU CHUYỂN TIỀN TỆ", "B09-DNN": "BẢN THUYẾT MINH BÁO CÁO TÀI CHÍNH",
    "F01-DNN": "BẢNG CÂN ĐỐI TÀI KHOẢN",
}


def tt133_statement(company, report, signature):
    code, year, rows = report["code"], report["year"], report["rows"]
    period = f"Năm {year}"
    if code.startswith("B01"):
        period = f"Tại ngày 31 tháng 12 năm {year}"
    elif code == "B03-DNN":
        period = f"(Theo phương pháp trực tiếp) - Năm {year}"
    elif code == "B03-DNN-GT":
        period = f"(Theo phương pháp gián tiếp) - Năm {year}"
    extra = {}
    if code == "F01-DNN":
        columns = [Column("Số tài khoản", 11), Column("Tên tài khoản", 42)] + [
            Column(label, 17, True)
            for label in ("Đầu kỳ - Nợ", "Đầu kỳ - Có", "Phát sinh - Nợ", "Phát sinh - Có", "Cuối kỳ - Nợ", "Cuối kỳ - Có")
        ]
        lines = [
            Row([row["code"], row["name"], row["opening_debit"], row["opening_credit"], row["period_debit"],
                 row["period_credit"], row["closing_debit"], row["closing_credit"]], bold=row["level"] == 0)
            for row in rows
        ]
        extra["landscape"] = True
    elif code == "B09-DNN":
        columns = [Column("Nội dung", 60), Column("Mã", 8), Column("Diễn giải", 40), Column("Năm nay", 18, True), Column("Năm trước", 18, True)]
        lines = [
            Row([row["name"], row["code"], row.get("narrative") or "", row.get("current"), row.get("previous")], bold=row.get("level") == 0)
            for row in rows
        ]
    else:
        labels = ("Số cuối năm", "Số đầu năm") if code.startswith("B01") else ("Năm nay", "Năm trước")
        columns = statement_columns(*labels)
        lines = [
            statement_row(row["name"], "" if row["code"] in ("A", "TS", "NV", "H1", "H2", "H3") else row["code"], "",
                          row.get("current"), row.get("previous"), row.get("level", 1), bold=row.get("level") == 0)
            for row in rows
        ]
    return Statement(
        company_name=company.name, company_address=company.address or "", tax_code=company.tax_code or "",
        form_code=code, legal_basis=LEGAL_BASIS, title=UPPERCASE_TITLES[code], period=period, columns=columns,
        rows=lines, signature=signature, **extra,
    )


def build_report(company, year, code):
    if code not in REPORTS:
        raise ValueError("Mẫu TT133 không hợp lệ.")
    current = _snapshot(company, year)
    previous = _snapshot(company, year - 1)
    if code.startswith("B01"):
        # The opening column is this year's opening balance, which already includes OPENING entries.
        opening = {key: {**item, "closing": item["opening"]} for key, item in current.items()}
        rows, warnings = _balance_sheet(code, current, opening, company, year)
    elif code == "B02-DNN":
        rows, warnings = _business_result(current, previous, company, year)
    elif code.startswith("B03"):
        rows, warnings = _cash_flow(company, year, "INDIRECT" if code.endswith("-GT") else "DIRECT")
    elif code == "B09-DNN":
        notes = dict(TT133NoteText.objects.filter(company=company, year=year).values_list("section_code", "content"))
        rows, warnings = _notes(current, previous, notes)
    else:
        rows, warnings = _trial_balance(current, company)
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
