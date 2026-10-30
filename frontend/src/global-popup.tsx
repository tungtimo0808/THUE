import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

export type GlobalPopupType = "error" | "success" | "warning" | "info";

export interface GlobalPopupPayload {
  id?: string;
  type: GlobalPopupType;
  title?: string;
  message: string;
  autoCloseMs?: number;
}

const FIELD_LABELS_VI: Record<string, string> = {
  tax_code: "Mã số thuế",
  company: "Doanh nghiệp",
  company_id: "Doanh nghiệp",
  name: "Tên",
  legal_name: "Tên pháp lý doanh nghiệp",
  short_name: "Tên viết tắt",
  code: "Mã",
  address: "Địa chỉ",
  province: "Tỉnh/Thành phố",
  legal_representative: "Người đại diện theo pháp luật",
  representative_title: "Chức danh người đại diện",
  phone: "Số điện thoại",
  phone_number: "Số điện thoại",
  email: "Địa chỉ Email",
  username: "Tên đăng nhập",
  password: "Mật khẩu",
  password_confirm: "Xác nhận mật khẩu",
  confirm_password: "Xác nhận mật khẩu",
  current_password: "Mật khẩu hiện tại",
  new_password: "Mật khẩu mới",
  fiscal_period: "Kỳ kế toán",
  fiscal_period_id: "Kỳ kế toán",
  accounting_period: "Kỳ kế toán",
  accounting_period_id: "Kỳ kế toán",
  fiscal_year: "Năm tài chính",
  fiscal_year_id: "Năm tài chính",
  posting_date: "Ngày hạch toán",
  voucher_date: "Ngày chứng từ",
  document_date: "Ngày chứng từ",
  issue_date: "Ngày lập",
  due_date: "Hạn thanh toán",
  amount: "Số tiền",
  total_amount: "Tổng tiền",
  debit_account: "Tài khoản Nợ",
  credit_account: "Tài khoản Có",
  account: "Tài khoản kế toán",
  account_id: "Tài khoản kế toán",
  gl_account: "Tài khoản sổ cái",
  cash_account: "Tài khoản tiền mặt",
  bank_account: "Tài khoản ngân hàng",
  fund: "Quỹ tiền mặt",
  customer: "Khách hàng",
  customer_id: "Khách hàng",
  vendor: "Nhà cung cấp",
  vendor_id: "Nhà cung cấp",
  supplier: "Nhà cung cấp",
  employee: "Nhân viên",
  employee_id: "Nhân viên",
  warehouse: "Kho hàng",
  warehouse_id: "Kho hàng",
  item: "Vật tư / Hàng hóa",
  item_id: "Vật tư / Hàng hóa",
  product: "Sản phẩm / Hàng hóa",
  quantity: "Số lượng",
  unit_price: "Đơn giá",
  uom: "Đơn vị tính",
  currency: "Loại tiền",
  exchange_rate: "Tỷ giá",
  description: "Diễn giải",
  reason: "Lý do",
  lines: "Chi tiết dòng hạch toán",
  items: "Danh sách hàng hóa",
  role: "Vai trò",
  role_code: "Vai trò",
  status: "Trạng thái",
  version: "Phiên bản dữ liệu",
};

const IGNORED_META_KEYS = new Set([
  "code",
  "error_code",
  "status_code",
  "http_status",
  "type",
  "error_type",
]);

function cleanSingleMessage(rawText: string, fieldKey?: string): string {
  let text = String(rawText || "").trim();
  if (!text) return "";

  // Strip trailing `; code: SOME_CODE` or `code: SOME_CODE`
  text = text.replace(/;\s*code\s*:\s*[A-Z0-9_.-]+/gi, "").trim();
  text = text.replace(/\bcode\s*:\s*[A-Z0-9_.-]+/gi, "").trim();

  // Strip internal specification codes like `(EF-05)`, `(BR-COM-REG-01)`, `(BR04)`
  text = text.replace(/\s*\((?:EF|BR|AF|UC)-[A-Z0-9_-]+\)/gi, "").trim();
  text = text.replace(/\s*\((?:EF|BR|AF)\d+\)/gi, "").trim();

  // Strip leading technical field prefix if already present in string, e.g. `tax_code: Mã số thuế...`
  const prefixMatch = text.match(/^([a-z_][a-z0-9_.]*)\s*:\s*(.+)$/i);
  if (prefixMatch) {
    const detectedField = prefixMatch[1].toLowerCase();
    const rest = prefixMatch[2].trim();
    if (!fieldKey) fieldKey = detectedField;
    text = rest;
  }

  // Translate common English DRF/validation messages to natural Vietnamese
  const lower = text.toLowerCase();
  const fieldLabel = fieldKey ? FIELD_LABELS_VI[fieldKey.toLowerCase()] || "" : "";

  if (
    lower === "this field is required." ||
    lower === "this field may not be blank." ||
    lower === "this field may not be null." ||
    lower === "trường này là bắt buộc." ||
    lower === "không được để trống."
  ) {
    return fieldLabel
      ? `Vui lòng nhập thông tin bắt buộc: ${fieldLabel}.`
      : "Vui lòng nhập đầy đủ các thông tin bắt buộc.";
  }

  if (lower.includes("invalid pk") || lower.includes("object does not exist") || lower.includes("does not exist")) {
    return fieldLabel
      ? `${fieldLabel} được chọn không tồn tại hoặc không hợp lệ.`
      : "Dữ liệu tham chiếu không tồn tại hoặc đã bị xóa.";
  }

  if (lower.includes("already exists") || lower.includes("unique") || lower.includes("duplicate key")) {
    return fieldLabel
      ? `${fieldLabel} này đã tồn tại trên hệ thống. Vui lòng kiểm tra lại.`
      : "Dữ liệu bị trùng mã hoặc đã tồn tại trên hệ thống.";
  }

  // Make tax_code message extra clear for users
  if (text === "Mã số thuế không đúng định dạng." || text === "Mã số thuế không đúng định dạng") {
    return "Mã số thuế không đúng định dạng. Vui lòng nhập đúng 10 chữ số (hoặc 13 chữ số đối với chi nhánh, ví dụ: 0101234567).";
  }

  // If the message is already a clear Vietnamese sentence, DO NOT prepend raw `field_key:`!
  // Only prepend the friendly Vietnamese label if the message is very short/ambiguous and doesn't already mention the label.
  if (
    fieldLabel &&
    fieldKey &&
    !["detail", "message", "error", "non_field_errors", "__all__"].includes(fieldKey.toLowerCase()) &&
    !text.toLowerCase().includes(fieldLabel.toLowerCase()) &&
    text.length < 35
  ) {
    return `${fieldLabel}: ${text}`;
  }

  return text;
}

export function humanizeErrorMessage(body: unknown, status?: number): string {
  if (!body) {
    if (status === 401) return "Tài khoản hoặc mật khẩu không chính xác, hoặc phiên đăng nhập đã hết hạn.";
    if (status === 403) return "Bạn không có quyền thực hiện thao tác này trên doanh nghiệp hiện tại.";
    if (status === 404) return "Không tìm thấy dữ liệu hoặc chức năng yêu cầu.";
    if (status && status >= 500) return "Hệ thống máy chủ đang bận hoặc gặp sự cố tạm thời. Vui lòng thử lại sau giây lát.";
    return "Không thể thực hiện yêu cầu. Vui lòng kiểm tra lại thông tin đã nhập.";
  }

  if (typeof body === "string") {
    const parts = body
      .split(/;\s+/)
      .map((part) => cleanSingleMessage(part))
      .filter(Boolean);
    return parts.join("\n") || "Đã xảy ra lỗi khi xử lý yêu cầu.";
  }

  if (Array.isArray(body)) {
    const parts = body
      .map((item) => (typeof item === "string" ? cleanSingleMessage(item) : humanizeErrorMessage(item)))
      .filter(Boolean);
    return Array.from(new Set(parts)).join("\n") || "Dữ liệu không hợp lệ.";
  }

  if (typeof body === "object") {
    const obj = body as Record<string, unknown>;

    // Priority 1: explicit detail / message / error string
    for (const mainKey of ["detail", "message", "error", "non_field_errors", "__all__"]) {
      if (obj[mainKey]) {
        const extracted = Array.isArray(obj[mainKey])
          ? (obj[mainKey] as unknown[]).map((x) => cleanSingleMessage(String(x), mainKey)).filter(Boolean).join("\n")
          : typeof obj[mainKey] === "string"
          ? cleanSingleMessage(obj[mainKey] as string, mainKey)
          : "";
        if (extracted) return extracted;
      }
    }

    // Priority 2: nested `errors` dictionary or array
    if (obj.errors && typeof obj.errors === "object") {
      const nested = humanizeErrorMessage(obj.errors, status);
      if (nested) return nested;
    }

    // Priority 3: field-level validation messages
    const messages: string[] = [];
    for (const [field, value] of Object.entries(obj)) {
      if (IGNORED_META_KEYS.has(field.toLowerCase())) continue;
      if (value === null || value === undefined || value === "") continue;

      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "string" || typeof item === "number") {
            const cleaned = cleanSingleMessage(String(item), field);
            if (cleaned) messages.push(cleaned);
          } else if (typeof item === "object" && item !== null) {
            const nested = humanizeErrorMessage(item, status);
            if (nested) messages.push(nested);
          }
        }
      } else if (typeof value === "object") {
        const nested = humanizeErrorMessage(value, status);
        if (nested) messages.push(nested);
      } else {
        const cleaned = cleanSingleMessage(String(value), field);
        if (cleaned) messages.push(cleaned);
      }
    }

    const unique = Array.from(new Set(messages.filter(Boolean)));
    if (unique.length > 0) {
      return unique.join("\n");
    }
  }

  return "Không thể hoàn tất thao tác. Vui lòng kiểm tra lại dữ liệu đã nhập.";
}

const POPUP_EVENT_NAME = "soviet_global_popup_event";
let lastPopupSignature = "";
let lastPopupTime = 0;

export function showGlobalPopup(payload: GlobalPopupPayload) {
  if (typeof window === "undefined") return;
  const cleanMsg = humanizeErrorMessage(payload.message);
  if (!cleanMsg) return;

  const now = Date.now();
  const sig = `${payload.type}::${cleanMsg}`;
  if (sig === lastPopupSignature && now - lastPopupTime < 1200) {
    return;
  }
  lastPopupSignature = sig;
  lastPopupTime = now;

  const event = new CustomEvent<GlobalPopupPayload>(POPUP_EVENT_NAME, {
    detail: {
      ...payload,
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
      message: cleanMsg,
    },
  });
  window.dispatchEvent(event);
}

export function classifyNoticeType(message: string): GlobalPopupType {
  const lower = message.toLowerCase();
  if (
    lower.startsWith("không ") ||
    lower.startsWith("chưa ") ||
    lower.startsWith("chỉ ") ||
    lower.includes("lỗi") ||
    lower.includes("không thể") ||
    lower.includes("không được") ||
    lower.includes("không thực hiện") ||
    lower.includes("không tải") ||
    lower.includes("không lưu") ||
    lower.includes("không xóa") ||
    lower.includes("không hủy") ||
    lower.includes("không đủ") ||
    lower.includes("không có quyền") ||
    lower.includes("không tìm thấy") ||
    lower.includes("thất bại") ||
    lower.includes("không đúng") ||
    lower.includes("không hợp lệ") ||
    lower.includes("không tồn tại") ||
    lower.includes("từ chối") ||
    lower.includes("bị khóa") ||
    lower.includes("vượt quá") ||
    lower.includes("chưa cân") ||
    lower.includes("chưa được") ||
    lower.includes("chưa duyệt") ||
    lower.includes("chưa hỗ trợ") ||
    lower.includes("không khớp") ||
    lower.includes("bắt buộc") ||
    lower.includes("phải đảo") ||
    lower.includes("vui lòng nhập") ||
    lower.includes("vui lòng chọn") ||
    lower.includes("cần chọn") ||
    lower.includes("thiếu")
  ) {
    return "error";
  }
  if (lower.includes("cảnh báo") || lower.includes("lưu ý") || lower.includes("chú ý")) {
    return "warning";
  }
  return "success";
}

export function GlobalFeedbackPopupHost() {
  const [popup, setPopup] = useState<GlobalPopupPayload | null>(null);
  const cardRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<GlobalPopupPayload>;
      if (custom.detail && custom.detail.message) {
        setPopup(custom.detail);
      }
    };
    window.addEventListener(POPUP_EVENT_NAME, handler);
    return () => window.removeEventListener(POPUP_EVENT_NAME, handler);
  }, []);

  useEffect(() => {
    if (!popup) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPopup(null);
      }
    };
    const handlePointerDownOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setPopup(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDownOutside, true);

    const duration =
      popup.autoCloseMs ??
      (popup.type === "success" || popup.type === "info" ? 3500 : 6500);
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (duration > 0) {
      timer = setTimeout(() => {
        setPopup(null);
      }, duration);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDownOutside, true);
      if (timer) clearTimeout(timer);
    };
  }, [popup]);

  if (!popup) return null;

  const isError = popup.type === "error";
  const isWarning = popup.type === "warning";
  const isSuccess = popup.type === "success";

  const accentColor = isError
    ? "#dc2626"
    : isWarning
    ? "#d97706"
    : isSuccess
    ? "#059669"
    : "#0284c7";

  const lightBg = isError
    ? "#fef2f2"
    : isWarning
    ? "#fffbeb"
    : isSuccess
    ? "#ecfdf5"
    : "#f0f9ff";

  const borderColor = isError
    ? "#fecaca"
    : isWarning
    ? "#fde68a"
    : isSuccess
    ? "#a7f3d0"
    : "#bae6fd";

  const defaultTitle = isError
    ? "Thông báo lỗi dữ liệu"
    : isWarning
    ? "Cảnh báo kiểm tra"
    : isSuccess
    ? "Thực hiện thành công"
    : "Thông báo hệ thống";

  const lines = popup.message
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sv-global-popup-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        backgroundColor: "rgba(15, 23, 42, 0.32)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        pointerEvents: "none",
        animation: "svPopupFadeIn 0.16s ease-out",
        fontFamily: "'Be Vietnam Pro', Inter, system-ui, sans-serif",
      }}
    >
      <div
        ref={cardRef}
        style={{
          width: "100%",
          maxWidth: 460,
          backgroundColor: "#ffffff",
          borderRadius: 16,
          boxShadow: "0 24px 48px -12px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(15, 23, 42, 0.08)",
          overflow: "hidden",
          pointerEvents: "auto",
          animation: "svPopupScaleIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Top Accent Strip */}
        <div style={{ height: 5, backgroundColor: accentColor }} />

        <div style={{ padding: "22px 24px 20px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: lightBg,
                border: `1px solid ${borderColor}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {isError ? (
                <XCircle size={24} color={accentColor} />
              ) : isWarning ? (
                <AlertTriangle size={24} color={accentColor} />
              ) : isSuccess ? (
                <CheckCircle2 size={24} color={accentColor} />
              ) : (
                <Info size={24} color={accentColor} />
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <h3
                  id="sv-global-popup-title"
                  style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#0f172a",
                    lineHeight: 1.35,
                  }}
                >
                  {popup.title || defaultTitle}
                </h3>
                <button
                  type="button"
                  aria-label="Đóng"
                  onClick={() => setPopup(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: 4,
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <div
                style={{
                  marginTop: 10,
                  padding: "11px 14px",
                  borderRadius: 10,
                  backgroundColor: lightBg,
                  border: `1px solid ${borderColor}`,
                  color: "#1e293b",
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  fontWeight: 500,
                }}
              >
                {lines.length <= 1 ? (
                  <span>{lines[0] || popup.message}</span>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 5 }}>
                    {lines.map((line, idx) => (
                      <li key={idx}>{line}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 20,
              display: "flex",
               justifyContent: "flex-end",
              gap: 10,
            }}
          >
            <button
              type="button"
              autoFocus
              onClick={() => setPopup(null)}
              style={{
                minWidth: 112,
                height: 38,
                padding: "0 20px",
                borderRadius: 9,
                border: "none",
                backgroundColor: accentColor,
                color: "#ffffff",
                fontSize: 13.5,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(15, 23, 42, 0.12)",
              }}
            >
              {isError ? "Đã hiểu" : "Đóng"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes svPopupFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes svPopupScaleIn {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
