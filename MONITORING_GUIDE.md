# TaprootAgro 监控与A/B测试指南

## 概览

TaprootAgro 现已具备完整的韧性优化监控系统，包括：

1. **崩溃上报（Beacon API）** - 可靠的错误追踪，即使页面关闭也能发送
2. **WebSocket版本协商** - 实时通信的版本兼容
3. **监控仪表盘** - 可视化版本使用率、降级频率、错误分析
4. **A/B测试框架** - 基于版本的灰度发布

---

## 1. 崩溃上报系统

### 特性

- ✅ **Beacon API** - 页面关闭时仍能发送错误报告
- ✅ **版本跟踪** - 每个错误关联API版本
- ✅ **A/B测试集成** - 错误按实验分组统计
- ✅ **WebSocket监控** - 实时连接错误追踪
- ✅ **性能指标** - 响应时间、错误率统计

### 使用方法

```typescript
import { errorMonitor } from './utils/errorMonitor';

// 1. 初始化（在 main.tsx 或 Root.tsx）
errorMonitor.install({
  reportEndpoint: 'https://api.taprootagro.com/errors', // 可选
  apiVersion: 'v3',
  abTestGroup: 'control', // 可选
});

// 2. 手动捕获错误
try {
  // some code
} catch (error) {
  errorMonitor.capture(error, {
    type: 'manual',
    context: 'user-action',
    apiVersion: 'v3',
  });
}

// 3. 跟踪版本使用
errorMonitor.trackVersionUsage('v3', 150); // 150ms响应时间

// 4. 跟踪降级
errorMonitor.trackFallback('v3', 'v2');

// 5. 跟踪WebSocket
errorMonitor.trackWebSocketConnection('v3', true);
errorMonitor.trackWebSocketError('v3', new Error('Connection failed'));

// 6. 获取统计
const metrics = errorMonitor.getMetrics();
console.log('版本使用:', metrics.versionUsage);
console.log('降级次数:', metrics.fallbackCount);
console.log('WebSocket连接:', metrics.wsConnections);

// 7. 清除数据
errorMonitor.clear(); // 清除错误日志
errorMonitor.clearMetrics(); // 清除性能指标
```

### Beacon API 自动发送

页面关闭时自动发送错误和指标（无需手动调用）：

```typescript
// 已自动注册以下事件：
// - visibilitychange (页面隐藏时)
// - beforeunload (页面卸载前)

// 使用 navigator.sendBeacon() 确保数据发送成功
```

---

## 2. WebSocket版本协商

### 特性

- ✅ **自动版本降级** - v3 → v2 → v1
- ✅ **心跳保活** - 低速网络适配
- ✅ **断线重连** - 指数退避策略
- ✅ **消息队列** - 离线缓存
- ✅ **性能监控** - 集成errorMonitor

### 使用方法

```typescript
import { createVersionedWebSocket } from './utils/wsVersionNegotiation';

// 创建WebSocket连接
const ws = createVersionedWebSocket('wss://api.taprootagro.com/realtime', {
  preferredVersion: 'v3',
  enableFallback: true,
  heartbeatInterval: 30000, // 30秒心跳
  reconnect: {
    enabled: true,
    maxAttempts: 5,
    initialDelay: 1000,
    maxDelay: 30000,
  },
  onOpen: (version) => {
    console.log('WebSocket已连接，版本:', version);
  },
  onMessage: (data, version) => {
    console.log('收到消息:', data, '版本:', version);
  },
  onVersionNegotiated: (version, fallback) => {
    if (fallback) {
      console.warn('版本降级到:', version);
    }
  },
  onError: (error) => {
    console.error('WebSocket错误:', error);
  },
});

// 连接
await ws.connect();

// 发送消息
ws.send({ type: 'chat', content: 'Hello' });

// 获取状态
const state = ws.getState();
console.log('当前版本:', state.version);
console.log('队列大小:', state.queueSize);

// 关闭连接
ws.close();
```

### 消息格式

```typescript
interface WSMessage {
  type: 'ping' | 'pong' | 'data' | 'version-negotiation';
  version?: ApiVersion;
  payload?: unknown;
  timestamp: number;
}
```

---

## 3. 监控仪表盘

### 访问

```
https://taprootagro.com/monitoring-dashboard
```

### 功能

#### 总览标签
- API调用总数
- 错误总数
- WebSocket连接统计
- 版本降级次数
- 版本分布图

#### 版本分析标签
- 各版本详细统计（调用次数、错误率、WebSocket连接）
- 版本降级记录

#### 错误日志标签
- 实时错误列表
- 错误类型分类（JS、网络、WebSocket等）
- 堆栈信息
- API版本关联

#### A/B测试标签
- 实验列表
- 分组对比（样本量、转化率、错误率、响应时间）
- 实验状态（运行中、已降级、已停止）

### 集成到设置页面

```typescript
// SettingsPage.tsx
import { useNavigate } from 'react-router';
import { Activity } from 'lucide-react';

function SettingsPage() {
  const navigate = useNavigate();
  
  return (
    <Button onClick={() => navigate('/monitoring-dashboard')}>
      <Activity className="w-4 h-4 mr-2" />
      监控仪表盘
    </Button>
  );
}
```

---

## 4. A/B测试框架

### 特性

- ✅ **设备ID稳定分组** - 哈希算法确保用户体验一致
- ✅ **多实验并行** - 支持同时运行多个实验
- ✅ **版本维度筛选** - 仅对特定API版本用户测试
- ✅ **自动异常降级** - 错误率超阈值自动回退
- ✅ **实验数据采集** - 转化率、错误率、响应时间

### 使用方法

#### 4.1 注册实验

```typescript
import { abTestManager, createVersionRolloutExperiment } from './utils/abTest';

// 方式1: 使用预定义模板（API版本灰度）
const experiment = createVersionRolloutExperiment('v3', 20); // 20%流量
abTestManager.registerExperiment(experiment);

// 方式2: 自定义实验
abTestManager.registerExperiment({
  id: 'new-ui-test',
  name: '新UI测试',
  description: '测试新的农业管理界面',
  enabled: true,
  groups: [
    {
      name: 'control',
      percentage: 50,
      config: { useNewUI: false },
    },
    {
      name: 'treatment',
      percentage: 50,
      config: { useNewUI: true },
    },
  ],
  targetVersions: ['v3'], // 仅v3用户参与
  fallback: {
    errorRateThreshold: 5, // 5%错误率触发降级
    detectionWindow: 60000, // 1分钟检测窗口
    fallbackGroup: 'control', // 降级到对照组
  },
});
```

#### 4.2 获取用户分组

```typescript
// 获取分组
const assignment = abTestManager.getAssignment('new-ui-test', 'v3');
if (assignment) {
  console.log('用户分组:', assignment.group); // 'control' | 'treatment'
  console.log('分组配置:', assignment.config); // { useNewUI: true/false }
}

// 检查是否在特定分组
const isInTreatment = abTestManager.isInGroup('new-ui-test', 'treatment', 'v3');

// 获取实验配置
const config = abTestManager.getExperimentConfig('new-ui-test', 'v3');
```

#### 4.3 使用实验配置

```typescript
function App() {
  const assignment = abTestManager.getAssignment('new-ui-test', 'v3');
  const useNewUI = assignment?.config?.useNewUI ?? false;
  
  return useNewUI ? <NewUI /> : <OldUI />;
}
```

#### 4.4 追踪事件

```typescript
// 追踪转化（成功事件）
abTestManager.trackConversion('new-ui-test', 150); // 150ms响应时间

// 追踪错误
try {
  // some action
} catch (error) {
  abTestManager.trackError('new-ui-test');
}
```

#### 4.5 查看实验结果

```typescript
const metrics = abTestManager.getMetrics('new-ui-test');

console.log('对照组:');
console.log('- 样本量:', metrics.groupStats.control.sampleSize);
console.log('- 转化率:', metrics.groupStats.control.conversionRate);
console.log('- 错误率:', metrics.groupStats.control.errorRate);

console.log('实验组:');
console.log('- 样本量:', metrics.groupStats.treatment.sampleSize);
console.log('- 转化率:', metrics.groupStats.treatment.conversionRate);
console.log('- 错误率:', metrics.groupStats.treatment.errorRate);

console.log('实验状态:', metrics.status); // 'running' | 'degraded' | 'stopped'
```

#### 4.6 停止/清除实验

```typescript
// 停止实验（不再分配新用户）
abTestManager.stopExperiment('new-ui-test');

// 清除实验数据
abTestManager.clearExperiment('new-ui-test');
```

### 自动降级示例

当实验组错误率超过阈值时，系统自动降级：

```typescript
// 假设实验配置了5%错误率阈值
// 当某个实验组错误率超过5%时：

// 1. 系统自动将该组所有用户重新分配到对照组
// 2. 实验状态变为 'degraded'
// 3. 控制台输出警告日志
// 4. 监控仪表盘显示降级状态
```

---

## 5. 完整集成示例

### 5.1 在 main.tsx 初始化

```typescript
// main.tsx
import { errorMonitor } from './utils/errorMonitor';
import { abTestManager, createVersionRolloutExperiment } from './utils/abTest';

// 初始化错误监控
errorMonitor.install({
  reportEndpoint: import.meta.env.VITE_ERROR_REPORT_URL,
  apiVersion: 'v3',
});

// 注册A/B实验：v3 API 20%灰度发布
const v3Rollout = createVersionRolloutExperiment('v3', 20);
abTestManager.registerExperiment(v3Rollout);

// 获取用户分组并设置监控
const assignment = abTestManager.getAssignment('api-version-v3-rollout');
if (assignment) {
  errorMonitor.setAbTestGroup(assignment.group);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 5.2 在 API 调用中集成

```typescript
// 示例：远程配置加载
import { apiClient } from './utils/apiClient';
import { abTestManager } from './utils/abTest';

async function loadRemoteConfig() {
  // 检查是否在新版本实验组
  const assignment = abTestManager.getAssignment('api-version-v3-rollout');
  const useV3 = assignment?.config?.useNewVersion ?? false;
  
  try {
    const response = await apiClient({
      endpoint: 'https://api.taprootagro.com/config',
      method: 'GET',
      preferredVersion: useV3 ? 'v3' : 'v2',
      enableFallback: true,
      cache: true,
      offlineFallback: true,
    });
    
    // 追踪成功转化
    abTestManager.trackConversion(
      'api-version-v3-rollout',
      response.timestamp - Date.now()
    );
    
    return response.data;
  } catch (error) {
    // 追踪错误
    abTestManager.trackError('api-version-v3-rollout');
    throw error;
  }
}
```

### 5.3 WebSocket 集成

```typescript
import { createVersionedWebSocket } from './utils/wsVersionNegotiation';
import { abTestManager } from './utils/abTest';

// 获取用户分组
const assignment = abTestManager.getAssignment('ws-version-test', 'v3');
const wsVersion = assignment?.config?.wsVersion || 'v2';

const ws = createVersionedWebSocket('wss://api.taprootagro.com/chat', {
  preferredVersion: wsVersion,
  enableFallback: true,
  onOpen: (version) => {
    abTestManager.trackConversion('ws-version-test');
  },
  onError: (error) => {
    abTestManager.trackError('ws-version-test');
  },
});
```

---

## 6. 数据上报格式

### 错误上报

```json
{
  "deviceId": "dev_abc123",
  "appVersion": "1.2.0",
  "apiVersion": "v3",
  "abTestGroup": "treatment",
  "errors": [
    {
      "id": "err_xyz789",
      "timestamp": "2026-03-09T10:30:00.000Z",
      "type": "network",
      "message": "HTTP 500 Internal Server Error",
      "url": "https://api.taprootagro.com/config",
      "apiVersion": "v3",
      "abTestGroup": "treatment",
      "stack": "Error: HTTP 500...",
      "userAgent": "Mozilla/5.0...",
      "deviceId": "dev_abc123"
    }
  ],
  "metrics": {
    "versionUsage": {
      "v3": 150,
      "v2": 50
    },
    "fallbackCount": {
      "v3": 5
    },
    "wsConnections": {
      "total": 10,
      "successful": 9,
      "failed": 1,
      "byVersion": {
        "v3": 7,
        "v2": 3
      }
    },
    "abTestGroups": {
      "control": 100,
      "treatment": 100
    },
    "errorsByType": {
      "network": 3,
      "js": 1
    },
    "errorsByVersion": {
      "v3": 4
    },
    "avgResponseTime": 180,
    "p95ResponseTime": 450,
    "firstSeen": 1709985000000,
    "lastUpdate": 1709988600000
  },
  "flushedAt": "2026-03-09T10:30:00.000Z"
}
```

---

## 7. 最佳实践

### 7.1 灰度发布流程

```
1. 注册实验（5%流量）
   ↓
2. 监控 24小时
   ↓
3. 检查错误率、性能
   ↓
4. 逐步扩大（5% → 20% → 50% → 100%）
   ↓
5. 所有指标正常 → 全量发布
```

### 7.2 错误率阈值建议

- **关键接口**: 1-2% 错误率阈值
- **一般接口**: 3-5% 错误率阈值
- **非关键功能**: 5-10% 错误率阈值

### 7.3 监控指标

**必须监控**:
- ✅ 错误率（按版本、实验分组）
- ✅ 响应时间（P50, P95, P99）
- ✅ 降级频率
- ✅ WebSocket连接成功率

**建议监控**:
- ⭐ 用户留存率
- ⭐ 转化率
- ⭐ 页面加载时间
- ⭐ API调用分布

---

## 8. 故障排查

### 问题1: 错误未上报

**检查清单**:
1. `errorMonitor.install()` 是否在应用启动时调用？
2. `reportEndpoint` 是否配置正确？
3. 网络是否正常？
4. Beacon API 是否支持？（旧浏览器需降级）

### 问题2: WebSocket频繁断线

**解决方案**:
1. 增大心跳间隔（低速网络）
2. 检查服务端是否支持版本协商
3. 查看 `errorMonitor.getLog()` 中的 WebSocket 错误

### 问题3: A/B测试分组不稳定

**原因**:
- 设备ID变化（清除localStorage）

**解决**:
- 使用更稳定的设备指纹（需额外库）
- 或使用服务端分配ID

---

## 9. 环境变量

```bash
# .env
VITE_ERROR_REPORT_URL=https://api.taprootagro.com/errors
VITE_WS_URL=wss://api.taprootagro.com/realtime
VITE_AB_TEST_ENABLED=true
```

---

## 10. TypeScript 类型

```typescript
// 导出的主要类型
import type {
  ApiVersion,
  PerformanceMetrics,
  ErrorEntry,
  ABTestExperiment,
  ABTestAssignment,
  ABTestMetrics,
  WSConnectionOptions,
  WSMessage,
} from './utils/...';
```

---

## 支持

如有问题，请查看：
- [API_VERSION_README.md](./API_VERSION_README.md) - API版本系统详解
- [API_ARCHITECTURE.md](./API_ARCHITECTURE.md) - 架构文档
- 监控仪表盘: `/monitoring-dashboard`
