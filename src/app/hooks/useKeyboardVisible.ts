import { useState, useEffect } from 'react';

/**
 * Detect virtual keyboard visibility on mobile devices.
 * 
 * Strategy:
 * - Uses visualViewport API: when keyboard opens, visualViewport.height
 *   becomes significantly smaller than window.innerHeight.
 * - Threshold: 150px difference (keyboards are typically 250-350px tall).
 * - Falls back to false on desktop / unsupported browsers.
 * - Also monitors focus/blur events on input elements for faster detection.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;

    const THRESHOLD = 150; // px — minimum height difference to consider keyboard "open"

    function check() {
      // When keyboard opens, visualViewport.height shrinks but innerHeight stays the same
      const diff = window.innerHeight - (vv?.height ?? window.innerHeight);
      const isVisible = diff > THRESHOLD;
      setVisible(isVisible);

      // 键盘弹出时立即重置页面滚动位置，防止页面跳动
      if (isVisible) {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }
    }

    if (vv) {
      vv.addEventListener('resize', check);
      // iOS also fires scroll when keyboard pushes viewport
      vv.addEventListener('scroll', check);
    }

    // 监听 input/textarea 的 focus/blur 事件，提前预判键盘状态
    // 这比等待 visualViewport resize 更快（能提前 100-300ms）
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        const inputType = (target as HTMLInputElement).type;
        // 排除不会弹键盘的 input 类型
        if (inputType !== 'checkbox' && inputType !== 'radio' && inputType !== 'range' && inputType !== 'file') {
          // 提前标记键盘即将出现，防止 dock 栏闪烁
          // 延迟一帧确认（避免误判点击 input 但未弹键盘的情况）
          requestAnimationFrame(() => {
            // 再次检查 visualViewport（此时可能已经开始缩小）
            if (vv) {
              const diff = window.innerHeight - vv.height;
              if (diff > THRESHOLD) {
                setVisible(true);
                window.scrollTo(0, 0);
              }
            }
          });
          // 延迟 300ms 再检查一次（覆盖键盘动画时间）
          setTimeout(check, 300);
        }
      }
    };

    const handleFocusOut = () => {
      // blur 后延迟检查，等待键盘收起动画完成
      setTimeout(check, 100);
      setTimeout(check, 300);
    };

    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('focusout', handleFocusOut, true);

    // Initial check
    check();

    return () => {
      if (vv) {
        vv.removeEventListener('resize', check);
        vv.removeEventListener('scroll', check);
      }
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('focusout', handleFocusOut, true);
    };
  }, []);

  return visible;
}