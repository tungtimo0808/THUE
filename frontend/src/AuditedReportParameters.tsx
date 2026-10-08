import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { SelectionTable } from "./MisaPurchaseContractReports";
import ReportDateInput from "./ReportDateInput";
import type { AuditedReportDefinition } from "./audited-report-schema";
import type { AuditedParameters } from "./audited-report-parameters";
import { auditedPeriodRange } from "./audited-report-parameters";
import {
  selectorSampleRows,
  reportReferenceChoices,
} from "./audited-report-fixtures";
import ReportReferencePicker from "./ReportReferencePicker";

export default function AuditedReportParameters({
  definition,
  draft,
  setDraft,
  onCancel,
  onApply,
  onReset,
  error,
}: {
  definition: AuditedReportDefinition;
  draft: AuditedParameters;
  setDraft: (value: AuditedParameters) => void;
  onCancel: () => void;
  onApply: () => void;
  onReset: () => void;
  error: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), []);
  const updateField = (label: string, value: string) => {
    const fields = { ...draft.fields, [label]: value };
    if (label === "Kỳ báo cáo" && value !== "Tùy chọn") {
      const [from, to] = auditedPeriodRange(value);
      if ("Từ ngày" in fields) fields["Từ ngày"] = from;
      if ("Đến ngày" in fields) fields["Đến ngày"] = to;
    }
    if ((label === "Từ ngày" || label === "Đến ngày") && "Kỳ báo cáo" in fields)
      fields["Kỳ báo cáo"] = "Tùy chọn";
    setDraft({ ...draft, fields });
  };
  return (
    <div className="pc-overlay">
      <div
        className="pc-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audited-param-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
          if (event.key === "Tab") {
            const controls = [
              ...event.currentTarget.querySelectorAll<HTMLElement>(
                "button:not(:disabled),input:not(:disabled),select:not(:disabled)",
              ),
            ];
            if (event.shiftKey && document.activeElement === controls[0]) {
              event.preventDefault();
              controls.at(-1)?.focus();
            } else if (
              !event.shiftKey &&
              document.activeElement === controls.at(-1)
            ) {
              event.preventDefault();
              controls[0]?.focus();
            }
          }
        }}
      >
        <header>
          <h2 id="audited-param-title">Chọn tham số</h2>
          <button ref={closeRef} aria-label="Đóng tham số" onClick={onCancel}>
            <X size={20} />
          </button>
        </header>
        <div className="pc-drawer-content">
          <div className="pc-form-grid">
            {definition.labels.map((label) => {
              const field = definition.fields?.find(
                (field) => field.label === label,
              );
              const date =
                field?.kind === "date" || /^Ngày|ngày$|thời điểm$/.test(label);
              const values =
                definition.options?.[label] ??
                (label === "Đơn vị tính"
                  ? ["Đơn vị tính chính"]
                  : label === "Nhân viên"
                    ? ["", "NV001", "NV002"]
                    : /Tài khoản|tài khoản/.test(label)
                      ? [
                          "",
                          draft.fields[label] ||
                            (/phải trả/.test(definition.name) ? "331" : "131"),
                          "131",
                          "331",
                          "112",
                          "111",
                        ]
                      : undefined);
              return (
                <label key={label}>
                  <span className="pc-label">
                    {label}
                    {field?.required && <span> *</span>}
                  </span>
                  {date ? (
                    <ReportDateInput
                      label={label}
                      value={draft.fields[label]}
                      onChange={(value) => updateField(label, value)}
                    />
                  ) : label === "Năm" || field?.kind === "number" ? (
                    <input
                      aria-label={label}
                      type="number"
                      min="1900"
                      max="9999"
                      value={draft.fields[label]}
                      onInput={(event) =>
                        updateField(label, event.currentTarget.value)
                      }
                      onChange={(event) =>
                        updateField(label, event.target.value)
                      }
                    />
                  ) : label === "Tháng" ? (
                    <input
                      aria-label={label}
                      type="month"
                      value={draft.fields[label]}
                      onInput={(event) =>
                        updateField(label, event.currentTarget.value)
                      }
                      onChange={(event) =>
                        updateField(label, event.target.value)
                      }
                    />
                  ) : values ? (
                    <select
                      aria-label={label}
                      value={draft.fields[label] || ""}
                      onChange={(event) =>
                        updateField(label, event.target.value)
                      }
                    >
                      {!values.includes("") && draft.fields[label] === "" && (
                        <option value="">Tất cả</option>
                      )}
                      {[...new Set(values)].map((value) => (
                        <option key={value} value={value}>
                          {value || "Tất cả"}
                        </option>
                      ))}
                    </select>
                  ) : /Nhóm|Nhân viên|Đơn vị|Chi nhánh|Bộ phận|Kho|Khách hàng|Nhà cung cấp|Công trình|Hợp đồng|Đối tượng|Mã thống kê/.test(
                      label,
                    ) ? (
                    <ReportReferencePicker
                      label={label}
                      value={draft.fields[label]}
                      onChange={(value) => updateField(label, value)}
                      choices={reportReferenceChoices(label)}
                    />
                  ) : (
                    <input
                      aria-label={label}
                      value={draft.fields[label]}
                      placeholder="Tất cả"
                      onInput={(event) =>
                        updateField(label, event.currentTarget.value)
                      }
                      onChange={(event) =>
                        updateField(label, event.target.value)
                      }
                    />
                  )}
                </label>
              );
            })}
          </div>
          {!!definition.radios?.length && (
            <div className="ar-radio-group">
              {definition.radios.map((radio) => (
                <label key={radio.label}>
                  <input
                    type="radio"
                    name="audited-report-mode"
                    checked={draft.radio === radio.label}
                    onChange={() => setDraft({ ...draft, radio: radio.label })}
                  />
                  {radio.label}
                </label>
              ))}
            </div>
          )}
          {definition.selectors.map((selector, index) => (
            <SelectionTable
              key={index}
              title={selector.title}
              headers={selector.headers}
              rows={selectorSampleRows(selector)}
              selected={draft.selected[String(index)] ?? []}
              onChange={(ids) =>
                setDraft({
                  ...draft,
                  selected: { ...draft.selected, [String(index)]: ids },
                })
              }
              selectAllLabel={selector.selectAllLabel}
            />
          ))}
          {definition.checkboxes.map((check) => (
            <label className="pc-combine ar-check" key={check.label}>
              <input
                type="checkbox"
                checked={draft.checks[check.label] ?? false}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    checks: {
                      ...draft.checks,
                      [check.label]: event.target.checked,
                    },
                  })
                }
              />
              {check.label}
            </label>
          ))}
          {error && (
            <p className="pc-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer>
          <button onClick={onReset}>Xóa điều kiện</button>
          <div>
            <button onClick={onCancel}>Hủy</button>
            <button className="pc-primary" onClick={onApply}>
              Xem báo cáo
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
