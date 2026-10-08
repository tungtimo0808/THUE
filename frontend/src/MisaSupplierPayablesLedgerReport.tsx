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
  ChevronDown,
  Filter,
  Columns,
  Calendar,
  UserCheck,
} from "lucide-react";

export interface MisaSupplierPayablesLedgerReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaSupplierPayablesLedgerReport({
  onBack,
  notify,
}: MisaSupplierPayablesLedgerReportProps) {
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");

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
      {/* 1. Top Header */}
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
            Chi tiết công nợ phải trả nhà cung cấp
          </h2>

          <button
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: 4,
              padding: "3px 8px",
              fontSize: 12,
              color: "#1d4ed8",
              cursor: "pointer",
              marginLeft: 8,
            }}
            onClick={() => notify?.("Mở chức năng Đối chiếu công nợ với NCC...")}
          >
            <UserCheck size={14} />
            <span>Đối chiếu công nợ với NCC</span>
          </button>
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
              color: "#334155",
              cursor: "pointer",
            }}
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
              color: "#334155",
              cursor: "pointer",
            }}
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
            }}
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
          <button
            type="button"
            style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, padding: "5px 8px" }}
          >
            <Filter size={14} color="#64748b" />
          </button>
          <button
            type="button"
            style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, padding: "5px 8px" }}
          >
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
              style={{
                width: 220,
                height: 28,
                padding: "0 30px 0 10px",
                fontSize: 12,
                borderRadius: 4,
                border: "1px solid #cbd5e1",
                outline: "none",
              }}
            />
            <Search size={14} style={{ position: "absolute", right: 8, top: 7, color: "#94a3b8" }} />
          </div>

          <button
            type="button"
            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}
            onClick={() => notify?.("Đã nạp lại.")}
          >
            <RefreshCw size={15} />
          </button>
          <button
            type="button"
            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}
          >
            <Mail size={15} />
          </button>
          <button
            type="button"
            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}
            onClick={() => window.print()}
          >
            <Printer size={15} />
          </button>
          <button
            type="button"
            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}
          >
            <Download size={15} />
          </button>
          <button
            type="button"
            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}
          >
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
          <h1
            style={{
              margin: "0 0 6px 0",
              fontSize: 15.5,
              fontWeight: 700,
              color: "#0f172a",
              textTransform: "uppercase",
            }}
          >
            CHI TIẾT CÔNG NỢ PHẢI TRẢ NHÀ CUNG CẤP
          </h1>
          <div style={{ fontSize: 12.5, color: "#475569", fontStyle: "italic" }}>
            Tài khoản: 331, Nhà cung cấp: Tran Thi Huong, Tháng 10 năm 2026
          </div>
        </div>

        <div
          style={{
            width: "100%",
            border: "1px solid #cbd5e1",
            borderRadius: 4,
            overflow: "hidden",
            background: "#ffffff",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12.5,
              color: "#1e293b",
            }}
          >
            <thead>
              <tr style={{ background: "#e8f5ec", borderBottom: "1px solid #cbd5e1" }}>
                <th rowSpan={2} style={{ padding: "8px 10px", textAlign: "left", width: 100, borderRight: "1px solid #cbd5e1" }}>
                  Ngày hạch toán
                </th>
                <th rowSpan={2} style={{ padding: "8px 10px", textAlign: "left", width: 100, borderRight: "1px solid #cbd5e1" }}>
                  Ngày chứng từ
                </th>
                <th rowSpan={2} style={{ padding: "8px 10px", textAlign: "left", width: 95, borderRight: "1px solid #cbd5e1" }}>
                  Số chứng từ
                </th>
                <th rowSpan={2} style={{ padding: "8px 10px", textAlign: "left", minWidth: 200, borderRight: "1px solid #cbd5e1" }}>
                  Diễn giải
                </th>
                <th rowSpan={2} style={{ padding: "8px 10px", textAlign: "center", width: 85, borderRight: "1px solid #cbd5e1" }}>
                  TK công nợ
                </th>
                <th rowSpan={2} style={{ padding: "8px 10px", textAlign: "center", width: 85, borderRight: "1px solid #cbd5e1" }}>
                  TK đối ứng
                </th>
                <th colSpan={2} style={{ padding: "6px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1" }}>
                  Phát sinh
                </th>
                <th colSpan={2} style={{ padding: "6px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1" }}>
                  Số dư
                </th>
                <th rowSpan={2} style={{ padding: "8px 10px", textAlign: "left", width: 100 }}>
                  Mã công trình
                </th>
              </tr>
              <tr style={{ background: "#e8f5ec", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ padding: "6px 10px", textAlign: "right", width: 95, borderRight: "1px solid #cbd5e1" }}>Nợ</th>
                <th style={{ padding: "6px 10px", textAlign: "right", width: 95, borderRight: "1px solid #cbd5e1" }}>Có</th>
                <th style={{ padding: "6px 10px", textAlign: "right", width: 95, borderRight: "1px solid #cbd5e1" }}>Nợ</th>
                <th style={{ padding: "6px 10px", textAlign: "right", width: 95, borderRight: "1px solid #cbd5e1" }}>Có</th>
              </tr>
            </thead>
            <tbody>
              {/* Group Header */}
              <tr style={{ background: "#f8fafc", fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>
                <td colSpan={6} style={{ padding: "8px 10px", borderRight: "1px solid #e2e8f0" }}>
                  ▾ Tên nhà cung cấp: Tran Thi Huong (4)
                </td>
                <td style={{ padding: "8px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>10.000.000</td>
                <td style={{ padding: "8px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>27.000.000</td>
                <td style={{ borderRight: "1px solid #e2e8f0" }}></td>
                <td style={{ borderRight: "1px solid #e2e8f0" }}></td>
                <td></td>
              </tr>

              {/* Row 1 */}
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 10px", borderRight: "1px solid #f1f5f9" }}>06/10/2026</td>
                <td style={{ padding: "8px 10px", borderRight: "1px solid #f1f5f9" }}>06/10/2026</td>
                <td style={{ padding: "8px 10px", color: "#0075c0", cursor: "pointer", borderRight: "1px solid #f1f5f9" }}>NK00001</td>
                <td style={{ padding: "8px 10px", borderRight: "1px solid #f1f5f9" }}>Màn hình 21 LG inch</td>
                <td style={{ padding: "8px 10px", textAlign: "center", borderRight: "1px solid #f1f5f9" }}>331</td>
                <td style={{ padding: "8px 10px", textAlign: "center", borderRight: "1px solid #f1f5f9" }}>156</td>
                <td style={{ padding: "8px 10px", textAlign: "right", borderRight: "1px solid #f1f5f9" }}></td>
                <td style={{ padding: "8px 10px", textAlign: "right", borderRight: "1px solid #f1f5f9" }}>25.000.000</td>
                <td style={{ borderRight: "1px solid #f1f5f9" }}></td>
                <td style={{ padding: "8px 10px", textAlign: "right", borderRight: "1px solid #f1f5f9" }}>25.000.000</td>
                <td></td>
              </tr>

              {/* Row 2 */}
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 10px", borderRight: "1px solid #f1f5f9" }}>06/10/2026</td>
                <td style={{ padding: "8px 10px", borderRight: "1px solid #f1f5f9" }}>06/10/2026</td>
                <td style={{ padding: "8px 10px", color: "#0075c0", cursor: "pointer", borderRight: "1px solid #f1f5f9" }}>NK00001</td>
                <td style={{ padding: "8px 10px", borderRight: "1px solid #f1f5f9" }}>Thuế GTGT - Màn hình 21 LG inch</td>
                <td style={{ padding: "8px 10px", textAlign: "center", borderRight: "1px solid #f1f5f9" }}>331</td>
                <td style={{ padding: "8px 10px", textAlign: "center", borderRight: "1px solid #f1f5f9" }}>1331</td>
                <td style={{ borderRight: "1px solid #f1f5f9" }}></td>
                <td style={{ padding: "8px 10px", textAlign: "right", borderRight: "1px solid #f1f5f9" }}>2.000.000</td>
                <td style={{ borderRight: "1px solid #f1f5f9" }}></td>
                <td style={{ padding: "8px 10px", textAlign: "right", borderRight: "1px solid #f1f5f9" }}>27.000.000</td>
                <td></td>
              </tr>

              {/* Row 3 */}
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 10px", borderRight: "1px solid #f1f5f9" }}>06/10/2026</td>
                <td style={{ padding: "8px 10px", borderRight: "1px solid #f1f5f9" }}>06/10/2026</td>
                <td style={{ padding: "8px 10px", color: "#0075c0", cursor: "pointer", borderRight: "1px solid #f1f5f9" }}>UNC00001</td>
                <td style={{ padding: "8px 10px", borderRight: "1px solid #f1f5f9" }}>Trả tiền cho Tran Thi Huong theo hóa đơn NM01</td>
                <td style={{ padding: "8px 10px", textAlign: "center", borderRight: "1px solid #f1f5f9" }}>331</td>
                <td style={{ padding: "8px 10px", textAlign: "center", borderRight: "1px solid #f1f5f9" }}>1121</td>
                <td style={{ padding: "8px 10px", textAlign: "right", borderRight: "1px solid #f1f5f9" }}>10.000.000</td>
                <td style={{ borderRight: "1px solid #f1f5f9" }}></td>
                <td style={{ borderRight: "1px solid #f1f5f9" }}></td>
                <td style={{ padding: "8px 10px", textAlign: "right", borderRight: "1px solid #f1f5f9" }}>17.000.000</td>
                <td></td>
              </tr>

              {/* Row 4: Cộng */}
              <tr style={{ borderBottom: "1px solid #e2e8f0", fontWeight: 600 }}>
                <td colSpan={4} style={{ padding: "8px 10px", borderRight: "1px solid #e2e8f0" }}>Cộng</td>
                <td style={{ padding: "8px 10px", textAlign: "center", borderRight: "1px solid #e2e8f0" }}>331</td>
                <td style={{ borderRight: "1px solid #e2e8f0" }}></td>
                <td style={{ padding: "8px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>10.000.000</td>
                <td style={{ padding: "8px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>27.000.000</td>
                <td style={{ borderRight: "1px solid #e2e8f0" }}></td>
                <td style={{ padding: "8px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>17.000.000</td>
                <td></td>
              </tr>

              {/* Tổng cộng */}
              <tr
                style={{
                  background: "#f8fafc",
                  borderTop: "1px solid #cbd5e1",
                  borderBottom: "1px solid #cbd5e1",
                  fontWeight: 700,
                }}
              >
                <td colSpan={6} style={{ padding: "8px 10px", borderRight: "1px solid #cbd5e1" }}>
                  Tổng cộng
                </td>
                <td style={{ padding: "8px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                  10.000.000
                </td>
                <td style={{ padding: "8px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                  27.000.000
                </td>
                <td colSpan={3}></td>
              </tr>
            </tbody>
          </table>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 16px",
              background: "#ffffff",
              borderTop: "1px solid #e2e8f0",
              fontSize: 12,
              color: "#64748b",
            }}
          >
            <span>Tổng số: 4</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span>Số dòng/trang: 20</span>
              <span>&lt; 1 &gt;</span>
            </div>
          </div>
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
          <div
            style={{
              width: 840,
              maxWidth: "92vw",
              height: "100%",
              background: "#ffffff",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Chọn tham số</h3>
              <button
                type="button"
                onClick={() => setIsParamDrawerOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ flex: 1, padding: 20 }}>
              <p style={{ fontSize: 13, color: "#64748b" }}>
                Kỳ báo cáo: Tháng 10 năm 2026. Tài khoản: 331. Nhà cung cấp: Tran Thi Huong.
              </p>
            </div>
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={() => setIsParamDrawerOpen(false)}
                style={{ height: 32, padding: "0 16px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff" }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => setIsParamDrawerOpen(false)}
                style={{ height: 32, padding: "0 18px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontWeight: 600 }}
              >
                Xem báo cáo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
