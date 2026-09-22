import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import {
	methodNotAllowed,
	readJson,
	requireCaller,
	unexpected,
	z,
} from "@/lib/api-helpers";
import {
	revokeCurrentSession,
	revokeOtherSessions,
} from "@/lib/auth-sessions.server";
import { forgetVerification } from "@/lib/supabase-auth.server";
import { ApiError, json, jsonError, withSecurity } from "@/middleware";

/**
 * `POST /api/auth/logout` — end this session on the server.
 *
 * WHY A ROUTE, WHEN SUPABASE OWNS THE SESSION
 * -------------------------------------------
 * `#/components/topbar` signed out by calling `supabase.auth.signOut({scope:'local'})`,
 * which deletes the token from that browser and leaves everything else untouched: the
 * access token stays valid until it expires, other devices stay signed in, and this
 * server's verification cache keeps answering for up to thirty seconds afterwards.
 * "Sign out" that only clears one localStorage key is a display change.
 *
 * This endpoint does the server half — revoke the session row (0032), drop the cached
 * verification so the next request with that token is refused, and optionally revoke
 * every other device — and tells the caller the client half is still theirs to do,
 * because only the browser can delete its own stored token.
 *
 * POST, not GET. A logout behind a GET is a link, an image tag or a prefetch away
 * from signing somebody out; `withSecurity` already refuses cross-site requests, and
 * this keeps the side effect behind a verb that cannot be triggered by navigation.
 */

const bodySchema = z
	.object({
		/** Also end every other device's session. */
		everywhere: z.boolean().optional(),
	})
	.strict();

function bearer(request: Request): string | null {
	const header = request.headers.get("authorization") ?? "";
	const match = /^Bearer\s+(.+)$/i.exec(header.trim());
	return match?.[1]?.trim() || null;
}

export const Route = createFileRoute("/api/auth/logout/")({
	server: {
		handlers: {
			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					try {
						const body = await readJson(request, bodySchema, 1024);
						const token = bearer(request);
						if (!token)
							return jsonError("There is no session token to end", 401);

						const revokedHere = await db.transaction((tx) =>
							revokeCurrentSession(token, tx),
						);
						const revokedElsewhere = body.everywhere
							? await db.transaction((tx) =>
									revokeOtherSessions(user.id, token, tx),
								)
							: 0;

						// Without this the cache keeps accepting the token for up to
						// `CACHE_MS`, which is thirty seconds of "signed out but still works".
						forgetVerification(token);

						return json({
							ok: true,
							revoked: (revokedHere ? 1 : 0) + revokedElsewhere,
							revokedHere,
							revokedOtherDevices: revokedElsewhere,
							// The browser still holds the token; only the client can clear it.
							clientSignOutRequired: true,
							note: "Call supabase.auth.signOut() to clear this device's stored token.",
						});
					} catch (error) {
						if (error instanceof ApiError)
							return jsonError(error.message, error.status);
						return unexpected("auth/logout", error);
					}
				},
				{
					auth: "required",
					maxBodySize: 1024,
					rateLimit: {
						limit: 20,
						key: ({ caller }) => `auth:logout:${caller?.id ?? "anon"}`,
					},
				},
			),

			// A GET that signs you out is a GET anybody can put in an `<img src>`.
			GET: methodNotAllowed("POST"),
			PUT: methodNotAllowed("POST"),
			PATCH: methodNotAllowed("POST"),
			DELETE: methodNotAllowed("POST"),
		},
	},
});
