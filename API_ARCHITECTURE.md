# TaprootAgro API版本管理架构图

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TaprootAgro PWA                              │
│                     (React 18 + Vite + TailwindCSS v4)              │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     应用层 (React Components)                        │
├─────────────────────────────────────────────────────────────────────┤
│  PWARegister  │  ConfigProvider  │  HomePage  │  MarketPage  │ ... │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
        ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
        │  apiClient   │  │  deepMerge   │  │ useLanguage  │
        │  (统一客户端) │  │  (配置合并)  │  │  (国际化)    │
        └──────────────┘  └──────────────┘  └──────────────┘
                    │
                    ▼
        ┌────────────────────────────────────────────┐
        │         apiClient (API客户端层)             │
        ├────────────────────────────────────────────┤
        │  • 请求去重 (飞行中请求复用)                │
        │  • 网络质量感�� (2G/3G/4G自适应)           │
        │  • 超时控制 (AbortController)              │
        │  • IndexedDB缓存 (idb封装)                 │
        └────────────────────────────────────────────┘
                    │
                    ▼
        ┌────────────────────────────────────────────┐
        │       apiVersion (版本管理层)               │
        ├────────────────────────────────────────────┤
        │  • 版本协商 (v3 → v2 → v1)                 │
        │  • 自动降级 (Fallback Chain)               │
        │  • 响应转换 (Transformer Registry)         │
        │  • 版本持久化 (localStorage)               │
        └────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌──────────────┐        ┌──────────────┐
│ 重试策略层    │        │  缓存策略层   │
├──────────────┤        ├──────────────┤
│ • 指数退避    │        │ • IndexedDB  │
│ • 错误判断    │        │ • TTL管理    │
│ • 最大次数    │        │ • 离线读取   │
└──────────────┘        └──────────────┘
        │                       │
        └───────────┬───────────┘
                    ▼
        ┌────────────────────────────────────────────┐
        │          网络层 (Fetch API)                 │
        ├────────────────────────────────────────────┤
        │  • HTTP请求 (fetch + AbortController)      │
        │  • 请求头注入 (X-API-Version)              │
        │  • 响应头解析 (X-API-Version)              │
        └────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API服务端                                       │
├─────────────────────────────────────────────────────────────────────┤
│  Supabase Edge Functions  │  Remote Config CDN  │  Chat Proxy API  │
└─────────────────────────────────────────────────────────────────────┘
```

## 🔄 版本协商流程

```
客户端                                    服务端
  │                                        │
  │  1. 构建请求                           │
  │  ─────────────────────────────────>   │
  │  Headers:                              │
  │    X-API-Version: v3                   │
  │    X-Client-Supported-Versions: v3,v2,v1 │
  │  Body:                                 │
  │    { apiVersion: 'v3', ... }           │
  │                                        │
  │                                   2. 版本检查
  │                                        │
  │                                   v3可用？
  │                                   ├─ YES → 返回v3
  │                                   └─ NO  → 检查v2
  │                                        │
  │                                   v2可用？
  │                                   ├─ YES → 返回v2
  │                                   └─ NO  → 检查v1
  │                                        │
  │  3. 接收响应                           │
  │  <─────────────────────────────────   │
  │  Headers:                              │
  │    X-API-Version: v2 (实际版本)        │
  │  Body:                                 │
  │    { ... v2格式数据 }                  │
  │                                        │
  │  4. 版本转换                           │
  │  查找转换器: v2 → v3                   │
  │  应用转换: transformV2ToV3(data)       │
  │  返回: v3格式数据                       │
  │                                        │
  │  5. 保存成功版本                       │
  │  localStorage.set('last_success', 'v2') │
  │  (下次优先使用v2)                       │
  │                                        │
```

## 💾 缓存架构

```
┌──────────────────────────────────────────────────────────────┐
│                    缓存层架构                                 │
└──────────────────────────────────────────────────────────────┘

请求到达
   │
   ▼
┌─────────────────────┐
│ 1. 请求去重检查      │
│   飞行中请求？       │
└─────────────────────┘
   │
   ├─ YES → 复用Promise
   │         (无需重复请求)
   │
   └─ NO → 继续
           │
           ▼
   ┌─────────────────────┐
   │ 2. IndexedDB查询     │
   │   缓存命中？         │
   └─────────────────────┘
           │
           ├─ YES → 检查TTL
           │         │
           │         ├─ 未过期 → 返回缓存数据 ✅
           │         └─ 已过期 → 继续网络请求
           │
           └─ NO → 继续
                   │
                   ▼
           ┌─────────────────────┐
           │ 3. 网络请求          │
           │   (带版本协商)       │
           └─────────────────────┘
                   │
                   ├─ 成功 → 写入IndexedDB
                   │         返回数据 ✅
                   │
                   └─ 失败 → 重试策略
                             │
                             ├─ 重试成功 → 返回数据 ✅
                             │
                             └─ 重试失败
                                   │
                                   └─ 离线Fallback？
                                       │
                                       ├─ YES → 返回过期缓存 ⚠️
                                       └─ NO  → 抛出错误 ❌
```

## 🔁 重试策略（指数退避）

```
初始请求失败
   │
   ▼
┌──────────────────────┐
│ 是否可重试？          │
│ • 网络错误：YES       │
│ • 408/500/502：YES    │
│ • 404/401：NO         │
└──────────────────────┘
   │
   └─ 可重试 → 第1次重试
               delay = 1s
               │
               ├─ 成功 → 返回 ✅
               │
               └─ 失败 → 第2次重试
                         delay = 2s (1s × 2)
                         │
                         ├─ 成功 → 返回 ✅
                         │
                         └─ 失败 → 第3次重试
                                   delay = 4s (2s × 2)
                                   │
                                   ├─ 成功 → 返回 ✅
                                   │
                                   └─ 失败 → 检查离线fallback
                                             │
                                             ├─ 有过期缓存 → 返回 ⚠️
                                             └─ 无缓存 → 抛出错误 ❌
```

## 📊 配置深度Merge流程

```
defaultConfig (默认值)
   +
customConfig (用户配置)
   │
   ▼
deepMerge(defaults, custom, MERGE_DEEP)
   │
   ├─ 遍历custom的每个key
   │   │
   │   ├─ value是对象？
   │   │   └─ YES → 递归合并 merge(defaults[key], custom[key])
   │   │   └─ NO  → 继续检查
   │   │
   │   ├─ value是数组？
   │   │   └─ 策略选择:
   │   │       ├─ replace: 完全替换
   │   │       ├─ merge: 按索引合并
   │   │       └─ append: 追加去重
   │   │
   │   ├─ value是null/undefined？
   │   │   └─ 策略选择:
   │   │       ├─ skip: 保留defaults值
   │   │       └─ overwrite: 覆盖为null/undefined
   │   │
   │   └─ 基本类型
   │       └─ 直接覆盖
   │
   ▼
合并结果（深度合并后的完整配置）

示例：
defaults = {
  app: { name: 'TaprootAgro', theme: { color: '#059669', size: 14 } },
  features: ['market', 'ai']
}

custom = {
  app: { theme: { size: 16 } },
  features: ['weather']
}

结果（MERGE_DEEP）:
{
  app: {
    name: 'TaprootAgro',      // 保留
    theme: {
      color: '#059669',        // 保留
      size: 16                 // 覆盖
    }
  },
  features: ['weather']        // 替换（replace策略）
}

结果（MERGE_APPEND）:
{
  app: { ... 同上 },
  features: ['market', 'ai', 'weather']  // 追加去重
}
```

## 🌐 网络质量感知

```
navigator.connection.effectiveType
   │
   ├─ '4g' / 'wifi'
   │   └─ 高质量网络
   │       ├─ 超时: 10s
   │       ├─ 重试次数: 3
   │       └─ 缓存TTL: 标准
   │
   ├─ '3g'
   │   └─ 中等网络
   │       ├─ 超时: 20s
   │       ├─ 重试次数: 2
   │       └─ 缓存TTL: 延长
   │
   └─ '2g' / 'slow-2g'
       └─ 低质量网络（非洲农户）
           ├─ 超时: 30s
           ├─ 重试次数: 1
           ├─ 缓存TTL: 最长
           └─ 离线fallback: 强制启用
```

## 🔐 数据流示例（完整案例）

### 场景：PWA启动时获取远程配置

```
1. PWARegister.tsx
   ↓
2. checkRemoteConfig()
   ↓
3. apiClient<RolloutConfig>({
     endpoint: 'https://www.taprootagro.com/config.json',
     preferredVersion: 'v3',
     enableFallback: true,
     cache: true,
     cacheTTL: 24h,
     offlineFallback: true,
   })
   ↓
4. 请求去重检查
   ├─ 飞行中？→ 复用Promise ✅
   └─ 否 → 继续
   ↓
5. IndexedDB缓存查询
   ├─ 命中 + 未过期？→ 返回缓存 ✅
   └─ 否 → 继续
   ↓
6. 网络质量检测
   ├─ 2G → timeout=30s
   ├─ 3G → timeout=20s
   └─ 4G → timeout=10s
   ↓
7. 版本协商请求
   Headers: X-API-Version: v3
   ↓
8. 服务端响应
   Headers: X-API-Version: v2 (降级)
   Body: { version: 'v9', features: {...} }
   ↓
9. 版本转换
   v2 → v3: applyTransform(data, 'v2', 'v3')
   ↓
10. 写入IndexedDB缓存
    key: config.json
    ttl: 24h
    version: v2
    ↓
11. 保存最后成功版本
    localStorage.set('last_success_config.json', 'v2')
    ↓
12. 返回数据
    {
      data: { version: 'v9', features: {...} },
      apiVersion: 'v2',
      fallback: true,
      transformed: true,
    }
    ↓
13. 应用配置
    localStorage.set('taproot_remote_config', JSON.stringify(config))
    notifyConfigUpdated(config)
    ↓
14. 全局响应
    useRemoteConfig() → 更新
    ConfigProvider → 深度merge
    所有组件 → 刷新
```

## 📦 文件依赖关系

```
PWARegister.tsx
   │
   ├─ import { apiClient } from '../utils/apiClient'
   └─ import { notifyConfigUpdated } from '../hooks/useRemoteConfig'

ConfigProvider.tsx
   │
   ├─ import { deepMerge, MERGE_DEEP } from '../utils/deepMerge'
   └─ import type { HomePageConfig } from './useHomeConfig'

apiClient.ts
   │
   ├─ import { apiCallWithVersion } from './apiVersion'
   ├─ import { openDB } from 'idb'
   └─ export { apiClient, apiGet, apiPost, clearCache, getCacheStats }

apiVersion.ts
   │
   ├─ import { deepMerge } from './deepMerge'
   └─ export { apiCallWithVersion, registerTransformer, fetchConfigWithVersion }

deepMerge.ts
   │
   └─ export { deepMerge, deepMergeAll, MERGE_DEEP, MERGE_APPEND, ... }
```

## 🎯 关键设计决策

### 1. 为什么使用IndexedDB而非localStorage？

- ✅ 无5MB限制（适合大配置、翻译包）
- ✅ 异步API（不阻塞主线程）
- ✅ 结构化数据（原生支持对象）
- ✅ 事务支持（数据一致性）

### 2. 为什么使用版本协商而非硬编码？

- ✅ 平滑升级（旧客户端兼容新服务端）
- ✅ 灰度发布（部分用户使用新版本）
- ✅ 紧急回滚（服务端降级到旧版本）
- ✅ A/B测试（不同版本对比）

### 3. 为什么使用深度merge而非Object.assign？

- ✅ 保留嵌套字段（避免丢失配置）
- ✅ 数组策略（append/merge/replace）
- ✅ 空值处理（null/undefined策略）
- ✅ 类型安全（TypeScript支持）

### 4. 为什么使用指数退避而非固定延迟？

- ✅ 快速失败（初次快速重试）
- ✅ 避免雪崩（后续延长间隔）
- ✅ 节省流量（低端设备友好）
- ✅ 服务端友好（减轻压力）

---

**架构版本**: v2.0.0  
**最后更新**: 2026-03-09  
**维护者**: TaprootAgro Team
