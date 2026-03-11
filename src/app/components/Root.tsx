import { Outlet } from 'react-router';
import { useEffect } from 'react';
import { LanguageProvider } from '../hooks/useLanguage';
import { ViewportMeta } from './ViewportMeta';
import { ResponsiveScale } from './ResponsiveScale';
import { PWARegister } from './PWARegister';
import { ErrorBoundary } from './ErrorBoundary';
import { errorMonitor } from '../utils/errorMonitor';
import { installSilentRecovery } from '../utils/silentRecovery';
import { initTaprootDB } from '../utils/db';
import { defaultConfig } from '../hooks/useHomeConfig';
import { ConfigProvider, useConfigContext } from '../hooks/ConfigProvider';
import { useDynamicIcon } from '../hooks/useDynamicIcon';

// Inner component that uses hooks requiring config context
function RootInner() {
  const { config } = useConfigContext();
  useDynamicIcon(config.desktopIcon);

  return (
    <>
      <ViewportMeta />
      <ResponsiveScale />
      <PWARegister />
      <Outlet />
    </>
  );
}

export function Root() {
  // Install error monitor after mount (avoids patching fetch during SSR/preview)
  useEffect(() => {
    errorMonitor.install();
    installSilentRecovery();
    initTaprootDB(); // fire-and-forget — app works with localStorage fallback until ready
  }, []);

  // defaultConfig 是模块级常量，直接 import 即可，无需调用 useHomeConfig() hook
  // 这样避免在 ConfigProvider 之外创建多余的 state 实例
  return (
    <LanguageProvider>
      <ConfigProvider defaultConfig={defaultConfig}>
        <ErrorBoundary>
          <RootInner />
        </ErrorBoundary>
      </ConfigProvider>
    </LanguageProvider>
  );
}