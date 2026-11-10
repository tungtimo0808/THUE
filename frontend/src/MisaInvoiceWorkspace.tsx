import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import { FileText, Monitor, BookOpen, X, CheckCircle2 } from "lucide-react";
import { apiClient } from "./apiClient";
import "./misa-invoice-workspace.css";
// Flow diagram geometry, in the same 1000×460 coordinate space as the SVG viewBox. The box keeps
// that aspect ratio (see .iw-flow), so node positions (icon centers) and connectors stay aligned.
const FLOW_W = 1000;
const FLOW_H = 460;
const flowNodes = [
  // [label, route, x, y, label above icon]
  ["Tự động lấy hóa đơn từ TCT", "sync", 100, 150, true],
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
  const { token } = useApiSession();
  const [kind, setKind] = useState(""),
    [sent, setSent] = useState(""),
    [fault, setFault] = useState(""),
    [action, setAction] = useState("");
  const [legalModalOpen, setLegalModalOpen] = useState(false);

  const steps =
    fault === faults[0]
      ? [
          [
            "Gửi thông báo cho người mua về việc hóa đơn đã lập sai.",
            "Gửi thông báo giải trình",
          ],
          [
            "Gửi thông báo HĐĐT đã lập sai theo mẫu số 04/SS-HĐĐT đến CQT.",
            "Lập thông báo HĐ lập sai",
          ],
        ]
      : action
        ? [
            [
              `Lập văn bản thỏa thuận ghi rõ nội dung sai và gửi đến người mua trước khi lập hóa đơn ${action === "Thay thế hóa đơn" ? "thay thế" : "điều chỉnh"}.`,
              "Lập biên bản",
            ],
            [
              `Lập hóa đơn ${action === "Thay thế hóa đơn" ? "thay thế" : "điều chỉnh"} gửi CQT cấp mã để gửi cho người mua.`,
              action === "Thay thế hóa đơn"
                ? "Lập hóa đơn thay thế"
                : "Lập hóa đơn điều chỉnh",
            ],
          ]
        : [];

  const renderLegalModal = () => (
    legalModalOpen && (
      <div className="ce-overlay" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 9999, display: "grid", placeItems: "center", padding: 20 }}>
        <div style={{ background: "#fff", borderRadius: 10, maxWidth: 680, width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
              <BookOpen size={18} color="#2563eb" />
              Quy chuẩn xử lý HĐĐT (NĐ 123/2020/NĐ-CP & TT 78/2021/TT-BTC)
            </h3>
            <button type="button" onClick={() => setLegalModalOpen(false)} style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}>
              <X size={18} />
            </button>
          </div>
          <div style={{ padding: "20px", fontSize: 13.5, lineHeight: 1.6, color: "#334155" }}>
            <div style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: 8, marginBottom: 16, borderLeft: "4px solid #2563eb" }}>
              <b>Căn cứ pháp lý:</b> Điều 19 Nghị định số 123/2020/NĐ-CP và Điều 7 Thông tư số 78/2021/TT-BTC về xử lý hóa đơn điện tử đã lập có sai sót.
            </div>

            <h4 style={{ color: "#1e293b", margin: "14px 0 6px" }}>1. Người bán tự phát hiện sai sót chưa gửi người mua</h4>
            <p style={{ margin: "0 0 10px" }}>Người bán thực hiện hủy hóa đơn đã lập có sai sót và lập hóa đơn điện tử mới, ký số gửi cơ quan thuế để cấp mã hóa đơn mới thay thế hóa đơn đã lập.</p>

            <h4 style={{ color: "#1e293b", margin: "14px 0 6px" }}>2. Sai tên, địa chỉ người mua nhưng không sai mã số thuế & số tiền</h4>
            <p style={{ margin: "0 0 10px" }}>Người bán thông báo cho người mua về việc hóa đơn có sai sót và <b>không phải lập lại hóa đơn</b>. Người bán thực hiện thông báo với CQT theo <b>Mẫu số 04/SS-HĐĐT</b>.</p>

            <h4 style={{ color: "#1e293b", margin: "14px 0 6px" }}>3. Sai mã số thuế, số tiền, thuế suất hoặc quy cách hàng hóa</h4>
            <p style={{ margin: "0 0 6px" }}>Người bán được lựa chọn 1 trong 2 phương án:</p>
            <ul style={{ margin: "0 0 10px", paddingLeft: 20 }}>
              <li><b>Lập hóa đơn điều chỉnh:</b> Ghi rõ 'Điều chỉnh (tăng/giảm) số lượng, đơn giá, thuế suất... cho hóa đơn Mẫu số... Ký hiệu... Số... Ngày...'. Hóa đơn điều chỉnh ghi dấu (+) hoặc (-) tương ứng.</li>
              <li><b>Lập hóa đơn thay thế:</b> Ghi rõ 'Thay thế cho hóa đơn Mẫu số... Ký hiệu... Số... Ngày...'. Hai bên lập văn bản thỏa thuận trước khi phát hành hóa đơn thay thế.</li>
            </ul>

            <h4 style={{ color: "#1e293b", margin: "14px 0 6px" }}>4. Xử lý khi nhận được Thông báo rà soát từ Cơ quan thuế</h4>
            <p style={{ margin: "0 0 10px" }}>Khi cơ quan thuế gửi Mẫu 01/TB-RSĐT, doanh nghiệp cần rà soát và nộp Mẫu 04/SS-HĐĐT theo đúng thời hạn ghi trên thông báo để giải trình hoặc hủy/điều chỉnh kịp thời.</p>
          </div>
          <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end" }}>
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
    )
  );

  if (tab === "error-guide")
    return (
      <div className="iw-guide">
        {renderLegalModal()}
        <header>
          <h1>Tra cứu cách xử lý HĐ đã lập sai</h1>
          <p>
            Cung cấp thông tin về hóa đơn đã lập sai của bạn, hệ thống sẽ hướng
            dẫn cách xử lý phù hợp.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
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
                      setSent("");
                      setFault("");
                      setAction("");
                    }}
                  />
                  {value}
                </label>
              ))}
            </fieldset>
            {kind && (
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
                        setFault("");
                        setAction("");
                      }}
                    />
                    {value}
                  </label>
                ))}
              </fieldset>
            )}
            {sent && (
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
                        setAction("");
                      }}
                    />
                    {value}
                  </label>
                ))}
              </fieldset>
            )}
          </section>
          <section className="iw-guide-result">
            {!fault ? (
              <p className="iw-guide-empty">
                Vui lòng chọn thông tin ở mục tra cứu bên trái để xem hướng dẫn
                phù hợp
              </p>
            ) : (
              <>
                {fault === faults[0] ? (
                  <h2>Xử lý hóa đơn sai sót với 2 bước đơn giản</h2>
                ) : (
                  <>
                    <h2>Lựa chọn cách xử lý hóa đơn phù hợp</h2>
                    <div className="iw-guide-actions">
                      {["Thay thế hóa đơn", "Điều chỉnh hóa đơn"].map(
                        (value) => (
                          <label key={value}>
                            <input
                              type="radio"
                              name="invoice-resolution"
                              checked={action === value}
                              onChange={() => setAction(value)}
                            />
                            {value}
                          </label>
                        ),
                      )}
                    </div>
                  </>
                )}
                {steps.map(([text, label], index) => (
                  <article key={label}>
                    <b>{index + 1}</b>
                    <div>
                      <p>{text}</p>
                      <Link to={label === "Lập hóa đơn thay thế"
                        ? href("/sales/invoices", { create: "replacement" })
                        : label === "Lập hóa đơn điều chỉnh"
                          ? href("/sales/invoices", { create: "adjustment" })
                          : href("/invoices/adjustments")}>{label}</Link>
                    </div>
                  </article>
                ))}
                {fault === faults[0] && (
                  <p>
                    <b>Lưu ý: Không cần lập lại hóa đơn</b>
                  </p>
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
                    marginTop: 12,
                    boxShadow: "0 1px 2px rgba(37,99,235,0.05)",
                  }}
                  onClick={() => setLegalModalOpen(true)}
                >
                  <BookOpen size={14} /> Xem hướng dẫn quy chuẩn Nghị định 123 & Thông tư 78
                </button>
              </>
            )}
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
          ["Tự động lấy hóa đơn từ TCT", "/invoices/sync"],
          ["Hộp thư hóa đơn đầu vào", "/invoices/incoming/inbox"],
          ["Hóa đơn điều chỉnh & Thay thế", "/invoices/adjustments"],
          ["Tra cứu hóa đơn điện tử", "/invoices/lookup"],
        ].map(([label, targetPath]) => (
          <Link key={label} to={href(targetPath)}>
            <FileText size={18} />
            <span>{label}</span>
          </Link>
        ))}
      </footer>
    </div>
  );
}
