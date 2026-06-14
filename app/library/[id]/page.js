'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Layout from '@/components/Layout';
import { api, errMsg, getToken } from '@/lib/client/api';

const PROG_LABEL = { not_started:'لم أبدأ', in_progress:'أشاهد', completed:'أنهيت ✓' };
const PRIO_LABEL = { high:'عالية', medium:'متوسطة', later:'لاحقًا' };
const STATE_AR = {
  open:'بانتظار ردّ كلٍّ مننا', answered_by_one:'ردّ واحد مننا',
  ready_to_reveal:'جاهز للكشف', revealed:'مكشوف', decided:'تقرّر',
  draft:'مسودّة', confirmed:'مؤكَّد',
};
const CATS = [
  { id:'khotouba', title:'الخطوبة' },
  { id:'zawaj',    title:'الجواز' },
  { id:'baad',     title:'بعد الجواز' },
  { id:'tarbiya',  title:'التربية' },
];

export default function ResourcePage() {
  const router = useRouter();
  const { id } = useParams();
  const [detail, setDetail]   = useState(null);
  const [tab, setTab]         = useState('summary');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { router.replace('/auth'); return; }
    load();
  }, [id]);

  async function load() {
    try {
      const d = await api('GET', '/resources/'+id);
      setDetail(d);
    } catch(e) { if(e.code==='UNAUTHENTICATED') router.replace('/auth'); }
    finally { setLoading(false); }
  }

  async function setProg(status) {
    await api('PUT', '/resources/'+id+'/progress', { status });
    load();
  }
  async function setPrio(priority) {
    await api('PUT', '/resources/'+id+'/priority', { priority });
    load();
  }
  async function setCat(category) {
    await api('PUT', '/resources/'+id+'/category', { category });
    load();
  }
  async function setFocus() {
    await api('PUT', '/focus', { resourceId: id });
    router.push('/home');
  }

  if (loading) return <Layout><div className="text-center py-16 text-sm" style={{color:'var(--ink-muted)'}}>…تحميل</div></Layout>;
  if (!detail)  return <Layout><div className="text-center py-16">مورد غير موجود</div></Layout>;

  const r = detail.resource;
  const ytId = (r.link||'').match(/(?:youtu\.be\/|[?&]v=)([\w-]{6,})/)?.[1];
  const ytEmbed = ytId ? `https://www.youtube.com/embed/${ytId}` : null;
  const catOf = r.category || ({0:'khotouba',1:'khotouba',2:'khotouba',3:'zawaj',4:'baad',5:'baad'})[Number(r.stage)] || 'khotouba';

  return (
    <Layout>
      <button onClick={() => router.push('/library')} className="text-sm mb-3 flex items-center gap-1" style={{color:'var(--ink-muted)'}}>
        → المكتبة
      </button>

      <h1 className="display mb-3">{r.title}</h1>

      {/* Progress & Priority */}
      <div className="card flex flex-wrap gap-2 items-center text-sm">
        <span className="text-xs" style={{color:'var(--ink-muted)'}}>متابعتي:</span>
        <div className="flex gap-1">
          {['not_started','in_progress','completed'].map(v => (
            <button key={v} onClick={() => setProg(v)}
              className="px-2.5 py-1 rounded-lg text-xs transition-all"
              style={r.prog?.mine===v ? {background:'var(--primary)',color:'var(--gold)',fontWeight:600} : {background:'var(--line)',color:'var(--ink-muted)'}}>
              {PROG_LABEL[v]}
            </button>
          ))}
        </div>
        <span className="text-xs" style={{color:'var(--ink-muted)'}}>شريكي: <b>{PROG_LABEL[r.prog?.partner||'not_started']}</b></span>
      </div>

      <div className="card flex flex-wrap gap-2 items-center text-sm">
        <span className="text-xs" style={{color:'var(--ink-muted)'}}>الأولوية:</span>
        {['high','medium','later'].map(v => (
          <button key={v} onClick={() => setPrio(v)}
            className="px-2.5 py-1 rounded-lg text-xs transition-all"
            style={r.priority===v ? {background:'var(--primary)',color:'var(--gold)',fontWeight:600} : {background:'var(--line)',color:'var(--ink-muted)'}}>
            {PRIO_LABEL[v]}
          </button>
        ))}
        <button onClick={setFocus} className="btn text-xs px-2.5 py-1 mr-auto">📌 مادتنا دلوقتي</button>
      </div>

      {/* Category */}
      <div className="card flex flex-wrap gap-2 items-center text-sm">
        <span className="text-xs" style={{color:'var(--ink-muted)'}}>التصنيف:</span>
        {CATS.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)}
            className="px-2.5 py-1 rounded-lg text-xs transition-all"
            style={catOf===c.id ? {background:'var(--primary)',color:'var(--gold)',fontWeight:600} : {background:'var(--line)',color:'var(--ink-muted)'}}>
            {c.title}
          </button>
        ))}
      </div>

      {/* YouTube embed */}
      {ytEmbed && (
        <div className="rounded-2xl overflow-hidden mb-4" style={{aspectRatio:'16/9',background:'#000'}}>
          <iframe src={ytEmbed} className="w-full h-full" allowFullScreen loading="lazy" />
        </div>
      )}
      {!ytEmbed && r.link && (
        <a href={r.link} target="_blank" rel="noopener" className="btn-ghost inline-block mb-4 text-sm">فتح المصدر ↗</a>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{background:'var(--line)'}}>
        {[['summary','الملخص'],['discussion','الحوار'],['notes','ملاحظات'],['decisions','القرارات']].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-1.5 rounded-lg text-xs transition-all"
            style={tab===t ? {background:'var(--primary)',color:'var(--gold)',fontWeight:600} : {color:'var(--ink-muted)'}}>
            {l}
          </button>
        ))}
      </div>

      {tab==='summary'    && <SummaryTab detail={detail} id={id} reload={load} router={router} />}
      {tab==='discussion' && <DiscussionTab detail={detail} id={id} reload={load} />}
      {tab==='notes'      && <NotesTab id={id} />}
      {tab==='decisions'  && <DecisionsTab detail={detail} id={id} reload={load} />}
    </Layout>
  );
}

function SummaryTab({ detail, id, reload, router }) {
  const sum = detail.summary;
  const [generating, setGenerating] = useState(false);
  async function gen() {
    setGenerating(true);
    try { await api('POST', '/resources/'+id+'/summary'); reload(); }
    finally { setGenerating(false); }
  }
  return (
    <div>
      <div className="card">
        <p className="eyebrow mb-2">الملخص</p>
        {sum ? <p className="text-sm whitespace-pre-wrap leading-7" style={{color:'var(--ink)'}}>{sum.content}</p>
             : <p className="text-sm" style={{color:'var(--ink-muted)'}}>لم يُولَّد ملخص بعد.</p>}
        <button className="btn mt-3 text-sm" onClick={gen} disabled={generating}>
          {generating ? '...' : sum ? 'إعادة التوليد' : 'وَلِّد الملخص'}
        </button>
      </div>
      <div className="card flex items-center justify-between">
        <span className="text-sm" style={{color:'var(--ink-muted)'}}>جاهزين للحوار؟</span>
        <button className="btn text-sm" onClick={() => router.push('/library/'+id+'?tab=discussion')}>يلا نبدأ الحوار ←</button>
      </div>
    </div>
  );
}

function DiscussionTab({ detail, id, reload }) {
  const qs = detail.questions || [];
  const [newQ, setNewQ] = useState('');
  const [generating, setGenerating] = useState(false);
  const [responses, setResponses] = useState({});

  useEffect(() => {
    qs.forEach(q => loadResp(q.id));
  }, []);

  async function loadResp(qid) {
    try { const r = await api('GET', '/questions/'+qid+'/responses'); setResponses(p => ({...p,[qid]:r})); }
    catch {}
  }
  async function genQ() {
    setGenerating(true);
    try { await api('POST', '/resources/'+id+'/questions/generate'); reload(); }
    finally { setGenerating(false); }
  }
  async function addQ() {
    if (!newQ.trim()) return;
    await api('POST', '/resources/'+id+'/questions', { text: newQ });
    setNewQ(''); reload();
  }
  async function saveAns(qid, text) {
    await api('PUT', '/questions/'+qid+'/responses', { text });
    loadResp(qid);
  }
  async function doReveal(qid) { await api('POST', '/questions/'+qid+'/reveal'); loadResp(qid); }

  const STATE_AR = {
    open:'بانتظار ردّ كلٍّ مننا', answered_by_one:'ردّ واحد مننا',
    ready_to_reveal:'جاهز للكشف', revealed:'مكشوف', decided:'تقرّر',
  };

  return (
    <div>
      {!qs.length && (
        <div className="card text-center">
          <p className="text-sm mb-3" style={{color:'var(--ink-muted)'}}>لا يوجد أسئلة بعد.</p>
          <button className="btn" onClick={genQ} disabled={generating}>{generating?'...':'وَلِّد أسئلة للنقاش'}</button>
        </div>
      )}
      {qs.map(q => {
        const r = responses[q.id] || {};
        const locked = ['revealed','decided'].includes(r.questionState||q.state);
        return (
          <div key={q.id} className="card mb-3">
            <p className="font-medium text-sm mb-2">{q.text}</p>
            <span className="pill text-xs">{STATE_AR[r.questionState||q.state]||q.state}</span>
            <div className="mt-3 space-y-2">
              <div>
                <p className="text-xs mb-1" style={{color:'var(--ink-muted)'}}>إجابتك</p>
                <AnsBox qid={q.id} mine={r.mine?.text||''} locked={locked} onSave={saveAns} />
              </div>
              {locked && r.partner && (
                <div className="rounded-xl p-3" style={{background:'var(--accent-soft)'}}>
                  <p className="text-xs mb-1" style={{color:'var(--accent)'}}>الطرف الآخر</p>
                  <p className="text-sm">{r.partner.text}</p>
                </div>
              )}
              {!locked && <div className="rounded-xl p-3 text-center text-xs" style={{background:'var(--line)',color:'var(--ink-muted)'}}>۝ إجابة الطرف الآخر مخفية حتى تجيبا كلاكما</div>}
              {(r.questionState||q.state)==='ready_to_reveal' && (
                <button className="btn-accent text-sm w-full" onClick={() => doReveal(q.id)}>اكشفا الإجابتين معًا</button>
              )}
            </div>
          </div>
        );
      })}
      <div className="card flex gap-2">
        <input className="inp flex-1 text-sm" placeholder="أضِف سؤالًا…" value={newQ} onChange={e => setNewQ(e.target.value)} />
        <button className="btn-ghost text-sm px-3" onClick={addQ}>+</button>
      </div>
    </div>
  );
}

function AnsBox({ qid, mine, locked, onSave }) {
  const [text, setText] = useState(mine);
  useEffect(() => setText(mine), [mine]);
  return (
    <div>
      <textarea className="inp text-sm w-full" rows={3} disabled={locked}
        placeholder={locked ? '' : 'اكتب إجابتك بصدق…'}
        value={text} onChange={e => setText(e.target.value)} />
      {!locked && <button className="btn text-xs mt-1" onClick={() => onSave(qid, text)}>احفظ إجابتي</button>}
    </div>
  );
}

function NotesTab({ id }) {
  const [notes, setNotes] = useState({ shared:'', mine:'' });
  useEffect(() => { api('GET','/resources/'+id+'/notes').then(setNotes).catch(()=>{}); }, [id]);
  async function save(scope, content) {
    await api('PUT', '/resources/'+id+'/notes', { scope, content });
  }
  return (
    <div className="space-y-3">
      {[['shared','مشتركة','نشوفها ونعدّلها إحنا الاتنين.'],
        ['mine','خاصة بيك','تظهر لك وحدك.']].map(([scope, title, desc]) => (
        <div key={scope} className="card">
          <p className="eyebrow mb-1">ملاحظات {title}</p>
          <p className="text-xs mb-2" style={{color:'var(--ink-muted)'}}>{desc}</p>
          <textarea className="inp text-sm w-full" rows={4}
            defaultValue={scope==='shared' ? notes.shared : notes.mine}
            onBlur={e => save(scope, e.target.value)} />
        </div>
      ))}
    </div>
  );
}

function DecisionsTab({ detail, id, reload }) {
  const decs = detail.decisions || [];
  const qs   = (detail.questions||[]).filter(q => ['revealed','decided'].includes(q.state));
  const [form, setForm] = useState({ statement:'', context:'', category:'general', reviewDate:'' });
  const [selQ, setSelQ] = useState([]);
  async function confirm(did) { await api('POST','/decisions/'+did+'/confirm'); reload(); }
  async function createDec() {
    if (!form.statement.trim() || !selQ.length) return;
    await api('POST','/decisions',{ resourceId:id, ...form, questionIds:selQ }); reload();
    setForm({ statement:'', context:'', category:'general', reviewDate:'' }); setSelQ([]);
  }
  const STATE = { draft:'مسودّة', confirmed:'مؤكَّد', revisited:'قيد المراجعة' };
  return (
    <div>
      {decs.map(d => (
        <div key={d.id} className="card mb-3">
          <p className="text-base font-semibold mb-1">{d.statement}</p>
          {d.context && <p className="text-xs mb-2" style={{color:'var(--ink-muted)'}}>{d.context}</p>}
          <div className="flex items-center gap-2">
            <span className="pill">{STATE[d.state]} {d.confirmCount}/2</span>
            {d.state!=='confirmed' && <button className="btn-accent text-xs px-2 py-1" onClick={() => confirm(d.id)}>أؤكّد موافقتي</button>}
          </div>
        </div>
      ))}
      {qs.length > 0 ? (
        <div className="card">
          <p className="eyebrow mb-3">تسجيل قرار</p>
          <div className="space-y-2">
            <textarea className="inp text-sm" rows={2} placeholder="صياغة القرار…"
              value={form.statement} onChange={e => setForm(f=>({...f,statement:e.target.value}))} />
            <textarea className="inp text-sm" rows={2} placeholder="السياق (اختياري)…"
              value={form.context} onChange={e => setForm(f=>({...f,context:e.target.value}))} />
            <p className="text-xs" style={{color:'var(--ink-muted)'}}>اربط بالأسئلة:</p>
            {qs.map(q => (
              <label key={q.id} className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={selQ.includes(q.id)}
                  onChange={e => setSelQ(p => e.target.checked ? [...p,q.id] : p.filter(x=>x!==q.id))} />
                <span>{q.text}</span>
              </label>
            ))}
            <button className="btn w-full" onClick={createDec}>سجّل القرار (مسودّة)</button>
          </div>
        </div>
      ) : <p className="card text-sm text-center" style={{color:'var(--ink-muted)'}}>اكشفا سؤالًا أولاً في تبويب الحوار.</p>}
    </div>
  );
}
