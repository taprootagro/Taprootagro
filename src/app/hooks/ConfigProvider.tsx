import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { HomePageConfig } from './useHomeConfig';

/**
 * ConfigProvider - 全局配置单例 Context
 * 
 * 解决 useHomeConfig 多实例问题：
 *   Keep-Alive 模式下 4 个 tab 页面各自调用 useHomeConfig()，
 *   每个实例独立 useState + JSON.parse + 事件监听 = 4 倍内存和事件开销。
 * 
 * 改为 Context Provider 在 Root 层提供单一数据源，
 * 所有子组件通过 useContext 共享同一份配置对象。
 */

const CONFIG_STORAGE_KEY = 'agri_home_config';

interface ConfigContextType {
  config: HomePageConfig;
  saveConfig: (newConfig: HomePageConfig) => void;
  resetConfig: () => void;
  exportConfig: () => void;
  importConfig: (file: File) => Promise<void>;
  defaultConfig: HomePageConfig;
}

const ConfigContext = createContext<ConfigContextType | null>(null);

// 默认配置从 useHomeConfig 导出（避免重复定义）
// 这里动态导入以避免循环依赖
let _defaultConfig: HomePageConfig | null = null;

function getDefaultConfig(): HomePageConfig {
  if (_defaultConfig) return _defaultConfig;
  // 将在 Provider 初始化时设置
  return {} as HomePageConfig;
}

export function ConfigProvider({ children, defaultConfig }: { children: ReactNode; defaultConfig: HomePageConfig }) {
  _defaultConfig = defaultConfig;
  
  const [config, setConfig] = useState<HomePageConfig>(() => {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return mergeConfig(defaultConfig, parsed);
      } catch (e) {
        console.error('[ConfigProvider] Failed to parse config:', e);
        return defaultConfig;
      }
    }
    return defaultConfig;
  });

  // 监听配置更新事件（来自其他 tab 或 ConfigManagerPage）
  useEffect(() => {
    const handleConfigUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<HomePageConfig>;
      if (customEvent.detail) {
        setConfig(customEvent.detail);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === CONFIG_STORAGE_KEY && e.newValue) {
        try {
          setConfig(JSON.parse(e.newValue));
        } catch { /* ignore */ }
      }
    };

    window.addEventListener('configUpdate', handleConfigUpdate);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('configUpdate', handleConfigUpdate);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const saveConfig = useCallback((newConfig: HomePageConfig) => {
    setConfig(newConfig);
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
    window.dispatchEvent(new CustomEvent('configUpdate', { detail: newConfig }));
  }, []);

  const resetConfig = useCallback(() => {
    setConfig(defaultConfig);
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(defaultConfig));
    window.dispatchEvent(new CustomEvent('configUpdate', { detail: defaultConfig }));
  }, [defaultConfig]);

  const exportConfigFn = useCallback(() => {
    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `home-config-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [config]);

  const importConfigFn = useCallback((file: File) => {
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
  }, [saveConfig]);

  return (
    <ConfigContext.Provider value={{
      config,
      saveConfig,
      resetConfig,
      exportConfig: exportConfigFn,
      importConfig: importConfigFn,
      defaultConfig,
    }}>
      {children}
    </ConfigContext.Provider>
  );
}

/** 从 Context 获取配置（推荐） */
export function useConfigContext(): ConfigContextType {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error('useConfigContext must be used within ConfigProvider');
  }
  return ctx;
}

/** 深度合并配置，确保所有字段都存在 */
function mergeConfig(defaults: HomePageConfig, parsed: Partial<HomePageConfig>): HomePageConfig {
  return {
    ...defaults,
    ...parsed,
    marketPage: {
      ...defaults.marketPage,
      ...(parsed.marketPage || {}),
      categories: parsed.marketPage?.categories || defaults.marketPage.categories,
      products: parsed.marketPage?.products || defaults.marketPage.products,
      advertisements: parsed.marketPage?.advertisements ||
        ((parsed.marketPage as any)?.advertisement ? [(parsed.marketPage as any).advertisement] : defaults.marketPage.advertisements),
    },
    filing: parsed.filing || defaults.filing,
    aboutUs: parsed.aboutUs || defaults.aboutUs,
    privacyPolicy: parsed.privacyPolicy || defaults.privacyPolicy,
    termsOfService: parsed.termsOfService || defaults.termsOfService,
    appBranding: parsed.appBranding || defaults.appBranding,
    chatContact: {
      ...defaults.chatContact,
      ...(parsed.chatContact || {}),
    },
    userProfile: parsed.userProfile || defaults.userProfile,
    desktopIcon: {
      ...defaults.desktopIcon,
      ...(parsed.desktopIcon || {}),
    },
    pushConfig: parsed.pushConfig || defaults.pushConfig,
    pushProvidersConfig: parsed.pushProvidersConfig || defaults.pushProvidersConfig,
    aiModelConfig: parsed.aiModelConfig || defaults.aiModelConfig,
    cloudAIConfig: parsed.cloudAIConfig || defaults.cloudAIConfig,
    backendProxyConfig: parsed.backendProxyConfig || defaults.backendProxyConfig,
    loginConfig: parsed.loginConfig || defaults.loginConfig,
  };
}
