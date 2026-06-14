'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { api, getToken } from '@/lib/client/api';

const STATE_AR = {
  open:'بانتظار ردّكما', answered_by_one:'ردّ واحد فقط',
  ready_to_reveal:'جاهز للكشف', revealed:'مكشوف', decided:'تقرّر',
};
const STATE_COLOR = {
  open:'var(--ink-muted)', answered_by_one:'var(--gold)',
  ready_to_reveal:'var(--accent)', revealed:'var(--primary)', decided:'var(--primary)',
};

export default function DiscussionsPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState([]);
  const [filter, setFilter]       = useState('all');
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!getToken()) { router.replace('/auth'); return; }
    api('GET','/questions').then(data=>{
      setQuestions(Array.isArray(data)?data:data.questions||[]);
    }).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const filters = [
    ['all','الكل'],['open','بانتظار'],['ready_to_reveal','للكشف'],['revealed','مكشوف'],
  ];

  const shown = filter==='all' ? questions : questions.filter(q=>q.state===filter);

  return (
    <Layout>
      <h1 className="display mb-1">المناقشات</h1>
      <p className="lede mb-4">كل أسئلة النقاش في مكان واحد.</p>

      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {filters.map(([k,l])=>(
          <button key={k} onClick={()=>setFilter(k)}
            className="flex-none px-3 py-1.5 rounded-xl text-xs transition-all whitespace-nowrap"
            style={filter===k?{background:'var(--primary)',color:'var(--gold)',fontWeight:600}:{background:'var(--line)',color:'var(--ink-muted)'}}>
            {l} {k==='all'?'':questions.filter(q=>k==='all'||q.state===k).length > 0 ? `(${questions.filter(q=>q.state===k).length})` : ''}
          </button>
        ))}
      </div>

      {loading
        ? <div className="text-center py-12 text-sm" style={{color:'var(--ink-muted)'}}>…تحميل</div>
        : !shown.length
          ? <div className="card text-center py-10 text-sm" style={{color:'var(--ink-muted)'}}>مفيش أسئلة هنا</div>
          : shown.map(q=>(
              <button key={q.id} onClick={()=>router.push('/library/'+q.resourceId+'?tab=discussion')}
                className="card w-full text-right mb-3 hover:opacity-80 transition-opacity">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium flex-1">{q.text}</p>
                  <span className="flex-none text-xs px-2 py-0.5 rounded-full"
                    style={{background:'color-mix(in srgb,'+STATE_COLOR[q.state]+' 15%,transparent)',color:STATE_COLOR[q.state]}}>
                    {STATE_AR[q.state]||q.state}
                  </span>
                </div>
                {q.resourceTitle && <p className="text-xs mt-1.5" style={{color:'var(--ink-muted)'}}>من: {q.resourceTitle}</p>}
              </button>
            ))}
    </Layout>
  );
}
