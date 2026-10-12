import {useEffect,useRef,useState} from 'react';
import {Calendar} from 'lucide-react';
import {cashDateValue,currentCashDate} from './cash-date';
export default function VoucherDateField({value,onChange,label,className='misa-voucher-input'}:{value:string;onChange:(value:string)=>void;label:string;className?:string}){
 const [open,setOpen]=useState(false),[view,setView]=useState<'days'|'months'|'years'>('days');
 const initial=new Date(cashDateValue(value));
 const [month,setMonth]=useState(Number.isFinite(initial.getTime())?initial.getMonth():new Date().getMonth());
 const [year,setYear]=useState(Number.isFinite(initial.getTime())?initial.getFullYear():new Date().getFullYear());
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!open)return;const close=(event:MouseEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close);},[open]);
 const show=()=>{const date=new Date(cashDateValue(value));if(Number.isFinite(date.getTime())){setMonth(date.getMonth());setYear(date.getFullYear());}setView('days');setOpen(!open);};
 const move=(direction:number)=>{if(view==='years'){setYear(year+direction*12);return;}if(view==='months'){setYear(year+direction);return;}const next=new Date(year,month+direction,1);setYear(next.getFullYear());setMonth(next.getMonth());};
 const choose=(date:Date)=>{onChange(currentCashDate(date));setOpen(false);};
 const days=new Date(year,month+1,0).getDate(),offset=(new Date(year,month,1).getDay()+6)%7;
 const buttonStyle={border:0,background:'transparent',height:32,cursor:'pointer',color:'#475569'};
 return <div ref={root} style={{position:'relative',width:'100%',zIndex:open?2000:undefined}} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setOpen(false);}}}>
 <input className={className} aria-label={label} value={value} placeholder="DD/MM/YYYY" onChange={event=>onChange(event.target.value)} style={{width:'100%',paddingRight:28}}/>
 <button type="button" aria-label={`Chọn ngày ${label}`} aria-expanded={open} onClick={show} style={{position:'absolute',right:5,top:4,border:0,background:'transparent',cursor:'pointer',color:'#059669'}}><Calendar size={16}/></button>
 {open&&<div role="dialog" aria-label={`Lịch ${label}`} style={{position:'absolute',right:0,top:'calc(100% + 3px)',width:300,padding:12,background:'white',border:'1px solid #d1d5db',borderRadius:7,boxShadow:'0 4px 14px #0002'}}>
 <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><button type="button" aria-label="Kỳ trước trên lịch" style={buttonStyle} onClick={()=>move(-1)}>‹</button><button type="button" style={{...buttonStyle,fontWeight:600}} onClick={()=>setView(view==='days'?'months':view==='months'?'years':'days')}>{view==='years'?`${year-5} – ${year+6}`:view==='months'?`Năm ${year}`:`Tháng ${month+1} Năm ${year}`}</button><button type="button" aria-label="Kỳ sau trên lịch" style={buttonStyle} onClick={()=>move(1)}>›</button></div>
 {view==='days'?<><div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',textAlign:'center',padding:'8px 0',borderBottom:'1px solid #e5e7eb',color:'#6b7280'}}>{['T2','T3','T4','T5','T6','T7','CN'].map(day=><span key={day}>{day}</span>)}</div><div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,padding:'8px 0'}}>{Array.from({length:offset},(_,index)=><span key={`blank-${index}`}/>)}{Array.from({length:days},(_,index)=>{const date=new Date(year,month,index+1),selected=currentCashDate(date)===value;return <button key={index} type="button" aria-label={`Chọn ${currentCashDate(date)}`} style={{...buttonStyle,borderRadius:'50%',background:selected?'#059669':'transparent',color:selected?'white':'#64748b'}} onClick={()=>choose(date)}>{index+1}</button>;})}</div></>:<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,padding:'12px 0'}}>{Array.from({length:12},(_,index)=><button key={index} type="button" style={buttonStyle} onClick={()=>{if(view==='years'){setYear(year-5+index);setView('months');}else{setMonth(index);setView('days');}}}>{view==='years'?year-5+index:`Tháng ${index+1}`}</button>)}</div>}
 <button type="button" style={{...buttonStyle,width:'100%',borderTop:'1px solid #e5e7eb',color:'#059669'}} onClick={()=>choose(new Date())}>Hôm nay</button>
 </div>}
 </div>;
}
