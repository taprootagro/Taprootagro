// ============================================================================
// IMAdapter - Unified IM Channel Abstraction
// ============================================================================
// Provides a common interface for three IM modes:
//   1. supabase-realtime  — Supabase Realtime (WebSocket on chat_messages table)
//   2. im-provider-direct — Direct IM SDK (Sendbird/CometChat/Aliyun client SDK)
//   3. edge-function-proxy — Edge Function relay + polling (current default)
//
// The CommunityPage and ChatProxyService use this adapter to send/receive
// messages without knowing which backend is active.
// ============================================================================

import type { ChatMessage } from './ChatProxyService';
import type { IMMode, ChatProvider } from '../hooks/useHomeConfig';
import { SupabaseRealtimeAdapter } from './SupabaseRealtimeAdapter';
import { storageGet } from '../utils/safeStorage';
import { EdgeFunctionProxyAdapter } from './EdgeFunctionProxyAdapter';
import { IMProviderDirectAdapter } from './IMProviderDirectAdapter';

// ---- Adapter Interface ----

export interface IMAdapterConfig {
  imMode: IMMode;
  chatProvider: ChatProvider;
  supabaseUrl: string;
  supabaseAnonKey: string;
  edgeFunctionName: string;
  // Provider-specific
  aliyunAppId: string;
  sendbirdAppId: string;
  cometchatAppId: string;
  cometchatRegion: string;
}

export interface IIMAdapter {
  /** Adapter mode name */
  readonly mode: IMMode;

  /** Human-readable description of the current mode */
  readonly modeLabel: string;

  /** Initialize the adapter (connect SDK, subscribe to Realtime, etc.) */
  connect(userId: string, channelName: string): Promise<void>;

  /** Disconnect and clean up */
  disconnect(): void;

  /** Send a message through this adapter */
  sendMessage(msg: {
    id: string;
    content: string;
    type: 'text' | 'image' | 'voice';
    senderId: string;
    targetUserId: string;
    channelName: string;
    duration?: number;
  }): Promise<{ success: boolean; serverTimestamp?: number; error?: string }>;

  /** Fetch message history */
  getHistory(channelName: string, limit?: number): Promise<ChatMessage[]>;

  /** Register a listener for incoming messages */
  onMessage(listener: (msg: ChatMessage) => void): () => void;

  /** Whether the adapter is currently connected */
  readonly isConnected: boolean;
}

// ---- Config Reader ----

const CONFIG_STORAGE_KEY = 'agri_home_config';

export function getIMAdapterConfig(): IMAdapterConfig {
  const defaults: IMAdapterConfig = {
    imMode: 'edge-function-proxy',
    chatProvider: 'aliyun-im',
    supabaseUrl: '',
    supabaseAnonKey: '',
    edgeFunctionName: 'chat-proxy',
    aliyunAppId: '',
    sendbirdAppId: '',
    cometchatAppId: '',
    cometchatRegion: 'us',
  };

  try {
    const saved = storageGet(CONFIG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const bpc = parsed.backendProxyConfig;
      if (bpc) {
        return {
          imMode: bpc.imMode || defaults.imMode,
          chatProvider: bpc.chatProvider || defaults.chatProvider,
          supabaseUrl: bpc.supabaseUrl || defaults.supabaseUrl,
          supabaseAnonKey: bpc.supabaseAnonKey || defaults.supabaseAnonKey,
          edgeFunctionName: bpc.edgeFunctionName || defaults.edgeFunctionName,
          aliyunAppId: bpc.aliyunAppId || '',
          sendbirdAppId: bpc.sendbirdAppId || '',
          cometchatAppId: bpc.cometchatAppId || '',
          cometchatRegion: bpc.cometchatRegion || 'us',
        };
      }
    }
  } catch { /* ignore */ }
  return defaults;
}

// ---- Mode Labels ----
export const IM_MODE_LABELS: Record<IMMode, { zh: string; en: string; desc_zh: string; desc_en: string; icon: string; color: string; activeColor: string }> = {
  'supabase-realtime': {
    zh: 'Supabase Realtime (WebSocket)',
    en: 'Supabase Realtime (WebSocket)',
    desc_zh: '消息通过 Supabase Postgres 表 + Realtime WebSocket 推送，简单易用，适合 <5万 并发',
    desc_en: 'Messages via Supabase Postgres table + Realtime WebSocket push. Simple, best for <50K concurrent',
    icon: 'S',
    color: 'border-emerald-400 bg-emerald-50',
    activeColor: 'ring-emerald-400',
  },
  'im-provider-direct': {
    zh: 'IM服务商直连 (SDK)',
    en: 'IM Provider Direct (SDK)',
    desc_zh: '加载服务商客户端SDK，消息走WebSocket直连，延迟最低，适合高并发实时聊天',
    desc_en: 'Load provider client SDK, messages via direct WebSocket. Lowest latency, best for high-traffic real-time chat',
    icon: 'D',
    color: 'border-violet-400 bg-violet-50',
    activeColor: 'ring-violet-400',
  },
  'edge-function-proxy': {
    zh: 'Edge Function代理 + 轮询',
    en: 'Edge Function Proxy + Polling',
    desc_zh: '所有消息经 Supabase Edge Function 中转，前端轮询接收，无需IM SDK，最简部署',
    desc_en: 'All messages relayed via Supabase Edge Function, frontend polls for new messages. No IM SDK needed, simplest deployment',
    icon: 'E',
    color: 'border-amber-400 bg-amber-50',
    activeColor: 'ring-amber-400',
  },
};

// ---- Factory ----

/**
 * Create the appropriate IM adapter based on the current config.
 * Call this when initializing the chat system or when the user changes IM mode in ConfigManager.
 */
export function createIMAdapter(config?: IMAdapterConfig): IIMAdapter {
  const cfg = config || getIMAdapterConfig();
  const mode = cfg.imMode;

  console.log(`[IMAdapter] Creating adapter: mode=${mode}, provider=${cfg.chatProvider}`);

  switch (mode) {
    case 'supabase-realtime':
      return new SupabaseRealtimeAdapter(cfg);
    case 'im-provider-direct':
      return new IMProviderDirectAdapter(cfg);
    case 'edge-function-proxy':
    default:
      return new EdgeFunctionProxyAdapter(cfg);
  }
}

/** Singleton adapter instance — recreated when config changes */
let _currentAdapter: IIMAdapter | null = null;

/**
 * Get or create the singleton adapter.
 * If config has changed (different mode), recreates the adapter.
 */
export function getIMAdapter(): IIMAdapter {
  const cfg = getIMAdapterConfig();

  if (_currentAdapter && _currentAdapter.mode === cfg.imMode) {
    return _currentAdapter;
  }

  // Mode changed: disconnect old adapter and create new one
  if (_currentAdapter) {
    console.log(`[IMAdapter] Mode changed from ${_currentAdapter.mode} to ${cfg.imMode}, switching adapter`);
    _currentAdapter.disconnect();
  }

  _currentAdapter = createIMAdapter(cfg);
  return _currentAdapter;
}

/**
 * Force recreate the adapter (e.g. after config save in ConfigManager).
 */
export function resetIMAdapter(): IIMAdapter {
  if (_currentAdapter) {
    _currentAdapter.disconnect();
    _currentAdapter = null;
  }
  return getIMAdapter();
}