import { useState } from "react";
import { MISA_REPORT_DEFINITIONS } from "./misa-report-definitions";
import ReportDateInput from "./ReportDateInput";
import EmailSenderDialog from "./EmailSenderDialog";
import ChatRecipientPicker from "./ChatRecipientPicker";
import "./report-schedule-dialog.css";

export default function ReportScheduleDialog({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [channel, setChannel] = useState("email");
  const [frequency, setFrequency] = useState("Hàng tuần");
  const [period, setPeriod] = useState("Tuần này");
  const frequencyPeriods: Record<string, string[]> = {
    "Hàng ngày": ["Hôm nay", "Hôm qua", "Tuần này", "Tháng này"],
    "Hàng tuần": ["Tuần này", "Tuần trước", "Tháng này"],
    "Hàng tháng": ["Tháng này", "Tháng trước", "Quý này", "Tuần này"],
  };
  const legacyPeriods = ["Hôm nay", "Tuần này", "Tháng này", "Quý này", "Năm nay"].filter(value=>!frequencyPeriods[frequency].includes(value));
  const [cc, setCc] = useState(false), [bcc, setBcc] = useState(false);
  const [translationOptions, setTranslationOptions] = useState(false);
  const [senderDialogOpen, setSenderDialogOpen] = useState(false);
  const [reportPickerOpen, setReportPickerOpen] = useState(false);
  const [reportQuery, setReportQuery] = useState("");
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [selectionBeforePicker, setSelectionBeforePicker] = useState<string[]>([]);
  const [analysisMode, setAnalysisMode] = useState(false);
  const [analysisBeforePicker, setAnalysisBeforePicker] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const branches = ["Trụ sở chính", "Chi nhánh TP. Hồ Chí Minh"];
  const [selectedBranches, setSelectedBranches] = useState<string[]>(["Trụ sở chính"]);
  const openReportPicker = () => { setSelectionBeforePicker([...selectedReports]); setAnalysisBeforePicker(analysisMode); setReportPickerOpen(true); };
  const cancelReportPicker = () => { setSelectedReports(selectionBeforePicker); setAnalysisMode(analysisBeforePicker); setReportPickerOpen(false); };
  const reportChoices = MISA_REPORT_DEFINITIONS.filter(report=>report.name.toLocaleLowerCase("vi").includes(reportQuery.toLocaleLowerCase("vi")));
  const toggleReport = (name: string) => setSelectedReports(current=>current.includes(name) ? current.filter(item=>item !== name) : [...current,name]);
  return <div onKeyDown={event=>{if(event.key === "Escape"){event.stopPropagation();if(reportPickerOpen)cancelReportPicker();else onClose();}}} style={{ position: "fixed", inset: 0, zIndex: 100000, background: "#0006", display: "grid", placeItems: "center" }}>
    <div className="misa-report-schedule-dialog" role="dialog" aria-modal="true" aria-label="Lập lịch gửi báo cáo" style={{ background: "white", width: "min(960px, 95vw)", maxHeight: "92vh", overflowY: "auto", padding: 24, borderRadius: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}><h2>Lập lịch gửi báo cáo</h2><button type="button" aria-label="Đóng lịch gửi" onClick={onClose}>×</button></div>
      <p style={{ textAlign: "center" }}>1. CHỌN BÁO CÁO — 2. LẬP LỊCH GỬI</p>
      <form onSubmit={event=>event.preventDefault()}>
        <div style={{ display: step === 1 ? "block" : "none" }}>
          <label><input type="radio" name="schedule-mode" checked={!analysisMode} onChange={()=>setAnalysisMode(false)} /> Gửi số liệu báo cáo định kỳ</label><br />
          <label><input type="radio" name="schedule-mode" checked={analysisMode} onChange={()=>setAnalysisMode(true)} /> Sổ Việt AI phân tích báo cáo và gửi kết quả định kỳ</label>
          <table aria-label="Báo cáo đã chọn để lập lịch" style={{ width: "100%", borderCollapse: "collapse", margin: "12px 0" }}><thead><tr><th style={{ textAlign: "left" }}>Tên báo cáo</th><th aria-label="Thao tác" /></tr></thead><tbody>{selectedReports.map(name=><tr key={name}><td style={{ borderBottom: "1px solid #ddd", padding: 8 }}>{name}</td><td><button type="button" aria-label={`Xóa ${name} khỏi lịch gửi`} onClick={()=>toggleReport(name)}>×</button></td></tr>)}</tbody></table>
          <button type="button" onClick={openReportPicker}>Chọn báo cáo</button><button type="button" onClick={()=>setSelectedReports([])}>Xóa hết dòng</button>
          <p><label>Chọn báo cáo<select aria-label="Chọn báo cáo" value={selectedReports} onChange={event=>setSelectedReports(Array.from(event.target.selectedOptions,option=>option.value))} multiple style={{ display: "block", width: "100%", height: 240 }}>{MISA_REPORT_DEFINITIONS.map(report=><option key={report.name}>{report.name}</option>)}</select></label></p>
        </div>
        <div style={{ display: step === 2 ? "block" : "none" }}>
          <label>Tên lịch gửi<input aria-label="Tên lịch gửi" style={{ display: "block", width: "100%" }} /></label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, margin: "12px 0" }}>
            <label>Tần suất gửi<select aria-label="Tần suất gửi" value={frequency} onChange={event=>{setFrequency(event.target.value);setPeriod(frequencyPeriods[event.target.value][0]);}}>{["Hàng ngày","Hàng tuần","Hàng tháng"].map(value=><option key={value}>{value}</option>)}</select></label>
            <label>Ngày bắt đầu gửi<ReportDateInput label="Ngày bắt đầu gửi" value={startDate} onChange={setStartDate} /></label><label>Ngày kết thúc gửi<ReportDateInput label="Ngày kết thúc gửi" value={endDate} onChange={setEndDate} /></label>
            <label>Giờ gửi<select aria-label="Giờ gửi" defaultValue="21:00">{["06:00","17:00","21:00"].map(value=><option key={value}>{value}</option>)}</select></label>
            <label>Kỳ báo cáo<select aria-label="Kỳ báo cáo" value={period} onChange={event=>setPeriod(event.target.value)}><optgroup label="Kỳ theo tần suất">{frequencyPeriods[frequency].map(value=><option key={value}>{value}</option>)}</optgroup>{legacyPeriods.length>0&&<optgroup label="Các lựa chọn hiện có">{legacyPeriods.map(value=><option key={value}>{value}</option>)}</optgroup>}</select></label>
            <label>Ngôn ngữ<select aria-label="Ngôn ngữ">{["Tiếng Việt","Tiếng Anh","Tiếng Trung","Tiếng Hàn"].map(value=><option key={value}>{value}</option>)}</select></label>
          </div>
          <label>Chi nhánh<select aria-label="Chi nhánh" multiple value={selectedBranches} onChange={event=>setSelectedBranches(Array.from(event.target.selectedOptions,option=>option.value))} style={{ display: "block", width: "100%" }}>{branches.map(branch=><option key={branch}>{branch}</option>)}</select></label>
          <p><label><input type="checkbox" checked={selectedBranches.length === branches.length} onChange={event=>setSelectedBranches(event.target.checked ? [...branches] : [])} /> Chọn tất cả</label></p>
          <div role="tablist" aria-label="Kênh gửi"><button type="button" role="tab" aria-selected={channel === "chat"} onClick={()=>setChannel("chat")}>Gửi qua Sổ Việt Chat</button><button type="button" role="tab" aria-selected={channel === "email"} onClick={()=>setChannel("email")}>Gửi qua Email</button></div>
          <div style={{ display: channel === "email" ? "block" : "none" }}>
            <h3>Thông tin email gửi đi</h3><label>Từ *<div style={{display:"flex",gap:6}}><input aria-label="Từ" type="email" style={{ display: "block", width: "100%" }} /><button type="button" aria-label="Thêm cấu hình email gửi" onClick={()=>setSenderDialogOpen(true)}>+</button></div></label>
            <label>Đến<input aria-label="Đến" style={{ display: "block", width: "100%" }} /></label><button type="button" onClick={()=>setCc(value=>!value)}>Cc</button><button type="button" onClick={()=>setBcc(value=>!value)}>Bcc</button>
            {cc && <label>Cc<input aria-label="Cc" /></label>}{bcc && <label>Bcc<input aria-label="Bcc" /></label>}
            <label>Tiêu đề<input aria-label="Tiêu đề" style={{ display: "block", width: "100%" }} /></label>
          </div>
          <div style={{ display: channel === "chat" ? "block" : "none" }}><h3>Thông tin gửi đi</h3><label>Người nhận<ChatRecipientPicker /></label></div>
          <label>Nội dung<textarea aria-label="Nội dung" rows={5} style={{ display: "block", width: "100%" }} /></label>
          <div aria-label="Tùy chọn nội dung email" style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0" }}>
            {["Ngắn hơn", "Thân mật hơn", "Chuyên nghiệp hơn", "Bản trước", "Bản sau", "Về bản gốc"].map(label=><button key={label} type="button">{label}</button>)}
            <button type="button" aria-label="Thêm yêu cầu cho Sổ Việt AI">+</button>
            <button type="button" aria-expanded={translationOptions} onClick={()=>setTranslationOptions(value=>!value)}>Tự động dịch</button>
            {translationOptions && <label>Ngôn ngữ dịch<select aria-label="Ngôn ngữ dịch"><option>Tiếng Anh</option><option>Tiếng Trung</option><option>Tiếng Hàn</option></select></label>}
          </div>
          <fieldset style={{ border: 0, padding: 0, margin: "12px 0" }}><legend>Định dạng tệp báo cáo đính kèm</legend><label><input type="radio" name="schedule-format" value="excel" defaultChecked /> Excel</label><label><input type="radio" name="schedule-format" value="pdf" /> PDF</label></fieldset>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}><button type="button" onClick={step === 1 ? onClose : ()=>setStep(1)}>{step === 1 ? "Hủy" : "Quay lại"}</button><button type="button" onClick={step === 1 ? ()=>setStep(2) : onClose}>{step === 1 ? "Tiếp tục" : "Lưu"}</button></div>
      </form>
      {senderDialogOpen&&<EmailSenderDialog onClose={()=>setSenderDialogOpen(false)} />}
      {reportPickerOpen && <div style={{ position: "fixed", inset: 0, zIndex: 100001, background: "#0006", display: "grid", placeItems: "center" }}><div role="dialog" aria-modal="true" aria-label="Chọn báo cáo" style={{ width: "min(800px, 90vw)", maxHeight: "85vh", background: "white", padding: 20, borderRadius: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}><h2>Chọn báo cáo</h2><button type="button" aria-label="Đóng chọn báo cáo" onClick={cancelReportPicker}>×</button></div>
        <label><input type="radio" name="picker-mode" checked={!analysisMode} onChange={()=>setAnalysisMode(false)} /> Gửi số liệu báo cáo định kỳ</label><label><input type="radio" name="picker-mode" checked={analysisMode} onChange={()=>setAnalysisMode(true)} /> Sổ Việt AI phân tích báo cáo và gửi kết quả định kỳ</label>
        <input aria-label="Tìm báo cáo để lập lịch" placeholder="Nhập từ khóa tìm kiếm" value={reportQuery} onChange={event=>setReportQuery(event.target.value)} />
        <div style={{ maxHeight: "55vh", overflowY: "auto", margin: "12px 0" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><th><input type="checkbox" aria-label="Chọn tất cả báo cáo trong bảng" checked={reportChoices.length > 0 && reportChoices.every(report=>selectedReports.includes(report.name))} onChange={event=>{const visible = new Set(reportChoices.map(report=>report.name));setSelectedReports(current=>event.target.checked ? [...new Set([...current,...visible])] : current.filter(name=>!visible.has(name)));}} /></th><th style={{ textAlign: "left" }}>Tên báo cáo</th></tr></thead><tbody>{reportChoices.map(report=><tr key={report.name}><td><input type="checkbox" aria-label={`Chọn ${report.name}`} checked={selectedReports.includes(report.name)} onChange={()=>toggleReport(report.name)} /></td><td style={{ borderBottom: "1px solid #ddd", padding: 8 }}>{report.name}</td></tr>)}</tbody></table>{!reportChoices.length && <p>Không có dữ liệu phù hợp</p>}</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}><button type="button" onClick={cancelReportPicker}>Hủy</button><button type="button" onClick={()=>setReportPickerOpen(false)}>Đồng ý</button></div>
      </div></div>}
    </div>
  </div>;
}
