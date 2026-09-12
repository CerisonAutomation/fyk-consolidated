import { createFileRoute } from "@tanstack/react-router";
import { json } from "#/middleware";

/**
 * `/api/$` — the catch-all that makes an unknown API path answer in JSON.
 *
 * TanStack Start matches routes by **pathname**, and a method a matched route does not
 * declare is not a 405: it is simply unmatched, and the request continues to the
 * document handler. So before this file, `curl /api/nope` returned `200 text/html` with
 * the SPA bundle in it, which is a genuinely bad answer to give a client: an API caller
 * that parses JSON sees a parse error at HTTP 200 and concludes the *server* is broken
 * rather than that it asked for something that does not exist. `/api/health` answering
 * `200 <html>` is how a misconfigured `VITE_APP_URL` looked like an outage.
 *
 * What this route fixes is *unknown paths*. What it cannot fix is a known path with an
 * undeclared verb — `/api/taps` matches the `taps` route, and only that route can answer
 * 405 — which is why `methodNotAllowed()` exists in `#/lib/api-helpers` and is declared
 * on the routes that move money, privilege or another user's rows. Fixing the remaining
 * routes in one sweep would need a `requestMiddleware` on the start instance
 * (`createStart`), and this app deliberately has no `src/start.ts`: the generated start
 * entry is what pins the boot behaviour the design review cares about, so the per-route
 * verb lists stay the fix. Auditing that decision is AUDIT §3.10.
 *
 * Ordering is safe by construction: TanStack Router ranks a static segment above a
 * splat, so `/api/health`, `/api/wallet` and the rest keep their own handlers — verified
 * by `GET /api/health` still returning `200 {"ok":true}` after this file exists, and by
 * the 401s/405s on the authenticated routes.
 */
function missing(method: string, pathname: string) {
	return json(
		{
			ok: false,
			error: `No ${method} route at ${pathname}`,
			code: "route_not_found",
			// A 404 on an API path is almost always a client holding a stale path or a
			// stale verb, and `path`/`method` are echoed back so the response says which.
			path: pathname,
			method,
		},
		{ status: 404, cache: "private" },
	);
}

const handler =
	(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD") =>
	async ({ request }: { request: Request }) =>
		missing(method, new URL(request.url).pathname);

export const Route = createFileRoute("/api/$")({
	server: {
		handlers: {
			GET: handler("GET"),
			POST: handler("POST"),
			PUT: handler("PUT"),
			PATCH: handler("PATCH"),
			DELETE: handler("DELETE"),
			HEAD: handler("HEAD"),
			// OPTIONS is left to the CORS middleware (`src/middleware.ts`), which owns
			// preflight, `Access-Control-*` and the `VITE_APP_URL` origin allow-list.
		},
	},
});
