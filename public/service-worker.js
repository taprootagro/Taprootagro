// ============================================================
// TaprootAgro PWA Service Worker - Cache-First + Daily Update
// ============================================================
// Strategy:
//   - ALL resources served from cache first (instant load)
//   - Navigation always resolves to cached index.html (SPA)
//   - Once per day (first open), background-check server for updates
//   - If new SW detected, user sees update banner
// ============================================================

const CACHE_VERSION = 'v5';
const CACHE_PREFIX = 'taproot-agro';
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;

// Remote config endpoint
const REMOTE_CONFIG_URL = 'https://www.taprootagro.com/taprootagro/global';

// Daily check key stored in cache
const DAILY_CHECK_KEY = '__taproot_daily_check__';

// App shell - critical resources to pre-cache on install
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json'
];

// ============================================================
// DAILY CHECK HELPER - Only hit the server once per day
// ============================================================
function getTodayDateString() {
  return new Date().toISOString().slice(0, 10); // "2026-02-28"
}

async function hasCheckedToday() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(DAILY_CHECK_KEY);
    if (!response) return false;
    const data = await response.json();
    return data.date === getTodayDateString();
  } catch {
    return false;
  }
}

async function markCheckedToday() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const body = JSON.stringify({ date: getTodayDateString() });
    await cache.put(DAILY_CHECK_KEY, new Response(body, {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch {
    // Silently fail
  }
}

// ============================================================
// INSTALL - Pre-cache app shell, do NOT auto skipWaiting
// ============================================================
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing ${CACHE_VERSION}...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching app shell');
        return Promise.allSettled(
          APP_SHELL.map((url) => cache.add(url).catch((err) => {
            console.warn(`[SW] Failed to cache: ${url}`, err);
          }))
        );
      })
  );
  // Do NOT call self.skipWaiting() here!
});

// ============================================================
// ACTIVATE - Clean up old caches, claim clients
// ============================================================
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating ${CACHE_VERSION}...`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => {
            console.log(`[SW] Deleting old cache: ${name}`);
            return caches.delete(name);
          })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// ============================================================
// FETCH - Cache-First SPA Strategy
//   - Navigation: ALWAYS serve /index.html (SPA single entry point)
//   - Static assets: Cache-first with network fallback
//   - API & cross-origin: Pass through
// ============================================================
let dailyCheckTriggered = false;

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Skip API endpoints
  if (url.pathname.startsWith('/api/')) return;

  // Skip the service worker file itself
  if (url.pathname === '/service-worker.js') return;

  // Trigger daily update check (non-blocking, only once per day)
  if (!dailyCheckTriggered) {
    dailyCheckTriggered = true;
    event.waitUntil(triggerDailyCheck());
  }

  // ----- Navigation requests (HTML pages) -----
  // SPA: ALL navigation resolves to /index.html, React Router handles the rest
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation());
    return;
  }

  // ----- All other same-origin resources: Cache-first -----
  event.respondWith(cacheFirstStrategy(request));
});

// SPA Navigation Handler: always return index.html
// Priority: cached index.html → network index.html → offline fallback
async function handleNavigation() {
  // 1. Try to serve cached /index.html (instant, works offline)
  const cachedIndex = await caches.match('/index.html');
  if (cachedIndex) {
    return cachedIndex;
  }

  // 2. Also try cached "/" (may be the same response)
  const cachedRoot = await caches.match('/');
  if (cachedRoot) {
    return cachedRoot;
  }

  // 3. Nothing cached — fetch from network
  try {
    const networkResponse = await fetch('/index.html');
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put('/index.html', networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return new Response(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TaprootAgro</title></head>' +
      '<body style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui;background:#f0fdf4;color:#065f46;text-align:center;padding:2rem">' +
      '<div><h2 style="margin-bottom:1rem">Offline</h2><p>Please check your network connection and try again.</p>' +
      '<button onclick="location.reload()" style="margin-top:1rem;padding:0.5rem 1.5rem;background:#10b981;color:white;border:none;border-radius:0.5rem;cursor:pointer">Retry</button></div>' +
      '</body></html>',
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      }
    );
  }
}

// Cache-first: use cache if available, otherwise fetch and cache
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return new Response('Offline - Resource not cached', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// ============================================================
// DAILY UPDATE CHECK - Background, non-blocking
// ============================================================
async function triggerDailyCheck() {
  try {
    const alreadyChecked = await hasCheckedToday();
    if (alreadyChecked) {
      console.log('[SW] Daily check already done, skipping');
      return;
    }

    console.log('[SW] First open today — checking server for updates...');
    await markCheckedToday();

    // 1. Check registration for new service-worker.js
    await self.registration.update();
    console.log('[SW] SW update check complete');

    // 2. Background refresh index.html so next launch has latest version
    try {
      const freshIndex = await fetch('/index.html', { cache: 'no-store' });
      if (freshIndex.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put('/index.html', freshIndex.clone());
        await cache.put('/', freshIndex.clone());
        console.log('[SW] index.html refreshed in cache');
      }
    } catch {
      console.warn('[SW] Failed to refresh index.html, will retry tomorrow');
    }

    // 3. Also check remote config
    await checkRemoteConfig();
  } catch (error) {
    console.warn('[SW] Daily check failed (will retry tomorrow):', error.message || error);
  }
}

// ============================================================
// MESSAGE HANDLER
// ============================================================
self.addEventListener('message', (event) => {
  const { type } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      console.log('[SW] Client approved update, calling skipWaiting()');
      self.skipWaiting();
      break;

    case 'GET_VERSION':
      event.ports[0]?.postMessage({
        version: CACHE_VERSION,
        cacheName: CACHE_NAME,
        remoteConfigUrl: REMOTE_CONFIG_URL
      });
      break;

    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME).then(() => {
        event.ports[0]?.postMessage({ success: true });
      });
      break;

    case 'CHECK_UPDATE':
      self.registration.update().then(() => {
        event.ports[0]?.postMessage({ checked: true });
      }).catch((err) => {
        event.ports[0]?.postMessage({ checked: false, error: err.message });
      });
      break;

    case 'CHECK_REMOTE_CONFIG':
      checkRemoteConfig().then((result) => {
        event.ports[0]?.postMessage(result);
      }).catch((err) => {
        event.ports[0]?.postMessage({ hasUpdate: false, error: err.message });
      });
      break;
  }
});

// ============================================================
// REMOTE CONFIG
// ============================================================
async function checkRemoteConfig() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(REMOTE_CONFIG_URL, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[SW] Remote config fetch failed: HTTP ${response.status}`);
      return { hasUpdate: false, error: `HTTP ${response.status}` };
    }

    const config = await response.json();
    console.log('[SW] Remote config received:', config);

    const remoteVersion = config.version || config.cacheVersion || config.appVersion;
    if (remoteVersion && remoteVersion !== CACHE_VERSION) {
      console.log(`[SW] Remote version ${remoteVersion} differs from local ${CACHE_VERSION}, update available`);
      self.registration.update().catch((err) => {
        console.warn('[SW] Auto update check failed:', err);
      });
      return { hasUpdate: true, remoteVersion, localVersion: CACHE_VERSION, config };
    }

    console.log(`[SW] Version up to date: ${CACHE_VERSION}`);
    return { hasUpdate: false, remoteVersion, localVersion: CACHE_VERSION, config };
  } catch (error) {
    console.warn('[SW] Remote config check failed:', error.message || error);
    return { hasUpdate: false, error: error.message || 'Network error' };
  }
}

// ============================================================
// PUSH NOTIFICATIONS
// ============================================================
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

  let data = {
    title: 'TaprootAgro',
    body: 'You have a new notification',
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    tag: 'default',
    data: {}
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      console.error('[SW] Push data parse error:', e);
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      data: data.data,
      image: data.image,
      vibrate: data.vibrate || [200, 100, 200],
      actions: data.actions || [],
      requireInteraction: false,
      renotify: true
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url
    || (event.action && { view: '/', reply: '/home/community', order: '/home/market', profile: '/home/profile' }[event.action])
    || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow(urlToOpen);
      })
  );
});

self.addEventListener('notificationclose', () => {});

// ============================================================
// BACKGROUND SYNC
// ============================================================
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-data-periodic') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  console.log('[SW] Starting data sync...');
  try {
    const allClients = await self.clients.matchAll();
    if (allClients.length === 0) return;

    const syncQueue = await new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (e) => resolve(e.data);
      allClients[0].postMessage({ type: 'GET_SYNC_QUEUE' }, [channel.port2]);
      setTimeout(() => resolve([]), 1000);
    });

    if (!syncQueue || syncQueue.length === 0) return;

    const endpoints = {
      comment: '/api/comments',
      like: '/api/likes',
      purchase: '/api/purchases',
      post: '/api/posts',
      other: '/api/sync'
    };

    const results = await Promise.allSettled(
      syncQueue.map((item) =>
        fetch(endpoints[item.type] || endpoints.other, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.data)
        })
      )
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    console.log(`[SW] Sync complete: ${succeeded}/${syncQueue.length} succeeded`);
  } catch (error) {
    console.error('[SW] Sync error:', error);
    throw error;
  }
}

console.log(`[SW] Script loaded, version: ${CACHE_VERSION}`);
