import { useNavigate } from "react-router";
import React, { useState, useEffect } from "react";
import { useHomeConfig } from "../hooks/useHomeConfig";
import { useLanguage } from "../hooks/useLanguage";
import { ArrowLeft, Plus, Trash2, Save, Edit3, RotateCcw, Lock } from "lucide-react";
import { RichTextEditor } from "./RichTextEditor";

export default function ConfigManagerPage() {
  const navigate = useNavigate();
  const { config, saveConfig } = useHomeConfig();
  const { t, isChinese } = useLanguage();

  // 入口密码门禁状态（必须在所有 hooks 之前声明）
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [gatePassword, setGatePassword] = useState("");
  const [gateError, setGateError] = useState(false);

  const [activeTab, setActiveTab] = useState<"banners" | "live" | "articles" | "marketCategories" | "marketProducts" | "marketAd" | "filing" | "aboutUs" | "privacy" | "terms" | "appBranding" | "chatContact" | "userProfile" | "desktopIcon">("banners");
  const [editingItem, setEditingItem] = useState<any>(null);
  const [hasChanges, setHasChanges] = useState(false);
  // 本地工作副本：所有编辑操作只修改此副本，不立即持久化
  const [workingConfig, setWorkingConfig] = useState(() => JSON.parse(JSON.stringify(config)));
  // Save 确认弹窗状态
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [savePassword, setSavePassword] = useState("");
  const [saveError, setSaveError] = useState("");

  // 双语辅助：中文环境显示中文，其他语言显示英文
  const ct = (zh: string, en: string) => isChinese ? zh : en;

  // 入口密码验证
  const handleGateSubmit = () => {
    if (gatePassword.toLowerCase() === "taprootagro") {
      setIsUnlocked(true);
      setGateError(false);
    } else {
      setGateError(true);
    }
  };

  // 未解锁时显示密码输入页面
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* 状态栏占位 — standalone 模式下用 safe-area-inset-top 撇开 */}
        <div className="bg-emerald-600 safe-top flex-shrink-0" />
        {/* 顶部导航栏 */}
        <div className="bg-emerald-600 text-white px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/home/profile")} className="p-1.5 hover:bg-emerald-700 rounded-lg transition-colors flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="font-semibold text-base sm:text-lg truncate">{ct("内容配置管理", "Content Config Manager")}</h1>
        </div>
        {/* 密码输入 */}
        <div className="flex items-center justify-center px-6" style={{ minHeight: 'calc(100vh - 100px)' }}>
          <div className="w-full max-w-xs space-y-6 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <input
                type="password"
                value={gatePassword}
                onChange={(e) => { setGatePassword(e.target.value); setGateError(false); }}
                onKeyDown={(e) => e.key === "Enter" && handleGateSubmit()}
                autoFocus
                className={`w-full px-4 py-3 border-2 rounded-xl text-center tracking-widest focus:outline-none transition-colors ${
                  gateError
                    ? "border-red-400 bg-red-50 focus:border-red-500"
                    : "border-gray-200 bg-white focus:border-emerald-500"
                }`}
              />
              {gateError && (
                <div className="mt-2 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                </div>
              )}
            </div>
            <button
              onClick={handleGateSubmit}
              className="w-full py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
            >
              {ct("进入", "Enter")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 处理返回（不再自动保存）
  const handleGoBack = () => {
    if (hasChanges) {
      if (!confirm(ct("有未保存的更改，确定要离开吗？", "You have unsaved changes. Are you sure you want to leave?"))) {
        return;
      }
    }
    navigate("/home/profile");
  };

  // 显示保存确认弹窗
  const handleShowSaveDialog = () => {
    setSavePassword("");
    setSaveError("");
    setShowSaveDialog(true);
  };

  // 确认保存：需要输入 taprootagro
  const handleConfirmSave = () => {
    if (savePassword.toLowerCase() !== "taprootagro") {
      setSaveError(ct("验证码错误，请输入 taprootagro", "Incorrect code. Please enter taprootagro"));
      return;
    }
    saveConfig(workingConfig);
    setHasChanges(false);
    setShowSaveDialog(false);
    setSavePassword("");
    setSaveError("");
    alert(ct("配置保存成功！", "Config saved successfully!"));
  };

  // 添加新项
  const handleAddItem = (type: string) => {
    const newItem = createNewItem(type);
    setEditingItem(newItem);
  };

  // 创建新项模板
  const createNewItem = (type: string) => {
    const items = getItemsByType(type);
    const maxId = items.length > 0 ? Math.max(0, ...items.map((item: any) => item.id || 0)) : 0;
    switch (type) {
      case "banners":
        return { id: maxId + 1, url: "", alt: "", title: "", content: "" };
      case "live":
        return { id: maxId + 1, title: "", viewers: "0", thumbnail: "", videoUrl: "" };
      case "articles":
        return { id: maxId + 1, title: "", content: "", thumbnail: "" };
      case "marketCategories":
        return { id: (maxId + 1).toString(), name: "", subCategories: [] };
      case "marketProducts":
        return { id: maxId + 1, name: "", image: "", price: "", category: "", subCategory: "", description: "", stock: 0 };
      case "marketAd":
        return { id: maxId + 1, image: "", title: "", content: "" };
      case "filing":
        return { id: maxId + 1, icpNumber: "", icpUrl: "", policeNumber: "", policeUrl: "" };
      case "aboutUs":
        return { id: maxId + 1, content: "" };
      case "privacy":
        return { id: maxId + 1, content: "" };
      case "terms":
        return { id: maxId + 1, content: "" };
      case "appBranding":
        return { logoUrl: "", appName: "", slogan: "" };
      case "chatContact":
        return { name: "", avatar: "", subtitle: "" };
      case "userProfile":
        return { name: "", avatar: "" };
      case "desktopIcon":
        return { appName: "", icon192Url: "", icon512Url: "" };
      default:
        return {};
    }
  };

  // 获取当前标签的数据
  const getItemsByType = (type: string) => {
    const wc = workingConfig;
    if (!wc || !wc.marketPage) {
      return [];
    }
    switch (type) {
      case "banners": return wc.banners || [];
      case "live": return wc.liveStreams || [];
      case "articles": return wc.articles || [];
      case "marketCategories": return wc.marketPage.categories || [];
      case "marketProducts": return wc.marketPage.products || [];
      case "marketAd":
        return wc.marketPage.advertisements || [];
      case "filing": return wc.filing ? [wc.filing] : [];
      case "aboutUs": return wc.aboutUs ? [wc.aboutUs] : [];
      case "privacy": return wc.privacyPolicy ? [wc.privacyPolicy] : [];
      case "terms": return wc.termsOfService ? [wc.termsOfService] : [];
      case "appBranding": return wc.appBranding ? [wc.appBranding] : [];
      case "chatContact": return wc.chatContact ? [wc.chatContact] : [];
      case "userProfile": return wc.userProfile ? [wc.userProfile] : [];
      case "desktopIcon": return wc.desktopIcon ? [wc.desktopIcon] : [];
      default: return [];
    }
  };

  // 保存编辑
  const handleSaveEdit = () => {
    if (!editingItem) return;

    // 深拷贝配置，避免直接修改原数组引用导致 React 检测不到变化
    const newConfig = JSON.parse(JSON.stringify(workingConfig)) as typeof config;
    const items = getItemsByType(activeTab);
    const existingIndex = items.findIndex((item: any) => item.id === editingItem.id);

    if (existingIndex >= 0) {
      // 更新现有项
      switch (activeTab) {
        case "banners":
          newConfig.banners[existingIndex] = editingItem;
          break;
        case "live":
          newConfig.liveStreams[existingIndex] = editingItem;
          break;
        case "articles":
          newConfig.articles[existingIndex] = editingItem;
          break;
        case "marketCategories":
          newConfig.marketPage.categories[existingIndex] = editingItem;
          break;
        case "marketProducts":
          newConfig.marketPage.products[existingIndex] = editingItem;
          break;
        case "marketAd":
          newConfig.marketPage.advertisements[existingIndex] = editingItem;
          break;
        case "filing":
          newConfig.filing = editingItem;
          break;
        case "aboutUs":
          newConfig.aboutUs = editingItem;
          break;
        case "privacy":
          newConfig.privacyPolicy = editingItem;
          break;
        case "terms":
          newConfig.termsOfService = editingItem;
          break;
        case "appBranding":
          newConfig.appBranding = editingItem;
          break;
        case "chatContact":
          newConfig.chatContact = editingItem;
          break;
        case "userProfile":
          newConfig.userProfile = editingItem;
          break;
        case "desktopIcon":
          newConfig.desktopIcon = editingItem;
          break;
      }
    } else {
      // 添加新项
      switch (activeTab) {
        case "banners":
          newConfig.banners.push(editingItem);
          break;
        case "live":
          newConfig.liveStreams.push(editingItem);
          break;
        case "articles":
          newConfig.articles.push(editingItem);
          break;
        case "marketCategories":
          newConfig.marketPage.categories.push(editingItem);
          break;
        case "marketProducts":
          newConfig.marketPage.products.push(editingItem);
          break;
        case "marketAd":
          newConfig.marketPage.advertisements.push(editingItem);
          break;
        case "filing":
          newConfig.filing = editingItem;
          break;
        case "aboutUs":
          newConfig.aboutUs = editingItem;
          break;
        case "privacy":
          newConfig.privacyPolicy = editingItem;
          break;
        case "terms":
          newConfig.termsOfService = editingItem;
          break;
        case "appBranding":
          newConfig.appBranding = editingItem;
          break;
        case "chatContact":
          newConfig.chatContact = editingItem;
          break;
        case "userProfile":
          newConfig.userProfile = editingItem;
          break;
        case "desktopIcon":
          newConfig.desktopIcon = editingItem;
          break;
      }
    }

    setWorkingConfig(newConfig);
    setEditingItem(null);
    setHasChanges(true);
  };

  // 删除项
  const handleDeleteItem = (id: number | string) => {
    if (!confirm(ct("确定要删除这项吗？", "Are you sure you want to delete this item?"))) return;

    const newConfig = JSON.parse(JSON.stringify(workingConfig)) as typeof config;
    switch (activeTab) {
      case "banners":
        newConfig.banners = workingConfig.banners.filter((item: any) => item.id !== id);
        break;
      case "live":
        newConfig.liveStreams = workingConfig.liveStreams.filter((item: any) => item.id !== id);
        break;
      case "articles":
        newConfig.articles = workingConfig.articles.filter((item: any) => item.id !== id);
        break;
      case "marketCategories":
        newConfig.marketPage.categories = workingConfig.marketPage.categories.filter((item: any) => item.id !== id);
        break;
      case "marketProducts":
        newConfig.marketPage.products = workingConfig.marketPage.products.filter((item: any) => item.id !== id);
        break;
      case "marketAd":
        newConfig.marketPage.advertisements = (workingConfig.marketPage.advertisements || []).filter((item: any) => item.id !== id);
        break;
      // 单体配置类型：重置为默认值而非null，防止崩溃
      case "filing":
        newConfig.filing = { icpNumber: "", icpUrl: "", policeNumber: "", policeUrl: "" };
        break;
      case "aboutUs":
        newConfig.aboutUs = { title: "", content: "" };
        break;
      case "privacy":
        newConfig.privacyPolicy = { title: "", content: "" };
        break;
      case "terms":
        newConfig.termsOfService = { title: "", content: "" };
        break;
      case "appBranding":
        newConfig.appBranding = { logoUrl: "", appName: "", slogan: "" };
        break;
      case "chatContact":
        newConfig.chatContact = { name: "", avatar: "", subtitle: "" };
        break;
      case "userProfile":
        newConfig.userProfile = { name: "", avatar: "" };
        break;
      case "desktopIcon":
        newConfig.desktopIcon = { appName: "", icon192Url: "", icon512Url: "" };
        break;
    }

    setWorkingConfig(newConfig);
    setHasChanges(true);
  };

  // 渲染表格
  const renderTable = () => {
    const items = getItemsByType(activeTab);

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow">
          <thead className="bg-emerald-600 text-white">
            <tr>
              {getTableHeaders().map((header, index) => (
                <th key={index} className="px-3 py-2 text-left text-xs font-semibold border-r border-emerald-500 last:border-r-0">
                  {header}
                </th>
              ))}
              <th className="px-3 py-2 text-center text-xs font-semibold w-24 border-l border-emerald-500">{ct("操作", "Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={getTableHeaders().length + 1} className="px-3 py-6 text-center text-gray-500 text-xs">
                  {ct('暂无数据，点击右上角"添加"按钮创建新项', 'No data yet. Click the "Add" button to create a new item.')}
                </td>
              </tr>
            ) : (
              items.map((item: any, index: number) => (
                <tr key={item.id || index} className={`border-b hover:bg-emerald-50 transition-colors ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                  {renderTableRow(item)}
                  <td className="px-3 py-2 text-center border-l border-gray-200">
                    <div className="flex gap-1.5 justify-center">
                      <button
                        onClick={() => setEditingItem({ ...item })}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                        title={ct("编辑", "Edit")}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        title={ct("删除", "Delete")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // 获取表头
  const getTableHeaders = () => {
    switch (activeTab) {
      case "banners":
        return ["ID", ct("图片URL", "Image URL"), ct("描述文字", "Alt Text"), ct("标题", "Title"), ct("内容", "Content")];
      case "live":
        return ["ID", ct("直播标题", "Live Title"), ct("观看人数", "Viewers"), ct("预览", "Preview")];
      case "articles":
        return ["ID", ct("文章标题", "Article Title"), ct("内容", "Content"), ct("缩略图URL", "Thumbnail URL")];
      case "marketCategories":
        return ["ID", ct("类别名称", "Category Name"), ct("子类别", "Subcategories")];
      case "marketProducts":
        return ["ID", ct("产品名称", "Product Name"), ct("描述", "Description"), ct("价格", "Price"), ct("类别", "Category"), ct("缩略图URL", "Thumbnail URL")];
      case "marketAd":
        return ["ID", ct("广告标题", "Ad Title"), ct("内容", "Content"), ct("缩略图URL", "Thumbnail URL")];
      case "filing":
        return [ct("ICP备案号", "ICP Number"), ct("ICP链接", "ICP Link"), ct("公安备案号", "Police Filing No."), ct("公安链接", "Police Link")];
      case "aboutUs":
        return ["ID", ct("关于我们内容", "About Us Content")];
      case "privacy":
        return ["ID", ct("隐私政策内容", "Privacy Policy Content")];
      case "terms":
        return ["ID", ct("服务条款内容", "Terms of Service Content")];
      case "appBranding":
        return [ct("Logo图标", "Logo Icon"), ct("应用名称", "App Name"), ct("口号", "Slogan")];
      case "chatContact":
        return [ct("姓名", "Name"), ct("头像", "Avatar"), ct("副标题", "Subtitle")];
      case "userProfile":
        return [ct("姓名", "Name"), ct("头像", "Avatar")];
      case "desktopIcon":
        return [ct("应用名称", "App Name"), ct("192px图标", "Icon 192"), ct("512px图标", "Icon 512")];
      default:
        return [];
    }
  };

  // 渲染表格行
  const renderTableRow = (item: any) => {
    switch (activeTab) {
      case "banners":
        return (
          <>
            <td className="px-3 py-2 text-xs">{item.id}</td>
            <td className="px-3 py-2 text-xs max-w-xs truncate" title={item.url}>{item.url}</td>
            <td className="px-3 py-2 text-xs">{item.alt}</td>
            <td className="px-3 py-2 text-xs">{item.title}</td>
            <td className="px-3 py-2 text-xs max-w-xs truncate" title={item.content}>{item.content}</td>
          </>
        );
      case "live":
        return (
          <>
            <td className="px-3 py-2 text-xs">{item.id}</td>
            <td className="px-3 py-2 text-xs">{item.title}</td>
            <td className="px-3 py-2 text-xs">{item.viewers}</td>
            <td className="px-3 py-2 text-xs">
              {item.thumbnail ? (
                <img src={item.thumbnail} alt={item.title} className="w-16 h-10 object-cover rounded" />
              ) : (
                <span className="text-gray-400">{ct("无缩略图", "No thumbnail")}</span>
              )}
            </td>
          </>
        );
      case "articles":
        return (
          <>
            <td className="px-3 py-2 text-xs">{item.id}</td>
            <td className="px-3 py-2 text-xs">{item.title}</td>
            <td className="px-3 py-2 text-xs max-w-xs truncate" title={item.content}>{item.content}</td>
            <td className="px-3 py-2 text-xs max-w-xs truncate" title={item.thumbnail}>{item.thumbnail}</td>
          </>
        );
      case "marketCategories":
        return (
          <>
            <td className="px-3 py-2 text-xs">{item.id}</td>
            <td className="px-3 py-2 text-xs">{item.name}</td>
            <td className="px-3 py-2 text-xs">{item.subCategories.join(", ")}</td>
          </>
        );
      case "marketProducts":
        return (
          <>
            <td className="px-3 py-2 text-xs">{item.id}</td>
            <td className="px-3 py-2 text-xs">{item.name}</td>
            <td className="px-3 py-2 text-xs">{item.description}</td>
            <td className="px-3 py-2 text-xs">{item.price}</td>
            <td className="px-3 py-2 text-xs">{item.category}</td>
            <td className="px-3 py-2 text-xs max-w-xs truncate" title={item.image}>{item.image}</td>
          </>
        );
      case "marketAd":
        return (
          <>
            <td className="px-3 py-2 text-xs">{item.id}</td>
            <td className="px-3 py-2 text-xs">{item.title}</td>
            <td className="px-3 py-2 text-xs">{item.content || "-"}</td>
            <td className="px-3 py-2 text-xs max-w-xs truncate" title={item.image}>{item.image}</td>
          </>
        );
      case "filing":
        return (
          <>
            <td className="px-3 py-2 text-xs max-w-xs truncate" title={item.icpNumber}>{item.icpNumber}</td>
            <td className="px-3 py-2 text-xs max-w-xs truncate" title={item.icpUrl}>{item.icpUrl}</td>
            <td className="px-3 py-2 text-xs max-w-xs truncate" title={item.policeNumber}>{item.policeNumber}</td>
            <td className="px-3 py-2 text-xs max-w-xs truncate" title={item.policeUrl}>{item.policeUrl}</td>
          </>
        );
      case "aboutUs":
        return (
          <>
            <td className="px-3 py-2 text-xs">{item.id}</td>
            <td className="px-3 py-2 text-xs max-w-xs truncate" title={item.content}>{item.content}</td>
          </>
        );
      case "privacy":
        return (
          <>
            <td className="px-3 py-2 text-xs">{item.id}</td>
            <td className="px-3 py-2 text-xs max-w-xs truncate" title={item.content}>{item.content}</td>
          </>
        );
      case "terms":
        return (
          <>
            <td className="px-3 py-2 text-xs">{item.id}</td>
            <td className="px-3 py-2 text-xs max-w-xs truncate" title={item.content}>{item.content}</td>
          </>
        );
      case "appBranding":
        return (
          <>
            <td className="px-3 py-2 text-xs">{item.logoUrl}</td>
            <td className="px-3 py-2 text-xs">{item.appName}</td>
            <td className="px-3 py-2 text-xs">{item.slogan}</td>
          </>
        );
      case "chatContact":
        return (
          <>
            <td className="px-3 py-2 text-xs">{item.name}</td>
            <td className="px-3 py-2 text-xs max-w-xs truncate" title={item.avatar}>{item.avatar}</td>
            <td className="px-3 py-2 text-xs max-w-xs truncate" title={item.subtitle}>{item.subtitle}</td>
          </>
        );
      case "userProfile":
        return (
          <>
            <td className="px-3 py-2 text-xs">{item.name}</td>
            <td className="px-3 py-2 text-xs max-w-xs truncate" title={item.avatar}>{item.avatar}</td>
          </>
        );
      case "desktopIcon":
        return (
          <>
            <td className="px-3 py-2 text-xs">{item.appName}</td>
            <td className="px-3 py-2 text-xs max-w-[120px] truncate" title={item.icon192Url}>{item.icon192Url}</td>
            <td className="px-3 py-2 text-xs max-w-[120px] truncate" title={item.icon512Url}>{item.icon512Url}</td>
          </>
        );
      default:
        return null;
    }
  };

  // 渲染编辑对话框
  const renderEditDialog = () => {
    if (!editingItem) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-emerald-600 text-white px-6 py-4 flex justify-between items-center">
            <h3 className="text-lg font-semibold">{ct("编辑", "Edit")} {getTabName(activeTab)}</h3>
            <button onClick={() => setEditingItem(null)} className="text-white hover:bg-emerald-700 rounded-lg p-1">
              ✕
            </button>
          </div>

          <div className="p-6 space-y-4">
            {renderEditFields()}
          </div>

          <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex gap-3 justify-end border-t">
            <button
              onClick={() => setEditingItem(null)}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              {ct("取消", "Cancel")}
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {ct("保存", "Save")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 渲染编辑字段
  const renderEditFields = () => {
    switch (activeTab) {
      case "banners":
        return (
          <>
            <InputField label="ID" value={editingItem.id} disabled />
            <InputField label={ct("图片URL", "Image URL")} value={editingItem.url} onChange={(v: string) => setEditingItem({ ...editingItem, url: v })} />
            <InputField label={ct("描述文字", "Alt Text")} value={editingItem.alt} onChange={(v: string) => setEditingItem({ ...editingItem, alt: v })} />
            <InputField label={ct("标题", "Title")} value={editingItem.title} onChange={(v: string) => setEditingItem({ ...editingItem, title: v })} />
            <RichTextEditor label={ct("内容", "Content")} value={editingItem.content || ""} onChange={(v: string) => setEditingItem({ ...editingItem, content: v })} placeholder={ct("从Word粘贴或直接编辑，支持格式和图片", "Paste from Word or edit directly, supports formatting and images")} />
          </>
        );
      case "live":
        return (
          <>
            <InputField label="ID" value={editingItem.id} disabled />
            <InputField label={ct("直播标题", "Live Title")} value={editingItem.title} onChange={(v: string) => setEditingItem({ ...editingItem, title: v })} />
            <InputField label={ct("观看人数", "Viewers")} value={editingItem.viewers} onChange={(v: string) => setEditingItem({ ...editingItem, viewers: v })} />
            {/* 缩略图URL + 预览 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{ct("缩略图URL", "Thumbnail URL")}</label>
              <input
                type="text"
                value={editingItem.thumbnail || ""}
                onChange={(e) => setEditingItem({ ...editingItem, thumbnail: e.target.value })}
                placeholder={ct("输入图片链接", "Enter image URL")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              {editingItem.thumbnail && (
                <img src={editingItem.thumbnail} alt={ct("缩略图预览", "Thumbnail preview")} className="mt-2 w-full max-w-xs h-32 object-cover rounded-lg border border-gray-200" />
              )}
            </div>
            {/* 视频URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{ct("视频URL", "Video URL")}</label>
              <input
                type="text"
                value={editingItem.videoUrl || ""}
                onChange={(e) => setEditingItem({ ...editingItem, videoUrl: e.target.value })}
                placeholder={ct("输入视频链接（.mp4）", "Enter video URL (.mp4)")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <p className="mt-1 text-xs text-gray-500">{ct("缩略图用于列表封面展示，视频URL用于播放页面", "Thumbnail for list cover display, Video URL for playback page")}</p>
            </div>
          </>
        );
      case "articles":
        return (
          <>
            <InputField label="ID" value={editingItem.id} disabled />
            <InputField label={ct("文章标题", "Article Title")} value={editingItem.title} onChange={(v: string) => setEditingItem({ ...editingItem, title: v })} />
            <RichTextEditor label={ct("文章内容", "Article Content")} value={editingItem.content || ""} onChange={(v: string) => setEditingItem({ ...editingItem, content: v })} placeholder={ct("从Word粘贴或直接编辑，支持段落、图片、列表等格式", "Paste from Word or edit directly, supports paragraphs, images, lists")} minHeight="300px" />
            <InputField label={ct("缩略图URL", "Thumbnail URL")} value={editingItem.thumbnail || ""} onChange={(v: string) => setEditingItem({ ...editingItem, thumbnail: v })} />
          </>
        );
      case "marketCategories":
        return (
          <>
            <InputField 
              label={ct("类别ID（英文，用于系统识别）", "Category ID (English, for system use)")} 
              value={editingItem.id} 
              onChange={(v: string) => setEditingItem({ ...editingItem, id: v })} 
              placeholder={ct("例如：herbicide, insecticide", "e.g. herbicide, insecticide")}
            />
            <InputField 
              label={ct("类别名称（显示给用户）", "Category Name (displayed to user)")} 
              value={editingItem.name} 
              onChange={(v: string) => setEditingItem({ ...editingItem, name: v })} 
              placeholder={ct("例如：除草剂, 杀虫剂", "e.g. Herbicide, Insecticide")}
            />
            
            {/* 子类别编辑 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {ct("子类别列表", "Subcategory List")}
              </label>
              <div className="space-y-2">
                {(editingItem.subCategories || []).map((subCat: string, index: number) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={subCat}
                      onChange={(e) => {
                        const newSubCategories = [...(editingItem.subCategories || [])];
                        newSubCategories[index] = e.target.value;
                        setEditingItem({ ...editingItem, subCategories: newSubCategories });
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder={ct("子类别名称", "Subcategory name")}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newSubCategories = editingItem.subCategories.filter((_: string, i: number) => i !== index);
                        setEditingItem({ ...editingItem, subCategories: newSubCategories });
                      }}
                      className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                
                {/* 添加子类别按钮 */}
                <button
                  type="button"
                  onClick={() => {
                    const newSubCategories = [...(editingItem.subCategories || []), ""];
                    setEditingItem({ ...editingItem, subCategories: newSubCategories });
                  }}
                  className="w-full px-3 py-2 bg-emerald-50 text-emerald-600 border-2 border-dashed border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {ct("添加子类别", "Add Subcategory")}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {ct("💡 子类别示例：苗前、苗中后、苗前苗后", "💡 Examples: Pre-emergence, Mid-post, Pre & Post")}
              </p>
            </div>
          </>
        );
      case "marketProducts":
        return (
          <>
            <InputField label="ID" value={editingItem.id} disabled />
            <InputField label={ct("产品名称", "Product Name")} value={editingItem.name} onChange={(v: string) => setEditingItem({ ...editingItem, name: v })} />
            
            {/* 一级类别选择 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">{ct("一级类别", "Primary Category")}</label>
              <select
                value={editingItem.category || ""}
                onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value, subCategory: "" })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">{ct("选择类别", "Select category")}</option>
                {config.marketPage.categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* 二级类别选择 */}
            {editingItem.category && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">{ct("二级类别", "Subcategory")}</label>
                <select
                  value={editingItem.subCategory || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, subCategory: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">{ct("选择子类别", "Select subcategory")}</option>
                  {config.marketPage.categories
                    .find((cat) => cat.id === editingItem.category)
                    ?.subCategories.map((subCat) => (
                      <option key={subCat} value={subCat}>{subCat}</option>
                    ))}
                </select>
              </div>
            )}
            
            <InputField label={ct("价格", "Price")} value={editingItem.price} onChange={(v: string) => setEditingItem({ ...editingItem, price: v })} placeholder={ct("例如：¥68", "e.g. 68")} />
            <InputField label={ct("库存数量", "Stock Qty")} value={editingItem.stock || ""} onChange={(v: string) => setEditingItem({ ...editingItem, stock: parseInt(v) || 0 })} type="number" />
            <InputField label={ct("产品图片URL", "Product Image URL")} value={editingItem.image || ""} onChange={(v: string) => setEditingItem({ ...editingItem, image: v })} />
            <TextAreaField label={ct("简短描述", "Short Description")} value={editingItem.description || ""} onChange={(v: string) => setEditingItem({ ...editingItem, description: v })} rows={2} placeholder={ct("一句话描述产品特点", "One-line product highlight")} />
            <RichTextEditor label={ct("详细说明", "Detailed Description")} value={editingItem.details || ""} onChange={(v: string) => setEditingItem({ ...editingItem, details: v })} placeholder={ct("从Word粘贴或直接编辑产品详情", "Paste from Word or edit product details")} minHeight="200px" />
            <RichTextEditor label={ct("产品规格", "Specifications")} value={editingItem.specifications || ""} onChange={(v: string) => setEditingItem({ ...editingItem, specifications: v })} placeholder={ct("从Word粘贴或直接编辑规格参数", "Paste from Word or edit specifications")} minHeight="150px" />
          </>
        );
      case "marketAd":
        return (
          <>
            <InputField label="ID" value={editingItem.id} disabled />
            <InputField label={ct("广告标题", "Ad Title")} value={editingItem.title} onChange={(v: string) => setEditingItem({ ...editingItem, title: v })} />
            <RichTextEditor label={ct("广告内容", "Ad Content")} value={editingItem.content || ""} onChange={(v: string) => setEditingItem({ ...editingItem, content: v })} placeholder={ct("从Word粘贴或直接编辑广告详情", "Paste from Word or edit ad details directly")} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{ct("广告图片URL", "Ad Image URL")}</label>
              <input
                type="text"
                value={editingItem.image || ""}
                onChange={(e) => setEditingItem({ ...editingItem, image: e.target.value })}
                placeholder={ct("输入图片链接", "Enter image URL")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              {editingItem.image && (
                <img src={editingItem.image} alt={ct("广告预览", "Ad preview")} className="mt-2 w-full max-w-md h-40 object-cover rounded-lg border border-gray-200" />
              )}
            </div>
          </>
        );
      case "filing":
        return (
          <>
            <InputField label="ID" value={editingItem.id} disabled />
            <InputField label={ct("ICP备案号", "ICP Number")} value={editingItem.icpNumber || ""} onChange={(v: string) => setEditingItem({ ...editingItem, icpNumber: v })} />
            <InputField label={ct("ICP链接", "ICP Link")} value={editingItem.icpUrl || ""} onChange={(v: string) => setEditingItem({ ...editingItem, icpUrl: v })} />
            <InputField label={ct("公安备案号", "Police Filing No.")} value={editingItem.policeNumber || ""} onChange={(v: string) => setEditingItem({ ...editingItem, policeNumber: v })} />
            <InputField label={ct("公安链接", "Police Link")} value={editingItem.policeUrl || ""} onChange={(v: string) => setEditingItem({ ...editingItem, policeUrl: v })} />
          </>
        );
      case "aboutUs":
        return (
          <>
            <InputField label="ID" value={editingItem.id} disabled />
            <RichTextEditor label={ct("关于我们内容", "About Us Content")} value={editingItem.content || ""} onChange={(v: string) => setEditingItem({ ...editingItem, content: v })} placeholder={ct("从Word粘贴或直接编辑", "Paste from Word or edit directly")} />
          </>
        );
      case "privacy":
        return (
          <>
            <InputField label="ID" value={editingItem.id} disabled />
            <RichTextEditor label={ct("隐私政策内容", "Privacy Policy Content")} value={editingItem.content || ""} onChange={(v: string) => setEditingItem({ ...editingItem, content: v })} placeholder={ct("从Word粘贴或直接编辑", "Paste from Word or edit directly")} />
          </>
        );
      case "terms":
        return (
          <>
            <InputField label="ID" value={editingItem.id} disabled />
            <RichTextEditor label={ct("服务条款内容", "Terms of Service Content")} value={editingItem.content || ""} onChange={(v: string) => setEditingItem({ ...editingItem, content: v })} placeholder={ct("从Word粘贴或直接编辑", "Paste from Word or edit directly")} />
          </>
        );
      case "appBranding":
        return (
          <>
            <InputField label={ct("Logo图标", "Logo Icon")} value={editingItem.logoUrl || ""} onChange={(v: string) => setEditingItem({ ...editingItem, logoUrl: v })} />
            <InputField label={ct("应用名称", "App Name")} value={editingItem.appName || ""} onChange={(v: string) => setEditingItem({ ...editingItem, appName: v })} />
            <InputField label={ct("口号", "Slogan")} value={editingItem.slogan || ""} onChange={(v: string) => setEditingItem({ ...editingItem, slogan: v })} />
          </>
        );
      case "chatContact":
        return (
          <>
            <InputField label={ct("姓名", "Name")} value={editingItem.name || ""} onChange={(v: string) => setEditingItem({ ...editingItem, name: v })} />
            <InputField label={ct("头像", "Avatar")} value={editingItem.avatar || ""} onChange={(v: string) => setEditingItem({ ...editingItem, avatar: v })} />
            <InputField label={ct("副标题", "Subtitle")} value={editingItem.subtitle || ""} onChange={(v: string) => setEditingItem({ ...editingItem, subtitle: v })} />
          </>
        );
      case "userProfile":
        return (
          <>
            <InputField label={ct("姓名", "Name")} value={editingItem.name || ""} onChange={(v: string) => setEditingItem({ ...editingItem, name: v })} />
            <InputField label={ct("头像", "Avatar")} value={editingItem.avatar || ""} onChange={(v: string) => setEditingItem({ ...editingItem, avatar: v })} />
          </>
        );
      case "desktopIcon":
        return (
          <>
            <InputField label={ct("应用名称", "App Name")} value={editingItem.appName || ""} onChange={(v: string) => setEditingItem({ ...editingItem, appName: v })} />
            <InputField label={ct("192px图标链接", "Icon 192px URL")} value={editingItem.icon192Url || ""} onChange={(v: string) => setEditingItem({ ...editingItem, icon192Url: v })} />
            <InputField label={ct("512px图标链接", "Icon 512px URL")} value={editingItem.icon512Url || ""} onChange={(v: string) => setEditingItem({ ...editingItem, icon512Url: v })} />
            {editingItem.icon192Url && (
              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-1">{ct("图标预览", "Icon Preview")}</p>
                <img src={editingItem.icon192Url} alt="icon preview" className="w-16 h-16 rounded-xl border border-gray-200 object-cover" />
              </div>
            )}
          </>
        );
      default:
        return null;
    }
  };

  const getTabName = (tab: string) => {
    switch (tab) {
      case "banners": return ct("安全守护", "Safety Guard");
      case "live": return ct("直播", "Live");
      case "articles": return ct("文章", "Articles");
      case "marketCategories": return ct("市场类别", "Market Categories");
      case "marketProducts": return ct("市场产品", "Market Products");
      case "marketAd": return ct("市场广告", "Market Ads");
      case "filing": return ct("备案信息", "Filing Info");
      case "aboutUs": return ct("关于我们", "About Us");
      case "privacy": return ct("隐私政策", "Privacy Policy");
      case "terms": return ct("服务条款", "Terms of Service");
      case "appBranding": return ct("应用品牌", "App Branding");
      case "chatContact": return ct("聊天联系", "Chat Contact");
      case "userProfile": return ct("用户资料", "User Profile");
      case "desktopIcon": return ct("桌面图标", "Desktop Icon");
      default: return "";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 状态栏占位 — standalone 模式下用 safe-area-inset-top 撇开 */}
      <div className="bg-emerald-600 safe-top flex-shrink-0" />

      {/* 顶部导航栏 */}
      <div className="bg-emerald-600 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-lg">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={handleGoBack} className="p-1.5 hover:bg-emerald-700 rounded-lg transition-colors flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="font-semibold text-base sm:text-lg truncate">{ct("内容配置管理", "Content Config Manager")}</h1>
        </div>

        <button
          onClick={handleShowSaveDialog}
          disabled={!hasChanges}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors text-sm ${
            hasChanges
              ? "bg-white text-emerald-700 hover:bg-emerald-50 shadow-sm"
              : "bg-emerald-700/50 text-emerald-200 cursor-not-allowed"
          }`}
        >
          <Save className="w-3.5 h-3.5" />
          <span>{ct("保存", "Save")}</span>
        </button>
      </div>

      {/* 标签页 */}
      <div className="bg-white border-b shadow-sm sticky top-[52px] z-30">
        <div className="flex overflow-x-auto">
          {[
            { key: "banners", label: ct("安全守护", "Safety Guard") },
            { key: "live", label: ct("直播列表", "Live") },
            { key: "articles", label: ct("文章列表", "Articles") },
            { key: "marketCategories", label: ct("市场类别", "Categories") },
            { key: "marketProducts", label: ct("市场产品", "Products") },
            { key: "marketAd", label: ct("市场广告", "Ads") },
            { key: "filing", label: ct("备案信息", "Filing") },
            { key: "aboutUs", label: ct("关于我们", "About Us") },
            { key: "privacy", label: ct("隐私政策", "Privacy") },
            { key: "terms", label: ct("服务条款", "Terms") },
            { key: "appBranding", label: ct("应用品牌", "Branding") },
            { key: "chatContact", label: ct("聊天联系", "Chat") },
            { key: "userProfile", label: ct("用户资料", "Profile") },
            { key: "desktopIcon", label: ct("桌面图标", "Desktop Icon") }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50"
                  : "text-gray-600 hover:text-emerald-600 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="p-4 max-w-7xl mx-auto">
        {activeTab === "desktopIcon" ? (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
              {/* App Name */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">{ct("PWA应用名称", "PWA App Name")}</label>
                <input
                  type="text"
                  value={workingConfig.desktopIcon.appName || ""}
                  onChange={(e) => {
                    const newConfig = JSON.parse(JSON.stringify(workingConfig));
                    newConfig.desktopIcon.appName = e.target.value;
                    setWorkingConfig(newConfig);
                    setHasChanges(true);
                  }}
                  placeholder="TaprootAgro"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              {/* Icon 192 URL */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">{ct("192×192 图标链接", "192×192 Icon URL")}</label>
                <input
                  type="text"
                  value={workingConfig.desktopIcon.icon192Url || ""}
                  onChange={(e) => {
                    const newConfig = JSON.parse(JSON.stringify(workingConfig));
                    newConfig.desktopIcon.icon192Url = e.target.value;
                    setWorkingConfig(newConfig);
                    setHasChanges(true);
                  }}
                  placeholder="https://example.com/icon-192.png"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-xs"
                />
              </div>

              {/* Icon 512 URL */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">{ct("512×512 图标链接", "512×512 Icon URL")}</label>
                <input
                  type="text"
                  value={workingConfig.desktopIcon.icon512Url || ""}
                  onChange={(e) => {
                    const newConfig = JSON.parse(JSON.stringify(workingConfig));
                    newConfig.desktopIcon.icon512Url = e.target.value;
                    setWorkingConfig(newConfig);
                    setHasChanges(true);
                  }}
                  placeholder="https://example.com/icon-512.png"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-xs"
                />
              </div>

              {/* Icon Preview */}
              {workingConfig.desktopIcon.icon192Url && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-2">{ct("图标预览", "Icon Preview")}</p>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center gap-1">
                      <img
                        src={workingConfig.desktopIcon.icon192Url}
                        alt="192px"
                        className="w-12 h-12 rounded-xl border border-gray-200 object-cover"
                      />
                      <span className="text-[10px] text-gray-400">192px</span>
                    </div>
                    {workingConfig.desktopIcon.icon512Url && (
                      <div className="flex flex-col items-center gap-1">
                        <img
                          src={workingConfig.desktopIcon.icon512Url}
                          alt="512px"
                          className="w-16 h-16 rounded-xl border border-gray-200 object-cover"
                        />
                        <span className="text-[10px] text-gray-400">512px</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* 操作按钮 */}
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">{getTabName(activeTab)} {ct("管理", "Management")}</h2>
              <button
                onClick={() => handleAddItem(activeTab)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {ct("添加", "Add")}
              </button>
            </div>

            {/* Excel样式表格 */}
            {renderTable()}

            {/* 提示信息 */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">💡 {ct("使用提示", "Tips")}</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• {ct('点击"编辑"按钮可以修改内容', 'Click the "Edit" button to modify content')}</li>
                <li>• {ct('点击"添加"按钮可以新增项目', 'Click the "Add" button to create new items')}</li>
                <li>• {ct('编辑完成后点击右上角"保存"按钮提交更改', 'Click the "Save" button in the top-right to submit changes')}</li>
                <li>• {ct("保存时需要输入验证码确认，防止误操作", "A confirmation code is required when saving to prevent accidental changes")}</li>
                <li>• {ct("未保存的更改在离开页面时会提示确认", "You will be prompted to confirm if leaving with unsaved changes")}</li>
              </ul>
            </div>
          </>
        )}
      </div>

      {/* 编辑对话框 */}
      {renderEditDialog()}

      {/* 保存确认弹窗 */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-emerald-600 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold">{ct("保存配置", "Save Config")}</h3>
              <button onClick={() => setShowSaveDialog(false)} className="text-white hover:bg-emerald-700 rounded-lg p-1">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500">{ct("请输入验证码以确认保存配置", "Enter the code to confirm saving the config")}</p>
              <InputField label={ct("验证码", "Code")} value={savePassword} onChange={(v: string) => setSavePassword(v)} placeholder="taprootagro" />
              {saveError && <p className="text-sm text-red-500">{saveError}</p>}
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex gap-3 justify-end border-t">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                {ct("取消", "Cancel")}
              </button>
              <button
                onClick={handleConfirmSave}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {ct("保存", "Save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



// 输入框组件
function InputField({ label, value, onChange, disabled = false, placeholder = "", type = "text" }: any) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100"
      />
    </div>
  );
}

// 下拉框组件
function SelectField({ label, value, onChange, options }: any) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
      >
        {options.map((option: string) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}

// 文本域组件
function TextAreaField({ label, value, onChange, rows = 6, placeholder = "" }: any) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
      />
    </div>
  );
}