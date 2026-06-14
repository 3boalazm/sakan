'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { api, getToken } from '@/lib/client/api';

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [form, setForm]   = useState({ title:'', assignee:'both', dueDate:'' });

  useEffect(() => { if (!getToken()) { router.replace('/auth'); return; } load(); }, []);
  const load = () => api('GET','/tasks').then(d=>setTasks(Array.isArray(d)?d:d.tasks||[])).catch(()=>{});
  const add  = async () => { if (!form.title.trim()) return; await api('POST','/tasks',form); setForm(f=>({...f,title:''})); load(); };
  const tog  = async (id) => { await api('POST','/tasks/'+id+'/toggle'); load(); };
  const del  = async (id) => { await api('POST','/tasks/'+id+'/delete'); setTasks(p=>p.filter(x=>x.id!==id)); };

  const ASSIGNEE = { me:'أنا', partner:'شريكي', both:'كلانا' };
  const open = tasks.filter(t=>!t.done), done = tasks.filter(t=>t.done);

  return (
    <Layout>
      <h1 className="display mb-1">المهام</h1>
      <p className="lede mb-4">تنظيم مهام البيت والحياة المشتركة.</p>

      <div className="card space-y-2">
        <input className="inp text-sm" placeholder="المهمة…" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&add()}/>
        <div className="flex gap-2">
          <div className="flex gap-1 flex-1">
            {Object.entries(ASSIGNEE).map(([k,l])=>(
              <button key={k} onClick={()=>setForm(f=>({...f,assignee:k}))}
                className="flex-1 py-1 rounded-lg text-xs transition-all"
                style={form.assignee===k?{background:'var(--primary)',color:'var(--gold)'}:{background:'var(--line)',color:'var(--ink-muted)'}}>
                {l}
              </button>
            ))}
          </div>
          <button className="btn text-sm px-4" onClick={add}>+</button>
        </div>
      </div>

      {open.map(t=>(
        <div key={t.id} className="card flex items-center gap-3 !py-3">
          <button onClick={()=>tog(t.id)} className="flex-none w-5 h-5 rounded-full border-2 transition-all" style={{borderColor:'var(--primary)'}} />
          <div className="flex-1">
            <p className="text-sm">{t.title}</p>
            <span className="pill text-xs">{ASSIGNEE[t.assignee]||t.assignee}</span>
          </div>
          <button onClick={()=>del(t.id)} className="text-xs opacity-40 hover:opacity-80" style={{color:'var(--accent)'}}>✕</button>
        </div>
      ))}

      {done.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs cursor-pointer mb-2" style={{color:'var(--ink-muted)'}}>المنجز ({done.length})</summary>
          {done.map(t=>(
            <div key={t.id} className="card flex items-center gap-3 !py-2 opacity-60">
              <button onClick={()=>tog(t.id)} className="flex-none text-lg">✅</button>
              <p className="text-sm flex-1" style={{textDecoration:'line-through'}}>{t.title}</p>
              <button onClick={()=>del(t.id)} className="text-xs opacity-40" style={{color:'var(--accent)'}}>✕</button>
            </div>
          ))}
        </details>
      )}
    </Layout>
  );
}
