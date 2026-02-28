import { SecondaryView } from "./SecondaryView";
import { Play, Users, Clock, Video } from "lucide-react";
import { useHomeConfig } from "../hooks/useHomeConfig";

interface LiveDetailPageProps {
  onClose: () => void;
  onOpenVideoFeed?: () => void;
}

export function LiveDetailPage({ onClose, onOpenVideoFeed }: LiveDetailPageProps) {
  const { config } = useHomeConfig();
  const liveStreams = config.liveStreams || [];

  // 第一个直播作为"当前直播"，其余作为"往期回放"
  const currentLive = liveStreams[0];
  const pastVideos = liveStreams.slice(1);

  return (
    <SecondaryView 
      onClose={onClose} 
      title="直播与视频"
      showTitle={true}
    >
      <div className="p-4 space-y-4">
        {/* 视频播放入口 - 类似抖音的短视频 */}
        <div 
          onClick={onOpenVideoFeed}
          className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white cursor-pointer active:scale-95 transition-transform shadow-lg"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <Video className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-1">农技短视频</h3>
            </div>
            <Play className="w-6 h-6" fill="white" />
          </div>
        </div>

        {/* 当前直播 */}
        {currentLive && (
          <div className="bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-100">
            <div className="relative aspect-video">
              {currentLive.thumbnail ? (
                <img 
                  src={currentLive.thumbnail}
                  alt={currentLive.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                  <Video className="w-12 h-12 text-gray-400" />
                </div>
              )}
              <div className="absolute top-3 left-3 bg-red-500 text-white px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                直播中
              </div>
              <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5">
                <Users className="w-3 h-3" />
                {currentLive.viewers}
              </div>
            </div>
            <div className="p-4">
              <h3 className="text-gray-800 font-semibold mb-2">{currentLive.title}</h3>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{currentLive.viewers}人观看</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 往期回放 */}
        {pastVideos.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-gray-800 font-semibold text-sm">往期回放</h3>
            
            {pastVideos.map((video) => (
              <div 
                key={video.id}
                className="bg-white rounded-xl overflow-hidden shadow border border-gray-100 active:bg-gray-50 transition-colors"
              >
                <div className="flex gap-3 p-3">
                  <div className="relative w-32 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                    {video.thumbnail ? (
                      <img 
                        src={video.thumbnail}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <Video className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
                        <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-gray-800 text-sm font-medium mb-1 line-clamp-2">
                      {video.title}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{video.viewers} 观看</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 没有直播数据时的提示 */}
        {liveStreams.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Video className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">暂无直播内容</p>
            <p className="text-xs mt-1">请在内容管理中添加直播数据</p>
          </div>
        )}
      </div>
    </SecondaryView>
  );
}