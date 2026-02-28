import { useNavigate } from "react-router";
import { ArrowLeft, Bell, RefreshCw, Shield, Globe, Info, ChevronRight, Check, FileText } from "lucide-react";
import { useState } from "react";
import { PushNotifications } from "./PushNotifications";
import { BackgroundSync } from "./BackgroundSync";
import { useLanguage, languages, Language } from "../hooks/useLanguage";
import { SecondaryView } from "./SecondaryView";
import { useHomeConfig } from "../hooks/useHomeConfig";

export function SettingsPage() {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const { config } = useHomeConfig();
  const [showPushSettings, setShowPushSettings] = useState(false);
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTermsOfService, setShowTermsOfService] = useState(false);

  const settingsSections = [
    {
      title: t.settings.advancedFeatures,
      items: [
        {
          icon: Bell,
          label: t.settings.pushNotifications,
          description: t.settings.pushNotificationsDesc,
          color: "text-emerald-600",
          action: () => setShowPushSettings(!showPushSettings),
          expanded: showPushSettings,
        },
        {
          icon: RefreshCw,
          label: t.settings.backgroundSync,
          description: t.settings.backgroundSyncDesc,
          color: "text-blue-600",
          action: () => setShowSyncSettings(!showSyncSettings),
          expanded: showSyncSettings,
        },
        {
          icon: FileText,
          label: t.settings.configManager,
          description: t.settings.configManagerDesc,
          color: "text-purple-600",
          action: () => navigate("/config-manager"),
        },
      ],
    },
    {
      title: t.settings.generalSettings,
      items: [
        {
          icon: Globe,
          label: t.settings.language,
          description: languages[language].nativeName,
          color: "text-purple-600",
          action: () => setShowLanguageSelector(true),
        },
      ],
    },
    {
      title: t.settings.privacy,
      items: [
        {
          icon: Shield,
          label: t.settings.privacyPolicy,
          description: t.settings.privacyPolicyDesc,
          color: "text-orange-600",
          action: () => setShowPrivacyPolicy(true),
        },
        {
          icon: Info,
          label: t.settings.termsOfService,
          description: t.settings.termsOfServiceDesc,
          color: "text-gray-600",
          action: () => setShowTermsOfService(true),
        },
      ],
    },
  ];

  return (
    <div className="pb-4 min-h-screen" style={{ backgroundColor: 'var(--app-bg)' }}>
      {/* 顶部导航栏 */}
      <div className="bg-emerald-600 px-4 pt-12 pb-6 sticky top-0 z-10 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/home/profile")}
            className="text-white active:scale-95 transition-transform duration-150"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold text-white">{t.settings.title}</h1>
        </div>
      </div>

      {/* 设置列表 */}
      <div className="px-4 mt-4 space-y-4">
        {settingsSections.map((section, sectionIndex) => (
          <div key={sectionIndex}>
            {/* 分类标题 */}
            <div className="px-2 mb-2">
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                {section.title}
              </h2>
            </div>

            {/* 设置项卡片 */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              {section.items.map((item, itemIndex) => {
                const Icon = item.icon;
                return (
                  <div key={itemIndex}>
                    <button
                      onClick={item.action}
                      className="w-full px-4 py-3.5 flex items-center justify-between active:bg-emerald-100 transition-colors duration-150"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                          item.expanded ? 'bg-emerald-100 scale-110' : 'bg-gray-50'
                        }`}>
                          <Icon className={`w-5 h-5 ${item.color} transition-transform duration-200 ${item.expanded ? 'scale-110' : ''}`} />
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.label}
                          </p>
                          {item.description && (
                            <p className="text-xs text-gray-500 truncate mt-0.5">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <ChevronRight className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-all duration-200 ${
                        item.expanded ? 'rotate-90 text-emerald-600' : ''
                      }`} />
                    </button>

                    {/* 展开的设置内容 - 添加平滑动画 */}
                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      item.expanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    }`}>
                      <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                        <div className="pt-3">
                          {item.label === t.settings.pushNotifications && <PushNotifications />}
                          {item.label === t.settings.backgroundSync && <BackgroundSync />}
                        </div>
                      </div>
                    </div>

                    {/* 分隔线 */}
                    {itemIndex < section.items.length - 1 && !item.expanded && (
                      <div className="border-t border-gray-100 mx-4"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 语言选择器 - 浮现弹出 */}
      {showLanguageSelector && (
        <SecondaryView 
          title={t.settings.language} 
          onClose={() => setShowLanguageSelector(false)}
          showTitle={true}
        >
          <div className="p-4 space-y-2">
            {/* 语言列表 */}
            {Object.entries(languages).map(([code, info]) => (
              <button
                key={code}
                onClick={() => {
                  setLanguage(code as Language);
                  setTimeout(() => setShowLanguageSelector(false), 300);
                }}
                className={`w-full p-4 rounded-xl flex items-center justify-between transition-all duration-200 ${
                  language === code
                    ? 'bg-emerald-50 border-2 border-emerald-500'
                    : 'bg-white border-2 border-gray-200 active:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="text-left flex-1 min-w-0">
                    <p className={`font-semibold text-sm truncate ${
                      language === code ? 'text-emerald-900' : 'text-gray-900'
                    }`}>
                      {info.nativeName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{info.name}</p>
                  </div>
                </div>
                {language === code && (
                  <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 ml-2" />
                )}
              </button>
            ))}
          </div>
        </SecondaryView>
      )}

      {/* 私政策 - 浮现弹出 */}
      {showPrivacyPolicy && (
        <SecondaryView 
          title={config?.privacyPolicy?.title || t.settings.privacyPolicy} 
          onClose={() => setShowPrivacyPolicy(false)}
          showTitle={true}
        >
          <div className="p-4 pb-8">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="text-sm text-gray-700 leading-relaxed rich-content max-h-[60vh] overflow-y-auto" dangerouslySetInnerHTML={{ __html: config?.privacyPolicy?.content || t.settings.privacyPolicyText }} />
            </div>
          </div>
        </SecondaryView>
      )}

      {/* 服务条款 - 浮现弹出 */}
      {showTermsOfService && (
        <SecondaryView 
          title={config?.termsOfService?.title || t.settings.termsOfService} 
          onClose={() => setShowTermsOfService(false)}
          showTitle={true}
        >
          <div className="p-4 pb-8">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="text-sm text-gray-700 leading-relaxed rich-content max-h-[60vh] overflow-y-auto" dangerouslySetInnerHTML={{ __html: config?.termsOfService?.content || t.settings.termsOfServiceText }} />
            </div>
          </div>
        </SecondaryView>
      )}
    </div>
  );
}

// 默认导出用于懒加载
export default SettingsPage;