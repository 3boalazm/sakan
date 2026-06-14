'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken, errMsg } from '@/lib/client/api';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode]     = useState('login'); // login | signup | join
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [form, setForm]     = useState({ name:'', email:'', password:'', code:'' });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit() {
    setError(''); setLoading(true);
    try {
      let out;
      if (mode === 'login') {
        out = await api('POST', '/login', { email: form.email, password: form.password });
      } else if (mode === 'signup') {
        out = await api('POST', '/pair', { email: form.email, password: form.password, displayName: form.name || 'أنا' });
      } else {
        out = await api('POST', '/pair/join', { code: form.code.trim().toUpperCase(), email: form.email, password: form.password, displayName: form.name || 'أنا' });
      }
      setToken(out.token);
      if (out.pairCode)    localStorage.setItem('sakan_code', out.pairCode);
      if (out.displayName) localStorage.setItem('sakan_name', out.displayName);
      router.replace('/home');
    } catch(e) {
      setError(errMsg(e));
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
         style={{background:'var(--primary)'}}>
      {/* Brand */}
      <div className="mb-8 text-center">
        <div className="text-5xl font-bold mb-2" style={{color:'var(--gold)'}}>سكن</div>
        <p className="text-sm opacity-70 text-white">مساحتنا إحنا الاتنين بس — نتعلّم، نتناقش، ونتفق</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-3xl p-6 shadow-2xl" style={{background:'var(--surface)'}}>
        {/* Tabs */}
        <div className="flex mb-6 rounded-xl overflow-hidden border" style={{borderColor:'var(--line)'}}>
          {[['login','دخول'],['signup','حساب جديد']].map(([m,l]) => (
            <button key={m} onClick={() => { setMode(m); setError(''); }}
              className="flex-1 py-2 text-sm font-medium transition-all"
              style={mode===m ? {background:'var(--primary)',color:'var(--gold)'} : {color:'var(--ink-muted)'}}>
              {l}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {(mode === 'signup' || mode === 'join') && (
            <input className="inp" placeholder="اسمك (مثلاً: مصطفى)"
              value={form.name} onChange={set('name')} />
          )}
          {mode === 'join' && (
            <input className="inp" placeholder="كود الميثاق"
              value={form.code} onChange={set('code')} />
          )}
          <input className="inp" type="email" placeholder="الإيميل"
            value={form.email} onChange={set('email')} />
          <input className="inp" type="password" placeholder="الباسوورد"
            value={form.password} onChange={set('password')} />

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <button className="btn w-full py-3 text-base" onClick={submit} disabled={loading}>
            {loading ? '...' : mode === 'login' ? 'دخول' : mode === 'signup' ? 'إنشاء الميثاق' : 'انضمام'}
          </button>

          {mode === 'login' && (
            <p className="text-center text-xs" style={{color:'var(--ink-muted)'}}>
              أول مرة؟{' '}
              <button className="font-semibold" style={{color:'var(--primary)'}} onClick={() => setMode('signup')}>اعمل حساب</button>
              {' '}أو{' '}
              <button className="font-semibold" style={{color:'var(--primary)'}} onClick={() => setMode('join')}>انضم بكود</button>
            </p>
          )}
          {mode !== 'login' && (
            <p className="text-center text-xs" style={{color:'var(--ink-muted)'}}>
              <button className="font-semibold" style={{color:'var(--primary)'}} onClick={() => setMode('login')}>← رجوع لتسجيل الدخول</button>
            </p>
          )}
        </div>
      </div>

      <p className="mt-6 text-xs text-white opacity-40">خاصّة بطبيعتها · من غير مشاركة عامة 🌿</p>
    </div>
  );
}
