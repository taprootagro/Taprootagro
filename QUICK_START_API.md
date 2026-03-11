# TaprootAgro API客户端快速开始指南

## 🚀 5分钟快速上手

### 1. 基础GET请求（最简单）

```typescript
import { apiGet } from '@/app/utils/apiClient';

// 自动启用缓存、重试、版本协商
const config = await apiGet('/api/remote-config');
console.log(config);
```

### 2. POST请求

```typescript
import { apiPost } from '@/app/utils/apiClient';

const result = await apiPost('/api/user/update', {
  name: 'John Doe',
  email: 'john@example.com',
});
```

### 3. 自定义选项

```typescript
import { apiClient } from '@/app/utils/apiClient';

const response = await apiClient({
  endpoint: '/api/data',
  method: 'GET',
  preferredVersion: 'v3',        // 期望v3版本
  enableFallback: true,           // 启用v2/v1降级
  cache: true,                    // 启用缓存
  cacheTTL: 10 * 60 * 1000,      // 10分钟TTL
  offlineFallback: true,          // 离线时使用过期缓存
  retry: {
    maxRetries: 3,                // 最多重试3次
    initialDelay: 1000,           // 初始延迟1s
  },
});

console.log(response.data);      // 响应数据
console.log(response.apiVersion); // 实际使用的版本
console.log(response.fallback);   // 是否降级
```

## 📦 常用场景

### 场景1: 远程配置获取（推荐）

```typescript
import { fetchConfigWithVersion } from '@/app/utils/apiVersion';

const defaultConfig = {
  features: { market: true, ai: true },
  theme: { primaryColor: '#059669' },
};

// 自动merge远程配置与本地默认值
const config = await fetchConfigWithVersion(
  'https://config.taprootagro.com/app.json',
  defaultConfig,
  {
    enableFallback: true,
    cache: true,
    cacheTTL: 30 * 60 * 1000, // 30分钟
  }
);

// config = deepMerge(defaultConfig, remoteConfig)
```

### 场景2: 多CDN fallback

```typescript
import { fetchConfigWithFallbackUrls } from '@/app/utils/apiVersion';

// 并行请求，最快响应优先
const config = await fetchConfigWithFallbackUrls(
  [
    'https://cdn1.taprootagro.com/config.json',
    'https://cdn2.taprootagro.com/config.json',
    'https://api.taprootagro.com/config',
  ],
  defaultConfig
);
```

### 场景3: 配置深度合并

```typescript
import { deepMerge, MERGE_DEEP, MERGE_APPEND } from '@/app/utils/deepMerge';

const defaults = {
  app: { name: 'TaprootAgro', theme: { color: '#059669' } },
  features: ['market', 'ai'],
};

const custom = {
  app: { theme: { fontSize: 16 } }, // 新增字段
  features: ['weather'],             // 新功能
};

// 深度合并（数组按索引合并）
const merged1 = deepMerge(defaults, custom, MERGE_DEEP);
// { app: { name: 'TaprootAgro', theme: { color: '#059669', fontSize: 16 } },
//   features: ['weather'] }

// 数组追加模式
const merged2 = deepMerge(defaults, custom, MERGE_APPEND);
// { app: {...}, features: ['market', 'ai', 'weather'] }
```

### 场景4: API版本转换

```typescript
import { registerTransformer, apiClient } from '@/app/utils/apiVersion';

// 定义v1 → v2转换器
registerTransformer('/api/products', 'v1', 'v2', (data: any) => {
  return data.items.map((p: any) => ({
    id: p.product_id,           // 字段重命名
    name: p.product_name,
    price: p.price_amount / 100, // 单位转换（分→元）
  }));
});

// 调用时自动转换
const products = await apiClient({
  endpoint: '/api/products',
  preferredVersion: 'v2',
  transformTo: 'v2',        // 如果返回v1，自动转换
});
```

## 🎯 核心API参考

### apiClient 选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `endpoint` | string | - | API端点（必填）|
| `method` | string | 'GET' | HTTP方法 |
| `preferredVersion` | ApiVersion | 'v3' | 首选版本 |
| `enableFallback` | boolean | true | 启用版本降级 |
| `cache` | boolean | false | 启用缓存 |
| `cacheTTL` | number | 300000 | 缓存TTL（ms）|
| `offlineFallback` | boolean | false | 离线时使用过期缓存 |
| `timeout` | number | auto | 超时时间（自动根据网络质量调整）|
| `retry` | RetryOptions | - | 重试配置 |
| `validateResponse` | function | - | 响应验证函数 |
| `transformTo` | ApiVersion | - | 目标版本（自动转换）|

### deepMerge 选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `arrayStrategy` | MergeStrategy | 'replace' | 数组合并策略：replace/merge/append |
| `nullStrategy` | string | 'overwrite' | null处理：keep/overwrite |
| `undefinedStrategy` | string | 'skip' | undefined处理：skip/overwrite |
| `clone` | boolean | true | 是否克隆（避免引用污染）|
| `customMerge` | function | - | 自定义合并函数 |

## 💡 最佳实践

### ✅ 推荐做法

```typescript
// 1. 使用便捷API
const data = await apiGet('/api/config');

// 2. 远程配置启用长缓存
await apiGet('/api/config', {
  cache: true,
  cacheTTL: 24 * 60 * 60 * 1000, // 24小时
  offlineFallback: true,
});

// 3. 实时数据短缓存
await apiGet('/api/weather', {
  cache: true,
  cacheTTL: 5 * 60 * 1000, // 5分钟
});

// 4. 敏感操作禁用缓存
await apiPost('/api/payment', data, {
  cache: false,
});

// 5. 使用预设merge策略
import { MERGE_DEEP, MERGE_APPEND } from '@/app/utils/deepMerge';
const merged = deepMerge(defaults, custom, MERGE_DEEP);
```

### ❌ 避免做法

```typescript
// ❌ 不要直接使用fetch（绕过版本管理）
const res = await fetch('/api/config');

// ❌ 不要浅层合并嵌套对象
const merged = { ...defaults, ...custom }; // 丢失嵌套字段

// ❌ 不要对实时数据使用长缓存
await apiGet('/api/current-price', {
  cacheTTL: 24 * 60 * 60 * 1000, // 太长！
});

// ❌ 不要禁用离线fallback（农业用户弱网环境）
await apiGet('/api/config', {
  offlineFallback: false, // 离线时失败
});
```

## 🔍 调试技巧

### 1. 查看缓存状态

```typescript
import { getCacheStats, clearCache } from '@/app/utils/apiClient';

// 查看缓存统计
const stats = await getCacheStats();
console.log(`缓存条目: ${stats.count}`);
console.table(stats.entries);

// 清除特定缓存
await clearCache('/api/old-data');

// 清除所有缓存
await clearCache();
```

### 2. 版本协商日志

```typescript
const response = await apiClient({
  endpoint: '/api/data',
  preferredVersion: 'v3',
  enableFallback: true,
});

console.log('API版本:', response.apiVersion);        // 'v2'
console.log('是否降级:', response.fallback);          // true
console.log('请求版本:', response.requestedVersion);  // 'v3'
console.log('是否转换:', response.transformed);       // true
```

### 3. 网络质量检测

```typescript
// apiClient自动检测，也可手动查看
const conn = (navigator as any).connection;
console.log('网络类型:', conn?.effectiveType); // '4g', '3g', '2g'
console.log('下行速度:', conn?.downlink, 'Mbps');
```

## 📚 完整示例

详见以下文件：

- `/src/app/utils/apiVersion.example.ts` - 10个完整实战案例
- `/src/app/components/PWARegister.tsx` - 远程配置获取实例
- `/src/app/hooks/ConfigProvider.tsx` - 深度merge实例

## 🎯 下一步

现在可以开始第⑥项优化：**崩溃上报beacon** 🚀

相关文件：
- `/src/app/utils/errorMonitor.ts` - 已有基础
- 需要添加: Beacon API、离线队列、批量上报
