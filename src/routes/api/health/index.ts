import { createFileRoute } from "@tanstack/react-router";
import { pingDatabase } from "#/db";
import { methodNotAllowed } from "#/lib/api-helpers";
import { publicCacheHeaders } from "#/lib/security";
import { isAuthConfigured } from "#/lib/supabase-auth.server";
import { json } from "#/middleware";

/**
 * Liveness/readiness endpoint.
 *
 * `Dockerfile` ran `HEALTHCHECK CMD curl -f http://localhost:3000/health` and
 * `e2e/app.spec.ts` requests `/api/health` — neither endpoint existed, so the
 * container was permanently "unhealthy" (an orchestrator restart loop) while the
 * e2e suite failed for the same reason.
 *
 * Deliberately cheap and public: no session, no rate-limit bucket, cacheable
 * for a few seconds so a 15s healthcheck interval cannot become load.
 *
 * `?deep=1` adds one round trip to Postgres and answers `503` when the database
 * is unreachable, so an orchestrator can act on it. A *configuration* problem
 * (`DATABASE_URL` unset) is reported distinctly from an outage: `unconfigured`
 * means "the deployment is wrong", `unreachable` means "the database is down".
 */
export const Route = createFileRoute("/api/health/")({
	server: {
		handlers: {
			/* Every verb this route does not implement is answered in JSON (405 +
			 * Allow). Without a declaration TanStack Start treats the request as
			 * unmatched-by-path-and-method and falls through to the document handler,
			 * which answers `200 text/html` with the SPA bundle — a client parsing
			 * JSON then blames the server instead of its own verb. AUDIT §3.10. */
			POST: methodNotAllowed("GET"),
			PUT: methodNotAllowed("GET"),
			PATCH: methodNotAllowed("GET"),
			DELETE: methodNotAllowed("GET"),

			GET: async ({ request }: { request: Request }) => {
				const url = new URL(request.url);
				const deep = url.searchParams.get("deep") === "1";

				const base = {
					status: "ok" as "ok" | "degraded",
					uptimeSeconds: Math.round(process.uptime()),
					timestamp: new Date().toISOString(),
					checks: {
						auth: isAuthConfigured() ? "configured" : "missing-supabase-env",
					},
				};

				if (!deep) return json(base, { headers: publicCacheHeaders(5) });

				try {
					await pingDatabase();
					return json(
						{ ...base, checks: { ...base.checks, database: "ok" } },
						{ headers: publicCacheHeaders(5) },
					);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					const database = message.includes("DATABASE_URL")
						? "unconfigured"
						: "unreachable";
					return json(
						{
							...base,
							status: "degraded",
							checks: { ...base.checks, database },
						},
						{ status: 503, headers: publicCacheHeaders(1) },
					);
				}
			},
		},
	},
});
