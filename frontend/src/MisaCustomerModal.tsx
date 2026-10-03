import React, { useState, useEffect } from "react";
import {
  X,
  HelpCircle,
  Search,
  Plus,
  ChevronDown,
  Calendar,
  Info,
} from "lucide-react";

export interface CustomerData {
  id?: string;
  code: string;
  name: string;
  taxCode?: string;
  address?: string;
  phone?: string;
  debt?: number;
  customerType?: "organization" | "individual";
  isSupplier?: boolean;
  dvqhnsCode?: string;
  website?: string;
  group?: string;
  salesperson?: string;
  isInternal?: boolean;
  // Individual fields
  idCardNo?: string;
  idCardDate?: string;
  idCardPlace?: string;
  salutation?: string;
  // Contact info
  contactName?: string;
  contactSalutation?: string;
  contactEmail?: string;
  contactPhone?: string;
  legalRepresentative?: string;
  // Electronic invoice recipient
  einvoiceRecipientName?: string;
  einvoiceRecipientEmail?: string;
  einvoiceRecipientPhone?: string;
  // Individual contact
  mobilePhone?: string;
  landlinePhone?: string;
  passportNo?: string;
  // Payment terms
  creditDays?: number;
  creditLimit?: number;
  arAccount?: string;
  notes?: string;
}

interface MisaCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customer: CustomerData, andAddNew?: boolean) => void;
  initialData?: Partial<CustomerData> | null;
  defaultCode?: string;
  notify?: (msg: string) => void;
}

export const MisaCustomerModal: React.FC<MisaCustomerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  defaultCode = "KH00001",
  notify = () => {},
}) => {
  // Mode: "organization" (Tổ chức) vs "individual" (Cá nhân)
  const [customerType, setCustomerType] = useState<"organization" | "individual">(
    initialData?.customerType || "organization"
  );
  const [isSupplier, setIsSupplier] = useState<boolean>(initialData?.isSupplier || false);

  // General fields
  const [code, setCode] = useState(initialData?.code || defaultCode);
  const [taxCode, setTaxCode] = useState(initialData?.taxCode || "");
  const [dvqhnsCode, setDvqhnsCode] = useState(initialData?.dvqhnsCode || "");
  const [phone, setPhone] = useState(initialData?.phone || "");
  const [website, setWebsite] = useState(initialData?.website || "");
  const [name, setName] = useState(initialData?.name || "");
  const [group, setGroup] = useState(initialData?.group || "");
  const [address, setAddress] = useState(initialData?.address || "");
  const [salesperson, setSalesperson] = useState(initialData?.salesperson || "");
  const [isInternal, setIsInternal] = useState(initialData?.isInternal || false);

  // Individual-specific fields
  const [idCardNo, setIdCardNo] = useState(initialData?.idCardNo || "");
  const [idCardDate, setIdCardDate] = useState(initialData?.idCardDate || "");
  const [idCardPlace, setIdCardPlace] = useState(initialData?.idCardPlace || "");
  const [salutation, setSalutation] = useState(initialData?.salutation || "Ông");

  // Lower tabs
  const [activeTab, setActiveTab] = useState<
    "contact" | "terms" | "bank" | "otherAddress" | "notes" | "extra"
  >("contact");

  // Contact info (Tổ chức)
  const [contactSalutation, setContactSalutation] = useState(initialData?.contactSalutation || "Ông");
  const [contactName, setContactName] = useState(initialData?.contactName || "");
  const [contactEmail, setContactEmail] = useState(initialData?.contactEmail || "");
  const [contactPhone, setContactPhone] = useState(initialData?.contactPhone || "");
  const [legalRepresentative, setLegalRepresentative] = useState(initialData?.legalRepresentative || "");

  // E-invoice recipient (Tổ chức)
  const [einvoiceRecipientName, setEinvoiceRecipientName] = useState(initialData?.einvoiceRecipientName || "");
  const [einvoiceRecipientEmail, setEinvoiceRecipientEmail] = useState(initialData?.einvoiceRecipientEmail || "");
  const [einvoiceRecipientPhone, setEinvoiceRecipientPhone] = useState(initialData?.einvoiceRecipientPhone || "");

  // Contact info (Cá nhân)
  const [mobilePhone, setMobilePhone] = useState(initialData?.mobilePhone || "");
  const [landlinePhone, setLandlinePhone] = useState(initialData?.landlinePhone || "");
  const [passportNo, setPassportNo] = useState(initialData?.passportNo || "");

  // Other tabs
  const [creditDays, setCreditDays] = useState(initialData?.creditDays || 30);
  const [creditLimit, setCreditLimit] = useState(initialData?.creditLimit || 50000000);
  const [arAccount, setArAccount] = useState(initialData?.arAccount || "131");
  const [notes, setNotes] = useState(initialData?.notes || "");

  useEffect(() => {
    if (initialData) {
      setCode(initialData.code || defaultCode);
      setName(initialData.name || "");
      setTaxCode(initialData.taxCode || "");
      setAddress(initialData.address || "");
      setPhone(initialData.phone || "");
      setCustomerType(initialData.customerType || "organization");
    } else {
      setCode(defaultCode);
    }
  }, [initialData, defaultCode]);

  if (!isOpen) return null;

  // Auto-fill mock helper on taxCode or CCCD search
  const handleTaxCodeLookup = () => {
    if (!taxCode && !idCardNo) {
      notify("Vui lòng nhập Mã số thuế hoặc CCCD để tra cứu tự động");
      return;
    }
    if (customerType === "organization") {
      setName("Công ty TNHH Đầu tư & Phát triển Công nghệ Tân Phát");
      setAddress("Tầng 5, Tòa nhà Keangnam Landmark 72, Đường Phạm Hùng, Phường Mễ Trì, Quận Nam Từ Liêm, Hà Nội");
      setWebsite("https://tanphat-tech.com.vn");
      setPhone("024.3789.9999");
      setDvqhnsCode("1029485");
      notify("Đã tra cứu thông tin doanh nghiệp tự động thành công từ Tổng cục Thuế!");
    } else {
      setName("Nguyễn Hoàng Nam");
      setIdCardDate("15/06/2021");
      setIdCardPlace("Cục Cảnh sát QLHC về TTXH");
      setAddress("Số 45 Đại Cồ Việt, Phường Lê Đại Hành, Quận Hai Bà Trưng, Hà Nội");
      setTaxCode("8492019485");
      notify("Đã tra cứu thông tin CCCD định danh tự động thành công!");
    }
  };

  const handleSaveInternal = (andAddNew: boolean = false) => {
    if (!name.trim()) {
      notify("Vui lòng nhập Tên khách hàng!");
      return;
    }
    const customer: CustomerData = {
      id: initialData?.id || `kh-${Date.now()}`,
      code: code || defaultCode,
      name,
      taxCode,
      address,
      phone: customerType === "organization" ? phone : mobilePhone || phone,
      debt: initialData?.debt || 0,
      customerType,
      isSupplier,
      dvqhnsCode,
      website,
      group,
      salesperson,
      isInternal,
      idCardNo,
      idCardDate,
      idCardPlace,
      salutation,
      contactName,
      contactSalutation,
      contactEmail,
      contactPhone,
      legalRepresentative,
      einvoiceRecipientName,
      einvoiceRecipientEmail,
      einvoiceRecipientPhone,
      mobilePhone,
      landlinePhone,
      passportNo,
      creditDays,
      creditLimit,
      arAccount,
      notes,
    };

    onSave(customer, andAddNew);
    notify(`Đã lưu khách hàng "${name}" thành công!`);

    if (andAddNew) {
      // Reset form for next entry
      const nextNum = parseInt(code.replace(/\D/g, "") || "1", 10) + 1;
      const nextCode = `KH${String(nextNum).padStart(5, "0")}`;
      setCode(nextCode);
      setName("");
      setTaxCode("");
      setAddress("");
      setPhone("");
      setDvqhnsCode("");
      setWebsite("");
      setIdCardNo("");
      setIdCardDate("");
      setIdCardPlace("");
      setContactName("");
      setContactEmail("");
      setContactPhone("");
      setEinvoiceRecipientName("");
      setEinvoiceRecipientEmail("");
      setEinvoiceRecipientPhone("");
      setMobilePhone("");
      setLandlinePhone("");
      setPassportNo("");
    } else {
      onClose();
    }
  };

  return (
    <div
      className="misa-modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        className="misa-customer-modal-window"
        style={{
          background: "#ffffff",
          borderRadius: 8,
          width: 920,
          maxWidth: "96vw",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.25)",
          border: "1px solid #cbd5e1",
          overflow: "hidden",
        }}
      >
        {/* ================================================================= */}
        {/* HEADER                                                            */}
        {/* ================================================================= */}
        <div
          style={{
            padding: "12px 20px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#ffffff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: "#1e293b",
              }}
            >
              Thông tin khách hàng
            </h2>

            {/* Type selector: Tổ chức vs Cá nhân, Checkbox Là nhà cung cấp */}
            <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 13 }}>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  color: customerType === "organization" ? "#00a862" : "#334155",
                  fontWeight: customerType === "organization" ? 600 : 400,
                }}
              >
                <input
                  type="radio"
                  name="customerType"
                  checked={customerType === "organization"}
                  onChange={() => setCustomerType("organization")}
                  style={{ accentColor: "#00a862", cursor: "pointer" }}
                />
                <span>Tổ chức</span>
              </label>

              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  color: customerType === "individual" ? "#00a862" : "#334155",
                  fontWeight: customerType === "individual" ? 600 : 400,
                }}
              >
                <input
                  type="radio"
                  name="customerType"
                  checked={customerType === "individual"}
                  onChange={() => setCustomerType("individual")}
                  style={{ accentColor: "#00a862", cursor: "pointer" }}
                />
                <span>Cá nhân</span>
              </label>

              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  color: "#334155",
                  marginLeft: 6,
                }}
              >
                <input
                  type="checkbox"
                  checked={isSupplier}
                  onChange={(e) => setIsSupplier(e.target.checked)}
                  style={{ accentColor: "#00a862", cursor: "pointer" }}
                />
                <span>Là nhà cung cấp</span>
              </label>
            </div>
          </div>

          {/* Action buttons: Help & Close */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => notify("Hướng dẫn thêm mới Khách hàng theo chuẩn MISA AMIS")}
              title="Hướng dẫn sử dụng"
              style={{
                background: "transparent",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: 4,
                display: "grid",
                placeItems: "center",
              }}
            >
              <HelpCircle size={18} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Đóng (Esc)"
              style={{
                background: "transparent",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: 4,
                display: "grid",
                placeItems: "center",
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* BODY                                                              */}
        {/* ================================================================= */}
        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
          {/* --------------------------------------------------------------- */}
          {/* UPPER FORM SECTION: TỔ CHỨC (SCREENSHOT 1)                       */}
          {/* --------------------------------------------------------------- */}
          {customerType === "organization" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Row 1: MST (search), Mã ĐVQHNS, Mã KH *, Điện thoại, Website */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 0.9fr 0.9fr 1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                    Mã số thuế/CCCD chủ hộ
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      padding: "0 8px",
                      height: 30,
                      background: "#ffffff",
                    }}
                  >
                    <input
                      type="text"
                      value={taxCode}
                      onChange={(e) => setTaxCode(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleTaxCodeLookup()}
                      placeholder=""
                      style={{
                        border: "none",
                        outline: "none",
                        width: "100%",
                        height: "100%",
                        fontSize: 12.5,
                        background: "transparent",
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleTaxCodeLookup}
                      title="Bấm để tra cứu thông tin tự động theo Mã số thuế"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#00a862",
                        padding: 0,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <Search size={14} />
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                    Mã số ĐVQHNS
                  </label>
                  <input
                    type="text"
                    value={dvqhnsCode}
                    onChange={(e) => setDvqhnsCode(e.target.value)}
                    style={{
                      width: "100%",
                      height: 30,
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12.5,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                    Mã khách hàng <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    style={{
                      width: "100%",
                      height: 30,
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12.5,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                    Điện thoại
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{
                      width: "100%",
                      height: 30,
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12.5,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                    Website
                  </label>
                  <input
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    style={{
                      width: "100%",
                      height: 30,
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12.5,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Row 2: Tên khách hàng * (span left), Nhóm khách hàng (span right) */}
              <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                    Tên khách hàng <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                      width: "100%",
                      height: 30,
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12.5,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                    Nhóm khách hàng
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <select
                      value={group}
                      onChange={(e) => setGroup(e.target.value)}
                      style={{
                        flex: 1,
                        height: 30,
                        padding: "0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        outline: "none",
                        appearance: "none",
                        WebkitAppearance: "none",
                        background: "#ffffff",
                      }}
                    >
                      <option value="">-- Chọn nhóm khách hàng --</option>
                      <option value="VIP">Khách hàng VIP</option>
                      <option value="Đại lý">Khách hàng đại lý</option>
                      <option value="Khách lẻ">Khách lẻ</option>
                      <option value="Xuất khẩu">Khách hàng xuất khẩu</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => notify("Thêm nhanh nhóm khách hàng")}
                      title="Thêm nhóm khách hàng"
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#00a862",
                        display: "grid",
                        placeItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#64748b",
                        display: "grid",
                        placeItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 3: Địa chỉ (textarea), Nhân viên bán hàng + Là đối tượng nội bộ */}
              <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                    Địa chỉ
                  </label>
                  <textarea
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="VD: Số 82 Duy Tân, Dịch Vọng Hậu, Cầu Giấy, Hà Nội"
                    style={{
                      width: "100%",
                      height: 58,
                      padding: "6px 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12.5,
                      boxSizing: "border-box",
                      outline: "none",
                      resize: "none",
                    }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                      Nhân viên bán hàng
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <select
                        value={salesperson}
                        onChange={(e) => setSalesperson(e.target.value)}
                        style={{
                          flex: 1,
                          height: 30,
                          padding: "0 8px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 12.5,
                          outline: "none",
                          appearance: "none",
                          WebkitAppearance: "none",
                          background: "#ffffff",
                        }}
                      >
                        <option value="">-- Chọn nhân viên bán hàng --</option>
                        <option value="NV01">NV01 - Nguyễn Văn An</option>
                        <option value="NV02">NV02 - Trần Thị Bình</option>
                        <option value="NV03">NV03 - Lê Hoàng Nam</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => notify("Thêm nhanh nhân viên bán hàng")}
                        title="Thêm nhân viên bán hàng"
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 4,
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          color: "#00a862",
                          display: "grid",
                          placeItems: "center",
                          cursor: "pointer",
                        }}
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        type="button"
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 4,
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          color: "#64748b",
                          display: "grid",
                          placeItems: "center",
                          cursor: "pointer",
                        }}
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <label
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        cursor: "pointer",
                        fontSize: 12.5,
                        color: "#334155",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        style={{ accentColor: "#00a862", cursor: "pointer" }}
                      />
                      <span>Là Đối tượng nội bộ</span>
                    </label>
                    <Info size={14} style={{ color: "#0284c7", cursor: "pointer" }} title="Đối tượng nội bộ thuộc cùng công ty/tập đoàn" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* UPPER FORM SECTION: CÁ NHÂN (SCREENSHOT 2)                        */}
          {/* --------------------------------------------------------------- */}
          {customerType === "individual" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Row 1: Số CCCD (search), Ngày cấp, Nơi cấp, Nhóm khách hàng */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 0.9fr 0.9fr 2fr",
                  gap: 12,
                }}
              >
                <div>
                  <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                    Số CCCD
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      padding: "0 8px",
                      height: 30,
                      background: "#ffffff",
                    }}
                  >
                    <input
                      type="text"
                      value={idCardNo}
                      onChange={(e) => setIdCardNo(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleTaxCodeLookup()}
                      placeholder=""
                      style={{
                        border: "none",
                        outline: "none",
                        width: "100%",
                        height: "100%",
                        fontSize: 12.5,
                        background: "transparent",
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleTaxCodeLookup}
                      title="Bấm để tra cứu thông tin tự động theo số CCCD"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#00a862",
                        padding: 0,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <Search size={14} />
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                    Ngày cấp
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      padding: "0 8px",
                      height: 30,
                      background: "#ffffff",
                    }}
                  >
                    <input
                      type="text"
                      value={idCardDate}
                      onChange={(e) => setIdCardDate(e.target.value)}
                      placeholder="DD/MM/YYYY"
                      style={{
                        border: "none",
                        outline: "none",
                        width: "100%",
                        fontSize: 12,
                        background: "transparent",
                      }}
                    />
                    <Calendar size={13} style={{ color: "#94a3b8" }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                    Nơi cấp
                  </label>
                  <input
                    type="text"
                    value={idCardPlace}
                    onChange={(e) => setIdCardPlace(e.target.value)}
                    style={{
                      width: "100%",
                      height: 30,
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12.5,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                    Nhóm khách hàng
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <select
                      value={group}
                      onChange={(e) => setGroup(e.target.value)}
                      style={{
                        flex: 1,
                        height: 30,
                        padding: "0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        outline: "none",
                        appearance: "none",
                        WebkitAppearance: "none",
                        background: "#ffffff",
                      }}
                    >
                      <option value="">-- Chọn nhóm khách hàng --</option>
                      <option value="VIP">Khách hàng VIP</option>
                      <option value="Đại lý">Khách hàng đại lý</option>
                      <option value="Khách lẻ">Khách lẻ</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => notify("Thêm nhanh nhóm khách hàng")}
                      title="Thêm nhóm khách hàng"
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#00a862",
                        display: "grid",
                        placeItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#64748b",
                        display: "grid",
                        placeItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2: Mã khách hàng *, Mã số thuế, Nhân viên bán hàng */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.5fr 1.5fr 2fr",
                  gap: 12,
                }}
              >
                <div>
                  <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                    Mã khách hàng <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    style={{
                      width: "100%",
                      height: 30,
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12.5,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                    Mã số thuế
                  </label>
                  <input
                    type="text"
                    value={taxCode}
                    onChange={(e) => setTaxCode(e.target.value)}
                    style={{
                      width: "100%",
                      height: 30,
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12.5,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                    Nhân viên bán hàng
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <select
                      value={salesperson}
                      onChange={(e) => setSalesperson(e.target.value)}
                      style={{
                        flex: 1,
                        height: 30,
                        padding: "0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        outline: "none",
                        background: "#ffffff",
                      }}
                    >
                      <option value="">-- Chọn nhân viên bán hàng --</option>
                      <option value="NV01">NV01 - Nguyễn Văn An</option>
                      <option value="NV02">NV02 - Trần Thị Bình</option>
                      <option value="NV03">NV03 - Lê Hoàng Nam</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => notify("Thêm nhanh nhân viên bán hàng")}
                      title="Thêm nhân viên bán hàng"
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#00a862",
                        display: "grid",
                        placeItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#64748b",
                        display: "grid",
                        placeItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 3: Tên khách hàng * ([Xưng hô] + [Họ và tên]), [ ] Là Đối tượng nội bộ (?) */}
              <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 12, alignItems: "center" }}>
                <div>
                  <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                    Tên khách hàng <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <select
                      value={salutation}
                      onChange={(e) => setSalutation(e.target.value)}
                      style={{
                        width: 90,
                        height: 30,
                        padding: "0 6px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        outline: "none",
                        background: "#ffffff",
                      }}
                    >
                      <option value="Ông">Ông</option>
                      <option value="Bà">Bà</option>
                      <option value="Anh">Anh</option>
                      <option value="Chị">Chị</option>
                    </select>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Họ và tên"
                      style={{
                        flex: 1,
                        height: 30,
                        padding: "0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        boxSizing: "border-box",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 18 }}>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                      fontSize: 12.5,
                      color: "#334155",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      style={{ accentColor: "#00a862", cursor: "pointer" }}
                    />
                    <span>Là Đối tượng nội bộ</span>
                  </label>
                  <Info size={14} style={{ color: "#0284c7", cursor: "pointer" }} title="Đối tượng nội bộ thuộc cùng công ty/tập đoàn" />
                </div>
              </div>

              {/* Row 4: Địa chỉ */}
              <div>
                <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                  Địa chỉ
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="VD: Số 82 Duy Tân, Dịch Vọng Hậu, Cầu Giấy, Hà Nội"
                  style={{
                    width: "100%",
                    height: 58,
                    padding: "6px 8px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12.5,
                    boxSizing: "border-box",
                    outline: "none",
                    resize: "none",
                  }}
                />
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* LOWER SECTION: SUB-TABS NAVIGATION                              */}
          {/* --------------------------------------------------------------- */}
          <div
            style={{
              borderBottom: "1px solid #e2e8f0",
              marginTop: 16,
              display: "flex",
              gap: 20,
            }}
          >
            {[
              { id: "contact", label: "Thông tin liên hệ" },
              { id: "terms", label: "Điều khoản thanh toán" },
              { id: "bank", label: "Tài khoản ngân hàng" },
              { id: "otherAddress", label: "Địa chỉ khác" },
              { id: "notes", label: "Ghi chú" },
              { id: "extra", label: "Thông tin bổ sung" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as any)}
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: activeTab === t.id ? "2.5px solid #00a862" : "2.5px solid transparent",
                  color: activeTab === t.id ? "#00a862" : "#475569",
                  fontWeight: activeTab === t.id ? 600 : 500,
                  fontSize: 13,
                  padding: "8px 2px",
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* --------------------------------------------------------------- */}
          {/* TAB 1: THÔNG TIN LIÊN HỆ                                         */}
          {/* --------------------------------------------------------------- */}
          {activeTab === "contact" && (
            <div style={{ marginTop: 14 }}>
              {customerType === "organization" ? (
                /* Screenshot 1 layout: 2 columns (Người liên hệ vs Người nhận HĐĐT) */
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  {/* Left Column: Người liên hệ */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                        Người liên hệ
                      </label>
                      <div style={{ display: "flex", gap: 6 }}>
                        <select
                          value={contactSalutation}
                          onChange={(e) => setContactSalutation(e.target.value)}
                          style={{
                            width: 90,
                            height: 30,
                            padding: "0 6px",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            fontSize: 12.5,
                            outline: "none",
                            background: "#ffffff",
                          }}
                        >
                          <option value="Ông">Ông</option>
                          <option value="Bà">Bà</option>
                          <option value="Anh">Anh</option>
                          <option value="Chị">Chị</option>
                        </select>
                        <input
                          type="text"
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="Họ và tên"
                          style={{
                            flex: 1,
                            height: 30,
                            padding: "0 8px",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            fontSize: 12.5,
                            boxSizing: "border-box",
                            outline: "none",
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="Email"
                        style={{
                          width: "100%",
                          height: 30,
                          padding: "0 8px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 12.5,
                          boxSizing: "border-box",
                          outline: "none",
                        }}
                      />
                    </div>

                    <div>
                      <input
                        type="text"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="Số điện thoại"
                        style={{
                          width: "100%",
                          height: 30,
                          padding: "0 8px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 12.5,
                          boxSizing: "border-box",
                          outline: "none",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                        Đại diện theo PL
                      </label>
                      <input
                        type="text"
                        value={legalRepresentative}
                        onChange={(e) => setLegalRepresentative(e.target.value)}
                        placeholder="Đại diện theo PL"
                        style={{
                          width: "100%",
                          height: 30,
                          padding: "0 8px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 12.5,
                          boxSizing: "border-box",
                          outline: "none",
                        }}
                      />
                    </div>
                  </div>

                  {/* Right Column: Người nhận hóa đơn điện tử */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                        Người nhận hóa đơn điện tử
                      </label>
                      <input
                        type="text"
                        value={einvoiceRecipientName}
                        onChange={(e) => setEinvoiceRecipientName(e.target.value)}
                        placeholder="Họ và tên"
                        style={{
                          width: "100%",
                          height: 30,
                          padding: "0 8px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 12.5,
                          boxSizing: "border-box",
                          outline: "none",
                        }}
                      />
                    </div>

                    <div>
                      <input
                        type="text"
                        value={einvoiceRecipientEmail}
                        onChange={(e) => setEinvoiceRecipientEmail(e.target.value)}
                        placeholder='Email (Ngăn cách nhiều email bởi dấu ";")'
                        style={{
                          width: "100%",
                          height: 30,
                          padding: "0 8px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 12.5,
                          boxSizing: "border-box",
                          outline: "none",
                        }}
                      />
                    </div>

                    <div>
                      <input
                        type="text"
                        value={einvoiceRecipientPhone}
                        onChange={(e) => setEinvoiceRecipientPhone(e.target.value)}
                        placeholder="Số điện thoại"
                        style={{
                          width: "100%",
                          height: 30,
                          padding: "0 8px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 12.5,
                          boxSizing: "border-box",
                          outline: "none",
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* Screenshot 2 layout: Cá nhân (Thông tin liên hệ, Đại diện theo PL vs Số hộ chiếu) */
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                        Thông tin liên hệ
                      </label>
                      <input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="Email"
                        style={{
                          width: "100%",
                          height: 30,
                          padding: "0 8px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 12.5,
                          boxSizing: "border-box",
                          outline: "none",
                          marginBottom: 8,
                        }}
                      />
                      <input
                        type="text"
                        value={mobilePhone}
                        onChange={(e) => setMobilePhone(e.target.value)}
                        placeholder="Điện thoại di động"
                        style={{
                          width: "100%",
                          height: 30,
                          padding: "0 8px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 12.5,
                          boxSizing: "border-box",
                          outline: "none",
                          marginBottom: 8,
                        }}
                      />
                      <input
                        type="text"
                        value={landlinePhone}
                        onChange={(e) => setLandlinePhone(e.target.value)}
                        placeholder="Điện thoại cố định"
                        style={{
                          width: "100%",
                          height: 30,
                          padding: "0 8px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 12.5,
                          boxSizing: "border-box",
                          outline: "none",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                        Đại diện theo PL
                      </label>
                      <input
                        type="text"
                        value={legalRepresentative}
                        onChange={(e) => setLegalRepresentative(e.target.value)}
                        placeholder="Đại diện theo PL"
                        style={{
                          width: "100%",
                          height: 30,
                          padding: "0 8px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 12.5,
                          boxSizing: "border-box",
                          outline: "none",
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                        Số hộ chiếu
                      </label>
                      <input
                        type="text"
                        value={passportNo}
                        onChange={(e) => setPassportNo(e.target.value)}
                        placeholder=""
                        style={{
                          width: "100%",
                          height: 30,
                          padding: "0 8px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 12.5,
                          boxSizing: "border-box",
                          outline: "none",
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* TAB 2: ĐIỀU KHOẢN THANH TOÁN                                    */}
          {/* --------------------------------------------------------------- */}
          {activeTab === "terms" && (
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                  Số ngày được nợ
                </label>
                <input
                  type="number"
                  value={creditDays}
                  onChange={(e) => setCreditDays(Number(e.target.value))}
                  style={{
                    width: "100%",
                    height: 30,
                    padding: "0 8px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12.5,
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                  Hạn mức nợ (VND)
                </label>
                <input
                  type="number"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(Number(e.target.value))}
                  style={{
                    width: "100%",
                    height: 30,
                    padding: "0 8px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12.5,
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                  Tài khoản công nợ
                </label>
                <input
                  type="text"
                  value={arAccount}
                  onChange={(e) => setArAccount(e.target.value)}
                  style={{
                    width: "100%",
                    height: 30,
                    padding: "0 8px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12.5,
                    outline: "none",
                  }}
                />
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* TAB 3: TÀI KHOẢN NGÂN HÀNG                                      */}
          {/* --------------------------------------------------------------- */}
          {activeTab === "bank" && (
            <div style={{ marginTop: 14 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, border: "1px solid #cbd5e1" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
                    <th style={{ padding: "6px 10px", textAlign: "left" }}>Số tài khoản</th>
                    <th style={{ padding: "6px 10px", textAlign: "left" }}>Tên ngân hàng</th>
                    <th style={{ padding: "6px 10px", textAlign: "left" }}>Chi nhánh</th>
                    <th style={{ padding: "6px 10px", textAlign: "left" }}>Tỉnh/Thành phố</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: 6 }}>
                      <input placeholder="Nhập số tài khoản..." style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 6px" }} />
                    </td>
                    <td style={{ padding: 6 }}>
                      <input placeholder="Tên ngân hàng (Vietcombank, MB...)" style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 6px" }} />
                    </td>
                    <td style={{ padding: 6 }}>
                      <input placeholder="Chi nhánh" style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 6px" }} />
                    </td>
                    <td style={{ padding: 6 }}>
                      <input placeholder="Tỉnh/Thành phố" style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 6px" }} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* TAB 4: ĐỊA CHỈ KHÁC                                             */}
          {/* --------------------------------------------------------------- */}
          {activeTab === "otherAddress" && (
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                Địa chỉ giao hàng
              </label>
              <textarea
                rows={3}
                placeholder="Nhập địa chỉ nhận hàng/kho hàng nếu khác địa chỉ xuất hóa đơn..."
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 12.5,
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* TAB 5: GHI CHÚ                                                  */}
          {/* --------------------------------------------------------------- */}
          {activeTab === "notes" && (
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                Ghi chú nội bộ
              </label>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ghi chú về khách hàng này..."
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 12.5,
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* TAB 6: THÔNG TIN BỔ SUNG                                        */}
          {/* --------------------------------------------------------------- */}
          {activeTab === "extra" && (
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                  Kênh phân phối
                </label>
                <input
                  type="text"
                  placeholder="Kênh bán buôn / bán lẻ / thương mại điện tử..."
                  style={{
                    width: "100%",
                    height: 30,
                    padding: "0 8px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12.5,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
                  Phân khúc thị trường
                </label>
                <input
                  type="text"
                  placeholder="Thị trường Miền Bắc / Miền Trung / Miền Nam..."
                  style={{
                    width: "100%",
                    height: 30,
                    padding: "0 8px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12.5,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* FOOTER                                                            */}
        {/* ================================================================= */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 10,
            background: "#ffffff",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 32,
              padding: "0 18px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              fontSize: 13,
              color: "#334155",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={() => handleSaveInternal(false)}
            style={{
              height: 32,
              padding: "0 20px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              fontSize: 13,
              color: "#334155",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Cất
          </button>

          <button
            type="button"
            onClick={() => handleSaveInternal(true)}
            style={{
              height: 32,
              padding: "0 20px",
              border: "none",
              background: "#00a862",
              borderRadius: 4,
              fontSize: 13,
              color: "#ffffff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cất và Thêm
          </button>
        </div>
      </div>
    </div>
  );
};

export default MisaCustomerModal;
