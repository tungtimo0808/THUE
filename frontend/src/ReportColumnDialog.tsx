import { useState } from "react";
import "./report-schedule-dialog.css";

export interface CustomReportColumn {
  name: string;
  englishName?: string;
  format: string;
  formula: string;
}

export default function ReportColumnDialog({
  columns,
  onCancel,
  onAdd,
  initialColumn,
}: {
  columns: string[];
  onCancel: () => void;
  onAdd: (column: CustomReportColumn) => void;
  initialColumn?: CustomReportColumn;
}) {
  const [name, setName] = useState(initialColumn?.name || "");
  const [englishName, setEnglishName] = useState(
    initialColumn?.englishName || "",
  );
  const [format, setFormat] = useState(initialColumn?.format || "Tiền quy đổi");
  const [formula, setFormula] = useState(initialColumn?.formula || "");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const visible = columns.filter((column) =>
    column.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")),
  );
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100003,
        background: "#0006",
        display: "grid",
        placeItems: "center",
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <div
        className="misa-report-schedule-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={initialColumn ? "Sửa cột" : "Thêm cột"}
        style={{
          background: "white",
          width: "min(760px, 92vw)",
          padding: 24,
          maxHeight: "90vh",
          overflowY: "auto",
          borderRadius: 4,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h2>{initialColumn ? "Sửa cột" : "Thêm cột"}</h2>
          <button type="button" aria-label="Đóng thêm cột" onClick={onCancel}>
            ×
          </button>
        </div>
        <div className="misa-report-column-fields">
          <label>
            Tên cột *
            <input
              aria-label="Tên cột mới"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            Tên Tiếng Anh
            <input
              aria-label="Tên Tiếng Anh"
              value={englishName}
              onChange={(event) => setEnglishName(event.target.value)}
            />
          </label>
          <label>
            Định dạng theo *
            <select
              aria-label="Định dạng số"
              value={format}
              onChange={(event) => setFormat(event.target.value)}
            >
              <optgroup label="Định dạng theo Sổ Việt ERP">
                {[
                  "Kiểu chữ",
                  "Kiểu tiền quy đổi",
                  "Kiểu tiền nguyên tệ",
                  "Kiểu số lượng",
                  "Kiểu đơn giá quy đổi",
                  "Kiểu đơn giá ngoại tệ",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </optgroup>
              <optgroup label="Các lựa chọn hiện có">
                {["Số lượng", "Số tiền", "Tiền quy đổi", "Kiểu đơn giá"].map(
                  (value) => (
                    <option key={value}>{value}</option>
                  ),
                )}
              </optgroup>
            </select>
          </label>
        </div>
        <p style={{ color: "#6b7280", fontStyle: "italic" }}>
          Chọn dòng trong danh sách để đưa vào công thức. Dùng dấu “.” để ngăn
          cách phần thập phân.
        </p>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          <div>
            <h3>Các cột dữ liệu</h3>
            <input
              aria-label="Tìm cột để thiết lập công thức"
              placeholder="Nhập từ khóa tìm kiếm"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div style={{ maxHeight: 220, overflowY: "auto", marginTop: 8 }}>
              {visible.map((column) => (
                <button
                  type="button"
                  key={column}
                  style={{ display: "block", width: "100%", textAlign: "left" }}
                  onClick={() =>
                    setFormula((current) => `${current}[${column}]`)
                  }
                >
                  {column}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3>Công thức</h3>
            <textarea
              aria-label="Công thức cột"
              rows={8}
              value={formula}
              onChange={(event) => setFormula(event.target.value)}
              style={{ width: "100%" }}
            />
            <div
              style={{
                display: "flex",
                gap: 6,
                margin: "8px 0",
                flexWrap: "wrap",
              }}
            >
              {["+", "-", "*", "/", "(", ")"].map((operator) => (
                <button
                  type="button"
                  key={operator}
                  aria-label={`Chèn phép tính ${operator}`}
                  onClick={() =>
                    setFormula((current) => `${current} ${operator} `)
                  }
                >
                  {operator}
                </button>
              ))}
              <button
                type="button"
                aria-label="Xóa công thức"
                onClick={() => setFormula("")}
              >
                Xóa
              </button>
            </div>
            <button type="button">Kiểm tra</button>
          </div>
        </div>
        {error && <p role="alert">{error}</p>}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
            marginTop: 20,
          }}
        >
          <button type="button" onClick={onCancel}>
            Hủy
          </button>
          <button
            type="button"
            onClick={() => {
              if (!name.trim()) {
                setError("Vui lòng nhập tên cột.");
                return;
              }
              if (
                name.trim() !== initialColumn?.name &&
                columns.includes(name.trim())
              ) {
                setError("Tên cột đã tồn tại. Vui lòng đặt tên khác.");
                return;
              }
              onAdd({
                name: name.trim(),
                englishName: englishName.trim(),
                format,
                formula,
              });
            }}
          >
            Đồng ý
          </button>
        </div>
      </div>
    </div>
  );
}
