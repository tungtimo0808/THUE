import { useId, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Settings } from "lucide-react";
import ReportTemplateDialog from "./ReportTemplateDialog";

export default function ReportCustomizationMenu({
  reportName,
  visibleColumns,
  variants = [],
  triggerIcon,
  triggerStyle,
}: {
  reportName: string;
  visibleColumns: readonly string[];
  variants?: readonly string[];
  triggerIcon?: ReactNode;
  triggerStyle?: CSSProperties;
}) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTemplateName, setEditorTemplateName] = useState("");
  const [managerOpen, setManagerOpen] = useState(false);
  const [variant, setVariant] = useState("Mẫu chuẩn");
  return (
    <div
      style={{ position: "relative" }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-label="Tùy chỉnh mẫu báo cáo"
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-expanded={open}
        style={triggerStyle}
        onClick={() => setOpen((value) => !value)}
      >
        {triggerIcon || <Settings size={16} />}
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Tùy chọn mẫu báo cáo"
          id={menuId}
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            zIndex: 10,
            minWidth: 210,
            padding: 4,
            border: "1px solid #cdd3da",
            background: "white",
            boxShadow: "0 4px 10px #0002",
          }}
        >
          {["Mẫu chuẩn", ...variants].map((name) => (
            <button
              key={name}
              type="button"
              role="menuitemradio"
              aria-checked={variant === name}
              style={{
                width: "100%",
                height: "auto",
                display: "block",
                padding: "8px 12px",
                textAlign: "left",
                whiteSpace: "nowrap",
              }}
              onClick={() => {
                setVariant(name);
                setOpen(false);
              }}
            >
              {name}
            </button>
          ))}
          {["Thêm mẫu mới", "Sửa mẫu hiện tại"].map((name) => (
            <button
              key={name}
              type="button"
              role="menuitem"
              style={{
                width: "100%",
                height: "auto",
                display: "block",
                padding: "8px 12px",
                textAlign: "left",
                whiteSpace: "nowrap",
              }}
              onClick={() => {
                setOpen(false);
                setEditorTemplateName(
                  name === "Sửa mẫu hiện tại" ? variant : "",
                );
                setEditorOpen(true);
              }}
            >
              {name}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            style={{
              width: "100%",
              height: "auto",
              padding: "8px 12px",
              textAlign: "left",
            }}
            onClick={() => {
              setOpen(false);
              setManagerOpen(true);
            }}
          >
            Quản lý mẫu
          </button>
        </div>
      )}
      {managerOpen &&
        createPortal(
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
                setManagerOpen(false);
              }
            }}
          >
            <div
              className="misa-report-schedule-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Quản lý mẫu"
              style={{
                background: "white",
                width: "min(640px,95vw)",
                padding: 24,
                borderRadius: 4,
              }}
            >
              <h2>Quản lý mẫu</h2>
              <table style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Tên mẫu</th>
                    <th>Đang áp dụng</th>
                  </tr>
                </thead>
                <tbody>
                  {["Mẫu chuẩn", ...variants].map((name) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Đang áp dụng ${name}`}
                          checked={variant === name}
                          disabled
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 12,
                  marginTop: 16,
                }}
              >
                <button type="button" onClick={() => setManagerOpen(false)}>
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManagerOpen(false);
                    setEditorTemplateName("");
                    setEditorOpen(true);
                  }}
                >
                  Thêm mẫu
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      {editorOpen &&
        createPortal(
          <ReportTemplateDialog
            initialReport={reportName}
            initialVisibleColumns={visibleColumns}
            initialTemplateName={editorTemplateName}
            onClose={() => setEditorOpen(false)}
          />,
          document.body,
        )}
    </div>
  );
}
