import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { HomePageConfig } from '../hooks/useHomeConfig';

// 默认配置
const defaultConfig: HomePageConfig = {
  banners: [
    {
      id: 1,
      url: "https://images.unsplash.com/photo-1702896781457-1d4f69aebf7e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhZ3JpY3VsdHVyZSUyMGZpZWxkJTIwbGFuZHNjYXBlfGVufDF8fHx8MTc3MDgyMDI3Mnww&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "农业田野风光",
      title: "智慧农业新时代"
    },
    {
      id: 2,
      url: "https://images.unsplash.com/photo-1673200692829-fcdb7e267fc1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYXJtJTIwaGFydmVzdCUyMGNyb3BzfGVufDF8fHx8MTc3MDgyMDI3Mnww&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "农场作物收割",
      title: "丰收季节"
    },
    {
      id: 3,
      url: "https://images.unsplash.com/photo-1591530712751-96e6f5ad73ac?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxncmVlbiUyMHBsYW50cyUyMGZhcm1pbmd8ZW58MXx8fHwxNzcwODIwMjcyfDA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "绿色植物种植",
      title: "绿色生态农业"
    }
  ],
  navigation: [
    { id: 1, icon: "ScanLine", title: "病虫识别", subtitle: "AI智能检测" },
    { id: 2, icon: "Bot", title: "AI助手", subtitle: "智能问答" },
    { id: 3, icon: "Calculator", title: "收益统计", subtitle: "数据分析" },
    { id: 4, icon: "MapPin", title: "农田地图", subtitle: "位置管理" }
  ],
  liveStreams: [
    {
      id: 1,
      title: "水稻种植技术讲解",
      viewers: "1234",
      thumbnail: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=400"
    },
    {
      id: 2,
      title: "有机蔬菜栽培经验分享",
      viewers: "856",
      thumbnail: "https://images.unsplash.com/photo-1605000797499-95a51c5269ae?w=400"
    }
  ],
  articles: [
    {
      id: 1,
      title: "春季小麦施肥管理要点",
      author: "农业专家",
      views: "1.2k",
      category: "种植技术",
      date: "2天前",
      content: "春季是小麦生长的关键时期...",
      thumbnail: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=400"
    },
    {
      id: 2,
      title: "玉米病虫害综合防治技术",
      author: "植保专家",
      views: "856",
      category: "病虫害",
      date: "3天前",
      content: "玉米常见病虫害包括...",
      thumbnail: "https://images.unsplash.com/photo-1605000797499-95a51c5269ae?w=400"
    },
    {
      id: 3,
      title: "西非加纳业10周年纪念日",
      author: "土壤专家",
      views: "642",
      category: "施肥管理",
      date: "5天前",
      content: "科学施肥是提高作物产量的关键...",
      thumbnail: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=400"
    },
    {
      id: 4,
      title: "水稻育秧期温湿度控制技巧",
      author: "种植达人",
      views: "923",
      category: "栽培技术",
      date: "1周前",
      content: "育秧期的温湿度控制直接影响...",
      thumbnail: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=400"
    },
    {
      id: 5,
      title: "现代化智能温室大棚建设方案",
      author: "设施农业专家",
      views: "1.5k",
      category: "设施农业",
      date: "3天前",
      content: "智能温室大棚通过物联网技术...",
      thumbnail: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=400"
    },
    {
      id: 6,
      title: "蔬菜种植中的水肥一体化技术应用",
      author: "灌溉专家",
      views: "789",
      category: "灌溉技术",
      date: "4天前",
      content: "水肥一体化是现代农业的重要技术...",
      thumbnail: "https://images.unsplash.com/photo-1605000797499-95a51c5269ae?w=400"
    },
    {
      id: 7,
      title: "果树修剪与整形关键技术要领",
      author: "果树专家",
      views: "1.1k",
      category: "果树管理",
      date: "6天前",
      content: "果树修剪是果树栽培管理的重要环节...",
      thumbnail: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=400"
    }
  ],
  videoFeed: {
    title: "农业短视频",
    description: "观看最新农业技术视频",
    videoSources: [
      "https://example.com/video1.mp4",
      "https://example.com/video2.mp4"
    ]
  },
  marketPage: {
    categories: [
      {
        id: "herbicide",
        name: "除草剂",
        subCategories: ["苗前苗后", "苗前", "苗中苗后"]
      },
      {
        id: "insecticide",
        name: "杀虫剂",
        subCategories: ["接触性", "内吸性", "胃毒性"]
      },
      {
        id: "fungicide",
        name: "杀菌剂",
        subCategories: ["保护性", "治疗性", "复合型"]
      },
      {
        id: "fertilizer",
        name: "肥料",
        subCategories: ["氮肥", "磷肥", "钾肥"]
      }
    ],
    products: [
      // 除草剂产品
      {
        id: 1,
        name: "强效除草剂 500ml",
        image: "https://placehold.co/400x400/10b981/ffffff?text=TAPROOTAGRO&font=raleway",
        price: "¥68",
        category: "herbicide",
        subCategory: "苗前苗后",
        description: "强效除草剂，适用于苗前和苗后除草",
        stock: 100
      },
      {
        id: 2,
        name: "生态除草剂 1L",
        image: "https://placehold.co/400x400/10b981/ffffff?text=TAPROOTAGRO&font=raleway",
        price: "¥52",
        category: "herbicide",
        subCategory: "苗前",
        description: "环保生态除草剂，苗前使用效果佳",
        stock: 80
      },
      {
        id: 3,
        name: "环保除草剂 300ml",
        image: "https://placehold.co/400x400/10b981/ffffff?text=TAPROOTAGRO&font=raleway",
        price: "¥45",
        category: "herbicide",
        subCategory: "苗中苗后",
        description: "苗中苗后专用除草剂",
        stock: 120
      },
      {
        id: 4,
        name: "高效除草剂 800ml",
        image: "https://placehold.co/400x400/10b981/ffffff?text=TAPROOTAGRO&font=raleway",
        price: "¥72",
        category: "herbicide",
        subCategory: "苗中苗后",
        description: "高效除草，持续时间长",
        stock: 90
      },

      // 杀虫剂产品
      {
        id: 5,
        name: "接触型杀虫剂 600ml",
        image: "https://placehold.co/400x400/10b981/ffffff?text=TAPROOTAGRO&font=raleway",
        price: "¥78",
        category: "insecticide",
        subCategory: "接触性",
        description: "接触即死，快速见效",
        stock: 110
      },
      {
        id: 6,
        name: "速效杀虫喷雾 400ml",
        image: "https://placehold.co/400x400/10b981/ffffff?text=TAPROOTAGRO&font=raleway",
        price: "¥65",
        category: "insecticide",
        subCategory: "接触性",
        description: "速效杀虫，保护作物",
        stock: 95
      },
      {
        id: 7,
        name: "内吸型杀虫剂 800ml",
        image: "https://placehold.co/400x400/10b981/ffffff?text=TAPROOTAGRO&font=raleway",
        price: "¥92",
        category: "insecticide",
        subCategory: "内吸性",
        description: "内吸传导，持效期长",
        stock: 85
      },
      {
        id: 8,
        name: "长效内吸虫剂 1L",
        image: "https://placehold.co/400x400/10b981/ffffff?text=TAPROOTAGRO&font=raleway",
        price: "¥108",
        category: "insecticide",
        subCategory: "内吸性",
        description: "长效保护，一次施用持续有效",
        stock: 70
      },
      {
        id: 9,
        name: "胃毒杀虫颗粒 500g",
        image: "https://placehold.co/400x400/10b981/ffffff?text=TAPROOTAGRO&font=raleway",
        price: "¥58",
        category: "insecticide",
        subCategory: "胃毒性",
        description: "胃毒型杀虫剂，诱杀效果好",
        stock: 130
      },
      {
        id: 10,
        name: "高效胃毒剂 700ml",
        image: "https://placehold.co/400x400/10b981/ffffff?text=TAPROOTAGRO&font=raleway",
        price: "¥75",
        category: "insecticide",
        subCategory: "胃毒性",
        description: "高效胃毒，针对性强",
        stock: 100
      },

      // 杀菌剂产品
      {
        id: 11,
        name: "保护型杀菌剂 500ml",
        image: "https://placehold.co/400x400/10b981/ffffff?text=TAPROOTAGRO&font=raleway",
        price: "¥68",
        category: "fungicide",
        subCategory: "保护性",
        description: "预防病害，保护作物健康",
        stock: 90
      },
      {
        id: 12,
        name: "预防真菌喷雾 600ml",
        image: "https://placehold.co/400x400/10b981/ffffff?text=TAPROOTAGRO&font=raleway",
        price: "¥72",
        category: "fungicide",
        subCategory: "保护性",
        description: "预防真菌感染，提前防护",
        stock: 85
      },
      {
        id: 13,
        name: "治疗型杀菌剂 800ml",
        image: "https://placehold.co/400x400/10b981/ffffff?text=TAPROOTAGRO&font=raleway",
        price: "¥95",
        category: "fungicide",
        subCategory: "治疗性",
        description: "治疗病害，快速恢复",
        stock: 75
      },
      {
        id: 14,
        name: "病害治疗液 1L",
        image: "https://placehold.co/400x400/10b981/ffffff?text=TAPROOTAGRO&font=raleway",
        price: "¥112",
        category: "fungicide",
        subCategory: "治疗性",
        description: "专业治疗各类病害",
        stock: 65
      },
      {
        id: 15,
        name: "复合型杀菌剂 700ml",
        image: "https://placehold.co/400x400/10b981/ffffff?text=TAPROOTAGRO&font=raleway",
        price: "¥88",
        category: "fungicide",
        subCategory: "复合型",
        description: "保护加治疗，双重功效",
        stock: 95
      },
      {
        id: 16,
        name: "全方位杀菌液 900ml",
        image: "https://placehold.co/400x400/10b981/ffffff?text=TAPROOTAGRO&font=raleway",
        price: "¥98",
        category: "fungicide",
        subCategory: "复合型",
        description: "全方位保护，综合防治",
        stock: 80
      },

      // 肥料产品
      {
        id: 17,
        name: "高纯度氮肥 10kg",
        image: "https://placehold.co/400x400/10b981/ffffff?text=TAPROOTAGRO&font=raleway",
        price: "¥125",
        category: "fertilizer",
        subCategory: "氮肥",
        description: "高纯度氮肥，促进叶片生长",
        stock: 150
      },
      {
        id: 18,
        name: "速效氮肥 5kg",
        image: "https://placehold.co/400x400/10b981/ffffff?text=TAPROOTAGRO&font=raleway",
        price: "¥68",
        category: "fertilizer",
        subCategory: "氮肥",
        description: "速效吸收，快速见效",
        stock: 200
      },
      {
        id: 19,
        name: "优质磷肥 10kg",
        image: "https://placehold.co/400x400/10b981/ffffff?text=TAPROOTAGRO&font=raleway",
        price: "¥138",
        category: "fertilizer",
        subCategory: "磷肥",
        description: "促进根系发育和开花结果",
        stock: 120
      },
      {
        id: 20,
        name: "高效磷肥 8kg",
        image: "https://placehold.co/400x400/10b981/ffffff?text=TAPROOTAGRO&font=raleway",
        price: "¥115",
        category: "fertilizer",
        subCategory: "磷肥",
        description: "高效磷肥，增强作物抗性",
        stock: 140
      },
      {
        id: 21,
        name: "精制钾肥 12kg",
        image: "https://placehold.co/400x400/10b981/ffffff?text=TAPROOTAGRO&font=raleway",
        price: "¥145",
        category: "fertilizer",
        subCategory: "钾肥",
        description: "提高产量和品质",
        stock: 110
      },
      {
        id: 22,
        name: "速溶钾肥 6kg",
        image: "https://placehold.co/400x400/10b981/ffffff?text=TAPROOTAGRO&font=raleway",
        price: "¥78",
        category: "fertilizer",
        subCategory: "钾肥",
        description: "速溶钾肥，易吸收利用",
        stock: 180
      }
    ],
    advertisement: {
      id: 1,
      image: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=400",
      title: "农业技术培训",
      link: "https://example.com/training"
    }
  },
  filing: {
    icpNumber: "京ICP备12345678号",
    icpUrl: "http://beian.miit.gov.cn/",
    policeNumber: "京公网安备12345678901234号",
    policeUrl: "http://www.beian.gov.cn/"
  },
  aboutUs: {
    title: "关于我们",
    content: "我们是一家专注于农业技术的公司，致力于提供最先进的农业解决方案。我们的团队由农业专家、工程师和数据分析师组成，致力于推动农业的可持续发展。"
  },
  privacyPolicy: {
    title: "隐私政策",
    content: "我们尊重并保护所有使用我们服务的用户的隐私。本隐私政策解释了我们如何收集、使用、披露和保护您的个人信息。\n\n1. 信息收集：我们可能会收集您的姓名、电子邮件地址、电话号码等个人信息。\n\n2. 信息使用：我们使用收集的信息来提供和改进我们的服务，包括但不限于发送营销信息、处理订单和提供技术支持。\n\n3. 信息共享：我们不会将您的个人信息出售或出租给第三方，除非得到您的明确同意或法律要求。\n\n4. 信息保护：我们采取合理的安全措施来保护您的个人信息，防止未经授权的访问、使用或披露。\n\n5. 您的权利：您有权访问、更正或删除您的个人信息。如果您有任何关于隐私的问题或疑虑，请联系我们。"
  },
  termsOfService: {
    title: "用户协议",
    content: "欢迎使用我们的服务！本用户协议（以下简称"协议"）规定了您使用我们服务的条款和条件。\n\n1. 服务描述：我们提供各种农业技术解决方案，包括但不限于病虫害识别、智能助手、收益统计和农田地图管理。\n\n2. 用户责任：您必须遵守所有适用的法律和法规，并且不得使用我们的服务进行任何非法活动。\n\n3. 服务变更：我们保留随时更改或终止服务的权利，恕不另行通知。\n\n4. 知识产权：我们拥有服务的所有权利、所有权和利益，包括但不限于版权、商标和专利。\n\n5. 责任限制：我们不对因使用或无法使用我们的服务而产生的任何直接、间接、附带、特殊或后果性损害承担责任。\n\n6. 争议解决：因本协议引起的任何争议应通过友好协商解决；协商不成的，应提交至有管辖权的法院解决。\n\n7. 其他条款：本协议的任何条款无效或不可执行的，不影响其他条款的有效性和可执行性。\n\n8. 接受协议：使用我们的服务即表示您接受本协议的所有条款和条件。如果您不同意本协议的任何条款，请不要使用我们的服务。"
  },
  appBranding: {
    logoUrl: "https://images.unsplash.com/photo-1642919854816-98575cbaefa8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaW1wbGUlMjBsZWFmJTIwc2tldGNoJTIwbWluaW1hbCUyMGRyYXdpbmd8ZW58MXx8fHwxNzcwODU0NDU2fDA&ixlib=rb-4.1.0&q=80&w=1080",
    appName: "TaprootAgro",
    slogan: "To be the taproot of smart agro."
  },
  chatContact: {
    name: "建国",
    avatar: "https://images.unsplash.com/photo-1614558097757-bf9aa8fb830e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaW1wbGUlMjBtaW5pbWFsaXN0JTIwYXZhdGFyJTIwc2tldGNoJTIwZHJhd2luZ3xlbnwxfHx8fDE3NzA4NTQxODl8MA&ixlib=rb-4.1.0&q=80&w=1080"
  },
  userProfile: {
    name: "Rick",
    avatar: "https://images.unsplash.com/photo-1642919854816-98575cbaefa8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaW1wbGUlMjBsZWFmJTIwc2tldGNoJTIwbWluaW1hbCUyMGRyYXdpbmd8ZW58MXx8fHwxNzcwODU0NDU2fDA&ixlib=rb-4.1.0&q=80&w=1080"
  }
};

const CONFIG_STORAGE_KEY = "agri_home_config";

interface ConfigContextType {
  config: HomePageConfig;
  saveConfig: (newConfig: HomePageConfig) => void;
  resetConfig: () => void;
  exportConfig: () => void;
  importConfig: (file: File) => Promise<void>;
  defaultConfig: HomePageConfig;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<HomePageConfig>(() => {
    // 从 localStorage 加载配置
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (saved) {
      try {
        const parsedConfig = JSON.parse(saved);
        // 合并默认配置以确保所有字段都存在
        return {
          ...defaultConfig,
          ...parsedConfig,
          marketPage: {
            ...defaultConfig.marketPage,
            ...(parsedConfig.marketPage || {}),
            categories: parsedConfig.marketPage?.categories || defaultConfig.marketPage.categories,
            products: parsedConfig.marketPage?.products || defaultConfig.marketPage.products,
            advertisement: parsedConfig.marketPage?.advertisement || defaultConfig.marketPage.advertisement,
          },
          filing: parsedConfig.filing || defaultConfig.filing,
          aboutUs: parsedConfig.aboutUs || defaultConfig.aboutUs,
          privacyPolicy: parsedConfig.privacyPolicy || defaultConfig.privacyPolicy,
          termsOfService: parsedConfig.termsOfService || defaultConfig.termsOfService,
          appBranding: parsedConfig.appBranding || defaultConfig.appBranding,
          chatContact: parsedConfig.chatContact || defaultConfig.chatContact,
          userProfile: parsedConfig.userProfile || defaultConfig.userProfile
        };
      } catch (e) {
        console.error("Failed to parse config:", e);
        return defaultConfig;
      }
    }
    return defaultConfig;
  });

  // 监听其他标签页的 storage 变化
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === CONFIG_STORAGE_KEY && e.newValue) {
        try {
          const newConfig = JSON.parse(e.newValue);
          setConfig(newConfig);
        } catch (error) {
          console.error("Failed to parse storage change:", error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 保存配置到 localStorage
  const saveConfig = (newConfig: HomePageConfig) => {
    setConfig(newConfig);
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
    // 触发自定义事件，通知同一页面内的其他组件
    window.dispatchEvent(new CustomEvent('configUpdate', { detail: newConfig }));
  };

  // 重置为默认配置
  const resetConfig = () => {
    setConfig(defaultConfig);
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(defaultConfig));
    window.dispatchEvent(new CustomEvent('configUpdate', { detail: defaultConfig }));
  };

  // 导出配置为 JSON 文件
  const exportConfig = () => {
    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `home-config-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 导入配置从 JSON 文件
  const importConfig = (file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string);
          saveConfig(imported);
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  return (
    <ConfigContext.Provider
      value={{
        config,
        saveConfig,
        resetConfig,
        exportConfig,
        importConfig,
        defaultConfig
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}
