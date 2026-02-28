import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { MapPin, Edit, Settings, FileText, Package, CreditCard, Calendar, Info, Scan, QrCode, LogOut, ChevronRight, LogIn } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { useHomeConfig } from "../hooks/useHomeConfig";
import { CameraCapture } from "./CameraCapture";
import { isUserLoggedIn, setUserLoggedIn } from "../utils/auth";
import { PickupAddressEdit } from "./PickupAddressEdit";
import { AllOrdersPage } from "./AllOrdersPage";
import { PendingReceiptPage } from "./PendingReceiptPage";
import { PendingPaymentPage } from "./PendingPaymentPage";
import { InvoiceRecordsPage } from "./InvoiceRecordsPage";
import { AbnormalFeedbackPage } from "./AbnormalFeedbackPage";
import { AboutUsPage } from "./AboutUsPage";

export function ProfilePage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { config } = useHomeConfig();
  const [showCamera, setShowCamera] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAddressEdit, setShowAddressEdit] = useState(false);
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [showPendingReceipt, setShowPendingReceipt] = useState(false);
  const [showPendingPayment, setShowPendingPayment] = useState(false);
  const [showInvoiceRecords, setShowInvoiceRecords] = useState(false);
  const [showAbnormalFeedback, setShowAbnormalFeedback] = useState(false);
  const [showAboutUs, setShowAboutUs] = useState(false);
  const [pickupAddress, setPickupAddress] = useState(
    "中国（山东）自由贸易试验区济南片区舜华路街道经十路7000号，汉峪金融商务中心A4-3-901"
  );

  // 检查登录状态
  useEffect(() => {
    setIsLoggedIn(isUserLoggedIn());
    // 从 localStorage 加载保存的地址
    const savedAddress = localStorage.getItem("pickup-address");
    if (savedAddress) {
      setPickupAddress(savedAddress);
    }
  }, []);

  const menuItems = [
    {
      section: "",
      items: [
        { icon: FileText, label: t.profile.allOrders, color: "text-blue-600", action: () => setShowAllOrders(true) },
        { icon: Package, label: t.profile.pendingReceipt, color: "text-green-600", action: () => setShowPendingReceipt(true) },
        { icon: CreditCard, label: t.profile.pendingPayment, color: "text-orange-600", action: () => setShowPendingPayment(true) },
        { icon: Calendar, label: t.profile.invoiceRecords, color: "text-purple-600", action: () => setShowInvoiceRecords(true) },
        { icon: Info, label: t.profile.abnormalFeedback, color: "text-red-600", action: () => setShowAbnormalFeedback(true) },
      ],
    },
    {
      section: "",
      items: [
        { icon: Settings, label: t.profile.settings, color: "text-gray-600", action: () => navigate("/settings") },
        { icon: Info, label: t.profile.aboutUs, color: "text-emerald-600", action: () => setShowAboutUs(true) },
      ],
    },
  ];

  // 未登录时显示的界面
  if (!isLoggedIn) {
    return (
      <div className="pb-4 min-h-full relative" style={{ backgroundColor: 'var(--app-bg)' }}>
        {/* 绿色圆角矩形背景层 - 从顶部到Logo和登录卡片之间 */}
        <div className="absolute top-0 left-0 right-0 h-60 bg-emerald-600 rounded-b-3xl shadow-lg">
          {/* 装饰元素 */}
          <div className="absolute top-8 right-8 w-20 h-20 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute bottom-8 left-8 w-24 h-24 bg-white/10 rounded-full blur-3xl"></div>
        </div>

        {/* 内容区域 - 在绿色背景上方 */}
        <div className="relative z-10 px-4 pt-12">
          {/* Logo头像区域 */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-lg ring-4 ring-white/30 mb-3">
              <span className="text-4xl">🌿</span>
            </div>
            <p className="text-white/90 text-sm">
              {t.profile.loginPrompt || "请登录以使用完整功能"}
            </p>
          </div>

          {/* 白色登录卡片 - 被绿色背景衬托 */}
          <div className="bg-white rounded-3xl p-6 shadow-2xl text-center border border-gray-100">
            {/* 登录按钮 */}
            <button
              onClick={() => navigate("/login")}
              className="w-full bg-emerald-600 text-white py-3.5 rounded-2xl active:bg-emerald-700 transition-colors duration-150 flex items-center justify-center gap-2 font-medium shadow-lg"
            >
              <LogIn className="w-5 h-5" />
              {t.common.login}
            </button>
          </div>

          {/* 访客入口 - 设置 */}
          <div className="mt-4">
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <button
                onClick={() => navigate("/settings")}
                className="w-full px-4 py-3 flex items-center justify-between active:bg-emerald-50 transition-colors duration-150"
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-gray-600" />
                  <span className="text-sm text-gray-800">{t.profile.settings}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-emerald-600" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 已登录时显示的界面
  return (
    <div className="pb-4 min-h-full" style={{ backgroundColor: 'var(--app-bg)' }}>
      {/* 相机捕获界面 */}
      {showCamera && (
        <CameraCapture
          onCapture={(imageData) => {
            console.log("拍摄的图片:", imageData);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* 地址编辑弹窗 */}
      {showAddressEdit && (
        <PickupAddressEdit
          initialAddress={pickupAddress}
          onClose={() => setShowAddressEdit(false)}
          onSave={(newAddress) => setPickupAddress(newAddress)}
        />
      )}

      {/* 所有订单页面 */}
      {showAllOrders && (
        <AllOrdersPage onClose={() => setShowAllOrders(false)} />
      )}

      {/* 待收货页面 */}
      {showPendingReceipt && (
        <PendingReceiptPage onClose={() => setShowPendingReceipt(false)} />
      )}

      {/* 待付款页面 */}
      {showPendingPayment && (
        <PendingPaymentPage onClose={() => setShowPendingPayment(false)} />
      )}

      {/* 发票记录页面 */}
      {showInvoiceRecords && (
        <InvoiceRecordsPage onClose={() => setShowInvoiceRecords(false)} />
      )}

      {/* 异常反馈页面 */}
      {showAbnormalFeedback && (
        <AbnormalFeedbackPage onClose={() => setShowAbnormalFeedback(false)} />
      )}

      {/* 关于我们页面 */}
      {showAboutUs && (
        <AboutUsPage onClose={() => setShowAboutUs(false)} />
      )}

      {/* 绿色头部区域 */}
      <div className="bg-emerald-600 px-4 pt-12 pb-6 rounded-b-3xl relative shadow-lg">
        {/* 扫一扫和二维码按钮 */}
        <div className="absolute top-12 ltr:right-4 rtl:left-4 flex flex-col items-center gap-2">
          <button
            onClick={() => setShowCamera(true)}
            className="text-white active:scale-95 transition-transform duration-150 bg-white/10 p-2 rounded-full backdrop-blur-sm"
          >
            <Scan className="w-5 h-5" />
          </button>
          <button className="text-white active:scale-95 transition-transform duration-150 bg-white/10 p-2 rounded-full backdrop-blur-sm">
            <QrCode className="w-5 h-5" />
          </button>
        </div>

        {/* 用户信息 */}
        <div className="flex items-center gap-3">
          {/* 头像 */}
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg flex-shrink-0 overflow-hidden ring-4 ring-white/20">
            <img
              src={config?.userProfile?.avatar || "https://images.unsplash.com/photo-1642919854816-98575cbaefa8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaW1wbGUlMjBsZWFmJTIwc2tldGNoJTIwbWluaW1hbCUyMGRyYXdpbmd8ZW58MXx8fHwxNzcwODU0NDU2fDA&ixlib=rb-4.1.0&q=80&w=1080"}
              alt="User Avatar"
              className="w-full h-full object-cover"
            />
          </div>

          {/* 用户详细信息 */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-white truncate">{config?.userProfile?.name || "Rick"}</h2>
          </div>
        </div>
      </div>

      {/* 提货地点卡片 */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl p-3 shadow-lg">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-800 mb-1.5">{t.profile.pickupInfo}</h3>
              <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 break-all">
                {pickupAddress}
              </p>
            </div>
            <button 
              onClick={() => setShowAddressEdit(true)}
              className="text-emerald-600 active:scale-95 transition-transform duration-150 flex-shrink-0"
            >
              <Edit className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 菜单列表 */}
      <div className="px-4 mt-4 space-y-3">
        {menuItems.map((section, sectionIndex) => (
          <div
            key={sectionIndex}
            className="bg-white rounded-2xl overflow-hidden shadow-lg"
          >
            {section.section && (
              <div className="px-4 py-2 bg-gray-50">
                <h3 className="text-sm text-gray-600">{section.section}</h3>
              </div>
            )}
            {section.items.map((item, itemIndex) => {
              const Icon = item.icon;
              return (
                <div key={itemIndex}>
                  <button 
                    onClick={item.action}
                    className="w-full px-4 py-3 flex items-center justify-between active:bg-emerald-100 transition-colors duration-150 min-w-0"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Icon className={`w-5 h-5 flex-shrink-0 ${item.color}`} />
                      <span className="text-sm text-gray-800 truncate">{item.label}</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  </button>
                  {itemIndex < section.items.length - 1 && (
                    <div className="border-t border-gray-100 mx-4"></div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* 登出按钮 */}
      <div className="px-4">
        <button
          onClick={() => {
            // 清除登录状态
            setUserLoggedIn(false);
            // 刷新当前页面以显示未登录界面
            setIsLoggedIn(false);
          }}
          className="w-full mt-6 mb-6 bg-white text-gray-400 py-3 rounded-2xl active:bg-gray-50 transition-colors duration-150 text-sm"
        >
          {t.profile.logout}
        </button>
      </div>
    </div>
  );
}

// 默认导出用于懒加载
export default ProfilePage;