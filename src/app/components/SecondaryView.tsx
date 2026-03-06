import { ReactNode, useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";

interface SecondaryViewProps {
  children: ReactNode;
  footer?: ReactNode;
  dockLeft?: ReactNode;
  dockRight?: ReactNode;
  headerRight?: ReactNode;
  onClose: () => void;
  title?: string;
  showTitle?: boolean;
}

/**
 * SecondaryView — 二级页面容器
 * 动画：从底部浮上来 translateY(100%) → translateY(0)
 * 纯 CSS transform，GPU 合成，十年前手机也流畅
 */
export function SecondaryView({ children, footer, dockLeft, dockRight, headerRight, onClose, title, showTitle = true }: SecondaryViewProps) {
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
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{
        backgroundColor: 'var(--app-bg)',
        transform: phase === 'entering'
          ? 'scale(0.94) translateY(12px)'   // 进入：从略小+偏下浮上来
          : phase === 'leaving'
            ? 'scale(0.97)'                  // 退出：纯缩小，不位移，干净利落
            : 'none',
        opacity: off ? 0 : 1,
        transition: phase === 'leaving'
          ? 'transform 160ms ease-in, opacity 120ms ease-in'
          : 'transform 380ms cubic-bezier(0.16, 1, 0.3, 1), opacity 280ms cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: off ? 'transform, opacity' : 'auto',
      }}
      onTransitionEnd={handleTransitionEnd}
    >
      {/* 状态栏占位 */}
      <div className="bg-emerald-600 safe-top flex-shrink-0" />

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ backgroundColor: 'var(--app-bg)' }}>
        {showTitle && title && (
          <div 
            className="sticky top-0 z-10 flex items-center justify-center relative"
            style={{ 
              backgroundColor: 'var(--app-bg)',
              boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
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
            {headerRight && (
              <div className="absolute right-4 top-1/2" style={{ transform: 'translateY(-50%)' }}>
                {headerRight}
              </div>
            )}
          </div>
        )}
        <div className="min-h-full" style={{ backgroundColor: 'var(--app-bg)' }}>
          {children}
        </div>
      </div>

      {/* Footer — 固定在滚动区域下方、Dock栏上方 */}
      {footer && (
        <div className="flex-shrink-0" style={{ backgroundColor: 'var(--app-bg)' }}>
          {footer}
        </div>
      )}

      {/* Dock栏 — 结构与 Layout 底部导航完全一致，只是内容换成关闭按钮 */}
      <nav className="flex-shrink-0 bg-white safe-bottom" style={{ boxShadow: '0 -1px 12px rgba(0,0,0,0.06)' }}>
        <div className="relative">
          <div className="flex items-center justify-center px-1 relative">
            {dockLeft && <div className="absolute left-4">{dockLeft}</div>}
            {dockRight && <div className="absolute right-4">{dockRight}</div>}
            <button
              onClick={handleClose}
              className="flex items-center justify-center pt-2.5 pb-1.5 active:scale-95 transition-transform touch-manipulation"
              aria-label="关闭"
            >
              <X className="w-7 h-7 text-red-500" strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}