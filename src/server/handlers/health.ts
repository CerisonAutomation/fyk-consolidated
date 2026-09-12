/**
 * GET /api/health — an honest readiness probe.
 *
 * It reports the things this app can actually verify from inside the request
 * path: whether the server has credentials, whether the durable (database) rate
 * limiter is live, and whether moderation capability is present. It deliberately
 * does not claim database connectivity it has not tested, because a probe that
 * always answers 200 is how outages get missed in production.
 */

import type { RequestCtx } from "../context";
import { dbFailure } from "../errors";
import { durableLimiterReady, limiterWarning } from "../rate-limit";
import { serverConfigured, serviceKeyConfigured } from "../supabase-server";

export async function health(ctx: RequestCtx) {
	const client = ctx.db();
	let schemaReady = false;
	let probeError: string | null = null;
	const { error } = await client.from("profiles").select("id").limit(1);
	if (error) probeError = error.code ?? "unknown";
	else schemaReady = true;

	return {
		status: schemaReady ? ("ok" as const) : ("degraded" as const),
		configured: serverConfigured(),
		schemaReady,
		// A service-role key in the request path is a design smell we want visible.
		serviceKeyPresent: serviceKeyConfigured(),
		durableRateLimit: durableLimiterReady(),
		warning: limiterWarning(),
		probeError,
	};
}

export function dbFailureReexport() {
	return dbFailure;
}
