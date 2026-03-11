import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, X, Download } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { shouldShowUpdate, type RolloutConfig } from '../utils/rollout';
import { errorMonitor } from '../utils/errorMonitor';
import { notifyConfigUpdated } from '../hooks/useRemoteConfig';
import { apiClient } from '../utils';
import { storageGet, storageSet, storageGetJSON, storageSetJSON } from '../utils/safeStorage';

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
 * 
 * v2 Update: 使用 apiClient 进行远程配置获取，支持版本协商、重试、缓存
 */

// No periodic polling — the SW handles daily checks itself
// Client only needs to register SW and listen for waiting workers

// Remote config
// Default: TaprootAgro central server (free tier).
// Self-hosted / paid customers can override via VITE_REMOTE_CONFIG_URL at build time.
const REMOTE_CONFIG_URL = import.meta.env.VITE_REMOTE_CONFIG_URL || 'https://www.taprootagro.com/taprootagro/globalpublic/customer.json';
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
  const { t, language } = useLanguage();

  // Handle the update action
  const handleUpdate = useCallback(() => {
    if (!waitingWorker) return;
    
    // iOS Safari PWA 更新策略：标记待更新，下次启动生效
    // 避免运行时热切换导致的资源加载失败和崩溃
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isStandalone = (window.navigator as any).standalone === true || 
                         window.matchMedia('(display-mode: standalone)').matches;
    
    if (isIOS && isStandalone) {
      // iOS PWA 模式：延迟更新策略
      console.log('[PWA] iOS PWA detected, using deferred update strategy');
      
      // 标记有待更新的 SW
      sessionStorage.setItem('taproot_sw_pending_update', '1');
      
      // 注意：iOS 下绝不能发送 SKIP_WAITING，否则新 SW 激活会立即清理旧缓存，
      // 导致当前正在运行的页面在按需加载切片时发生 ChunkLoadError，甚至白屏崩溃。
      // 正确做法是保留 waiting 状态，等用户彻底杀掉进程重启时，系统会自动激活新 SW。
      
      // 显示提示：重启应用后生效
      setIsUpdating(true);
      setTimeout(() => {
        alert(t.common.updateOnRestart || '更新已准备就绪，请彻底关闭并重新打开应用以完成更新');
        setIsUpdating(false);
        setDismissed(true);
      }, 500);
      
      return;
    }
    
    // 非 iOS PWA：使用原有的立即更新策略
    setIsUpdating(true);

    // Set a flag so the controllerchange handler knows this is an intentional update
    sessionStorage.setItem('taproot_sw_updating', '1');

    // Tell the waiting SW to skip waiting and become active
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });

    // Safety: if controllerchange doesn't fire within 3s, force reload
    setTimeout(() => {
      console.warn('[PWA] controllerchange did not fire in 3s, force reloading...');
      sessionStorage.removeItem('taproot_sw_updating');
      window.location.reload();
    }, 3000);
  }, [waitingWorker, t.common.updateOnRestart]);

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
      const lastCheckDate = storageGet(LS_KEY_LAST_REMOTE_CHECK) || '';
      if (lastCheckDate === today) {
        console.log('[PWA] Daily remote check already done today, skipping');
        return;
      }

      console.log('[PWA] First open today — running client-side remote config check...');

      // 使用 apiClient 进行版本化、带重试的远程配置获取
      const response = await apiClient<RolloutConfig>({
        endpoint: REMOTE_CONFIG_URL,
        method: 'GET',
        preferredVersion: 'v3',
        enableFallback: true,
        cache: true,
        cacheTTL: 24 * 60 * 60 * 1000, // 24小时缓存
        offlineFallback: true,
        timeout: 10000,
        retry: {
          maxRetries: 2,
          initialDelay: 1000,
        },
        validateResponse: (data: unknown) => {
          // 验证响应格式
          return typeof data === 'object' && data !== null;
        },
      });

      const config = response.data;
      console.log('[PWA] Remote config received:', config);
      
      if (response.fallback) {
        console.warn(`[PWA] Using fallback API version ${response.apiVersion} (requested: ${response.requestedVersion})`);
      }

      // Mark today as checked & persist config
      storageSet(LS_KEY_LAST_REMOTE_CHECK, today);
      storageSetJSON(LS_KEY_REMOTE_CONFIG, config);

      // Configure error reporting endpoint from remote config
      if (config.errorReportUrl) {
        errorMonitor.setReportEndpoint(config.errorReportUrl);
        console.log('[PWA] Error reporting endpoint configured:', config.errorReportUrl);
      }

      // Extract version (supports multiple field names for flexibility)
      const remoteVersion = config.version || (config as any).cacheVersion || (config as any).appVersion;
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

      // Notify the config update
      notifyConfigUpdated(config);
    } catch (error: any) {
      // apiClient 已经处理了重试和离线fallback
      // 这里只处理彻底失败的情况
      console.warn('[PWA] Remote config check failed after all retries:', error?.message);
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
            console.log('[PWA] New version installed, checking rollout eligibility...');

            // Check rollout before showing update banner
            const config = storageGetJSON<RolloutConfig>(LS_KEY_REMOTE_CONFIG);

            // Get current version from the existing (active) SW
            const currentVersion = ''; // Will be checked against config
            const { shouldUpdate, reason } = shouldShowUpdate(config, currentVersion);
            console.log(`[PWA] Rollout decision: ${shouldUpdate ? 'SHOW' : 'HOLD'} — ${reason}`);

            if (shouldUpdate) {
              setWaitingWorker(newWorker);
              setUpdateAvailable(true);
            } else {
              console.log('[PWA] Update available but device not in rollout group, holding back');
              // Re-check rollout eligibility every 30 minutes
              // (in case rolloutPercentage is increased server-side)
              const recheckInterval = setInterval(() => {
                try {
                  const freshConfig = storageGetJSON<RolloutConfig>(LS_KEY_REMOTE_CONFIG);
                  const { shouldUpdate: nowEligible } = shouldShowUpdate(freshConfig, currentVersion);
                  if (nowEligible) {
                    console.log('[PWA] Now eligible for rollout, showing update');
                    setWaitingWorker(newWorker);
                    setUpdateAvailable(true);
                    clearInterval(recheckInterval);
                  }
                } catch { /* ignore */ }
              }, 30 * 60 * 1000);
            }
          }
        });
      };

      reg.addEventListener('updatefound', onUpdateFound);

      // Check if there's already a waiting worker (e.g., from a previous visit)
      if (reg.waiting && navigator.serviceWorker.controller) {
        console.log('[PWA] Found waiting worker from previous visit');
        // For already-waiting workers, always show (they survived a page load)
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
    let reloading = false;
    const onControllerChange = () => {
      // Prevent infinite reload loop
      if (reloading) return;
      reloading = true;
      console.log('[PWA] Controller changed, reloading for new version...');
      // Small delay to let new SW fully activate
      setTimeout(() => {
        sessionStorage.removeItem('taproot_sw_updating');
        window.location.reload();
      }, 300);
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // ---- Listen for SW broadcast messages (remote config actions) ----
    const onSWMessage = (event: MessageEvent) => {
      const { type } = event.data || {};
      switch (type) {
        case 'FORCE_RELOAD':
          console.log('[PWA] Force reload requested by remote config');
          if (!reloading) {
            reloading = true;
            window.location.reload();
          }
          break;
        case 'KILL_SWITCH':
          console.log('[PWA] Kill switch activated, reloading without SW');
          if (!reloading) {
            reloading = true;
            window.location.reload();
          }
          break;
        case 'REMOTE_CONFIG_UPDATED':
          console.log('[PWA] Remote config updated via SW broadcast');
          if (event.data.config) {
            storageSetJSON(LS_KEY_REMOTE_CONFIG, event.data.config);
            notifyConfigUpdated(event.data.config);
            // Configure error reporting if present
            if (event.data.config.errorReportUrl) {
              errorMonitor.setReportEndpoint(event.data.config.errorReportUrl);
            }
          }
          break;
      }
    };
    navigator.serviceWorker.addEventListener('message', onSWMessage);

    // Register after page load to not block rendering
    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW, { once: true });
    }

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      navigator.serviceWorker.removeEventListener('message', onSWMessage);
    };
  }, [checkRemoteConfig]);

  // ---- Sync language to SW whenever it changes ----
  useEffect(() => {
    if (!canRegisterServiceWorker()) return;
    if (!navigator.serviceWorker.controller) return;

    // Map app language codes to SW translation keys
    // SW supports: en, zh, fr, es, ar, sw
    const langMap: Record<string, string> = {
      en: 'en', zh: 'zh', 'zh-TW': 'zh', es: 'es', fr: 'fr',
      ar: 'ar', pt: 'en', hi: 'en', ru: 'en', bn: 'en',
      ur: 'ar', id: 'en', vi: 'en', ms: 'en', ja: 'zh',
      th: 'en', my: 'en', tl: 'en', tr: 'en', fa: 'ar',
    };
    const swLang = langMap[language] || 'en';

    try {
      navigator.serviceWorker.controller.postMessage({
        type: 'SET_LANGUAGE',
        lang: swLang,
      });
      console.log('[PWA] Language synced to SW:', swLang);
    } catch {
      // SW not ready yet, will sync on next change
    }
  }, [language]);

  // PWA meta tags and manifest are now declared statically in index.html.
  // No need to inject them dynamically — removes duplicate DOM manipulation.

  // Don't render banner if no update or dismissed
  if (!updateAvailable || dismissed) return null;

  return (
    <div
      className="fixed bottom-16 inset-x-2 z-[9999] animate-slide-up"
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
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-white/50 hover:text-white/80 rounded-full"
            aria-label={t.common.close}
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