'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { api, getToken } from '@/lib/client/api';

const TYPE_LABEL = {
  resource_added:    'أضفت موردًا جديدًا',
  resource_progress: 'غيّرت حالة مورد',
  question_answered: 'أجبت على سؤال',
  question_revealed: 'انكشفت إجابتكما',
  decision_created:  'سجّلت قرارًا',
  decision_confirmed:'أكّدت قرارًا',
  note_saved:        'حفظت ملاحظة',
};
const ICO = {
  resource_added:'📚', resource_progress:'📈', question_answered:'💬',
  question_revealed:'👁️', decision_created:'✅', decision_confirmed:'🤝', note_saved:'📝',
};

function relDate(ts) {
  if (!ts) return '';
  const d = new Date(typeof ts==='number'?ts:ts.seconds*1000);
  const diff = Date.now()-d.getTime();
  if (diff<60000) return 'منذ لحظات';
  if (diff<3600000) return `منذ ${Math.floor(diff/60000)} د`;
  if (diff<86400000) return `منذ ${Math.floor(diff/3600000)} س`;
  return d.toLocaleDateString('ar-EG',{month:'short',day:'numeric'});
}

export default function MyJourneyPage() {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { router.replace('/auth'); return; }
    api('GET','/journey').then(data=>{
      setEvents(Array.isArray(data)?data:data.events||[]);
    }).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  return (
    <Layout>
      <h1 className="display mb-1">رحلتي 🌿</h1>
      <p className="lede mb-5">خطواتك إنت بس — مش بيشوفها حد غيرك</p>

      {loading
        ? <div className="text-center py-12 text-sm" style={{color:'var(--ink-muted)'}}>…تحميل</div>
        : !events.length
          ? (
            <div className="card text-center py-12">
              <p className="text-3xl mb-3">🌱</p>
              <p className="font-medium mb-1">رحلتك لسه بتبدأ</p>
              <p className="text-sm" style={{color:'var(--ink-muted)'}}>لمّا تضيف موارد وتتفاعل معها، هيتسجّل هنا.</p>
              <button className="btn mt-4" onClick={()=>router.push('/library')}>اكتشف المكتبة</button>
            </div>
          )
          : (
            <div className="relative">
              <div className="absolute right-4 top-0 bottom-0 w-0.5" style={{background:'var(--line)'}} />
              {events.map((ev,i)=>(
                <div key={ev.id||i} className="flex gap-4 mb-5 relative">
                  <div className="flex-none w-8 h-8 rounded-full flex items-center justify-center text-sm z-10"
                    style={{background:'var(--primary)',color:'var(--gold)'}}>
                    {ICO[ev.type]||'•'}
                  </div>
                  <div className="card flex-1 !mb-0">
                    <p className="text-sm font-medium">{TYPE_LABEL[ev.type]||ev.type}</p>
                    {ev.meta?.title && <p className="text-xs mt-0.5" style={{color:'var(--ink-muted)'}}>{ev.meta.title}</p>}
                    {ev.to && <span className="pill text-xs mt-1">→ {ev.to}</span>}
                    <p className="text-xs mt-1.5" style={{color:'var(--ink-muted)',opacity:.7}}>{relDate(ev.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
    </Layout>
  );
}
