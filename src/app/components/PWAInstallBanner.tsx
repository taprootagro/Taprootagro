import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { Download, X, Share } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';

/**
 * PWA 安装横幅
 * - Android/Chrome：beforeinstallprompt 触发原生安装
 * - iOS/Safari：引导用户通过"分享 → 添加到主屏幕"安装
 */
export function PWAInstallBanner() {
  const { showBanner, platform, triggerInstall, dismiss } = useInstallPrompt();
  const { lang } = useLanguage();

  if (!showBanner || !platform) return null;

  // 多语言文案（轻量内联，不扩充全局 i18n）
  const texts = getTexts(lang);

  if (platform === 'ios') {
    return (
      <div className="fixed bottom-20 left-3 right-3 z-[60] animate-slide-up">
        <div
          className="rounded-2xl p-4 shadow-2xl border border-gray-100"
          style={{
            background: 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 100%)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          }}
        >
          {/* 关闭按钮 */}
          <button
            onClick={dismiss}
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>

          <div className="flex items-start gap-3 pr-6">
            {/* 图标 */}
            <div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0 shadow-sm">
              <Download className="w-5 h-5 text-white" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-gray-900" style={{ fontSize: '14px' }}>
                {texts.iosTitle}
              </p>
              <div className="flex items-center gap-1.5 mt-2 text-gray-500" style={{ fontSize: '13px' }}>
                <span>{texts.iosStep1}</span>
                <Share className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span>{texts.iosStep2}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Android / Chrome
  return (
    <div className="fixed bottom-20 left-3 right-3 z-[60] animate-slide-up">
      <div
        className="rounded-2xl p-4 shadow-2xl border border-gray-100"
        style={{
          background: 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 100%)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}
      >
        <div className="flex items-center gap-3">
          {/* 图标 */}
          <div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Download className="w-5 h-5 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-gray-900 truncate" style={{ fontSize: '14px' }}>
              {texts.androidTitle}
            </p>
            <p className="text-gray-500 truncate" style={{ fontSize: '12px' }}>
              {texts.androidDesc}
            </p>
          </div>

          {/* 安装按钮 */}
          <button
            onClick={triggerInstall}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl flex-shrink-0 active:bg-emerald-700 transition-colors"
            style={{ fontSize: '13px' }}
          >
            {texts.installBtn}
          </button>

          {/* 关闭 */}
          <button
            onClick={dismiss}
            className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0 active:bg-gray-100"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** 轻量多语言文案 */
function getTexts(lang: string) {
  const map: Record<string, {
    androidTitle: string;
    androidDesc: string;
    installBtn: string;
    iosTitle: string;
    iosStep1: string;
    iosStep2: string;
  }> = {
    zh: {
      androidTitle: '安装 TaprootAgro 到桌面',
      androidDesc: '离线可用，一键启动',
      installBtn: '安装',
      iosTitle: '安装 TaprootAgro 到主屏幕',
      iosStep1: '点击底部',
      iosStep2: '→ 添加到主屏幕',
    },
    'zh-TW': {
      androidTitle: '安裝 TaprootAgro 到桌面',
      androidDesc: '離線可用，一鍵啟動',
      installBtn: '安裝',
      iosTitle: '安裝 TaprootAgro 到主畫面',
      iosStep1: '點擊底部',
      iosStep2: '→ 加入主畫面',
    },
    fr: {
      androidTitle: 'Installer TaprootAgro',
      androidDesc: 'Fonctionne hors ligne',
      installBtn: 'Installer',
      iosTitle: 'Ajouter TaprootAgro',
      iosStep1: 'Appuyez sur',
      iosStep2: "→ Sur l'écran d'accueil",
    },
    es: {
      androidTitle: 'Instalar TaprootAgro',
      androidDesc: 'Funciona sin conexión',
      installBtn: 'Instalar',
      iosTitle: 'Agregar TaprootAgro',
      iosStep1: 'Toca',
      iosStep2: '→ Agregar a inicio',
    },
    pt: {
      androidTitle: 'Instalar TaprootAgro',
      androidDesc: 'Funciona offline',
      installBtn: 'Instalar',
      iosTitle: 'Adicionar TaprootAgro',
      iosStep1: 'Toque em',
      iosStep2: '→ Tela de Início',
    },
    ar: {
      androidTitle: 'تثبيت TaprootAgro',
      androidDesc: 'يعمل بدون إنترنت',
      installBtn: 'تثبيت',
      iosTitle: 'أضف TaprootAgro للشاشة',
      iosStep1: 'اضغط على',
      iosStep2: '← إضافة للشاشة الرئيسية',
    },
    hi: {
      androidTitle: 'TaprootAgro इंस्टॉल करें',
      androidDesc: 'ऑफलाइन भी चलता है',
      installBtn: 'इंस्टॉल',
      iosTitle: 'TaprootAgro होम स्क्रीन पर जोड़ें',
      iosStep1: 'नीचे',
      iosStep2: '→ होम स्क्रीन पर जोड़ें',
    },
  };

  return map[lang] || {
    androidTitle: 'Install TaprootAgro',
    androidDesc: 'Works offline, fast launch',
    installBtn: 'Install',
    iosTitle: 'Add TaprootAgro to Home Screen',
    iosStep1: 'Tap',
    iosStep2: '→ Add to Home Screen',
  };
}
