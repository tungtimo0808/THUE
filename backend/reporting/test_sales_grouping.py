from django.test import SimpleTestCase

from .sales_report_services import _total_sales_rows

COLUMNS = [
    {"code": "branch_name", "data_type": "STRING"},
    {"code": "net_sales_amount", "data_type": "NUMBER"},
    {"code": "gross_profit_amount", "data_type": "NUMBER"},
    {"code": "gross_margin_percent", "data_type": "NUMBER"},
]


def row(branch, net, profit):
    return {"columns": {"branch_name": branch, "net_sales_amount": net, "gross_profit_amount": profit,
                        "gross_margin_percent": 99}, "source_refs": [{"line": branch}]}


class SalesGroupingTests(SimpleTestCase):
    def test_lines_are_totalled_by_the_report_columns_and_margin_is_recomputed(self):
        rows = _total_sales_rows([row("A", 100, 20), row("B", 50, 5), row("A", 100, 30)], COLUMNS)
        self.assertEqual([item["columns"]["branch_name"] for item in rows], ["A", "B"])
        self.assertEqual(rows[0]["columns"]["net_sales_amount"], 200)
        self.assertEqual(rows[0]["columns"]["gross_margin_percent"], 25)
        self.assertEqual(rows[1]["row_order"], 2)
        self.assertEqual(len(rows[0]["source_refs"]), 2)
