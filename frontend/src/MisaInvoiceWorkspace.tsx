import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FileText, Monitor } from "lucide-react";
import { apiClient } from "./apiClient";
import "./misa-invoice-workspace.css";
const flowNodes = [
  ["Đăng ký/ Thay đổi thông tin sử dụng HĐĐT", "meinvoice", 10, 28],
  ["Khởi tạo mẫu", "outgoing", 10, 68],
  ["Xuất và gửi hóa đơn", "outgoing", 29, 49],
  ["Thông báo hóa đơn lập sai", "adjustments", 57, 20],
  ["Xử lý hóa đơn không hợp lệ", "adjustments", 45, 68],
  ["Biên bản điều chỉnh/ thay thế hóa đơn", "adjustments", 68, 68],
  ["Lập hóa đơn thay thế", "adjustments", 89, 20],
  ["Lập hóa đơn điều chỉnh", "adjustments", 89, 68],
] as const;
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
}: {
  tab: string;
  href: (path: string) => string;
  notify: (text: string) => void;
}) {
  const [kind, setKind] = useState(""),
    [sent, setSent] = useState(""),
    [fault, setFault] = useState(""),
    [action, setAction] = useState("");
  const [taxCode, setTaxCode] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    apiClient
      .get<any>("/api/v1/tax/connectors/")
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.results || [];
        const first = list[0];
        if (first) {
          if (first.tax_code) setTaxCode(String(first.tax_code));
          if (first.username) setEmail(String(first.username));
        }
      })
      .catch(() => {});
  }, []);
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
  if (tab === "meinvoice")
    return (
      <div className="iw-connect">
        <section>
          <div className="iw-brand">meInvoice</div>
          <h1>
            Kết nối phần mềm
            <br />
            Hóa đơn điện tử MeInvoice.VN
          </h1>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!taxCode.trim() || !email.trim() || !password) {
                setError("Vui lòng nhập đầy đủ thông tin kết nối.");
                return;
              }
              setError("");
              apiClient
                .post("/api/v1/tax/connectors/", {
                  provider_code: "MEINVOICE",
                  provider_name: "MISA meInvoice.VN",
                  endpoint_url: "https://www.meinvoice.vn",
                  tax_code: taxCode.trim(),
                  username: email.trim(),
                  is_active: true,
                })
                .catch(() => {});
              setPassword("");
              notify("Thông tin kết nối đã được kiểm tra và lưu lên hệ thống.");
            }}
          >
            <input
              aria-label="Mã số thuế"
              placeholder="Mã số thuế"
              value={taxCode}
              onInput={(e) => setTaxCode(e.currentTarget.value)}
              onChange={(e) => setTaxCode(e.target.value)}
            />
            <input
              aria-label="Email hoặc số điện thoại"
              placeholder="Email hoặc số điện thoại"
              value={email}
              onInput={(e) => setEmail(e.currentTarget.value)}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              aria-label="Mật khẩu"
              placeholder="Mật khẩu"
              type="password"
              autoComplete="off"
              value={password}
              onInput={(e) => setPassword(e.currentTarget.value)}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <p role="alert" className="iw-error">
                {error}
              </p>
            )}
            <p>
              Bạn chưa có tài khoản MeInvoice?{" "}
              <a
                href="https://www.meinvoice.vn/"
                target="_blank"
                rel="noreferrer"
              >
                Mua ngay tại đây
              </a>
            </p>
            <button>Kết nối</button>
          </form>
        </section>
        <aside>
          <h2>Phần mềm hóa đơn điện tử MeInvoice</h2>
          <div className="iw-connect-art">
            <Monitor size={110} />
            <FileText size={52} />
          </div>
          <p>Quản lý, lập và phát hành hóa đơn điện tử.</p>
          <p>Tiết kiệm chi phí in ấn, lưu trữ và bảo quản hóa đơn.</p>
          <a href="https://www.meinvoice.vn/" target="_blank" rel="noreferrer">
            Xem thêm
          </a>
        </aside>
      </div>
    );
  if (tab === "error-guide")
    return (
      <div className="iw-guide">
        <header>
          <h1>Tra cứu cách xử lý HĐ đã lập sai</h1>
          <p>
            Cung cấp thông tin về hóa đơn đã lập sai của bạn, hệ thống sẽ hướng
            dẫn cách xử lý phù hợp.
          </p>
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
                      <Link to={href("/invoices/adjustments")}>{label}</Link>
                    </div>
                  </article>
                ))}
                {fault === faults[0] && (
                  <p>
                    <b>Lưu ý: Không cần lập lại hóa đơn</b>
                  </p>
                )}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    alert("Tài liệu hướng dẫn xử lý hóa đơn điện tử Sổ Việt e-Invoice");
                  }}
                >
                  Xem hướng dẫn chi tiết
                </a>
              </>
            )}
          </section>
        </div>
      </div>
    );
  return (
    <div className="iw-process">
      <div className="iw-rule">
        Quản lý và phát hành hóa đơn theo:{" "}
        <button>Nghị định 254/2026/NĐ-CP</button>
      </div>
      <div className="iw-process-grid">
        <section className="iw-business">
          <h2>NGHIỆP VỤ HÓA ĐƠN ĐIỆN TỬ</h2>
          <div className="iw-flow">
            <svg
              viewBox="0 0 760 420"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <marker
                  id="iw-arrow"
                  markerWidth="5"
                  markerHeight="5"
                  refX="4"
                  refY="2.5"
                  orient="auto"
                >
                  <path d="M0 0 L5 2.5 L0 5" fill="#9ba2a9" />
                </marker>
              </defs>
              <path
                d="M130 120 Q160 120 160 165 L160 250 Q160 280 130 280 M160 200 L220 200 M300 200 L740 200 M435 200 L435 125 M342 200 L342 265 M516 200 L516 265 M675 200 L675 125 M675 200 L675 265"
                fill="none"
                stroke="#a1a6ad"
                strokeWidth="1"
                markerEnd="url(#iw-arrow)"
              />
            </svg>
            {flowNodes.map(([label, path, left, top]) => (
              <Link
                key={label}
                to={href("/invoices/" + path)}
                style={{ left: `${left}%`, top: `${top}%` }}
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
          "Thiết lập Email gửi HĐ",
          "Thiết lập chữ ký số",
          "Lịch sử truyền nhận với TCT",
          "Tùy chọn",
        ].map((label) => (
          <button key={label} onClick={() => notify(label)}>
            <FileText size={18} />
            <span>{label}</span>
          </button>
        ))}
      </footer>
    </div>
  );
}
