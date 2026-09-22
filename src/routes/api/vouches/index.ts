import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
	cleanText,
	methodNotAllowed,
	readJson,
	requireCaller,
	unexpected,
	z,
} from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { users, vouches } from "@/schema";

/**
 * `GET|POST|DELETE /api/vouches` — one member standing behind another's identity.
 *
 * THE GAP THIS CLOSES
 * -------------------
 * `/vouches` was a generated list screen fetching `/api/vouches?filter=All&search=`,
 * with `credentials: "include"` and no bearer token, against an endpoint that did not
 * exist and a table `0033` had to create. So the screen could only ever render the
 * empty state of a 404, and it rendered that as "no vouches yet" — indistinguishable
 * from the truth, which is why it survived.
 *
 * WHAT A VOUCH IS HERE
 * --------------------
 * A row from one account about another, with 20–500 characters saying why. Withdrawal
 * sets `revoked_at` rather than deleting, so "did this person ever vouch for them" stays
 * answerable, and one row per pair means a second vouch from the same person is an edit
 * of the first, not a louder version of it.
 *
 * The author's verification level travels with the vouch in the response. A vouch from
 * an unverified account is worth less than one from somebody who passed a selfie
 * challenge, and the reader — not this route — is the one who decides how much less.
 */

const createSchema = z
	.object({
		profileId: z.uuid(),
		body: z.string().trim().min(20, "Say at least 20 characters").max(500),
	})
	.strict();

type VouchView = {
	id: string;
	body: string;
	createdAt: string;
	revokedAt: string | null;
	profileId: string;
	author: {
		id: string;
		handle: string | null;
		displayName: string | null;
		avatar: string | null;
		verification: number;
	} | null;
};

export const Route = createFileRoute("/api/vouches/")({
	server: {
		handlers: {
			PUT: methodNotAllowed("GET, POST, DELETE"),
			PATCH: methodNotAllowed("GET, POST, DELETE"),

			GET: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const url = new URL(request.url);
					const view = url.searchParams.get("view") ?? "received";
					const profileId = url.searchParams.get("profileId");

					try {
						// `given` includes withdrawn vouches: it is your own history, and
						// hiding a row you revoked would make it look like it never happened.
						const includeRevoked = view === "given";
						const where =
							view === "given"
								? eq(vouches.voucherId, user.id)
								: and(
										eq(vouches.profileId, profileId ? profileId : user.id),
										includeRevoked ? undefined : isNull(vouches.revokedAt),
									);

						const rows = await db
							.select()
							.from(vouches)
							.where(where)
							.orderBy(desc(vouches.createdAt))
							.limit(100);

						const authorIds = [...new Set(rows.map((row) => row.voucherId))];
						const authors =
							authorIds.length > 0
								? await db
										.select({
											id: users.id,
											handle: users.handle,
											displayName: users.displayName,
											avatar: users.avatar,
											verification: users.verification,
										})
										.from(users)
										.where(inArray(users.id, authorIds))
								: [];
						const byAuthor = new Map(authors.map((author) => [author.id, author]));

						const items: VouchView[] = rows.map((row) => {
							const author = byAuthor.get(row.voucherId);
							return {
								id: row.id,
								body: row.body,
								createdAt: row.createdAt.toISOString(),
								revokedAt: row.revokedAt?.toISOString() ?? null,
								profileId: row.profileId,
								author: author
									? {
											id: author.id,
											handle: author.handle,
											displayName: author.displayName,
											avatar: author.avatar,
											verification: author.verification ?? 0,
										}
									: null,
							};
						});

						return json({ items, total: items.length, view });
					} catch (error) {
						return unexpected("vouches/GET", error);
					}
				},
				{ rateLimit: { limit: 60, key: ({ caller }) => `vouches:${caller?.id ?? "anon"}` } },
			),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					let body: z.infer<typeof createSchema>;
					try {
						body = await readJson(request, createSchema, 8 * 1024);
					} catch (error) {
						if (error instanceof Error && error.name === "ApiError") throw error;
						return unexpected("vouches/POST", error);
					}

					try {
						if (body.profileId === user.id)
							return jsonError("You cannot vouch for yourself", 400);

						const [target] = await db
							.select({ id: users.id })
							.from(users)
							.where(eq(users.id, body.profileId))
							.limit(1);
						if (!target) return jsonError("That profile no longer exists", 404);

						const text = cleanText(body.body, 500);
						if (text.length < 20)
							return jsonError("Say at least 20 characters", 422);

						// One row per pair. Writing again edits the vouch and, if it had been
						// withdrawn, puts it back — which is what "I want to vouch again" means.
						const [row] = await db
							.insert(vouches)
							.values({ voucherId: user.id, profileId: body.profileId, body: text })
							.onConflictDoUpdate({
								target: [vouches.voucherId, vouches.profileId],
								set: { body: text, revokedAt: null },
							})
							.returning({ id: vouches.id, createdAt: vouches.createdAt });

						return json({ ok: true, id: row.id, createdAt: row.createdAt.toISOString() });
					} catch (error) {
						return unexpected("vouches/POST", error);
					}
				},
				{
					maxBodySize: 8 * 1024,
					rateLimit: { limit: 10, key: ({ caller }) => `vouches:POST:${caller?.id ?? "anon"}` },
				},
			),

			DELETE: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const url = new URL(request.url);
					const id = url.searchParams.get("id");
					if (!id) return jsonError("Which vouch? Pass ?id=", 400);

					try {
						const [row] = await db
							.update(vouches)
							.set({ revokedAt: new Date() })
							.where(and(eq(vouches.id, id), eq(vouches.voucherId, user.id)))
							.returning({ id: vouches.id });
						// No row means either it never existed or it was somebody else's;
						// both are "not found" to the caller, and the difference is not
						// information worth handing out.
						if (!row) return jsonError("No vouch of yours with that id", 404);
						return json({ ok: true, revoked: true });
					} catch (error) {
						return unexpected("vouches/DELETE", error);
					}
				},
				{ rateLimit: { limit: 20, key: ({ caller }) => `vouches:DELETE:${caller?.id ?? "anon"}` } },
			),
		},
	},
});
