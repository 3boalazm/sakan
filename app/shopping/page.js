'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { api, getToken } from '@/lib/client/api';

export default function ShoppingPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [form, setForm]   = useState({ name:'', quantity:1, unit:'قطعة', priority:'medium', notes:'' });

  useEffect(()=>{ if (!getToken()){ router.replace('/auth'); return; } load(); },[]);
  const load=()=>api('GET','/shopping').then(d=>setItems(Array.isArray(d)?d:d.items||[])).catch(()=>{});
  const add=async()=>{ if (!form.name.trim()) return; await api('POST','/shopping',form); setForm(f=>({...f,name:'',notes:''})); load(); };
  const tog=async(id)=>{ await api('POST','/shopping/'+id+'/toggle'); load(); };
  const del=async(id)=>{ await api('POST','/shopping/'+id+'/delete'); setItems(p=>p.filter(x=>x.id!==id)); };

  const open = items.filter(i=>!i.done), done = items.filter(i=>i.done);
  const PRIO = { high:'🔴', medium:'🟡', later:'🟢' };

  return (
    <Layout>
      <h1 className="display mb-1">المشتريات</h1>
      <p className="lede mb-4">قائمة التسوّق المشتركة.</p>

      <div className="card space-y-2 mb-4">
        <div className="flex gap-2">
          <input className="inp flex-1 text-sm" placeholder="الصنف…" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&add()}/>
          <input className="inp w-16 text-sm text-center" type="number" min={1} value={form.quantity} onChange={e=>setForm(f=>({...f,quantity:Number(e.target.value)}))}/>
          <input className="inp w-20 text-sm" placeholder="الوحدة" value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}/>
        </div>
        <div className="flex gap-2">
          {[['high','عالية'],['medium','متوسطة'],['later','لاحقًا']].map(([k,l])=>(
            <button key={k} onClick={()=>setForm(f=>({...f,priority:k}))}
              className="flex-1 py-1 rounded-lg text-xs transition-all"
              style={form.priority===k?{background:'var(--primary)',color:'var(--gold)'}:{background:'var(--line)',color:'var(--ink-muted)'}}>
              {l}
            </button>
          ))}
          <button className="btn text-sm px-4" onClick={add}>+</button>
        </div>
      </div>

      {open.map(i=>(
        <div key={i.id} className="card flex items-center gap-3 !py-3">
          <button onClick={()=>tog(i.id)} className="flex-none w-5 h-5 rounded-full border-2" style={{borderColor:'var(--primary)'}}/>
          <div className="flex-1">
            <p className="text-sm">{PRIO[i.priority]} {i.name}</p>
            <p className="text-xs" style={{color:'var(--ink-muted)'}}>{i.quantity} {i.unit}</p>
          </div>
          <button onClick={()=>del(i.id)} className="text-xs opacity-40" style={{color:'var(--accent)'}}>✕</button>
        </div>
      ))}

      {done.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs cursor-pointer mb-2" style={{color:'var(--ink-muted)'}}>اشتريناه ({done.length})</summary>
          {done.map(i=>(
            <div key={i.id} className="card flex items-center gap-3 !py-2 opacity-60">
              <button onClick={()=>tog(i.id)} className="flex-none text-lg">✅</button>
              <p className="text-sm flex-1" style={{textDecoration:'line-through'}}>{i.name}</p>
              <button onClick={()=>del(i.id)} className="text-xs opacity-40" style={{color:'var(--accent)'}}>✕</button>
            </div>
          ))}
        </details>
      )}
    </Layout>
  );
}
