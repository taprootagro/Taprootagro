import { SecondaryView } from "./SecondaryView";
import { useLanguage } from "../hooks/useLanguage";
import { useHomeConfig } from "../hooks/useHomeConfig";

interface AboutUsPageProps {
  onClose: () => void;
}

export function AboutUsPage({ onClose }: AboutUsPageProps) {
  const { t } = useLanguage();
  const { config } = useHomeConfig();

  return (
    <SecondaryView 
      onClose={onClose} 
      title={t.profile.aboutUs}
      showTitle={true}
    >
      <div className="p-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {config?.aboutUs?.content || "暂无内容"}
          </div>
        </div>
      </div>
    </SecondaryView>
  );
}