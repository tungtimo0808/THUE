import { useState } from "react";
import "./report-schedule-dialog.css";

export default function ReportGroupingDialog({
  columns,
  onClose,
}: {
  columns: string[];
  onClose: () => void;
}) {
  const [levels, setLevels] = useState(["", "", ""]);
  return (
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
          onClose();
        }
      }}
    >
      <div
        className="misa-report-schedule-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Nhóm dữ liệu theo cột"
        style={{
          background: "white",
          padding: 24,
          width: "min(480px,90vw)",
          borderRadius: 4,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h2>Nhóm dữ liệu theo cột</h2>
          <button
            type="button"
            aria-label="Đóng nhóm dữ liệu"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {levels.map((value, index) => (
          <label key={index}>
            Mức {index + 1}
            <select
              aria-label={`Mức ${index + 1}`}
              value={value}
              onChange={(event) =>
                setLevels((current) =>
                  current.map((level, position) =>
                    position === index ? event.target.value : level,
                  ),
                )
              }
            >
              <option value="">Chọn cột</option>
              {[...new Set(columns)].map((column) => (
                <option key={column}>{column}</option>
              ))}
            </select>
          </label>
        ))}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
            marginTop: 20,
          }}
        >
          <button type="button" onClick={onClose}>
            Hủy
          </button>
          <button type="button" onClick={onClose}>
            Đồng ý
          </button>
        </div>
      </div>
    </div>
  );
}
