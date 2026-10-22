import { Paperclip, Upload, X } from "lucide-react";

/* Shared by the voucher forms (inventory issues/transfers, fixed-asset revaluation): attachments and printing. */
export const ATTACHMENT_MAX_SIZE = 5 * 1024 * 1024;
export const ATTACHMENT_PATTERN = /\.(pdf|png|jpe?g|gif|docx?|xlsx?|csv|txt|zip|rar)$/i;
export const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string);
export const formatFileSize = (size: number) => size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;


/** Prints a voucher through an invisible frame so the page itself is untouched. */
export function openPrintFrame(html: string, title: string, onBlocked: () => void) {
  document.getElementById("inventory-issue-print")?.remove();
  const frame = document.createElement("iframe");
  frame.id = "inventory-issue-print";
  frame.title = title;
  Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  frame.onload = () => {
    try { frame.contentWindow?.focus(); frame.contentWindow?.print(); } catch { onBlocked(); }
  };
  frame.srcdoc = html;
  document.body.appendChild(frame);
}

/** Attachment area of the warehouse vouchers (AF11 / EF19): new files wait in the form and are uploaded on save. */
export function VoucherAttachments({ inputId, files, attachments, readOnly, onAdd, onRemoveFile, onDownload, onRemove }: {
  inputId: string;
  files: File[];
  attachments: any[];
  readOnly: boolean;
  onAdd: (files: FileList | null) => void;
  onRemoveFile: (index: number) => void;
  onDownload: (entry: any) => void;
  onRemove: (entry: any) => void;
}) {
  return (
    <div style={{ background: "#ffffff", borderTop: "1px solid #e2e8f0", padding: "10px 16px", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12, color: "#475569" }}>
        <Paperclip size={14} />
        <strong>Đính kèm</strong>
        <span style={{ color: "#94a3b8" }}>Dung lượng tối đa 5MB</span>
      </div>
      <input id={inputId} type="file" multiple hidden aria-label="Chọn tệp đính kèm" disabled={readOnly}
        onChange={(event) => { onAdd(event.target.files); event.target.value = ""; }} />
      {!readOnly && (
        <label
          htmlFor={inputId}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); onAdd(event.dataTransfer.files); }}
          style={{ border: "1px dashed #cbd5e1", borderRadius: 4, background: "#f8fafc", padding: "12px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}
        >
          <Upload size={18} style={{ color: "#64748b" }} />
          <span style={{ fontSize: 12.5, color: "#0284c7" }}>
            Chọn tệp <span style={{ color: "#64748b" }}>hoặc kéo và thả tệp vào đây</span>
          </span>
        </label>
      )}
      {(attachments.length > 0 || files.length > 0) && (
        <ul aria-label="Tệp đính kèm" style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12 }}>
          {attachments.map((entry: any) => (
            <li key={entry.id} style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid #e2e8f0", borderRadius: 4, padding: "4px 8px", background: "#ffffff" }}>
              <Paperclip size={12} style={{ color: "#64748b" }} />
              <button type="button" onClick={() => onDownload(entry)} style={{ border: "none", background: "none", padding: 0, color: "#0284c7", cursor: "pointer", fontSize: 12 }}>{entry.name}</button>
              <span style={{ color: "#94a3b8" }}>{formatFileSize(entry.size)}</span>
              {!readOnly && <button type="button" title={`Xóa tệp ${entry.name}`} onClick={() => onRemove(entry)} style={{ border: "none", background: "none", padding: 0, color: "#ef4444", cursor: "pointer", display: "grid" }}><X size={12} /></button>}
            </li>
          ))}
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} style={{ display: "flex", alignItems: "center", gap: 6, border: "1px dashed #cbd5e1", borderRadius: 4, padding: "4px 8px", background: "#f8fafc" }}>
              <Paperclip size={12} style={{ color: "#64748b" }} />
              <span>{file.name}</span>
              <span style={{ color: "#94a3b8" }}>{formatFileSize(file.size)} · chờ lưu</span>
              <button type="button" title={`Bỏ tệp ${file.name}`} onClick={() => onRemoveFile(index)} style={{ border: "none", background: "none", padding: 0, color: "#ef4444", cursor: "pointer", display: "grid" }}><X size={12} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
