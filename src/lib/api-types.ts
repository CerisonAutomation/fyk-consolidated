/**
 * Client-side mirrors of the server's response shapes.
 *
 * Hand-written rather than generated because the server returns projections, not
 * rows: `distanceKm` is jittered, `presence` is derived, `canEdit`/`canRecall` are
 * time-boxed, and every field is camelCased at the boundary. Pages type against
 * these so a projection change breaks the build instead of rendering `undefined`.
 */

export type Presence = "online" | "active" | "offline";
export type Exposure = "clean" | "mature" | "explicit";

export interface PublicProfile {
	id: string;
	handle: string | null;
	displayName: string;
	headline: string | null;
	bio?: string | null;
	age: number | null;
	city: string | null;
	area: string | null;
	distanceKm: number | null;
	distanceLabel: string | null;
	avatarUrl: string | null;
	photos: { url: string; width: number | null; height: number | null }[];
	interests: string[];
	lookingFor: string[];
	bodyType: string | null;
	positionRole: string | null;
	heightCm: number | null;
	pronouns: string | null;
	exposureLevel: Exposure;
	openToMeet: boolean;
	availableUntil: string | null;
	presence: Presence;
	lastActiveAt: string;
	isSuspended: boolean;
	sharedInterests: string[];
	compatibility: number;
}

export interface DiscoverPage {
	candidates: PublicProfile[];
	page: number;
	hasMore: boolean;
	note: string | null;
}

export interface Relationship {
	blocked: boolean;
	iTapped: boolean;
	tappedMe: boolean;
	isMatch: boolean;
	iFavorited: boolean;
}

export interface ProfileView {
	profile: PublicProfile;
	relationship: Relationship;
}

export interface TapResult {
	ok: boolean;
	matched: boolean;
	conversationId: string | null;
	kind: string;
}

export interface ConversationRow {
	id: string;
	other: PublicProfile | null;
	preview: string;
	lastMessageAt: string | null;
	unread: number;
	pinned: boolean;
}

export interface ReactionRow {
	emoji: string;
	count: number;
	mine: boolean;
}

/**
 * Chat write responses, re-exported from the handler that answers them. Importing the
 * server type is deliberate: this file is the browser's copy of the API, and the
 * copy stays true by being the same declaration.
 */
export type {
	MessageActionAck,
	MessageEditAck,
	SendMessageAck,
} from "#/server/handlers/chat";

export interface MessageRow {
	id: string;
	senderId: string;
	mine: boolean;
	type: "text" | "image" | "video" | "audio";
	body: string | null;
	recalled: boolean;
	edited: boolean;
	editedAt: string | null;
	pinnedAt: string | null;
	replyToId: string | null;
	createdAt: string;
	mediaUrl: string | null;
	mediaExpiresIn: number | null;
	senderName: string;
	reactions: ReactionRow[];
	canEdit: boolean;
	canRecall: boolean;
}

export interface MessagePage {
	messages: MessageRow[];
	pinned: {
		id: string;
		body: string | null;
		senderId: string;
		pinnedAt: string;
	}[];
	hasMore: boolean;
}

export interface BoardPost {
	id: string;
	kind: "invite" | "offer" | "ask" | "text";
	body: string;
	activityId: string | null;
	spots: number | null;
	joinCount: number;
	expiresAt: string;
	createdAt: string;
	joined: boolean;
	isMine: boolean;
	joiners: { id: string; displayName: string; avatarUrl: string | null }[];
	author: PublicProfile | null;
}

export interface BoardPage {
	posts: BoardPost[];
	note: string | null;
}

export interface FykEvent {
	id: string;
	title: string;
	description: string | null;
	startsAt: string;
	endsAt: string | null;
	venue: string | null;
	address: string | null;
	city: string | null;
	capacity: number | null;
	cost: string | null;
	explicitness: Exposure;
	status: string;
	attendeeCount: number;
	attending: "going" | "maybe" | "declined" | null;
	isHost: boolean;
	host: {
		id: string;
		displayName: string | null;
		avatarUrl: string | null;
	} | null;
}

export interface EventPage {
	events: FykEvent[];
	note: string | null;
}

export interface EventDetail {
	event: FykEvent;
	attending: "going" | "maybe" | "declined" | null;
	attendees: PublicProfile[];
	attendeeCount: number;
	isHost: boolean;
}

export interface NotificationRow {
	id: string;
	kind: "match" | "message" | "event" | "board" | "system" | "safety" | string;
	title: string;
	body: string | null;
	deepLink: string | null;
	read: boolean;
	createdAt: string;
}

export interface ReportRow {
	id: string;
	targetType: "profile" | "message" | "board_post" | "event" | string;
	targetId: string;
	reason: string;
	status: "open" | "in_review" | "action_taken" | "dismissed" | string;
	severity: "normal" | "urgent" | string;
	createdAt: string;
	reviewedAt: string | null;
	resolved: boolean;
}

export interface BlockedRow {
	id: string;
	displayName: string;
	avatarUrl: string | null;
}

export interface ViewRow {
	profileId: string;
	displayName: string;
	avatarUrl: string | null;
	age: number | null;
	viewedAt: string;
}

export interface SelfSettings {
	profile: PublicProfile;
	privacy: {
		hideDistance: boolean;
		hideOnline: boolean;
		incognito: boolean;
		exposureLevel: Exposure;
		openToMeet: boolean;
		availableUntil: string | null;
	};
}

export interface ModerationRow {
	id: string;
	reporterId: string;
	targetType: string;
	targetId: string;
	reason: string;
	details: string | null;
	status: string;
	severity: string;
	createdAt: string;
	reviewedAt: string | null;
	resolution: string | null;
	duplicateCount: number;
	target: {
		id: string;
		displayName: string;
		handle: string | null;
		age: number | null;
		suspended: boolean;
		role: string;
		joinedAt: string | null;
	} | null;
}

export interface ModerationQueue {
	reports: ModerationRow[];
	counts: { open: number };
}

export interface ModerationDetail {
	report: Record<string, unknown> | null;
	target: Record<string, unknown> | null;
	history: {
		id: string;
		action: string;
		note: string | null;
		created_at: string;
	}[];
	priorAgainstTarget: {
		id: string;
		reason: string;
		status: string;
		created_at: string;
	}[];
}
