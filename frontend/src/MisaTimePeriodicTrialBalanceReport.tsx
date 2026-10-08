import React, { useState, useMemo } from "react";
import {
  ChevronLeft,
  Printer,
  Download,
  HelpCircle,
  X,
  Search,
  RefreshCw,
  Mail,
  MessageCircle,
  ChevronDown,
} from "lucide-react";

export interface PeriodicAccountRow {
  code: string;
  name: string;
  openDebit?: number;
  openCredit?: number;
  // Monthly debit/credit for month 1..10
  monthlyDebit?: Record<number, number>;
  monthlyCredit?: Record<number, number>;
  totalDebit?: number;
  totalCredit?: number;
  closeDebit?: number;
  closeCredit?: number;
}

const DEFAULT_ROWS: PeriodicAccountRow[] = [
  {
    code: "111",
    name: "Tiền mặt",
    monthlyCredit: { 10: 10000000 },
    totalCredit: 10000000,
    closeDebit: -10000000,
  },
  {
    code: "112",
    name: "Tiền gửi không kỳ hạn",
    monthlyCredit: { 10: 10000000 },
    totalCredit: 10000000,
    closeDebit: -10000000,
  },
  {
    code: "131",
    name: "Phải thu của khách hàng",
    monthlyDebit: { 10: 20000000 },
    totalDebit: 20000000,
    closeDebit: 20000000,
  },
  {
    code: "133",
    name: "Thuế GTGT được khấu trừ",
    monthlyDebit: { 10: 2000000 },
    totalDebit: 2000000,
    closeDebit: 2000000,
  },
  {
    code: "141",
    name: "Tạm ứng",
    monthlyDebit: { 10: 10000000 },
    totalDebit: 10000000,
    closeDebit: 10000000,
  },
  {
    code: "156",
    name: "Hàng hóa",
    monthlyDebit: { 10: 25000000 },
    monthlyCredit: { 10: 12525000 },
    totalDebit: 25000000,
    totalCredit: 12525000,
    closeDebit: 12475000,
  },
  {
    code: "331",
    name: "Phải trả cho người bán",
    monthlyDebit: { 10: 10000000 },
    monthlyCredit: { 10: 27000000 },
    totalDebit: 10000000,
    totalCredit: 27000000,
    closeCredit: 17000000,
  },
  {
    code: "511",
    name: "Doanh thu bán hàng và cung cấp dịch vụ",
    monthlyCredit: { 10: 20000000 },
    totalCredit: 20000000,
    closeCredit: 20000000,
  },
  {
    code: "632",
    name: "Giá vốn hàng bán",
    monthlyDebit: { 10: 12525000 },
    totalDebit: 12525000,
    closeDebit: 12525000,
  },
];

export interface MisaTimePeriodicTrialBalanceReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaTimePeriodicTrialBalanceReport({
  onBack,
  notify,
}: MisaTimePeriodicTrialBalanceReportProps) {
  // Drawer Parameters State matching Screenshot 1
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [periodType, setPeriodType] = useState<"month" | "quarter">("month");
  const [fromMonth, setFromMonth] = useState(1);
  const [fromYear, setFromYear] = useState(2026);
  const [toMonth, setToMonth] = useState(10);
  const [toYear, setToYear] = useState(2026);
  const [accountLevel, setAccountLevel] = useState("1");
  const [showTwoSideBalance, setShowTwoSideBalance] = useState(true);

  // Temporary drawer draft state
  const [draftPeriodType, setDraftPeriodType] = useState<"month" | "quarter">("month");
  const [draftFromMonth, setDraftFromMonth] = useState(1);
  const [draftFromYear, setDraftFromYear] = useState(2026);
  const [draftToMonth, setDraftToMonth] = useState(10);
  const [draftToYear, setDraftToYear] = useState(2026);
  const [draftAccountLevel, setDraftAccountLevel] = useState("1");
  const [draftShowTwoSideBalance, setDraftShowTwoSideBalance] = useState(true);

  // Search keyword inside report
  const [searchKeyword, setSearchKeyword] = useState("");

  // Drilldown modal item
  const [drilldownItem, setDrilldownItem] = useState<{
    code: string;
    name: string;
  } | null>(null);

  const handleOpenDrawer = () => {
    setDraftPeriodType(periodType);
    setDraftFromMonth(fromMonth);
    setDraftFromYear(fromYear);
    setDraftToMonth(toMonth);
    setDraftToYear(toYear);
    setDraftAccountLevel(accountLevel);
    setDraftShowTwoSideBalance(showTwoSideBalance);
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setPeriodType(draftPeriodType);
    setFromMonth(draftFromMonth);
    setFromYear(draftFromYear);
    setToMonth(draftToMonth);
    setToYear(draftToYear);
    setAccountLevel(draftAccountLevel);
    setShowTwoSideBalance(draftShowTwoSideBalance);
    setIsParamDrawerOpen(false);
    notify?.("Đã tải lại Bảng cân đối tài khoản phân tích theo thời gian với tham số mới.");
  };

  const handleResetParams = () => {
    setDraftPeriodType("month");
    setDraftFromMonth(1);
    setDraftFromYear(2026);
    setDraftToMonth(10);
    setDraftToYear(2026);
    setDraftAccountLevel("1");
    setDraftShowTwoSideBalance(true);
  };

  // Format currency helper
  const formatCell = (val?: number) => {
    if (val === undefined || val === null) return { text: "", isNegative: false };
    if (val === 0) return { text: "0", isNegative: false };
    if (val < 0) {
      return {
        text: `(${Math.abs(val).toLocaleString("vi-VN")})`,
        isNegative: true,
      };
    }
    return {
      text: val.toLocaleString("vi-VN"),
      isNegative: false,
    };
  };

  // Range of months for the table columns
  const monthsRange = useMemo(() => {
    const list: number[] = [];
    for (let m = fromMonth; m <= toMonth; m++) {
      list.push(m);
    }
    return list;
  }, [fromMonth, toMonth]);

  // Filter rows
  const filteredRows = useMemo(() => {
    return DEFAULT_ROWS.filter((row) => {
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        return (
          row.code.toLowerCase().includes(kw) ||
          row.name.toLowerCase().includes(kw)
        );
      }
      return true;
    });
  }, [searchKeyword]);

  // Totals row calculation
  const totals = useMemo(() => {
    const res: {
      openDebit: number;
      openCredit: number;
      monthlyDebit: Record<number, number>;
      monthlyCredit: Record<number, number>;
      totalDebit: number;
      totalCredit: number;
      closeDebit: number;
      closeCredit: number;
    } = {
      openDebit: 0,
      openCredit: 0,
      monthlyDebit: {},
      monthlyCredit: {},
      totalDebit: 0,
      totalCredit: 0,
      closeDebit: 0,
      closeCredit: 0,
    };

    monthsRange.forEach((m) => {
      res.monthlyDebit[m] = 0;
      res.monthlyCredit[m] = 0;
    });

    filteredRows.forEach((r) => {
      res.openDebit += r.openDebit || 0;
      res.openCredit += r.openCredit || 0;

      monthsRange.forEach((m) => {
        res.monthlyDebit[m] += r.monthlyDebit?.[m] || 0;
        res.monthlyCredit[m] += r.monthlyCredit?.[m] || 0;
      });

      res.totalDebit += r.totalDebit || 0;
      res.totalCredit += r.totalCredit || 0;
      res.closeDebit += r.closeDebit && r.closeDebit > 0 ? r.closeDebit : 0;
      res.closeCredit += r.closeCredit || 0;
    });

    return res;
  }, [filteredRows, monthsRange]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: "#ffffff",
        overflow: "hidden",
        fontFamily: "inherit",
      }}
    >
      {/* 1. Top Header Bar matching Screenshot 2/3/4 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          minHeight: 46,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: "transparent",
              border: "none",
              color: "#334155",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 4,
              borderRadius: 4,
            }}
            title="Quay lại danh mục báo cáo"
          >
            <ChevronLeft size={20} />
          </button>
          <h2
            style={{
              margin: 0,
              fontSize: 14.5,
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            Bảng cân đối tài khoản phân tích theo thời gian
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
            }}
            title="Tải xuống"
            onClick={() => notify?.("Đang tải xuống dữ liệu báo cáo...")}
          >
            <Download size={17} />
          </button>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
            }}
            title="Đóng"
          >
            <X size={19} />
          </button>
        </div>
      </div>

      {/* 2. Action Toolbar matching Screenshot 2 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          padding: "8px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          gap: 10,
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
          }}
        >
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              color: "#94a3b8",
            }}
          />
          <input
            type="text"
            placeholder="Tìm kiếm"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            style={{
              height: 30,
              width: 200,
              padding: "0 10px 0 30px",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 12.5,
              outline: "none",
              background: "#ffffff",
            }}
          />
        </div>

        <button
          type="button"
          style={{
            width: 30,
            height: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
          }}
          title="Nạp lại"
          onClick={() => notify?.("Đã làm mới dữ liệu báo cáo.")}
        >
          <RefreshCw size={15} />
        </button>

        <button
          type="button"
          style={{
            width: 30,
            height: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
          }}
          title="Gửi email"
          onClick={() => notify?.("Mở hộp thoại gửi email")}
        >
          <Mail size={15} />
        </button>

        <button
          type="button"
          style={{
            width: 30,
            height: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            color: "#0284c7",
            cursor: "pointer",
          }}
          title="Bình luận / Trao đổi"
          onClick={() => notify?.("Mở bảng trao đổi nội bộ")}
        >
          <MessageCircle size={15} />
        </button>

        <button
          type="button"
          style={{
            width: 30,
            height: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
          }}
          title="In báo cáo"
          onClick={() => notify?.("Đang tải dữ liệu in báo cáo...")}
        >
          <Printer size={15} />
        </button>

        <button
          type="button"
          style={{
            height: 30,
            padding: "0 6px",
            display: "flex",
            alignItems: "center",
            gap: 2,
            background: "transparent",
            border: "none",
            color: "#16a34a",
            cursor: "pointer",
          }}
          title="Xuất khẩu Excel"
          onClick={() => notify?.("Đang xuất khẩu báo cáo ra Excel...")}
        >
          <span style={{ fontSize: 13, fontWeight: 700 }}>XLS</span>
          <ChevronDown size={13} color="#64748b" />
        </button>

        <button
          type="button"
          style={{
            height: 32,
            padding: "0 18px",
            background: "#00a862",
            border: "none",
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 600,
            color: "#ffffff",
            cursor: "pointer",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
          onClick={handleOpenDrawer}
        >
          Chọn tham số
        </button>
      </div>

      {/* 3. Report Subtitle matching Screenshot 2 */}
      <div style={{ textAlign: "center", padding: "14px 20px 10px 20px" }}>
        <h3
          style={{
            margin: 0,
            fontSize: 13.5,
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          Từ tháng {fromMonth}/{fromYear} đến tháng {toMonth}/{toYear}
        </h3>
      </div>

      {/* 4. Table Container with Horizontal Scroll matching Screenshots 2, 3, 4 */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "0 20px 16px 20px",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            overflowX: "auto",
          }}
        >
          <table
            style={{
              width: "max-content",
              minWidth: "100%",
              borderCollapse: "collapse",
              fontSize: 12.5,
              fontFamily: "inherit",
            }}
          >
            <thead>
              {/* Row 1 Header */}
              <tr style={{ background: "#e2f0d9" }}>
                <th
                  rowSpan={2}
                  style={{
                    position: "sticky",
                    left: 0,
                    zIndex: 2,
                    background: "#e2f0d9",
                    border: "1px solid #cbd5e1",
                    padding: "8px 10px",
                    textAlign: "center",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 105,
                  }}
                >
                  Số hiệu tài khoản
                </th>
                <th
                  rowSpan={2}
                  style={{
                    position: "sticky",
                    left: 105,
                    zIndex: 2,
                    background: "#e2f0d9",
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "left",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 200,
                  }}
                >
                  Tên tài khoản
                </th>
                {/* Đầu kỳ */}
                <th
                  colSpan={2}
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "6px 10px",
                    textAlign: "center",
                    fontWeight: 700,
                    color: "#1e293b",
                  }}
                >
                  Đầu kỳ
                </th>
                {/* Month columns */}
                {monthsRange.map((m) => (
                  <th
                    key={m}
                    colSpan={2}
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: "6px 10px",
                      textAlign: "center",
                      fontWeight: 700,
                      color: "#1e293b",
                      minWidth: 160,
                    }}
                  >
                    Phát sinh tháng {m}/{toYear}
                  </th>
                ))}
                {/* Tổng tiền */}
                <th
                  colSpan={2}
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "6px 10px",
                    textAlign: "center",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 170,
                  }}
                >
                  Tổng tiền
                </th>
                {/* Cuối kỳ */}
                <th
                  colSpan={2}
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "6px 10px",
                    textAlign: "center",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 170,
                  }}
                >
                  Cuối kỳ
                </th>
              </tr>

              {/* Row 2 Header: Nợ / Có subheaders */}
              <tr style={{ background: "#e2f0d9" }}>
                {/* Đầu kỳ */}
                <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 80 }}>Nợ</th>
                <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 80 }}>Có</th>
                {/* Month subheaders */}
                {monthsRange.map((m) => (
                  <React.Fragment key={m}>
                    <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 80 }}>Nợ</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 80 }}>Có</th>
                  </React.Fragment>
                ))}
                {/* Tổng tiền */}
                <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 85 }}>Nợ</th>
                <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 85 }}>Có</th>
                {/* Cuối kỳ */}
                <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 85 }}>Nợ</th>
                <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 85 }}>Có</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const totalDebitFmt = formatCell(row.totalDebit);
                const totalCreditFmt = formatCell(row.totalCredit);
                const closeDebitFmt = formatCell(row.closeDebit);
                const closeCreditFmt = formatCell(row.closeCredit);

                return (
                  <tr
                    key={row.code}
                    style={{
                      background: "#ffffff",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#ffffff";
                    }}
                  >
                    {/* Số hiệu tài khoản (Sticky) */}
                    <td
                      style={{
                        position: "sticky",
                        left: 0,
                        zIndex: 1,
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        padding: "7px 10px",
                        textAlign: "center",
                        color: "#0284c7",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                      onClick={() => setDrilldownItem({ code: row.code, name: row.name })}
                    >
                      {row.code}
                    </td>

                    {/* Tên tài khoản (Sticky) */}
                    <td
                      style={{
                        position: "sticky",
                        left: 105,
                        zIndex: 1,
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        padding: "7px 12px",
                        color: "#0f172a",
                      }}
                    >
                      {row.name}
                    </td>

                    {/* Đầu kỳ Nợ / Có */}
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 8px", textAlign: "right" }}></td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 8px", textAlign: "right" }}></td>

                    {/* Months 1..10 */}
                    {monthsRange.map((m) => {
                      const debitVal = row.monthlyDebit?.[m];
                      const creditVal = row.monthlyCredit?.[m];
                      const dFmt = formatCell(debitVal);
                      const cFmt = formatCell(creditVal);

                      return (
                        <React.Fragment key={m}>
                          <td
                            style={{
                              border: "1px solid #e2e8f0",
                              padding: "7px 8px",
                              textAlign: "right",
                              color: dFmt.isNegative ? "#dc2626" : "#334155",
                            }}
                          >
                            {dFmt.text}
                          </td>
                          <td
                            style={{
                              border: "1px solid #e2e8f0",
                              padding: "7px 8px",
                              textAlign: "right",
                              color: cFmt.isNegative ? "#dc2626" : "#334155",
                            }}
                          >
                            {cFmt.text}
                          </td>
                        </React.Fragment>
                      );
                    })}

                    {/* Tổng tiền Nợ / Có */}
                    <td
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: "7px 8px",
                        textAlign: "right",
                        color: totalDebitFmt.isNegative ? "#dc2626" : "#334155",
                      }}
                    >
                      {totalDebitFmt.text}
                    </td>
                    <td
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: "7px 8px",
                        textAlign: "right",
                        color: totalCreditFmt.isNegative ? "#dc2626" : "#334155",
                      }}
                    >
                      {totalCreditFmt.text}
                    </td>

                    {/* Cuối kỳ Nợ / Có */}
                    <td
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: "7px 8px",
                        textAlign: "right",
                        color: closeDebitFmt.isNegative ? "#dc2626" : "#334155",
                      }}
                    >
                      {closeDebitFmt.text}
                    </td>
                    <td
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: "7px 8px",
                        textAlign: "right",
                        color: closeCreditFmt.isNegative ? "#dc2626" : "#334155",
                      }}
                    >
                      {closeCreditFmt.text}
                    </td>
                  </tr>
                );
              })}

              {/* Dòng Tổng cộng matching Screenshot 2/3/4 */}
              <tr
                style={{
                  background: "#ffffff",
                  fontWeight: 700,
                  borderTop: "2px solid #cbd5e1",
                }}
              >
                <td
                  colSpan={2}
                  style={{
                    position: "sticky",
                    left: 0,
                    zIndex: 1,
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    color: "#0f172a",
                  }}
                >
                  Tổng cộng
                </td>

                {/* Đầu kỳ */}
                <td style={{ border: "1px solid #cbd5e1", padding: "8px 8px", textAlign: "right" }}></td>
                <td style={{ border: "1px solid #cbd5e1", padding: "8px 8px", textAlign: "right" }}></td>

                {/* Monthly totals */}
                {monthsRange.map((m) => {
                  const dTot = totals.monthlyDebit[m];
                  const cTot = totals.monthlyCredit[m];
                  const dFmt = formatCell(dTot);
                  const cFmt = formatCell(cTot);

                  return (
                    <React.Fragment key={m}>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px 8px", textAlign: "right" }}>
                        {dFmt.text}
                      </td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px 8px", textAlign: "right" }}>
                        {cFmt.text}
                      </td>
                    </React.Fragment>
                  );
                })}

                {/* Tổng tiền matching Screenshot 4: 79.525.000 / 79.525.000 */}
                <td style={{ border: "1px solid #cbd5e1", padding: "8px 8px", textAlign: "right" }}>
                  {formatCell(totals.totalDebit).text}
                </td>
                <td style={{ border: "1px solid #cbd5e1", padding: "8px 8px", textAlign: "right" }}>
                  {formatCell(totals.totalCredit).text}
                </td>

                {/* Cuối kỳ matching Screenshot 4: 37.000.000 / 37.000.000 */}
                <td style={{ border: "1px solid #cbd5e1", padding: "8px 8px", textAlign: "right" }}>
                  {formatCell(totals.closeDebit).text}
                </td>
                <td style={{ border: "1px solid #cbd5e1", padding: "8px 8px", textAlign: "right" }}>
                  {formatCell(totals.closeCredit).text}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer Summary matching Screenshot 2/3/4 */}
        <div style={{ marginTop: 10, fontSize: 13, color: "#475569" }}>
          Tổng số: <strong>{filteredRows.length}</strong>
        </div>
      </div>

      {/* 5. Parameter Drawer matching Screenshot 1 */}
      {isParamDrawerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            display: "flex",
            justifyContent: "flex-end",
            background: "rgba(15, 23, 42, 0.35)",
            backdropFilter: "blur(1px)",
          }}
          onClick={() => setIsParamDrawerOpen(false)}
        >
          <div
            style={{
              width: 500,
              maxWidth: "100%",
              height: "100%",
              background: "#ffffff",
              boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                Chọn tham số
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    padding: 2,
                  }}
                  title="Trợ giúp"
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    padding: 2,
                  }}
                  onClick={() => setIsParamDrawerOpen(false)}
                  title="Đóng"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Drawer Body matching Screenshot 1 */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: 18,
                fontSize: 13,
              }}
            >
              {/* Kỳ báo cáo Radio Buttons: Tháng / Quý */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontWeight: 600,
                    marginBottom: 10,
                    color: "#0f172a",
                  }}
                >
                  Kỳ báo cáo
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="radio"
                      name="periodType"
                      checked={draftPeriodType === "month"}
                      onChange={() => setDraftPeriodType("month")}
                      style={{ accentColor: "#00a862", width: 16, height: 16 }}
                    />
                    <span>Tháng</span>
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="radio"
                      name="periodType"
                      checked={draftPeriodType === "quarter"}
                      onChange={() => setDraftPeriodType("quarter")}
                      style={{ accentColor: "#00a862", width: 16, height: 16 }}
                    />
                    <span>Quý</span>
                  </label>
                </div>
              </div>

              {/* Từ tháng / Năm */}
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      color: "#334155",
                      marginBottom: 6,
                    }}
                  >
                    Từ tháng
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={draftFromMonth}
                      onChange={(e) => setDraftFromMonth(Number(e.target.value))}
                      style={{
                        width: "100%",
                        height: 34,
                        padding: "0 30px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        background: "#ffffff",
                        fontSize: 13,
                        outline: "none",
                        appearance: "none",
                      }}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>
                          Tháng {m}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: 9,
                        color: "#64748b",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>

                <div style={{ width: 100 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      color: "#334155",
                      marginBottom: 6,
                    }}
                  >
                    Năm
                  </label>
                  <input
                    type="number"
                    value={draftFromYear}
                    onChange={(e) => setDraftFromYear(Number(e.target.value))}
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Đến tháng / Năm */}
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      color: "#334155",
                      marginBottom: 6,
                    }}
                  >
                    Đến tháng
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={draftToMonth}
                      onChange={(e) => setDraftToMonth(Number(e.target.value))}
                      style={{
                        width: "100%",
                        height: 34,
                        padding: "0 30px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        background: "#ffffff",
                        fontSize: 13,
                        outline: "none",
                        appearance: "none",
                      }}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>
                          Tháng {m}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: 9,
                        color: "#64748b",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>

                <div style={{ width: 100 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      color: "#334155",
                      marginBottom: 6,
                    }}
                  >
                    Năm
                  </label>
                  <input
                    type="number"
                    value={draftToYear}
                    onChange={(e) => setDraftToYear(Number(e.target.value))}
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Bậc tài khoản */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12.5,
                    color: "#334155",
                    marginBottom: 6,
                  }}
                >
                  Bậc tài khoản
                </label>
                <div style={{ position: "relative" }}>
                  <select
                    value={draftAccountLevel}
                    onChange={(e) => setDraftAccountLevel(e.target.value)}
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 30px 0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      background: "#ffffff",
                      fontSize: 13,
                      outline: "none",
                      appearance: "none",
                    }}
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="Tất cả">Tất cả</option>
                  </select>
                  <ChevronDown
                    size={16}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: 9,
                      color: "#64748b",
                      pointerEvents: "none",
                    }}
                  />
                </div>
              </div>

              {/* Hiển thị số dư hai bên matching Screenshot 1 */}
              <div>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#0f172a",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={draftShowTwoSideBalance}
                    onChange={(e) => setDraftShowTwoSideBalance(e.target.checked)}
                    style={{
                      accentColor: "#00a862",
                      width: 16,
                      height: 16,
                      cursor: "pointer",
                    }}
                  />
                  <span>Hiển thị số dư hai bên</span>
                </label>
              </div>
            </div>

            {/* Drawer Footer matching Screenshot 1 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                onClick={handleResetParams}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 13,
                  color: "#0f172a",
                  fontWeight: 500,
                  cursor: "pointer",
                  padding: "6px 8px",
                }}
              >
                Xóa điều kiện
              </button>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsParamDrawerOpen(false)}
                  style={{
                    height: 32,
                    padding: "0 18px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13,
                    color: "#334155",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleApplyParams}
                  style={{
                    height: 32,
                    padding: "0 20px",
                    background: "#00a862",
                    border: "none",
                    borderRadius: 4,
                    fontSize: 13,
                    color: "#ffffff",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Xem báo cáo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Drilldown Modal */}
      {drilldownItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(2px)",
            padding: 20,
          }}
          onClick={() => setDrilldownItem(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 900,
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 45px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              maxHeight: "85vh",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                borderBottom: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  Sổ chi tiết phát sinh theo thời gian - TK {drilldownItem.code} ({drilldownItem.name})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDrilldownItem(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12.5,
                  border: "1px solid #cbd5e1",
                }}
              >
                <thead>
                  <tr style={{ background: "#e2f0d9", color: "#1e293b", fontWeight: 700 }}>
                    <th style={{ border: "1px solid #cbd5e1", padding: "8px 10px" }}>Kỳ tháng</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "8px 10px" }}>Ngày HT</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "8px 10px" }}>Số chứng từ</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "8px 10px", textAlign: "left" }}>Diễn giải</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "8px 10px" }}>TK Nợ</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "8px 10px" }}>TK Có</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "8px 10px", textAlign: "right" }}>Số tiền</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #e2e8f0", padding: "8px 10px", textAlign: "center" }}>10/2026</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "8px 10px", textAlign: "center" }}>05/10/2026</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "8px 10px", textAlign: "center", color: "#0284c7", fontWeight: 600 }}>
                      BH00012
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "8px 10px" }}>
                      Hạch toán nghiệp vụ tài khoản {drilldownItem.code}
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "8px 10px", textAlign: "center" }}>
                      {drilldownItem.code === "131" ? "131" : drilldownItem.code === "632" ? "632" : "111"}
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "8px 10px", textAlign: "center" }}>
                      {drilldownItem.code === "511" ? "511" : drilldownItem.code === "156" ? "156" : "331"}
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>
                      {drilldownItem.code === "131" || drilldownItem.code === "511" ? "20.000.000" : "10.000.000"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                padding: "10px 16px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() => notify?.("Đã xuất khẩu chứng từ ra Excel.")}
                style={{
                  height: 30,
                  padding: "0 14px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                Xuất Excel
              </button>
              <button
                type="button"
                onClick={() => setDrilldownItem(null)}
                style={{
                  height: 30,
                  padding: "0 18px",
                  background: "#00a862",
                  border: "none",
                  borderRadius: 4,
                  fontSize: 12.5,
                  color: "#ffffff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
