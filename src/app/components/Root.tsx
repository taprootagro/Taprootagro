import { Outlet } from 'react-router';
import { LanguageProvider } from '../hooks/useLanguage';
import { ViewportMeta } from './ViewportMeta';
import { ResponsiveScale } from './ResponsiveScale';
import { PWARegister } from './PWARegister';
import { ErrorBoundary } from './ErrorBoundary';
import { errorMonitor } from '../utils/errorMonitor';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

// Install error monitor once at app startup
errorMonitor.install();

export function Root() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ViewportMeta />
        <ResponsiveScale />
        <PWARegister />
        <Outlet />
      </LanguageProvider>
    </ErrorBoundary>
  );
}