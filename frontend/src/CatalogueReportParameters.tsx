import { useState } from "react";
import AuditedReportParameters from "./AuditedReportParameters";
import type { AuditedReportDefinition } from "./audited-report-schema";
import { initialAuditedParameters, validateAuditedParameters } from "./audited-report-parameters";
import "./audited-reports.css";
export default function CatalogueReportParameters({definition,onClose}:{definition:AuditedReportDefinition;onClose:()=>void}) {
  const [draft,setDraft]=useState(()=>initialAuditedParameters(definition));
  const [error,setError]=useState("");
  return <div className="pc-report" style={{position:"fixed",inset:0,zIndex:100000,background:"transparent",height:"100%",minHeight:0}}>
    <AuditedReportParameters definition={definition} draft={draft} setDraft={setDraft} error={error}
      onCancel={onClose} onReset={()=>{setDraft(initialAuditedParameters(definition));setError("");}}
      onApply={()=>{const message=validateAuditedParameters(draft,definition);setError(message);if(!message)onClose();}}/>
  </div>;
}
