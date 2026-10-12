import {useMemo,useState} from 'react';
import {cashLedger,cashAdvanceSummary,type CashEntry} from './cash-operations';
import {cashDateRange} from './cash-date';
import {parseReportDate,formatReportDate} from './report-date';
import {downloadCashCsv} from './cash-download';
import './cash-enhancements.css';
export default function MisaCashSupplementaryReport({id,entries,onBack}:{id:string;entries:CashEntry[];onBack:()=>void}){
 const range=cashDateRange('Tháng này')!;
 const[from,setFrom]=useState(parseReportDate(range[0])),[to,setTo]=useState(parseReportDate(range[1]));
 const rows=useMemo(()=>entries.map(row=>({...row,date:parseReportDate(row.date)})).filter(row=>row.date),[entries]);
 const ledger=cashLedger(rows,from,to),advances=cashAdvanceSummary(rows,from,to),advanceMode=id==='advance141';
 const header=advanceMode?['Nhân viên','Số dư đầu kỳ','Tạm ứng trong kỳ','Hoàn ứng trong kỳ','Số dư cuối kỳ']:['Ngày','Số phiếu thu','Số phiếu chi','Diễn giải','Thu','Chi','Tồn quỹ'];
 const data:(string|number)[][]=advanceMode?advances.map(row=>[row.person,row.opening,row.advance,row.refund,row.closing]):ledger.rows.map(row=>[formatReportDate(row.date),row.kind==='receipt'?row.code||'':'',row.kind==='payment'?row.code||'':'',row.description||'',row.receipt,row.payment,row.balance]);
 const title=advanceMode?'TỔNG HỢP TẠM ỨNG THEO NHÂN VIÊN':'SỔ QUỸ TIỀN MẶT',invalid=!from||!to||from>to;
 return <section className="ce-form"><div className="ce-toolbar"><button onClick={onBack}>Danh sách báo cáo</button><label>Từ ngày<input aria-label="Từ ngày báo cáo bổ sung" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Đến ngày<input aria-label="Đến ngày báo cáo bổ sung" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><button onClick={()=>downloadCashCsv(title,[header,...data])}>Xuất CSV</button><button onClick={()=>window.print()}>In</button></div>
 <h2>{title}</h2><p>Từ ngày {formatReportDate(from)} đến ngày {formatReportDate(to)}</p>{invalid?<p role="alert" className="ce-error">Nhập đủ khoảng ngày; từ ngày phải trước hoặc bằng đến ngày.</p>:<div className="ce-table-scroll"><table><thead><tr>{header.map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{!advanceMode&&<tr className="ce-total"><td colSpan={6}>Số dư đầu kỳ</td><td>{ledger.opening.toLocaleString('vi-VN')}</td></tr>}{data.map((row,index)=><tr key={index}>{row.map((cell,i)=><td key={i}>{typeof cell==='number'?cell.toLocaleString('vi-VN'):cell}</td>)}</tr>)}{!data.length&&<tr><td colSpan={header.length}>Không có phát sinh trong kỳ</td></tr>}</tbody><tfoot><tr className="ce-total"><td colSpan={header.length-1}>{advanceMode?'Tổng dư tạm ứng cuối kỳ':'Số dư cuối kỳ'}</td><td>{(advanceMode?advances.reduce((sum,row)=>sum+row.closing,0):ledger.closing).toLocaleString('vi-VN')}</td></tr></tfoot></table></div>}</section>;
}
