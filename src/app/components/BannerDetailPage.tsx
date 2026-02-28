import { SecondaryView } from "./SecondaryView";
import { Shield } from "lucide-react";
import { useHomeConfig } from "../hooks/useHomeConfig";
import type { BannerConfig } from "../hooks/useHomeConfig";

interface BannerDetailPageProps {
  onClose: () => void;
  bannerIndex: number;
  bannerData?: BannerConfig;
}

export function BannerDetailPage({ onClose, bannerIndex, bannerData }: BannerDetailPageProps) {
  // 从配置中读取最新的数据，确保编辑后能实时显示
  const { config } = useHomeConfig();
  const latestBanner = bannerData?.id 
    ? config.banners.find(b => b.id === bannerData.id) || bannerData 
    : bannerData;

  return (
    <SecondaryView 
      onClose={onClose} 
      title={latestBanner?.title || `安全守护 ${bannerIndex + 1}`}
      showTitle={true}
    >
      <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--app-bg)' }}>
        {/* 顶部大图 */}
        {latestBanner?.url && (
          <div className="w-full">
            <img 
              src={latestBanner.url} 
              alt={latestBanner.alt || latestBanner.title || "安全守护"} 
              className="w-full aspect-[2/1] object-cover"
            />
          </div>
        )}

        {/* 内容区 */}
        <div className="px-4 py-4 space-y-4">
          {/* 标题卡片 */}
          <div className="bg-white rounded-2xl p-4 shadow">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span className="text-xs text-emerald-600 font-medium">安全守护</span>
            </div>
            <h2 className="text-gray-800 text-lg">
              {latestBanner?.title || `安全守护详情 ${bannerIndex + 1}`}
            </h2>
            {latestBanner?.alt && (
              <p className="text-gray-500 text-xs mt-1">{latestBanner.alt}</p>
            )}
          </div>

          {/* 详细内容 */}
          {latestBanner?.content && (
            <div className="bg-white rounded-2xl p-4 shadow">
              <div className="text-gray-700 text-sm whitespace-pre-wrap">
                {latestBanner.content}
              </div>
            </div>
          )}

          {/* 无内容提示 */}
          {!latestBanner?.content && (
            <div className="bg-white rounded-2xl p-6 shadow text-center">
              <Shield className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">暂无详细内容</p>
              <p className="text-gray-300 text-xs mt-1">可在内容管理 → 安全守护中编辑</p>
            </div>
          )}
        </div>
      </div>
    </SecondaryView>
  );
}
