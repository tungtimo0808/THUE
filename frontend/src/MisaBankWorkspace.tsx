import { useState, useMemo, useRef } from "react";
import {
  Filter,
  Search,
  RefreshCw,
  FileSpreadsheet,
  Settings,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Landmark,
  Coins,
  Clock,
  CreditCard,
  UserRound,
  Building2,
  Users,
  Calculator,
  SlidersHorizontal,
  FileCheck,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import {
  TaxPaymentModal,
  SupplierPaymentModal,
  AccountingVoucherModal,
  CreateVoucherModal,
  AIAssistantModal,
  MISA_BANK_RECEIPT_TYPES,
  MISA_BANK_PAYMENT_TYPES,
  formatVND,
} from "./MisaCashWorkspace";
import {
  SingleCustomerInvoiceCollectionModal,
  MultiCustomerInvoiceCollectionModal,
  InsurancePaymentModal,
  SalaryPaymentModal,
  InternalTransferModal,
  ExcelImportModal,
} from "./MisaBankModals";
import {
  LoanContractModal,
  BorrowingContractModal,
  CreditContractModal,
  CreditOverviewView,
} from "./MisaCreditModals";
import "./misa-cash.css";

export default function MisaBankWorkspace({
  tab = "transactions",
  notify,
}: {
  company: { id: string; name: string };
  period: string;
  tab: string;
  href: (path: string) => string;
  notify: (msg: string) => void;
}) {
  // Modal states
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showMultiCustomerModal, setShowMultiCustomerModal] = useState(false);
  const [showInsuranceModal, setShowInsuranceModal] = useState(false);
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [showCreateVoucher, setShowCreateVoucher] = useState<"receipt" | "payment" | null>(null);
  const [createVoucherTypeIndex, setCreateVoucherTypeIndex] = useState(0);
  const [showBankReceiptSubmenu, setShowBankReceiptSubmenu] = useState(false);
  const [showBankPaymentSubmenu, setShowBankPaymentSubmenu] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [creditContractModalKind, setCreditContractModalKind] = useState<"borrowing" | "lending" | null>(null);

  // Dropdowns (Mutually exclusive to prevent multiple menus open simultaneously)
  const [activeToolbarMenu, setActiveToolbarMenu] = useState<"receipt" | "payment" | null>(null);
  const [activeFlowchartMenu, setActiveFlowchartMenu] = useState<"receipt" | "payment" | null>(null);
  const flowchartMenuTimer = useRef<number | null>(null);

  const handleFlowchartMouseEnter = (menu: "receipt" | "payment") => {
    if (flowchartMenuTimer.current) {
      clearTimeout(flowchartMenuTimer.current);
      flowchartMenuTimer.current = null;
    }
    setActiveFlowchartMenu(menu);
  };

  const handleFlowchartMouseLeave = () => {
    flowchartMenuTimer.current = window.setTimeout(() => {
      setActiveFlowchartMenu(null);
    }, 220);
  };

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showAvaBanner, setShowAvaBanner] = useState(true);
  const [detailExpanded, setDetailExpanded] = useState(true);
  const [kpiCollapsed, setKpiCollapsed] = useState(false);

  // Selected voucher for print preview
  const [selectedVoucher, setSelectedVoucher] = useState({
    code: "UNC00028",
    date: "2026-09-02",
    person: "TRUNG TÂM KIỂM DỊCH THỰC VẬT SAU NHẬP KHẨU",
    address: "Hà Nội",
    reason: "Chi tiền mua dịch vụ của TRUNG TÂM KIỂM DỊCH THỰC VẬT SAU NHẬP KHẨU",
    debitAccount: "6427",
    creditAccount: "1121",
    amount: 2317000,
    amountInWords: "Hai triệu ba trăm mười bảy nghìn đồng chẵn",
    notes: "Kèm theo Hóa đơn điện tử số 34221 ngày 02/09/2026",
    chiefAccountant: "Trương Thị B",
    director: "Nguyễn Văn A",
  });

  // Authentic sample transactions matching Image 1
  const [transactions, setTransactions] = useState([
    {
      id: "unc-028",
      dateHachToan: "02/09/2026",
      dateChungTu: "02/09/2026",
      code: "UNC00028",
      description: "Chi tiền mua dịch vụ của TRUNG TÂM KIỂM DỊCH THỰC VẬT SAU ...",
      amount: 234000,
      partner: "TRUNG TÂM KIỂM DỊCH THỰC VẬT SAU NHẬP KHẨU I",
      kind: "payment",
      status: "posted",
      items: [
        {
          code: "PHH56",
          name: "Dịch vụ giám định mẫu vật thể - Côn trùng",
          taxDesc: "Thuế GTGT - Dịch vụ giám định mẫu vật thể - Côn trùng",
          taxRate: 0,
          taxAmount: 0,
          taxAccount: "1331",
          invoiceCode: "34221",
          invoiceDate: "02/09/2026",
        },
        {
          code: "PHH57",
          name: "Dịch vụ giám định mẫu vật thể - Nấm",
          taxDesc: "Thuế GTGT - Dịch vụ giám định mẫu vật thể - Nấm",
          taxRate: 0,
          taxAmount: 0,
          taxAccount: "1331",
          invoiceCode: "34221",
          invoiceDate: "02/09/2026",
        },
        {
          code: "PHH58",
          name: "Dịch vụ giám định mẫu vật thể - Vi khuẩn",
          taxDesc: "Thuế GTGT - Dịch vụ giám định mẫu vật thể - Vi khuẩn",
          taxRate: 0,
          taxAmount: 0,
          taxAccount: "1331",
          invoiceCode: "34221",
          invoiceDate: "02/09/2026",
        },
      ],
    },
    {
      id: "unc-027",
      dateHachToan: "10/08/2026",
      dateChungTu: "10/08/2026",
      code: "UNC00027",
      description: "Chi tiền mua dịch vụ của Công ty Cổ phần Vận chuyển Huy Hoàng",
      amount: 220000,
      partner: "Công ty Cổ phần Vận chuyển Huy Hoàng",
      kind: "payment",
      status: "posted",
      items: [
        {
          code: "VH01",
          name: "Cước vận chuyển container tuyến Hải Phòng - Hà Nội",
          taxDesc: "Thuế GTGT dịch vụ vận tải hàng hóa",
          taxRate: 8,
          taxAmount: 185360,
          taxAccount: "1331",
          invoiceCode: "18942",
          invoiceDate: "10/08/2026",
        },
      ],
    },
    {
      id: "unc-026",
      dateHachToan: "15/07/2026",
      dateChungTu: "15/07/2026",
      code: "UNC00026",
      description: "Chi tiền phí dịch vụ duy trì tài khoản ngân hàng điện tử",
      amount: 4180000,
      partner: "Ngân hàng TMCP Ngoại thương Việt Nam",
      kind: "payment",
      status: "posted",
      items: [
        {
          code: "EB01",
          name: "Phí dịch vụ eBanking 6 tháng cuối năm",
          taxDesc: "Thuế GTGT phí ngân hàng",
          taxRate: 10,
          taxAmount: 380000,
          taxAccount: "1331",
          invoiceCode: "002819",
          invoiceDate: "15/07/2026",
        },
      ],
    },
  ]);

  const [selectedRowId, setSelectedRowId] = useState("unc-028");

  const selectedTransaction = useMemo(
    () => transactions.find((t) => t.id === selectedRowId) || transactions[0],
    [transactions, selectedRowId],
  );

  const totalPayment = useMemo(
    () =>
      transactions
        .filter((t) => t.kind === "payment" || t.kind === "transfer")
        .reduce((sum, t) => sum + t.amount, 0),
    [transactions],
  );

  const totalReceipt = useMemo(
    () =>
      transactions
        .filter((t) => t.kind === "receipt")
        .reduce((sum, t) => sum + t.amount, 0),
    [transactions],
  );

  const currentBalance = useMemo(
    () => 1740888870 + totalReceipt - (totalPayment - 4634000),
    [totalReceipt, totalPayment],
  );

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchQuery =
        !searchQuery ||
        t.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.partner.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType =
        filterType === "all" ||
        (filterType === "receipt" && t.kind === "receipt") ||
        (filterType === "payment" && t.kind === "payment") ||
        (filterType === "transfer" && t.kind === "transfer");
      return matchQuery && matchType;
    });
  }, [transactions, searchQuery, filterType]);

  // Handlers
  const handleTaxPayment = (taxData: any) => {
    const newDoc = {
      id: crypto.randomUUID(),
      dateHachToan: taxData.taxDate.split("-").reverse().join("/"),
      dateChungTu: taxData.taxDate.split("-").reverse().join("/"),
      code: `UNC${String(transactions.length + 29).padStart(5, "0")}`,
      description: `Chi nộp ${taxData.taxType} qua ngân hàng`,
      amount: taxData.totalAmount,
      partner: "Kho bạc Nhà nước",
      kind: "payment",
      status: "posted",
      items: [
        {
          code: "THUE",
          name: taxData.taxType,
          taxDesc: "Nộp ngân sách nhà nước",
          taxRate: 0,
          taxAmount: 0,
          taxAccount: "33311",
          invoiceCode: "NSNN-01",
          invoiceDate: taxData.taxDate.split("-").reverse().join("/"),
        },
      ],
    };
    setTransactions([newDoc, ...transactions]);
    setSelectedRowId(newDoc.id);
    setShowTaxModal(false);
    notify(`Đã lập thành công chứng từ ${newDoc.code} - Nộp thuế ${formatVND(taxData.totalAmount)}đ!`);
  };

  const handleSupplierPayment = (data: any) => {
    const newDoc = {
      id: crypto.randomUUID(),
      dateHachToan: data.payDate.split("-").reverse().join("/"),
      dateChungTu: data.payDate.split("-").reverse().join("/"),
      code: `UNC${String(transactions.length + 29).padStart(5, "0")}`,
      description: `Ủy nhiệm chi trả tiền nhà cung cấp ${data.supplier} theo hóa đơn`,
      amount: data.totalAmount,
      partner: data.supplier,
      kind: "payment",
      status: "posted",
      items: [
        {
          code: "TT-NCC",
          name: `Thanh toán công nợ ${data.supplier}`,
          taxDesc: "Trả tiền nhà cung cấp",
          taxRate: 0,
          taxAmount: 0,
          taxAccount: "331",
          invoiceCode: "HD-00281",
          invoiceDate: data.payDate.split("-").reverse().join("/"),
        },
      ],
    };
    setTransactions([newDoc, ...transactions]);
    setSelectedRowId(newDoc.id);
    setShowSupplierModal(false);
    notify(`Đã lập thành công chứng từ ${newDoc.code} - Trả tiền NCC ${formatVND(data.totalAmount)}đ!`);
  };

  const handleCustomerCollection = (data: any) => {
    const gbcCode = `GBC${String(transactions.length + 12).padStart(5, "0")}`;
    const newDoc = {
      id: crypto.randomUUID(),
      dateHachToan: data.collectDate.split("-").reverse().join("/"),
      dateChungTu: data.collectDate.split("-").reverse().join("/"),
      code: gbcCode,
      description: `Thu tiền gửi từ khách hàng ${data.customer} theo hóa đơn`,
      amount: data.totalAmount,
      partner: data.customer,
      kind: "receipt",
      status: "posted",
      items: data.invoices.map((inv: any) => ({
        code: inv.voucherCode,
        name: inv.description,
        taxDesc: "Thu tiền khách hàng theo hóa đơn",
        taxRate: 0,
        taxAmount: 0,
        taxAccount: "131.1",
        invoiceCode: inv.invoiceCode || inv.voucherCode,
        invoiceDate: data.collectDate.split("-").reverse().join("/"),
      })),
    };
    setTransactions([newDoc, ...transactions]);
    setSelectedRowId(newDoc.id);
    setShowCustomerModal(false);
    notify(`Đã thu thành công ${formatVND(data.totalAmount)}đ từ ${data.customer} (${gbcCode})!`);
  };

  const handleMultiCustomerCollection = (data: any) => {
    const gbcCode = `GBC${String(transactions.length + 12).padStart(5, "0")}`;
    const newDoc = {
      id: crypto.randomUUID(),
      dateHachToan: data.collectDate.includes("/") ? data.collectDate : data.collectDate.split("-").reverse().join("/"),
      dateChungTu: data.collectDate.includes("/") ? data.collectDate : data.collectDate.split("-").reverse().join("/"),
      code: gbcCode,
      description: `Thu tiền gửi theo hóa đơn nhiều khách hàng (${data.invoices?.length || 0} hóa đơn)`,
      amount: data.totalAmount,
      partner: "Nhiều khách hàng",
      kind: "receipt",
      status: "posted",
      items: data.invoices.map((inv: any) => ({
        code: inv.voucherCode,
        name: inv.description,
        taxDesc: "Thu tiền khách hàng theo hóa đơn",
        taxRate: 0,
        taxAmount: 0,
        taxAccount: "131.1",
        invoiceCode: inv.invoiceCode || inv.voucherCode,
        invoiceDate: data.collectDate.includes("/") ? data.collectDate : data.collectDate.split("-").reverse().join("/"),
      })),
    };
    setTransactions([newDoc, ...transactions]);
    setSelectedRowId(newDoc.id);
    setShowMultiCustomerModal(false);
    notify(`Đã thu thành công ${formatVND(data.totalAmount)}đ từ nhiều khách hàng (${gbcCode})!`);
  };

  const handleInsurancePayment = (data: any) => {
    const uncCode = `UNC${String(transactions.length + 29).padStart(5, "0")}`;
    const newDoc = {
      id: crypto.randomUUID(),
      dateHachToan: data.payDate.split("-").reverse().join("/"),
      dateChungTu: data.payDate.split("-").reverse().join("/"),
      code: uncCode,
      description: `Ủy nhiệm chi nộp BHXH, BHYT, BHTN tháng 08/2026 - ${data.insuranceUnit}`,
      amount: data.totalAmount,
      partner: data.insuranceUnit,
      kind: "payment",
      status: "posted",
      items: [
        {
          code: "BHXH-01",
          name: "Trích nộp BHXH, BHYT, BHTN",
          taxDesc: "Nộp cơ quan bảo hiểm xã hội",
          taxRate: 0,
          taxAmount: 0,
          taxAccount: "3383",
          invoiceCode: "BH-T08",
          invoiceDate: data.payDate.split("-").reverse().join("/"),
        },
      ],
    };
    setTransactions([newDoc, ...transactions]);
    setSelectedRowId(newDoc.id);
    setShowInsuranceModal(false);
    notify(`Đã lập thành công chứng từ ${uncCode} - Nộp bảo hiểm ${formatVND(data.totalAmount)}đ!`);
  };

  const handleSalaryPayment = (data: any) => {
    const uncCode = `UNC${String(transactions.length + 29).padStart(5, "0")}`;
    const newDoc = {
      id: crypto.randomUUID(),
      dateHachToan: "15/09/2026",
      dateChungTu: "15/09/2026",
      code: uncCode,
      description: `Ủy nhiệm chi chi trả lương CBNV ${data.payrollPeriod} qua ngân hàng`,
      amount: data.totalAmount,
      partner: "Cán bộ công nhân viên công ty",
      kind: "payment",
      status: "posted",
      items: [
        {
          code: "LUONG-T08",
          name: `Chi trả lương CBNV (${data.employeeCount} nhân viên)`,
          taxDesc: "Chi trả lương qua tài khoản",
          taxRate: 0,
          taxAmount: 0,
          taxAccount: "3341",
          invoiceCode: "BL-T08",
          invoiceDate: "15/09/2026",
        },
      ],
    };
    setTransactions([newDoc, ...transactions]);
    setSelectedRowId(newDoc.id);
    setShowSalaryModal(false);
    notify(`Đã lập thành công chứng từ ${uncCode} - Chi lương ${formatVND(data.totalAmount)}đ!`);
  };

  const handleInternalTransfer = (data: any) => {
    const uncCode = `UNC${String(transactions.length + 29).padStart(5, "0")}`;
    const newDoc = {
      id: crypto.randomUUID(),
      dateHachToan: data.transferDate.split("-").reverse().join("/"),
      dateChungTu: data.transferDate.split("-").reverse().join("/"),
      code: uncCode,
      description: data.reason || `Chuyển tiền nội bộ từ ${data.sourceAccount} sang ${data.targetAccount}`,
      amount: data.amount,
      partner: data.targetAccount,
      kind: "transfer",
      status: "posted",
      items: [
        {
          code: "NB01",
          name: "Chuyển tiền nội bộ",
          taxDesc: "Chuyển tiền giữa các tài khoản",
          taxRate: 0,
          taxAmount: 0,
          taxAccount: "1121",
          invoiceCode: "NB-01",
          invoiceDate: data.transferDate.split("-").reverse().join("/"),
        },
      ],
    };
    setTransactions([newDoc, ...transactions]);
    setSelectedRowId(newDoc.id);
    setShowTransferModal(false);
    notify(`Đã thực hiện chuyển tiền nội bộ ${formatVND(data.amount)}đ!`);
  };

  const handleSaveLoanContract = (data: any) => {
    setShowLoanModal(false);
    notify(`Đã lưu thành công Khế ước cho vay ${data.code}!`);
  };

  const handleSaveBorrowContract = (data: any) => {
    setShowBorrowModal(false);
    notify(`Đã lưu thành công Khế ước đi vay ${data.code}!`);
  };

  const handleSaveCreditContract = (data: any) => {
    setCreditContractModalKind(null);
    notify(`Đã lưu thành công Hợp đồng tín dụng ${data.contractNum || ""}!`);
  };

  // Common Modals Renderer
  const renderModals = () => (
    <>
      {showCustomerModal && (
        <SingleCustomerInvoiceCollectionModal
          initialMethod="bank"
          onClose={() => setShowCustomerModal(false)}
          onSubmit={handleCustomerCollection}
        />
      )}

      {showMultiCustomerModal && (
        <MultiCustomerInvoiceCollectionModal
          initialMethod="bank"
          onClose={() => setShowMultiCustomerModal(false)}
          onSubmit={handleMultiCustomerCollection}
        />
      )}

      {showInsuranceModal && (
        <InsurancePaymentModal
          onClose={() => setShowInsuranceModal(false)}
          onSubmit={handleInsurancePayment}
        />
      )}

      {showSalaryModal && (
        <SalaryPaymentModal
          onClose={() => setShowSalaryModal(false)}
          onSubmit={handleSalaryPayment}
        />
      )}

      {showTransferModal && (
        <InternalTransferModal
          onClose={() => setShowTransferModal(false)}
          onSubmit={handleInternalTransfer}
        />
      )}

      {showExcelModal && (
        <ExcelImportModal
          onClose={() => setShowExcelModal(false)}
          onImportSuccess={(cnt) => {
            notify(`Đã nhập khẩu thành công ${cnt} chứng từ tiền gửi từ tệp Excel!`);
          }}
        />
      )}

      {showTaxModal && (
        <TaxPaymentModal
          onClose={() => setShowTaxModal(false)}
          onSubmit={handleTaxPayment}
        />
      )}

      {showSupplierModal && (
        <SupplierPaymentModal
          onClose={() => setShowSupplierModal(false)}
          onSubmit={handleSupplierPayment}
        />
      )}

      {showVoucherModal && (
        <AccountingVoucherModal
          voucher={selectedVoucher}
          onClose={() => setShowVoucherModal(false)}
        />
      )}

      {showCreateVoucher && (
        <CreateVoucherModal
          kind={showCreateVoucher}
          voucherCategory="bank"
          initialTypeIndex={createVoucherTypeIndex}
          onClose={() => {
            setShowCreateVoucher(null);
            setCreateVoucherTypeIndex(0);
          }}
          onSave={(doc) => {
            setTransactions([
              {
                id: doc.id,
                dateHachToan: doc.date.split("-").reverse().join("/"),
                dateChungTu: doc.date.split("-").reverse().join("/"),
                code: doc.code,
                description: doc.description,
                amount: doc.amount,
                partner: doc.partner,
                kind: doc.kind,
                status: "posted",
                items: [
                  {
                    code: "DV01",
                    name: doc.description,
                    taxDesc: "Thuế GTGT dịch vụ",
                    taxRate: 8,
                    taxAmount: 0,
                    taxAccount: "1331",
                    invoiceCode: "HD-0912",
                    invoiceDate: doc.date.split("-").reverse().join("/"),
                  },
                ],
              },
              ...transactions,
            ]);
            setShowCreateVoucher(null);
            setCreateVoucherTypeIndex(0);
            notify(`Đã lập thành công chứng từ tiền gửi ${doc.code}!`);
          }}
        />
      )}

      {showAIModal && (
        <AIAssistantModal
          onClose={() => setShowAIModal(false)}
          onApply={(doc) => {
            setShowAIModal(false);
            notify(`AVA Kế toán đã tạo dự thảo chứng từ chuyển khoản ${doc.code}.`);
          }}
        />
      )}

      {showLoanModal && (
        <LoanContractModal
          onClose={() => setShowLoanModal(false)}
          onSubmit={handleSaveLoanContract}
          onOpenCreditContract={() => setCreditContractModalKind("lending")}
        />
      )}

      {showBorrowModal && (
        <BorrowingContractModal
          onClose={() => setShowBorrowModal(false)}
          onSubmit={handleSaveBorrowContract}
          onOpenCreditContract={() => setCreditContractModalKind("borrowing")}
        />
      )}

      {creditContractModalKind && (
        <CreditContractModal
          kind={creditContractModalKind}
          onClose={() => setCreditContractModalKind(null)}
          onSubmit={handleSaveCreditContract}
        />
      )}
    </>
  );

  // --------------------------------------------------------------------
  // RENDER TAB: "Khế ước cho vay" & "Khế ước đi vay" (MATCHING SCREENSHOT 5)
  // --------------------------------------------------------------------
  if (tab === "loans" || tab === "borrowings") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        <CreditOverviewView
          type={tab === "loans" ? "loans" : "borrowings"}
          onOpenLoanModal={() => setShowLoanModal(true)}
          onOpenBorrowModal={() => setShowBorrowModal(true)}
          onOpenCreditContractModal={(k) => setCreditContractModalKind(k)}
          onOpenAIModal={() => setShowAIModal(true)}
          onOpenExcelModal={() => setShowExcelModal(true)}
          notify={notify}
        />
        {renderModals()}
      </div>
    );
  }

  // --------------------------------------------------------------------
  // RENDER TAB: "Thu, chi tiền" (MATCHING SCREENSHOT 4 & 5)
  // --------------------------------------------------------------------
  if (tab === "transactions" || tab === "all") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8fafc" }}>
        {/* AVA Kế toán Smart Analysis Banner (Image 4 & 5) */}
        {showAvaBanner && (
          <div
            style={{
              margin: "10px 14px 0 14px",
              background: "linear-gradient(135deg, #f5f3ff 0%, #eff6ff 100%)",
              border: "1px solid #e0e7ff",
              borderRadius: 8,
              padding: "10px 14px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            {/* Header row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
                    display: "grid",
                    placeItems: "center",
                    color: "#ffffff",
                  }}
                >
                  <Sparkles size={13} />
                </div>
                <strong style={{ fontSize: 13, color: "#4338ca" }}>AVA Kế toán</strong>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "#6b7280" }}>
                <span>Tháng 8 Số liệu tính đến: 15h56</span>
                <span
                  style={{ color: "#4f46e5", cursor: "pointer", display: "inline-flex", alignItems: "center" }}
                  onClick={() => setShowAIModal(true)}
                >
                  Xem tất cả &gt;
                </span>
                <button
                  type="button"
                  style={{ border: "none", background: "none", cursor: "pointer", color: "#9ca3af", padding: 0 }}
                  onClick={() => setShowAvaBanner(false)}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Analysis Grid (2 Columns matching Image 4 & 5) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Column 1: Dòng tiền thuần */}
              <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>Dòng tiền thuần</span>
                  <span
                    style={{ fontSize: 11, color: "#0284c7", cursor: "pointer" }}
                    onClick={() => notify("Mở phân tích chuyên sâu Dòng tiền thuần...")}
                  >
                    Phân tích chuyên sâu
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.4 }}>
                  Dòng tiền thuần <span style={{ color: "#dc2626", fontWeight: 600 }}>thâm hụt nghiêm trọng</span>, hệ số thu/chi = 0 lần, đang <span style={{ color: "#dc2626", fontWeight: 600 }}>mất đi</span> khả năng tự tài trợ vốn lưu động.
                </p>
              </div>

              {/* Column 2: Rủi ro & Khuyến nghị */}
              <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>Rủi ro &amp; Khuyến nghị</span>
                  <span
                    style={{ fontSize: 11, color: "#0284c7", cursor: "pointer" }}
                    onClick={() => notify("Mở phân tích chuyên sâu Rủi ro & Khuyến nghị...")}
                  >
                    Phân tích chuyên sâu
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.4 }}>
                  Nguy cơ <span style={{ color: "#dc2626", fontWeight: 600 }}>cạn kiệt</span> thanh khoản, đối mặt với nợ xấu. Bạn nên xem xét tìm kiếm nguồn vốn vay bổ sung.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 3 KPI Summary Cards (Image 4 & 5) */}
        {!kpiCollapsed && (
          <div className="misa-kpi-row" style={{ margin: "10px 14px 4px 14px" }}>
            {/* Card 1 */}
            <div
              className="misa-kpi-card"
              style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12, padding: "10px 14px" }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 8,
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  display: "grid",
                  placeItems: "center",
                  color: "#00b06b",
                  flexShrink: 0,
                }}
              >
                <Coins size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#334155", fontWeight: 500, marginBottom: 2 }}>
                  Tổng thu đầu năm đến hiện tại
                </div>
                <strong style={{ fontSize: 18, color: totalReceipt > 0 ? "#00b06b" : "#111827" }}>
                  {formatVND(totalReceipt)}
                </strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11.5, color: "#94a3b8" }}>
                <Clock size={12} />
                <span>15:12</span>
              </div>
            </div>

            {/* Card 2 */}
            <div
              className="misa-kpi-card"
              style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12, padding: "10px 14px" }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 8,
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  display: "grid",
                  placeItems: "center",
                  color: "#ea580c",
                  flexShrink: 0,
                }}
              >
                <Coins size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#334155", fontWeight: 500, marginBottom: 2 }}>
                  Tổng chi đầu năm đến hiện tại
                </div>
                <strong style={{ fontSize: 18, color: "#ea580c" }}>{formatVND(totalPayment)}</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11.5, color: "#94a3b8" }}>
                <Clock size={12} />
                <span>15:12</span>
              </div>
            </div>

            {/* Card 3 */}
            <div
              className="misa-kpi-card highlight"
              style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12, padding: "10px 14px" }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 8,
                  background: "#f3e8ff",
                  border: "1px solid #ddd6fe",
                  display: "grid",
                  placeItems: "center",
                  color: "#7e22ce",
                  flexShrink: 0,
                }}
              >
                <Landmark size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#334155", fontWeight: 500, marginBottom: 2 }}>
                  Số dư tiền gửi đến ngày 09/09/2026
                </div>
                <strong style={{ fontSize: 18, color: "#00b06b" }}>{formatVND(currentBalance)}</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11.5, color: "#94a3b8" }}>
                <Clock size={12} />
                <span>15:12</span>
              </div>
            </div>
          </div>
        )}

        {/* Center Collapse/Expand Button for KPI strip */}
        <div style={{ display: "flex", justifyContent: "center", background: "#ffffff", borderBottom: "1px solid #e5e7eb", paddingBottom: 2 }}>
          <button
            type="button"
            onClick={() => setKpiCollapsed(!kpiCollapsed)}
            style={{
              width: 32,
              height: 16,
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderBottom: "none",
              borderRadius: "6px 6px 0 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748b",
              boxShadow: "0 -1px 2px rgba(0,0,0,0.04)",
            }}
            title={kpiCollapsed ? "Mở rộng thẻ chỉ số" : "Thu gọn thẻ chỉ số"}
          >
            {kpiCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
        </div>

        {/* Click outside backdrop for toolbar dropdowns */}
        {activeToolbarMenu && (
          <div
            style={{ position: "fixed", inset: 0, zIndex: 18 }}
            onClick={() => setActiveToolbarMenu(null)}
          />
        )}

        {/* Action Toolbar (Exact layout from user screenshot) */}
        <div
          className="misa-toolbar"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 14px",
            background: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
            position: "relative",
            zIndex: 19,
            gap: 8,
          }}
        >
          {/* Left Controls: Search, Loại phiếu, Period, Utility Icons */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* Search Box */}
            <div style={{ position: "relative", width: 200 }}>
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: 9,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#8b5cf6",
                }}
              />
              <input
                type="text"
                placeholder="Tìm kiếm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  height: 32,
                  paddingLeft: 28,
                  paddingRight: 8,
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  fontSize: 13,
                  outline: "none",
                  background: "#ffffff",
                }}
              />
            </div>

            {/* Loại chứng từ dropdown */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                height: 32,
                padding: "0 8px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 13,
                background: "#ffffff",
                color: "#334155",
                cursor: "pointer",
              }}
              aria-label="Lọc theo trạng thái"
            >
              <option value="all">Loại phiếu: Tất cả</option>
              <option value="receipt">Loại phiếu: Thu tiền</option>
              <option value="payment">Loại phiếu: Chi tiền (UNC)</option>
              <option value="transfer">Loại phiếu: Chuyển tiền nội bộ</option>
            </select>

            {/* Period select: Đầu năm tới hiện tại */}
            <select
              defaultValue="ytd"
              style={{
                height: 32,
                padding: "0 8px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                color: "#334155",
                background: "#ffffff",
                cursor: "pointer",
                boxSizing: "border-box",
              }}
            >
              <option value="ytd">Kỳ: Đầu năm tới hiện tại</option>
              <option value="month">Kỳ: Tháng này</option>
              <option value="quarter">Kỳ: Quý này</option>
              <option value="year">Kỳ: Năm nay</option>
            </select>

            {/* Icon buttons group */}
            <button
              type="button"
              className="misa-tax-icon-btn"
              title="Gợi ý thông minh / AI Insights"
              onClick={() => setShowAIModal(true)}
              style={{
                width: 32,
                height: 32,
                border: "1px solid #d1d5db",
                borderRadius: 6,
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                color: "#8b5cf6",
                cursor: "pointer",
              }}
            >
              <Sparkles size={15} />
            </button>

            <button
              type="button"
              className="misa-tax-icon-btn"
              title="Làm mới dữ liệu"
              onClick={() => notify("Đã cập nhật danh sách tiền gửi.")}
              style={{
                width: 32,
                height: 32,
                border: "1px solid #d1d5db",
                borderRadius: 6,
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                color: "#64748b",
                cursor: "pointer",
              }}
            >
              <RefreshCw size={15} />
            </button>

            <button
              type="button"
              className="misa-tax-icon-btn"
              title="Tùy chọn điều chuyển / sắp xếp"
              onClick={() => notify("Tùy chọn hiển thị chứng từ.")}
              style={{
                width: 32,
                height: 32,
                border: "1px solid #d1d5db",
                borderRadius: 6,
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                color: "#64748b",
                cursor: "pointer",
              }}
            >
              <SlidersHorizontal size={15} />
            </button>

            <button
              type="button"
              className="misa-tax-icon-btn"
              title="Xuất khẩu / Nhập khẩu"
              onClick={() => notify("Đã xuất khẩu danh sách ra Excel.")}
              style={{
                width: 32,
                height: 32,
                border: "1px solid #d1d5db",
                borderRadius: 6,
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                color: "#64748b",
                cursor: "pointer",
              }}
            >
              <FileSpreadsheet size={15} />
            </button>

            <button
              type="button"
              className="misa-tax-icon-btn"
              title="Tùy chọn cột và thiết lập"
              onClick={() => notify("Mở thiết lập cột.")}
              style={{
                width: 32,
                height: 32,
                border: "1px solid #d1d5db",
                borderRadius: 6,
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                color: "#64748b",
                cursor: "pointer",
              }}
            >
              <Settings size={15} />
            </button>

            <button
              type="button"
              className="misa-filter-btn"
              title="Bộ lọc nâng cao"
              onClick={() => notify("Mở bộ lọc nâng cao")}
              style={{
                width: 32,
                height: 32,
                border: "1px solid #d1d5db",
                borderRadius: 6,
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                color: "#64748b",
                cursor: "pointer",
              }}
            >
              <Filter size={15} />
            </button>
          </div>

          {/* Right Buttons: Thêm bằng AI, Thu tiền, Chi tiền */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {/* Thêm bằng AI Button */}
            <button
              type="button"
              onClick={() => setShowAIModal(true)}
              style={{
                height: 32,
                padding: "0 12px",
                background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: 6,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(99, 102, 241, 0.25)",
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.25)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Sparkles size={12} />
              </div>
              Thêm bằng AI
            </button>

            {/* Thêm thu tiền Dropdown Button (Matching Screenshot 3) */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() =>
                  setActiveToolbarMenu((prev) => (prev === "receipt" ? null : "receipt"))
                }
                style={{
                  height: 32,
                  padding: "0 14px",
                  background: "#00b06b",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 6,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(0, 176, 107, 0.3)",
                }}
              >
                <span>Thêm thu tiền</span>
                <ChevronDown size={14} />
              </button>

              {activeToolbarMenu === "receipt" && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    right: 0,
                    minWidth: 220,
                    background: "#ffffff",
                    borderRadius: 8,
                    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.12)",
                    border: "1px solid #e2e8f0",
                    padding: "6px 0",
                    zIndex: 50,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{ position: "relative" }}
                    onMouseEnter={() => setShowBankReceiptSubmenu(true)}
                    onMouseLeave={() => setShowBankReceiptSubmenu(false)}
                  >
                    <button
                      type="button"
                      style={{
                        textAlign: "left",
                        padding: "10px 18px",
                        border: "none",
                        background: showBankReceiptSubmenu ? "#f1f5f9" : "transparent",
                        fontSize: 13.5,
                        color: "#1e293b",
                        cursor: "pointer",
                        width: "100%",
                        fontFamily: "inherit",
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                      onClick={() => {
                        setActiveToolbarMenu(null);
                        setShowBankReceiptSubmenu(false);
                        setCreateVoucherTypeIndex(0);
                        setShowCreateVoucher("receipt");
                      }}
                    >
                      <span>Thu tiền</span>
                      <ChevronRight size={14} style={{ color: "#94a3b8" }} />
                    </button>

                    {showBankReceiptSubmenu && (
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          right: "100%",
                          minWidth: 260,
                          background: "#ffffff",
                          borderRadius: 8,
                          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
                          border: "1px solid #e2e8f0",
                          padding: "6px 0",
                          zIndex: 60,
                        }}
                      >
                        {MISA_BANK_RECEIPT_TYPES.map((t, idx) => (
                          <button
                            key={t.id}
                            type="button"
                            style={{
                              textAlign: "left",
                              padding: "8px 16px",
                              border: "none",
                              background: "transparent",
                              fontSize: 13,
                              color: "#1e293b",
                              cursor: "pointer",
                              width: "100%",
                              fontFamily: "inherit",
                              whiteSpace: "nowrap",
                              display: "block",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#dbece2";
                              e.currentTarget.style.color = "#047857";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                              e.currentTarget.style.color = "#1e293b";
                            }}
                            onClick={() => {
                              setActiveToolbarMenu(null);
                              setShowBankReceiptSubmenu(false);
                              setCreateVoucherTypeIndex(idx);
                              setShowCreateVoucher("receipt");
                            }}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    style={{
                      textAlign: "left",
                      padding: "10px 18px",
                      border: "none",
                      background: "transparent",
                      fontSize: 13.5,
                      color: "#1e293b",
                      cursor: "pointer",
                      width: "100%",
                      fontFamily: "inherit",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={() => {
                      setActiveToolbarMenu(null);
                      setShowCustomerModal(true);
                    }}
                  >
                    Thu tiền theo hóa đơn
                  </button>
                  <button
                    type="button"
                    style={{
                      textAlign: "left",
                      padding: "10px 18px",
                      border: "none",
                      background: "transparent",
                      fontSize: 13.5,
                      color: "#1e293b",
                      cursor: "pointer",
                      width: "100%",
                      fontFamily: "inherit",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={() => {
                      setActiveToolbarMenu(null);
                      setShowMultiCustomerModal(true);
                    }}
                  >
                    Thu tiền theo nhiều hóa đơn
                  </button>
                </div>
              )}
              {activeToolbarMenu && (
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 40 }}
                  onClick={() => setActiveToolbarMenu(null)}
                />
              )}
            </div>

            {/* Thêm chi tiền Dropdown Button (Matching Screenshot 4) */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() =>
                  setActiveToolbarMenu((prev) => (prev === "payment" ? null : "payment"))
                }
                style={{
                  height: 32,
                  padding: "0 14px",
                  background: "#00b06b",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 6,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(0, 176, 107, 0.3)",
                }}
              >
                <span>Thêm chi tiền</span>
                <ChevronDown size={14} />
              </button>

              {activeToolbarMenu === "payment" && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    right: 0,
                    minWidth: 220,
                    background: "#ffffff",
                    borderRadius: 8,
                    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.12)",
                    border: "1px solid #e2e8f0",
                    padding: "6px 0",
                    zIndex: 50,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{ position: "relative" }}
                    onMouseEnter={() => setShowBankPaymentSubmenu(true)}
                    onMouseLeave={() => setShowBankPaymentSubmenu(false)}
                  >
                    <button
                      type="button"
                      style={{
                        textAlign: "left",
                        padding: "10px 18px",
                        border: "none",
                        background: showBankPaymentSubmenu ? "#f1f5f9" : "transparent",
                        fontSize: 13.5,
                        color: "#1e293b",
                        cursor: "pointer",
                        width: "100%",
                        fontFamily: "inherit",
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                      onClick={() => {
                        setActiveToolbarMenu(null);
                        setShowBankPaymentSubmenu(false);
                        setCreateVoucherTypeIndex(0);
                        setShowCreateVoucher("payment");
                      }}
                    >
                      <span>Chi tiền</span>
                      <ChevronRight size={14} style={{ color: "#64748b" }} />
                    </button>

                    {showBankPaymentSubmenu && (
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          right: "100%",
                          marginRight: 4,
                          minWidth: 320,
                          background: "#ffffff",
                          borderRadius: 8,
                          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
                          border: "1px solid #e2e8f0",
                          padding: "6px 0",
                          zIndex: 60,
                        }}
                      >
                        {MISA_BANK_PAYMENT_TYPES.map((t, idx) => (
                          <button
                            key={t.id}
                            type="button"
                            style={{
                              textAlign: "left",
                              padding: "8px 16px",
                              border: "none",
                              background: "transparent",
                              fontSize: 13,
                              color: "#1e293b",
                              cursor: "pointer",
                              width: "100%",
                              fontFamily: "inherit",
                              whiteSpace: "nowrap",
                              display: "block",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#dbece2";
                              e.currentTarget.style.color = "#047857";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                              e.currentTarget.style.color = "#1e293b";
                            }}
                            onClick={() => {
                              setActiveToolbarMenu(null);
                              setShowBankPaymentSubmenu(false);
                              setCreateVoucherTypeIndex(idx);
                              setShowCreateVoucher("payment");
                            }}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    style={{
                      textAlign: "left",
                      padding: "10px 18px",
                      border: "none",
                      background: "transparent",
                      fontSize: 13.5,
                      color: "#1e293b",
                      cursor: "pointer",
                      width: "100%",
                      fontFamily: "inherit",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={() => {
                      setActiveToolbarMenu(null);
                      setShowSupplierModal(true);
                    }}
                  >
                    Trả tiền theo hóa đơn
                  </button>
                  <button
                    type="button"
                    style={{
                      textAlign: "left",
                      padding: "10px 18px",
                      border: "none",
                      background: "transparent",
                      fontSize: 13.5,
                      color: "#1e293b",
                      cursor: "pointer",
                      width: "100%",
                      fontFamily: "inherit",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={() => {
                      setActiveToolbarMenu(null);
                      setShowTaxModal(true);
                    }}
                  >
                    Nộp thuế
                  </button>
                  <button
                    type="button"
                    style={{
                      textAlign: "left",
                      padding: "10px 18px",
                      border: "none",
                      background: "transparent",
                      fontSize: 13.5,
                      color: "#1e293b",
                      cursor: "pointer",
                      width: "100%",
                      fontFamily: "inherit",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={() => {
                      setActiveToolbarMenu(null);
                      setShowInsuranceModal(true);
                    }}
                  >
                    Nộp bảo hiểm
                  </button>
                  <button
                    type="button"
                    style={{
                      textAlign: "left",
                      padding: "10px 18px",
                      border: "none",
                      background: "transparent",
                      fontSize: 13.5,
                      color: "#1e293b",
                      cursor: "pointer",
                      width: "100%",
                      fontFamily: "inherit",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={() => {
                      setActiveToolbarMenu(null);
                      setShowSalaryModal(true);
                    }}
                  >
                    Trả lương
                  </button>
                </div>
              )}
              {activeToolbarMenu && (
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 40 }}
                  onClick={() => setActiveToolbarMenu(null)}
                />
              )}
            </div>
          </div>
        </div>

        {/* Master Table (Image 4 & 5) */}
        <div style={{ flex: 1, minHeight: 220, overflow: "auto", background: "#ffffff", borderBottom: "1px solid #e5e7eb" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 36, textAlign: "center", padding: "8px 4px" }}>
                  <input type="checkbox" style={{ accentColor: "#00b06b" }} />
                </th>
                <th style={{ width: 110, textAlign: "left", padding: "8px 10px" }}>Ngày hạch toán</th>
                <th style={{ width: 110, textAlign: "left", padding: "8px 10px" }}>Ngày chứng từ</th>
                <th style={{ width: 100, textAlign: "left", padding: "8px 10px" }}>Số chứng từ</th>
                <th style={{ textAlign: "left", padding: "8px 10px" }}>Diễn giải</th>
                <th style={{ width: 110, textAlign: "right", padding: "8px 10px" }}>Số tiền</th>
                <th style={{ width: 230, textAlign: "left", padding: "8px 10px" }}>Đối tượng</th>
                <th style={{ width: 95, textAlign: "center", padding: "8px 10px" }}>Chức năng</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => {
                const isSelected = tx.id === selectedRowId;
                return (
                  <tr
                    key={tx.id}
                    onClick={() => setSelectedRowId(tx.id)}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      background: isSelected ? "rgba(0, 176, 107, 0.08)" : "#ffffff",
                      cursor: "pointer",
                    }}
                  >
                    <td style={{ textAlign: "center", padding: "8px 4px" }}>
                      <input type="checkbox" checked={isSelected} onChange={() => setSelectedRowId(tx.id)} />
                    </td>
                    <td style={{ padding: "8px 10px", color: "#374151" }}>{tx.dateHachToan}</td>
                    <td style={{ padding: "8px 10px", color: "#374151" }}>{tx.dateChungTu}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <span
                        style={{ color: "#0284c7", fontWeight: 600, cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVoucher({
                            code: tx.code,
                            date: "2026-09-02",
                            person: tx.partner,
                            address: "Hà Nội",
                            reason: tx.description,
                            debitAccount: "6427",
                            creditAccount: "1121",
                            amount: tx.amount,
                            amountInWords: "Hai triệu ba trăm mười bảy nghìn đồng chẵn",
                            notes: "Kèm theo Hóa đơn điện tử số 34221 ngày 02/09/2026",
                            chiefAccountant: "Trương Thị B",
                            director: "Nguyễn Văn A",
                          });
                          setShowVoucherModal(true);
                        }}
                      >
                        {tx.code}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px", color: "#1f2937" }}>{tx.description}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>
                      {formatVND(tx.amount)}
                    </td>
                    <td style={{ padding: "8px 10px", color: "#374151" }}>{tx.partner}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <span
                        style={{ color: "#0284c7", cursor: "pointer", marginRight: 6 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVoucher({
                            code: tx.code,
                            date: "2026-09-02",
                            person: tx.partner,
                            address: "Hà Nội",
                            reason: tx.description,
                            debitAccount: "6427",
                            creditAccount: "1121",
                            amount: tx.amount,
                            amountInWords: "Hai triệu ba trăm mười bảy nghìn đồng chẵn",
                            notes: "Kèm theo Hóa đơn điện tử số 34221",
                            chiefAccountant: "Trương Thị B",
                            director: "Nguyễn Văn A",
                          });
                          setShowVoucherModal(true);
                        }}
                      >
                        Xem
                      </span>
                      <ChevronDown size={13} style={{ display: "inline", color: "#0284c7" }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "#f8fafc", fontWeight: 700, borderTop: "2px solid #e2e8f0" }}>
                <td colSpan={4} style={{ padding: "10px", textAlign: "left" }}>
                  Tổng
                </td>
                <td style={{ padding: "10px", textAlign: "left" }}>Cộng</td>
                <td style={{ padding: "10px", textAlign: "right" }}>{formatVND(totalPayment)}</td>
                <td></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Master Table Pagination */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 14px",
            background: "#ffffff",
            borderBottom: "1px solid #e5e7eb",
            fontSize: 12,
            color: "#6b7280",
          }}
        >
          <div>
            Tổng số: <strong>{filteredTransactions.length}</strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span>Số dòng/trang</span>
            <select style={{ height: 26, borderRadius: 4, border: "1px solid #d1d5db", fontSize: 12 }}>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
            <div style={{ display: "flex", gap: 4 }}>
              <button type="button" style={{ border: "none", background: "none", cursor: "pointer" }}>|&lt;</button>
              <button type="button" style={{ border: "none", background: "none", cursor: "pointer" }}>&lt;</button>
              <span style={{ fontWeight: 600, color: "#111827", padding: "0 6px" }}>1</span>
              <button type="button" style={{ border: "none", background: "none", cursor: "pointer" }}>&gt;</button>
              <button type="button" style={{ border: "none", background: "none", cursor: "pointer" }}>&gt;|</button>
            </div>
          </div>
        </div>

        {/* Split Detail Pane (Image 4 & 5) */}
        {selectedTransaction && (
          <div style={{ height: detailExpanded ? 240 : 40, background: "#ffffff", display: "flex", flexDirection: "column", transition: "height 0.2s ease" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 14px",
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
                borderBottom: "1px solid #e2e8f0",
                cursor: "pointer",
              }}
              onClick={() => setDetailExpanded(!detailExpanded)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <strong style={{ fontSize: 12, color: "#1e293b" }}>Chi tiết</strong>
                <ChevronDown
                  size={14}
                  style={{
                    transform: detailExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </div>
              <span style={{ fontSize: 11, color: "#64748b" }}>
                {selectedTransaction.code} - {selectedTransaction.partner}
              </span>
            </div>

            {detailExpanded && (
              <div style={{ flex: 1, overflow: "auto" }}>
                <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                      <th style={{ width: 36, textAlign: "center", padding: "8px 4px" }}>#</th>
                      <th style={{ width: 100, textAlign: "left", padding: "8px 10px" }}>Mã hàng</th>
                      <th style={{ textAlign: "left", padding: "8px 10px" }}>Tên dịch vụ</th>
                      <th style={{ textAlign: "left", padding: "8px 10px" }}>Diễn giải thuế</th>
                      <th style={{ width: 85, textAlign: "right", padding: "8px 10px" }}>% thuế GTGT</th>
                      <th style={{ width: 110, textAlign: "right", padding: "8px 10px" }}>Tiền thuế GTGT</th>
                      <th style={{ width: 95, textAlign: "center", padding: "8px 10px" }}>TK thuế GTGT</th>
                      <th style={{ width: 95, textAlign: "left", padding: "8px 10px" }}>Số hóa đơn</th>
                      <th style={{ width: 95, textAlign: "left", padding: "8px 10px" }}>Ngày hóa đơn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTransaction.items.map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ textAlign: "center", padding: "8px 4px", color: "#6b7280" }}>{idx + 1}</td>
                        <td style={{ padding: "8px 10px", fontWeight: 600, color: "#1e293b" }}>{it.code}</td>
                        <td style={{ padding: "8px 10px", color: "#1f2937" }}>{it.name}</td>
                        <td style={{ padding: "8px 10px", color: "#4b5563" }}>{it.taxDesc}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right" }}>{it.taxRate}%</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>{formatVND(it.taxAmount)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "center" }}>{it.taxAccount}</td>
                        <td style={{ padding: "8px 10px", color: "#0284c7" }}>{it.invoiceCode}</td>
                        <td style={{ padding: "8px 10px", color: "#374151" }}>{it.invoiceDate}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={9}>Tổng số: {selectedTransaction.items.length} dòng</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* MODALS */}
        {renderModals()}
      </div>
    );
  }

  // --------------------------------------------------------------------
  // RENDER TAB: "Quy trình" (Exact flowchart matching Image 2 & 3)
  // --------------------------------------------------------------------
  return (
    <div
      className="ref-process-wrapper"
      style={{
        background: "#f1f5f9",
        minHeight: "100%",
        padding: "24px 28px",
        overflowY: "auto",
      }}
    >
      <div
        className="ref-process-layout"
        style={{
          maxWidth: 1080,
          display: "grid",
          gridTemplateColumns: "minmax(0, 2.3fr) minmax(250px, 1fr)",
          gap: 14,
          margin: "0 auto",
        }}
      >
        {/* Panel 1: NGHIỆP VỤ TIỀN GỬI (Flowchart canvas) */}
        <section
          className="ref-process-panel"
          style={{
            background: "#ffffff",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            overflow: "visible",
            position: "relative",
            zIndex: 20,
          }}
        >
          <h2
            style={{
              fontSize: 13,
              fontWeight: 700,
              textAlign: "center",
              margin: 0,
              padding: "14px 10px",
              borderBottom: "1px solid #f1f5f9",
              color: "#1e293b",
              letterSpacing: "0.5px",
            }}
          >
            NGHIỆP VỤ TIỀN GỬI
          </h2>

          <div
            className="ref-process-canvas"
            style={{
              position: "relative",
              height: 310,
              margin: "0 10px",
              overflow: "visible",
            }}
          >
            {/* SVG Connecting Flow Lines with Arrows (Image 2 & 3) */}
            <svg
              className="ref-flow-lines"
              viewBox="0 0 600 300"
              preserveAspectRatio="none"
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                overflow: "visible",
              }}
            >
              <defs>
                <marker
                  id="ref-arrow-bank"
                  markerWidth="7"
                  markerHeight="7"
                  refX="6"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 7 3.5, 0 7" fill="#94a3b8" />
                </marker>
              </defs>

              {/* 1. Horizontal arrow from Đề nghị chi tiền to Chi tiền */}
              <path
                d="M 125 188 L 195 188"
                stroke="#cbd5e1"
                strokeWidth="1.5"
                fill="none"
                markerEnd="url(#ref-arrow-bank)"
              />

              {/* 2. Vertical T-junction line between Thu tiền and Chi tiền */}
              <path
                d="M 245 92 L 245 188"
                stroke="#cbd5e1"
                strokeWidth="1.5"
                fill="none"
              />
              <path
                d="M 240 92 L 250 92 M 240 188 L 250 188"
                stroke="#cbd5e1"
                strokeWidth="1.5"
                fill="none"
              />

              {/* 3. Horizontal branch from midpoint between Thu and Chi to Đối chiếu ngân hàng */}
              <path
                d="M 245 140 L 350 140"
                stroke="#cbd5e1"
                strokeWidth="1.5"
                fill="none"
                markerEnd="url(#ref-arrow-bank)"
              />

              {/* 4. Horizontal arrow going right from Đối chiếu ngân hàng */}
              <path
                d="M 450 140 L 525 140"
                stroke="#cbd5e1"
                strokeWidth="1.5"
                fill="none"
                markerEnd="url(#ref-arrow-bank)"
              />
            </svg>

            {/* Click outside backdrop for flowchart menus */}
            {activeFlowchartMenu && (
              <div
                style={{ position: "fixed", inset: 0, zIndex: 18 }}
                onClick={() => setActiveFlowchartMenu(null)}
              />
            )}

            {/* Node 1: Đề nghị chi tiền (Left, aligned with Chi tiền) */}
            <div
              style={{
                position: "absolute",
                left: 30,
                top: 145,
                width: 100,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                cursor: "pointer",
                textAlign: "center",
                zIndex: 2,
              }}
              onClick={() => {
                notify("Chuyển tới chức năng Đề nghị chi tiền...");
              }}
              title="Đề nghị chi tiền"
            >
              <span className="ref-business-icon request" style={{ marginBottom: 6 }}>
                <span
                  className="ref-document-sheet"
                  style={{
                    background: "linear-gradient(90deg, #10b981, #059669)",
                    border: "1px solid #34d399",
                  }}
                >
                  <b style={{ color: "#ffffff", fontWeight: 800 }}>ĐN</b>
                  <i /><i /><i />
                </span>
                <span
                  className="ref-gold-icon"
                  style={{ background: "#f59e0b", borderColor: "#fbbf24" }}
                >
                  <ArrowRight size={14} strokeWidth={2.5} />
                </span>
              </span>
              <span style={{ fontSize: 11.5, color: "#334155", fontWeight: 500, lineHeight: 1.3 }}>
                Đề nghị chi tiền
              </span>
            </div>

            {/* Node 2: Thu tiền (Top Center) */}
            <div
              style={{
                position: "absolute",
                left: 195,
                top: 25,
                width: 100,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                zIndex: activeFlowchartMenu === "receipt" ? 60 : 10,
              }}
              onMouseEnter={() => handleFlowchartMouseEnter("receipt")}
              onMouseLeave={handleFlowchartMouseLeave}
            >
              <div
                style={{
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
                onClick={() => setActiveFlowchartMenu((prev) => (prev === "receipt" ? null : "receipt"))}
                title="Lập chứng từ thu tiền gửi"
              >
                {/* MISA Banknote Icon: THU */}
                <span className="ref-business-icon receive" style={{ marginBottom: 6 }}>
                  <span className="ref-document-sheet" style={{ background: "linear-gradient(90deg, #10b981, #059669)", border: "1px solid #34d399" }}>
                    <b style={{ color: "#ffffff", fontWeight: 800 }}>THU</b>
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="ref-gold-icon" style={{ background: "#f59e0b", borderColor: "#fbbf24" }}>
                    <Coins size={16} />
                  </span>
                </span>
                <span style={{ fontSize: 11.5, color: "#334155", fontWeight: 500 }}>
                  Thu tiền
                </span>
              </div>

              {/* Action Dropdown */}
              {activeFlowchartMenu === "receipt" && (
                <div
                  className="ref-action-options"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    minWidth: 240,
                    zIndex: 100,
                    background: "#ffffff",
                    boxShadow: "0 12px 28px rgba(0,0,0,0.18), 0 3px 8px rgba(0,0,0,0.06)",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    padding: "4px 0",
                  }}
                  onMouseEnter={() => handleFlowchartMouseEnter("receipt")}
                  onMouseLeave={handleFlowchartMouseLeave}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlowchartMenu(null);
                      setShowCreateVoucher("receipt");
                    }}
                  >
                    Thu tiền
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlowchartMenu(null);
                      setShowCustomerModal(true);
                    }}
                  >
                    Thu tiền theo hóa đơn
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlowchartMenu(null);
                      setShowMultiCustomerModal(true);
                    }}
                  >
                    Thu tiền theo hóa đơn nhiều khách hàng
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlowchartMenu(null);
                      setShowTransferModal(true);
                    }}
                  >
                    Chuyển tiền nội bộ
                  </button>
                </div>
              )}
            </div>

            {/* Node 3: Chi tiền (Bottom Center) */}
            <div
              style={{
                position: "absolute",
                left: 195,
                top: 145,
                width: 100,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                zIndex: activeFlowchartMenu === "payment" ? 60 : 10,
              }}
              onMouseEnter={() => handleFlowchartMouseEnter("payment")}
              onMouseLeave={handleFlowchartMouseLeave}
            >
              <div
                style={{
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
                onClick={() => setActiveFlowchartMenu((prev) => (prev === "payment" ? null : "payment"))}
                title="Lập chứng từ chi tiền gửi (Ủy nhiệm chi)"
              >
                {/* MISA Banknote Icon: CHI */}
                <span className="ref-business-icon pay" style={{ marginBottom: 6 }}>
                  <span className="ref-document-sheet" style={{ background: "linear-gradient(90deg, #10b981, #059669)", border: "1px solid #34d399" }}>
                    <b style={{ color: "#ffffff", fontWeight: 800 }}>CHI</b>
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="ref-gold-icon" style={{ background: "#ea580c", borderColor: "#f97316" }}>
                    <Coins size={16} />
                  </span>
                </span>
                <span style={{ fontSize: 11.5, color: "#334155", fontWeight: 500 }}>
                  Chi tiền
                </span>
              </div>

              {/* Action Dropdown */}
              {activeFlowchartMenu === "payment" && (
                <div
                  className="ref-action-options"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    minWidth: 240,
                    zIndex: 100,
                    background: "#ffffff",
                    boxShadow: "0 12px 28px rgba(0,0,0,0.18), 0 3px 8px rgba(0,0,0,0.06)",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    padding: "4px 0",
                  }}
                  onMouseEnter={() => handleFlowchartMouseEnter("payment")}
                  onMouseLeave={handleFlowchartMouseLeave}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlowchartMenu(null);
                      setShowCreateVoucher("payment");
                    }}
                  >
                    Chi tiền
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlowchartMenu(null);
                      setShowSupplierModal(true);
                    }}
                  >
                    Trả tiền theo hóa đơn
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlowchartMenu(null);
                      setShowTaxModal(true);
                    }}
                  >
                    Nộp thuế
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlowchartMenu(null);
                      setShowInsuranceModal(true);
                    }}
                  >
                    Nộp bảo hiểm
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlowchartMenu(null);
                      setShowSalaryModal(true);
                    }}
                  >
                    Trả lương
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlowchartMenu(null);
                      setShowTransferModal(true);
                    }}
                  >
                    Chuyển tiền nội bộ
                  </button>
                </div>
              )}
            </div>

            {/* Node 4: Đối chiếu ngân hàng (Right, middle vertical) */}
            <div
              style={{
                position: "absolute",
                left: 350,
                top: 96,
                width: 100,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                cursor: "pointer",
                textAlign: "center",
                zIndex: 2,
              }}
              onClick={() => {
                notify("Chuyển tới tính năng Đối chiếu ngân hàng...");
              }}
              title="Đối chiếu ngân hàng"
            >
              <span className="ref-business-icon reconcile" style={{ marginBottom: 6 }}>
                <span
                  className="ref-document-sheet"
                  style={{
                    background: "linear-gradient(90deg, #10b981, #059669)",
                    border: "1px solid #34d399",
                  }}
                >
                  <b style={{ color: "#ffffff", fontWeight: 800 }}>ĐC</b>
                  <i /><i /><i />
                </span>
                <span
                  className="ref-gold-icon"
                  style={{ background: "#f59e0b", borderColor: "#fbbf24" }}
                >
                  <FileCheck size={15} />
                </span>
              </span>
              <span style={{ fontSize: 11.5, color: "#334155", fontWeight: 500, lineHeight: 1.3 }}>
                Đối chiếu ngân hàng
              </span>
            </div>
          </div>
        </section>

        {/* Panel 2: BÁO CÁO (Right Column matching Image 2 & 3) */}
        <aside
          className="ref-process-reports"
          style={{
            background: "#ffffff",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <h2
            style={{
              fontSize: 13,
              fontWeight: 700,
              textAlign: "center",
              margin: 0,
              padding: "14px 10px",
              borderBottom: "1px solid #f1f5f9",
              color: "#1e293b",
              letterSpacing: "0.5px",
            }}
          >
            BÁO CÁO
          </h2>
          <ul
            style={{
              padding: "8px 16px",
              margin: 0,
              flex: 1,
              display: "flex",
              flexDirection: "column",
              listStyle: "none",
            }}
          >
            {[
              "Bảng kê chứng từ theo khế ước cho vay",
              "Bảng kê chứng từ theo khế ước vay",
              "Bảng kê số dư ngân hàng",
              "Bảng kê số dư tiền theo ngày",
              "Báo cáo tổng hợp tình hình khế ước cho vay",
            ].map((repName) => (
              <li
                key={repName}
                style={{
                  borderBottom: "1px solid #f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  minHeight: 46,
                  fontSize: 12,
                  color: "#334155",
                  padding: "6px 0 6px 14px",
                  position: "relative",
                  cursor: "pointer",
                }}
                onClick={() => notify(`Mở báo cáo: ${repName}`)}
              >
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: "#000000",
                  }}
                />
                <span style={{ transition: "color 0.15s ease" }} className="hover-link">
                  {repName}
                </span>
              </li>
            ))}
          </ul>
          <div
            style={{
              textAlign: "center",
              padding: "12px",
              borderTop: "1px solid #f1f5f9",
            }}
          >
            <span
              style={{
                color: "#0284c7",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
              onClick={() => notify("Mở tất cả báo cáo tiền gửi...")}
            >
              Tất cả báo cáo
            </span>
          </div>
        </aside>

        {/* Panel 3: Master Data / Shortcuts (Middle row spanning 100%) */}
        <div
          className="ref-shortcuts"
          style={{
            gridColumn: "1 / -1",
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            background: "#ffffff",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            position: "relative",
            zIndex: 1,
          }}
        >
          <button
            type="button"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "14px 8px",
              background: "#ffffff",
              border: "none",
              borderRight: "1px solid #f1f5f9",
              cursor: "pointer",
              fontSize: 12,
              color: "#334155",
            }}
            onClick={() => notify("Mở danh mục Tài khoản ngân hàng")}
          >
            <CreditCard size={20} style={{ color: "#00b06b" }} />
            <span>Tài khoản ngân hàng</span>
          </button>

          <button
            type="button"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "14px 8px",
              background: "#ffffff",
              border: "none",
              borderRight: "1px solid #f1f5f9",
              cursor: "pointer",
              fontSize: 12,
              color: "#334155",
            }}
            onClick={() => setShowCustomerModal(true)}
          >
            <UserRound size={20} style={{ color: "#f59e0b" }} />
            <span>Khách hàng</span>
          </button>

          <button
            type="button"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "14px 8px",
              background: "#ffffff",
              border: "none",
              borderRight: "1px solid #f1f5f9",
              cursor: "pointer",
              fontSize: 12,
              color: "#334155",
            }}
            onClick={() => setShowSupplierModal(true)}
          >
            <Building2 size={20} style={{ color: "#00b06b" }} />
            <span>Nhà cung cấp</span>
          </button>

          <button
            type="button"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "14px 8px",
              background: "#ffffff",
              border: "none",
              borderRight: "1px solid #f1f5f9",
              cursor: "pointer",
              fontSize: 12,
              color: "#334155",
            }}
            onClick={() => setShowSalaryModal(true)}
          >
            <Users size={20} style={{ color: "#10b981" }} />
            <span>Nhân viên</span>
          </button>

          <button
            type="button"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "14px 8px",
              background: "#ffffff",
              border: "none",
              borderRight: "1px solid #f1f5f9",
              cursor: "pointer",
              fontSize: 12,
              color: "#334155",
            }}
            onClick={() => notify("Tính tỷ giá xuất quỹ ngoại tệ...")}
          >
            <Calculator size={20} style={{ color: "#00b06b" }} />
            <span>Tính tỷ giá xuất quỹ</span>
          </button>

          <button
            type="button"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "14px 8px",
              background: "#ffffff",
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              color: "#334155",
            }}
            onClick={() => notify("Tùy chọn thiết lập phân hệ Tiền gửi...")}
          >
            <SlidersHorizontal size={20} style={{ color: "#f59e0b" }} />
            <span>Tùy chọn</span>
          </button>
        </div>

        {/* Panel 4: AMIS Quy trình Banner (Bottom row spanning 100%) */}
        <div
          style={{
            gridColumn: "1 / -1",
            background: "linear-gradient(90deg, #ecfdf5 0%, #ffffff 80%)",
            border: "1px solid #d1fae5",
            borderRadius: 8,
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: "linear-gradient(135deg, #06b6d4, #0284c7)",
                color: "#ffffff",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                fontSize: 19,
                boxShadow: "0 2px 4px rgba(6,182,212,0.3)",
              }}
            >
              Q
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <strong style={{ fontSize: 13, color: "#111827", fontWeight: 700 }}>
                AMIS Quy trình
              </strong>
              <span style={{ fontSize: 12, color: "#475569" }}>
                Giảm tải công việc kế toán bằng cách số hóa phê duyệt đề nghị thanh toán, tạm ứng và tự động sinh chứng từ.
              </span>
            </div>
          </div>

          <button
            type="button"
            style={{
              background: "#00b06b",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              padding: "8px 16px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
              boxShadow: "0 1px 3px rgba(0, 176, 107, 0.3)",
            }}
            onClick={() => notify("Mở thiết lập tự động hóa AMIS Quy trình...")}
          >
            <SlidersHorizontal size={14} />
            Thiết lập tự động
          </button>
        </div>
      </div>

      {renderModals()}
    </div>
  );
}
