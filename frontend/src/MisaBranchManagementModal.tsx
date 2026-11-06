import React, { useState, useEffect, useMemo } from "react";
import {
  Building2,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  MapPin,
  X,
  Shield,
  Phone,
  User,
  Check,
} from "lucide-react";
import { request } from "./live-api";
import { showGlobalPopup } from "./global-popup";

export interface BranchData {
  id: string;
  code: string;
  name: string;
  tax_code?: string;
  address?: string;
  phone?: string;
  representative_name?: string;
  is_head_office?: boolean;
  status: "ACTIVE" | "INACTIVE";
  parent?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  companyName: string;
  companyTaxCode: string;
  token: string;
  activeBranchId?: string;
  onSelectBranch?: (branchId: string, branchName: string) => void;
  onBranchesUpdated?: () => void;
}

export default function MisaBranchManagementModal({
  isOpen,
  onClose,
  companyId,
  companyName,
  companyTaxCode,
  token,
  activeBranchId,
  onSelectBranch,
  onBranchesUpdated,
}: Props) {
  const [branches, setBranches] = useState<BranchData[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [editingBranch, setEditingBranch] = useState<BranchData | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formTaxCode, setFormTaxCode] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRepresentative, setFormRepresentative] = useState("");
  const [formIsHeadOffice, setFormIsHeadOffice] = useState(false);
  const [formStatus, setFormStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");

  const loadBranches = async () => {
    if (!companyId || !token) return;
    setLoading(true);
    try {
      const res = await request<BranchData[] | { results: BranchData[] }>(
        `/api/v1/organization/branches/?company_id=${encodeURIComponent(companyId)}`,
        token
      );
      const list = Array.isArray(res) ? res : res.results || [];
      setBranches(list);
    } catch (err: any) {
      showGlobalPopup({
        type: "error",
        title: "Lỗi tải chi nhánh",
        message: err?.message || "Không thể tải danh sách chi nhánh.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadBranches();
      setIsFormOpen(false);
      setEditingBranch(null);
    }
  }, [isOpen, companyId]);

  const openCreateForm = () => {
    setEditingBranch(null);
    setFormCode("");
    setFormName("");
    setFormTaxCode(companyTaxCode ? `${companyTaxCode}-` : "");
    setFormAddress("");
    setFormPhone("");
    setFormRepresentative("");
    setFormIsHeadOffice(branches.length === 0);
    setFormStatus("ACTIVE");
    setIsFormOpen(true);
  };

  const openEditForm = (branch: BranchData) => {
    setEditingBranch(branch);
    setFormCode(branch.code || "");
    setFormName(branch.name || "");
    setFormTaxCode(branch.tax_code || "");
    setFormAddress(branch.address || "");
    setFormPhone(branch.phone || "");
    setFormRepresentative(branch.representative_name || "");
    setFormIsHeadOffice(Boolean(branch.is_head_office));
    setFormStatus(branch.status || "ACTIVE");
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = formCode.trim().toUpperCase();
    const cleanName = formName.trim();
    if (!cleanCode) {
      showGlobalPopup({
        type: "warning",
        title: "Thiếu thông tin",
        message: "Vui lòng nhập Mã chi nhánh.",
      });
      return;
    }
    if (!cleanName) {
      showGlobalPopup({
        type: "warning",
        title: "Thiếu thông tin",
        message: "Vui lòng nhập Tên chi nhánh.",
      });
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        company: companyId,
        code: cleanCode,
        name: cleanName,
        tax_code: formTaxCode.trim(),
        address: formAddress.trim(),
        phone: formPhone.trim(),
        representative_name: formRepresentative.trim(),
        is_head_office: formIsHeadOffice,
        status: formStatus,
      };

      if (editingBranch) {
        // Update existing branch
        await request(
          `/api/v1/organization/branches/${editingBranch.id}/?company_id=${encodeURIComponent(companyId)}`,
          token,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          }
        );
        showGlobalPopup({
          type: "success",
          title: "Cập nhật thành công",
          message: `Chi nhánh ${cleanName} đã được cập nhật thành công.`,
        });
      } else {
        // Create new branch
        await request(
          `/api/v1/organization/branches/?company_id=${encodeURIComponent(companyId)}`,
          token,
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );
        showGlobalPopup({
          type: "success",
          title: "Tạo chi nhánh thành công",
          message: `Chi nhánh mới "${cleanName}" (${cleanCode}) đã được tạo.`,
        });
      }

      setIsFormOpen(false);
      setEditingBranch(null);
      await loadBranches();
      onBranchesUpdated?.();
    } catch (err: any) {
      showGlobalPopup({
        type: "error",
        title: "Không thể lưu chi nhánh",
        message: err?.message || "Đã xảy ra lỗi trong quá trình lưu chi nhánh.",
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredBranches = useMemo(() => {
    if (!search.trim()) return branches;
    const q = search.toLowerCase();
    return branches.filter(
      (b) =>
        b.code?.toLowerCase().includes(q) ||
        b.name?.toLowerCase().includes(q) ||
        b.address?.toLowerCase().includes(q) ||
        b.tax_code?.toLowerCase().includes(q)
    );
  }, [branches, search]);

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
          maxWidth: 920,
          background: "#ffffff",
          borderRadius: 14,
          boxShadow: "0 20px 40px rgba(0,0,0,0.18)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
          overflow: "hidden",
          fontFamily: "'Be Vietnam Pro', -apple-system, sans-serif",
        }}
      >
        {/* Header Modal */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 24px",
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "#e0f2fe",
                color: "#0284c7",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Building2 size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
                Quản lý Chi nhánh & Đơn vị phụ thuộc
              </h2>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                {companyName} · MST: <strong>{companyTaxCode || "---"}</strong>
              </div>
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
              borderRadius: 6,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          {isFormOpen ? (
            /* Form Thêm / Chỉnh sửa chi nhánh */
            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: 12,
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0284c7", display: "flex", alignItems: "center", gap: 6 }}>
                  {editingBranch ? <Edit2 size={16} /> : <Plus size={16} />}
                  {editingBranch ? `Chỉnh sửa chi nhánh: ${editingBranch.name}` : "Thêm chi nhánh mới"}
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  style={{
                    fontSize: 13,
                    color: "#64748b",
                    background: "#f1f5f9",
                    border: "none",
                    borderRadius: 6,
                    padding: "4px 10px",
                    cursor: "pointer",
                  }}
                >
                  ← Quay lại danh sách
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Mã chi nhánh <span style={{ color: "#e11d48" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="VD: CN-DN, CN-HCM"
                    required
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                      boxSizing: "border-box",
                      fontFamily: "monospace",
                      fontWeight: 700,
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Tên chi nhánh / Đơn vị <span style={{ color: "#e11d48" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="VD: Chi nhánh Đà Nẵng, Văn phòng miền Trung"
                    required
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Mã số thuế chi nhánh (13 số)
                  </label>
                  <input
                    type="text"
                    value={formTaxCode}
                    onChange={(e) => setFormTaxCode(e.target.value)}
                    placeholder="VD: 0101234567-002"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Người đại diện chi nhánh
                  </label>
                  <input
                    type="text"
                    value={formRepresentative}
                    onChange={(e) => setFormRepresentative(e.target.value)}
                    placeholder="VD: Nguyễn Văn A"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Số điện thoại liên hệ
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="VD: 0236 3888 999"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Địa chỉ chi nhánh
                  </label>
                  <input
                    type="text"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="VD: Số 123 Đường Bạch Đằng, Quận Hải Châu, TP. Đà Nẵng"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 8 }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                  <input
                    type="checkbox"
                    checked={formIsHeadOffice}
                    onChange={(e) => setFormIsHeadOffice(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: "#0284c7" }}
                  />
                  Đặt làm Trụ sở chính (Head Office)
                </label>

                <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Trạng thái:</span>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    <option value="ACTIVE">🟢 Đang hoạt động</option>
                    <option value="INACTIVE">⚪ Ngừng hoạt động</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    background: "#f1f5f9",
                    border: "1px solid #cbd5e1",
                    color: "#475569",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 6,
                    background: "#0284c7",
                    color: "#ffffff",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
                  }}
                >
                  {saving ? "Đang lưu..." : editingBranch ? "Cập nhật chi nhánh" : "Lưu chi nhánh mới"}
                </button>
              </div>
            </form>
          ) : (
            /* Bảng danh sách chi nhánh */
            <div>
              {/* Toolbar */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
                  <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm theo mã, tên, địa chỉ chi nhánh..."
                    style={{
                      width: "100%",
                      padding: "8px 12px 8px 32px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    onClick={loadBranches}
                    disabled={loading}
                    title="Tải lại"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      color: "#475569",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <RefreshCw size={14} className={loading ? "spin" : ""} />
                  </button>

                  <button
                    type="button"
                    onClick={openCreateForm}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 16px",
                      borderRadius: 8,
                      background: "#0284c7",
                      color: "#ffffff",
                      border: "none",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: "0 2px 6px rgba(2, 132, 199, 0.2)",
                    }}
                  >
                    <Plus size={16} /> Thêm chi nhánh mới
                  </button>
                </div>
              </div>

              {/* Table */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", fontWeight: 700 }}>
                      <th style={{ padding: "10px 14px" }}>Mã chi nhánh</th>
                      <th style={{ padding: "10px 14px" }}>Tên chi nhánh / Đơn vị</th>
                      <th style={{ padding: "10px 14px" }}>Mã số thuế</th>
                      <th style={{ padding: "10px 14px" }}>Địa chỉ</th>
                      <th style={{ padding: "10px 14px" }}>Người đại diện</th>
                      <th style={{ padding: "10px 14px", textAlign: "center" }}>Trạng thái</th>
                      <th style={{ padding: "10px 14px", textAlign: "right" }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBranches.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: 36, textAlign: "center", color: "#64748b" }}>
                          {loading ? "Đang tải dữ liệu chi nhánh..." : "Chưa có chi nhánh nào phù hợp."}
                        </td>
                      </tr>
                    ) : (
                      filteredBranches.map((b) => {
                        const isCurrentActive = activeBranchId === b.id;
                        return (
                          <tr
                            key={b.id}
                            style={{
                              borderBottom: "1px solid #f1f5f9",
                              background: isCurrentActive ? "#f0fdf4" : undefined,
                            }}
                          >
                            <td style={{ padding: "10px 14px", fontWeight: 700, fontFamily: "monospace", color: "#0284c7" }}>
                              {b.code}
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <strong style={{ color: "#0f172a" }}>{b.name}</strong>
                                {b.is_head_office && (
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      padding: "1px 6px",
                                      borderRadius: 4,
                                      background: "#fef3c7",
                                      color: "#b45309",
                                      border: "1px solid #fde68a",
                                    }}
                                  >
                                    Trụ sở chính
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: "10px 14px", color: "#334155" }}>{b.tax_code || "---"}</td>
                            <td style={{ padding: "10px 14px", color: "#475569", maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={b.address}>
                              {b.address || "---"}
                            </td>
                            <td style={{ padding: "10px 14px", color: "#334155" }}>
                              {b.representative_name ? (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <User size={12} color="#64748b" /> {b.representative_name}
                                </span>
                              ) : (
                                "---"
                              )}
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "center" }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  background: b.status === "ACTIVE" ? "#ecfdf5" : "#f1f5f9",
                                  color: b.status === "ACTIVE" ? "#047857" : "#64748b",
                                }}
                              >
                                {b.status === "ACTIVE" ? (
                                  <>
                                    <CheckCircle2 size={12} /> Hoạt động
                                  </>
                                ) : (
                                  <>
                                    <XCircle size={12} /> Ngừng
                                  </>
                                )}
                              </span>
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "right" }}>
                              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                {onSelectBranch && !isCurrentActive && (
                                  <button
                                    type="button"
                                    onClick={() => onSelectBranch(b.id, b.name)}
                                    title="Chọn làm việc tại chi nhánh này"
                                    style={{
                                      padding: "4px 8px",
                                      borderRadius: 4,
                                      background: "#e0f2fe",
                                      border: "none",
                                      color: "#0369a1",
                                      fontSize: 12,
                                      fontWeight: 600,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Chọn làm việc
                                  </button>
                                )}
                                {isCurrentActive && (
                                  <span style={{ fontSize: 11, fontWeight: 700, color: "#15803d", display: "inline-flex", alignItems: "center", gap: 2 }}>
                                    <Check size={12} /> Đang chọn
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openEditForm(b)}
                                  title="Sửa thông tin chi nhánh"
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: 4,
                                    background: "#f8fafc",
                                    border: "1px solid #cbd5e1",
                                    color: "#334155",
                                    fontSize: 12,
                                    cursor: "pointer",
                                  }}
                                >
                                  Sửa
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid #e2e8f0",
            background: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 12,
            color: "#64748b",
          }}
        >
          <div>
            Tổng số: <strong>{branches.length}</strong> chi nhánh (
            {branches.filter((b) => b.status === "ACTIVE").length} đang hoạt động)
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              color: "#334155",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
