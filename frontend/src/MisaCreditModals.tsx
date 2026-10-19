import VoucherDateField from "./VoucherDateField";
import {SupplierModal} from "./MisaPurchaseModals";
import MisaDirectoryWorkspace from "./MisaDirectoryWorkspace";
import { useState } from "react";
import {
  X,
  HelpCircle,
  ChevronDown,
  Sparkles,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

export function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount);
}

// ============================================================================
// 1. MODAL: KHẾ ƯỚC CHO VAY (MATCHING IMAGE 1)
// ============================================================================
export interface LoanContractModalProps {
  onClose: () => void;
  onSubmit: (data: any) => boolean | void | Promise<boolean | void>;
  onOpenCreditContract?: () => void;
}

export function LoanContractModal({
  onClose,
  onSubmit,
  onOpenCreditContract,
}: LoanContractModalProps) {
  // Master fields
  const [contractCode, setContractCode] = useState("KUCV00001");
  const [borrower, setBorrower] = useState("Công ty TNHH Đầu tư Thương mại Sao Mai");
  const [creditContract, setCreditContract] = useState("");
  const [purpose, setPurpose] = useState("Bổ sung vốn lưu động phục vụ SXKD");
  const [debitAccount, setDebitAccount] = useState("1283");
  const [creditInterestAccount, setCreditInterestAccount] = useState("515");

  // Tab state
  const [activeTab, setActiveTab] = useState<
    "disbursement" | "interest" | "recovery" | "stats" | "attachment"
  >("disbursement");

  // Tab 1: Thông tin giải ngân (5 ô tiền + chi tiết)
  const [loanAmount, setLoanAmount] = useState(500000000);
  const [disbursedAmount, setDisbursedAmount] = useState(500000000);
  const [recoveredPrincipal, setRecoveredPrincipal] = useState(0);
  const [recoveredInterest, setRecoveredInterest] = useState(0);
  const currentDebt = Math.max(0, disbursedAmount - recoveredPrincipal);

  const [disbursementMethod, setDisbursementMethod] = useState("Chuyển khoản");
  const [beneficiaryAccount, setBeneficiaryAccount] = useState("2151000849201");
  const [bankName, setBankName] = useState("BIDV - Ngân hàng TMCP Đầu tư và Phát triển VN");
  const [loanTerm, setLoanTerm] = useState(12);
  const [termUnit, setTermUnit] = useState("Tháng");
  const [disbursementDate, setDisbursementDate] = useState("09/10/2026");
  const [dueDate, setDueDate] = useState("09/10/2027");

  // Tab 2: Lãi suất (Grid + Radio options)
  const [interestBasis, setInterestBasis] = useState("Lãi suất trên dư nợ gốc");
  const [yearDaysBasis, setYearDaysBasis] = useState("365");
  const [hasAdjustment, setHasAdjustment] = useState(false);
  const [interestRows, setInterestRows] = useState([
    { id: 1, rate: 8.5, overdueRate: 150, effectiveDate: "09/10/2026", note: "Lãi suất cố định 12 tháng đầu" },
  ]);

  // Tab 3: Hình thức thu nợ
  const [principalPeriod, setPrincipalPeriod] = useState("Hàng tháng");
  const [interestPeriod, setInterestPeriod] = useState("Hàng tháng");
  const [collectionMethod, setCollectionMethod] = useState("Nộp vào tài khoản");
  const [firstPrincipalDate, setFirstPrincipalDate] = useState("09/11/2026");
  const [firstInterestDate, setFirstInterestDate] = useState("09/11/2026");
  const [collectionAccount, setCollectionAccount] = useState("1028475929 - VCB");
  const [collectionBankName, setCollectionBankName] = useState("Vietcombank - CN Hà Nội");

  // Tab 4: Thống kê khác
  const [project, setProject] = useState("");
  const [order, setOrder] = useState("");
  const [saleContract, setSaleContract] = useState("");
  const [expenseItem, setExpenseItem] = useState("");
  const [cashFlowItem, setCashFlowItem] = useState("");
  const [department, setDepartment] = useState("Phòng Kế toán - Tài chính");

  // Tab 5: Đính kèm
  const [quickParty,setQuickParty]=useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const [attachments, setAttachments] = useState<{ name: string; size: string; time: string }[]>([
    { name: "KHE_UOC_CHO_VAY_KUCV00001.pdf", size: "1.4 MB", time: "09/10/2026 10:15" },
  ]);

  // Dropdown menu for Cất và Đóng
  const [showSaveDropdown, setShowSaveDropdown] = useState(false);

  const handleAddInterestRow = () => {
    setInterestRows((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        rate: 9.0,
        overdueRate: 150,
        effectiveDate: "09/10/2027",
        note: "Điều chỉnh theo lãi suất thị trường",
      },
    ]);
  };

  const handleClearInterestRows = () => {
    setInterestRows([]);
  };

  const handleRemoveInterestRow = (id: number) => {
    setInterestRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      e.target.value = "";
      if (f.size > 5 * 1024 * 1024) {
        setAttachmentError("Dung lượng tệp không được vượt quá 5 MB.");
        return;
      }
      setAttachmentError("");
      setAttachments((prev) => [
        ...prev,
        {
          name: f.name,
          size: `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
          time: new Date().toLocaleString("vi-VN"),
        },
      ]);
    }
  };

  const handleSave = async (andClose = false) => {
    const saved = await onSubmit({
      kind: "loan",
      code: contractCode,
      borrower,
      creditContract,
      purpose,
      debitAccount,
      creditInterestAccount,
      loanAmount,
      disbursedAmount,
      recoveredPrincipal,
      recoveredInterest,
      currentDebt,
      disbursementMethod,
      beneficiaryAccount,
      bankName,
      loanTerm,
      termUnit,
      disbursementDate,
      dueDate,
      interestBasis,
      yearDaysBasis,
      hasAdjustment,
      interestRows,
      principalPeriod,
      interestPeriod,
      collectionMethod,
      firstPrincipalDate,
      firstInterestDate,
      collectionAccount,
      collectionBankName,
      project,
      order,
      saleContract,
      expenseItem,
      cashFlowItem,
      department,
      attachments,
    });
    if (saved === false) return;
    if (andClose) onClose();
  };

  return (
    <div className="misa-modal-backdrop" role="dialog" aria-modal="true">
      <div className="misa-credit-modal-window" style={{ maxWidth: 960, width: "95vw" }}>
        {/* Header */}
        <header className="misa-credit-modal-header" style={{ borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111827" }}>
              Khế ước cho vay đầu kỳ {contractCode}
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="misa-invoice-circle-btn"
              title="Trợ giúp"
              onClick={() => alert("Hướng dẫn quản lý khế ước cho vay đầu kỳ")}
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

        {/* Master Form Area */}
        <div style={{ padding: "14px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          {/* Row 1 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 16, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Số khế ước cho vay <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                value={contractCode}
                onChange={(e) => setContractCode(e.target.value)}
                style={{
                  width: "100%",
                  height: 32,
                  padding: "0 10px",
                  borderRadius: 4,
                  border: "1px solid #10b981",
                  fontSize: 13,
                  fontWeight: 600,
                  outline: "none",
                  background: "#ffffff",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Đối tượng vay <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div style={{ display: "flex", gap: 4 }}>
                <select
                  value={borrower}
                  onChange={(e) => setBorrower(e.target.value)}
                  style={{
                    flex: 1,
                    height: 32,
                    padding: "0 10px",
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    fontSize: 13,
                    background: "#ffffff",
                  }}
                >
                  <option value="">-- Chọn đối tượng vay --</option>
                  <option value="Công ty TNHH Đầu tư Thương mại Sao Mai">Công ty TNHH Đầu tư Thương mại Sao Mai</option>
                  <option value="Công ty CP Xây dựng Đông Dương">Công ty CP Xây dựng Đông Dương</option>
                  <option value="Công ty CP Tập đoàn Hoàng Hà">Công ty CP Tập đoàn Hoàng Hà</option>
                  <option value="Công ty TNHH Dịch vụ Vận tải Hải Đăng">Công ty TNHH Dịch vụ Vận tải Hải Đăng</option>
                </select>
                <button
                  type="button"
                  title="Thêm đối tượng"
                  onClick={() => setQuickParty(true)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                    color: "#059669",
                  }}
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Row 2 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 16, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Hợp đồng tín dụng
              </label>
              <div style={{ display: "flex", gap: 4 }}>
                <select
                  value={creditContract}
                  onChange={(e) => setCreditContract(e.target.value)}
                  style={{
                    flex: 1,
                    height: 32,
                    padding: "0 10px",
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    fontSize: 13,
                    background: "#ffffff",
                  }}
                >
                  <option value="">-- Chọn hợp đồng tín dụng --</option>
                  <option value="HĐTD00001 - Hợp đồng tài trợ dự án">HĐTD00001 - Hợp đồng tài trợ dự án</option>
                  <option value="HĐTD00002 - Hợp đồng cấp hạn mức vốn lưu động">HĐTD00002 - Hợp đồng cấp hạn mức vốn lưu động</option>
                </select>
                <button
                  type="button"
                  onClick={onOpenCreditContract}
                  title="Thêm hợp đồng tín dụng cho vay"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                    color: "#059669",
                  }}
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Mục đích vay
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Nhập mục đích vay hoặc dùng AI gợi ý..."
                  style={{
                    width: "100%",
                    height: 32,
                    padding: "0 34px 0 10px",
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    fontSize: 13,
                    background: "#ffffff",
                  }}
                />
                <button
                  type="button"
                  title="Gợi ý bằng AI"
                  onClick={() => setPurpose("Bổ sung vốn lưu động phục vụ hoạt động sản xuất kinh doanh")}
                  style={{
                    position: "absolute",
                    right: 6,
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "transparent",
                    color: "#8b5cf6",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Sparkles size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Row 3 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                TK hạch toán nợ gốc <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={debitAccount}
                onChange={(e) => setDebitAccount(e.target.value)}
                style={{
                  width: "100%",
                  height: 32,
                  padding: "0 10px",
                  borderRadius: 4,
                  border: "1px solid #d1d5db",
                  fontSize: 13,
                  background: "#ffffff",
                }}
              >
                <option value="1283">1283 - Cho vay</option>
                <option value="1288">1288 - Các khoản đầu tư nắm giữ đến ngày đáo hạn khác</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                TK hạch toán lãi vay <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={creditInterestAccount}
                onChange={(e) => setCreditInterestAccount(e.target.value)}
                style={{
                  width: "100%",
                  height: 32,
                  padding: "0 10px",
                  borderRadius: 4,
                  border: "1px solid #d1d5db",
                  fontSize: 13,
                  background: "#ffffff",
                }}
              >
                <option value="515">515 - Doanh thu hoạt động tài chính</option>
                <option value="3387">3387 - Doanh thu chưa thực hiện</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sub-tabs Navigation */}
        <div style={{ display: "flex", gap: 2, background: "#f1f5f9", padding: "4px 16px 0 16px", borderBottom: "1px solid #cbd5e1" }}>
          {[
            { id: "disbursement", label: "Thông tin giải ngân" },
            { id: "interest", label: "Lãi suất" },
            { id: "recovery", label: "Hình thức thu nợ" },
            { id: "stats", label: "Thống kê khác" },
            { id: "attachment", label: "Đính kèm" },
          ].map((tb) => (
            <button
              key={tb.id}
              type="button"
              onClick={() => setActiveTab(tb.id as any)}
              style={{
                padding: "8px 16px",
                border: "none",
                background: activeTab === tb.id ? "#ffffff" : "transparent",
                color: activeTab === tb.id ? "#059669" : "#475569",
                fontWeight: activeTab === tb.id ? 600 : 500,
                fontSize: 13,
                borderRadius: "4px 4px 0 0",
                borderBottom: activeTab === tb.id ? "2px solid #059669" : "2px solid transparent",
                cursor: "pointer",
              }}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {/* Tab Body Content */}
        <div style={{ flex: 1, padding: "18px 20px", overflowY: "auto", background: "#ffffff", minHeight: 280 }}>
          {/* TAB 1: THÔNG TIN GIẢI NGÂN (Hình ảnh 1 đầy đủ 5 ô tiền) */}
          {activeTab === "disbursement" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* 5 Card/Ô số tiền: Giá trị khoản vay | Đã giải ngân | Nợ gốc đã thu | Lãi đã thu | Dư nợ hiện tại */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                    Giá trị khoản vay <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={loanAmount === 0 ? "0" : formatVND(loanAmount)}
                    onChange={(e) => {
                      const val = parseInt(e.target.value.replace(/\D/g, "") || "0", 10);
                      setLoanAmount(val);
                      setDisbursedAmount(val);
                    }}
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 8px",
                      borderRadius: 4,
                      border: "1px solid #d1d5db",
                      fontSize: 13,
                      textAlign: "right",
                      fontWeight: 600,
                      color: "#059669",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                    Giá trị đã giải ngân
                  </label>
                  <input
                    type="text"
                    value={disbursedAmount === 0 ? "0" : formatVND(disbursedAmount)}
                    onChange={(e) => setDisbursedAmount(parseInt(e.target.value.replace(/\D/g, "") || "0", 10))}
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 8px",
                      borderRadius: 4,
                      border: "1px solid #d1d5db",
                      fontSize: 13,
                      textAlign: "right",
                      fontWeight: 600,
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                    Nợ gốc đã thu
                  </label>
                  <input
                    type="text"
                    value={recoveredPrincipal === 0 ? "0" : formatVND(recoveredPrincipal)}
                    onChange={(e) => setRecoveredPrincipal(parseInt(e.target.value.replace(/\D/g, "") || "0", 10))}
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 8px",
                      borderRadius: 4,
                      border: "1px solid #d1d5db",
                      fontSize: 13,
                      textAlign: "right",
                      fontWeight: 600,
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                    Lãi đã thu
                  </label>
                  <input
                    type="text"
                    value={recoveredInterest === 0 ? "0" : formatVND(recoveredInterest)}
                    onChange={(e) => setRecoveredInterest(parseInt(e.target.value.replace(/\D/g, "") || "0", 10))}
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 8px",
                      borderRadius: 4,
                      border: "1px solid #d1d5db",
                      fontSize: 13,
                      textAlign: "right",
                      fontWeight: 600,
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                    Dư nợ hiện tại
                  </label>
                  <input
                    type="text"
                    value={currentDebt === 0 ? "0" : formatVND(currentDebt)}
                    readOnly
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 8px",
                      borderRadius: 4,
                      border: "1px solid #e2e8f0",
                      background: "#f1f5f9",
                      fontSize: 13,
                      textAlign: "right",
                      fontWeight: 700,
                      color: "#dc2626",
                    }}
                  />
                </div>
              </div>

              {/* Row 2: Phương thức giải ngân, TK thụ hưởng, Tên ngân hàng */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1.5fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    Phương thức giải ngân <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    value={disbursementMethod}
                    onChange={(e) => setDisbursementMethod(e.target.value)}
                    style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                  >
                    <option value="Chuyển khoản">Chuyển khoản</option>
                    <option value="Tiền mặt">Tiền mặt</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    TK thụ hưởng
                  </label>
                  <select
                    value={beneficiaryAccount}
                    onChange={(e) => {
                      setBeneficiaryAccount(e.target.value);
                      if (e.target.value.includes("2151")) setBankName("BIDV - Ngân hàng TMCP Đầu tư và Phát triển VN");
                      else if (e.target.value.includes("1028")) setBankName("Vietcombank - Ngân hàng TMCP Ngoại thương VN");
                      else setBankName("");
                    }}
                    style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                  >
                    <option value="">&nbsp;</option>
                    <option value="2151000849201">2151000849201 - BIDV</option>
                    <option value="1028475929">1028475929 - VCB</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    Tên ngân hàng
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    readOnly
                    placeholder="Tên ngân hàng thụ hưởng"
                    style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: 13, color: "#475569" }}
                  />
                </div>
              </div>

              {/* Row 3: Thời hạn vay, Ngày giải ngân, Ngày đáo hạn */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    Thời hạn vay <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      type="number"
                      value={loanTerm}
                      onChange={(e) => setLoanTerm(parseInt(e.target.value || "0", 10))}
                      style={{ width: 80, height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13, textAlign: "right" }}
                    />
                    <select
                      value={termUnit}
                      onChange={(e) => setTermUnit(e.target.value)}
                      style={{ flex: 1, height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                    >
                      <option value="Tháng">Tháng</option>
                      <option value="Năm">Năm</option>
                      <option value="Ngày">Ngày</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    Ngày giải ngân <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <VoucherDateField value={disbursementDate} onChange={setDisbursementDate} label="Ngày giải ngân"/>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    Ngày đáo hạn <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <VoucherDateField value={dueDate} onChange={setDueDate} label="Ngày đáo hạn"/>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LÃI SUẤT (Grid table + Options) */}
          {activeTab === "interest" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Radio options */}
              <div style={{ display: "flex", alignItems: "center", gap: 24, padding: "8px 12px", background: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", color: "#374151" }}>
                  <input
                    type="radio"
                    name="interestBasis"
                    checked={interestBasis === "Lãi suất trên dư nợ gốc"}
                    onChange={() => setInterestBasis("Lãi suất trên dư nợ gốc")}
                  />
                  <span>Lãi suất trên dư nợ gốc</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", color: "#374151" }}>
                  <input
                    type="radio"
                    name="interestBasis"
                    checked={interestBasis === "Lãi suất trên dư nợ thực tế"}
                    onChange={() => setInterestBasis("Lãi suất trên dư nợ thực tế")}
                  />
                  <span>Lãi suất trên dư nợ thực tế</span>
                </label>
                <div style={{ width: 1, height: 18, background: "#cbd5e1" }} />
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", color: "#374151" }}>
                  <input
                    type="radio"
                    name="yearDaysBasis"
                    checked={yearDaysBasis === "365"}
                    onChange={() => setYearDaysBasis("365")}
                  />
                  <span>Lãi năm / 365 ngày</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", color: "#374151" }}>
                  <input
                    type="checkbox"
                    checked={hasAdjustment}
                    onChange={(e) => setHasAdjustment(e.target.checked)}
                  />
                  <span>Có điều chỉnh lãi suất</span>
                </label>
              </div>

              {/* Grid Header Buttons */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                  Bảng mức lãi suất theo từng giai đoạn
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleAddInterestRow}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 10px",
                      borderRadius: 4,
                      border: "1px solid #10b981",
                      background: "#ecfdf5",
                      color: "#059669",
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={14} />
                    <span>Thêm dòng</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearInterestRows}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 10px",
                      borderRadius: 4,
                      border: "1px solid #e2e8f0",
                      background: "#ffffff",
                      color: "#ef4444",
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={14} />
                    <span>Xóa hết dòng</span>
                  </button>
                </div>
              </div>

              {/* Grid Table */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", textAlign: "left" }}>
                      <th style={{ width: 40, padding: "8px 10px", textAlign: "center" }}>#</th>
                      <th style={{ width: 140, padding: "8px 10px" }}>Lãi suất %/năm</th>
                      <th style={{ width: 160, padding: "8px 10px" }}>Lãi suất quá hạn %</th>
                      <th style={{ width: 140, padding: "8px 10px" }}>Hiệu lực từ ngày</th>
                      <th style={{ padding: "8px 10px" }}>Ghi chú</th>
                      <th style={{ width: 50, padding: "8px 10px", textAlign: "center" }}>Xóa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interestRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "#94a3b8" }}>
                          Chưa có thông tin lãi suất. Bấm "Thêm dòng" để thiết lập.
                        </td>
                      </tr>
                    ) : (
                      interestRows.map((r, idx) => (
                        <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "6px 10px", textAlign: "center", color: "#64748b" }}>{idx + 1}</td>
                          <td style={{ padding: "6px 10px" }}>
                            <input
                              type="number"
                              step="0.1"
                              value={r.rate}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value || "0");
                                setInterestRows((prev) => prev.map((item) => (item.id === r.id ? { ...item, rate: val } : item)));
                              }}
                              style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #d1d5db", borderRadius: 4, textAlign: "right" }}
                            />
                          </td>
                          <td style={{ padding: "6px 10px" }}>
                            <input
                              type="number"
                              value={r.overdueRate}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value || "0");
                                setInterestRows((prev) => prev.map((item) => (item.id === r.id ? { ...item, overdueRate: val } : item)));
                              }}
                              style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #d1d5db", borderRadius: 4, textAlign: "right" }}
                            />
                          </td>
                          <td style={{ padding: "6px 10px" }}>
                            <input
                              type="text"
                              value={r.effectiveDate}
                              onChange={(e) => {
                                const val = e.target.value;
                                setInterestRows((prev) => prev.map((item) => (item.id === r.id ? { ...item, effectiveDate: val } : item)));
                              }}
                              style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #d1d5db", borderRadius: 4 }}
                            />
                          </td>
                          <td style={{ padding: "6px 10px" }}>
                            <input
                              type="text"
                              value={r.note}
                              onChange={(e) => {
                                const val = e.target.value;
                                setInterestRows((prev) => prev.map((item) => (item.id === r.id ? { ...item, note: val } : item)));
                              }}
                              placeholder="Nhập ghi chú điều chỉnh..."
                              style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #d1d5db", borderRadius: 4 }}
                            />
                          </td>
                          <td style={{ padding: "6px 10px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveInterestRow(r.id)}
                              style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
                              title="Xóa dòng"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: HÌNH THỨC THU NỢ */}
          {activeTab === "recovery" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 720 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    Thu gốc <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    value={principalPeriod}
                    onChange={(e) => setPrincipalPeriod(e.target.value)}
                    style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                  >
                    <option value="Hàng tháng">Hàng tháng</option>
                    <option value="Hàng quý">Hàng quý</option>
                    <option value="Hàng năm">Hàng năm</option>
                    <option value="Cuối kỳ">Cuối kỳ</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    Thu lãi <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    value={interestPeriod}
                    onChange={(e) => setInterestPeriod(e.target.value)}
                    style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                  >
                    <option value="Hàng tháng">Hàng tháng</option>
                    <option value="Hàng quý">Hàng quý</option>
                    <option value="Cùng kỳ thu gốc">Cùng kỳ thu gốc</option>
                    <option value="Cuối kỳ">Cuối kỳ</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    Phương thức thu nợ <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    value={collectionMethod}
                    onChange={(e) => setCollectionMethod(e.target.value)}
                    style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                  >
                    <option value="Nộp vào tài khoản">Nộp vào tài khoản</option>
                    <option value="Tiền mặt">Tiền mặt</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    Ngày thu gốc đầu tiên <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <VoucherDateField value={firstPrincipalDate} onChange={setFirstPrincipalDate} label="Ngày trả nợ gốc đầu tiên"/>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    Ngày thu lãi đầu tiên <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <VoucherDateField value={firstInterestDate} onChange={setFirstInterestDate} label="Ngày trả lãi đầu tiên"/>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    Chuyển vào tài khoản
                  </label>
                  <select
                    value={collectionAccount}
                    onChange={(e) => {
                      setCollectionAccount(e.target.value);
                      if (e.target.value.includes("VCB")) setCollectionBankName("Vietcombank - CN Hà Nội");
                      else if (e.target.value.includes("BIDV")) setCollectionBankName("BIDV - CN Quang Trung");
                    }}
                    style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                  >
                    <option value="1028475929 - VCB">1028475929 - VCB</option>
                    <option value="2151000849201 - BIDV">2151000849201 - BIDV</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    Tên ngân hàng
                  </label>
                  <input
                    type="text"
                    value={collectionBankName}
                    readOnly
                    style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: 13, color: "#475569" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: THỐNG KÊ KHÁC */}
          {activeTab === "stats" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 720 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                  Công trình
                </label>
                <input
                  type="text"
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  placeholder="Chọn hoặc nhập mã công trình..."
                  style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                  Đơn đặt hàng
                </label>
                <input
                  type="text"
                  value={order}
                  onChange={(e) => setOrder(e.target.value)}
                  placeholder="Chọn đơn đặt hàng liên quan..."
                  style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                  Hợp đồng bán
                </label>
                <input
                  type="text"
                  value={saleContract}
                  onChange={(e) => setSaleContract(e.target.value)}
                  placeholder="Chọn hợp đồng bán..."
                  style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                  Khoản mục chi phí
                </label>
                <input
                  type="text"
                  value={expenseItem}
                  onChange={(e) => setExpenseItem(e.target.value)}
                  placeholder="Chọn khoản mục chi phí..."
                  style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                  Mục thu/chi
                </label>
                <input
                  type="text"
                  value={cashFlowItem}
                  onChange={(e) => setCashFlowItem(e.target.value)}
                  placeholder="Chọn mục thu chi dòng tiền..."
                  style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                  Đơn vị / Phòng ban
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Phòng Kế toán - Tài chính"
                  style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>
            </div>
          )}

          {/* TAB 5: ĐÍNH KÈM */}
          {quickParty&&<div style={{position:"fixed",inset:0,zIndex:11000,background:"transparent",overflow:"auto"}}><button style={{position:"fixed",right:16,top:12,zIndex:12000}} onClick={()=>setQuickParty(false)}>Đóng thêm đối tượng</button><MisaDirectoryWorkspace initialName="Khách hàng" initialCreate legacy={null} notify={()=>{}} onEditorClose={()=>setQuickParty(false)} onEntrySaved={values=>{setBorrower(values["Tên khách hàng"]||values["Tên"]||"");setQuickParty(false);}}/></div>}
          {activeTab === "attachment" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                style={{
                  border: "2px dashed #cbd5e1",
                  borderRadius: 8,
                  padding: "24px 20px",
                  textAlign: "center",
                  background: "#f8fafc",
                  cursor: "pointer",
                }}
                onClick={() => document.getElementById("file-upload-loan")?.click()}
              >
                <Upload size={32} style={{ color: "#059669", margin: "0 auto 8px auto" }} />
                <div style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
                  Kéo thả tài liệu khế ước cho vay hoặc <span style={{ color: "#0284c7", textDecoration: "underline" }}>chọn tệp từ máy tính</span>
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                  Hỗ trợ định dạng PDF, Word, Excel, hình ảnh. Dung lượng tối đa 5MB.
                </div>
                <input
                  id="file-upload-loan"
                  type="file"
                  style={{ display: "none" }}
                  onChange={handleFileUpload}
                />
              </div>

              {attachmentError && <p role="alert" style={{color:"#dc2626",fontSize:13}}>{attachmentError}</p>}
              {attachments.length > 0 && (
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ background: "#f8fafc", padding: "8px 12px", borderBottom: "1px solid #e2e8f0", fontSize: 12, fontWeight: 600, color: "#475569" }}>
                    Tài liệu đã đính kèm ({attachments.length})
                  </div>
                  {attachments.map((att, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        borderBottom: idx < attachments.length - 1 ? "1px solid #f1f5f9" : "none",
                        fontSize: 13,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: "#059669", fontWeight: 600 }}>📄</span>
                        <span style={{ fontWeight: 500, color: "#1e293b" }}>{att.name}</span>
                        <span style={{ fontSize: 11, color: "#64748b" }}>({att.size})</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>{att.time}</span>
                        <button
                          type="button"
                          onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                          style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}
                          title="Xóa đính kèm"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer style={{ height: 48, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, padding: "0 20px", position: "relative" }}>
          <button
            type="button"
            className="misa-invoice-btn-cancel"
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            type="button"
            className="misa-invoice-btn-cancel"
            onClick={() => handleSave(false)}
          >
            Cất
          </button>
          <div style={{ position: "relative", display: "inline-block" }}>
            <button
              type="button"
              className="misa-invoice-btn-submit"
              onClick={() => handleSave(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <span>Cất và Đóng</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSaveDropdown(!showSaveDropdown);
                }}
                style={{ display: "flex", alignItems: "center", paddingLeft: 4, borderLeft: "1px solid rgba(255,255,255,0.3)" }}
              >
                <ChevronDown size={14} />
              </span>
            </button>
            {showSaveDropdown && (
              <div
                style={{
                  position: "absolute",
                  bottom: "100%",
                  right: 0,
                  marginBottom: 4,
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  minWidth: 150,
                  zIndex: 100,
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    fontSize: 13,
                    cursor: "pointer",
                    color: "#374151",
                  }}
                  onClick={() => {
                    setShowSaveDropdown(false);
                    handleSave(false);
                    // reset form for new entry
                    setContractCode("KUCV00002");
                  }}
                >
                  Cất và Thêm
                </button>
              </div>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

// ============================================================================
// 2. MODAL: KHẾ ƯỚC ĐI VAY (MATCHING IMAGE 2)
// ============================================================================
export interface BorrowingContractModalProps {
  onClose: () => void;
  onSubmit: (data: any) => boolean | void | Promise<boolean | void>;
  onOpenCreditContract?: () => void;
}

export function BorrowingContractModal({
  onClose,
  onSubmit,
  onOpenCreditContract,
}: BorrowingContractModalProps) {
  // Master fields
  const [contractCode, setContractCode] = useState("KUDV00001");
  const [lender, setLender] = useState("Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)");
  const [creditContract, setCreditContract] = useState("HĐTD-BIDV-2026/01 - Cấp hạn mức tín dụng BIDV");
  const [purpose, setPurpose] = useState("Bổ sung vốn lưu động thanh toán tiền hàng cho nhà cung cấp");
  const [debitAccount, setDebitAccount] = useState("3411");
  const [creditInterestAccount, setCreditInterestAccount] = useState("635");

  // Tab state
  const [activeTab, setActiveTab] = useState<
    "disbursement" | "interest" | "repayment" | "stats" | "attachment"
  >("disbursement");

  // Tab 1: Thông tin giải ngân
  const [loanAmount, setLoanAmount] = useState(1200000000);
  const [loanTerm, setLoanTerm] = useState(6);
  const [termUnit, setTermUnit] = useState("Tháng");
  const [disbursementDate, setDisbursementDate] = useState("09/10/2026");
  const [dueDate, setDueDate] = useState("09/04/2027");
  const [disbursementMethod, setDisbursementMethod] = useState("Chuyển khoản vào tài khoản DN");
  const [beneficiaryAccount, setBeneficiaryAccount] = useState("1028475929 - VCB");
  const [bankName, setBankName] = useState("Vietcombank - CN Hà Nội");

  // Tab 2: Lãi suất
  const [interestBasis, setInterestBasis] = useState("Lãi suất trên dư nợ giảm dần");
  const [yearDaysBasis, setYearDaysBasis] = useState("365");
  const [hasAdjustment, setHasAdjustment] = useState(true);
  const [interestRows, setInterestRows] = useState([
    { id: 1, rate: 7.5, overdueRate: 150, effectiveDate: "09/10/2026", note: "Lãi suất ưu đãi quý 4" },
  ]);

  // Tab 3: Hình thức trả nợ
  const [principalPeriod, setPrincipalPeriod] = useState("Hàng tháng");
  const [interestPeriod, setInterestPeriod] = useState("Hàng tháng");
  const [repaymentMethod, setRepaymentMethod] = useState("Tiền gửi");
  const [firstPrincipalDate, setFirstPrincipalDate] = useState("09/11/2026");
  const [firstInterestDate, setFirstInterestDate] = useState("09/11/2026");
  const [repaymentAccount, setRepaymentAccount] = useState("1028475929 - VCB");
  const [repaymentBankName, setRepaymentBankName] = useState("Vietcombank - CN Hà Nội");

  // Tab 4: Thống kê khác
  const [project, setProject] = useState("");
  const [purchaseOrder, setPurchaseOrder] = useState("");
  const [purchaseContract, setPurchaseContract] = useState("");
  const [expenseItem, setExpenseItem] = useState("");
  const [cashFlowItem, setCashFlowItem] = useState("");
  const [department, setDepartment] = useState("Phòng Kế toán - Tài chính");

  // Tab 5: Đính kèm
  const [quickParty,setQuickParty]=useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const [attachments, setAttachments] = useState<{ name: string; size: string; time: string }[]>([
    { name: "KHE_UOC_DI_VAY_KUDV00001.pdf", size: "2.1 MB", time: "09/10/2026 11:20" },
  ]);

  // Dropdown menu for Cất và Đóng
  const [showSaveDropdown, setShowSaveDropdown] = useState(false);

  const handleAddInterestRow = () => {
    setInterestRows((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        rate: 8.2,
        overdueRate: 150,
        effectiveDate: "09/01/2027",
        note: "Điều chỉnh theo lãi suất thị trường",
      },
    ]);
  };

  const handleClearInterestRows = () => {
    setInterestRows([]);
  };

  const handleRemoveInterestRow = (id: number) => {
    setInterestRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      e.target.value = "";
      if (f.size > 5 * 1024 * 1024) {
        setAttachmentError("Dung lượng tệp không được vượt quá 5 MB.");
        return;
      }
      setAttachmentError("");
      setAttachments((prev) => [
        ...prev,
        {
          name: f.name,
          size: `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
          time: new Date().toLocaleString("vi-VN"),
        },
      ]);
    }
  };

  const handleSave = async (andClose = false) => {
    const saved = await onSubmit({
      kind: "borrowing",
      code: contractCode,
      lender,
      creditContract,
      purpose,
      debitAccount,
      creditInterestAccount,
      loanAmount,
      loanTerm,
      termUnit,
      disbursementDate,
      dueDate,
      disbursementMethod,
      beneficiaryAccount,
      bankName,
      interestBasis,
      yearDaysBasis,
      hasAdjustment,
      interestRows,
      principalPeriod,
      interestPeriod,
      repaymentMethod,
      firstPrincipalDate,
      firstInterestDate,
      repaymentAccount,
      repaymentBankName,
      project,
      purchaseOrder,
      purchaseContract,
      expenseItem,
      cashFlowItem,
      department,
      attachments,
    });
    if (saved === false) return;
    if (andClose) onClose();
  };

  return (
    <div className="misa-modal-backdrop" role="dialog" aria-modal="true">
      <div className="misa-credit-modal-window" style={{ maxWidth: 960, width: "95vw" }}>
        {/* Header */}
        <header className="misa-credit-modal-header" style={{ borderBottom: "1px solid #e2e8f0" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111827" }}>
            Khế ước đi vay {contractCode}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              className="misa-invoice-help-link"
              onClick={() => alert("Hướng dẫn lập Khế ước đi vay")}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#0284c7", fontSize: 12, cursor: "pointer" }}
            >
              <HelpCircle size={15} />
              <span>Hướng dẫn sử dụng</span>
              <ChevronDown size={13} />
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

        {/* Master Form Area */}
        <div style={{ padding: "14px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          {/* Row 1 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 16, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Số khế ước đi vay <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                value={contractCode}
                onChange={(e) => setContractCode(e.target.value)}
                placeholder="Nhập số khế ước đi vay..."
                style={{
                  width: "100%",
                  height: 32,
                  padding: "0 10px",
                  borderRadius: 4,
                  border: "1px solid #10b981",
                  fontSize: 13,
                  fontWeight: 600,
                  outline: "none",
                  background: "#ffffff",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Đối tượng cho vay <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div style={{ display: "flex", gap: 4 }}>
                <select
                  value={lender}
                  onChange={(e) => setLender(e.target.value)}
                  style={{
                    flex: 1,
                    height: 32,
                    padding: "0 10px",
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    fontSize: 13,
                    background: "#ffffff",
                  }}
                >
                  <option value="">-- Chọn đối tượng cho vay --</option>
                  <option value="Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)">BIDV - Chi nhánh Ba Đình</option>
                  <option value="Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)">Vietcombank - Chi nhánh Hà Nội</option>
                  <option value="Ngân hàng TMCP Quân đội (MBBank)">MB Bank - Chi nhánh Thăng Long</option>
                  <option value="Ngân hàng TMCP Công thương Việt Nam (VietinBank)">VietinBank - Chi nhánh Đống Đa</option>
                </select>
                <button
                  type="button"
                  title="Thêm đối tượng cho vay"
                  onClick={() => setQuickParty(true)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                    color: "#059669",
                  }}
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Row 2 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 16, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Hợp đồng tín dụng
              </label>
              <div style={{ display: "flex", gap: 4 }}>
                <select
                  value={creditContract}
                  onChange={(e) => setCreditContract(e.target.value)}
                  style={{
                    flex: 1,
                    height: 32,
                    padding: "0 10px",
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    fontSize: 13,
                    background: "#ffffff",
                  }}
                >
                  <option value="">-- Chọn hợp đồng tín dụng --</option>
                  <option value="HĐTD-BIDV-2026/01 - Cấp hạn mức tín dụng BIDV">HĐTD-BIDV-2026/01 - Cấp hạn mức tín dụng BIDV</option>
                  <option value="HĐTD-VCB-2026/03 - Hợp đồng vay trung dài hạn VCB">HĐTD-VCB-2026/03 - Hợp đồng vay trung dài hạn VCB</option>
                </select>
                <button
                  type="button"
                  onClick={onOpenCreditContract}
                  title="Thêm hợp đồng tín dụng"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                    color: "#059669",
                  }}
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Mục đích vay
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Nhập mục đích vay hoặc dùng AI gợi ý..."
                  style={{
                    width: "100%",
                    height: 32,
                    padding: "0 34px 0 10px",
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    fontSize: 13,
                    background: "#ffffff",
                  }}
                />
                <button
                  type="button"
                  title="Gợi ý bằng AI"
                  onClick={() => setPurpose("Bổ sung vốn lưu động thanh toán tiền hàng cho nhà cung cấp")}
                  style={{
                    position: "absolute",
                    right: 6,
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "transparent",
                    color: "#8b5cf6",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Sparkles size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Row 3 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                TK hạch toán nợ gốc <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={debitAccount}
                onChange={(e) => setDebitAccount(e.target.value)}
                style={{
                  width: "100%",
                  height: 32,
                  padding: "0 10px",
                  borderRadius: 4,
                  border: "1px solid #d1d5db",
                  fontSize: 13,
                  background: "#ffffff",
                }}
              >
                <option value="3411">3411 - Các khoản đi vay</option>
                <option value="3412">3412 - Nợ thuê tài chính</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                TK hạch toán lãi vay <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={creditInterestAccount}
                onChange={(e) => setCreditInterestAccount(e.target.value)}
                style={{
                  width: "100%",
                  height: 32,
                  padding: "0 10px",
                  borderRadius: 4,
                  border: "1px solid #d1d5db",
                  fontSize: 13,
                  background: "#ffffff",
                }}
              >
                <option value="635">635 - Chi phí tài chính</option>
                <option value="242">242 - Chi phí trả trước</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sub-tabs Navigation */}
        <div style={{ display: "flex", gap: 2, background: "#f1f5f9", padding: "4px 16px 0 16px", borderBottom: "1px solid #cbd5e1" }}>
          {[
            { id: "disbursement", label: "Thông tin giải ngân" },
            { id: "interest", label: "Lãi suất" },
            { id: "repayment", label: "Hình thức trả nợ" },
            { id: "stats", label: "Thống kê khác" },
            { id: "attachment", label: "Đính kèm" },
          ].map((tb) => (
            <button
              key={tb.id}
              type="button"
              onClick={() => setActiveTab(tb.id as any)}
              style={{
                padding: "8px 16px",
                border: "none",
                background: activeTab === tb.id ? "#ffffff" : "transparent",
                color: activeTab === tb.id ? "#059669" : "#475569",
                fontWeight: activeTab === tb.id ? 600 : 500,
                fontSize: 13,
                borderRadius: "4px 4px 0 0",
                borderBottom: activeTab === tb.id ? "2px solid #059669" : "2px solid transparent",
                cursor: "pointer",
              }}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {/* Tab Body Content */}
        <div style={{ flex: 1, padding: "18px 20px", overflowY: "auto", background: "#ffffff", minHeight: 280 }}>
          {/* TAB 1: THÔNG TIN GIẢI NGÂN (Hình ảnh 2) */}
          {activeTab === "disbursement" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Row 1: Giá trị khoản vay & Thời hạn */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    Giá trị khoản vay <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={loanAmount === 0 ? "0" : formatVND(loanAmount)}
                    onChange={(e) => setLoanAmount(parseInt(e.target.value.replace(/\D/g, "") || "0", 10))}
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 10px",
                      borderRadius: 4,
                      border: "1px solid #d1d5db",
                      fontSize: 13,
                      textAlign: "right",
                      fontWeight: 600,
                      color: "#059669",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    Thời hạn vay <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      type="number"
                      value={loanTerm}
                      onChange={(e) => setLoanTerm(parseInt(e.target.value || "0", 10))}
                      style={{ width: 75, height: 32, padding: "0 8px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13, textAlign: "right" }}
                    />
                    <select
                      value={termUnit}
                      onChange={(e) => setTermUnit(e.target.value)}
                      style={{ flex: 1, height: 32, padding: "0 8px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                    >
                      <option value="Tháng">Tháng</option>
                      <option value="Năm">Năm</option>
                      <option value="Ngày">Ngày</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    Ngày giải ngân <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <VoucherDateField value={disbursementDate} onChange={setDisbursementDate} label="Ngày giải ngân"/>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    Ngày đáo hạn <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <VoucherDateField value={dueDate} onChange={setDueDate} label="Ngày đáo hạn"/>
                  </div>
                </div>
              </div>

              {/* Row 2: Phương thức giải ngân, TK thụ hưởng, Tên ngân hàng */}
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.2fr 1.4fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    Phương thức giải ngân <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    value={disbursementMethod}
                    onChange={(e) => setDisbursementMethod(e.target.value)}
                    style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                  >
                    <option value="Chuyển khoản vào tài khoản DN">Chuyển khoản vào tài khoản DN</option>
                    <option value="Chuyển khoản cho bên thứ ba">Chuyển khoản cho bên thứ ba</option>
                    <option value="Tiền mặt">Tiền mặt</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    TK thụ hưởng
                  </label>
                  <select
                    value={beneficiaryAccount}
                    onChange={(e) => {
                      setBeneficiaryAccount(e.target.value);
                      if (e.target.value.includes("VCB")) setBankName("Vietcombank - CN Hà Nội");
                      else if (e.target.value.includes("BIDV")) setBankName("BIDV - CN Ba Đình");
                      else setBankName("");
                    }}
                    style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                  >
                    <option value="">-- Chọn tài khoản --</option>
                    <option value="1028475929 - VCB">1028475929 - VCB</option>
                    <option value="2151000849201 - BIDV">2151000849201 - BIDV</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    Tên ngân hàng
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    readOnly
                    placeholder="Tên ngân hàng tài khoản DN"
                    style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: 13, color: "#475569" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LÃI SUẤT */}
          {activeTab === "interest" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Radio options */}
              <div style={{ display: "flex", alignItems: "center", gap: 24, padding: "8px 12px", background: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", color: "#374151" }}>
                  <input
                    type="radio"
                    name="borrowInterestBasis"
                    checked={interestBasis === "Lãi suất trên dư nợ giảm dần"}
                    onChange={() => setInterestBasis("Lãi suất trên dư nợ giảm dần")}
                  />
                  <span>Lãi suất trên dư nợ giảm dần</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", color: "#374151" }}>
                  <input
                    type="radio"
                    name="borrowInterestBasis"
                    checked={interestBasis === "Lãi suất trên dư nợ gốc"}
                    onChange={() => setInterestBasis("Lãi suất trên dư nợ gốc")}
                  />
                  <span>Lãi suất trên dư nợ gốc</span>
                </label>
                <div style={{ width: 1, height: 18, background: "#cbd5e1" }} />
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", color: "#374151" }}>
                  <input
                    type="radio"
                    name="borrowYearDaysBasis"
                    checked={yearDaysBasis === "365"}
                    onChange={() => setYearDaysBasis("365")}
                  />
                  <span>Lãi năm / 365 ngày</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", color: "#374151" }}>
                  <input
                    type="checkbox"
                    checked={hasAdjustment}
                    onChange={(e) => setHasAdjustment(e.target.checked)}
                  />
                  <span>Có điều chỉnh lãi suất</span>
                </label>
              </div>

              {/* Grid Header Buttons */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                  Bảng mức lãi suất đi vay
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleAddInterestRow}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 10px",
                      borderRadius: 4,
                      border: "1px solid #10b981",
                      background: "#ecfdf5",
                      color: "#059669",
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={14} />
                    <span>Thêm dòng</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearInterestRows}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 10px",
                      borderRadius: 4,
                      border: "1px solid #e2e8f0",
                      background: "#ffffff",
                      color: "#ef4444",
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={14} />
                    <span>Xóa hết dòng</span>
                  </button>
                </div>
              </div>

              {/* Grid Table */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", textAlign: "left" }}>
                      <th style={{ width: 40, padding: "8px 10px", textAlign: "center" }}>#</th>
                      <th style={{ width: 140, padding: "8px 10px" }}>Lãi suất %/năm</th>
                      <th style={{ width: 160, padding: "8px 10px" }}>Lãi suất quá hạn %</th>
                      <th style={{ width: 140, padding: "8px 10px" }}>Hiệu lực từ ngày</th>
                      <th style={{ padding: "8px 10px" }}>Ghi chú</th>
                      <th style={{ width: 50, padding: "8px 10px", textAlign: "center" }}>Xóa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interestRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "#94a3b8" }}>
                          Chưa có thông tin lãi suất. Bấm "Thêm dòng" để thiết lập.
                        </td>
                      </tr>
                    ) : (
                      interestRows.map((r, idx) => (
                        <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "6px 10px", textAlign: "center", color: "#64748b" }}>{idx + 1}</td>
                          <td style={{ padding: "6px 10px" }}>
                            <input
                              type="number"
                              step="0.1"
                              value={r.rate}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value || "0");
                                setInterestRows((prev) => prev.map((item) => (item.id === r.id ? { ...item, rate: val } : item)));
                              }}
                              style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #d1d5db", borderRadius: 4, textAlign: "right" }}
                            />
                          </td>
                          <td style={{ padding: "6px 10px" }}>
                            <input
                              type="number"
                              value={r.overdueRate}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value || "0");
                                setInterestRows((prev) => prev.map((item) => (item.id === r.id ? { ...item, overdueRate: val } : item)));
                              }}
                              style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #d1d5db", borderRadius: 4, textAlign: "right" }}
                            />
                          </td>
                          <td style={{ padding: "6px 10px" }}>
                            <input
                              type="text"
                              value={r.effectiveDate}
                              onChange={(e) => {
                                const val = e.target.value;
                                setInterestRows((prev) => prev.map((item) => (item.id === r.id ? { ...item, effectiveDate: val } : item)));
                              }}
                              style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #d1d5db", borderRadius: 4 }}
                            />
                          </td>
                          <td style={{ padding: "6px 10px" }}>
                            <input
                              type="text"
                              value={r.note}
                              onChange={(e) => {
                                const val = e.target.value;
                                setInterestRows((prev) => prev.map((item) => (item.id === r.id ? { ...item, note: val } : item)));
                              }}
                              placeholder="Nhập ghi chú..."
                              style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #d1d5db", borderRadius: 4 }}
                            />
                          </td>
                          <td style={{ padding: "6px 10px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveInterestRow(r.id)}
                              style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
                              title="Xóa dòng"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: HÌNH THỨC TRẢ NỢ */}
          {activeTab === "repayment" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 720 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    Trả gốc <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    value={principalPeriod}
                    onChange={(e) => setPrincipalPeriod(e.target.value)}
                    style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                  >
                    <option value="Hàng tháng">Hàng tháng</option>
                    <option value="Hàng quý">Hàng quý</option>
                    <option value="Cuối kỳ">Cuối kỳ</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    Trả lãi <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    value={interestPeriod}
                    onChange={(e) => setInterestPeriod(e.target.value)}
                    style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                  >
                    <option value="Hàng tháng">Hàng tháng</option>
                    <option value="Hàng quý">Hàng quý</option>
                    <option value="Cùng kỳ trả gốc">Cùng kỳ trả gốc</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    Phương thức trả nợ <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    value={repaymentMethod}
                    onChange={(e) => setRepaymentMethod(e.target.value)}
                    style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                  >
                    <option value="Tiền gửi">Tiền gửi (Ủy nhiệm chi)</option>
                    <option value="Tiền mặt">Tiền mặt</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    Ngày trả gốc đầu tiên <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <VoucherDateField value={firstPrincipalDate} onChange={setFirstPrincipalDate} label="Ngày trả nợ gốc đầu tiên"/>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    Ngày trả lãi đầu tiên <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <VoucherDateField value={firstInterestDate} onChange={setFirstInterestDate} label="Ngày trả lãi đầu tiên"/>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    Chuyển vào tài khoản
                  </label>
                  <select
                    value={repaymentAccount}
                    onChange={(e) => {
                      setRepaymentAccount(e.target.value);
                      if (e.target.value.includes("VCB")) setRepaymentBankName("Vietcombank - CN Hà Nội");
                      else if (e.target.value.includes("BIDV")) setRepaymentBankName("BIDV - CN Ba Đình");
                    }}
                    style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                  >
                    <option value="1028475929 - VCB">1028475929 - VCB</option>
                    <option value="2151000849201 - BIDV">2151000849201 - BIDV</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    Tên ngân hàng
                  </label>
                  <input
                    type="text"
                    value={repaymentBankName}
                    readOnly
                    style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: 13, color: "#475569" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: THỐNG KÊ KHÁC */}
          {activeTab === "stats" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 720 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                  Công trình
                </label>
                <input
                  type="text"
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  placeholder="Chọn hoặc nhập mã công trình..."
                  style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                  Đơn mua hàng
                </label>
                <input
                  type="text"
                  value={purchaseOrder}
                  onChange={(e) => setPurchaseOrder(e.target.value)}
                  placeholder="Chọn đơn mua hàng liên quan..."
                  style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                  Hợp đồng mua
                </label>
                <input
                  type="text"
                  value={purchaseContract}
                  onChange={(e) => setPurchaseContract(e.target.value)}
                  placeholder="Chọn hợp đồng mua..."
                  style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                  Khoản mục chi phí
                </label>
                <input
                  type="text"
                  value={expenseItem}
                  onChange={(e) => setExpenseItem(e.target.value)}
                  placeholder="Chọn khoản mục chi phí..."
                  style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                  Mục thu/chi
                </label>
                <input
                  type="text"
                  value={cashFlowItem}
                  onChange={(e) => setCashFlowItem(e.target.value)}
                  placeholder="Chọn mục thu chi..."
                  style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                  Đơn vị / Phòng ban
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Phòng Kế toán - Tài chính"
                  style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>
            </div>
          )}

          {/* TAB 5: ĐÍNH KÈM */}
          {quickParty&&<div style={{position:"fixed",inset:0,zIndex:11000,background:"transparent",overflow:"auto"}}><button style={{position:"fixed",right:16,top:12,zIndex:12000}} onClick={()=>setQuickParty(false)}>Đóng thêm đối tượng</button><SupplierModal onClose={()=>setQuickParty(false)} onSubmit={data=>{setLender(data.name||"");setQuickParty(false);}}/></div>}
          {activeTab === "attachment" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                style={{
                  border: "2px dashed #cbd5e1",
                  borderRadius: 8,
                  padding: "24px 20px",
                  textAlign: "center",
                  background: "#f8fafc",
                  cursor: "pointer",
                }}
                onClick={() => document.getElementById("file-upload-borrow")?.click()}
              >
                <Upload size={32} style={{ color: "#059669", margin: "0 auto 8px auto" }} />
                <div style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
                  Kéo thả tài liệu khế ước đi vay hoặc <span style={{ color: "#0284c7", textDecoration: "underline" }}>chọn tệp từ máy tính</span>
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                  Hỗ trợ định dạng PDF, Word, Excel, hình ảnh. Dung lượng tối đa 5MB.
                </div>
                <input
                  id="file-upload-borrow"
                  type="file"
                  style={{ display: "none" }}
                  onChange={handleFileUpload}
                />
              </div>

              {attachmentError && <p role="alert" style={{color:"#dc2626",fontSize:13}}>{attachmentError}</p>}
              {attachments.length > 0 && (
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ background: "#f8fafc", padding: "8px 12px", borderBottom: "1px solid #e2e8f0", fontSize: 12, fontWeight: 600, color: "#475569" }}>
                    Tài liệu đã đính kèm ({attachments.length})
                  </div>
                  {attachments.map((att, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        borderBottom: idx < attachments.length - 1 ? "1px solid #f1f5f9" : "none",
                        fontSize: 13,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: "#059669", fontWeight: 600 }}>📄</span>
                        <span style={{ fontWeight: 500, color: "#1e293b" }}>{att.name}</span>
                        <span style={{ fontSize: 11, color: "#64748b" }}>({att.size})</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>{att.time}</span>
                        <button
                          type="button"
                          onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                          style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}
                          title="Xóa đính kèm"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer style={{ height: 48, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, padding: "0 20px", position: "relative" }}>
          <button
            type="button"
            className="misa-invoice-btn-cancel"
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            type="button"
            className="misa-invoice-btn-cancel"
            onClick={() => handleSave(false)}
          >
            Cất
          </button>
          <div style={{ position: "relative", display: "inline-block" }}>
            <button
              type="button"
              className="misa-invoice-btn-submit"
              onClick={() => handleSave(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <span>Cất và Đóng</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSaveDropdown(!showSaveDropdown);
                }}
                style={{ display: "flex", alignItems: "center", paddingLeft: 4, borderLeft: "1px solid rgba(255,255,255,0.3)" }}
              >
                <ChevronDown size={14} />
              </span>
            </button>
            {showSaveDropdown && (
              <div
                style={{
                  position: "absolute",
                  bottom: "100%",
                  right: 0,
                  marginBottom: 4,
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  minWidth: 150,
                  zIndex: 100,
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    fontSize: 13,
                    cursor: "pointer",
                    color: "#374151",
                  }}
                  onClick={() => {
                    setShowSaveDropdown(false);
                    handleSave(false);
                    setContractCode("KUDV00002");
                  }}
                >
                  Cất và Thêm
                </button>
              </div>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

// ============================================================================
// 3. MODAL: HỢP ĐỒNG TÍN DỤNG / HỢP ĐỒNG TÍN DỤNG CHO VAY (MATCHING IMAGE 3 & 4)
// ============================================================================
export interface CreditContractModalProps {
  kind?: "borrowing" | "lending"; // borrowing: Image 3 ("Hợp đồng tín dụng"), lending: Image 4 ("Hợp đồng tín dụng cho vay")
  onClose: () => void;
  onSubmit: (data: any) => boolean | void | Promise<boolean | void>;
}

export function CreditContractModal({
  kind = "borrowing",
  onClose,
  onSubmit,
}: CreditContractModalProps) {
  const isLending = kind === "lending";
  const title = isLending ? "Hợp đồng tín dụng cho vay" : "Hợp đồng tín dụng";

  // Form states
  const [contractType, setContractType] = useState<"limit" | "principle">("limit");
  const [contractNum, setContractNum] = useState(isLending ? "HĐTD00001" : "");
  const [signDate, setSignDate] = useState("29/09/2026");
  const [status, setStatus] = useState("Chưa thực hiện");
  const [partner, setPartner] = useState("");
  const [creditLimit, setCreditLimit] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [purpose, setPurpose] = useState("");

  // Collateral assets (Tài sản đảm bảo)
  const [assets, setAssets] = useState<
    { id: string; name: string; value: number; document: string }[]
  >([]);

  const addAssetRow = () => {
    setAssets([
      ...assets,
      {
        id: `ast-${Date.now()}`,
        name: "",
        value: 0,
        document: "",
      },
    ]);
  };

  const removeAllAssets = () => {
    setAssets([]);
  };

  const handleSave = async () => {
    const saved = await onSubmit({
      kind,
      contractType,
      contractNum,
      signDate,
      status,
      partner,
      creditLimit,
      startDate,
      endDate,
      purpose,
      assets,
    });
    if (saved === false) return;
    onClose();
  };

  return (
    <div className="misa-modal-backdrop" role="dialog" aria-modal="true">
      <div className="misa-credit-modal-window" style={{ maxWidth: 1060 }}>
        {/* Header (Image 3 & 4) */}
        <header className="misa-credit-modal-header">
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111827" }}>
            {title}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" className="misa-invoice-circle-btn" title="Trợ giúp">
              <HelpCircle size={18} />
            </button>
            <button type="button" className="misa-invoice-circle-btn" onClick={onClose} title="Đóng">
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Master Form Area */}
        <div style={{ padding: "14px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          {/* Radio contract types */}
          <div style={{ display: "flex", gap: 20, marginBottom: 14 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
              <input
                type="radio"
                name="creditContractType"
                checked={contractType === "limit"}
                onChange={() => setContractType("limit")}
                style={{ accentColor: "#00b06b", cursor: "pointer" }}
              />
              <span>Hợp đồng tín dụng hạn mức</span>
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
              <input
                type="radio"
                name="creditContractType"
                checked={contractType === "principle"}
                onChange={() => setContractType("principle")}
                style={{ accentColor: "#00b06b", cursor: "pointer" }}
              />
              <span>Hợp đồng nguyên tắc</span>
            </label>
          </div>

          {/* Row 1: Số hợp đồng, Ngày ký, Tình trạng */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 14, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Số hợp đồng <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                value={contractNum}
                onChange={(e) => setContractNum(e.target.value)}
                placeholder="Nhập số hợp đồng tín dụng..."
                style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #10b981", fontSize: 13, outline: "none", background: "#ffffff" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Ngày ký <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <VoucherDateField value={signDate} onChange={setSignDate} label="Ngày ký"/>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Tình trạng <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13, background: "#ffffff" }}
              >
                <option value="Chưa thực hiện">Chưa thực hiện</option>
                <option value="Đang thực hiện">Đang thực hiện</option>
                <option value="Đã hoàn thành">Đã hoàn thành</option>
                <option value="Hủy bỏ">Hủy bỏ</option>
              </select>
            </div>
          </div>

          {/* Row 2: Đối tượng vay/cho vay, Hạn mức tín dụng */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                {isLending ? "Đối tượng vay" : "Đối tượng cho vay"} <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div style={{ display: "flex", gap: 4 }}>
                <select
                  value={partner}
                  onChange={(e) => setPartner(e.target.value)}
                  style={{ flex: 1, height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13, background: "#ffffff" }}
                >
                  <option value="">&nbsp;</option>
                  {isLending ? (
                    <>
                      <option value="Công ty TNHH Đầu tư Thương mại Sao Mai">Công ty TNHH Đầu tư Thương mại Sao Mai</option>
                      <option value="Công ty CP Xây dựng Đông Dương">Công ty CP Xây dựng Đông Dương</option>
                    </>
                  ) : (
                    <>
                      <option value="Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)">Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)</option>
                      <option value="Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)">Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)</option>
                    </>
                  )}
                </select>
                <button
                  type="button"
                  title="Thêm đối tượng"
                  style={{ width: 32, height: 32, borderRadius: 4, border: "1px solid #d1d5db", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#059669" }}
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Hạn mức tín dụng
              </label>
              <input
                type="text"
                value={creditLimit === 0 ? "0" : formatVND(creditLimit)}
                onChange={(e) => setCreditLimit(parseInt(e.target.value.replace(/\D/g, "") || "0", 10))}
                style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13, textAlign: "right", fontWeight: 600, background: "#ffffff" }}
              />
            </div>
          </div>

          {/* Row 3: Thời hạn từ, Đến, Mục đích vay */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Thời hạn từ <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <VoucherDateField value={startDate} onChange={setStartDate} label="Thời hạn từ"/>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Đến <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <VoucherDateField value={endDate} onChange={setEndDate} label="Thời hạn đến"/>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                Mục đích vay
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Nhập mục đích vay..."
                  style={{ width: "100%", height: 32, padding: "0 34px 0 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 13, background: "#ffffff" }}
                />
                <button
                  type="button"
                  title="Gợi ý AI"
                  onClick={() => setPurpose("Bổ sung vốn kinh doanh theo hạn mức hợp đồng tín dụng")}
                  style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", color: "#8b5cf6", cursor: "pointer" }}
                >
                  <Sparkles size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Tài sản đảm bảo (Image 3 & 4) */}
        <div style={{ flex: 1, padding: "14px 20px", overflowY: "auto", background: "#ffffff" }}>
          <h4 style={{ margin: "0 0 10px 0", fontSize: 13.5, fontWeight: 700, color: "#111827" }}>
            Tài sản đảm bảo
          </h4>

          {/* Table */}
          <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "#dbece2", borderBottom: "1px solid #cbd5e1" }}>
                  <th style={{ width: 40, textAlign: "center", padding: "7px 4px" }}>#</th>
                  <th style={{ textAlign: "left", padding: "7px 10px" }}>Tên tài sản đảm bảo</th>
                  <th style={{ width: 180, textAlign: "right", padding: "7px 10px" }}>Giá trị định giá</th>
                  <th style={{ width: 220, textAlign: "left", padding: "7px 10px" }}>Giấy tờ chuyển giao</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ height: 48, textAlign: "center", color: "#9ca3af", fontStyle: "italic" }}>
                      Chưa có tài sản đảm bảo nào được khai báo.
                    </td>
                  </tr>
                ) : (
                  assets.map((ast, idx) => (
                    <tr key={ast.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ textAlign: "center", color: "#6b7280" }}>{idx + 1}</td>
                      <td style={{ padding: "4px 8px" }}>
                        <input
                          type="text"
                          value={ast.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAssets(assets.map((a) => (a.id === ast.id ? { ...a, name: val } : a)));
                          }}
                          placeholder="Ví dụ: Bất động sản số 12 Bà Triệu"
                          style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 12.5 }}
                        />
                      </td>
                      <td style={{ padding: "4px 8px" }}>
                        <input
                          type="text"
                          value={ast.value === 0 ? "0" : formatVND(ast.value)}
                          onChange={(e) => {
                            const val = parseInt(e.target.value.replace(/\D/g, "") || "0", 10);
                            setAssets(assets.map((a) => (a.id === ast.id ? { ...a, value: val } : a)));
                          }}
                          style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 12.5, textAlign: "right" }}
                        />
                      </td>
                      <td style={{ padding: "4px 8px" }}>
                        <input
                          type="text"
                          value={ast.document}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAssets(assets.map((a) => (a.id === ast.id ? { ...a, document: val } : a)));
                          }}
                          placeholder="Số sổ đỏ / Giấy tờ pháp lý"
                          style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 12.5 }}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => setAssets(assets.filter((a) => a.id !== ast.id))}
                          style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer" }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <button
              type="button"
              onClick={addAssetRow}
              style={{
                height: 30,
                padding: "0 12px",
                borderRadius: 4,
                border: "1px solid #d1d5db",
                background: "#ffffff",
                fontSize: 12.5,
                fontWeight: 500,
                color: "#1e293b",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Plus size={14} style={{ color: "#00b06b" }} />
              <span>Thêm dòng</span>
            </button>
            <button
              type="button"
              onClick={removeAllAssets}
              style={{
                height: 30,
                padding: "0 12px",
                borderRadius: 4,
                border: "1px solid #d1d5db",
                background: "#ffffff",
                fontSize: 12.5,
                fontWeight: 500,
                color: "#1e293b",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Trash2 size={14} style={{ color: "#64748b" }} />
              <span>Xóa hết dòng</span>
            </button>
          </div>

          {/* Section: Đính kèm (Dung lượng tối đa 5MB) */}
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <span>Đính kèm</span>
              <span style={{ fontSize: 11, fontWeight: 400, color: "#64748b" }}>Dung lượng tối đa 5MB</span>
            </div>
            <div
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                padding: "20px 16px",
                textAlign: "center",
                background: "#f8fafc",
                cursor: "pointer",
              }}
            >
              <Upload size={22} style={{ color: "#64748b", margin: "0 auto 6px auto" }} />
              <div style={{ fontSize: 12.5, color: "#475569" }}>
                <span style={{ color: "#0284c7", textDecoration: "underline" }}>Chọn tệp</span> hoặc kéo và thả tệp vào đây
              </div>
            </div>
          </div>
        </div>

        {/* Footer (Image 3 & 4) */}
        <footer style={{ height: 48, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, padding: "0 20px" }}>
          <button
            type="button"
            className="misa-invoice-btn-cancel"
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            type="button"
            className="misa-invoice-btn-submit"
            onClick={handleSave}
          >
            Cất
          </button>
        </footer>
      </div>
    </div>
  );
}

// ============================================================================
// 4. OUTER SCREEN: KHẾ ƯỚC CHO VAY & KHẾ ƯỚC ĐI VAY (MATCHING IMAGE 5)
// ============================================================================
export interface CreditOverviewViewProps {
  type: "loans" | "borrowings"; // loans: Khế ước cho vay, borrowings: Khế ước đi vay
  onOpenLoanModal: () => void;
  onOpenBorrowModal: () => void;
  onOpenCreditContractModal: (kind: "borrowing" | "lending") => void;
  onOpenAIModal?: () => void;
  onOpenExcelModal?: () => void;
  notify: (msg: string) => void;
  /** Loan agreements from the backend; the sample rows are used when absent. */
  records?: { id: string; code: string; date: string; dueDate: string; partner: string; amount: number; rate: number; status: string }[];
}

export function CreditOverviewView({
  type,
  onOpenLoanModal,
  onOpenBorrowModal,
  onOpenCreditContractModal,
  onOpenAIModal,
  onOpenExcelModal,
  notify,
  records,
}: CreditOverviewViewProps) {
  const isLoans = type === "loans";
  const [showListView, setShowListView] = useState(false);
  const [activeMenu, setActiveMenu] = useState(false);

  // Sample records for the list view
  const sampleRecords = isLoans
    ? [
        {
          id: "kucv-1",
          code: "KUCV00001",
          date: "25/09/2026",
          dueDate: "25/09/2027",
          partner: "Công ty TNHH Đầu tư Thương mại Sao Mai",
          amount: 500000000,
          rate: 8.5,
          status: "Đang thực hiện",
        },
        {
          id: "kucv-2",
          code: "KUCV00002",
          date: "10/08/2026",
          dueDate: "10/08/2027",
          partner: "Công ty CP Xây dựng Đông Dương",
          amount: 800000000,
          rate: 9.0,
          status: "Đang thực hiện",
        },
      ]
    : [
        {
          id: "kudv-1",
          code: "KUDV00001",
          date: "15/09/2026",
          dueDate: "15/09/2027",
          partner: "Ngân hàng TMCP Đầu tư và Phát triển VN (BIDV)",
          amount: 2500000000,
          rate: 7.2,
          status: "Đang thực hiện",
        },
        {
          id: "kudv-2",
          code: "KUDV00002",
          date: "01/07/2026",
          dueDate: "01/07/2027",
          partner: "Ngân hàng TMCP Ngoại thương VN (Vietcombank)",
          amount: 1200000000,
          rate: 6.8,
          status: "Đang thực hiện",
        },
      ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff", overflow: "hidden" }}>
      {!showListView ? (
        // Empty / Intro State Canvas (Exact Matching Image 5)
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 20px 24px 20px",
            background: "#ffffff",
          }}
        >
          {/* Central Circular Illustration (Matching Image 5) */}
          <div style={{ position: "relative", width: 280, height: 180, marginBottom: 24 }}>
            <svg width="280" height="180" viewBox="0 0 280 180" fill="none">
              {/* Dashed connecting circle */}
              <circle
                cx="140"
                cy="90"
                r="64"
                stroke="#cbd5e1"
                strokeWidth="1.8"
                strokeDasharray="4 4"
              />

              {/* Sparkle top right */}
              <path d="M 195 40 L 197 34 L 199 40 L 205 42 L 199 44 L 197 50 L 195 44 L 189 42 Z" fill="#64748b" />
              {/* Sparkle bottom left */}
              <path d="M 85 145 L 87 140 L 89 145 L 94 147 L 89 149 L 87 154 L 85 149 L 80 147 Z" fill="#00b06b" />

              {/* Top Node: Calendar + Clock */}
              <g transform="translate(120, 20)">
                <rect x="0" y="4" width="40" height="34" rx="5" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.5" />
                <rect x="0" y="4" width="40" height="11" rx="5" fill="#00b06b" />
                <rect x="8" y="0" width="4" height="7" rx="1.5" fill="#1e293b" />
                <rect x="28" y="0" width="4" height="7" rx="1.5" fill="#1e293b" />
                {/* Clock circle */}
                <circle cx="32" cy="30" r="14" fill="#00b06b" />
                <path d="M 32 23 V 30 H 36" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
              </g>

              {/* Left Node: Contract Document + Signature */}
              <g transform="translate(70, 95)">
                <path
                  d="M 6 0 H 32 L 40 8 V 40 C 40 42.2 38.2 44 36 44 H 6 C 3.8 44 2 42.2 2 40 V 4 C 2 1.8 3.8 0 6 0 Z"
                  fill="#f8fafc"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                />
                <path d="M 32 0 V 8 H 40" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
                {/* Document text lines */}
                <rect x="8" y="14" width="22" height="2" rx="1" fill="#cbd5e1" />
                <rect x="8" y="20" width="18" height="2" rx="1" fill="#cbd5e1" />
                <rect x="8" y="26" width="20" height="2" rx="1" fill="#cbd5e1" />
                {/* Green signature flourish */}
                <path
                  d="M 8 36 Q 16 28 24 35 Q 28 39 34 32"
                  stroke="#00b06b"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>

              {/* Right Node: Hand + Dollar Coin */}
              <g transform="translate(165, 95)">
                {/* Dollar Coin */}
                <circle cx="28" cy="14" r="14" fill="#00b06b" />
                <text x="28" y="19" fill="#ffffff" fontSize="15" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">$</text>
                {/* Hand outline */}
                <path
                  d="M 0 32 C 8 32 14 36 22 36 H 42 C 44 36 46 34 46 32 C 46 30 42 28 38 28 H 22 C 16 28 10 24 2 24"
                  stroke="#94a3b8"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  fill="#f8fafc"
                />
              </g>
            </svg>
          </div>

          {/* Headline (Image 5) */}
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#111827",
              textAlign: "center",
              margin: "0 0 6px 0",
            }}
          >
            {isLoans
              ? "Khai báo hợp đồng tín dụng, khế ước cho vay"
              : "Khai báo hợp đồng tín dụng, khế ước đi vay"}
          </h2>
          <p
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: "#111827",
              textAlign: "center",
              margin: "0 0 24px 0",
            }}
          >
            {isLoans
              ? "để tính toán lãi cho vay đến hạn, theo dõi lịch thu nợ và lãi cho vay"
              : "để tính toán lãi vay đến hạn, theo dõi lịch trả nợ và lãi vay"}
          </p>

          {/* Action buttons row (Image 5) */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            {/* Button 1: Thêm bằng AI */}
            <button
              type="button"
              onClick={onOpenAIModal}
              style={{
                height: 34,
                padding: "0 14px",
                background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(99, 102, 241, 0.3)",
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.25)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Sparkles size={11} />
              </div>
              <span>Thêm bằng AI</span>
            </button>

            {/* Button 2: Thêm hợp đồng tín dụng cho vay / Thêm hợp đồng tín dụng */}
            <button
              type="button"
              onClick={() => onOpenCreditContractModal(isLoans ? "lending" : "borrowing")}
              style={{
                height: 34,
                padding: "0 14px",
                background: "#ffffff",
                color: "#1e293b",
                border: "1px solid #d1d5db",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {isLoans ? "Thêm hợp đồng tín dụng cho vay" : "Thêm hợp đồng tín dụng"}
            </button>

            {/* Button 3: Thêm khế ước cho vay / Thêm khế ước đi vay (Dropdown Button) */}
            <div style={{ position: "relative" }}>
              <div
                style={{
                  display: "inline-flex",
                  borderRadius: 4,
                  overflow: "hidden",
                  boxShadow: "0 1px 3px rgba(0, 176, 107, 0.3)",
                }}
              >
                <button
                  type="button"
                  onClick={isLoans ? onOpenLoanModal : onOpenBorrowModal}
                  style={{
                    height: 34,
                    padding: "0 14px",
                    background: "#00b06b",
                    color: "#ffffff",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {isLoans ? "Thêm khế ước cho vay" : "Thêm khế ước đi vay"}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMenu(!activeMenu)}
                  style={{
                    height: 34,
                    padding: "0 8px",
                    background: "#009a5d",
                    color: "#ffffff",
                    border: "none",
                    borderLeft: "1px solid rgba(255,255,255,0.2)",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <ChevronDown size={14} />
                </button>
              </div>

              {activeMenu && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    right: 0,
                    minWidth: 220,
                    background: "#ffffff",
                    borderRadius: 6,
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.12)",
                    padding: "6px 0",
                    zIndex: 50,
                  }}
                >
                  <button
                    type="button"
                    style={{
                      width: "100%",
                      padding: "8px 14px",
                      textAlign: "left",
                      border: "none",
                      background: "transparent",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setActiveMenu(false);
                      if (isLoans) onOpenLoanModal();
                      else onOpenBorrowModal();
                    }}
                  >
                    {isLoans ? "Khế ước cho vay" : "Khế ước đi vay"}
                  </button>
                  <button
                    type="button"
                    style={{
                      width: "100%",
                      padding: "8px 14px",
                      textAlign: "left",
                      border: "none",
                      background: "transparent",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setActiveMenu(false);
                      onOpenCreditContractModal(isLoans ? "lending" : "borrowing");
                    }}
                  >
                    {isLoans ? "Hợp đồng tín dụng cho vay" : "Hợp đồng tín dụng"}
                  </button>
                </div>
              )}
            </div>

            {/* Button 4: Nhập từ Excel */}
            <button
              type="button"
              onClick={onOpenExcelModal}
              style={{
                height: 34,
                padding: "0 14px",
                background: "#ffffff",
                color: "#1e293b",
                border: "1px solid #d1d5db",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Nhập từ Excel
            </button>
          </div>

          {/* Bottom Button: Xem danh sách chứng từ (Image 5) */}
          <div style={{ marginTop: 28, display: "flex", justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => {
                setShowListView(true);
                notify(isLoans ? "Xem danh sách Khế ước cho vay" : "Xem danh sách Khế ước đi vay");
              }}
              style={{
                height: 32,
                padding: "0 18px",
                background: "#ffffff",
                color: "#059669",
                border: "1px solid #10b981",
                borderRadius: 4,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              Xem danh sách chứng từ
            </button>
          </div>
        </div>
      ) : (
        // Full Data Table View
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Table Toolbar */}
          <div style={{ padding: "10px 16px", background: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowListView(false)}
                style={{ padding: "4px 8px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, cursor: "pointer" }}
              >
                ← Quay lại giới thiệu
              </button>
              <strong style={{ fontSize: 14, color: "#111827" }}>
                {isLoans ? "Danh sách Khế ước cho vay" : "Danh sách Khế ước đi vay"}
              </strong>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={isLoans ? onOpenLoanModal : onOpenBorrowModal}
                style={{ height: 32, padding: "0 14px", background: "#00b06b", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                + {isLoans ? "Thêm khế ước cho vay" : "Thêm khế ước đi vay"}
              </button>
            </div>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflow: "auto", background: "#eaeff4" }}>
            <table className="misa-invoice-table">
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: "center" }}>STT</th>
                  <th style={{ width: 120 }}>Số khế ước</th>
                  <th style={{ width: 110, textAlign: "center" }}>Ngày giải ngân</th>
                  <th style={{ width: 110, textAlign: "center" }}>Ngày đáo hạn</th>
                  <th>{isLoans ? "Đối tượng vay" : "Đối tượng cho vay"}</th>
                  <th style={{ width: 140, textAlign: "right" }}>Giá trị khoản vay</th>
                  <th style={{ width: 100, textAlign: "right" }}>Lãi suất (%/năm)</th>
                  <th style={{ width: 130, textAlign: "center" }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {(records || sampleRecords).map((r, i) => (
                  <tr key={r.id} style={{ background: "#ffffff" }}>
                    <td style={{ textAlign: "center", color: "#6b7280" }}>{i + 1}</td>
                    <td>
                      <span style={{ color: "#0284c7", fontWeight: 600, cursor: "pointer" }}>
                        {r.code}
                      </span>
                    </td>
                    <td style={{ textAlign: "center", color: "#374151" }}>{r.date}</td>
                    <td style={{ textAlign: "center", color: "#374151" }}>{r.dueDate}</td>
                    <td style={{ color: "#111827", fontWeight: 500 }}>{r.partner}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: "#059669" }}>{formatVND(r.amount)} đ</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{r.rate}%</td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                        {r.status}
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
  );
}
