import {useState} from 'react';
import {CASH_PERIODS,cashPeriodDates} from './cash-report-periods';
import {cashDateValue} from './cash-date';

const rows=[
 {type:'Đơn mua hàng',code:'PO-2026-089',date:'20/09/2026',desc:'Hợp đồng cung cấp thiết bị văn phòng',val:32000000},
 {type:'Giấy tạm ứng',code:'TU-0021',date:'25/09/2026',desc:'Đề nghị tạm ứng công tác phí quý 4',val:15000000},
 {type:'Khế ước vay',code:'KUV-VCB-04',date:'10/08/2026',desc:'Hạn mức vay vốn lưu động đợt 4/2026',val:500000000},
];
export default function CashReferencePicker({onClose,onSelect}:{onClose:()=>void;onSelect:(codes:string[])=>void}){
 const initial=cashPeriodDates('Tháng này')!;
 const [period,setPeriod]=useState('Tháng này'),[from,setFrom]=useState(initial[0]),[to,setTo]=useState(initial[1]);
 const [field,setField]=useState('Loại chứng từ'),[value,setValue]=useState(''),[search,setSearch]=useState(''),[selected,setSelected]=useState<string[]>([]),[error,setError]=useState('');
 const [filter,setFilter]=useState<{from:string;to:string;field:string;value:string}|null>(null);
 const visible=rows.filter(row=>row.code.toLowerCase().includes(search.toLowerCase())&&(!filter||cashDateValue(row.date)>=cashDateValue(filter.from)&&cashDateValue(row.date)<=cashDateValue(filter.to)&&(filter.field==='Loại chứng từ'?row.type:row.code).toLowerCase().includes(filter.value.toLowerCase())));
 const toggle=(code:string)=>setSelected(prev=>prev.includes(code)?prev.filter(item=>item!==code):[...prev,code]);
 const apply=()=>{if(!Number.isFinite(cashDateValue(from))||!Number.isFinite(cashDateValue(to))||cashDateValue(from)>cashDateValue(to)){setError('Khoảng ngày không hợp lệ.');return;}setError('');setFilter({from,to,field,value});};
 return <div className="misa-tax-modal-overlay" style={{zIndex:10000}}><div className="misa-tax-modal-window" role="dialog" aria-label="Chọn chứng từ tham chiếu" style={{maxWidth:1150}}>
 <header className="misa-tax-modal-header"><h2>Chọn chứng từ tham chiếu</h2><button type="button" aria-label="Đóng tham chiếu" onClick={onClose}>×</button></header>
 <div className="misa-tax-modal-body" style={{padding:16}}>
 <div className="ce-fields"><label>Tìm theo<select value={field} onChange={e=>setField(e.target.value)}><option>Loại chứng từ</option><option>Số chứng từ</option></select></label><label>Giá trị<input value={value} onChange={e=>setValue(e.target.value)}/></label><label>Khoảng thời gian<select value={period} onChange={e=>{setPeriod(e.target.value);const range=cashPeriodDates(e.target.value);if(range){setFrom(range[0]);setTo(range[1]);}}}>{CASH_PERIODS.map(item=><option key={item}>{item}</option>)}</select></label><label>Từ<input value={from} onChange={e=>{setFrom(e.target.value);setPeriod('Tùy chọn');}}/></label><label>Đến<input value={to} onChange={e=>{setTo(e.target.value);setPeriod('Tùy chọn');}}/></label><button type="button" onClick={apply}>Lấy dữ liệu</button></div>
 {error&&<p role="alert">{error}</p>}
 <input aria-label="Tìm theo số chứng từ" placeholder="Tìm theo số chứng từ" value={search} onChange={e=>setSearch(e.target.value)}/>
 <p style={{fontSize:12,color:'#64748b'}}>Các chứng từ mẫu hiện có được giữ nguyên. Bấm Lấy dữ liệu để áp dụng khoảng ngày.</p>
 <div style={{overflowX:'auto'}}><table className="misa-voucher-table"><thead><tr><th><input aria-label="Chọn tất cả chứng từ" type="checkbox" checked={visible.length>0&&visible.every(row=>selected.includes(row.code))} onChange={e=>setSelected(prev=>e.target.checked?[...new Set([...prev,...visible.map(row=>row.code)])]:prev.filter(code=>!visible.some(row=>row.code===code)))}/></th>{['Ngày hạch toán','Ngày chứng từ','Số chứng từ','Diễn giải','Đối tượng','Tên đối tượng','TK Nợ','TK Có','Số tiền','Loại chứng từ','Thao tác'].map(text=><th key={text}>{text}</th>)}</tr></thead>
 <tbody>{visible.map(row=><tr key={row.code}><td><input type="checkbox" aria-label={`Chọn ${row.code}`} checked={selected.includes(row.code)} onChange={()=>toggle(row.code)}/></td><td>{row.date}</td><td>{row.date}</td><td>{row.code}</td><td>{row.desc}</td><td></td><td></td><td></td><td></td><td>{row.val.toLocaleString('vi-VN')}</td><td>{row.type}</td><td><button type="button" onClick={()=>onSelect([row.code])}>Chọn</button></td></tr>)}{!visible.length&&<tr><td colSpan={12} style={{textAlign:'center'}}>Không có dữ liệu</td></tr>}</tbody></table></div>
 </div><footer className="misa-voucher-footer"><span>Đã chọn: {selected.length}</span><div style={{display:'flex',gap:8}}><button onClick={onClose}>Hủy</button><button onClick={onClose}>Đóng</button><button disabled={!selected.length} onClick={()=>onSelect(selected)}>Đồng ý</button></div></footer>
 </div></div>;
}
