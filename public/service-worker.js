// ============================================================
// TaprootAgro PWA Service Worker - Production Update System
// ============================================================
// Update Guide:
//   1. Change CACHE_VERSION to trigger update on all clients
//   2. Deploy new files to your hosting server
//   3. Users will see an update banner and can update with one tap
// ============================================================

const CACHE_VERSION = 'v4';
const CACHE_PREFIX = 'taproot-agro';
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;

// Remote config endpoint - checked weekly by clients to discover new versions
const REMOTE_CONFIG_URL = 'https://www.taprootagro.com/taprootagro/global';
const REMOTE_CHECK_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

// App shell - critical resources to pre-cache on install
const APP_SHELL = [
  '/',
  '/index.html'
];

// ============================================================
// INSTALL - Pre-cache app shell, do NOT auto skipWaiting
// ============================================================
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing ${CACHE_VERSION}...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching app shell');
        // Use individual cache.add to avoid failing all if one resource 404s
        return Promise.allSettled(
          APP_SHELL.map((url) => cache.add(url).catch((err) => {
            console.warn(`[SW] Failed to cache: ${url}`, err);
          }))
        );
      })
  );
  // Do NOT call self.skipWaiting() here!
  // Wait for the client to explicitly request activation via SKIP_WAITING message
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
      // Take control of all clients immediately after activation
      return self.clients.claim();
    })
  );
});

// ============================================================
// FETCH - Smart caching strategy
//   - Navigation requests: Network-first (always get latest HTML)
//   - Static assets (JS/CSS/fonts/images): Cache-first with network fallback
//   - API calls & external URLs: Network-only (never cache)
// ============================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (APIs, CDNs, analytics, etc.)
  if (url.origin !== self.location.origin) return;

  // Skip API endpoints
  if (url.pathname.startsWith('/api/')) return;

  // Skip the service worker file itself
  if (url.pathname === '/service-worker.js') return;

  // ----- Navigation requests (HTML pages) -----
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // ----- Static assets (JS, CSS, images, fonts, models) -----
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // ----- Everything else: network with cache fallback -----
  event.respondWith(networkFirstStrategy(request));
});

// Check if a path is a static asset (hashed filenames are safe to cache long-term)
function isStaticAsset(pathname) {
  return /\.(js|css|woff2?|ttf|eot|svg|png|jpe?g|gif|webp|ico|onnx|json)(\?.*)?$/.test(pathname)
    || pathname.startsWith('/assets/')
    || pathname.startsWith('/models/');
}

// Network-first: try network, fall back to cache, then offline fallback
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    // Cache successful responses for offline use
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // For navigation, return cached index.html (SPA fallback)
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
    }
    return new Response('Offline - No cached version available', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
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
// MESSAGE HANDLER - Communication with the client
// ============================================================
self.addEventListener('message', (event) => {
  const { type } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      // Client approved the update, activate new SW now
      console.log('[SW] Client approved update, calling skipWaiting()');
      self.skipWaiting();
      break;

    case 'GET_VERSION':
      event.ports[0]?.postMessage({
        version: CACHE_VERSION,
        cacheName: CACHE_NAME,
        remoteConfigUrl: REMOTE_CONFIG_URL,
        remoteCheckInterval: REMOTE_CHECK_INTERVAL
      });
      break;

    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME).then(() => {
        event.ports[0]?.postMessage({ success: true });
      });
      break;

    case 'CHECK_UPDATE':
      // Force a registration update check
      self.registration.update().then(() => {
        event.ports[0]?.postMessage({ checked: true });
      }).catch((err) => {
        event.ports[0]?.postMessage({ checked: false, error: err.message });
      });
      break;

    case 'CHECK_REMOTE_CONFIG':
      // Fetch remote config and compare version
      checkRemoteConfig().then((result) => {
        event.ports[0]?.postMessage(result);
      }).catch((err) => {
        event.ports[0]?.postMessage({ hasUpdate: false, error: err.message });
      });
      break;
  }
});

// ============================================================
// REMOTE CONFIG - Weekly version check from central server
// ============================================================
async function checkRemoteConfig() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

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

    // Compare remote version with current local version
    const remoteVersion = config.version || config.cacheVersion || config.appVersion;
    if (remoteVersion && remoteVersion !== CACHE_VERSION) {
      console.log(`[SW] Remote version ${remoteVersion} differs from local ${CACHE_VERSION}, update available`);
      // Trigger SW update check - this will fetch a new service-worker.js if deployed
      self.registration.update().catch((err) => {
        console.warn('[SW] Auto update check failed:', err);
      });
      return { hasUpdate: true, remoteVersion, localVersion: CACHE_VERSION, config };
    }

    console.log(`[SW] Version up to date: ${CACHE_VERSION}`);
    return { hasUpdate: false, remoteVersion, localVersion: CACHE_VERSION, config };
  } catch (error) {
    // Network error, offline, timeout - silently fail, keep current version
    console.warn('[SW] Remote config check failed (will retry next cycle):', error.message || error);
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

// Notification click
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