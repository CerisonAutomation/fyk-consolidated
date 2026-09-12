import { createFileRoute } from "@tanstack/react-router";
import { db } from "#/db";
import {
	methodNotAllowed,
	readJson,
	requireCaller,
	z,
} from "#/lib/api-helpers";
import { resolveCheckIn, SafetyError } from "#/lib/safety.server";
import { json, jsonError, withSecurity } from "#/middleware";

/**
 * `POST /api/safety/check-in/resolve` — confirm safe, or admit you are not.
 *
 * Resolving a check-in is a three-row write: the record in `safety_checkins`, the
 * projection in the caller's own `notifications`, and a notice in *somebody else's*
 * `notifications`. The last one is why this file exists — 0019 §5 removed the browser's
 * ability to insert a notification at all, and before that it was a client-side
 * fire-and-forget with an empty catch, so `components/Extras.tsx` cleared its own HUD
 * timer and told nobody, safe or not.
 *
 * 0021 moved the record out of the notification body, so the contact is no longer read
 * back out of a JSON blob the caller could have written: it is `safety_checkins.contact_id`,
 * which only ever points at a row in the caller's own `safety_contacts` (composite
 * foreign key). `contactId` in the body is still accepted and still ignored, so an old
 * client cannot redirect the notice to a profile it picked on the fly.
 *
 * A resolve that lost the race against the overdue sweep does not overwrite it: the
 * route reports what the sweep already sent instead of alerting the contact twice.
 */
const bodySchema = z.object({
	checkInId: z.uuid(),
	safe: z.boolean(),
	/** Accepted for compatibility with `#/lib/store.ts`, then ignored. */
	contactId: z.uuid().optional(),
});

export const Route = createFileRoute("/api/safety/check-in/resolve/")({
	server: {
		handlers: {
			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const body = await readJson(request, bodySchema, 4 * 1024);

					try {
						const result = await db.transaction(async (tx) =>
							resolveCheckIn(tx, {
								userId: user.id,
								checkInId: body.checkInId,
								safe: body.safe,
							}),
						);
						return json(
							{
								ok: true,
								// `contactNotified` and `warning` are the contract `#/lib/store.ts`
								// reads: it must be able to say "your contact was not informed"
								// out loud instead of clearing the timer on an assumption.
								contactNotified: result.contactNotified,
								warning: result.warning,
								checkIn: result.checkIn,
							},
							{ cache: "private" },
						);
					} catch (error) {
						if (error instanceof SafetyError)
							return jsonError(error.message, error.status);
						return jsonError("Could not resolve the check-in", 500);
					}
				},
				{
					maxBodySize: 4 * 1024,
					rateLimit: {
						limit: 40,
						key: ({ caller }) => `check-in:resolve:${caller?.id ?? "anon"}`,
					},
				},
			),

			GET: methodNotAllowed("POST"),
			PUT: methodNotAllowed("POST"),
			PATCH: methodNotAllowed("POST"),
			DELETE: methodNotAllowed("POST"),
		},
	},
});
