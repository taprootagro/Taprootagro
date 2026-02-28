import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, X, Download } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';

/**
 * PWA Registration & Update Manager
 * 
 * Strategy: Cache-first + daily update check
 * 
 * Update flow:
 * 1. Service Worker serves ALL resources from cache first (instant load)
 * 2. Once per day (first open), SW background-checks server for updates
 * 3. If new SW detected, it installs and enters "waiting" state
 * 4. This component shows an update banner at the bottom
 * 5. User taps "Update" → sends SKIP_WAITING to new SW
 * 6. New SW activates → controllerchange fires → page reloads
 * 
 * To push an update:
 *   1. Change CACHE_VERSION in /public/service-worker.js
 *   2. Optionally update version in remote config at /taprootagro/global
 *   3. Deploy — clients discover the update on next day's first open
 */

// No periodic polling — the SW handles daily checks itself
// Client only needs to register SW and listen for waiting workers

// Remote config
const REMOTE_CONFIG_URL = 'https://www.taprootagro.com/taprootagro/global';
const LS_KEY_LAST_REMOTE_CHECK = 'taproot_last_remote_check';
const LS_KEY_REMOTE_CONFIG = 'taproot_remote_config';

// Check if the current environment supports service worker registration
// SW registration fails in iframes, preview environments, cross-origin contexts, etc.
function canRegisterServiceWorker(): boolean {
  // No SW support at all
  if (!('serviceWorker' in navigator)) return false;
  // Running inside an iframe (e.g., Figma preview, CodeSandbox, StackBlitz)
  if (window.self !== window.top) return false;
  // Known preview/dev domains where SW registration is blocked
  const hostname = window.location.hostname;
  if (
    hostname.includes('figma.site') ||
    hostname.includes('figma.com') ||
    hostname.includes('codesandbox.io') ||
    hostname.includes('stackblitz.com') ||
    hostname.includes('webcontainer.io')
  ) return false;
  return true;
}

export function PWARegister() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { t } = useLanguage();

  // Handle the update action
  const handleUpdate = useCallback(() => {
    if (!waitingWorker) return;
    setIsUpdating(true);
    // Tell the waiting SW to skip waiting and become active
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  }, [waitingWorker]);

  // Dismiss the update banner (will show again on next check)
  const handleDismiss = useCallback(() => {
    setDismissed(true);
    // Show again after 10 minutes
    setTimeout(() => setDismissed(false), 10 * 60 * 1000);
  }, []);

  // ---- Daily remote config check (client-side, complements SW check) ----
  const checkRemoteConfig = useCallback(async (
    registration: ServiceWorkerRegistration | null
  ) => {
    try {
      // Use localStorage date string for daily gating (same logic as SW)
      const today = new Date().toISOString().slice(0, 10);
      const lastCheckDate = localStorage.getItem(LS_KEY_LAST_REMOTE_CHECK) || '';
      if (lastCheckDate === today) {
        console.log('[PWA] Daily remote check already done today, skipping');
        return;
      }

      console.log('[PWA] First open today — running client-side remote config check...');

      // Fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(REMOTE_CONFIG_URL, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[PWA] Remote config HTTP ${response.status}, keeping current version`);
        return;
      }

      const config = await response.json();
      console.log('[PWA] Remote config received:', config);

      // Mark today as checked & persist config
      localStorage.setItem(LS_KEY_LAST_REMOTE_CHECK, today);
      localStorage.setItem(LS_KEY_REMOTE_CONFIG, JSON.stringify(config));

      // Extract version (supports multiple field names for flexibility)
      const remoteVersion = config.version || config.cacheVersion || config.appVersion;
      if (!remoteVersion) {
        console.log('[PWA] Remote config has no version field, check complete');
        return;
      }

      // Get local SW version via MessageChannel
      let localVersion = '';
      if (navigator.serviceWorker.controller) {
        try {
          localVersion = await new Promise<string>((resolve) => {
            const channel = new MessageChannel();
            channel.port1.onmessage = (e) => resolve(e.data?.version || '');
            navigator.serviceWorker.controller!.postMessage(
              { type: 'GET_VERSION' }, [channel.port2]
            );
            setTimeout(() => resolve(''), 3000);
          });
        } catch {
          localVersion = '';
        }
      }

      if (localVersion && remoteVersion !== localVersion) {
        console.log(`[PWA] Version mismatch! Remote: ${remoteVersion}, Local: ${localVersion}`);
        console.log('[PWA] Triggering service worker update check...');
        // This will cause the browser to fetch /service-worker.js again
        // If the file has changed, the normal SW update flow kicks in
        registration?.update().catch((err) => {
          console.warn('[PWA] Update check failed:', err);
        });
      } else {
        console.log(`[PWA] Version up to date: ${localVersion || 'unknown'}`);
      }
    } catch (error: any) {
      // Network error, timeout, offline — silently ignore
      if (error?.name === 'AbortError') {
        console.warn('[PWA] Remote config check timed out, will retry next cycle');
      } else {
        console.warn('[PWA] Remote config check failed, keeping current version:', error?.message);
      }
      // Do NOT update the timestamp on failure, so it retries on next app load
    }
  }, []);

  useEffect(() => {
    if (!canRegisterServiceWorker()) return;

    let registration: ServiceWorkerRegistration | null = null;

    // Track new SW entering waiting state
    const trackWaitingWorker = (reg: ServiceWorkerRegistration) => {
      const onUpdateFound = () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          // New SW is installed and waiting to activate
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[PWA] New version available, waiting for user approval');
            setWaitingWorker(newWorker);
            setUpdateAvailable(true);
          }
        });
      };

      reg.addEventListener('updatefound', onUpdateFound);

      // Check if there's already a waiting worker (e.g., from a previous visit)
      if (reg.waiting && navigator.serviceWorker.controller) {
        console.log('[PWA] Found waiting worker from previous visit');
        setWaitingWorker(reg.waiting);
        setUpdateAvailable(true);
      }
    };

    // Register service worker
    const registerSW = async () => {
      try {
        registration = await navigator.serviceWorker.register('/service-worker.js', {
          // Let browser cache handle SW file; daily check is in the SW itself
          updateViaCache: 'none'
        });
        console.log('[PWA] Service Worker registered, scope:', registration.scope);

        trackWaitingWorker(registration);

        // No periodic polling — SW handles daily update checks internally
        // Only run client-side remote config check once on load
        checkRemoteConfig(registration);

      } catch (error) {
        console.error('[PWA] Service Worker registration failed:', error);
      }
    };

    // Listen for controller change (new SW took over) → reload
    const onControllerChange = () => {
      console.log('[PWA] Controller changed, reloading for new version...');
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // Register after page load to not block rendering
    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW, { once: true });
    }

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, [checkRemoteConfig]);

  // Inject PWA meta tags and manifest
  useEffect(() => {
    // Manifest
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/manifest.json';
      document.head.appendChild(link);
    }

    // Meta tags
    const metas: Record<string, string> = {
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-status-bar-style': 'default',
      'apple-mobile-web-app-title': 'TaprootAgro',
      'mobile-web-app-capable': 'yes',
      'theme-color': '#10b981',
    };

    const createdElements: HTMLElement[] = [];

    Object.entries(metas).forEach(([name, content]) => {
      if (!document.querySelector(`meta[name="${name}"]`)) {
        const meta = document.createElement('meta');
        meta.name = name;
        meta.content = content;
        document.head.appendChild(meta);
        createdElements.push(meta);
      }
    });

    // Apple touch icon
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const icon = document.createElement('link');
      icon.rel = 'apple-touch-icon';
      icon.href = '/icon-192.png';
      document.head.appendChild(icon);
      createdElements.push(icon);
    }

    return () => {
      createdElements.forEach((el) => el.parentNode?.removeChild(el));
    };
  }, []);

  // Don't render banner if no update or dismissed
  if (!updateAvailable || dismissed) return null;

  return (
    <div
      className="fixed bottom-16 left-2 right-2 z-[9999] animate-slide-up"
      style={{ maxWidth: '420px', margin: '0 auto' }}
    >
      <div
        className="bg-emerald-700 text-white rounded-2xl shadow-2xl overflow-hidden"
        style={{
          boxShadow: '0 -4px 24px rgba(0,0,0,0.2), 0 8px 32px rgba(16,185,129,0.3)',
        }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Icon */}
          <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Download className="w-5 h-5" />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-white/95" style={{ fontSize: 'clamp(13px, 3.5vw, 14px)' }}>
              {t.common.newVersionAvailable || 'New version available'}
            </p>
            <p className="text-white/60" style={{ fontSize: 'clamp(10px, 2.8vw, 11px)', marginTop: '2px' }}>
              {t.common.tapToUpdate || 'Tap to update for the latest features'}
            </p>
          </div>

          {/* Update button */}
          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className="flex-shrink-0 bg-white text-emerald-700 rounded-xl px-4 py-2 flex items-center gap-1.5 active:scale-95 transition-transform disabled:opacity-70"
            style={{ fontSize: 'clamp(12px, 3.2vw, 13px)' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
            {isUpdating
              ? (t.common.updating || 'Updating...')
              : (t.common.update || 'Update')
            }
          </button>

          {/* Dismiss */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-white/50 hover:text-white/80 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar when updating */}
        {isUpdating && (
          <div className="h-0.5 bg-white/20">
            <div className="h-full bg-white/80 animate-progress-bar rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
}