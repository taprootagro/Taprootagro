import { createBrowserRouter } from "react-router";
import { lazy, Suspense } from "react";
import { Root } from "./components/Root";
import { Layout } from "./components/Layout";
import { SplashScreen } from "./components/SplashScreen";
import { 
  SkeletonScreen,
  HomePageSkeleton, 
  MarketPageSkeleton, 
  CommunityPageSkeleton, 
  ProfilePageSkeleton 
} from "./components/SkeletonScreen";

// 懒加载页面组件 - 按需加载，减少首次加载体积
const HomePage = lazy(() => import("./components/HomePage"));
const MarketPage = lazy(() => import("./components/MarketPage"));
const CommunityPage = lazy(() => import("./components/CommunityPage"));
const ProfilePage = lazy(() => import("./components/ProfilePage"));
const SettingsPage = lazy(() => import("./components/SettingsPage"));
const LoginPage = lazy(() => import("./components/LoginPage"));
const ConfigManagerPage = lazy(() => import("./components/ConfigManagerPage"));

// 预加载函数 - 在首页加载完成后预加载其他主要页面，提升切换速度
export function preloadMainPages() {
  // 使用 requestIdleCallback 在浏览器空闲时预加载，不影响主线程性能
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      import("./components/MarketPage");
      import("./components/CommunityPage");
      import("./components/ProfilePage");
    });
  } else {
    // 降级方案：使用 setTimeout
    setTimeout(() => {
      import("./components/MarketPage");
      import("./components/CommunityPage");
      import("./components/ProfilePage");
    }, 1000);
  }
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      {
        index: true,
        Component: SplashScreen,
      },
      {
        path: "login",
        element: (
          <Suspense fallback={<SkeletonScreen />}>
            <LoginPage />
          </Suspense>
        ),
      },
      {
        path: "home",
        Component: Layout,
        children: [
          { 
            index: true, 
            element: (
              <Suspense fallback={<HomePageSkeleton />}>
                <HomePage />
              </Suspense>
            )
          },
          { 
            path: "market", 
            element: (
              <Suspense fallback={<MarketPageSkeleton />}>
                <MarketPage />
              </Suspense>
            )
          },
          { 
            path: "community", 
            element: (
              <Suspense fallback={<CommunityPageSkeleton />}>
                <CommunityPage />
              </Suspense>
            )
          },
          { 
            path: "profile", 
            element: (
              <Suspense fallback={<ProfilePageSkeleton />}>
                <ProfilePage />
              </Suspense>
            )
          },
        ],
      },
      {
        path: "settings",
        element: (
          <Suspense fallback={<SkeletonScreen />}>
            <SettingsPage />
          </Suspense>
        ),
      },
      {
        path: "config-manager",
        element: (
          <Suspense fallback={<SkeletonScreen />}>
            <ConfigManagerPage />
          </Suspense>
        ),
      },
    ],
  },
]);