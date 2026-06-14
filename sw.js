// sw.js — نسخة تنظيف وإصلاح
// بتستبدل أي Service Worker قديم (Next.js / workbox)، بتمسح كل الكاش القديم،
// وبتقدّم كل حاجة من الشبكة مباشرة (مفيش تقديم نسخ قديمة).
// أي جهاز فتح الموقع قبل كده هيتنضّف أوتوماتيك بمجرد ما يزور الموقع ويعمل reload مرة.

self.addEventListener('install', () => {
  // فعّل النسخة الجديدة على طول من غير انتظار
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // امسح كل الكاش القديم بالكامل (Next.js + workbox + أي حاجة)
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    // خُد السيطرة على كل التبويبات المفتوحة فورًا
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  // POST وغيره يعدّي للشبكة عادي
  if (event.request.method !== 'GET') return;
  // مفيش respondWith → المتصفح بيجيب من الشبكة مباشرة، يعني مفيش نسخ قديمة تتقدّم أبدًا
});