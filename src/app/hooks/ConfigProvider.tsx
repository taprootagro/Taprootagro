import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { HomePageConfig } from './useHomeConfig';
import { deepMerge, MERGE_DEEP } from '../utils';
import { storageGetJSON, storageSetJSON } from '../utils/safeStorage';

/**
 * ConfigProvider - 全局配置单例 Context
 * 
 * 解决 useHomeConfig 多实例问题：
 *   Keep-Alive 模式下 4 个 tab 页面各自调用 useHomeConfig()，
 *   每个实例独立 useState + JSON.parse + 事件监听 = 4 倍内存和事件开销。
 * 
 * 改为 Context Provider 在 Root 层提供单一数据源，
 * 所有子组件通过 useContext 共享同一份配置对象。
 * 
 * v2 更新：使用深度merge工具替代浅层合并，支持嵌套对象完整合并。
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
    const parsed = storageGetJSON<HomePageConfig>(CONFIG_STORAGE_KEY);
    if (parsed) {
      return deepMerge(defaultConfig, parsed, MERGE_DEEP);
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
    storageSetJSON(CONFIG_STORAGE_KEY, newConfig);
    window.dispatchEvent(new CustomEvent('configUpdate', { detail: newConfig }));
  }, []);

  const resetConfig = useCallback(() => {
    setConfig(defaultConfig);
    storageSetJSON(CONFIG_STORAGE_KEY, defaultConfig);
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