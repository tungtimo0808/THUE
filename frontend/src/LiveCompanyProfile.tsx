import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import { ApiError, request } from "./live-api";
import "./live-account.css";

type CompanyInfo = {
  id: string; code: string; tax_code: string; status: string; version: string;
  legal_name: string; short_name: string; name: string; business_type: string;
  legal_representative: string; representative_title: string; country_code: string;
  province: string; district: string; ward: string; address: string; phone: string;
  email: string; website: string; logo: string | null; timezone: string; default_locale: string;
};
type Editable = Omit<CompanyInfo, "id" | "code" | "tax_code" | "status" | "version" | "logo">;
type InfoResponse = { company: CompanyInfo; can_edit: boolean; pending_versions: { id: string; effective_from: string; status: string }[] };
const fields: (keyof Editable)[] = [
  "name", "short_name", "legal_name", "business_type", "legal_representative", "representative_title",
  "country_code", "province", "district", "ward", "address", "phone", "email", "website", "timezone", "default_locale",
];
const legalFields = new Set<keyof Editable>(["legal_name", "business_type", "legal_representative", "representative_title", "country_code", "province", "district", "ward", "address"]);
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });

export default function LiveCompanyProfile() {
  const { token, companies, companyId, selectCompany } = useApiSession();
  const [info, setInfo] = useState<InfoResponse | null>(null);
  const [draft, setDraft] = useState<Editable | null>(null);
  const [effective, setEffective] = useState(today);
  const [logo, setLogo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!token || !companyId) { setInfo(null); return; }
    let active = true;
    request<InfoResponse>(`/api/v1/organization/companies/${companyId}/information/`, token)
      .then(value => { if (active) { setInfo(value); setDraft(Object.fromEntries(fields.map(field => [field, value.company[field] || ""])) as Editable); } })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được thông tin doanh nghiệp."); });
    return () => { active = false; };
  }, [token, companyId, reload]);

  const changes = info && draft ? Object.fromEntries(fields.filter(field => draft[field] !== info.company[field]).map(field => [field, draft[field]])) as Partial<Editable> : {};
  const legalChanged = Object.keys(changes).some(field => legalFields.has(field as keyof Editable));

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!info || !draft || !Object.keys(changes).length) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await request<{ message: string; scheduled: boolean }>(`/api/v1/organization/companies/${companyId}/information/`, token, {
        method: "PATCH", body: JSON.stringify({ version: info.company.version, ...changes, ...(legalChanged || effective > today() ? { effective_from: effective } : {}) }),
      });
      setMessage(result.scheduled ? "Đã lưu phiên bản chờ hiệu lực." : "Đã cập nhật thông tin doanh nghiệp.");
      setReload(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không lưu được thông tin doanh nghiệp."); }
    finally { setBusy(false); }
  }

  async function changeLogo(remove: boolean) {
    if (!info || (!remove && !logo)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      if (remove) {
        await request(`/api/v1/organization/companies/${companyId}/information/`, token, {
          method: "PATCH", body: JSON.stringify({ version: info.company.version, remove_logo: true }),
        });
      } else {
        const body = new FormData();
        body.append("version", info.company.version);
        body.append("logo", logo!);
        const response = await fetch(`/api/v1/organization/companies/${companyId}/information/`, {
          method: "PATCH", headers: { Authorization: `Bearer ${token}` }, body,
        });
        if (!response.ok) {
          const detail = await response.json().catch(() => null);
          throw new ApiError(detail ? JSON.stringify(detail) : "Không tải được logo.", response.status);
        }
      }
      setLogo(null); setMessage(remove ? "Đã xóa logo." : "Đã cập nhật logo.");
      setReload(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không đổi được logo."); }
    finally { setBusy(false); }
  }

  return <main className="account-page"><section className="account-card account-wide">
    <Link to="/login">← Phiên làm việc</Link>
    <p className="account-eyebrow">SYS-02</p>
    <h1>Thông tin doanh nghiệp</h1>
    {!token ? <p>Bạn cần <Link to="/login">đăng nhập</Link>.</p> : !companies.length ? <p>Chưa có doanh nghiệp. <Link to="/company-setup">Khởi tạo doanh nghiệp</Link>.</p> : <>
      <label>Doanh nghiệp<select value={companyId} onChange={event => selectCompany(event.target.value)}>{companies.map(company =>
        <option key={company.id} value={company.id}>{company.name}</option>,
      )}</select></label>
      {error && <p className="account-error" role="alert">{error}</p>}
      {message && <p className="account-message" role="status">{message}</p>}
      {!info || !draft ? <p>Đang tải thông tin...</p> : <>
        <p>Mã: <strong>{info.company.code}</strong> · Mã số thuế: <strong>{info.company.tax_code}</strong> · Trạng thái: {info.company.status}</p>
        {info.pending_versions.length > 0 && <p>Có {info.pending_versions.length} phiên bản chờ hiệu lực: {info.pending_versions.map(item => item.effective_from).join(", ")}.</p>}
        <form onSubmit={save}>
          <label>Tên hiển thị<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} required disabled={!info.can_edit} /></label>
          <label>Tên viết tắt<input value={draft.short_name} onChange={event => setDraft({ ...draft, short_name: event.target.value })} disabled={!info.can_edit} /></label>
          <label>Tên pháp lý<input value={draft.legal_name} onChange={event => setDraft({ ...draft, legal_name: event.target.value })} required disabled={!info.can_edit} /></label>
          <label>Loại hình<select value={draft.business_type} onChange={event => setDraft({ ...draft, business_type: event.target.value })} disabled={!info.can_edit}>
            <option value="LLC_ONE_MEMBER">TNHH một thành viên</option><option value="LLC_MULTI_MEMBER">TNHH nhiều thành viên</option>
            <option value="JOINT_STOCK">Công ty cổ phần</option><option value="PRIVATE_ENTERPRISE">Doanh nghiệp tư nhân</option>
            <option value="PARTNERSHIP">Công ty hợp danh</option><option value="OTHER">Khác</option>
          </select></label>
          <label>Người đại diện<input value={draft.legal_representative} onChange={event => setDraft({ ...draft, legal_representative: event.target.value })} required disabled={!info.can_edit} /></label>
          <label>Chức danh người đại diện<input value={draft.representative_title} onChange={event => setDraft({ ...draft, representative_title: event.target.value })} disabled={!info.can_edit} /></label>
          <label>Mã quốc gia<input value={draft.country_code} onChange={event => setDraft({ ...draft, country_code: event.target.value.toUpperCase() })} maxLength={2} required disabled={!info.can_edit} /></label>
          <label>Tỉnh / thành phố<input value={draft.province} onChange={event => setDraft({ ...draft, province: event.target.value })} required disabled={!info.can_edit} /></label>
          <label>Quận / huyện<input value={draft.district} onChange={event => setDraft({ ...draft, district: event.target.value })} disabled={!info.can_edit} /></label>
          <label>Phường / xã<input value={draft.ward} onChange={event => setDraft({ ...draft, ward: event.target.value })} disabled={!info.can_edit} /></label>
          <label>Địa chỉ<input value={draft.address} onChange={event => setDraft({ ...draft, address: event.target.value })} required disabled={!info.can_edit} /></label>
          <label>Điện thoại<input value={draft.phone} onChange={event => setDraft({ ...draft, phone: event.target.value })} disabled={!info.can_edit} /></label>
          <label>Email<input type="email" value={draft.email} onChange={event => setDraft({ ...draft, email: event.target.value })} disabled={!info.can_edit} /></label>
          <label>Website<input type="url" value={draft.website} onChange={event => setDraft({ ...draft, website: event.target.value })} disabled={!info.can_edit} /></label>
          <label>Múi giờ<input value={draft.timezone} onChange={event => setDraft({ ...draft, timezone: event.target.value })} disabled={!info.can_edit} /></label>
          <label>Ngôn ngữ<input value={draft.default_locale} onChange={event => setDraft({ ...draft, default_locale: event.target.value })} disabled={!info.can_edit} /></label>
          <label>Ngày hiệu lực {legalChanged ? "(bắt buộc khi sửa pháp lý)" : "(để trống hoặc hôm nay để áp dụng ngay)"}<input type="date" min={today()} value={effective} onChange={event => setEffective(event.target.value)} disabled={!info.can_edit} /></label>
          <button type="submit" disabled={busy || !info.can_edit || !Object.keys(changes).length}>Lưu thông tin</button>
        </form>
        {info.can_edit && <div className="account-change-email">
          {info.company.logo && <p>Logo: <a href={info.company.logo} target="_blank" rel="noreferrer">Xem logo hiện tại</a></p>}
          <label>Logo mới<input type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" onChange={event => setLogo(event.target.files?.[0] || null)} /></label>
          <div className="account-actions"><button type="button" disabled={busy || !logo} onClick={() => changeLogo(false)}>Tải logo</button>
            {info.company.logo && <button type="button" disabled={busy} onClick={() => changeLogo(true)}>Xóa logo</button>}</div>
        </div>}
      </>}
    </>}
  </section></main>;
}
