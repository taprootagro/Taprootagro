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
      className={`fixed inset-0 bg-white z-50 flex flex-col transition-opacity duration-75 ease-in ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* 顶部状态栏 - 绿色与下方完美衔接 */}
      <div className="bg-emerald-600 text-white px-4 py-2 flex justify-between items-center flex-shrink-0">
        {/* 左侧：时间 */}
        <span className="font-medium" style={{ fontSize: 'clamp(11px, 3vw, 13px)' }}>
          9:41
        </span>
        
        {/* 右侧：信号、WiFi、电池 */}
        <div className="flex gap-1.5 items-center">
          {/* 信号强度 */}
          <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
            <rect width="2" height="4" rx="0.5" fill="white" opacity="0.95" />
            <rect x="3.5" width="2" height="6" rx="0.5" fill="white" opacity="0.95" />
            <rect x="7" width="2" height="8" rx="0.5" fill="white" opacity="0.95" />
            <rect x="10.5" width="2" height="11" rx="0.5" fill="white" opacity="0.95" />
          </svg>
          
          {/* WiFi 图标 */}
          <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
            <path d="M7.5 11C8.05 11 8.5 10.55 8.5 10C8.5 9.45 8.05 9 7.5 9C6.95 9 6.5 9.45 6.5 10C6.5 10.55 6.95 11 7.5 11Z" fill="white" opacity="0.95"/>
            <path d="M7.5 6C9.43 6 11.24 6.73 12.63 8L11.5 9.13C10.42 8.19 9.02 7.67 7.5 7.67C5.98 7.67 4.58 8.19 3.5 9.13L2.37 8C3.76 6.73 5.57 6 7.5 6Z" fill="white" opacity="0.95"/>
            <path d="M7.5 2C10.53 2 13.36 3.17 15.5 5.23L14.37 6.36C12.58 4.68 10.14 3.67 7.5 3.67C4.86 3.67 2.42 4.68 0.63 6.36L-0.5 5.23C1.64 3.17 4.47 2 7.5 2Z" fill="white" opacity="0.95"/>
          </svg>
          
          {/* 电池图标 */}
          <div className="flex items-center gap-0.5">
            <div className="relative">
              <div className="w-[18px] h-[9px] border border-white/90 rounded-sm flex items-center px-[1px]">
                <div className="w-full h-[5px] bg-white rounded-[1px] opacity-95"></div>
              </div>
              <div className="absolute -right-[2px] top-1/2 -translate-y-1/2 w-[1.5px] h-[4px] bg-white/90 rounded-r-sm"></div>
            </div>
          </div>
        </div>
      </div>

      {/* 内容区域 - 占据除状态栏和dock外的所有空间 */}
      <div className="flex-1 overflow-y-auto bg-white">
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
      <nav className="flex-shrink-0 bg-white border-t border-gray-200 safe-area-inset-bottom">
        <div className="flex justify-center items-center py-2">
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