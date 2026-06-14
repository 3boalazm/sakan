'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { api, errMsg, getToken } from '@/lib/client/api';

const PROG_LABEL = { not_started:'لم يبدأ', in_progress:'يتابع', completed:'أنهى ✓' };

export default function HomePage() {
  const router = useRouter();
  const [resources, setResources] = useState([]);
  const [focus, setFocus]         = useState(null);
  const [grat, setGrat]           = useState('');
  const [loading, setLoading]     = useState(true);
  const [name, setName]           = useState('');

  useEffect(() => {
    if (!getToken()) { router.replace('/auth'); return; }
    setName(localStorage.getItem('sakan_name') || '');
    load();
  }, []);

  async function load() {
    try {
      const [items, foc] = await Promise.all([api('GET','/resources'), api('GET','/focus')]);
      setResources(items); setFocus(foc.focus);
    } catch(e) { if (e.code==='UNAUTHENTICATED') router.replace('/auth'); }
    finally { setLoading(false); }
  }

  async function addGrat() {
    if (!grat.trim()) return;
    await api('POST', '/gratitude', { text: grat });
    setGrat('');
  }

  async function clearFocus() { await api('POST', '/focus/clear'); setFocus(null); }

  const open = resources.filter(r => !(r.prog?.mine==='completed' && r.prog?.partner==='completed'));

  return (
    <Layout>
      {/* Greeting */}
      <div className="card mb-2" style={{background:'var(--primary)',border:'none'}}>
        <p className="text-sm" style={{color:'var(--gold-soft)',opacity:.7}}>أهلًا</p>
        <h1 className="text-2xl font-bold" style={{color:'var(--gold)'}}>{name || 'في سكن'}</h1>
        <p className="text-xs mt-1" style={{color:'var(--gold-soft)',opacity:.6}}>نوّرت سكن 🌿</p>
      </div>

      {/* Focus card */}
      {focus && (
        <div className="card border-2 mb-2" style={{borderColor:'var(--gold)'}}>
          <p className="eyebrow mb-1">📌 مادتنا دلوقتي</p>
          <p className="font-semibold">{focus.title}</p>
          <div className="flex gap-2 mt-2">
            <span className="pill">{PROG_LABEL[focus.prog?.mine]}</span>
            <span className="pill">{PROG_LABEL[focus.prog?.partner]}</span>
          </div>
          <div className="flex justify-between mt-3">
            <button className="btn text-xs px-3 py-1.5" onClick={() => router.push('/library/'+focus.id)}>فتح</button>
            <button className="text-xs" style={{color:'var(--ink-muted)'}} onClick={clearFocus}>إزالة التركيز</button>
          </div>
        </div>
      )}

      {/* Gratitude */}
      <div className="card">
        <p className="eyebrow mb-2">نعمة النهارده</p>
        <div className="flex gap-2">
          <input className="inp flex-1" placeholder="نعمة من بيتنا نشكر الله عليها…"
            value={grat} onChange={e => setGrat(e.target.value)}
            onKeyDown={e => e.key==='Enter' && addGrat()} />
          <button className="btn px-4" onClick={addGrat}>+</button>
        </div>
      </div>

      {/* Open loops */}
      <div>
        <p className="eyebrow mb-3 px-1">حلقات مفتوحة</p>
        {loading ? <div className="text-center py-8 text-sm" style={{color:'var(--ink-muted)'}}>…تحميل</div>
        : open.length === 0
          ? <div className="card text-center py-8 text-sm" style={{color:'var(--ink-muted)'}}>مفيش حلقات مفتوحة 🌿</div>
          : open.slice(0,8).map(r => (
            <button key={r.id} onClick={() => router.push('/library/'+r.id)}
              className="card w-full text-right flex items-center gap-3 hover:opacity-80 transition-opacity">
              {r.thumbnail
                ? <img src={r.thumbnail} alt="" className="w-20 h-12 object-cover rounded-xl flex-none" />
                : <span className="text-2xl">{r.type==='book'?'📖':r.type==='video'?'🎬':'🎓'}</span>}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{r.title}</p>
                <div className="flex gap-1 mt-1">
                  <span className="pill text-xs">{PROG_LABEL[r.prog?.mine]}</span>
                  <span className="pill text-xs">{PROG_LABEL[r.prog?.partner]}</span>
                </div>
              </div>
            </button>
          ))
        }
      </div>
    </Layout>
  );
}
