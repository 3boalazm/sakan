'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { api, getToken } from '@/lib/client/api';

const TABS = [['wishes','الأمنيات','🌠'],['gratitude','الشكر','🌸'],['capsules','الكبسولات','💌'],['mood','المزاج','🌡️'],['safespace','المساحة الآمنة','🕊️']];

export default function ConnectPage() {
  const router = useRouter();
  const [tab, setTab] = useState('wishes');
  useEffect(() => { if (!getToken()) router.replace('/auth'); }, []);

  return (
    <Layout>
      <h1 className="display mb-1">تواصلنا</h1>
      <p className="lede mb-4">مساحة للمشاعر والأمنيات والامتنان.</p>
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {TABS.map(([k,l,i])=>(
          <button key={k} onClick={()=>setTab(k)}
            className="flex-none px-3 py-1.5 rounded-xl text-xs whitespace-nowrap transition-all"
            style={tab===k?{background:'var(--primary)',color:'var(--gold)',fontWeight:600}:{background:'var(--line)',color:'var(--ink-muted)'}}>
            {i} {l}
          </button>
        ))}
      </div>
      {tab==='wishes'    && <WishesTab/>}
      {tab==='gratitude' && <GratitudeTab/>}
      {tab==='capsules'  && <CapsulesTab/>}
      {tab==='mood'      && <MoodTab/>}
      {tab==='safespace' && <SafeSpaceTab/>}
    </Layout>
  );
}

function WishesTab() {
  const [items,setItems]=useState([]);const[text,setText]=useState('');const[cat,setCat]=useState('together');
  useEffect(()=>{api('GET','/wishes').then(d=>setItems(Array.isArray(d)?d:d.items||[])).catch(()=>{});},[]);
  const add=async()=>{if(!text.trim())return;await api('POST','/wishes',{text,category:cat});setText('');api('GET','/wishes').then(d=>setItems(Array.isArray(d)?d:d.items||[]));};
  const del=async(id)=>{await api('POST','/wishes/'+id+'/delete');setItems(p=>p.filter(x=>x.id!==id));};
  const tog=async(id)=>{await api('POST','/wishes/'+id+'/toggle');api('GET','/wishes').then(d=>setItems(Array.isArray(d)?d:d.items||[]));};
  const cats=[['together','معًا'],['home','البيت'],['grow','النمو'],['fun','المتعة']];
  return(
    <div>
      <div className="card">
        <div className="flex gap-2 mb-2 flex-wrap">
          {cats.map(([k,l])=><button key={k} onClick={()=>setCat(k)} className="px-2.5 py-1 rounded-lg text-xs transition-all" style={cat===k?{background:'var(--primary)',color:'var(--gold)'}:{background:'var(--line)',color:'var(--ink-muted)'}}>{l}</button>)}
        </div>
        <div className="flex gap-2"><input className="inp flex-1 text-sm" placeholder="أمنية تودّ مشاركتها…" value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()}/><button className="btn px-4" onClick={add}>+</button></div>
      </div>
      {items.map(w=>(
        <div key={w.id} className="card flex items-start gap-2 !py-3">
          <button onClick={()=>tog(w.id)} className="text-lg flex-none">{w.done?'✅':'🌠'}</button>
          <p className="flex-1 text-sm" style={w.done?{textDecoration:'line-through',color:'var(--ink-muted)'}:{}}>{w.text}</p>
          <button onClick={()=>del(w.id)} className="text-xs opacity-40 hover:opacity-80" style={{color:'var(--accent)'}}>✕</button>
        </div>
      ))}
    </div>
  );
}

function GratitudeTab() {
  const [items,setItems]=useState([]);const[text,setText]=useState('');
  const load=()=>api('GET','/gratitude').then(d=>setItems(Array.isArray(d)?d:d.items||[])).catch(()=>{});
  useEffect(()=>{load();},[]);
  const add=async()=>{if(!text.trim())return;await api('POST','/gratitude',{text});setText('');load();};
  const del=async(id)=>{await api('POST','/gratitude/'+id+'/delete');setItems(p=>p.filter(x=>x.id!==id));};
  return(
    <div>
      <div className="card flex gap-2">
        <input className="inp flex-1 text-sm" placeholder="نعمة نشكر الله عليها…" value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()}/>
        <button className="btn px-4" onClick={add}>+</button>
      </div>
      {items.map(g=>(
        <div key={g.id} className="card flex items-start gap-2 !py-3">
          <span className="text-xl flex-none">🌸</span>
          <p className="flex-1 text-sm">{g.text}</p>
          <button onClick={()=>del(g.id)} className="text-xs opacity-40 hover:opacity-80" style={{color:'var(--accent)'}}>✕</button>
        </div>
      ))}
    </div>
  );
}

function CapsulesTab() {
  const [items,setItems]=useState([]);const[form,setForm]=useState({message:'',openAt:''});
  const now=new Date();const minDate=now.toISOString().split('T')[0];
  useEffect(()=>{api('GET','/capsules').then(d=>setItems(Array.isArray(d)?d:d.items||[])).catch(()=>{});},[]);
  const add=async()=>{if(!form.message.trim()||!form.openAt)return;await api('POST','/capsules',{message:form.message,openAt:new Date(form.openAt).getTime()});setForm({message:'',openAt:''});api('GET','/capsules').then(d=>setItems(Array.isArray(d)?d:d.items||[]));};
  return(
    <div>
      <div className="card space-y-2">
        <p className="eyebrow">رسالة للمستقبل 💌</p>
        <textarea className="inp text-sm" rows={3} placeholder="اكتب رسالتك لنفسك أو لشريكك في المستقبل…" value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))}/>
        <input className="inp text-sm" type="date" min={minDate} value={form.openAt} onChange={e=>setForm(f=>({...f,openAt:e.target.value}))}/>
        <button className="btn w-full text-sm" onClick={add}>احفظ الكبسولة</button>
      </div>
      {items.map(c=>{
        const openDate=new Date(typeof c.openAt==='number'?c.openAt:c.openAt?.seconds*1000);
        const locked=Date.now()<openDate.getTime();
        return(
          <div key={c.id} className="card">
            {locked?<div className="flex items-center gap-2"><span className="text-2xl">🔒</span><div><p className="text-sm font-medium">كبسولة مغلقة</p><p className="text-xs" style={{color:'var(--ink-muted)'}}>تُفتح {openDate.toLocaleDateString('ar-EG')}</p></div></div>
            :<div><p className="text-sm">{c.message}</p><p className="text-xs mt-1" style={{color:'var(--ink-muted)'}}>كُتبت {new Date(typeof c.createdAt==='number'?c.createdAt:c.createdAt?.seconds*1000).toLocaleDateString('ar-EG')}</p></div>}
          </div>
        );
      })}
    </div>
  );
}

function MoodTab() {
  const [val,setVal]=useState(5);const[saved,setSaved]=useState(null);
  useEffect(()=>{api('GET','/mood').then(d=>{if(d.value!=null){setVal(d.value);setSaved(d);}}).catch(()=>{});},[]);
  const save=async()=>{await api('PUT','/mood',{value:val});setSaved({value:val});};
  const MOODS=['😔','😕','😐','🙂','😊','😄'];
  const pct=((val-1)/9)*100;
  return(
    <div className="card">
      <p className="eyebrow mb-3">مزاجنا النهارده</p>
      <div className="flex justify-between mb-2">{MOODS.map((e,i)=><span key={i} className="text-2xl cursor-pointer transition-transform" style={{transform:Math.round((i/5)*9)+1===val?'scale(1.4)':'scale(1)'}} onClick={()=>setVal(Math.round((i/5)*9)+1)}>{e}</span>)}</div>
      <input type="range" min={1} max={10} value={val} onChange={e=>setVal(Number(e.target.value))} className="w-full mb-3"/>
      <p className="text-center text-2xl font-bold mb-3" style={{color:'var(--primary)'}}>{val}/10</p>
      {saved&&<p className="text-xs text-center mb-2" style={{color:'var(--ink-muted)'}}>آخر تسجيل: {saved.value}/10</p>}
      <button className="btn w-full" onClick={save}>سجّل مزاجي</button>
    </div>
  );
}

function SafeSpaceTab() {
  const [items,setItems]=useState([]);const[form,setForm]=useState({type:'concern',message:''});
  const load=()=>api('GET','/safespace').then(d=>setItems(Array.isArray(d)?d:d.items||[])).catch(()=>{});
  useEffect(()=>{load();},[]);
  const add=async()=>{if(!form.message.trim())return;await api('POST','/safespace',form);setForm(f=>({...f,message:''}));load();};
  const addr=async(id)=>{await api('POST','/safespace/'+id+'/addressed');load();};
  const types=[['concern','قلق'],['need','احتياج'],['joy','فرحة'],['prayer','دعاء']];
  return(
    <div>
      <div className="card space-y-2">
        <p className="eyebrow">شارك من غير حكم 🕊️</p>
        <div className="flex gap-2 flex-wrap">
          {types.map(([k,l])=><button key={k} onClick={()=>setForm(f=>({...f,type:k}))} className="px-3 py-1 rounded-lg text-xs transition-all" style={form.type===k?{background:'var(--primary)',color:'var(--gold)'}:{background:'var(--line)',color:'var(--ink-muted)'}}>{l}</button>)}
        </div>
        <textarea className="inp text-sm" rows={3} placeholder="اكتب بحرية…" value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))}/>
        <button className="btn w-full text-sm" onClick={add}>شارك</button>
      </div>
      {items.filter(x=>!x.addressed).map(s=>(
        <div key={s.id} className="card" style={{borderRight:'3px solid var(--accent)'}}>
          <p className="text-xs mb-1" style={{color:'var(--accent)'}}>{types.find(t=>t[0]===s.type)?.[1]||s.type}</p>
          <p className="text-sm">{s.message}</p>
          <button onClick={()=>addr(s.id)} className="text-xs mt-2" style={{color:'var(--ink-muted)'}}>تمّت المعالجة ✓</button>
        </div>
      ))}
    </div>
  );
}
