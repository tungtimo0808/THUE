import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./live-account.css";

type Lookup = { exists_on_system: boolean; company_name?: string; legal_name?: string; address?: string; province?: string; legal_representative?: string; business_type?: string; note?: string };
type NewCompany = { id: string; code: string; name: string; status: string; tax_code: string };

export default function LiveCompanyBootstrap() {
  const { token, refreshCompanies } = useApiSession();
  const [taxCode, setTaxCode] = useState("");
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [businessType, setBusinessType] = useState("LLC_ONE_MEMBER");
  const [address, setAddress] = useState("");
  const [province, setProvince] = useState("");
  const [representative, setRepresentative] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [fiscalMonth, setFiscalMonth] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const [created, setCreated] = useState<NewCompany | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function lookupTax(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setLookup(null);
    try {
      const result = await request<Lookup>(`/api/v1/common/companies/create/?tax_code=${encodeURIComponent(taxCode.replace(/\s/g, ""))}`, token);
      setLookup(result);
      if (!result.exists_on_system) {
        setLegalName(result.legal_name || ""); setAddress(result.address || "");
        setProvince(result.province || ""); setRepresentative(result.legal_representative || "");
        setBusinessType(result.business_type || "LLC_ONE_MEMBER");
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tra cứu được mã số thuế."); }
    finally { setBusy(false); }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await request<NewCompany>("/api/v1/common/companies/create/", token, {
        method: "POST",
        body: JSON.stringify({
          ...(code.trim() ? { code: code.trim() } : {}), name: name.trim() || legalName.trim(),
          legal_name: legalName.trim(), tax_code: taxCode.replace(/\s/g, ""),
          business_type: businessType, address: address.trim(), province: province.trim(),
          legal_representative: representative.trim(), phone: phone.trim(), email: email.trim(),
          confirmed_authority: confirmed, fiscal_year_start_month: fiscalMonth,
        }),
      });
      setCreated(result);
      await request("/api/v1/common/companies/complete-setup/", token, {
        method: "POST",
        body: JSON.stringify({ company_id: result.id }),
      }).catch(() => {});
      await refreshCompanies();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tạo được doanh nghiệp."); }
    finally { setBusy(false); }
  }

  return <main className="account-page"><section className="account-card account-wide">
    <Link to="/login">← Phiên làm việc</Link>
    <p className="account-eyebrow">SYS-01</p>
    <h1>Khởi tạo doanh nghiệp</h1>
    {!token ? <p>Bạn cần <Link to="/login">đăng nhập</Link> bằng tài khoản đã xác thực email.</p> : <>
      {error && <p className="account-error" role="alert">{error}</p>}
      {created ? <div role="status" className="account-message">
        <strong>Đã tạo {created.name}</strong><br />Mã {created.code} · Mã số thuế {created.tax_code} · Trạng thái {created.status}.
        <p><Link to="/company-profile">Tiếp tục thiết lập thông tin doanh nghiệp</Link></p>
      </div> : <>
        <form onSubmit={lookupTax}>
          <label>Mã số thuế<input value={taxCode} onChange={event => { setTaxCode(event.target.value); setLookup(null); }} pattern="[0-9]{10}(-[0-9]{3})?" required /></label>
          <button type="submit" disabled={busy}>Tra cứu mã số thuế</button>
        </form>
        {lookup?.exists_on_system ? <p className="account-message">{lookup.company_name} đã có trên hệ thống. <Link to="/join">Gửi yêu cầu tham gia</Link>.</p> : lookup && <>
          <p className="account-message">Thông tin tra cứu là gợi ý. Hãy kiểm tra và sửa theo giấy đăng ký doanh nghiệp trước khi tạo.</p>
          <form className="account-change-email" onSubmit={create}>
            <label>Mã doanh nghiệp (tùy chọn)<input value={code} onChange={event => setCode(event.target.value)} pattern="[A-Za-z0-9_-]+" maxLength={30} /></label>
            <label>Tên hiển thị<input value={name} onChange={event => setName(event.target.value)} /></label>
            <label>Tên pháp lý<input value={legalName} onChange={event => setLegalName(event.target.value)} required /></label>
            <label>Loại hình<select value={businessType} onChange={event => setBusinessType(event.target.value)}>
              <option value="LLC_ONE_MEMBER">TNHH một thành viên</option><option value="LLC_MULTI_MEMBER">TNHH nhiều thành viên</option>
              <option value="JOINT_STOCK">Công ty cổ phần</option><option value="PRIVATE_ENTERPRISE">Doanh nghiệp tư nhân</option>
              <option value="PARTNERSHIP">Công ty hợp danh</option><option value="OTHER">Khác</option>
            </select></label>
            <label>Địa chỉ đăng ký<input value={address} onChange={event => setAddress(event.target.value)} required /></label>
            <label>Tỉnh / thành phố<input value={province} onChange={event => setProvince(event.target.value)} required /></label>
            <label>Người đại diện pháp luật<input value={representative} onChange={event => setRepresentative(event.target.value)} required /></label>
            <label>Số điện thoại<input type="tel" value={phone} onChange={event => setPhone(event.target.value)} /></label>
            <label>Email doanh nghiệp<input type="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
            <label>Tháng bắt đầu năm tài chính<input type="number" min={1} max={12} value={fiscalMonth} onChange={event => setFiscalMonth(Number(event.target.value))} required /></label>
            <label className="account-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required /> Tôi xác nhận có quyền khởi tạo và quản lý doanh nghiệp này.</label>
            <button type="submit" disabled={busy}>Tạo doanh nghiệp</button>
          </form>
        </>}
      </>}
    </>}
  </section></main>;
}
