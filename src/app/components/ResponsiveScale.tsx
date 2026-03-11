import { useEffect } from 'react';

/**
 * 响应式视口组件
 * 
 * 变更说明（v2）：
 * - 移除了动态修改根字体大小的逻辑，改为尊重用户系统字体设置
 *   （无障碍合规：WCAG 2.1 SC 1.4.4 要求文字可放大到 200% 不丢失内容）
 * - 保留 --app-height CSS 变量，解决 iOS Safari 100vh 不准的问题
 * - 用户如果在系统设置中调大字体，App 会自动跟随，无需额外处理
 */
export function ResponsiveScale() {
  useEffect(() => {
    const updateViewportHeight = () => {
      // 动态视口高度 — 解决 iOS Safari 工具栏导致 100vh 不准
      const vh = window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${vh}px`);
    };

    // 初始设置
    updateViewportHeight();

    // 监听窗口大小变化
    window.addEventListener('resize', updateViewportHeight);
    
    // 监听屏幕方向变化
    const handleOrientation = () => {
      // orientationchange 后尺寸可能有延迟，等 150ms 再更新
      setTimeout(updateViewportHeight, 150);
    };
    window.addEventListener('orientationchange', handleOrientation);
    
    // iOS Safari 滚动工具栏显隐会改变 innerHeight
    // 用 visualViewport 监听更精确
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewportHeight);
    }

    // 清理函数
    return () => {
      window.removeEventListener('resize', updateViewportHeight);
      window.removeEventListener('orientationchange', handleOrientation);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateViewportHeight);
      }
    };
  }, []);

  return null;
}