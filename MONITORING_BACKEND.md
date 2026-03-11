# TaprootAgro 监控后台架构指南

## 📐 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                     农户端（PWA App）                             │
│  - errorMonitor 自动收集错误、性能数据                            │
│  - Beacon API 发送到 Supabase                                    │
│  - 用户完全无感知                                                 │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ POST /functions/v1/error-reporter
                       │ (Beacon API)
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│               Supabase Edge Function                             │
│  - 接收错误上报数据                                               │
│  - 验证、清洗、存储到数据库                                       │
│  - 实时聚合、告警                                                 │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│               Supabase Database                                  │
│  - error_logs 表（错误日志）                                     │
│  - performance_metrics 表（性能指标）                            │
│  - ab_test_results 表（A/B测试数据）                             │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ REST API / Realtime
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│            管理后台（独立Web应用）                                │
│  - 监控仪表盘（从Supabase读取数据）                               │
│  - 错误分析、A/B测试结果                                         │
│  - 只有运维人员可访问                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1️⃣ Supabase 数据库表结构

### 1.1 错误日志表

```sql
-- error_logs 表
CREATE TABLE error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  app_version TEXT,
  api_version TEXT,
  ab_test_group TEXT,
  error_type TEXT NOT NULL, -- 'js' | 'network' | 'websocket' | 'unhandledrejection' | 'react'
  message TEXT NOT NULL,
  stack TEXT,
  url TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引优化查询
CREATE INDEX idx_error_logs_timestamp ON error_logs(timestamp DESC);
CREATE INDEX idx_error_logs_device_id ON error_logs(device_id);
CREATE INDEX idx_error_logs_error_type ON error_logs(error_type);
CREATE INDEX idx_error_logs_api_version ON error_logs(api_version);
CREATE INDEX idx_error_logs_ab_test_group ON error_logs(ab_test_group);

-- RLS 策略（只允许后台读取）
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "管理员可读取所有错误日志"
  ON error_logs FOR SELECT
  USING (auth.jwt()->>'role' = 'admin');
```

### 1.2 性能指标表

```sql
-- performance_metrics 表
CREATE TABLE performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  app_version TEXT,
  api_version TEXT,
  ab_test_group TEXT,
  
  -- 版本使用统计（JSONB格式：{ "v3": 150, "v2": 50 }）
  version_usage JSONB DEFAULT '{}'::jsonb,
  
  -- 降级统计
  fallback_count JSONB DEFAULT '{}'::jsonb,
  
  -- WebSocket统计
  ws_connections JSONB DEFAULT '{"total":0,"successful":0,"failed":0,"byVersion":{}}'::jsonb,
  
  -- 错误统计
  errors_by_type JSONB DEFAULT '{}'::jsonb,
  errors_by_version JSONB DEFAULT '{}'::jsonb,
  
  -- 响应时间
  avg_response_time NUMERIC DEFAULT 0,
  p95_response_time NUMERIC DEFAULT 0,
  
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_performance_metrics_timestamp ON performance_metrics(timestamp DESC);
CREATE INDEX idx_performance_metrics_device_id ON performance_metrics(device_id);

ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "管理员可读取性能指标"
  ON performance_metrics FOR SELECT
  USING (auth.jwt()->>'role' = 'admin');
```

### 1.3 A/B测试结果表

```sql
-- ab_test_results 表
CREATE TABLE ab_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  group_name TEXT NOT NULL, -- 'control' | 'treatment' | 'treatment-a' | 'treatment-b'
  
  -- 事件统计
  impressions INT DEFAULT 0,
  conversions INT DEFAULT 0,
  errors INT DEFAULT 0,
  
  -- 性能数据
  total_response_time NUMERIC DEFAULT 0,
  
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ab_test_experiment_id ON ab_test_results(experiment_id);
CREATE INDEX idx_ab_test_timestamp ON ab_test_results(timestamp DESC);

ALTER TABLE ab_test_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "管理员可读取A/B测试结果"
  ON ab_test_results FOR SELECT
  USING (auth.jwt()->>'role' = 'admin');
```

---

## 2️⃣ Supabase Edge Function

### 2.1 创建 Edge Function

```bash
# 在 Supabase 项目中创建函数
supabase functions new error-reporter
```

### 2.2 Edge Function 代码

在 `supabase/functions/error-reporter/index.ts` 中：

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ErrorReport {
  deviceId: string;
  appVersion: string;
  apiVersion: string;
  abTestGroup?: string;
  errors: Array<{
    id: string;
    timestamp: string;
    type: string;
    message: string;
    stack?: string;
    url: string;
    userAgent: string;
    apiVersion?: string;
    abTestGroup?: string;
    meta?: Record<string, unknown>;
  }>;
  metrics: {
    versionUsage: Record<string, number>;
    fallbackCount: Record<string, number>;
    wsConnections: {
      total: number;
      successful: number;
      failed: number;
      byVersion: Record<string, number>;
    };
    abTestGroups: Record<string, number>;
    errorsByType: Record<string, number>;
    errorsByVersion: Record<string, number>;
    avgResponseTime: number;
    p95ResponseTime: number;
  };
  flushedAt: string;
}

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 创建 Supabase 客户端（使用 service role key）
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 解析请求体
    const report: ErrorReport = await req.json();

    // 1. 存储错误日志
    if (report.errors && report.errors.length > 0) {
      const errorLogs = report.errors.map(error => ({
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

      const { error: errorLogError } = await supabase
        .from('error_logs')
        .insert(errorLogs);

      if (errorLogError) {
        console.error('Error inserting error logs:', errorLogError);
      }
    }

    // 2. 存储性能指标
    if (report.metrics) {
      const { error: metricsError } = await supabase
        .from('performance_metrics')
        .insert({
          device_id: report.deviceId,
          app_version: report.appVersion,
          api_version: report.apiVersion,
          ab_test_group: report.abTestGroup,
          version_usage: report.metrics.versionUsage,
          fallback_count: report.metrics.fallbackCount,
          ws_connections: report.metrics.wsConnections,
          errors_by_type: report.metrics.errorsByType,
          errors_by_version: report.metrics.errorsByVersion,
          avg_response_time: report.metrics.avgResponseTime,
          p95_response_time: report.metrics.p95ResponseTime,
          timestamp: report.flushedAt,
        });

      if (metricsError) {
        console.error('Error inserting performance metrics:', metricsError);
      }
    }

    // 3. 实时告警（可选）
    const criticalErrorCount = report.errors.filter(e => 
      e.type === 'js' || e.type === 'unhandledrejection'
    ).length;

    if (criticalErrorCount > 5) {
      // 发送告警（Slack、邮件等）
      console.warn(`⚠️ High error rate detected for device ${report.deviceId}`);
      // TODO: 集成告警系统
    }

    return new Response(
      JSON.stringify({ success: true, received: report.errors.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing report:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
```

### 2.3 部署 Edge Function

```bash
# 部署函数
supabase functions deploy error-reporter

# 获取函数 URL
# 输出类似: https://[project-ref].supabase.co/functions/v1/error-reporter
```

---

## 3️⃣ 农户端配置

在 `src/main.tsx` 或 `src/app/components/Root.tsx` 中初始化 errorMonitor：

```typescript
import { errorMonitor } from './utils/errorMonitor';

// 初始化错误监控
errorMonitor.install({
  // 使用 Supabase Edge Function URL
  reportEndpoint: 'https://[your-project-ref].supabase.co/functions/v1/error-reporter',
  apiVersion: 'v3',
});

// 设置 A/B 测试分组（如果有）
const assignment = abTestManager.getAssignment('api-version-v3-rollout');
if (assignment) {
  errorMonitor.setAbTestGroup(assignment.group);
}
```

---

## 4️⃣ 管理后台（独立项目）

### 4.1 创建新项目

```bash
# 创建独立的管理后台项目
npx create-react-app taprootagro-admin --template typescript
cd taprootagro-admin

# 安装依赖
npm install @supabase/supabase-js recharts lucide-react
npm install -D tailwindcss
```

### 4.2 连接 Supabase

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);
```

### 4.3 监控仪表盘组件

将之前的 `MonitoringDashboard.tsx` 复制到管理后台，修改数据源：

```typescript
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function AdminDashboard() {
  const [errorLogs, setErrorLogs] = useState([]);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    // 从 Supabase 读取错误日志
    const { data: errors } = await supabase
      .from('error_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    setErrorLogs(errors || []);

    // 聚合性能指标（最近24小时）
    const { data: metricsData } = await supabase
      .from('performance_metrics')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // 合并多设备的指标
    const aggregatedMetrics = aggregateMetrics(metricsData || []);
    setMetrics(aggregatedMetrics);
  };

  // 聚合逻辑...
  const aggregateMetrics = (data) => {
    // TODO: 实现聚合逻辑
    return {};
  };

  return (
    <div>
      {/* 使用之前的 MonitoringDashboard UI */}
    </div>
  );
}
```

### 4.4 实时订阅（可选）

```typescript
// 实时监听新错误
useEffect(() => {
  const subscription = supabase
    .channel('error_logs')
    .on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'error_logs' },
      (payload) => {
        console.log('New error:', payload.new);
        setErrorLogs(prev => [payload.new, ...prev]);
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, []);
```

### 4.5 部署管理后台

```bash
# 部署到 Vercel/Netlify
npm run build

# 设置环境变量
REACT_APP_SUPABASE_URL=https://[project-ref].supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key

# 部署
vercel --prod
```

---

## 5️⃣ 安全配置

### 5.1 Supabase RLS 策略

```sql
-- 只允许管理员访问
CREATE POLICY "管理员读取"
  ON error_logs FOR SELECT
  USING (auth.jwt()->>'role' = 'admin');

-- 或基于特定用户 ID
CREATE POLICY "特定用户读取"
  ON error_logs FOR SELECT
  USING (auth.uid() IN (
    SELECT user_id FROM admin_users
  ));
```

### 5.2 Edge Function 认证（可选）

在 Edge Function 中添加 API Key 验证：

```typescript
const apiKey = req.headers.get('x-api-key');
if (apiKey !== Deno.env.get('ERROR_REPORTER_API_KEY')) {
  return new Response('Unauthorized', { status: 401 });
}
```

在农户端配置：

```typescript
errorMonitor.install({
  reportEndpoint: 'https://[project-ref].supabase.co/functions/v1/error-reporter',
  headers: {
    'x-api-key': import.meta.env.VITE_ERROR_REPORTER_API_KEY
  }
});
```

---

## 6️⃣ 数据保留策略

### 6.1 自动清理旧数据

```sql
-- 创建定时任务（需要 pg_cron 扩展）
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 每天清理 30 天前的错误日志
SELECT cron.schedule(
  'clean-old-error-logs',
  '0 2 * * *', -- 每天凌晨2点
  $$
    DELETE FROM error_logs 
    WHERE created_at < NOW() - INTERVAL '30 days';
  $$
);

-- 清理 7 天前的性能指标
SELECT cron.schedule(
  'clean-old-metrics',
  '0 3 * * *',
  $$
    DELETE FROM performance_metrics 
    WHERE created_at < NOW() - INTERVAL '7 days';
  $$
);
```

---

## 7️⃣ 告警集成（可选）

### 7.1 Slack 告警

在 Edge Function 中：

```typescript
async function sendSlackAlert(message: string) {
  await fetch(Deno.env.get('SLACK_WEBHOOK_URL')!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `🚨 TaprootAgro Alert: ${message}`
    })
  });
}

// 使用
if (criticalErrorCount > 10) {
  await sendSlackAlert(
    `High error rate: ${criticalErrorCount} errors from device ${report.deviceId}`
  );
}
```

---

## 📊 完整数据流

```
1. 农户使用 App → 触发错误/性能事件
   ↓
2. errorMonitor 自动收集数据
   ↓
3. 页面关闭时 Beacon API 发送到 Supabase Edge Function
   ↓
4. Edge Function 验证、清洗、存储到数据库
   ↓
5. 管理后台实时查询数据库
   ↓
6. 运维人员查看仪表盘、分析问题
```

---

## 🎯 环境变量配置

### 农户端 `.env`

```bash
VITE_SUPABASE_URL=https://[project-ref].supabase.co
VITE_ERROR_REPORTER_ENDPOINT=https://[project-ref].supabase.co/functions/v1/error-reporter
VITE_ERROR_REPORTER_API_KEY=your-secret-api-key
```

### 管理后台 `.env`

```bash
REACT_APP_SUPABASE_URL=https://[project-ref].supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

---

## ✅ 总结

| 组件 | 位置 | 用途 |
|------|------|------|
| errorMonitor | 农户端 PWA | 收集数据，Beacon 发送 |
| Edge Function | Supabase | 接收、验证、存储数据 |
| Database | Supabase | 持久化存储 |
| Admin Dashboard | 独立 Web 应用 | 可视化展示，运维分析 |

这样的架构清晰分离了数据收集和数据展示，农户端保持轻量化，管理后台功能强大，且安全可控！
