import { Search, ScanLine } from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useHomeConfig } from "../hooks/useHomeConfig";
import { CameraCapture } from "./CameraCapture";
import { MarketAdDetailPage } from "./MarketAdDetailPage";
import { ProductDetailPage } from "./ProductDetailPage";
import type { MarketAdvertisementConfig } from "../hooks/useHomeConfig";

export function MarketPage() {
  const { t } = useLanguage();
  const { config } = useHomeConfig();
  const [showCamera, setShowCamera] = useState(false);
  
  // 二级界面状态管理
  type ViewType = 
    | { type: "market" }
    | { type: "ad"; data: MarketAdvertisementConfig }
    | { type: "product"; data: any };
  
  const [currentView, setCurrentView] = useState<ViewType>({ type: "market" });
  
  // 从配置读取类别和产品
  const categories = config.marketPage.categories || [];
  const products = config.marketPage.products || [];
  const advertisements = config.marketPage.advertisements || [];
  
  // 广告轮播
  const [adIndex, setAdIndex] = useState(0);
  const adTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (advertisements.length <= 1) return;
    adTimerRef.current = setInterval(() => {
      setAdIndex(prev => (prev + 1) % advertisements.length);
    }, 4000);
    return () => { if (adTimerRef.current) clearInterval(adTimerRef.current); };
  }, [advertisements.length]);
  
  // 初始选中第一个一级类别
  const [selectedCategory, setSelectedCategory] = useState(
    categories.length > 0 ? categories[0].id : ""
  );

  // 当配置中的类别变化时，确保 selectedCategory 仍然有效
  useEffect(() => {
    if (categories.length > 0 && !categories.find(cat => cat.id === selectedCategory)) {
      setSelectedCategory(categories[0].id);
    }
  }, [categories, selectedCategory]);
  
  // 获取当前选中类别的子类别列表
  const currentSubCategories = useMemo(() => {
    const category = categories.find(cat => cat.id === selectedCategory);
    return category?.subCategories || [];
  }, [categories, selectedCategory]);

  // 根据一级类别过滤产品，并按二级类别分组
  const groupedProducts = useMemo(() => {
    const filtered = products.filter(product => product.category === selectedCategory);
    
    // 按二级类别分组
    const groups: { [key: string]: any[] } = {};
    currentSubCategories.forEach(subCat => {
      groups[subCat] = filtered.filter(product => product.subCategory === subCat);
    });
    
    return groups;
  }, [products, selectedCategory, currentSubCategories]);

  return (
    <div className="pb-20 h-screen flex flex-col overflow-hidden">
      {/* 二级界面路由 */}
      {currentView.type === "ad" && (
        <MarketAdDetailPage onClose={() => setCurrentView({ type: "market" })} ad={currentView.data} />
      )}
      {currentView.type === "product" && (
        <ProductDetailPage
          onClose={() => setCurrentView({ type: "market" })}
          product={currentView.data}
        />
      )}

      {/* 商城主界面 */}
      {currentView.type === "market" && (
        <>
          {/* 相机捕获界面 */}
          {showCamera && (
            <CameraCapture
              onCapture={(imageData) => {
                console.log("拍摄的图片:", imageData);
                // 这里可以处理拍摄的图片
              }}
              onClose={() => setShowCamera(false)}
            />
          )}

          {/* 搜索栏 - 完全固定在顶部，不参与滚动 */}
          <div className="bg-emerald-600 px-3 py-1.5 z-10 flex-shrink-0">
            <div className="flex gap-2 items-center max-w-screen-xl mx-auto">
              <div className="flex-1 min-w-0 bg-white rounded-full px-3 py-1.5 flex items-center gap-2 h-10">
                <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder={t.market.searchProducts}
                  className="flex-1 min-w-0 outline-none text-xs"
                />
              </div>
              <button 
                onClick={() => setShowCamera(true)}
                className="bg-white w-10 h-10 rounded-full active:scale-95 transition-transform flex items-center justify-center flex-shrink-0"
              >
                <ScanLine className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          {/* 主内容区域：左侧一级类别 + 右侧产品（按二级类别分组） */}
          <div className="flex gap-0 flex-1 overflow-hidden">
            {/* 左侧一级类别栏 - 独立滚动容器 */}
            <div 
              className="w-20 flex-shrink-0 overflow-y-auto z-[5]"
              style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', backgroundColor: 'var(--app-bg)' }}
            >
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => {
                    setSelectedCategory(category.id);
                  }}
                  className={`w-full py-3 px-1 text-xs text-center transition-all duration-200 active:scale-95 relative ${
                    selectedCategory === category.id
                      ? "bg-white text-emerald-600 font-medium shadow-md"
                      : "text-gray-600"
                  }`}
                >
                  {/* 左侧绿色指示条 */}
                  {selectedCategory === category.id && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-emerald-600 rounded-r-full"></div>
                  )}
                  <div className="break-words leading-tight">{category.name}</div>
                </button>
              ))}
            </div>

            {/* 右侧产品区域 - 按二级类别分组显示 */}
            <div 
              className="flex-1 min-w-0 overflow-y-auto bg-white" 
              style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
            >
              {/* 顶部广告轮播 */}
              {advertisements.length > 0 && (
                <div className="mx-3 mt-3">
                  <div className="relative overflow-hidden rounded-lg">
                    <img
                      src={advertisements[adIndex]?.image}
                      alt={advertisements[adIndex]?.title || "广告"}
                      className="w-full aspect-[3/1] object-cover cursor-pointer active:scale-95 transition-transform"
                      onClick={() => setCurrentView({ type: "ad", data: advertisements[adIndex] })}
                    />
                    {/* 广告标题 */}
                    {advertisements[adIndex]?.title && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5 pt-4">
                        <p className="text-white text-[10px] truncate">{advertisements[adIndex].title}</p>
                      </div>
                    )}
                  </div>
                  {/* 指示点 */}
                  {advertisements.length > 1 && (
                    <div className="flex justify-center gap-1 mt-1.5">
                      {advertisements.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setAdIndex(i)}
                          className={`rounded-full transition-all ${
                            i === adIndex ? "w-3 h-1.5 bg-emerald-600" : "w-1.5 h-1.5 bg-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 按二级类别分组显示产品 */}
              <div className="pb-24">
                {currentSubCategories.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p className="text-sm">该类别暂无产品</p>
                  </div>
                ) : (
                  currentSubCategories.map((subCat) => {
                    const productsInSubCat = groupedProducts[subCat] || [];
                    
                    // 如果该子类别没有产品，则不显示
                    if (productsInSubCat.length === 0) return null;
                    
                    return (
                      <div key={subCat} className="mt-4">
                        {/* 二级类别标题 - 无背景 */}
                        <div className="px-3 py-2">
                          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                            <span className="w-1 h-4 bg-emerald-600 rounded-full"></span>
                            {subCat}
                          </h3>
                        </div>
                        
                        {/* 该子类别下的产品网格 */}
                        <div className="px-3 py-2">
                          <div className="grid grid-cols-2 gap-3">
                            {productsInSubCat.map((product) => (
                              <div
                                key={product.id}
                                className="bg-white rounded-xl overflow-hidden active:scale-95 transition-transform shadow-md border border-gray-100"
                                onClick={() => setCurrentView({ type: "product", data: product })}
                              >
                                <img
                                  src={product.image}
                                  alt={product.name}
                                  className="w-full aspect-square object-cover"
                                />
                                <div className="p-2">
                                  <p className="text-xs text-gray-800 font-medium line-clamp-2 break-words min-h-[2rem]">
                                    {product.name}
                                  </p>
                                  <div className="mt-0.5">
                                    <span className="text-sm font-semibold text-emerald-600">{product.price}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// 默认导出用于懒加载
export default MarketPage;