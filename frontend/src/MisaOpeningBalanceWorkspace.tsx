import React, { useState } from "react";
import {
  HelpCircle,
  X,
  Plus,
  Trash2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Search,
  ExternalLink,
  Upload,
  Download,
  Check,
  Building2,
  CreditCard,
  Users,
  Package,
  Wrench,
  CarFront,
  FileSpreadsheet,
  Tag,
  Briefcase,
  Layers,
  ArrowLeft,
} from "lucide-react";
import "./misa-opening.css";

export type MisaOpeningBalanceWorkspaceProps = {
  notify?: (msg: string) => void;
};

type OpeningCategory = {
  id: string;
  title: string;
  heading: string;
  catalogLink: string;
  catalogName: string;
  tooltipText: string;
  color: string;
};

const OPENING_CATEGORIES: OpeningCategory[] = [
  {
    id: "accounts",
    title: "Số dư tài khoản",
    heading: "Để bắt đầu một năm tài chính mới, bạn cần nhập số dư đầu kỳ cho các tài khoản",
    catalogLink: "/directory/accounting",
    catalogName: "Danh mục Hệ thống tài khoản",
    tooltipText: "Nhấn vào đây để nhập số dư đầu kì của tài khoản",
    color: "#00a862",
  },
  {
    id: "bank",
    title: "Số dư TK ngân hàng",
    heading: "Để bắt đầu một năm tài chính mới, bạn cần nhập số dư đầu kỳ cho các tài khoản ngân hàng",
    catalogLink: "/directory/bank-accounts",
    catalogName: "Danh mục Tài khoản ngân hàng",
    tooltipText: "Nhấn vào đây để nhập số dư đầu kì của tài khoản ngân hàng",
    color: "#0284c7",
  },
  {
    id: "customers",
    title: "Công nợ khách hàng",
    heading: "Để bắt đầu một năm tài chính mới, bạn cần nhập số dư công nợ khách hàng",
    catalogLink: "/directory/partners?type=customer",
    catalogName: "Danh mục Khách hàng",
    tooltipText: "Nhấn vào đây để nhập số dư đầu kì của công nợ khách hàng",
    color: "#10b981",
  },
  {
    id: "suppliers",
    title: "Công nợ nhà cung cấp",
    heading: "Để bắt đầu một năm tài chính mới, bạn cần nhập số dư công nợ đầu kỳ của các nhà cung cấp",
    catalogLink: "/directory/partners?type=supplier",
    catalogName: "Danh mục Nhà cung cấp",
    tooltipText: "Nhấn vào đây để nhập số dư đầu kì của công nợ nhà cung cấp",
    color: "#f59e0b",
  },
  {
    id: "employees",
    title: "Công nợ nhân viên",
    heading: "Để bắt đầu một năm tài chính mới, bạn cần nhập số dư công nợ đầu kỳ của các nhân viên",
    catalogLink: "/directory/organization",
    catalogName: "Danh mục Nhân viên",
    tooltipText: "Nhấn vào đây để nhập số dư đầu kì của công nợ nhân viên",
    color: "#6366f1",
  },
  {
    id: "inventory",
    title: "Tồn kho vật tư, hàng hóa và CCDC",
    heading: "Để bắt đầu một năm tài chính mới, bạn cần nhập số dư tồn kho đầu kỳ của các vật tư, hàng hóa trên từng kho",
    catalogLink: "/directory/items",
    catalogName: "Danh mục vật tư hàng hóa",
    tooltipText: "Nhấn vào đây để nhập tồn kho đầu kì của vật tư hàng hóa",
    color: "#059669",
  },
  {
    id: "tools",
    title: "CCDC đang sử dụng đầu kỳ",
    heading: "Để bắt đầu một năm tài chính mới, bạn cần khai báo các CCDC đã ghi tăng các năm trước để tiếp tục phân bổ chi phí trong năm nay",
    catalogLink: "/tools",
    catalogName: "Danh mục Công cụ dụng cụ",
    tooltipText: "Nhấn vào đây để khai báo CCDC đầu kỳ",
    color: "#d97706",
  },
  {
    id: "assets",
    title: "Tài sản cố định đầu kỳ",
    heading: "Để bắt đầu một năm tài chính mới, bạn cần khai báo các TSCĐ đã ghi tăng của các năm trước để tiếp tục tính khấu hao trong năm nay",
    catalogLink: "/assets",
    catalogName: "Danh mục Tài sản cố định",
    tooltipText: "Nhấn vào đây để khai báo tài sản cố định đầu kỳ",
    color: "#2563eb",
  },
  {
    id: "prepaid",
    title: "Chi phí trả trước đầu kỳ",
    heading: "Để bắt đầu một năm tài chính mới, bạn cần khai báo các chi phí trả trước đã phát sinh các năm trước để tiếp tục phân bổ chi phí trong năm nay",
    catalogLink: "/ledger",
    catalogName: "Chi phí trả trước",
    tooltipText: "Nhấn vào đây để khai báo chi phí trả trước đầu kỳ",
    color: "#8b5cf6",
  },
  {
    id: "wip",
    title: "Chi phí dở dang",
    heading: "Nhập ngay chi phí dở dang để bắt đầu một năm tài chính mới",
    catalogLink: "/cost",
    catalogName: "Danh mục Đối tượng tập hợp chi phí",
    tooltipText: "Nhấn vào đây để nhập chi phí dở dang đầu kỳ",
    color: "#0d9488",
  },
];

export default function MisaOpeningBalanceWorkspace({ notify }: MisaOpeningBalanceWorkspaceProps) {
  // Current view: null (hub) or category id
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  // Modal State
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Chi phí dở dang subtab
  const [wipSubtab, setWipSubtab] = useState<string>("Đối tượng tập hợp chi phí");

  // Accounts grid rows
  const [accountRows, setAccountRows] = useState([
    { account: "1111", name: "Tiền Việt Nam", debit: 0, credit: 0 },
    { account: "1121", name: "Tiền gửi Ngân hàng TMCP Ngoại thương VN (VCB)", debit: 0, credit: 0 },
    { account: "131", name: "Phải thu của khách hàng", debit: 0, credit: 0 },
    { account: "152", name: "Nguyên liệu, vật liệu", debit: 0, credit: 0 },
    { account: "1561", name: "Giá mua hàng hóa", debit: 0, credit: 0 },
    { account: "2111", name: "Nhà cửa, vật kiến trúc", debit: 0, credit: 0 },
    { account: "331", name: "Phải trả cho người bán", debit: 0, credit: 0 },
    { account: "4111", name: "Vốn góp của chủ sở hữu", debit: 0, credit: 0 },
  ]);

  // Section collapse state in customer/supplier modals
  const [invoiceDetailOpen, setInvoiceDetailOpen] = useState(true);
  const [projectDetailOpen, setProjectDetailOpen] = useState(true);

  // Form states for modals
  const [bankAccountCode, setBankAccountCode] = useState("112");
  const [bankAccNumber, setBankAccNumber] = useState("");
  const [bankDebit, setBankDebit] = useState(0);
  const [bankCredit, setBankCredit] = useState(0);

  const [partnerAccCode, setPartnerAccCode] = useState("131");
  const [partnerName, setPartnerName] = useState("");
  const [partnerDebit, setPartnerDebit] = useState(0);
  const [partnerCredit, setPartnerCredit] = useState(0);

  const [supplierAccCode, setSupplierAccCode] = useState("331");
  const [supplierName, setSupplierName] = useState("");
  const [supplierDebit, setSupplierDebit] = useState(0);
  const [supplierCredit, setSupplierCredit] = useState(0);

  const [employeeAccCode, setEmployeeAccCode] = useState("141");
  const [employeeName, setEmployeeName] = useState("");
  const [employeeDebit, setEmployeeDebit] = useState(0);
  const [employeeCredit, setEmployeeCredit] = useState(0);

  const [inventoryItem, setInventoryItem] = useState("");
  const [inventoryWarehouse, setInventoryWarehouse] = useState("");
  const [inventoryQty, setInventoryQty] = useState(0);
  const [inventoryVal, setInventoryVal] = useState(0);

  const activeCategory = OPENING_CATEGORIES.find((c) => c.id === activeCategoryId);

  const handleOpenCategory = (id: string) => {
    setActiveCategoryId(id);
  };

  const handleBackToHub = () => {
    setActiveCategoryId(null);
    setActiveModal(null);
  };

  const handleSaveModal = (type: string, andAdd = false) => {
    notify?.(`Đã lưu thành công ${type}.`);
    if (!andAdd) {
      setActiveModal(null);
    }
  };

  // =========================================================================
  // VIEW 1: MAIN HUB SCREEN (10 TILES) - Matches Screenshot 3
  // =========================================================================
  if (!activeCategoryId) {
    return (
      <div className="misa-opening-container">
        <div className="misa-opening-hub">
          <h2 className="misa-opening-hub-title">Nhập số dư ban đầu</h2>

          <div className="misa-opening-tiles-grid">
            {OPENING_CATEGORIES.map((cat, idx) => (
              <div
                key={cat.id}
                className="misa-opening-tile"
                onClick={() => handleOpenCategory(cat.id)}
              >
                <div className="misa-opening-tile-icon">
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    {/* Folder base */}
                    <rect x="6" y="8" width="36" height="34" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
                    <rect x="6" y="8" width="36" height="8" rx="2" fill="#e2e8f0" />
                    {/* Badge */}
                    <circle cx="24" cy="26" r="12" fill={cat.color} opacity="0.15" />
                    <circle cx="24" cy="26" r="9" fill={cat.color} />
                    <text x="24" y="30" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">
                      {idx === 0
                        ? "$"
                        : idx === 1
                        ? "NH"
                        : idx === 2
                        ? "KH"
                        : idx === 3
                        ? "NC"
                        : idx === 4
                        ? "NV"
                        : idx === 5
                        ? "KHO"
                        : idx === 6
                        ? "CC"
                        : idx === 7
                        ? "TS"
                        : idx === 8
                        ? "CP"
                        : "DD"}
                    </text>
                  </svg>
                </div>
                <span className="misa-opening-tile-label">{cat.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: CATEGORY DETAIL PAGE (LANDING + MODALS)
  // =========================================================================
  return (
    <div className="misa-opening-container">
      {/* Top Header */}
      <div className="misa-opening-detail-header">
        <div className="misa-opening-detail-left">
          <h3 className="misa-opening-detail-title">{activeCategory?.title}</h3>
          <a
            href={activeCategory?.catalogLink}
            className="misa-opening-catalog-link"
            onClick={(e) => {
              e.preventDefault();
              notify?.(`Đang mở ${activeCategory?.catalogName}...`);
            }}
          >
            <span>{activeCategory?.catalogName}</span>
          </a>
        </div>

        <div className="misa-opening-detail-right">
          <div className="misa-opening-info-note">
            <span style={{ color: "#00a862", fontWeight: 700 }}>ⓘ</span>
            <span>
              Để nhập &lt;{activeCategory?.title}&gt; theo ngoại tệ bạn cần thay đổi tùy chọn tiền tệ trong{" "}
              <a
                href="#settings"
                className="misa-opening-info-link"
                onClick={(e) => {
                  e.preventDefault();
                  notify?.("Mở thiết lập tiền tệ...");
                }}
              >
                Tùy chọn chung
              </a>
              . Xem hướng dẫn{" "}
              <a
                href="#guide"
                className="misa-opening-info-link"
                onClick={(e) => {
                  e.preventDefault();
                  notify?.("Mở hướng dẫn nhập số dư...");
                }}
              >
                tại đây
              </a>
            </span>
          </div>

          <button
            type="button"
            className="misa-opening-help-btn"
            onClick={() => notify?.("Hướng dẫn sử dụng nhập số dư ban đầu.")}
          >
            <HelpCircle size={15} />
            <span>Hướng dẫn sử dụng</span>
            <ChevronDown size={13} />
          </button>

          <button
            type="button"
            className="misa-opening-close-btn"
            onClick={handleBackToHub}
            title="Đóng về màn hình tổng"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Chi phí dở dang Subtabs */}
      {activeCategoryId === "wip" && (
        <div style={{ display: "flex", gap: 16, padding: "8px 24px 0", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          {["Đối tượng tập hợp chi phí", "Công trình", "Đơn hàng", "Hợp đồng"].map((sub) => (
            <button
              key={sub}
              type="button"
              style={{
                background: "none",
                border: "none",
                padding: "8px 4px",
                fontSize: 13,
                fontWeight: wipSubtab === sub ? 600 : 400,
                color: wipSubtab === sub ? "#00a862" : "#475569",
                borderBottom: wipSubtab === sub ? "2px solid #00a862" : "2px solid transparent",
                cursor: "pointer",
              }}
              onClick={() => setWipSubtab(sub)}
            >
              {sub}
            </button>
          ))}
        </div>
      )}

      {/* Landing View with Centered Illustration */}
      <div className="misa-opening-landing">
        <div className="misa-opening-illustration">
          <svg width="200" height="150" viewBox="0 0 200 150" fill="none">
            <ellipse cx="100" cy="140" rx="70" ry="8" fill="#e2e8f0" opacity="0.6" />
            {/* Woman at desk graphic */}
            <circle cx="102" cy="74" r="14" fill="#00a862" />
            <path d="M92 98 C92 88, 112 88, 112 98 L112 115 L92 115 Z" fill="#00a862" />
            <rect x="76" y="104" width="46" height="26" rx="3" fill="#cbd5e1" stroke="#94a3b8" />
            {/* Coins and icons around */}
            <circle cx="50" cy="62" r="16" fill="#00a862" />
            <text x="50" y="68" textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="bold">
              $
            </text>
            <circle cx="148" cy="70" r="10" fill="#00a862" opacity="0.8" />
            <text x="148" y="74" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">
              %
            </text>
            <circle cx="156" cy="46" r="8" fill="#0284c7" />
            <circle cx="138" cy="98" r="8" fill="#f59e0b" />
          </svg>
        </div>

        <h3 className="misa-opening-heading">{activeCategory?.heading}</h3>

        <div className="misa-opening-landing-btns">
          <button
            type="button"
            className="misa-opening-btn-primary"
            onClick={() => setActiveModal(activeCategoryId)}
          >
            Nhập số dư
          </button>
          <button
            type="button"
            className="misa-opening-btn-secondary"
            onClick={() => notify?.("Chuẩn bị nhập số dư từ tệp Excel mẫu...")}
          >
            Nhập số dư từ Excel
          </button>

          {/* Floating Tooltip Bubble */}
          <div className="misa-opening-tooltip-bubble">{activeCategory?.tooltipText}</div>
        </div>

        <button
          type="button"
          className="misa-opening-bottom-btn"
          onClick={() => notify?.("Xem danh sách chứng từ đã nhập...")}
        >
          Xem danh sách chứng từ
        </button>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: SỐ DƯ TÀI KHOẢN (FULL-SCREEN TABLE ENTRY)                         */}
      {/* ========================================================================= */}
      {activeModal === "accounts" && (
        <div className="misa-opening-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="misa-opening-modal large" style={{ maxWidth: 1040 }} onClick={(e) => e.stopPropagation()}>
            <div className="misa-opening-modal-header">
              <h3 className="misa-opening-modal-title">Nhập số dư tài khoản</h3>
              <button type="button" className="misa-opening-close-btn" onClick={() => setActiveModal(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="misa-opening-modal-body" style={{ maxHeight: 520 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ position: "relative", width: 260 }}>
                  <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input
                    type="text"
                    placeholder="Nhập từ khóa tìm kiếm"
                    className="misa-opening-input"
                    style={{ paddingLeft: 32, width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ overflowX: "auto", width: "100%" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, border: "1px solid #cbd5e1" }}>
                  <thead>
                    <tr style={{ background: "#dcfce7", color: "#166534", borderBottom: "1px solid #cbd5e1" }}>
                      <th style={{ padding: "8px 12px", textAlign: "left", width: 140 }}>Số tài khoản</th>
                      <th style={{ padding: "8px 12px", textAlign: "left" }}>Tên tài khoản</th>
                      <th style={{ padding: "8px 12px", textAlign: "right", width: 150 }}>Dư Nợ</th>
                      <th style={{ padding: "8px 12px", textAlign: "right", width: 150 }}>Dư Có</th>
                      <th style={{ padding: "8px 12px", textAlign: "center", width: 120 }}>Chi tiết số dư</th>
                      <th style={{ padding: "8px 12px", width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountRows.map((row, idx) => (
                      <tr key={row.account} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "6px 12px", fontWeight: 600 }}>{row.account}</td>
                        <td style={{ padding: "6px 12px" }}>{row.name}</td>
                        <td style={{ padding: "6px 12px" }}>
                          <input
                            type="number"
                            value={row.debit}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              const next = [...accountRows];
                              next[idx].debit = val;
                              setAccountRows(next);
                            }}
                            className="misa-opening-input"
                            style={{ textAlign: "right", width: "100%" }}
                          />
                        </td>
                        <td style={{ padding: "6px 12px" }}>
                          <input
                            type="number"
                            value={row.credit}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              const next = [...accountRows];
                              next[idx].credit = val;
                              setAccountRows(next);
                            }}
                            className="misa-opening-input"
                            style={{ textAlign: "right", width: "100%" }}
                          />
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "center" }}>
                          <span style={{ color: "#00a862", cursor: "pointer", fontSize: 12.5 }}>Nhập chi tiết</span>
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => setAccountRows(accountRows.filter((_, i) => i !== idx))}
                            style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                      <td colSpan={2} style={{ padding: "8px 12px" }}>Tổng</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>
                        {accountRows.reduce((a, b) => a + b.debit, 0).toLocaleString("vi-VN")}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>
                        {accountRows.reduce((a, b) => a + b.credit, 0).toLocaleString("vi-VN")}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="misa-opening-btn-secondary"
                  style={{ height: 30, fontSize: 12.5, padding: "0 12px" }}
                  onClick={() => setAccountRows([...accountRows, { account: "1388", name: "Phải thu khác", debit: 0, credit: 0 }])}
                >
                  + Thêm dòng
                </button>
                <button
                  type="button"
                  className="misa-opening-btn-secondary"
                  style={{ height: 30, fontSize: 12.5, padding: "0 12px" }}
                  onClick={() => setAccountRows([])}
                >
                  Xóa hết dòng
                </button>
              </div>
            </div>

            <div className="misa-opening-modal-footer">
              <button type="button" className="misa-opening-btn-secondary" onClick={() => setActiveModal(null)}>
                Đóng
              </button>
              <button type="button" className="misa-opening-btn-secondary" onClick={() => handleSaveModal("Số dư tài khoản", true)}>
                Cất
              </button>
              <button type="button" className="misa-opening-btn-primary" onClick={() => handleSaveModal("Số dư tài khoản", false)}>
                Cất và Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: SỐ DƯ TÀI KHOẢN NGÂN HÀNG                                        */}
      {/* ========================================================================= */}
      {activeModal === "bank" && (
        <div className="misa-opening-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="misa-opening-modal" onClick={(e) => e.stopPropagation()}>
            <div className="misa-opening-modal-header">
              <h3 className="misa-opening-modal-title">Số dư tài khoản ngân hàng</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <HelpCircle size={18} color="#64748b" style={{ cursor: "pointer" }} />
                <X size={18} color="#64748b" style={{ cursor: "pointer" }} onClick={() => setActiveModal(null)} />
              </div>
            </div>
            <div className="misa-opening-modal-body">
              <div className="misa-opening-field">
                <label className="misa-opening-label">Số tài khoản <span style={{ color: "#ef4444" }}>*</span></label>
                <select className="misa-opening-select" value={bankAccountCode} onChange={(e) => setBankAccountCode(e.target.value)}>
                  <option value="112">112 - Tiền gửi ngân hàng</option>
                  <option value="1121">1121 - Tiền Việt Nam</option>
                  <option value="1122">1122 - Ngoại tệ</option>
                </select>
              </div>
              <div className="misa-opening-field">
                <label className="misa-opening-label">Tài khoản ngân hàng <span style={{ color: "#ef4444" }}>*</span></label>
                <div style={{ display: "flex", gap: 6 }}>
                  <select className="misa-opening-select" style={{ flex: 1 }} value={bankAccNumber} onChange={(e) => setBankAccNumber(e.target.value)}>
                    <option value="">-- Chọn số tài khoản ngân hàng --</option>
                    <option value="VCB-001">0011004234567 - Vietcombank Sở giao dịch</option>
                    <option value="TCB-002">1903456789001 - Techcombank Ba Đình</option>
                    <option value="MB-003">0580123456789 - MBBank Chi nhánh Đống Đa</option>
                  </select>
                  <button type="button" className="misa-opening-btn-secondary" style={{ width: 34, padding: 0, justifyContent: "center" }}>
                    +
                  </button>
                </div>
              </div>
              <div className="misa-opening-form-row">
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Dư Nợ</label>
                  <input type="number" className="misa-opening-input" value={bankDebit} onChange={(e) => setBankDebit(Number(e.target.value) || 0)} />
                </div>
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Dư Có</label>
                  <input type="number" className="misa-opening-input" value={bankCredit} onChange={(e) => setBankCredit(Number(e.target.value) || 0)} />
                </div>
              </div>
            </div>
            <div className="misa-opening-modal-footer">
              <button type="button" className="misa-opening-btn-secondary" onClick={() => setActiveModal(null)}>
                Đóng
              </button>
              <button type="button" className="misa-opening-btn-secondary" onClick={() => handleSaveModal("Số dư TK ngân hàng", false)}>
                Cất
              </button>
              <button type="button" className="misa-opening-btn-primary" onClick={() => handleSaveModal("Số dư TK ngân hàng", true)}>
                Cất và Thêm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CÔNG NỢ KHÁCH HÀNG (EXPANDABLE SECTIONS)                        */}
      {/* ========================================================================= */}
      {activeModal === "customers" && (
        <div className="misa-opening-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="misa-opening-modal large" onClick={(e) => e.stopPropagation()}>
            <div className="misa-opening-modal-header">
              <h3 className="misa-opening-modal-title">Nhập chi tiết công nợ khách hàng</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <HelpCircle size={18} color="#64748b" style={{ cursor: "pointer" }} />
                <X size={18} color="#64748b" style={{ cursor: "pointer" }} onClick={() => setActiveModal(null)} />
              </div>
            </div>
            <div className="misa-opening-modal-body" style={{ maxHeight: 520 }}>
              <div className="misa-opening-form-row">
                <div className="misa-opening-field" style={{ flex: 1 }}>
                  <label className="misa-opening-label">Số tài khoản <span style={{ color: "#ef4444" }}>*</span></label>
                  <select className="misa-opening-select" value={partnerAccCode} onChange={(e) => setPartnerAccCode(e.target.value)}>
                    <option value="131">131 - Phải thu của khách hàng</option>
                    <option value="1361">1361 - Vốn kinh doanh ở các đơn vị trực thuộc</option>
                    <option value="1362">1362 - Phải thu nội bộ về chênh lệch tỷ giá</option>
                    <option value="1363">1363 - Phải thu nội bộ về chi phí đi vay đủ điều kiện</option>
                    <option value="1368">1368 - Phải thu nội bộ khác</option>
                  </select>
                </div>
                <div className="misa-opening-field" style={{ flex: 2 }}>
                  <label className="misa-opening-label">Khách hàng <span style={{ color: "#ef4444" }}>*</span></label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <select className="misa-opening-select" style={{ flex: 1 }} value={partnerName} onChange={(e) => setPartnerName(e.target.value)}>
                      <option value="">-- Chọn khách hàng --</option>
                      <option value="KH001">KH001 - Công ty Cổ phần Công nghệ Sao Việt</option>
                      <option value="KH002">KH002 - Công ty TNHH Đầu tư & Thương mại Thăng Long</option>
                      <option value="KH003">KH003 - Doanh nghiệp Tư nhân Minh Phát</option>
                    </select>
                    <button type="button" className="misa-opening-btn-secondary" style={{ width: 34, padding: 0, justifyContent: "center" }}>
                      +
                    </button>
                  </div>
                </div>
                <div className="misa-opening-field" style={{ flex: 1 }}>
                  <label className="misa-opening-label">Dư Nợ</label>
                  <input type="number" className="misa-opening-input" value={partnerDebit} onChange={(e) => setPartnerDebit(Number(e.target.value) || 0)} />
                </div>
                <div className="misa-opening-field" style={{ flex: 1 }}>
                  <label className="misa-opening-label">Dư Có</label>
                  <input type="number" className="misa-opening-input" value={partnerCredit} onChange={(e) => setPartnerCredit(Number(e.target.value) || 0)} />
                </div>
              </div>

              {/* Collapsible 1: Chi tiết theo Hóa đơn */}
              <div className="misa-opening-collapsible-section">
                <div className="misa-opening-collapsible-title" onClick={() => setInvoiceDetailOpen(!invoiceDetailOpen)}>
                  {invoiceDetailOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>Chi tiết theo Hóa đơn</span>
                </div>
                {invoiceDetailOpen && (
                  <div style={{ padding: 10 }}>
                    <div style={{ overflowX: "auto", width: "100%" }}>
                      <table className="misa-opening-table-mini">
                        <thead>
                          <tr>
                            <th>Ngày hóa đơn/chứng từ</th>
                            <th>Số hóa đơn/chứng từ</th>
                            <th>Hạn thanh toán</th>
                            <th style={{ textAlign: "right" }}>Giá trị hóa đơn</th>
                            <th style={{ textAlign: "right" }}>Số còn phải thu</th>
                            <th style={{ textAlign: "right" }}>Số thu trước</th>
                            <th>Nhân viên</th>
                            <th style={{ width: 30 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td><input type="text" className="misa-opening-input" defaultValue="15/12/2025" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="text" className="misa-opening-input" defaultValue="HD00125" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="text" className="misa-opening-input" defaultValue="15/01/2026" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="number" className="misa-opening-input" defaultValue="50000000" style={{ height: 26, fontSize: 12, textAlign: "right" }} /></td>
                            <td><input type="number" className="misa-opening-input" defaultValue="50000000" style={{ height: 26, fontSize: 12, textAlign: "right" }} /></td>
                            <td><input type="number" className="misa-opening-input" defaultValue="0" style={{ height: 26, fontSize: 12, textAlign: "right" }} /></td>
                            <td><input type="text" className="misa-opening-input" defaultValue="Nguyễn Văn A" style={{ height: 26, fontSize: 12 }} /></td>
                            <td style={{ textAlign: "center" }}><Trash2 size={13} color="#ef4444" style={{ cursor: "pointer" }} /></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button type="button" className="misa-opening-btn-secondary" style={{ height: 26, fontSize: 12, padding: "0 10px" }}>+ Thêm dòng</button>
                      <button type="button" className="misa-opening-btn-secondary" style={{ height: 26, fontSize: 12, padding: "0 10px" }}>Xóa hết dòng</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Collapsible 2: Chi tiết theo nhân viên, đơn vị, công trình, đơn hàng, hợp đồng */}
              <div className="misa-opening-collapsible-section">
                <div className="misa-opening-collapsible-title" onClick={() => setProjectDetailOpen(!projectDetailOpen)}>
                  {projectDetailOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>Chi tiết theo nhân viên, đơn vị, công trình, đơn hàng, hợp đồng</span>
                </div>
                {projectDetailOpen && (
                  <div style={{ padding: 10 }}>
                    <div style={{ overflowX: "auto", width: "100%" }}>
                      <table className="misa-opening-table-mini">
                        <thead>
                          <tr>
                            <th>Nhân viên</th>
                            <th>Đơn vị</th>
                            <th>Công trình</th>
                            <th>Đơn đặt hàng</th>
                            <th>Hợp đồng bán</th>
                            <th style={{ textAlign: "right" }}>Dư Nợ</th>
                            <th style={{ textAlign: "right" }}>Dư Có</th>
                            <th style={{ width: 30 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td><input type="text" className="misa-opening-input" placeholder="Nhân viên" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="text" className="misa-opening-input" defaultValue="Phòng Kinh doanh" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="text" className="misa-opening-input" placeholder="Công trình" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="text" className="misa-opening-input" placeholder="Đơn hàng" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="text" className="misa-opening-input" defaultValue="HĐ-2025/08" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="number" className="misa-opening-input" defaultValue="50000000" style={{ height: 26, fontSize: 12, textAlign: "right" }} /></td>
                            <td><input type="number" className="misa-opening-input" defaultValue="0" style={{ height: 26, fontSize: 12, textAlign: "right" }} /></td>
                            <td style={{ textAlign: "center" }}><Trash2 size={13} color="#ef4444" style={{ cursor: "pointer" }} /></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button type="button" className="misa-opening-btn-secondary" style={{ height: 26, fontSize: 12, padding: "0 10px" }}>+ Thêm dòng</button>
                      <button type="button" className="misa-opening-btn-secondary" style={{ height: 26, fontSize: 12, padding: "0 10px" }}>Xóa hết dòng</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="misa-opening-modal-footer">
              <button type="button" className="misa-opening-btn-secondary" onClick={() => setActiveModal(null)}>Đóng</button>
              <button type="button" className="misa-opening-btn-secondary" onClick={() => handleSaveModal("Công nợ khách hàng", false)}>Cất</button>
              <button type="button" className="misa-opening-btn-primary" onClick={() => handleSaveModal("Công nợ khách hàng", true)}>Cất và Thêm</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CÔNG NỢ NHÀ CUNG CẤP                                              */}
      {/* ========================================================================= */}
      {activeModal === "suppliers" && (
        <div className="misa-opening-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="misa-opening-modal large" onClick={(e) => e.stopPropagation()}>
            <div className="misa-opening-modal-header">
              <h3 className="misa-opening-modal-title">Nhập chi tiết công nợ nhà cung cấp</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <HelpCircle size={18} color="#64748b" style={{ cursor: "pointer" }} />
                <X size={18} color="#64748b" style={{ cursor: "pointer" }} onClick={() => setActiveModal(null)} />
              </div>
            </div>
            <div className="misa-opening-modal-body" style={{ maxHeight: 520 }}>
              <div className="misa-opening-form-row">
                <div className="misa-opening-field" style={{ flex: 1.2 }}>
                  <label className="misa-opening-label">Số tài khoản <span style={{ color: "#ef4444" }}>*</span></label>
                  <select className="misa-opening-select" value={supplierAccCode} onChange={(e) => setSupplierAccCode(e.target.value)}>
                    <option value="331">331 - Phải trả cho người bán</option>
                    <option value="3361">3361 - Phải trả nội bộ về vốn kinh doanh</option>
                    <option value="3362">3362 - Phải trả nội bộ về chênh lệch tỷ giá</option>
                    <option value="3363">3363 - Phải trả nội bộ về chi phí đi vay đủ điều kiện</option>
                    <option value="3368">3368 - Phải trả nội bộ khác</option>
                    <option value="3411">3411 - Các khoản đi vay</option>
                    <option value="3412">3412 - Nợ thuê tài chính</option>
                  </select>
                </div>
                <div className="misa-opening-field" style={{ flex: 2 }}>
                  <label className="misa-opening-label">Nhà cung cấp <span style={{ color: "#ef4444" }}>*</span></label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <select className="misa-opening-select" style={{ flex: 1 }} value={supplierName} onChange={(e) => setSupplierName(e.target.value)}>
                      <option value="">-- Chọn nhà cung cấp --</option>
                      <option value="NCC001">NCC001 - Công ty TNHH Phân phối Thiết bị FPT</option>
                      <option value="NCC002">NCC002 - Công ty Cổ phần Dịch vụ Viễn thông Viettel</option>
                    </select>
                    <button type="button" className="misa-opening-btn-secondary" style={{ width: 34, padding: 0, justifyContent: "center" }}>+</button>
                  </div>
                </div>
                <div className="misa-opening-field" style={{ flex: 1 }}>
                  <label className="misa-opening-label">Dư Nợ</label>
                  <input type="number" className="misa-opening-input" value={supplierDebit} onChange={(e) => setSupplierDebit(Number(e.target.value) || 0)} />
                </div>
                <div className="misa-opening-field" style={{ flex: 1 }}>
                  <label className="misa-opening-label">Dư Có</label>
                  <input type="number" className="misa-opening-input" value={supplierCredit} onChange={(e) => setSupplierCredit(Number(e.target.value) || 0)} />
                </div>
              </div>

              {/* Collapsible 1: Chi tiết theo Hóa đơn */}
              <div className="misa-opening-collapsible-section">
                <div className="misa-opening-collapsible-title" onClick={() => setInvoiceDetailOpen(!invoiceDetailOpen)}>
                  {invoiceDetailOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>Chi tiết theo Hóa đơn</span>
                </div>
                {invoiceDetailOpen && (
                  <div style={{ padding: 10 }}>
                    <div style={{ overflowX: "auto", width: "100%" }}>
                      <table className="misa-opening-table-mini">
                        <thead>
                          <tr>
                            <th>Ngày hóa đơn/chứng từ</th>
                            <th>Số hóa đơn/chứng từ</th>
                            <th>Hạn thanh toán</th>
                            <th style={{ textAlign: "right" }}>Giá trị hóa đơn</th>
                            <th style={{ textAlign: "right" }}>Số còn phải trả</th>
                            <th style={{ textAlign: "right" }}>Số trả trước</th>
                            <th>Nhân viên</th>
                            <th style={{ width: 30 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td><input type="text" className="misa-opening-input" defaultValue="20/12/2025" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="text" className="misa-opening-input" defaultValue="HD-INVOICE-88" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="text" className="misa-opening-input" defaultValue="20/01/2026" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="number" className="misa-opening-input" defaultValue="80000000" style={{ height: 26, fontSize: 12, textAlign: "right" }} /></td>
                            <td><input type="number" className="misa-opening-input" defaultValue="80000000" style={{ height: 26, fontSize: 12, textAlign: "right" }} /></td>
                            <td><input type="number" className="misa-opening-input" defaultValue="0" style={{ height: 26, fontSize: 12, textAlign: "right" }} /></td>
                            <td><input type="text" className="misa-opening-input" defaultValue="Trần Thị B" style={{ height: 26, fontSize: 12 }} /></td>
                            <td style={{ textAlign: "center" }}><Trash2 size={13} color="#ef4444" style={{ cursor: "pointer" }} /></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button type="button" className="misa-opening-btn-secondary" style={{ height: 26, fontSize: 12, padding: "0 10px" }}>+ Thêm dòng</button>
                      <button type="button" className="misa-opening-btn-secondary" style={{ height: 26, fontSize: 12, padding: "0 10px" }}>Xóa hết dòng</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Collapsible 2: Chi tiết theo nhân viên, đơn vị, công trình, đơn hàng, hợp đồng */}
              <div className="misa-opening-collapsible-section">
                <div className="misa-opening-collapsible-title" onClick={() => setProjectDetailOpen(!projectDetailOpen)}>
                  {projectDetailOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>Chi tiết theo nhân viên, đơn vị, công trình, đơn hàng, hợp đồng</span>
                </div>
                {projectDetailOpen && (
                  <div style={{ padding: 10 }}>
                    <div style={{ overflowX: "auto", width: "100%" }}>
                      <table className="misa-opening-table-mini">
                        <thead>
                          <tr>
                            <th>Nhân viên</th>
                            <th>Đơn vị</th>
                            <th>Công trình</th>
                            <th>Đơn đặt hàng</th>
                            <th>Hợp đồng mua</th>
                            <th style={{ textAlign: "right" }}>Dư Nợ</th>
                            <th style={{ textAlign: "right" }}>Dư Có</th>
                            <th style={{ width: 30 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td><input type="text" className="misa-opening-input" placeholder="Nhân viên" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="text" className="misa-opening-input" defaultValue="Phòng Vật tư" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="text" className="misa-opening-input" placeholder="Công trình" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="text" className="misa-opening-input" placeholder="Đơn hàng" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="text" className="misa-opening-input" defaultValue="HĐM-2025/11" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="number" className="misa-opening-input" defaultValue="0" style={{ height: 26, fontSize: 12, textAlign: "right" }} /></td>
                            <td><input type="number" className="misa-opening-input" defaultValue="80000000" style={{ height: 26, fontSize: 12, textAlign: "right" }} /></td>
                            <td style={{ textAlign: "center" }}><Trash2 size={13} color="#ef4444" style={{ cursor: "pointer" }} /></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button type="button" className="misa-opening-btn-secondary" style={{ height: 26, fontSize: 12, padding: "0 10px" }}>+ Thêm dòng</button>
                      <button type="button" className="misa-opening-btn-secondary" style={{ height: 26, fontSize: 12, padding: "0 10px" }}>Xóa hết dòng</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="misa-opening-modal-footer">
              <button type="button" className="misa-opening-btn-secondary" onClick={() => setActiveModal(null)}>Đóng</button>
              <button type="button" className="misa-opening-btn-secondary" onClick={() => handleSaveModal("Công nợ nhà cung cấp", false)}>Cất</button>
              <button type="button" className="misa-opening-btn-primary" onClick={() => handleSaveModal("Công nợ nhà cung cấp", true)}>Cất và Thêm</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: CÔNG NỢ NHÂN VIÊN                                                */}
      {/* ========================================================================= */}
      {activeModal === "employees" && (
        <div className="misa-opening-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="misa-opening-modal large" onClick={(e) => e.stopPropagation()}>
            <div className="misa-opening-modal-header">
              <h3 className="misa-opening-modal-title">Nhập chi tiết công nợ nhân viên</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <HelpCircle size={18} color="#64748b" style={{ cursor: "pointer" }} />
                <X size={18} color="#64748b" style={{ cursor: "pointer" }} onClick={() => setActiveModal(null)} />
              </div>
            </div>
            <div className="misa-opening-modal-body">
              <div className="misa-opening-form-row">
                <div className="misa-opening-field" style={{ flex: 1 }}>
                  <label className="misa-opening-label">Số tài khoản <span style={{ color: "#ef4444" }}>*</span></label>
                  <select className="misa-opening-select" value={employeeAccCode} onChange={(e) => setEmployeeAccCode(e.target.value)}>
                    <option value="141">141 - Tạm ứng</option>
                    <option value="1388">1388 - Phải thu khác (Nhân viên)</option>
                    <option value="3341">3341 - Phải trả người lao động</option>
                  </select>
                </div>
                <div className="misa-opening-field" style={{ flex: 2 }}>
                  <label className="misa-opening-label">Nhân viên <span style={{ color: "#ef4444" }}>*</span></label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <select className="misa-opening-select" style={{ flex: 1 }} value={employeeName} onChange={(e) => setEmployeeName(e.target.value)}>
                      <option value="">-- Chọn nhân viên --</option>
                      <option value="NV001">NV001 - Nguyễn Văn An (Phòng Kế toán)</option>
                      <option value="NV002">NV002 - Lê Thị Bình (Phòng Kinh doanh)</option>
                    </select>
                    <button type="button" className="misa-opening-btn-secondary" style={{ width: 34, padding: 0, justifyContent: "center" }}>+</button>
                  </div>
                </div>
                <div className="misa-opening-field" style={{ flex: 1 }}>
                  <label className="misa-opening-label">Dư Nợ</label>
                  <input type="number" className="misa-opening-input" value={employeeDebit} onChange={(e) => setEmployeeDebit(Number(e.target.value) || 0)} />
                </div>
                <div className="misa-opening-field" style={{ flex: 1 }}>
                  <label className="misa-opening-label">Dư Có</label>
                  <input type="number" className="misa-opening-input" value={employeeCredit} onChange={(e) => setEmployeeCredit(Number(e.target.value) || 0)} />
                </div>
              </div>
            </div>
            <div className="misa-opening-modal-footer">
              <button type="button" className="misa-opening-btn-secondary" onClick={() => setActiveModal(null)}>Đóng</button>
              <button type="button" className="misa-opening-btn-secondary" onClick={() => handleSaveModal("Công nợ nhân viên", false)}>Cất</button>
              <button type="button" className="misa-opening-btn-primary" onClick={() => handleSaveModal("Công nợ nhân viên", true)}>Cất và Thêm</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: TỒN KHO VẬT TƯ, HÀNG HÓA VÀ CCDC                                  */}
      {/* ========================================================================= */}
      {activeModal === "inventory" && (
        <div className="misa-opening-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="misa-opening-modal" onClick={(e) => e.stopPropagation()}>
            <div className="misa-opening-modal-header">
              <h3 className="misa-opening-modal-title">Nhập chi tiết tồn kho vật tư hàng hóa</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <HelpCircle size={18} color="#64748b" style={{ cursor: "pointer" }} />
                <X size={18} color="#64748b" style={{ cursor: "pointer" }} onClick={() => setActiveModal(null)} />
              </div>
            </div>
            <div className="misa-opening-modal-body">
              <div className="misa-opening-field">
                <label className="misa-opening-label">Hàng hóa <span style={{ color: "#ef4444" }}>*</span></label>
                <div style={{ display: "flex", gap: 6 }}>
                  <select className="misa-opening-select" style={{ flex: 1 }} value={inventoryItem} onChange={(e) => setInventoryItem(e.target.value)}>
                    <option value="">-- Chọn hàng hóa, vật tư --</option>
                    <option value="HH01">HH01 - Máy tính Dell Vostro 3520</option>
                    <option value="HH02">HH02 - Ổ cứng SSD Samsung 1TB</option>
                    <option value="VL01">VL01 - Dây cáp mạng Cat6 UTP</option>
                  </select>
                  <button type="button" className="misa-opening-btn-secondary" style={{ width: 34, padding: 0, justifyContent: "center" }}>+</button>
                </div>
              </div>
              <div className="misa-opening-field">
                <label className="misa-opening-label">Kho <span style={{ color: "#ef4444" }}>*</span></label>
                <div style={{ display: "flex", gap: 6 }}>
                  <select className="misa-opening-select" style={{ flex: 1 }} value={inventoryWarehouse} onChange={(e) => setInventoryWarehouse(e.target.value)}>
                    <option value="">-- Chọn kho lưu trữ --</option>
                    <option value="KHO_TONG">KHO_TONG - Kho Tổng Hà Nội</option>
                    <option value="KHO_HCM">KHO_HCM - Kho Chi nhánh TP.HCM</option>
                  </select>
                  <button type="button" className="misa-opening-btn-secondary" style={{ width: 34, padding: 0, justifyContent: "center" }}>+</button>
                </div>
              </div>
              <div className="misa-opening-form-row">
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Đơn vị tính</label>
                  <select className="misa-opening-select">
                    <option>Chiếc</option>
                    <option>Bộ</option>
                    <option>Hộp</option>
                  </select>
                </div>
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Số lượng tồn</label>
                  <input type="number" className="misa-opening-input" value={inventoryQty} onChange={(e) => setInventoryQty(Number(e.target.value) || 0)} />
                </div>
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Giá trị tồn</label>
                  <input type="number" className="misa-opening-input" value={inventoryVal} onChange={(e) => setInventoryVal(Number(e.target.value) || 0)} />
                </div>
              </div>
            </div>
            <div className="misa-opening-modal-footer">
              <button type="button" className="misa-opening-btn-secondary" onClick={() => setActiveModal(null)}>Đóng</button>
              <button type="button" className="misa-opening-btn-secondary" onClick={() => handleSaveModal("Tồn kho vật tư", false)}>Cất</button>
              <button type="button" className="misa-opening-btn-primary" onClick={() => handleSaveModal("Tồn kho vật tư", true)}>Cất và Thêm</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: CCDC ĐANG SỬ DỤNG ĐẦU KỲ                                         */}
      {/* ========================================================================= */}
      {activeModal === "tools" && (
        <div className="misa-opening-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="misa-opening-modal large" style={{ maxWidth: 1040 }} onClick={(e) => e.stopPropagation()}>
            <div className="misa-opening-modal-header">
              <h3 className="misa-opening-modal-title">Khai báo công cụ dụng cụ đầu kỳ</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <HelpCircle size={18} color="#64748b" style={{ cursor: "pointer" }} />
                <X size={18} color="#64748b" style={{ cursor: "pointer" }} onClick={() => setActiveModal(null)} />
              </div>
            </div>
            <div className="misa-opening-modal-body" style={{ maxHeight: 520 }}>
              <div className="misa-opening-form-row">
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Số CT ghi tăng *</label>
                  <input type="text" className="misa-opening-input" defaultValue="OPN" />
                </div>
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Ngày ghi tăng *</label>
                  <input type="text" className="misa-opening-input" defaultValue="01/01/2026" />
                </div>
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Mã CCDC *</label>
                  <input type="text" className="misa-opening-input" defaultValue="CCDC-001" />
                </div>
                <div className="misa-opening-field" style={{ flex: 2 }}>
                  <label className="misa-opening-label">Tên CCDC *</label>
                  <input type="text" className="misa-opening-input" defaultValue="Máy in Canon LBP 2900" />
                </div>
              </div>

              <div className="misa-opening-form-row">
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Đơn vị tính</label>
                  <input type="text" className="misa-opening-input" defaultValue="Chiếc" />
                </div>
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Số lượng</label>
                  <input type="number" className="misa-opening-input" defaultValue={1} />
                </div>
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Đơn giá</label>
                  <input type="number" className="misa-opening-input" defaultValue={4500000} />
                </div>
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Thành tiền</label>
                  <input type="number" className="misa-opening-input" defaultValue={4500000} />
                </div>
                <div className="misa-opening-field">
                  <label className="misa-opening-label">TK chờ phân bổ</label>
                  <input type="text" className="misa-opening-input" defaultValue="242" />
                </div>
              </div>
            </div>
            <div className="misa-opening-modal-footer">
              <button type="button" className="misa-opening-btn-secondary" onClick={() => setActiveModal(null)}>Đóng</button>
              <button type="button" className="misa-opening-btn-secondary" onClick={() => handleSaveModal("CCDC đầu kỳ", false)}>Cất</button>
              <button type="button" className="misa-opening-btn-primary" onClick={() => handleSaveModal("CCDC đầu kỳ", true)}>Cất và Thêm</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 8: TÀI SẢN CỐ ĐỊNH ĐẦU KỲ                                           */}
      {/* ========================================================================= */}
      {activeModal === "assets" && (
        <div className="misa-opening-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="misa-opening-modal large" style={{ maxWidth: 1040 }} onClick={(e) => e.stopPropagation()}>
            <div className="misa-opening-modal-header">
              <h3 className="misa-opening-modal-title">Khai báo tài sản cố định đầu kỳ</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <HelpCircle size={18} color="#64748b" style={{ cursor: "pointer" }} />
                <X size={18} color="#64748b" style={{ cursor: "pointer" }} onClick={() => setActiveModal(null)} />
              </div>
            </div>
            <div className="misa-opening-modal-body" style={{ maxHeight: 520 }}>
              <div className="misa-opening-form-row">
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Số CT ghi tăng *</label>
                  <input type="text" className="misa-opening-input" defaultValue="OPN" />
                </div>
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Ngày ghi tăng *</label>
                  <input type="text" className="misa-opening-input" defaultValue="01/01/2026" />
                </div>
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Mã tài sản *</label>
                  <input type="text" className="misa-opening-input" defaultValue="TSCD-001" />
                </div>
                <div className="misa-opening-field" style={{ flex: 2 }}>
                  <label className="misa-opening-label">Tên tài sản *</label>
                  <input type="text" className="misa-opening-input" defaultValue="Xe ô tô Toyota Fortuner" />
                </div>
              </div>

              <div className="misa-opening-form-row">
                <div className="misa-opening-field">
                  <label className="misa-opening-label">TK nguyên giá *</label>
                  <select className="misa-opening-select"><option>2111 - Nhà cửa, vật kiến trúc</option><option selected>2113 - Phương tiện vận tải</option></select>
                </div>
                <div className="misa-opening-field">
                  <label className="misa-opening-label">TK khấu hao *</label>
                  <select className="misa-opening-select"><option selected>2141 - Hao mòn TSCĐ hữu hình</option></select>
                </div>
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Nguyên giá</label>
                  <input type="number" className="misa-opening-input" defaultValue={1150000000} />
                </div>
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Hao mòn lũy kế</label>
                  <input type="number" className="misa-opening-input" defaultValue={230000000} />
                </div>
              </div>
            </div>
            <div className="misa-opening-modal-footer">
              <button type="button" className="misa-opening-btn-secondary" onClick={() => setActiveModal(null)}>Đóng</button>
              <button type="button" className="misa-opening-btn-secondary" onClick={() => handleSaveModal("Tài sản cố định", false)}>Cất</button>
              <button type="button" className="misa-opening-btn-primary" onClick={() => handleSaveModal("Tài sản cố định", true)}>Cất và Thêm</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 9: CHI PHÍ DỞ DANG                                                  */}
      {/* ========================================================================= */}
      {activeModal === "wip" && (
        <div className="misa-opening-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="misa-opening-modal large" style={{ maxWidth: 1040 }} onClick={(e) => e.stopPropagation()}>
            <div className="misa-opening-modal-header">
              <h3 className="misa-opening-modal-title">Khai báo chi phí dở dang đầu kỳ cho đối tượng tập hợp kỳ trước</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <HelpCircle size={18} color="#64748b" style={{ cursor: "pointer" }} />
                <X size={18} color="#64748b" style={{ cursor: "pointer" }} onClick={() => setActiveModal(null)} />
              </div>
            </div>
            <div className="misa-opening-modal-body" style={{ maxHeight: 520 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <input type="checkbox" id="wip-detail-check" style={{ accentColor: "#00a862" }} />
                <label htmlFor="wip-detail-check" style={{ fontSize: 13, cursor: "pointer" }}>Nhập chi tiết theo các yếu tố chi phí</label>
              </div>

              <div style={{ overflowX: "auto", width: "100%" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, border: "1px solid #cbd5e1" }}>
                  <thead>
                    <tr style={{ background: "#dcfce7", color: "#166534" }}>
                      <th style={{ padding: "8px 10px", textAlign: "left" }}>Mã đối tượng THCP</th>
                      <th style={{ padding: "8px 10px", textAlign: "left" }}>Tên đối tượng THCP</th>
                      <th style={{ padding: "8px 10px", textAlign: "left" }}>Loại đối tượng THCP</th>
                      <th style={{ padding: "8px 10px", textAlign: "left" }}>Quy trình sản xuất</th>
                      <th style={{ padding: "8px 10px", textAlign: "right" }}>NVL trực tiếp</th>
                      <th style={{ padding: "8px 10px", textAlign: "right" }}>Nhân công trực tiếp</th>
                      <th style={{ padding: "8px 10px", textAlign: "right" }}>Chi phí SXC</th>
                      <th style={{ width: 30 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><input type="text" className="misa-opening-input" defaultValue="THCP-SP01" style={{ height: 26, fontSize: 12 }} /></td>
                      <td><input type="text" className="misa-opening-input" defaultValue="Sản xuất Bàn làm việc Hòa Phát" style={{ height: 26, fontSize: 12 }} /></td>
                      <td><input type="text" className="misa-opening-input" defaultValue="Sản phẩm" style={{ height: 26, fontSize: 12 }} /></td>
                      <td><input type="text" className="misa-opening-input" defaultValue="Giản đơn" style={{ height: 26, fontSize: 12 }} /></td>
                      <td><input type="number" className="misa-opening-input" defaultValue={15000000} style={{ height: 26, fontSize: 12, textAlign: "right" }} /></td>
                      <td><input type="number" className="misa-opening-input" defaultValue={4500000} style={{ height: 26, fontSize: 12, textAlign: "right" }} /></td>
                      <td><input type="number" className="misa-opening-input" defaultValue={2200000} style={{ height: 26, fontSize: 12, textAlign: "right" }} /></td>
                      <td style={{ textAlign: "center" }}><Trash2 size={13} color="#ef4444" style={{ cursor: "pointer" }} /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" className="misa-opening-btn-secondary" style={{ height: 26, fontSize: 12, padding: "0 10px" }}>+ Thêm dòng</button>
                <button type="button" className="misa-opening-btn-secondary" style={{ height: 26, fontSize: 12, padding: "0 10px" }}>Xóa hết dòng</button>
              </div>
            </div>
            <div className="misa-opening-modal-footer">
              <button type="button" className="misa-opening-btn-secondary" onClick={() => setActiveModal(null)}>Hủy</button>
              <button type="button" className="misa-opening-btn-primary" onClick={() => handleSaveModal("Chi phí dở dang", false)}>Cất</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 10: CHI PHÍ TRẢ TRƯỚC ĐẦU KỲ                                        */}
      {/* ========================================================================= */}
      {activeModal === "prepaid" && (
        <div className="misa-opening-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="misa-opening-modal large" onClick={(e) => e.stopPropagation()}>
            <div className="misa-opening-modal-header">
              <h3 className="misa-opening-modal-title">Khai báo chi phí trả trước đầu kỳ</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <HelpCircle size={18} color="#64748b" style={{ cursor: "pointer" }} />
                <X size={18} color="#64748b" style={{ cursor: "pointer" }} onClick={() => setActiveModal(null)} />
              </div>
            </div>
            <div className="misa-opening-modal-body">
              <div className="misa-opening-form-row">
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Mã chi phí trả trước *</label>
                  <input type="text" className="misa-opening-input" defaultValue="CPTT-01" />
                </div>
                <div className="misa-opening-field" style={{ flex: 2 }}>
                  <label className="misa-opening-label">Tên chi phí trả trước *</label>
                  <input type="text" className="misa-opening-input" defaultValue="Tiền thuê văn phòng năm 2026" />
                </div>
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Số tiền *</label>
                  <input type="number" className="misa-opening-input" defaultValue={120000000} />
                </div>
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Số kỳ phân bổ (Tháng)</label>
                  <input type="number" className="misa-opening-input" defaultValue={12} />
                </div>
              </div>
            </div>
            <div className="misa-opening-modal-footer">
              <button type="button" className="misa-opening-btn-secondary" onClick={() => setActiveModal(null)}>Đóng</button>
              <button type="button" className="misa-opening-btn-primary" onClick={() => handleSaveModal("Chi phí trả trước", false)}>Cất và Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
