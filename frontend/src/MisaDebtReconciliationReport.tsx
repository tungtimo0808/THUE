import React, { useState } from "react";
import {
  ChevronLeft,
  Printer,
  Download,
  Settings,
  HelpCircle,
  X,
  RefreshCw,
  Mail,
  PenTool,
  MessageSquare,
  UserCheck,
} from "lucide-react";

export interface MisaDebtReconciliationReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
  type?: "confirmation" | "notice"; // "confirmation" = Biên bản đối chiếu, "notice" = Thông báo công nợ
}

export default function MisaDebtReconciliationReport({
  onBack,
  notify,
  type = "confirmation",
}: MisaDebtReconciliationReportProps) {
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const isNotice = type === "notice";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: "#e2e8f0",
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
            {isNotice ? "Thông báo công nợ với nhà cung cấp" : "Biên bản đối chiếu và xác nhận công nợ phải trả"}
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
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
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
          <button
            type="button"
            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}
          >
            <MessageSquare size={15} />
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

      {/* 3. A4 Sheet Paper */}
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
            width: "880px",
            minHeight: "1050px",
            background: "#ffffff",
            boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
            padding: "40px 48px",
            boxSizing: "border-box",
            color: "#0f172a",
            fontFamily: "'Times New Roman', Times, serif, system-ui",
            fontSize: 12,
          }}
        >
          {isNotice ? (
            /* Thông báo công nợ với nhà cung cấp matching Request 14, Screenshot 2 */
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Tung</div>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <h1 style={{ margin: "0 0 6px 0", fontSize: 16.5, fontWeight: 700 }}>
                  THÔNG BÁO CÔNG NỢ VỚI NHÀ CUNG CẤP
                </h1>
                <div style={{ fontStyle: "italic", fontSize: 12.5 }}>Ngày in: 07/10/2026</div>
              </div>

              {/* Two Column Card */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", border: "1px solid #334155", marginBottom: 20 }}>
                <div style={{ padding: "8px 12px", borderRight: "1px solid #334155" }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Kính gửi:</div>
                  <div>Đơn vị: Tran Thi Huong</div>
                  <div>Địa chỉ:</div>
                  <div>Mã số thuế: 030178006908</div>
                </div>
                <div>
                  <div style={{ textAlign: "center", padding: "6px", borderBottom: "1px solid #334155" }}>
                    <div style={{ fontWeight: 700 }}>Kỳ</div>
                    <div style={{ fontStyle: "italic", fontSize: 11 }}>Tháng 10 năm 2026</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "6px 8px", borderBottom: "1px solid #334155" }}>
                    <span style={{ fontWeight: 700 }}>Số dư cuối kỳ</span>
                    <span style={{ textAlign: "right", fontWeight: 700 }}>17.000.000</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "6px 8px" }}>
                    <span style={{ fontWeight: 700 }}>Số dư đầu kỳ</span>
                    <span></span>
                  </div>
                </div>
              </div>

              {/* Voucher Table */}
              <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #334155", marginBottom: 20 }}>
                <thead>
                  <tr style={{ background: "#ffffff", textAlign: "center", fontWeight: 700 }}>
                    <th style={{ border: "1px solid #334155", padding: "6px", width: 90 }}>Ngày</th>
                    <th style={{ border: "1px solid #334155", padding: "6px", width: 100 }}>Số chứng từ</th>
                    <th style={{ border: "1px solid #334155", padding: "6px", textAlign: "left" }}>Diễn giải</th>
                    <th style={{ border: "1px solid #334155", padding: "6px", width: 110, textAlign: "right" }}>Số tiền</th>
                    <th style={{ border: "1px solid #334155", padding: "6px", width: 110, textAlign: "right" }}>Số dư</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #334155", padding: "6px", textAlign: "center" }}>06/10/2026</td>
                    <td style={{ border: "1px solid #334155", padding: "6px", textAlign: "center" }}>NM01</td>
                    <td style={{ border: "1px solid #334155", padding: "6px" }}>
                      Mua hàng của Tran Thi Huong theo hóa đơn số NM01
                    </td>
                    <td style={{ border: "1px solid #334155", padding: "6px", textAlign: "right" }}>17.000.000</td>
                    <td style={{ border: "1px solid #334155", padding: "6px", textAlign: "right" }}>17.000.000</td>
                  </tr>
                </tbody>
              </table>

              {/* Aging Table Box */}
              <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #334155", marginBottom: 40, fontSize: 11 }}>
                <thead>
                  <tr style={{ textAlign: "center", fontWeight: 700 }}>
                    <th style={{ border: "1px solid #334155", padding: "4px" }}>Không có hạn nợ</th>
                    <th style={{ border: "1px solid #334155", padding: "4px" }}>Chưa đến hạn</th>
                    <th style={{ border: "1px solid #334155", padding: "4px" }}>Quá hạn 1-30 ngày</th>
                    <th style={{ border: "1px solid #334155", padding: "4px" }}>Quá hạn 31-60 ngày</th>
                    <th style={{ border: "1px solid #334155", padding: "4px" }}>Quá hạn 61-90 ngày</th>
                    <th style={{ border: "1px solid #334155", padding: "4px" }}>Quá hạn 91-120 ngày</th>
                    <th style={{ border: "1px solid #334155", padding: "4px" }}>Quá hạn trên 120 ngày</th>
                    <th style={{ border: "1px solid #334155", padding: "4px" }}>Tổng số dư Nợ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ textAlign: "right" }}>
                    <td style={{ border: "1px solid #334155", padding: "4px" }}>17.000.000</td>
                    <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                    <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                    <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                    <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                    <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                    <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                    <td style={{ border: "1px solid #334155", padding: "4px", fontWeight: 700 }}>17.000.000</td>
                  </tr>
                </tbody>
              </table>

              {/* Signature */}
              <div style={{ textAlign: "right", paddingRight: 60 }}>
                <div style={{ fontWeight: 700 }}>Người lập</div>
                <div style={{ fontStyle: "italic", fontSize: 11 }}>(Ký, họ tên)</div>
              </div>
            </div>
          ) : (
            /* Biên bản đối chiếu & xác nhận công nợ matching Request 13, Screenshot 2 */
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Tung</div>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <h1 style={{ margin: "0 0 6px 0", fontSize: 16.5, fontWeight: 700 }}>
                  BIÊN BẢN ĐỐI CHIẾU & XÁC NHẬN CÔNG NỢ
                </h1>
              </div>

              <div style={{ marginBottom: 16, lineHeight: 1.6 }}>
                <div><span style={{ fontWeight: 700 }}>Bên mua: </span>Tung</div>
                <div><span style={{ fontWeight: 700 }}>Địa chỉ: </span></div>
                <div><span style={{ fontWeight: 700 }}>Mã số thuế: </span></div>
              </div>

              {/* Bên bán Box */}
              <div style={{ border: "1px solid #334155", marginBottom: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "4px 8px", borderBottom: "1px solid #334155" }}>
                  <span style={{ fontWeight: 700 }}>Bên bán:</span>
                  <div>
                    <span style={{ fontWeight: 700 }}>Mã nhà cung cấp: </span>
                    <span style={{ border: "1px solid #334155", padding: "1px 6px" }}>NCC00001</span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", padding: "4px 8px", borderBottom: "1px solid #334155" }}>
                  <span style={{ fontWeight: 700 }}>Nhà cung cấp</span>
                  <span>Tran Thi Huong</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", padding: "4px 8px", borderBottom: "1px solid #334155" }}>
                  <span style={{ fontWeight: 700 }}>Địa chỉ</span>
                  <span></span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", padding: "4px 8px" }}>
                  <span style={{ fontWeight: 700 }}>Điện thoại và ĐT di động</span>
                  <span>097775611</span>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontStyle: "italic" }}>
                <span>Thời điểm xác nhận: Tháng 10 năm 2026</span>
                <span>Đơn vị tính: VND</span>
              </div>

              {/* Table */}
              <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #334155", marginBottom: 16 }}>
                <thead>
                  <tr style={{ background: "#ffffff", fontWeight: 700 }}>
                    <th style={{ border: "1px solid #334155", padding: "6px 8px", textAlign: "left" }}>
                      Các nội dung đối chiếu:
                    </th>
                    <th style={{ border: "1px solid #334155", padding: "6px 8px", width: 140, textAlign: "right" }}></th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #334155", padding: "5px 8px", fontWeight: 700 }}>1. Công nợ đầu kỳ</td>
                    <td style={{ border: "1px solid #334155", padding: "5px 8px", textAlign: "right" }}></td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #334155", padding: "5px 8px", fontWeight: 700 }}>
                      2. Phát sinh tăng trong kỳ (2 = 2.1 + 2.2)
                    </td>
                    <td style={{ border: "1px solid #334155", padding: "5px 8px", textAlign: "right" }}>27.000.000</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #334155", padding: "4px 8px 4px 20px", fontStyle: "italic" }}>- Trong đó</td>
                    <td style={{ border: "1px solid #334155", padding: "4px 8px" }}></td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #334155", padding: "4px 8px 4px 28px" }}>2.1. Phải trả từ mua hàng</td>
                    <td style={{ border: "1px solid #334155", padding: "4px 8px", textAlign: "right" }}>27.000.000</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #334155", padding: "4px 8px 4px 28px" }}>2.2. Phải trả khác</td>
                    <td style={{ border: "1px solid #334155", padding: "4px 8px" }}></td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #334155", padding: "5px 8px", fontWeight: 700 }}>
                      3. Phát sinh giảm trong kỳ (3 = 3.1 + 3.2)
                    </td>
                    <td style={{ border: "1px solid #334155", padding: "5px 8px", textAlign: "right" }}>10.000.000</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #334155", padding: "4px 8px 4px 28px" }}>3.1. Thanh toán trong kỳ</td>
                    <td style={{ border: "1px solid #334155", padding: "4px 8px", textAlign: "right" }}>10.000.000</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #334155", padding: "4px 8px 4px 28px" }}>3.2. Giảm khác</td>
                    <td style={{ border: "1px solid #334155", padding: "4px 8px" }}></td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #334155", padding: "5px 8px", fontWeight: 700 }}>
                      4. Công nợ cuối kỳ (4 = 1 + 2 - 3)
                    </td>
                    <td style={{ border: "1px solid #334155", padding: "5px 8px", textAlign: "right", fontWeight: 700 }}>
                      17.000.000
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #334155", padding: "5px 8px", fontWeight: 700 }}>
                      5. Phát sinh công nợ lũy kế năm
                    </td>
                    <td style={{ border: "1px solid #334155", padding: "5px 8px", textAlign: "right" }}>27.000.000</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #334155", padding: "5px 8px", fontWeight: 700 }}>
                      6. Công nợ quá hạn thanh toán
                    </td>
                    <td style={{ border: "1px solid #334155", padding: "5px 8px" }}></td>
                  </tr>
                </tbody>
              </table>

              <div style={{ marginBottom: 12, lineHeight: 1.6 }}>
                <div>
                  <span style={{ fontWeight: 700 }}>Số tiền công nợ cuối kỳ viết bằng chữ: </span>
                  <span style={{ fontStyle: "italic" }}>Mười bảy triệu đồng.</span>
                </div>
              </div>

              <div style={{ textAlign: "center", marginTop: 20, fontStyle: "italic", fontWeight: 700 }}>
                Trân trọng cảm ơn!
              </div>
            </div>
          )}
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
            <p style={{ marginTop: 20, color: "#64748b" }}>
              Kỳ: Tháng 10 năm 2026. Nhà cung cấp: NCC00001 - Tran Thi Huong.
            </p>
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
