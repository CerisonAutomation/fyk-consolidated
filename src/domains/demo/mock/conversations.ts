import { demoMeProfileId, HOUR, MINUTE, NOW } from "../config";
import { hashFromSeed } from "./avatars";
import { demoFavoriteOf } from "./grid";
import { lastOnlineOf, onlineUntilOf, photosOf, profileSeed } from "./profiles";

type DemoMessage = { fromMe: boolean; reactions?: number } & (
	| { kind?: "text"; text: string }
	| { kind: "image" }
	| { kind: "expiringImage"; expired?: boolean }
	| {
			kind: "album";
			albumId: number;
			expiring?: "v1" | "v2";
			locked?: boolean;
			unseen?: boolean;
			coverUrl?: null;
	  }
	| { kind: "unsent" }
);

type DemoConversation = {
	withId: number;
	unread: number;
	pinned: boolean;
	favorite: boolean;
	muted: boolean;
	lastActivityAgo: number;
	messages: DemoMessage[];
};

const demoConversationSeeds: DemoConversation[] = [
	{
		withId: 100001,
		unread: 2,
		pinned: false,
		favorite: true,
		muted: true,
		lastActivityAgo: 4,
		messages: [
			{ fromMe: false, text: "Hey! Your coffee recommendation was excellent." },
			{
				fromMe: true,
				text: "Glad you liked it. Want to try the new place by the harbour?",
				reactions: 1,
			},
			{ fromMe: false, text: "Definitely. Thursday after work?" },
		],
	},
	{
		withId: 100006,
		unread: 1,
		pinned: false,
		favorite: false,
		muted: false,
		lastActivityAgo: 1,
		messages: [
			{ fromMe: false, text: "👀" },
			{ fromMe: true, text: "That sunset photo is unreal." },
			{ fromMe: false, text: "Right? The light lasted about two minutes 🔥" },
		],
	},
	{
		withId: 100009,
		unread: 0,
		pinned: true,
		favorite: false,
		muted: false,
		lastActivityAgo: 52,
		messages: [
			{ fromMe: true, text: "Are you still going to the exhibition Saturday?" },
			{ fromMe: false, text: "Yes, around three. Join me?" },
			{ fromMe: true, text: "Perfect. I will meet you at the main entrance." },
		],
	},
	{
		withId: 100250,
		unread: 0,
		pinned: false,
		favorite: false,
		muted: true,
		lastActivityAgo: 18,
		messages: [
			{ fromMe: false, text: "Great meeting you last night." },
			{ fromMe: true, text: "You too. Let us do it again soon 👍" },
		],
	},
	{
		withId: 100777,
		unread: 3,
		pinned: false,
		favorite: false,
		muted: false,
		lastActivityAgo: 7,
		messages: [
			{ fromMe: false, text: "I found that live music place I mentioned." },
			{ fromMe: false, text: "They have a set at nine on Friday." },
			{ fromMe: false, text: "Interested?" },
		],
	},
];

const MESSAGE_GAP = 7 * MINUTE;

export function conversationIdFor(withId: number): string {
	return `${Math.min(demoMeProfileId, withId)}:${Math.max(demoMeProfileId, withId)}`;
}

function lastActivityOf(conv: DemoConversation): number {
	return NOW - conv.lastActivityAgo * MINUTE;
}

function buildMessage({
	conv,
	message,
	index,
	timestamp,
}: {
	conv: DemoConversation;
	message: DemoMessage;
	index: number;
	timestamp: number;
}): Record<string, unknown> {
	const conversationId = conversationIdFor(conv.withId);
	const messageId = `${index}:demo-${conv.withId}-${index}`;
	const senderId = message.fromMe ? demoMeProfileId : conv.withId;
	const reactions = Array.from({ length: message.reactions ?? 0 }, () => ({
		profileId: message.fromMe ? conv.withId : demoMeProfileId,
		reactionType: 1,
	}));
	const base = { messageId, conversationId, senderId, timestamp, reactions };
	switch (message.kind) {
		case "unsent":
			return { type: "Unsent", body: null, ...base, unsent: true };
		default:
			return {
				type: "Text",
				body: { text: "text" in message ? message.text : "" },
				...base,
				unsent: false,
			};
	}
}

function threadMessages(conv: DemoConversation): Record<string, unknown>[] {
	const lastActivity = lastActivityOf(conv);
	const count = conv.messages.length;
	const ordered = conv.messages.map((message, i) =>
		buildMessage({
			conv,
			message,
			index: i,
			timestamp: lastActivity - (count - 1 - i) * MESSAGE_GAP,
		}),
	);
	return ordered.reverse();
}

export function demoConversations({
	page,
	favoritesOnly = false,
}: {
	page: number;
	favoritesOnly?: boolean;
}): { entries: unknown[]; nextPage: number | null } {
	if (page > 1) return { entries: [], nextPage: null };
	const entries = demoConversationSeeds
		.filter(
			(conv) => !favoritesOnly || demoFavoriteOf({ profileId: conv.withId }),
		)
		.map((conv) => {
			const conversationId = conversationIdFor(conv.withId);
			const seed = profileSeed(conv.withId);
			const photos = photosOf(conv.withId);
			const latest = threadMessages(conv).at(0);
			const latestBody =
				latest?.body && typeof latest.body === "object"
					? (latest.body as Record<string, unknown>)
					: null;
			return {
				type: "full_conversation_v1",
				data: {
					conversationId,
					name: seed.name ?? "Grindr user",
					participants: [
						{
							profileId: conv.withId,
							primaryMediaHash: photos[0] ?? null,
							lastOnline: lastOnlineOf(seed),
							onlineUntil: onlineUntilOf(seed),
							distanceMetres: seed.distanceM,
							position: seed.position,
							isInAList: demoFavoriteOf({ profileId: conv.withId }),
							hasDatingPotential: false,
						},
					],
					lastActivityTimestamp: lastActivityOf(conv),
					unreadCount: conv.unread,
					preview:
						typeof latestBody?.text === "string" ? latestBody.text : null,
					muted: conv.muted,
					pinned: conv.pinned,
					favorite: demoFavoriteOf({ profileId: conv.withId }),
					rightNow: "NOT_ACTIVE",
					onlineUntil: onlineUntilOf(seed),
					hasUnreadThrob: false,
				},
			};
		})
		.sort(
			(a, b) => b.data.lastActivityTimestamp - a.data.lastActivityTimestamp,
		);
	return { entries, nextPage: null };
}

export function demoConversationMessages({
	conversationId,
	pageKey: _pageKey,
}: {
	conversationId: string;
	pageKey?: string;
}) {
	const conv = demoConversationSeeds.find(
		(candidate) => conversationIdFor(candidate.withId) === conversationId,
	);
	const withId = conv?.withId ?? Number(conversationId.split(":").at(-1));
	const seed = profileSeed(Number.isFinite(withId) ? withId : 100001);
	const photos = photosOf(seed.id);
	return {
		lastReadTimestamp: null,
		messages: [
			...(sentMessagesByConversation.get(conversationId) ?? []),
			...(conv ? threadMessages(conv) : []),
		],
		profile: {
			distance: seed.distanceM,
			mediaHash: photos[0] ?? null,
			name: seed.name,
			onlineUntil: onlineUntilOf(seed),
			profileId: seed.id,
			showDistance: true,
		},
	};
}

export function demoSingleMessage({
	conversationId: _conversationId,
	messageId: _messageId,
}: {
	conversationId: string;
	messageId: string;
}) {
	return { message: null };
}

let demoSentCounter = 0;
const sentMessagesByConversation = new Map<string, Record<string, unknown>[]>();

export function demoSentMessage(body: unknown): Record<string, unknown> {
	const sent = body as {
		type?: string | number;
		target?: { targetId?: number };
		body?: unknown;
	};
	const targetId = sent.target?.targetId ?? 0;
	const timestamp = Date.now();
	const conversationId = conversationIdFor(targetId);
	const text =
		typeof sent.body === "string"
			? sent.body
			: sent.body && typeof sent.body === "object" && "text" in sent.body
				? String((sent.body as { text: unknown }).text)
				: "";
	const message = {
		type: "Text",
		body: { text },
		messageId: `${timestamp}:demo-sent-${targetId}-${demoSentCounter++}`,
		conversationId,
		senderId: demoMeProfileId,
		timestamp,
		unsent: false,
		reactions: [],
	};
	const messages = sentMessagesByConversation.get(conversationId) ?? [];
	sentMessagesByConversation.set(conversationId, [message, ...messages]);
	return message;
}

export function demoUploadChatMedia({
	bytes,
	contentType,
}: {
	bytes: Uint8Array<ArrayBuffer>;
	contentType: string;
}): { mediaId: number; url: string; mediaHash: string } {
	const mediaId = 920_000 + demoSentCounter++;
	const url = URL.createObjectURL(new Blob([bytes], { type: contentType }));
	return {
		mediaId,
		url,
		mediaHash: hashFromSeed(`drawer-${mediaId}`),
	};
}

export function demoDrawerMedia() {
	return Array.from({ length: 10 }, (_, index) => ({
		id: 910_000 + index,
		url: `https://picsum.photos/seed/opengrind-drawer-${index}/600/800`,
		contentType: "image/jpeg",
		createdTs: NOW - (index + 1) * HOUR,
		used: index % 3 === 0,
		takenOnGrindr: false,
	}));
}
