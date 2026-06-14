import './globals.css';

export const metadata = {
  title: 'سكن — مساحتنا',
  description: 'مساحة خاصة للزوجين — نتعلم، نتناقش، ونتفق',
  manifest: '/manifest.json',
  themeColor: '#1e3a2f',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1e3a2f" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <script dangerouslySetInnerHTML={{__html:`
          (function(){
            try {
              var t = localStorage.getItem('sakan_theme') || 'light';
              if(['light','dark','oled'].indexOf(t)>=0)
                document.documentElement.setAttribute('data-theme', t);
            } catch(e) {}
          })();
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
