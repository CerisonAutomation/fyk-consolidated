import { RealtimeClient, type RealtimeChannel } from "@supabase/realtime-js";
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
  private client: RealtimeClient | null = null;
  private channels = new Map<string, RealtimeChannel>();
  private listeners = new Map<string, Set<(event: RealtimeEvent) => void>>();
  private presenceListeners = new Map<string, Set<(state: PresenceState[]) => void>>();

  private getClient(): RealtimeClient {
    if (!this.client) {
      const supabase = getSupabase();
      if (!supabase) throw new Error("Supabase not configured");
      const rt = supabase.realtime;
      if (!rt) throw new Error("Realtime client not available");
      this.client = rt as unknown as RealtimeClient;
    }
    return this.client;
  }

  subscribeToTable(
    table: string,
    callback: (event: RealtimeEvent) => void,
    filter?: { event?: string; schema?: string },
  ): () => void {
    const channelName = `realtime:${table}`;
    const channel = this.getClient().channel(channelName);

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
        this.channels.get(channelName)?.unsubscribe();
        this.channels.delete(channelName);
        this.listeners.delete(channelName);
      }
    };
  }

  subscribeToConversation(
    conversationId: string,
    onMessage: (event: RealtimeEvent) => void,
    onTyping?: (userId: string, typing: boolean) => void,
  ): () => void {
    const unsubMessage = this.subscribeToTable("messages", onMessage, {
      event: "INSERT",
    });

    let unsubTyping: (() => void) | undefined;
    if (onTyping) {
      const channelName = `typing:${conversationId}`;
      const channel = this.getClient().channel(channelName);

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          Object.entries(state).forEach(([_key, presences]) => {
            const presence = (presences as any[])[0];
            if (presence) {
              onTyping(presence.user_id, presence.typing);
            }
          });
        })
        .subscribe();

      this.channels.set(channelName, channel);
      unsubTyping = () => {
        channel.unsubscribe();
        this.channels.delete(channelName);
      };
    }

    return () => {
      unsubMessage();
      unsubTyping?.();
    };
  }

  trackPresence(userId: string, data: Record<string, unknown>): void {
    const channel = this.getClient().channel("online");
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          user_id: userId,
          online_at: new Date().toISOString(),
          ...data,
        });
      }
    });
    this.channels.set("online", channel);
  }

  broadcastTyping(conversationId: string, userId: string, isTyping: boolean): void {
    const channelName = `typing:${conversationId}`;
    let channel = this.channels.get(channelName);
    if (!channel) {
      channel = this.getClient().channel(channelName);
      this.channels.set(channelName, channel);
      channel.subscribe();
    }
    channel.track({
      user_id: userId,
      typing: isTyping,
      timestamp: Date.now(),
    });
  }

  unsubscribeAll(): void {
    this.channels.forEach((channel) => channel.unsubscribe());
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
