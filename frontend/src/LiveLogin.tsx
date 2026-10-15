import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import "./live-account.css";

export default function LiveLogin() {
  const { token, companies, companyId, signIn, signOut, selectCompany } = useApiSession();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { await signIn(identifier.trim(), password); setPassword(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không đăng nhập được."); }
    finally { setBusy(false); }
  }

  return <main className="account-page"><section className="account-card">
    <Link to="/">← Về ứng dụng</Link>
    <p className="account-eyebrow">COM-03 / COM-04</p>
    <h1>{token ? "Phiên làm việc" : "Đăng nhập"}</h1>
    {error && <p className="account-error" role="alert">{error}</p>}
    {!token ? <>
      <form onSubmit={submit}>
        <label>Email hoặc số điện thoại<input value={identifier} onChange={event => setIdentifier(event.target.value)} autoComplete="username" required /></label>
        <label>Mật khẩu<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required /></label>
        <button type="submit" disabled={busy}>Đăng nhập</button>
      </form>
      <p><Link to="/account">Đăng ký tài khoản</Link> · <Link to="/reset-password">Quên mật khẩu?</Link></p>
    </> : <>
      {companies.length ? <>
        <p>Doanh nghiệp đang tham gia:</p>
        <label>Doanh nghiệp<select value={companyId} onChange={event => selectCompany(event.target.value)}>{companies.map(company =>
          <option key={company.id} value={company.id}>{company.name}</option>,
        )}</select></label>
      </> : <p>Bạn chưa tham gia doanh nghiệp nào. <Link to="/join">Tìm và gửi yêu cầu tham gia</Link>.</p>}
      <p><Link to="/directory?directory=Kh%C3%A1ch+h%C3%A0ng">Vào ứng dụng</Link></p>
      <p><Link to="/profile">Hồ sơ cá nhân và đổi mật khẩu</Link></p>
      <p><Link to="/scope">Chuyển phạm vi làm việc</Link></p>
      <p><Link to="/common">Thông báo, tìm kiếm, việc cần xử lý và AI</Link></p>
      <p><Link to="/company-setup">Khởi tạo doanh nghiệp</Link></p>
      <p><Link to="/company-profile">Thông tin doanh nghiệp</Link></p>
      <p><Link to="/organization-structure">Cơ cấu tổ chức</Link></p>
      <p><Link to="/join-requests-admin">Xử lý yêu cầu tham gia</Link></p>
      <p><Link to="/company-users">Người dùng doanh nghiệp</Link></p>
      <p><Link to="/roles">Quản lý Role</Link></p>
      <p><Link to="/permissions">Phân quyền Role và User</Link></p>
      <p><Link to="/data-scopes">Thiết lập Data Scope</Link></p>
      <p><Link to="/organization-assignments">Phân công người dùng vào đơn vị</Link></p>
      <p><Link to="/workflows">Quản lý Workflow phê duyệt</Link></p>
      <p><Link to="/approval-tasks">Xử lý yêu cầu phê duyệt</Link></p>
      <p><Link to="/modules">Cấu hình phân hệ sử dụng</Link></p>
      <p><Link to="/numbering-rules">Đánh số chứng từ</Link></p>
      <p><Link to="/fiscal-periods">Kỳ kế toán</Link></p>
      <p><Link to="/accounting-policies">Chính sách kế toán</Link></p>
      <p><Link to="/audit-logs">Audit Log</Link></p>
      <p><Link to="/user-access">Khóa và ngừng quyền người dùng</Link></p>
      <p><Link to="/vendors">Nhà cung cấp</Link></p>
      <p><Link to="/employees">Nhân viên</Link></p>
      <p><Link to="/items">Vật tư, hàng hóa và dịch vụ</Link></p>
      <p><Link to="/item-categories">Nhóm hàng hóa, dịch vụ</Link></p>
      <p><Link to="/uoms">Đơn vị tính</Link></p>
      <p><Link to="/warehouses">Kho</Link></p>
      <p><Link to="/company-bank-accounts">Tài khoản ngân hàng công ty</Link></p>
      <p><Link to="/accounts">Hệ thống tài khoản kế toán</Link></p>
      <button type="button" onClick={signOut}>Đăng xuất</button>
    </>}
  </section></main>;
}
