import { createFileRoute } from "@tanstack/react-router";
import { and, count, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	cleanText,
	isMissingProfileError,
	methodNotAllowed,
	publicProfile,
	publicProfileSelection,
	readJson,
	readPagination,
	requireCaller,
	z,
} from "@/lib/api-helpers";
import { startPromotion } from "@/lib/promotion.server";
import { json, jsonError, withSecurity } from "@/middleware";
import { eventRsvps, events, users } from "@/schema";

/**
 * Events API.
 *
 * Fixed relative to the previous version:
 *   - Identity came from `auth.api.getSession()` (better-auth, configured with
 *     no database), so it was always `null`: `POST` answered 401 for signed-in
 *     users and `GET` answered "not attending" for everyone. The Supabase
 *     session the browser actually holds is verified now.
 *   - `startsAt: new Date(body.start_time)` accepted anything: `"tomorrow"`
 *     became `Invalid Date` and the driver answered 500. Dates are parsed and
 *     range-checked by the schema at the edge.
 *   - `event.create` + `eventRsvp.create` were two round trips; a failure
 *     between them left a published event with no host RSVP. One transaction now.
 *   - `include: { rsvps: … }` copied every RSVP row per event just to count it.
 *     Counts are aggregated in SQL; the caller's own RSVP is one indexed query.
 *   - No `try/catch`: any driver error escaped as an unhandled rejection.
 *   - Cursor pagination keyed on `id` (`gt(id, cursor)`) while rows are ordered
 *     by `startsAt`: uuid order has nothing to do with time order, so pages
 *     skipped and repeated rows. The cursor is now the `(starts_at, id)` pair of
 *     the last row on the page.
 */

const createEventSchema = z.object({
	action: z.literal("create"),
	title: z.string().trim().min(3, "use at least 3 characters").max(200),
	description: z.string().trim().max(2000).optional(),
	activityId: z.string().trim().max(64).optional(),
	venue: z.string().trim().max(200).optional(),
	address: z.string().trim().max(300).optional(),
	city: z.string().trim().max(120).optional(),
	lat: z.coerce.number().min(-90).max(90).optional(),
	lng: z.coerce.number().min(-180).max(180).optional(),
	startsAt: z.iso
		.datetime({ message: "expected an ISO-8601 timestamp" })
		.transform((value) => new Date(value)),
	endsAt: z.iso
		.datetime({ message: "expected an ISO-8601 timestamp" })
		.optional()
		.transform((value) => (value ? new Date(value) : undefined)),
	capacity: z.coerce.number().int().min(1).max(10_000).optional(),
	cost: z.string().trim().max(50).optional(),
	scale: z.enum(["casual", "big"]).default("casual"),
});

const rsvpSchema = z.object({
	action: z.enum(["join", "leave"]),
	eventId: z.uuid(),
});

/**
 * An event can be promoted to the top of the feed — but only by its host, and
 * only while it still happens in the future. `#/lib/entity-promotions.server`
 * applies the same price table, the same 7-day cap and the same `wallet` debit
 * as every other surface, so "boost" costs the same on a group, a shout and an
 * event: three different screens, one economy.
 */
const boostEventSchema = z
	.object({
		action: z.literal("boost"),
		eventId: z.uuid(),
		minutes: z.number().int().min(30).max(720).optional(),
		idempotencyKey: z.string().max(120).optional(),
	})
	.strict();

const bodySchema = z.discriminatedUnion("action", [
	createEventSchema,
	rsvpSchema,
	boostEventSchema,
]);

/** `char_length(title) between 3 and 120` is a DB check; mirror it, don't 500. */
const TITLE_MAX = 120;

export const Route = createFileRoute("/api/events/")({
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

			/** Public list: published events only, capped at 100 rows per page. */
			GET: withSecurity(
				async ({ request, caller }) => {
					const url = new URL(request.url);
					const { limit, cursor } = readPagination(url);
					const city =
						url.searchParams.get("city")?.trim().slice(0, 120) || undefined;
					// `#/routes/events/$eventId` renders one event. Without this filter its
					// only options were a page of unrelated events or a route of its own;
					// the id is a uuid, so it is parsed rather than trusted.
					const onlyId = z.uuid().safeParse(url.searchParams.get("id") ?? "");

					const where = and(
						onlyId.success ? eq(events.id, onlyId.data) : undefined,
						onlyId.success ? undefined : eq(events.status, "published"),
						city
							? ilike(events.city, `%${city.replace(/[%_]/g, "\\$&")}%`)
							: undefined,
						// Keyset cursor: "everything after this moment". A deleted
						// cursor row yields NULL and therefore an empty page rather
						// than an error, which is the correct end of the listing.
						cursor
							? sql`(${events.startsAt}, ${events.id}) > (
									select e.starts_at, e.id from public.events e where e.id = ${cursor}::uuid
								)`
							: undefined,
					);

					const page = await db
						.select({
							id: events.id,
							title: events.title,
							description: events.description,
							activityId: events.activityId,
							venue: events.venue,
							address: events.address,
							city: events.city,
							lat: events.lat,
							lng: events.lng,
							startsAt: events.startsAt,
							endsAt: events.endsAt,
							capacity: events.capacity,
							cost: events.cost,
							scale: events.scale,
							status: events.status,
							hostId: events.hostId,
						})
						.from(events)
						.where(where)
						.orderBy(sql`${events.startsAt} asc`, sql`${events.id} asc`)
						.limit(limit + 1);

					const hasMore = page.length > limit;
					const rows = hasMore ? page.slice(0, limit) : page;
					const ids = rows.map((event) => event.id);
					const hostIds = [...new Set(rows.map((event) => event.hostId))];

					const [hostRows, goingRows, myRows] = await Promise.all([
						ids.length
							? db
									.select(publicProfileSelection)
									.from(users)
									.where(inArray(users.id, hostIds))
							: Promise.resolve([]),
						ids.length
							? db
									.select({ eventId: eventRsvps.eventId, total: count() })
									.from(eventRsvps)
									.where(
										and(
											inArray(eventRsvps.eventId, ids),
											eq(eventRsvps.status, "going"),
										),
									)
									.groupBy(eventRsvps.eventId)
							: Promise.resolve([]),
						caller && ids.length
							? db
									.select({
										eventId: eventRsvps.eventId,
										status: eventRsvps.status,
									})
									.from(eventRsvps)
									.where(
										and(
											eq(eventRsvps.profileId, caller.id),
											inArray(eventRsvps.eventId, ids),
										),
									)
							: Promise.resolve([]),
					]);

					const hosts = new Map(hostRows.map((host) => [host.id, host]));
					const counts = new Map(
						goingRows.map((row) => [row.eventId, Number(row.total)]),
					);
					const mine = new Map(
						myRows.map((rsvp) => [rsvp.eventId, rsvp.status]),
					);

					return json(
						{
							events: rows.map((event) => ({
								id: event.id,
								name: event.title,
								description: event.description ?? "",
								category: event.activityId ?? "Other",
								location: [event.venue, event.address, event.city]
									.filter(Boolean)
									.join(", "),
								lat: event.lat,
								lng: event.lng,
								start_time: event.startsAt.toISOString(),
								end_time: event.endsAt?.toISOString() ?? null,
								created_by: event.hostId,
								max_attendees: event.capacity,
								cost: event.cost,
								scale: event.scale,
								status: event.status,
								attendee_count: counts.get(event.id) ?? 0,
								attending:
									mine.get(event.id) === "going"
										? true
										: mine.has(event.id)
											? false
											: null,
								isMine: caller ? event.hostId === caller.id : false,
								creator: publicProfile(hosts.get(event.hostId)),
							})),
							nextCursor: hasMore ? (rows.at(-1)?.id ?? null) : null,
						},
						// `attending`/`isMine` are per-user, so a response computed for a
						// signed-in caller must never be served from a shared cache.
						{ cache: caller ? "private" : "public" },
					);
				},
				{
					auth: "optional",
					rateLimit: { limit: 100, key: ({ ip }) => `events:GET:${ip}` },
				},
			),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const body = await readJson(request, bodySchema, 32 * 1024);

					if (body.action === "boost") {
						const [row] = await db
							.select({
								id: events.id,
								hostId: events.hostId,
								startsAt: events.startsAt,
								status: events.status,
							})
							.from(events)
							.where(eq(events.id, body.eventId))
							.limit(1);
						if (!row || row.status !== "published")
							return jsonError("That event is not published", 404);
						if (row.hostId !== user.id)
							return jsonError("You can only boost an event you host", 403);
						if (row.startsAt.getTime() < Date.now())
							return jsonError("That event already started", 409);

						const outcome = await db.transaction((tx) =>
							startPromotion(
								{
									userId: user.id,
									entityType: "activity",
									entityId: row.id,
									minutes: body.minutes,
									idempotencyKey: body.idempotencyKey,
								},
								tx,
							),
						);
						if (outcome.kind === "insufficient")
							return jsonError(
								`That costs ${outcome.cost} bones and the wallet holds ${outcome.balance}`,
								402,
							);
						if (outcome.kind === "held")
							return jsonError(
								`Already promoted until ${outcome.endsAt.toISOString()}`,
								409,
							);
						if (outcome.kind === "duplicate")
							return json({
								ok: true,
								duplicate: true,
								note: "That boost was already applied.",
							});
						return json({ ok: true, ...outcome });
					}

					if (body.action === "create") {
						const title = cleanText(body.title, TITLE_MAX);
						if (title.length < 3) return jsonError("Title is too short", 400);
						if (body.endsAt && body.endsAt <= body.startsAt) {
							return jsonError("endsAt must be after startsAt", 400);
						}
						if (body.startsAt.getTime() < Date.now() - 60 * 60 * 1000) {
							return jsonError("startsAt is in the past", 400);
						}
						try {
							const created = await db.transaction(async (tx) => {
								const [event] = await tx
									.insert(events)
									.values({
										hostId: user.id,
										title,
										description: body.description
											? cleanText(body.description, 2000)
											: null,
										activityId: body.activityId || null,
										venue: body.venue ? cleanText(body.venue, 200) : null,
										address: body.address ? cleanText(body.address, 300) : null,
										city: body.city ? cleanText(body.city, 120) : null,
										lat: body.lat ?? null,
										lng: body.lng ?? null,
										startsAt: body.startsAt,
										endsAt: body.endsAt ?? null,
										capacity: body.capacity ?? null,
										cost: body.cost ? cleanText(body.cost, 50) : null,
										scale: body.scale,
										status: "published",
									})
									.returning({ id: events.id });
								// The host is attending. In one transaction: an event
								// without its host RSVP used to be a permanent state.
								await tx
									.insert(eventRsvps)
									.values({
										eventId: event.id,
										profileId: user.id,
										status: "going",
									})
									.onConflictDoNothing();
								return event;
							});
							return json({ ok: true, eventId: created.id }, { status: 201 });
						} catch (error) {
							if (isMissingProfileError(error)) {
								return jsonError(
									"Finish onboarding before creating events",
									409,
								);
							}
							throw error;
						}
					}

					const event = await db
						.select({
							id: events.id,
							capacity: events.capacity,
							status: events.status,
						})
						.from(events)
						.where(eq(events.id, body.eventId))
						.limit(1)
						.then((rows) => rows[0]);
					if (!event) return jsonError("Event not found", 404);

					if (body.action === "join") {
						if (event.status !== "published")
							return jsonError("This event is not open", 409);
						if (event.capacity) {
							const [going] = await db
								.select({ total: count() })
								.from(eventRsvps)
								.where(
									and(
										eq(eventRsvps.eventId, event.id),
										eq(eventRsvps.status, "going"),
									),
								);
							// Capacity is advisory, not a lock: two people joining at
							// once can both fit into the last slot. `event_waitlist`
							// exists for the version that must not oversell.
							if (Number(going?.total ?? 0) >= event.capacity)
								return jsonError("Event is full", 409);
						}
						await db
							.insert(eventRsvps)
							.values({
								eventId: event.id,
								profileId: user.id,
								status: "going",
							})
							.onConflictDoUpdate({
								target: [eventRsvps.eventId, eventRsvps.profileId],
								set: { status: "going" },
							});
						return json({ ok: true, attending: true });
					}

					await db
						.delete(eventRsvps)
						.where(
							and(
								eq(eventRsvps.eventId, body.eventId),
								eq(eventRsvps.profileId, user.id),
							),
						);
					return json({ ok: true, attending: false });
				},
				{
					maxBodySize: 32 * 1024,
					rateLimit: {
						limit: 20,
						key: ({ caller: user }) => `events:POST:${user?.id ?? "anon"}`,
					},
				},
			),
		},
	},
});
