import { Outlet } from 'react-router';
import { LanguageProvider } from '../hooks/useLanguage';
import { ViewportMeta } from './ViewportMeta';
import { ResponsiveScale } from './ResponsiveScale';
import { PWARegister } from './PWARegister';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

export function Root() {
  return (
    <LanguageProvider>
      <ViewportMeta />
      <ResponsiveScale />
      <PWARegister />
      <Outlet />
    </LanguageProvider>
  );
}