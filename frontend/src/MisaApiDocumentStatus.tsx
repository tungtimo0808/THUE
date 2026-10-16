import { useState } from "react";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import { errorText } from "./misa-api-writes";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Nháp", PENDING_APPROVAL: "Chờ duyệt", APPROVED: "Đã duyệt", POSTED: "Đã ghi sổ",
  REJECTED: "Từ chối", REVISION_REQUIRED: "Yêu cầu sửa", CANCELLED: "Đã hủy", REVERSED: "Đã đảo",
  CONFIRMED: "Đã xác nhận", ISSUED: "Đã phát hành", COMPLETED: "Hoàn thành", ACTIVE: "Đang sử dụng",
};

export function apiStatusLabel(status: unknown) {
  return STATUS_LABELS[String(status)] || String(status || "");
}

/** The next workflow step a list row offers for a backend status. */
const NEXT_STEP: Record<string, [string, string]> = {
  DRAFT: ["submit", "Gửi duyệt"], REVISION_REQUIRED: ["submit", "Gửi duyệt"], REJECTED: ["submit", "Gửi duyệt"],
  PENDING_APPROVAL: ["approve", "Duyệt"], APPROVED: ["post", "Ghi sổ"],
};

/**
 * Status text of an API document inside an existing table cell, followed by the next workflow action
 * (submit → approve → post). The backend enforces permissions such as "no self-approval".
 */
export default function MisaApiDocumentStatus({ path, record, companyId, notify, onChanged, canPost = true }: {
  path: string;
  record?: Record<string, any>;
  companyId: string;
  notify: (message: string) => void;
  onChanged: () => void;
  canPost?: boolean;
}) {
  const { token } = useApiSession();
  const [busy, setBusy] = useState(false);
  if (!record) return null;
  const next = NEXT_STEP[record.status];
  const step = next && (next[0] !== "post" || canPost) ? next : null;
  const run = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!step || !token) return;
    setBusy(true);
    try {
      const saved = await request<Record<string, any>>(
        `${path}${record.id}/${step[0]}/?company_id=${encodeURIComponent(companyId)}`, token,
        { method: "POST", body: JSON.stringify({ version: record.version }) },
      );
      notify(`${record.number || ""}: ${apiStatusLabel(saved?.status)}.`);
      onChanged();
    } catch (error) {
      notify(`Không ${step[1].toLowerCase()} được ${record.number || ""}: ${errorText(error)}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {apiStatusLabel(record.status)}
      {step && (
        <button
          type="button"
          onClick={run}
          disabled={busy}
          style={{ marginLeft: 6, border: 0, background: "none", color: "#0284c7", cursor: "pointer", fontSize: "inherit", fontWeight: 600, padding: 0 }}
        >
          {busy ? "…" : step[1]}
        </button>
      )}
    </>
  );
}
