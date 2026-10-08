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
  Calendar,
  PenTool,
  MessageCircle,
} from "lucide-react";

export interface MisaItemPayablesDetailReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaItemPayablesDetailReport({
  onBack,
  notify,
}: MisaItemPayablesDetailReportProps) {
  // Drawer Parameters State
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [reportPeriodPreset, setReportPeriodPreset] = useState("Tháng này");
  const [fromDate, setFromDate] = useState("01/10/2026");
  const [toDate, setToDate] = useState("31/10/2026");
  const [selectedAccount, setSelectedAccount] = useState("331");
  const [combineTax, setCombineTax] = useState(false);

  // Drawer draft state
  const [draftPeriodPreset, setDraftPeriodPreset] = useState("Tháng này");
  const [draftFromDate, setDraftFromDate] = useState("01/10/2026");
  const [draftToDate, setDraftToDate] = useState("31/10/2026");
  const [draftCombineTax, setDraftCombineTax] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");

  const accountsList = [
    { code: "331", name: "Phải trả cho người bán", level: 1 },
    { code: "336", name: "Phải trả nội bộ", level: 1 },
    { code: "3361", name: "Phải trả nội bộ về vốn kinh doanh", level: 2 },
    { code: "3362", name: "Phải trả nội bộ về chênh lệch tỷ giá", level: 2 },
    { code: "3363", name: "Phải trả nội bộ về chi phí đi vay đủ điều kiện được vốn hóa", level: 2 },
    { code: "3368", name: "Phải trả nội bộ khác", level: 2 },
    { code: "341", name: "Vay và nợ thuê tài chính", level: 1 },
    { code: "3411", name: "Các khoản đi vay", level: 2 },
    { code: "3412", name: "Nợ thuê tài chính", level: 2 },
  ];

  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(
    accountsList.map((a) => a.code)
  );
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>(["NCC00001"]);

  const handleOpenDrawer = () => {
    setDraftPeriodPreset(reportPeriodPreset);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftCombineTax(combineTax);
    setAccountSearch("");
    setSupplierSearch("");
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setReportPeriodPreset(draftPeriodPreset);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setCombineTax(draftCombineTax);
    if (selectedAccounts.length > 0) {
      setSelectedAccount(selectedAccounts[0]);
    }
    setIsParamDrawerOpen(false);
    notify?.("Đã cập nhật Chi tiết công nợ phải trả theo mặt hàng (tĩnh).");
  };

  const handleResetParams = () => {
    setDraftPeriodPreset("Tháng này");
    setDraftFromDate("01/10/2026");
    setDraftToDate("31/10/2026");
    setSelectedAccounts(accountsList.map((a) => a.code));
    setSelectedSuppliers(["NCC00001"]);
    setDraftCombineTax(false);
  };

  const filteredAccounts = accountsList.filter(
    (a) =>
      a.code.toLowerCase().includes(accountSearch.toLowerCase()) ||
      a.name.toLowerCase().includes(accountSearch.toLowerCase())
  );

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
      {/* 1. Top Header Bar */}
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
            Chi tiết công nợ phải trả theo mặt hàng (tĩnh)
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
            onClick={() => notify?.("Đã lưu báo cáo thành công.")}
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

      {/* 2. Action Toolbar matching Screenshot 5 */}
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
              fontWeight: 500,
            }}
            onClick={() => notify?.("Mở thiết lập người ký báo cáo...")}
          >
            <PenTool size={14} color="#64748b" />
            <span>Thiết lập người ký</span>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}
            title="Nạp lại"
            onClick={() => notify?.("Đã nạp lại dữ liệu.")}
          >
            <RefreshCw size={15} />
          </button>

          <button
            type="button"
            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}
            title="Gửi mail"
            onClick={() => notify?.("Mở hộp thoại gửi mail...")}
          >
            <Mail size={15} />
          </button>

          {/* MISA Online Chat / Support button */}
          <button
            type="button"
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "#0284c7",
              border: "none",
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
            title="Hỗ trợ trực tuyến MISA"
            onClick={() => notify?.("Mở hỗ trợ trực tuyến.")}
          >
            <MessageCircle size={13} fill="#ffffff" />
          </button>

          <button
            type="button"
            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}
            title="In báo cáo"
            onClick={() => window.print()}
          >
            <Printer size={15} />
          </button>

          <button
            type="button"
            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}
            title="Xuất file"
            onClick={() => notify?.("Xuất file báo cáo thành công.")}
          >
            <Download size={15} />
          </button>

          <button
            type="button"
            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}
            title="Tùy chọn khác"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* 3. A4 Canvas Sheet Preview matching Screenshot 5 */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "24px",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            width: "920px",
            minHeight: "1180px",
            background: "#ffffff",
            boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
            padding: "40px 48px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            color: "#0f172a",
            fontSize: 12,
            fontFamily: "'Times New Roman', Times, serif, system-ui",
          }}
        >
          {/* Header Top Left matching Screenshot 5 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Tung</div>
          </div>

          {/* Title Centered matching Screenshot 5 */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <h1
              style={{
                margin: "0 0 6px 0",
                fontSize: 16.5,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              CHI TIẾT CÔNG NỢ PHẢI TRẢ THEO MẶT HÀNG
            </h1>
            <div style={{ fontStyle: "italic", fontSize: 13, marginBottom: 4 }}>
              Tháng 10 năm 2026
            </div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>
              Tài khoản: {selectedAccount} - Phải trả cho người bán
            </div>
          </div>

          {/* Supplier Info matching Screenshot 5 */}
          <div style={{ marginBottom: 16, fontSize: 12.5, lineHeight: 1.6 }}>
            <div>
              <span style={{ fontWeight: 700 }}>Mã nhà cung cấp: </span>
              <span>NCC00001</span>
            </div>
            <div>
              <span style={{ fontWeight: 700 }}>Tên nhà cung cấp: </span>
              <span>Tran Thi Huong</span>
            </div>
          </div>

          {/* Detailed Ledger Table matching Screenshot 5 */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              border: "1px solid #334155",
              fontSize: 11,
              lineHeight: 1.35,
            }}
          >
            <thead>
              <tr style={{ background: "#ffffff", textAlign: "center", fontWeight: 700 }}>
                <th style={{ border: "1px solid #334155", padding: "6px 4px", width: 68 }}>
                  Ngày hạch toán
                </th>
                <th style={{ border: "1px solid #334155", padding: "6px 4px", width: 68 }}>
                  Ngày chứng từ
                </th>
                <th style={{ border: "1px solid #334155", padding: "6px 4px", width: 68 }}>
                  Số chứng từ
                </th>
                <th style={{ border: "1px solid #334155", padding: "6px 6px", textAlign: "left", minWidth: 150 }}>
                  Diễn giải
                </th>
                <th style={{ border: "1px solid #334155", padding: "6px 4px", width: 44 }}>
                  TK đối ứng
                </th>
                <th style={{ border: "1px solid #334155", padding: "6px 4px", width: 44 }}>
                  Đơn vị tính
                </th>
                <th style={{ border: "1px solid #334155", padding: "6px 4px", width: 46 }}>
                  Số lượng
                </th>
                <th style={{ border: "1px solid #334155", padding: "6px 4px", width: 72 }}>
                  Đơn giá
                </th>
                <th style={{ border: "1px solid #334155", padding: "6px 4px", width: 72 }}>
                  Số phải trả
                </th>
                <th style={{ border: "1px solid #334155", padding: "6px 4px", width: 64 }}>
                  Trả lại/Giảm giá
                </th>
                <th style={{ border: "1px solid #334155", padding: "6px 4px", width: 68 }}>
                  CK thanh toán/Giảm trừ khác
                </th>
                <th style={{ border: "1px solid #334155", padding: "6px 4px", width: 72 }}>
                  Số đã trả
                </th>
                <th style={{ border: "1px solid #334155", padding: "6px 4px", width: 72 }}>
                  Số dư
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Row 1: Header of Voucher NK00001 */}
              <tr>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "center" }}>
                  06/10/2026
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "center" }}>
                  06/10/2026
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "center" }}>
                  NK00001
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 6px" }}>
                  Mua hàng của Tran Thi Huong theo hóa đơn số NM01
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
              </tr>

              {/* Row 2: Item 1 */}
              <tr>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 6px" }}>
                  Màn hình 21 LG inch
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "center" }}>
                  156
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "center" }}>
                  chiếc
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "right" }}>
                  10,00
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "right" }}>
                  2.500.000,00
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "right" }}>
                  25.000.000
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "right" }}>
                  25.000.000
                </td>
              </tr>

              {/* Row 3: Tax Line */}
              <tr>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 6px" }}>
                  Thuế GTGT - Màn hình 21 LG inch
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "center" }}>
                  1331
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "right" }}>
                  2.000.000
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "right" }}>
                  27.000.000
                </td>
              </tr>

              {/* Row 4: Cộng Voucher NK00001 */}
              <tr style={{ fontWeight: 700 }}>
                <td style={{ border: "1px solid #334155", padding: "5px 6px" }} colSpan={6}>
                  Cộng
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "right" }}>
                  10,00
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "right" }}>
                  27.000.000
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "right" }}>
                  27.000.000
                </td>
              </tr>

              {/* Row 5: Header Voucher UNC00001 */}
              <tr>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "center" }}>
                  06/10/2026
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "center" }}>
                  06/10/2026
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "center" }}>
                  UNC00001
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 6px" }}>
                  Trả tiền cho Tran Thi Huong theo hóa đơn số NM01
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
              </tr>

              {/* Row 6: UNC Detail */}
              <tr>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 6px" }}>
                  Trả tiền cho Tran Thi Huong theo hóa đơn NM01
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "center" }}>
                  1121
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "right" }}>
                  10.000.000
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "right" }}>
                  17.000.000
                </td>
              </tr>

              {/* Row 7: Cộng UNC */}
              <tr style={{ fontWeight: 700 }}>
                <td style={{ border: "1px solid #334155", padding: "5px 6px" }} colSpan={6}>
                  Cộng
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "right" }}>
                  10.000.000
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "right" }}>
                  17.000.000
                </td>
              </tr>

              {/* Row 8: Tổng cộng */}
              <tr style={{ fontWeight: 700 }}>
                <td style={{ border: "1px solid #334155", padding: "5px 6px" }} colSpan={6}>
                  Tổng cộng
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "right" }}>
                  10,00
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "right" }}>
                  27.000.000
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "right" }}>
                  10.000.000
                </td>
                <td style={{ border: "1px solid #334155", padding: "5px 4px", textAlign: "right" }}>
                  17.000.000
                </td>
              </tr>
            </tbody>
          </table>

          {/* Bottom Debt Summary matching Screenshot 5 */}
          <div style={{ marginTop: 24, fontSize: 12.5, lineHeight: 1.8 }}>
            <div>
              <span style={{ fontWeight: 700 }}>Công nợ đầu kỳ:</span>
            </div>
            <div>
              <span style={{ fontWeight: 700 }}>Số phát sinh trong kỳ: </span>
              <span style={{ marginLeft: 160 }}>27.000.000</span>
            </div>
            <div>
              <span style={{ fontWeight: 700 }}>Số đã thanh toán: </span>
              <span style={{ marginLeft: 172 }}>10.000.000</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Modal Drawer matching Screenshot 4 */}
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
              boxShadow: "-4px 0 16px rgba(0,0,0,0.15)",
              animation: "slideInRight 0.25s ease-out",
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                Chọn tham số
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
                  title="Trợ giúp"
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsParamDrawerOpen(false)}
                  style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}
                  title="Đóng"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Drawer Content matching Screenshot 4 */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {/* Row 1: Kỳ báo cáo, Từ ngày, Đến ngày */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 16,
                  alignItems: "flex-end",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: 5,
                    }}
                  >
                    Kỳ báo cáo
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={draftPeriodPreset}
                      onChange={(e) => setDraftPeriodPreset(e.target.value)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 28px 0 10px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        background: "#ffffff",
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="Tháng này">Tháng này</option>
                      <option value="Tháng trước">Tháng trước</option>
                      <option value="Quý 4">Quý 4</option>
                      <option value="Năm nay">Năm nay</option>
                    </select>
                    <ChevronDown
                      size={15}
                      style={{ position: "absolute", right: 8, top: 9, color: "#64748b", pointerEvents: "none" }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: 5,
                    }}
                  >
                    Từ ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={draftFromDate}
                      onChange={(e) => setDraftFromDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 28px 0 10px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        outline: "none",
                      }}
                    />
                    <Calendar
                      size={14}
                      style={{ position: "absolute", right: 8, top: 9, color: "#64748b", pointerEvents: "none" }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: 5,
                    }}
                  >
                    Đến ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={draftToDate}
                      onChange={(e) => setDraftToDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 28px 0 10px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        outline: "none",
                      }}
                    />
                    <Calendar
                      size={14}
                      style={{ position: "absolute", right: 8, top: 9, color: "#64748b", pointerEvents: "none" }}
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Nhóm NCC matching Screenshot 4 */}
              <div style={{ width: "40%" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 5,
                  }}
                >
                  Nhóm NCC
                </label>
                <div style={{ position: "relative" }}>
                  <select
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 28px 0 10px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      fontSize: 12.5,
                      background: "#ffffff",
                      outline: "none",
                      cursor: "pointer",
                    }}
                  >
                    <option value="">-- Tất cả nhóm NCC --</option>
                  </select>
                  <ChevronDown
                    size={15}
                    style={{ position: "absolute", right: 8, top: 9, color: "#64748b", pointerEvents: "none" }}
                  />
                </div>
              </div>

              {/* Table 1: Chọn tài khoản matching Screenshot 4 */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#334155", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={selectedAccounts.length === accountsList.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAccounts(accountsList.map((a) => a.code));
                        } else {
                          setSelectedAccounts([]);
                        }
                      }}
                      style={{ accentColor: "#00a862" }}
                    />
                    <span style={{ fontWeight: 600 }}>Chọn tất cả tài khoản</span>
                    <span style={{ color: "#00a862", fontWeight: 600, marginLeft: 4 }}>
                      {selectedAccounts.length} tài khoản được chọn
                    </span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <Search
                      size={13}
                      style={{
                        position: "absolute",
                        left: 8,
                        top: 6.5,
                        color: "#8b5cf6",
                        pointerEvents: "none",
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Nhập từ khóa tìm kiếm"
                      value={accountSearch}
                      onChange={(e) => setAccountSearch(e.target.value)}
                      style={{
                        width: 200,
                        height: 26,
                        padding: "0 8px 0 26px",
                        fontSize: 11.5,
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    maxHeight: 180,
                    overflowY: "auto",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                  }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#e5efe8", borderBottom: "1px solid #cbd5e1", position: "sticky", top: 0 }}>
                        <th style={{ width: 36, padding: "6px 8px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={selectedAccounts.length === accountsList.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAccounts(accountsList.map((a) => a.code));
                              } else {
                                setSelectedAccounts([]);
                              }
                            }}
                            style={{ accentColor: "#00a862" }}
                          />
                        </th>
                        <th style={{ padding: "6px 10px", textAlign: "left", width: 140, fontWeight: 600 }}>Số tài khoản</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600 }}>Tên tài khoản</th>
                        <th style={{ padding: "6px 10px", textAlign: "center", width: 60, fontWeight: 600 }}>Bậc</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAccounts.map((acc) => {
                        const isChecked = selectedAccounts.includes(acc.code);
                        return (
                          <tr
                            key={acc.code}
                            onClick={() => {
                              setSelectedAccounts((prev) =>
                                prev.includes(acc.code)
                                  ? prev.filter((c) => c !== acc.code)
                                  : [...prev, acc.code]
                              );
                            }}
                            style={{
                              borderBottom: "1px solid #f1f5f9",
                              cursor: "pointer",
                              background: isChecked ? "#f0fdf4" : "#ffffff",
                            }}
                          >
                            <td style={{ textAlign: "center", padding: "5px 8px" }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                style={{ accentColor: "#00a862" }}
                              />
                            </td>
                            <td style={{ padding: "5px 10px", fontWeight: acc.level === 1 ? 600 : 400 }}>
                              {acc.code}
                            </td>
                            <td style={{ padding: "5px 10px" }}>{acc.name}</td>
                            <td style={{ padding: "5px 10px", textAlign: "center" }}>{acc.level}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table 2: Chọn nhà cung cấp matching Screenshot 4 */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#334155", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={selectedSuppliers.includes("NCC00001")}
                      onChange={(e) => {
                        setSelectedSuppliers(e.target.checked ? ["NCC00001"] : []);
                      }}
                      style={{ accentColor: "#00a862" }}
                    />
                    <span style={{ fontWeight: 600 }}>Chọn tất cả nhà cung cấp</span>
                    <span style={{ color: "#00a862", fontWeight: 600, marginLeft: 4 }}>
                      {selectedSuppliers.length} nhà cung cấp được chọn
                    </span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <Search
                      size={13}
                      style={{
                        position: "absolute",
                        left: 8,
                        top: 6.5,
                        color: "#8b5cf6",
                        pointerEvents: "none",
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Nhập từ khóa tìm kiếm"
                      value={supplierSearch}
                      onChange={(e) => setSupplierSearch(e.target.value)}
                      style={{
                        width: 200,
                        height: 26,
                        padding: "0 8px 0 26px",
                        fontSize: 11.5,
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#e5efe8", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ width: 36, padding: "6px 8px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={selectedSuppliers.includes("NCC00001")}
                            onChange={(e) => {
                              setSelectedSuppliers(e.target.checked ? ["NCC00001"] : []);
                            }}
                            style={{ accentColor: "#00a862" }}
                          />
                        </th>
                        <th style={{ padding: "6px 10px", textAlign: "left", width: 130, fontWeight: 600 }}>Mã NCC</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", width: 170, fontWeight: 600 }}>Tên NCC</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600 }}>Địa chỉ</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", width: 140, fontWeight: 600 }}>Mã số thuế</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        onClick={() => {
                          setSelectedSuppliers((prev) =>
                            prev.includes("NCC00001") ? [] : ["NCC00001"]
                          );
                        }}
                        style={{
                          background: selectedSuppliers.includes("NCC00001") ? "#f0fdf4" : "#ffffff",
                          cursor: "pointer",
                        }}
                      >
                        <td style={{ textAlign: "center", padding: "5px 8px" }}>
                          <input
                            type="checkbox"
                            checked={selectedSuppliers.includes("NCC00001")}
                            onChange={() => {}}
                            style={{ accentColor: "#00a862" }}
                          />
                        </td>
                        <td style={{ padding: "5px 10px" }}>NCC00001</td>
                        <td style={{ padding: "5px 10px" }}>Tran Thi Huong</td>
                        <td style={{ padding: "5px 10px" }}></td>
                        <td style={{ padding: "5px 10px" }}>030178006908</td>
                      </tr>
                    </tbody>
                  </table>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 12px",
                      background: "#f8fafc",
                      borderTop: "1px solid #e2e8f0",
                      fontSize: 11.5,
                      color: "#64748b",
                    }}
                  >
                    <span>Tổng số: 1</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <span>Số dòng/trang</span>
                      <select
                        defaultValue="20"
                        style={{
                          height: 22,
                          padding: "0 4px",
                          borderRadius: 3,
                          border: "1px solid #cbd5e1",
                          fontSize: 11.5,
                          outline: "none",
                          background: "#ffffff",
                        }}
                      >
                        <option value="10">10</option>
                        <option value="20">20</option>
                        <option value="30">30</option>
                      </select>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ cursor: "pointer", color: "#94a3b8" }}>|&lt;</span>
                        <span style={{ cursor: "pointer", color: "#94a3b8" }}>&lt;</span>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 18,
                            height: 18,
                            borderRadius: 2,
                            background: "#e8f5ec",
                            color: "#00a862",
                            fontWeight: 700,
                          }}
                        >
                          1
                        </span>
                        <span style={{ cursor: "pointer", color: "#94a3b8" }}>&gt;</span>
                        <span style={{ cursor: "pointer", color: "#94a3b8" }}>&gt;|</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Checkbox "Cộng gộp tiền thuế của các mặt hàng khác nhau" */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "#334155",
                  cursor: "pointer",
                  marginTop: 4,
                }}
              >
                <input
                  type="checkbox"
                  checked={draftCombineTax}
                  onChange={(e) => setDraftCombineTax(e.target.checked)}
                  style={{ accentColor: "#00a862" }}
                />
                <span>Cộng gộp tiền thuế của các mặt hàng khác nhau</span>
              </label>
            </div>

            {/* Drawer Footer matching Screenshot 4 */}
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
                    fontWeight: 600,
                    color: "#ffffff",
                    cursor: "pointer",
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
