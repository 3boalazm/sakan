'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { api, getToken } from '@/lib/client/api';

const CATS = ['مأكل','مشرب','ملبس','إيجار','فرش','كهرباء','نقل','ترفيه','صحة','تعليم','هدايا','ادخار','أخرى'];

export default function BudgetPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [form, setForm]   = useState({ label:'', amount:'', category:'أخرى', dueDate:'' });
  const [pay, setPay]     = useState({});

  useEffect(()=>{ if (!getToken()){ router.replace('/auth'); return; } load(); },[]);
  const load=()=>api('GET','/budget').then(d=>setItems(Array.isArray(d)?d:d.items||[])).catch(()=>{});
  const add=async()=>{ if (!form.label.trim()||!form.amount) return; await api('POST','/budget',{...form,amount:Number(form.amount)}); setForm(f=>({...f,label:'',amount:''})); load(); };
  const del=async(id)=>{ await api('POST','/budget/'+id+'/delete'); setItems(p=>p.filter(x=>x.id!==id)); };
  const payItem=async(id)=>{ const a=Number(pay[id]||0); if (!a) return; await api('POST','/budget/'+id+'/pay',{amount:a}); setPay(p=>({...p,[id]:''})); load(); };

  const total=items.reduce((s,i)=>s+i.amount,0);
  const paid =items.reduce((s,i)=>s+(i.paidAmount||0),0);
  const pct  =total?Math.round(paid/total*100):0;

  return (
    <Layout>
      <h1 className="display mb-1">الميزانية</h1>
      <p className="lede mb-4">تتبّع مصاريف البيت معًا.</p>

      <div className="card mb-2" style={{background:'var(--primary)',border:'none'}}>
        <p className="text-sm mb-1" style={{color:'var(--gold-soft)',opacity:.8}}>الإجمالي</p>
        <p className="text-3xl font-bold" style={{color:'var(--gold)'}}>{total.toLocaleString('ar-EG')} <span className="text-base font-normal">جم</span></p>
        <div className="mt-2 h-1.5 rounded-full" style={{background:'rgba(255,255,255,.2)'}}>
          <div className="h-full rounded-full" style={{width:pct+'%',background:'var(--gold)'}} />
        </div>
        <p className="text-xs mt-1" style={{color:'var(--gold-soft)',opacity:.7}}>مدفوع: {paid.toLocaleString()} ({pct}%)</p>
      </div>

      <div className="card space-y-2 mb-4">
        <div className="flex gap-2">
          <input className="inp flex-1 text-sm" placeholder="البند…" value={form.label} onChange={e=>setForm(f=>({...f,label:e.target.value}))}/>
          <input className="inp w-24 text-sm" type="number" placeholder="المبلغ" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/>
        </div>
        <select className="inp text-sm" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
          {CATS.map(c=><option key={c}>{c}</option>)}
        </select>
        <button className="btn w-full text-sm" onClick={add}>+ أضف</button>
      </div>

      {items.map(item=>(
        <div key={item.id} className="card mb-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-sm">{item.label}</p>
              <p className="text-xs" style={{color:'var(--ink-muted)'}}>{item.category} · {item.amount.toLocaleString()} جم</p>
            </div>
            <button onClick={()=>del(item.id)} className="text-xs opacity-40" style={{color:'var(--accent)'}}>✕</button>
          </div>
          {(item.paidAmount||0) < item.amount && (
            <div className="flex gap-2 mt-2">
              <input className="inp flex-1 text-xs" type="number" placeholder="ادفع…" value={pay[item.id]||''} onChange={e=>setPay(p=>({...p,[item.id]:e.target.value}))}/>
              <button className="btn text-xs px-3" onClick={()=>payItem(item.id)}>سجّل</button>
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full" style={{background:'var(--line)'}}>
              <div className="h-full rounded-full" style={{width:Math.min(100,Math.round((item.paidAmount||0)/item.amount*100))+'%',background:'var(--primary)'}}/>
            </div>
            <span className="text-xs" style={{color:'var(--ink-muted)'}}>{item.paidAmount||0}/{item.amount}</span>
          </div>
        </div>
      ))}
    </Layout>
  );
}
