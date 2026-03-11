# TaprootAgro API版本兼容 + 配置深度Merge系统

## 📋 概述

本次优化（第⑤项）为TaprootAgro实现了完整的API版本管理和配置深度合并系统，面向全球低端设备用户（特别是非洲2G/3G网络环境）提供韧性优化。

## 🎯 核心功能

### 1. API版本管理 (`/src/app/utils/apiVersion.ts`)

- ✅ **自动版本协商**: 客户端声明支持的版本，服务端返回可用版本
- ✅ **降级fallback链**: v3 → v2 → v1 自动降级
- ✅ **响应格式转换**: 旧版本API响应自动转换为新版本schema
- ✅ **离线持久化**: 最后成功版本保存到localStorage，离线恢复时优先使用
- ✅ **版本转换器注册表**: 可扩展的版本转换函数系统

#### 预定义转换器

```typescript
// Remote Config: v1 → v2
// v1: featureFlags → v2: features

// Chat Token: v1 → v2
// v1: { token, appKey } → v2: { token, appId, uid }

// Chat Messages: v1 → v2
// v1: 秒级时间戳 → v2: 毫秒级时间戳
```

### 2. 统一API客户端 (`/src/app/utils/apiClient.ts`)

整合版本管理、错误重试、离线缓存、网络质量感知的API调用封装。

#### 核心特性

- ✅ **IndexedDB缓存**: 替代localStorage，支持大数据量（默认5分钟TTL）
- ✅ **指数退避重试**: 网络错误、超时自动重试（最大3次，初始延迟1s）
- ✅ **网络质量感知**: 
  - 2G: 30s超时
  - 3G: 20s超时
  - 4G: 10s超时
- ✅ **请求去重**: 防止重复调用（飞行中请求复用）
- ✅ **离线fallback**: 离线时使用过期缓存
- ✅ **超时控制**: AbortController实现请求超时

#### 便捷API

```typescript
// GET请求（自动缓存）
const data = await apiGet('/api/config');

// POST请求
const result = await apiPost('/api/user/update', { name: 'John' });

// 清除缓存
await clearCache('/api/config'); // 单个endpoint
await clearCache(); // 所有缓存

// 缓存统计
const stats = await getCacheStats();
console.log(`缓存条目数: ${stats.count}`);
```

### 3. 深度配置Merge (`/src/app/utils/deepMerge.ts`)

递归深度合并配置对象，解决`ConfigProvider`浅层merge的局限性。

#### 功能特性

- ✅ **递归合并嵌套对象**: 无限层级支持
- ✅ **数组合并策略**: 
  - `replace`: 完全替换（默认）
  - `merge`: 按索引合并
  - `append`: 追加去重
- ✅ **空值处理**: 
  - `nullStrategy`: keep | overwrite
  - `undefinedStrategy`: skip | overwrite
- ✅ **循环引用检测**: WeakMap追踪
- ✅ **克隆模式**: 避免引用污染

#### 预设策略

```typescript
import { deepMerge, MERGE_DEEP, MERGE_APPEND, MERGE_CONSERVATIVE } from './deepMerge';

// 深度合并（数组按索引合并）
const merged = deepMerge(defaults, custom, MERGE_DEEP);

// 追加模式（数组去重追加）
const merged = deepMerge(defaults, custom, MERGE_APPEND);

// 保守模式（保留null，跳过undefined）
const merged = deepMerge(defaults, custom, MERGE_CONSERVATIVE);
```

## 🔧 集成点

### 1. ConfigProvider（已更新）

```typescript
// /src/app/hooks/ConfigProvider.tsx
import { deepMerge, MERGE_DEEP } from '../utils/deepMerge';

const [config, setConfig] = useState<HomePageConfig>(() => {
  const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    // 使用深度merge替代浅层合并
    return deepMerge(defaultConfig, parsed, MERGE_DEEP);
  }
  return defaultConfig;
});
```

### 2. PWARegister（已更新）

```typescript
// /src/app/components/PWARegister.tsx
import { apiClient } from '../utils/apiClient';

const response = await apiClient<RolloutConfig>({
  endpoint: REMOTE_CONFIG_URL,
  method: 'GET',
  preferredVersion: 'v3',
  enableFallback: true,
  cache: true,
  cacheTTL: 24 * 60 * 60 * 1000, // 24小时
  offlineFallback: true,
  retry: { maxRetries: 2 },
  validateResponse: (data) => typeof data === 'object' && data !== null,
});
```

## 📊 版本协商流程

```
客户端请求
  ├─ Headers: X-API-Version: v3
  ├─ Headers: X-Client-Supported-Versions: v3,v2,v1
  ├─ Body: { apiVersion: 'v3', supportedVersions: ['v3','v2','v1'], ... }
  │
  v
服务端处理
  ├─ 检查v3是否可用
  │   ├─ 可用 → 返回v3响应 + Header: X-API-Version: v3
  │   └─ 不可用 → fallback到v2
  │       ├─ 可用 → 返回v2响应 + Header: X-API-Version: v2
  │       └─ 不可用 → fallback到v1
  │
  v
客户端处理
  ├─ 读取 X-API-Version 响应头
  ├─ 如果版本 != 请求版本 → 查找转换器
  │   └─ 应用转换: v2 data → v3 format
  ├─ 保存成功版本到localStorage（下次优先使用）
  └─ 返回统一格式数据
```

## 📈 性能优化

### 低端设备适配

1. **网络质量感知**: 根据`navigator.connection.effectiveType`自动调整超时
2. **请求去重**: 避免重复API调用（特别是GET请求）
3. **IndexedDB缓存**: 减少网络请求，支持离线使用
4. **指数退避**: 网络失败时避免频繁重试（节省流量）

### 缓存策略

```typescript
// 远程配置: 24小时缓存 + 离线fallback
await apiGet('/api/config', {
  cache: true,
  cacheTTL: 24 * 60 * 60 * 1000,
  offlineFallback: true,
});

// 实时数据: 5分钟缓存
await apiGet('/api/weather', {
  cache: true,
  cacheTTL: 5 * 60 * 1000,
});

// 敏感操作: 禁用缓存
await apiPost('/api/payment', data, {
  cache: false,
});
```

## 🛠️ 自定义版本转换器

```typescript
import { registerTransformer } from './apiVersion';

// 注册产品API v1 → v2 转换器
registerTransformer<Product[]>(
  '/api/products',
  'v1',
  'v2',
  (data: any) => {
    return data.items.map((p: any) => ({
      id: p.product_id,
      name: p.product_name,
      price: p.price_amount / 100, // v1分 → v2元
    }));
  }
);

// 使用时自动转换
const products = await apiGet<Product[]>('/api/products', {
  preferredVersion: 'v2',
  transformTo: 'v2', // 如果返回v1，自动转换
});
```

## 📚 使用示例

详见 `/src/app/utils/apiVersion.example.ts`，包含10个完整实战案例：

1. 基础GET请求
2. POST请求（带版本协商）
3. 自定义版本转换器
4. 配置深度merge
5. 远程配置获取
6. 低端设备优化
7. 缓存管理
8. 响应验证与自动降级
9. 离线优先策略
10. 完整实战案例（聊天消息）

## 🔍 调试技巧

### 查看版本协商过程

```typescript
const response = await apiClient({
  endpoint: '/api/data',
  preferredVersion: 'v3',
  enableFallback: true,
});

console.log('API版本:', response.apiVersion);
console.log('是否降级:', response.fallback);
console.log('请求版本:', response.requestedVersion);
console.log('是否转换:', response.transformed);
```

### 查看缓存状态

```typescript
import { getCacheStats, clearCache } from './apiClient';

// 查看缓存统计
const stats = await getCacheStats();
console.log(`缓存条目: ${stats.count}`);
stats.entries.forEach(url => console.log(`- ${url}`));

// 清除特定缓存
await clearCache('/api/old-data');
```

### 查看最后成功版本

```typescript
import { getLastSuccessVersion } from './apiVersion';

const lastVersion = getLastSuccessVersion('/api/remote-config');
console.log(`最后成功版本: ${lastVersion}`);
```

## ⚠️ 注意事项

### 1. 避免回归问题

- ✅ 所有import已验证（React hooks, idb等）
- ✅ 无重复import
- ✅ 类型安全（TypeScript严格模式）

### 2. 服务端配合

API服务端需支持以下响应头：

```
X-API-Version: v2
X-Supported-Versions: v3,v2,v1 (可选)
```

### 3. 缓存清理

定期清理过期缓存（建议在App启动时）：

```typescript
// 启动时清理7天前的缓存
const cleanOldCache = async () => {
  const stats = await getCacheStats();
  // 可根据timestamp字段筛选过期条目
};
```

## 🚀 后续优化建议

1. ✅ **第⑥项**: 崩溃上报beacon（下一步）
2. ⚡ **WebSocket版本协商**: 为实时通信添加版本支持
3. 📊 **监控仪表盘**: 统计版本使用率、降级频率
4. 🔄 **自动A/B测试**: 基于版本的灰度发布

## 🎉 总结

本次优化完成了第⑤项"API版本兜底+配置深度merge"，为TaprootAgro提供了：

- ✅ 韧性API调用（自动重试、降级、转换）
- ✅ 离线优先缓存（IndexedDB持久化）
- ✅ 低端设备优化（网络质量感知）
- ✅ 深度配置合并（递归merge，支持数组策略）
- ✅ 版本兼容保障（v1/v2/v3平滑迁移）

现在可以继续进行第⑥项"崩溃上报beacon"优化！🚀
