import {CASH_PERIODS} from "./cash-report-periods";
import CashColumnDialog from "./CashColumnDialog";
import {defaultBankColumns,readBankColumns} from "./bank-columns";
import {parseReportDate} from "./report-date";
import CashExcelImport from "./CashExcelImport";
import BankAccountingDetail from "./BankAccountingDetail";
import type {VoucherDetailRow} from "./MisaCashWorkspace";
import CashAdvancedPanel,{defaultCashFilter,type CashFilter} from "./CashAdvancedPanel";
import {currentCashDate,isCashDateInRange} from "./cash-date";
import {cashLedger,nextCashCode} from "./cash-operations";
import MisaBankElectronicWorkspace from "./MisaBankElectronicWorkspace";
import MisaReportCenterWorkspace from "./MisaReportCenterWorkspace";
import MisaCashForecastWorkspace from "./MisaCashForecastWorkspace";
import CashOptionsDialog from "./CashOptionsDialog";
import {AdvanceSettlementTab} from "./MisaCashWorkspace";
import { useState, useMemo, useRef, useEffect, cloneElement, type ReactElement } from "react";
import {useNavigate,useSearchParams} from 'react-router-dom';
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
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
  PaymentRequestsTab,
  SupplierPaymentModal,
  AccountingVoucherModal,
  CreateVoucherModal,
  AIAssistantModal,
  MISA_BANK_RECEIPT_TYPES,
  MISA_BANK_PAYMENT_TYPES,
  formatVND,
  convertNumberToVietnameseWords,
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
import MisaBankReconciliation from './MisaBankReconciliation';
import MisaPaymentWorkflow from './MisaPaymentWorkflow';
import {matchesTransactionPeriod} from './transaction-period';

type BankTransaction = { id:string; dateHachToan:string; dateChungTu:string; code:string; description:string; amount:number; partner:string; kind:string; status:string; bankAccount?:string;partnerCode?:string;beneficiaryAccount?:string;beneficiaryBank?:string;address?:string;employee?:string;bankName?:string;combinedInvoices?:string;settled?:string;extended1?:string;extended2?:string;extended3?:string;extended4?:string;extended5?:string;extended6?:string;extended7?:string;extended8?:string;extended9?:string;extended10?:string;createdBy?:string;createdAt?:string;updatedBy?:string;updatedAt?:string; reasonLabel?:string; documentType?:string; rows?:VoucherDetailRow[]; debit?:string; credit?:string; items:{code?:string;name:string;taxDesc:string;taxRate:number;taxAmount:number;taxAccount:string;invoiceCode:string;invoiceDate:string}[]; };
type ApiBankProfile = { account_number: string; account_name: string; bank_name: string; currency_code: string; balance: string | number };

type ApiBankTransaction = {
  id: string;
  number: string;
  transaction_date: string;
  value_date?: string | null;
  description: string;
  amount: string | number;
  counterparty_name: string;
  transaction_type: string;
  status: string;
  bank_reference?: string;
  counterparty_account?: string;
};

function mapBankTransaction(row: ApiBankTransaction): BankTransaction {
  const date = (value?: string | null) => value ? value.slice(0, 10).split("-").reverse().join("/") : "";
  return {
    id: row.id,
    dateHachToan: date(row.transaction_date),
    dateChungTu: date(row.value_date || row.transaction_date),
    code: row.number,
    description: row.description || "",
    amount: Number(row.amount),
    partner: row.counterparty_name || "",
    kind: ["RECEIPT", "INTEREST", "OTHER_IN"].includes(row.transaction_type) ? "receipt" : "payment",
    status: row.status.toLowerCase(),
    bankAccount: row.counterparty_account || "",
    items: [],
  };
}

export default function MisaBankWorkspace({
  tab = "transactions",
  company,
  notify,
  href,
}: {
  company: { id: string; name: string };
  period: string;
  tab: string;
  href: (path: string) => string;
  notify: (msg: string) => void;
}) {
  const navigate=useNavigate();
  const { token } = useApiSession();
  const [bankParams]=useSearchParams();
  const [bankOptionsOpen,setBankOptionsOpen]=useState(false);
  const bankColumnsKey=`soviet:bank-columns:${company.id}`;
  const [bankColumns,setBankColumns]=useState(()=>{try{return readBankColumns(localStorage.getItem(bankColumnsKey));}catch{return defaultBankColumns();}});
  const [bankColumnsOpen,setBankColumnsOpen]=useState(false);
  useEffect(()=>{try{setBankColumns(readBankColumns(localStorage.getItem(bankColumnsKey)));}catch{setBankColumns(defaultBankColumns());}},[bankColumnsKey]);
  // Modal states
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showMultiCustomerModal, setShowMultiCustomerModal] = useState(false);
  const [showInsuranceModal, setShowInsuranceModal] = useState(false);
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [bankImportKind,setBankImportKind]=useState<"receipt"|"payment"|null>(null);
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
  const [filterPeriod,setFilterPeriod]=useState('ytd');
  const [bankFilter,setBankFilter]=useState<CashFilter>(defaultCashFilter);
  const [bankFilterOpen,setBankFilterOpen]=useState(false);
  const [bankPage,setBankPage]=useState(1);
  const [bankPageSize,setBankPageSize]=useState(20);
  const [showAvaBanner, setShowAvaBanner] = useState(true);
  const [detailExpanded, setDetailExpanded] = useState(true);
  const [bankDetailTab,setBankDetailTab]=useState("accounting");
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
    amountInWords: convertNumberToVietnameseWords(2317000),
    notes: "Kèm theo Hóa đơn điện tử số 34221 ngày 02/09/2026",
    chiefAccountant: "Trương Thị B",
    director: "Nguyễn Văn A",
  });

  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [bankAccounts, setBankAccounts] = useState<{ account: string; name: string }[]>([]);
  const [bankBalance, setBankBalance] = useState(0);

  useEffect(() => {
    if (!token || !company.id) {
      setTransactions([]);
      setBankAccounts([]);
      setBankBalance(0);
      return;
    }
    let active = true;
    setTransactions([]);
    setBankAccounts([]);
    setBankBalance(0);
    const path = `/api/v1/bank/transactions/?company_id=${encodeURIComponent(company.id)}`;
    request<ApiBankProfile[] | { results: ApiBankProfile[] }>(
      `/api/v1/bank/accounts/?company_id=${encodeURIComponent(company.id)}`, token,
    ).then((response) => {
      if (!active) return;
      const records = Array.isArray(response) ? response : response.results;
      setBankBalance(records.reduce((total, row) => total + Number(row.balance), 0));
      setBankAccounts(records.map((row) => ({
        account: row.account_number,
        name: `${row.bank_name} - ${row.account_name} (${row.currency_code})`,
      })));
    }).catch((error) => {
      if (active) notify(error instanceof Error ? error.message : "Không tải được tài khoản ngân hàng.");
    });
    request<ApiBankTransaction[] | { results: ApiBankTransaction[] }>(path, token)
      .then((response) => {
        if (!active) return;
        const records = Array.isArray(response) ? response : response.results;
        setTransactions(records.map(mapBankTransaction));
      })
      .catch((error) => {
        if (active) notify(error instanceof Error ? error.message : "Không tải được giao dịch ngân hàng.");
      });
    return () => { active = false; };
  }, [token, company.id, notify]);

  const [bankRowMenu,setBankRowMenu]=useState<string|null>(null);
  const [selectedRowId, setSelectedRowId] = useState("unc-028");
  const [bankCheckedIds,setBankCheckedIds]=useState<string[]>([]);
  const [bankDeletePending,setBankDeletePending]=useState(false);
  const [bankDeletedRows,setBankDeletedRows]=useState<BankTransaction[]>([]);

  const bankLedger=useMemo(()=>cashLedger(transactions.map(transaction=>({date:parseReportDate(transaction.dateHachToan),kind:transaction.kind,amount:transaction.amount,status:transaction.status})),`${new Date().getFullYear()}-01-01`,parseReportDate(currentCashDate()),0),[transactions]);
  const totalPayment = bankLedger.payment;

  const totalReceipt = bankLedger.receipt;

  const currentBalance = bankBalance;

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
      const matchDate=filterPeriod==='custom'?isCashDateInRange(t.dateHachToan,bankFilter.from,bankFilter.to):matchesTransactionPeriod(t.dateHachToan,filterPeriod);
      const matchStatus=bankFilter.status==='all'||t.status===bankFilter.status;
      const matchReason=bankFilter.reason==='all'||t.reasonLabel===bankFilter.reason;
      const matchAccount=!bankFilter.bankAccount||bankFilter.bankAccount==='all'||t.bankAccount===bankFilter.bankAccount;
      return matchQuery && matchType && matchDate && matchStatus && matchReason && matchAccount;
    });
  }, [transactions, searchQuery, filterType,filterPeriod,bankFilter]);
  const bankPages=Math.max(1,Math.ceil(filteredTransactions.length/bankPageSize));
  const bankVisiblePage=Math.min(bankPage,bankPages);
  const bankVisibleRows=filteredTransactions.slice((bankVisiblePage-1)*bankPageSize,bankVisiblePage*bankPageSize);
  const selectedTransaction = useMemo(
    () => bankVisibleRows.find((item) => item.id === selectedRowId) || bankVisibleRows[0],
    [filteredTransactions, selectedRowId,bankVisiblePage,bankPageSize],
  );

  const checkedBankRows=filteredTransactions.filter(transaction=>bankCheckedIds.includes(transaction.id));
  const toggleBankChecked=(id:string)=>setBankCheckedIds(previous=>previous.includes(id)?previous.filter(value=>value!==id):[...previous,id]);
  const setBankPosting = async (status: BankTransaction["status"], selected = checkedBankRows) => {
    if (!token || !company.id || selected.length === 0) return;
    const action = status === "posted" ? "post" : "reverse";
    try {
      const updated = await Promise.all(selected.map((transaction) =>
        request<ApiBankTransaction>(
          `/api/v1/bank/transactions/${transaction.id}/${action}/?company_id=${encodeURIComponent(company.id)}`,
          token,
          { method: "POST" },
        ),
      ));
      const byId = new Map(updated.map((row) => [row.id, mapBankTransaction(row)]));
      setTransactions((previous) => previous.map((row) => byId.get(row.id) || row));
      setBankCheckedIds([]);
      notify(`Đã ${action === "post" ? "ghi sổ" : "đảo giao dịch"} ${updated.length} chứng từ.`);
      try {
        const profiles = await request<ApiBankProfile[] | { results: ApiBankProfile[] }>(
          `/api/v1/bank/accounts/?company_id=${encodeURIComponent(company.id)}`, token,
        );
        const accounts = Array.isArray(profiles) ? profiles : profiles.results;
        setBankBalance(accounts.reduce((total, profile) => total + Number(profile.balance), 0));
      } catch {
        notify("Giao dịch đã cập nhật, nhưng chưa tải lại được số dư ngân hàng.");
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Không thực hiện được thao tác ngân hàng.");
    }
  };

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
      {bankColumnsOpen&&<CashColumnDialog value={bankColumns} defaults={defaultBankColumns} onClose={()=>setBankColumnsOpen(false)} onSave={value=>{setBankColumns(value);try{localStorage.setItem(bankColumnsKey,JSON.stringify(value));}catch{notify('Đã áp dụng cột nhưng chưa lưu được tùy chọn trên trình duyệt.');}}}/>}
      {bankImportKind&&<CashExcelImport category="bank" kind={bankImportKind} existingCodes={transactions.map(transaction=>transaction.code)} onClose={()=>setBankImportKind(null)} onImport={documents=>{setTransactions(previous=>[...documents.map(document=>({...document,dateHachToan:document.postDate.split('-').reverse().join('/'),dateChungTu:document.date.split('-').reverse().join('/'),items:[]})),...previous]);setSelectedRowId(documents[0]?.id||selectedRowId);notify(`Đã nhập ${documents.length} chứng từ tiền gửi vào frontend.`);}}/>}
      {bankFilterOpen&&<CashAdvancedPanel bankAccounts={bankAccounts} mode="filters" filter={bankFilter} hidden={[]} reasons={[...MISA_BANK_RECEIPT_TYPES,...MISA_BANK_PAYMENT_TYPES].map(type=>type.label.replace(/^\d+\.\s*/,''))} onClose={()=>setBankFilterOpen(false)} onColumns={()=>{}} onFilter={value=>{setBankFilter(value);setFilterPeriod('custom');}}/>}
      {bankOptionsOpen&&<CashOptionsDialog companyId={company.id} onClose={()=>setBankOptionsOpen(false)}/>}
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
        <InsurancePaymentModal initialMethod="bank"
          onClose={() => setShowInsuranceModal(false)}
          onSubmit={handleInsurancePayment}
        />
      )}

      {showSalaryModal && (
        <SalaryPaymentModal initialMethod="bank"
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
          initialMethod="bank"
          onClose={() => setShowTaxModal(false)}
          onSubmit={handleTaxPayment}
        />
      )}

      {showSupplierModal && (
        <SupplierPaymentModal
          initialMethod="bank"
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
          existingCodes={transactions.map(row=>row.code)}
          suggestedCode={nextCashCode(showCreateVoucher,transactions.map(row=>row.code),"bank")}
          initialTypeIndex={createVoucherTypeIndex}
          onClose={() => {
            setShowCreateVoucher(null);
            setCreateVoucherTypeIndex(0);
          }}
          onSave={(doc) => {
            setTransactions([
              {
                id: doc.id,
                dateHachToan: (doc.postDate||doc.date).split("-").reverse().join("/"),
                dateChungTu: doc.date.split("-").reverse().join("/"),
                code: doc.code,
                description: doc.description,
                amount: doc.amount,
                partner: doc.partner,
                rows: doc.rows,
                debit: doc.debit,
                credit: doc.credit,
                bankAccount: doc.bankAccount,
                reasonLabel: doc.reasonLabel,
                documentType: doc.kind==="receipt"?"Thu tiền gửi":doc.paymentMethod||"Ủy nhiệm chi",
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
            notify(`Sổ Việt AI đã tạo dự thảo chứng từ chuyển khoản ${doc.code}.`);
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

  if(tab==='ebanking')return <><MisaBankElectronicWorkspace accounts={bankAccounts} companyId={company.id} onOpenVoucher={kind=>setShowCreateVoucher(kind)}/>{renderModals()}</>;
  if(tab==='reports')return <MisaReportCenterWorkspace key={bankParams.get('report')||'bank'} initialCategory="bank" initialReport={bankParams.get('report')} embedded notify={notify}/>;
  if(tab==='cashflow')return <MisaCashForecastWorkspace companyId={company.id} openingKind="bank" entries={transactions.map(row=>({date:row.dateHachToan,kind:row.kind,amount:row.amount,code:row.code,status:row.status}))}/>;
  if(tab==='advance-settlement')return <><MisaPaymentWorkflow variant="settlement" notify={notify}><AdvanceSettlementTab notify={notify} onOpenCreateReceipt={()=>setShowCreateVoucher('receipt')}/></MisaPaymentWorkflow>{renderModals()}</>;
  if (tab === 'reconciliation') return <MisaBankReconciliation transactions={transactions} notify={notify}/>;
  if (tab === 'payment-requests') return <><MisaPaymentWorkflow notify={notify}><PaymentRequestsTab notify={notify} onOpenCreatePayment={()=>setShowCreateVoucher('payment')}/></MisaPaymentWorkflow>{renderModals()}</>;

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
        {/* Sổ Việt AI Smart Analysis Banner (Image 4 & 5) */}
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
                <strong style={{ fontSize: 13, color: "#4338ca" }}>Sổ Việt AI</strong>
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
                <span>{new Date().toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}</span>
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
                  Số dư tiền gửi đến ngày {currentCashDate()}
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
                onInput={e=>setSearchQuery(e.currentTarget.value)}
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
              value={filterPeriod}
              onChange={e=>setFilterPeriod(e.target.value)}
              aria-label="Kỳ thu chi tiền gửi"
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
            <option value="custom">Kỳ: Tùy chọn</option>
              {CASH_PERIODS.filter(period=>!["Đầu năm đến hiện tại","Tháng này","Quý này","Năm nay","Tùy chọn"].includes(period)).map(period=><option key={period} value={period}>Kỳ: {period}</option>)}</select>

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
              onClick={async()=>{const XLSX=await import("xlsx");const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([["Ngày hạch toán","Ngày chứng từ","Số chứng từ","Diễn giải","Số tiền","Đối tượng","Số tài khoản NH","Lý do thu/chi","Loại chứng từ"],...filteredTransactions.map(transaction=>[transaction.dateHachToan,transaction.dateChungTu,transaction.code,transaction.description,transaction.amount,transaction.partner,transaction.bankAccount||"",transaction.reasonLabel||"",transaction.documentType||""])]),"Tien-gui");XLSX.writeFileXLSX(workbook,"Thu-chi-tien-gui.xlsx");}}
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
              onClick={() => setBankColumnsOpen(true)}
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
              onClick={() => setBankFilterOpen(true)}
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
          <details className="ce-toolbar"><summary style={{cursor:'pointer'}}>Nhập chứng từ tiền gửi từ Excel</summary><button onClick={()=>setBankImportKind('receipt')}>Nhập thu tiền gửi</button><button onClick={()=>setBankImportKind('payment')}>Nhập chi tiền gửi</button></details>
          {checkedBankRows.length>0&&<div className="ce-toolbar" role="toolbar" aria-label="Thao tác chứng từ tiền gửi đã chọn"><strong>Đã chọn {checkedBankRows.length}</strong><button onClick={()=>setBankPosting('posted')}>Ghi sổ</button><button onClick={()=>setBankPosting('draft')}>Bỏ ghi sổ</button><button disabled title="Not supported by backend">Xóa</button><button onClick={()=>setBankCheckedIds([])}>Bỏ chọn</button></div>}
          {bankDeletedRows.length>0&&<div className="ce-toolbar" role="status">Đã xóa {bankDeletedRows.length} chứng từ trên frontend.<button onClick={()=>{setTransactions(previous=>[...bankDeletedRows.filter(row=>!previous.some(existing=>existing.id===row.id)),...previous]);setBankDeletedRows([]);}}>Hoàn tác</button></div>}
          {bankDeletePending&&<div className="ce-overlay"><section className="ce-panel" role="alertdialog" aria-modal="true" aria-label="Xóa chứng từ tiền gửi"><header><h2>Xóa chứng từ tiền gửi</h2></header><div className="ce-panel-body">Xóa {checkedBankRows.length} chứng từ đã chọn khỏi danh sách frontend?</div><footer><button onClick={()=>setBankDeletePending(false)}>Hủy</button><button className="ce-primary" onClick={()=>{const ids=new Set(checkedBankRows.map(row=>row.id));setBankDeletedRows(checkedBankRows);setTransactions(previous=>previous.filter(row=>!ids.has(row.id)));setBankCheckedIds(previous=>previous.filter(id=>!ids.has(id)));setBankDeletePending(false);}}>Xóa chứng từ</button></footer></section></div>}
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 36, textAlign: "center", padding: "8px 4px" }}>
                  <input type="checkbox" aria-label="Chọn tất cả chứng từ trang hiện tại" checked={bankVisibleRows.length>0&&bankVisibleRows.every(row=>bankCheckedIds.includes(row.id))} onChange={event=>{const ids=bankVisibleRows.map(row=>row.id);setBankCheckedIds(previous=>event.target.checked?[...new Set([...previous,...ids])]:previous.filter(id=>!ids.includes(id)));}} style={{ accentColor: "#00b06b" }} />
                </th>
                {bankColumns.filter(column=>column.visible).map(column=><th key={column.id} style={{width:column.width,minWidth:column.width,textAlign:column.id===6?'right':'left',padding:'8px 10px'}}>{column.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {bankVisibleRows.map((tx) => {
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
                      <input type="checkbox" aria-label={`Chọn chứng từ ${tx.code}`} checked={bankCheckedIds.includes(tx.id)} onClick={event=>event.stopPropagation()} onChange={()=>toggleBankChecked(tx.id)} />
                    </td>
                    {bankColumns.filter(column=>column.visible).map(column=>{const cells:ReactElement<any>[]=[<td style={{ padding: "8px 10px", color: "#374151" }}>{tx.dateHachToan}</td>,
                    <td style={{ padding: "8px 10px", color: "#374151" }}>{tx.dateChungTu}</td>,
                    <td style={{ padding: "8px 10px" }}>
                      <span
                        style={{ color: "#0284c7", fontWeight: 600, cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVoucher({
                            code: tx.code,
                            date: parseReportDate(tx.dateChungTu),
                            person: tx.partner,
                            address: "Hà Nội",
                            reason: tx.description,
                            debitAccount: tx.debit||(tx.kind==="receipt"?"1121":"6427"),
                            creditAccount: tx.credit||(tx.kind==="receipt"?"131":"1121"),
                            amount: tx.amount,
                            amountInWords: convertNumberToVietnameseWords(tx.amount),
                            notes: "Kèm theo Hóa đơn điện tử số 34221 ngày 02/09/2026",
                            chiefAccountant: "Trương Thị B",
                            director: "Nguyễn Văn A",
                          });
                          setShowVoucherModal(true);
                        }}
                      >
                        {tx.code}
                      </span>
                    </td>,
                    <td style={{ padding: "8px 10px", color: "#1f2937" }}>{tx.description}</td>,
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>
                      {formatVND(tx.amount)}
                    </td>,
                    <td style={{ padding: "8px 10px", color: "#374151" }}>{tx.partner}</td>,
                    <td style={{padding:"8px 10px"}}>{tx.bankAccount||""}</td>,<td style={{padding:"8px 10px"}}>{tx.reasonLabel||""}</td>,<td style={{padding:"8px 10px"}}>{tx.documentType||(tx.kind==="receipt"?"Thu tiền gửi":tx.kind==="transfer"?"Chuyển tiền nội bộ":"Ủy nhiệm chi")}</td>,
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <span
                        style={{ color: "#0284c7", cursor: "pointer", marginRight: 6 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVoucher({
                            code: tx.code,
                            date: parseReportDate(tx.dateChungTu),
                            person: tx.partner,
                            address: "Hà Nội",
                            reason: tx.description,
                            debitAccount: tx.debit||(tx.kind==="receipt"?"1121":"6427"),
                            creditAccount: tx.credit||(tx.kind==="receipt"?"131":"1121"),
                            amount: tx.amount,
                            amountInWords: convertNumberToVietnameseWords(tx.amount),
                            notes: "Kèm theo Hóa đơn điện tử số 34221",
                            chiefAccountant: "Trương Thị B",
                            director: "Nguyễn Văn A",
                          });
                          setShowVoucherModal(true);
                        }}
                      >
                        Xem
                      </span>
                      <button aria-label={`Chức năng chứng từ ${tx.code}`} aria-expanded={bankRowMenu===tx.id} onClick={event=>{event.stopPropagation();setBankRowMenu(previous=>previous===tx.id?null:tx.id);}} style={{border:0,background:'transparent',color:'#0284c7',cursor:'pointer'}}><ChevronDown size={13}/></button>
                      {bankRowMenu===tx.id&&<div role="menu" aria-label={`Chức năng ${tx.code}`}><button role="menuitem" onClick={event=>{event.stopPropagation();void setBankPosting(tx.status==='posted'?'draft':'posted',[tx]);setBankRowMenu(null);}}>{tx.status==='posted'?'Đảo giao dịch':'Ghi sổ'}</button><button role="menuitem" onClick={event=>{event.stopPropagation();setBankRowMenu(null);}}>Đóng</button></div>}
                    </td>,<td>{tx.partnerCode||""}</td>,<td>{tx.beneficiaryAccount||""}</td>,<td>{tx.beneficiaryBank||""}</td>,<td>{tx.address||""}</td>,<td>{tx.employee||""}</td>,<td>{tx.bankName||""}</td>,<td>{tx.combinedInvoices||""}</td>,<td>{tx.settled||""}</td>,<td>{tx.extended1||""}</td>,<td>{tx.extended2||""}</td>,<td>{tx.extended3||""}</td>,<td>{tx.extended4||""}</td>,<td>{tx.extended5||""}</td>,<td>{tx.extended6||""}</td>,<td>{tx.extended7||""}</td>,<td>{tx.extended8||""}</td>,<td>{tx.extended9||""}</td>,<td>{tx.extended10||""}</td>,<td>{tx.createdBy||""}</td>,<td>{tx.createdAt||""}</td>,<td>{tx.updatedBy||""}</td>,<td>{tx.updatedAt||""}</td>];const cell=cells[column.id-2];return cloneElement(cell,{key:column.id,style:{...cell.props.style,width:column.width,minWidth:column.width}});})}
                  </tr>
                );
              })}
            {!filteredTransactions.length&&<tr><td colSpan={1+bankColumns.filter(column=>column.visible).length} style={{textAlign:'center',padding:24}}>Không có chứng từ phù hợp với điều kiện tìm kiếm</td></tr>}
            </tbody>
            <tfoot><tr style={{background:'#f8fafc',fontWeight:700}}><td/>{bankColumns.filter(column=>column.visible).map(column=><td key={column.id} style={{padding:10,textAlign:column.id===6?'right':'left'}}>{column.id===2?'Tổng':column.id===6?formatVND(filteredTransactions.reduce((sum,transaction)=>sum+transaction.amount,0)):''}</td>)}</tr></tfoot>
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
            <select aria-label="Số dòng trang danh sách tiền gửi" value={bankPageSize} onChange={event=>{setBankPageSize(Number(event.target.value));setBankPage(1);}} style={{ height: 26, borderRadius: 4, border: "1px solid #d1d5db", fontSize: 12 }}>
              <option value="20">20</option>
              <option value="50">50</option><option value="100">100</option>
            </select>
            <div style={{ display: "flex", gap: 4 }}>
              <button aria-label="Trang đầu tiền gửi" disabled={bankVisiblePage===1} onClick={()=>setBankPage(1)}>|&lt;</button><button aria-label="Trang trước tiền gửi" disabled={bankVisiblePage===1} onClick={()=>setBankPage(bankVisiblePage-1)}>&lt;</button><span>{bankVisiblePage}/{bankPages}</span><button aria-label="Trang sau tiền gửi" disabled={bankVisiblePage===bankPages} onClick={()=>setBankPage(bankVisiblePage+1)}>&gt;</button><button aria-label="Trang cuối tiền gửi" disabled={bankVisiblePage===bankPages} onClick={()=>setBankPage(bankPages)}>&gt;|</button>
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
                <nav className="ce-toolbar" aria-label="Chi tiết chứng từ ngân hàng" style={{padding:'0 10px'}}><button onClick={()=>setBankDetailTab('accounting')}>Hạch toán</button><button onClick={()=>setBankDetailTab('services')}>Chi tiết dịch vụ và thuế</button></nav>{bankDetailTab==='accounting'?<BankAccountingDetail key={selectedTransaction.id} rows={selectedTransaction.rows?.length?selectedTransaction.rows:[{id:selectedTransaction.id,description:selectedTransaction.description,debit:selectedTransaction.debit||(selectedTransaction.kind==='receipt'?'1121':'6427'),credit:selectedTransaction.credit||(selectedTransaction.kind==='receipt'?'131':'1121'),amount:selectedTransaction.amount,partnerName:selectedTransaction.partner}]}/>:<table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
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
                </table>}
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
                onClick={() => setActiveFlowchartMenu("receipt")}
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
                onClick={() => setActiveFlowchartMenu("payment")}
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
                navigate(href('/bank/reconciliation'));
              }}
              role="button"
              tabIndex={0}
              onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();navigate(href('/bank/reconciliation'));}}}
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
                onClick={() => navigate(href("/bank/reports")+"&report="+encodeURIComponent(repName))}
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
              onClick={() => navigate(href("/bank/reports"))}
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
            onClick={() => navigate(href("/directory") + "&directory=" + encodeURIComponent("Tài khoản ngân hàng"))}
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
            onClick={() => navigate(href("/directory") + "&directory=" + encodeURIComponent("Khách hàng"))}
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
            onClick={() => navigate(href("/directory") + "&directory=" + encodeURIComponent("Nhà cung cấp"))}
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
            onClick={() => navigate(href("/directory") + "&directory=" + encodeURIComponent("Nhân viên"))}
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
            onClick={() => setBankOptionsOpen(true)}
          >
            <SlidersHorizontal size={20} style={{ color: "#f59e0b" }} />
            <span>Tùy chọn</span>
          </button>
        </div>
      </div>

      {renderModals()}
    </div>
  );
}
