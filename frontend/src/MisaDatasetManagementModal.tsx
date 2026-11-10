import React, { useEffect, useMemo, useState } from "react";
import {
  Database,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Lock,
  Unlock,
  Edit2,
  Calendar,
  X,
  Check,
  BookOpen,
  ArrowRightLeft,
} from "lucide-react";
import { request } from "./live-api";
import { showGlobalPopup } from "./global-popup";

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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  companyName: string;
  companyTaxCode: string;
  defaultRegime?: string;
  token: string;
  activeDatasetId: string;
  initialOpenCreate?: boolean;
  initialCreateMode?: boolean;
  datasets: AccountingDatasetItem[];
  onDatasetsChanged?: (nextList: AccountingDatasetItem[]) => void;
  onDatasetsUpdated?: (nextList: AccountingDatasetItem[]) => void;
  onSelectDataset: (item: AccountingDatasetItem) => void;
}

export default function MisaDatasetManagementModal({
  isOpen,
  onClose,
  companyId,
  companyName,
  companyTaxCode,
  defaultRegime = "TT99",
  token,
  activeDatasetId,
  initialOpenCreate = false,
  initialCreateMode = false,
  datasets,
  onDatasetsChanged,
  onDatasetsUpdated,
  onSelectDataset,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("ALL");
  const [bookFilter, setBookFilter] = useState<string>("ALL");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AccountingDatasetItem | null>(null);
  const [bannerMsg, setBannerMsg] = useState<string>("");

  // Form states
  const [formYear, setFormYear] = useState<number>(2027);
  const [formBookType, setFormBookType] = useState<"FINANCIAL" | "MANAGEMENT">("FINANCIAL");
  const [formCode, setFormCode] = useState<string>("DLKT-2027");
  const [formLabel, setFormLabel] = useState<string>("Dữ liệu kế toán 2027");
  const [formRegime, setFormRegime] = useState<string>("TT99");
  const [formStartDate, setFormStartDate] = useState<string>("2027-01-01");
  const [formEndDate, setFormEndDate] = useState<string>("2027-12-31");
  const [formCarryForward, setFormCarryForward] = useState<boolean>(true);
  const [formCarrySource, setFormCarrySource] = useState<string>("DLKT-2026");
  const [formStatus, setFormStatus] = useState<"ACTIVE" | "LOCKED">("ACTIVE");
  const [formNotes, setFormNotes] = useState<string>("");
  const [formSwitchImmediately, setFormSwitchImmediately] = useState<boolean>(true);

  const openCreateForm = () => {
    const existingYears = datasets.map((d) => d.fiscal_year);
    const suggestedYear = !existingYears.includes(2027)
      ? 2027
      : !existingYears.includes(2023)
      ? 2023
      : Math.max(...existingYears, 2026) + 1;
    const normReg = String(defaultRegime || "TT99").toUpperCase();
    const regCode = normReg.includes("58")
      ? "TT58"
      : normReg.includes("133")
      ? "TT133"
      : normReg.includes("200")
      ? "TT200"
      : "TT99";

    setEditingItem(null);
    setFormYear(suggestedYear);
    setFormBookType("FINANCIAL");
    setFormCode(`DLKT-${suggestedYear}`);
    setFormLabel(`Dữ liệu kế toán ${suggestedYear}`);
    setFormRegime(regCode);
    setFormStartDate(`${suggestedYear}-01-01`);
    setFormEndDate(`${suggestedYear}-12-31`);
    setFormCarryForward(true);
    const prevDataset = datasets.find((d) => d.fiscal_year === suggestedYear - 1 && d.book_type === "FINANCIAL") || datasets[0];
    setFormCarrySource(prevDataset ? prevDataset.code : "");
    setFormStatus("ACTIVE");
    setFormNotes(`Bộ sổ kế toán tài chính & báo cáo thuế năm ${suggestedYear}`);
    setFormSwitchImmediately(true);
    setIsFormOpen(true);
  };

  const openEditForm = (item: AccountingDatasetItem) => {
    setEditingItem(item);
    setFormYear(item.fiscal_year);
    setFormBookType(item.book_type);
    setFormCode(item.code);
    setFormLabel(item.label);
    setFormRegime(item.accounting_regime || "TT99");
    setFormStartDate(item.start_date || `${item.fiscal_year}-01-01`);
    setFormEndDate(item.end_date || `${item.fiscal_year}-12-31`);
    setFormCarryForward(Boolean(item.carry_forward_from));
    setFormCarrySource(item.carry_forward_from || "");
    setFormStatus(item.status || "ACTIVE");
    setFormNotes(item.notes || "");
    setFormSwitchImmediately(false);
    setIsFormOpen(true);
  };

  useEffect(() => {
    if (isOpen) {
      setBannerMsg("");
      if (initialOpenCreate || initialCreateMode) {
        openCreateForm();
      } else {
        setIsFormOpen(false);
        setEditingItem(null);
      }
    }
  }, [isOpen, initialOpenCreate, initialCreateMode]);

  const handleYearOrBookChange = (nextYear: number, nextBook: "FINANCIAL" | "MANAGEMENT") => {
    setFormYear(nextYear);
    setFormBookType(nextBook);
    if (!editingItem) {
      const prefix = nextBook === "FINANCIAL" ? "DLKT" : "DLQT";
      const typeName = nextBook === "FINANCIAL" ? "kế toán" : "quản trị";
      setFormCode(`${prefix}-${nextYear}`);
      setFormLabel(`Dữ liệu ${typeName} ${nextYear}`);
      setFormStartDate(`${nextYear}-01-01`);
      setFormEndDate(`${nextYear}-12-31`);
      const prev = datasets.find((d) => d.fiscal_year === nextYear - 1 && d.book_type === nextBook);
      if (prev) {
        setFormCarrySource(prev.code);
      }
      setFormNotes(
        nextBook === "FINANCIAL"
          ? `Bộ sổ kế toán tài chính & báo cáo thuế năm ${nextYear}`
          : `Bộ sổ kế toán quản trị nội bộ & phân tích lãi lỗ năm ${nextYear}`
      );
    }
  };

  const persistListToServer = async (nextList: AccountingDatasetItem[]) => {
    saveStoredDatasets(companyId, nextList);
    onDatasetsChanged?.(nextList);
    onDatasetsUpdated?.(nextList);
    if (token && companyId) {
      try {
        await fetch(`/api/v1/common/settings/?company_id=${encodeURIComponent(companyId)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            company: companyId,
            company_id: companyId,
            configuration: {
              accounting_datasets: nextList,
            },
          }),
        });
      } catch {
        // Local storage already persisted
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = formCode.trim().toUpperCase();
    const cleanLabel = formLabel.trim();
    if (!cleanCode || !cleanLabel) {
      showGlobalPopup({
        type: "warning",
        title: "Thiếu thông tin",
        message: "Vui lòng nhập đầy đủ Mã dữ liệu và Tên dữ liệu kế toán.",
      });
      return;
    }

    const generatedId =
      editingItem?.id ||
      `${formBookType === "FINANCIAL" ? "accounting" : "management"}-${formYear}-${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    const canonicalId =
      !editingItem &&
      !datasets.some((d) => d.id === `${formBookType === "FINANCIAL" ? "accounting" : "management"}-${formYear}`)
        ? `${formBookType === "FINANCIAL" ? "accounting" : "management"}-${formYear}`
        : generatedId;

    if (
      !editingItem &&
      datasets.some((d) => d.code.toUpperCase() === cleanCode || d.id === canonicalId)
    ) {
      showGlobalPopup({
        type: "warning",
        title: "Trùng mã dữ liệu",
        message: `Dữ liệu kế toán có mã "${cleanCode}" đã tồn tại. Vui lòng chọn năm khác hoặc đặt mã khác.`,
      });
      return;
    }

    setSaving(true);
    try {
      const newItem: AccountingDatasetItem = {
        id: editingItem ? editingItem.id : canonicalId,
        code: cleanCode,
        label: cleanLabel,
        fiscal_year: Number(formYear) || 2026,
        book_type: formBookType,
        accounting_regime: formRegime,
        start_date: formStartDate || `${formYear}-01-01`,
        end_date: formEndDate || `${formYear}-12-31`,
        carry_forward_from: formCarryForward && formCarrySource ? formCarrySource : undefined,
        status: formStatus,
        notes: formNotes.trim(),
      };

      // Also ensure backend FiscalYear exists if creating a new year
      if (!editingItem && token && companyId) {
        await fetch(`/api/v1/common/fiscal-years/?company_id=${encodeURIComponent(companyId)}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            company: companyId,
            code: `FY${newItem.fiscal_year}`,
            name: `Năm tài chính ${newItem.fiscal_year}`,
            year_type: "CALENDAR_YEAR",
            start_date: newItem.start_date,
            end_date: newItem.end_date,
            period_structure: "MONTHLY",
            has_adjustment_period: false,
            notes: newItem.notes || "",
          }),
        }).catch(() => {
          // Ignore if FiscalYear FYxxxx already exists in DB
        });
      }

      const nextList = editingItem
        ? datasets.map((d) => (d.id === editingItem.id ? newItem : d))
        : [newItem, ...datasets].sort((a, b) => b.fiscal_year - a.fiscal_year || a.book_type.localeCompare(b.book_type));

      await persistListToServer(nextList);

      setBannerMsg(
        editingItem
          ? `✓ Đã lưu cập nhật thông tin bộ dữ liệu "${newItem.label}" (${newItem.code}).`
          : `✓ Đã khởi tạo bộ dữ liệu "${newItem.label}" (Năm tài chính ${newItem.fiscal_year})${
              newItem.carry_forward_from ? ` và kết chuyển số dư đầu kỳ từ ${newItem.carry_forward_from}` : ""
            }.`
      );

      setIsFormOpen(false);
      setEditingItem(null);

      if (formSwitchImmediately && (initialOpenCreate || initialCreateMode)) {
        onSelectDataset(newItem);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleLock = async (item: AccountingDatasetItem) => {
    const nextStatus: "ACTIVE" | "LOCKED" = item.status === "LOCKED" ? "ACTIVE" : "LOCKED";
    const nextList = datasets.map((d) => (d.id === item.id ? { ...d, status: nextStatus } : d));
    await persistListToServer(nextList);
    setBannerMsg(
      nextStatus === "LOCKED"
        ? `✓ Bộ dữ liệu "${item.label}" đã được chuyển sang trạng thái Đã khóa sổ.`
        : `✓ Bộ dữ liệu "${item.label}" đã được mở khóa để tiếp tục hạch toán.`
    );
  };

  const availableYears = useMemo(() => {
    const set = new Set<number>(datasets.map((d) => d.fiscal_year));
    return Array.from(set).sort((a, b) => b - a);
  }, [datasets]);

  const filteredList = useMemo(() => {
    return datasets.filter((d) => {
      if (yearFilter !== "ALL" && String(d.fiscal_year) !== yearFilter) return false;
      if (bookFilter !== "ALL" && d.book_type !== bookFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          d.code.toLowerCase().includes(q) ||
          d.label.toLowerCase().includes(q) ||
          String(d.fiscal_year).includes(q) ||
          (d.notes || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [datasets, yearFilter, bookFilter, search]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1220,
          background: "#ffffff",
          borderRadius: 14,
          boxShadow: "0 20px 40px rgba(0,0,0,0.18)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 22px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#f8fafc",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "#e0f2fe",
                color: "var(--brand)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Database size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                Quản lý Dữ liệu Kế toán &amp; Năm tài chính
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#64748b" }}>
                {companyName} {companyTaxCode ? `· MST: ${companyTaxCode}` : ""} · Hỗ trợ đa năm tài chính &amp; đa bộ sổ (Tài chính / Quản trị)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 6,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>
          {!isFormOpen ? (
            <>
              {/* Toolbar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 14,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      padding: "0 12px",
                      height: 36,
                      width: 260,
                      background: "#ffffff",
                    }}
                  >
                    <Search size={15} color="#64748b" />
                    <input
                      type="text"
                      placeholder="Tìm theo mã, tên, năm tài chính..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{
                        border: "none",
                        outline: "none",
                        width: "100%",
                        fontSize: 13,
                        color: "#0f172a",
                        background: "transparent",
                      }}
                    />
                  </div>

                  {/* Year pills */}
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      background: "#f1f5f9",
                      padding: 3,
                      borderRadius: 8,
                      gap: 3,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setYearFilter("ALL")}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 6,
                        border: "none",
                        background: yearFilter === "ALL" ? "#ffffff" : "transparent",
                        color: yearFilter === "ALL" ? "var(--brand)" : "#475569",
                        fontWeight: yearFilter === "ALL" ? 700 : 500,
                        fontSize: 12,
                        cursor: "pointer",
                        boxShadow: yearFilter === "ALL" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Tất cả các năm ({datasets.length})
                    </button>
                    {availableYears.map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => setYearFilter(String(yr))}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 6,
                          border: "none",
                          background: yearFilter === String(yr) ? "#ffffff" : "transparent",
                          color: yearFilter === String(yr) ? "var(--brand)" : "#475569",
                          fontWeight: yearFilter === String(yr) ? 700 : 500,
                          fontSize: 12,
                          cursor: "pointer",
                          boxShadow: yearFilter === String(yr) ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Năm {yr}
                      </button>
                    ))}
                  </div>

                  {/* Book type filter */}
                  <select
                    value={bookFilter}
                    onChange={(e) => setBookFilter(e.target.value)}
                    style={{
                      height: 34,
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      padding: "0 10px",
                      fontSize: 12.5,
                      color: "#334155",
                      background: "#ffffff",
                      cursor: "pointer",
                    }}
                  >
                    <option value="ALL">Tất cả loại bộ sổ</option>
                    <option value="FINANCIAL">Sổ Tài chính &amp; Thuế</option>
                    <option value="MANAGEMENT">Sổ Quản trị nội bộ</option>
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={openCreateForm}
                    style={{
                      height: 36,
                      padding: "0 14px",
                      borderRadius: 8,
                      border: "1px solid var(--brand)",
                      background: "var(--brand)",
                      color: "#ffffff",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <Plus size={15} />
                    <span>Tạo dữ liệu kế toán mới</span>
                  </button>
                </div>
              </div>

              {bannerMsg && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: "9px 14px",
                    borderRadius: 8,
                    background: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    color: "#065f46",
                    fontSize: 12.5,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span>{bannerMsg}</span>
                  <button
                    type="button"
                    onClick={() => setBannerMsg("")}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#065f46",
                      cursor: "pointer",
                      padding: 2,
                      display: "flex",
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Table */}
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  overflowX: "auto",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12.5,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                      <th style={{ padding: "10px 10px", fontWeight: 600, color: "#475569", width: 96, whiteSpace: "nowrap" }}>
                        Mã dữ liệu
                      </th>
                      <th style={{ padding: "10px 10px", fontWeight: 600, color: "#475569", minWidth: 195 }}>
                        Tên bộ dữ liệu kế toán
                      </th>
                      <th style={{ padding: "10px 10px", fontWeight: 600, color: "#475569", width: 145, whiteSpace: "nowrap" }}>
                        Năm tài chính
                      </th>
                      <th style={{ padding: "10px 10px", fontWeight: 600, color: "#475569", width: 145, whiteSpace: "nowrap" }}>
                        Loại bộ sổ
                      </th>
                      <th style={{ padding: "10px 10px", fontWeight: 600, color: "#475569", width: 90, whiteSpace: "nowrap" }}>
                        Chế độ KT
                      </th>
                      <th style={{ padding: "10px 10px", fontWeight: 600, color: "#475569", width: 108, whiteSpace: "nowrap" }}>
                        Trạng thái
                      </th>
                      <th style={{ padding: "10px 10px", fontWeight: 600, color: "#475569", textAlign: "right", width: 235, whiteSpace: "nowrap" }}>
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredList.map((item) => {
                      const isCurrent = item.id === activeDatasetId;
                      return (
                        <tr
                          key={item.id}
                          style={{
                            borderBottom: "1px solid #f1f5f9",
                            background: isCurrent ? "#f0f9ff" : "#ffffff",
                          }}
                        >
                          <td style={{ padding: "10px 10px", fontWeight: 700, color: "var(--brand)", whiteSpace: "nowrap" }}>
                            {item.code}
                          </td>
                          <td style={{ padding: "10px 10px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <strong style={{ color: "#0f172a", fontSize: 13 }}>{item.label}</strong>
                              {item.carry_forward_from && (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    fontSize: 10.5,
                                    padding: "1px 6px",
                                    borderRadius: 999,
                                    background: "#f1f5f9",
                                    color: "#475569",
                                    fontWeight: 500,
                                    whiteSpace: "nowrap",
                                  }}
                                  title={`Đã kết chuyển số dư đầu kỳ từ ${item.carry_forward_from}`}
                                >
                                  <ArrowRightLeft size={10} />
                                  Từ {item.carry_forward_from}
                                </span>
                              )}
                            </div>
                            {item.notes && (
                              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{item.notes}</div>
                            )}
                          </td>
                          <td style={{ padding: "10px 10px", whiteSpace: "nowrap" }}>
                            <div style={{ fontWeight: 600, color: "#1e293b" }}>Năm {item.fiscal_year}</div>
                            <div style={{ fontSize: 10.5, color: "#64748b" }}>
                              {item.start_date} → {item.end_date}
                            </div>
                          </td>
                          <td style={{ padding: "10px 10px", whiteSpace: "nowrap" }}>
                            {item.book_type === "FINANCIAL" ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  padding: "3px 9px",
                                  borderRadius: 999,
                                  background: "#eff6ff",
                                  color: "#1d4ed8",
                                  border: "1px solid #bfdbfe",
                                }}
                              >
                                <BookOpen size={12} /> Sổ Tài chính &amp; Thuế
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  padding: "3px 9px",
                                  borderRadius: 999,
                                  background: "#f3e8ff",
                                  color: "#6b21a8",
                                  border: "1px solid #d8b4fe",
                                }}
                              >
                                <Database size={12} /> Sổ Quản trị nội bộ
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "10px 10px", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                display: "inline-block",
                                fontSize: 11.5,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 6,
                                background: "#ecfdf5",
                                color: "#047857",
                                border: "1px solid #a7f3d0",
                              }}
                            >
                              {item.accounting_regime === "TT200"
                                ? "TT200/2014"
                                : item.accounting_regime === "TT133"
                                ? "TT133/2016"
                                : item.accounting_regime === "TT58"
                                ? "TT58/2026"
                                : "TT99/2025"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 10px", whiteSpace: "nowrap" }}>
                            {item.status === "ACTIVE" ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  color: "#15803d",
                                  background: "#dcfce7",
                                  padding: "3px 9px",
                                  borderRadius: 999,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <CheckCircle2 size={12} /> Đang mở
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  color: "#b45309",
                                  background: "#fef3c7",
                                  padding: "3px 9px",
                                  borderRadius: 999,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <Lock size={12} /> Đã khóa sổ
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "10px 10px", textAlign: "right", whiteSpace: "nowrap" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "nowrap" }}>
                              {isCurrent ? (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: "var(--brand)",
                                    background: "#e0f2fe",
                                    border: "1px solid #bae6fd",
                                    padding: "5px 10px",
                                    borderRadius: 6,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <Check size={13} /> Đang chọn
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectDataset(item);
                                    onClose();
                                  }}
                                  style={{
                                    padding: "5px 10px",
                                    borderRadius: 6,
                                    border: "1px solid #bae6fd",
                                    background: "#f0f9ff",
                                    color: "var(--brand)",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  Chọn làm việc
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openEditForm(item)}
                                style={{
                                  padding: "5px 9px",
                                  borderRadius: 6,
                                  border: "1px solid #cbd5e1",
                                  background: "#ffffff",
                                  color: "#334155",
                                  fontSize: 12,
                                  fontWeight: 500,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <Edit2 size={12} /> Sửa
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleToggleLock(item)}
                                title={item.status === "LOCKED" ? "Mở khóa sổ năm tài chính" : "Khóa sổ năm tài chính"}
                                style={{
                                  padding: "5px 9px",
                                  borderRadius: 6,
                                  border: "1px solid #cbd5e1",
                                  background: "#ffffff",
                                  color: item.status === "LOCKED" ? "#047857" : "#b45309",
                                  fontSize: 12,
                                  fontWeight: 500,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {item.status === "LOCKED" ? <Unlock size={12} /> : <Lock size={12} />}
                                {item.status === "LOCKED" ? "Mở sổ" : "Khóa sổ"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            /* Create / Edit Dataset Form */
            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "#f0f9ff",
                  border: "1px solid #bae6fd",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <strong style={{ fontSize: 14, color: "var(--brand-hover)" }}>
                    {editingItem
                      ? `Chỉnh sửa bộ dữ liệu: ${editingItem.label}`
                      : "Khởi tạo bộ dữ liệu kế toán mới theo Năm tài chính"}
                  </strong>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--brand)" }}>
                    Hệ thống tự động khởi tạo 12 kỳ kế toán tháng (K1 → K12) và hỗ trợ kết chuyển số dư đầu kỳ từ năm trước.
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Năm tài chính <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    value={formYear}
                    onChange={(e) => handleYearOrBookChange(Number(e.target.value), formBookType)}
                    style={{
                      width: "100%",
                      height: 38,
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      padding: "0 12px",
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: "#0f172a",
                    }}
                  >
                    {[2028, 2027, 2026, 2025, 2024, 2023, 2022, 2021].map((yr) => (
                      <option key={yr} value={yr}>
                        Năm tài chính {yr} (01/01/{yr} → 31/12/{yr})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Loại bộ sổ dữ liệu <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    value={formBookType}
                    onChange={(e) =>
                      handleYearOrBookChange(formYear, e.target.value as "FINANCIAL" | "MANAGEMENT")
                    }
                    style={{
                      width: "100%",
                      height: 38,
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      padding: "0 12px",
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: "#0f172a",
                    }}
                  >
                    <option value="FINANCIAL">Sổ Tài chính &amp; Thuế (Báo cáo Thuế &amp; BCTC)</option>
                    <option value="MANAGEMENT">Sổ Quản trị nội bộ (Phân tích &amp; Quản trị DN)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Mã bộ dữ liệu <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="VD: DLKT-2027"
                    style={{
                      width: "100%",
                      height: 38,
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      padding: "0 12px",
                      fontSize: 13.5,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Tên hiển thị trên thanh Taskbar <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                    placeholder="VD: Dữ liệu kế toán 2027"
                    style={{
                      width: "100%",
                      height: 38,
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      padding: "0 12px",
                      fontSize: 13.5,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Chế độ kế toán áp dụng
                  </label>
                  <select
                    value={formRegime}
                    onChange={(e) => setFormRegime(e.target.value)}
                    style={{
                      width: "100%",
                      height: 38,
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      padding: "0 12px",
                      fontSize: 13.5,
                    }}
                  >
                    <option value="TT99">Thông tư 99/2025/TT-BTC (Chế độ kế toán DN mới)</option>
                    <option value="TT200">Thông tư 200/2014/TT-BTC (Doanh nghiệp nói chung)</option>
                    <option value="TT133">Thông tư 133/2016/TT-BTC (Doanh nghiệp vừa và nhỏ)</option>
                    <option value="TT58">Thông tư 58/2026/TT-BTC (Doanh nghiệp siêu nhỏ)</option>
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                      Bắt đầu năm tài chính
                    </label>
                    <input
                      type="date"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: 38,
                        borderRadius: 8,
                        border: "1px solid #cbd5e1",
                        padding: "0 10px",
                        fontSize: 13,
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                      Kết thúc năm tài chính
                    </label>
                    <input
                      type="date"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: 38,
                        borderRadius: 8,
                        border: "1px solid #cbd5e1",
                        padding: "0 10px",
                        fontSize: 13,
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Carry-forward option */}
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#1e293b", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={formCarryForward}
                    onChange={(e) => setFormCarryForward(e.target.checked)}
                  />
                  <span>Tự động kết chuyển số dư cuối kỳ từ dữ liệu năm trước sang đầu kỳ năm {formYear}</span>
                </label>

                {formCarryForward && (
                  <select
                    value={formCarrySource}
                    onChange={(e) => setFormCarrySource(e.target.value)}
                    style={{
                      height: 34,
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      padding: "0 10px",
                      fontSize: 12.5,
                      background: "#ffffff",
                    }}
                  >
                    <option value="">-- Chọn bộ dữ liệu nguồn kết chuyển --</option>
                    {datasets.map((d) => (
                      <option key={d.id} value={d.code}>
                        {d.code} · {d.label} (Năm {d.fiscal_year})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Ghi chú / Mô tả bộ dữ liệu
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Ghi chú phạm vi hạch toán hoặc mục đích sử dụng..."
                  style={{
                    width: "100%",
                    height: 38,
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    padding: "0 12px",
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {!editingItem && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--brand)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={formSwitchImmediately}
                    onChange={(e) => setFormSwitchImmediately(e.target.checked)}
                  />
                  <span>Chuyển ngay sang làm việc trên bộ dữ liệu "{formLabel}" sau khi khởi tạo</span>
                </label>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 8, borderTop: "1px solid #e2e8f0" }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingItem(null);
                  }}
                  style={{
                    height: 36,
                    padding: "0 16px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#334155",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Quay lại danh sách
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    height: 36,
                    padding: "0 18px",
                    borderRadius: 8,
                    border: "1px solid var(--brand)",
                    background: "var(--brand)",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {saving ? "Đang lưu..." : editingItem ? "Lưu thay đổi" : "Khởi tạo dữ liệu kế toán"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        {!isFormOpen && (
          <div
            style={{
              padding: "12px 22px",
              borderTop: "1px solid #e2e8f0",
              background: "#f8fafc",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: 12.5, color: "#64748b" }}>
              Tổng số: <strong>{datasets.length} bộ dữ liệu kế toán</strong> ({availableYears.length} năm tài chính:{" "}
              {availableYears.join(", ")})
            </span>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: 34,
                padding: "0 18px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#334155",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

