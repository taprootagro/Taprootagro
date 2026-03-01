import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { useHomeConfig } from "../hooks/useHomeConfig";

/**
 * SplashScreen — 智能计时启动屏
 * 
 * 改进：不再硬编码 2 秒等待。
 * 策略：最短 800ms（品牌曝光） + 首张 banner 预加载完成 → 立即跳转
 * 回访用户（SW 缓存命中）几乎 0 网络延迟，800ms 后就跳转。
 * 弱网首次用户在 banner 加载完成后跳转，最长等 4 秒兜底。
 * 
 * 退场动画：scale(1) → scale(1.04) + opacity → 0，200ms ease-in，
 * 动画结束后再执行 navigate，视觉上无缝衔接。
 */
export function SplashScreen() {
  const navigate = useNavigate();
  const { config } = useHomeConfig();
  const [minTimePassed, setMinTimePassed] = useState(false);
  const [resourceReady, setResourceReady] = useState(false);
  const [exiting, setExiting] = useState(false);

  // 最短展示 800ms（品牌曝光时间）
  useEffect(() => {
    const timer = setTimeout(() => setMinTimePassed(true), 800);
    return () => clearTimeout(timer);
  }, []);

  // 预加载首张 banner 图片（如有）
  useEffect(() => {
    const firstBanner = config?.banners?.[0]?.url;
    if (!firstBanner) {
      setResourceReady(true);
      return;
    }

    const img = new Image();
    img.onload = () => setResourceReady(true);
    img.onerror = () => setResourceReady(true); // 加载失败也继续
    img.src = firstBanner;

    // 兜底：最长等 4 秒，无论资源是否 ready
    const maxTimer = setTimeout(() => setResourceReady(true), 4000);
    return () => clearTimeout(maxTimer);
  }, [config?.banners]);

  // 两个条件都满足时触发退场动画
  useEffect(() => {
    if (minTimePassed && resourceReady && !exiting) {
      setExiting(true);
    }
  }, [minTimePassed, resourceReady, exiting]);

  // 退场动画结束后跳转
  const handleAnimationEnd = useCallback(() => {
    if (exiting) {
      navigate("/home", { replace: true });
    }
  }, [exiting, navigate]);

  return (
    <div
      className="min-h-full bg-white flex flex-col items-center justify-center px-[5vw] relative overflow-hidden fixed inset-0"
      style={{
        animation: exiting ? 'splash-exit 200ms ease-in forwards' : undefined,
        willChange: exiting ? 'transform, opacity' : 'auto',
      }}
      onAnimationEnd={handleAnimationEnd}
    >
      {/* 状态栏绿色占位 — 与 Layout 一致，确保 standalone 下状态栏文字可见 */}
      <div className="bg-emerald-600 safe-top fixed top-0 left-0 right-0 z-50" />

      {/* Logo */}
      <div 
        className="bg-white rounded-3xl flex items-center justify-center mb-[4vh] shadow-xl overflow-hidden"
        style={{ 
          width: 'clamp(140px, 32vw, 180px)', 
          height: 'clamp(140px, 32vw, 180px)',
          borderRadius: 'clamp(24px, 7vw, 36px)'
        }}
      >
        {config?.appBranding?.logoUrl ? (
          <img 
            src={config.appBranding.logoUrl} 
            alt="Logo"
            className="w-full h-full object-cover"
          />
        ) : (
          <span 
            className="text-emerald-600 font-bold"
            style={{ fontSize: 'clamp(60px, 16vw, 90px)' }}
          >
            农
          </span>
        )}
      </div>
      
      {/* Slogan */}
      <h1 
        className="text-gray-900 font-bold text-center mb-[1vh]"
        style={{ fontSize: 'clamp(20px, 6vw, 32px)' }}
      >
        {config?.appBranding?.appName || "TaprootAgro"}
      </h1>
      <p 
        className="text-gray-500 text-center leading-relaxed max-w-[90vw] whitespace-nowrap"
        style={{ fontSize: 'clamp(10px, 2.8vw, 14px)' }}
      >
        {config?.appBranding?.slogan || "To be the taproot of smart agro."}
      </p>

      {/* 加载动画指示器 */}
      <div className="mt-[8vh]">
        <div className="flex gap-[1vw]">
          <div 
            className="bg-emerald-600 rounded-full animate-bounce"
            style={{ 
              width: 'clamp(8px, 2.5vw, 12px)', 
              height: 'clamp(8px, 2.5vw, 12px)',
              animationDelay: '0ms'
            }}
          ></div>
          <div 
            className="bg-emerald-600 rounded-full animate-bounce"
            style={{ 
              width: 'clamp(8px, 2.5vw, 12px)', 
              height: 'clamp(8px, 2.5vw, 12px)',
              animationDelay: '150ms'
            }}
          ></div>
          <div 
            className="bg-emerald-600 rounded-full animate-bounce"
            style={{ 
              width: 'clamp(8px, 2.5vw, 12px)', 
              height: 'clamp(8px, 2.5vw, 12px)',
              animationDelay: '300ms'
            }}
          ></div>
        </div>
      </div>
    </div>
  );
}