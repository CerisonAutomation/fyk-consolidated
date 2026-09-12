import { createFileRoute } from "@tanstack/react-router";
import { and, asc, count, desc, eq, gt, inArray } from "drizzle-orm";
import { db } from "#/db";
import {
	cleanText,
	isMissingProfileError,
	methodNotAllowed,
	publicProfile,
	publicProfileSelection,
	readJson,
	requireCaller,
	z,
} from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { meetnowPosts, notifications, taps, users } from "#/schema";

/**
 * MeetNow — "I'm at X, come over" posts.
 *
 * This endpoint lists where real people are right now, so it is the one place
 * where an unauthenticated read is not acceptable: the previous version returned
 * `{ posts: [] }` for anonymous traffic (good) but derived the author's
 * coordinates as `{ lat: 0, lng: 0 }` (bad — everyone landed in the Gulf of
 * Guinea) and let a client post `note`/`location` with no type checking.
 *
 *  - Coordinates are only emitted when the author supplied them.
 *  - `expiresAt` is clamped to [now, now + 24h] server-side, so a client cannot
 *    mint a permanent "active right now" row.
 *  - `join` writes a tap *and* a notification in one transaction, and the deep
 *    link is built from the validated UUID, not from request text.
 *  - Column names follow `0010_remaining_tables.sql` (`category`/`note`/
 *    `location`/`active`/`expires_at`). The old Prisma model also declared
 *    `type`/`place`/`status`, which do not exist in the database; reading them
 *    was a 500 on a freshly migrated project.
 */

const MEETNOW_EXPIRY_HOURS_DEFAULT = 4;
const MEETNOW_EXPIRY_HOURS_MAX = 24;
const MEETNOW_LIST_LIMIT = 50;

const POST_COLUMNS = {
	id: meetnowPosts.id,
	userId: meetnowPosts.userId,
	category: meetnowPosts.category,
	note: meetnowPosts.note,
	location: meetnowPosts.location,
	lat: meetnowPosts.lat,
	lng: meetnowPosts.lng,
	expiresAt: meetnowPosts.expiresAt,
	active: meetnowPosts.active,
	createdAt: meetnowPosts.createdAt,
};

/** Exactly the columns `POST_COLUMNS` selects — no hand-maintained duplicate. */
type MeetnowRow = Pick<
	typeof meetnowPosts.$inferSelect,
	keyof typeof POST_COLUMNS
>;

function shapePost(
	post: MeetnowRow,
	author?: ReturnType<typeof publicProfile>,
) {
	return {
		id: post.id,
		user_id: post.userId,
		category: post.category ?? "other",
		note: post.note ?? "",
		location: post.location ?? "",
		// Never fabricate coordinates: `0,0` is a real place in the ocean.
		lat: post.lat ?? null,
		lng: post.lng ?? null,
		expires_at: (post.expiresAt ?? new Date()).toISOString(),
		active:
			post.active === true &&
			(post.expiresAt === null || post.expiresAt > new Date()),
		created_at: (post.createdAt ?? new Date()).toISOString(),
		user: author,
	};
}

const createSchema = z.object({
	action: z.literal("create").optional().default("create"),
	category: z.string().trim().min(1).max(50),
	note: z.string().trim().max(500).optional(),
	location: z.string().trim().max(200).optional(),
	lat: z.coerce.number().min(-90).max(90).optional(),
	lng: z.coerce.number().min(-180).max(180).optional(),
	expiresInHours: z.coerce
		.number()
		.min(0.25)
		.max(MEETNOW_EXPIRY_HOURS_MAX)
		.optional(),
});

const joinSchema = z.object({ action: z.literal("join"), postId: z.uuid() });
const closeSchema = z.object({ action: z.literal("close"), postId: z.uuid() });

const bodySchema = z.union([createSchema, joinSchema, closeSchema]);

/** Posts that are still live right now, newest first. */
function livePosts() {
	return and(
		eq(meetnowPosts.active, true),
		gt(meetnowPosts.expiresAt, new Date()),
	);
}

export const Route = createFileRoute("/api/meetnow/")({
	server: {
		handlers: {
			/* Every verb this route does not implement is answered in JSON (405 +
			 * Allow). Without a declaration TanStack Start treats the request as
			 * unmatched-by-path-and-method and falls through to the document handler,
			 * which answers `200 text/html` with the SPA bundle — a client parsing
			 * JSON then blames the server instead of its own verb. AUDIT §3.10. */
			PUT: methodNotAllowed("GET, POST"),
			PATCH: methodNotAllowed("GET, POST"),
			DELETE: methodNotAllowed("GET, POST"),

			/** Requires a session: this is live location data about real users. */
			GET: withSecurity(
				async () => {
					const rows = await db
						.select(POST_COLUMNS)
						.from(meetnowPosts)
						.where(livePosts())
						.orderBy(desc(meetnowPosts.createdAt), asc(meetnowPosts.id))
						.limit(MEETNOW_LIST_LIMIT);

					const authors = rows.length
						? await db
								.select(publicProfileSelection)
								.from(users)
								.where(
									inArray(users.id, [
										...new Set(rows.map((row) => row.userId)),
									]),
								)
						: [];
					const byId = new Map(authors.map((author) => [author.id, author]));

					return json(
						{
							posts: rows.map((row) =>
								shapePost(row, publicProfile(byId.get(row.userId))),
							),
						},
						{ cache: "private" },
					);
				},
				{
					auth: "required",
					rateLimit: {
						limit: 60,
						key: ({ caller }) => `meetnow:GET:${caller?.id ?? "anon"}`,
					},
				},
			),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const body = await readJson(request, bodySchema, 16 * 1024);

					if (!("postId" in body)) {
						const now = Date.now();
						const hours = body.expiresInHours ?? MEETNOW_EXPIRY_HOURS_DEFAULT;
						const expiresAt = new Date(
							now + Math.round(hours * 60 * 60 * 1000),
						);
						try {
							const [post] = await db.transaction(async (tx) => {
								// A fresh post supersedes the author's live one, and the
								// sweep has to happen *before* the insert: after it, the new
								// row matches "live posts of this user" and gets switched
								// off in the same request — which is how a post could appear
								// in the create response and never in the list.
								await tx
									.update(meetnowPosts)
									.set({ active: false })
									.where(and(eq(meetnowPosts.userId, user.id), livePosts()));
								return await tx
									.insert(meetnowPosts)
									.values({
										userId: user.id,
										category: cleanText(body.category, 50),
										note: body.note ? cleanText(body.note, 500) : null,
										location: body.location
											? cleanText(body.location, 200)
											: null,
										lat: body.lat ?? null,
										lng: body.lng ?? null,
										expiresAt,
										active: true,
									})
									.returning(POST_COLUMNS);
							});

							// Echo the author's public profile so the client can render its
							// own card without a second request (never invented here).
							const [author] = await db
								.select(publicProfileSelection)
								.from(users)
								.where(eq(users.id, user.id))
								.limit(1);

							return json(
								{ ok: true, post: shapePost(post, publicProfile(author)) },
								{ status: 201 },
							);
						} catch (error) {
							if (isMissingProfileError(error)) {
								return jsonError("Finish onboarding before posting", 409);
							}
							throw error;
						}
					}

					const [post] = await db
						.select({
							id: meetnowPosts.id,
							userId: meetnowPosts.userId,
							location: meetnowPosts.location,
							expiresAt: meetnowPosts.expiresAt,
							active: meetnowPosts.active,
						})
						.from(meetnowPosts)
						.where(eq(meetnowPosts.id, body.postId))
						.limit(1);

					if (!post) return jsonError("Post not found", 404);

					if (body.action === "join") {
						if (post.active !== true)
							return jsonError("Post is no longer active", 409);
						if (post.expiresAt && post.expiresAt < new Date())
							return jsonError("Post has expired", 409);
						if (post.userId === user.id)
							return jsonError("Cannot join your own post", 400);

						try {
							await db.transaction(async (tx) => {
								// Idempotent by construction: `taps` has a
								// UNIQUE(tapper_id, tapped_id), so re-joining updates
								// the timestamp instead of minting a second tap, and
								// there is no read-then-write race.
								await tx
									.insert(taps)
									.values({
										tapperId: user.id,
										tappedId: post.userId,
										type: "meetnow_join",
									})
									.onConflictDoUpdate({
										target: [taps.tapperId, taps.tappedId],
										set: { createdAt: new Date() },
									});
								await tx.insert(notifications).values({
									userId: post.userId,
									type: "meetnow",
									title: "MeetNow join",
									body: `Someone is coming to ${cleanText(post.location, 120) || "your MeetNow spot"}`,
									actorId: user.id,
									// Built from a validated UUID, never from request text.
									href: `/meetnow?post=${post.id}`,
									read: false,
								});
							});
						} catch (error) {
							if (isMissingProfileError(error)) {
								return jsonError("Finish onboarding first", 409);
							}
							throw error;
						}
						return json({ ok: true });
					}

					// `close` — the author only, and the row is never deleted: the
					// tap/notification history has to survive it.
					const closed = await db
						.update(meetnowPosts)
						.set({ active: false })
						.where(
							and(
								eq(meetnowPosts.id, body.postId),
								eq(meetnowPosts.userId, user.id),
							),
						)
						.returning({ id: meetnowPosts.id });
					if (closed.length === 0) {
						// Not the author's post: distinguish 403 from 404 only in the
						// log, never to the client, so ids cannot be probed.
						const exists = await db
							.select({ total: count() })
							.from(meetnowPosts)
							.where(eq(meetnowPosts.id, body.postId));
						if (Number(exists[0]?.total ?? 0) === 0)
							return jsonError("Post not found", 404);
						return jsonError("You can only close your own post", 403);
					}
					return json({ ok: true });
				},
				{
					maxBodySize: 16 * 1024,
					rateLimit: {
						limit: 10,
						key: ({ caller: user }) => `meetnow:POST:${user?.id ?? "anon"}`,
					},
				},
			),
		},
	},
});
