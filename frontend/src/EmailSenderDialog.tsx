import { useState } from "react";
import "./report-schedule-dialog.css";

const providers = [
  "Gmail1",
  "Gmail2",
  "Hotmail",
  "Outlook mail",
  "Yahoo Mail1",
  "Yahoo Mail2",
  "Khác",
];
const providerDefaults: Record<
  string,
  { server: string; port: string; security: string }
> = {
  Gmail1: { server: "smtp.gmail.com", port: "587", security: "TLS" },
  Gmail2: { server: "smtp.gmail.com", port: "465", security: "SSL" },
  Hotmail: { server: "smtp.live.com", port: "25", security: "TLS" },
  "Outlook mail": { server: "smtp.office365.com", port: "25", security: "TLS" },
  "Yahoo Mail1": {
    server: "smtp.mail.yahoo.com",
    port: "587",
    security: "SSL",
  },
  "Yahoo Mail2": {
    server: "smtp.bizmail.yahoo.com",
    port: "465",
    security: "SSL",
  },
  Khác: { server: "", port: "", security: "Không" },
};

export default function EmailSenderDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  const [provider, setProvider] = useState("Gmail1");
  const [settings, setSettings] = useState(providerDefaults.Gmail1);
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100002,
        background: "#0006",
        display: "grid",
        placeItems: "center",
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        className="misa-report-schedule-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Thêm Thiết lập cấu hình gửi email"
        style={{
          width: "min(620px,90vw)",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: 24,
          background: "white",
          borderRadius: 4,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h2>Thêm Thiết lập cấu hình gửi email</h2>
          <button
            type="button"
            aria-label="Đóng cấu hình gửi email"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="misa-email-config-fields">
          <label>
            Nhà cung cấp *
            <select
              aria-label="Nhà cung cấp email"
              value={provider}
              onChange={(event) => {
                setProvider(event.target.value);
                setSettings({ ...providerDefaults[event.target.value] });
              }}
            >
              {providers.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <label>
            Máy chủ mail *
            <input
              aria-label="Máy chủ mail"
              value={settings.server}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  server: event.target.value,
                }))
              }
            />
          </label>
          <div style={{ display: advanced ? "contents" : "none" }}>
            <label>
              Cổng
              <input
                type="number"
                min={1}
                max={65535}
                aria-label="Cổng email"
                value={settings.port}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    port: event.target.value,
                  }))
                }
              />
            </label>
            <fieldset style={{ border: 0, padding: 0, margin: "12px 0" }}>
              <legend>Phương thức bảo mật *</legend>
              {["Không", "SSL", "TLS"].map((method) => (
                <label key={method}>
                  <input
                    type="radio"
                    name="email-sender-security"
                    value={method}
                    checked={settings.security === method}
                    onChange={() =>
                      setSettings((current) => ({
                        ...current,
                        security: method,
                      }))
                    }
                  />{" "}
                  {method}
                </label>
              ))}
            </fieldset>
          </div>
          <label>
            Tên người gửi
            <input aria-label="Tên người gửi" />
          </label>
          <label>
            Địa chỉ email gửi *
            <input type="email" aria-label="Địa chỉ email gửi" />
          </label>
          <label>
            Mật khẩu ứng dụng email *
            <input
              type="password"
              aria-label="Mật khẩu ứng dụng email"
              autoComplete="new-password"
            />
          </label>
        </div>
        <button
          type="button"
          aria-expanded={advanced}
          onClick={() => setAdvanced((value) => !value)}
        >
          {advanced ? "Thiết lập cơ bản" : "Thiết lập nâng cao"}
        </button>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
            marginTop: 20,
          }}
        >
          <button type="button" onClick={onClose}>
            Hủy
          </button>
          <button type="button">Kiểm tra cấu hình email</button>
          <button type="button" onClick={onClose}>
            Đồng ý
          </button>
        </div>
      </div>
    </div>
  );
}
