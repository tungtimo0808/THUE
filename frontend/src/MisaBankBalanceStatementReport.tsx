import ReportCustomizationMenu from "./ReportCustomizationMenu";
import { templateColumnLabels } from "./report-template-columns";
import { MISA_REPORT_DEFINITIONS } from "./misa-report-definitions";
import {CASH_PERIODS,cashPeriodDates,cashPeriodSubtitle} from "./cash-report-periods";
import { useState, useMemo, useEffect } from "react";
import { parseReportDate } from "./report-date";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import { useSearchParams } from "react-router-dom";
import "./bank-balance-report.css";
import {
  ChevronLeft,
  Printer,
  Settings,
  HelpCircle,
  X,
  Search,
  RefreshCw,
  Mail,
  MessageCircle,
  ChevronDown,
  Filter,
  Columns,
  Calendar,
} from "lucide-react";

export interface BankBalanceStatementRow {
  id: string;
  bankAccountNo: string;
  bankName: string;
  currency: string;
  openingBalance: number;
  debitAmount: number;
  creditAmount: number;
  closingBalance: number;
}
type ApiRow = { id: string; bank_account_no: string; bank_name: string; currency: string;
  opening_balance: string; debit_amount: string; credit_amount: string; closing_balance: string };
type ApiReport = { rows: ApiRow[]; warnings: string[] };
type SavedPreset = { id: string; name: string; account_code: string; date_from: string; date_to: string;
  period_preset: string; search: string };

export interface MisaBankBalanceStatementReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaBankBalanceStatementReport({
  onBack,
  notify,
}: MisaBankBalanceStatementReportProps) {
  const { token, companyId: sessionCompanyId, companies } = useApiSession();
  const [searchParams] = useSearchParams();
  const requestedCompany = searchParams.get("company");
  const companyId = companies.some((company) => company.id === requestedCompany) ? requestedCompany! : sessionCompanyId;
  const [rows, setRows] = useState<BankBalanceStatementRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [accountOptions, setAccountOptions] = useState<Array<{ code: string; name: string }>>([]);
  const [presets, setPresets] = useState<SavedPreset[]>([]);
  const [showPresets, setShowPresets] = useState(false);
  const [reportError, setReportError] = useState("");
  const [loading, setLoading] = useState(false);
  // Drawer Parameters State matching Image 1
  const [paramError,setParamError]=useState("");
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [reportPeriodPreset, setReportPeriodPreset] = useState("Tháng này");
  const [fromDate, setFromDate] = useState(()=>cashPeriodDates("Tháng này")![0]);
  const [toDate, setToDate] = useState(()=>cashPeriodDates("Tháng này")![1]);
  const [selectedAccount, setSelectedAccount] = useState("112");

  // Drawer draft state
  const [draftPeriodPreset, setDraftPeriodPreset] = useState("Tháng này");
  const [draftFromDate, setDraftFromDate] = useState(()=>cashPeriodDates("Tháng này")![0]);
  const [draftToDate, setDraftToDate] = useState(()=>cashPeriodDates("Tháng này")![1]);
  const [draftAccount, setDraftAccount] = useState("112");

  // Search keyword inside report table
  const [searchKeyword, setSearchKeyword] = useState("");

  const handleOpenDrawer = () => {
    setDraftPeriodPreset(reportPeriodPreset);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftAccount(selectedAccount);
    setIsParamDrawerOpen(true);
  };

  const reportQuery = (account: string, from: string, to: string, search = "") => new URLSearchParams({
    company_id: companyId, account_code: account, date_from: parseReportDate(from), date_to: parseReportDate(to), ...(search && { search }),
  });
  const loadReport = async (account: string, from: string, to: string, apply = false) => {
    if (!token || !companyId) return false;
    setLoading(true); setReportError("");
    try {
      const result = await request<ApiReport>(`/api/v1/bank/balance-report/summary/?${reportQuery(account, from, to)}`, token);
      setRows(result.rows.map((row) => ({ id: row.id, bankAccountNo: row.bank_account_no, bankName: row.bank_name,
        currency: row.currency, openingBalance: Number(row.opening_balance), debitAmount: Number(row.debit_amount),
        creditAmount: Number(row.credit_amount), closingBalance: Number(row.closing_balance) })));
      setWarnings(result.warnings || []);
      if (apply) notify?.("Đã cập nhật Bảng kê số dư ngân hàng.");
      return true;
    } catch (caught) {
      setReportError(caught instanceof Error ? caught.message : "Không thể tải dữ liệu số dư ngân hàng. Vui lòng thử lại.");
      return false;
    } finally { setLoading(false); }
  };
  useEffect(() => {
    if (!token || !companyId) return;
    request<Array<{ code: string; name: string }>>(`/api/v1/bank/balance-report/options/?company_id=${encodeURIComponent(companyId)}`, token)
      .then(setAccountOptions).catch(() => setAccountOptions([]));
    void loadReport("112", cashPeriodDates("Tháng này")![0], cashPeriodDates("Tháng này")![1]);
  }, [token, companyId]);
  const handleApplyParams = async () => {
    if (!draftAccount.trim()) { setParamError("Vui lòng chọn tài khoản kế toán."); return; }
    if (!parseReportDate(draftFromDate) || !parseReportDate(draftToDate)) { setParamError("Vui lòng nhập ngày hợp lệ theo định dạng DD/MM/YYYY."); return; }
    if (parseReportDate(draftFromDate) > parseReportDate(draftToDate)) { setParamError("Từ ngày không được lớn hơn Đến ngày."); return; }
    if (!accountOptions.some((option) => option.code === draftAccount)) { setParamError("Tài khoản kế toán không tồn tại hoặc không hợp lệ."); return; }
    if (!await loadReport(draftAccount, draftFromDate, draftToDate, true)) { setParamError("Không thể tải dữ liệu số dư ngân hàng. Vui lòng thử lại."); return; }
    setParamError('');
    setReportPeriodPreset(draftPeriodPreset);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setSelectedAccount(draftAccount);
    setIsParamDrawerOpen(false);
  };

  const handleResetParams = () => {
    setParamError("");
    setDraftPeriodPreset("Tháng này");
    setDraftFromDate(cashPeriodDates("Tháng này")![0]);
    setDraftToDate(cashPeriodDates("Tháng này")![1]);
    setDraftAccount("112");
  };

  const handlePresetChange=(preset:string)=>{setDraftPeriodPreset(preset);const range=cashPeriodDates(preset);if(range){setDraftFromDate(range[0]);setDraftToDate(range[1]);}};

  // Subtitle period text matching Image 2
  const periodSubtitle = useMemo(() => {
    return `Tài khoản: ${selectedAccount}, ${cashPeriodSubtitle(fromDate,toDate)}`;
  }, [fromDate, toDate, selectedAccount]);

  // Filter rows
  const filteredRows = useMemo(() => {
    if (!searchKeyword.trim()) return rows;
    const kw = searchKeyword.toLowerCase();
    return rows.filter(
      (r) =>
        r.bankAccountNo.toLowerCase().includes(kw) ||
        r.bankName.toLowerCase().includes(kw)
    );
  }, [searchKeyword, rows]);

  const totalsByCurrency = useMemo(() => {
    const totals: Record<string, { opening: number; debit: number; credit: number; closing: number }> = {};
    for (const row of filteredRows) {
      const total = totals[row.currency] ||= { opening: 0, debit: 0, credit: 0, closing: 0 };
      total.opening += row.openingBalance; total.debit += row.debitAmount;
      total.credit += row.creditAmount; total.closing += row.closingBalance;
    }
    return Object.entries(totals).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredRows]);

  const exportExcel = async () => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/bank/balance-report/export/?${reportQuery(selectedAccount, fromDate, toDate, searchKeyword.trim())}`,
        { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Xuất báo cáo thất bại. Vui lòng thử lại.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = "bang-ke-so-du-ngan-hang.xlsx"; link.click(); URL.revokeObjectURL(url);
    } catch (caught) { setReportError(caught instanceof Error ? caught.message : "Xuất báo cáo thất bại. Vui lòng thử lại."); }
  };
  const savePreset = async () => {
    if (!token) return;
    try {
      await request(`/api/v1/bank/balance-report/save/?${reportQuery(selectedAccount, fromDate, toDate)}`, token, {
        method: "POST", body: JSON.stringify({ period_preset: reportPeriodPreset, search: searchKeyword }),
      });
      notify?.("Đã lưu báo cáo thành công."); setReportError("");
    } catch (caught) { setReportError(caught instanceof Error ? caught.message : "Không lưu được báo cáo."); }
  };
  const showSaved = async () => {
    if (!token) return;
    try {
      const result = await request<SavedPreset[]>(`/api/v1/bank/balance-report/presets/?company_id=${encodeURIComponent(companyId)}`, token);
      setPresets(result); setShowPresets(true); setReportError("");
    } catch (caught) { setReportError(caught instanceof Error ? caught.message : "Không tải được báo cáo đã lưu."); }
  };

  const formatMoney = (val?: number) => {
    if (val === undefined || val === null) return "";
    if (val === 0) return "0";
    if (val < 0) {
      return `(${Math.abs(val).toLocaleString("vi-VN")})`;
    }
    return val.toLocaleString("vi-VN");
  };

  return (
    <div
      className="bank-balance-report"
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
      {/* 1. Header Bar matching Image 2 */}
      <div
        className="bank-balance-report-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: "none",
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
            Bảng kê số dư ngân hàng
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            style={{
              height: 32,
              padding: "0 12px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 12.5,
              fontWeight: 500,
              color: "#334155",
              cursor: "pointer",
            }}
            onClick={() => void showSaved()}
          >
            Danh sách báo cáo đã lưu
          </button>

          <button
            type="button"
            style={{
              height: 32,
              padding: "0 12px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 12.5,
              fontWeight: 500,
              color: "#334155",
              cursor: "pointer",
            }}
            onClick={() => void savePreset()}
          >
            Lưu báo cáo
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
      </div>

      {showPresets && <div style={{ padding: "12px 20px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><strong>Báo cáo đã lưu</strong><button onClick={() => setShowPresets(false)}>Đóng</button></div>
        {!presets.length ? <p>Chưa có báo cáo đã lưu.</p> : presets.map((preset) => <button key={preset.id} style={{ display: "block", marginTop: 6 }} onClick={async () => {
          const from = preset.date_from.split("-").reverse().join("/");
          const to = preset.date_to.split("-").reverse().join("/");
          if (!await loadReport(preset.account_code, from, to)) return;
          setReportPeriodPreset(preset.period_preset || "Tùy chọn"); setFromDate(from); setToDate(to);
          setSelectedAccount(preset.account_code); setSearchKeyword(preset.search || ""); setShowPresets(false);
        }}>{preset.name}</button>)}
      </div>}

      {/* 2. Action Toolbar matching Image 2 */}
      <div
        className="bank-balance-report-toolbar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        {/* Left Toolbar Icons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            style={{
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              color: "#64748b",
              cursor: "pointer",
            }}
            title="Bộ lọc"
            onClick={() => notify?.("Mở bộ lọc...")}
          >
            <Filter size={14} />
          </button>
          <button
            type="button"
            style={{
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              color: "#64748b",
              cursor: "pointer",
            }}
            title="Tùy chỉnh cột"
            onClick={() => notify?.("Tùy chỉnh hiển thị cột...")}
          >
            <Columns size={14} />
          </button>
        </div>

        {/* Right Toolbar Icons */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
              placeholder="Nhập từ khóa tìm kiếm"
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
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
            }}
            title="Nạp lại"
            onClick={() => void loadReport(selectedAccount, fromDate, toDate, true)}
          >
            <RefreshCw size={15} />
          </button>

          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
            }}
            title="Gửi email"
            onClick={() => notify?.("Mở hộp thoại gửi email...")}
          >
            <Mail size={15} />
          </button>

          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
            }}
            title="Phản hồi"
            onClick={() => notify?.("Mở phản hồi...")}
          >
            <MessageCircle size={15} />
          </button>

          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
            }}
            title="In"
            onClick={() => window.print()}
          >
            <Printer size={15} />
          </button>

          <button
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              padding: "3px 8px",
              color: "#334155",
              cursor: "pointer",
            }}
            title="Xuất khẩu Excel"
            onClick={() => void exportExcel()}
          >
            <span style={{ fontSize: 12, fontWeight: 700 }}>XLS</span>
            <ChevronDown size={13} color="#64748b" />
          </button>

          <ReportCustomizationMenu reportName="Bảng kê số dư ngân hàng" visibleColumns={templateColumnLabels(MISA_REPORT_DEFINITIONS.find(report => report.name === "Bảng kê số dư ngân hàng")?.headers ?? [])} triggerIcon={<Settings size={15} />} triggerStyle={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
            }} />
        </div>
      </div>

      {/* 3. Centered Report Title matching Image 2 */}
      <div className="bank-balance-report-title" style={{ textAlign: "center", padding: "16px 20px 10px 20px" }}>
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            color: "#0f172a",
            letterSpacing: "0.2px",
          }}
        >
          BẢNG KÊ SỐ DƯ NGÂN HÀNG
        </h3>
        <div
          style={{
            fontSize: 12.5,
            fontStyle: "italic",
            color: "#475569",
            marginTop: 4,
          }}
        >
          {periodSubtitle}
        </div>
      </div>
      {reportError && <p role="alert" style={{ color: "#b91c1c", margin: "4px 20px" }}>{reportError}</p>}
      {loading && <p style={{ margin: "4px 20px" }}>Đang tải dữ liệu số dư ngân hàng…</p>}
      {warnings.map((warning) => <p key={warning} role="status" style={{ color: "#92400e", margin: "4px 20px" }}>⚠ {warning}</p>)}

      {/* 4. Table Area matching Image 2 & 3 */}
      <div
        className="bank-balance-report-content"
        style={{
          flex: 1,
          overflow: "auto",
          padding: "0 20px 16px 20px",
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            overflowX: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12.5,
              fontFamily: "inherit",
            }}
          >
            <thead>
              <tr style={{ background: "#e2f0d9" }}>
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "left",
                    fontWeight: 700,
                    color: "#1e293b",
                    width: "16%",
                  }}
                >
                  Tài khoản ngân hàng
                </th>
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "left",
                    fontWeight: 700,
                    color: "#1e293b",
                    width: "36%",
                  }}
                >
                  Tên ngân hàng
                </th>
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#1e293b",
                    width: "12%",
                  }}
                >
                  Số dư đầu kỳ
                </th>
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#1e293b",
                    width: "12%",
                  }}
                >
                  Phát sinh Nợ
                </th>
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#1e293b",
                    width: "12%",
                  }}
                >
                  Phát sinh Có
                </th>
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#1e293b",
                    width: "12%",
                  }}
                >
                  Số dư cuối kỳ
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => {
                const isNegativeBalance =
                  row.closingBalance !== undefined && row.closingBalance < 0;
                return (
                  <tr
                    key={idx}
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
                    <td
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: "7px 12px",
                        color: "#1e293b",
                        fontWeight: 500,
                      }}
                    >
                      {row.bankAccountNo} <small style={{ color: "#64748b" }}>({row.currency})</small>
                    </td>
                    <td
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: "7px 12px",
                        color: "#1e293b",
                      }}
                    >
                      {row.bankName}
                    </td>
                    <td
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: "7px 12px",
                        textAlign: "right",
                      }}
                    >
                      {formatMoney(row.openingBalance)}
                    </td>
                    <td
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: "7px 12px",
                        textAlign: "right",
                      }}
                    >
                      {formatMoney(row.debitAmount)}
                    </td>
                    <td
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: "7px 12px",
                        textAlign: "right",
                      }}
                    >
                      {formatMoney(row.creditAmount)}
                    </td>
                    <td
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: "7px 12px",
                        textAlign: "right",
                        color: isNegativeBalance ? "#dc2626" : "#1e293b",
                      }}
                    >
                      {formatMoney(row.closingBalance)}
                    </td>
                  </tr>
                );
              })}

              {!filteredRows.length && <tr><td colSpan={6} style={{ textAlign: "center", padding: 18 }}>Không có dữ liệu phù hợp với điều kiện đã chọn.</td></tr>}

              {/* Total Row matching Image 2 & 3 */}
              {totalsByCurrency.map(([currency, total]) => <tr key={currency} style={{ background: "#f8fafc", fontWeight: 700 }}>
                <td
                  style={{
                    border: "1px solid #e2e8f0",
                    padding: "7px 12px",
                    fontWeight: 700,
                    color: "#1e293b",
                  }}
                >
                  Tổng cộng ({currency})
                </td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "7px 12px" }}></td>
                <td style={{ border: "1px solid #e2e8f0", padding: "7px 12px", textAlign: "right" }}>{formatMoney(total.opening)}</td>
                <td
                  style={{
                    border: "1px solid #e2e8f0",
                    padding: "7px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                  }}
                >
                  {formatMoney(total.debit)}
                </td>
                <td
                  style={{
                    border: "1px solid #e2e8f0",
                    padding: "7px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                  }}
                >
                  {formatMoney(total.credit)}
                </td>
                <td
                  style={{
                    border: "1px solid #e2e8f0",
                    padding: "7px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: total.closing < 0 ? "#dc2626" : "#1e293b",
                  }}
                >
                  {formatMoney(total.closing)}
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>

        {/* Footer Bar matching Image 2 */}
        <div
          className="bank-balance-report-footer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 4px",
            fontSize: 12.5,
            color: "#475569",
          }}
        >
          <div>Tổng số: {filteredRows.length}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span>Số dòng/trang</span>
              <select
                defaultValue="20"
                style={{
                  height: 26,
                  padding: "0 6px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 3,
                  fontSize: 12,
                  outline: "none",
                  background: "#ffffff",
                }}
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                type="button"
                disabled
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#94a3b8",
                  cursor: "not-allowed",
                  fontSize: 12,
                  padding: "2px 6px",
                }}
              >
                |&lt;
              </button>
              <button
                type="button"
                disabled
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#94a3b8",
                  cursor: "not-allowed",
                  fontSize: 12,
                  padding: "2px 6px",
                }}
              >
                &lt;
              </button>
              <span
                style={{
                  padding: "2px 8px",
                  background: "#00a862",
                  color: "#ffffff",
                  borderRadius: 3,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                1
              </span>
              <button
                type="button"
                disabled
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#94a3b8",
                  cursor: "not-allowed",
                  fontSize: 12,
                  padding: "2px 6px",
                }}
              >
                &gt;
              </button>
              <button
                type="button"
                disabled
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#94a3b8",
                  cursor: "not-allowed",
                  fontSize: 12,
                  padding: "2px 6px",
                }}
              >
                &gt;|
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Parameter Drawer matching Image 1 */}
      {isParamDrawerOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            display: "flex",
            justifyContent: "flex-end",
            background: "rgba(0, 0, 0, 0.45)",
          }}
          onClick={() => setIsParamDrawerOpen(false)}
        >
          <div
            style={{
              width: 520,
              height: "100%",
              background: "#ffffff",
              boxShadow: "-4px 0 16px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
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
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <HelpCircle
                  size={18}
                  color="#64748b"
                  style={{ cursor: "pointer" }}
                />
                <button
                  type="button"
                  onClick={() => setIsParamDrawerOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    padding: 2,
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {paramError&&<p role="alert" style={{color:"#b91c1c"}}>{paramError}</p>}
              {/* Kỳ báo cáo * */}
              <div>
                <label
                  style={{
                    fontSize: 12.5,
                    color: "#475569",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Kỳ báo cáo <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select
                  value={draftPeriodPreset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  style={{
                    width: "100%",
                    height: 32,
                    padding: "0 10px",
                    border: "1px solid #00a862",
                    borderRadius: 4,
                    fontSize: 13,
                    background: "#ffffff",
                    outline: "none",
                  }}
                >
                  {CASH_PERIODS.map(period=><option key={period}>{period}</option>)}
                </select>
              </div>

              {/* Từ ngày - Đến ngày matching Image 1 */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: 12.5,
                      color: "#475569",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Từ ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={draftFromDate}
                      onChange={(e) => {setDraftFromDate(e.target.value);setDraftPeriodPreset("Tùy chọn");}}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 30px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                        background: "#ffffff",
                      }}
                    />
                    <Calendar
                      size={14}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: 9,
                        color: "#94a3b8",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      fontSize: 12.5,
                      color: "#475569",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Đến ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={draftToDate}
                      onChange={(e) => {setDraftToDate(e.target.value);setDraftPeriodPreset("Tùy chọn");}}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 30px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                        background: "#ffffff",
                      }}
                    />
                    <Calendar
                      size={14}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: 9,
                        color: "#94a3b8",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Tài khoản * matching Image 1 */}
              <div>
                <label
                  style={{
                    fontSize: 12.5,
                    color: "#475569",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Tài khoản <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select
                  value={draftAccount}
                  onChange={(e) => setDraftAccount(e.target.value)}
                  style={{
                    width: "100%",
                    height: 32,
                    padding: "0 10px",
                    border: "1px solid #00a862",
                    borderRadius: 4,
                    fontSize: 13,
                    background: "#ffffff",
                    outline: "none",
                  }}
                >
                  {accountOptions.map((option) => <option key={option.code} value={option.code}>{option.code} - {option.name}</option>)}
                </select>
              </div>
            </div>

            {/* Footer matching Image 1 */}
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
                  height: 32,
                  padding: "0 14px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 13,
                  color: "#334155",
                  cursor: "pointer",
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
                  onClick={() => void handleApplyParams()}
                  disabled={loading}
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
    </div>
  );
}
