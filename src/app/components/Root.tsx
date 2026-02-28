import { Outlet } from 'react-router';
import { useEffect } from 'react';
import { LanguageProvider } from '../hooks/useLanguage';
import { ViewportMeta } from './ViewportMeta';
import { ResponsiveScale } from './ResponsiveScale';
import { PWARegister } from './PWARegister';
import { ErrorBoundary } from './ErrorBoundary';
import { errorMonitor } from '../utils/errorMonitor';
import { useHomeConfig } from '../hooks/useHomeConfig';
import { useDynamicIcon } from '../hooks/useDynamicIcon';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

// Inner component that uses hooks requiring config context
function RootInner() {
  const { config } = useHomeConfig();
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
  }, []);

  return (
    <LanguageProvider>
      <ErrorBoundary>
        <RootInner />
      </ErrorBoundary>
    </LanguageProvider>
  );
}