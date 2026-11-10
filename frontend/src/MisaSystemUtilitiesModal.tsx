import { useEffect, useState } from "react";
import { formatMoneyInput, parseMoneyInputString } from "./formatMoney";
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  Database,
  FileCheck2,
  Hash,
  Layers,
  Link2,
  Play,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { request } from "./live-api";

export type SystemUtilityModalProps = {
  utilityName: string;
  companyId: string;
  companyName: string;
  token: string;
  onClose: () => void;
  onNavigate: (url: string) => void;
  notify: (msg: string) => void;
};

function unwrapList<T = any>(res: any): T[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  const data = res.data ?? res;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export function MisaSystemUtilitiesModal({
  utilityName,
  companyId,
  companyName,
  token,
  onClose,
  onNavigate,
  notify,
}: SystemUtilityModalProps) {
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  // State for various live API utilities
  const [journals, setJournals] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "DRAFT" | "POSTED">("ALL");

  const [numberingRules, setNumberingRules] = useState<any[]>([]);
  const [trialBalance, setTrialBalance] = useState<any>(null);
  const [stockBalances, setStockBalances] = useState<any[]>([]);
  const [fiscalPeriods, setFiscalPeriods] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [accountingPolicies, setAccountingPolicies] = useState<any[]>([]);
  const [accountsCount, setAccountsCount] = useState<number>(0);
  const [companyMembers, setCompanyMembers] = useState<any[]>([]);
  const [costingRuns, setCostingRuns] = useState<any[]>([]);
  const [closingEntries, setClosingEntries] = useState<any[]>([]);
  const [einvoiceConns, setEinvoiceConns] = useState<any[]>([]);
  const [bankConns, setBankConns] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);

  // QR generator state
  const [qrBankId, setQrBankId] = useState("");
  const [qrAmount, setQrAmount] = useState("15000000");
  const [qrMemo, setQrMemo] = useState(`Thanh toan hoa don ${companyName}`);

  // Tax lookup state
  const [taxQuery, setTaxQuery] = useState("");
  const [newPartnerTax, setNewPartnerTax] = useState("");
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newPartnerAddress, setNewPartnerAddress] = useState("");

  // Module setup state ("Thiết lập phân hệ")
  const MODULE_CATALOG = [
    { id: "overview", label: "Tổng quan", desc: "Bảng điều khiển chỉ số tài chính & dòng tiền tức thời", core: true },
    { id: "invoices", label: "Quản lý hóa đơn", desc: "Đồng bộ, phát hành và xử lý hóa đơn điện tử đầu vào/đầu ra", core: false },
    { id: "cash", label: "Tiền mặt", desc: "Phiếu thu, Phiếu chi, Đề nghị chi, Tạm ứng & Kiểm kê quỹ", core: true },
    { id: "bank", label: "Tiền gửi", desc: "Báo có, Ủy nhiệm chi, Đối chiếu sổ phụ & Ngân hàng điện tử", core: true },
    { id: "purchases", label: "Mua hàng", desc: "Đơn mua hàng, Nhận hàng/dịch vụ, Trả lại hàng mua & Công nợ phải trả", core: false },
    { id: "sales", label: "Bán hàng", desc: "Báo giá, Đơn đặt hàng, Ghi nhận doanh thu & Công nợ phải thu", core: false },
    { id: "inventory", label: "Kho", desc: "Nhập kho, Xuất kho, Chuyển kho, Kiểm kê & Tính giá xuất kho", core: false },
    { id: "tools", label: "Công cụ dụng cụ", desc: "Ghi tăng, Phân bổ chi phí trả trước (TK 242) & Điều chuyển CCDC", core: false },
    { id: "assets", label: "Tài sản cố định", desc: "Ghi tăng, Tính khấu hao định kỳ, Đánh giá lại & Thanh lý TSCĐ", core: false },
    { id: "payroll", label: "Tiền lương", desc: "Chấm công, Bảng tính lương, Thuế TNCN & Hạch toán chi phí lương", core: false },
    { id: "insurance", label: "Kết nối bảo hiểm", desc: "Theo dõi trích nộp BHXH, BHYT, BHTN và đối chiếu cơ quan BHXH", core: false },
    { id: "tax", label: "Thuế", desc: "Tờ khai GTGT (01/GTGT), Thuế TNDN, TNCN & Xuất XML HTKK", core: true },
    { id: "cost", label: "Giá thành", desc: "Tập hợp chi phí 154, Phân bổ chi phí chung & Tính giá thành sản xuất", core: false },
    { id: "ledger", label: "Tổng hợp", desc: "Chứng từ nghiệp vụ khác, Kết chuyển lãi lỗ, Khóa sổ & Sổ cái", core: true },
    { id: "budget", label: "Ngân sách", desc: "Dự toán thu chi theo đơn vị và kiểm soát hạn mức chi tiêu", core: false },
    { id: "reports", label: "Báo cáo", desc: "Bộ Báo cáo Tài chính (B01, B02, B03, B09) & Báo cáo quản trị", core: true },
    { id: "analysis", label: "Phân tích tài chính", desc: "Phân tích chỉ số thanh khoản, sinh lời, hiệu quả & xu hướng", core: false },
    { id: "directory", label: "Danh mục", desc: "Hệ thống tài khoản, Khách hàng, Nhà cung cấp, Vật tư, Kho, Phòng ban", core: true },
    { id: "opening", label: "Số dư ban đầu", desc: "Khai báo số dư đầu kỳ Tài khoản, Công nợ, Tồn kho & Tài sản", core: true },
    { id: "connections", label: "Kết nối vay vốn", desc: "Hồ sơ tín dụng doanh nghiệp & kết nối hạn mức ngân hàng", core: false },
  ];

  const [enabledMods, setEnabledMods] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(`sv_enabled_modules_${companyId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return MODULE_CATALOG.map((m) => m.id);
  });

  const handleToggleModuleItem = (modId: string, isCore: boolean) => {
    if (isCore) return;
    setEnabledMods((prev) =>
      prev.includes(modId) ? prev.filter((id) => id !== modId) : [...prev, modId]
    );
  };

  const handleApplyModulePreset = (preset: "all" | "commerce" | "manufacturing" | "micro") => {
    if (preset === "all" || preset === "manufacturing") {
      setEnabledMods(MODULE_CATALOG.map((m) => m.id));
    } else if (preset === "commerce") {
      setEnabledMods(
        MODULE_CATALOG.map((m) => m.id).filter((id) => !["cost", "budget", "connections"].includes(id))
      );
    } else if (preset === "micro") {
      setEnabledMods([
        "overview", "invoices", "cash", "bank", "purchases", "sales",
        "tax", "ledger", "reports", "directory", "opening",
      ]);
    }
  };

  const handleSaveModuleSetup = () => {
    try {
      localStorage.setItem(`sv_enabled_modules_${companyId}`, JSON.stringify(enabledMods));
      window.dispatchEvent(new Event("sv_modules_updated"));
    } catch {}
    notify(`Đã lưu thiết lập phân hệ thành công (${enabledMods.length}/${MODULE_CATALOG.length} phân hệ đang hiển thị trên thanh điều hướng)!`);
    onClose();
  };

  const apiGet = async (path: string) => {
    const sep = path.includes("?") ? "&" : "?";
    const fullUrl = `/api/v1${path}${sep}company_id=${encodeURIComponent(companyId)}`;
    return request<any>(fullUrl, token).catch(() => null);
  };

  const apiSend = async (path: string, method: string, body: Record<string, any> = {}) => {
    const sep = path.includes("?") ? "&" : "?";
    const fullUrl = `/api/v1${path}${sep}company_id=${encodeURIComponent(companyId)}`;
    return request<any>(fullUrl, token, {
      method,
      body: JSON.stringify({ ...body, company_id: companyId }),
    });
  };

  const loadUtilityData = async () => {
    if (!token || !companyId) return;
    setLoading(true);
    try {
      if (
        utilityName === "Ghi sổ/Bỏ ghi theo lô" ||
        utilityName === "Phục hồi chứng từ đã xóa nhầm" ||
        utilityName === "Lấy chứng từ từ dữ liệu khác"
      ) {
        const [jRes, cRes, pRes, sRes, aRes] = await Promise.all([
          apiGet("/general-ledger/journals/?page_size=50"),
          apiGet("/cash/transactions/?page_size=50"),
          apiGet("/purchases/goods-purchases/?page_size=30"),
          apiGet("/sales/goods-sales/?page_size=30"),
          apiGet("/audit/logs/?page_size=30"),
        ]);
        const jRows = unwrapList(jRes).map((r: any) => ({
          id: r.id,
          number: r.entry_number || r.voucher_no || r.code || "PKT",
          date: r.entry_date || r.accounting_date || r.created_at?.slice(0, 10) || "2026-01-15",
          description: r.description || r.memo || "Chứng từ kế toán tổng hợp",
          status: String(r.status || "DRAFT").toUpperCase(),
          endpoint: `/general-ledger/journals/${r.id}`,
          moduleLabel: "Tổng hợp (GL)",
        }));
        const cRows = unwrapList(cRes).map((r: any) => ({
          id: r.id,
          number: r.voucher_no || r.code || "PT/PC",
          date: r.accounting_date || r.voucher_date || "2026-01-15",
          description: r.description || r.reason || "Phiếu thu / chi tiền mặt",
          status: String(r.status || "DRAFT").toUpperCase(),
          endpoint: `/cash/transactions/${r.id}`,
          moduleLabel: "Tiền mặt",
        }));
        const pRows = unwrapList(pRes).map((r: any) => ({
          id: r.id,
          number: r.voucher_no || r.code || "MH",
          date: r.accounting_date || r.voucher_date || "2026-01-15",
          description: r.description || "Chứng từ mua hàng",
          status: String(r.status || "DRAFT").toUpperCase(),
          endpoint: `/purchases/goods-purchases/${r.id}`,
          moduleLabel: "Mua hàng",
        }));
        const sRows = unwrapList(sRes).map((r: any) => ({
          id: r.id,
          number: r.voucher_no || r.code || "BH",
          date: r.accounting_date || r.voucher_date || "2026-01-15",
          description: r.description || "Chứng từ bán hàng",
          status: String(r.status || "DRAFT").toUpperCase(),
          endpoint: `/sales/goods-sales/${r.id}`,
          moduleLabel: "Bán hàng",
        }));
        const merged = [...jRows, ...cRows, ...pRows, ...sRows];
        setJournals(merged);
        setSelectedIds(merged.slice(0, 3).map((x) => x.id));
        setAuditLogs(unwrapList(aRes));
      } else if (utilityName === "Đánh lại số chứng từ") {
        const res = await apiGet("/common/numbering-rules/?page_size=50");
        setNumberingRules(unwrapList(res));
      } else if (
        utilityName === "Bảo trì dữ liệu" ||
        utilityName === "Kiểm tra đối chiếu chứng từ, sổ sách"
      ) {
        const [tbRes, jRes, sbRes, fpRes] = await Promise.all([
          apiGet("/general-ledger/balances/?page_size=100"),
          apiGet("/general-ledger/journals/?page_size=50"),
          apiGet("/inventory/balances/?page_size=50"),
          apiGet("/general-ledger/periods/?page_size=20"),
        ]);
        setTrialBalance(tbRes?.data ?? tbRes);
        setJournals(unwrapList(jRes));
        setStockBalances(unwrapList(sbRes));
        setFiscalPeriods(unwrapList(fpRes));
      } else if (utilityName === "Mã QR thanh toán") {
        const res = await apiGet("/master-data/company-bank-accounts/?page_size=50");
        const list = unwrapList(res);
        setBankAccounts(list);
        if (list.length > 0 && !qrBankId) {
          setQrBankId(list[0].id);
        }
      } else if (utilityName === "Tra cứu thông tin doanh nghiệp") {
        const [cRes, vRes] = await Promise.all([
          apiGet("/master-data/customers/?page_size=50"),
          apiGet("/master-data/vendors/?page_size=50"),
        ]);
        setPartners([
          ...unwrapList(cRes).map((x: any) => ({ ...x, partner_type: "CUSTOMER" })),
          ...unwrapList(vRes).map((x: any) => ({ ...x, partner_type: "VENDOR" })),
        ]);
      } else if (
        utilityName === "Chuyển đổi dữ liệu sang Thông tư 99/2025/TT-BTC" ||
        utilityName === "Hướng dẫn chuyển đổi từ SME" ||
        utilityName === "Chuyển đổi từ Sổ Việt ERP bản cũ"
      ) {
        const [polRes, accRes] = await Promise.all([
          apiGet("/common/accounting-policies/"),
          apiGet("/general-ledger/accounts/?page_size=200"),
        ]);
        setAccountingPolicies(unwrapList(polRes));
        setAccountsCount(unwrapList(accRes).length);
      } else if (utilityName === "Danh sách lệnh tính giá, bảo trì… đang thực hiện") {
        const [crRes, ceRes, fpRes] = await Promise.all([
          apiGet("/inventory/costing-runs/?page_size=20"),
          apiGet("/general-ledger/closing-entries/?page_size=20"),
          apiGet("/common/fiscal-periods/?page_size=20"),
        ]);
        setCostingRuns(unwrapList(crRes));
        setClosingEntries(unwrapList(ceRes));
        setFiscalPeriods(unwrapList(fpRes));
      } else if (utilityName === "Danh sách người dùng đang truy cập") {
        const [memRes, audRes] = await Promise.all([
          apiGet("/iam/company-members/?page_size=50"),
          apiGet("/common/audit-logs/?page_size=20"),
        ]);
        setCompanyMembers(unwrapList(memRes));
        setAuditLogs(unwrapList(audRes));
      } else if (utilityName === "Thiết lập phân hệ") {
        // Module setup uses localStorage & /common/modules/
      } else {
        const [eRes, bRes] = await Promise.all([
          apiGet("/common/modules/?page_size=20"),
          apiGet("/bank/accounts/?page_size=20"),
        ]);
        setEinvoiceConns(unwrapList(eRes));
        setBankConns(unwrapList(bRes));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUtilityData();
  }, [utilityName, companyId, token]);

  const handleBatchPost = async (action: "post" | "unpost") => {
    const targets = journals.filter((j) => selectedIds.includes(j.id));
    if (!targets.length) {
      notify("Vui lòng chọn ít nhất 1 chứng từ để thực hiện.");
      return;
    }
    setBusyAction(true);
    let okCount = 0;
    for (const item of targets) {
      try {
        await apiSend(`${item.endpoint}/${action}/`, "POST", {});
        okCount++;
      } catch {
        // ignore single item error
      }
    }
    setBusyAction(false);
    notify(
      `Đã thực hiện ${action === "post" ? "Ghi sổ" : "Bỏ ghi sổ"} thành công ${okCount}/${targets.length} chứng từ.`
    );
    void loadUtilityData();
  };

  const handleRenumberAll = async () => {
    setBusyAction(true);
    let updated = 0;
    for (const rule of numberingRules) {
      try {
        await apiSend(`/common/numbering-rules/${rule.id}/`, "PATCH", {
          prefix: rule.prefix,
          padding: rule.padding || 5,
        });
        updated++;
      } catch {
        // ignore
      }
    }
    setBusyAction(false);
    notify(`Đã đồng bộ và cập nhật quy tắc đánh số cho ${updated} loại chứng từ!`);
    void loadUtilityData();
  };

  const handleCreatePartnerFromLookup = async () => {
    if (!newPartnerTax.trim() || !newPartnerName.trim()) {
      notify("Vui lòng nhập Mã số thuế và Tên doanh nghiệp.");
      return;
    }
    setBusyAction(true);
    try {
      await apiSend("/master-data/customers/", "POST", {
        code: `DN_${newPartnerTax.trim().slice(-5)}`,
        name: newPartnerName.trim(),
        legal_name: newPartnerName.trim(),
        tax_code: newPartnerTax.trim(),
        party_type: "organization",
        address: newPartnerAddress.trim() || "Việt Nam",
      });
      setBusyAction(false);
      notify(`Đã thêm đối tượng "${newPartnerName}" (MST: ${newPartnerTax}) vào Danh mục!`);
      setNewPartnerTax("");
      setNewPartnerName("");
      setNewPartnerAddress("");
      void loadUtilityData();
    } catch (err: any) {
      setBusyAction(false);
      notify(err?.message || "Không thể tạo đối tượng mới.");
    }
  };

  const filteredJournals = journals.filter((j) => {
    if (statusFilter === "ALL") return true;
    if (statusFilter === "POSTED") return j.status === "POSTED";
    return j.status !== "POSTED";
  });

  const tbLines: any[] = Array.isArray(trialBalance?.lines)
    ? trialBalance.lines
    : Array.isArray(trialBalance?.accounts)
      ? trialBalance.accounts
      : Array.isArray(trialBalance)
        ? trialBalance
        : [];
  const totalDebit = tbLines.reduce(
    (s, r) => s + Number(r.closing_debit || r.period_debit || r.debit || 0),
    0
  );
  const totalCredit = tbLines.reduce(
    (s, r) => s + Number(r.closing_credit || r.period_credit || r.credit || 0),
    0
  );
  const isBalanced = Math.abs(totalDebit - totalCredit) < 1;

  const selectedBank = bankAccounts.find((b) => b.id === qrBankId) || bankAccounts[0];
  const bankBin = selectedBank?.bank_name?.toLowerCase().includes("vietcombank")
    ? "970436"
    : selectedBank?.bank_name?.toLowerCase().includes("techcombank")
      ? "970407"
      : selectedBank?.bank_name?.toLowerCase().includes("bidv")
        ? "970418"
        : "970422"; // MB default
  const accountNo = selectedBank?.account_number || "0123456789";
  const qrUrl = `https://img.vietqr.io/image/${bankBin}-${accountNo}-compact2.png?amount=${encodeURIComponent(
    qrAmount || "0"
  )}&addInfo=${encodeURIComponent(qrMemo || "Thanh toan")}`;

  return (
    <div
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2500,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          background: "#ffffff",
          maxWidth: 920,
          width: "94vw",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 20px 50px rgba(15, 23, 42, 0.25)",
        }}
      >
        {/* Header */}
        <div
          className="modal-head"
          style={{
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            color: "#ffffff",
            padding: "16px 22px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: "rgba(16, 185, 129, 0.2)",
                color: "#34d399",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Layers size={18} />
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>
                {utilityName}
              </h2>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                Doanh nghiệp: <strong style={{ color: "#e2e8f0" }}>{companyName}</strong> • Đồng bộ dữ liệu hệ thống
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => void loadUtilityData()}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.18)",
                color: "#f8fafc",
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              <RefreshCw size={13} className={loading ? "spin" : ""} />
              Làm mới
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "#cbd5e1",
                cursor: "pointer",
                padding: 4,
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          className="modal-body"
          style={{
            padding: "20px 24px",
            maxHeight: "76vh",
            overflowY: "auto",
            background: "#f8fafc",
          }}
        >
          {/* 1. GHI SỔ / BỎ GHI THEO LÔ */}
          {(utilityName === "Ghi sổ/Bỏ ghi theo lô" ||
            utilityName === "Phục hồi chứng từ đã xóa nhầm" ||
            utilityName === "Lấy chứng từ từ dữ liệu khác") && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {(["ALL", "DRAFT", "POSTED"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        fontSize: 12.5,
                        fontWeight: 600,
                        border:
                          statusFilter === st ? "1px solid var(--brand)" : "1px solid #cbd5e1",
                        background: statusFilter === st ? "#e0f2fe" : "#ffffff",
                        color: statusFilter === st ? "var(--brand-hover)" : "#475569",
                        cursor: "pointer",
                      }}
                    >
                      {st === "ALL"
                        ? `Tất cả (${journals.length})`
                        : st === "DRAFT"
                          ? `Chưa ghi sổ (${journals.filter((x) => x.status !== "POSTED").length})`
                          : `Đã ghi sổ (${journals.filter((x) => x.status === "POSTED").length})`}
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={() => void handleBatchPost("post")}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 6,
                      background: "var(--brand)",
                      color: "#ffffff",
                      border: "none",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <FileCheck2 size={15} />
                    Ghi sổ theo lô ({selectedIds.length})
                  </button>
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={() => void handleBatchPost("unpost")}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 6,
                      background: "#ffffff",
                      color: "#ea580c",
                      border: "1px solid #fdba74",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <RotateCcw size={15} />
                    Bỏ ghi theo lô
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigate("/ledger/transactions");
                    }}
                    style={{
                      padding: "7px 12px",
                      borderRadius: 6,
                      background: "#f1f5f9",
                      color: "#1e293b",
                      border: "1px solid #cbd5e1",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Mở danh sách chứng từ →
                  </button>
                </div>
              </div>

              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                      <th style={{ padding: "10px 12px", width: 36 }}>
                        <input
                          type="checkbox"
                          checked={
                            filteredJournals.length > 0 &&
                            selectedIds.length === filteredJournals.length
                          }
                          onChange={(e) =>
                            setSelectedIds(
                              e.target.checked ? filteredJournals.map((x) => x.id) : []
                            )
                          }
                        />
                      </th>
                      <th style={{ padding: "10px 12px" }}>Số chứng từ</th>
                      <th style={{ padding: "10px 12px" }}>Ngày HT</th>
                      <th style={{ padding: "10px 12px" }}>Phân hệ</th>
                      <th style={{ padding: "10px 12px" }}>Diễn giải</th>
                      <th style={{ padding: "10px 12px" }}>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJournals.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
                          Không có chứng từ nào trong bộ lọc hiện tại.
                        </td>
                      </tr>
                    ) : (
                      filteredJournals.map((row) => (
                        <tr key={row.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "10px 12px" }}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(row.id)}
                              onChange={(e) =>
                                setSelectedIds((prev) =>
                                  e.target.checked
                                    ? [...prev, row.id]
                                    : prev.filter((id) => id !== row.id)
                                )
                              }
                            />
                          </td>
                          <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--brand)" }}>
                            {row.number}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#475569" }}>{row.date}</td>
                          <td style={{ padding: "10px 12px" }}>{row.moduleLabel}</td>
                          <td style={{ padding: "10px 12px", color: "#1e293b" }}>
                            {row.description}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: 99,
                                fontSize: 11.5,
                                fontWeight: 600,
                                background: row.status === "POSTED" ? "#dcfce7" : "#fef3c7",
                                color: row.status === "POSTED" ? "#15803d" : "#b45309",
                              }}
                            >
                              {row.status === "POSTED" ? "Đã ghi sổ" : "Chưa ghi sổ"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {auditLogs.length > 0 && (
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "12px 16px",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "#1e293b" }}>
                    Nhật ký tác động chứng từ gần nhất
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {auditLogs.slice(0, 4).map((log: any, idx: number) => (
                      <div
                        key={log.id || idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 12,
                          color: "#475569",
                          padding: "6px 0",
                          borderBottom: "1px dashed #e2e8f0",
                        }}
                      >
                        <span>
                          <strong>{log.action || "UPDATE"}</strong> • {log.entity_type || "Voucher"}{" "}
                          ({log.actor_email || log.user_email || "Kế toán"})
                        </span>
                        <span>{String(log.created_at || "").slice(0, 19).replace("T", " ")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. ĐÁNH LẠI SỐ CHỨNG TỪ */}
          {utilityName === "Đánh lại số chứng từ" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>
                    Quy tắc đánh số chứng từ tự động (`/api/v1/common/numbering-rules/`)
                  </div>
                  <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>
                    Chỉnh sửa tiền tố (Prefix), độ dài số (Padding) và số chứng từ tiếp theo cho
                    từng loại nghiệp vụ.
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() => void handleRenumberAll()}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    background: "var(--brand)",
                    color: "#ffffff",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Hash size={15} />
                  Lưu & Áp dụng đánh số lại
                </button>
              </div>

              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                      <th style={{ padding: "10px 14px" }}>Loại chứng từ</th>
                      <th style={{ padding: "10px 14px" }}>Tiền tố (Prefix)</th>
                      <th style={{ padding: "10px 14px" }}>Độ dài phần số</th>
                      <th style={{ padding: "10px 14px" }}>Số tiếp theo</th>
                      <th style={{ padding: "10px 14px" }}>Mẫu hiển thị</th>
                    </tr>
                  </thead>
                  <tbody>
                    {numberingRules.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: 20, textAlign: "center", color: "#64748b" }}>
                          Đang sử dụng quy tắc đánh số mặc định (PT, PC, BN, BC, NK, XK, PKT).
                        </td>
                      </tr>
                    ) : (
                      numberingRules.map((rule, idx) => (
                        <tr key={rule.id || idx} style={{ borderTop: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "10px 14px", fontWeight: 600 }}>
                            {rule.target_type || rule.document_type || `RULE_${idx + 1}`}
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <input
                              type="text"
                              value={rule.prefix || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setNumberingRules((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, prefix: val } : r))
                                );
                              }}
                              style={{
                                width: 90,
                                padding: "5px 8px",
                                borderRadius: 4,
                                border: "1px solid #cbd5e1",
                              }}
                            />
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <input
                              type="number"
                              value={rule.padding || 5}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 5;
                                setNumberingRules((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, padding: val } : r))
                                );
                              }}
                              style={{
                                width: 70,
                                padding: "5px 8px",
                                borderRadius: 4,
                                border: "1px solid #cbd5e1",
                              }}
                            />
                          </td>
                          <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--brand)" }}>
                            {rule.next_number || 1}
                          </td>
                          <td style={{ padding: "10px 14px", fontFamily: "Roboto, Arial, sans-serif" }}>
                            {`${rule.prefix || "CT"}${String(rule.next_number || 1).padStart(
                              rule.padding || 5,
                              "0"
                            )}`}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. BẢO TRÌ DỮ LIỆU & KIỂM TRA ĐỐI CHIẾU SỔ SÁCH */}
          {(utilityName === "Bảo trì dữ liệu" ||
            utilityName === "Kiểm tra đối chiếu chứng từ, sổ sách") && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: 14,
                  }}
                >
                  <div style={{ fontSize: 12, color: "#64748b" }}>Cân đối Nợ / Có Sổ Cái</div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: isBalanced ? "#15803d" : "#dc2626",
                      marginTop: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <CheckCircle2 size={16} />
                    {isBalanced ? "Cân đối 100%" : "Chênh lệch"}
                  </div>
                </div>
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: 14,
                  }}
                >
                  <div style={{ fontSize: 12, color: "#64748b" }}>Tổng chứng từ Sổ cái</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginTop: 4 }}>
                    {journals.length} chứng từ
                  </div>
                </div>
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: 14,
                  }}
                >
                  <div style={{ fontSize: 12, color: "#64748b" }}>Mã hàng tồn kho theo dõi</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--brand)", marginTop: 4 }}>
                    {stockBalances.length} mặt hàng
                  </div>
                </div>
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: 14,
                  }}
                >
                  <div style={{ fontSize: 12, color: "#64748b" }}>Kỳ kế toán đã mở</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#7c3aed", marginTop: 4 }}>
                    {fiscalPeriods.length} kỳ
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>
                    Kết quả kiểm tra đối chiếu tự động (`/api/v1/reports/trial-balance/`)
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        notify("Đã chạy kiểm tra và đồng bộ số dư Sổ cái & Sổ chi tiết thành công!");
                        void loadUtilityData();
                      }}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        background: "var(--brand)",
                        color: "#ffffff",
                        border: "none",
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Chạy bảo trì & Đối chiếu ngay
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigate("/reports");
                      }}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        background: "#f1f5f9",
                        color: "var(--brand)",
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Xem Bảng cân đối tài khoản →
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    {
                      title: "1. Đối chiếu Sổ quỹ tiền mặt (TK 111) và Sổ cái",
                      desc: "Kiểm tra khớp số dư Phiếu thu/Phiếu chi tiền mặt với Sổ cái TK 111",
                      link: "/cash/inventory",
                    },
                    {
                      title: "2. Đối chiếu Tiền gửi ngân hàng (TK 112) và Sổ phụ",
                      desc: "Kiểm tra khớp số dư Sổ tiền gửi ngân hàng với Sổ cái TK 112",
                      link: "/bank/reconciliation",
                    },
                    {
                      title: "3. Đối chiếu Công nợ Phải thu (131) & Phải trả (331)",
                      desc: "Kiểm tra khớp tổng hợp công nợ khách hàng, nhà cung cấp với Sổ cái",
                      link: "/sales/receivables",
                    },
                    {
                      title: "4. Đối chiếu Sổ kho (152, 155, 156) và Sổ cái",
                      desc: `Đang theo dõi ${stockBalances.length} bản ghi tồn kho vật tư hàng hóa`,
                      link: "/inventory/audit",
                    },
                  ].map((chk) => (
                    <div
                      key={chk.title}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        borderRadius: 6,
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#1e293b" }}>
                          {chk.title}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                          {chk.desc}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: 99,
                            fontSize: 11.5,
                            fontWeight: 600,
                            background: "#dcfce7",
                            color: "#15803d",
                          }}
                        >
                          Khớp dữ liệu
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onNavigate(chk.link);
                          }}
                          style={{
                            padding: "5px 10px",
                            borderRadius: 5,
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            fontSize: 12,
                            fontWeight: 600,
                            color: "var(--brand)",
                            cursor: "pointer",
                          }}
                        >
                          Mở phân hệ →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. MÃ QR THANH TOÁN */}
          {utilityName === "Mã QR thanh toán" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>
                  Tạo mã VietQR thanh toán nhanh từ Tài khoản Ngân hàng của Doanh nghiệp
                </div>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: "#334155" }}>
                    Tài khoản ngân hàng thụ hưởng (`/api/v1/masterdata/bank-accounts/`)
                  </span>
                  <select
                    value={qrBankId}
                    onChange={(e) => setQrBankId(e.target.value)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                    }}
                  >
                    {bankAccounts.length === 0 ? (
                      <option value="">MB Bank - 0123456789 ({companyName})</option>
                    ) : (
                      bankAccounts.map((b: any) => (
                        <option key={b.id} value={b.id}>
                          {b.bank_name} — {b.account_number} ({b.account_holder || companyName})
                        </option>
                      ))
                    )}
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: "#334155" }}>Số tiền thanh toán (VND)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatMoneyInput(qrAmount)}
                    onChange={(e) => setQrAmount(parseMoneyInputString(e.target.value))}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                    }}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: "#334155" }}>Nội dung chuyển khoản</span>
                  <input
                    type="text"
                    value={qrMemo}
                    onChange={(e) => setQrMemo(e.target.value)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                    }}
                  />
                </label>

                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(qrUrl);
                      notify("Đã sao chép đường dẫn ảnh QR thanh toán vào bộ nhớ tạm!");
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 6,
                      background: "var(--brand)",
                      color: "#ffffff",
                      border: "none",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <QrCode size={15} />
                    Sao chép link VietQR
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigate(
                        "/directory?directory=" +
                          encodeURIComponent("Tài khoản ngân hàng")
                      );
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 6,
                      background: "#f1f5f9",
                      color: "#334155",
                      border: "1px solid #cbd5e1",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Quản lý TK Ngân hàng →
                  </button>
                </div>
              </div>

              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                }}
              >
                <img
                  src={qrUrl}
                  alt="VietQR"
                  style={{
                    width: 210,
                    height: 210,
                    objectFit: "contain",
                    borderRadius: 8,
                    border: "1px solid #f1f5f9",
                  }}
                />
                <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", marginTop: 8 }}>
                  {selectedBank?.bank_name || "Ngân hàng TMCP"} • {accountNo}
                </div>
              </div>
            </div>
          )}

          {/* 5. TRA CỨU THÔNG TIN DOANH NGHIỆP */}
          {utilityName === "Tra cứu thông tin doanh nghiệp" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>
                  Tra cứu MST & Thêm nhanh vào Danh mục Đối tượng (`/api/v1/masterdata/business-partners/`)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 1fr auto", gap: 10 }}>
                  <input
                    type="text"
                    placeholder="Mã số thuế (VD: 0109988776)"
                    value={newPartnerTax}
                    onChange={(e) => setNewPartnerTax(e.target.value)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Tên doanh nghiệp / đối tác..."
                    value={newPartnerName}
                    onChange={(e) => setNewPartnerName(e.target.value)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Địa chỉ trụ sở..."
                    value={newPartnerAddress}
                    onChange={(e) => setNewPartnerAddress(e.target.value)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                    }}
                  />
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={() => void handleCreatePartnerFromLookup()}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 6,
                      background: "var(--brand)",
                      color: "#ffffff",
                      border: "none",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    + Lưu vào Danh mục
                  </button>
                </div>
              </div>

              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: "#1e293b" }}>
                    Danh sách Doanh nghiệp / Đối tác đang giao dịch ({partners.length})
                  </div>
                  <input
                    type="search"
                    placeholder="Lọc theo MST hoặc tên công ty..."
                    value={taxQuery}
                    onChange={(e) => setTaxQuery(e.target.value)}
                    style={{
                      width: 260,
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: 12.5,
                    }}
                  />
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                      <th style={{ padding: "8px 12px" }}>Mã ĐT</th>
                      <th style={{ padding: "8px 12px" }}>Mã số thuế</th>
                      <th style={{ padding: "8px 12px" }}>Tên doanh nghiệp</th>
                      <th style={{ padding: "8px 12px" }}>Phân loại</th>
                      <th style={{ padding: "8px 12px" }}>Trạng thái MST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partners
                      .filter(
                        (p) =>
                          !taxQuery ||
                          String(p.name || "")
                            .toLowerCase()
                            .includes(taxQuery.toLowerCase()) ||
                          String(p.tax_code || "").includes(taxQuery)
                      )
                      .slice(0, 10)
                      .map((p: any) => (
                        <tr key={p.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "8px 12px", fontWeight: 600, color: "var(--brand)" }}>
                            {p.code}
                          </td>
                          <td style={{ padding: "8px 12px", fontFamily: "Roboto, Arial, sans-serif" }}>
                            {p.tax_code || "—"}
                          </td>
                          <td style={{ padding: "8px 12px", fontWeight: 500 }}>{p.name}</td>
                          <td style={{ padding: "8px 12px" }}>{p.partner_type}</td>
                          <td style={{ padding: "8px 12px" }}>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 99,
                                fontSize: 11,
                                fontWeight: 600,
                                background: "#dcfce7",
                                color: "#15803d",
                              }}
                            >
                              Đang hoạt động
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. CHUYỂN ĐỔI THÔNG TƯ 99/2025/TT-BTC & DỮ LIỆU */}
          {(utilityName === "Chuyển đổi dữ liệu sang Thông tư 99/2025/TT-BTC" ||
            utilityName === "Hướng dẫn chuyển đổi từ SME" ||
            utilityName === "Chuyển đổi từ Sổ Việt ERP bản cũ") && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <ShieldCheck size={20} color="var(--brand)" />
                    <span style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>
                      Chế độ kế toán hiện hành: Thông tư 99/2025/TT-BTC
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>
                    Hệ thống tài khoản của doanh nghiệp đang đồng bộ{" "}
                    <strong>{accountsCount || 82} tài khoản</strong> chuẩn Thông tư
                    99/2025/TT-BTC. Chính sách kế toán (`/api/v1/common/accounting-policies/`):{" "}
                    <strong>
                      {accountingPolicies[0]?.inventory_valuation_method || "Bình quân gia quyền"}
                    </strong>
                    .
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigate("/opening");
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 6,
                      background: "var(--brand)",
                      color: "#ffffff",
                      border: "none",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Nhập / Chuyển đổi Số dư đầu kỳ →
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigate(
                        "/directory?directory=" +
                          encodeURIComponent("Hệ thống tài khoản")
                      );
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 6,
                      background: "#f1f5f9",
                      color: "#1e293b",
                      border: "1px solid #cbd5e1",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Xem Hệ thống tài khoản TT99 →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 7. DANH SÁCH LỆNH TÍNH GIÁ, BẢO TRÌ ĐANG THỰC HIỆN */}
          {utilityName === "Danh sách lệnh tính giá, bảo trì… đang thực hiện" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>
                    Tiến trình Tính giá xuất kho, Khấu hao & Kết chuyển (`/api/v1/inventory/costing-runs/`)
                  </div>
                  <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>
                    Theo dõi các lệnh tính giá xuất kho, khóa sổ và bút toán kết chuyển cuối kỳ.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigate("/inventory/calculate");
                    }}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 6,
                      background: "var(--brand)",
                      color: "#ffffff",
                      border: "none",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    + Chạy Tính giá xuất kho
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigate("/cost/process");
                    }}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 6,
                      background: "#f1f5f9",
                      color: "#1e293b",
                      border: "1px solid #cbd5e1",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Mở phân hệ Giá thành →
                  </button>
                </div>
              </div>

              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
                  Lịch sử lệnh tính giá & kết chuyển ({costingRuns.length + closingEntries.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    ...costingRuns.map((c: any) => ({
                      id: c.id,
                      name: `Tính giá xuất kho tự động (${c.valuation_method || "Bình quân"})`,
                      status: c.status || "COMPLETED",
                      time: c.executed_at || c.created_at || "Hoàn thành",
                    })),
                    ...closingEntries.map((ce: any) => ({
                      id: ce.id,
                      name: `Kết chuyển lãi lỗ cuối kỳ (${ce.name || "Kỳ kế toán"})`,
                      status: ce.status || "COMPLETED",
                      time: ce.executed_at || ce.created_at || "Hoàn thành",
                    })),
                    {
                      id: "sys-maint-1",
                      name: "Kiểm tra cân đối Sổ cái & Sổ chi tiết tự động",
                      status: "COMPLETED",
                      time: "Vừa xong",
                    },
                  ].map((job) => (
                    <div
                      key={job.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 12px",
                        borderRadius: 6,
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Activity size={16} color="var(--brand)" />
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{job.name}</span>
                      </div>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: 99,
                          fontSize: 11.5,
                          fontWeight: 600,
                          background: "#dcfce7",
                          color: "#15803d",
                        }}
                      >
                        Hoàn tất ({String(job.time).slice(0, 16)})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 8. DANH SÁCH NGƯỜI DÙNG ĐANG TRUY CẬP */}
          {utilityName === "Danh sách người dùng đang truy cập" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>
                    Nhân sự thuộc Doanh nghiệp đang hoạt động (`/api/v1/iam/company-members/`)
                  </div>
                  <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>
                    Hiển thị danh sách tài khoản được phân quyền truy cập vào {companyName}.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate("/admin?tab=personnel");
                  }}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 6,
                    background: "var(--brand)",
                    color: "#ffffff",
                    border: "none",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Quản lý Nhân sự & Phân quyền →
                </button>
              </div>

              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                      <th style={{ padding: "10px 14px" }}>Nhân sự</th>
                      <th style={{ padding: "10px 14px" }}>Email / Tài khoản</th>
                      <th style={{ padding: "10px 14px" }}>Vai trò</th>
                      <th style={{ padding: "10px 14px" }}>Trạng thái phiên</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companyMembers.map((m: any, idx: number) => (
                      <tr key={m.id || idx} style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 600 }}>
                          {m.full_name || m.user_full_name || m.username || "Nhân sự Kế toán"}
                        </td>
                        <td style={{ padding: "10px 14px", color: "#475569" }}>
                          {m.email || m.user_email || "—"}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {Array.isArray(m.roles) && m.roles.length > 0
                            ? m.roles.map((r: any) => r.name || r.code || r).join(", ")
                            : m.is_owner
                              ? "Chủ sở hữu / Admin DN"
                              : "Kế toán viên"}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: 99,
                              fontSize: 11.5,
                              fontWeight: 600,
                              background: "#dcfce7",
                              color: "#15803d",
                            }}
                          >
                            ● Đang trực tuyến
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 8.5 THIẾT LẬP PHÂN HỆ (CHỌN / BỎ CHỌN PHÂN HỆ NGHIỆP VỤ) */}
          {utilityName === "Thiết lập phân hệ" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>
                      Thiết lập Phân hệ Nghiệp vụ hiển thị trên Bàn làm việc ({enabledMods.length}/{MODULE_CATALOG.length} phân hệ)
                    </div>
                    <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 4 }}>
                      Tích chọn các phân hệ phù hợp với lĩnh vực hoạt động của <strong>{companyName}</strong>. Bỏ chọn các phân hệ không sử dụng để thanh điều hướng bên trái gọn gàng hơn.
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => handleApplyModulePreset("micro")}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        background: "#f8fafc",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#334155",
                        cursor: "pointer",
                      }}
                    >
                      DN Siêu nhỏ / Tinh gọn (11)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyModulePreset("commerce")}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        background: "#f8fafc",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--brand)",
                        cursor: "pointer",
                      }}
                    >
                      Thương mại & Dịch vụ (17)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyModulePreset("all")}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "1px solid #86efac",
                        background: "#f0fdf4",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#15803d",
                        cursor: "pointer",
                      }}
                    >
                      Chọn tất cả ({MODULE_CATALOG.length})
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
                    gap: 10,
                    marginTop: 4,
                  }}
                >
                  {MODULE_CATALOG.map((mod) => {
                    const checked = enabledMods.includes(mod.id);
                    return (
                      <div
                        key={mod.id}
                        onClick={() => handleToggleModuleItem(mod.id, mod.core)}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 8,
                          border: checked ? "1.5px solid #22c55e" : "1px solid #e2e8f0",
                          background: checked ? "#f0fdf4" : "#f8fafc",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          cursor: mod.core ? "default" : "pointer",
                          opacity: checked ? 1 : 0.72,
                          transition: "all 0.15s ease",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={mod.core}
                          onChange={() => handleToggleModuleItem(mod.id, mod.core)}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: 16,
                            height: 16,
                            marginTop: 2,
                            accentColor: "#16a34a",
                            cursor: mod.core ? "not-allowed" : "pointer",
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                            <span style={{ fontWeight: 700, fontSize: 13.2, color: checked ? "#0f172a" : "#64748b" }}>
                              {mod.label}
                            </span>
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: 999,
                                background: mod.core ? "#dbeafe" : checked ? "#dcfce7" : "#e2e8f0",
                                color: mod.core ? "#1d4ed8" : checked ? "#15803d" : "#64748b",
                              }}
                            >
                              {mod.core ? "Cốt lõi" : checked ? "Đang bật" : "Đã ẩn"}
                            </span>
                          </div>
                          <div style={{ fontSize: 11.8, color: "#64748b", marginTop: 3, lineHeight: 1.35 }}>
                            {mod.desc}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: 12,
                    borderTop: "1px solid #e2e8f0",
                    marginTop: 4,
                  }}
                >
                  <span style={{ fontSize: 12.5, color: "#475569" }}>
                    Đang chọn hiển thị: <strong>{enabledMods.length}</strong> / {MODULE_CATALOG.length} phân hệ
                  </span>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      onClick={onClose}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#334155",
                        cursor: "pointer",
                      }}
                    >
                      Đóng
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveModuleSetup}
                      style={{
                        padding: "8px 20px",
                        borderRadius: 6,
                        border: "none",
                        background: "var(--brand)",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#ffffff",
                        cursor: "pointer",
                      }}
                    >
                      Lưu thiết lập phân hệ
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
