import { create } from "zustand";
import z from "zod";

// Event schemas (ported from open-grind)
const notificationEventSchema = z.object({
	type: z.string(),
	notificationId: z.string().nullish(),
	ref: z.string().nullish(),
	payload: z.unknown(),
});

export const commandResponseEventSchema = notificationEventSchema.safeExtend({
	status: z.int().nullish(),
});

export const chatV1MessageSentEventSchema = notificationEventSchema.safeExtend({
	type: z.literal("chat.v1.message_sent"),
	payload: z.unknown(),
});

export const chatV1ConversationDeleteEventSchema =
	notificationEventSchema.safeExtend({
		type: z.literal("chat.v1.conversation.delete"),
		payload: z.object({ conversationIds: z.array(z.string()) }),
	});

export const chatV1ConversationReadEventSchema =
	notificationEventSchema.safeExtend({
		type: z.literal("chat.v1.conversation_read"),
		payload: z.object({
			conversationId: z.string(),
			profileId: z.coerce.number(),
			timestamp: z.number(),
		}),
	});

export const tapV1TapSentEventSchema = notificationEventSchema.safeExtend({
	type: z.literal("tap.v1.tap_sent"),
	payload: z.object({
		timestamp: z.number(),
		senderId: z.number(),
		recipientId: z.number(),
		tapType: z.number().nullable(),
		senderProfileImageHash: z.string().nullable(),
		senderDisplayName: z.string().nullable(),
		isMutual: z.boolean(),
	}),
});

export const viewedMeV1NewViewReceivedEventSchema =
	notificationEventSchema.safeExtend({
		type: z.literal("viewed_me.v1.new_view_received"),
		payload: z.object({
			viewedCount: z.int().nullable(),
			mostRecent: z
				.object({
					profileId: z.coerce.number().int().nonnegative(),
					photoHash: z.string().nullish(),
					timestamp: z.number(),
				})
				.nullable(),
		}),
	});

export type WsStatus = "disconnected" | "connected";

type EventHandler = (payload: unknown) => void;

// ---------------------------------------------------------------------------
// Reconnect configuration
// ---------------------------------------------------------------------------

const MAX_RETRIES = 10;
const BASE_DELAY_MS = 3_000;
const MAX_DELAY_MS = 60_000;

interface WsState {
	status: WsStatus;
	ws: WebSocket | null;
	eventHandlers: Map<string, Set<EventHandler>>;
	reconnectTimer: ReturnType<typeof setTimeout> | null;
	retries: number;
	intentionalDisconnect: boolean;

	connect: (url: string, token: string) => void;
	disconnect: () => void;
	send: (type: string, payload: unknown) => void;
	on: (eventType: string, handler: EventHandler) => () => void;
	off: (eventType: string, handler: EventHandler) => void;
}

export const useWsStore = create<WsState>((set, get) => ({
	status: "disconnected",
	ws: null,
	eventHandlers: new Map(),
	reconnectTimer: null,
	retries: 0,
	intentionalDisconnect: false,

	connect(url, token) {
		const { ws: existingWs, reconnectTimer } = get();

		// Cleanup any pending reconnect timer and existing socket
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			set({ reconnectTimer: null });
		}
		if (existingWs) {
			// Prevent the old onclose handler from triggering a reconnect
			existingWs.onclose = null;
			existingWs.onerror = null;
			existingWs.close();
		}

		set({ intentionalDisconnect: false });

		const socket = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);

		socket.onopen = () => {
			set({ status: "connected", ws: socket, retries: 0 });
		};

		socket.onclose = (event) => {
			set({ status: "disconnected", ws: null, reconnectTimer: null });

			// Never reconnect after intentional disconnect or if retries exhausted
			const { intentionalDisconnect, retries } = get();
			if (intentionalDisconnect) return;
			if (retries >= MAX_RETRIES) {
				console.warn(
					`[ws] reconnect abandoned after ${MAX_RETRIES} attempts`,
				);
				return;
			}

			// Exponential backoff: 3s, 6s, 12s, 24s, 48s, then capped at 60s
			const delay = Math.min(BASE_DELAY_MS * 2 ** retries, MAX_DELAY_MS);
			const nextRetry = retries + 1;
			set({ retries: nextRetry });

			console.info(
				`[ws] reconnecting in ${delay}ms (attempt ${nextRetry}/${MAX_RETRIES})`,
			);

			const timer = setTimeout(() => {
				const current = get();
				if (current.status === "disconnected" && !current.intentionalDisconnect) {
					current.connect(url, token);
				}
			}, delay);
			set({ reconnectTimer: timer });
		};

		socket.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				const eventType = data.type;
				if (!eventType) return;

				const { eventHandlers } = get();
				const handlers = eventHandlers.get(eventType);
				if (handlers) {
					for (const handler of handlers) {
						try {
							handler(data);
						} catch (error) {
							console.error(`[ws] handler error for ${eventType}:`, error);
						}
					}
				}
			} catch (error) {
				console.error("[ws] message parse error:", error);
			}
		};

		socket.onerror = (error) => {
			console.error("[ws] error:", error);
		};

		set({ ws: socket });
	},

	disconnect() {
		const { ws, reconnectTimer } = get();
		set({ intentionalDisconnect: true });
		if (reconnectTimer) clearTimeout(reconnectTimer);
		if (ws) ws.close();
		set({ status: "disconnected", ws: null, reconnectTimer: null });
	},

	send(type, payload) {
		const { ws } = get();
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			console.error("[ws] send failed: not connected");
			return;
		}
		ws.send(JSON.stringify({ type, ref_id: crypto.randomUUID(), payload }));
	},

	on(eventType, handler) {
		const { eventHandlers } = get();
		if (!eventHandlers.has(eventType)) {
			eventHandlers.set(eventType, new Set());
		}
		eventHandlers.get(eventType)!.add(handler);
		set({ eventHandlers: new Map(eventHandlers) });

		return () => {
			get().off(eventType, handler);
		};
	},

	off(eventType, handler) {
		const { eventHandlers } = get();
		const handlers = eventHandlers.get(eventType);
		if (handlers) {
			handlers.delete(handler);
			set({ eventHandlers: new Map(eventHandlers) });
		}
	},
}));
