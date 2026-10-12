import {useState} from 'react';
export type VoucherChoice={code:string;name:string;person?:string;address?:string;dept?:string;taxCode?:string;phone?:string;bankAccount?:string;bankName?:string};
export default function VoucherChoiceTable<T extends VoucherChoice>({kind,rows,onSelect}:{kind:'partner'|'employee';rows:T[];onSelect:(row:T)=>void}){
 const [query,setQuery]=useState('');
 const matches=rows.filter(row=>Object.values(row).join(' ').toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')));
 const headers=kind==='employee'?['Mã nhân viên','Tên nhân viên','Đơn vị','ĐT di động']:['Mã đối tượng','Tên đối tượng','Mã số thuế','Địa chỉ','Điện thoại','Loại đối tượng'];
 return <div className="misa-voucher-partner-dropdown" style={{width:kind==='employee'?750:980,maxWidth:'calc(100vw - 70px)',zIndex:100,maxHeight:340,overflow:'auto',background:'white'}}>
 <input aria-label={kind==='employee'?'Tìm nhân viên':'Tìm đối tượng'} placeholder="Tìm theo mã, tên hoặc thông tin liên quan" value={query} onChange={e=>setQuery(e.target.value)} style={{width:'calc(100% - 16px)',height:32,margin:8,padding:'0 8px',border:'1px solid #cbd5e1'}}/>
 <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr>{headers.map(text=><th key={text} style={{padding:'8px',textAlign:'left',background:'#e5e7eb',whiteSpace:'nowrap'}}>{text}</th>)}</tr></thead>
 <tbody>{matches.map(row=><tr key={row.code} tabIndex={0} aria-label={`Chọn ${row.code} ${row.name}`} onClick={()=>onSelect(row)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(row);}}} style={{cursor:'pointer',borderBottom:'1px solid #f1f5f9'}}>
 {(kind==='employee'?[row.code,row.name,row.dept||'',row.phone||'']:[row.code,row.name,row.taxCode||'',row.address||'',row.phone||'',row.code.startsWith('KH')?'Khách hàng':row.code.startsWith('NV')?'Nhân viên':row.code.startsWith('NCC')?'Nhà cung cấp':'Đối tượng']).map((value,index)=><td key={index} style={{padding:'8px',maxWidth:260}}>{value}</td>)}
 </tr>)}{!matches.length&&<tr><td colSpan={headers.length} style={{padding:16,textAlign:'center'}}>Không có dữ liệu phù hợp</td></tr>}</tbody></table>
 <div style={{padding:8,color:'#059669',borderTop:'1px solid #e2e8f0'}}>Tìm nhanh (F3) · {matches.length} kết quả</div>
 </div>;
}
