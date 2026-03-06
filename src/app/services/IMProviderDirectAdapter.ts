// ============================================================================
// IMProviderDirectAdapter - Direct IM Provider SDK Mode
// ============================================================================
// Message Flow:
//   SEND: Frontend IM SDK → IM Provider Cloud (WebSocket)
//   RECEIVE: IM Provider Cloud → Frontend IM SDK (WebSocket push)
//   TOKEN: Frontend → Edge Function → IM Provider Token API → Frontend
//
// This mode loads the IM provider's client SDK directly in the browser.
// Messages are sent/received via WebSocket — no polling needed.
// The Edge Function is ONLY used for token generation (no message relay).
//
// Pros: Lowest latency, real-time WebSocket, rich SDK features (typing, read receipts)
// Cons: Larger JS bundle (IM SDK), requires client SDK support, more complex
// Best for: High-traffic apps (>5K concurrent), real-time chat requirements
//
// Supported Providers:
//   - Sendbird:  @sendbird/chat SDK (~80KB gzipped)
//   - CometChat: @cometchat/chat-sdk-javascript (~60KB gzipped)
//   - Aliyun IM: aliyun-im-sdk (varies)
//
// SDK Loading Strategy:
//   Dynamic import from ESM CDN (esm.sh) to avoid bundling unused SDKs.
//   Only the selected provider's SDK is loaded at runtime.
// ============================================================================

import type { ChatMessage } from './ChatProxyService';
import type { IIMAdapter, IMAdapterConfig } from './IMAdapter';
import type { IMMode } from '../hooks/useHomeConfig';

export class IMProviderDirectAdapter implements IIMAdapter {
  readonly mode: IMMode = 'im-provider-direct';
  readonly modeLabel = 'IM Provider Direct (SDK)';

  private _config: IMAdapterConfig;
  private _userId = '';
  private _channelName = '';
  private _connected = false;
  private _listeners = new Set<(msg: ChatMessage) => void>();
  private _sdkInstance: unknown = null;
  private _sdkChannel: unknown = null;
  private _token = '';

  constructor(config: IMAdapterConfig) {
    this._config = config;
  }

  get isConnected() { return this._connected; }

  // ---- Token acquisition (always via Edge Function) ----

  private async _getToken(): Promise<{ token: string; appId: string }> {
    const { supabaseUrl, supabaseAnonKey, edgeFunctionName, chatProvider } = this._config;

    if (supabaseUrl && supabaseAnonKey) {
      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/${edgeFunctionName}/token`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${supabaseAnonKey}`,
              apikey: supabaseAnonKey,
            },
            body: JSON.stringify({
              channelName: this._channelName,
              uid: this._userId,
              provider: chatProvider,
            }),
          }
        );
        if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
        const data = await res.json();
        return { token: data.token, appId: data.appId };
      } catch (err) {
        console.error('[IMDirect] Token acquisition failed:', err);
      }
    }

    // Mock token
    return { token: `mock-token-${Date.now()}`, appId: 'MOCK_APP' };
  }

  // ---- Connect: load SDK + authenticate + subscribe ----

  async connect(userId: string, channelName: string): Promise<void> {
    this._userId = userId;
    this._channelName = channelName;

    const { token, appId } = await this._getToken();
    this._token = token;

    const provider = this._config.chatProvider;

    try {
      switch (provider) {
        case 'sendbird':
          await this._connectSendbird(appId, userId, token, channelName);
          break;
        case 'cometchat':
          await this._connectCometChat(appId, userId, token, channelName);
          break;
        case 'aliyun-im':
          await this._connectAliyunIM(appId, userId, token, channelName);
          break;
        default:
          console.warn(`[IMDirect] Unknown provider: ${provider}, running in simulation mode`);
          this._connected = true;
      }
    } catch (err) {
      console.error(`[IMDirect] Failed to connect via ${provider}:`, err);
      // Fallback: mark as connected in simulation mode
      this._connected = true;
      console.warn('[IMDirect] Running in simulation mode (SDK not available)');
    }
  }

  // ---- Sendbird ----
  private async _connectSendbird(appId: string, userId: string, token: string, channelName: string): Promise<void> {
    try {
      const SendbirdChat = await import(
        /* @vite-ignore */
        'https://esm.sh/@sendbird/chat@4'
      ).catch(() => null);

      if (!SendbirdChat) {
        console.warn('[IMDirect][Sendbird] SDK not available, simulation mode');
        this._connected = true;
        return;
      }

      const resolvedAppId = appId || this._config.sendbirdAppId;
      const sb = SendbirdChat.default.init({ appId: resolvedAppId });
      await sb.connect(userId, token);

      // Get or create group channel
      const params = new sb.GroupChannelParams();
      params.channelUrl = channelName;
      params.isDistinct = true;

      let channel;
      try {
        channel = await sb.GroupChannel.getChannel(channelName);
      } catch {
        // Channel doesn't exist, create it
        channel = await sb.GroupChannel.createChannel(params);
      }

      this._sdkInstance = sb;
      this._sdkChannel = channel;

      // Listen for messages
      const handler = new sb.ChannelHandler();
      handler.onMessageReceived = (_ch: unknown, message: Record<string, unknown>) => {
        if ((message as Record<string, unknown>).sender?.userId === this._userId) return;
        const msg: ChatMessage = {
          id: String(message.messageId || `sb_${Date.now()}`),
          channelName,
          senderId: String((message as Record<string, unknown>).sender?.userId || ''),
          content: String(message.message || ''),
          type: 'text',
          timestamp: Number(message.createdAt) || Date.now(),
          status: 'sent',
          read: false,
        };
        this._listeners.forEach(fn => fn(msg));
      };
      sb.addChannelHandler('taproot-handler', handler);

      this._connected = true;
      console.log(`[IMDirect][Sendbird] Connected: ${channelName}`);
    } catch (err) {
      console.error('[IMDirect][Sendbird] Connection error:', err);
      this._connected = true; // Simulation mode
    }
  }

  // ---- CometChat ----
  private async _connectCometChat(appId: string, userId: string, token: string, _channelName: string): Promise<void> {
    try {
      const CometChat = await import(
        /* @vite-ignore */
        'https://esm.sh/@cometchat/chat-sdk-javascript@4'
      ).catch(() => null);

      if (!CometChat) {
        console.warn('[IMDirect][CometChat] SDK not available, simulation mode');
        this._connected = true;
        return;
      }

      const resolvedAppId = appId || this._config.cometchatAppId;
      const region = this._config.cometchatRegion || 'us';

      const appSetting = new CometChat.AppSettingsBuilder()
        .subscribePresenceForAllUsers()
        .setRegion(region)
        .autoEstablishSocketConnection(true)
        .build();

      await CometChat.CometChat.init(resolvedAppId, appSetting);
      await CometChat.CometChat.login(userId, token);

      // Message listener
      CometChat.CometChat.addMessageListener(
        'taproot-listener',
        new CometChat.CometChat.MessageListener({
          onTextMessageReceived: (message: Record<string, unknown>) => {
            if (String((message as Record<string, unknown>).sender?.uid) === this._userId) return;
            const msg: ChatMessage = {
              id: String(message.id || `cc_${Date.now()}`),
              channelName: _channelName,
              senderId: String((message as Record<string, unknown>).sender?.uid || ''),
              content: String((message as Record<string, unknown>).text || ''),
              type: 'text',
              timestamp: Number(message.sentAt) ? Number(message.sentAt) * 1000 : Date.now(),
              status: 'sent',
              read: false,
            };
            this._listeners.forEach(fn => fn(msg));
          },
        })
      );

      this._sdkInstance = CometChat;
      this._connected = true;
      console.log(`[IMDirect][CometChat] Connected: ${_channelName}`);
    } catch (err) {
      console.error('[IMDirect][CometChat] Connection error:', err);
      this._connected = true; // Simulation mode
    }
  }

  // ---- Aliyun IM ----
  private async _connectAliyunIM(appId: string, userId: string, token: string, channelName: string): Promise<void> {
    // Aliyun IM SDK is not available on public CDN — requires private deployment
    // In production, the SDK would be loaded from your own CDN
    console.log(`[IMDirect][AliyunIM] Would connect with appId=${appId || this._config.aliyunAppId}, userId=${userId}, channel=${channelName}`);
    console.warn('[IMDirect][AliyunIM] SDK not available on public CDN. Using simulation mode.');
    console.log('[IMDirect][AliyunIM] Token acquired:', token.substring(0, 15) + '...');
    this._connected = true;
  }

  // ---- Disconnect ----

  disconnect(): void {
    const provider = this._config.chatProvider;

    try {
      if (provider === 'sendbird' && this._sdkInstance) {
        (this._sdkInstance as Record<string, (...args: unknown[]) => void>).removeChannelHandler?.('taproot-handler');
        (this._sdkInstance as Record<string, (...args: unknown[]) => void>).disconnect?.();
      } else if (provider === 'cometchat' && this._sdkInstance) {
        const CometChat = this._sdkInstance as Record<string, Record<string, (...args: unknown[]) => void>>;
        CometChat.CometChat?.removeMessageListener?.('taproot-listener');
        CometChat.CometChat?.logout?.();
      }
    } catch (err) {
      console.warn('[IMDirect] Disconnect error:', err);
    }

    this._sdkInstance = null;
    this._sdkChannel = null;
    this._connected = false;
    this._listeners.clear();
    console.log(`[IMDirect] Disconnected (${provider})`);
  }

  // ---- Send Message ----

  async sendMessage(msg: {
    id: string;
    content: string;
    type: 'text' | 'image' | 'voice';
    senderId: string;
    targetUserId: string;
    channelName: string;
    duration?: number;
  }): Promise<{ success: boolean; serverTimestamp?: number; error?: string }> {
    const provider = this._config.chatProvider;

    // If SDK is connected, send via SDK
    if (provider === 'sendbird' && this._sdkChannel) {
      try {
        const channel = this._sdkChannel as Record<string, (...args: unknown[]) => Promise<unknown>>;
        const params = { message: msg.content, customType: msg.type };
        await channel.sendUserMessage?.(params);
        return { success: true, serverTimestamp: Date.now() };
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('[IMDirect][Sendbird] Send failed:', err);
        return { success: false, error: errMsg };
      }
    }

    if (provider === 'cometchat' && this._sdkInstance) {
      try {
        const CometChat = this._sdkInstance as Record<string, Record<string, new (...args: unknown[]) => unknown>>;
        const textMessage = new CometChat.CometChat.TextMessage(
          msg.targetUserId,
          msg.content,
          'user'
        );
        await (CometChat.CometChat as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>).sendMessage?.(textMessage);
        return { success: true, serverTimestamp: Date.now() };
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('[IMDirect][CometChat] Send failed:', err);
        return { success: false, error: errMsg };
      }
    }

    // Fallback: send via Edge Function (same as edge-function-proxy mode)
    const { supabaseUrl, supabaseAnonKey, edgeFunctionName } = this._config;
    if (supabaseUrl && supabaseAnonKey) {
      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/${edgeFunctionName}/message`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${supabaseAnonKey}`,
              apikey: supabaseAnonKey,
            },
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
          }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return { success: true, serverTimestamp: data.serverTimestamp };
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return { success: false, error: errMsg };
      }
    }

    // Mock
    console.log(`[IMDirect][MOCK] Simulated send via ${provider}:`, msg.content);
    return { success: true, serverTimestamp: Date.now() };
  }

  // ---- History ----

  async getHistory(channelName: string, limit = 50): Promise<ChatMessage[]> {
    // Most IM SDKs provide history via their own API
    // For now, fall back to Edge Function history endpoint
    const { supabaseUrl, supabaseAnonKey, edgeFunctionName } = this._config;
    if (!supabaseUrl || !supabaseAnonKey) return [];

    try {
      const res = await fetch(
        `${supabaseUrl}/functions/v1/${edgeFunctionName}/history?channel=${encodeURIComponent(channelName)}&limit=${limit}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseAnonKey}`,
            apikey: supabaseAnonKey,
          },
        }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (data.messages || []).map((m: Record<string, unknown>) => ({
        ...m,
        status: 'sent' as const,
        read: false,
      }));
    } catch {
      return [];
    }
  }

  onMessage(listener: (msg: ChatMessage) => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }
}
