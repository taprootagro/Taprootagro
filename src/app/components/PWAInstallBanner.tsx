import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { Download, X, Share } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { useHomeConfig } from '../hooks/useHomeConfig';

/**
 * PWA 安装横幅
 * - Android/Chrome：beforeinstallprompt 触发原生安装
 * - iOS/Safari：引导用户通过"分享 → 添加到主屏幕"安装
 * - 图标优先使用远程配置的自定义图标，回退到 Download 通用图标
 */
export function PWAInstallBanner() {
  const { showBanner, platform, triggerInstall, dismiss } = useInstallPrompt();
  const { language, isRTL } = useLanguage();
  const { config } = useHomeConfig();

  if (!showBanner || !platform) return null;

  // 多语言文案（轻量内联，不扩充全局 i18n）
  const texts = getTexts(language);

  // 获取实际 App 图标：desktopIcon > appBranding.logoUrl > 回退到通用图标
  const customIcon = config?.desktopIcon?.icon192Url || config?.appBranding?.logoUrl;

  // iOS 非 Safari 浏览器检测（需要引导去 Safari 打开）
  const ua = navigator.userAgent;
  const isIOSNonSafari = platform === 'ios' && /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);

  // 图标渲染：有自定义图标用 img，否则用 Download 通用图标
  const iconElement = customIcon ? (
    <img
      src={customIcon}
      alt=""
      className="w-11 h-11 rounded-xl flex-shrink-0 shadow-sm object-cover"
    />
  ) : (
    <div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0 shadow-sm">
      <Download className="w-5 h-5 text-white" />
    </div>
  );

  if (platform === 'ios') {
    return (
      <div className="fixed bottom-20 inset-x-3 z-[60] animate-slide-up">
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
            className={`absolute top-3 ${isRTL ? 'left-3' : 'right-3'} w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200`}
            aria-label="Close"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>

          <div className={`flex items-start gap-3 ${isRTL ? 'pl-8' : 'pr-8'}`}>
            {/* 图标 */}
            {iconElement}

            <div className="flex-1 min-w-0">
              <p className="text-gray-900" style={{ fontSize: '14px' }}>
                {texts.iosTitle}
              </p>
              {isIOSNonSafari ? (
                <p className="mt-2 text-gray-500" style={{ fontSize: '12px' }}>
                  {texts.iosOpenInSafari}
                </p>
              ) : (
                <div className="flex items-center gap-1.5 mt-2 text-gray-500" style={{ fontSize: '13px' }}>
                  <span>{texts.iosStep1}</span>
                  <Share className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span>{texts.iosStep2}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Android / Chrome
  return (
    <div className="fixed bottom-20 inset-x-3 z-[60] animate-slide-up">
      <div
        className="rounded-2xl p-4 shadow-2xl border border-gray-100"
        style={{
          background: 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 100%)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}
      >
        <div className="flex items-center gap-3">
          {/* 图标 */}
          {iconElement}

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
            className="w-10 h-10 flex items-center justify-center rounded-full flex-shrink-0 active:bg-gray-100"
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
    iosOpenInSafari: string;
  }> = {
    zh: {
      androidTitle: '安装 TaprootAgro 到桌面',
      androidDesc: '离线可用，一键启动',
      installBtn: '安装',
      iosTitle: '安装 TaprootAgro 到主屏幕',
      iosStep1: '点击底部',
      iosStep2: '→ 添加到主屏幕',
      iosOpenInSafari: '请在 Safari 浏览器中打开此页面',
    },
    'zh-TW': {
      androidTitle: '安裝 TaprootAgro 到桌面',
      androidDesc: '離線可用，一鍵啟動',
      installBtn: '安裝',
      iosTitle: '安裝 TaprootAgro 到主畫面',
      iosStep1: '點擊底部',
      iosStep2: '→ 加入主畫面',
      iosOpenInSafari: '請在 Safari 瀏覽器中打開此頁面',
    },
    fr: {
      androidTitle: 'Installer TaprootAgro',
      androidDesc: 'Fonctionne hors ligne',
      installBtn: 'Installer',
      iosTitle: 'Ajouter TaprootAgro',
      iosStep1: 'Appuyez sur',
      iosStep2: "→ Sur l'écran d'accueil",
      iosOpenInSafari: 'Ouvrez cette page dans le navigateur Safari',
    },
    es: {
      androidTitle: 'Instalar TaprootAgro',
      androidDesc: 'Funciona sin conexión',
      installBtn: 'Instalar',
      iosTitle: 'Agregar TaprootAgro',
      iosStep1: 'Toca',
      iosStep2: '→ Agregar a inicio',
      iosOpenInSafari: 'Abra esta página en el navegador Safari',
    },
    pt: {
      androidTitle: 'Instalar TaprootAgro',
      androidDesc: 'Funciona offline',
      installBtn: 'Instalar',
      iosTitle: 'Adicionar TaprootAgro',
      iosStep1: 'Toque em',
      iosStep2: '→ Tela de Início',
      iosOpenInSafari: 'Abra esta página no navegador Safari',
    },
    ar: {
      androidTitle: 'تثبيت TaprootAgro',
      androidDesc: 'يعمل بدون إنترنت',
      installBtn: 'تثبيت',
      iosTitle: 'أضف TaprootAgro للشاش',
      iosStep1: 'اضغط على',
      iosStep2: '← إضافة للشاشة الرئيسية',
      iosOpenInSafari: 'افتح هذه الصفحة في متصفح Safari',
    },
    hi: {
      androidTitle: 'TaprootAgro इंस्टॉल करें',
      androidDesc: 'ऑफलाइन भी चलता है',
      installBtn: 'इंस्टॉल',
      iosTitle: 'TaprootAgro होम स्क्रीन पर जोड़ें',
      iosStep1: 'नीचे',
      iosStep2: '→ होम स्क्रीन पर जोड़ें',
      iosOpenInSafari: 'इस पेज को Safari ब्राउज़र में खोलें',
    },
    ru: {
      androidTitle: 'Установить TaprootAgro',
      androidDesc: 'Работает офлайн',
      installBtn: 'Установить',
      iosTitle: 'Добавить TaprootAgro',
      iosStep1: 'Нажмите',
      iosStep2: '→ На экран «Домой»',
      iosOpenInSafari: 'Откройте эту страницу в браузере Safari',
    },
    bn: {
      androidTitle: 'TaprootAgro ইনস্টল করুন',
      androidDesc: 'অফলাইে কাজ করে',
      installBtn: 'ইনস্টল',
      iosTitle: 'TaprootAgro হোম স্ক্রিনে যোগ করুন',
      iosStep1: 'নিচে',
      iosStep2: '→ হোম স্ক্রিনে যোগ করুন',
      iosOpenInSafari: 'এই পেজটি Safari ব্রাউজারে খুলুন',
    },
    ur: {
      androidTitle: 'TaprootAgro انسٹال کریں',
      androidDesc: 'آف لائن کام کرتا ہے',
      installBtn: 'انسٹال',
      iosTitle: 'TaprootAgro ہوم اسکرین پر شامل کریں',
      iosStep1: 'نیچے دبائیں',
      iosStep2: '← ہوم اسکرین میں شامل کریں',
      iosOpenInSafari: 'اس صفحے کو Safari براوزر میں کھولیں',
    },
    id: {
      androidTitle: 'Pasang TaprootAgro',
      androidDesc: 'Bisa offline, buka cepat',
      installBtn: 'Pasang',
      iosTitle: 'Tambah TaprootAgro ke Layar Utama',
      iosStep1: 'Ketuk',
      iosStep2: '→ Tambahkan ke Layar Utama',
      iosOpenInSafari: 'Buka halaman ini di browser Safari',
    },
    vi: {
      androidTitle: 'Cài đặt TaprootAgro',
      androidDesc: 'Hoạt động ngoại tuyến',
      installBtn: 'Cài đặt',
      iosTitle: 'Thêm TaprootAgro vào Màn hình chính',
      iosStep1: 'Nhấn',
      iosStep2: '→ Thêm vào Màn hình chính',
      iosOpenInSafari: 'Mở trang này trong trình duyệt Safari',
    },
    ms: {
      androidTitle: 'Pasang TaprootAgro',
      androidDesc: 'Boleh guna luar talian',
      installBtn: 'Pasang',
      iosTitle: 'Tambah TaprootAgro ke Skrin Utama',
      iosStep1: 'Ketik',
      iosStep2: '→ Tambah ke Skrin Utama',
      iosOpenInSafari: 'Buka halaman ini di browser Safari',
    },
    ja: {
      androidTitle: 'TaprootAgro をインストール',
      androidDesc: 'オフラインでも使えます',
      installBtn: 'インストール',
      iosTitle: 'TaprootAgro をホーム画面に追加',
      iosStep1: '下の',
      iosStep2: '→ ホーム画面に追加',
      iosOpenInSafari: 'このページを Safari ブラウザで開きます',
    },
    th: {
      androidTitle: 'ติดตั้ง TaprootAgro',
      androidDesc: 'ใช้งานออฟไลน์ได้',
      installBtn: 'ติดตั้ง',
      iosTitle: 'เพิ่ม TaprootAgro ไปยังหน้าจอหลัก',
      iosStep1: 'แตะ',
      iosStep2: '→ เพิ่มไปยังหน้าจอหลัก',
      iosOpenInSafari: 'เปิดหน้านี้ในเบราว์เซอร์ Safari',
    },
    my: {
      androidTitle: 'TaprootAgro ထည့်သွင်းပါ',
      androidDesc: 'အော့ဖ်လိုင်းသုံးနိုင်သည်',
      installBtn: 'ထည့်သွင်း',
      iosTitle: 'TaprootAgro ကို ပင်မစာမျက်နှာသို့ ထည့်ပါ',
      iosStep1: 'အောက်ခြေ',
      iosStep2: '→ ပင်မစာမျက်နှာသို့ ထည့်ပါ',
      iosOpenInSafari: 'ဒီစာမျက်နှာကို Safari ဘရာဝှက်တွင် ဖွင့်ပါ',
    },
    tl: {
      androidTitle: 'I-install ang TaprootAgro',
      androidDesc: 'Gumagana offline',
      installBtn: 'I-install',
      iosTitle: 'Idagdag ang TaprootAgro sa Home Screen',
      iosStep1: 'Pindutin',
      iosStep2: '→ Idagdag sa Home Screen',
      iosOpenInSafari: 'Bukas ang pahinang ito sa browser ng Safari',
    },
    tr: {
      androidTitle: "TaprootAgro'yu Yükle",
      androidDesc: 'Çevrimdışı çalışır',
      installBtn: 'Yükle',
      iosTitle: "TaprootAgro'yu Ana Ekrana Ekle",
      iosStep1: 'Dokunun',
      iosStep2: '→ Ana Ekrana Ekle',
      iosOpenInSafari: 'Bu sayfayı Safari tarayıcısında açın',
    },
    fa: {
      androidTitle: 'نصب TaprootAgro',
      androidDesc: 'بدون اینترنت کار می‌کند',
      installBtn: 'نصب',
      iosTitle: 'افزودن TaprootAgro به صفحه اصلی',
      iosStep1: 'روی',
      iosStep2: '← افزودن به صفحه اصلی',
      iosOpenInSafari: 'این صفحه را در مرورگر Safari باز کنید',
    },
  };

  return map[lang] || {
    androidTitle: 'Install TaprootAgro',
    androidDesc: 'Works offline, fast launch',
    installBtn: 'Install',
    iosTitle: 'Add TaprootAgro to Home Screen',
    iosStep1: 'Tap',
    iosStep2: '→ Add to Home Screen',
    iosOpenInSafari: 'Open this page in Safari browser',
  };
}