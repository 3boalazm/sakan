// سكن — Service Worker
// نسخة: 1.0.0  |  تاريخ البناء: يُحدَّث تلقائيًا

const CACHE_NAME    = 'sakan-v1';
const STATIC_CACHE  = 'sakan-static-v1';
const DYNAMIC_CACHE = 'sakan-dynamic-v1';

// ملفات الشل — تُخزَّن دائمًا
const SHELL_FILES = [
  '/',
  '/index.html',
  '/js/sakan-core.js',
  '/js/sakan-pages1.js',
  '/js/sakan-pages2.js',
  '/media/auth-bg.jpg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/manifest.json',
];

// ===================== Install =====================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing سكن...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

// ===================== Activate =====================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ===================== Fetch =====================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls → Network first, no cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets (JS, CSS, fonts, images) → Cache first
  if (
    url.pathname.startsWith('/js/')   ||
    url.pathname.startsWith('/fonts/')||
    url.pathname.startsWith('/icons/')||
    url.pathname.startsWith('/media/')||
    url.pathname.endsWith('.css')     ||
    url.pathname.endsWith('.js')
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML / navigation → Stale while revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// ===================== Strategies =====================

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    return cached || new Response(
      JSON.stringify({ error: 'offline' }), 
      { status: 503, headers: { 'Content-Type': 'application/json' }}
    );
  }
}

async function staleWhileRevalidate(request) {
  const cache  = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || (await fetchPromise) || 
    caches.match('/index.html'); // App shell fallback
}

// ===================== Push Notifications =====================
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  let data;
  try { data = event.data.json(); }
  catch (e) { data = { title: 'سكن', body: event.data.text() }; }

  const title   = data.title || 'سكن 🌿';
  const options = {
    body:    data.body   || '',
    icon:    '/icons/icon-192x192.png',
    badge:   '/icons/icon-72x72.png',
    tag:     data.tag    || 'sakan-notif',
    data:    data.url    || '/',
    vibrate: [200, 100, 200],
    dir:     'rtl',
    lang:    'ar',
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(winClients => {
      const existing = winClients.find(c => c.url === url);
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});

// ===================== Background Sync =====================
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notes') {
    event.waitUntil(syncPendingNotes());
  }
});

async function syncPendingNotes() {
  // TODO: sync any pending localStorage notes to server when back online
  console.log('[SW] Background sync: notes');
}

// ===================== Message =====================
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CACHE_URLS') {
    const urls = event.data.payload;
    caches.open(DYNAMIC_CACHE).then(c => c.addAll(urls));
  }
});
