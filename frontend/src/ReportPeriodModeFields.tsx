import type { ReportComparisonDates } from "./report-period-range";
import ReportDateInput from "./ReportDateInput";
import "./report-period-mode-fields.css";

type Props = {
  mode: "quarter" | "year" | "custom";
  dates: ReportComparisonDates; setDates: (dates:ReportComparisonDates)=>void;
  fromMonth: number; toMonth: number; fromYear: number; toYear: number;
  setFromMonth: (value:number)=>void; setToMonth: (value:number)=>void;
  setFromYear: (value:number)=>void; setToYear: (value:number)=>void;
};
export default function ReportPeriodModeFields(props: Props) {
  if(props.mode === "custom") return <div className="report-period-mode-fields">
    {["So sánh kỳ","Với kỳ"].map((title,index)=><fieldset key={title}>
      <legend>{title}</legend>
      <div className="report-period-mode-row">{["Từ ngày","Đến ngày"].map((label,offset)=>{
        const key=index*2+offset;
        return <label key={label}><span>{label}</span><ReportDateInput label={`${title}: ${label}`} value={props.dates[key]} onChange={value=>props.setDates(props.dates.map((old,i)=>i===key?value:old) as ReportComparisonDates)}/></label>;
      })}</div>
    </fieldset>)}
  </div>;
  return <div className="report-period-mode-fields">
    {["Từ","Đến"].map((prefix,index)=>{
      const month=index?props.toMonth:props.fromMonth;
      const year=index?props.toYear:props.fromYear;
      const setMonth=index?props.setToMonth:props.setFromMonth;
      const setYear=index?props.setToYear:props.setFromYear;
      return <div className="report-period-mode-row" key={prefix}>
        {props.mode === "quarter" && <label><span>{prefix} quý</span><select aria-label={`${prefix} quý`} value={Math.ceil(month/3)} onChange={event=>setMonth((Number(event.target.value)-1)*3+1)}>{[1,2,3,4].map(quarter=><option value={quarter} key={quarter}>Quý {quarter}</option>)}</select></label>}
        <label><span>{props.mode === "year"?`${prefix} năm`:"Năm"}</span><input type="number" aria-label={props.mode === "year"?`${prefix} năm`:`Năm ${prefix.toLowerCase()} quý`} min={1900} max={9999} value={year} onChange={event=>setYear(Number(event.target.value))}/></label>
      </div>;
    })}
  </div>;
}
