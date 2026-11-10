import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import {
  FileText,
  Monitor,
  BookOpen,
  X,
  CheckCircle2,
  Send,
  FileSignature,
  AlertTriangle,
  ArrowRight,
  Inbox,
  Search,
} from "lucide-react";
import { request } from "./live-api";
import "./misa-invoice-workspace.css";
// Flow diagram geometry, in the same 1000×460 coordinate space as the SVG viewBox. The box keeps
// that aspect ratio (see .iw-flow), so node positions (icon centers) and connectors stay aligned.
const FLOW_W = 1000;
const FLOW_H = 460;
const flowNodes = [
  // [label, route, x, y, label above icon]
  ["Tiếp nhận hóa đơn đầu vào", "incoming/inbox", 100, 150, true],
  ["Khởi tạo mẫu & Đăng ký", "outgoing", 100, 330, false],
  ["Xuất và gửi hóa đơn", "outgoing", 290, 240, false],
  ["Thông báo hóa đơn lập sai", "adjustments", 570, 150, true],
  ["Xử lý hóa đơn không hợp lệ", "adjustments", 480, 330, false],
  ["Biên bản điều chỉnh/ thay thế hóa đơn", "adjustments", 680, 330, false],
  ["Lập hóa đơn thay thế", "adjustments", 880, 150, true],
  ["Lập hóa đơn điều chỉnh", "adjustments", 880, 330, false],
] as const;
// Each connector is its own path so every step gets an arrowhead; ends stop at the icon edge.
const flowConnectors = [
  "M146 150 H170 Q190 150 190 170 V240",
  "M146 330 H170 Q190 330 190 310 V240",
  "M190 240 H242",
  "M336 240 H880",
  "M480 240 V284",
  "M570 240 V196",
  "M680 240 V284",
  "M880 240 V196",
  "M880 240 V284",
] as const;
const flowArrowed = new Set([2, 4, 5, 6, 7, 8]);
const kinds = [
  "HĐ có mã của CQT",
  "HĐ không có mã của CQT",
  "HĐ khởi tạo từ máy tính tiền",
  "Hóa đơn theo NĐ51",
];

const faults = [
  "Sai tên; địa chỉ; số tiền bằng chữ hoặc các nội dung khác nhưng không sai về mã số thuế; số tiền; thuế suất; tiền thuế hoặc hàng hóa ghi trên hóa đơn.",
  "Sai mã số thuế; tên hàng hóa; hàng hóa ghi trên hóa đơn không đúng quy cách, chất lượng; sai về số tiền ghi trên hóa đơn; sai về thuế suất; tiền thuế hoặc các nội dung bắt buộc khác.",
];

type GuideStep = {
  text: string;
  label: string;
  actionType: "modal-explain" | "modal-04ss" | "modal-minutes" | "modal-cancel" | "link-replace" | "link-adjust";
};

type LiveInvoiceOption = {
  id: string;
  invoice_series: string;
  invoice_number: string;
  invoice_date: string;
  buyer_name: string;
  buyer_tax_code: string;
  total_amount: string;
  status: string;
};

export default function MisaInvoiceWorkspace({
  tab,
  href,
  notify,
  company,
}: {
  tab: string;
  href: (path: string, extra?: Record<string, string>) => string;
  notify: (text: string) => void;
  company?: { id: string; name: string; tax_code?: string };
}) {
  const { token, companyId: sessionCompanyId } = useApiSession();
  const effectiveCompanyId = company?.id || sessionCompanyId || "";

  // Pre-select sensible defaults so the guide immediately displays full instructions
  // and reacts smoothly whenever any option on the left is clicked.
  const [kind, setKind] = useState(kinds[0]);
  const [sent, setSent] = useState("Đã gửi");
  const [fault, setFault] = useState(faults[0]);
  const [action, setAction] = useState("Thay thế hóa đơn");
  const [legalModalOpen, setLegalModalOpen] = useState(false);

  // Interactive operational modal state for Mẫu 04/SS-HĐĐT, Biên bản thỏa thuận, Thông báo giải trình
  const [activeActionModal, setActiveActionModal] = useState<
    "modal-explain" | "modal-04ss" | "modal-minutes" | "modal-cancel" | null
  >(null);
  const [liveInvoices, setLiveInvoices] = useState<LiveInvoiceOption[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [reasonInput, setReasonInput] = useState(
    "Điều chỉnh thông tin sai sót theo rà soát chứng từ kế toán giữa hai bên",
  );
  const [buyerEmailInput, setBuyerEmailInput] = useState("ketoan@doitac.vn");
  const [submittingAction, setSubmittingAction] = useState(false);

  useEffect(() => {
    if (tab !== "error-guide" || !token || !effectiveCompanyId) return;
    let active = true;
    request<{ results: LiveInvoiceOption[] }>(
      `/api/v1/tax/invoices/query/?company_id=${encodeURIComponent(effectiveCompanyId)}&mode=outgoing`,
      token,
    )
      .then((res) => {
        if (!active || !res?.results) return;
        setLiveInvoices(res.results);
        if (res.results.length > 0 && !selectedInvoiceId) {
          setSelectedInvoiceId(res.results[0].id);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [tab, token, effectiveCompanyId]);

  const selectedInvoice = liveInvoices.find((i) => i.id === selectedInvoiceId) || liveInvoices[0];

  // Build accurate legal & operational steps for every combination of (kind, sent, fault, action)
  let guideHeading = "Xử lý hóa đơn sai sót với các bước chuẩn quy định";
  let legalBasisNote =
    "Căn cứ: Điều 19 Nghị định 123/2020/NĐ-CP (sửa đổi bởi Nghị định 70/2025/NĐ-CP) & Điều 7 Thông tư 78/2021/TT-BTC.";
  let highlightNote = "";
  let steps: GuideStep[] = [];

  if (kind === "Hóa đơn theo NĐ51") {
    legalBasisNote =
      "Căn cứ: Khoản 6 Điều 12 Thông tư 78/2021/TT-BTC (Xử lý hóa đơn đã lập theo Nghị định 51/2010/NĐ-CP & 04/2014/NĐ-CP phát hiện sai sót sau khi chuyển sang HĐĐT Nghị định 123).";
    if (fault === faults[0]) {
      guideHeading = "Xử lý hóa đơn NĐ51 sai tên, địa chỉ (không sai MST & số tiền)";
      highlightNote =
        "Lưu ý: Không phải lập lại hóa đơn. Người bán thông báo cho người mua và gửi Mẫu số 04/SS-HĐĐT đến Cơ quan thuế.";
      steps = [
        {
          text: "Thông báo cho người mua về việc hóa đơn đã lập theo NĐ51 có sai sót về tên, địa chỉ (không sai mã số thuế và các nội dung khác).",
          label: "Gửi thông báo giải trình",
          actionType: "modal-explain",
        },
        {
          text: "Lập và gửi Thông báo hóa đơn điện tử có sai sót theo Mẫu số 04/SS-HĐĐT đến Cơ quan thuế quản lý.",
          label: "Lập thông báo HĐ lập sai (04/SS-HĐĐT)",
          actionType: "modal-04ss",
        },
      ];
    } else {
      guideHeading =
        "Xử lý hóa đơn NĐ51 sai MST, số tiền, thuế suất hoặc hàng hóa (Bắt buộc lập HĐĐT thay thế)";
      highlightNote =
        "Lưu ý quan trọng (Khoản 6 Điều 12 TT78): Đối với hóa đơn NĐ51 phát hiện sai số tiền, MST, thuế suất sau khi đã chuyển sang NĐ123, doanh nghiệp thực hiện lập hóa đơn điện tử mới theo NĐ123 để THAY THẾ (không lập hóa đơn điều chỉnh NĐ51).";
      steps = [
        {
          text: "Người bán và người mua lập văn bản thỏa thuận ghi rõ nội dung sai sót của hóa đơn đã lập theo Nghị định 51/2010/NĐ-CP.",
          label: "Lập biên bản thỏa thuận",
          actionType: "modal-minutes",
        },
        {
          text: "Người bán lập Thông báo hóa đơn điện tử có sai sót theo Mẫu số 04/SS-HĐĐT gửi Cơ quan thuế.",
          label: "Lập thông báo HĐ lập sai (04/SS-HĐĐT)",
          actionType: "modal-04ss",
        },
        {
          text: "Lập hóa đơn điện tử mới (theo Nghị định 123/2020/NĐ-CP) thay thế cho hóa đơn NĐ51 đã lập sai, ký số gửi CQT cấp mã và gửi cho người mua.",
          label: "Lập hóa đơn thay thế",
          actionType: "link-replace",
        },
      ];
    }
  } else if (sent === "Chưa gửi") {
    legalBasisNote =
      "Căn cứ: Khoản 1 Điều 19 Nghị định 123/2020/NĐ-CP — Trường hợp người bán phát hiện hóa đơn điện tử đã lập có sai sót nhưng CHƯA gửi cho người mua.";
    if (kind === "HĐ có mã của CQT") {
      guideHeading = "Xử lý HĐ có mã của CQT đã cấp mã nhưng chưa gửi cho người mua";
      highlightNote =
        "Lưu ý: Vì hóa đơn chưa gửi cho người mua nên không cần lập biên bản thỏa thuận với người mua. Người bán nộp Mẫu 04/SS-HĐĐT để hủy HĐ cũ và lập HĐ mới.";
      steps = [
        {
          text: "Gửi Thông báo hóa đơn điện tử có sai sót theo Mẫu số 04/SS-HĐĐT đến Cơ quan thuế để thực hiện hủy hóa đơn điện tử có mã đã lập có sai sót.",
          label: "Lập thông báo HĐ lập sai (04/SS-HĐĐT)",
          actionType: "modal-04ss",
        },
        {
          text: "Lập hóa đơn điện tử mới, ký số gửi Cơ quan thuế để cấp mã hóa đơn mới thay thế hóa đơn đã lập để gửi cho người mua.",
          label: "Lập hóa đơn thay thế",
          actionType: "link-replace",
        },
        {
          text: "Thực hiện hủy hóa đơn điện tử đã lập có sai sót trên hệ thống phần mềm sau khi CQT tiếp nhận thông báo.",
          label: "Xử lý hủy hóa đơn sai sót",
          actionType: "modal-cancel",
        },
      ];
    } else {
      guideHeading = `Xử lý ${kind} đã lập nhưng chưa gửi cho người mua`;
      highlightNote =
        "Lưu ý: Nếu hóa đơn chưa gửi dữ liệu đến CQT thì chỉ cần hủy trên phần mềm và lập HĐ mới. Nếu đã truyền dữ liệu lên CQT thì gửi kèm Mẫu 04/SS-HĐĐT.";
      steps = [
        {
          text: `Thực hiện hủy bỏ hóa đơn (${kind}) đã lập sai trên phần mềm (và gửi Mẫu 04/SS-HĐĐT nếu dữ liệu hóa đơn đã được chuyển đến CQT).`,
          label: "Xử lý hủy hóa đơn sai sót",
          actionType: "modal-cancel",
        },
        {
          text: "Lập hóa đơn điện tử mới đúng quy định, ký số và gửi cho người mua (đồng thời chuyển dữ liệu HĐĐT đến CQT theo quy định).",
          label: "Lập hóa đơn thay thế",
          actionType: "link-replace",
        },
      ];
    }
  } else if (fault === faults[0]) {
    guideHeading = "Xử lý hóa đơn sai tên, địa chỉ với 2 bước đơn giản";
    legalBasisNote =
      "Căn cứ: Điểm a Khoản 2 Điều 19 Nghị định 123/2020/NĐ-CP — Hóa đơn đã gửi người mua chỉ sai tên, địa chỉ nhưng không sai mã số thuế và các nội dung khác.";
    highlightNote = "Lưu ý: Không cần lập lại hóa đơn điều chỉnh hay thay thế.";
    steps = [
      {
        text: "Gửi thông báo cho người mua về việc hóa đơn đã lập có sai sót (sai tên, địa chỉ người mua nhưng đúng mã số thuế và số tiền).",
        label: "Gửi thông báo giải trình",
        actionType: "modal-explain",
      },
      {
        text: "Gửi thông báo HĐĐT đã lập sai theo Mẫu số 04/SS-HĐĐT đến Cơ quan thuế để ghi nhận thông tin đúng.",
        label: "Lập thông báo HĐ lập sai (04/SS-HĐĐT)",
        actionType: "modal-04ss",
      },
    ];
  } else {
    guideHeading = "Lựa chọn cách xử lý hóa đơn phù hợp (Thay thế hoặc Điều chỉnh)";
    legalBasisNote =
      "Căn cứ: Điểm b Khoản 2 Điều 19 Nghị định 123/2020/NĐ-CP & Nghị định 70/2025/NĐ-CP — Sai mã số thuế, số tiền, thuế suất, tiền thuế hoặc quy cách, chất lượng hàng hóa.";
    const effectiveAction = action || "Thay thế hóa đơn";
    const isReplace = effectiveAction === "Thay thế hóa đơn";
    highlightNote = isReplace
      ? "Hóa đơn thay thế phải có dòng chữ: “Thay thế cho hóa đơn Mẫu số... ký hiệu... số... ngày... tháng... năm...”."
      : "Hóa đơn điều chỉnh phải có dòng chữ: “Điều chỉnh cho hóa đơn Mẫu số... ký hiệu... số... ngày... tháng... năm...” (điều chỉnh tăng ghi dấu dương +, điều chỉnh giảm ghi dấu âm -).";
    steps = [
      {
        text: `Lập văn bản thỏa thuận (Biên bản ${isReplace ? "thay thế" : "điều chỉnh"} hóa đơn) ghi rõ nội dung sai sót giữa người bán và người mua trước khi lập hóa đơn ${isReplace ? "thay thế" : "điều chỉnh"}.`,
        label: "Lập biên bản thỏa thuận",
        actionType: "modal-minutes",
      },
      {
        text: `Lập hóa đơn điện tử ${isReplace ? "thay thế" : "điều chỉnh"} ${
          kind === "HĐ có mã của CQT"
            ? "ký số gửi CQT cấp mã để gửi cho người mua."
            : "ký số gửi cho người mua và chuyển dữ liệu đến CQT."
        }`,
        label: isReplace ? "Lập hóa đơn thay thế" : "Lập hóa đơn điều chỉnh",
        actionType: isReplace ? "link-replace" : "link-adjust",
      },
    ];
  }

  const handleSubmitActionModal = async () => {
    setSubmittingAction(true);
    try {
      const invRef = selectedInvoice
        ? `${selectedInvoice.invoice_series} - Số ${selectedInvoice.invoice_number} (${selectedInvoice.buyer_name})`
        : "hóa đơn đã chọn";

      if (token && effectiveCompanyId && selectedInvoiceId) {
        await request(
          `/api/v1/tax/invoices/${selectedInvoiceId}/error-notice/?company_id=${encodeURIComponent(effectiveCompanyId)}`,
          token,
          {
            method: "POST",
            body: JSON.stringify({
              notice_type: activeActionModal || "modal-04ss",
              reason: reasonInput.trim(),
              invoice_kind: kind,
              sent_status: sent,
              fault_type: fault,
              buyer_email: buyerEmailInput.trim(),
            }),
          },
        );
      }

      if (activeActionModal === "modal-04ss") {
        notify(
          `✓ Đã lưu hồ sơ & ghi nhận Thông báo HĐĐT có sai sót (Mẫu 04/SS-HĐĐT) cho ${invRef} trên hệ thống!`,
        );
      } else if (activeActionModal === "modal-minutes") {
        notify(
          `✓ Đã lập & lưu Biên bản thỏa thuận xử lý hóa đơn sai sót cho ${invRef} (gửi tới ${buyerEmailInput})!`,
        );
      } else if (activeActionModal === "modal-cancel") {
        notify(
          `✓ Đã hủy hóa đơn sai sót chưa gửi người mua (${invRef}) và cập nhật trạng thái Đã hủy trên cơ sở dữ liệu!`,
        );
      } else {
        notify(
          `✓ Đã lưu & gửi Thông báo giải trình sai sót thông tin hóa đơn (${invRef}) tới người mua (${buyerEmailInput})!`,
        );
      }
      setActiveActionModal(null);
    } catch (err: any) {
      notify(
        err?.message ||
          "Không thể lưu hồ sơ xử lý sai sót hóa đơn lên máy chủ.",
      );
    } finally {
      setSubmittingAction(false);
    }
  };

  const renderActionModal = () => {
    if (!activeActionModal) return null;
    const modalTitles: Record<string, string> = {
      "modal-04ss":
        "Lập Thông báo hóa đơn điện tử có sai sót (Mẫu số 04/SS-HĐĐT)",
      "modal-minutes":
        "Lập Biên bản thỏa thuận (Điều chỉnh / Thay thế hóa đơn)",
      "modal-explain":
        "Gửi Thông báo giải trình hóa đơn lập sai cho Người mua",
      "modal-cancel": "Xử lý Hủy hóa đơn điện tử đã lập sai (Chưa gửi người mua)",
    };

    return (
      <div
        className="ce-overlay"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15,23,42,0.6)",
          zIndex: 9999,
          display: "grid",
          placeItems: "center",
          padding: 20,
        }}
        onClick={() => setActiveActionModal(null)}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 10,
            maxWidth: 640,
            width: "100%",
            maxHeight: "88vh",
            overflowY: "auto",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 20px",
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: "#0f172a",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <FileSignature size={18} color="#00a165" />
              {modalTitles[activeActionModal]}
            </h3>
            <button
              type="button"
              onClick={() => setActiveActionModal(null)}
              style={{
                border: "none",
                background: "none",
                cursor: "pointer",
                color: "#64748b",
              }}
            >
              <X size={18} />
            </button>
          </div>

          <div
            style={{
              padding: "20px",
              fontSize: 13.5,
              lineHeight: 1.6,
              color: "#334155",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 12.5,
                color: "#166534",
              }}
            >
              <b>Hình thức đang chọn:</b> {kind} ·{" "}
              {kind === "Hóa đơn theo NĐ51" ? "Đã phát hành theo NĐ51" : sent}
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: 6,
                  color: "#1e293b",
                }}
              >
                Chọn hóa đơn đầu ra cần xử lý sai sót
              </label>
              <select
                value={selectedInvoiceId}
                onChange={(e) => setSelectedInvoiceId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                }}
              >
                {liveInvoices.length === 0 ? (
                  <option value="">
                    1C26TAA - Số 00000128 · Công ty TNHH Thương mại Á Châu
                  </option>
                ) : (
                  liveInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_series} - Số {inv.invoice_number || "Nháp"} (
                      {inv.invoice_date}) · {inv.buyer_name} ·{" "}
                      {Math.round(Number(inv.total_amount || 0)).toLocaleString(
                        "vi-VN",
                      )}{" "}
                      đ
                    </option>
                  ))
                )}
              </select>
            </div>

            {activeActionModal === "modal-04ss" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: 600,
                      marginBottom: 4,
                      fontSize: 12.5,
                    }}
                  >
                    Mẫu biểu CQT
                  </label>
                  <input
                    type="text"
                    readOnly
                    value="Mẫu số 04/SS-HĐĐT (Ban hành kèm NĐ 123/2020/NĐ-CP)"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      fontSize: 12.5,
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: 600,
                      marginBottom: 4,
                      fontSize: 12.5,
                    }}
                  >
                    Tính chất thông báo (Cột 6 Mẫu 04/SS)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={
                      sent === "Chưa gửi"
                        ? "1 - Hủy hóa đơn đã lập sai"
                        : fault === faults[0]
                          ? "4 - Giải trình sai sót tên/địa chỉ"
                          : action === "Điều chỉnh hóa đơn"
                            ? "2 - Điều chỉnh hóa đơn"
                            : "3 - Thay thế hóa đơn"
                    }
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "#0284c7",
                    }}
                  />
                </div>
              </div>
            )}

            {(activeActionModal === "modal-explain" ||
              activeActionModal === "modal-minutes") && (
              <div>
                <label
                  style={{
                    display: "block",
                    fontWeight: 600,
                    marginBottom: 6,
                    color: "#1e293b",
                  }}
                >
                  Email người mua nhận thông báo / biên bản điện tử
                </label>
                <input
                  type="email"
                  value={buyerEmailInput}
                  onChange={(e) => setBuyerEmailInput(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                  }}
                />
              </div>
            )}

            <div>
              <label
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: 6,
                  color: "#1e293b",
                }}
              >
                Lý do sai sót & Nội dung giải trình / thỏa thuận
              </label>
              <textarea
                rows={3}
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  fontFamily: "inherit",
                }}
              />
            </div>
          </div>

          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Link
              to={href("/invoices/adjustments")}
              style={{
                fontSize: 13,
                color: "#2563eb",
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              Mở danh sách HĐ sai sót / điều chỉnh <ArrowRight size={14} />
            </Link>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setActiveActionModal(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  color: "#475569",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={handleSubmitActionModal}
                style={{
                  padding: "8px 18px",
                  borderRadius: 6,
                  border: "none",
                  background: "#00a165",
                  color: "#fff",
                  cursor: submittingAction ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Send size={14} />
                {submittingAction
                  ? "Đang xử lý..."
                  : activeActionModal === "modal-04ss"
                    ? "Ký số & Gửi Mẫu 04/SS-HĐĐT"
                    : activeActionModal === "modal-minutes"
                      ? "Lưu & Gửi biên bản thỏa thuận"
                      : activeActionModal === "modal-cancel"
                        ? "Xác nhận Hủy hóa đơn sai sót"
                        : "Gửi thông báo giải trình"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderLegalModal = () =>
    legalModalOpen && (
      <div
        className="ce-overlay"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15,23,42,0.6)",
          zIndex: 9999,
          display: "grid",
          placeItems: "center",
          padding: 20,
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 10,
            maxWidth: 680,
            width: "100%",
            maxHeight: "85vh",
            overflowY: "auto",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 20px",
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: "#0f172a",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <BookOpen size={18} color="#2563eb" />
              Quy chuẩn xử lý HĐĐT (NĐ 123/2020/NĐ-CP, NĐ 70/2025/NĐ-CP & TT
              78/2021/TT-BTC)
            </h3>
            <button
              type="button"
              onClick={() => setLegalModalOpen(false)}
              style={{
                border: "none",
                background: "none",
                cursor: "pointer",
                color: "#64748b",
              }}
            >
              <X size={18} />
            </button>
          </div>
          <div
            style={{
              padding: "20px",
              fontSize: 13.5,
              lineHeight: 1.6,
              color: "#334155",
            }}
          >
            <div
              style={{
                background: "#f8fafc",
                padding: "12px 16px",
                borderRadius: 8,
                marginBottom: 16,
                borderLeft: "4px solid #2563eb",
              }}
            >
              <b>Căn cứ pháp lý:</b> Điều 19 Nghị định số 123/2020/NĐ-CP (được
              sửa đổi, bổ sung tại Nghị định 70/2025/NĐ-CP) và Điều 7, Điều 12
              Thông tư số 78/2021/TT-BTC về xử lý hóa đơn điện tử đã lập có sai
              sót.
            </div>

            <h4 style={{ color: "#1e293b", margin: "14px 0 6px" }}>
              1. Người bán tự phát hiện sai sót chưa gửi người mua
            </h4>
            <p style={{ margin: "0 0 10px" }}>
              Người bán thông báo với CQT theo Mẫu số 04/SS-HĐĐT về việc hủy hóa
              đơn điện tử có mã đã lập có sai sót và lập hóa đơn điện tử mới, ký
              số gửi cơ quan thuế để cấp mã hóa đơn mới thay thế hóa đơn đã lập
              để gửi cho người mua.
            </p>

            <h4 style={{ color: "#1e293b", margin: "14px 0 6px" }}>
              2. Sai tên, địa chỉ người mua nhưng không sai mã số thuế & số tiền
            </h4>
            <p style={{ margin: "0 0 10px" }}>
              Người bán thông báo cho người mua về việc hóa đơn có sai sót và{" "}
              <b>không phải lập lại hóa đơn</b>. Người bán thực hiện thông báo
              với CQT theo <b>Mẫu số 04/SS-HĐĐT</b>.
            </p>

            <h4 style={{ color: "#1e293b", margin: "14px 0 6px" }}>
              3. Sai mã số thuế, số tiền, thuế suất hoặc quy cách hàng hóa
            </h4>
            <p style={{ margin: "0 0 6px" }}>
              Người bán và người mua lập văn bản thỏa thuận ghi rõ sai sót, sau
              đó người bán lựa chọn 1 trong 2 phương án:
            </p>
            <ul style={{ margin: "0 0 10px", paddingLeft: 20 }}>
              <li>
                <b>Lập hóa đơn điều chỉnh:</b> Ghi rõ “Điều chỉnh (tăng/giảm) số
                lượng, giá bán, thuế suất... cho hóa đơn Mẫu số... Ký hiệu...
                Số... Ngày...”.
              </li>
              <li>
                <b>Lập hóa đơn thay thế:</b> Ghi rõ “Thay thế cho hóa đơn Mẫu
                số... Ký hiệu... Số... Ngày...”.
              </li>
            </ul>

            <h4 style={{ color: "#1e293b", margin: "14px 0 6px" }}>
              4. Hóa đơn theo Nghị định 51/2010/NĐ-CP phát hiện sai sót (Khoản 6
              Điều 12 TT 78)
            </h4>
            <p style={{ margin: "0 0 10px" }}>
              Người bán và người mua lập văn bản thỏa thuận ghi rõ sai sót,
              người bán gửi Mẫu 04/SS-HĐĐT và lập hóa đơn điện tử mới (theo NĐ
              123) thay thế cho hóa đơn đã lập có sai sót.
            </p>
          </div>
          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={() => setLegalModalOpen(false)}
              style={{
                padding: "8px 20px",
                borderRadius: 6,
                border: "none",
                background: "var(--brand)",
                color: "#ffffff",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
                boxShadow: "0 1px 2px rgba(2,132,199,0.25)",
              }}
            >
              Đã hiểu & Đóng
            </button>
          </div>
        </div>
      </div>
    );

  if (tab === "error-guide")
    return (
      <div className="iw-guide">
        {renderLegalModal()}
        {renderActionModal()}
        <header>
          <h1>Tra cứu cách xử lý HĐ đã lập sai</h1>
          <p>
            Cung cấp thông tin về hóa đơn đã lập sai của bạn, hệ thống sẽ hướng
            dẫn cách xử lý phù hợp theo chuẩn Nghị định 123/2020/NĐ-CP, Nghị định
            70/2025/NĐ-CP & Thông tư 78/2021/TT-BTC.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <Link
              to={href("/sales/invoices")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                color: "#334155",
                fontSize: 12.5,
                fontWeight: 500,
                textDecoration: "none",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              }}
            >
              Xem hóa đơn đã phát hành & xử lý hủy
            </Link>
            <Link
              to={href("/invoices/adjustments")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: 6,
                color: "#1d4ed8",
                fontSize: 12.5,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Đến màn hình HĐ điều chỉnh / thay thế →
            </Link>
          </div>
        </header>
        <div className="iw-guide-columns">
          <section>
            <fieldset>
              <legend>1. Hình thức hóa đơn</legend>
              {kinds.map((value) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="invoice-kind"
                    checked={kind === value}
                    onChange={() => {
                      setKind(value);
                      if (value === "Hóa đơn theo NĐ51") {
                        setSent("Đã gửi");
                        if (!fault) setFault(faults[1]);
                        setAction("Thay thế hóa đơn");
                      } else {
                        if (!sent) setSent("Đã gửi");
                        if (!fault) setFault(faults[0]);
                        if (!action) setAction("Thay thế hóa đơn");
                      }
                    }}
                  />
                  {value}
                </label>
              ))}
            </fieldset>

            {kind !== "Hóa đơn theo NĐ51" ? (
              <fieldset>
                <legend>2. Hóa đơn đã gửi cho người mua chưa?</legend>
                {["Đã gửi", "Chưa gửi"].map((value) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="invoice-sent"
                      checked={sent === value}
                      onChange={() => {
                        setSent(value);
                        if (!fault) setFault(faults[0]);
                        if (!action) setAction("Thay thế hóa đơn");
                      }}
                    />
                    {value}
                  </label>
                ))}
              </fieldset>
            ) : (
              <fieldset>
                <legend>2. Trạng thái hóa đơn NĐ51</legend>
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    padding: "10px 12px",
                    fontSize: 12.5,
                    color: "#475569",
                    lineHeight: 1.5,
                  }}
                >
                  Hóa đơn theo Nghị định 51/2010/NĐ-CP là hóa đơn của giai đoạn
                  trước đã phát hành và giao cho người mua, nay phát hiện sai
                  sót sau khi doanh nghiệp đã chuyển sang áp dụng HĐĐT theo Nghị
                  định 123/2020/NĐ-CP.
                </div>
              </fieldset>
            )}

            {(sent === "Đã gửi" || kind === "Hóa đơn theo NĐ51") ? (
              <fieldset>
                <legend>3. Hóa đơn của đơn vị sai nội dung nào?</legend>
                {faults.map((value) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="invoice-fault"
                      checked={fault === value}
                      onChange={() => {
                        setFault(value);
                        if (!action) setAction("Thay thế hóa đơn");
                      }}
                    />
                    {value}
                  </label>
                ))}
              </fieldset>
            ) : (
              <fieldset>
                <legend>3. Nội dung sai sót (Khi chưa gửi người mua)</legend>
                <div
                  style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: 6,
                    padding: "10px 12px",
                    fontSize: 12.5,
                    color: "#166534",
                    lineHeight: 1.5,
                  }}
                >
                  Khi hóa đơn <b>chưa gửi cho người mua</b>, bất kể sai nội dung
                  nào (tên, địa chỉ, MST hay số tiền), đơn vị đều thực hiện quy
                  trình <b>Hủy hóa đơn đã lập sai và lập hóa đơn mới</b> theo
                  hướng dẫn bên phải.
                </div>
              </fieldset>
            )}
          </section>

          <section className="iw-guide-result">
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  background: "#ecfdf5",
                  color: "#059669",
                  border: "1px solid #a7f3d0",
                  padding: "3px 10px",
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {kind}
              </span>
              <span
                style={{
                  background: "#eff6ff",
                  color: "#2563eb",
                  border: "1px solid #bfdbfe",
                  padding: "3px 10px",
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {kind === "Hóa đơn theo NĐ51" ? "Đã giao người mua (NĐ51)" : sent}
              </span>
            </div>

            <h2>{guideHeading}</h2>

            <div
              style={{
                background: "#f8fafc",
                borderLeft: "3px solid #0284c7",
                padding: "8px 12px",
                borderRadius: 4,
                fontSize: 12.5,
                color: "#475569",
                marginBottom: 18,
              }}
            >
              {legalBasisNote}
            </div>

            {sent === "Đã gửi" &&
              kind !== "Hóa đơn theo NĐ51" &&
              fault === faults[1] && (
                <div className="iw-guide-actions">
                  {["Thay thế hóa đơn", "Điều chỉnh hóa đơn"].map((value) => (
                    <label
                      key={value}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 14px",
                        borderRadius: 6,
                        border:
                          action === value
                            ? "1px solid #00a165"
                            : "1px solid #cbd5e1",
                        background: action === value ? "#f0fdf4" : "#ffffff",
                        fontWeight: action === value ? 600 : 500,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="invoice-resolution"
                        checked={action === value}
                        onChange={() => setAction(value)}
                        style={{ marginTop: 0 }}
                      />
                      {value}
                    </label>
                  ))}
                </div>
              )}

            {steps.map((step, index) => (
              <article key={step.label + index}>
                <b>{index + 1}</b>
                <div>
                  <p>{step.text}</p>
                  {step.actionType === "link-replace" ? (
                    <Link to={href("/sales/invoices", { create: "replacement" })}>
                      {step.label}
                    </Link>
                  ) : step.actionType === "link-adjust" ? (
                    <Link to={href("/sales/invoices", { create: "adjustment" })}>
                      {step.label}
                    </Link>
                  ) : (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => setActiveActionModal(step.actionType as any)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: "#00a165",
                          color: "white",
                          padding: "9px 14px",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: 13,
                        }}
                      >
                        {step.label}
                      </button>
                      <Link
                        to={href("/invoices/adjustments")}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          background: "#f8fafc",
                          color: "#334155",
                          border: "1px solid #cbd5e1",
                          padding: "8px 12px",
                          borderRadius: 4,
                          textDecoration: "none",
                          fontSize: 12.5,
                          fontWeight: 500,
                        }}
                      >
                        Danh sách HĐ sai sót →
                      </Link>
                    </div>
                  )}
                </div>
              </article>
            ))}

            {highlightNote && (
              <div
                style={{
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  color: "#92400e",
                  padding: "10px 14px",
                  borderRadius: 6,
                  fontSize: 13,
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                }}
              >
                <AlertTriangle
                  size={16}
                  color="#d97706"
                  style={{ flexShrink: 0, marginTop: 2 }}
                />
                <span>
                  <b>{highlightNote}</b>
                </span>
              </div>
            )}

            <button
              type="button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: 6,
                color: "#1d4ed8",
                cursor: "pointer",
                padding: "7px 14px",
                fontWeight: 600,
                fontSize: 13,
                marginTop: 8,
                boxShadow: "0 1px 2px rgba(37,99,235,0.05)",
              }}
              onClick={() => setLegalModalOpen(true)}
            >
              <BookOpen size={14} /> Xem hướng dẫn quy chuẩn Nghị định 123 &
              Thông tư 78
            </button>
          </section>
        </div>
      </div>
    );

  return (
    <div className="iw-process">
      {renderLegalModal()}
      <div className="iw-rule">
        Quản lý và phát hành hóa đơn theo:{" "}
        <button
          type="button"
          onClick={() => setLegalModalOpen(true)}
          style={{
            cursor: "pointer",
            background: "#eff6ff",
            color: "#1d4ed8",
            border: "1px solid #bfdbfe",
            borderRadius: 6,
            padding: "4px 10px",
            fontWeight: 600,
            fontSize: 12.5,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
          title="Bấm để xem chi tiết căn cứ pháp lý NĐ 123 và TT 78"
        >
          <BookOpen size={13} /> Nghị định 123/2020/NĐ-CP & TT 78/2021/TT-BTC
        </button>
      </div>
      <div className="iw-process-grid">
        <section className="iw-business">
          <h2>NGHIỆP VỤ HÓA ĐƠN ĐIỆN TỬ</h2>
          <div className="iw-flow">
            <svg viewBox={`0 0 ${FLOW_W} ${FLOW_H}`} aria-hidden="true">
              <defs>
                <marker
                  id="iw-arrow"
                  viewBox="0 0 10 10"
                  markerWidth="12"
                  markerHeight="12"
                  refX="9"
                  refY="5"
                  orient="auto-start-reverse"
                  markerUnits="userSpaceOnUse"
                >
                  <path d="M0 0 L10 5 L0 10 Z" fill="#8a929b" />
                </marker>
              </defs>
              {flowConnectors.map((d, index) => (
                <path
                  key={d}
                  d={d}
                  fill="none"
                  stroke="#a1a6ad"
                  strokeWidth="1.5"
                  markerEnd={flowArrowed.has(index) ? "url(#iw-arrow)" : undefined}
                />
              ))}
            </svg>
            {flowNodes.map(([label, path, x, y, labelAbove]) => (
              <Link
                key={label}
                className={labelAbove ? "label-above" : undefined}
                to={href("/invoices/" + path)}
                style={{ left: `${(x / FLOW_W) * 100}%`, top: `${(y / FLOW_H) * 100}%` }}
              >
                <span className="iw-flow-icon">
                  <Monitor size={35} />
                  <FileText size={21} />
                </span>
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </section>
        <aside className="iw-reports">
          <h2>BÁO CÁO</h2>
          {[
            "Bảng kê hóa đơn đã sử dụng",
            "Thống kê số lượng hóa đơn đã phát hành",
            "Danh sách hóa đơn điều chỉnh/ thay thế",
            "Danh sách Hủy hóa đơn (NĐ 123/2020/NĐ-CP)",
          ].map((label) => (
            <Link key={label} to={href("/invoices/reports")}>
              •　{label}
            </Link>
          ))}
          <Link className="iw-all-reports" to={href("/invoices/reports")}>
            Tất cả báo cáo
          </Link>
        </aside>
      </div>
      <footer>
        {[
          {
            label: "Hộp thư hóa đơn đầu vào",
            sub: "Tiếp nhận & kiểm tra file XML",
            targetPath: "/invoices/incoming/inbox",
            Icon: Inbox,
          },
          {
            label: "Hướng dẫn xử lý HĐ đã lập sai",
            sub: "Tra cứu quy trình NĐ 123 & NĐ 70",
            targetPath: "/invoices/error-guide",
            Icon: BookOpen,
          },
          {
            label: "Hóa đơn điều chỉnh & Thay thế",
            sub: "Quản lý biên bản & mẫu 04/SS-HĐĐT",
            targetPath: "/invoices/adjustments",
            Icon: FileSignature,
          },
          {
            label: "Tra cứu hóa đơn điện tử",
            sub: "Tìm kiếm & đối soát trạng thái HĐ",
            targetPath: "/invoices/lookup",
            Icon: Search,
          },
        ].map(({ label, sub, targetPath, Icon }) => (
          <Link key={label} to={href(targetPath)} className="iw-footer-link">
            <span className="iw-footer-icon">
              <Icon size={20} />
            </span>
            <span className="iw-footer-text">
              <strong>{label}</strong>
              <small>{sub}</small>
            </span>
          </Link>
        ))}
      </footer>
    </div>
  );
}
