// ============================================================================
// SupabaseRealtimeAdapter - Supabase Realtime WebSocket Mode
// ============================================================================
// Message Flow:
//   SEND: Frontend → Edge Function → INSERT into chat_messages table
//   RECEIVE: Supabase Realtime subscribes to chat_messages table changes → WebSocket push
//
// This mode uses Supabase's built-in Realtime feature (Postgres Changes).
// No third-party IM SDK needed. All messages are stored in Supabase DB.
//
// Pros: Simple, no IM SDK costs, built-in with Supabase
// Cons: Realtime concurrent connection limits (500 on Pro plan)
// Best for: < 50K concurrent users or when you want simplicity
//
// Required Supabase setup:
//   1. Create `chat_messages` table (see schema below)
//   2. Enable Realtime on the table: ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
//   3. Deploy Edge Function for message sending
//
// Table schema:
//   CREATE TABLE chat_messages (
//     id TEXT PRIMARY KEY,
//     channel_name TEXT NOT NULL,
//     sender_id TEXT NOT NULL,
//     target_user_id TEXT,
//     content TEXT DEFAULT '',
//     type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'voice')),
//     duration INTEGER,
//     timestamp BIGINT NOT NULL,
//     created_at TIMESTAMPTZ DEFAULT NOW()
//   );
//   CREATE INDEX idx_chat_messages_channel ON chat_messages(channel_name, timestamp);
//   ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
// ============================================================================

import type { ChatMessage } from './ChatProxyService';
import type { IIMAdapter, IMAdapterConfig } from './IMAdapter';
import type { IMMode } from '../hooks/useHomeConfig';

export class SupabaseRealtimeAdapter implements IIMAdapter {
  readonly mode: IMMode = 'supabase-realtime';
  readonly modeLabel = 'Supabase Realtime';

  private _config: IMAdapterConfig;
  private _userId = '';
  private _channelName = '';
  private _connected = false;
  private _listeners = new Set<(msg: ChatMessage) => void>();
  private _supabaseClient: any = null; // @supabase/supabase-js client (lazy loaded)
  private _subscription: any = null;

  constructor(config: IMAdapterConfig) {
    this._config = config;
  }

  get isConnected() { return this._connected; }

  async connect(userId: string, channelName: string): Promise<void> {
    this._userId = userId;
    this._channelName = channelName;

    const { supabaseUrl, supabaseAnonKey } = this._config;
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[SupabaseRT] No Supabase URL/Key configured. Running in simulation mode.');
      this._connected = true;
      return;
    }

    try {
      // Dynamic import @supabase/supabase-js to avoid hard dependency
      // If not installed, falls back to REST-only mode
      const { createClient } = await import(
        /* @vite-ignore */
        'https://esm.sh/@supabase/supabase-js@2'
      ).catch(() => {
        console.warn('[SupabaseRT] @supabase/supabase-js not available, using REST fallback');
        return { createClient: null };
      });

      if (createClient) {
        this._supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
          realtime: {
            params: {
              eventsPerSecond: 10,
            },
          },
        });

        // Subscribe to INSERT events on chat_messages for this channel
        this._subscription = this._supabaseClient
          .channel(`chat:${channelName}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'chat_messages',
              filter: `channel_name=eq.${channelName}`,
            },
            (payload: any) => {
              const row = payload.new;
              // Skip own messages
              if (row.sender_id === this._userId) return;

              const msg: ChatMessage = {
                id: row.id,
                channelName: row.channel_name,
                senderId: row.sender_id,
                content: row.content || '',
                type: row.type || 'text',
                timestamp: Number(row.timestamp) || Date.now(),
                status: 'sent',
                read: false,
                duration: row.duration,
              };

              this._listeners.forEach(fn => fn(msg));
            }
          )
          .subscribe((status: string) => {
            console.log(`[SupabaseRT] Subscription status: ${status}`);
            this._connected = status === 'SUBSCRIBED';
          });

        console.log(`[SupabaseRT] Subscribed to channel: ${channelName}`);
      } else {
        // REST fallback: no realtime, just polling
        console.log('[SupabaseRT] Running without Realtime SDK (REST only)');
        this._connected = true;
      }
    } catch (err) {
      console.error('[SupabaseRT] Connection error:', err);
      this._connected = true; // Still allow sending via REST
    }
  }

  disconnect(): void {
    if (this._subscription) {
      this._subscription.unsubscribe();
      this._subscription = null;
    }
    if (this._supabaseClient) {
      this._supabaseClient.removeAllChannels();
      this._supabaseClient = null;
    }
    this._connected = false;
    this._listeners.clear();
    console.log('[SupabaseRT] Disconnected');
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
    const { supabaseUrl, supabaseAnonKey, edgeFunctionName } = this._config;

    // Option 1: If Supabase client is available, INSERT directly
    if (this._supabaseClient) {
      try {
        const { error } = await this._supabaseClient
          .from('chat_messages')
          .insert({
            id: msg.id,
            channel_name: msg.channelName,
            sender_id: msg.senderId,
            target_user_id: msg.targetUserId,
            content: msg.content,
            type: msg.type,
            duration: msg.duration,
            timestamp: Date.now(),
          });

        if (error) throw error;
        return { success: true, serverTimestamp: Date.now() };
      } catch (err: any) {
        console.error('[SupabaseRT] Direct insert failed:', err);
        // Fall through to Edge Function
      }
    }

    // Option 2: Send via Edge Function (always available)
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
              provider: 'supabase', // Signal to Edge Function: just INSERT into DB
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
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    // Mock mode
    console.log('[SupabaseRT][MOCK] Simulated send:', msg.content);
    return { success: true, serverTimestamp: Date.now() };
  }

  async getHistory(channelName: string, limit = 50): Promise<ChatMessage[]> {
    if (this._supabaseClient) {
      try {
        const { data, error } = await this._supabaseClient
          .from('chat_messages')
          .select('*')
          .eq('channel_name', channelName)
          .order('timestamp', { ascending: true })
          .limit(limit);

        if (error) throw error;

        return (data || []).map((row: any) => ({
          id: row.id,
          channelName: row.channel_name,
          senderId: row.sender_id,
          content: row.content || '',
          type: row.type || 'text',
          timestamp: Number(row.timestamp) || 0,
          status: 'sent' as const,
          read: false,
          duration: row.duration,
        }));
      } catch (err) {
        console.warn('[SupabaseRT] History fetch failed:', err);
      }
    }
    return [];
  }

  onMessage(listener: (msg: ChatMessage) => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }
}
