import { Outlet, Link, useLocation } from "react-router";
import { Home, ShoppingBag, MessageCircle, User } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { useState, useEffect } from "react";

// 预加载映射 - 根据路径预加载对应组件
const preloadMap: Record<string, () => Promise<any>> = {
  "/home": () => import("./HomePage"),
  "/home/market": () => import("./MarketPage"),
  "/home/community": () => import("./CommunityPage"),
  "/home/profile": () => import("./ProfilePage"),
};

export function Layout() {
  const location = useLocation();
  const { t } = useLanguage();
  
  // 未读消息红点状态
  const [showUnreadBadge, setShowUnreadBadge] = useState(true);

  // 监听路由变化，点击社区页面后隐藏红点
  useEffect(() => {
    if (location.pathname === "/home/community") {
      setShowUnreadBadge(false);
    }
  }, [location.pathname]);

  // 触摸开始时立即预加载页面，提升响应速度
  const handleTouchStart = (path: string) => {
    const preload = preloadMap[path];
    if (preload) {
      preload();
    }
  };

  const navItems = [
    { path: "/home", icon: Home, label: t.common.home },
    { path: "/home/market", icon: ShoppingBag, label: t.common.market },
    { path: "/home/community", icon: MessageCircle, label: t.common.community, showBadge: showUnreadBadge },
    { path: "/home/profile", icon: User, label: t.common.profile },
  ];

  return (
    <div className="h-full w-full flex flex-col" style={{ backgroundColor: 'var(--app-bg)' }}>
      {/* 状态栏 - 绿色与下方完美衔接 */}
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

      {/* 主内容 */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </main>

      {/* 底部导航 */}
      <nav className="flex-shrink-0 bg-white border-t border-gray-200 safe-area-inset-bottom shadow-lg">
        <div className="flex justify-around items-center py-1.5 px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors duration-200 relative ${
                  isActive ? "text-emerald-600" : "text-gray-500"
                }`}
                onTouchStart={() => handleTouchStart(item.path)}
              >
                {/* 活动背景 */}
                {isActive && (
                  <div className="absolute inset-0 bg-emerald-50 rounded-xl -z-10"></div>
                )}
                
                {/* 图标 - 简化动画 */}
                <div className={`${isActive ? 'scale-110' : ''} transition-transform duration-200`}>
                  <Icon className="w-5 h-5" />
                </div>
                
                {/* 活动指示器 */}
                {isActive && (
                  <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-emerald-600 rounded-full"></div>
                )}
                
                {/* 未读消息红点 */}
                {item.showBadge && (
                  <div className="absolute top-0 right-2 w-2 h-2 bg-red-500 rounded-full"></div>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}