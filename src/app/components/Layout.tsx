import { Link, useLocation } from "react-router";
import { useNetworkQuality } from "../hooks/useNetworkQuality";
import { useDynamicManifest } from "../hooks/useDynamicManifest";
import { Home, BookOpen, MessageCircle, User } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { useState, useEffect, lazy, Suspense, useMemo, useRef } from "react";
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

// Tab key 到 index 的映射（用于胶囊滑动动画 translateX 计算）
const TAB_KEYS = ["home", "market", "community", "profile"] as const;

export function Layout() {
  const location = useLocation();
  const { t } = useLanguage();
  const networkQuality = useNetworkQuality();
  useDynamicManifest();
  
  // 未读消息红点状态
  const [showUnreadBadge, setShowUnreadBadge] = useState(true);

  // 记录已访问过的 tab，实现「首次访问才懒加载，之后常驻」
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(() => {
    const currentTab = getTabKey(location.pathname);
    return new Set([currentTab]);
  });

  const activeTab = getTabKey(location.pathname);
  const activeIndex = TAB_KEYS.indexOf(activeTab as typeof TAB_KEYS[number]);

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

  // 胶囊滑动样式 — 纯 CSS transition 替代 motion layoutId，省 ~30KB
  const pillStyle = useMemo(() => ({
    transform: `translateX(${activeIndex * 100}%)`,
    width: `${100 / TAB_KEYS.length}%`,
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  }), [activeIndex]);



  // 根据网络质量决定是否用 backdrop-blur
  const navBgClass = networkQuality.disableBlur
    ? "bg-white border-t border-gray-100"
    : "bg-white/95 backdrop-blur-md border-t border-gray-100";

  return (
    <div
      className="fixed top-0 left-0 right-0 flex flex-col overflow-hidden"
      style={{
        backgroundColor: 'var(--app-bg)',
        height: 'var(--app-height, 100vh)',
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
          return (
            <div
              key={key}
              className="absolute inset-0 overflow-y-auto overflow-x-hidden"
              style={{
                display: isActive ? "block" : "none",
                animation: isActive && fadeKey > 0 ? `tab-fade-in 180ms ease-out` : undefined,
              }}
            >
              <Suspense fallback={<Skeleton />}>
                <Component />
              </Suspense>
            </div>
          );
        })}
      </main>

      {/* 底部导航 — flex 子元素，自然贴底，避免 iOS fixed bottom 视口偏移 */}
      <nav
        className={`flex-shrink-0 z-40 ${navBgClass} safe-bottom`}
        style={{ boxShadow: '0 -1px 12px rgba(0,0,0,0.06)' }}
      >
        <div className="relative">
          {/* 滑动胶囊背景 — 纯 CSS transition 替代 motion/react layoutId */}
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={pillStyle}
          >
            <div className="mx-1.5 h-full bg-emerald-50 rounded-2xl" />
          </div>

          <div className="flex items-center pt-1 pb-0.5 px-1 relative">
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

                  {/* 激活态小圆点 - 内联在各 tab 项下方 */}
                  <div
                    className="w-1 h-1 rounded-full mt-0.5 transition-colors duration-200"
                    style={{ backgroundColor: isActive ? '#059669' : 'transparent' }}
                  />
                </Link>
              );
            })}
          </div>


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