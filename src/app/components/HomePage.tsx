import { Search, ScanLine, Bot, Calculator } from "lucide-react";
import Slider from "react-slick";
import { usePerformanceMonitor } from "../hooks/usePerformanceMonitor";
import { useLanguage } from "../hooks/useLanguage";
import { useState, useEffect } from "react";
import { CameraCapture } from "./CameraCapture";
import { BannerDetailPage } from "./BannerDetailPage";
import { AIAssistantPage } from "./AIAssistantPage";
import { StatementPage } from "./StatementPage";
import { LiveDetailPage } from "./LiveDetailPage";
import { ArticleDetailPage } from "./ArticleDetailPage";
import { VideoFeedPage } from "./VideoFeedPage";
import { preloadMainPages } from "../routes";
import { useHomeConfig } from "../hooks/useHomeConfig";

export function HomePage() {
  // 性能监控
  usePerformanceMonitor("首页");
  const { t } = useLanguage();
  const { config } = useHomeConfig(); // 从配置读取数据
  const [showCamera, setShowCamera] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  
  // 预加载其他主要页面，提升底部导航切换速度
  useEffect(() => {
    preloadMainPages();
  }, []);

  // 二级界面状态管理
  const [currentView, setCurrentView] = useState<
    | { type: "home" }
    | { type: "banner"; index: number; data: any }
    | { type: "aiAssistant" }
    | { type: "statement" }
    | { type: "live" }
    | { type: "videoFeed" }
    | { type: "article"; data: any }
  >({ type: "home" });

  // 从配置读取数据
  const articles = config?.articles || [];
  const bannerImages = config?.banners || [];

  // 轮播配置
  const sliderSettings = {
    dots: true,
    infinite: true,
    speed: 800,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 5000,
    fade: true,
    cssEase: 'ease-in-out',
    arrows: false,
    pauseOnHover: true,
  };

  // 预加载图片
  useEffect(() => {
    const imagePromises = bannerImages.map((image) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = image.url;
      });
    });

    Promise.all(imagePromises).then(() => {
      setImagesLoaded(true);
    });
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--app-bg)' }}>
      {/* 二级界面路由 */}
      {currentView.type === "banner" && (
        <BannerDetailPage
          onClose={() => setCurrentView({ type: "home" })}
          bannerIndex={currentView.index}
          bannerData={currentView.data}
        />
      )}
      {currentView.type === "aiAssistant" && (
        <AIAssistantPage onClose={() => setCurrentView({ type: "home" })} />
      )}
      {currentView.type === "statement" && (
        <StatementPage onClose={() => setCurrentView({ type: "home" })} />
      )}
      {currentView.type === "live" && (
        <LiveDetailPage 
          onClose={() => setCurrentView({ type: "home" })}
          onOpenVideoFeed={() => setCurrentView({ type: "videoFeed" })}
        />
      )}
      {currentView.type === "videoFeed" && (
        <VideoFeedPage onClose={() => setCurrentView({ type: "home" })} />
      )}
      {currentView.type === "article" && (
        <ArticleDetailPage
          onClose={() => setCurrentView({ type: "home" })}
          article={currentView.data}
        />
      )}

      {/* 首页内容 */}
      {currentView.type === "home" && (
        <>
          {/* 相机捕获界面 */}
          {showCamera && (
            <CameraCapture
              onCapture={(imageData) => {
                console.log("拍摄的图片:", imageData);
              }}
              onClose={() => setShowCamera(false)}
            />
          )}

          {/* 搜索栏 */}
          <div className="bg-emerald-600 px-3 py-1.5 sticky top-0 z-10 shadow-md">
            <div className="flex gap-2 items-center max-w-screen-xl mx-auto">
              <div className="flex-1 min-w-0 bg-white rounded-full px-3 py-1.5 flex items-center gap-2 transition-all duration-300 focus-within:ring-2 focus-within:ring-emerald-300 focus-within:shadow-lg h-10">
                <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder={t.home.searchPlaceholder}
                  className="flex-1 min-w-0 outline-none text-xs placeholder:text-gray-400"
                />
              </div>
              <button 
                onClick={() => setShowCamera(true)}
                className="bg-white w-10 h-10 rounded-full active:scale-95 transition-all duration-200 flex items-center justify-center flex-shrink-0 shadow-sm"
              >
                <ScanLine className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          {/* 主内容区域 - 增加底部内边距避免被底部导航遮挡 */}
          <div className="px-3 space-y-3 max-w-screen-xl mx-auto pb-32">
            {/* 轮播图 */}
            <div 
              className="mt-3 rounded-2xl overflow-hidden banner-slider active:scale-95 transition-transform cursor-pointer aspect-[2/1] shadow-lg"
            >
              <Slider {...sliderSettings}>
                {bannerImages.map((image, index) => (
                  <div 
                    key={image.id} 
                    className="slider-item"
                    onClick={() => {
                      setCurrentView({ type: "banner", index, data: image });
                    }}
                  >
                    <img
                      src={image.url}
                      alt={image.alt}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </Slider>
            </div>

            {/* AI助手和对账单 */}
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setCurrentView({ type: "aiAssistant" })}
                className="bg-white rounded-2xl p-4 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg aspect-square"
              >
                <Bot className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-600" />
                <span className="text-sm text-gray-800 font-medium">{t.home.aiAssistant}</span>
              </button>
              <button 
                onClick={() => setCurrentView({ type: "statement" })}
                className="bg-white rounded-2xl p-4 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg aspect-square"
              >
                <Calculator className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-600" />
                <span className="text-sm text-gray-800 font-medium">{t.home.statement}</span>
              </button>
            </div>

            {/* 直播区域 */}
            <button 
              onClick={() => setCurrentView({ type: "videoFeed" })}
              className="w-full aspect-[2/1] rounded-2xl overflow-hidden relative active:scale-95 transition-transform shadow-lg"
            >
              {config.liveStreams?.[0]?.thumbnail ? (
                <img
                  src={config.liveStreams[0].thumbnail}
                  alt={config.liveStreams[0].title || t.home.agriVideos}
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src="https://images.unsplash.com/photo-1625246333195-78d9c38ad449?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYXJtZXIlMjBwbGFudGluZyUyMGNyb3BzJTIwZmllbGR8ZW58MXx8fHwxNzcwODIxNDEzfDA&ixlib=rb-4.1.0&q=80&w=1080"
                  alt="农短视频"
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute top-2 ltr:left-2 rtl:right-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                {t.home.liveNavigation}
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-left">
                <h3 className="text-white font-medium text-sm">{config.liveStreams?.[0]?.title || t.home.agriVideos}</h3>
              </div>
            </button>

            {/* 文章列表 */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-100">
              <div className="divide-y divide-gray-100">
                {articles.map((article) => (
                  <button
                    key={article.id}
                    onClick={() => setCurrentView({ type: "article", data: article })}
                    className="w-full px-3 py-3 text-left active:bg-emerald-100 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="flex-1 text-gray-900 text-sm sm:text-base line-clamp-2 min-w-0">
                        {article.title}
                      </h3>
                      {article.thumbnail ? (
                        <img 
                          src={article.thumbnail} 
                          alt={article.title}
                          className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-xl flex-shrink-0 object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-xl flex-shrink-0"></div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ICP备案和公安备案号 - 极简样式 */}
            {(config?.filing?.icpNumber || config?.filing?.policeNumber) && (
            <div className="bg-gray-50 rounded-lg border border-gray-200">
              <div className="px-3 py-2 space-y-1">
                <p className="text-xs text-gray-500">{t.home.filingNo}</p>
                {config?.filing?.icpNumber && (
                <a 
                  href={config?.filing?.icpUrl || "https://beian.miit.gov.cn/"} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block text-[10px] text-gray-400 active:text-emerald-600"
                >
                  {config.filing.icpNumber}
                </a>
                )}
                {config?.filing?.policeNumber && (
                <a 
                  href={config?.filing?.policeUrl || "http://www.beian.gov.cn/portal/registerSystemInfo"} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block text-[10px] text-gray-400 active:text-emerald-600"
                >
                  {config.filing.policeNumber}
                </a>
                )}
              </div>
            </div>
            )}
          </div>
        </>
      )}

      {/* Slick Carousel 样式 */}
      <style>{`
        /* Slick Slider 基础样式 */
        .banner-slider {
          background: #f3f4f6;
          position: relative;
        }
        .banner-slider .slick-slider {
          position: relative;
          display: block;
          box-sizing: border-box;
          user-select: none;
          touch-action: pan-y;
          height: 100%;
        }
        .banner-slider .slick-list {
          position: relative;
          display: block;
          overflow: hidden;
          margin: 0;
          padding: 0;
          height: 100%;
          background: #f3f4f6;
        }
        .banner-slider .slick-list:focus {
          outline: none;
        }
        .banner-slider .slick-list.dragging {
          cursor: pointer;
        }
        .banner-slider .slick-slider .slick-track,
        .banner-slider .slick-slider .slick-list {
          transform: translate3d(0, 0, 0);
        }
        .banner-slider .slick-track {
          position: relative;
          top: 0;
          left: 0;
          display: block;
          margin-left: auto;
          margin-right: auto;
          height: 100%;
        }
        .banner-slider .slick-track:before,
        .banner-slider .slick-track:after {
          display: table;
          content: '';
        }
        .banner-slider .slick-track:after {
          clear: both;
        }
        .banner-slider .slick-loading .slick-track {
          visibility: hidden;
        }
        .banner-slider .slick-slide {
          display: none;
          float: left;
          height: 100%;
          min-height: 1px;
        }
        .banner-slider .slick-slide > div {
          height: 100%;
        }
        .banner-slider .slider-item {
          height: 100%;
          display: block !important;
        }
        .banner-slider .slick-slide img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .banner-slider .slick-slide.slick-loading img {
          display: none;
        }
        .banner-slider .slick-slide.dragging img {
          pointer-events: none;
        }
        .banner-slider .slick-initialized .slick-slide {
          display: block;
        }
        .banner-slider .slick-loading .slick-slide {
          visibility: hidden;
        }
        .banner-slider .slick-vertical .slick-slide {
          display: block;
          height: auto;
          border: none;
        }
        
        /* Dots 指示点样式 */
        .banner-slider .slick-dots {
          position: absolute;
          bottom: 10px;
          display: block;
          width: 100%;
          padding: 0;
          margin: 0;
          list-style: none;
          text-align: center;
          z-index: 10;
        }
        .banner-slider .slick-dots li {
          position: relative;
          display: inline-block;
          width: 20px;
          height: 20px;
          margin: 0 3px;
          padding: 0;
          cursor: pointer;
        }
        .banner-slider .slick-dots li button {
          font-size: 0;
          line-height: 0;
          display: block;
          width: 20px;
          height: 20px;
          padding: 5px;
          cursor: pointer;
          color: transparent;
          border: 0;
          outline: none;
          background: transparent;
        }
        .banner-slider .slick-dots li button:before {
          font-size: 8px;
          line-height: 20px;
          position: absolute;
          top: 0;
          left: 0;
          width: 20px;
          height: 20px;
          content: '•';
          text-align: center;
          color: white;
          opacity: 0.5;
        }
        .banner-slider .slick-dots li.slick-active button:before {
          opacity: 1;
          color: white;
        }
      `}</style>
    </div>
  );
}

// 认导出用于懒加载
export default HomePage;