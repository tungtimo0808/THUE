import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileCheck2,
  History,
  Lock,
  LogOut,
  MapPin,
  Server,
  Settings,
  Sparkles,
  User,
} from "lucide-react";
import { useApiSession } from "./ApiSession";
import "./live-account.css";

export default function LiveSession() {
  const navigate = useNavigate();
  const { token, companyId, companies, signOut } = useApiSession();

  const activeCompany = useMemo(() => {
    return companies.find((c) => c.id === companyId) || companies[0] || null;
  }, [companies, companyId]);

  const rawSession = useMemo(() => {
    try {
      const raw = localStorage.getItem("erp_api_session");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const user = rawSession?.user || {
    id: "17",
    username: "admin",
    display_name: "Đỗ Đức Tùng",
    email: "tungtimo0808@gmail.com",
  };

  const branchLabel = useMemo(() => {
    try {
      const b = localStorage.getItem("ref_branch");
      return b === "hcm" ? "Chi nhánh TP. HCM" : "Trụ sở chính (Toàn doanh nghiệp)";
    } catch {
      return "Trụ sở chính";
    }
  }, []);

  const datasetLabel = useMemo(() => {
    try {
      const d = localStorage.getItem("ref_dataset");
      return d === "management-2026" ? "Dữ liệu quản trị 2026" : "Dữ liệu kế toán chính thức 2026";
    } catch {
      return "Dữ liệu kế toán 2026";
    }
  }, []);

  const regimeLabel = useMemo(() => {
    const raw = String((activeCompany as any)?.accounting_regime || "TT99").toUpperCase();
    if (raw.includes("133")) return "Thông tư 133/2016/TT-BTC (Doanh nghiệp nhỏ và vừa)";
    if (raw.includes("200")) return "Thông tư 200/2014/TT-BTC (Doanh nghiệp)";
    return "Thông tư 99/2025/TT-BTC (Chuẩn mực BCTC & Kế toán mới)";
  }, [activeCompany]);

  async function handleLogout() {
    await signOut();
    navigate("/login");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "24px 20px 48px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Top Header Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 24,
            background: "#ffffff",
            padding: "12px 20px",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => navigate("/")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                background: "#0284c7",
                color: "#ffffff",
                border: "none",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
              }}
            >
              <ArrowLeft size={16} /> Bàn làm việc Kế toán
            </button>
            <span style={{ fontSize: 13, color: "#64748b" }}>/</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Phiên làm việc hiện tại</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                background: token ? "#ecfdf5" : "#fef2f2",
                color: token ? "#047857" : "#b91c1c",
                border: `1px solid ${token ? "#a7f3d0" : "#fecaca"}`,
              }}
            >
              <CheckCircle2 size={13} /> {token ? "Đang kết nối máy chủ" : "Chưa đăng nhập"}
            </span>
          </div>
        </div>

        {/* Main Grid Content */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: 20 }}>
          {/* Card 1: Người dùng hiện tại */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, borderBottom: "1px solid #f1f5f9", paddingBottom: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "#e0f2fe",
                  display: "grid",
                  placeItems: "center",
                  color: "#0284c7",
                }}
              >
                <User size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Thông tin tài khoản</h3>
                <span style={{ fontSize: 12, color: "#64748b" }}>Người dùng đang đăng nhập hệ thống</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>Họ và tên:</span>
                <strong style={{ fontSize: 14, color: "#0f172a" }}>{user.display_name || user.username}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>Tên đăng nhập / Email:</span>
                <span style={{ fontSize: 13, color: "#1e293b", fontWeight: 500 }}>{user.email || user.username}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>Vai trò hệ thống:</span>
                <span
                  style={{
                    padding: "2px 10px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    background: "#fef3c7",
                    color: "#b45309",
                    border: "1px solid #fde68a",
                  }}
                >
                  👑 Quản trị doanh nghiệp / Kế toán trưởng
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>Trạng thái tài khoản:</span>
                <span style={{ fontSize: 12, color: "#15803d", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <CheckCircle2 size={13} /> Đang hoạt động bình thường
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Doanh nghiệp & Chi nhánh đang làm việc */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, borderBottom: "1px solid #f1f5f9", paddingBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "#ecfdf5",
                    display: "grid",
                    placeItems: "center",
                    color: "#059669",
                  }}
                >
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Doanh nghiệp & Đơn vị</h3>
                  <span style={{ fontSize: 12, color: "#64748b" }}>Phạm vi chứng từ & sổ sách</span>
                </div>
              </div>
              <Link
                to="/select-company"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#0284c7",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                Đổi doanh nghiệp →
              </Link>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>Doanh nghiệp:</span>
                <strong style={{ fontSize: 14, color: "#0f172a", textAlign: "right", maxWidth: "60%" }}>
                  {activeCompany?.name || "Công ty TNHH Tunghihihi"}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>Mã số thuế (MST):</span>
                <code style={{ fontSize: 13, color: "#0f172a", fontWeight: 700 }}>
                  {activeCompany?.tax_code || "0110888999"}
                </code>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>Chi nhánh / Đơn vị:</span>
                <span style={{ fontSize: 13, color: "#0284c7", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <MapPin size={13} /> {branchLabel}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>Chế độ kế toán:</span>
                <span style={{ fontSize: 12, color: "#047857", fontWeight: 600, background: "#ecfdf5", padding: "2px 8px", borderRadius: 4 }}>
                  {regimeLabel}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>Tập dữ liệu:</span>
                <span style={{ fontSize: 13, color: "#334155" }}>{datasetLabel}</span>
              </div>
            </div>
          </div>

          {/* Card 3: Trạng thái hoạt động & An toàn dữ liệu */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, borderBottom: "1px solid #f1f5f9", paddingBottom: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "#f3e8ff",
                  display: "grid",
                  placeItems: "center",
                  color: "#9333ea",
                }}
              >
                <Server size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Trạng thái hoạt động</h3>
                <span style={{ fontSize: 12, color: "#64748b" }}>Kết nối máy chủ và an toàn dữ liệu</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>Máy chủ phần mềm:</span>
                <span style={{ fontSize: 12, color: "#15803d", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <CheckCircle2 size={13} /> Đang kết nối ổn định
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>Dữ liệu chứng từ:</span>
                <span style={{ fontSize: 12, color: "#0284c7", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <FileCheck2 size={13} /> Đồng bộ trực tuyến
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>Lịch sử thao tác:</span>
                <span style={{ fontSize: 12, color: "#047857", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <History size={13} /> Tự động lưu nhật ký kiểm toán
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>Bảo mật dữ liệu:</span>
                <span style={{ fontSize: 12, color: "#334155", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Lock size={13} /> Đã bảo vệ an toàn
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Thao tác điều hướng nhanh */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, borderBottom: "1px solid #f1f5f9", paddingBottom: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "#fff7ed",
                  display: "grid",
                  placeItems: "center",
                  color: "#ea580c",
                }}
              >
                <Sparkles size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Lối tắt thao tác</h3>
                <span style={{ fontSize: 12, color: "#64748b" }}>Chuyển đổi phân hệ làm việc</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button
                type="button"
                onClick={() => navigate("/")}
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "10px 16px",
                  borderRadius: 8,
                  background: "#0284c7",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
                }}
              >
                <Sparkles size={16} /> Vào bàn làm việc Kế toán
              </button>

              <button
                type="button"
                onClick={() => navigate("/select-company")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "#f8fafc",
                  border: "1px solid #cbd5e1",
                  color: "#334155",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Building2 size={14} /> Đổi doanh nghiệp
              </button>

              <button
                type="button"
                onClick={() => navigate("/scope")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "#f8fafc",
                  border: "1px solid #cbd5e1",
                  color: "#334155",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <MapPin size={14} /> Đổi chi nhánh
              </button>

              <button
                type="button"
                onClick={() => navigate("/admin")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "#f8fafc",
                  border: "1px solid #cbd5e1",
                  color: "#334155",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Settings size={14} /> Quản trị doanh nghiệp
              </button>

              <button
                type="button"
                onClick={handleLogout}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "#fff1f2",
                  border: "1px solid #fecdd3",
                  color: "#e11d48",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <LogOut size={14} /> Đăng xuất tài khoản
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
