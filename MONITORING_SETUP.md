# TaprootAgro 监控系统快速部署指南

## 🚀 快速开始

### 步骤 1: 配置农户端

在 `src/main.tsx` 中初始化错误监控：

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { errorMonitor } from './app/utils/errorMonitor';

// 初始化错误监控（自动收集，用户无感知）
errorMonitor.install({
  reportEndpoint: import.meta.env.VITE_ERROR_REPORTER_ENDPOINT,
  apiVersion: 'v3',
  headers: {
    'x-api-key': import.meta.env.VITE_ERROR_REPORTER_API_KEY,
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 步骤 2: 配置环境变量

创建 `.env` 文件：

```bash
# Supabase 配置
VITE_SUPABASE_URL=https://[your-project-ref].supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# 错误上报端点（Supabase Edge Function）
VITE_ERROR_REPORTER_ENDPOINT=https://[your-project-ref].supabase.co/functions/v1/error-reporter

# API Key（可选，用于身份验证）
VITE_ERROR_REPORTER_API_KEY=your-secret-api-key
```

### 步骤 3: 创建 Supabase 数据库表

在 Supabase SQL Editor 中执行：

```sql
-- 1. 错误日志表
CREATE TABLE error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  app_version TEXT,
  api_version TEXT,
  ab_test_group TEXT,
  error_type TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  url TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_error_logs_timestamp ON error_logs(timestamp DESC);
CREATE INDEX idx_error_logs_device_id ON error_logs(device_id);

-- 2. 性能指标表
CREATE TABLE performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  app_version TEXT,
  api_version TEXT,
  version_usage JSONB DEFAULT '{}'::jsonb,
  fallback_count JSONB DEFAULT '{}'::jsonb,
  ws_connections JSONB DEFAULT '{}'::jsonb,
  errors_by_type JSONB DEFAULT '{}'::jsonb,
  errors_by_version JSONB DEFAULT '{}'::jsonb,
  avg_response_time NUMERIC DEFAULT 0,
  p95_response_time NUMERIC DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_performance_metrics_timestamp ON performance_metrics(timestamp DESC);
```

### 步骤 4: 部署 Supabase Edge Function

创建文件 `supabase/functions/error-reporter/index.ts`：

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 验证 API Key（可选）
    const apiKey = req.headers.get('x-api-key');
    if (apiKey && apiKey !== Deno.env.get('ERROR_REPORTER_API_KEY')) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const report = await req.json();

    // 存储错误日志
    if (report.errors?.length > 0) {
      const errorLogs = report.errors.map((error: any) => ({
        device_id: report.deviceId,
        app_version: report.appVersion,
        api_version: error.apiVersion || report.apiVersion,
        ab_test_group: error.abTestGroup || report.abTestGroup,
        error_type: error.type,
        message: error.message,
        stack: error.stack,
        url: error.url,
        user_agent: error.userAgent,
        timestamp: error.timestamp,
        meta: error.meta,
      }));

      await supabase.from('error_logs').insert(errorLogs);
    }

    // 存储性能指标
    if (report.metrics) {
      await supabase.from('performance_metrics').insert({
        device_id: report.deviceId,
        app_version: report.appVersion,
        api_version: report.apiVersion,
        version_usage: report.metrics.versionUsage,
        fallback_count: report.metrics.fallbackCount,
        ws_connections: report.metrics.wsConnections,
        errors_by_type: report.metrics.errorsByType,
        errors_by_version: report.metrics.errorsByVersion,
        avg_response_time: report.metrics.avgResponseTime,
        p95_response_time: report.metrics.p95ResponseTime,
        timestamp: report.flushedAt,
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

部署命令：

```bash
supabase functions deploy error-reporter
```

### 步骤 5: 配置 Edge Function 环境变量

在 Supabase Dashboard → Edge Functions → error-reporter → Settings：

```
ERROR_REPORTER_API_KEY=your-secret-api-key
```

---

## ✅ 验证部署

### 测试数据收集

在浏览器控制台执行：

```javascript
// 1. 手动触发错误
errorMonitor.capture(new Error('Test error'));

// 2. 查看本地收集的数据
console.log('Errors:', errorMonitor.getLog());
console.log('Metrics:', errorMonitor.getMetrics());

// 3. 手动触发发送
errorMonitor.flush();
```

### 检查 Supabase 数据库

在 Supabase Table Editor 中查看：
- `error_logs` 表应该有新记录
- `performance_metrics` 表应该有新记录

---

## 📊 查询示例

### 查询最近24小时错误

```sql
SELECT 
  error_type,
  COUNT(*) as count,
  api_version
FROM error_logs
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY error_type, api_version
ORDER BY count DESC;
```

### 查询错误率最高的设备

```sql
SELECT 
  device_id,
  COUNT(*) as error_count,
  MAX(timestamp) as last_error
FROM error_logs
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY device_id
ORDER BY error_count DESC
LIMIT 20;
```

### 查询API版本使用分布

```sql
SELECT 
  api_version,
  COUNT(*) as usage_count
FROM performance_metrics
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY api_version;
```

---

## 🔍 常见问题

### 1. 数据没有上报？

检查清单：
- [ ] `reportEndpoint` 是否配置正确？
- [ ] 网络是否正常？
- [ ] Edge Function 是否部署成功？
- [ ] API Key 是否匹配？
- [ ] 浏览器控制台是否有错误？

### 2. Beacon API 不支持？

errorMonitor 会自动降级到 `fetch with keepalive`，无需担心。

### 3. 如何禁用监控？

```typescript
// 不调用 errorMonitor.install() 即可
```

---

## 🎯 后续步骤

1. ✅ **创建管理后台** - 参考 [MONITORING_BACKEND.md](./MONITORING_BACKEND.md)
2. ✅ **配置告警** - Slack/邮件通知高错误率
3. ✅ **数据保留策略** - 自动清理30天前的数据
4. ✅ **性能优化** - 监控指标聚合和分析

监控系统已完全后台化运行，农户完全无感知！🌾
