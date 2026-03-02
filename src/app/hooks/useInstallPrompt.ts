import { useState, useEffect, useCallback, useRef } from 'react';

const DISMISS_KEY = 'pwa_install_dismissed';
const INSTALLED_KEY = 'pwa_installed';       // 永久已安装标记
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7天后再次提示

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallPlatform = 'android' | 'ios' | null;

/**
 * 检测是否以 standalone 模式运行（已安装到桌面）
 * 兼容小米 / 华为 / OPPO / vivo 等国产浏览器
 */
function detectStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
  if ((navigator as any).standalone === true) return true;
  if (document.referrer.includes('android-app://')) return true;
  if (localStorage.getItem(INSTALLED_KEY) === 'true') return true;
  return false;
}

/**
 * 检测是否应该显示安装提示（排除已安装和冷却期）
 */
function shouldShowBanner(): boolean {
  if (detectStandalone()) return false;
  const dismissedAt = localStorage.getItem(DISMISS_KEY);
  if (dismissedAt) {
    const elapsed = Date.now() - parseInt(dismissedAt, 10);
    if (elapsed < DISMISS_DURATION) return false;
  }
  return true;
}

/**
 * 检测 iOS 设备（所有浏览器，不限 Safari）
 * iOS 上所有浏览器都使用 WebKit，都需要"分享→添加到主屏幕"方式安装
 */
function detectIOS(): boolean {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPad 伪装成 macOS 的情况
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
  return false;
}

/**
 * 检测 Android 设备（排除 iOS 和纯桌面）
 */
function detectAndroid(): boolean {
  const ua = navigator.userAgent;
  // 明确 Android UA
  if (/Android/i.test(ua)) return true;
  // 移动设备但非 iOS（兜底：一些国产浏览器 UA 不标准）
  if (/Mobile|Tablet/i.test(ua) && !detectIOS()) return true;
  return false;
}

// 超时兜底时间：3 秒内没收到 beforeinstallprompt 就显示手动引导
const ANDROID_FALLBACK_TIMEOUT = 3000;

// ================================================================
// 模块级 beforeinstallprompt 事件捕获
// 解决：事件在 React 挂载之前触发导致被错过的问题
// ================================================================
let _capturedPromptEvent: BeforeInstallPromptEvent | null = null;
const _promptListeners = new Set<(e: BeforeInstallPromptEvent) => void>();

// 在模块加载时立即注册全局监听（比 React 快得多）
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _capturedPromptEvent = e as BeforeInstallPromptEvent;
    // 通知所有已注册的 hook 实例
    _promptListeners.forEach(fn => fn(_capturedPromptEvent!));
  });
}

export function useInstallPrompt() {
  const [showBanner, setShowBanner] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>(null);
  const [manualInstall, setManualInstall] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (!shouldShowBanner()) return;

    const isIOS = detectIOS();

    // ---- iOS：所有浏览器都显示引导 ----
    if (isIOS) {
      const timer = setTimeout(() => {
        if (shouldShowBanner()) {
          setPlatform('ios');
          setShowBanner(true);
        }
      }, 1500);
      return () => clearTimeout(timer);
    }

    // ---- Android / Chrome / 其他：beforeinstallprompt ----
    // 1) 检查是否已在 React 挂载前捕获到事件
    if (_capturedPromptEvent) {
      deferredPrompt.current = _capturedPromptEvent;
      setPlatform('android');
      setShowBanner(true);
      return;
    }

    // 2) 还没捕获到，注册回调等待
    let gotPrompt = false;
    const handler = (e: BeforeInstallPromptEvent) => {
      gotPrompt = true;
      deferredPrompt.current = e;
      if (!detectStandalone()) {
        setManualInstall(false);
        setPlatform('android');
        setShowBanner(true);
      }
    };
    _promptListeners.add(handler);

    // 3) 超时兜底：3 秒后仍无事件 → Android 设备显示手动安装引导
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    if (detectAndroid()) {
      fallbackTimer = setTimeout(() => {
        if (!gotPrompt && !_capturedPromptEvent && shouldShowBanner()) {
          setManualInstall(true);
          setPlatform('android');
          setShowBanner(true);
        }
      }, ANDROID_FALLBACK_TIMEOUT);
    }

    // 4) 同时也监听 appinstalled
    const installedHandler = () => {
      setShowBanner(false);
      deferredPrompt.current = null;
      _capturedPromptEvent = null;
      localStorage.setItem(INSTALLED_KEY, 'true');
      localStorage.removeItem(DISMISS_KEY);
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      _promptListeners.delete(handler);
      window.removeEventListener('appinstalled', installedHandler);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    const prompt = deferredPrompt.current || _capturedPromptEvent;
    if (prompt) {
      try {
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') {
          setShowBanner(false);
          localStorage.setItem(INSTALLED_KEY, 'true');
          localStorage.removeItem(DISMISS_KEY);
        }
      } catch {
        // 某些浏览器 prompt() 只能调一次，忽略错误
      }
      deferredPrompt.current = null;
      _capturedPromptEvent = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    setShowBanner(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    deferredPrompt.current = null;
  }, []);

  return { showBanner, platform, manualInstall, triggerInstall, dismiss };
}