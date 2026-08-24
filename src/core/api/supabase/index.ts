/**
 * Supabase data access layer.
 * Replaces the demo/mock layer with real Supabase queries.
 */
import { supabase } from "#/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Types matching the Supabase table schemas
// ---------------------------------------------------------------------------

export type DbProfile = {
	id: number;
	isMe: boolean;
	displayName: string | null;
	age: number | null;
	showAge: boolean;
	bio: string | null;
	position: number | null;
	bodyType: number | null;
	ethnicity: number | null;
	relationship: number | null;
	hivStatus: number | null;
	heightCm: number | null;
	weightGrams: number | null;
	tribes: string;
	lookingFor: string;
	meetAt: string;
	instagram: string | null;
	lat: number;
	lon: number;
	geohash: string;
	onlineUntil: string | null;
	lastSeen: string;
	isFavorite: boolean;
	favoriteNote: string | null;
	favoritePhone: string | null;
	verified: boolean;
	rightNowStatus: string;
	rightNowText: string | null;
	isBlocked: boolean;
	isHidden: boolean;
	isVisiting: boolean;
	unreadCount: number;
	hasChatted24h: boolean;
	isNew: boolean;
	createdAt: string;
	updatedAt: string;
	userId: string | null;
};

export type DbPhoto = {
	id: number;
	profileId: number;
	hash: string;
	position: number;
};

export type DbConversation = {
	id: number;
	createdAt: string;
	updatedAt: string;
	pinned: boolean;
	muted: boolean;
	favorite: boolean;
	unread: number;
	draft: string | null;
};

export type DbMessage = {
	id: number;
	conversationId: number;
	authorId: number;
	kind: string;
	text: string | null;
	imageHash: string | null;
	expiring: boolean;
	createdAt: string;
	reactions: string;
	replyToId: number | null;
	readAt: string | null;
};

export type DbTap = {
	id: number;
	fromId: number;
	toId: number;
	type: number;
	createdAt: string;
};

export type DbView = {
	id: number;
	viewerId: number;
	viewedId: number;
	source: number;
	createdAt: string;
};

// ---------------------------------------------------------------------------
// Photo helpers
// ---------------------------------------------------------------------------

export async function getPhotosForProfile(
	profileId: number,
): Promise<DbPhoto[]> {
	const { data, error } = await supabase
		.from("Photo")
		.select("*")
		.eq("profileId", profileId)
		.order("position", { ascending: true });
	if (error) {
		console.error("[supabase-api] getPhotosForProfile error", error);
		return [];
	}
	return (data ?? []) as DbPhoto[];
}

export async function getPhotosForProfiles(
	profileIds: number[],
): Promise<Map<number, DbPhoto[]>> {
	if (profileIds.length === 0) return new Map();
	const { data, error } = await supabase
		.from("Photo")
		.select("*")
		.in("profileId", profileIds)
		.order("position", { ascending: true });
	if (error) {
		console.error("[supabase-api] getPhotosForProfiles error", error);
		return new Map();
	}
	const map = new Map<number, DbPhoto[]>();
	for (const photo of (data ?? []) as DbPhoto[]) {
		const list = map.get(photo.profileId) ?? [];
		list.push(photo);
		map.set(photo.profileId, list);
	}
	return map;
}

export async function getMyUploadedPhotos(): Promise<DbPhoto[]> {
	const { data: meProfile } = await supabase
		.from("Profile")
		.select("id")
		.eq("isMe", true)
		.single();
	if (!meProfile) return [];
	return getPhotosForProfile(meProfile.id);
}

// ---------------------------------------------------------------------------
// Grid / Cascade (browse nearby profiles)
// ---------------------------------------------------------------------------

type GridQuery = {
	nearbyGeoHash?: string;
	pageNumber?: number;
	favorites?: boolean;
	onlineOnly?: boolean;
	ageMin?: number;
	ageMax?: number;
	photoOnly?: boolean;
};

export type GridProfileItem = {
	type: "full_profile_v1" | "partial_profile_v1";
	data: {
		profileId: number;
		onlineUntil: string | null;
		displayName: string | null;
		distanceMeters: number | undefined;
		lastOnline: string;
		rightNow: string;
		unreadCount: number;
		isVisiting: boolean;
		isPopular: boolean;
		primaryImageUrl: string | undefined;
		favorite: boolean;
		viewed: boolean;
		chatted: boolean;
		roaming: boolean;
		age: number | undefined;
		heightCm: number | undefined;
		weightGrams: number | undefined;
		bodyType: number | undefined;
	};
};

const PAGE_SIZE = 60;

export async function getGridProfiles(
	query: GridQuery,
): Promise<{ items: GridProfileItem[]; nextPage: number | null }> {
	const page = query.pageNumber ?? 0;
	const from = page * PAGE_SIZE;
	const to = from + PAGE_SIZE - 1;

	let qb = supabase
		.from("Profile")
		.select("*", { count: "exact" })
		.eq("isMe", false)
		.eq("isBlocked", false)
		.eq("isHidden", false)
		.order("geohash", { ascending: true })
		.range(from, to);

	if (query.favorites) {
		qb = qb.eq("isFavorite", true);
	}
	if (query.onlineOnly) {
		qb = qb.not("onlineUntil", "is", null);
		qb = qb.gte("onlineUntil", new Date().toISOString());
	}
	if (query.ageMin !== undefined) {
		qb = qb.gte("age", query.ageMin);
	}
	if (query.ageMax !== undefined) {
		qb = qb.lte("age", query.ageMax);
	}

	const { data, error, count } = await qb;
	if (error) {
		console.error("[supabase-api] getGridProfiles error", error);
		return { items: [], nextPage: null };
	}

	const profiles = (data ?? []) as DbProfile[];
	const photoMap = await getPhotosForProfiles(profiles.map((p) => p.id));

	const items: GridProfileItem[] = profiles.map((p, i) => {
		const photos = photoMap.get(p.id) ?? [];
		const primaryHash = photos[0]?.hash;
		const isPartial = (p.id % 9 === 0) || i % 15 === 0;
		return {
			type: isPartial ? "partial_profile_v1" : "full_profile_v1",
			data: {
				profileId: p.id,
				onlineUntil: p.onlineUntil,
				displayName: p.displayName,
				distanceMeters: undefined,
				lastOnline: p.lastSeen,
				rightNow: p.rightNowStatus,
				unreadCount: p.unreadCount,
				isVisiting: p.isVisiting,
				isPopular: p.isFavorite || p.unreadCount > 0,
				primaryImageUrl: primaryHash
					? `https://api.dicebear.com/10.x/lorelei/svg?seed=${primaryHash}`
					: undefined,
				favorite: p.isFavorite,
				viewed: false,
				chatted: p.hasChatted24h,
				roaming: false,
				age: p.age ?? undefined,
				heightCm: p.heightCm ?? undefined,
				weightGrams: p.weightGrams ?? undefined,
				bodyType: p.bodyType ?? undefined,
			},
		};
	});

	const total = count ?? 0;
	const hasMore = from + PAGE_SIZE < total;

	return { items, nextPage: hasMore ? page + 1 : null };
}

// ---------------------------------------------------------------------------
// Profile fetching
// ---------------------------------------------------------------------------

export async function getProfileById(
	profileId: number,
): Promise<DbProfile | null> {
	const { data, error } = await supabase
		.from("Profile")
		.select("*")
		.eq("id", profileId)
		.single();
	if (error) {
		console.error("[supabase-api] getProfileById error", error);
		return null;
	}
	return data as DbProfile;
}

export async function getProfilesByIds(
	ids: number[],
): Promise<DbProfile[]> {
	if (ids.length === 0) return [];
	const { data, error } = await supabase
		.from("Profile")
		.select("*")
		.in("id", ids);
	if (error) {
		console.error("[supabase-api] getProfilesByIds error", error);
		return [];
	}
	return (data ?? []) as DbProfile[];
}

// ---------------------------------------------------------------------------
// Conversations (inbox)
// ---------------------------------------------------------------------------

export type ConversationEntry = {
	type: "full_conversation_v1";
	data: {
		conversationId: string;
		name: string;
		participants: Array<{
			profileId: number;
			primaryMediaHash: string | null;
			lastOnline: string;
			onlineUntil: string | null;
			distanceMetres: number | null;
			position: string | null;
			isInAList: boolean;
			hasDatingPotential: boolean;
		}>;
		lastActivityTimestamp: string;
		unreadCount: number;
		preview: string | null;
		muted: boolean;
		pinned: boolean;
		favorite: boolean;
		rightNow: string;
		onlineUntil: string | null;
		hasUnreadThrob: boolean;
	};
};

function conversationIdFor(a: number, b: number): string {
	return `${Math.min(a, b)}:${Math.max(a, b)}`;
}

export async function getConversations(
	_page = 1,
): Promise<{
	entries: ConversationEntry[];
	nextPage: number | null;
}> {
	const { data: meProfile } = await supabase
		.from("Profile")
		.select("id")
		.eq("isMe", true)
		.single();
	const meId = meProfile?.id;
	if (!meId) return { entries: [], nextPage: null };

	// Get conversations I'm part of
	const { data: participations } = await supabase
		.from("ConversationParticipant")
		.select("conversationId")
		.eq("profileId", meId);

	if (!participations || participations.length === 0) {
		return { entries: [], nextPage: null };
	}

	const convIds = participations.map((p) => p.conversationId);

	const { data: conversations } = await supabase
		.from("Conversation")
		.select("*")
		.in("id", convIds)
		.order("updatedAt", { ascending: false });

	if (!conversations) return { entries: [], nextPage: null };

	const entries: ConversationEntry[] = [];

	for (const conv of conversations as DbConversation[]) {
		// Get the other participant
		const { data: otherParts } = await supabase
			.from("ConversationParticipant")
			.select("profileId")
			.eq("conversationId", conv.id)
			.neq("profileId", meId);

		if (!otherParts || otherParts.length === 0) continue;
		const otherId = otherParts[0].profileId;

		const otherProfile = await getProfileById(otherId);
		const photos = await getPhotosForProfile(otherId);
		const primaryHash = photos[0]?.hash ?? null;

		// Get last message for preview
		const { data: lastMsg } = await supabase
			.from("Message")
			.select("text, kind")
			.eq("conversationId", conv.id)
			.order("createdAt", { ascending: false })
			.limit(1)
			.single();

		const preview =
			lastMsg && lastMsg.kind === "text" ? (lastMsg.text ?? "") : null;

		entries.push({
			type: "full_conversation_v1",
			data: {
				conversationId: conversationIdFor(meId, otherId),
				name: otherProfile?.displayName ?? "User",
				participants: [
					{
						profileId: otherId,
						primaryMediaHash: primaryHash,
						lastOnline: otherProfile?.lastSeen ?? new Date().toISOString(),
						onlineUntil: otherProfile?.onlineUntil ?? null,
						distanceMetres: null,
						position: null,
						isInAList: otherProfile?.isFavorite ?? false,
						hasDatingPotential: false,
					},
				],
				lastActivityTimestamp: conv.updatedAt,
				unreadCount: conv.unread,
				preview,
				muted: conv.muted,
				pinned: conv.pinned,
				favorite: conv.favorite,
				rightNow: otherProfile?.rightNowStatus ?? "NOT_ACTIVE",
				onlineUntil: otherProfile?.onlineUntil ?? null,
				hasUnreadThrob: false,
			},
		});
	}

	// Sort by pinned first, then by last activity
	entries.sort((a, b) => {
		if (a.data.pinned !== b.data.pinned) return a.data.pinned ? -1 : 1;
		return (
			new Date(b.data.lastActivityTimestamp).getTime() -
			new Date(a.data.lastActivityTimestamp).getTime()
		);
	});

	return { entries, nextPage: null };
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function getConversationMessages(conversationId: string) {
	const parts = conversationId.split(":");
	if (parts.length !== 2)
		return { lastReadTimestamp: null, messages: [], profile: null };

	const [idA, idB] = parts.map(Number);
	const meId = (await supabase.from("Profile").select("id").eq("isMe", true).single()).data?.id;

	// Find the actual conversation ID from ConversationParticipant
	let actualConvId: number | null = null;
	if (meId) {
		const { data: parts } = await supabase
			.from("ConversationParticipant")
			.select("conversationId")
			.eq("profileId", meId);
		if (parts) {
			for (const p of parts) {
				const { data: otherParts } = await supabase
					.from("ConversationParticipant")
					.select("profileId")
					.eq("conversationId", p.conversationId)
					.neq("profileId", meId);
				if (otherParts && otherParts.length > 0) {
					const otherId = otherParts[0].profileId;
					const cid = conversationIdFor(meId, otherId);
					if (cid === conversationId) {
						actualConvId = p.conversationId;
						break;
					}
				}
			}
		}
	}

	if (actualConvId === null) {
		return { lastReadTimestamp: null, messages: [], profile: null };
	}

	const { data: messages } = await supabase
		.from("Message")
		.select("*")
		.eq("conversationId", actualConvId)
		.order("createdAt", { ascending: false });

	const otherId = idA === meId ? idB : idA;
	const otherProfile = await getProfileById(otherId);

	return {
		lastReadTimestamp: null,
		messages: (messages ?? []).map((m: DbMessage) => ({
			messageId: `${m.id}`,
			conversationId,
			senderId: m.authorId,
			timestamp: new Date(m.createdAt).getTime(),
			type: m.kind === "unsent" ? "Unsent" : "Text",
			body: m.kind === "text" ? { text: m.text ?? "" } : null,
			unsent: m.kind === "unsent",
			reactions: JSON.parse(m.reactions ?? "[]"),
		})),
		profile: otherProfile
			? {
					distance: null,
					mediaHash:
						(await getPhotosForProfile(otherProfile.id))[0]?.hash ?? null,
					name: otherProfile.displayName,
					onlineUntil: otherProfile.onlineUntil
						? new Date(otherProfile.onlineUntil).getTime()
						: null,
					profileId: otherProfile.id,
					showDistance: false,
			  }
			: null,
	};
}

export async function sendMessage(body: {
	type?: string;
	target?: { targetId?: number };
	body?: unknown;
}) {
	const targetId = body.target?.targetId;
	if (!targetId) return null;

	const { data: meProfile } = await supabase
		.from("Profile")
		.select("id")
		.eq("isMe", true)
		.single();
	if (!meProfile) return null;
	const meId = meProfile.id;

	// Find conversation
	let actualConvId: number | null = null;
	const { data: myParts } = await supabase
		.from("ConversationParticipant")
		.select("conversationId")
		.eq("profileId", meId);
	if (myParts) {
		for (const p of myParts) {
			const { data: otherParts } = await supabase
				.from("ConversationParticipant")
				.select("profileId")
				.eq("conversationId", p.conversationId)
				.neq("profileId", meId);
			if (otherParts && otherParts.length > 0) {
				const otherId = otherParts[0].profileId;
				if (otherId === targetId) {
					actualConvId = p.conversationId;
					break;
				}
			}
		}
	}

	const text =
		typeof body.body === "object" &&
		body.body !== null &&
		"text" in body.body
			? (body.body as { text: string }).text
			: "";

	const { data: inserted, error } = await supabase
		.from("Message")
		.insert({
			conversationId: actualConvId ?? 0,
			authorId: meId,
			kind: "text",
			text,
			reactions: "[]",
		})
		.select()
		.single();

	if (error) {
		console.error("[supabase-api] sendMessage error", error);
		return null;
	}

	const msg = inserted as DbMessage;
	return {
		messageId: `${msg.id}`,
		conversationId: conversationIdFor(meId, targetId),
		senderId: meId,
		timestamp: new Date(msg.createdAt).getTime(),
		type: "Text",
		body: { text: msg.text ?? "" },
		unsent: false,
		reactions: [],
	};
}

// ---------------------------------------------------------------------------
// Taps (interest - received)
// ---------------------------------------------------------------------------

export type ReceivedTap = {
	distance: number | null;
	profileImageMediaHash: string | null;
	isFavorite: boolean;
	profileId: number;
	displayName: string | null;
	onlineUntil: string | null;
	timestamp: string;
	tapType: number;
	lastOnline: string;
	isBoosting: boolean;
	isMutual: boolean;
	rightNowType: string;
	isViewable: boolean;
};

export async function getReceivedTaps(): Promise<ReceivedTap[]> {
	const { data: meProfile } = await supabase
		.from("Profile")
		.select("id")
		.eq("isMe", true)
		.single();
	if (!meProfile) return [];
	const meId = meProfile.id;

	const { data: taps } = await supabase
		.from("Tap")
		.select("*")
		.eq("toId", meId)
		.order("createdAt", { ascending: false });

	if (!taps) return [];

	const result: ReceivedTap[] = [];
	for (const tap of taps as DbTap[]) {
		const profile = await getProfileById(tap.fromId);
		const photos = await getPhotosForProfile(tap.fromId);

		// Check if mutual
		const { data: mutual } = await supabase
			.from("Tap")
			.select("id")
			.eq("fromId", meId)
			.eq("toId", tap.fromId)
			.limit(1);

		result.push({
			distance: null,
			profileImageMediaHash: photos[0]?.hash ?? null,
			isFavorite: profile?.isFavorite ?? false,
			profileId: tap.fromId,
			displayName: profile?.displayName ?? null,
			onlineUntil: profile?.onlineUntil ?? null,
			timestamp: tap.createdAt,
			tapType: tap.type,
			lastOnline: profile?.lastSeen ?? tap.createdAt,
			isBoosting: false,
			isMutual: (mutual?.length ?? 0) > 0,
			rightNowType: "",
			isViewable: true,
		});
	}

	return result;
}

export async function sendTap(
	recipientId: number,
	tapType: number,
): Promise<{ isMutual: boolean }> {
	const { data: meProfile } = await supabase
		.from("Profile")
		.select("id")
		.eq("isMe", true)
		.single();
	if (!meProfile) return { isMutual: false };

	await supabase.from("Tap").insert({
		fromId: meProfile.id,
		toId: recipientId,
		type: tapType,
	});

	const { data: mutual } = await supabase
		.from("Tap")
		.select("id")
		.eq("fromId", recipientId)
		.eq("toId", meProfile.id)
		.limit(1);

	return { isMutual: (mutual?.length ?? 0) > 0 };
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export type ViewProfile = {
	profileImageMediaHash: string | null;
	distance: number | null;
	isFavorite: boolean;
	lastViewed: string;
	isSecretAdmirer: boolean;
	viewedCount: { totalCount: number; maxDisplayCount: number };
	profileId?: number;
	displayName?: string | null;
	onlineUntil?: string | null;
};

export async function getViews(): Promise<{
	profiles: ViewProfile[];
	previews: ViewProfile[];
}> {
	const { data: meProfile } = await supabase
		.from("Profile")
		.select("id")
		.eq("isMe", true)
		.single();
	if (!meProfile) return { profiles: [], previews: [] };
	const meId = meProfile.id;

	const { data: views } = await supabase
		.from("View")
		.select("*")
		.eq("viewedId", meId)
		.order("createdAt", { ascending: false });

	if (!views) return { profiles: [], previews: [] };

	const profiles: ViewProfile[] = [];
	for (const view of views as DbView[]) {
		const profile = await getProfileById(view.viewerId);
		const photos = await getPhotosForProfile(view.viewerId);

		// Count total views from this viewer
		const { count } = await supabase
			.from("View")
			.select("id", { count: "exact", head: true })
			.eq("viewerId", view.viewerId)
			.eq("viewedId", meId);

		profiles.push({
			profileImageMediaHash: photos[0]?.hash ?? null,
			distance: null,
			isFavorite: profile?.isFavorite ?? false,
			lastViewed: view.createdAt,
			isSecretAdmirer: false,
			viewedCount: {
				totalCount: count ?? 1,
				maxDisplayCount: 99,
			},
			profileId: view.viewerId,
			displayName: profile?.displayName ?? null,
			onlineUntil: profile?.onlineUntil ?? null,
		});
	}

	return { profiles, previews: [] };
}

export async function recordView(profileId: number): Promise<void> {
	const { data: meProfile } = await supabase
		.from("Profile")
		.select("id")
		.eq("isMe", true)
		.single();
	if (!meProfile) return;

	await supabase.from("View").insert({
		viewerId: meProfile.id,
		viewedId: profileId,
		source: 1,
	});
}

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

export async function addFavorite(profileId: number): Promise<void> {
	await supabase
		.from("Profile")
		.update({ isFavorite: true })
		.eq("id", profileId);
}

export async function removeFavorite(profileId: number): Promise<void> {
	await supabase
		.from("Profile")
		.update({ isFavorite: false })
		.eq("id", profileId);
}

// ---------------------------------------------------------------------------
// Blocks / Hides
// ---------------------------------------------------------------------------

export async function getBlockedUsers(): Promise<
	Array<{ profileId: number; blockedTime: number }>
> {
	const { data } = await supabase
		.from("Profile")
		.select("id, updatedAt")
		.eq("isBlocked", true);
	return (data ?? []).map((p) => ({
		profileId: p.id,
		blockedTime: new Date(p.updatedAt).getTime(),
	}));
}

export async function blockUser(profileId: number): Promise<void> {
	await supabase
		.from("Profile")
		.update({ isBlocked: true })
		.eq("id", profileId);
}

export async function unblockUser(profileId: number): Promise<void> {
	await supabase
		.from("Profile")
		.update({ isBlocked: false })
		.eq("id", profileId);
}

export async function getHiddenUsers(): Promise<Array<{ profileId: number }>> {
	const { data } = await supabase
		.from("Profile")
		.select("id")
		.eq("isHidden", true);
	return (data ?? []).map((p) => ({ profileId: p.id }));
}

export async function hideUser(profileId: number): Promise<void> {
	await supabase
		.from("Profile")
		.update({ isHidden: true })
		.eq("id", profileId);
}

export async function unhideUser(profileId: number): Promise<void> {
	await supabase
		.from("Profile")
		.update({ isHidden: false })
		.eq("id", profileId);
}

// ---------------------------------------------------------------------------
// Settings / Preferences
// ---------------------------------------------------------------------------

export async function getAccountPreferences(): Promise<Record<
	string,
	unknown
> | null> {
	const { data: meProfile } = await supabase
		.from("Profile")
		.select("id")
		.eq("isMe", true)
		.single();
	if (!meProfile) return null;

	const { data } = await supabase
		.from("Preference")
		.select("*")
		.eq("profileId", meProfile.id)
		.single();
	return data as Record<string, unknown> | null;
}

export async function setAccountPreferences(
	settings: Record<string, unknown>,
): Promise<void> {
	const { data: meProfile } = await supabase
		.from("Profile")
		.select("id")
		.eq("isMe", true)
		.single();
	if (!meProfile) return;

	await supabase.from("Preference").upsert({
		profileId: meProfile.id,
		geohash: (settings.geohash as string) ?? "dr5ru",
		...settings,
	});
}

// ---------------------------------------------------------------------------
// Conversation mutations
// ---------------------------------------------------------------------------

export async function deleteConversation(conversationId: string): Promise<void> {
	const parts = conversationId.split(":");
	if (parts.length !== 2) return;
	const { data: meProfile } = await supabase
		.from("Profile")
		.select("id")
		.eq("isMe", true)
		.single();
	if (!meProfile) return;
	const meId = meProfile.id;

	// Find actual conversation
	const { data: myParts } = await supabase
		.from("ConversationParticipant")
		.select("conversationId")
		.eq("profileId", meId);
	if (!myParts) return;

	for (const p of myParts) {
		const { data: otherParts } = await supabase
			.from("ConversationParticipant")
			.select("profileId")
			.eq("conversationId", p.conversationId)
			.neq("profileId", meId);
		if (otherParts && otherParts.length > 0) {
			const otherId = otherParts[0].profileId;
			const cid = `${Math.min(meId, otherId)}:${Math.max(meId, otherId)}`;
			if (cid === conversationId) {
				await supabase
					.from("Conversation")
					.delete()
					.eq("id", p.conversationId);
				break;
			}
		}
	}
}

export async function pinConversation(
	conversationId: string,
	pinned: boolean,
): Promise<void> {
	const parts = conversationId.split(":");
	if (parts.length !== 2) return;
	const { data: meProfile } = await supabase
		.from("Profile")
		.select("id")
		.eq("isMe", true)
		.single();
	if (!meProfile) return;
	const meId = meProfile.id;

	const { data: myParts } = await supabase
		.from("ConversationParticipant")
		.select("conversationId")
		.eq("profileId", meId);
	if (!myParts) return;

	for (const p of myParts) {
		const { data: otherParts } = await supabase
			.from("ConversationParticipant")
			.select("profileId")
			.eq("conversationId", p.conversationId)
			.neq("profileId", meId);
		if (otherParts && otherParts.length > 0) {
			const otherId = otherParts[0].profileId;
			const cid = `${Math.min(meId, otherId)}:${Math.max(meId, otherId)}`;
			if (cid === conversationId) {
				await supabase
					.from("Conversation")
					.update({ pinned })
					.eq("id", p.conversationId);
				break;
			}
		}
	}
}

export async function muteConversation(
	conversationId: string,
	muted: boolean,
): Promise<void> {
	const parts = conversationId.split(":");
	if (parts.length !== 2) return;
	const { data: meProfile } = await supabase
		.from("Profile")
		.select("id")
		.eq("isMe", true)
		.single();
	if (!meProfile) return;
	const meId = meProfile.id;

	const { data: myParts } = await supabase
		.from("ConversationParticipant")
		.select("conversationId")
		.eq("profileId", meId);
	if (!myParts) return;

	for (const p of myParts) {
		const { data: otherParts } = await supabase
			.from("ConversationParticipant")
			.select("profileId")
			.eq("conversationId", p.conversationId)
			.neq("profileId", meId);
		if (otherParts && otherParts.length > 0) {
			const otherId = otherParts[0].profileId;
			const cid = `${Math.min(meId, otherId)}:${Math.max(meId, otherId)}`;
			if (cid === conversationId) {
				await supabase
					.from("Conversation")
					.update({ muted })
					.eq("id", p.conversationId);
				break;
			}
		}
	}
}

export async function markRead(
	conversationId: string,
): Promise<void> {
	// Mark all messages in conversation as read
	const { data: meProfile } = await supabase
		.from("Profile")
		.select("id")
		.eq("isMe", true)
		.single();
	if (!meProfile) return;
	const meId = meProfile.id;

	const { data: myParts } = await supabase
		.from("ConversationParticipant")
		.select("conversationId")
		.eq("profileId", meId);
	if (!myParts) return;

	for (const p of myParts) {
		const { data: otherParts } = await supabase
			.from("ConversationParticipant")
			.select("profileId")
			.eq("conversationId", p.conversationId)
			.neq("profileId", meId);
		if (otherParts && otherParts.length > 0) {
			const otherId = otherParts[0].profileId;
			const cid = `${Math.min(meId, otherId)}:${Math.max(meId, otherId)}`;
			if (cid === conversationId) {
				await supabase
					.from("Message")
					.update({ readAt: new Date().toISOString() })
					.eq("conversationId", p.conversationId)
					.is("readAt", null);
				await supabase
					.from("Conversation")
					.update({ unread: 0 })
					.eq("id", p.conversationId);
				break;
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Search profiles
// ---------------------------------------------------------------------------

export async function searchProfiles(
	query: Record<string, unknown>,
): Promise<DbProfile[]> {
	let qb = supabase
		.from("Profile")
		.select("*")
		.eq("isMe", false)
		.eq("isBlocked", false)
		.eq("isHidden", false);

	const ageMin = query.ageMin as number | undefined;
	const ageMax = query.ageMax as number | undefined;
	if (ageMin !== undefined) qb = qb.gte("age", ageMin);
	if (ageMax !== undefined) qb = qb.lte("age", ageMax);

	qb = qb.limit(60);

	const { data, error } = await qb;
	if (error) {
		console.error("[supabase-api] searchProfiles error", error);
		return [];
	}
	return (data ?? []) as DbProfile[];
}

// ---------------------------------------------------------------------------
// Auth state (profile ID lookup)
// ---------------------------------------------------------------------------

export async function getMyProfileId(): Promise<number | null> {
	const { data } = await supabase
		.from("Profile")
		.select("id")
		.eq("isMe", true)
		.single();
	return data?.id ?? null;
}
