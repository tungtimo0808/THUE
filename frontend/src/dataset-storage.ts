export interface AccountingDatasetItem {
  id: string;
  code: string;
  label: string;
  fiscal_year: number;
  book_type: "FINANCIAL" | "MANAGEMENT";
  accounting_regime: string;
  start_date: string;
  end_date: string;
  carry_forward_from?: string;
  status: "ACTIVE" | "LOCKED";
  notes?: string;
}

export function getDefaultAccountingDatasets(defaultRegime = "TT99"): AccountingDatasetItem[] {
  const normReg = String(defaultRegime || "TT99").toUpperCase();
  const regCode = normReg.includes("58")
    ? "TT58"
    : normReg.includes("133")
    ? "TT133"
    : normReg.includes("200")
    ? "TT200"
    : "TT99";
  return [
    {
      id: "accounting-2026",
      code: "DLKT-2026",
      label: "Dữ liệu kế toán 2026",
      fiscal_year: 2026,
      book_type: "FINANCIAL",
      accounting_regime: regCode,
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      carry_forward_from: "DLKT-2025",
      status: "ACTIVE",
      notes: "Bộ sổ kế toán tài chính & báo cáo thuế năm 2026",
    },
    {
      id: "management-2026",
      code: "DLQT-2026",
      label: "Dữ liệu quản trị 2026",
      fiscal_year: 2026,
      book_type: "MANAGEMENT",
      accounting_regime: regCode,
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      carry_forward_from: "DLQT-2025",
      status: "ACTIVE",
      notes: "Bộ sổ kế toán quản trị nội bộ & phân tích lãi lỗ năm 2026",
    },
    {
      id: "accounting-2025",
      code: "DLKT-2025",
      label: "Dữ liệu kế toán 2025",
      fiscal_year: 2025,
      book_type: "FINANCIAL",
      accounting_regime: regCode === "TT99" ? "TT200" : regCode,
      start_date: "2025-01-01",
      end_date: "2025-12-31",
      carry_forward_from: "DLKT-2024",
      status: "LOCKED",
      notes: "Bộ sổ kế toán tài chính năm 2025 (Đã quyết toán & khóa sổ năm)",
    },
    {
      id: "management-2025",
      code: "DLQT-2025",
      label: "Dữ liệu quản trị 2025",
      fiscal_year: 2025,
      book_type: "MANAGEMENT",
      accounting_regime: regCode === "TT99" ? "TT200" : regCode,
      start_date: "2025-01-01",
      end_date: "2025-12-31",
      status: "LOCKED",
      notes: "Bộ sổ kế toán quản trị nội bộ năm 2025",
    },
    {
      id: "accounting-2024",
      code: "DLKT-2024",
      label: "Dữ liệu kế toán 2024",
      fiscal_year: 2024,
      book_type: "FINANCIAL",
      accounting_regime: regCode === "TT99" ? "TT200" : regCode,
      start_date: "2024-01-01",
      end_date: "2024-12-31",
      status: "LOCKED",
      notes: "Dữ liệu lịch sử năm tài chính 2024 (Tra cứu chứng từ & BCTC)",
    },
  ];
}

export function loadStoredDatasets(companyId: string, defaultRegime = "TT99"): AccountingDatasetItem[] {
  const defaults = getDefaultAccountingDatasets(defaultRegime);
  if (!companyId) return defaults;
  try {
    const raw = localStorage.getItem(`erp_datasets_${companyId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return defaults;
}

export function saveStoredDatasets(companyId: string, list: AccountingDatasetItem[]) {
  if (!companyId) return;
  try {
    localStorage.setItem(`erp_datasets_${companyId}`, JSON.stringify(list));
  } catch {
    // ignore
  }
}
