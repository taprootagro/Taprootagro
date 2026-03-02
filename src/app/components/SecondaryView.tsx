import { ReactNode, useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";

interface SecondaryViewProps {
  children: ReactNode;
  onClose: () => void;
  title?: string;
  showTitle?: boolean;
}

/**
 * SecondaryView — 二级页面容器
 * 动画：从底部浮上来 translateY(100%) → translateY(0)
 * 纯 CSS transform，GPU 合成，十年前手机也流畅
 */
export function SecondaryView({ children, onClose, title, showTitle = true }: SecondaryViewProps) {
  const [phase, setPhase] = useState<'entering' | 'visible' | 'leaving'>('entering');

  useEffect(() => {
    // 双帧确保浏览器完成首帧布局再触发过渡，低端设备也能稳定触发动画
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase('visible'));
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleClose = useCallback(() => {
    setPhase('leaving');
  }, []);

  const handleTransitionEnd = useCallback(() => {
    if (phase === 'leaving') onClose();
  }, [phase, onClose]);

  const off = phase !== 'visible';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-white"
      style={{
        transform: off ? 'scale(0.92) translateY(18px)' : 'scale(1) translateY(0)',
        opacity: off ? 0 : 1,
        transition: phase === 'leaving'
          ? 'transform 320ms cubic-bezier(0.4, 0, 1, 1), opacity 260ms ease-in'
          : 'transform 480ms cubic-bezier(0.16, 1, 0.3, 1), opacity 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: off ? 'transform, opacity' : 'auto',
      }}
      onTransitionEnd={handleTransitionEnd}
    >
      {/* 状态栏占位 */}
      <div className="bg-emerald-600 safe-top flex-shrink-0" />

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white">
        {showTitle && title && (
          <div 
            className="sticky top-0 bg-white border-b border-gray-200 z-10 flex items-center justify-center"
            style={{ 
              padding: 'clamp(12px, 3vh, 20px) clamp(16px, 4vw, 24px)',
              minHeight: 'clamp(48px, 12vh, 64px)'
            }}
          >
            <h2 
              className="font-bold text-gray-900 text-center truncate w-full px-2"
              style={{ fontSize: 'clamp(13px, 4vw, 18px)' }}
            >
              {title}
            </h2>
          </div>
        )}
        <div className="bg-white h-full">
          {children}
        </div>
      </div>

      {/* Dock栏 */}
      <nav className="flex-shrink-0 bg-white border-t border-gray-200 safe-bottom">
        <div className="flex justify-center items-center pt-1.5 pb-1">
          <button
            onClick={handleClose}
            className="flex items-center justify-center p-2 transition-colors active:scale-95 touch-manipulation"
            aria-label="关闭"
          >
            <X className="w-7 h-7 text-red-500" />
          </button>
        </div>
      </nav>
    </div>
  );
}