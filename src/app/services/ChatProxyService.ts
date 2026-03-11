// ============================================================================
// ChatProxyService - Frontend Proxy to Backend IM API
// ============================================================================
// This service handles ALL communication with the backend.
// The frontend NEVER touches API keys — it only sends requests to the backend
// (Supabase Edge Function), which holds the real IM provider credentials.
//
// Supported IM Providers (configured in ConfigManager → Backend Proxy):
//   - Alibaba Cloud IM (互动消息) — aliyun-im
//   - Sendbird                    — sendbird
//   - CometChat                   — cometchat
//
// All three providers offer: text, image, voice, audio/video calls via SDK.
// In MOCK mode (no Supabase connected), it simulates server responses locally.
// ============================================================================

import { storageGet } from '../utils/safeStorage';
import { getAccessToken } from '../utils/auth';

import type {
  TokenRequest,
  TokenResponse,
  SendMessageRequest,
  SendMessageResponse,
  ChatMessageDTO,
  PollResponse,
} from "./ChatBackend";
import { getUserId } from "../utils/auth";
import { apiClient } from '../utils/apiClient';

export interface ChatMessage {
  id: string;
  channelName: string;
  senderId: string;
  content: string;
  type: "text" | "image" | "voice";
  timestamp: number;
  status: "sending" | "sent" | "failed";
  read: boolean;
  duration?: number;
}

// ---- Configuration ----
const CONFIG_STORAGE_KEY = "agri_home_config";

type ChatProvider = 'aliyun-im' | 'sendbird' | 'cometchat';

interface ProxyCfg {
  supabaseUrl: string;
  supabaseAnonKey: string;
  edgeFunctionName: string;
  enabled: boolean;
  chatProvider: ChatProvider;
  // Provider-specific App IDs (passed to Edge Function for context)
  aliyunAppId: string;
  sendbirdAppId: string;
  cometchatAppId: string;
  cometchatRegion: string;
}

function getProxyConfig(): ProxyCfg {
  const defaults: ProxyCfg = {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || "",
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
    edgeFunctionName: "chat-proxy",
    enabled: false,
    chatProvider: 'aliyun-im',
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
          supabaseUrl: bpc.supabaseUrl || defaults.supabaseUrl,
          supabaseAnonKey: bpc.supabaseAnonKey || defaults.supabaseAnonKey,
          edgeFunctionName: bpc.edgeFunctionName || defaults.edgeFunctionName,
          enabled: bpc.enabled ?? defaults.enabled,
          chatProvider: bpc.chatProvider || defaults.chatProvider,
          aliyunAppId: bpc.aliyunAppId || '',
          sendbirdAppId: bpc.sendbirdAppId || '',
          cometchatAppId: bpc.cometchatAppId || '',
          cometchatRegion: bpc.cometchatRegion || 'us',
        };
      }
    }
  } catch {
    // ignore parse errors
  }
  return defaults;
}

function getEdgeFunctionBase(): string {
  const cfg = getProxyConfig();
  if (cfg.enabled && cfg.supabaseUrl) {
    return `${cfg.supabaseUrl}/functions/v1/${cfg.edgeFunctionName}`;
  }
  return "";
}

function isBackendAvailable(): boolean {
  return Boolean(getEdgeFunctionBase());
}

function getHeaders(): Record<string, string> {
  const cfg = getProxyConfig();
  const accessToken = getAccessToken();
  return {
    "Content-Type": "application/json",
    // Authorization ONLY carries user's JWT — never fall back to anonKey.
    // If no accessToken, this header is omitted so the backend returns 401.
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    // apikey is always the anonKey (required by Supabase Edge Function gateway routing)
    ...(cfg.supabaseAnonKey ? { apikey: cfg.supabaseAnonKey } : {}),
  };
}

// ---- Provider display names ----
export const CHAT_PROVIDER_INFO: Record<ChatProvider, { name: string; nameZh: string; features: string[] }> = {
  'aliyun-im': {
    name: 'Alibaba Cloud IM',
    nameZh: '阿里云互动消息',
    features: ['Text', 'Image', 'Voice', 'Audio Call', 'Video Call', 'Group Chat'],
  },
  'sendbird': {
    name: 'Sendbird',
    nameZh: 'Sendbird',
    features: ['Text', 'Image', 'Voice', 'Audio Call', 'Video Call', 'Group Chat', 'Push'],
  },
  'cometchat': {
    name: 'CometChat',
    nameZh: 'CometChat',
    features: ['Text', 'Image', 'Voice', 'Audio Call', 'Video Call', 'Group Chat', 'AI Bots'],
  },
};

// ---- Mock data store ----
const mockMessageStore: ChatMessage[] = [];

export class ChatProxyService {
  private currentUserId: string = "me";
  private currentChannel: string = "default-channel";
  private _listeners = new Set<(msg: ChatMessage) => void>();
  private _targetUserId: string | null = null;
  private _mode: "backend" | "mock" = "mock";
  private _mockWarningShown = false; // 只显示一次警告
  private _pollTimer: ReturnType<typeof setTimeout> | null = null;
  private _pollSinceTimestamp: number = 0;
  private _pollInterval: number = 3000; // 3s default, auto-adjusts
  private _seenMessageIds: Set<string> = new Set();
  private _isPolling: boolean = false;

  constructor() {
    this.currentUserId = getUserId() || "";
    this.refreshMode();
    window.addEventListener("configUpdate", () => this.refreshMode());
  }

  refreshMode() {
    const newMode = isBackendAvailable() ? "backend" : "mock";
    if (newMode !== this._mode) {
      console.log(`[ChatProxy] Mode changed: ${this._mode} → ${newMode}`);
      this._mockWarningShown = false; // 模式改变时重置警告标志
    }
    this._mode = newMode;
    const cfg = getProxyConfig();
    console.log(`[ChatProxy] Running in ${this._mode.toUpperCase()} mode | Provider: ${cfg.chatProvider}`);
    // 移除启动时的警告 - 只在实际使用时提示
  }

  get mode() {
    this._mode = isBackendAvailable() ? "backend" : "mock";
    return this._mode;
  }

  /** Get current configured chat provider */
  get provider(): ChatProvider {
    return getProxyConfig().chatProvider;
  }

  /** Get provider display info */
  get providerInfo() {
    return CHAT_PROVIDER_INFO[this.provider];
  }

  onMessage(listener: (msg: ChatMessage) => void) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private notifyListeners(msg: ChatMessage) {
    this._listeners.forEach((fn) => fn(msg));
  }

  setUserId(userId: string) {
    this.currentUserId = userId;
  }

  /** Set the target user ID for the current chat session */
  setTargetUserId(targetUserId: string) {
    this._targetUserId = targetUserId;
  }

  /** Get the current target user ID */
  get targetUserId(): string | null {
    return this._targetUserId;
  }

  /**
   * Generate a deterministic 1-to-1 channel name from two user IDs.
   * Sorts alphabetically so both sides get the same channel name.
   */
  static generateChannelName(userId1: string, userId2: string): string {
    const sorted = [userId1, userId2].sort();
    return `dm_${sorted[0]}_${sorted[1]}`;
  }

  // ========================================================================
  // MESSAGE RECEIVING — Polling-based real-time message receiving
  // ========================================================================
  //
  // Architecture:
  //   IM Provider → Webhook → Edge Function → Supabase DB (chat_messages table)
  //   Frontend polls GET /chat-proxy/poll?channel=xxx&since=timestamp&userId=xxx
  //   Only returns messages from OTHER users (excludes own messages)
  //
  // In MOCK mode: generates simulated replies from the contact
  //
  // Alternative approaches (for future upgrade):
  //   1. Supabase Realtime: subscribe to chat_messages table changes (no polling)
  //   2. IM Client SDK: install provider's JS SDK for WebSocket-based receiving
  //      - Sendbird: @sendbird/chat → channel.onMessageReceived()
  //      - CometChat: @cometchat/chat-sdk → CometChat.addMessageListener()
  //      - Aliyun IM: aliyun-im-sdk → onMessageReceived callback
  //      (requires client-side token from /token endpoint)
  // ========================================================================

  /**
   * Start polling for new messages on the current channel.
   * Call this when entering the chat view. Call stopPolling() when leaving.
   * 
   * @param intervalMs - Polling interval in ms (default 3000ms for backend, 0 for mock)
   */
  startPolling(intervalMs?: number): void {
    this.stopPolling(); // Clear any existing poller

    if (this._mode === "backend") {
      if (intervalMs) this._pollInterval = intervalMs;
      this._pollSinceTimestamp = Date.now(); // Only get messages after now
      console.log(`[ChatProxy] Starting poll (initial interval ${this._pollInterval}ms) on channel: ${this.currentChannel}`);

      // Use recursive setTimeout so adaptive interval changes take effect
      const scheduleNext = () => {
        this._pollTimer = setTimeout(async () => {
          await this._doPoll();
          if (this._pollTimer !== null) {
            scheduleNext(); // Schedule next poll with potentially updated interval
          }
        }, this._pollInterval);
      };

      // Immediate first poll, then start scheduling
      this._doPoll().then(() => {
        if (this._pollTimer !== null || this._pollInterval > 0) {
          // Mark as active (stopPolling checks _pollTimer)
          this._pollTimer = setTimeout(() => {}, 0); // placeholder
          clearTimeout(this._pollTimer);
          scheduleNext();
        }
      });
    } else {
      // Mock mode: no auto-generated messages — static display only.
      console.log("[ChatProxy][MOCK] Mock mode active — no auto-reply simulation. Static display only.");
    }
  }

  /** Stop polling for messages */
  stopPolling(): void {
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
      this._pollTimer = null;
      console.log("[ChatProxy] Polling stopped");
    }
    this._isPolling = false;
  }

  /** Whether polling is currently active */
  get isPollingActive(): boolean {
    return this._pollTimer !== null;
  }

  // ---- Backend polling implementation ----
  private async _doPoll(): Promise<void> {
    if (this._isPolling) return; // Prevent overlapping polls
    this._isPolling = true;

    const base = getEdgeFunctionBase();
    if (!base) {
      this._isPolling = false;
      return;
    }

    try {
      const url = `${base}/poll?channel=${encodeURIComponent(this.currentChannel)}&since=${this._pollSinceTimestamp}&userId=${encodeURIComponent(this.currentUserId)}`;
      
      const res = await apiClient<PollResponse>({
        endpoint: url,
        method: "GET",
        headers: getHeaders(),
        timeout: 10000,
        retry: { maxRetries: 1 } // Do not retry aggressively for polling
      });

      const data = res.data;

      if (data && data.messages && data.messages.length > 0) {
        console.log(`[ChatProxy] Poll received ${data.messages.length} new message(s)`);

        for (const dto of data.messages) {
          // Deduplicate: skip if we've already seen this message
          if (this._seenMessageIds.has(dto.id)) continue;
          this._seenMessageIds.add(dto.id);

          // Skip own messages (shouldn't happen, but safety check)
          if (dto.senderId === this.currentUserId) continue;

          const msg: ChatMessage = {
            id: dto.id,
            channelName: dto.channelName,
            senderId: dto.senderId,
            content: dto.content,
            type: dto.type,
            timestamp: dto.timestamp,
            status: "sent",
            read: false,
            duration: dto.duration,
          };

          this.notifyListeners(msg);

          // Advance the timestamp watermark
          if (dto.timestamp > this._pollSinceTimestamp) {
            this._pollSinceTimestamp = dto.timestamp;
          }
        }

        // Adaptive: if messages are flowing, poll faster (min 1s)
        if (this._pollInterval > 1000) {
          this._pollInterval = Math.max(1000, this._pollInterval - 500);
        }
      } else {
        // No new messages: slow down polling (max 10s)
        if (this._pollInterval < 10000) {
          this._pollInterval = Math.min(10000, this._pollInterval + 500);
        }
      }
    } catch (error) {
      console.warn("[ChatProxy] Poll error:", error);
    } finally {
      this._isPolling = false;
    }
  }

  /** Mark existing message IDs as seen (to prevent duplicates on initial load) */
  markSeen(messageIds: string[]): void {
    for (const id of messageIds) {
      this._seenMessageIds.add(id);
    }
  }

  // ========================================================================
  // JOIN CHANNEL — Get IM token from backend Edge Function
  // ========================================================================
  async joinChannel(
    channelName: string
  ): Promise<{ token: string; appId: string; uid: string | number }> {
    this.currentChannel = channelName;
    const base = getEdgeFunctionBase();
    const cfg = getProxyConfig();

    if (this._mode === "backend" && base) {
      console.log(`[ChatProxy] POST ${base}/token (provider: ${cfg.chatProvider})`);
      const body: TokenRequest = {
        channelName,
        uid: this.currentUserId,
        provider: cfg.chatProvider,
      };

      try {
        const res = await apiClient<TokenResponse>({
          endpoint: `${base}/token`,
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(body),
          retry: { maxRetries: 2 }
        });

        const data = res.data;
        if (!data || !data.token) {
           throw new Error("Token response invalid");
        }

        console.log(`[ChatProxy] Received token for ${cfg.chatProvider}: ${data.token.substring(0, 10)}...`);
        return { token: data.token, appId: data.appId, uid: data.uid };
      } catch (err: any) {
        throw new Error(`Token request failed: ${err.message || "Unknown error"}`);
      }
    }

    // Mock mode
    console.log(`[ChatProxy][MOCK] Generating mock token for channel: ${channelName}`);
    await this.simulateLatency(300);
    return {
      token: `mock-token-${Date.now()}`,
      appId: `MOCK_${cfg.chatProvider.toUpperCase()}`,
      uid: this.currentUserId,
    };
  }

  // ========================================================================
  // SEND MESSAGE — Route through backend
  // ========================================================================
  async sendMessage(
    content: string,
    type: "text" | "image" | "voice" = "text",
    duration?: number,
    targetUserId?: string
  ): Promise<ChatMessage> {
    // 首次使用时显示Mock模式提示（仅一次）
    if (this._mode === "mock" && !this._mockWarningShown) {
      console.warn(
        "[ChatProxy] Backend proxy not enabled. Running in MOCK mode.\n" +
        "Go to ConfigManager → Backend Proxy tab to configure IM provider and enable backend proxy."
      );
      this._mockWarningShown = true;
    }

    const newMessage: ChatMessage = {
      id: `m${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      channelName: this.currentChannel,
      senderId: this.currentUserId,
      content,
      type,
      timestamp: Date.now(),
      status: "sending",
      read: false,
      duration,
    };

    const base = getEdgeFunctionBase();
    const cfg = getProxyConfig();

    if (this._mode === "backend" && base) {
      try {
        const body: SendMessageRequest = {
          channelName: this.currentChannel,
          targetUserId: targetUserId || "",
          provider: cfg.chatProvider,
          message: {
            id: newMessage.id,
            senderId: newMessage.senderId,
            content: newMessage.content,
            type: newMessage.type,
            timestamp: newMessage.timestamp,
            duration: newMessage.duration,
          },
        };

        const res = await apiClient<SendMessageResponse>({
          endpoint: `${base}/message`,
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(body),
          retry: { maxRetries: 3 }
        });

        const data = res.data;
        newMessage.status = "sent";
        newMessage.timestamp = data?.serverTimestamp || newMessage.timestamp;
        return newMessage;
      } catch (error) {
        console.error("[ChatProxy] Send failed:", error);
        newMessage.status = "failed";
        return newMessage;
      }
    }

    // Mock mode
    await this.simulateLatency(200);
    newMessage.status = "sent";
    mockMessageStore.push(newMessage);

    // Mock auto-reply: simulate a response from the contact after 1-2s
    if (this._targetUserId) {
      this._scheduleMockReply(newMessage);
    }

    return newMessage;
  }

  /**
   * Schedule a mock auto-reply in mock mode.
   * Simulates the contact responding to the user's message.
   */
  private _scheduleMockReply(userMsg: ChatMessage): void {
    const delay = 1000 + Math.random() * 2000; // 1-3s delay
    const mockReplies: Record<string, string[]> = {
      text: [
        "好的，收到了！",
        "没问题，我马上处理",
        "这个产品目前有货，需要我帮你预留吗？",
        "价格方面可以再商量",
        "OK, received!",
        "I'll check and get back to you",
        "Yes, this product is available",
      ],
      image: [
        "图片收到了，我看看",
        "Product photo received, let me check",
      ],
      voice: [
        "语音已收听",
        "Voice message received",
      ],
    };

    const replies = mockReplies[userMsg.type] || mockReplies.text;
    const replyContent = replies[Math.floor(Math.random() * replies.length)];

    setTimeout(() => {
      const replyMsg: ChatMessage = {
        id: `mock_reply_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        channelName: this.currentChannel,
        senderId: this._targetUserId || "",
        content: replyContent,
        type: "text",
        timestamp: Date.now(),
        status: "sent",
        read: false,
      };
      this.notifyListeners(replyMsg);
      console.log(`[ChatProxy][MOCK] Auto-reply from ${this._targetUserId}: "${replyContent}"`);
    }, delay);
  }

  // ========================================================================
  // GET HISTORY — Fetch from backend database
  // ========================================================================
  async getHistory(channelName: string): Promise<ChatMessage[]> {
    const base = getEdgeFunctionBase();

    if (this._mode === "backend" && base) {
      const res = await fetch(
        `${base}/history?channel=${encodeURIComponent(channelName)}`,
        { headers: getHeaders() }
      );

      if (!res.ok) throw new Error("Failed to fetch history");

      const data: { messages: ChatMessageDTO[] } = await res.json();
      return data.messages.map((m) => ({ ...m, status: "sent" as const }));
    }

    // Mock mode
    await this.simulateLatency(500);
    return mockMessageStore.filter((m) => m.channelName === channelName);
  }

  // ---- Helpers ----
  private simulateLatency(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton export
export const chatService = new ChatProxyService();