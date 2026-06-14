'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { api, getToken } from '@/lib/client/api';

const PROG = { not_started:'لم يبدأ', in_progress:'يتابع', completed:'أنهى ✓' };
const PRIO = { high:'عالية', medium:'متوسطة', later:'لاحقًا' };
const CATS = [
  { id:'khotouba', title:'الخطوبة والاختيار', ico:'💍' },
  { id:'zawaj',    title:'مرحلة الجواز',       ico:'🤝' },
  { id:'baad',     title:'ما بعد الجواز',       ico:'🏡' },
  { id:'tarbiya',  title:'التربية',            ico:'🌱' },
];
const STAGE_CAT = {0:'khotouba',1:'khotouba',2:'khotouba',3:'zawaj',4:'baad',5:'baad'};

export default function JourneysPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [playlist, setPlaylist] = useState('youtube');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { router.replace('/auth'); return; }
    api('GET','/resources').then(setItems).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const srcOf = r => {
    const l = r.link||'';
    if (/youtu\.?be|youtube/i.test(l)) return 'youtube';
    if (/t\.me|telegram/i.test(l)) return 'telegram';
    return r.type==='video'?'youtube':'telegram';
  };
  const catOf = r => r.category || STAGE_CAT[Number(r.stage)] || 'khotouba';

  const inPlaylist = items
    .filter(r => srcOf(r)===playlist)
    .sort((a,b)=>({high:0,medium:1,later:2}[a.priority]??1)-({high:0,medium:1,later:2}[b.priority]??1));

  const ytCount = items.filter(r=>srcOf(r)==='youtube').length;
  const tgCount = items.filter(r=>srcOf(r)==='telegram').length;

  return (
    <Layout>
      <h1 className="display mb-1">قوائمنا</h1>
      <p className="lede mb-4">الموارد مرتّبة حسب المرحلة — تابعوا مسيرتكم معًا.</p>

      <div className="flex gap-2 mb-4 p-1 rounded-xl" style={{background:'var(--line)'}}>
        {[['youtube','▶ يوتيوب',ytCount],['telegram','✈ تيليجرام',tgCount]].map(([pl,lbl,cnt])=>(
          <button key={pl} onClick={()=>setPlaylist(pl)}
            className="flex-1 py-2 rounded-lg text-sm transition-all"
            style={playlist===pl?{background:'var(--primary)',color:'var(--gold)',fontWeight:600}:{color:'var(--ink-muted)'}}>
            {lbl} <span className="text-xs opacity-60">({cnt})</span>
          </button>
        ))}
      </div>

      {loading
        ? <div className="text-center py-12 text-sm" style={{color:'var(--ink-muted)'}}>…تحميل</div>
        : CATS.map(cat => {
            const inCat = inPlaylist.filter(r=>catOf(r)===cat.id);
            if (!inCat.length) return null;
            const done = inCat.filter(r=>r.prog?.mine==='completed'&&r.prog?.partner==='completed').length;
            const pct  = inCat.length ? Math.round(done/inCat.length*100) : 0;
            return (
              <div key={cat.id} className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{cat.ico}</span>
                    <p className="font-semibold">{cat.title}</p>
                  </div>
                  <span className="pill">{done}/{inCat.length}</span>
                </div>
                <div className="h-1.5 rounded-full mb-3" style={{background:'var(--line)'}}>
                  <div className="h-full rounded-full transition-all" style={{width:pct+'%',background:'var(--primary)'}} />
                </div>
                {inCat.map(r=>(
                  <button key={r.id} onClick={()=>router.push('/library/'+r.id)}
                    className="card w-full text-right flex gap-3 items-center mb-2 hover:opacity-80 transition-opacity">
                    {r.thumbnail
                      ? <img src={r.thumbnail} alt="" className="w-20 h-12 object-cover rounded-xl flex-none"/>
                      : <span className="text-2xl flex-none">{r.type==='book'?'📖':r.type==='video'?'🎬':'🎓'}</span>}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{r.title}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="pill text-xs">أنا: {PROG[r.prog?.mine||'not_started']}</span>
                        <span className="pill text-xs">شريكي: {PROG[r.prog?.partner||'not_started']}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
    </Layout>
  );
}
