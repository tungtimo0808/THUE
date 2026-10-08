import React, { useState } from "react";
import {
  ChevronLeft,
  Printer,
  Download,
  Settings,
  HelpCircle,
  X,
  Search,
  RefreshCw,
  Mail,
  Filter,
  Columns,
} from "lucide-react";

export type ReconcileReportType =
  | "debt_payment_match" // Đối chiếu chứng từ công nợ phải trả và chứng từ thanh toán
  | "cost_purchase_match" // Đối chiếu chi phí mua hàng trên chứng từ chi phí và chứng từ mua hàng
  | "purchase_cost_match"; // Đối chiếu chi phí mua hàng trên chứng từ mua hàng và chứng từ chi phí

export interface MisaPurchaseReconciliationReportsProps {
  onBack: () => void;
  notify?: (msg: string) => void;
  reportType: ReconcileReportType;
}

export default function MisaPurchaseReconciliationReports({
  onBack,
  notify,
  reportType,
}: MisaPurchaseReconciliationReportsProps) {
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");

  const getTitle = () => {
    switch (reportType) {
      case "debt_payment_match":
        return "Đối chiếu chứng từ công nợ phải trả và chứng từ thanh toán";
      case "cost_purchase_match":
        return "Đối chiếu chi phí mua hàng trên chứng từ chi phí và chứng từ mua hàng";
      case "purchase_cost_match":
        return "Đối chiếu chi phí mua hàng trên chứng từ mua hàng và chứng từ chi phí";
    }
  };

  const getSubtitle = () => {
    switch (reportType) {
      case "debt_payment_match":
        return "Nhà cung cấp: Tran Thi Huong, Tháng 10 năm 2026";
      case "cost_purchase_match":
      case "purchase_cost_match":
        return "Tháng 10 năm 2026";
    }
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
      {/* 1. Header Bar */}
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
            style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", padding: 4 }}
          >
            <ChevronLeft size={20} />
          </button>
          <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "#0f172a" }}>
            {getTitle()}
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            style={{ height: 32, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, color: "#334155" }}
          >
            Danh sách báo cáo đã lưu
          </button>
          <button
            type="button"
            style={{ height: 32, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, color: "#334155" }}
          >
            Lưu báo cáo
          </button>
          <button
            type="button"
            style={{ height: 32, padding: "0 18px", background: "#00a862", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, color: "#ffffff" }}
            onClick={() => setIsParamDrawerOpen(true)}
          >
            Chọn tham số
          </button>
        </div>
      </div>

      {/* 2. Action Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 20px",
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, padding: "5px 8px" }}>
            <Filter size={14} color="#64748b" />
          </button>
          <button type="button" style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, padding: "5px 8px" }}>
            <Columns size={14} color="#64748b" />
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="Nhập từ khóa tìm kiếm"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{ width: 220, height: 28, padding: "0 30px 0 10px", fontSize: 12, borderRadius: 4, border: "1px solid #cbd5e1", outline: "none" }}
            />
            <Search size={14} style={{ position: "absolute", right: 8, top: 7, color: "#94a3b8" }} />
          </div>

          <button type="button" style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }} onClick={() => notify?.("Đã nạp lại.")}>
            <RefreshCw size={15} />
          </button>
          <button type="button" style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}>
            <Mail size={15} />
          </button>
          <button type="button" style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }} onClick={() => window.print()}>
            <Printer size={15} />
          </button>
          <button type="button" style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}>
            <Download size={15} />
          </button>
          <button type="button" style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}>
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* 3. Main Report Area */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h1 style={{ margin: "0 0 6px 0", fontSize: 15.5, fontWeight: 700, textTransform: "uppercase" }}>
            {getTitle()}
          </h1>
          <div style={{ fontSize: 12.5, color: "#475569", fontStyle: "italic" }}>
            {getSubtitle()}
          </div>
        </div>

        <div style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              {reportType === "debt_payment_match" ? (
                <>
                  <tr style={{ background: "#e8f5ec", borderBottom: "1px solid #cbd5e1" }}>
                    <th colSpan={4} style={{ padding: "6px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                      Chứng từ công nợ
                    </th>
                    <th colSpan={3} style={{ padding: "6px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                      Chứng từ thanh toán
                    </th>
                    <th rowSpan={2} style={{ padding: "6px 10px", textAlign: "right", width: 120 }}>
                      Chênh lệch
                    </th>
                  </tr>
                  <tr style={{ background: "#e8f5ec", borderBottom: "1px solid #cbd5e1" }}>
                    <th style={{ padding: "6px 10px", textAlign: "left", width: 100, borderRight: "1px solid #cbd5e1" }}>Ngày CT</th>
                    <th style={{ padding: "6px 10px", textAlign: "left", width: 100, borderRight: "1px solid #cbd5e1" }}>Số CT</th>
                    <th style={{ padding: "6px 10px", textAlign: "left", width: 100, borderRight: "1px solid #cbd5e1" }}>Số hóa đơn</th>
                    <th style={{ padding: "6px 10px", textAlign: "right", width: 120, borderRight: "1px solid #cbd5e1" }}>Số tiền</th>
                    <th style={{ padding: "6px 10px", textAlign: "left", width: 100, borderRight: "1px solid #cbd5e1" }}>Ngày CT</th>
                    <th style={{ padding: "6px 10px", textAlign: "left", width: 100, borderRight: "1px solid #cbd5e1" }}>Số CT</th>
                    <th style={{ padding: "6px 10px", textAlign: "right", width: 120, borderRight: "1px solid #cbd5e1" }}>Số tiền</th>
                  </tr>
                </>
              ) : reportType === "cost_purchase_match" ? (
                <>
                  <tr style={{ background: "#e8f5ec", borderBottom: "1px solid #cbd5e1" }}>
                    <th colSpan={5} style={{ padding: "6px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                      Chứng từ chi phí mua hàng
                    </th>
                    <th colSpan={5} style={{ padding: "6px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                      Chứng từ mua hàng
                    </th>
                    <th rowSpan={2} style={{ padding: "6px 10px", textAlign: "right", width: 120 }}>
                      Chênh lệch
                    </th>
                  </tr>
                  <tr style={{ background: "#e8f5ec", borderBottom: "1px solid #cbd5e1" }}>
                    <th style={{ padding: "6px 10px", textAlign: "left", width: 95, borderRight: "1px solid #cbd5e1" }}>Ngày hạch toán</th>
                    <th style={{ padding: "6px 10px", textAlign: "left", width: 95, borderRight: "1px solid #cbd5e1" }}>Ngày chứng từ</th>
                    <th style={{ padding: "6px 10px", textAlign: "left", width: 95, borderRight: "1px solid #cbd5e1" }}>Số chứng từ</th>
                    <th style={{ padding: "6px 10px", textAlign: "center", width: 95, borderRight: "1px solid #cbd5e1" }}>TK chi phí/TK kho</th>
                    <th style={{ padding: "6px 10px", textAlign: "right", width: 105, borderRight: "1px solid #cbd5e1" }}>Số tiền</th>
                    <th style={{ padding: "6px 10px", textAlign: "left", width: 95, borderRight: "1px solid #cbd5e1" }}>Ngày hạch toán</th>
                    <th style={{ padding: "6px 10px", textAlign: "left", width: 95, borderRight: "1px solid #cbd5e1" }}>Ngày chứng từ</th>
                    <th style={{ padding: "6px 10px", textAlign: "left", width: 95, borderRight: "1px solid #cbd5e1" }}>Số chứng từ</th>
                    <th style={{ padding: "6px 10px", textAlign: "center", width: 95, borderRight: "1px solid #cbd5e1" }}>TK chi phí/TK kho</th>
                    <th style={{ padding: "6px 10px", textAlign: "right", width: 105, borderRight: "1px solid #cbd5e1" }}>Số tiền</th>
                  </tr>
                </>
              ) : (
                /* purchase_cost_match */
                <>
                  <tr style={{ background: "#e8f5ec", borderBottom: "1px solid #cbd5e1" }}>
                    <th colSpan={5} style={{ padding: "6px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                      Chứng từ mua hàng
                    </th>
                    <th colSpan={5} style={{ padding: "6px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                      Chứng từ chi phí mua hàng
                    </th>
                    <th rowSpan={2} style={{ padding: "6px 10px", textAlign: "right", width: 120 }}>
                      Chênh lệch
                    </th>
                  </tr>
                  <tr style={{ background: "#e8f5ec", borderBottom: "1px solid #cbd5e1" }}>
                    <th style={{ padding: "6px 10px", textAlign: "left", width: 95, borderRight: "1px solid #cbd5e1" }}>Ngày hạch toán</th>
                    <th style={{ padding: "6px 10px", textAlign: "left", width: 95, borderRight: "1px solid #cbd5e1" }}>Ngày chứng từ</th>
                    <th style={{ padding: "6px 10px", textAlign: "left", width: 95, borderRight: "1px solid #cbd5e1" }}>Số chứng từ</th>
                    <th style={{ padding: "6px 10px", textAlign: "center", width: 95, borderRight: "1px solid #cbd5e1" }}>TK kho/chi phí</th>
                    <th style={{ padding: "6px 10px", textAlign: "right", width: 105, borderRight: "1px solid #cbd5e1" }}>Số tiền</th>
                    <th style={{ padding: "6px 10px", textAlign: "left", width: 95, borderRight: "1px solid #cbd5e1" }}>Ngày hạch toán</th>
                    <th style={{ padding: "6px 10px", textAlign: "left", width: 95, borderRight: "1px solid #cbd5e1" }}>Ngày chứng từ</th>
                    <th style={{ padding: "6px 10px", textAlign: "left", width: 95, borderRight: "1px solid #cbd5e1" }}>Số chứng từ</th>
                    <th style={{ padding: "6px 10px", textAlign: "center", width: 95, borderRight: "1px solid #cbd5e1" }}>TK kho/chi phí</th>
                    <th style={{ padding: "6px 10px", textAlign: "right", width: 105, borderRight: "1px solid #cbd5e1" }}>Số tiền</th>
                  </tr>
                </>
              )}
            </thead>
            <tbody>
              {reportType === "debt_payment_match" ? (
                <>
                  <tr style={{ background: "#f8fafc", fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>
                    <td colSpan={3} style={{ padding: "8px 10px" }}>▾ Tài khoản: 331 (1)</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>27.000.000</td>
                    <td colSpan={2}></td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>10.000.000</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>17.000.000</td>
                  </tr>
                  <tr style={{ background: "#ffffff", fontWeight: 600, borderBottom: "1px solid #f1f5f9" }}>
                    <td colSpan={3} style={{ padding: "8px 10px 8px 24px" }}>▾ Mã nhà cung cấp: NCC00001 (3)</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>27.000.000</td>
                    <td colSpan={2}></td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>10.000.000</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>17.000.000</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 10px" }}>06/10/2026</td>
                    <td style={{ padding: "8px 10px", color: "#0075c0" }}>NK00001</td>
                    <td style={{ padding: "8px 10px" }}>NM01</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>27.000.000</td>
                    <td colSpan={4}></td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td colSpan={4}></td>
                    <td style={{ padding: "8px 10px" }}>06/10/2026</td>
                    <td style={{ padding: "8px 10px", color: "#0075c0" }}>UNC00001</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>10.000.000</td>
                    <td></td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #cbd5e1", fontWeight: 600 }}>
                    <td colSpan={3} style={{ padding: "8px 10px" }}>Cộng</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>27.000.000</td>
                    <td colSpan={2}></td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>10.000.000</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>17.000.000</td>
                  </tr>
                  <tr style={{ background: "#f8fafc", fontWeight: 700, borderTop: "1px solid #cbd5e1" }}>
                    <td colSpan={3} style={{ padding: "8px 10px" }}>Tổng cộng</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>27.000.000</td>
                    <td colSpan={2}></td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>10.000.000</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>17.000.000</td>
                  </tr>
                </>
              ) : reportType === "purchase_cost_match" ? (
                <>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 10px" }}>06/10/2026</td>
                    <td style={{ padding: "8px 10px" }}>06/10/2026</td>
                    <td style={{ padding: "8px 10px", color: "#0075c0" }}>NK00001</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>156</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>50.000</td>
                    <td colSpan={5}></td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>50.000</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #cbd5e1", fontWeight: 600 }}>
                    <td colSpan={4} style={{ padding: "8px 10px" }}>Cộng</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>50.000</td>
                    <td colSpan={5}></td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>50.000</td>
                  </tr>
                  <tr style={{ background: "#f8fafc", fontWeight: 700, borderTop: "1px solid #cbd5e1" }}>
                    <td colSpan={4} style={{ padding: "8px 10px" }}>Tổng cộng</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>50.000</td>
                    <td colSpan={5}></td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>50.000</td>
                  </tr>
                </>
              ) : (
                /* cost_purchase_match empty */
                <tr>
                  <td colSpan={11} style={{ padding: "90px 20px", textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                      <svg width="60" height="60" viewBox="0 0 96 96" fill="none">
                        <rect x="24" y="24" width="48" height="48" rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
                        <path d="M36 44H60M36 52H52" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
                        <circle cx="58" cy="58" r="14" fill="#ffffff" stroke="#00a862" strokeWidth="2.5" />
                        <path d="M68 68L78 78" stroke="#00a862" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                      <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>
                        Không có dữ liệu
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer */}
      {isParamDrawerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 1000,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div style={{ width: 840, maxWidth: "92vw", height: "100%", background: "#ffffff", padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Chọn tham số</h3>
              <button type="button" onClick={() => setIsParamDrawerOpen(false)} style={{ background: "none", border: "none" }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ marginTop: 20, color: "#64748b" }}>Kỳ: Tháng 10 năm 2026.</p>
            <button
              type="button"
              onClick={() => setIsParamDrawerOpen(false)}
              style={{ marginTop: 20, background: "#00a862", color: "#ffffff", border: "none", padding: "8px 16px", borderRadius: 4 }}
            >
              Xem báo cáo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
