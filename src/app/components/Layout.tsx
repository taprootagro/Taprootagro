import { Link, useLocation } from "react-router";
import { Home, BookOpen, MessageCircle, User } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { useState, useEffect, lazy, Suspense } from "react";
import { motion } from "motion/react";
import {
  HomePageSkeleton,
  MarketPageSkeleton,
  CommunityPageSkeleton,
  ProfilePageSkeleton,
} from "./SkeletonScreen";

// Keep-alive: 懒加载但只挂载一次，切换时不卸载
const HomePage = lazy(() => import("./HomePage"));
const MarketPage = lazy(() => import("./MarketPage"));
const CommunityPage = lazy(() => import("./CommunityPage"));
const ProfilePage = lazy(() => import("./ProfilePage"));

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

  // 记录已访问过的 tab，实现「首次访问才懒加载，之后常驻」
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(() => {
    // 根据当前路径，初始只挂载当前 tab
    const currentTab = getTabKey(location.pathname);
    return new Set([currentTab]);
  });

  const activeTab = getTabKey(location.pathname);

  // 路由变化时标记 tab 为已访问
  useEffect(() => {
    setMountedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  // 监听路由变化，点击社区页面后隐藏红点
  useEffect(() => {
    if (activeTab === "community") {
      setShowUnreadBadge(false);
    }
  }, [activeTab]);

  // 触摸开始时立即预加载页面，提升响应速度
  const handleTouchStart = (path: string) => {
    const preload = preloadMap[path];
    if (preload) {
      preload();
    }
  };

  const navItems = [
    { path: "/home", icon: Home, label: t.common.home },
    { path: "/home/market", icon: BookOpen, label: t.common.market },
    { path: "/home/community", icon: MessageCircle, label: t.common.community, showBadge: showUnreadBadge },
    { path: "/home/profile", icon: User, label: t.common.profile },
  ];

  // Tab 页面配置
  const tabPages = [
    { key: "home", Component: HomePage, Skeleton: HomePageSkeleton },
    { key: "market", Component: MarketPage, Skeleton: MarketPageSkeleton },
    { key: "community", Component: CommunityPage, Skeleton: CommunityPageSkeleton },
    { key: "profile", Component: ProfilePage, Skeleton: ProfilePageSkeleton },
  ] as const;

  return (
    <div className="h-full w-full flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--app-bg)' }}>
      {/* 状态栏占位 — standalone 模式下用 safe-area-inset-top 撇开 */}
      <div className="bg-emerald-600 safe-top flex-shrink-0" />

      {/* 主内容 — Keep-alive: 所有已访问 tab 同时存在 DOM 中，用 display 切换 */}
      <main className="flex-1 overflow-hidden relative">
        {tabPages.map(({ key, Component, Skeleton }) => {
          const isActive = activeTab === key;
          const isMounted = mountedTabs.has(key);
          if (!isMounted) return null;
          return (
            <div
              key={key}
              className="absolute inset-0 overflow-y-auto overflow-x-hidden"
              style={{ display: isActive ? "block" : "none" }}
            >
              <Suspense fallback={<Skeleton />}>
                <Component />
              </Suspense>
            </div>
          );
        })}
      </main>

      {/* 底部导航 */}
      <nav
        className="flex-shrink-0 bg-white/95 backdrop-blur-md border-t border-gray-100 safe-bottom"
        style={{ boxShadow: '0 -1px 12px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-end pt-1.5 pb-1 px-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex flex-col items-center justify-center relative flex-1 min-w-0 max-w-[25%] py-1 select-none"
                onTouchStart={() => handleTouchStart(item.path)}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {/* 激活态胶囊背景 — layoutId 实现跨 tab 滑动跟随 */}
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-x-1.5 inset-y-0 bg-emerald-50 rounded-2xl -z-10"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}

                {/* 图标 - 纯变色，无弹跳 */}
                <div className="relative">
                  <Icon
                    className="w-[22px] h-[22px] transition-colors duration-200"
                    style={{ color: isActive ? '#059669' : '#9ca3af' }}
                    strokeWidth={isActive ? 2 : 1.8}
                  />

                  {/* 未读消息红点 - 带脉冲 */}
                  {item.showBadge && (
                    <span className="absolute -top-0.5 -right-1.5 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 ring-2 ring-white" />
                    </span>
                  )}
                </div>

                {/* 文字标签 */}
                <span
                  className="text-[10px] mt-0.5 w-full text-center truncate leading-tight px-0.5 transition-colors duration-200"
                  style={{
                    color: isActive ? '#059669' : '#9ca3af',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {item.label}
                </span>

                {/* 激活态底部小圆点 — 同样用 layoutId 跨 tab 滑动 */}
                {isActive && (
                  <motion.div
                    layoutId="nav-dot"
                    className="w-1 h-1 rounded-full bg-emerald-500 mt-0.5"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/** 从 pathname 提取 tab key */
function getTabKey(pathname: string): string {
  if (pathname.startsWith("/home/market")) return "market";
  if (pathname.startsWith("/home/community")) return "community";
  if (pathname.startsWith("/home/profile")) return "profile";
  return "home";
}