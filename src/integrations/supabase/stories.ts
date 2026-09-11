import { getSupabase, ok, toFailure, type Result } from "./client";

// ─── Types ───────────────────────────────────────────────────────────────────

export type StoryItem = {
	id: string;
	media_url: string;
	media_type: string;
	caption: string | null;
	background: string | null;
	created_at: string;
	viewed: boolean;
};

export type StoryRing = {
	userId: string;
	userName: string;
	userAvatar: string;
	items: StoryItem[];
};

// ─── Queries ─────────────────────────────────────────────────────────────────

const STORY_COLUMNS = "id, user_id, media_url, media_type, caption, background, expires_at, created_at";
const VIEW_COLUMNS = "id, story_id, user_id, viewed_at";
const USER_COLUMNS = "id, pseudo, nick, photos";

/**
 * Loads story rings grouped by author for the current user.
 * Unviewed rings come first, then viewed.
 */
export async function loadStoryRings(userId: string): Promise<Result<{ mine: StoryItem[]; rings: StoryRing[] }>> {
	const sb = getSupabase();
	if (!sb) return toFailure(new Error("Supabase is not configured."));

	const now = new Date().toISOString();

	// 1. Load my own active stories
	const { data: myStories, error: myErr } = await sb
		.from("stories" as any)
		.select(STORY_COLUMNS)
		.eq("user_id", userId)
		.gt("expires_at", now)
		.order("created_at", { ascending: false });

	if (myErr) return toFailure(myErr);

	// 2. Load all other active stories
	const { data: otherStories, error: otherErr } = await sb
		.from("stories" as any)
		.select(STORY_COLUMNS)
		.neq("user_id", userId)
		.gt("expires_at", now)
		.order("created_at", { ascending: false });

	if (otherErr) return toFailure(otherErr);

	// 3. Load my views for other stories
	const otherIds = (otherStories ?? []).map((s: any) => s.id);
	const { data: myViews } = otherIds.length > 0
		? await sb
				.from("story_views" as any)
				.select(VIEW_COLUMNS)
				.eq("user_id", userId)
				.in("story_id", otherIds)
		: { data: [] };

	const viewedSet = new Set<string>();
	for (const v of (myViews ?? []) as any[]) {
		viewedSet.add(v.story_id);
	}

	// 4. Fetch unique authors for other stories
	const authorIds = [...new Set((otherStories ?? []).map((s: any) => s.user_id))];
	const { data: authors } = authorIds.length > 0
		? await sb.from("users").select(USER_COLUMNS).in("id", authorIds)
		: { data: [] };

	const authorMap = new Map<string, any>();
	for (const a of (authors ?? []) as any[]) {
		authorMap.set(a.id, a);
	}

	// 5. Build mine stories
	const mine: StoryItem[] = (myStories ?? []).map((s: any) => ({
		id: s.id,
		media_url: s.media_url,
		media_type: s.media_type,
		caption: s.caption,
		background: s.background,
		created_at: s.created_at,
		viewed: false,
	}));

	// 6. Build rings grouped by author
	const ringMap = new Map<string, StoryRing>();
	for (const story of (otherStories ?? []) as any[]) {
		const author = authorMap.get(story.user_id);
		const existing = ringMap.get(story.user_id);
		const storyItem: StoryItem = {
			id: story.id,
			media_url: story.media_url,
			media_type: story.media_type,
			caption: story.caption,
			background: story.background,
			created_at: story.created_at,
			viewed: viewedSet.has(story.id),
		};

		if (existing) {
			existing.items.push(storyItem);
		} else {
			const photos = (author?.photos as string[]) ?? [];
			ringMap.set(story.user_id, {
				userId: story.user_id,
				userName: author?.nick ?? author?.pseudo ?? "Someone",
				userAvatar: photos[0] ?? "",
				items: [storyItem],
			});
		}
	}

	// Sort rings: unviewed first
	const rings = Array.from(ringMap.values()).sort((a, b) => {
		const aHasUnviewed = a.items.some((i) => !i.viewed);
		const bHasUnviewed = b.items.some((i) => !i.viewed);
		if (aHasUnviewed && !bHasUnviewed) return -1;
		if (!aHasUnviewed && bHasUnviewed) return 1;
		return 0;
	});

	return ok({ mine, rings });
}

/**
 * Creates a new story with 24-hour expiry.
 */
export async function createStory(
	userId: string,
	mediaUrl: string,
	caption?: string,
	background?: string,
): Promise<Result<{ id: string }>> {
	const sb = getSupabase();
	if (!sb) return toFailure(new Error("Supabase is not configured."));

	if (!mediaUrl.trim()) {
		return { ok: false, code: "validation", message: "An image URL is required." };
	}

	const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

	const { data, error } = await sb
		.from("stories" as any)
		.insert({
			user_id: userId,
			media_url: mediaUrl.trim(),
			media_type: "image",
			caption: caption?.trim() || null,
			background: background ?? null,
			viewed_by: [],
			expires_at: expiresAt,
		})
		.select("id")
		.single();

	if (error) return toFailure(error);
	return ok({ id: (data as any).id });
}

/**
 * Marks a story as viewed by the given user.
 */
export async function viewStory(
	storyId: string,
	userId: string,
): Promise<Result<null>> {
	const sb = getSupabase();
	if (!sb) return toFailure(new Error("Supabase is not configured."));

	// Upsert the view record
	const { error } = await sb
		.from("story_views" as any)
		.upsert(
			{ story_id: storyId, user_id: userId },
			{ onConflict: "story_id,user_id" },
		);

	if (error) return toFailure(error);
	return ok(null);
}

/**
 * Deletes a story. Only the owner can delete.
 */
export async function deleteStory(
	storyId: string,
	userId: string,
): Promise<Result<null>> {
	const sb = getSupabase();
	if (!sb) return toFailure(new Error("Supabase is not configured."));

	const { error } = await sb
		.from("stories" as any)
		.delete()
		.eq("id", storyId)
		.eq("user_id", userId);

	if (error) return toFailure(error);
	return ok(null);
}
