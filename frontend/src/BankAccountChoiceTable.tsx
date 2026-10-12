import {useState} from 'react';
export default function BankAccountChoiceTable({rows,onSelect}:{rows:{account:string;name:string}[];onSelect:(row:{account:string;name:string})=>void}){
 const [query,setQuery]=useState('');
 const matches=rows.filter(row=>`${row.account} ${row.name}`.toLowerCase().includes(query.toLowerCase()));
 return <div className="misa-voucher-partner-dropdown" style={{width:850,maxWidth:'calc(100vw - 70px)',zIndex:100,maxHeight:340,overflow:'auto',background:'white'}}>
 <input aria-label="Tìm tài khoản ngân hàng" placeholder="Tìm số tài khoản hoặc ngân hàng" value={query} onChange={e=>setQuery(e.target.value)} style={{width:'calc(100% - 16px)',margin:8,height:32,padding:'0 8px',border:'1px solid #cbd5e1'}}/>
 <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr>{['Số tài khoản','Tên ngân hàng','Chi nhánh','Diễn giải'].map(text=><th key={text} style={{padding:8,textAlign:'left',background:'#e5e7eb'}}>{text}</th>)}</tr></thead><tbody>{matches.map(row=><tr key={row.account} aria-label={`Chọn tài khoản ${row.account}`} tabIndex={0} onClick={()=>onSelect(row)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(row);}}} style={{cursor:'pointer',borderBottom:'1px solid #f1f5f9'}}><td style={{padding:8}}>{row.account}</td><td style={{padding:8}}>{row.name.split(' - ')[0]}</td><td style={{padding:8}}>{row.name.split(' - ').slice(1).join(' - ')}</td><td></td></tr>)}{!matches.length&&<tr><td colSpan={4} style={{padding:16,textAlign:'center'}}>Không có dữ liệu phù hợp</td></tr>}</tbody></table>
 <div style={{padding:8,borderTop:'1px solid #e2e8f0'}}>Tổng số: {matches.length}</div></div>;
}
