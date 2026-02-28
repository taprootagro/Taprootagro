import { useEffect } from 'react';

export function ViewportMeta() {
  useEffect(() => {
    // 设置viewport meta标签
    let metaViewport = document.querySelector('meta[name="viewport"]');
    
    if (!metaViewport) {
      metaViewport = document.createElement('meta');
      metaViewport.setAttribute('name', 'viewport');
      document.head.appendChild(metaViewport);
    }
    
    metaViewport.setAttribute(
      'content',
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
    );

    // 设置主题颜色
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.setAttribute('name', 'theme-color');
      document.head.appendChild(metaTheme);
    }
    
    metaTheme.setAttribute('content', '#10b981');

    // 设置apple-mobile-web-app-capable
    let metaApple = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
    
    if (!metaApple) {
      metaApple = document.createElement('meta');
      metaApple.setAttribute('name', 'apple-mobile-web-app-capable');
      document.head.appendChild(metaApple);
    }
    
    metaApple.setAttribute('content', 'yes');

    // 设置apple-mobile-web-app-status-bar-style
    let metaAppleBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    
    if (!metaAppleBar) {
      metaAppleBar = document.createElement('meta');
      metaAppleBar.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
      document.head.appendChild(metaAppleBar);
    }
    
    metaAppleBar.setAttribute('content', 'black-translucent');
  }, []);

  return null;
}
