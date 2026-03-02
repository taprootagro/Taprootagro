import { Link, useLocation } from "react-router";
import { useNetworkQuality } from "../hooks/useNetworkQuality";
import { useDynamicManifest } from "../hooks/useDynamicManifest";
import { useKeyboardVisible } from "../hooks/useKeyboardVisible";
import { Home, NotebookText, MessageCircle, User } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { useState, useEffect, lazy, Suspense, useRef } from "react";
import {
  HomePageSkeleton,
  MarketPageSkeleton,
  CommunityPageSkeleton,
  ProfilePageSkeleton,
} from "./SkeletonScreen";
import { PWAInstallBanner } from "./PWAInstallBanner";

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

// Tab key 到 index 的映射
const TAB_KEYS = ["home", "market", "community", "profile"] as const;

export function Layout() {
  const location = useLocation();
  const { t } = useLanguage();
  const networkQuality = useNetworkQuality();
  useDynamicManifest();
  const keyboardVisible = useKeyboardVisible();
  
  // 未读消息红点状态
  const [showUnreadBadge, setShowUnreadBadge] = useState(true);

  // 记录已访问过的 tab，实现「首次访问才懒加载，之后常驻」
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(() => {
    const currentTab = getTabKey(location.pathname);
    return new Set([currentTab]);
  });

  const activeTab = getTabKey(location.pathname);

  // Tab 切换淡入动画：追踪切换计数，用 CSS animation 触发
  const switchCountRef = useRef(0);
  const prevTabRef = useRef(activeTab);
  const [fadeKey, setFadeKey] = useState(0);

  useEffect(() => {
    if (prevTabRef.current !== activeTab) {
      prevTabRef.current = activeTab;
      switchCountRef.current += 1;
      setFadeKey(switchCountRef.current);
    }
  }, [activeTab]);

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
    { path: "/home/market", icon: NotebookText, label: t.common.market },
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

  // 根据网络质量决定是否用 backdrop-blur
  const navBgClass = networkQuality.disableBlur
    ? "bg-white border-t border-gray-100"
    : "bg-white/95 backdrop-blur-md border-t border-gray-100";

  return (
    <div
      className="fixed top-0 left-0 right-0 flex flex-col overflow-hidden"
      style={{
        backgroundColor: 'var(--app-bg)',
        /* 三层回退：JS精确值 → 100dvh(动态视口，排除工具栏) → 100vh(兜底) */
        height: 'var(--app-height, 100dvh)',
      }}
    >
      {/* 状态栏占位 — standalone 模式下用 safe-area-inset-top 撇开 */}
      <div className="bg-emerald-600 safe-top flex-shrink-0" />

      {/* 主内容 — Keep-alive: 所有已访问 tab 同时存在 DOM 中，用 display 切换 */}
      <main className="flex-1 overflow-hidden relative">
        {tabPages.map(({ key, Component, Skeleton }) => {
          const isActive = activeTab === key;
          const isMounted = mountedTabs.has(key);
          if (!isMounted) return null;
          // community 页面有自己的内部滚动，外层用 overflow-hidden
          // 防止 iOS 聚焦 input 时滚动外层容器导致页面跳顶
          const overflowClass = key === "community"
            ? "absolute inset-0 overflow-hidden"
            : "absolute inset-0 overflow-y-auto overflow-x-hidden";
          return (
            <div
              key={key}
              className={overflowClass}
              style={{
                display: isActive ? "block" : "none",
              }}
            >
              <Suspense fallback={<Skeleton />}>
                <Component />
              </Suspense>
            </div>
          );
        })}
      </main>

      {/* 底部导航 — 键盘弹出时隐藏，让聊天输入栏紧贴键盘 */}
      {!keyboardVisible && (
      <nav
        className={`flex-shrink-0 z-40 ${navBgClass} safe-bottom`}
        style={{ boxShadow: '0 -1px 12px rgba(0,0,0,0.06)' }}
      >
        <div className="relative">
          <div className="flex items-center px-1 relative">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center justify-center relative flex-1 min-w-0 max-w-[25%] pt-2.5 pb-1.5 select-none"
                  onTouchStart={() => handleTouchStart(item.path)}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {/* 图标 - 放大，无文字 */}
                  <div className="relative">
                    <Icon
                      className="w-7 h-7 transition-colors duration-200"
                      style={{ color: isActive ? '#059669' : '#9ca3af' }}
                      strokeWidth={isActive ? 2.2 : 1.8}
                    />

                    {/* 未读消息红点 - 带脉冲 */}
                    {item.showBadge && (
                      <span className="absolute -top-0.5 -right-1.5 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 ring-2 ring-white" />
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>


        </div>
      </nav>
      )}
      <PWAInstallBanner />
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