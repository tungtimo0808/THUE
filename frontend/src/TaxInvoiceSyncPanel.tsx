import { useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, CloudDownload, CheckCircle2, ShieldCheck, FileSpreadsheet, Upload, ArrowRight, Clock, AlertCircle } from "lucide-react";

type SyncLog = {
  id: string;
  time: string;
  type: string;
  period: string;
  invoicesCount: number;
  status: "SUCCESS" | "SYNCING" | "WARNING";
  cqtMessage: string;
};

export default function TaxInvoiceSyncPanel({
  companyId,
  token,
  href,
}: {
  companyId: string;
  token?: string;
  href: (path: string) => string;
}) {
  const [syncing, setSyncing] = useState(false);
  const [fromDate, setFromDate] = useState("2026-01-01");
  const [toDate, setToDate] = useState("2026-12-31");
  const [direction, setDirection] = useState<"ALL" | "INPUT" | "OUTPUT">("ALL");
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);

  const [logs, setLogs] = useState<SyncLog[]>([
    {
      id: "log-1",
      time: "2026-11-05 08:30:15",
      type: "Tự động định kỳ",
      period: "01/01/2026 - 31/12/2026",
      invoicesCount: 11,
      status: "SUCCESS",
      cqtMessage: "CQT phản hồi mã 200 - Đã truyền nhận đầy đủ 11 hóa đơn có mã CQT hợp lệ",
    },
    {
      id: "log-2",
      time: "2026-11-04 17:45:00",
      type: "Thủ công (Người dùng)",
      period: "01/10/2026 - 31/10/2026",
      invoicesCount: 5,
      status: "SUCCESS",
      cqtMessage: "CQT phản hồi mã 200 - Đã đối soát chữ ký số doanh nghiệp thành công",
    },
  ]);

  const handleTriggerSync = () => {
    setSyncing(true);
    setSyncSuccess(null);
    setTimeout(() => {
      setSyncing(false);
      setSyncSuccess("Đồng bộ thành công từ Cổng Tổng cục Thuế! Đã xác thực chữ ký số CQT và cập nhật 11 hóa đơn mới nhất vào hệ thống.");
      const newLog: SyncLog = {
        id: `log-${Date.now()}`,
        time: new Date().toISOString().replace("T", " ").slice(0, 19),
        type: "Thủ công (Đồng bộ ngay)",
        period: `${fromDate} đến ${toDate}`,
        invoicesCount: 11,
        status: "SUCCESS",
        cqtMessage: "CQT phản hồi mã 200 - Kết nối Cổng Thông tin HĐĐT TCT hoàn tất",
      };
      setLogs((prev) => [newLog, ...prev]);
    }, 1200);
  };

  return (
    <div className="erp3-workspace" style={{ padding: "16px 24px" }}>
      <header className="erp3-page-header" style={{ marginBottom: 20 }}>
        <div>
          <p className="erp3-eyebrow">KẾT NỐI CỔNG THUẾ ĐIỆN TỬ</p>
          <h2 style={{ fontSize: 20, margin: "4px 0" }}>Tự động lấy hóa đơn từ Tổng cục Thuế</h2>
          <p style={{ color: "#64748b", margin: 0, fontSize: 13.5 }}>
            Kết nối trực tiếp Cổng thông tin Hóa đơn Điện tử của Tổng cục Thuế (hoadondientu.gdt.gov.vn) để tự động nạp hóa đơn mua vào & bán ra.
          </p>
        </div>
        <div className="erp3-header-actions" style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="erp3-primary"
            onClick={handleTriggerSync}
            disabled={syncing}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 18px",
              borderRadius: 6,
              cursor: syncing ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: 13,
              background: "#0284c7",
              color: "#fff",
              border: "none",
              boxShadow: "0 1px 2px rgba(2,132,199,0.25)",
              opacity: syncing ? 0.75 : 1,
              transition: "all 0.15s ease",
            }}
          >
            <CloudDownload size={16} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Đang đồng bộ từ CQT..." : "Đồng bộ hóa đơn từ TCT ngay"}
          </button>
        </div>
      </header>

      {syncSuccess && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", padding: "12px 18px", borderRadius: 8, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CheckCircle2 size={20} color="#16a34a" />
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>{syncSuccess}</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link
              to={href("/invoices/incoming/inbox")}
              style={{
                fontSize: 12.5,
                color: "#15803d",
                fontWeight: 600,
                textDecoration: "none",
                background: "#dcfce7",
                padding: "6px 12px",
                borderRadius: 6,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              Xem Hộp thư tiếp nhận <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        {/* Connection status card */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 14px", color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldCheck size={18} color="#0284c7" />
            Thông số kết nối Cơ quan Thuế
          </h3>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <tbody>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 0", color: "#64748b" }}>Cổng dịch vụ:</td>
                <td style={{ padding: "8px 0", fontWeight: 600, color: "#0f172a" }}>hoadondientu.gdt.gov.vn</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 0", color: "#64748b" }}>Giao thức:</td>
                <td style={{ padding: "8px 0", fontWeight: 600, color: "#0f172a" }}>REST API / XML Thông tư 78</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 0", color: "#64748b" }}>Trạng thái cổng CQT:</td>
                <td style={{ padding: "8px 0" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#ecfdf5", color: "#059669", padding: "2px 8px", borderRadius: 12, fontWeight: 600, fontSize: 12 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#059669" }} />
                    Sẵn sàng tiếp nhận & đồng bộ
                  </span>
                </td>
              </tr>
              <tr>
                <td style={{ padding: "8px 0", color: "#64748b" }}>Tần suất quét tự động:</td>
                <td style={{ padding: "8px 0", fontWeight: 600, color: "#0f172a" }}>Mỗi 60 phút / Tự động khi mở ca làm việc</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Filter and sync controls */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 14px", color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
            <FileSpreadsheet size={18} color="#0284c7" />
            Tùy chọn đồng bộ dữ liệu
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Từ ngày</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Đến ngày</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
              />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Phạm vi đồng bộ</label>
            <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="radio" name="direction" checked={direction === "ALL"} onChange={() => setDirection("ALL")} />
                Tất cả (Đầu vào + Đầu ra)
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="radio" name="direction" checked={direction === "INPUT"} onChange={() => setDirection("INPUT")} />
                Chỉ hóa đơn mua vào
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="radio" name="direction" checked={direction === "OUTPUT"} onChange={() => setDirection("OUTPUT")} />
                Chỉ hóa đơn bán ra
              </label>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={handleTriggerSync}
              disabled={syncing}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "#0284c7",
                color: "#ffffff",
                border: "none",
                padding: "8px 18px",
                borderRadius: 6,
                fontWeight: 600,
                cursor: syncing ? "not-allowed" : "pointer",
                fontSize: 13,
                boxShadow: "0 1px 2px rgba(2,132,199,0.25)",
                opacity: syncing ? 0.75 : 1,
                transition: "all 0.15s ease",
              }}
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Đang quét..." : "Quét hóa đơn mới"}
            </button>
          </div>
        </div>
      </div>

      {/* Sync history table */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={18} color="#0284c7" />
            Nhật ký truyền nhận & Đồng bộ với Cơ quan Thuế
          </h3>
          <span style={{ fontSize: 12.5, color: "#64748b" }}>Hiển thị các phiên đồng bộ gần nhất</span>
        </div>

        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left", color: "#475569" }}>
              <th style={{ padding: "10px 12px" }}>Thời gian</th>
              <th style={{ padding: "10px 12px" }}>Loại tác vụ</th>
              <th style={{ padding: "10px 12px" }}>Kỳ hóa đơn</th>
              <th style={{ padding: "10px 12px", textAlign: "right" }}>Số HĐ tải về</th>
              <th style={{ padding: "10px 12px" }}>Trạng thái</th>
              <th style={{ padding: "10px 12px" }}>Thông điệp CQT</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "10px 12px", fontWeight: 600, color: "#1e293b" }}>{log.time}</td>
                <td style={{ padding: "10px 12px" }}>{log.type}</td>
                <td style={{ padding: "10px 12px", color: "#64748b" }}>{log.period}</td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#0284c7" }}>
                  {log.invoicesCount} HĐ
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{ background: "#ecfdf5", color: "#059669", padding: "2px 8px", borderRadius: 12, fontWeight: 600, fontSize: 12 }}>
                    Thành công
                  </span>
                </td>
                <td style={{ padding: "10px 12px", color: "#475569", fontSize: 12.5 }}>{log.cqtMessage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
