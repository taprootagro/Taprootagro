// ============================================================================
// CloudAIService - Cloud Vision AI Deep Analysis (Backend Proxy Pattern)
// ============================================================================
// This service sends images to a Supabase Edge Function for cloud AI analysis.
// The frontend NEVER touches any API keys — all provider credentials (Qwen,
// Gemini, OpenAI, etc.) are stored as server-side secrets in the Edge Function.
//
// When cloud AI is not configured, it falls back to a rich MOCK response
// to demonstrate the UI flow.
// ============================================================================

import { cloudAIGuard } from '../utils/cloudAIGuard';

export interface DeepAnalysisResult {
  provider: string;       // Display name (e.g. "通义千问", "Gemini")
  model: string;          // Model ID (e.g. "qwen-vl-plus")
  analysis: string;       // Markdown-formatted analysis text
  confidence?: number;    // Optional overall confidence (0-1)
  suggestions?: string[]; // Optional actionable suggestions
  timestamp: number;
}

// ---- Configuration (reads from localStorage like ChatProxyService) ----
const CONFIG_STORAGE_KEY = "agri_home_config";

interface CloudAICfg {
  enabled: boolean;
  providerName: string;
  edgeFunctionName: string;
  modelId: string;
  systemPrompt: string;
  maxTokens: number;
}

interface BackendCfg {
  supabaseUrl: string;
  supabaseAnonKey: string;
  enabled: boolean;
}

function getCloudAIConfig(): CloudAICfg {
  const defaults: CloudAICfg = {
    enabled: false,
    providerName: "Cloud AI",
    edgeFunctionName: "ai-vision-proxy",
    modelId: "qwen-vl-plus",
    systemPrompt: "",
    maxTokens: 512,
  };
  try {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const c = parsed.cloudAIConfig;
      if (c) {
        return {
          enabled: c.enabled ?? defaults.enabled,
          providerName: c.providerName || defaults.providerName,
          edgeFunctionName: c.edgeFunctionName || defaults.edgeFunctionName,
          modelId: c.modelId || defaults.modelId,
          systemPrompt: c.systemPrompt || defaults.systemPrompt,
          maxTokens: c.maxTokens || defaults.maxTokens,
        };
      }
    }
  } catch { /* ignore */ }
  return defaults;
}

function getBackendConfig(): BackendCfg {
  const defaults: BackendCfg = { supabaseUrl: "", supabaseAnonKey: "", enabled: false };
  try {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const b = parsed.backendProxyConfig;
      if (b) {
        return {
          supabaseUrl: b.supabaseUrl || "",
          supabaseAnonKey: b.supabaseAnonKey || "",
          enabled: b.enabled ?? false,
        };
      }
    }
  } catch { /* ignore */ }
  return defaults;
}

function getEndpointUrl(): string {
  const cloud = getCloudAIConfig();
  const backend = getBackendConfig();
  if (cloud.enabled && backend.enabled && backend.supabaseUrl) {
    return `${backend.supabaseUrl}/functions/v1/${cloud.edgeFunctionName}`;
  }
  return "";
}

function getHeaders(): Record<string, string> {
  const backend = getBackendConfig();
  return {
    "Content-Type": "application/json",
    ...(backend.supabaseAnonKey ? { Authorization: `Bearer ${backend.supabaseAnonKey}` } : {}),
    ...(backend.supabaseAnonKey ? { apikey: backend.supabaseAnonKey } : {}),
  };
}

// ---- MOCK analysis (for demo when no backend) ----
function generateMockAnalysis(
  detections: { className: string; score: number }[]
): DeepAnalysisResult {
  const cfg = getCloudAIConfig();
  const detectionSummary = detections
    .map((d) => `${d.className} (${(d.score * 100).toFixed(0)}%)`)
    .join("、");

  const analysis = `## 深度分析报告

### 识别结果概览
端侧模型已检测到以下目标：**${detectionSummary}**

### 详细分析

${detections.map((d, i) => `#### ${i + 1}. ${d.className}
- **置信度**：${(d.score * 100).toFixed(1)}%
- **病害类型**：${d.score > 0.85 ? "典型症状，可确诊" : "疑似症状，建议进一步观察"}
- **危害程度**：${d.score > 0.9 ? "严重" : d.score > 0.75 ? "中等" : "轻微"}
- **发病阶段**：${d.score > 0.85 ? "中后期" : "初期"}
`).join("\n")}

### 防治建议
${detections.map((d, i) => `${i + 1}. **${d.className}**：建议使用对应的专业药剂进行防治，注意用药安全间隔期。可在TaprootAgro商城查看推荐产品。`).join("\n")}

### 农事提醒
- 建议定期巡田，及时发现病虫害。
- 合理轮作，减少病原菌积累。
- 注意田间排水，降低湿度以减少病害发生。

---
*本分析由 ${cfg.providerName} (${cfg.modelId}) 提供*`;

  return {
    provider: cfg.providerName,
    model: cfg.modelId,
    analysis,
    confidence: detections.length > 0 ? detections.reduce((s, d) => s + d.score, 0) / detections.length : 0,
    suggestions: [
      "建议使用对应药剂进行防治",
      "注意安全用药间隔期",
      "定期巡田，加强田间管理",
    ],
    timestamp: Date.now(),
  };
}

// ---- Public API ----

class CloudAIService {
  /** Check if deep analysis feature is available (configured + enabled) */
  get isAvailable(): boolean {
    const cfg = getCloudAIConfig();
    return cfg.enabled;
  }

  /** Get display provider name */
  get providerName(): string {
    return getCloudAIConfig().providerName;
  }

  /** Check if running in real backend mode or mock */
  get mode(): "backend" | "mock" {
    return getEndpointUrl() ? "backend" : "mock";
  }

  /**
   * Perform deep analysis on an image with on-device detection results.
   *
   * @param imageBase64 - Base64-encoded image data (data:image/... format)
   * @param detections  - On-device detection results for context
   * @returns DeepAnalysisResult with markdown analysis text
   */
  async analyze(
    imageBase64: string,
    detections: { className: string; score: number }[]
  ): Promise<DeepAnalysisResult> {
    const endpoint = getEndpointUrl();
    const cfg = getCloudAIConfig();

    // ---- Frontend Guard Checks ----
    const preflight = cloudAIGuard.preflightCheck();
    if (preflight === 'DAILY_LIMIT') {
      throw new Error('DAILY_LIMIT_REACHED');
    }
    if (preflight === 'COOLDOWN') {
      const remaining = cloudAIGuard.getCooldownRemaining();
      throw new Error(`COOLDOWN:${remaining}`);
    }

    // ---- Image Compression ----
    console.log('[CloudAI] Compressing image before analysis...');
    const compressedImage = await cloudAIGuard.compressImage(imageBase64);

    // ---- Dedup Cache Check ----
    const cachedResultJson = await cloudAIGuard.checkDedup(compressedImage);
    if (cachedResultJson) {
      console.log('[CloudAI] Returning cached dedup result');
      const cached = JSON.parse(cachedResultJson) as DeepAnalysisResult;
      cached.timestamp = Date.now(); // refresh timestamp
      return cached;
    }

    if (endpoint) {
      // ---- Real Backend Proxy Call ----
      console.log(`[CloudAI] POST ${endpoint}`);
      try {
        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

        const res = await fetch(endpoint, {
          method: "POST",
          headers: getHeaders(),
          signal: controller.signal,
          body: JSON.stringify({
            image: compressedImage,
            detections: detections.map((d) => ({
              className: d.className,
              score: d.score,
            })),
            modelId: cfg.modelId,
            systemPrompt: cfg.systemPrompt,
            maxTokens: cfg.maxTokens,
          }),
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(err.error || err.message || `Server responded with ${res.status}`);
        }

        const data = await res.json();

        // Robust response parsing: handle multiple AI provider response formats
        // Edge Function should normalize, but we handle common variants as fallback
        let analysisText = "";
        if (typeof data === "string") {
          // Edge Function returned raw string
          analysisText = data;
        } else if (data.analysis) {
          analysisText = data.analysis;
        } else if (data.text) {
          analysisText = data.text;
        } else if (data.content) {
          analysisText = data.content;
        } else if (data.result) {
          // Some providers wrap in .result
          analysisText = typeof data.result === "string" ? data.result : JSON.stringify(data.result);
        } else if (data.choices?.[0]?.message?.content) {
          // OpenAI-compatible format (if Edge Function passes through)
          analysisText = data.choices[0].message.content;
        } else if (data.output?.text) {
          // Qwen / DashScope format
          analysisText = data.output.text;
        } else if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
          // Gemini format
          analysisText = data.candidates[0].content.parts[0].text;
        }

        if (!analysisText) {
          console.warn("[CloudAI] Could not extract analysis text from response:", data);
          analysisText = "The cloud AI returned a response but the analysis text could not be extracted. Raw response logged to console.";
        }

        const result: DeepAnalysisResult = {
          provider: data.provider || cfg.providerName,
          model: data.model || cfg.modelId,
          analysis: analysisText,
          confidence: data.confidence,
          suggestions: data.suggestions,
          timestamp: Date.now(),
        };

        // Record usage and cache result
        cloudAIGuard.recordCall();
        await cloudAIGuard.cacheResult(compressedImage, JSON.stringify(result));

        return result;
      } catch (error: any) {
        console.error("[CloudAI] Backend call failed:", error);
        // Provide user-friendly error messages
        if (error?.name === 'AbortError') {
          throw new Error('Request timed out (60s). The cloud AI service may be overloaded. Please try again later.');
        }
        if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')) {
          throw new Error('Network error. Please check your internet connection and try again.');
        }
        throw error;
      }
    }

    // ---- Mock Mode ----
    console.log("[CloudAI][MOCK] Generating mock deep analysis");
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500));
    const mockResult = generateMockAnalysis(detections);

    // Record usage and cache even for mock
    cloudAIGuard.recordCall();
    await cloudAIGuard.cacheResult(compressedImage, JSON.stringify(mockResult));

    return mockResult;
  }
}

export const cloudAIService = new CloudAIService();