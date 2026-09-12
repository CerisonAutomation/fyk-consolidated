import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, like } from "drizzle-orm";
import { db } from "#/db";
import {
	cleanText,
	methodNotAllowed,
	readJson,
	requireCaller,
	unexpected,
	z,
} from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { notifications, users } from "#/schema";

/**
 * `POST /api/safety/check-in` — arm a check-in, `GET` — the one that is running.
 *
 * WHY AN ENDPOINT EXISTS FOR THIS
 * -------------------------------
 * `#/integrations/supabase/safety.ts` armed a check-in by inserting a
 * `notifications` row of type `'check_in'` whose JSON body carries
 * `{ contact_id, place, due_at, status }`. `notifications_type_check` (0013) has
 * never included `'check_in'`, so the insert was rejected by the database, and the
 * module read the id back from a row that did not exist. The screen then said
 * "Safety check-in armed" and the timer lived only in `#/lib/store.ts` — a reload
 * lost it, and the contact (or the user, until a contact picker exists) was never
 * told anything. `0019` widened the CHECK so the row can exist; this route is what
 * writes it, because "someone's safety record" is not a thing a browser should be
 * able to insert, edit or delete at will.
 *
 * The stored shape is the one `POST /api/safety/check-in/resolve` already parses,
 * so arming and resolving stay two halves of one contract instead of two formats.
 * What is deliberately *not* here: an SMS, a push to the contact, or an "overdue"
 * cron. `resolve` is the only path that alerts anyone, and it needs a contact —
 * which the screen does not ask for yet (see AUDIT.md §3.11).
 */

/** How long a check-in may run: 5 minutes to 24 hours, default 4 hours. */
const MAX_MINUTES = 24 * 60;
const DEFAULT_MINUTES = 4 * 60;

const armSchema = z.object({
	place: z.string().max(160).optional(),
	contactId: z.uuid().optional(),
	minutes: z.coerce.number().int().min(5).max(MAX_MINUTES).optional(),
});

const listSchema = z.object({
	limit: z.coerce.number().int().min(1).max(20).default(5),
});

function rowPayload(row: typeof notifications.$inferSelect) {
	let stored: Record<string, unknown> = {};
	if (typeof row.body === "string") {
		try {
			stored = JSON.parse(row.body) as Record<string, unknown>;
		} catch {
			stored = {};
		}
	} else if (row.body && typeof row.body === "object") {
		stored = row.body as Record<string, unknown>;
	}
	return {
		id: row.id,
		status: typeof stored.status === "string" ? stored.status : "ARMED",
		due_at:
			typeof stored.due_at === "string"
				? stored.due_at
				: new Date(row.createdAt ?? Date.now()).toISOString(),
		contact_id:
			typeof stored.contact_id === "string" ? stored.contact_id : row.actorId,
		place: typeof stored.place === "string" ? stored.place : "",
		created_at: row.createdAt
			? new Date(row.createdAt).toISOString()
			: new Date().toISOString(),
	};
}

const checkInTypes = like(notifications.type, "check_in%");

export const Route = createFileRoute("/api/safety/check-in/")({
	server: {
		handlers: {
			GET: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const query = listSchema.safeParse(
						Object.fromEntries(new URL(request.url).searchParams),
					);
					if (!query.success) return jsonError("limit must be 1-20", 400);

					try {
						const rows = await db
							.select()
							.from(notifications)
							.where(and(eq(notifications.userId, user.id), checkInTypes))
							.orderBy(desc(notifications.createdAt))
							.limit(query.data.limit);
						const armed = rows
							.map(rowPayload)
							.filter((row) => row.status === "ARMED");
						return json(
							{
								// The HUD wants "the one that is running"; the history is there for the
								// screen to say "you checked in 3 days ago" instead of forgetting.
								active: armed[0] ?? null,
								recent: rows.slice(0, 5),
							},
							{ cache: "private" },
						);
					} catch (error) {
						return unexpected("safety/check-in/GET", error);
					}
				},
				{
					rateLimit: {
						limit: 120,
						key: ({ caller }) => `check-in:GET:${caller?.id ?? "anon"}`,
					},
				},
			),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const body = await readJson(request, armSchema, 4 * 1024);

					try {
						const minutes = body.minutes ?? DEFAULT_MINUTES;
						const dueAt = new Date(Date.now() + minutes * 60_000);
						const place = cleanText(body.place, 160);

						// One armed check-in per account: a second one would leave the first
						// running with nothing on screen pointing at it.
						const [running] = await db
							.select({ id: notifications.id, body: notifications.body })
							.from(notifications)
							.where(and(eq(notifications.userId, user.id), checkInTypes))
							.orderBy(desc(notifications.createdAt))
							.limit(1);
						if (running) {
							const stored =
								running.body && typeof running.body === "object"
									? (running.body as Record<string, unknown>)
									: (() => {
											try {
												return JSON.parse(
													String(running.body ?? "{}"),
												) as Record<string, unknown>;
											} catch {
												return {};
											}
										})();
							if (
								stored.status === "ARMED" &&
								Date.parse(String(stored.due_at ?? 0)) > Date.now()
							)
								return jsonError(
									"A check-in is already running. Confirm safe or wait for it to come due.",
									409,
								);
						}

						const contactId =
							body.contactId && body.contactId !== user.id
								? body.contactId
								: null;
						if (contactId) {
							const [contact] = await db
								.select({ id: users.id })
								.from(users)
								.where(
									and(eq(users.id, contactId), eq(users.isSuspended, false)),
								)
								.limit(1);
							if (!contact) return jsonError("That contact is not on FYK", 404);
						}

						const [me] = await db
							.select({ displayName: users.displayName })
							.from(users)
							.where(eq(users.id, user.id))
							.limit(1);

						const stored = {
							contact_id: contactId,
							place,
							due_at: dueAt.toISOString(),
							status: "ARMED",
						};

						const [row] = await db
							.insert(notifications)
							.values({
								userId: user.id,
								type: "check_in",
								title: "Safety check-in armed",
								body: JSON.stringify(stored),
								href: "/safety",
								actorId: contactId ?? user.id,
								read: false,
							})
							.returning();

						return json({
							ok: true,
							...rowPayload(row),
							// The screen's own copy says "4 hours"; say what the server actually used.
							minutes,
							contact_name: contactId
								? cleanText(me?.displayName, 60) || "You"
								: "You",
							note: contactId
								? undefined
								: "No emergency contact yet, so this timer is for you alone.",
						});
					} catch (error) {
						return unexpected("safety/check-in/POST", error);
					}
				},
				{
					maxBodySize: 4 * 1024,
					rateLimit: {
						limit: 10,
						windowMs: 60 * 60 * 1000,
						key: ({ caller }) => `check-in:POST:${caller?.id ?? "anon"}`,
					},
				},
			),

			// Declared so an unsupported verb is answered in JSON. Without these, a `PUT
			// /api/wallet` reached the SPA handler and returned `200 text/html`.
			PUT: methodNotAllowed("GET, POST"),
			PATCH: methodNotAllowed("GET, POST"),
			DELETE: methodNotAllowed("GET, POST"),
		},
	},
});
