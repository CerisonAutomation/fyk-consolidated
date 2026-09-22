import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import {
	methodNotAllowed,
	requireCaller,
	unexpected,
	z,
} from "@/lib/api-helpers";
import {
	expiredSessionCount,
	listSessions,
	revokeOtherSessions,
	revokeSession,
	touchSession,
} from "@/lib/auth-sessions.server";
import { ApiError, json, jsonError, withSecurity } from "@/middleware";

/**
 * `GET/DELETE /api/auth/sessions` — the devices signed in as you, and ending them.
 *
 * WHAT THIS REPLACED
 * ------------------
 * A handler that returned a literal: one invented session with
 * `userAgent: "Current Device"` and `ip: "127.0.0.1"`, a second entry of the same
 * shape, a `DELETE` that answered `{ok: true, revoked: [...]}` without touching a
 * table, and eight `void cache;` statements whose comment said they existed "to
 * satisfy TS noUnusedLocals". Every device looked like the current one and nothing
 * was ever signed out, which is the worst shape for a security screen: it reports
 * the action it did not take.
 *
 * 0032 reshapes `public.sessions` around a `token_hash` instead of a plaintext
 * bearer token, and `#/lib/auth-sessions.server` owns the reads and writes. The row
 * for the calling token is touched on the way in, so the list always marks the
 * device you are holding as `current` — that flag is derived from the token hash,
 * not from a client's claim.
 *
 * Revocation sets `revoked_at` rather than deleting: "signed out on that phone, on
 * that date" stays answerable, and `#/lib/supabase-auth.server#forgetVerification`
 * drops the cached verification so the revocation takes effect on the next request
 * instead of thirty seconds later.
 */

export const Route = createFileRoute("/api/auth/sessions/")({
	server: {
		handlers: {
			GET: withSecurity(
				async ({ request, caller, ip }) => {
					const user = requireCaller(caller);
					try {
						const token = bearer(request);
						if (token)
							await touchSession({
								userId: user.id,
								token,
								userAgent: request.headers.get("user-agent"),
								ip,
							});

						const [all, expired] = await Promise.all([
							listSessions(user.id, token),
							expiredSessionCount(user.id),
						]);
						const live = all.filter((s) => s.revokedAt === null);

						return json(
							{
								sessions: live,
								revoked: all.filter((s) => s.revokedAt !== null),
								current: live.find((s) => s.current) ?? null,
								expiredCount: expired,
								// Supabase owns the refresh token: revoking here stops this
								// server accepting the access token, and the client still has
								// to sign out to clear the cookie it holds.
								note: "Revoking a session ends it here. The device's own sign-out clears its stored token.",
							},
							{ cache: "private" },
						);
					} catch (error) {
						if (error instanceof ApiError)
							return jsonError(error.message, error.status);
						return unexpected("auth/sessions:GET", error);
					}
				},
				{
					auth: "required",
					rateLimit: {
						limit: 60,
						key: ({ caller }) => `sessions:GET:${caller?.id ?? "anon"}`,
					},
				},
			),

			DELETE: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					try {
						const url = new URL(request.url);
						const id = url.searchParams.get("id");
						const everywhere = url.searchParams.get("everywhere") === "1";
						const token = bearer(request);

						if (everywhere) {
							if (!token) return jsonError("Sign in first", 401);
							// "Everywhere" means every *other* device: signing out the device
							// that made the request is `/api/auth/logout`, and doing both from
							// one button leaves the caller with a token the server refuses
							// while the screen still renders as signed in.
							const revoked = await revokeOtherSessions(user.id, token);
							return json({ ok: true, revoked, othersOnly: true });
						}

						const parsed = z.uuid().safeParse(id ?? "");
						if (!parsed.success)
							return jsonError("Pass ?id=<session id> or ?everywhere=1", 400);

						const revoked = await db.transaction((tx) =>
							revokeSession(user.id, parsed.data, tx),
						);
						if (!revoked)
							return jsonError(
								"That session is not yours, or it is already revoked",
								404,
							);
						return json({ ok: true, revoked: 1, id: parsed.data });
					} catch (error) {
						if (error instanceof ApiError)
							return jsonError(error.message, error.status);
						return unexpected("auth/sessions:DELETE", error);
					}
				},
				{
					auth: "required",
					rateLimit: {
						limit: 20,
						key: ({ caller }) => `sessions:DELETE:${caller?.id ?? "anon"}`,
					},
				},
			),

			POST: methodNotAllowed("GET, DELETE"),
			PUT: methodNotAllowed("GET, DELETE"),
			PATCH: methodNotAllowed("GET, DELETE"),
		},
	},
});

function bearer(request: Request): string | null {
	const header = request.headers.get("authorization") ?? "";
	const match = /^Bearer\s+(.+)$/i.exec(header.trim());
	const token = match?.[1]?.trim();
	return token ? token : null;
}
