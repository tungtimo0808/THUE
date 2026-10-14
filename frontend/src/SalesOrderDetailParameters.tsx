import { useState } from "react";
import AuditedReportParameters from "./AuditedReportParameters";
import type { AuditedReportDefinition } from "./audited-report-schema";
import { initialAuditedParameters, validateAuditedParameters } from "./audited-report-parameters";
import { MISA_REPORT_DEFINITIONS } from "./misa-report-definitions";
import "./audited-reports.css";

const definition:AuditedReportDefinition = {
  name:"Báo cáo chi tiết tình hình thực hiện đơn đặt hàng", category:"Bán hàng", viewer:"parameterOnly",
  labels:["Kỳ báo cáo","Từ ngày","Đến ngày","Đơn vị","Nhân viên"], headers:[],
  selectors:[{title:"Đơn đặt hàng",headers:["Số đơn hàng","Ngày đơn hàng","Khách hàng","Diễn giải"],selectAllLabel:"Chọn tất cả đơn đặt hàng"}],
  checkboxes:[], fields:[{label:"Kỳ báo cáo",kind:"combo"},{label:"Từ ngày",kind:"date"},{label:"Đến ngày",kind:"date"}],
  options:{"Kỳ báo cáo":MISA_REPORT_DEFINITIONS[0].options?.["Kỳ báo cáo"] || ["Tháng này","Tùy chọn"]},
};
export default function SalesOrderDetailParameters({onClose}:{onClose:()=>void}) {
  const [draft,setDraft]=useState(()=>initialAuditedParameters(definition));
  const [error,setError]=useState("");
  return <div className="pc-report" style={{position:"fixed",inset:0,zIndex:100000,background:"transparent",height:"100%",minHeight:0}}>
    <AuditedReportParameters definition={definition} draft={draft} setDraft={setDraft} error={error}
      onCancel={onClose} onReset={()=>{setDraft(initialAuditedParameters(definition));setError("");}}
      onApply={()=>{const message=validateAuditedParameters(draft,definition);setError(message);if(!message)onClose();}}/>
  </div>;
}
