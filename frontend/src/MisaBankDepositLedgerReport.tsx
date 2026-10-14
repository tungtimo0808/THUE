import ReportCustomizationMenu from "./ReportCustomizationMenu";
import { templateColumnLabels } from "./report-template-columns";
import { MISA_REPORT_DEFINITIONS } from "./misa-report-definitions";
import {CASH_PERIODS,cashPeriodDates,cashPeriodSubtitle} from "./cash-report-periods";
import {cashDateValue,isCashDateInRange} from "./cash-date";
import { useState, useMemo } from "react";
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
  MinusSquare,
  PlusSquare,
} from "lucide-react";

export interface BankDepositRow {
  postDate?: string;
  voucherDate?: string;
  voucherNo?: string;
  description: string;
  correspAcc?: string;
  receiptAmount?: number;
  paymentAmount?: number;
  balance?: number;
  isOpening?: boolean;
}

const DEFAULT_ROWS: BankDepositRow[] = [
  {
    description: "Số dư đầu kỳ",
    isOpening: true,
  },
  {
    postDate: "06/10/2026",
    voucherDate: "06/10/2026",
    voucherNo: "UNC00001",
    description: "Trả tiền cho Tran Thi Huong theo hóa đơn NM01",
    correspAcc: "331",
    paymentAmount: 10000000,
    balance: -10000000,
  },
];

export interface MisaBankDepositLedgerReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaBankDepositLedgerReport({
  onBack,
  notify,
}: MisaBankDepositLedgerReportProps) {
  // Drawer Parameters State matching Image 1
  const [paramError,setParamError]=useState("");
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [reportPeriodPreset, setReportPeriodPreset] = useState("Tháng này");
  const [fromDate, setFromDate] = useState(()=>cashPeriodDates("Tháng này")![0]);
  const [toDate, setToDate] = useState(()=>cashPeriodDates("Tháng này")![1]);
  const [selectedAccount, setSelectedAccount] = useState("1121");
  const [selectedBankAccount, setSelectedBankAccount] = useState("");

  // 4 Checkboxes matching Image 1
  const [mergeSameEntries, setMergeSameEntries] = useState(true);
  const [mergeByVoucher, setMergeByVoucher] = useState(false);
  const [sortByCreation, setSortByCreation] = useState(true);
  const [sortReceiptBeforePayment, setSortReceiptBeforePayment] = useState(false);

  // Drawer draft state
  const [draftPeriodPreset, setDraftPeriodPreset] = useState("Tháng này");
  const [draftFromDate, setDraftFromDate] = useState(()=>cashPeriodDates("Tháng này")![0]);
  const [draftToDate, setDraftToDate] = useState(()=>cashPeriodDates("Tháng này")![1]);
  const [draftAccount, setDraftAccount] = useState("1121");
  const [draftBankAccount, setDraftBankAccount] = useState("");
  const [draftMergeSame, setDraftMergeSame] = useState(true);
  const [draftMergeVoucher, setDraftMergeVoucher] = useState(false);
  const [draftSortCreation, setDraftSortCreation] = useState(true);
  const [draftSortReceiptFirst, setDraftSortReceiptFirst] = useState(false);

  // Group collapsed state
  const [isGroupCollapsed, setIsGroupCollapsed] = useState(false);

  // Search keyword inside report table
  const [searchKeyword, setSearchKeyword] = useState("");

  const handleOpenDrawer = () => {
    setDraftPeriodPreset(reportPeriodPreset);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftAccount(selectedAccount);
    setDraftBankAccount(selectedBankAccount);
    setDraftMergeSame(mergeSameEntries);
    setDraftMergeVoucher(mergeByVoucher);
    setDraftSortCreation(sortByCreation);
    setDraftSortReceiptFirst(sortReceiptBeforePayment);
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    if(!draftAccount.trim()||!Number.isFinite(cashDateValue(draftFromDate))||!Number.isFinite(cashDateValue(draftToDate))||cashDateValue(draftFromDate)>cashDateValue(draftToDate)){setParamError('Chọn tài khoản và khoảng ngày hợp lệ theo DD/MM/YYYY.');return;}
    setParamError('');
    setReportPeriodPreset(draftPeriodPreset);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setSelectedAccount(draftAccount);
    setSelectedBankAccount(draftBankAccount);
    setMergeSameEntries(draftMergeSame);
    setMergeByVoucher(draftMergeVoucher);
    setSortByCreation(draftSortCreation);
    setSortReceiptBeforePayment(draftSortReceiptFirst);
    setIsParamDrawerOpen(false);
    notify?.("Đã cập nhật Sổ tiền gửi ngân hàng.");
  };

  const handleResetParams = () => {
    setParamError("");
    setDraftPeriodPreset("Tháng này");
    setDraftFromDate(cashPeriodDates("Tháng này")![0]);
    setDraftToDate(cashPeriodDates("Tháng này")![1]);
    setDraftAccount("1121");
    setDraftBankAccount("");
    setDraftMergeSame(true);
    setDraftMergeVoucher(false);
    setDraftSortCreation(true);
    setDraftSortReceiptFirst(false);
  };

  const handlePresetChange = (preset:string)=>{setDraftPeriodPreset(preset);const range=cashPeriodDates(preset);if(range){setDraftFromDate(range[0]);setDraftToDate(range[1]);}};

  // Subtitle period text matching Image 2
  const periodSubtitle = useMemo(() => {
    return `Tài khoản: ${selectedAccount}, ${cashPeriodSubtitle(fromDate,toDate)}`;
  }, [fromDate, toDate, selectedAccount]);

  // Filter rows
  const filteredRows = useMemo(() => {
    const datedRows=DEFAULT_ROWS.filter(row=>row.isOpening||isCashDateInRange(row.postDate||"",fromDate,toDate));
    if (!searchKeyword.trim()) return datedRows;
    const kw = searchKeyword.toLowerCase();
    return datedRows.filter(
      (r) =>
        r.description.toLowerCase().includes(kw) ||
        (r.voucherNo && r.voucherNo.toLowerCase().includes(kw))
    );
  }, [searchKeyword,fromDate,toDate]);

  const totalReceipt = useMemo(() => {
    return filteredRows.reduce((acc, r) => acc + (r.receiptAmount || 0), 0);
  }, [filteredRows]);

  const totalPayment = useMemo(() => {
    return filteredRows.reduce((acc, r) => acc + (r.paymentAmount || 0), 0);
  }, [filteredRows]);

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
            Sổ tiền gửi ngân hàng
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
            onClick={() => notify?.("Xem danh sách báo cáo đã lưu...")}
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
            onClick={() => notify?.("Đã lưu mẫu báo cáo thành công.")}
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

      {/* 2. Action Toolbar matching Image 2 */}
      <div
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
            onClick={() => setIsGroupCollapsed((prev) => !prev)}
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
            title={isGroupCollapsed ? "Mở rộng nhóm" : "Thu gọn nhóm"}
          >
            {isGroupCollapsed ? <PlusSquare size={16} /> : <MinusSquare size={16} />}
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
            onClick={() => notify?.("Đã làm mới dữ liệu báo cáo.")}
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
            onClick={() => notify?.("Đang xuất khẩu báo cáo ra Excel...")}
          >
            <span style={{ fontSize: 12, fontWeight: 700 }}>XLS</span>
            <ChevronDown size={13} color="#64748b" />
          </button>

          <ReportCustomizationMenu reportName="Sổ tiền gửi ngân hàng" visibleColumns={templateColumnLabels(MISA_REPORT_DEFINITIONS.find(report => report.name === "Sổ tiền gửi ngân hàng")?.headers ?? [])} triggerIcon={<Settings size={15} />} triggerStyle={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
            }} />
        </div>
      </div>

      {/* 3. Centered Report Title matching Image 2 */}
      <div style={{ textAlign: "center", padding: "16px 20px 10px 20px" }}>
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            color: "#0f172a",
            letterSpacing: "0.2px",
          }}
        >
          SỔ TIỀN GỬI NGÂN HÀNG
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

      {/* 4. Table Area matching Image 2 & 3 */}
      <div
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
              width: "max-content",
              minWidth: "100%",
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
                    textAlign: "center",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 120,
                  }}
                >
                  Ngày hạch toán
                </th>
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "center",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 120,
                  }}
                >
                  Ngày chứng từ
                </th>
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "center",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 110,
                  }}
                >
                  Số chứng từ
                </th>
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "left",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 320,
                  }}
                >
                  Diễn giải
                </th>
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "center",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 90,
                  }}
                >
                  TK đối ứng
                </th>
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 130,
                  }}
                >
                  Thu
                </th>
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 130,
                  }}
                >
                  Chi
                </th>
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 130,
                  }}
                >
                  Tồn
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Bank Account Group Header Row matching Image 2 */}
              <tr style={{ background: "#ffffff", fontWeight: 700 }}>
                <td
                  colSpan={5}
                  style={{
                    border: "1px solid #e2e8f0",
                    padding: "7px 12px",
                    color: "#1e293b",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                    }}
                    onClick={() => setIsGroupCollapsed((prev) => !prev)}
                  >
                    <span style={{ fontSize: 10, color: "#64748b" }}>
                      {isGroupCollapsed ? "▸" : "▾"}
                    </span>
                    <span>Tài khoản ngân hàng: (2)</span>
                  </div>
                </td>
                <td
                  style={{
                    border: "1px solid #e2e8f0",
                    padding: "7px 12px",
                    textAlign: "right",
                  }}
                ></td>
                <td
                  style={{
                    border: "1px solid #e2e8f0",
                    padding: "7px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                  }}
                >
                  {formatMoney(totalPayment)}
                </td>
                <td
                  style={{
                    border: "1px solid #e2e8f0",
                    padding: "7px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#dc2626",
                  }}
                >
                  {formatMoney(-totalPayment)}
                </td>
              </tr>

              {/* Data rows if not collapsed */}
              {!isGroupCollapsed &&
                filteredRows.map((row, idx) => {
                  const isNegativeBalance =
                    row.balance !== undefined && row.balance < 0;
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
                          padding: "7px 10px",
                          textAlign: "center",
                        }}
                      >
                        {row.postDate || ""}
                      </td>
                      <td
                        style={{
                          border: "1px solid #e2e8f0",
                          padding: "7px 10px",
                          textAlign: "center",
                        }}
                      >
                        {row.voucherDate || ""}
                      </td>
                      <td
                        style={{
                          border: "1px solid #e2e8f0",
                          padding: "7px 10px",
                          textAlign: "center",
                          color: "#0284c7",
                          cursor: row.voucherNo ? "pointer" : "default",
                          fontWeight: row.voucherNo ? 500 : 400,
                        }}
                        onClick={() => {
                          if (row.voucherNo) {
                            notify?.(`Mở ủy nhiệm chi ${row.voucherNo}`);
                          }
                        }}
                      >
                        {row.voucherNo || ""}
                      </td>
                      <td
                        style={{
                          border: "1px solid #e2e8f0",
                          padding: "7px 12px",
                          fontWeight: row.isOpening ? 700 : 400,
                        }}
                      >
                        {row.description}
                      </td>
                      <td
                        style={{
                          border: "1px solid #e2e8f0",
                          padding: "7px 8px",
                          textAlign: "center",
                        }}
                      >
                        {row.correspAcc || ""}
                      </td>
                      <td
                        style={{
                          border: "1px solid #e2e8f0",
                          padding: "7px 12px",
                          textAlign: "right",
                        }}
                      >
                        {formatMoney(row.receiptAmount)}
                      </td>
                      <td
                        style={{
                          border: "1px solid #e2e8f0",
                          padding: "7px 12px",
                          textAlign: "right",
                        }}
                      >
                        {formatMoney(row.paymentAmount)}
                      </td>
                      <td
                        style={{
                          border: "1px solid #e2e8f0",
                          padding: "7px 12px",
                          textAlign: "right",
                          color: isNegativeBalance ? "#dc2626" : "#1e293b",
                        }}
                      >
                        {formatMoney(row.balance)}
                      </td>
                    </tr>
                  );
                })}

              {/* Total Row matching Image 2 */}
              <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                <td
                  style={{
                    border: "1px solid #e2e8f0",
                    padding: "7px 10px",
                    textAlign: "center",
                    fontWeight: 700,
                  }}
                >
                  Tổng cộng
                </td>
                <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px" }}></td>
                <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px" }}></td>
                <td style={{ border: "1px solid #e2e8f0", padding: "7px 12px" }}></td>
                <td style={{ border: "1px solid #e2e8f0", padding: "7px 8px" }}></td>
                <td
                  style={{
                    border: "1px solid #e2e8f0",
                    padding: "7px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                  }}
                >
                  {formatMoney(totalReceipt)}
                </td>
                <td
                  style={{
                    border: "1px solid #e2e8f0",
                    padding: "7px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                  }}
                >
                  {formatMoney(totalPayment)}
                </td>
                <td style={{ border: "1px solid #e2e8f0", padding: "7px 12px" }}></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer Bar matching Image 2 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 4px",
            fontSize: 12.5,
            color: "#475569",
          }}
        >
          <div>Tổng số: 2</div>
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
              {/* Kỳ báo cáo */}
              <div>
                <label
                  style={{
                    fontSize: 12.5,
                    color: "#475569",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Kỳ báo cáo
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

              {/* Tài khoản * & Tài khoản ngân hàng matching Image 1 */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1.8fr",
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
                    <option value="112">112 - Tiền gửi không kỳ hạn</option>
                    <option value="1121">1121 - TGNH BIDV</option>
                    <option value="1122">1122 - TGNH Vietcombank</option>
                  </select>
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
                    Tài khoản ngân hàng
                  </label>
                  <select
                    value={draftBankAccount}
                    onChange={(e) => setDraftBankAccount(e.target.value)}
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      background: "#ffffff",
                      outline: "none",
                    }}
                  >
                    <option value="">(Tất cả)</option>
                    <option value="BIDV_026">0261198991 - BIDV</option>
                    <option value="VCB_098">0987654321 - Vietcombank</option>
                  </select>
                </div>
              </div>

              {/* 4 Checkboxes matching Image 1 */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginTop: 6,
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    color: "#1e293b",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={draftMergeSame}
                    onChange={(e) => setDraftMergeSame(e.target.checked)}
                    style={{ accentColor: "#00a862", width: 16, height: 16 }}
                  />
                  <span>Cộng gộp các bút toán giống nhau</span>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    color: "#1e293b",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={draftMergeVoucher}
                    onChange={(e) => setDraftMergeVoucher(e.target.checked)}
                    style={{ accentColor: "#00a862", width: 16, height: 16 }}
                  />
                  <span>Cộng gộp theo chứng từ</span>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    color: "#1e293b",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={draftSortCreation}
                    onChange={(e) => setDraftSortCreation(e.target.checked)}
                    style={{ accentColor: "#00a862", width: 16, height: 16 }}
                  />
                  <span>Sắp xếp chứng từ theo thứ tự lập</span>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    color: "#1e293b",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={draftSortReceiptFirst}
                    onChange={(e) => setDraftSortReceiptFirst(e.target.checked)}
                    style={{ accentColor: "#00a862", width: 16, height: 16 }}
                  />
                  <span>
                    Sắp xếp chứng từ thu trước chứng từ chi trong cùng một ngày
                  </span>
                </label>
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
    </div>
  );
}
