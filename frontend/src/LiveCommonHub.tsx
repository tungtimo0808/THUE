import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./live-account.css";

type Page<T> = { results: T[]; count: number };
type Notification = { id: string; title: string; message: string; status: string; company_name?: string; created_at: string; link?: string };
type WorkItem = { id: string; title: string; status: string; priority: string; due_at?: string; reference_code?: string; link?: string };
type SearchItem = { id: string; entity_type: string; code: string; name: string; status?: string };
type SearchGroup = { count: number; items: SearchItem[]; has_more: boolean };
type AIInteraction = { id: string; question: string; answer: string; status: string; confirmed_at?: string | null; feedback?: { helpful: boolean } | null; sources?: unknown[] };
type Tab = "notifications" | "search" | "work" | "ai";

export default function LiveCommonHub() {
  const [params] = useSearchParams();
  const initialQueryParam = params.get("q") || "";
  const { token, companyId } = useApiSession();
  const [tab, setTab] = useState<Tab>(params.get("tab") === "search" ? "search" : "notifications");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [archived, setArchived] = useState(false);
  const [notificationPage, setNotificationPage] = useState(1);
  const [notificationCount, setNotificationCount] = useState(0);
  const [work, setWork] = useState<WorkItem[]>([]);
  const [workPage, setWorkPage] = useState(1);
  const [workCount, setWorkCount] = useState(0);
  const [query, setQuery] = useState(initialQueryParam);
  const [groups, setGroups] = useState<Record<string, SearchGroup> | null>(null);
  const [searchDetail, setSearchDetail] = useState("");
  const [question, setQuestion] = useState("");
  const [requestType, setRequestType] = useState<"GUIDANCE" | "LOOKUP" | "EXPLAIN" | "ANALYSIS">("GUIDANCE");
  const [interactions, setInteractions] = useState<AIInteraction[]>([]);

  useEffect(() => {
    if (!token || tab !== "notifications") return;
    let active = true;
    request<Page<Notification>>(`/api/v1/common/notifications/?page=${notificationPage}&archived=${archived}`, token)
      .then(value => { if (active) { setNotifications(value.results); setNotificationCount(value.count); } })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được thông báo."); });
    return () => { active = false; };
  }, [token, tab, archived, notificationPage]);

  useEffect(() => {
    if (!token || !companyId || tab !== "work") return;
    let active = true;
    request<Page<WorkItem>>(`/api/v1/common/work-items/?company_id=${encodeURIComponent(companyId)}&page=${workPage}`, token)
      .then(value => { if (active) { setWork(value.results); setWorkCount(value.count); } })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được việc cần xử lý."); });
    return () => { active = false; };
  }, [token, companyId, tab, workPage]);

  useEffect(() => {
    if (!token || !companyId || tab !== "ai") return;
    let active = true;
    request<Page<AIInteraction> | AIInteraction[]>(`/api/v1/common/ai/?company_id=${encodeURIComponent(companyId)}`, token)
      .then(value => { if (active) setInteractions(Array.isArray(value) ? value : value.results); })
      .catch(() =>
        request<Page<AIInteraction> | AIInteraction[]>(`/api/v1/common/ai-conversations/?company_id=${encodeURIComponent(companyId)}`, token)
          .then(value => { if (active) setInteractions(Array.isArray(value) ? value : value.results); })
      )
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được lịch sử AI."); });
    return () => { active = false; };
  }, [token, companyId, tab]);

  useEffect(() => {
    const initialQuery = initialQueryParam.trim();
    if (!token || !companyId || tab !== "search" || !initialQuery || initialQuery.length < 2) return;
    let active = true;
    request<{ groups: Record<string, SearchGroup> }>(
      `/api/v1/common/search/?${new URLSearchParams({ company: companyId, q: initialQuery })}`, token,
    ).then(result => { if (active) setGroups(result.groups); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Không tìm kiếm được."); });
    return () => { active = false; };
  }, [token, companyId, tab, initialQueryParam]);

  async function notificationAction(item: Notification, action: "read" | "unread" | "archive" | "unarchive" | "open") {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await request<Notification | { notification: Notification; link: string | null; available: boolean }>(
        `/api/v1/common/notifications/${item.id}/${action}/`, token, { method: "POST", body: "{}" },
      );
      if (action === "archive" || action === "unarchive") setNotifications(current => current.filter(row => row.id !== item.id));
      else if (action === "open") {
        const opened = result as { notification: Notification; link: string | null; available: boolean };
        setNotifications(current => current.map(row => row.id === item.id ? opened.notification : row));
        setMessage(opened.available ? `Nội dung liên quan: ${opened.link || "không có đường dẫn"}` : "Nội dung liên quan không còn khả dụng.");
      } else setNotifications(current => current.map(row => row.id === item.id ? result as Notification : row));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không xử lý được thông báo."); }
    finally { setBusy(false); }
  }

  async function readAll() {
    setBusy(true); setError("");
    try {
      await request(`/api/v1/common/notifications/read-all/`, token, { method: "POST", body: "{}" });
      setNotifications(current => current.map(item => ({ ...item, status: "READ" })));
      setMessage("Đã đánh dấu tất cả là đã đọc.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không cập nhật được thông báo."); }
    finally { setBusy(false); }
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!companyId) return;
    setBusy(true); setError(""); setSearchDetail("");
    try {
      const result = await request<{ groups: Record<string, SearchGroup> }>(
        `/api/v1/common/search/?${new URLSearchParams({ company: companyId, q: query.trim() })}`, token,
      );
      setGroups(result.groups);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tìm kiếm được."); }
    finally { setBusy(false); }
  }

  async function openSearch(item: SearchItem) {
    setBusy(true); setError("");
    try {
      const result = await request<{ link: string }>("/api/v1/common/search/open/", token, {
        method: "POST", body: JSON.stringify({ company: companyId, entity_type: item.entity_type, entity_id: item.id }),
      });
      setSearchDetail(`${item.name}: ${result.link}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không mở được kết quả."); }
    finally { setBusy(false); }
  }

  async function openWork(item: WorkItem) {
    setBusy(true); setError("");
    try {
      const result = await request<{ link: string | null }>(`/api/v1/common/work-items/${item.id}/open/?company_id=${encodeURIComponent(companyId)}`, token, { method: "POST", body: "{}" });
      setMessage(result.link ? `Nội dung công việc: ${result.link}` : "Công việc không có đường dẫn chi tiết.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không mở được công việc."); }
    finally { setBusy(false); }
  }

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!companyId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await request<AIInteraction>(`/api/v1/common/ai/query/?company_id=${encodeURIComponent(companyId)}`, token, {
        method: "POST", body: JSON.stringify({ company: companyId, question: question.trim(), request_type: requestType }),
      });
      setInteractions(current => [result, ...current]); setQuestion("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "AI Assistant không trả lời được."); }
    finally { setBusy(false); }
  }

  async function aiAction(item: AIInteraction, action: "confirm" | "feedback", helpful?: boolean) {
    setBusy(true); setError(""); setMessage("");
    try {
      if (action === "confirm") {
        const result = await request<AIInteraction>(`/api/v1/common/ai/${item.id}/confirm/?company_id=${encodeURIComponent(companyId)}`, token, { method: "POST", body: "{}" });
        setInteractions(current => current.map(row => row.id === item.id ? result : row));
        setMessage("Đã xác nhận kết quả AI.");
      } else {
        const feedback = await request<{ helpful: boolean }>(`/api/v1/common/ai/${item.id}/feedback/?company_id=${encodeURIComponent(companyId)}`, token, {
          method: "POST", body: JSON.stringify({ helpful }),
        });
        setInteractions(current => current.map(row => row.id === item.id ? { ...row, feedback } : row));
        setMessage("Đã gửi đánh giá.");
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không cập nhật được kết quả AI."); }
    finally { setBusy(false); }
  }

  return <main className="account-page"><section className="account-card account-wide">
    <Link to="/login">← Phiên làm việc</Link>
    <p className="account-eyebrow">COM-09 → COM-12</p>
    <h1>Dùng chung</h1>
    {!token ? <p>Bạn cần <Link to="/login">đăng nhập</Link>.</p> : <>
      <nav className="account-tabs" aria-label="Chức năng dùng chung">
        {([ ["notifications", "Thông báo"], ["search", "Tìm kiếm"], ["work", "Việc cần xử lý"], ["ai", "AI Assistant"] ] as const).map(([id, label]) =>
          <button type="button" key={id} aria-current={tab === id ? "page" : undefined} onClick={() => { setTab(id); setError(""); setMessage(""); }}>{label}</button>,
        )}
      </nav>
      {error && <p className="account-error" role="alert">{error}</p>}
      {message && <p className="account-message" role="status">{message}</p>}
      {tab === "notifications" && <>
        <div className="account-actions"><button type="button" onClick={() => { setArchived(value => !value); setNotificationPage(1); }}>{archived ? "Thông báo hiện tại" : "Đã lưu trữ"}</button>
          {!archived && <button type="button" disabled={busy} onClick={readAll}>Đánh dấu tất cả đã đọc</button>}</div>
        {!notifications.length ? <p>Chưa có thông báo.</p> : <ul className="account-request-list">{notifications.map(item => <li key={item.id}>
          <div><strong>{item.title}</strong><span>{item.message}</span><span>{item.company_name || "Hệ thống"} · {item.status} · {new Date(item.created_at).toLocaleString("vi-VN")}</span></div>
          <div className="account-actions"><button type="button" disabled={busy} onClick={() => notificationAction(item, "open")}>Mở</button>
            {!archived && <button type="button" disabled={busy} onClick={() => notificationAction(item, item.status === "READ" ? "unread" : "read")}>{item.status === "READ" ? "Chưa đọc" : "Đã đọc"}</button>}
            <button type="button" disabled={busy} onClick={() => notificationAction(item, archived ? "unarchive" : "archive")}>{archived ? "Khôi phục" : "Lưu trữ"}</button></div>
        </li>)}</ul>}
        <Pagination page={notificationPage} count={notificationCount} onChange={setNotificationPage} />
      </>}
      {tab === "search" && <>
        {!companyId ? <p>Hãy tham gia doanh nghiệp và <Link to="/scope">chọn phạm vi</Link>.</p> : <form onSubmit={search}>
          <label>Từ khóa<input value={query} onChange={event => setQuery(event.target.value)} minLength={2} required /></label>
          <button type="submit" disabled={busy}>Tìm kiếm</button>
        </form>}
        {searchDetail && <p className="account-message">{searchDetail}</p>}
        {groups && Object.entries(groups).map(([name, group]) => <section key={name} className="account-group"><h2>{name} ({group.count})</h2>
          <ul className="account-request-list">{group.items.map(item => <li key={item.id}><div><strong>{item.code}</strong><span>{item.name} · {item.status || ""}</span></div>
            <button type="button" disabled={busy} onClick={() => openSearch(item)}>Mở</button></li>)}</ul>
          {group.has_more && <p>Còn kết quả khác trong nhóm này.</p>}
        </section>)}
      </>}
      {tab === "work" && <>
        {!companyId ? <p>Hãy tham gia doanh nghiệp và <Link to="/scope">chọn phạm vi</Link>.</p> : !work.length ? <p>Không có việc cần xử lý.</p> : <ul className="account-request-list">{work.map(item => <li key={item.id}>
          <div><strong>{item.title}</strong><span>{item.reference_code} · {item.priority} · {item.status} · {item.due_at ? new Date(item.due_at).toLocaleDateString("vi-VN") : ""}</span></div>
          <button type="button" disabled={busy} onClick={() => openWork(item)}>Mở</button>
        </li>)}</ul>}
        <Pagination page={workPage} count={workCount} onChange={setWorkPage} />
      </>}
      {tab === "ai" && <>
        {!companyId ? <p>Hãy tham gia doanh nghiệp và <Link to="/scope">chọn phạm vi</Link>.</p> : <form onSubmit={ask}>
          <label>Loại yêu cầu<select value={requestType} onChange={event => setRequestType(event.target.value as typeof requestType)}>
            <option value="GUIDANCE">Hướng dẫn</option><option value="LOOKUP">Tra cứu</option><option value="EXPLAIN">Giải thích</option><option value="ANALYSIS">Phân tích</option>
          </select></label>
          <label>Câu hỏi<textarea value={question} onChange={event => setQuestion(event.target.value)} minLength={3} maxLength={4000} rows={4} required /></label>
          <button type="submit" disabled={busy}>Gửi câu hỏi</button>
        </form>}
        <ul className="account-request-list">{interactions.map(item => <li key={item.id}><div><strong>{item.question}</strong><span>{item.answer || item.status}</span>
          {item.status === "COMPLETED" && <div className="account-actions">
            {!item.confirmed_at && <button type="button" disabled={busy} onClick={() => aiAction(item, "confirm")}>Xác nhận</button>}
            {!item.feedback && <><button type="button" disabled={busy} onClick={() => aiAction(item, "feedback", true)}>Hữu ích</button>
              <button type="button" disabled={busy} onClick={() => aiAction(item, "feedback", false)}>Chưa hữu ích</button></>}
          </div>}
        </div></li>)}</ul>
      </>}
    </>}
  </section></main>;
}

function Pagination({ page, count, onChange }: { page: number; count: number; onChange: (page: number) => void }) {
  if (count <= 20) return null;
  return <div className="account-actions"><button type="button" disabled={page === 1} onClick={() => onChange(page - 1)}>Trước</button><span>Trang {page}</span><button type="button" disabled={page * 20 >= count} onClick={() => onChange(page + 1)}>Sau</button></div>;
}
