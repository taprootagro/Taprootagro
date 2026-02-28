import { useNavigate } from "react-router";
import React, { useState } from "react";
import { useHomeConfig } from "../hooks/useHomeConfig";
import { useLanguage } from "../hooks/useLanguage";
import { ArrowLeft, Download, Upload, RotateCcw, Plus, Trash2, Save, Edit3 } from "lucide-react";
import type { 
  BannerConfig, 
  NavigationItem, 
  LiveStreamConfig, 
  ArticleConfig,
  MarketCategoryConfig,
  MarketProductConfig,
  MarketAdvertisementConfig
} from "../hooks/useHomeConfig";

export default function ConfigManagerPage() {
  const navigate = useNavigate();
  const { config, saveConfig, resetConfig, exportConfig, importConfig } = useHomeConfig();
  const { t, isChinese } = useLanguage();
  const [activeTab, setActiveTab] = useState<"banners" | "live" | "articles" | "marketCategories" | "marketProducts" | "marketAd" | "filing" | "aboutUs" | "privacy" | "terms" | "appBranding" | "chatContact" | "userProfile">("banners");
  const [editingItem, setEditingItem] = useState<any>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // 双语辅助：中文环境显示中文，其他语言显示英文
  const ct = (zh: string, en: string) => isChinese ? zh : en;

  // 处理文件导入
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importConfig(file)
        .then(() => {
          alert(ct("配置导入成功！", "Config imported successfully!"));
          setHasChanges(false);
        })
        .catch((error) => {
          alert(ct(`导入失败: ${error.message}`, `Import failed: ${error.message}`));
        });
    }
  };

  // 处理重置
  const handleReset = () => {
    if (confirm(ct("确定要重置为默认配置吗？这将清除所有自定义设置。", "Reset to default config? This will clear all custom settings."))) {
      resetConfig();
      setHasChanges(false);
      alert(ct("已重置为默认配置", "Reset to default config"));
    }
  };

  // 自动更新所有产品图片为TAPROOTAGRO品牌图片
  const autoUpdateAllProductImages = () => {
    const updatedConfig = {
      ...config,
      marketPage: {
        ...config.marketPage,
        products: config.marketPage.products.map(product => ({
          ...product,
          image: "https://placehold.co/400x400/10b981/ffffff?text=TAPROOTAGRO&font=raleway"
        }))
      }
    };
    saveConfig(updatedConfig);
  };

  // 处理返回并自动更新产品图片
  const handleGoBack = () => {
    autoUpdateAllProductImages();
    navigate("/home/profile");
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
      default:
        return {};
    }
  };

  // 获取当前标签的数据
  const getItemsByType = (type: string) => {
    if (!config || !config.marketPage) {
      return [];
    }
    switch (type) {
      case "banners": return config.banners || [];
      case "live": return config.liveStreams || [];
      case "articles": return config.articles || [];
      case "marketCategories": return config.marketPage.categories || [];
      case "marketProducts": return config.marketPage.products || [];
      case "marketAd":
        return config.marketPage.advertisements || [];
      case "filing": return config.filing ? [config.filing] : [];
      case "aboutUs": return config.aboutUs ? [config.aboutUs] : [];
      case "privacy": return config.privacyPolicy ? [config.privacyPolicy] : [];
      case "terms": return config.termsOfService ? [config.termsOfService] : [];
      case "appBranding": return config.appBranding ? [config.appBranding] : [];
      case "chatContact": return config.chatContact ? [config.chatContact] : [];
      case "userProfile": return config.userProfile ? [config.userProfile] : [];
      default: return [];
    }
  };

  // 保存编辑
  const handleSaveEdit = () => {
    if (!editingItem) return;

    // 深拷贝配置，避免直接修改原数组引用导致 React 检测不到变化
    const newConfig = JSON.parse(JSON.stringify(config)) as typeof config;
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
      }
    }

    saveConfig(newConfig);
    setEditingItem(null);
    setHasChanges(false);
  };

  // 删除项
  const handleDeleteItem = (id: number | string) => {
    if (!confirm(ct("确定要删除这项吗？", "Are you sure you want to delete this item?"))) return;

    const newConfig = JSON.parse(JSON.stringify(config)) as typeof config;
    switch (activeTab) {
      case "banners":
        newConfig.banners = config.banners.filter(item => item.id !== id);
        break;
      case "live":
        newConfig.liveStreams = config.liveStreams.filter(item => item.id !== id);
        break;
      case "articles":
        newConfig.articles = config.articles.filter(item => item.id !== id);
        break;
      case "marketCategories":
        newConfig.marketPage.categories = config.marketPage.categories.filter(item => item.id !== id);
        break;
      case "marketProducts":
        newConfig.marketPage.products = config.marketPage.products.filter(item => item.id !== id);
        break;
      case "marketAd":
        newConfig.marketPage.advertisements = (config.marketPage.advertisements || []).filter(item => item.id !== id);
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
    }

    saveConfig(newConfig);
    setHasChanges(false);
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
            <TextAreaField label={ct("内容", "Content")} value={editingItem.content || ""} onChange={(v: string) => setEditingItem({ ...editingItem, content: v })} />
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
            <TextAreaField label={ct("文章内容", "Article Content")} value={editingItem.content || ""} onChange={(v: string) => setEditingItem({ ...editingItem, content: v })} />
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
            <TextAreaField label={ct("详细说明", "Detailed Description")} value={editingItem.details || ""} onChange={(v: string) => setEditingItem({ ...editingItem, details: v })} rows={4} placeholder={ct("产品的详细介绍", "Detailed product introduction")} />
            <TextAreaField label={ct("产品规格", "Specifications")} value={editingItem.specifications || ""} onChange={(v: string) => setEditingItem({ ...editingItem, specifications: v })} rows={3} placeholder={ct("规格参数，如：500ml，有效成分等", "Specs, e.g. 500ml, active ingredients")} />
          </>
        );
      case "marketAd":
        return (
          <>
            <InputField label="ID" value={editingItem.id} disabled />
            <InputField label={ct("广告标题", "Ad Title")} value={editingItem.title} onChange={(v: string) => setEditingItem({ ...editingItem, title: v })} />
            <TextAreaField label={ct("广告内容", "Ad Content")} value={editingItem.content || ""} onChange={(v: string) => setEditingItem({ ...editingItem, content: v })} rows={6} placeholder={ct("输入广告详情内容，支持换行", "Enter ad details, line breaks supported")} />
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
            <TextAreaField label={ct("关于我们内容", "About Us Content")} value={editingItem.content || ""} onChange={(v: string) => setEditingItem({ ...editingItem, content: v })} />
          </>
        );
      case "privacy":
        return (
          <>
            <InputField label="ID" value={editingItem.id} disabled />
            <TextAreaField label={ct("隐私政策内容", "Privacy Policy Content")} value={editingItem.content || ""} onChange={(v: string) => setEditingItem({ ...editingItem, content: v })} />
          </>
        );
      case "terms":
        return (
          <>
            <InputField label="ID" value={editingItem.id} disabled />
            <TextAreaField label={ct("服务条款内容", "Terms of Service Content")} value={editingItem.content || ""} onChange={(v: string) => setEditingItem({ ...editingItem, content: v })} />
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
      default: return "";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <div className="bg-emerald-600 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-lg">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={handleGoBack} className="p-1.5 hover:bg-emerald-700 rounded-lg transition-colors flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="font-semibold text-base sm:text-lg truncate">{ct("内容配置管理", "Content Config Manager")}</h1>
        </div>

        <div className="flex gap-2">
          <button
            onClick={exportConfig}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 rounded-lg flex items-center gap-1.5 transition-colors text-sm"
            title={ct("导出配置", "Export Config")}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{ct("导出", "Export")}</span>
          </button>
          
          <label className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer text-sm">
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{ct("导入", "Import")}</span>
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>

          <button
            onClick={handleReset}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-1.5 transition-colors text-sm"
            title={ct("重置为默认", "Reset to Default")}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{ct("重置", "Reset")}</span>
          </button>
        </div>
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
            { key: "userProfile", label: ct("用户资料", "Profile") }
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
            <li>• {ct('点击"导出"可以将配置保存为JSON文件', 'Click "Export" to save config as a JSON file')}</li>
            <li>• {ct('点击"导入"可以从JSON文件恢复配置', 'Click "Import" to restore config from a JSON file')}</li>
            <li>• {ct("所有修改会自动保存到浏览器本地存储", "All changes are auto-saved to browser local storage")}</li>
          </ul>
        </div>
      </div>

      {/* 编辑对话框 */}
      {renderEditDialog()}
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
