'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { api, getToken } from '@/lib/client/api';

const SECTIONS = [
  { type:'value',       label:'القيم',          ico:'⭐', hint:'قيمة نتفق أنها أساس بيتنا' },
  { type:'rule',        label:'الاتفاقيات',     ico:'🤝', hint:'اتفاق واضح بيننا' },
  { type:'goal',        label:'الأهداف',        ico:'🎯', hint:'هدف مشترك نسعى إليه' },
  { type:'tradition',   label:'التقاليد',       ico:'🌙', hint:'عادة جميلة نحافظ عليها' },
];

export default function CharterPage() {
  const router = useRouter();
  const [items, setItems]   = useState([]);
  const [form, setForm]     = useState({ type:'value', text:'' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { router.replace('/auth'); return; }
    load();
  }, []);

  async function load() {
    const d = await api('GET','/charter').catch(()=>[]);
    setItems(Array.isArray(d)?d:d.items||[]);
    setLoading(false);
  }
  async function add() {
    if (!form.text.trim()) return;
    await api('POST','/charter',form); setForm(f=>({...f,text:''})); load();
  }
  async function del(id) { await api('POST','/charter/'+id+'/delete'); load(); }

  return (
    <Layout>
      <h1 className="display mb-1">ميثاقنا</h1>
      <p className="lede mb-5">قيم وأهداف واتفاقيات بيتنا — مرجعنا الدايم.</p>

      {/* Add form */}
      <div className="card mb-4">
        <div className="flex gap-2 mb-2 flex-wrap">
          {SECTIONS.map(s=>(
            <button key={s.type} onClick={()=>setForm(f=>({...f,type:s.type}))}
              className="px-3 py-1 rounded-lg text-xs transition-all"
              style={form.type===s.type?{background:'var(--primary)',color:'var(--gold)',fontWeight:600}:{background:'var(--line)',color:'var(--ink-muted)'}}>
              {s.ico} {s.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="inp flex-1 text-sm"
            placeholder={SECTIONS.find(s=>s.type===form.type)?.hint||'اكتب…'}
            value={form.text} onChange={e=>setForm(f=>({...f,text:e.target.value}))}
            onKeyDown={e=>e.key==='Enter'&&add()} />
          <button className="btn text-sm px-4" onClick={add}>+</button>
        </div>
      </div>

      {loading
        ? <div className="text-center py-10 text-sm" style={{color:'var(--ink-muted)'}}>…تحميل</div>
        : !items.length
          ? <div className="card text-center py-10 text-sm" style={{color:'var(--ink-muted)'}}>ميثاقكما لسه فاضي — ابدأ بأول قيمة 🌿</div>
          : SECTIONS.map(sec=>{
              const sec_items = items.filter(i=>i.type===sec.type);
              if (!sec_items.length) return null;
              return (
                <div key={sec.type} className="mb-5">
                  <p className="eyebrow mb-2">{sec.ico} {sec.label}</p>
                  {sec_items.map(item=>(
                    <div key={item.id} className="card flex items-start justify-between gap-2 !py-3">
                      <p className="text-sm flex-1">{item.text}</p>
                      <button onClick={()=>del(item.id)} className="text-xs flex-none opacity-40 hover:opacity-80" style={{color:'var(--accent)'}}>✕</button>
                    </div>
                  ))}
                </div>
              );
            })}
    </Layout>
  );
}
