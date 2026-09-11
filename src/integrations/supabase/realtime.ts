import { getSupabase } from "./client";

type RealtimeEvent = {
  event: "INSERT" | "UPDATE" | "DELETE" | "*";
  schema: string;
  table: string;
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
};

type PresenceState = {
  key: string;
  presence: Record<string, unknown>;
};

export class SupabaseRealtime {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private channels = new Map<string, any>();
  private listeners = new Map<string, Set<(event: RealtimeEvent) => void>>();
  private presenceListeners = new Map<string, Set<(state: PresenceState[]) => void>>();

  private getSupabaseClient() {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase not configured");
    return supabase;
  }

  subscribeToTable(
    table: string,
    callback: (event: RealtimeEvent) => void,
    filter?: { event?: string; schema?: string },
  ): () => void {
    const channelName = `realtime:${table}`;
    const channel = this.getSupabaseClient().channel(channelName);

    if (!this.channels.has(channelName)) {
      this.channels.set(channelName, channel);

      channel
        .on("postgres_changes", {
          event: (filter?.event as any) || "*",
          schema: filter?.schema || "public",
          table,
        }, (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown>; schema: string; table: string }) => {
          const listeners = this.listeners.get(channelName);
          if (listeners) {
            listeners.forEach((cb) => cb({
              event: payload.eventType as RealtimeEvent["event"],
              schema: payload.schema,
              table: payload.table,
              new: payload.new,
              old: payload.old,
            }));
          }
        })
        .subscribe();
    }

    if (!this.listeners.has(channelName)) {
      this.listeners.set(channelName, new Set());
    }
    this.listeners.get(channelName)!.add(callback);

    return () => {
      this.listeners.get(channelName)?.delete(callback);
      if (this.listeners.get(channelName)?.size === 0) {
        const ch = this.channels.get(channelName);
        if (ch) {
          this.getSupabaseClient().removeChannel(ch);
        }
        this.channels.delete(channelName);
        this.listeners.delete(channelName);
      }
    };
  }

  /**
   * Subscribe to a conversation's messages with a filter on conversation_id,
   * and optionally listen for typing indicators via Broadcast (not Presence).
   *
   * Per Supabase docs:
   *   - Postgres Changes: use filter to scope to a specific conversation
   *   - Typing indicators: use Broadcast (fire-and-forget), NOT Presence
   *     (Presence is for slow-changing state like online/offline status)
   *   - Presence for typing floods the channel with rapid track() calls
   */
  subscribeToConversation(
    conversationId: string,
    onMessage: (event: RealtimeEvent) => void,
    onTyping?: (userId: string, typing: boolean) => void,
  ): () => void {
    // 1. Postgres Changes for messages — filtered to this conversation
    const messageChannelName = `realtime:messages:${conversationId}`;
    const messageChannel = this.getSupabaseClient().channel(messageChannelName);

    if (!this.channels.has(messageChannelName)) {
      this.channels.set(messageChannelName, messageChannel);

      messageChannel
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        }, (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown>; schema: string; table: string }) => {
          const listeners = this.listeners.get(messageChannelName);
          if (listeners) {
            listeners.forEach((cb) => cb({
              event: payload.eventType as RealtimeEvent["event"],
              schema: payload.schema,
              table: payload.table,
              new: payload.new,
              old: payload.old,
            }));
          }
        })
        .subscribe();
    }

    if (!this.listeners.has(messageChannelName)) {
      this.listeners.set(messageChannelName, new Set());
    }
    this.listeners.get(messageChannelName)!.add(onMessage);

    const unsubMessage = () => {
      this.listeners.get(messageChannelName)?.delete(onMessage);
      if (this.listeners.get(messageChannelName)?.size === 0) {
        const ch = this.channels.get(messageChannelName);
        if (ch) {
          this.getSupabaseClient().removeChannel(ch);
        }
        this.channels.delete(messageChannelName);
        this.listeners.delete(messageChannelName);
      }
    };

    // 2. Typing indicators via Broadcast (not Presence)
    //    Per docs: "Typing indicators: Use Broadcast with throttle"
    let unsubTyping: (() => void) | undefined;
    if (onTyping) {
      const typingChannelName = `typing:${conversationId}`;
      const typingChannel = this.getSupabaseClient().channel(typingChannelName);

      typingChannel
        .on("broadcast", { event: "typing" }, ({ payload }: { payload: any }) => {
          onTyping(payload.userId, payload.isTyping);
        })
        .subscribe();

      this.channels.set(typingChannelName, typingChannel);
      unsubTyping = () => {
        const ch = this.channels.get(typingChannelName);
        if (ch) {
          this.getSupabaseClient().removeChannel(ch);
        }
        this.channels.delete(typingChannelName);
      };
    }

    return () => {
      unsubMessage();
      unsubTyping?.();
    };
  }

  /**
   * Track user presence (online/offline status).
   * Per docs: Presence is for slow-changing state like online status.
   * Uses supabase.removeChannel() for cleanup.
   */
  trackPresence(userId: string, data: Record<string, unknown>): void {
    // Clean up existing presence channel before creating a new one
    const existing = this.channels.get("online");
    if (existing) {
      this.getSupabaseClient().removeChannel(existing);
      this.channels.delete("online");
    }

    const channel = this.getSupabaseClient().channel("online", {
      config: {
        presence: {
          key: `user-${userId}`,
        },
      },
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          userId,
          online_at: new Date().toISOString(),
          ...data,
        });
      }
    });
    this.channels.set("online", channel);
  }

  /**
   * Broadcast a typing indicator using Broadcast (fire-and-forget),
   * NOT Presence. Per Supabase docs:
   *   - Broadcast for high-frequency ephemeral events (typing, cursors)
   *   - Presence for slow-changing state (online status, active document)
   *   - Calling track() rapidly floods the channel
   */
  broadcastTyping(conversationId: string, userId: string, isTyping: boolean): void {
    const channelName = `typing:${conversationId}`;
    let channel = this.channels.get(channelName);
    if (!channel) {
      channel = this.getSupabaseClient().channel(channelName);
      this.channels.set(channelName, channel);
      channel.subscribe();
    }
    // Use broadcast.send() instead of channel.track() (presence)
    channel.send({
      type: "broadcast",
      event: "typing",
      payload: {
        userId,
        isTyping,
        timestamp: Date.now(),
      },
    });
  }

  unsubscribeAll(): void {
    this.channels.forEach((channel) => {
      this.getSupabaseClient().removeChannel(channel);
    });
    this.channels.clear();
    this.listeners.clear();
    this.presenceListeners.clear();
  }
}

let instance: SupabaseRealtime | null = null;

export function getRealtime(): SupabaseRealtime {
  if (!instance) instance = new SupabaseRealtime();
  return instance;
}
