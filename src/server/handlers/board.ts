import { asRows } from "../data/typed-rows";
/**
 * The Board: live "I'm around / want to do X" posts with an expiry.
 *
 * This is FYK's differentiator, so it is kept small and fully wired: create,
 * join, leave, expire. Replies happen in DMs, which is why there is no comment
 * (validate_post_join) so two people cannot claim the last spot.
 */

import { z } from "zod";
import { type RequestCtx, readJson } from "../context";
import {
	PROFILE_LIST_COLUMNS,
	type ProfileRow,
	toPublicProfile,
} from "../data/profiles";
import {
	badRequest,
	conflict,
	dbFailure,
	forbidden,
	notFound,
} from "../errors";

const POST_COLUMNS =
	"id,author_id,kind,body,activity_id,city,area,spots,join_count,expires_at,created_at";

export const createBoardSchema = z.object({
	kind: z.enum(["invite", "offer", "ask", "text"]).default("text"),
	body: z
		.string()
		.trim()
		.min(3, "Say a bit more — at least 3 characters.")
		.max(400),
	activityId: z.string().trim().max(40).optional(),
	spots: z.number().int().min(1).max(50).optional(),
	windowMinutes: z.number().int().min(30).max(720).default(120),
});

export async function listBoard(ctx: RequestCtx) {
	const caller = await ctx.auth();
	const client = ctx.db();
	const now = new Date().toISOString();

	// `?kind=` is applied in Postgres, not in the browser: the list is capped, so a
	// client-side filter would silently hide posts that are on the Board.
	const kind = ctx.query.get("kind");
	if (kind && !["invite", "offer", "ask", "text"].includes(kind))
		throw badRequest("Unknown Board filter.");

	let posts = client
		.from("board_posts")
		.select(POST_COLUMNS)
		.gt("expires_at", now)
		.order("created_at", { ascending: false })
		.limit(60);
	if (kind) posts = posts.eq("kind", kind as never);

	const postsResult = await posts;
	if (postsResult.error)
		throw dbFailure(postsResult.error, "That did not save. Please try again.");

	const rows = asRows<Record<string, unknown>>(postsResult.data);
	if (!rows.length)
		return {
			posts: [],
			note: "The Board is quiet right now. Post first — people respond to something specific.",
		};

	const authorIds = [...new Set(rows.map((row) => String(row.author_id)))];
	const postIds = rows.map((row) => String(row.id));

	const [profilesResult, myJoinsResult, allJoinsResult] = await Promise.all([
		client.from("profiles").select(PROFILE_LIST_COLUMNS).in("id", authorIds),
		client
			.from("post_joins")
			.select("post_id")
			.in("post_id", postIds)
			.eq("profile_id", caller.userId),
		client
			.from("post_joins")
			.select("post_id,profile_id")
			.in("post_id", postIds),
	]);

	const profileMap = new Map(
		asRows<ProfileRow>(profilesResult.data).map((row) => [row.id, row]),
	);
	const joined = new Set(
		asRows<{ post_id: string }>(myJoinsResult.data).map((row) => row.post_id),
	);
	const joiners = new Map<string, string[]>();
	for (const row of asRows<{ post_id: string; profile_id: string }>(
		allJoinsResult.data,
	)) {
		const list = joiners.get(row.post_id) ?? [];
		list.push(row.profile_id);
		joiners.set(row.post_id, list);
	}

	const viewer = rows.length
		? await client
				.from("profiles")
				.select(PROFILE_LIST_COLUMNS)
				.eq("id", caller.userId)
				.maybeSingle()
		: { data: null };
	const viewerRow = (viewer.data ?? null) as ProfileRow | null;

	const out = rows.map((row) => {
		const author = profileMap.get(String(row.author_id));
		const people = (joiners.get(String(row.id)) ?? [])
			.map((id) => profileMap.get(id))
			.filter(
				(profile): profile is NonNullable<typeof profile> =>
					profile !== undefined,
			)
			.slice(0, 6)
			.map((profile) => ({
				id: profile.id,
				displayName: profile.display_name ?? profile.handle ?? "Someone",
				avatarUrl: profile.avatar_url,
			}));
		return {
			id: row.id,
			kind: row.kind,
			body: row.body,
			activityId: row.activity_id,
			spots: row.spots,
			joinCount: Number(row.join_count ?? 0),
			expiresAt: row.expires_at,
			createdAt: row.created_at,
			joined: joined.has(String(row.id)),
			isMine: String(row.author_id) === caller.userId,
			joiners: people,
			author: author
				? toPublicProfile(author, {
						viewer: viewerRow
							? {
									id: caller.userId,
									lat: viewerRow.lat_coarse,
									lng: viewerRow.lng_coarse,
									interests: viewerRow.interests ?? [],
								}
							: null,
						client,
					})
				: null,
		};
	});

	return { posts: out, note: null };
}

export async function createBoardPost(ctx: RequestCtx) {
	const caller = await ctx.auth();
	const body = await readJson(ctx.request, createBoardSchema);
	const client = ctx.db();

	// One live post per person: the Board stays a signal, not a feed to shout into.
	const existing = await client
		.from("board_posts")
		.select("id")
		.eq("author_id", caller.userId)
		.gt("expires_at", new Date().toISOString())
		.limit(1);
	if ((existing.data ?? []).length)
		throw conflict("You already have a live post. Update or remove it first.");

	const expiresAt = new Date(
		Date.now() + body.windowMinutes * 60_000,
	).toISOString();
	const insert = await client
		.from("board_posts")
		.insert({
			author_id: caller.userId,
			kind: body.kind,
			body: body.body,
			activity_id: body.activityId ?? null,
			spots: body.spots ?? null,
			expires_at: expiresAt,
		})
		.select(POST_COLUMNS)
		.single();
	if (insert.error)
		throw dbFailure(insert.error, "That did not save. Please try again.");

	// Posting and "available now" are the same claim; keep them consistent.
	await client
		.from("profiles")
		.update({
			open_to_meet: true,
			available_until: expiresAt,
			last_active_at: new Date().toISOString(),
		})
		.eq("id", caller.userId);

	return { post: insert.data };
}

export async function deleteBoardPost(ctx: RequestCtx, postId: string) {
	const caller = await ctx.auth();
	z.string().uuid().parse(postId);
	const client = ctx.db();
	const owner = await client
		.from("board_posts")
		.select("id,author_id")
		.eq("id", postId)
		.maybeSingle();
	if (!owner.data) throw notFound("That post is gone.");
	if ((owner.data as { author_id: string }).author_id !== caller.userId)
		throw forbidden("You can only remove your own post.");
	const remove = await client
		.from("board_posts")
		.delete()
		.eq("id", postId)
		.eq("author_id", caller.userId);
	if (remove.error)
		throw dbFailure(remove.error, "That did not save. Please try again.");
	return { deleted: true };
}

export async function setBoardJoin(ctx: RequestCtx, postId: string) {
	const caller = await ctx.auth();
	z.string().uuid().parse(postId);
	const body = await readJson(ctx.request, z.object({ joining: z.boolean() }));
	const client = ctx.db();

	if (body.joining) {
		const insert = await client
			.from("post_joins")
			.insert({ post_id: postId, profile_id: caller.userId });
		// The trigger raises post_full / post_expired / owner_cannot_join; those
		// names are mapped to friendly text by mapUnknownError.
		if (insert.error)
			throw dbFailure(insert.error, "That did not save. Please try again.");
	} else {
		const remove = await client
			.from("post_joins")
			.delete()
			.eq("post_id", postId)
			.eq("profile_id", caller.userId);
		if (remove.error)
			throw dbFailure(remove.error, "That did not save. Please try again.");
	}

	const after = await client
		.from("board_posts")
		.select("join_count,spots,expires_at")
		.eq("id", postId)
		.maybeSingle();
	return {
		joined: body.joining,
		joinCount:
			(after.data as { join_count?: number } | null)?.join_count ?? null,
	};
}
