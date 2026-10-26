import { useState } from "react";
import { MISA_REPORT_DEFINITIONS } from "./misa-report-definitions";
import { templateColumnLabels } from "./report-template-columns";
import ReportColumnDialog from "./ReportColumnDialog";
import type { CustomReportColumn } from "./ReportColumnDialog";
import {
  REPORT_OPTIONAL_COLUMNS,
  REPORT_TEMPLATE_DEFAULT_COLUMNS,
} from "./misa-report-optional-columns";
import "./report-schedule-dialog.css";

export default function ReportTemplateDialog({
  onClose,
  initialReport = "Tổng hợp bán hàng theo mặt hàng",
  initialVisibleColumns,
  initialTemplateName = "",
}: {
  onClose: () => void;
  initialReport?: string;
  initialVisibleColumns?: readonly string[];
  initialTemplateName?: string;
}) {
  const [baseReport, setBaseReport] = useState(initialReport);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>(() => [
    ...new Set(
      initialVisibleColumns ||
        templateColumnLabels(
          MISA_REPORT_DEFINITIONS.find(
            (report) => report.name === initialReport,
          )?.headers || [],
          REPORT_TEMPLATE_DEFAULT_COLUMNS[initialReport],
        ),
    ),
  ]);
  const [editWidths, setEditWidths] = useState(false);
  const [showExtraColumns, setShowExtraColumns] = useState(false);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<CustomReportColumn>();
  const [columnOrders, setColumnOrders] = useState<Record<string, string[]>>(
    {},
  );
  const [columnEdits, setColumnEdits] = useState<
    Record<
      string,
      {
        displayName?: string;
        width?: string;
        group?: string;
        function?: string;
      }
    >
  >({});
  const columnKey = (name: string) => JSON.stringify([baseReport, name]);
  const editColumn = (
    name: string,
    field: "displayName" | "width" | "group" | "function",
    value: string,
  ) =>
    setColumnEdits((current) => ({
      ...current,
      [columnKey(name)]: { ...current[columnKey(name)], [field]: value },
    }));
  const [customColumns, setCustomColumns] = useState<
    Record<string, CustomReportColumn[]>
  >({});
  const definition = MISA_REPORT_DEFINITIONS.find(
    (report) => report.name === baseReport,
  );
  const baseColumns = definition
    ? templateColumnLabels(
        definition.headers,
        REPORT_TEMPLATE_DEFAULT_COLUMNS[baseReport],
      )
    : [];
  const addedColumns = (customColumns[baseReport] || []).map(
    (column) => column.name,
  );
  const columns = [
    ...baseColumns,
    ...(REPORT_OPTIONAL_COLUMNS[baseReport] || []),
    ...(customColumns[baseReport] || []).map((column) => column.name),
  ];
  const allColumns = [...new Set(columns)];
  const orderedColumns = [
    ...(columnOrders[baseReport] || []).filter((name) =>
      allColumns.includes(name),
    ),
    ...allColumns.filter(
      (name) => !(columnOrders[baseReport] || []).includes(name),
    ),
  ];
  const moveColumn = (name: string, target: string) => {
    if (name === target) return;
    const order = [...orderedColumns];
    const from = order.indexOf(name);
    const to = order.indexOf(target);
    if (from < 0 || to < 0) return;
    order.splice(from, 1);
    order.splice(to, 0, name);
    setColumnOrders((current) => ({ ...current, [baseReport]: order }));
  };
  const visibleNames = [
    ...new Set(
      showExtraColumns || query.trim()
        ? columns
        : [...baseColumns, ...addedColumns],
    ),
  ].filter((name) =>
    name.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")),
  );
  const visible = orderedColumns.filter((name) => visibleNames.includes(name));
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
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
        aria-label="Tùy chỉnh giao diện"
        style={{
          background: "white",
          width: "min(940px,95vw)",
          maxHeight: "90vh",
          overflow: "auto",
          padding: 24,
          borderRadius: 4,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h2>Tùy chỉnh giao diện</h2>
          <button
            type="button"
            aria-label="Đóng tùy chỉnh giao diện"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <label>
          Báo cáo gốc
          <select
            aria-label="Báo cáo gốc"
            value={baseReport}
            onChange={(event) => {
              setBaseReport(event.target.value);
              setSelected(
                templateColumnLabels(
                  MISA_REPORT_DEFINITIONS.find(
                    (report) => report.name === event.target.value,
                  )?.headers || [],
                  REPORT_TEMPLATE_DEFAULT_COLUMNS[event.target.value],
                ),
              );
              setQuery("");
            }}
          >
            {MISA_REPORT_DEFINITIONS.map((report) => (
              <option key={report.name}>{report.name}</option>
            ))}
          </select>
        </label>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <label>
            Tên mẫu *
            <input aria-label="Tên mẫu" defaultValue={initialTemplateName} />
          </label>
          <label>
            <input
              type="checkbox"
              defaultChecked={Boolean(initialTemplateName)}
            />{" "}
            Dùng chung cho tất cả mọi người dùng khác
          </label>
        </div>
        <label>
          Tên báo cáo *
          <input
            aria-label="Tên báo cáo"
            key={baseReport}
            defaultValue={baseReport}
          />
        </label>
        <details open>
          <summary>Hiển thị cột dữ liệu</summary>
          <div style={{ display: "flex", gap: 12, margin: "12px 0" }}>
            <input
              aria-label="Tìm cột dữ liệu"
              placeholder="Nhập từ khóa tìm kiếm"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button
              type="button"
              onClick={() => setEditWidths((value) => !value)}
            >
              Sửa tên cột hiển thị và độ rộng
            </button>
          </div>
          <div style={{ maxHeight: 320, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th aria-label="Vị trí cột" />
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả cột dữ liệu"
                      checked={
                        visible.length > 0 &&
                        visible.every((name) => selected.includes(name))
                      }
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [...new Set([...current, ...visible])]
                            : current.filter((name) => !visible.includes(name)),
                        )
                      }
                    />
                  </th>
                  <th>Tên cột dữ liệu</th>
                  <th>Nhóm cột với</th>
                  <th>Chức năng</th>
                  {editWidths && (
                    <>
                      <th>Tên cột hiển thị</th>
                      <th>Độ rộng</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map((name) => (
                  <tr key={name}>
                    <td>
                      <span
                        draggable
                        role="button"
                        tabIndex={0}
                        aria-label={`Đổi vị trí cột ${name}`}
                        title="Kéo để thay đổi vị trí cột; dùng phím lên/xuống khi chọn nút"
                        style={{ cursor: "grab", color: "#6b7280", padding: 6 }}
                        onDragStart={(event) =>
                          event.dataTransfer.setData("text/plain", name)
                        }
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          moveColumn(
                            event.dataTransfer.getData("text/plain"),
                            name,
                          );
                        }}
                        onKeyDown={(event) => {
                          const index = visible.indexOf(name);
                          const target =
                            event.key === "ArrowUp"
                              ? visible[index - 1]
                              : event.key === "ArrowDown"
                                ? visible[index + 1]
                                : undefined;
                          if (target) {
                            event.preventDefault();
                            moveColumn(name, target);
                          }
                        }}
                      >
                        ⠿
                      </span>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Hiển thị cột ${name}`}
                        checked={selected.includes(name)}
                        onChange={() =>
                          setSelected((current) =>
                            current.includes(name)
                              ? current.filter((item) => item !== name)
                              : [...current, name],
                          )
                        }
                      />
                    </td>
                    <td style={{ padding: 8 }}>{name}</td>
                    <td>
                      <input
                        aria-label={`Nhóm cột với ${name}`}
                        value={columnEdits[columnKey(name)]?.group ?? name}
                        onChange={(event) =>
                          editColumn(name, "group", event.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Chức năng ${name}`}
                        value={columnEdits[columnKey(name)]?.function ?? ""}
                        onChange={(event) =>
                          editColumn(name, "function", event.target.value)
                        }
                      />
                      {(customColumns[baseReport] || []).some(
                        (column) => column.name === name,
                      ) && (
                        <>
                          <button
                            type="button"
                            aria-label={`Sửa cột ${name}`}
                            onClick={() => {
                              setEditingColumn(
                                customColumns[baseReport].find(
                                  (column) => column.name === name,
                                ),
                              );
                              setColumnDialogOpen(true);
                            }}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            aria-label={`Xóa cột tự tạo ${name}`}
                            onClick={() => {
                              setCustomColumns((current) => ({
                                ...current,
                                [baseReport]: (
                                  current[baseReport] || []
                                ).filter((column) => column.name !== name),
                              }));
                              setSelected((current) =>
                                current.filter((column) => column !== name),
                              );
                            }}
                          >
                            ×
                          </button>
                        </>
                      )}
                    </td>
                    {editWidths && (
                      <>
                        <td>
                          <input
                            aria-label={`Tên hiển thị ${name}`}
                            value={
                              columnEdits[columnKey(name)]?.displayName ?? name
                            }
                            onChange={(event) =>
                              editColumn(
                                name,
                                "displayName",
                                event.target.value,
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={40}
                            aria-label={`Độ rộng ${name}`}
                            value={columnEdits[columnKey(name)]?.width ?? "120"}
                            onChange={(event) =>
                              editColumn(name, "width", event.target.value)
                            }
                          />
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => setShowExtraColumns((value) => !value)}
          >
            {showExtraColumns ? "Ẩn bớt" : "Hiển thị thêm"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingColumn(undefined);
              setColumnDialogOpen(true);
            }}
          >
            Thêm
          </button>
        </details>
        <details style={{ margin: "16px 0" }}>
          <summary>Nhóm dữ liệu</summary>
          <label>
            Cột nhóm
            <select aria-label="Cột nhóm">
              <option value="">Chọn cột</option>
              {[...new Set(columns)].map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          {[1, 2, 3].map((level) => (
            <label key={level}>
              Mức {level}
              <select aria-label={`Mức ${level}`}>
                <option value="">Chọn cột</option>
                {[...new Set(columns)].map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
          ))}
        </details>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
            marginTop: 16,
          }}
        >
          <button type="button" onClick={onClose}>
            Hủy
          </button>
          <button
            type="button"
            onClick={() => {
              setSelected([...new Set(baseColumns)]);
              setQuery("");
              setColumnOrders((current) => ({ ...current, [baseReport]: [] }));
              setColumnEdits((current) =>
                Object.fromEntries(
                  Object.entries(current).filter(
                    ([key]) => JSON.parse(key)[0] !== baseReport,
                  ),
                ),
              );
            }}
          >
            Lấy mẫu ngầm định
          </button>
          <button type="button" style={{ background: "#00a862", color: "white", borderColor: "#00a862", fontWeight: 600, padding: "0 18px", height: 32, borderRadius: 4 }} onClick={onClose}>
            Lưu
          </button>
        </div>
        {columnDialogOpen && (
          <ReportColumnDialog
            initialColumn={editingColumn}
            columns={[...new Set(columns)]}
            onCancel={() => setColumnDialogOpen(false)}
            onAdd={(column) => {
              setCustomColumns((current) => ({
                ...current,
                [baseReport]: [
                  ...(current[baseReport] || []).filter(
                    (item) =>
                      item.name !== column.name &&
                      item.name !== editingColumn?.name,
                  ),
                  column,
                ],
              }));
              setSelected((current) => [
                ...new Set([
                  ...current.filter((name) => name !== editingColumn?.name),
                  column.name,
                ]),
              ]);
              setQuery("");
              setColumnDialogOpen(false);
            }}
          />
        )}
      </div>
    </div>
  );
}
