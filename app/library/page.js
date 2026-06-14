'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { api, errMsg, getToken } from '@/lib/client/api';

const TYPE_ICO = { course:'🎓', book:'📖', video:'🎬', pdf:'📄', article:'📰' };
const PRIO_W   = { high:0, medium:1, later:2 };
const CATS = [
  { id:'khotouba', title:'الخطوبة والاختيار', ico:'💍' },
  { id:'zawaj',    title:'مرحلة الجواز',       ico:'🤝' },
  { id:'baad',     title:'ما بعد الجواز',       ico:'🏡' },
  { id:'tarbiya',  title:'التربية',            ico:'🌱' },
];
const STAGE_CAT = {0:'khotouba',1:'khotouba',2:'khotouba',3:'zawaj',4:'baad',5:'baad'};

export default function LibraryPage() {
  const router = useRouter();
  const [items, setItems]   = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [playlist, setPlaylist] = useState('youtube');

  // Add form state
  const [form, setForm] = useState({ title:'', link:'', summary:'', insights:'', questions:'', applications:'' });

  useEffect(() => {
    if (!getToken()) { router.replace('/auth'); return; }
    load();
  }, []);

  async function load() {
    try { setItems(await api('GET','/resources')); }
    catch(e) { if(e.code==='UNAUTHENTICATED') router.replace('/auth'); }
    finally { setLoading(false); }
  }

  async function seed() {
    setSeeding(true);
    try { await api('POST','/journey/seed'); await load(); }
    finally { setSeeding(false); }
  }

  async function addRes() {
    if (!form.title.trim()) return;
    await api('POST','/resources/full', form);
    setForm({ title:'', link:'', summary:'', insights:'', questions:'', applications:'' });
    await load();
  }

  const srcOf = r => {
    const l = r.link || '';
    if (/youtu\.?be|youtube/i.test(l)) return 'youtube';
    if (/t\.me|telegram/i.test(l)) return 'telegram';
    return r.type==='video' ? 'youtube' : 'telegram';
  };

  const catOf = r => r.category || STAGE_CAT[Number(r.stage)] || 'khotouba';

  const inPlaylist = items
    .filter(r => srcOf(r) === playlist)
    .sort((a,b) => (PRIO_W[a.priority]??1)-(PRIO_W[b.priority]??1) || a.createdAt-b.createdAt);

  const filtered = search.trim()
    ? items.filter(r => [r.title,r.speaker,r.purpose,r.link].some(v => (v||'').toLowerCase().includes(search.toLowerCase())))
    : null;

  const seeded = items.some(r => r.seed);
  const ytCount = items.filter(r => srcOf(r)==='youtube').length;
  const tgCount = items.filter(r => srcOf(r)==='telegram').length;

  return (
    <Layout>
      <h1 className="display mb-1">المكتبة</h1>
      <p className="lede mb-4">كل موادنا في مكان واحد — دوّر، أضِف، وتابعوا تقدّم بعض.</p>

      {/* Seed */}
      <div className="card flex items-center gap-3 flex-wrap">
        <div className="flex-1">
          <p className="eyebrow">{seeded ? 'منهجنا' : 'ابدأ الرحلة'}</p>
          <p className="text-xs mt-0.5" style={{color:'var(--ink-muted)'}}>
            {seeded ? 'المنهج مستورد. تقدر تعيد الاستيراد لإضافة أي جديد.' : 'استورد دورات وكتب التأهيل دفعة واحدة.'}
          </p>
        </div>
        <button className="btn text-sm" onClick={seed} disabled={seeding}>
          {seeding ? '...' : seeded ? 'تحديث المنهج' : 'استورد المنهج'}
        </button>
      </div>

      {/* Search */}
      <input className="inp mb-4" placeholder="ابحث في الموارد…"
        value={search} onChange={e => setSearch(e.target.value)} />

      {/* Search results */}
      {filtered ? (
        <div>
          <p className="eyebrow mb-2">نتائج ({filtered.length})</p>
          {filtered.map(r => <ResCard key={r.id} r={r} router={router} />)}
          {!filtered.length && <p className="text-center py-8 text-sm" style={{color:'var(--ink-muted)'}}>مفيش نتائج</p>}
        </div>
      ) : (
        <>
          {/* Playlist toggle */}
          <div className="flex gap-2 mb-4 p-1 rounded-xl" style={{background:'var(--line)'}}>
            {[['youtube','▶ يوتيوب',ytCount],['telegram','✈ تيليجرام',tgCount]].map(([pl,lbl,cnt]) => (
              <button key={pl} onClick={() => setPlaylist(pl)}
                className="flex-1 py-1.5 rounded-lg text-sm transition-all"
                style={playlist===pl ? {background:'var(--primary)',color:'var(--gold)',fontWeight:600} : {color:'var(--ink-muted)'}}>
                {lbl} <span className="text-xs opacity-60">({cnt})</span>
              </button>
            ))}
          </div>

          {/* Categories */}
          {loading
            ? <div className="text-center py-12 text-sm" style={{color:'var(--ink-muted)'}}>…تحميل</div>
            : CATS.map(cat => {
                const inCat = inPlaylist.filter(r => catOf(r) === cat.id);
                if (!inCat.length) return null;
                const done = inCat.filter(r => r.prog?.mine==='completed' && r.prog?.partner==='completed').length;
                return (
                  <div key={cat.id} className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{cat.ico}</span>
                      <div>
                        <p className="font-semibold text-sm">{cat.title}</p>
                        <p className="text-xs" style={{color:'var(--ink-muted)'}}>{done}/{inCat.length} خلّصناه معًا</p>
                      </div>
                    </div>
                    {inCat.map(r => <ResCard key={r.id} r={r} router={router} />)}
                  </div>
                );
              })
          }

          {/* Add resource */}
          <details className="card mt-4">
            <summary className="cursor-pointer font-semibold text-sm" style={{color:'var(--ink)'}}>+ أضِف موردًا</summary>
            <div className="mt-3 space-y-2">
              {[['title','العنوان','text'],['link','الرابط (يوتيوب / تيليجرام)','text'],
                ['summary','الملخص','textarea'],['insights','أهم الأفكار','textarea'],
                ['questions','أسئلة النقاش','textarea'],['applications','تطبيقات عملية','textarea']].map(([k,pl,type]) => (
                type === 'textarea'
                  ? <textarea key={k} className="inp" placeholder={pl} rows={2}
                      value={form[k]} onChange={e => setForm(f=>({...f,[k]:e.target.value}))} />
                  : <input key={k} className="inp" placeholder={pl} type={type}
                      value={form[k]} onChange={e => setForm(f=>({...f,[k]:e.target.value}))} />
              ))}
              <button className="btn w-full" onClick={addRes}>أضِف المورد</button>
            </div>
          </details>
        </>
      )}
    </Layout>
  );
}

function ResCard({ r, router }) {
  const PRIO = { high:'عالية', medium:'متوسطة', later:'لاحقًا' };
  const PROG  = { not_started:'لم يبدأ', in_progress:'يتابع •', completed:'أنهى ✓' };
  const TYPE_ICO = { course:'🎓', book:'📖', video:'🎬' };
  return (
    <button onClick={() => router.push('/library/'+r.id)}
      className="card w-full text-right flex gap-3 items-center mb-2 hover:opacity-80 transition-opacity">
      {r.thumbnail
        ? <img src={r.thumbnail} alt="" className="w-20 h-12 object-cover rounded-xl flex-none" />
        : <span className="text-2xl flex-none">{TYPE_ICO[r.type]||'📄'}</span>}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{r.title}</p>
        {r.speaker && <p className="text-xs truncate" style={{color:'var(--ink-muted)'}}>{r.speaker}</p>}
        <div className="flex flex-wrap gap-1 mt-1">
          {r.priority && <span className="pill pill-warn text-xs">{PRIO[r.priority]}</span>}
          <span className="pill text-xs">أنا: {PROG[r.prog?.mine||'not_started']}</span>
          <span className="pill text-xs">شريكي: {PROG[r.prog?.partner||'not_started']}</span>
        </div>
      </div>
    </button>
  );
}
