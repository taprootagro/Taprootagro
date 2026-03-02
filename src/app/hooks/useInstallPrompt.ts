import { useState, useEffect, useCallback, useRef } from 'react';

const DISMISS_KEY = 'pwa_install_dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7天后再次提示

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallPlatform = 'android' | 'ios' | null;

export function useInstallPrompt() {
  const [showBanner, setShowBanner] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>(null);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // 已经是 standalone 模式（已安装），不提示
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;
    if (isStandalone) return;

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
      setPlatform('android');
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // 监听安装成功
    const installedHandler = () => {
      setShowBanner(false);
      deferredPrompt.current = null;
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
