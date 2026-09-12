import { createFileRoute } from "@tanstack/react-router";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "#/db";
import {
	methodNotAllowed,
	readJson,
	requireCaller,
	z,
} from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";
import { pushSubscriptions } from "#/schema";

/**
 * Web-push subscription registration.
 *
 * Fixed relative to the previous version:
 *   - `endpoint`/`p256dh`/`auth` were validated as "a string of 10–1000 chars".
 *     That accepts 1000 characters of junk in each column and, more importantly,
 *     a 1000-char endpoint. Fields are now length-capped to realistic sizes and
 *     the endpoint must be an `https:` URL with a hostname.
 *   - The find-then-update/create pair raced: two devices registering the same
 *     endpoint at once produced duplicate rows (and duplicate pushes). Now one
 *     delete+insert inside a transaction, backed by the unique index on
 *     `(user_id, endpoint)` — see `drizzle/schema.ts` and
 *     `supabase/migrations/0014_api_hardening.sql`.
 *   - Rows were matched by endpoint alone, so a subscription belonging to a
 *     *different* user with the same endpoint could be reassigned. Every
 *     statement here is scoped to the caller's `user_id`.
 *   - Unbounded rows per user (one per browser profile, forever) are capped: the
 *     oldest beyond 20 are pruned on each register.
 *
 * Sending is *not* done here: `supabase/functions/notify` owns delivery, so this
 * route only maintains the registry.
 */

const MAX_SUBSCRIPTIONS_PER_USER = 20;

const subscribeSchema = z.object({
	endpoint: z
		.string()
		.min(20)
		.max(512)
		.url()
		.refine(
			(value) => new URL(value).protocol === "https:",
			"push endpoints must use https",
		)
		.refine(
			(value) => Boolean(new URL(value).hostname),
			"push endpoint must have a host",
		),
	p256dh: z
		.string()
		.min(40)
		.max(120)
		.regex(/^[A-Za-z0-9_-]+$/, "p256dh must be base64url"),
	auth: z
		.string()
		.min(16)
		.max(64)
		.regex(/^[A-Za-z0-9_-]+$/, "auth must be base64url"),
});

export const Route = createFileRoute("/api/push/subscribe")({
	server: {
		handlers: {
			/* Every verb this route does not implement is answered in JSON (405 +
			 * Allow). Without a declaration TanStack Start treats the request as
			 * unmatched-by-path-and-method and falls through to the document handler,
			 * which answers `200 text/html` with the SPA bundle — a client parsing
			 * JSON then blames the server instead of its own verb. AUDIT §3.10. */
			GET: methodNotAllowed("POST, DELETE"),
			PUT: methodNotAllowed("POST, DELETE"),
			PATCH: methodNotAllowed("POST, DELETE"),

			/**
			 * Forget this device.
			 *
			 * `PushSubscription.unsubscribe()` is browser-local: it stops the worker
			 * receiving, and it leaves the row in `push_subscriptions` pointing at an
			 * endpoint that still exists at the push service for a while. Without this
			 * verb, "turn notifications off" on a shared or lost phone means "stop
			 * listening for now", which for this app is not a safety property — so
			 * `disablePush()` calls it before it drops the local subscription, and a
			 * failure there is surfaced rather than swallowed.
			 *
			 * `?endpoint=` scopes it to one device (the common case, and the only one the
			 * browser can authorise); without it every subscription of the caller goes,
			 * which is what an account-deletion flow needs. Both forms are keyed on the
			 * *caller's* id, so neither can touch anyone else's rows.
			 */
			DELETE: withSecurity(async ({ request, caller }) => {
				const user = requireCaller(caller);
				const endpoint = new URL(request.url).searchParams.get("endpoint");
				if (endpoint !== null && endpoint.length > 512) {
					return json({ error: "endpoint is too long" }, { status: 413 });
				}

				const where = endpoint
					? and(
							eq(pushSubscriptions.userId, user.id),
							eq(pushSubscriptions.endpoint, endpoint),
						)
					: eq(pushSubscriptions.userId, user.id);

				// `returning id` rather than a bare delete so the response says what
				// actually happened: "removed: 0" for a re-typed endpoint is the answer
				// that tells the caller it was already gone, and "removed: 3" says the
				// device list was longer than expected.
				const removed = await db
					.delete(pushSubscriptions)
					.where(where)
					.returning({ id: pushSubscriptions.id });

				return json({ ok: true, removed: removed.length });
			}, { rateLimit: { limit: 30, key: ({ caller: user }) => `push-del:${user?.id ?? "anon"}` } }),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const body = await readJson(request, subscribeSchema, 8 * 1024);
					const endpoint = body.endpoint.trim();

					await db.transaction(async (tx) => {
						// Re-registering an endpoint (key rotation, service-worker
						// reinstall) must not append a second row: delete-then-insert
						// inside one transaction is the idempotent form, and the
						// unique index makes it race-free.
						await tx
							.delete(pushSubscriptions)
							.where(
								and(
									eq(pushSubscriptions.userId, user.id),
									eq(pushSubscriptions.endpoint, endpoint),
								),
							);
						await tx.insert(pushSubscriptions).values({
							userId: user.id,
							endpoint,
							p256dh: body.p256dh,
							auth: body.auth,
						});

						// Keep one user's fan-out bounded; newest 20 survive.
						const stale = await tx
							.select({ id: pushSubscriptions.id })
							.from(pushSubscriptions)
							.where(eq(pushSubscriptions.userId, user.id))
							.orderBy(
								desc(pushSubscriptions.createdAt),
								asc(pushSubscriptions.id),
							)
							.limit(1000)
							.offset(MAX_SUBSCRIPTIONS_PER_USER);
						if (stale.length > 0) {
							await tx.delete(pushSubscriptions).where(
								inArray(
									pushSubscriptions.id,
									stale.map((row) => row.id),
								),
							);
						}
					});

					return json({ ok: true }, { status: 201 });
				},
				{
					maxBodySize: 8 * 1024,
					rateLimit: {
						limit: 10,
						key: ({ caller: user }) => `push:${user?.id ?? "anon"}`,
					},
				},
			),
		},
	},
});
