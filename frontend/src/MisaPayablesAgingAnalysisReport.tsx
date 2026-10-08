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
  PenTool,
  MessageSquare,
  UserCheck,
} from "lucide-react";

export interface MisaPayablesAgingAnalysisReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
  mode?: "summary" | "detail"; // "summary" = Phân tích (A4 Sheet), "detail" = Chi tiết (Table)
}

export default function MisaPayablesAgingAnalysisReport({
  onBack,
  notify,
  mode = "summary",
}: MisaPayablesAgingAnalysisReportProps) {
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const isSummary = mode === "summary";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: isSummary ? "#e2e8f0" : "#ffffff",
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
          borderBottom: "1px solid #cbd5e1",
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
            {isSummary
              ? "Phân tích công nợ phải trả theo tuổi nợ"
              : "Chi tiết công nợ phải trả theo tuổi nợ"}
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
          padding: "6px 20px",
          background: isSummary ? "#ffffff" : "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isSummary ? (
            <button
              type="button"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12.5,
                color: "#334155",
              }}
            >
              <PenTool size={14} color="#64748b" />
              <span>Thiết lập người ký</span>
            </button>
          ) : (
            <>
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
            </>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
          {isSummary && (
            <button
              type="button"
              style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}
            >
              <MessageSquare size={15} />
            </button>
          )}
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

      {/* 3. Main Body */}
      {isSummary ? (
        /* A4 Sheet Presentation matching Request 12, Screenshot 4 */
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "24px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "1050px",
              minHeight: "800px",
              background: "#ffffff",
              boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
              padding: "40px 48px",
              boxSizing: "border-box",
              color: "#0f172a",
              fontFamily: "'Times New Roman', Times, serif, system-ui",
              fontSize: 12,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Tung</div>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <h1 style={{ margin: "0 0 6px 0", fontSize: 16.5, fontWeight: 700 }}>
                PHÂN TÍCH CÔNG NỢ PHẢI TRẢ THEO TUỔI NỢ
              </h1>
              <div style={{ fontStyle: "italic", fontSize: 12.5 }}>
                Tài khoản: 331; Đến ngày 07/10/2026
              </div>
            </div>

            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                border: "1px solid #334155",
                fontSize: 10.5,
              }}
            >
              <thead>
                <tr style={{ background: "#ffffff", textAlign: "center", fontWeight: 700 }}>
                  <th rowSpan={2} style={{ border: "1px solid #334155", padding: "6px 4px", width: 80 }}>
                    Mã nhà cung cấp
                  </th>
                  <th rowSpan={2} style={{ border: "1px solid #334155", padding: "6px 4px", width: 120 }}>
                    Tên nhà cung cấp
                  </th>
                  <th rowSpan={2} style={{ border: "1px solid #334155", padding: "6px 4px", width: 80 }}>
                    Địa chỉ
                  </th>
                  <th rowSpan={2} style={{ border: "1px solid #334155", padding: "6px 4px", width: 75 }}>
                    Tổng nợ
                  </th>
                  <th rowSpan={2} style={{ border: "1px solid #334155", padding: "6px 4px", width: 75 }}>
                    Không có hạn nợ
                  </th>
                  <th colSpan={6} style={{ border: "1px solid #334155", padding: "4px" }}>
                    Nợ trước hạn
                  </th>
                  <th colSpan={6} style={{ border: "1px solid #334155", padding: "4px" }}>
                    Nợ quá hạn
                  </th>
                </tr>
                <tr style={{ textAlign: "center", fontWeight: 700 }}>
                  <th style={{ border: "1px solid #334155", padding: "4px" }}>0-30 ngày</th>
                  <th style={{ border: "1px solid #334155", padding: "4px" }}>31-60 ngày</th>
                  <th style={{ border: "1px solid #334155", padding: "4px" }}>61-90 ngày</th>
                  <th style={{ border: "1px solid #334155", padding: "4px" }}>91-120 ngày</th>
                  <th style={{ border: "1px solid #334155", padding: "4px" }}>Trên 120 ngày</th>
                  <th style={{ border: "1px solid #334155", padding: "4px" }}>Tổng</th>
                  <th style={{ border: "1px solid #334155", padding: "4px" }}>1-30 ngày</th>
                  <th style={{ border: "1px solid #334155", padding: "4px" }}>31-60 ngày</th>
                  <th style={{ border: "1px solid #334155", padding: "4px" }}>61-90 ngày</th>
                  <th style={{ border: "1px solid #334155", padding: "4px" }}>91-120 ngày</th>
                  <th style={{ border: "1px solid #334155", padding: "4px" }}>Trên 120 ngày</th>
                  <th style={{ border: "1px solid #334155", padding: "4px" }}>Tổng</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ fontWeight: 700 }}>
                  <td style={{ border: "1px solid #334155", padding: "4px" }}>Mã nhóm NCC: &lt;&lt;Khác&gt;&gt;</td>
                  <td colSpan={16} style={{ border: "1px solid #334155", padding: "4px" }}>
                    Tên nhóm NCC: &lt;&lt;Khác&gt;&gt;
                  </td>
                </tr>
                <tr>
                  <td style={{ border: "1px solid #334155", padding: "4px" }}>NCC00001</td>
                  <td style={{ border: "1px solid #334155", padding: "4px" }}>Tran Thi Huong</td>
                  <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                  <td style={{ border: "1px solid #334155", padding: "4px", textAlign: "right" }}>17.000.000</td>
                  <td style={{ border: "1px solid #334155", padding: "4px", textAlign: "right" }}>17.000.000</td>
                  <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                  <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                  <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                  <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                  <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                  <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                  <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                  <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                  <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                  <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                  <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                  <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                </tr>
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={3} style={{ border: "1px solid #334155", padding: "4px" }}>Tổng cộng</td>
                  <td style={{ border: "1px solid #334155", padding: "4px", textAlign: "right" }}>17.000.000</td>
                  <td style={{ border: "1px solid #334155", padding: "4px", textAlign: "right" }}>17.000.000</td>
                  <td colSpan={12} style={{ border: "1px solid #334155", padding: "4px" }}></td>
                </tr>
              </tbody>
            </table>

            {/* Signatures */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                marginTop: 40,
                textAlign: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>Người lập</div>
                <div style={{ fontStyle: "italic", fontSize: 11 }}>(Ký, họ tên)</div>
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>Kế toán trưởng</div>
                <div style={{ fontStyle: "italic", fontSize: 11 }}>(Ký, họ tên)</div>
              </div>
              <div>
                <div style={{ fontStyle: "italic", fontSize: 11, marginBottom: 4 }}>
                  Ngày 07 tháng 10 năm 2026
                </div>
                <div style={{ fontWeight: 700 }}>Giám đốc</div>
                <div style={{ fontStyle: "italic", fontSize: 11 }}>(Ký, họ tên, đóng dấu)</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Detailed Table matching Request 13, Screenshot 4 & 5 */
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
              CHI TIẾT CÔNG NỢ PHẢI TRẢ THEO TUỔI NỢ
            </h1>
            <div style={{ fontSize: 12.5, color: "#475569", fontStyle: "italic" }}>
              Tài khoản: 331, Đến ngày 07/10/2026
            </div>
          </div>

          <div style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#e8f5ec", borderBottom: "1px solid #cbd5e1" }}>
                  <th rowSpan={2} style={{ padding: "8px 10px", textAlign: "left", width: 95, borderRight: "1px solid #cbd5e1" }}>
                    Ngày chứng từ
                  </th>
                  <th rowSpan={2} style={{ padding: "8px 10px", textAlign: "left", width: 95, borderRight: "1px solid #cbd5e1" }}>
                    Số chứng từ
                  </th>
                  <th rowSpan={2} style={{ padding: "8px 10px", textAlign: "left", width: 95, borderRight: "1px solid #cbd5e1" }}>
                    Ngày hóa đơn
                  </th>
                  <th rowSpan={2} style={{ padding: "8px 10px", textAlign: "left", width: 90, borderRight: "1px solid #cbd5e1" }}>
                    Số hóa đơn
                  </th>
                  <th rowSpan={2} style={{ padding: "8px 10px", textAlign: "left", minWidth: 200, borderRight: "1px solid #cbd5e1" }}>
                    Diễn giải
                  </th>
                  <th rowSpan={2} style={{ padding: "8px 10px", textAlign: "right", width: 95, borderRight: "1px solid #cbd5e1" }}>
                    Tổng nợ
                  </th>
                  <th rowSpan={2} style={{ padding: "8px 10px", textAlign: "right", width: 105, borderRight: "1px solid #cbd5e1" }}>
                    Không có hạn nợ
                  </th>
                  <th colSpan={6} style={{ padding: "6px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1" }}>
                    Nợ trước hạn
                  </th>
                  <th colSpan={6} style={{ padding: "6px 10px", textAlign: "center", borderBottom: "1px solid #cbd5e1" }}>
                    Nợ quá hạn
                  </th>
                </tr>
                <tr style={{ background: "#e8f5ec", borderBottom: "1px solid #cbd5e1" }}>
                  <th style={{ padding: "6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>0-30 ngày</th>
                  <th style={{ padding: "6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>31-60 ngày</th>
                  <th style={{ padding: "6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>61-90 ngày</th>
                  <th style={{ padding: "6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>91-120 ngày</th>
                  <th style={{ padding: "6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Trên 120 ngày</th>
                  <th style={{ padding: "6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Tổng</th>
                  <th style={{ padding: "6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>1-30 ngày</th>
                  <th style={{ padding: "6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>31-60 ngày</th>
                  <th style={{ padding: "6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>61-90 ngày</th>
                  <th style={{ padding: "6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>91-120 ngày</th>
                  <th style={{ padding: "6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Trên 120 ngày</th>
                  <th style={{ padding: "6px", textAlign: "right" }}>Tổng</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: "#f8fafc", fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>
                  <td colSpan={5} style={{ padding: "8px 10px" }}>▾ Tên nhà cung cấp: Tran Thi Huong (1)</td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>17.000.000</td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>17.000.000</td>
                  <td colSpan={12}></td>
                </tr>
                <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "8px 10px" }}>06/10/2026</td>
                  <td style={{ padding: "8px 10px", color: "#0075c0" }}>NK00001</td>
                  <td style={{ padding: "8px 10px" }}>06/10/2026</td>
                  <td style={{ padding: "8px 10px" }}>NM01</td>
                  <td style={{ padding: "8px 10px" }}>Mua hàng của Tran Thi Huong theo hóa đơn ...</td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>17.000.000</td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>17.000.000</td>
                  <td colSpan={12}></td>
                </tr>
                <tr style={{ background: "#f8fafc", fontWeight: 700, borderTop: "1px solid #cbd5e1" }}>
                  <td colSpan={5} style={{ padding: "8px 10px" }}>Tổng cộng</td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>17.000.000</td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>17.000.000</td>
                  <td colSpan={12}></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

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
            <p style={{ marginTop: 20, color: "#64748b" }}>Đến ngày: 07/10/2026. Tài khoản: 331. Nhà cung cấp: NCC00001 - Tran Thi Huong.</p>
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
