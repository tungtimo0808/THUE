import {useEffect,useRef,useState} from 'react';
export default function DirectoryChoiceField({value,onChange,label,options=[]}:{value:string;onChange:(value:string)=>void;label:string;options?:string[]}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState('');const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!open)return;const close=(event:MouseEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close);},[open]);
 const matches=options.filter(option=>option.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')));
 return <div ref={root} style={{position:'relative',zIndex:open?2000:undefined}}><input aria-label={label} value={value} onChange={event=>onChange(event.target.value)} style={{paddingRight:26,width:'100%'}}/><button type="button" aria-label={`Chọn ${label}`} aria-expanded={open} onClick={()=>{setQuery('');setOpen(!open);}} style={{position:'absolute',right:4,top:5,border:0,background:'transparent',cursor:'pointer'}}>⌄</button>
 {open&&<div role="dialog" aria-label={`Danh sách ${label}`} style={{position:'absolute',top:'100%',left:0,width:'100%',minWidth:280,maxHeight:280,overflow:'auto',background:'white',border:'1px solid #d1d5db',boxShadow:'0 4px 12px #0002'}}><input aria-label={`Tìm ${label}`} value={query} placeholder="Tìm kiếm" onChange={event=>setQuery(event.target.value)} style={{margin:8,width:'calc(100% - 16px)'}}/>
 {label==='Đơn vị'&&<div style={{display:'grid',gridTemplateColumns:'100px 1fr',padding:8,background:'#e5e7eb',fontWeight:600}}><span>Mã đơn vị</span><span>Tên đơn vị</span></div>}
 {matches.map(option=><button type="button" key={option} style={{display:'block',width:'100%',border:0,textAlign:'left',padding:'8px 12px',background:value===option?'#059669':'white',color:value===option?'white':'#374151'}} onClick={()=>{onChange(option);setOpen(false);}}>{label==='Đơn vị'?<span style={{marginLeft:100}}>{option}</span>:option}</button>)}{!matches.length&&<p style={{padding:12}}>Không có dữ liệu phù hợp</p>}
 <div style={{padding:8,borderTop:'1px solid #e5e7eb',fontSize:12,color:'#64748b'}}>Bạn có thể nhập giá trị không có trong danh sách.</div></div>}
 </div>;
}
