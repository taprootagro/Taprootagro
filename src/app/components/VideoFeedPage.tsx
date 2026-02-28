import { useState, useRef, useEffect, useCallback } from "react";
import { X, Heart, MessageCircle, Share2, MapPin, Play, Loader2 } from "lucide-react";
import { useHomeConfig } from "../hooks/useHomeConfig";

interface VideoFeedPageProps {
  onClose: () => void;
}

// 使用小体积的示例视频（几MB而非几百MB）
const defaultVideoUrls = [
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
];

export function VideoFeedPage({ onClose }: VideoFeedPageProps) {
  const { config } = useHomeConfig();
  const liveStreams = config.liveStreams || [];

  // 从配置生成视频列表
  const videos = liveStreams.length > 0
    ? liveStreams.map((stream, index) => ({
        id: stream.id,
        url: stream.videoUrl || defaultVideoUrls[index % defaultVideoUrls.length],
        title: stream.title,
        thumbnail: stream.thumbnail,
        viewers: stream.viewers,
      }))
    : defaultVideoUrls.slice(0, 3).map((url, index) => ({
        id: index + 1,
        url,
        title: `示例视频 ${index + 1}`,
        thumbnail: "",
        viewers: "0",
      }));

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [likedVideos, setLikedVideos] = useState<Set<number>>(new Set());
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [showHint, setShowHint] = useState(true);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [loadingStates, setLoadingStates] = useState<Record<number, boolean>>({});
  const [errorStates, setErrorStates] = useState<Record<number, boolean>>({});
  
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 标记视频加载状态
  const handleVideoCanPlay = useCallback((index: number) => {
    setLoadingStates(prev => ({ ...prev, [index]: false }));
  }, []);

  const handleVideoWaiting = useCallback((index: number) => {
    setLoadingStates(prev => ({ ...prev, [index]: true }));
  }, []);

  const handleVideoError = useCallback((index: number) => {
    setErrorStates(prev => ({ ...prev, [index]: true }));
    setLoadingStates(prev => ({ ...prev, [index]: false }));
  }, []);

  // 自动播放当前视频
  useEffect(() => {
    const currentVideo = videoRefs.current[currentIndex];
    if (currentVideo) {
      // 初始设为加载中
      setLoadingStates(prev => ({ ...prev, [currentIndex]: true }));
      
      // 暂停所有其他视频
      videoRefs.current.forEach((video, index) => {
        if (video && index !== currentIndex) {
          video.pause();
          video.currentTime = 0;
        }
      });

      // 播放当前视频
      if (isPlaying) {
        currentVideo.play().then(() => {
          setLoadingStates(prev => ({ ...prev, [currentIndex]: false }));
        }).catch(() => {
          setIsPlaying(false);
          setLoadingStates(prev => ({ ...prev, [currentIndex]: false }));
        });
      } else {
        setLoadingStates(prev => ({ ...prev, [currentIndex]: false }));
      }
    }
  }, [currentIndex, isPlaying]);

  // 隐藏提示
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  // 处理触摸
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentTouch = e.targetTouches[0].clientY;
    setDragOffset(currentTouch - touchStart);
    setTouchEnd(currentTouch);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    const diff = touchStart - touchEnd;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        setCurrentIndex(prev => prev < videos.length - 1 ? prev + 1 : 0);
      } else {
        setCurrentIndex(prev => prev > 0 ? prev - 1 : videos.length - 1);
      }
    }
    
    setDragOffset(0);
    setTouchStart(0);
    setTouchEnd(0);
  };

  // 处理滚轮 - 加防抖
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (wheelTimer.current) return;
    
    const threshold = 30;
    if (Math.abs(e.deltaY) > threshold) {
      if (e.deltaY > 0) {
        setCurrentIndex(prev => prev < videos.length - 1 ? prev + 1 : 0);
      } else {
        setCurrentIndex(prev => prev > 0 ? prev - 1 : videos.length - 1);
      }
      wheelTimer.current = setTimeout(() => {
        wheelTimer.current = null;
      }, 500);
    }
  };

  const toggleLike = (videoId: number) => {
    setLikedVideos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) newSet.delete(videoId);
      else newSet.add(videoId);
      return newSet;
    });
  };

  const togglePlay = () => {
    const currentVideo = videoRefs.current[currentIndex];
    if (currentVideo) {
      if (isPlaying) {
        currentVideo.pause();
        setShowPlayIcon(true);
      } else {
        currentVideo.play();
        setShowPlayIcon(false);
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black overflow-hidden flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      {/* 视频容器 */}
      <div className="relative flex-1 w-full overflow-hidden">
        {videos.map((video, index) => {
          const offset = (index - currentIndex) * 100 + (isDragging ? (dragOffset / window.innerHeight) * 100 : 0);
          const isVisible = Math.abs(index - currentIndex) <= 1;
          const isCurrent = index === currentIndex;
          const isLoading = loadingStates[index];
          const hasError = errorStates[index];

          return (
            <div
              key={video.id}
              className="absolute inset-0 w-full h-full transition-all duration-300 ease-out"
              style={{
                transform: `translateY(${offset}%)`,
                opacity: isCurrent ? 1 : 0.3,
                pointerEvents: isCurrent ? "auto" : "none",
              }}
            >
              {isVisible && (
                <div className="relative w-full h-full bg-black">
                  {/* 缩略图背景（视频加载前显示） */}
                  {video.thumbnail && (
                    <img
                      src={video.thumbnail}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover opacity-40 blur-sm"
                    />
                  )}

                  {/* 视频播放器 */}
                  <video
                    ref={(el) => (videoRefs.current[index] = el)}
                    src={video.url}
                    poster={video.thumbnail || undefined}
                    className="relative w-full h-full object-contain z-[1]"
                    loop
                    playsInline
                    muted={isMuted}
                    preload={isVisible ? "auto" : "none"}
                    onClick={togglePlay}
                    onCanPlay={() => handleVideoCanPlay(index)}
                    onWaiting={() => handleVideoWaiting(index)}
                    onError={() => handleVideoError(index)}
                  />

                  {/* 加载指示器 */}
                  {isLoading && isCurrent && !hasError && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-10 h-10 text-white animate-spin" />
                        <span className="text-white/80 text-sm">视频加载中...</span>
                      </div>
                    </div>
                  )}

                  {/* 错误提示 */}
                  {hasError && isCurrent && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                      <div className="flex flex-col items-center gap-3 bg-black/60 backdrop-blur-sm px-6 py-4 rounded-2xl">
                        <Play className="w-10 h-10 text-white/60" />
                        <span className="text-white/80 text-sm">视频加载失败</span>
                        <span className="text-white/50 text-xs">请检查视频URL是否有效</span>
                      </div>
                    </div>
                  )}

                  {/* 暂停指示器 */}
                  {!isPlaying && isCurrent && !isLoading && !hasError && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                      <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center">
                        <Play className="w-10 h-10 text-white ml-1" fill="white" />
                      </div>
                    </div>
                  )}

                  {/* 视频信息和互动区域 */}
                  <div className="absolute bottom-0 left-0 right-0 pb-4 px-4 pt-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-10">
                    <div className="flex items-end gap-3">
                      {/* 左侧信息区 */}
                      <div className="flex-1 space-y-2 min-w-0">
                        <h3 className="text-white font-semibold text-base drop-shadow-lg">
                          {video.title}
                        </h3>
                        <div className="flex items-center gap-2 text-white/80 text-xs">
                          <span>{video.viewers} 观看</span>
                        </div>
                      </div>

                      {/* 右侧互动按钮 */}
                      <div className="flex flex-col items-center gap-4 pb-1 flex-shrink-0">
                        <button
                          onClick={() => toggleLike(video.id)}
                          className="flex flex-col items-center gap-0.5 active:scale-95 transition-transform"
                        >
                          <div className="w-11 h-11 bg-white/25 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
                            <Heart
                              className={`w-5 h-5 transition-all ${
                                likedVideos.has(video.id)
                                  ? "text-red-500 fill-red-500 scale-110"
                                  : "text-white"
                              }`}
                            />
                          </div>
                        </button>

                        <button className="flex flex-col items-center gap-0.5 active:scale-95 transition-transform">
                          <div className="w-11 h-11 bg-white/25 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
                            <MessageCircle className="w-5 h-5 text-white" />
                          </div>
                        </button>

                        <button className="flex flex-col items-center gap-0.5 active:scale-95 transition-transform">
                          <div className="w-11 h-11 bg-white/25 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
                            <Share2 className="w-5 h-5 text-white" />
                          </div>
                          <span className="text-white text-xs drop-shadow-lg font-medium">分享</span>
                        </button>

                        <button
                          onClick={() => alert('一键导航去大田（功能开发中）')}
                          className="flex flex-col items-center gap-0.5 active:scale-95 transition-transform"
                        >
                          <div className="w-11 h-11 bg-emerald-600/95 backdrop-blur-md rounded-full flex items-center justify-center border border-emerald-400/30 shadow-lg">
                            <MapPin className="w-5 h-5 text-white" />
                          </div>
                          <span className="text-white text-xs drop-shadow-lg font-medium">导航</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 滑动提示 */}
                  {currentIndex === 0 && showHint && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20 transition-opacity duration-1000">
                      <div className="bg-black/70 backdrop-blur-md px-6 py-3 rounded-full border border-white/20">
                        <p className="text-white text-sm font-medium">
                          上下滑动查看更多视频
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 进度指示器 */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-20">
        {videos.map((_, index) => (
          <div
            key={index}
            className={`w-1 h-6 rounded-full transition-all duration-300 ${
              index === currentIndex
                ? "bg-emerald-500 shadow-lg"
                : "bg-white/40"
            }`}
          />
        ))}
      </div>

      {/* 底部Dock栏 */}
      <div className="flex-shrink-0 bg-black/80 backdrop-blur-sm border-t border-white/10 z-20">
        <div className="flex justify-center items-center py-2">
          <button
            onClick={onClose}
            className="flex items-center justify-center p-1.5 active:scale-95 transition-transform"
            aria-label="关闭"
          >
            <X className="w-6 h-6 text-red-500" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default VideoFeedPage;