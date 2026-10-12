import {CASH_PERIODS,cashPeriodDates} from "./cash-report-periods";
import {useEffect,useState} from 'react';
import {cashDateRange,cashDateValue} from './cash-date';
import './cash-enhancements.css';
export type CashFilter={reason:string;status:string;from:string;to:string;preset:string;bankAccount?:string};
export const defaultCashFilter=():CashFilter=>{const range=cashDateRange('Đầu năm tới hiện tại')!;return {reason:'all',status:'all',from:range[0],to:range[1],preset:'Đầu năm đến hiện tại'};};
export const CASH_VISIBLE_COLUMNS=['Ngày hạch toán','Ngày chứng từ','Số chứng từ','Diễn giải','Số tiền','Đối tượng','Lý do thu/chi','Loại chứng từ','Hạch toán gộp nhiều hóa đơn','Trạng thái','Chức năng'];
export default function CashAdvancedPanel({mode,filter,hidden,reasons,onFilter,onColumns,onClose,bankAccounts}:{bankAccounts?:{account:string;name:string}[];mode:'filters'|'columns';filter:CashFilter;hidden:number[];reasons:string[];onFilter:(value:CashFilter)=>void;onColumns:(value:number[])=>void;onClose:()=>void}){
 const[draft,setDraft]=useState(filter),[columns,setColumns]=useState(hidden),[query,setQuery]=useState(''),[error,setError]=useState('');
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[onClose]);
 const field=(key:keyof CashFilter,value:string)=>setDraft(old=>({...old,[key]:value}));
 return <div className="ce-overlay" onClick={onClose}><aside className="ce-panel" role="dialog" aria-modal="true" aria-label={mode==='filters'?'Bộ lọc':'Tùy chỉnh giao diện'} onClick={event=>event.stopPropagation()}>
  <header><h2>{mode==='filters'?'Bộ lọc':'Tùy chỉnh giao diện'}</h2><button aria-label="Đóng bảng tùy chỉnh" onClick={onClose}>×</button></header>
  <div className="ce-panel-body">{mode==='filters'?<>
   <label>Lý do thu, chi<select value={draft.reason} onChange={e=>field('reason',e.target.value)}><option value="all">Tất cả</option>{reasons.map(reason=><option key={reason}>{reason}</option>)}</select></label>
   {bankAccounts&&<label>Tài khoản ngân hàng<select value={draft.bankAccount||'all'} onChange={event=>field('bankAccount',event.target.value)}><option value="all">Tất cả</option>{bankAccounts.map(account=><option key={account.account} value={account.account}>{account.account} - {account.name}</option>)}</select></label>}
   <label>Trạng thái ghi sổ<select value={draft.status} onChange={e=>field('status',e.target.value)}><option value="all">Tất cả</option><option value="posted">Đã ghi sổ</option><option value="draft">Chưa ghi sổ</option></select></label>
   <label>Thời gian<select value={draft.preset} onChange={e=>{const preset=e.target.value,range=cashPeriodDates(preset);setDraft(old=>({...old,preset,...(range?{from:range[0],to:range[1]}:{})}));}}>{CASH_PERIODS.map(period=><option key={period}>{period}</option>)}</select></label>
   <label>Từ ngày<input autoFocus aria-label="Từ ngày lọc thu chi" placeholder="DD/MM/YYYY" value={draft.from} onChange={e=>setDraft(old=>({...old,from:e.target.value,preset:'Tùy chọn'}))}/></label>
   <label>Đến ngày<input aria-label="Đến ngày lọc thu chi" placeholder="DD/MM/YYYY" value={draft.to} onChange={e=>setDraft(old=>({...old,to:e.target.value,preset:'Tùy chọn'}))}/></label>
  </>:<><input autoFocus aria-label="Tìm cột thu chi" placeholder="Nhập từ khóa tìm kiếm" value={query} onChange={e=>setQuery(e.target.value)}/><p>Tên cột dữ liệu</p>{CASH_VISIBLE_COLUMNS.map((label,index)=>label.toLowerCase().includes(query.toLowerCase())&&<label className="ce-column" key={label}><input type="checkbox" checked={!columns.includes(index+2)} onChange={e=>setColumns(old=>e.target.checked?old.filter(id=>id!==index+2):[...old,index+2])}/>{label}</label>)}</>}
   {error&&<p role="alert" className="ce-error">{error}</p>}
  </div><footer><button onClick={()=>mode==='filters'?setDraft(defaultCashFilter()):setColumns([])}>{mode==='filters'?'Bộ lọc mặc định':'Lấy mẫu ngầm định'}</button><button className="ce-primary" onClick={()=>{if(mode==='filters'){if(!Number.isFinite(cashDateValue(draft.from))||!Number.isFinite(cashDateValue(draft.to))||cashDateValue(draft.from)>cashDateValue(draft.to)){setError('Khoảng ngày không hợp lệ. Nhập ngày theo DD/MM/YYYY.');return;}onFilter(draft);}else onColumns(columns);onClose();}}>{mode==='filters'?'Lọc':'Cất'}</button></footer>
 </aside></div>;
}
export function cashReason(kind:string,description:string):string{
 if(/hoàn ứng/i.test(description))return 'Thu hoàn ứng nhân viên';
 if(/rút tiền/i.test(description))return 'Rút tiền gửi về nhập quỹ';
 if(/tạm ứng/i.test(description)&&kind==='payment')return 'Tạm ứng cho nhân viên';
 if(/trả lương/i.test(description))return 'Trả lương nhân viên';
 if(/gửi tiền|nộp tiền.*ngân hàng/i.test(description))return 'Gửi tiền vào ngân hàng';
 return kind==='receipt'?'Thu khác':'Chi khác';
}

