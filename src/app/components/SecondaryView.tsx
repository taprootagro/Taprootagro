import { ReactNode, useEffect, useState } from "react";
import { X } from "lucide-react";

interface SecondaryViewProps {
  children: ReactNode;
  onClose: () => void;
  title?: string;
  showTitle?: boolean; // 控制是否显示标题栏
}

export function SecondaryView({ children, onClose, title, showTitle = true }: SecondaryViewProps) {
  const [isVisible, setIsVisible] = useState(false);

  // 组件挂载时触发进入动画
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // 关闭动画处理 - 快速干净
  const handleClose = () => {
    setIsVisible(false);
    // 极短延迟，干净利落
    setTimeout(() => {
      onClose();
    }, 80); // 80ms 快速关闭
  };

  return (
    <div 
      className={`fixed inset-0 bg-white z-50 flex flex-col transition-opacity duration-75 ease-in overflow-hidden ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* 状态栏占位 — standalone 模式下用 safe-area-inset-top 撇开 */}
      <div className="bg-emerald-600 safe-top flex-shrink-0" />

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white">
        {/* 可选标题栏 */}
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
        
        {/* 内容主体 */}
        <div className="bg-white h-full">
          {children}
        </div>
      </div>

      {/* Dock栏 - 只显示红色叉号 */}
      <nav className="flex-shrink-0 bg-white border-t border-gray-200 safe-bottom">
        <div className="flex justify-center items-center pt-1.5 pb-0.5">
          <button
            onClick={handleClose}
            className="flex items-center justify-center p-1 transition-colors active:scale-95 touch-manipulation"
            aria-label="关闭"
          >
            <X className="w-6 h-6 text-red-500" />
          </button>
        </div>
      </nav>
    </div>
  );
}