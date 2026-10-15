import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import "./live-gl.css";

type TabKey =
  | "journals"
  | "accounts"
  | "trial-balance"
  | "ledger"
  | "periods"
  | "allocations"
  | "closings"
  | "budgets"
  | "reconciliations";

interface ReferenceData {
  periods: any[];
  accounts: any[];
  accountClasses: any[];
  branches: any[];
  currencies: any[];
  charts: any[];
}

export default function LiveGeneralLedger() {
  const { session } = useApiSession();
  const [activeTab, setActiveTab] = useState<TabKey>("journals");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Auth & Session
  const [token, setToken] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("erp_api_session");
      if (raw) {
        const parsed = JSON.parse(raw);
        setToken(parsed.token || parsed.access || "");
        setCompanyId(parsed.companyId || (parsed.companies && parsed.companies[0]?.id) || "");
      }
    } catch (e) {
      console.error("Failed to parse erp_api_session", e);
    }
  }, []);

  const getHeaders = useCallback(() => {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }, [token]);

  // Master References
  const [refsLoaded, setRefsLoaded] = useState(false);
  const [refs, setRefs] = useState<ReferenceData>({
    periods: [],
    accounts: [],
    accountClasses: [],
    branches: [],
    currencies: [],
    charts: [],
  });

  // Tab Data States
  const [journals, setJournals] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [trialBalances, setTrialBalances] = useState<{ totals: any; balances: any[] }>({
    totals: {},
    balances: [],
  });
  const [ledgerLines, setLedgerLines] = useState<any[]>([]);
  const [selectedLedgerAccount, setSelectedLedgerAccount] = useState<string>("");
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [periods, setPeriods] = useState<any[]>([]);
  const [allocationRules, setAllocationRules] = useState<any[]>([]);
  const [allocationRuns, setAllocationRuns] = useState<any[]>([]);
  const [closingRules, setClosingRules] = useState<any[]>([]);
  const [closingRuns, setClosingRuns] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [reconciliations, setReconciliations] = useState<any[]>([]);

  // Modals & Forms
  const [modalType, setModalType] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [journalLines, setJournalLines] = useState<any[]>([
    { line_no: 1, account: "", debit: "5000000", credit: "0", description: "Chi phí hoạt động" },
    { line_no: 2, account: "", debit: "0", credit: "5000000", description: "Thanh toán tiền mặt" },
  ]);

  // Fetch Master References
  const fetchRefs = useCallback(async () => {
    if (!companyId) return;
    try {
      const h = getHeaders();
      const [perRes, accRes, classRes, branchRes, currRes, chartRes] = await Promise.all([
        fetch(`/api/v1/general-ledger/periods/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/general-ledger/accounts/?company_id=${companyId}&ordering=code`, { headers: h }),
        fetch(`/api/v1/general-ledger/account-classes/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/organization/branches/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/currencies/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/general-ledger/charts-of-accounts/?company_id=${companyId}`, { headers: h }),
      ]);

      const perData = perRes.ok ? await perRes.json() : [];
      const accData = accRes.ok ? await accRes.json() : [];
      const classData = classRes.ok ? await classRes.json() : [];
      const branchData = branchRes.ok ? await branchRes.json() : [];
      const currData = currRes.ok ? await currRes.json() : [];
      const chartData = chartRes.ok ? await chartRes.json() : [];

      const perList = Array.isArray(perData) ? perData : perData.results || [];
      const accList = Array.isArray(accData) ? accData : accData.results || [];
      const chartList = Array.isArray(chartData) ? chartData : chartData.results || [];

      setRefs({
        periods: perList,
        accounts: accList,
        accountClasses: Array.isArray(classData) ? classData : classData.results || [],
        branches: Array.isArray(branchData) ? branchData : branchData.results || [],
        currencies: Array.isArray(currData) ? currData : currData.results || [],
        charts: chartList,
      });

      setPeriods(perList);
      setAccounts(accList);
      if (perList.length > 0 && !selectedPeriodId) {
        const currentPer = perList.find((p: any) => p.code === "2026-10") || perList[0];
        setSelectedPeriodId(currentPer.id);
      }
      if (accList.length > 0 && !selectedLedgerAccount) {
        setSelectedLedgerAccount(accList[0].id);
      }

      setRefsLoaded(true);
    } catch (e: any) {
      console.error("fetchRefs error", e);
    }
  }, [companyId, getHeaders, selectedPeriodId, selectedLedgerAccount]);

  // Load Active Tab Data
  const loadTabData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const h = getHeaders();

    try {
      if (activeTab === "journals") {
        const res = await fetch(`/api/v1/general-ledger/journals/?company_id=${companyId}&ordering=-created_at`, {
          headers: h,
        });
        if (res.ok) {
          const d = await res.json();
          setJournals(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "accounts") {
        const res = await fetch(`/api/v1/general-ledger/accounts/?company_id=${companyId}&ordering=code`, {
          headers: h,
        });
        if (res.ok) {
          const d = await res.json();
          setAccounts(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "trial-balance") {
        const pQuery = selectedPeriodId ? `&period_id=${selectedPeriodId}` : "";
        const res = await fetch(
          `/api/v1/general-ledger/balances/trial-balance/?company_id=${companyId}${pQuery}`,
          { headers: h }
        );
        if (res.ok) {
          const d = await res.json();
          setTrialBalances({
            totals: d.totals || {},
            balances: Array.isArray(d.balances) ? d.balances : [],
          });
        }
      } else if (activeTab === "ledger") {
        if (selectedLedgerAccount) {
          const pQuery = selectedPeriodId ? `&period_id=${selectedPeriodId}` : "";
          const res = await fetch(
            `/api/v1/general-ledger/balances/ledger/?company_id=${companyId}&account_id=${selectedLedgerAccount}${pQuery}`,
            { headers: h }
          );
          if (res.ok) {
            const d = await res.json();
            setLedgerLines(Array.isArray(d) ? d : []);
          }
        }
      } else if (activeTab === "periods") {
        const res = await fetch(`/api/v1/general-ledger/periods/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setPeriods(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "allocations") {
        const [rulesRes, runsRes] = await Promise.all([
          fetch(`/api/v1/general-ledger/allocation-rules/?company_id=${companyId}&ordering=-id`, { headers: h }),
          fetch(`/api/v1/general-ledger/allocation-runs/?company_id=${companyId}`, { headers: h }),
        ]);
        if (rulesRes.ok) {
          const d = await rulesRes.json();
          setAllocationRules(Array.isArray(d) ? d : d.results || []);
        }
        if (runsRes.ok) {
          const d = await runsRes.json();
          setAllocationRuns(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "closings") {
        const [rulesRes, runsRes] = await Promise.all([
          fetch(`/api/v1/general-ledger/closing-rules/?company_id=${companyId}&ordering=-id`, { headers: h }),
          fetch(`/api/v1/general-ledger/closing-runs/?company_id=${companyId}`, { headers: h }),
        ]);
        if (rulesRes.ok) {
          const d = await rulesRes.json();
          setClosingRules(Array.isArray(d) ? d : d.results || []);
        }
        if (runsRes.ok) {
          const d = await runsRes.json();
          setClosingRuns(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "budgets") {
        const res = await fetch(`/api/v1/general-ledger/budgets/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setBudgets(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "reconciliations") {
        const res = await fetch(`/api/v1/general-ledger/reconciliations/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setReconciliations(Array.isArray(d) ? d : d.results || []);
        }
      }
    } catch (e: any) {
      setNotice({ type: "error", text: "Lỗi tải dữ liệu: " + e.message });
    } finally {
      setLoading(false);
    }
  }, [companyId, activeTab, selectedPeriodId, selectedLedgerAccount, getHeaders]);

  useEffect(() => {
    if (companyId && token) {
      if (!refsLoaded) {
        fetchRefs();
      }
      loadTabData();
    }
  }, [companyId, token, activeTab, fetchRefs, loadTabData, refsLoaded]);

  // Actions: Journal Workflows
  const handleJournalAction = async (id: string, actionName: "submit" | "approve" | "post" | "cancel" | "reverse") => {
    try {
      const h = getHeaders();
      let body: any = {};
      if (actionName === "submit") {
        body = {
          workflow_snapshot: {
            levels: 1,
            allow_self_approval: true,
            allow_creator_posting: true,
          },
        };
      } else if (actionName === "approve") {
        body = { comment: "Phê duyệt bút toán kế toán" };
      } else if (actionName === "cancel") {
        body = { reason: "Hủy bút toán nháp" };
      } else if (actionName === "reverse") {
        const targetPeriod = refs.periods.find((p) => p.status === "OPEN") || refs.periods[0];
        body = {
          period: targetPeriod?.id,
          posting_date: new Date().toISOString().split("T")[0],
          number: `REV-JV-${Date.now().toString().slice(-6)}`,
          reason: "Đảo bút toán hạch toán sai",
        };
      }

      const res = await fetch(`/api/v1/general-ledger/journals/${id}/${actionName}/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err) || `Thực hiện ${actionName} thất bại`);
      }

      setNotice({ type: "success", text: `Thực hiện ${actionName.toUpperCase()} bút toán thành công!` });
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: e.message });
    }
  };

  // 1. Create Journal Entry (UC-GL-03)
  const handleCreateJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const h = getHeaders();
      const targetPeriod = refs.periods.find((p) => p.id === formData.period) || refs.periods[0];
      const targetBranch = refs.branches.find((b) => b.id === formData.branch) || refs.branches[0];
      const targetCurrency = refs.currencies.find((c) => c.code === "VND") || refs.currencies[0];

      const linesPayload = journalLines.map((line, idx) => ({
        line_no: idx + 1,
        account: line.account,
        debit: line.debit || "0",
        credit: line.credit || "0",
        currency: targetCurrency?.id,
        exchange_rate: 1,
        description: line.description || formData.description,
      }));

      let postDate = formData.posting_date || new Date().toISOString().split("T")[0];
      if (targetPeriod && (postDate < targetPeriod.start_date || postDate > targetPeriod.end_date)) {
        postDate = targetPeriod.start_date;
      }

      const payload = {
        company: companyId,
        branch: targetBranch?.id,
        period: targetPeriod?.id,
        number: formData.number || `JV-${Date.now().toString().slice(-6)}`,
        entry_type: "MANUAL",
        posting_date: postDate,
        document_date: postDate,
        description: formData.description || "Ghi nhận chi phí phát sinh",
        source_module: "",
        lines: linesPayload,
      };

      const res = await fetch(`/api/v1/general-ledger/journals/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(err));
      }

      setNotice({ type: "success", text: "Tạo bút toán kế toán thành công!" });
      setModalType(null);
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: "Lỗi tạo bút toán: " + e.message });
    }
  };

  // 2. Create Account (UC-GL-01)
  const handleCreateAccount = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const h = getHeaders();
      const targetClass = refs.accountClasses.find((c) => c.id === formData.account_class) || refs.accountClasses[0];
      const code = formData.code || `811${Date.now().toString().slice(-4)}`;
      const name = formData.name || "Chi phí phát sinh khác";
      const targetChart = (refs.charts && refs.charts[0]?.id)
        || refs.accounts.find((a) => a.chart_of_accounts)?.chart_of_accounts
        || "b595d09a-c573-4ade-8ae5-2933a30d935e";

      const payload = {
        company: companyId,
        chart_of_accounts: targetChart,
        account_class: targetClass?.id,
        code: code,
        name: name,
        account_level: code.length <= 3 ? 1 : 2,
        account_type: formData.account_type || "EXPENSE",
        normal_balance: formData.normal_balance || "DEBIT",
        is_postable: true,
        status: "ACTIVE",
      };

      const res = await fetch(`/api/v1/general-ledger/accounts/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(err));
      }

      setNotice({ type: "success", text: "Thêm tài khoản kế toán mới thành công!" });
      setModalType(null);
      fetchRefs();
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: "Lỗi tạo tài khoản: " + e.message });
    }
  };

  // 3. Aggregate Period Balances (UC-GL-09)
  const handleAggregatePeriod = async (periodId: string) => {
    try {
      const h = getHeaders();
      const res = await fetch(`/api/v1/general-ledger/periods/${periodId}/aggregate/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err) || "Tổng hợp số dư thất bại");
      }

      setNotice({ type: "success", text: "Tổng hợp lại số dư tài khoản theo kỳ thành công!" });
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: e.message });
    }
  };

  // 4. Create Allocation Rule & Run (UC-GL-06)
  const handleCreateAllocationRule = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const h = getHeaders();
      const sourceAcc = refs.accounts.find((a) => a.id === formData.source_account)
        || refs.accounts.find((a) => a.code === "632")
        || refs.accounts[0];
      const offsetAcc = refs.accounts.find((a) => a.id === formData.offset_account)
        || refs.accounts.find((a) => a.code === "632")
        || refs.accounts[1];
      const destAcc = refs.accounts.find((a) => a.id === formData.destination_account)
        || refs.accounts.find((a) => a.code === "641")
        || refs.accounts[2];

      const payload = {
        company: companyId,
        code: formData.code || `PB-${Date.now().toString().slice(-4)}`,
        name: formData.name || "Phân bổ giá vốn bán hàng sang chi phí",
        source_account: sourceAcc?.id,
        offset_account: offsetAcc?.id,
        method: "FIXED_PERCENT",
        is_active: true,
        destinations: [
          {
            account: destAcc?.id,
            percentage: "100.00",
          },
        ],
      };

      const res = await fetch(`/api/v1/general-ledger/allocation-rules/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(err));
      }

      setNotice({ type: "success", text: "Tạo quy tắc phân bổ chi phí thành công!" });
      setModalType(null);
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: "Lỗi tạo quy tắc phân bổ: " + e.message });
    }
  };

  const handleRunAllocation = async (ruleId: string) => {
    try {
      const h = getHeaders();
      const targetPeriod = refs.periods.find((p) => p.code === "2026-10")
        || (selectedPeriodId && refs.periods.find((p) => p.id === selectedPeriodId))
        || refs.periods[0];
      const payload = {
        company: companyId,
        period: targetPeriod?.id,
        idempotency_key: `ALLOC:${targetPeriod?.code}:${ruleId}:${Date.now()}`,
      };

      const res = await fetch(`/api/v1/general-ledger/allocation-rules/${ruleId}/run/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err) || "Chạy phân bổ thất bại");
      }

      setNotice({ type: "success", text: "Chạy phân bổ chi phí và sinh bút toán thành công!" });
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: e.message });
    }
  };

  // 5. Create Closing Rule & Run (UC-GL-07)
  const handleCreateClosingRule = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const h = getHeaders();
      const sourceAcc = refs.accounts.find((a) => a.id === formData.source_account)
        || refs.accounts.find((a) => a.code === "5111")
        || refs.accounts[0];
      const destAcc = refs.accounts.find((a) => a.id === formData.destination_account)
        || refs.accounts.find((a) => a.code === "911")
        || refs.accounts[1];

      const payload = {
        company: companyId,
        code: formData.code || `KC-${Date.now().toString().slice(-4)}`,
        name: formData.name || "Kết chuyển doanh thu xác định KQKD",
        source_account: sourceAcc?.id,
        destination_account: destAcc?.id,
        sequence: Number(formData.sequence) || 1,
        is_active: true,
      };

      const res = await fetch(`/api/v1/general-ledger/closing-rules/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(err));
      }

      setNotice({ type: "success", text: "Tạo quy tắc kết chuyển cuối kỳ thành công!" });
      setModalType(null);
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: "Lỗi tạo quy tắc kết chuyển: " + e.message });
    }
  };

  const handleRunClosing = async (ruleId: string) => {
    try {
      const h = getHeaders();
      const targetPeriod = refs.periods.find((p) => p.code === "2026-10")
        || (selectedPeriodId && refs.periods.find((p) => p.id === selectedPeriodId))
        || refs.periods[0];
      const payload = {
        company: companyId,
        period: targetPeriod?.id,
      };

      const res = await fetch(`/api/v1/general-ledger/closing-rules/${ruleId}/run/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err) || "Chạy kết chuyển thất bại");
      }

      setNotice({ type: "success", text: "Chạy kết chuyển cuối kỳ thành công!" });
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: e.message });
    }
  };

  // 6. Create Budget Line (UC-GL-02)
  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const h = getHeaders();
      const targetPeriod = refs.periods.find((p) => p.id === formData.period) || refs.periods[0];
      const targetAcc = refs.accounts.find((a) => a.id === formData.account) || refs.accounts[0];

      const payload = {
        company: companyId,
        period: targetPeriod?.id,
        account: targetAcc?.id,
        amount: formData.amount || "100000000",
        notes: formData.notes || "Ngân sách chi phí năm 2026",
      };

      const res = await fetch(`/api/v1/general-ledger/budgets/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(err));
      }

      setNotice({ type: "success", text: "Lập định mức ngân sách thành công!" });
      setModalType(null);
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: "Lỗi lập ngân sách: " + e.message });
    }
  };

  // 7. Run Reconciliation (UC-GL-11)
  const handleRunReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const h = getHeaders();
      const targetPeriod = refs.periods.find((p) => p.id === formData.period) || refs.periods[0];
      const targetAcc = refs.accounts.find((a) => a.id === formData.account) || refs.accounts[0];

      const payload = {
        company: companyId,
        period: targetPeriod?.id,
        account: targetAcc?.id,
        source_module: formData.source_module || "AP",
        subledger_amount: formData.subledger_amount || "15000000",
        details: { count: 5 },
      };

      const res = await fetch(`/api/v1/general-ledger/reconciliations/run/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err) || "Chạy đối chiếu thất bại");
      }

      setNotice({ type: "success", text: "Chạy đối chiếu sổ cái với phân hệ nguồn thành công!" });
      setModalType(null);
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: e.message });
    }
  };

  // Format Helper
  const formatNum = (val: any) => {
    const num = Number(val) || 0;
    return num.toLocaleString("vi-VN");
  };

  // KPI Calculations
  const totalDebit = journals
    .filter((j) => j.status === "POSTED")
    .reduce((sum, j) => sum + (Number(j.total_debit) || 0), 0);
  const totalCredit = journals
    .filter((j) => j.status === "POSTED")
    .reduce((sum, j) => sum + (Number(j.total_credit) || 0), 0);
  const postedCount = journals.filter((j) => j.status === "POSTED").length;

  return (
    <div className="live-gl-root">
      {/* Top Header */}
      <header className="live-gl-header">
        <div className="live-gl-title-box">
          <div className="live-gl-title">
            <span>⚖️</span>
            <span>Sổ Cái & Báo Cáo Tài Chính (General Ledger Management)</span>
            <span className="live-gl-badge">UC-GL-01 → UC-GL-12</span>
          </div>
          <div className="live-gl-company-info">
            <span>Doanh nghiệp:</span>
            <span className="live-gl-company-tag">{companyId.slice(0, 8)}...</span>
          </div>
        </div>

        <div className="live-gl-btn-group">
          <Link to="/tax" className="live-gl-btn live-gl-btn-secondary">
            🏛️ Quản lý thuế
          </Link>
          <Link to="/assets" className="live-gl-btn live-gl-btn-secondary">
            🏢 Tài sản & CCDC
          </Link>
          <Link to="/bank" className="live-gl-btn live-gl-btn-secondary">
            🏦 Ngân hàng
          </Link>
          <Link to="/cash" className="live-gl-btn live-gl-btn-secondary">
            💵 Tiền mặt
          </Link>
          <button
            onClick={() => {
              fetchRefs();
              loadTabData();
            }}
            className="live-gl-btn live-gl-btn-primary"
          >
            🔄 Làm mới
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="live-gl-nav">
        <button
          data-testid="tab-journals"
          className={`live-gl-nav-btn ${activeTab === "journals" ? "active" : ""}`}
          onClick={() => setActiveTab("journals")}
        >
          📑 Bút toán sổ cái <span className="live-gl-tag-pill">{journals.length}</span>
        </button>
        <button
          data-testid="tab-accounts"
          className={`live-gl-nav-btn ${activeTab === "accounts" ? "active" : ""}`}
          onClick={() => setActiveTab("accounts")}
        >
          🌳 Hệ thống tài khoản <span className="live-gl-tag-pill">{accounts.length}</span>
        </button>
        <button
          data-testid="tab-trial-balance"
          className={`live-gl-nav-btn ${activeTab === "trial-balance" ? "active" : ""}`}
          onClick={() => setActiveTab("trial-balance")}
        >
          ⚖️ Cân đối phát sinh <span className="live-gl-tag-pill">{trialBalances.balances.length}</span>
        </button>
        <button
          data-testid="tab-ledger"
          className={`live-gl-nav-btn ${activeTab === "ledger" ? "active" : ""}`}
          onClick={() => setActiveTab("ledger")}
        >
          📖 Sổ cái chi tiết <span className="live-gl-tag-pill">{ledgerLines.length}</span>
        </button>
        <button
          data-testid="tab-periods"
          className={`live-gl-nav-btn ${activeTab === "periods" ? "active" : ""}`}
          onClick={() => setActiveTab("periods")}
        >
          🔒 Kỳ kế toán & Số dư <span className="live-gl-tag-pill">{periods.length}</span>
        </button>
        <button
          data-testid="tab-allocations"
          className={`live-gl-nav-btn ${activeTab === "allocations" ? "active" : ""}`}
          onClick={() => setActiveTab("allocations")}
        >
          🔀 Phân bổ chi phí <span className="live-gl-tag-pill">{allocationRules.length}</span>
        </button>
        <button
          data-testid="tab-closings"
          className={`live-gl-nav-btn ${activeTab === "closings" ? "active" : ""}`}
          onClick={() => setActiveTab("closings")}
        >
          🔄 Kết chuyển cuối kỳ <span className="live-gl-tag-pill">{closingRules.length}</span>
        </button>
        <button
          data-testid="tab-budgets"
          className={`live-gl-nav-btn ${activeTab === "budgets" ? "active" : ""}`}
          onClick={() => setActiveTab("budgets")}
        >
          🎯 Ngân sách định mức <span className="live-gl-tag-pill">{budgets.length}</span>
        </button>
        <button
          data-testid="tab-reconciliations"
          className={`live-gl-nav-btn ${activeTab === "reconciliations" ? "active" : ""}`}
          onClick={() => setActiveTab("reconciliations")}
        >
          🔍 Đối chiếu GL <span className="live-gl-tag-pill">{reconciliations.length}</span>
        </button>
      </nav>

      {/* Main Container */}
      <main className="live-gl-container">
        {/* Notice Alert */}
        {notice && (
          <div className={`live-gl-notice ${notice.type}`}>
            <span>{notice.text}</span>
            <button
              onClick={() => setNotice(null)}
              style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        )}

        {/* KPI Banner */}
        <div className="live-gl-kpi-grid">
          <div className="live-gl-kpi-card">
            <span className="live-gl-kpi-label">Tổng phát sinh Nợ đã ghi sổ</span>
            <span className="live-gl-kpi-val highlight">{formatNum(totalDebit)} VND</span>
          </div>
          <div className="live-gl-kpi-card">
            <span className="live-gl-kpi-label">Tổng phát sinh Có đã ghi sổ</span>
            <span className="live-gl-kpi-val success">{formatNum(totalCredit)} VND</span>
          </div>
          <div className="live-gl-kpi-card">
            <span className="live-gl-kpi-label">Cân đối sổ cái (Chênh lệch)</span>
            <span className="live-gl-kpi-val info">
              {formatNum(Math.abs(totalDebit - totalCredit))} VND
            </span>
          </div>
          <div className="live-gl-kpi-card">
            <span className="live-gl-kpi-label">Bút toán đã ghi sổ / Tổng số</span>
            <span className="live-gl-kpi-val warning">
              {postedCount} / {journals.length} chứng từ
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="live-gl-controls">
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
              {activeTab === "journals" && "Danh Sách Bút Toán & Chứng Từ Sổ Cái (UC-GL-03, 04, 05, 08)"}
              {activeTab === "accounts" && "Hệ Thống Tài Khoản Kế Toán TT200 / TT133 (UC-GL-01)"}
              {activeTab === "trial-balance" && "Bảng Cân Đối Số Phát Sinh Tài Khoản (UC-GL-09, 12)"}
              {activeTab === "ledger" && "Sổ Cái Chi Tiết Tài Khoản (UC-GL-12)"}
              {activeTab === "periods" && "Quản Lý Kỳ Kế Toán & Tổng Hợp Số Dư (UC-GL-09, 10)"}
              {activeTab === "allocations" && "Quy Tắc & Lịch Sử Phân Bổ Chi Phí Tự Động (UC-GL-06)"}
              {activeTab === "closings" && "Quy Tắc & Lịch Sử Kết Chuyển Xác Định Kết Quả (UC-GL-07)"}
              {activeTab === "budgets" && "Quản Lý Hạn Mức Ngân Sách Theo Kỳ (UC-GL-02)"}
              {activeTab === "reconciliations" && "Đối Chiếu Dữ Liệu Sổ Cái Với Phân Hệ Nguồn (UC-GL-11)"}
            </h2>
          </div>

          <div className="live-gl-btn-group">
            {activeTab === "journals" && (
              <button
                data-testid="btn-create-journal"
                className="live-gl-btn live-gl-btn-primary"
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  const expenseAcc = refs.accounts.find((a) => a.code === "632") || refs.accounts[0];
                  const revenueAcc = refs.accounts.find((a) => a.code === "5111") || refs.accounts[1];

                  const matchingPeriod = refs.periods.find((p) => p.code === "2026-10")
                    || refs.periods.find((p) => p.start_date <= today && today <= p.end_date)
                    || refs.periods[0];
                  const validDate = (matchingPeriod && today >= matchingPeriod.start_date && today <= matchingPeriod.end_date)
                    ? today
                    : matchingPeriod?.start_date || today;

                  setFormData({
                    branch: refs.branches[0]?.id || "",
                    period: matchingPeriod?.id || "",
                    number: `JV-${Date.now().toString().slice(-6)}`,
                    posting_date: validDate,
                    document_date: validDate,
                    description: "Chi phí giá vốn và doanh thu kỳ 2026-10",
                  });
                  setJournalLines([
                    { line_no: 1, account: expenseAcc?.id || "", debit: "15000000", credit: "0", description: "Chi phí giá vốn kinh doanh" },
                    { line_no: 2, account: revenueAcc?.id || "", debit: "0", credit: "15000000", description: "Doanh thu bán hàng phát sinh" },
                  ]);
                  setModalType("create_journal");
                }}
              >
                + Lập Bút Toán Mới
              </button>
            )}

            {activeTab === "accounts" && (
              <button
                data-testid="btn-create-account"
                className="live-gl-btn live-gl-btn-primary"
                onClick={() => {
                  const randCode = `811${Date.now().toString().slice(-3)}`;
                  setFormData({
                    code: randCode,
                    name: "Chi phí phát sinh khác",
                    account_class: refs.accountClasses[0]?.id || "",
                    account_type: "EXPENSE",
                    normal_balance: "DEBIT",
                  });
                  setModalType("create_account");
                }}
              >
                + Thêm Tài Khoản
              </button>
            )}

            {activeTab === "allocations" && (
              <button
                data-testid="btn-create-allocation-rule"
                className="live-gl-btn live-gl-btn-primary"
                onClick={() => {
                  const expAcc = refs.accounts.find((a) => a.code === "632") || refs.accounts[0];
                  const destAcc = refs.accounts.find((a) => a.code === "641") || refs.accounts[1];
                  setFormData({
                    code: `PB-${Date.now()}`,
                    name: "Phân bổ giá vốn bán hàng sang chi phí",
                    source_account: expAcc?.id || "",
                    offset_account: expAcc?.id || "",
                    destination_account: destAcc?.id || "",
                  });
                  setModalType("create_allocation_rule");
                }}
              >
                + Tạo Quy Tắc Phân Bổ
              </button>
            )}

            {activeTab === "closings" && (
              <button
                data-testid="btn-create-closing-rule"
                className="live-gl-btn live-gl-btn-primary"
                onClick={() => {
                  const revAcc = refs.accounts.find((a) => a.code === "5111") || refs.accounts[0];
                  const resAcc = refs.accounts.find((a) => a.code === "911") || refs.accounts[1];
                  setFormData({
                    code: `KC-${Date.now()}`,
                    name: "Kết chuyển doanh thu bán hàng sang 911",
                    source_account: revAcc?.id || "",
                    destination_account: resAcc?.id || "",
                    sequence: "1",
                  });
                  setModalType("create_closing_rule");
                }}
              >
                + Tạo Quy Tắc Kết Chuyển
              </button>
            )}

            {activeTab === "budgets" && (
              <button
                data-testid="btn-create-budget"
                className="live-gl-btn live-gl-btn-primary"
                onClick={() => {
                  const existingKeys = new Set(budgets.map((b) => `${b.period}:${b.account}`));
                  let selectedPer = refs.periods[0];
                  let selectedAcc = refs.accounts[0];
                  for (const p of refs.periods) {
                    for (const a of refs.accounts) {
                      if (!existingKeys.has(`${p.id}:${a.id}`)) {
                        selectedPer = p;
                        selectedAcc = a;
                        break;
                      }
                    }
                    if (!existingKeys.has(`${selectedPer?.id}:${selectedAcc?.id}`)) break;
                  }

                  setFormData({
                    period: selectedPer?.id || "",
                    account: selectedAcc?.id || "",
                    amount: "50000000",
                    notes: "Ngân sách chi phí năm 2026",
                  });
                  setModalType("create_budget");
                }}
              >
                + Lập Hạn Mức Ngân Sách
              </button>
            )}

            {activeTab === "reconciliations" && (
              <button
                data-testid="btn-run-reconciliation"
                className="live-gl-btn live-gl-btn-primary"
                onClick={() => {
                  const apAcc = refs.accounts.find((a) => a.code === "331") || refs.accounts[0];
                  setFormData({
                    period: refs.periods[0]?.id || "",
                    account: apAcc?.id || "",
                    source_module: "AP",
                    subledger_amount: "10000000",
                  });
                  setModalType("run_reconciliation");
                }}
              >
                + Chạy Đối Chiếu GL
              </button>
            )}
          </div>
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
            Đang tải dữ liệu từ cơ sở dữ liệu...
          </div>
        )}

        {/* 1. JOURNALS TAB */}
        {!loading && activeTab === "journals" && (
          <div className="live-gl-table-card">
            <table className="live-gl-table">
              <thead>
                <tr>
                  <th>Số chứng từ</th>
                  <th>Ngày hạch toán</th>
                  <th>Loại</th>
                  <th>Kỳ kế toán</th>
                  <th>Diễn giải</th>
                  <th>Tổng Nợ (VND)</th>
                  <th>Tổng Có (VND)</th>
                  <th>Trạng thái</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {journals.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có bút toán nào
                    </td>
                  </tr>
                ) : (
                  journals.map((j) => (
                    <tr key={j.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{j.number}</td>
                      <td>{j.posting_date}</td>
                      <td>
                        <span className="live-gl-tag-pill">{j.entry_type}</span>
                      </td>
                      <td>{j.period_code || j.period}</td>
                      <td>{j.description}</td>
                      <td style={{ fontWeight: "700", color: "#818cf8" }}>{formatNum(j.total_debit)}</td>
                      <td style={{ fontWeight: "700", color: "#34d399" }}>{formatNum(j.total_credit)}</td>
                      <td>
                        <span className={`live-gl-badge-status ${j.status?.toLowerCase() || "draft"}`}>
                          {j.status}
                        </span>
                      </td>
                      <td>
                        <div className="live-gl-btn-group">
                          {(j.status === "DRAFT" || j.status === "REJECTED") && (
                            <button
                              className="live-gl-btn live-gl-btn-primary"
                              style={{ padding: "4px 8px", fontSize: "11px" }}
                              onClick={() => handleJournalAction(j.id, "submit")}
                            >
                              Gửi duyệt
                            </button>
                          )}
                          {j.status === "PENDING_APPROVAL" && (
                            <button
                              className="live-gl-btn live-gl-btn-success"
                              style={{ padding: "4px 8px", fontSize: "11px" }}
                              onClick={() => handleJournalAction(j.id, "approve")}
                            >
                              Duyệt
                            </button>
                          )}
                          {j.status === "APPROVED" && (
                            <button
                              className="live-gl-btn live-gl-btn-warning"
                              style={{ padding: "4px 8px", fontSize: "11px" }}
                              onClick={() => handleJournalAction(j.id, "post")}
                            >
                              Ghi sổ
                            </button>
                          )}
                          {j.status === "POSTED" && (
                            <button
                              className="live-gl-btn live-gl-btn-danger"
                              style={{ padding: "4px 8px", fontSize: "11px" }}
                              onClick={() => handleJournalAction(j.id, "reverse")}
                            >
                              Đảo bút toán
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. ACCOUNTS TAB */}
        {!loading && activeTab === "accounts" && (
          <div className="live-gl-table-card">
            <table className="live-gl-table">
              <thead>
                <tr>
                  <th>Số hiệu TK</th>
                  <th>Tên tài khoản</th>
                  <th>Cấp</th>
                  <th>Phân loại</th>
                  <th>Bên số dư</th>
                  <th>Ghi sổ trực tiếp</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có tài khoản nào
                    </td>
                  </tr>
                ) : (
                  accounts.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: "700", color: "#818cf8" }}>{a.code}</td>
                      <td style={{ color: "#f8fafc" }}>{a.name}</td>
                      <td>Cấp {a.account_level}</td>
                      <td>
                        <span className="live-gl-tag-pill">{a.account_type}</span>
                      </td>
                      <td>{a.normal_balance}</td>
                      <td>{a.is_postable ? "Có" : "Không (TK tổng hợp)"}</td>
                      <td>
                        <span className="live-gl-badge-status posted">{a.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. TRIAL BALANCE TAB */}
        {!loading && activeTab === "trial-balance" && (
          <div className="live-gl-table-card">
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e293b", display: "flex", gap: "12px", alignItems: "center" }}>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#94a3b8" }}>Chọn kỳ xem bảng cân đối:</span>
              <select
                className="live-gl-select"
                value={selectedPeriodId}
                onChange={(e) => {
                  setSelectedPeriodId(e.target.value);
                  setTimeout(() => loadTabData(), 50);
                }}
              >
                {refs.periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} ({p.start_date} → {p.end_date})
                  </option>
                ))}
              </select>
            </div>
            <table className="live-gl-table">
              <thead>
                <tr>
                  <th>Mã TK</th>
                  <th>Tên tài khoản</th>
                  <th>Dư Nợ đầu kỳ</th>
                  <th>Dư Có đầu kỳ</th>
                  <th>Phát sinh Nợ</th>
                  <th>Phát sinh Có</th>
                  <th>Dư Nợ cuối kỳ</th>
                  <th>Dư Có cuối kỳ</th>
                </tr>
              </thead>
              <tbody>
                {trialBalances.balances.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có số dư phát sinh trong kỳ được chọn. Hãy chạy 'Tổng hợp số dư' tại tab Kỳ kế toán.
                    </td>
                  </tr>
                ) : (
                  trialBalances.balances.map((b) => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: "700", color: "#818cf8" }}>{b.account_code}</td>
                      <td style={{ color: "#f8fafc" }}>{b.account_name}</td>
                      <td>{formatNum(b.opening_debit)}</td>
                      <td>{formatNum(b.opening_credit)}</td>
                      <td style={{ fontWeight: "700", color: "#818cf8" }}>{formatNum(b.period_debit)}</td>
                      <td style={{ fontWeight: "700", color: "#34d399" }}>{formatNum(b.period_credit)}</td>
                      <td>{formatNum(b.closing_debit)}</td>
                      <td>{formatNum(b.closing_credit)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. LEDGER TAB */}
        {!loading && activeTab === "ledger" && (
          <div className="live-gl-table-card">
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e293b", display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#94a3b8" }}>Chọn tài khoản:</span>
                <select
                  className="live-gl-select"
                  value={selectedLedgerAccount}
                  onChange={(e) => {
                    setSelectedLedgerAccount(e.target.value);
                    setTimeout(() => loadTabData(), 50);
                  }}
                >
                  {refs.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#94a3b8" }}>Chọn kỳ:</span>
                <select
                  className="live-gl-select"
                  value={selectedPeriodId}
                  onChange={(e) => {
                    setSelectedPeriodId(e.target.value);
                    setTimeout(() => loadTabData(), 50);
                  }}
                >
                  <option value="">-- Tất cả các kỳ --</option>
                  {refs.periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <table className="live-gl-table">
              <thead>
                <tr>
                  <th>Ngày hạch toán</th>
                  <th>Số chứng từ</th>
                  <th>Diễn giải</th>
                  <th>Nợ (VND)</th>
                  <th>Có (VND)</th>
                  <th>Phân hệ nguồn</th>
                </tr>
              </thead>
              <tbody>
                {ledgerLines.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có dòng phát sinh ghi sổ cho tài khoản này
                    </td>
                  </tr>
                ) : (
                  ledgerLines.map((l, idx) => (
                    <tr key={idx}>
                      <td>{l.posting_date}</td>
                      <td style={{ fontWeight: "700", color: "#818cf8" }}>{l.number}</td>
                      <td>{l.description}</td>
                      <td style={{ fontWeight: "700", color: "#818cf8" }}>{formatNum(l.debit)}</td>
                      <td style={{ fontWeight: "700", color: "#34d399" }}>{formatNum(l.credit)}</td>
                      <td>
                        <span className="live-gl-tag-pill">{l.source_module || "GL"}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. PERIODS TAB */}
        {!loading && activeTab === "periods" && (
          <div className="live-gl-table-card">
            <table className="live-gl-table">
              <thead>
                <tr>
                  <th>Mã kỳ kế toán</th>
                  <th>Năm tài chính</th>
                  <th>Kỳ thứ</th>
                  <th>Từ ngày</th>
                  <th>Đến ngày</th>
                  <th>Trạng thái</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {periods.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có kỳ kế toán nào
                    </td>
                  </tr>
                ) : (
                  [...periods].sort((a, b) => {
                    if (a.code === "2026-10") return -1;
                    if (b.code === "2026-10") return 1;
                    return (b.code || "").localeCompare(a.code || "");
                  }).map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{p.code}</td>
                      <td>{p.fiscal_year}</td>
                      <td>Kỳ {p.period_number}</td>
                      <td>{p.start_date}</td>
                      <td>{p.end_date}</td>
                      <td>
                        <span className={`live-gl-badge-status ${p.status === "OPEN" ? "posted" : "cancelled"}`}>
                          {p.status}
                        </span>
                      </td>
                      <td>
                        <div className="live-gl-btn-group">
                          <button
                            data-testid={`btn-aggregate-${p.code}`}
                            className="live-gl-btn live-gl-btn-secondary"
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                            onClick={() => handleAggregatePeriod(p.id)}
                          >
                            📊 Tổng hợp số dư
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 6. ALLOCATIONS TAB */}
        {!loading && activeTab === "allocations" && (
          <div className="live-gl-table-card">
            <table className="live-gl-table">
              <thead>
                <tr>
                  <th>Mã quy tắc</th>
                  <th>Tên quy tắc</th>
                  <th>TK Nguồn</th>
                  <th>TK Đối ứng</th>
                  <th>Phương pháp</th>
                  <th>Trạng thái</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {allocationRules.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có quy tắc phân bổ chi phí nào
                    </td>
                  </tr>
                ) : (
                  [...allocationRules].sort((a, b) => (b.code || "").localeCompare(a.code || "")).map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: "700", color: "#818cf8" }}>{r.code}</td>
                      <td style={{ color: "#f8fafc" }}>{r.name}</td>
                      <td>{r.source_account_code}</td>
                      <td>{r.offset_account_code}</td>
                      <td>{r.method}</td>
                      <td>
                        <span className={`live-gl-badge-status ${r.is_active ? "posted" : "draft"}`}>
                          {r.is_active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                      <td>
                        <button
                          data-testid={`btn-run-allocation-${r.code}`}
                          className="live-gl-btn live-gl-btn-primary"
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                          onClick={() => handleRunAllocation(r.id)}
                        >
                          ▶ Chạy phân bổ
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 7. CLOSINGS TAB */}
        {!loading && activeTab === "closings" && (
          <div className="live-gl-table-card">
            <table className="live-gl-table">
              <thead>
                <tr>
                  <th>Mã quy tắc</th>
                  <th>Tên quy tắc kết chuyển</th>
                  <th>TK Nguồn (Kết chuyển đi)</th>
                  <th>TK Đích (Nhận kết chuyển)</th>
                  <th>Thứ tự</th>
                  <th>Trạng thái</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {closingRules.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có quy tắc kết chuyển nào
                    </td>
                  </tr>
                ) : (
                  [...closingRules].sort((a, b) => (b.code || "").localeCompare(a.code || "")).map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: "700", color: "#818cf8" }}>{c.code}</td>
                      <td style={{ color: "#f8fafc" }}>{c.name}</td>
                      <td>{c.source_account_code}</td>
                      <td>{c.destination_account_code}</td>
                      <td>Thứ tự {c.sequence}</td>
                      <td>
                        <span className={`live-gl-badge-status ${c.is_active ? "posted" : "draft"}`}>
                          {c.is_active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                      <td>
                        <button
                          data-testid={`btn-run-closing-${c.code}`}
                          className="live-gl-btn live-gl-btn-primary"
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                          onClick={() => handleRunClosing(c.id)}
                        >
                          ▶ Chạy kết chuyển
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 8. BUDGETS TAB */}
        {!loading && activeTab === "budgets" && (
          <div className="live-gl-table-card">
            <table className="live-gl-table">
              <thead>
                <tr>
                  <th>Tài khoản</th>
                  <th>Kỳ kế toán</th>
                  <th>Hạn mức ngân sách (VND)</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {budgets.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có định mức ngân sách nào
                    </td>
                  </tr>
                ) : (
                  budgets.map((b) => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: "700", color: "#818cf8" }}>
                        {b.account_code} - {b.account_name}
                      </td>
                      <td>{b.period_code}</td>
                      <td style={{ fontWeight: "700", color: "#fbbf24" }}>{formatNum(b.amount)}</td>
                      <td>{b.notes || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 9. RECONCILIATIONS TAB */}
        {!loading && activeTab === "reconciliations" && (
          <div className="live-gl-table-card">
            <table className="live-gl-table">
              <thead>
                <tr>
                  <th>Kỳ kế toán</th>
                  <th>Phân hệ</th>
                  <th>Tài khoản</th>
                  <th>Số liệu phân hệ (VND)</th>
                  <th>Số liệu Sổ cái (VND)</th>
                  <th>Chênh lệch (VND)</th>
                  <th>Trạng thái</th>
                  <th>Đã xử lý</th>
                </tr>
              </thead>
              <tbody>
                {reconciliations.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có kết quả đối chiếu nào
                    </td>
                  </tr>
                ) : (
                  reconciliations.map((rec) => (
                    <tr key={rec.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{rec.period_code}</td>
                      <td>
                        <span className="live-gl-tag-pill">{rec.source_module}</span>
                      </td>
                      <td>{rec.account_code}</td>
                      <td>{formatNum(rec.subledger_amount)}</td>
                      <td style={{ fontWeight: "700" }}>{formatNum(rec.gl_amount)}</td>
                      <td style={{ fontWeight: "700", color: rec.difference === "0.0000" ? "#34d399" : "#f87171" }}>
                        {formatNum(rec.difference)}
                      </td>
                      <td>
                        <span className={`live-gl-badge-status ${rec.status === "MATCHED" ? "posted" : "cancelled"}`}>
                          {rec.status}
                        </span>
                      </td>
                      <td>{rec.resolved ? "✅ Đã xử lý" : "Chưa xử lý"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Modal 1: Create Journal Entry */}
      {modalType === "create_journal" && (
        <div className="live-gl-modal-backdrop">
          <div className="live-gl-modal wide">
            <div className="live-gl-modal-header">
              <span>Lập bút toán kế toán mới (Journal Entry)</span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateJournal}>
              <div className="live-gl-modal-body">
                <div className="live-gl-form-row-3">
                  <div className="live-gl-form-group">
                    <label>Số chứng từ:</label>
                    <input
                      type="text"
                      className="live-gl-input"
                      value={formData.number}
                      onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-gl-form-group">
                    <label>Kỳ kế toán:</label>
                    <select
                      className="live-gl-select"
                      value={formData.period}
                      onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                      required
                    >
                      {refs.periods.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="live-gl-form-group">
                    <label>Chi nhánh:</label>
                    <select
                      className="live-gl-select"
                      value={formData.branch}
                      onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                      required
                    >
                      {refs.branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="live-gl-form-row">
                  <div className="live-gl-form-group">
                    <label>Ngày hạch toán:</label>
                    <input
                      type="date"
                      className="live-gl-input"
                      value={formData.posting_date}
                      onChange={(e) => setFormData({ ...formData, posting_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-gl-form-group">
                    <label>Ngày chứng từ:</label>
                    <input
                      type="date"
                      className="live-gl-input"
                      value={formData.document_date}
                      onChange={(e) => setFormData({ ...formData, document_date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="live-gl-form-group">
                  <label>Diễn giải chung:</label>
                  <input
                    type="text"
                    className="live-gl-input"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>

                {/* Lines Table */}
                <div className="live-gl-form-group">
                  <label>Chi tiết các dòng Nợ / Có:</label>
                  <table className="live-gl-lines-table">
                    <thead>
                      <tr>
                        <th style={{ width: "35%" }}>Tài khoản</th>
                        <th style={{ width: "35%" }}>Diễn giải dòng</th>
                        <th style={{ width: "15%" }}>Tiền Nợ</th>
                        <th style={{ width: "15%" }}>Tiền Có</th>
                      </tr>
                    </thead>
                    <tbody>
                      {journalLines.map((line, idx) => (
                        <tr key={idx}>
                          <td>
                            <select
                              className="live-gl-select"
                              style={{ width: "100%" }}
                              value={line.account}
                              onChange={(e) => {
                                const updated = [...journalLines];
                                updated[idx].account = e.target.value;
                                setJournalLines(updated);
                              }}
                              required
                            >
                              <option value="">-- Chọn TK --</option>
                              {refs.accounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.code} - {a.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="text"
                              className="live-gl-input"
                              style={{ width: "100%" }}
                              value={line.description}
                              onChange={(e) => {
                                const updated = [...journalLines];
                                updated[idx].description = e.target.value;
                                setJournalLines(updated);
                              }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="live-gl-input"
                              style={{ width: "100%" }}
                              value={line.debit}
                              onChange={(e) => {
                                const updated = [...journalLines];
                                updated[idx].debit = e.target.value;
                                setJournalLines(updated);
                              }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="live-gl-input"
                              style={{ width: "100%" }}
                              value={line.credit}
                              onChange={(e) => {
                                const updated = [...journalLines];
                                updated[idx].credit = e.target.value;
                                setJournalLines(updated);
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="live-gl-modal-footer">
                <button
                  type="button"
                  className="live-gl-btn live-gl-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button data-testid="modal-submit-btn" type="submit" className="live-gl-btn live-gl-btn-primary">
                  Lưu bút toán
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Create Account */}
      {modalType === "create_account" && (
        <div className="live-gl-modal-backdrop">
          <div className="live-gl-modal">
            <div className="live-gl-modal-header">
              <span>Thêm tài khoản kế toán mới</span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateAccount}>
              <div className="live-gl-modal-body">
                <div className="live-gl-form-row">
                  <div className="live-gl-form-group">
                    <label>Số hiệu tài khoản:</label>
                    <input
                      type="text"
                      className="live-gl-input"
                      value={formData.code || ""}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    />
                  </div>
                  <div className="live-gl-form-group">
                    <label>Loại tài khoản (Class):</label>
                    <select
                      className="live-gl-select"
                      value={formData.account_class || (refs.accountClasses[0]?.id || "")}
                      onChange={(e) => setFormData({ ...formData, account_class: e.target.value })}
                    >
                      {refs.accountClasses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} - {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="live-gl-form-group">
                  <label>Tên tài khoản:</label>
                  <input
                    type="text"
                    className="live-gl-input"
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="live-gl-form-row">
                  <div className="live-gl-form-group">
                    <label>Bản chất tài khoản:</label>
                    <select
                      className="live-gl-select"
                      value={formData.account_type || "EXPENSE"}
                      onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                    >
                      <option value="ASSET">Tài sản (ASSET)</option>
                      <option value="LIABILITY">Nợ phải trả (LIABILITY)</option>
                      <option value="EQUITY">Vốn chủ sở hữu (EQUITY)</option>
                      <option value="REVENUE">Doanh thu (REVENUE)</option>
                      <option value="EXPENSE">Chi phí (EXPENSE)</option>
                    </select>
                  </div>
                  <div className="live-gl-form-group">
                    <label>Bên số dư thông thường:</label>
                    <select
                      className="live-gl-select"
                      value={formData.normal_balance || "DEBIT"}
                      onChange={(e) => setFormData({ ...formData, normal_balance: e.target.value })}
                    >
                      <option value="DEBIT">Dư Nợ (DEBIT)</option>
                      <option value="CREDIT">Dư Có (CREDIT)</option>
                      <option value="BOTH">Lưỡng tính (BOTH)</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="live-gl-modal-footer">
                <button
                  type="button"
                  className="live-gl-btn live-gl-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button
                  data-testid="modal-submit-btn"
                  type="button"
                  className="live-gl-btn live-gl-btn-primary"
                  onClick={() => handleCreateAccount()}
                >
                  Lưu tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Create Allocation Rule */}
      {modalType === "create_allocation_rule" && (
        <div className="live-gl-modal-backdrop">
          <div className="live-gl-modal">
            <div className="live-gl-modal-header">
              <span>Tạo quy tắc phân bổ chi phí tự động</span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateAllocationRule}>
              <div className="live-gl-modal-body">
                <div className="live-gl-form-row">
                  <div className="live-gl-form-group">
                    <label>Mã quy tắc:</label>
                    <input
                      type="text"
                      className="live-gl-input"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-gl-form-group">
                    <label>Tên quy tắc:</label>
                    <input
                      type="text"
                      className="live-gl-input"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="live-gl-form-row">
                  <div className="live-gl-form-group">
                    <label>Tài khoản nguồn (Cần phân bổ):</label>
                    <select
                      className="live-gl-select"
                      value={formData.source_account}
                      onChange={(e) => setFormData({ ...formData, source_account: e.target.value })}
                      required
                    >
                      {refs.accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="live-gl-form-group">
                    <label>Tài khoản đối ứng:</label>
                    <select
                      className="live-gl-select"
                      value={formData.offset_account}
                      onChange={(e) => setFormData({ ...formData, offset_account: e.target.value })}
                      required
                    >
                      {refs.accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="live-gl-form-group">
                  <label>Tài khoản đích nhận phân bổ (100%):</label>
                  <select
                    className="live-gl-select"
                    value={formData.destination_account}
                    onChange={(e) => setFormData({ ...formData, destination_account: e.target.value })}
                    required
                  >
                    {refs.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="live-gl-modal-footer">
                <button
                  type="button"
                  className="live-gl-btn live-gl-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button data-testid="modal-submit-btn" type="submit" className="live-gl-btn live-gl-btn-primary">
                  Lưu quy tắc
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Create Closing Rule */}
      {modalType === "create_closing_rule" && (
        <div className="live-gl-modal-backdrop">
          <div className="live-gl-modal">
            <div className="live-gl-modal-header">
              <span>Tạo quy tắc kết chuyển cuối kỳ</span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateClosingRule}>
              <div className="live-gl-modal-body">
                <div className="live-gl-form-row">
                  <div className="live-gl-form-group">
                    <label>Mã quy tắc:</label>
                    <input
                      type="text"
                      className="live-gl-input"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-gl-form-group">
                    <label>Thứ tự kết chuyển:</label>
                    <input
                      type="number"
                      className="live-gl-input"
                      value={formData.sequence}
                      onChange={(e) => setFormData({ ...formData, sequence: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="live-gl-form-group">
                  <label>Tên quy tắc kết chuyển:</label>
                  <input
                    type="text"
                    className="live-gl-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="live-gl-form-row">
                  <div className="live-gl-form-group">
                    <label>Tài khoản nguồn:</label>
                    <select
                      className="live-gl-select"
                      value={formData.source_account}
                      onChange={(e) => setFormData({ ...formData, source_account: e.target.value })}
                      required
                    >
                      {refs.accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="live-gl-form-group">
                    <label>Tài khoản nhận kết chuyển:</label>
                    <select
                      className="live-gl-select"
                      value={formData.destination_account}
                      onChange={(e) => setFormData({ ...formData, destination_account: e.target.value })}
                      required
                    >
                      {refs.accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="live-gl-modal-footer">
                <button
                  type="button"
                  className="live-gl-btn live-gl-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button data-testid="modal-submit-btn" type="submit" className="live-gl-btn live-gl-btn-primary">
                  Lưu quy tắc
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Create Budget */}
      {modalType === "create_budget" && (
        <div className="live-gl-modal-backdrop">
          <div className="live-gl-modal">
            <div className="live-gl-modal-header">
              <span>Lập hạn mức ngân sách định mức</span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateBudget}>
              <div className="live-gl-modal-body">
                <div className="live-gl-form-row">
                  <div className="live-gl-form-group">
                    <label>Kỳ kế toán:</label>
                    <select
                      className="live-gl-select"
                      value={formData.period}
                      onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                      required
                    >
                      {refs.periods.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="live-gl-form-group">
                    <label>Tài khoản:</label>
                    <select
                      className="live-gl-select"
                      value={formData.account}
                      onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                      required
                    >
                      {refs.accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="live-gl-form-group">
                  <label>Hạn mức ngân sách (VND):</label>
                  <input
                    type="number"
                    className="live-gl-input"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>

                <div className="live-gl-form-group">
                  <label>Ghi chú / Thuyết minh:</label>
                  <textarea
                    className="live-gl-textarea"
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="live-gl-modal-footer">
                <button
                  type="button"
                  className="live-gl-btn live-gl-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button data-testid="modal-submit-btn" type="submit" className="live-gl-btn live-gl-btn-primary">
                  Lưu ngân sách
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 6: Run Reconciliation */}
      {modalType === "run_reconciliation" && (
        <div className="live-gl-modal-backdrop">
          <div className="live-gl-modal">
            <div className="live-gl-modal-header">
              <span>Chạy đối chiếu sổ cái với phân hệ nguồn</span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleRunReconciliation}>
              <div className="live-gl-modal-body">
                <div className="live-gl-form-row">
                  <div className="live-gl-form-group">
                    <label>Kỳ kế toán:</label>
                    <select
                      className="live-gl-select"
                      value={formData.period}
                      onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                      required
                    >
                      {refs.periods.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="live-gl-form-group">
                    <label>Phân hệ nguồn:</label>
                    <select
                      className="live-gl-select"
                      value={formData.source_module}
                      onChange={(e) => setFormData({ ...formData, source_module: e.target.value })}
                    >
                      <option value="AP">Phải trả nhà cung cấp (AP)</option>
                      <option value="AR">Phải thu khách hàng (AR)</option>
                      <option value="CASH">Quản lý quỹ tiền mặt (CASH)</option>
                      <option value="BANK">Tiền gửi ngân hàng (BANK)</option>
                      <option value="INV">Quản lý kho hàng (INV)</option>
                      <option value="FA">Tài sản cố định (FA)</option>
                      <option value="TAX">Quản lý thuế (TAX)</option>
                    </select>
                  </div>
                </div>

                <div className="live-gl-form-row">
                  <div className="live-gl-form-group">
                    <label>Tài khoản đối chiếu:</label>
                    <select
                      className="live-gl-select"
                      value={formData.account}
                      onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                      required
                    >
                      {refs.accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="live-gl-form-group">
                    <label>Số tiền phân hệ nguồn (VND):</label>
                    <input
                      type="number"
                      className="live-gl-input"
                      value={formData.subledger_amount}
                      onChange={(e) => setFormData({ ...formData, subledger_amount: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="live-gl-modal-footer">
                <button
                  type="button"
                  className="live-gl-btn live-gl-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button data-testid="modal-submit-btn" type="submit" className="live-gl-btn live-gl-btn-primary">
                  Bắt đầu đối chiếu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
