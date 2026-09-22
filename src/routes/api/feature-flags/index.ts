import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
	methodNotAllowed,
	readJson,
	requireCaller,
	unexpected,
	z,
} from "@/lib/api-helpers";
import {
	FEATURE_FLAGS,
	flagEnvName,
	isFeatureFlagKey,
	resolveFeatureFlags,
} from "@/lib/feature-flags";
import { currentTier } from "@/lib/wallet.server";
import { ApiError, json, jsonError, withSecurity } from "@/middleware";
import { siteConfig, users } from "@/schema";

/**
 * `GET/POST /api/feature-flags` — which surfaces are switched on, for this caller.
 *
 * `useFeatureFlags()` in `#/hooks/prd-hooks` fetched this path and got the SPA's
 * HTML 404, so `isEnabled()` returned `false` for every flag and the surfaces it
 * gated stayed dark. The flags are now data: `#/lib/feature-flags` is the registry,
 * and this route resolves it against `site_config`, the environment and the caller.
 *
 * WHY THE ANSWER IS PER CALLER
 * ----------------------------
 * A flag with `audience: "paid"` is off for a free account no matter what the
 * environment says, and the response says so in `hidden` rather than pretending the
 * flag does not exist — a screen can then render "unlock with Plus" instead of
 * hiding a feature the member will later find and assume was broken.
 *
 * POST is admin-only (`users.role = 'admin'`, the same check `/api/admin/*` uses) and
 * writes `site_config.feature_flags`, which outranks the registry default but not the
 * environment: an operator can switch a surface off without a deploy, and an
 * operator with shell access can still overrule them deliberately.
 */

const CONFIG_KEY = "feature_flags";

const actionSchema = z.discriminatedUnion("action", [
	z
		.object({
			action: z.literal("set"),
			key: z.string().min(1).max(64),
			value: z.boolean(),
		})
		.strict(),
	z
		.object({ action: z.literal("reset"), key: z.string().min(1).max(64) })
		.strict(),
]);

async function storedConfig(): Promise<Record<string, unknown> | null> {
	const [row] = await db
		.select({ value: siteConfig.value })
		.from(siteConfig)
		.where(eq(siteConfig.key, CONFIG_KEY))
		.limit(1);
	const value = row?.value;
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

export const Route = createFileRoute("/api/feature-flags/")({
	server: {
		handlers: {
			GET: withSecurity(
				async ({ caller }) => {
					try {
						const [config, tier, roleRow] = await Promise.all([
							storedConfig(),
							caller ? currentTier(caller.id) : Promise.resolve("free"),
							caller
								? db
										.select({ role: users.role })
										.from(users)
										.where(eq(users.id, caller.id))
										.limit(1)
								: Promise.resolve([]),
						]);

						const resolved = resolveFeatureFlags({
							config,
							readEnv: (name) => process.env[name],
							context: { tier, role: roleRow[0]?.role ?? null },
						});

						return json({
							flags: resolved.flags,
							hidden: resolved.hidden,
							tier,
							// The registry itself, so a client can render a label instead of
							// hard-coding one per key and drifting from the server's meaning.
							definitions: FEATURE_FLAGS.map((flag) => ({
								key: flag.key,
								description: flag.description,
								audience: flag.audience,
								defaultOn: flag.defaultOn,
								env: flagEnvName(flag.key),
							})),
						});
					} catch (error) {
						if (error instanceof ApiError)
							return jsonError(error.message, error.status);
						return unexpected("feature-flags/list", error);
					}
				},
				{
					auth: "optional",
					// Read on every app start by every surface, so the budget is generous but
					// still keyed: an unkeyed limit is a limit shared by the whole internet.
					rateLimit: {
						limit: 120,
						key: ({ caller, ip }) => `flags:read:${caller?.id ?? ip}`,
					},
				},
			),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					try {
						const [me] = await db
							.select({ role: users.role })
							.from(users)
							.where(eq(users.id, user.id))
							.limit(1);
						if (me?.role !== "admin")
							return jsonError("Only an admin can change feature flags", 403);

						const body = await readJson(request, actionSchema, 2 * 1024);
						if (!isFeatureFlagKey(body.key))
							return jsonError(
								`Unknown flag. Known flags: ${FEATURE_FLAGS.map((f) => f.key).join(", ")}`,
								400,
							);

						const current = (await storedConfig()) ?? {};
						const next = { ...current };
						if (body.action === "set") next[body.key] = body.value;
						else delete next[body.key];

						await db
							.insert(siteConfig)
							.values({ key: CONFIG_KEY, value: next, updatedAt: new Date() })
							.onConflictDoUpdate({
								target: siteConfig.key,
								set: { value: next, updatedAt: new Date() },
							});

						const resolved = resolveFeatureFlags({
							config: next,
							readEnv: (name) => process.env[name],
							context: { tier: await currentTier(user.id), role: me.role },
						});
						return json({
							ok: true,
							action: body.action,
							key: body.key,
							flags: resolved.flags,
							// Say so when the environment overrules the write, otherwise an
							// admin sets a flag, sees no change, and concludes the route is broken.
							overruledByEnvironment:
								body.action === "set" &&
								resolved.flags[body.key] !== body.value,
						});
					} catch (error) {
						if (error instanceof ApiError)
							return jsonError(error.message, error.status);
						return unexpected("feature-flags/set", error);
					}
				},
				{
					auth: "required",
					maxBodySize: 2 * 1024,
					rateLimit: {
						limit: 30,
						key: ({ caller }) => `flags:write:${caller?.id}`,
					},
				},
			),

			PUT: methodNotAllowed("GET, POST"),
			PATCH: methodNotAllowed("GET, POST"),
			DELETE: methodNotAllowed("GET, POST"),
		},
	},
});
