import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useHomeConfig } from "../hooks/useHomeConfig";

export function SplashScreen() {
  const navigate = useNavigate();
  const { config } = useHomeConfig();

  useEffect(() => {
    // 2秒后自动跳转到首页
    const timer = setTimeout(() => {
      navigate("/home");
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-full bg-white flex flex-col items-center justify-center px-[5vw] relative overflow-hidden">
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