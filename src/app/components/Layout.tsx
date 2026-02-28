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
      {/* 状态栏占位 */}
      <div className="bg-emerald-600 px-4 py-2 flex-shrink-0">
        <span className="invisible">0:00</span>
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