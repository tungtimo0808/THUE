import { useState } from "react";
import {
  X,
  HelpCircle,
  Calendar,
  Search,
  Filter,
  Check,
  RotateCcw,
  AlertTriangle,
  ArrowRightLeft,
  ChevronRight,
  ChevronLeft,
  FileText,
  DollarSign,
  CheckCircle2,
} from "lucide-react";
import { formatVND, SAMPLE_SUPPLIERS } from "./MisaPurchaseModals";

// ============================================================================
// 1. MODAL: ĐỐI TRỪ CHỨNG TỪ (DebtOffsetModal)
// ============================================================================
export interface DebtOffsetModalProps {
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

export function DebtOffsetModal({ onClose, onSuccess }: DebtOffsetModalProps) {
  const [supplier, setSupplier] = useState(SAMPLE_SUPPLIERS[0]?.code || "NCC001");
  const [offsetDate, setOffsetDate] = useState("09/10/2026");
  const [currency, setCurrency] = useState("VND");
  const [payableAccount, setPayableAccount] = useState("331");

  // Danh sách chứng từ thanh toán (UNC, Phiếu chi)
  const [paymentDocs, setPaymentDocs] = useState([
    {
      id: "pay-01",
      selected: true,
      postDate: "28/09/2026",
      docDate: "28/09/2026",
      docNo: "UNC00042",
      desc: "Chuyển khoản thanh toán tiền mua thiết bị Tân Phát",
      amount: 25000000,
      unOffsetAmount: 25000000,
      offsetAmount: 21500000,
    },
    {
      id: "pay-02",
      selected: false,
      postDate: "05/10/2026",
      docDate: "05/10/2026",
      docNo: "PC00018",
      desc: "Chi tạm ứng mua phụ tùng thay thế",
      amount: 10000000,
      unOffsetAmount: 10000000,
      offsetAmount: 0,
    },
  ]);

  // Danh sách chứng từ công nợ (Hóa đơn mua hàng chưa trả)
  const [debtDocs, setDebtDocs] = useState([
    {
      id: "debt-01",
      selected: true,
      postDate: "29/09/2026",
      docDate: "29/09/2026",
      docNo: "NK00001",
      desc: "Mua máy mài góc và phụ kiện công nghiệp",
      amount: 21500000,
      unOffsetAmount: 21500000,
      offsetAmount: 21500000,
    },
    {
      id: "debt-02",
      selected: false,
      postDate: "02/10/2026",
      docDate: "02/10/2026",
      docNo: "NK00004",
      desc: "Mua bộ dụng cụ cơ khí cầm tay đợt 2",
      amount: 12800000,
      unOffsetAmount: 12800000,
      offsetAmount: 0,
    },
  ]);

  const totalOffset = paymentDocs
    .filter((d) => d.selected)
    .reduce((sum, d) => sum + d.offsetAmount, 0);

  const handleAutoOffset = () => {
    // Tự động gán số tiền đối trừ khớp giữa 2 bên
    let remain = 21500000;
    setPaymentDocs((prev) =>
      prev.map((d, i) =>
        i === 0
          ? { ...d, selected: true, offsetAmount: remain }
          : { ...d, selected: false, offsetAmount: 0 }
      )
    );
    setDebtDocs((prev) =>
      prev.map((d, i) =>
        i === 0
          ? { ...d, selected: true, offsetAmount: remain }
          : { ...d, selected: false, offsetAmount: 0 }
      )
    );
  };

  const handleExecute = () => {
    if (totalOffset <= 0) {
      alert("Vui lòng nhập hoặc chọn số tiền đối trừ lớn hơn 0!");
      return;
    }
    onSuccess?.(`Đã đối trừ thành công số tiền ${formatVND(totalOffset)} đ cho nhà cung cấp ${supplier}`);
    onClose();
  };

  return (
    <div className="misa-modal-backdrop" role="dialog" aria-modal="true">
      <div className="misa-credit-modal-window" style={{ maxWidth: 1100, width: "96vw" }}>
        {/* Header */}
        <header className="misa-credit-modal-header" style={{ borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ArrowRightLeft size={20} style={{ color: "#00b06b" }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111827" }}>
              Đối trừ chứng từ
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="misa-invoice-circle-btn"
              title="Hướng dẫn (F1)"
              onClick={() => alert("Hướng dẫn đối trừ chứng từ thanh toán và hóa đơn công nợ.")}
            >
              <HelpCircle size={18} />
            </button>
            <button
              type="button"
              className="misa-invoice-circle-btn"
              onClick={onClose}
              title="Đóng (ESC)"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Master Filters */}
        <div style={{ padding: "12px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1fr 1fr auto", gap: 12, alignItems: "flex-end" }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Nhà cung cấp <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                style={{ width: "100%", height: 32, padding: "0 8px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13, background: "#fff" }}
              >
                {SAMPLE_SUPPLIERS.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Ngày đối trừ <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={offsetDate}
                  onChange={(e) => setOffsetDate(e.target.value)}
                  style={{ width: "100%", height: 32, padding: "0 28px 0 8px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                />
                <Calendar size={14} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Loại tiền <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={{ width: "100%", height: 32, padding: "0 8px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
              >
                <option value="VND">VND</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                TK phải trả <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={payableAccount}
                onChange={(e) => setPayableAccount(e.target.value)}
                style={{ width: "100%", height: 32, padding: "0 8px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
              >
                <option value="331">331 - Phải trả cho người bán</option>
                <option value="3311">3311 - Phải trả cho người bán ngắn hạn</option>
              </select>
            </div>
            <div>
              <button
                type="button"
                onClick={handleAutoOffset}
                style={{
                  height: 32,
                  padding: "0 14px",
                  borderRadius: 4,
                  border: "none",
                  background: "#00b06b",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <RotateCcw size={14} />
                <span>Lấy dữ liệu</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2 Tables Body */}
        <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Table 1: Chứng từ thanh toán */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                1. Danh sách chứng từ thanh toán
              </div>
              <button
                type="button"
                onClick={handleAutoOffset}
                style={{ fontSize: 12, color: "#0284c7", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                Tự động phân bổ đối trừ
              </button>
            </div>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#334155", textAlign: "left" }}>
                    <th style={{ width: 36, padding: "8px", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={paymentDocs.every((d) => d.selected)}
                        onChange={(e) => setPaymentDocs((prev) => prev.map((d) => ({ ...d, selected: e.target.checked })))}
                      />
                    </th>
                    <th style={{ width: 90, padding: "8px" }}>Ngày HT</th>
                    <th style={{ width: 90, padding: "8px" }}>Ngày CT</th>
                    <th style={{ width: 100, padding: "8px" }}>Số CT</th>
                    <th style={{ padding: "8px" }}>Diễn giải</th>
                    <th style={{ width: 120, padding: "8px", textAlign: "right" }}>Số tiền</th>
                    <th style={{ width: 120, padding: "8px", textAlign: "right" }}>Chưa đối trừ</th>
                    <th style={{ width: 130, padding: "8px", textAlign: "right" }}>Số đối trừ</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentDocs.map((doc) => (
                    <tr key={doc.id} style={{ borderBottom: "1px solid #f1f5f9", background: doc.selected ? "#f0fdf4" : "transparent" }}>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={doc.selected}
                          onChange={(e) => setPaymentDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, selected: e.target.checked } : d)))}
                        />
                      </td>
                      <td style={{ padding: "6px 8px" }}>{doc.postDate}</td>
                      <td style={{ padding: "6px 8px" }}>{doc.docDate}</td>
                      <td style={{ padding: "6px 8px", fontWeight: 600, color: "#0284c7" }}>{doc.docNo}</td>
                      <td style={{ padding: "6px 8px" }}>{doc.desc}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>{formatVND(doc.amount)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#64748b" }}>{formatVND(doc.unOffsetAmount)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>
                        <input
                          type="number"
                          value={doc.offsetAmount}
                          onChange={(e) => {
                            const val = parseInt(e.target.value || "0", 10);
                            setPaymentDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, offsetAmount: val, selected: val > 0 } : d)));
                          }}
                          style={{ width: 110, height: 26, padding: "0 6px", border: "1px solid #d1d5db", borderRadius: 4, textAlign: "right", fontWeight: 600 }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 2: Chứng từ công nợ */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>
              2. Danh sách chứng từ công nợ (Hóa đơn / Chứng từ mua hàng)
            </div>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#334155", textAlign: "left" }}>
                    <th style={{ width: 36, padding: "8px", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={debtDocs.every((d) => d.selected)}
                        onChange={(e) => setDebtDocs((prev) => prev.map((d) => ({ ...d, selected: e.target.checked })))}
                      />
                    </th>
                    <th style={{ width: 90, padding: "8px" }}>Ngày HT</th>
                    <th style={{ width: 90, padding: "8px" }}>Ngày CT</th>
                    <th style={{ width: 100, padding: "8px" }}>Số CT</th>
                    <th style={{ padding: "8px" }}>Diễn giải</th>
                    <th style={{ width: 120, padding: "8px", textAlign: "right" }}>Số tiền</th>
                    <th style={{ width: 120, padding: "8px", textAlign: "right" }}>Chưa đối trừ</th>
                    <th style={{ width: 130, padding: "8px", textAlign: "right" }}>Số đối trừ</th>
                  </tr>
                </thead>
                <tbody>
                  {debtDocs.map((doc) => (
                    <tr key={doc.id} style={{ borderBottom: "1px solid #f1f5f9", background: doc.selected ? "#f0fdf4" : "transparent" }}>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={doc.selected}
                          onChange={(e) => setDebtDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, selected: e.target.checked } : d)))}
                        />
                      </td>
                      <td style={{ padding: "6px 8px" }}>{doc.postDate}</td>
                      <td style={{ padding: "6px 8px" }}>{doc.docDate}</td>
                      <td style={{ padding: "6px 8px", fontWeight: 600, color: "#0284c7" }}>{doc.docNo}</td>
                      <td style={{ padding: "6px 8px" }}>{doc.desc}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>{formatVND(doc.amount)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#64748b" }}>{formatVND(doc.unOffsetAmount)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>
                        <input
                          type="number"
                          value={doc.offsetAmount}
                          onChange={(e) => {
                            const val = parseInt(e.target.value || "0", 10);
                            setDebtDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, offsetAmount: val, selected: val > 0 } : d)));
                          }}
                          style={{ width: 110, height: 26, padding: "0 6px", border: "1px solid #d1d5db", borderRadius: 4, textAlign: "right", fontWeight: 600 }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer style={{ height: 50, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            <span>F9: Đối trừ</span> | <span>ESC: Đóng</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 13, color: "#475569" }}>Tổng số đối trừ:</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#00b06b" }}>
                {formatVND(totalOffset)} đ
              </span>
            </div>
            <button
              type="button"
              className="misa-invoice-btn-cancel"
              onClick={onClose}
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleExecute}
              style={{
                height: 32,
                padding: "0 20px",
                borderRadius: 4,
                border: "none",
                background: "#00b06b",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              }}
            >
              Đối trừ
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ============================================================================
// 2. MODAL: ĐỐI TRỪ CHỨNG TỪ NHIỀU ĐỐI TƯỢNG (MultiDebtOffsetModal)
// ============================================================================
export interface MultiDebtOffsetModalProps {
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

export function MultiDebtOffsetModal({ onClose, onSuccess }: MultiDebtOffsetModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [account, setAccount] = useState("331");
  const [group, setGroup] = useState("Tất cả");
  const [offsetDate, setOffsetDate] = useState("09/10/2026");

  const [suppliersList, setSuppliersList] = useState([
    {
      id: "sup-01",
      selected: true,
      code: "NCC001",
      name: "Công ty TNHH Thiết bị Công nghiệp Tân Phát",
      unpaidPayment: 25000000,
      unpaidDebt: 21500000,
      expectedOffset: 21500000,
    },
    {
      id: "sup-02",
      selected: true,
      code: "NCC002",
      name: "Công ty Cổ phần Thép Hòa Phát Hưng Yên",
      unpaidPayment: 50000000,
      unpaidDebt: 88500000,
      expectedOffset: 50000000,
    },
    {
      id: "sup-03",
      selected: false,
      code: "NCC003",
      name: "Công ty TNHH Nhập khẩu & Thương mại Sao Nam",
      unpaidPayment: 0,
      unpaidDebt: 15400000,
      expectedOffset: 0,
    },
  ]);

  const selectedCount = suppliersList.filter((s) => s.selected).length;
  const totalOffsetExpected = suppliersList
    .filter((s) => s.selected)
    .reduce((sum, s) => sum + s.expectedOffset, 0);

  const handleFinish = () => {
    onSuccess?.(`Đã hoàn tất đối trừ công nợ tự động cho ${selectedCount} nhà cung cấp với tổng số tiền ${formatVND(totalOffsetExpected)} đ.`);
    onClose();
  };

  return (
    <div className="misa-modal-backdrop" role="dialog" aria-modal="true">
      <div className="misa-credit-modal-window" style={{ maxWidth: 1050, width: "95vw" }}>
        {/* Header */}
        <header className="misa-credit-modal-header" style={{ borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ArrowRightLeft size={20} style={{ color: "#00b06b" }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111827" }}>
              Đối trừ chứng từ nhiều đối tượng
            </h2>
          </div>
          <button
            type="button"
            className="misa-invoice-circle-btn"
            onClick={onClose}
            title="Đóng (ESC)"
          >
            <X size={18} />
          </button>
        </header>

        {/* Stepper Wizard Bar */}
        <div style={{ display: "flex", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: "10px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: step === 1 ? "#00b06b" : "#475569", fontWeight: 700, fontSize: 13 }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: step === 1 ? "#00b06b" : "#cbd5e1", color: "#fff", display: "grid", placeItems: "center", fontSize: 12 }}>1</span>
            <span>CHỌN NHÀ CUNG CẤP</span>
          </div>
          <div style={{ width: 40, height: 1, background: "#cbd5e1", alignSelf: "center", margin: "0 16px" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: step === 2 ? "#00b06b" : "#94a3b8", fontWeight: 700, fontSize: 13 }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: step === 2 ? "#00b06b" : "#e2e8f0", color: step === 2 ? "#fff" : "#64748b", display: "grid", placeItems: "center", fontSize: 12 }}>2</span>
            <span>CHI TIẾT ĐỐI TRỪ & KẾT QUẢ</span>
          </div>
        </div>

        {/* Filters */}
        <div style={{ padding: "12px 20px", background: "#ffffff", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 1fr auto", gap: 14, alignItems: "flex-end" }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Tài khoản phải trả <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                style={{ width: "100%", height: 32, padding: "0 8px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
              >
                <option value="331">331 - Phải trả cho người bán</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Nhóm nhà cung cấp
              </label>
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                style={{ width: "100%", height: 32, padding: "0 8px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
              >
                <option value="Tất cả">Tất cả nhóm</option>
                <option value="Thiết bị máy móc">Thiết bị máy móc</option>
                <option value="Nguyên vật liệu thép">Nguyên vật liệu thép</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Ngày đối trừ <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                value={offsetDate}
                onChange={(e) => setOffsetDate(e.target.value)}
                style={{ width: "100%", height: 32, padding: "0 8px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
              />
            </div>
            <div>
              <button
                type="button"
                style={{ height: 32, padding: "0 14px", borderRadius: 4, border: "none", background: "#00b06b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Lấy dữ liệu
              </button>
            </div>
          </div>
        </div>

        {/* Body content */}
        <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto" }}>
          {step === 1 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1", color: "#334155", textAlign: "left" }}>
                      <th style={{ width: 36, padding: "8px 10px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={suppliersList.every((s) => s.selected)}
                          onChange={(e) => setSuppliersList((prev) => prev.map((s) => ({ ...s, selected: e.target.checked })))}
                        />
                      </th>
                      <th style={{ width: 100, padding: "8px 10px" }}>Mã NCC</th>
                      <th style={{ padding: "8px 10px" }}>Tên nhà cung cấp</th>
                      <th style={{ width: 160, padding: "8px 10px", textAlign: "right" }}>Số TT chưa đối trừ</th>
                      <th style={{ width: 160, padding: "8px 10px", textAlign: "right" }}>Số công nợ chưa ĐT</th>
                      <th style={{ width: 170, padding: "8px 10px", textAlign: "right" }}>Số tiền đối trừ dự kiến</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliersList.map((s) => (
                      <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9", background: s.selected ? "#f0fdf4" : "transparent" }}>
                        <td style={{ padding: "8px 10px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={s.selected}
                            onChange={(e) => setSuppliersList((prev) => prev.map((item) => (item.id === s.id ? { ...item, selected: e.target.checked } : item)))}
                          />
                        </td>
                        <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{s.code}</td>
                        <td style={{ padding: "8px 10px" }}>{s.name}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatVND(s.unpaidPayment)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatVND(s.unpaidDebt)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: s.expectedOffset > 0 ? "#00b06b" : "#94a3b8" }}>
                          {formatVND(s.expectedOffset)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* FIFO Info Note */}
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "10px 14px", fontSize: 12, color: "#1e40af", display: "flex", alignItems: "center", gap: 10 }}>
                <CheckCircle2 size={18} style={{ color: "#2563eb", flexShrink: 0 }} />
                <span>
                  Hệ thống sẽ tự động đối trừ các chứng từ thanh toán và công nợ của từng đối tượng được chọn theo nguyên tắc <strong>FIFO</strong> (chứng từ phát sinh trước đối trừ trước).
                </span>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                Xác nhận chi tiết đối trừ ({selectedCount} đối tượng được chọn):
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1", color: "#334155", textAlign: "left" }}>
                      <th style={{ width: 100, padding: "8px 10px" }}>Mã NCC</th>
                      <th style={{ padding: "8px 10px" }}>Tên nhà cung cấp</th>
                      <th style={{ width: 180, padding: "8px 10px", textAlign: "right" }}>Số tiền đối trừ</th>
                      <th style={{ width: 140, padding: "8px 10px", textAlign: "center" }}>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliersList
                      .filter((s) => s.selected)
                      .map((s) => (
                        <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{s.code}</td>
                          <td style={{ padding: "8px 10px" }}>{s.name}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#00b06b" }}>
                            {formatVND(s.expectedOffset)} đ
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "center" }}>
                            <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, background: "#dcfce7", color: "#15803d", fontSize: 11, fontWeight: 600 }}>
                              Hợp lệ
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer style={{ height: 50, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
          <div style={{ fontSize: 13, color: "#475569" }}>
            Đã chọn: <strong>{selectedCount}</strong> nhà cung cấp | Tổng dự kiến: <strong style={{ color: "#00b06b" }}>{formatVND(totalOffsetExpected)} đ</strong>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="misa-invoice-btn-cancel" onClick={onClose}>
              Hủy
            </button>
            {step === 2 && (
              <button
                type="button"
                className="misa-invoice-btn-cancel"
                onClick={() => setStep(1)}
              >
                Quay lại
              </button>
            )}
            {step === 1 ? (
              <button
                type="button"
                style={{ height: 32, padding: "0 18px", borderRadius: 4, border: "none", background: "#00b06b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                onClick={() => {
                  if (selectedCount === 0) {
                    alert("Vui lòng chọn ít nhất 1 nhà cung cấp để đối trừ!");
                    return;
                  }
                  setStep(2);
                }}
              >
                Tiếp tục
              </button>
            ) : (
              <button
                type="button"
                style={{ height: 32, padding: "0 18px", borderRadius: 4, border: "none", background: "#00b06b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                onClick={handleFinish}
              >
                Thực hiện đối trừ
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

// ============================================================================
// 3. MODAL: BỎ ĐỐI TRỪ (UnOffsetModal)
// ============================================================================
export interface UnOffsetModalProps {
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

export function UnOffsetModal({ onClose, onSuccess }: UnOffsetModalProps) {
  const [account, setAccount] = useState("331");
  const [supplier, setSupplier] = useState(SAMPLE_SUPPLIERS[0]?.code || "NCC001");
  const [fromDate, setFromDate] = useState("01/01/2026");
  const [toDate, setToDate] = useState("09/10/2026");

  const [records, setRecords] = useState([
    {
      id: "rec-01",
      selected: true,
      offsetDate: "29/09/2026",
      paymentDocNo: "UNC00042",
      debtDocNo: "NK00001",
      amount: 21500000,
      note: "Đối trừ thanh toán mua máy mài góc Tân Phát",
    },
  ]);

  const selectedCount = records.filter((r) => r.selected).length;
  const totalAmount = records.filter((r) => r.selected).reduce((sum, r) => sum + r.amount, 0);

  const handleExecute = () => {
    if (selectedCount === 0) {
      alert("Vui lòng chọn chứng từ cần bỏ đối trừ!");
      return;
    }
    onSuccess?.(`Đã bỏ đối trừ thành công ${selectedCount} chứng từ với số tiền ${formatVND(totalAmount)} đ.`);
    onClose();
  };

  return (
    <div className="misa-modal-backdrop" role="dialog" aria-modal="true">
      <div className="misa-credit-modal-window" style={{ maxWidth: 960, width: "95vw" }}>
        {/* Header */}
        <header className="misa-credit-modal-header" style={{ borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <RotateCcw size={20} style={{ color: "#ef4444" }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111827" }}>
              Bỏ đối trừ chứng từ
            </h2>
          </div>
          <button
            type="button"
            className="misa-invoice-circle-btn"
            onClick={onClose}
            title="Đóng (ESC)"
          >
            <X size={18} />
          </button>
        </header>

        {/* Filter bar */}
        <div style={{ padding: "12px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.8fr 1fr 1fr auto", gap: 12, alignItems: "flex-end" }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                TK phải trả <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                style={{ width: "100%", height: 32, padding: "0 8px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
              >
                <option value="331">331 - Phải trả cho người bán</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Nhà cung cấp <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                style={{ width: "100%", height: 32, padding: "0 8px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
              >
                {SAMPLE_SUPPLIERS.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Từ ngày
              </label>
              <input
                type="text"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{ width: "100%", height: 32, padding: "0 8px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Đến ngày
              </label>
              <input
                type="text"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{ width: "100%", height: 32, padding: "0 8px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
              />
            </div>
            <div>
              <button
                type="button"
                style={{ height: 32, padding: "0 14px", borderRadius: 4, border: "none", background: "#00b06b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Lấy dữ liệu
              </button>
            </div>
          </div>
        </div>

        {/* Table list */}
        <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto" }}>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1", color: "#334155", textAlign: "left" }}>
                  <th style={{ width: 36, padding: "8px 10px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={records.every((r) => r.selected)}
                      onChange={(e) => setRecords((prev) => prev.map((r) => ({ ...r, selected: e.target.checked })))}
                    />
                  </th>
                  <th style={{ width: 100, padding: "8px 10px" }}>Ngày đối trừ</th>
                  <th style={{ width: 120, padding: "8px 10px" }}>Số CT thanh toán</th>
                  <th style={{ width: 120, padding: "8px 10px" }}>Số CT công nợ</th>
                  <th style={{ width: 150, padding: "8px 10px", textAlign: "right" }}>Số tiền đã đối trừ</th>
                  <th style={{ padding: "8px 10px" }}>Diễn giải</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={r.selected}
                        onChange={(e) => setRecords((prev) => prev.map((item) => (item.id === r.id ? { ...item, selected: e.target.checked } : item)))}
                      />
                    </td>
                    <td style={{ padding: "8px 10px" }}>{r.offsetDate}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{r.paymentDocNo}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{r.debtDocNo}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#ef4444" }}>
                      {formatVND(r.amount)} đ
                    </td>
                    <td style={{ padding: "8px 10px", color: "#475569" }}>{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <footer style={{ height: 50, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
          <div style={{ fontSize: 13, color: "#475569" }}>
            Đã chọn: <strong>{selectedCount}</strong> chứng từ | Tổng tiền: <strong style={{ color: "#ef4444" }}>{formatVND(totalAmount)} đ</strong>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="misa-invoice-btn-cancel" onClick={onClose}>
              Đóng
            </button>
            <button
              type="button"
              style={{ height: 32, padding: "0 18px", borderRadius: 4, border: "none", background: "#ef4444", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              onClick={handleExecute}
            >
              Bỏ đối trừ
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ============================================================================
// 4. MODAL: BỎ ĐỐI TRỪ CHỨNG TỪ NHIỀU ĐỐI TƯỢNG (MultiUnOffsetModal)
// ============================================================================
export interface MultiUnOffsetModalProps {
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

export function MultiUnOffsetModal({ onClose, onSuccess }: MultiUnOffsetModalProps) {
  const [account, setAccount] = useState("331");
  const [group, setGroup] = useState("Tất cả");
  const [period, setPeriod] = useState("Tháng này");
  const [fromDate, setFromDate] = useState("01/10/2026");
  const [toDate, setToDate] = useState("09/10/2026");

  const [suppliers, setSuppliers] = useState([
    {
      id: "s-01",
      selected: true,
      code: "NCC001",
      name: "Công ty TNHH Thiết bị Công nghiệp Tân Phát",
      count: 2,
      totalAmount: 35000000,
    },
    {
      id: "s-02",
      selected: false,
      code: "NCC002",
      name: "Công ty Cổ phần Thép Hòa Phát Hưng Yên",
      count: 1,
      totalAmount: 50000000,
    },
  ]);

  const selectedCount = suppliers.filter((s) => s.selected).length;
  const totalAmount = suppliers.filter((s) => s.selected).reduce((sum, s) => sum + s.totalAmount, 0);

  const handleExecute = () => {
    if (selectedCount === 0) {
      alert("Vui lòng chọn ít nhất 1 nhà cung cấp để bỏ đối trừ!");
      return;
    }
    if (confirm(`Bạn có chắc chắn muốn bỏ đối trừ tất cả chứng từ của ${selectedCount} nhà cung cấp đã chọn không?`)) {
      onSuccess?.(`Đã bỏ đối trừ thành công cho ${selectedCount} nhà cung cấp với tổng số tiền ${formatVND(totalAmount)} đ.`);
      onClose();
    }
  };

  return (
    <div className="misa-modal-backdrop" role="dialog" aria-modal="true">
      <div className="misa-credit-modal-window" style={{ maxWidth: 960, width: "95vw" }}>
        {/* Header */}
        <header className="misa-credit-modal-header" style={{ borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <RotateCcw size={20} style={{ color: "#ef4444" }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111827" }}>
              Bỏ đối trừ chứng từ nhiều đối tượng
            </h2>
          </div>
          <button
            type="button"
            className="misa-invoice-circle-btn"
            onClick={onClose}
            title="Đóng (ESC)"
          >
            <X size={18} />
          </button>
        </header>

        {/* Filter bar */}
        <div style={{ padding: "12px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr 1fr 1fr auto", gap: 12, alignItems: "flex-end" }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                TK phải trả
              </label>
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                style={{ width: "100%", height: 32, padding: "0 8px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
              >
                <option value="331">331 - Phải trả cho người bán</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Nhóm nhà cung cấp
              </label>
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                style={{ width: "100%", height: 32, padding: "0 8px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
              >
                <option value="Tất cả">Tất cả nhóm</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Kỳ
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                style={{ width: "100%", height: 32, padding: "0 8px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
              >
                <option value="Tháng này">Tháng này</option>
                <option value="Quý này">Quý này</option>
                <option value="Năm nay">Năm nay</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Từ ngày
              </label>
              <input
                type="text"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{ width: "100%", height: 32, padding: "0 8px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Đến ngày
              </label>
              <input
                type="text"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{ width: "100%", height: 32, padding: "0 8px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
              />
            </div>
            <div>
              <button
                type="button"
                style={{ height: 32, padding: "0 14px", borderRadius: 4, border: "none", background: "#00b06b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Lấy dữ liệu
              </button>
            </div>
          </div>
        </div>

        {/* Body content */}
        <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Warning banner */}
          <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 6, padding: "10px 14px", fontSize: 12, color: "#92400e", display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={18} style={{ color: "#d97706", flexShrink: 0 }} />
            <span>
              Hệ thống sẽ hủy bỏ tất cả các liên kết đối trừ công nợ của các nhà cung cấp được chọn trong khoảng thời gian đã lọc.
            </span>
          </div>

          <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1", color: "#334155", textAlign: "left" }}>
                  <th style={{ width: 36, padding: "8px 10px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={suppliers.every((s) => s.selected)}
                      onChange={(e) => setSuppliers((prev) => prev.map((s) => ({ ...s, selected: e.target.checked })))}
                    />
                  </th>
                  <th style={{ width: 110, padding: "8px 10px" }}>Mã NCC</th>
                  <th style={{ padding: "8px 10px" }}>Tên nhà cung cấp</th>
                  <th style={{ width: 140, padding: "8px 10px", textAlign: "center" }}>Số lần đối trừ</th>
                  <th style={{ width: 180, padding: "8px 10px", textAlign: "right" }}>Tổng tiền đã đối trừ</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9", background: s.selected ? "#fef2f2" : "transparent" }}>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={s.selected}
                        onChange={(e) => setSuppliers((prev) => prev.map((item) => (item.id === s.id ? { ...item, selected: e.target.checked } : item)))}
                      />
                    </td>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{s.code}</td>
                    <td style={{ padding: "8px 10px" }}>{s.name}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600 }}>{s.count}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#ef4444" }}>
                      {formatVND(s.totalAmount)} đ
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <footer style={{ height: 50, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
          <div style={{ fontSize: 13, color: "#475569" }}>
            Đã chọn: <strong>{selectedCount}</strong> đối tượng | Tổng tiền: <strong style={{ color: "#ef4444" }}>{formatVND(totalAmount)} đ</strong>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="misa-invoice-btn-cancel" onClick={onClose}>
              Hủy
            </button>
            <button
              type="button"
              style={{ height: 32, padding: "0 18px", borderRadius: 4, border: "none", background: "#ef4444", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              onClick={handleExecute}
            >
              Thực hiện bỏ đối trừ
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ============================================================================
// 5. MODAL: BÙ TRỪ CÔNG NỢ (DebtClearingModal)
// ============================================================================
export interface DebtClearingModalProps {
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

export function DebtClearingModal({ onClose, onSuccess }: DebtClearingModalProps) {
  const [partner, setPartner] = useState("KH-NCC-001 - Công ty CP Tập đoàn Hoàng Hà");
  const [clearDate, setClearDate] = useState("09/10/2026");
  const [receivableAccount, setReceivableAccount] = useState("131");
  const [payableAccount, setPayableAccount] = useState("331");

  // Danh sách chứng từ phải thu (bán hàng cho họ)
  const [receivableDocs, setReceivableDocs] = useState([
    {
      id: "rec-01",
      selected: true,
      docDate: "25/09/2026",
      docNo: "BH00015",
      desc: "Xuất bán thiết bị công nghiệp theo hợp đồng",
      amount: 45000000,
      clearingAmount: 32000000,
    },
  ]);

  // Danh sách chứng từ phải trả (mua hàng của họ)
  const [payableDocs, setPayableDocs] = useState([
    {
      id: "pay-01",
      selected: true,
      docDate: "28/09/2026",
      docNo: "NK00003",
      desc: "Mua nguyên vật liệu sắt thép phục vụ dự án",
      amount: 32000000,
      clearingAmount: 32000000,
    },
  ]);

  const totalReceivable = receivableDocs.filter((d) => d.selected).reduce((sum, d) => sum + d.clearingAmount, 0);
  const totalPayable = payableDocs.filter((d) => d.selected).reduce((sum, d) => sum + d.clearingAmount, 0);
  const clearingValue = Math.min(totalReceivable, totalPayable);
  const diffValue = Math.abs(totalReceivable - totalPayable);

  const handleExecute = () => {
    if (clearingValue <= 0) {
      alert("Vui lòng nhập số tiền bù trừ lớn hơn 0!");
      return;
    }
    onSuccess?.(`Đã bù trừ công nợ thành công số tiền ${formatVND(clearingValue)} đ giữa TK 131 và TK 331.`);
    onClose();
  };

  return (
    <div className="misa-modal-backdrop" role="dialog" aria-modal="true">
      <div className="misa-credit-modal-window" style={{ maxWidth: 1100, width: "96vw" }}>
        {/* Header */}
        <header className="misa-credit-modal-header" style={{ borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ArrowRightLeft size={20} style={{ color: "#00b06b" }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111827" }}>
              Bù trừ công nợ
            </h2>
          </div>
          <button
            type="button"
            className="misa-invoice-circle-btn"
            onClick={onClose}
            title="Đóng (ESC)"
          >
            <X size={18} />
          </button>
        </header>

        {/* Master Filters */}
        <div style={{ padding: "12px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1fr 1fr auto", gap: 12, alignItems: "flex-end" }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Đối tượng bù trừ (Khách hàng kiêm NCC) <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={partner}
                onChange={(e) => setPartner(e.target.value)}
                style={{ width: "100%", height: 32, padding: "0 8px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13, background: "#fff" }}
              >
                <option value="KH-NCC-001 - Công ty CP Tập đoàn Hoàng Hà">KH-NCC-001 - Công ty CP Tập đoàn Hoàng Hà</option>
                <option value="KH-NCC-002 - Công ty TNHH Đầu tư Thương mại Sao Mai">KH-NCC-002 - Công ty TNHH Đầu tư Thương mại Sao Mai</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Ngày bù trừ <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                value={clearDate}
                onChange={(e) => setClearDate(e.target.value)}
                style={{ width: "100%", height: 32, padding: "0 8px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                TK phải thu <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={receivableAccount}
                onChange={(e) => setReceivableAccount(e.target.value)}
                style={{ width: "100%", height: 32, padding: "0 8px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
              >
                <option value="131">131 - Phải thu của khách hàng</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                TK phải trả <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={payableAccount}
                onChange={(e) => setPayableAccount(e.target.value)}
                style={{ width: "100%", height: 32, padding: "0 8px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
              >
                <option value="331">331 - Phải trả cho người bán</option>
              </select>
            </div>
            <div>
              <button
                type="button"
                style={{ height: 32, padding: "0 14px", borderRadius: 4, border: "none", background: "#00b06b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Lấy dữ liệu
              </button>
            </div>
          </div>
        </div>

        {/* 2 Tables */}
        <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Table 1: Chứng từ phải thu */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>
              1. Chứng từ phải thu (TK 131)
            </div>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#334155", textAlign: "left" }}>
                    <th style={{ width: 36, padding: "8px", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={receivableDocs.every((d) => d.selected)}
                        onChange={(e) => setReceivableDocs((prev) => prev.map((d) => ({ ...d, selected: e.target.checked })))}
                      />
                    </th>
                    <th style={{ width: 100, padding: "8px" }}>Ngày CT</th>
                    <th style={{ width: 110, padding: "8px" }}>Số CT</th>
                    <th style={{ padding: "8px" }}>Diễn giải</th>
                    <th style={{ width: 140, padding: "8px", textAlign: "right" }}>Số phải thu</th>
                    <th style={{ width: 140, padding: "8px", textAlign: "right" }}>Số bù trừ</th>
                  </tr>
                </thead>
                <tbody>
                  {receivableDocs.map((doc) => (
                    <tr key={doc.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={doc.selected}
                          onChange={(e) => setReceivableDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, selected: e.target.checked } : d)))}
                        />
                      </td>
                      <td style={{ padding: "6px 8px" }}>{doc.docDate}</td>
                      <td style={{ padding: "6px 8px", fontWeight: 600, color: "#0284c7" }}>{doc.docNo}</td>
                      <td style={{ padding: "6px 8px" }}>{doc.desc}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>{formatVND(doc.amount)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>
                        <input
                          type="number"
                          value={doc.clearingAmount}
                          onChange={(e) => {
                            const val = parseInt(e.target.value || "0", 10);
                            setReceivableDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, clearingAmount: val, selected: val > 0 } : d)));
                          }}
                          style={{ width: 120, height: 26, padding: "0 6px", border: "1px solid #d1d5db", borderRadius: 4, textAlign: "right", fontWeight: 600 }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 2: Chứng từ phải trả */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>
              2. Chứng từ phải trả (TK 331)
            </div>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#334155", textAlign: "left" }}>
                    <th style={{ width: 36, padding: "8px", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={payableDocs.every((d) => d.selected)}
                        onChange={(e) => setPayableDocs((prev) => prev.map((d) => ({ ...d, selected: e.target.checked })))}
                      />
                    </th>
                    <th style={{ width: 100, padding: "8px" }}>Ngày CT</th>
                    <th style={{ width: 110, padding: "8px" }}>Số CT</th>
                    <th style={{ padding: "8px" }}>Diễn giải</th>
                    <th style={{ width: 140, padding: "8px", textAlign: "right" }}>Số phải trả</th>
                    <th style={{ width: 140, padding: "8px", textAlign: "right" }}>Số bù trừ</th>
                  </tr>
                </thead>
                <tbody>
                  {payableDocs.map((doc) => (
                    <tr key={doc.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={doc.selected}
                          onChange={(e) => setPayableDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, selected: e.target.checked } : d)))}
                        />
                      </td>
                      <td style={{ padding: "6px 8px" }}>{doc.docDate}</td>
                      <td style={{ padding: "6px 8px", fontWeight: 600, color: "#0284c7" }}>{doc.docNo}</td>
                      <td style={{ padding: "6px 8px" }}>{doc.desc}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>{formatVND(doc.amount)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>
                        <input
                          type="number"
                          value={doc.clearingAmount}
                          onChange={(e) => {
                            const val = parseInt(e.target.value || "0", 10);
                            setPayableDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, clearingAmount: val, selected: val > 0 } : d)));
                          }}
                          style={{ width: 120, height: 26, padding: "0 6px", border: "1px solid #d1d5db", borderRadius: 4, textAlign: "right", fontWeight: 600 }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer style={{ height: 50, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
          <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#475569" }}>
            <span>Phải thu bù trừ: <strong>{formatVND(totalReceivable)} đ</strong></span>
            <span>|</span>
            <span>Phải trả bù trừ: <strong>{formatVND(totalPayable)} đ</strong></span>
            {diffValue > 0 && (
              <>
                <span>|</span>
                <span style={{ color: "#d97706" }}>Chênh lệch: <strong>{formatVND(diffValue)} đ</strong></span>
              </>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 13, color: "#475569" }}>Số tiền bù trừ:</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#00b06b" }}>
                {formatVND(clearingValue)} đ
              </span>
            </div>
            <button type="button" className="misa-invoice-btn-cancel" onClick={onClose}>
              Hủy
            </button>
            <button
              type="button"
              style={{ height: 32, padding: "0 20px", borderRadius: 4, border: "none", background: "#00b06b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              onClick={handleExecute}
            >
              Bù trừ
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
