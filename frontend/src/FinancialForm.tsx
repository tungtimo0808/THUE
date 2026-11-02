import { useState, type ReactNode } from "react";
import { apiClient, getSelectedCompanyId } from "./apiClient";
import "./financial-form.css";

export type FormSignature = {
  preparer_name: string;
  chief_accountant_name: string;
  representative_name: string;
  report_date: string;
};

const EMPTY_SIGNATURE: FormSignature = {
  preparer_name: "",
  chief_accountant_name: "",
  representative_name: "",
  report_date: "",
};

function signatureKey() {
  return `erp_form_signature_${getSelectedCompanyId()}`;
}

export function readFormSignature(): FormSignature {
  try {
    return { ...EMPTY_SIGNATURE, ...JSON.parse(localStorage.getItem(signatureKey()) || "{}") };
  } catch {
    return { ...EMPTY_SIGNATURE };
  }
}

/** Saves the file an export response carries; throws when the server sent none. */
export function saveStatementFile(response: { file_base64?: string; file_name?: string; content_type?: string }) {
  if (!response?.file_base64) throw new Error("Máy chủ chưa trả về tệp báo cáo.");
  const bytes = Uint8Array.from(atob(response.file_base64), (char) => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: response.content_type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = response.file_name || "bao-cao";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return link.download;
}

export function exportErrorText(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Không xuất được báo cáo.";
}

/** Cash-flow screens hold no run of their own, so each export refreshes one for the current year. */
export async function exportCashFlow(method: "DIRECT" | "INDIRECT", format: "EXCEL" | "PDF") {
  const companyId = getSelectedCompanyId();
  const year = new Date().getFullYear();
  const created: any = await apiClient.post("/api/v1/reports/cash-flow/runs/", {
    company_id: companyId,
    template_code: "B03-DN",
    cash_flow_method: method,
    period_start_date: `${year}-01-01`,
    period_end_date: `${year}-12-31`,
  });
  const runId = created?.run?.id || created?.id;
  if (!runId) throw new Error("Chưa lập được báo cáo lưu chuyển tiền tệ.");
  const response: any = await apiClient.post(
    `/api/v1/reports/cash-flow/runs/${encodeURIComponent(runId)}/export/?company_id=${encodeURIComponent(companyId)}`,
    { company_id: companyId, export_format: format, ...readFormSignature() },
  );
  return saveStatementFile(response);
}

function SignatureBar() {
  const [signature, setSignature] = useState(readFormSignature);
  const update = (field: keyof FormSignature, value: string) => {
    const next = { ...signature, [field]: value };
    setSignature(next);
    localStorage.setItem(signatureKey(), JSON.stringify(next));
  };
  const fields: Array<[keyof FormSignature, string]> = [
    ["preparer_name", "Người lập biểu"],
    ["chief_accountant_name", "Kế toán trưởng"],
    ["representative_name", "Người đại diện theo pháp luật"],
  ];
  return (
    <footer className="financial-form-signature">
      {fields.map(([field, label]) => (
        <label key={field}>
          {label}
          <input value={signature[field]} maxLength={200} onChange={(event) => update(field, event.target.value)} />
        </label>
      ))}
      <label>
        Ngày lập
        <input type="date" value={signature.report_date} onChange={(event) => update("report_date", event.target.value)} />
      </label>
    </footer>
  );
}

export function FinancialFormFrame({ tabs, active, onSelect, children }: {
  tabs?: ReadonlyArray<readonly [code: string, report: string]>;
  active?: string;
  onSelect?: (report: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="financial-form-frame">
      {tabs && (
        <nav className="financial-form-tabs" role="tablist" aria-label="Biểu mẫu báo cáo tài chính">
          {tabs.map(([code, report]) => (
            <button key={code} type="button" role="tab" aria-selected={active === code} onClick={() => onSelect?.(report)}>
              {code}
            </button>
          ))}
        </nav>
      )}
      <div className="financial-form-body">{children}</div>
      <SignatureBar />
    </div>
  );
}
