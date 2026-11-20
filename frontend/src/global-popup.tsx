import { useEffect, useState } from "react";
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
  full_name: "Họ và tên",
  display_name: "Họ và tên",
  first_name: "Tên",
  last_name: "Họ",
  new_password_confirm: "Xác nhận mật khẩu mới",
  challenge: "Phiên xác thực",
  otp: "Mã xác thực OTP",
  reset_token: "Liên kết đặt lại mật khẩu",
  terms_accepted: "Điều khoản sử dụng",
  privacy_accepted: "Chính sách bảo vệ dữ liệu cá nhân",
  party: "Đối tượng",
  party_id: "Đối tượng",
  party_type: "Loại đối tượng",
  base_uom: "Đơn vị tính chính",
  category: "Nhóm danh mục",
  branch: "Chi nhánh",
  branch_id: "Chi nhánh",
  department: "Phòng ban / Đơn vị",
  department_id: "Phòng ban / Đơn vị",
  employee_code: "Mã nhân viên",
  contract_type: "Loại hợp đồng",
  identity_number: "Số CCCD/CMND",
  identity_no: "Số CCCD/CMND",
  date_of_birth: "Ngày sinh",
  invoice_number: "Số hóa đơn",
  serial: "Ký hiệu hóa đơn",
  form_code: "Mẫu số hóa đơn",
  payment_term: "Điều khoản thanh toán",
  payment_method: "Phương thức thanh toán",
  credit_limit: "Hạn mức công nợ",
  due_days: "Số ngày được nợ",
  opening_date: "Ngày mở sổ",
  start_date: "Ngày bắt đầu",
  end_date: "Ngày kết thúc",
  from_date: "Từ ngày",
  to_date: "Đến ngày",
  bank_name: "Tên ngân hàng",
  account_number: "Số tài khoản ngân hàng",
  tax_rate: "Thuế suất",
  vat_rate: "Thuế suất GTGT",
  purchase_price: "Đơn giá mua",
  sales_price: "Đơn giá bán",
  unit_cost: "Đơn giá vốn",
  debit: "Số tiền Nợ",
  credit: "Số tiền Có",
  file: "Tệp tải lên",
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

  // Strip internal specification codes like `(EF-05)`, `(BR-COM-REG-01)`, `(BR04)`, `(UC-GL-10)`
  text = text.replace(/\s*\((?:EF|BR|AF|UC)-[A-Z0-9_.,\s/→-]+\)/gi, "").trim();
  text = text.replace(/\s*\((?:EF|BR|AF)\d+\)/gi, "").trim();
  text = text.replace(/^Lỗi\s+(?:EF|BR|AF|UC)-[A-Z0-9_.\s/-]+:\s*/i, "").trim();
  text = text.replace(/\s*-\s*(?:EF|BR|AF|UC)-[A-Z0-9_.-]+(?=\))/gi, "").trim();

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

  if (lower.includes("a valid number is required") || lower.includes("a valid integer is required")) {
    return fieldLabel
      ? `${fieldLabel} phải là một giá trị số hợp lệ.`
      : "Vui lòng nhập một giá trị số hợp lệ.";
  }

  if (lower.includes("date has wrong format") || lower.includes("datetime has wrong format")) {
    return fieldLabel
      ? `${fieldLabel} không đúng định dạng ngày tháng (vui lòng chọn hoặc nhập theo định dạng hợp lệ).`
      : "Ngày tháng không đúng định dạng hợp lệ.";
  }

  const maxLenMatch = text.match(/ensure this field has no more than (\d+) characters/i);
  if (maxLenMatch) {
    return fieldLabel
      ? `${fieldLabel} không được vượt quá ${maxLenMatch[1]} ký tự.`
      : `Nội dung không được vượt quá ${maxLenMatch[1]} ký tự.`;
  }

  const minLenMatch = text.match(/ensure this field has at least (\d+) characters/i);
  if (minLenMatch) {
    return fieldLabel
      ? `${fieldLabel} phải có ít nhất ${minLenMatch[1]} ký tự.`
      : `Nội dung phải có ít nhất ${minLenMatch[1]} ký tự.`;
  }

  const minValMatch = text.match(/ensure this value is greater than or equal to ([\d.,-]+)/i);
  if (minValMatch) {
    return fieldLabel
      ? `${fieldLabel} phải lớn hơn hoặc bằng ${minValMatch[1]}.`
      : `Giá trị phải lớn hơn hoặc bằng ${minValMatch[1]}.`;
  }

  const maxValMatch = text.match(/ensure this value is less than or equal to ([\d.,-]+)/i);
  if (maxValMatch) {
    return fieldLabel
      ? `${fieldLabel} phải nhỏ hơn hoặc bằng ${maxValMatch[1]}.`
      : `Giá trị phải nhỏ hơn hoặc bằng ${maxValMatch[1]}.`;
  }

  if (lower.includes("enter a valid email address")) {
    return fieldLabel
      ? `${fieldLabel} không đúng định dạng email (ví dụ: ten@congty.vn).`
      : "Địa chỉ email không đúng định dạng (ví dụ: ten@congty.vn).";
  }

  if (lower.includes("is not a valid choice")) {
    return fieldLabel
      ? `Giá trị đã chọn cho ${fieldLabel} không hợp lệ.`
      : "Giá trị lựa chọn không hợp lệ.";
  }

  if (lower.includes("must be a valid uuid") || lower.includes("is not a valid uuid")) {
    return fieldLabel
      ? `Mã định danh của ${fieldLabel} không hợp lệ. Vui lòng chọn lại.`
      : "Mã định danh dữ liệu không hợp lệ. Vui lòng tải lại trang và thử lại.";
  }

  if (lower.includes("you do not have permission to perform this action")) {
    return "Bạn không có quyền thực hiện thao tác này trên doanh nghiệp hiện tại.";
  }

  if (lower.includes("authentication credentials were not provided")) {
    return "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.";
  }

  const throttleMatch = text.match(/request was throttled.*?(\d+)\s*seconds/i);
  if (throttleMatch) {
    return `Bạn thao tác quá nhanh. Vui lòng thử lại sau ${throttleMatch[1]} giây.`;
  }

  if (lower === "not found." || lower.includes("matches the given query")) {
    return "Không tìm thấy bản ghi yêu cầu (có thể đã bị xóa hoặc bạn không có quyền truy cập).";
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
      const lowerField = field.toLowerCase();
      if (lowerField === "code") {
        // Ignore machine-readable error codes (e.g. "pending_verification"), but keep OTP field validation messages.
        if (typeof value === "string" && /^[a-z0-9_.-]+$/i.test(value.trim())) continue;
      } else if (IGNORED_META_KEYS.has(lowerField)) {
        continue;
      }
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

/** Thông báo không chặn thao tác — thay cho window.alert(). Tự phân loại nếu không truyền type. */
export function showNotice(message: string, type?: GlobalPopupType) {
  showGlobalPopup({ type: type ?? classifyNoticeType(message), message });
}

/** Dùng cho nút/tính năng chưa có backend hoặc tài liệu: nói rõ thay vì giả lập kết quả. */
export function showPendingFeature(feature: string) {
  showGlobalPopup({ type: "info", title: "Chưa tích hợp", message: `${feature}: chức năng này chưa được tích hợp trong phiên bản hiện tại.` });
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
    lower.includes("chưa xử lý được") ||
    lower.includes("tạm thời chưa") ||
    lower.includes("thiếu")
  ) {
    return "error";
  }
  if (lower.includes("cảnh báo") || lower.includes("lưu ý") || lower.includes("chú ý")) {
    return "warning";
  }
  if (/thành công|^đã (lưu|cập nhật|xóa|huỷ|hủy|tạo|ghi sổ|gửi|hoàn tất)/.test(lower)) return "success";
  return "info";
}

export function GlobalFeedbackPopupHost() {
  const [popup, setPopup] = useState<GlobalPopupPayload | null>(null);
  const [closing, setClosing] = useState(false);
  const [paused, setPaused] = useState(false);

  const dismissPopup = () => {
    setClosing(true);
  };

  useEffect(() => {
    const handler = (event: Event) => {
      const payload = (event as CustomEvent<GlobalPopupPayload>).detail;
      if (payload?.message) {
        setClosing(false);
        setPaused(false);
        setPopup(payload);
      }
    };
    window.addEventListener(POPUP_EVENT_NAME, handler);
    return () => window.removeEventListener(POPUP_EVENT_NAME, handler);
  }, []);

  const duration = popup
    ? (popup.autoCloseMs ?? (popup.type === "error" || popup.type === "warning" ? 5000 : 4000))
    : 0;

  useEffect(() => {
    if (!popup) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissPopup();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popup]);

  useEffect(() => {
    if (!popup || closing || paused || duration <= 0) return;
    const timer = window.setTimeout(() => setClosing(true), duration);
    return () => window.clearTimeout(timer);
  }, [popup, closing, paused, duration]);

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => {
      setPopup(null);
      setClosing(false);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [closing]);

  if (!popup) return null;
  const urgent = popup.type === "error" || popup.type === "warning";
  const Icon = popup.type === "error" ? XCircle : popup.type === "warning" ? AlertTriangle : popup.type === "success" ? CheckCircle2 : Info;
  const title = popup.title || (popup.type === "error" ? "Không thực hiện được" : popup.type === "warning" ? "Cần kiểm tra" : popup.type === "success" ? "Đã hoàn tất" : "Thông báo");
  return (
    <section
      key={popup.id}
      className={`feedback-toast ${popup.type}${closing ? " closing" : ""}${paused ? " paused" : ""}`}
      role={urgent ? "alert" : "status"}
      aria-live={urgent ? "assertive" : "polite"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <Icon size={18} aria-hidden="true" />
      <div><strong>{title}</strong><p>{popup.message}</p></div>
      <button type="button" aria-label="Đóng thông báo" onClick={dismissPopup}><X size={16} /></button>
      {duration > 0 && (
        <span
          className="feedback-toast-progress"
          aria-hidden="true"
          style={{ animationDuration: `${duration}ms` }}
        />
      )}
    </section>
  );
}
