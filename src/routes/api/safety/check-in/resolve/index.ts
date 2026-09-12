import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, like } from "drizzle-orm";
import { db } from "#/db";
import {
	isMissingProfileError,
	readJson,
	requireCaller,
	z,
} from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { notifications, users } from "#/schema";

/**
 * `POST /api/safety/check-in/resolve` — confirm (or miss) a safety check-in.
 *
 * `#/lib/store.ts` called this route and swallowed the rejection, so the check-in
 * HUD in `components/Extras.tsx` cleared its own timer and told nobody: the
 * emergency contact was never notified, safe or not.
 *
 * A check-in is stored as a `notifications` row of type `check_in` whose JSON body
 * carries `{ contact_id, place, due_at, status }` (that is what
 * `#/integrations/supabase/safety.ts` writes, and there is no separate table).
 * Resolving one is a two-row write — update mine, insert one for the contact —
 * which is exactly what browser code cannot do under RLS, because the second row
 * belongs to *another* user. Hence this endpoint.
 *
 * The contact is read back out of the stored body and never taken from the
 * request: resolving your own check-in must not be able to message a profile you
 * picked on the fly.
 */
const bodySchema = z.object({
	checkInId: z.uuid(),
	safe: z.boolean(),
	// Accepted for compatibility with the store, then ignored in favour of the
	// stored `contact_id`.
	contactId: z.uuid().optional(),
});

type CheckInBody = {
	contact_id?: string | null;
	place?: string | null;
	due_at?: string | null;
	status?: string | null;
};

function parseBody(raw: unknown): CheckInBody {
	if (typeof raw === "object" && raw !== null) return raw as CheckInBody;
	if (typeof raw !== "string") return {};
	try {
		return JSON.parse(raw) as CheckInBody;
	} catch {
		return {};
	}
}

export const Route = createFileRoute("/api/safety/check-in/resolve/")({
	server: {
		handlers: {
			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const body = await readJson(request, bodySchema, 4 * 1024);

					const [checkIn] = await db
						.select({
							id: notifications.id,
							body: notifications.body,
							createdAt: notifications.createdAt,
						})
						.from(notifications)
						.where(
							and(
								eq(notifications.id, body.checkInId),
								eq(notifications.userId, user.id),
								like(notifications.type, "check_in%"),
							),
						)
						.limit(1);
					if (!checkIn) return jsonError("Check-in not found", 404);

					const stored = parseBody(checkIn.body);
					const contactId = stored.contact_id ?? null;
					const payload = {
						...stored,
						status: body.safe ? ("SAFE" as const) : ("OVERDUE" as const),
						resolved_at: new Date().toISOString(),
					};

					await db
						.update(notifications)
						.set({
							title: body.safe ? "Check-in resolved" : "Check-in missed",
							body: JSON.stringify(payload),
							// Unread again on purpose: the result has to show up in the
							// notifications list, not just in the timer that already vanished.
							read: false,
							href: "/safety",
						})
						.where(eq(notifications.id, checkIn.id));

					let notified = false;
					if (contactId && contactId !== user.id) {
						const [contact] = await db
							.select({ id: users.id })
							.from(users)
							.where(eq(users.id, contactId))
							.limit(1);
						if (contact) {
							const [me] = await db
								.select({ displayName: users.displayName })
								.from(users)
								.where(eq(users.id, user.id))
								.limit(1);
							const who = me?.displayName?.trim() || "Your contact";
							const place = stored.place?.trim();
							try {
								await db.insert(notifications).values({
									userId: contact.id,
									type: body.safe ? "check_in_resolved" : "check_in_overdue",
									title: body.safe
										? "They are safe"
										: `Missed check-in${place ? ` · ${place}` : ""}`,
									body: body.safe
										? `${who} confirmed they are safe${place ? ` after their check-in near ${place}` : ""}.`
										: `${who} did not confirm a check-in${place ? ` near ${place}` : ""}. Consider reaching out.`,
									href: `/profile/${user.id}`,
									actorId: user.id,
									read: false,
								});
								notified = true;
							} catch (error) {
								if (!isMissingProfileError(error)) throw error;
							}
						}
					}

					return json({
						ok: true,
						status: payload.status,
						contactNotified: notified,
						// Only set when there is nobody to tell: the HUD can say so instead
						// of implying a message went out.
						warning:
							contactId || notified
								? null
								: "No emergency contact on this check-in",
					});
				},
				{
					maxBodySize: 4 * 1024,
					rateLimit: {
						limit: 30,
						key: ({ caller }) => `checkin:${caller?.id ?? "anon"}`,
					},
				},
			),

			/** The HUD's countdown state, straight from the pending `check_in` row. */
			GET: withSecurity(
				async ({ caller }) => {
					const user = requireCaller(caller);
					// `notifications.body` is plain text, so the status is checked here
					// rather than with a `::jsonb` predicate that would throw on the
					// non-JSON bodies legacy rows still contain.
					const pending = await db
						.select({
							id: notifications.id,
							body: notifications.body,
							createdAt: notifications.createdAt,
						})
						.from(notifications)
						.where(
							and(
								eq(notifications.userId, user.id),
								eq(notifications.type, "check_in"),
								eq(notifications.read, false),
							),
						)
						.orderBy(desc(notifications.createdAt))
						.limit(10);
					const row = pending.find(
						(item) => parseBody(item.body).status === "ARMED",
					);
					if (!row)
						return json(
							{ pending: false, checkIn: null },
							{ cache: "private" },
						);
					const stored = parseBody(row.body);
					return json(
						{
							pending: true,
							checkIn: {
								checkInId: row.id,
								contactId: stored.contact_id ?? null,
								place: stored.place ?? null,
								dueAt: stored.due_at ?? null,
								status: "ARMED" as const,
							},
						},
						{ cache: "private" },
					);
				},
				{
					rateLimit: {
						limit: 120,
						key: ({ caller }) => `checkin:GET:${caller?.id ?? "anon"}`,
					},
				},
			),
		},
	},
});
