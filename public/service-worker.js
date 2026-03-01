// ============================================================
// TaprootAgro PWA Service Worker - Cache-First + Offline-Ready
// ============================================================
// Strategy:
//   - Same-origin: Cache-first for instant load
//   - Cross-origin images: Cache-first with network fallback
//   - Cross-origin CDN (jsDelivr etc): Cache-first for ONNX Runtime
//   - Navigation: Always resolves to cached index.html (SPA)
//   - Once per day (first open), background-check server for updates
//   - Offline: Serve everything from cache, placeholder for uncached images
// ============================================================

const CACHE_VERSION = 'v7';
const CACHE_PREFIX = 'taproot-agro';
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;
const IMG_CACHE_NAME = `${CACHE_PREFIX}-images-${CACHE_VERSION}`;
const CDN_CACHE_NAME = `${CACHE_PREFIX}-cdn-${CACHE_VERSION}`;

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

// Resources that should NEVER be intercepted by the SW
const SW_BYPASS_PATHS = [
  '/service-worker.js',
  '/clear-cache.html',
  '/sw-reset',
];

// Maximum entries per cache
const MAX_CACHE_ENTRIES = 200;
const MAX_IMG_CACHE_ENTRIES = 300;
const MAX_CDN_CACHE_ENTRIES = 50;

// Cross-origin domains allowed to be cached
const CACHEABLE_IMAGE_HOSTS = [
  'images.unsplash.com',
  'placehold.co',
  'plus.unsplash.com',
];

const CACHEABLE_CDN_HOSTS = [
  'cdn.jsdelivr.net',       // ONNX Runtime WASM
  'unpkg.com',
  'cdnjs.cloudflare.com',
];

// ============================================================
// EMERGENCY RECOVERY
// ============================================================
const EMERGENCY_SKIP_WAITING = false;

// ============================================================
// HELPER - Strip redirect flag from responses
// ============================================================
function stripRedirect(response) {
  if (!response || !response.redirected) return response;
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

async function safeCacheAdd(cache, url) {
  try {
    const response = await fetch(url);
    if (response.ok) {
      await cache.put(url, stripRedirect(response));
    }
  } catch (err) {
    console.warn(`[SW] Failed to cache: ${url}`, err);
  }
}

// ============================================================
// DAILY CHECK HELPER
// ============================================================
function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
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
  } catch { /* Silently fail */ }
}

// ============================================================
// 1x1 transparent PNG placeholder for offline uncached images
// ============================================================
const OFFLINE_IMAGE_PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' +
  '<rect fill="#f0fdf4" width="400" height="300"/>' +
  '<text x="200" y="140" text-anchor="middle" fill="#059669" font-family="system-ui" font-size="16">Offline</text>' +
  '<text x="200" y="165" text-anchor="middle" fill="#6b7280" font-family="system-ui" font-size="12">Image not cached</text>' +
  '</svg>'
);

function createOfflineImageResponse() {
  // Return a minimal SVG placeholder
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' +
    '<rect fill="#f0fdf4" width="400" height="300"/>' +
    '<path d="M185 130 l15-20 l15 20 l-7 0 l0 15 l-16 0 l0-15z" fill="#d1d5db"/>' +
    '<text x="200" y="170" text-anchor="middle" fill="#9ca3af" font-family="system-ui" font-size="11">offline</text>' +
    '</svg>';
  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-store'
    }
  });
}

// ============================================================
// INSTALL
// ============================================================
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing ${CACHE_VERSION}...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching app shell');
        return Promise.allSettled(
          APP_SHELL.map((url) => safeCacheAdd(cache, url))
        );
      })
  );
  if (EMERGENCY_SKIP_WAITING) {
    console.warn('[SW] EMERGENCY_SKIP_WAITING enabled, forcing skipWaiting()');
    self.skipWaiting();
  }
});

// ============================================================
// ACTIVATE - Clean up old caches
// ============================================================
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating ${CACHE_VERSION}...`);
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      console.log('[SW] Claimed clients');

      // Pre-fetch fresh index.html
      try {
        const cache = await caches.open(CACHE_NAME);
        const indexResponse = await fetch('/index.html', { cache: 'no-store' });
        if (indexResponse.ok) {
          const clean = stripRedirect(indexResponse);
          await cache.put('/index.html', clean.clone());
          await cache.put('/', clean.clone());
          console.log('[SW] Cached fresh index.html during activation');
        }
      } catch (err) {
        console.warn('[SW] Failed to pre-cache index.html during activation:', err);
      }

      // Delete old caches (all prefixed caches from previous versions)
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith(CACHE_PREFIX) && 
            name !== CACHE_NAME && 
            name !== IMG_CACHE_NAME && 
            name !== CDN_CACHE_NAME)
          .map((name) => {
            console.log(`[SW] Deleting old cache: ${name}`);
            return caches.delete(name);
          })
      );
      console.log('[SW] Activation complete');
    })()
  );
});

// ============================================================
// FETCH - Multi-strategy routing
// ============================================================
let dailyCheckTriggered = false;

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip API endpoints (same-origin)
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

  // ---- Bypass paths ----
  if (url.origin === self.location.origin && SW_BYPASS_PATHS.includes(url.pathname)) {
    if (url.pathname === '/sw-reset') {
      event.respondWith(handleSwReset());
    }
    return;
  }

  // Trigger daily update check (non-blocking, only once per day)
  if (!dailyCheckTriggered) {
    dailyCheckTriggered = true;
    event.waitUntil(triggerDailyCheck());
  }

  // ----- Same-origin requests -----
  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      event.respondWith(safeRespond(() => handleNavigation(), request));
      return;
    }
    event.respondWith(safeRespond(() => cacheFirstStrategy(request, CACHE_NAME, MAX_CACHE_ENTRIES), request));
    return;
  }

  // ----- Cross-origin: Cacheable CDN (ONNX Runtime WASM, JS libraries) -----
  if (CACHEABLE_CDN_HOSTS.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) {
    event.respondWith(safeRespond(() => cacheFirstStrategy(request, CDN_CACHE_NAME, MAX_CDN_CACHE_ENTRIES), request));
    return;
  }

  // ----- Cross-origin: Cacheable images -----
  if (CACHEABLE_IMAGE_HOSTS.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) {
    event.respondWith(safeRespond(() => cacheFirstImageStrategy(request), request));
    return;
  }

  // ----- All other cross-origin: pass through (don't intercept) -----
});

// ============================================================
// SAFE RESPOND WRAPPER
// ============================================================
async function safeRespond(handler, originalRequest) {
  try {
    const response = await handler();
    if (response && response.status !== undefined) {
      return response;
    }
    throw new Error('Invalid response from handler');
  } catch (error) {
    console.error('[SW] Response handler failed, falling through to network:', error);
    try {
      return await fetch(originalRequest);
    } catch {
      // Check if this is an image request
      const url = new URL(originalRequest.url);
      if (isImageRequest(originalRequest, url)) {
        return createOfflineImageResponse();
      }
      
      // If requesting a JS module (like main.tsx) and we are offline/failed
      if (url.pathname.endsWith('.tsx') || url.pathname.endsWith('.ts') || url.pathname.endsWith('.js')) {
         return new Response('console.error("Resource load failed: ' + url.pathname + '");', {
           status: 503,
           headers: { 'Content-Type': 'application/javascript' }
         });
      }

      return new Response(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
        '<body style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui;background:#f0fdf4;color:#065f46;text-align:center;padding:2rem">' +
        '<div><h2>Something went wrong</h2><p style="color:#6b7280;margin:1rem 0">The app encountered an error.</p>' +
        '<button onclick="location.href=\'/sw-reset\'" style="padding:0.75rem 1.5rem;background:#10b981;color:white;border:none;border-radius:0.5rem;cursor:pointer;margin:0.25rem">Reset App</button>' +
        '<button onclick="location.reload()" style="padding:0.75rem 1.5rem;background:#6b7280;color:white;border:none;border-radius:0.5rem;cursor:pointer;margin:0.25rem">Retry</button>' +
        '</div></body></html>',
        { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }
  }
}

// ============================================================
// Helper: detect image requests
// ============================================================
function isImageRequest(request, url) {
  const accept = request.headers.get('accept') || '';
  if (accept.includes('image/')) return true;
  const ext = url.pathname.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'avif'].includes(ext || '');
}

// ============================================================
// EMERGENCY RESET - /sw-reset endpoint
// ============================================================
async function handleSwReset() {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TaprootAgro - Reset</title></head>
<body style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui;background:#f0fdf4;color:#065f46;text-align:center;padding:2rem">
<div id="status">
<svg style="width:48px;height:48px;margin:0 auto 1rem;animation:spin 1s linear infinite" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
<style>@keyframes spin{to{transform:rotate(360deg)}}</style>
<p>Resetting app...</p>
</div>
<script>
(async function(){
  const status = document.getElementById('status');
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(r => r.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    // Also clear IndexedDB model cache
    try { indexedDB.deleteDatabase('taproot-yolo-cache'); } catch(e) {}
    status.innerHTML = '<div style="font-size:48px;margin-bottom:1rem"></div>'
      + '<h2 style="margin-bottom:0.5rem">Reset Complete</h2>'
      + '<p style="margin-bottom:1rem;color:#6b7280">Service Worker unregistered and all caches cleared.</p>'
      + '<button onclick="location.href=\\'/\\'" style="padding:0.75rem 2rem;background:#10b981;color:white;border:none;border-radius:0.75rem;font-size:1rem;cursor:pointer">Open App</button>';
  } catch(e) {
    status.innerHTML = '<div style="font-size:48px;margin-bottom:1rem">❌</div>'
      + '<h2 style="margin-bottom:0.5rem">Reset Failed</h2>'
      + '<p style="color:#dc2626">' + e.message + '</p>'
      + '<p style="margin-top:1rem;color:#6b7280">Please manually clear site data in browser settings.</p>';
  }
})();
</script></body></html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// ============================================================
// SPA Navigation Handler
// ============================================================
async function handleNavigation() {
  // Network-first for navigation (index.html)
  // 部署新版本后，旧 HTML 引用的 JS chunk 文件名已存在，
  // 必须优先从网络获取最新 HTML，只在离线时回退缓存。
  try {
    const controller = new AbortController();
    // 弱网超时 4 秒后回退缓存，不让用户干等
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const networkResponse = await fetch('/index.html', {
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (networkResponse.ok) {
      const clean = stripRedirect(networkResponse);
      // 更新缓存，下次离线可用
      const cache = await caches.open(CACHE_NAME);
      cache.put('/index.html', clean.clone());
      cache.put('/', clean.clone());
      return clean;
    }
    // HTTP 错误（4xx/5xx），回退缓存
    throw new Error(`HTTP ${networkResponse.status}`);
  } catch (error) {
    // 网络不可用或超时 → 回退缓存
    console.warn('[SW] Navigation network-first failed, falling back to cache:', error.message || error);

    const cachedIndex = await caches.match('/index.html');
    if (cachedIndex) {
      return stripRedirect(cachedIndex);
    }

    const cachedRoot = await caches.match('/');
    if (cachedRoot) {
      return stripRedirect(cachedRoot);
    }

    // 完全无缓存 → 离线占位页
    return new Response(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>TaprootAgro - Offline</title>' +
      '<style>*{margin:0;padding:0;box-sizing:border-box}body{display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,-apple-system,sans-serif;background:#f0fdf4;color:#065f46;text-align:center;padding:2rem}' +
      '.card{background:white;border-radius:1rem;padding:2rem;box-shadow:0 4px 20px rgba(0,0,0,0.08);max-width:320px;width:100%}' +
      '.icon{width:64px;height:64px;background:#d1fae5;border-radius:1rem;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem}' +
      'h2{margin-bottom:0.5rem;color:#065f46}p{color:#6b7280;margin-bottom:1rem;font-size:0.875rem}' +
      'button{padding:0.75rem 1.5rem;background:#10b981;color:white;border:none;border-radius:0.75rem;cursor:pointer;font-size:0.875rem;width:100%}' +
      'button:active{background:#059669}</style></head>' +
      '<body><div class="card">' +
      '<div class="icon"><svg width="32" height="32" fill="none" stroke="#059669" stroke-width="2" viewBox="0 0 24 24"><path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg></div>' +
      '<h2>No Network</h2>' +
      '<p>Please check your connection. The app will work once you reconnect.</p>' +
      '<button onclick="location.reload()">Retry</button>' +
      '</div></body></html>',
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      }
    );
  }
}

// ============================================================
// Cache-first: same-origin assets & CDN resources
// ============================================================
async function cacheFirstStrategy(request, cacheName, maxEntries) {
  // 1. Check cache
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    if (isValidCachedResponse(cachedResponse)) {
      return stripRedirect(cachedResponse);
    }
    // Corrupted → evict
    console.warn('[SW] Corrupted cache entry evicted:', request.url);
    const cache = await caches.open(cacheName);
    cache.delete(request);
  }

  // 2. Fetch from network
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const clean = stripRedirect(networkResponse);
      const cache = await caches.open(cacheName);
      cache.put(request, clean.clone());
      trimCache(cacheName, maxEntries);
      return clean;
    }
    return networkResponse;
  } catch (error) {
    if (request.url.endsWith('.js') || request.url.endsWith('.tsx') || request.url.endsWith('.ts')) {
      return new Response('console.error("Offline - Resource not cached: ' + request.url + '");', {
        status: 503,
        headers: { 'Content-Type': 'application/javascript' }
      });
    }
    return new Response('Offline - Resource not cached', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// ============================================================
// Cache-first for cross-origin images
// With offline SVG placeholder fallback
// ============================================================
async function cacheFirstImageStrategy(request) {
  // 1. Check image cache
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    if (isValidCachedResponse(cachedResponse)) {
      return cachedResponse;
    }
    const cache = await caches.open(IMG_CACHE_NAME);
    cache.delete(request);
  }

  // 2. Try network
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Cache the cross-origin image (opaque is fine for display)
      const cache = await caches.open(IMG_CACHE_NAME);
      cache.put(request, networkResponse.clone());
      trimCache(IMG_CACHE_NAME, MAX_IMG_CACHE_ENTRIES);
      return networkResponse;
    }
    return networkResponse;
  } catch (error) {
    // Offline, no cache → return placeholder
    return createOfflineImageResponse();
  }
}

// ============================================================
// CACHE VALIDATION
// ============================================================
function isValidCachedResponse(response) {
  if (!response || response.status === 0) {
    // status 0 = opaque response from cross-origin, which is valid for images
    return response && response.type === 'opaque' ? true : false;
  }
  const contentLength = response.headers.get('content-length');
  if (contentLength !== null && parseInt(contentLength, 10) === 0) return false;
  if (response.type === 'error') return false;
  return true;
}

// ============================================================
// CACHE SIZE LIMITING
// ============================================================
async function trimCache(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length <= maxEntries) return;
    const toDelete = keys.length - maxEntries;
    console.log(`[SW] Trimming ${cacheName}: removing ${toDelete} oldest entries`);
    for (let i = 0; i < toDelete; i++) {
      await cache.delete(keys[i]);
    }
  } catch (err) {
    console.warn('[SW] Cache trim failed:', err);
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

    // 2. Background refresh index.html
    try {
      const freshIndex = await fetch('/index.html', { cache: 'no-store' });
      if (freshIndex.ok) {
        const clean = stripRedirect(freshIndex);
        const cache = await caches.open(CACHE_NAME);
        await cache.put('/index.html', clean.clone());
        await cache.put('/', clean.clone());
        console.log('[SW] index.html refreshed in cache');
      }
    } catch {
      console.warn('[SW] Failed to refresh index.html, will retry tomorrow');
    }

    // 3. Check remote config
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
      Promise.all([
        caches.delete(CACHE_NAME),
        caches.delete(IMG_CACHE_NAME),
        caches.delete(CDN_CACHE_NAME)
      ]).then(() => {
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
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
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