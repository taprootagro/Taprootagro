import { useState, useEffect, useCallback, useRef } from 'react';
import { storageGet, storageSet, storageRemove } from '../utils/safeStorage';

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
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
    if ((navigator as any).standalone === true) return true;
    if (document.referrer.includes('android-app://')) return true;
    if (storageGet(INSTALLED_KEY) === 'true') return true;
  } catch { /* ignore */ }
  return false;
}

/**
 * 检测是否应该显示安装提示（排除已安装和冷却期）
 */
function shouldShowBanner(): boolean {
  if (detectStandalone()) return false;
  const dismissedAt = storageGet(DISMISS_KEY);
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
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (!shouldShowBanner()) return;

    const isIOS = detectIOS();

    // ---- iOS：所有浏览器都显示引导 ----
    if (isIOS) {
      // 延迟 1.5s 让用户先看到内容，但用 module 级 flag 防止重入丢失
      const timer = setTimeout(() => {
        // 再次检查（防止期间用户安装了或关了）
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
      return; // 不需要再监听
    }

    // 2) 还没捕获到，注册回调等待
    const handler = (e: BeforeInstallPromptEvent) => {
      deferredPrompt.current = e;
      if (!detectStandalone()) {
        setPlatform('android');
        setShowBanner(true);
      }
    };
    _promptListeners.add(handler);

    // 3) 同时也监听 appinstalled
    const installedHandler = () => {
      setShowBanner(false);
      deferredPrompt.current = null;
      _capturedPromptEvent = null;
      storageSet(INSTALLED_KEY, 'true');
      storageRemove(DISMISS_KEY);
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      _promptListeners.delete(handler);
      window.removeEventListener('appinstalled', installedHandler);
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
          storageSet(INSTALLED_KEY, 'true');
          storageRemove(DISMISS_KEY);
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
    storageSet(DISMISS_KEY, String(Date.now()));
    deferredPrompt.current = null;
  }, []);

  return { showBanner, platform, triggerInstall, dismiss };
}