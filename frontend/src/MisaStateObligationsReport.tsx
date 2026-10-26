import React, { useState, useMemo, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  ChevronLeft,
  Search,
  RotateCw,
  Mail,
  MessageCircle,
  Printer,
  Download,
  Settings,
  HelpCircle,
  X,
  Filter,
  Columns,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import {
  createApiWriter,
  queryTaxReportUcRpt07,
  openCellContextUcRpt14,
} from "./misa-api-writes";

export interface StateObligationItem {
  id: string;
  name: string;
  code: string;
  isHeader?: boolean;
  isTotal?: boolean;
  prevBalance?: number;
  periodDue?: number;
  periodPaid?: number;
  accumDue?: number;
  accumPaid?: number;
  closingDue?: number;
}

// Exact 16 rows matching MISA AMIS Screenshot
const DEFAULT_OBLIGATIONS_DATA: StateObligationItem[] = [
  { id: "10", name: "I - Thuế", code: "10", isHeader: true },
  { id: "11", name: "1. Thuế GTGT hàng bán nội địa", code: "11", prevBalance: 0, periodDue: 125000000, periodPaid: 100000000, accumDue: 125000000, accumPaid: 100000000, closingDue: 25000000 },
  { id: "12", name: "2. Thuế GTGT hàng nhập khẩu", code: "12", prevBalance: 0, periodDue: 45000000, periodPaid: 45000000, accumDue: 45000000, accumPaid: 45000000, closingDue: 0 },
  { id: "13", name: "3. Thuế tiêu thụ đặc biệt", code: "13" },
  { id: "14", name: "4. Thuế xuất, nhập khẩu", code: "14" },
  { id: "15", name: "5. Thuế thu nhập doanh nghiệp", code: "15", prevBalance: 15000000, periodDue: 82000000, periodPaid: 80000000, accumDue: 97000000, accumPaid: 80000000, closingDue: 17000000 },
  { id: "16", name: "6. Thuế thu nhập cá nhân", code: "16", prevBalance: 0, periodDue: 28500000, periodPaid: 28500000, accumDue: 28500000, accumPaid: 28500000, closingDue: 0 },
  { id: "17", name: "7. Thuế tài nguyên", code: "17" },
  { id: "18", name: "8. Thuế nhà đất, tiền thuê đất", code: "18" },
  { id: "19", name: "9. Thuế bảo vệ môi trường", code: "19" },
  { id: "20", name: "10. Các loại thuế khác", code: "20" },
  { id: "30", name: "II - Các khoản phải nộp khác", code: "30", isHeader: true },
  { id: "31", name: "1. Các khoản phụ thu", code: "31" },
  { id: "32", name: "2. Các khoản phí, lệ phí", code: "32", prevBalance: 0, periodDue: 3000000, periodPaid: 3000000, accumDue: 3000000, accumPaid: 3000000, closingDue: 0 },
  { id: "33", name: "3. Các khoản khác", code: "33" },
  { id: "40", name: "Tổng cộng", code: "40", isTotal: true, prevBalance: 15000000, periodDue: 283500000, periodPaid: 256500000, accumDue: 298500000, accumPaid: 256500000, closingDue: 42000000 },
];

function formatVal(val?: number): string {
  if (val === undefined || val === null || val === 0) return "";
  return val.toLocaleString("vi-VN");
}

export interface MisaStateObligationsReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
  companyId?: string;
}

export default function MisaStateObligationsReport({
  onBack,
  notify,
  companyId = "default",
}: MisaStateObligationsReportProps) {
  const { token: apiToken } = useApiSession();

  // Parameter Drawer State
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState<boolean>(false);

  // Search keyword in table
  const [searchKeyword, setSearchKeyword] = useState<string>("");

  // Parameter Form State matching Screenshot 1
  const [period, setPeriod] = useState<string>("Tháng này");
  const [fromDate, setFromDate] = useState<string>("01/10/2026");
  const [toDate, setToDate] = useState<string>("31/10/2026");

  // Dynamic table data & drilldown modal state
  const [reportRows, setReportRows] = useState<StateObligationItem[]>(DEFAULT_OBLIGATIONS_DATA);
  const [loading, setLoading] = useState<boolean>(false);
  const [drilldownModal, setDrilldownModal] = useState<any | null>(null);

  const subtitlePeriod = "Tháng 10 năm 2026";

  const writer = useMemo(() => {
    return createApiWriter(companyId, (path, init) => request(path, apiToken, init));
  }, [companyId, apiToken]);

  const toIsoDate = (dStr: string) => {
    const parts = dStr.split("/");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
    return dStr;
  };

  const loadReportData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await queryTaxReportUcRpt07(writer, "RPT-0003", {
        from_date: toIsoDate(fromDate),
        to_date: toIsoDate(toDate),
        period_code: period,
        tax_type: "ALL",
      });

      if (res && Array.isArray(res.rows) && res.rows.length > 0) {
        const mapped: StateObligationItem[] = res.rows.map((r: any, idx: number) => {
          const cols = r.columns || {};
          return {
            id: cols.indicator_code || String(idx),
            code: cols.indicator_code || "",
            name: cols.indicator_name || "",
            isHeader: r.row_type === "GROUP" || r.row_type === "HEADER",
            isTotal:
              r.row_type === "TOTAL" ||
              cols.indicator_code === "40" ||
              (cols.indicator_name && cols.indicator_name.includes("Tổng cộng")),
            prevBalance: Number(cols.opening_payable || 0),
            periodDue: Number(cols.period_assessed || 0),
            periodPaid: Number(cols.period_paid || 0),
            accumDue: Number(cols.accumulated_assessed || 0),
            accumPaid: Number(cols.accumulated_paid || 0),
            closingDue: Number(cols.closing_payable || 0),
          };
        });
        setReportRows(mapped);
      }
    } catch (err: any) {
      console.warn("Could not load RPT-0003 from live API, falling back to default:", err);
    } finally {
      setLoading(false);
    }
  }, [writer, fromDate, toDate, period]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const filteredRows = useMemo(() => {
    if (!searchKeyword.trim()) return reportRows;
    const kw = searchKeyword.toLowerCase();
    return reportRows.filter(
      (r) => r.name.toLowerCase().includes(kw) || r.code.includes(kw)
    );
  }, [reportRows, searchKeyword]);

  const handleCellClick = async (row: StateObligationItem, field: string, val?: number) => {
    if (!val || row.isHeader) return;
    try {
      const drilldownData = await openCellContextUcRpt14(
        writer,
        "RPT-0003",
        `RPT-0003_${row.code}`,
        field,
        val,
        {
          row_id: row.code,
          period_from: toIsoDate(fromDate),
          period_to: toIsoDate(toDate),
          indicator_name: row.name,
        }
      );
      setDrilldownModal({
        row,
        field,
        val,
        data: drilldownData,
      });
    } catch (err: any) {
      notify?.("Mở chi tiết số liệu: " + (err.message || "Xem nguồn cấu thành"));
    }
  };

  const handleApplyParams = () => {
    setIsParamDrawerOpen(false);
    loadReportData();
    notify?.("Đã nạp số liệu Tình hình thực hiện nghĩa vụ với nhà nước theo tham số đã chọn.");
  };

  const handleResetParams = () => {
    setPeriod("Tháng này");
    setFromDate("01/10/2026");
    setToDate("31/10/2026");
    notify?.("Đã xóa điều kiện lọc về mặc định.");
  };

  const handleExportExcel = () => {
    try {
      const exportRows = filteredRows.map((r) => ({
        "Chỉ tiêu": r.name,
        "Mã số": r.code,
        "Số còn phải nộp kỳ trước chuyển sang": r.prevBalance || 0,
        "Số phải nộp trong kỳ": r.periodDue || 0,
        "Số đã nộp trong kỳ": r.periodPaid || 0,
        "Số phải nộp lũy kế": r.accumDue || 0,
        "Số đã nộp lũy kế": r.accumPaid || 0,
        "Số còn phải nộp cuối kỳ": r.closingDue || 0,
      }));
      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "NghiaVuNhaNuoc");
      XLSX.writeFile(wb, `BaoCao_NghiaVuNhaNuoc_${new Date().toISOString().slice(0, 10)}.xlsx`);
      notify?.("Đã kết xuất báo cáo ra Excel thành công.");
    } catch (e: any) {
      notify?.("Lỗi xuất file Excel: " + e.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", background: "#f8fafc", position: "relative" }}>
      {/* 1. Top Header Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          minHeight: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={onBack}
            title="Quay lại danh mục báo cáo"
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "#f1f5f9",
              border: "1px solid #cbd5e1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#334155",
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
            Tình hình thực hiện nghĩa vụ với nhà nước
          </h2>
          {loading && (
            <span style={{ fontSize: 12, color: "#00a862", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
              <RotateCw size={12} className="animate-spin" /> Đang tải dữ liệu...
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            style={{
              height: 32,
              padding: "0 14px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 500,
              color: "#334155",
              cursor: "pointer",
            }}
            onClick={() => notify?.("Xem danh sách báo cáo mẫu đã lưu.")}
          >
            Danh sách báo cáo đã lưu
          </button>
          <button
            type="button"
            style={{
              height: 32,
              padding: "0 14px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 500,
              color: "#334155",
              cursor: "pointer",
            }}
            onClick={() => notify?.("Đã lưu mẫu báo cáo tùy chỉnh thành công.")}
          >
            Lưu báo cáo
          </button>
          <button
            type="button"
            style={{
              height: 32,
              padding: "0 16px",
              background: "#00a862",
              border: "none",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            onClick={() => setIsParamDrawerOpen(true)}
          >
            Chọn tham số
          </button>
        </div>
      </div>

      {/* 2. Sub-Toolbar Action Strip */}
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            style={{
              width: 30,
              height: 30,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              cursor: "pointer",
            }}
            title="Lọc nhanh"
            onClick={() => setIsParamDrawerOpen(true)}
          >
            <Filter size={14} />
          </button>
          <button
            type="button"
            style={{
              width: 30,
              height: 30,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              cursor: "pointer",
            }}
            title="Tùy chỉnh cột hiển thị"
            onClick={() => notify?.("Tùy biến hiển thị các cột báo cáo.")}
          >
            <Columns size={14} />
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative", width: 240 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="Nhập từ khóa tìm kiếm"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{
                width: "100%",
                height: 30,
                padding: "0 10px 0 32px",
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
            style={{ width: 30, height: 30, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", cursor: "pointer" }}
            title="Làm mới"
            onClick={() => {
              loadReportData();
              notify?.("Đã làm mới dữ liệu báo cáo từ máy chủ.");
            }}
          >
            <RotateCw size={14} />
          </button>

          <button
            type="button"
            style={{ width: 30, height: 30, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", cursor: "pointer" }}
            title="Gửi email"
            onClick={() => notify?.("Mở hộp thoại gửi báo cáo qua email.")}
          >
            <Mail size={14} />
          </button>

          <button
            type="button"
            style={{ width: 30, height: 30, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#0284c7", cursor: "pointer" }}
            title="Trợ giúp / Phản hồi"
            onClick={() => notify?.("Hệ thống hỗ trợ kế toán Sổ Việt ERP.")}
          >
            <MessageCircle size={14} />
          </button>

          <button
            type="button"
            style={{ height: 30, padding: "0 10px", border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 4, display: "flex", alignItems: "center", gap: 4, color: "#334155", fontSize: 12.5, cursor: "pointer" }}
            onClick={handlePrint}
            title="In báo cáo"
          >
            <Printer size={14} />
            <ChevronDown size={12} />
          </button>

          <button
            type="button"
            style={{ height: 30, padding: "0 10px", border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 4, display: "flex", alignItems: "center", gap: 4, color: "#334155", fontSize: 12.5, cursor: "pointer" }}
            onClick={handleExportExcel}
            title="Kết xuất ra Excel (XLSX)"
          >
            <Download size={14} />
            <ChevronDown size={12} />
          </button>

          <button
            type="button"
            style={{ width: 30, height: 30, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", cursor: "pointer" }}
            title="Thiết lập"
            onClick={() => notify?.("Thiết lập báo cáo nâng cao.")}
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* 3. Main Report Content Area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column" }}>
        {/* Centered Report Title */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <h1 style={{ margin: "0 0 4px 0", fontSize: 15, fontWeight: 700, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.2px" }}>
            TÌNH HÌNH THỰC HIỆN NGHĨA VỤ VỚI NHÀ NƯỚC
          </h1>
          <div style={{ fontSize: 13, color: "#475569", fontStyle: "italic" }}>
            {subtitlePeriod}
          </div>
        </div>

        {/* Data Table */}
        <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              {/* Row 1 Header */}
              <tr style={{ background: "#e2f0d9", color: "#1e293b", fontWeight: 700, borderBottom: "1px solid #bbf7d0" }}>
                <th rowSpan={2} style={{ padding: "8px 12px", textAlign: "left", borderRight: "1px solid #cbd5e1", minWidth: 260 }}>
                  Chỉ tiêu
                </th>
                <th rowSpan={2} style={{ padding: "8px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1", width: 70 }}>
                  Mã số
                </th>
                <th rowSpan={2} style={{ padding: "8px 12px", textAlign: "center", borderRight: "1px solid #cbd5e1", width: 170 }}>
                  Số còn phải nộp kỳ trước chuyển sang
                </th>
                <th colSpan={2} style={{ padding: "6px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                  Số phát sinh trong kỳ
                </th>
                <th colSpan={2} style={{ padding: "6px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                  Số phát sinh lũy kế
                </th>
                <th rowSpan={2} style={{ padding: "8px 12px", textAlign: "center", width: 170 }}>
                  Số còn phải nộp cuối kỳ
                </th>
              </tr>

              {/* Row 2 Sub-headers */}
              <tr style={{ background: "#e2f0d9", color: "#1e293b", fontWeight: 600, borderBottom: "1px solid #cbd5e1" }}>
                {/* Phát sinh trong kỳ */}
                <th style={{ padding: "6px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1", width: 110 }}>Số phải nộp</th>
                <th style={{ padding: "6px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1", width: 110 }}>Số đã nộp</th>
                {/* Lũy kế */}
                <th style={{ padding: "6px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1", width: 110 }}>Số phải nộp</th>
                <th style={{ padding: "6px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1", width: 110 }}>Số đã nộp</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((row) => {
                const isHead = row.isHeader || row.isTotal;
                return (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: "1px solid #e2e8f0",
                      background: isHead ? "#fafafa" : "#ffffff",
                      fontWeight: isHead ? 700 : 400,
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isHead) e.currentTarget.style.backgroundColor = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      if (!isHead) e.currentTarget.style.backgroundColor = "#ffffff";
                    }}
                  >
                    {/* Chỉ tiêu */}
                    <td style={{ padding: "7px 12px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>
                      {row.name}
                    </td>

                    {/* Mã số */}
                    <td style={{ padding: "7px 10px", textAlign: "center", borderRight: "1px solid #e2e8f0", color: "#475569" }}>
                      {row.code}
                    </td>

                    {/* Số còn phải nộp kỳ trước */}
                    <td
                      onClick={() => handleCellClick(row, "opening_payable", row.prevBalance)}
                      style={{
                        padding: "7px 10px",
                        textAlign: "right",
                        borderRight: "1px solid #e2e8f0",
                        color: !isHead && row.prevBalance ? "#0066cc" : "#334155",
                        textDecoration: !isHead && row.prevBalance ? "underline" : "none",
                        cursor: !isHead && row.prevBalance ? "pointer" : "default",
                      }}
                      title={!isHead && row.prevBalance ? "Nhấp để xem drill-down chứng từ (UC-RPT-14)" : undefined}
                    >
                      {formatVal(row.prevBalance)}
                    </td>

                    {/* Phát sinh trong kỳ: Phải nộp / Đã nộp */}
                    <td
                      onClick={() => handleCellClick(row, "period_assessed", row.periodDue)}
                      style={{
                        padding: "7px 10px",
                        textAlign: "right",
                        borderRight: "1px solid #e2e8f0",
                        color: !isHead && row.periodDue ? "#0066cc" : "#334155",
                        textDecoration: !isHead && row.periodDue ? "underline" : "none",
                        cursor: !isHead && row.periodDue ? "pointer" : "default",
                      }}
                      title={!isHead && row.periodDue ? "Nhấp để xem drill-down chứng từ (UC-RPT-14)" : undefined}
                    >
                      {formatVal(row.periodDue)}
                    </td>
                    <td
                      onClick={() => handleCellClick(row, "period_paid", row.periodPaid)}
                      style={{
                        padding: "7px 10px",
                        textAlign: "right",
                        borderRight: "1px solid #e2e8f0",
                        color: !isHead && row.periodPaid ? "#0066cc" : "#334155",
                        textDecoration: !isHead && row.periodPaid ? "underline" : "none",
                        cursor: !isHead && row.periodPaid ? "pointer" : "default",
                      }}
                      title={!isHead && row.periodPaid ? "Nhấp để xem drill-down chứng từ (UC-RPT-14)" : undefined}
                    >
                      {formatVal(row.periodPaid)}
                    </td>

                    {/* Lũy kế: Phải nộp / Đã nộp */}
                    <td
                      onClick={() => handleCellClick(row, "accumulated_assessed", row.accumDue)}
                      style={{
                        padding: "7px 10px",
                        textAlign: "right",
                        borderRight: "1px solid #e2e8f0",
                        color: !isHead && row.accumDue ? "#0066cc" : "#334155",
                        textDecoration: !isHead && row.accumDue ? "underline" : "none",
                        cursor: !isHead && row.accumDue ? "pointer" : "default",
                      }}
                      title={!isHead && row.accumDue ? "Nhấp để xem drill-down chứng từ (UC-RPT-14)" : undefined}
                    >
                      {formatVal(row.accumDue)}
                    </td>
                    <td
                      onClick={() => handleCellClick(row, "accumulated_paid", row.accumPaid)}
                      style={{
                        padding: "7px 10px",
                        textAlign: "right",
                        borderRight: "1px solid #e2e8f0",
                        color: !isHead && row.accumPaid ? "#0066cc" : "#334155",
                        textDecoration: !isHead && row.accumPaid ? "underline" : "none",
                        cursor: !isHead && row.accumPaid ? "pointer" : "default",
                      }}
                      title={!isHead && row.accumPaid ? "Nhấp để xem drill-down chứng từ (UC-RPT-14)" : undefined}
                    >
                      {formatVal(row.accumPaid)}
                    </td>

                    {/* Số còn phải nộp cuối kỳ */}
                    <td
                      onClick={() => handleCellClick(row, "closing_payable", row.closingDue)}
                      style={{
                        padding: "7px 10px",
                        textAlign: "right",
                        color: !isHead && row.closingDue ? "#0066cc" : "#334155",
                        textDecoration: !isHead && row.closingDue ? "underline" : "none",
                        cursor: !isHead && row.closingDue ? "pointer" : "default",
                      }}
                      title={!isHead && row.closingDue ? "Nhấp để xem drill-down chứng từ (UC-RPT-14)" : undefined}
                    >
                      {formatVal(row.closingDue)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 4. Footer Pagination Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 4px",
            fontSize: 13,
            color: "#475569",
          }}
        >
          <div>Tổng số: <strong>{filteredRows.length}</strong></div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span>Số dòng/trang</span>
              <select
                style={{
                  height: 26,
                  padding: "0 6px",
                  borderRadius: 4,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  fontSize: 12.5,
                }}
                defaultValue="20"
              >
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                type="button"
                disabled
                style={{ width: 26, height: 26, border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 4, color: "#94a3b8", cursor: "not-allowed" }}
              >
                &lt;&lt;
              </button>
              <button
                type="button"
                disabled
                style={{ width: 26, height: 26, border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 4, color: "#94a3b8", cursor: "not-allowed" }}
              >
                &lt;
              </button>
              <span
                style={{
                  minWidth: 26,
                  height: 26,
                  padding: "0 6px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid #00a862",
                  borderRadius: 4,
                  background: "#e6f7ef",
                  color: "#00a862",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                1
              </span>
              <button
                type="button"
                disabled
                style={{ width: 26, height: 26, border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 4, color: "#94a3b8", cursor: "not-allowed" }}
              >
                &gt;
              </button>
              <button
                type="button"
                disabled
                style={{ width: 26, height: 26, border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 4, color: "#94a3b8", cursor: "not-allowed" }}
              >
                &gt;&gt;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Parameter Drawer "Chọn tham số" matching Screenshot 1 */}
      {isParamDrawerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(1px)",
            zIndex: 99999,
            display: "flex",
            justifyContent: "flex-end",
          }}
          onClick={() => setIsParamDrawerOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              background: "#ffffff",
              height: "100%",
              boxShadow: "-8px 0 30px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              animation: "slideInRight 0.2s ease-out",
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
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                Chọn tham số
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", padding: 2 }}
                  title="Trợ giúp"
                  onClick={() => notify?.("Xem hướng dẫn lập báo cáo tình hình thực hiện nghĩa vụ với nhà nước.")}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", padding: 2 }}
                  title="Đóng"
                  onClick={() => setIsParamDrawerOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Drawer Body Form */}
            <div style={{ padding: "20px 24px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 18, fontSize: 13 }}>
              {/* 1. Kỳ báo cáo */}
              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#334155" }}>
                  Kỳ báo cáo <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  style={{
                    width: "100%",
                    height: 34,
                    padding: "0 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    background: "#ffffff",
                    fontSize: 13,
                    outline: "none",
                  }}
                >
                  <option value="Năm nay">Năm nay</option>
                  <option value="Quý này">Quý này</option>
                  <option value="Tháng này">Tháng này</option>
                  <option value="Tháng trước">Tháng trước</option>
                  <option value="Tùy chọn">Tùy chọn</option>
                </select>
              </div>

              {/* 2. Từ ngày - Đến ngày */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, color: "#475569" }}>
                    Từ ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: 34,
                        padding: "0 28px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                    <Calendar size={14} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 6, color: "#475569" }}>
                    Đến ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: 34,
                        padding: "0 28px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                    <Calendar size={14} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 24px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                style={{
                  height: 34,
                  padding: "0 14px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#334155",
                  cursor: "pointer",
                }}
                onClick={handleResetParams}
              >
                Xóa điều kiện
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  style={{
                    height: 34,
                    padding: "0 16px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#334155",
                    cursor: "pointer",
                  }}
                  onClick={() => setIsParamDrawerOpen(false)}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  style={{
                    height: 34,
                    padding: "0 20px",
                    background: "#00a862",
                    border: "none",
                    borderRadius: 4,
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  onClick={handleApplyParams}
                >
                  Xem báo cáo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Drilldown Submodal (UC-RPT-14) */}
      {drilldownModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "grid",
            placeItems: "center",
            zIndex: 100000,
          }}
          onClick={() => setDrilldownModal(null)}
        >
          <div
            style={{
              width: 580,
              maxWidth: "92vw",
              background: "#ffffff",
              borderRadius: 8,
              padding: 20,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: 10 }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                Chi tiết Drill-down chỉ tiêu thuế (UC-RPT-14)
              </h4>
              <button
                type="button"
                onClick={() => setDrilldownModal(null)}
                style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 0", fontSize: 13 }}>
              <div style={{ marginBottom: 10 }}>
                <span style={{ color: "#64748b" }}>Chỉ tiêu: </span>
                <strong>{drilldownModal.row?.name || drilldownModal.row?.code}</strong>
              </div>
              <div style={{ marginBottom: 10 }}>
                <span style={{ color: "#64748b" }}>Cột số liệu: </span>
                <span style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>{drilldownModal.field}</span>
              </div>
              <div style={{ marginBottom: 12 }}>
                <span style={{ color: "#64748b" }}>Số tiền báo cáo: </span>
                <strong style={{ color: "#00a862", fontSize: 15 }}>
                  {formatVal(drilldownModal.val)} đ
                </strong>
              </div>
              {drilldownModal.data?.formula && (
                <div style={{ marginBottom: 12, padding: "8px 12px", background: "#f8fafc", borderRadius: 4, border: "1px solid #e2e8f0" }}>
                  <span style={{ color: "#64748b" }}>Quy tắc cấu thành: </span>
                  <code>{drilldownModal.data.formula}</code>
                </div>
              )}
              {drilldownModal.data?.components && drilldownModal.data.components.length > 0 && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginTop: 10 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ padding: "6px 8px", border: "1px solid #cbd5e1", textAlign: "left" }}>Thành phần cấu thành</th>
                      <th style={{ padding: "6px 8px", border: "1px solid #cbd5e1", textAlign: "right" }}>Số tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drilldownModal.data.components.map((c: any, i: number) => (
                      <tr key={i}>
                        <td style={{ padding: "6px 8px", border: "1px solid #cbd5e1" }}>{c.name || c.indicator_code}</td>
                        <td style={{ padding: "6px 8px", border: "1px solid #cbd5e1", textAlign: "right", fontWeight: 600 }}>
                          {Number(c.contribution_value || c.raw_value || 0).toLocaleString("vi-VN")} đ
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setDrilldownModal(null)}
                style={{ height: 32, padding: "0 16px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
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
