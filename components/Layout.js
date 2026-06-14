'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV = [
  { href:'/home',        label:'الرئيسية',   ico:'🏠' },
  { href:'/journeys',    label:'قوائمنا',    ico:'▶️', group:'رحلتنا' },
  { href:'/library',     label:'المكتبة',    ico:'📚', group:'رحلتنا' },
  { href:'/myjourney',   label:'رحلتي',      ico:'🌿', group:'رحلتنا' },
  { href:'/discussions', label:'المناقشات',  ico:'💬', group:'الحوار' },
  { href:'/decisions',   label:'القرارات',   ico:'✅', group:'الحوار' },
  { href:'/charter',     label:'ميثاقنا',    ico:'📜', group:'الحوار' },
  { href:'/connect',     label:'تواصلنا',    ico:'💞', group:'حياتنا' },
  { href:'/tasks',       label:'المهام',     ico:'🗒️', group:'حياتنا' },
  { href:'/budget',      label:'الميزانية',  ico:'💰', group:'حياتنا' },
  { href:'/shopping',    label:'المشتريات',  ico:'🛒', group:'حياتنا' },
  { href:'/settings',    label:'الإعدادات',  ico:'⚙️', group:'الإعدادات' },
];

export default function Layout({ children }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [open, setOpen]   = useState(false);
  const [theme, setTheme] = useState('light');
  const [name, setName]   = useState('');
  const [code, setCode]   = useState('');

  useEffect(() => {
    const t = localStorage.getItem('sakan_theme') || 'light';
    const n = localStorage.getItem('sakan_name')  || '';
    const c = localStorage.getItem('sakan_code')  || '';
    setTheme(t); setName(n); setCode(c);
  }, []);

  function applyTheme(t) {
    setTheme(t);
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('sakan_theme', t);
    setOpen(false);
  }

  function logout() {
    ['sakan_token','sakan_code','sakan_name','sakan_theme'].forEach(k => localStorage.removeItem(k));
    router.replace('/auth');
  }

  // Group nav items
  const groups = {};
  NAV.forEach(item => {
    const g = item.group || '';
    if (!groups[g]) groups[g] = [];
    groups[g].push(item);
  });

  return (
    <div className="min-h-screen flex flex-col" style={{background:'var(--surface)'}}>
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 h-14 border-b"
        style={{background:'var(--primary)', borderColor:'rgba(200,168,75,.2)'}}>
        <button onClick={() => setOpen(true)} className="flex flex-col gap-1 p-1">
          {[0,1,2].map(i => <span key={i} className="block w-5 h-0.5 rounded" style={{background:'var(--gold)'}} />)}
        </button>
        <span className="text-xl font-bold" style={{color:'var(--gold)'}}>سكن</span>
        <Link href="/home" className="w-7" />
      </header>

      {/* Drawer backdrop */}
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative z-10 w-72 h-full overflow-y-auto shadow-2xl"
            style={{background:'var(--primary)'}}>
            {/* Drawer header */}
            <div className="flex items-center justify-between p-4 border-b" style={{borderColor:'rgba(200,168,75,.2)'}}>
              <span className="text-xl font-bold" style={{color:'var(--gold)'}}>سكن</span>
              <button onClick={() => setOpen(false)} className="text-white opacity-60 text-xl">✕</button>
            </div>
            {code && <div className="px-4 py-2 text-xs" style={{color:'var(--gold-soft)',opacity:.7}}>كود: {code}</div>}

            {/* Nav links */}
            <nav className="p-3 space-y-1">
              {Object.entries(groups).map(([group, items]) => (
                <div key={group}>
                  {group && <div className="px-3 py-1 text-xs font-semibold opacity-50 text-white uppercase tracking-wider mt-3">{group}</div>}
                  {items.map(item => (
                    <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm"
                      style={pathname === item.href
                        ? {background:'rgba(200,168,75,.25)', color:'var(--gold)', fontWeight:600}
                        : {color:'rgba(255,255,255,.8)'}}>
                      <span>{item.ico}</span><span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </nav>

            {/* Theme switcher */}
            <div className="p-4 border-t" style={{borderColor:'rgba(200,168,75,.15)'}}>
              <p className="text-xs mb-2 opacity-50 text-white">السمة</p>
              <div className="flex gap-2">
                {[['light','☀️'],['dark','🌙'],['oled','⚫']].map(([t,ico]) => (
                  <button key={t} onClick={() => applyTheme(t)}
                    className="flex-1 py-1.5 rounded-lg text-xs transition-all"
                    style={theme===t ? {background:'var(--gold)', color:'var(--primary)', fontWeight:700} : {background:'rgba(255,255,255,.1)', color:'white'}}>
                    {ico}
                  </button>
                ))}
              </div>
            </div>

            {/* Logout */}
            <div className="p-4">
              <button onClick={logout} className="w-full py-2 rounded-xl text-sm"
                style={{background:'rgba(255,255,255,.08)', color:'rgba(255,255,255,.6)'}}>
                ↩️ خروج
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Page content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-5">
        {children}
      </main>
    </div>
  );
}
