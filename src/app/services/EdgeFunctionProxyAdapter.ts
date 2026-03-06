// ============================================================================
// EdgeFunctionProxyAdapter - Edge Function Relay + Polling Mode
// ============================================================================
// Message Flow:
//   SEND: Frontend → Edge Function → IM Provider API (send message)
//   RECEIVE: IM Provider → Webhook → Edge Function → Supabase DB
//            Frontend polls GET /chat-proxy/poll every 3-10s
//
// This is the default mode. No client-side IM SDK needed.
// All messages pass through Supabase Edge Function as a relay.
//
// Pros: Simplest setup, no IM SDK bundle, works offline-first
// Cons: Higher latency (polling), more Edge Function invocations
// Best for: Initial deployment, low-bandwidth environments
// ============================================================================

import type { ChatMessage } from './ChatProxyService';
import type { IIMAdapter, IMAdapterConfig } from './IMAdapter';
import type { IMMode } from '../hooks/useHomeConfig';

export class EdgeFunctionProxyAdapter implements IIMAdapter {
  readonly mode: IMMode = 'edge-function-proxy';
  readonly modeLabel = 'Edge Function Proxy';

  private _config: IMAdapterConfig;
  private _userId = '';
  private _channelName = '';
  private _connected = false;
  private _listeners = new Set<(msg: ChatMessage) => void>();
  private _pollTimer: ReturnType<typeof setTimeout> | null = null;
  private _pollInterval = 3000;
  private _pollSinceTimestamp = 0;
  private _seenMessageIds = new Set<string>();
  private _isPolling = false;

  constructor(config: IMAdapterConfig) {
    this._config = config;
  }

  get isConnected() { return this._connected; }

  private get _baseUrl(): string {
    const { supabaseUrl, edgeFunctionName } = this._config;
    if (!supabaseUrl) return '';
    return `${supabaseUrl}/functions/v1/${edgeFunctionName}`;
  }

  private get _headers(): Record<string, string> {
    const { supabaseAnonKey } = this._config;
    return {
      'Content-Type': 'application/json',
      ...(supabaseAnonKey ? { Authorization: `Bearer ${supabaseAnonKey}` } : {}),
      ...(supabaseAnonKey ? { apikey: supabaseAnonKey } : {}),
    };
  }

  async connect(userId: string, channelName: string): Promise<void> {
    this._userId = userId;
    this._channelName = channelName;
    this._connected = true;
    this._pollSinceTimestamp = Date.now();

    // Start polling
    this._startPolling();
    console.log(`[EdgeFnProxy] Connected to channel: ${channelName} (polling every ${this._pollInterval}ms)`);
  }

  disconnect(): void {
    this._stopPolling();
    this._connected = false;
    this._listeners.clear();
    this._seenMessageIds.clear();
    console.log('[EdgeFnProxy] Disconnected');
  }

  async sendMessage(msg: {
    id: string;
    content: string;
    type: 'text' | 'image' | 'voice';
    senderId: string;
    targetUserId: string;
    channelName: string;
    duration?: number;
  }): Promise<{ success: boolean; serverTimestamp?: number; error?: string }> {
    const base = this._baseUrl;

    if (base) {
      try {
        const res = await fetch(`${base}/message`, {
          method: 'POST',
          headers: this._headers,
          body: JSON.stringify({
            channelName: msg.channelName,
            targetUserId: msg.targetUserId,
            provider: this._config.chatProvider,
            message: {
              id: msg.id,
              senderId: msg.senderId,
              content: msg.content,
              type: msg.type,
              timestamp: Date.now(),
              duration: msg.duration,
            },
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return { success: true, serverTimestamp: data.serverTimestamp };
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return { success: false, error: errMsg };
      }
    }

    // Mock mode
    console.log('[EdgeFnProxy][MOCK] Simulated send:', msg.content);
    return { success: true, serverTimestamp: Date.now() };
  }

  async getHistory(channelName: string, limit = 50): Promise<ChatMessage[]> {
    const base = this._baseUrl;
    if (!base) return [];

    try {
      const res = await fetch(
        `${base}/history?channel=${encodeURIComponent(channelName)}&limit=${limit}`,
        { headers: this._headers }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return (data.messages || []).map((m: Record<string, unknown>) => ({
        ...m,
        status: 'sent' as const,
        read: false,
      }));
    } catch (err) {
      console.warn('[EdgeFnProxy] History fetch failed:', err);
      return [];
    }
  }

  onMessage(listener: (msg: ChatMessage) => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  // ---- Polling ----

  private _startPolling(): void {
    this._stopPolling();
    const base = this._baseUrl;
    if (!base) return;

    const scheduleNext = () => {
      this._pollTimer = setTimeout(async () => {
        await this._doPoll();
        if (this._pollTimer !== null) scheduleNext();
      }, this._pollInterval);
    };

    this._doPoll().then(() => scheduleNext());
  }

  private _stopPolling(): void {
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
      this._pollTimer = null;
    }
    this._isPolling = false;
  }

  private async _doPoll(): Promise<void> {
    if (this._isPolling) return;
    this._isPolling = true;

    const base = this._baseUrl;
    if (!base) { this._isPolling = false; return; }

    try {
      const url = `${base}/poll?channel=${encodeURIComponent(this._channelName)}&since=${this._pollSinceTimestamp}&userId=${encodeURIComponent(this._userId)}`;
      const res = await fetch(url, { headers: this._headers });

      if (!res.ok) { this._isPolling = false; return; }

      const data = await res.json();

      if (data.messages && data.messages.length > 0) {
        for (const dto of data.messages) {
          if (this._seenMessageIds.has(dto.id)) continue;
          this._seenMessageIds.add(dto.id);
          if (dto.senderId === this._userId) continue;

          const msg: ChatMessage = {
            id: dto.id,
            channelName: dto.channelName,
            senderId: dto.senderId,
            content: dto.content,
            type: dto.type,
            timestamp: dto.timestamp,
            status: 'sent',
            read: false,
            duration: dto.duration,
          };
          this._listeners.forEach(fn => fn(msg));

          if (dto.timestamp > this._pollSinceTimestamp) {
            this._pollSinceTimestamp = dto.timestamp;
          }
        }
        // Speed up polling when messages are flowing
        this._pollInterval = Math.max(1000, this._pollInterval - 500);
      } else {
        // Slow down when idle
        this._pollInterval = Math.min(10000, this._pollInterval + 500);
      }
    } catch (err) {
      console.warn('[EdgeFnProxy] Poll error:', err);
    } finally {
      this._isPolling = false;
    }
  }
}
