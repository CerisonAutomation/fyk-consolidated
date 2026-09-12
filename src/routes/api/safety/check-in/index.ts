import { createFileRoute } from "@tanstack/react-router";
import { db } from "#/db";
import {
	cleanText,
	methodNotAllowed,
	readJson,
	requireCaller,
	unexpected,
	z,
} from "#/lib/api-helpers";
import {
	armCheckIn,
	DEFAULT_MINUTES,
	getActiveCheckIn,
	listCheckIns,
	listContacts,
	MAX_MINUTES,
	MIN_MINUTES,
	SafetyError,
	sweepOverdue,
} from "#/lib/safety.server";
import { json, jsonError, withSecurity } from "#/middleware";

/**
 * `GET /api/safety/check-in` — the one that is running, plus the recent history and
 * the contact list the picker needs.
 * `POST /api/safety/check-in` — arm a new one.
 *
 * WHY AN ENDPOINT EXISTS FOR THIS
 * -------------------------------
 * `#/integrations/supabase/safety.ts` armed a check-in by inserting a `notifications`
 * row of type `'check_in'` whose JSON body carried `{contact_id, place, due_at,
 * status}`. `notifications_type_check` (0013) has never included `'check_in'`, so the
 * insert was rejected by the database, the module read the id back from a row that did
 * not exist, and the screen said "Safety check-in armed" about a timer that lived only
 * in `#/lib/store.ts` and vanished on reload.
 *
 * `0019` widened the CHECK and this route became the writer, which fixed the silence
 * but not the shape: a check-in is a *record with a deadline*, and storing it inside a
 * notification means it disappears when the inbox row is hidden, has no index on
 * `due_at`, and cannot be answered by "who is overdue right now". `0021` moved it to
 * `public.safety_checkins` with `public.safety_contacts` behind it, and this route now
 * writes the record plus its inbox projection from one transaction.
 *
 * Arming also used to be pointed at *the user themselves* — `createCheckIn(userId,
 * userId, …)` — because the schema had no emergency-contact concept to validate
 * against and the screen had no picker. `contactId` is now a row in the caller's own
 * `safety_contacts`, the migration makes "your own account" a CHECK violation, and a
 * check-in with no contact at all still arms but says so in `warning`.
 *
 * The overdue transition is computed here rather than by a scheduler, because this
 * deployment has none: no migration uses `pg_cron`, and `UPSTASH_REDIS_REST_*` is rate
 * limiting. `sweepOverdue` runs first on both verbs, and its `UPDATE ... RETURNING` is
 * what guarantees a contact is alerted once, not once per tab.
 */
const armSchema = z.object({
	place: z.string().max(200).optional(),
	contactId: z.uuid().optional(),
	lat: z.coerce.number().min(-90).max(90).optional(),
	lng: z.coerce.number().min(-180).max(180).optional(),
	minutes: z.coerce.number().int().min(MIN_MINUTES).max(MAX_MINUTES).optional(),
});

const listSchema = z.object({
	limit: z.coerce.number().int().min(1).max(20).default(5),
});

/** Turn a `SafetyError` into the response the client's `ApiError` will surface. */
function asJson(error: unknown, scope: string) {
	if (error instanceof SafetyError)
		return jsonError(error.message, error.status);
	return unexpected(scope, error);
}

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
						// The read is what materialises an overdue check-in, so a user who
						// opens the app two days late sees "missed", not a running timer.
						const justMissed = await sweepOverdue(db, user.id);
						const [active, recent, contacts] = await Promise.all([
							getActiveCheckIn(db, user.id),
							listCheckIns(db, user.id, query.data.limit),
							listContacts(db, user.id),
						]);
						return json(
							{
								active,
								recent,
								contacts,
								// Nothing on this screen can push, so the HUD says the check-in
								// was "raised when you last opened the app" rather than implying
								// the contact was paged at the deadline.
								just_missed: justMissed,
							},
							{ cache: "private" },
						);
					} catch (error) {
						return asJson(error, "safety/check-in/GET");
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
						await sweepOverdue(db, user.id);
						const result = await db.transaction(async (tx) =>
							armCheckIn(tx, {
								userId: user.id,
								contactId: body.contactId,
								place: cleanText(body.place ?? "", 200),
								lat: body.lat,
								lng: body.lng,
								minutes: body.minutes ?? DEFAULT_MINUTES,
							}),
						);
						// The payload is flat on purpose: `#/integrations/supabase/safety.ts`
						// reads `id`/`status`/`due_at`/`contact_name` off the top level, and the
						// two extra keys are what lets the screen tell "armed, nobody notified"
						// from "armed, contact told" instead of toasting success either way.
						return json(
							{
								ok: true,
								...result.checkIn,
								contactNotified: result.contactNotified,
								warning: result.warning,
							},
							{ cache: "private" },
						);
					} catch (error) {
						return asJson(error, "safety/check-in/POST");
					}
				},
				{
					maxBodySize: 4 * 1024,
					rateLimit: {
						limit: 20,
						key: ({ caller }) => `check-in:POST:${caller?.id ?? "anon"}`,
					},
				},
			),

			// Declared so an unsupported verb is answered in JSON. Without these, a
			// `PUT /api/safety/check-in` reached the SPA handler and returned
			// `200 text/html`.
			PUT: methodNotAllowed("GET, POST"),
			PATCH: methodNotAllowed("GET, POST"),
			DELETE: methodNotAllowed("GET, POST"),
		},
	},
});
