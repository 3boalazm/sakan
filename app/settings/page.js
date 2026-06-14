'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { api, getToken, clearToken } from '@/lib/client/api';

export default function SettingsPage() {
  const router = useRouter();
  const [code, setCode]   = useState('');
  const [name, setName]   = useState('');
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    if (!getToken()) { router.replace('/auth'); return; }
    setCode(localStorage.getItem('sakan_code')||'');
    setName(localStorage.getItem('sakan_name')||'');
    setTheme(localStorage.getItem('sakan_theme')||'light');
  },[]);

  function applyTheme(t) {
    setTheme(t);
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('sakan_theme', t);
  }

  function logout() {
    clearToken();
    ['sakan_code','sakan_name','sakan_theme'].forEach(k=>localStorage.removeItem(k));
    router.replace('/auth');
  }

  function copyCode() {
    navigator.clipboard.writeText(code).then(()=>alert('تم نسخ الكود!'));
  }

  return (
    <Layout>
      <h1 className="display mb-1">الإعدادات</h1>
      <p className="lede mb-5">إعدادات حسابك وتطبيقك.</p>

      {/* Profile */}
      <div className="card mb-4">
        <p className="eyebrow mb-3">الحساب</p>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold"
            style={{background:'var(--primary)',color:'var(--gold)'}}>
            {name?name[0]:'؟'}
          </div>
          <div>
            <p className="font-semibold">{name||'مجهول'}</p>
          </div>
        </div>
        {code && (
          <div className="rounded-xl p-3 text-center" style={{background:'var(--line)'}}>
            <p className="text-xs mb-1" style={{color:'var(--ink-muted)'}}>كود دعوة شريكك</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-xl font-bold tracking-widest" style={{color:'var(--primary)'}}>{code}</span>
              <button onClick={copyCode} className="text-xs px-2 py-1 rounded-lg" style={{background:'var(--primary)',color:'var(--gold)'}}>نسخ</button>
            </div>
          </div>
        )}
      </div>

      {/* Theme */}
      <div className="card mb-4">
        <p className="eyebrow mb-3">السمة</p>
        <div className="grid grid-cols-3 gap-2">
          {[['light','☀️ فاتح','#f8f5ec'],['dark','🌙 داكن','#1a2318'],['oled','⚫ OLED','#000']].map(([t,l,bg])=>(
            <button key={t} onClick={()=>applyTheme(t)}
              className="p-3 rounded-xl text-center transition-all border-2"
              style={theme===t?{borderColor:'var(--gold)',background:bg,color:theme===t&&t!=='light'?'#fff':'var(--ink)'}:{borderColor:'var(--line)',background:bg,color:t!=='light'?'#fff':'var(--ink)'}}>
              <p className="text-lg mb-1">{l.split(' ')[0]}</p>
              <p className="text-xs">{l.split(' ')[1]}</p>
              {theme===t && <p className="text-xs mt-1" style={{color:'var(--gold)'}}>✓ مُفعَّل</p>}
            </button>
          ))}
        </div>
      </div>

      {/* PWA Install */}
      <div className="card mb-4">
        <p className="eyebrow mb-2">التطبيق</p>
        <p className="text-sm mb-3" style={{color:'var(--ink-muted)'}}>يمكنك تثبيت سكن على شاشتك الرئيسية — يشتغل زي تطبيق عادي.</p>
        <p className="text-xs" style={{color:'var(--ink-muted)'}}>
          📱 Android: اضغط القائمة → "تثبيت التطبيق"<br/>
          🍎 iOS: اضغط Share → "Add to Home Screen"
        </p>
      </div>

      {/* Logout */}
      <button onClick={logout}
        className="w-full py-3 rounded-2xl text-sm font-medium border transition-all"
        style={{borderColor:'var(--accent)',color:'var(--accent)'}}>
        تسجيل الخروج ↩️
      </button>

      <p className="text-center text-xs mt-6" style={{color:'var(--ink-muted)',opacity:.5}}>
        سكن · نسخة 2.0 · مساحة خاصة 🌿
      </p>
    </Layout>
  );
}
