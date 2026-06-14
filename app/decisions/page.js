'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { api, getToken } from '@/lib/client/api';

const STATE = { draft:'مسودّة', confirmed:'مؤكَّد ✓', revisited:'قيد المراجعة' };
const STATE_COLOR = { draft:'var(--ink-muted)', confirmed:'var(--primary)', revisited:'var(--accent)' };

function relDate(ts) {
  if (!ts) return '';
  const d = new Date(typeof ts==='number'?ts:ts.seconds*1000);
  return d.toLocaleDateString('ar-EG',{year:'numeric',month:'short',day:'numeric'});
}

export default function DecisionsPage() {
  const router  = useRouter();
  const [decs, setDecs]   = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { router.replace('/auth'); return; }
    load();
  }, []);

  async function load() {
    const data = await api('GET','/decisions').catch(()=>[]);
    setDecs(Array.isArray(data)?data:data.decisions||[]);
    setLoading(false);
  }

  async function confirm(id) { await api('POST','/decisions/'+id+'/confirm'); load(); }

  const shown = filter==='all' ? decs : decs.filter(d=>d.state===filter);

  return (
    <Layout>
      <h1 className="display mb-1">القرارات</h1>
      <p className="lede mb-4">سجّل قراراتكما المشتركة — وراجعوها سوا.</p>

      <div className="flex gap-1 mb-4">
        {[['all','الكل'],['confirmed','مؤكّدة'],['draft','مسودّة']].map(([k,l])=>(
          <button key={k} onClick={()=>setFilter(k)}
            className="flex-none px-3 py-1.5 rounded-xl text-xs transition-all"
            style={filter===k?{background:'var(--primary)',color:'var(--gold)',fontWeight:600}:{background:'var(--line)',color:'var(--ink-muted)'}}>
            {l}
          </button>
        ))}
      </div>

      {loading
        ? <div className="text-center py-12 text-sm" style={{color:'var(--ink-muted)'}}>…تحميل</div>
        : !shown.length
          ? <div className="card text-center py-10 text-sm" style={{color:'var(--ink-muted)'}}>مفيش قرارات بعد — سجّل أول قرار من تبويب القرارات في أي مورد.</div>
          : shown.map(d=>(
              <div key={d.id} className="card mb-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-semibold text-sm flex-1">{d.statement}</p>
                  <span className="flex-none text-xs px-2 py-0.5 rounded-full"
                    style={{background:'color-mix(in srgb,'+STATE_COLOR[d.state]+' 15%,transparent)',color:STATE_COLOR[d.state]}}>
                    {STATE[d.state]}
                  </span>
                </div>
                {d.context && <p className="text-xs mb-2" style={{color:'var(--ink-muted)'}}>{d.context}</p>}
                <div className="flex items-center justify-between text-xs" style={{color:'var(--ink-muted)'}}>
                  <span>تأكيدات: {d.confirmCount||0}/2</span>
                  <span>{relDate(d.createdAt)}</span>
                </div>
                {d.state!=='confirmed' && (
                  <button className="btn-accent text-xs px-3 py-1.5 mt-2" onClick={()=>confirm(d.id)}>
                    أؤكّد موافقتي
                  </button>
                )}
              </div>
            ))}
    </Layout>
  );
}
