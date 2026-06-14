// sw.js — نسخة معدلة تدعم التحديث اليدوي بدون إعادة تحميل تلقائي

self.addEventListener('install', () => {
  // تفعيل النسخة الجديدة فورًا دون انتظار
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // مسح كل الكاش القديم
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    // السيطرة على جميع التبويبات المفتوحة
    await self.clients.claim();
  })());
});

// استقبال رسائل من الواجهة (عند الضغط على زر "تحديث")
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    // إعلام جميع العملاء (الصفحات) بأنه تم التحديث ويمكنهم إعادة التحميل
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'SW_UPDATED' });
      });
    });
  }
});

// لا نتعامل مع fetch — كل الطلبات تذهب للشبكة مباشرة
self.addEventListener('fetch', (event) => {
  // نمرر الطلبات كما هي دون تدخل من Service Worker
  return;
});