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
  // 标准检测
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
  if ((navigator as any).standalone === true) return true;

  // TWA (Trusted Web Activity)
  if (document.referrer.includes('android-app://')) return true;

  // 之前已经成功安装过（永久标记）
  if (localStorage.getItem(INSTALLED_KEY) === 'true') return true;

  return false;
}

export function useInstallPrompt() {
  const [showBanner, setShowBanner] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>(null);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // 已安装，不提示
    if (detectStandalone()) return;

    // 用户之前关闭过，检查是否过了冷却期
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10);
      if (elapsed < DISMISS_DURATION) return;
    }

    // 检测 iOS Safari
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|Chrome/.test(ua);

    if (isIOS && isSafari) {
      // iOS Safari：延迟 2s 显示，让用户先浏览内容
      const timer = setTimeout(() => {
        setPlatform('ios');
        setShowBanner(true);
      }, 2000);
      return () => clearTimeout(timer);
    }

    // Android / Chrome：监听 beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault(); // 阻止浏览器默认的迷你横幅
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      // 再次检查，防止小米等浏览器在已安装后仍触发此事件
      if (!detectStandalone()) {
        setPlatform('android');
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    // 监听安装成功 → 永久标记
    const installedHandler = () => {
      setShowBanner(false);
      deferredPrompt.current = null;
      localStorage.setItem(INSTALLED_KEY, 'true');
      localStorage.removeItem(DISMISS_KEY); // 清理关闭记录
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    if (deferredPrompt.current) {
      await deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
        // 用户接受安装 → 永久标记（有些浏览器不触发 appinstalled）
        localStorage.setItem(INSTALLED_KEY, 'true');
        localStorage.removeItem(DISMISS_KEY);
      }
      deferredPrompt.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    setShowBanner(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    deferredPrompt.current = null;
  }, []);

  return { showBanner, platform, triggerInstall, dismiss };
}