import { useEffect, useRef } from "react";
import { AlertCircle, Bell, CheckCheck, ChevronRight, FileText, RefreshCw } from "lucide-react";

export type NotificationItem = {
  id: string;
  dbId?: string;
  category: "pending" | "system";
  code: string;
  kindLabel: string;
  kind: string;
  description: string;
  partner: string;
  amount: number;
  date: string;
  actionUrl?: string;
  isVoucher?: boolean;
};

export function NotificationPanel({ items, readIds, filter, onFilter, loading, busy, error, onRetry, onReadAll, onOpen, onViewAll, onClose }: {
  items: NotificationItem[];
  readIds: Set<string>;
  filter: "all" | "pending" | "system";
  onFilter: (filter: "all" | "pending" | "system") => void;
  loading: boolean;
  busy: boolean;
  error: string;
  onRetry: () => void;
  onReadAll: () => void;
  onOpen: (item: NotificationItem) => void;
  onViewAll: () => void;
  onClose: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { listRef.current?.scrollTo(0, 0); }, [filter]);
  const unread = items.filter((item) => !readIds.has(item.id)).length;
  const visible = items.filter((item) => filter === "all" || item.category === filter);
  const tabs = [{ id: "all", label: "Tất cả" }, { id: "pending", label: "Chờ duyệt" }, { id: "system", label: "Hệ thống" }] as const;
  return (
    <div className="notification-panel">
      <div className="notification-toolbar">
        <div className="notification-filters" role="group" aria-label="Lọc thông báo">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" aria-pressed={filter === tab.id} onClick={() => onFilter(tab.id)}>
              {tab.label}<span>{items.filter((item) => tab.id === "all" || item.category === tab.id).length}</span>
            </button>
          ))}
        </div>
        <button type="button" className="notification-read-all" disabled={loading || busy || !unread} onClick={onReadAll}>
          <CheckCheck size={15} aria-hidden="true" />{busy ? "Đang cập nhật…" : "Đọc tất cả"}
        </button>
      </div>
      {error && <div className="notification-error" role="alert"><span>{error}</span><button type="button" onClick={onRetry} disabled={loading}><RefreshCw size={14} aria-hidden="true" />Thử lại</button></div>}
      <div ref={listRef} className="notification-list" aria-busy={loading}>
        {loading ? <p className="notification-empty" role="status">Đang tải thông báo…</p> : !visible.length ? (
          <div className="notification-empty"><Bell size={24} aria-hidden="true" /><p>{filter === "pending" ? "Không có yêu cầu chờ duyệt." : "Chưa có thông báo trong mục này."}</p></div>
        ) : visible.map((item) => {
          const unread = !readIds.has(item.id);
          const Icon = item.category === "pending" ? FileText : item.kind === "alert" ? AlertCircle : Bell;
          return (
            <button type="button" key={item.id} className={`notification-row${unread ? " unread" : ""}`} onClick={() => onOpen(item)} disabled={busy}>
              <Icon size={18} className={`notification-row-icon${item.kind === "alert" ? " warning" : ""}`} aria-hidden="true" />
              <span className="notification-row-content">
                <span className="notification-row-heading"><strong>{item.code}</strong>{unread && <span className="notification-unread-dot" aria-label="Chưa đọc" />}</span>
                <span className="notification-row-description">{item.description}</span>
                <span className="notification-row-meta">{item.kindLabel}{item.partner ? ` · ${item.partner}` : ""}</span>
                <span className="notification-row-bottom"><time>{item.date}</time>{item.category === "pending" && <span className="notification-pending">Chờ duyệt</span>}{item.amount > 0 && <span className="notification-amount">{item.amount.toLocaleString("vi-VN")} ₫</span>}</span>
              </span>
              <ChevronRight size={16} className="notification-row-arrow" aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <footer className="notification-footer">
        <span role="status">{unread ? `${unread} chưa đọc` : "Đã đọc tất cả"}</span>
        <div><button type="button" className="button" onClick={onClose}>Đóng</button><button type="button" className="button primary" onClick={onViewAll}>Xem tất cả</button></div>
      </footer>
    </div>
  );
}
