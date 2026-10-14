import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { SelectionTable } from "./MisaPurchaseContractReports";
import ReportDateInput from "./ReportDateInput";
import type { AuditedReportDefinition } from "./audited-report-schema";
import type { AuditedParameters } from "./audited-report-parameters";
import { auditedPeriodRange, taxMonthRange } from "./audited-report-parameters";
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
  const monthQuarterMode = definition.fields?.some(field => field.label === "Kỳ báo cáo" && field.kind === "radio") && definition.radios?.some(radio => radio.label === "Theo quý");
  const budgetPeriodMode = definition.category === "Ngân sách" && definition.radios?.some(radio=>radio.label === "Xem một kỳ");
  const budgetExpenseMode = definition.name === "Tình hình chi phí thực tế so với kế hoạch";
  useEffect(() => closeRef.current?.focus(), []);
  const updateField = (label: string, value: string) => {
    const fields = { ...draft.fields, [label]: value };
    if (
      (label === "Kỳ báo cáo" || label === "Khoảng thời gian") &&
      value !== "Tùy chọn"
    ) {
      const [from, to] = auditedPeriodRange(value);
      if ("Từ ngày" in fields) fields["Từ ngày"] = from;
      if ("Đến ngày" in fields) fields["Đến ngày"] = to;
    }
    if ((label === "Từ ngày" || label === "Đến ngày") && "Kỳ báo cáo" in fields)
      fields["Kỳ báo cáo"] = "Tùy chọn";
    if (
      (label === "Từ ngày" || label === "Đến ngày") &&
      "Khoảng thời gian" in fields
    )
      fields["Khoảng thời gian"] = "Tùy chọn";
    if (
      definition.printLayout === "taxUninvoiced" &&
      draft.radio === "Theo tháng" &&
      (label === "Tháng" || label === "Năm")
    ) {
      const range = taxMonthRange(fields.Tháng, fields.Năm);
      if (range) {
        fields["Từ ngày"] = range[0];
        fields["Đến ngày"] = range[1];
      }
    }
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
            {definition.labels
              .filter(label => !definition.fields?.some(field=>field.label === label && field.kind === "radio"))
              .filter(label => !(monthQuarterMode && (label === "Kỳ báo cáo" || (draft.radio === "Theo năm" && label === "Tháng"))))
              .map(label => budgetPeriodMode && label === "Xem theo" && draft.radio === "Xem một kỳ" ? "Kỳ báo cáo" : label)
              .map(label => monthQuarterMode && label === "Tháng" && draft.radio === "Theo quý" ? "Quý" : label)
              .filter(
                (label) =>
                  definition.printLayout !== "taxUninvoiced" ||
                  (draft.radio === "Theo tháng"
                    ? !["Khoảng thời gian", "Từ ngày", "Đến ngày"].includes(
                        label,
                      )
                    : !["Tháng", "Năm"].includes(label)),
              )
              .map((label) => {
                const field = budgetPeriodMode && label === "Kỳ báo cáo" ? {label,kind:"combo",required:false} : label === "Quý" && monthQuarterMode ? {label,kind:"combo",required:definition.fields?.find(item=>item.label === "Tháng")?.required} : label === "Năm" && monthQuarterMode && draft.radio === "Theo năm" ? {label,kind:"number",required:true} : definition.fields?.find(
                  (field) => field.label === label,
                );
                const date =
                  field?.kind === "date" ||
                  /^Ngày|ngày$|thời điểm$/.test(label);
                const values =
                  (monthQuarterMode && (label === "Tháng" || label === "Quý") ? Array.from({length:label === "Quý" ? 4 : 12}, (_,index)=>String(index+1)) : definition.options?.[label]) ??
                  (/ngân hàng/i.test(label)
                    ? ["", "VCB — 0011000123456", "BIDV — 1201000123456"]
                    : label === "Đơn vị tính"
                      ? ["Đơn vị tính chính"]
                      : label === "Nhân viên"
                        ? ["", "NV001", "NV002"]
                        : /Tài khoản|tài khoản/.test(label)
                          ? [
                              "",
                              draft.fields[label] ||
                                (/phải trả/.test(definition.name)
                                  ? "331"
                                  : "131"),
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
                        min={label === "Năm" ? 1900 : label === "Tháng" ? 1 : 0}
                        max={
                          label === "Năm"
                            ? 9999
                            : label === "Tháng"
                              ? 12
                              : undefined
                        }
                        value={draft.fields[label]}
                        onInput={(event) =>
                          updateField(label, event.currentTarget.value)
                        }
                        onChange={(event) =>
                          updateField(label, event.target.value)
                        }
                      />
                    ) : label === "Tháng" && !monthQuarterMode ? (
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
                          <option value="">
                            {field?.required
                              ? "Chọn " + label.toLocaleLowerCase("vi")
                              : "Tất cả"}
                          </option>
                        )}
                        {[...new Set(values)].map((value) => (
                          <option key={value} value={value}>
                            {value ||
                              (field?.required
                                ? "Chọn " + label.toLocaleLowerCase("vi")
                                : "Tất cả")}
                          </option>
                        ))}
                      </select>
                    ) : /Nhóm|Nhân viên|Đơn vị|Chi nhánh|Bộ phận|Kho|Khách hàng|Nhà cung cấp|Công trình|Hợp đồng|Đối tượng|Mã thống kê|Loại tài sản cố định|Kỳ tính giá thành/.test(
                        label,
                      ) ? (
                      <ReportReferencePicker
                        label={label}
                        value={draft.fields[label]}
                        onChange={(value) => updateField(label, value)}
                        choices={reportReferenceChoices(label, definition.name)}
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
              {definition.fields?.filter(field=>field.kind === "radio").map(field=><span key={field.label}>{field.label}</span>)}
              {definition.radios.filter(radio=>!budgetExpenseMode || !radio.label.startsWith("Khi ")).map((radio) => (
                <label key={radio.label}>
                  <input
                    type="radio"
                    name="audited-report-mode"
                    checked={draft.radio === radio.label}
                    onChange={() => {
                      const range =
                        definition.printLayout === "taxUninvoiced" &&
                        radio.label === "Theo tháng"
                          ? taxMonthRange(draft.fields.Tháng, draft.fields.Năm)
                          : null;
                      setDraft({
                        ...draft,
                        radio: radio.label,
                        fields: range
                          ? {
                              ...draft.fields,
                              "Từ ngày": range[0],
                              "Đến ngày": range[1],
                            }
                          : budgetPeriodMode && radio.label === "Xem một kỳ"
                            ? {...draft.fields,"Kỳ báo cáo":draft.fields["Kỳ báo cáo"] || "Tháng này"}
                          : monthQuarterMode && radio.label === "Theo quý"
                            ? {...draft.fields, Quý:draft.fields.Quý || "1"}
                            : draft.fields,
                      });
                    }}
                  />
                  {radio.label}
                </label>
              ))}
            </div>
          )}
          {budgetExpenseMode && <fieldset className="ar-radio-group">
            <legend>Cách lấy chi phí thực hiện</legend>
            {definition.radios?.filter(radio=>radio.label.startsWith("Khi ")).map(radio=><label key={radio.label}>
              <input type="radio" name="budget-expense-method" checked={(draft.fields["Cách lấy chi phí thực hiện"] || "Khi ghi nhận chi phí") === radio.label} onChange={()=>setDraft({...draft,fields:{...draft.fields,"Cách lấy chi phí thực hiện":radio.label}})}/>
              {radio.label}
            </label>)}
          </fieldset>}
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
