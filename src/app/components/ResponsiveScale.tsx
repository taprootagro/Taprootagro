import { useEffect } from 'react';

/**
 * 响应式缩放组件
 * 根据屏幕宽度动态调整根元素字体大小，实现整体UI的等比例缩放
 * 设计基准：375px (iPhone SE / 小屏手机)
 * 缩放范围：320px ~ 480px
 */
export function ResponsiveScale() {
  useEffect(() => {
    const setRootFontSize = () => {
      const screenWidth = window.innerWidth;
      
      // 设计基准宽度 (参考iPhone SE等小屏手机)
      const baseWidth = 375;
      
      // 基准字体大小
      const baseFontSize = 16;
      
      // 限制最小和最大宽度，避免极端情况
      const minWidth = 320; // 最小屏幕宽度
      const maxWidth = 480; // 最大屏幕宽度（小型平板）
      
      // 计算实际宽度（在限制范围内）
      const actualWidth = Math.min(Math.max(screenWidth, minWidth), maxWidth);
      
      // 计算缩放比例
      const scale = actualWidth / baseWidth;
      
      // 计算新的字体大小
      const newFontSize = baseFontSize * scale;
      
      // 设置根元素字体大小
      document.documentElement.style.fontSize = `${newFontSize}px`;
      
      // 同时更新CSS变量
      document.documentElement.style.setProperty('--font-size', `${newFontSize}px`);
      
      // 调试信息（可选）
      // console.log(`Screen: ${screenWidth}px, Scale: ${scale.toFixed(2)}, Font: ${newFontSize.toFixed(2)}px`);
    };

    // 初始设置
    setRootFontSize();

    // 监听窗口大小变化
    window.addEventListener('resize', setRootFontSize);
    
    // 监听屏幕方向变化
    window.addEventListener('orientationchange', setRootFontSize);

    // 清理函数
    return () => {
      window.removeEventListener('resize', setRootFontSize);
      window.removeEventListener('orientationchange', setRootFontSize);
    };
  }, []);

  return null;
}
