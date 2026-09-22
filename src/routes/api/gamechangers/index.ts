import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, unexpected } from "@/lib/api-helpers";
import {
	MONTHLY_BOOSTS,
	TIER_ORDER,
	TIER_PERKS,
	type Tier,
	tapLimitFor,
	tierName,
	tierPrice,
	tierRank,
} from "@/lib/economy";
import { FEATURE_FLAGS, resolveFeatureFlags } from "@/lib/feature-flags";
import { currentTier } from "@/lib/wallet.server";
import { ApiError, json, jsonError, withSecurity } from "@/middleware";
import { siteConfig, users } from "@/schema";

/**
 * `GET /api/gamechangers` — the ladder, computed.
 *
 * "Game changers" is the marketing name for the tier ladder and the paid surfaces it
 * unlocks, and the screen that shows it fetched `/api/gamechangers` for an HTML 404
 * and then rendered a hard-coded list. A hard-coded list of what money buys is a list
 * that can drift from what money buys, so nothing here is stored: every item is read
 * from `#/lib/economy` (prices, perks, monthly boosts, tap limits) and
 * `#/lib/feature-flags` (which surfaces a paid tier gates), the two modules the
 * charging and enforcing routes already use.
 *
 * Read-only on purpose. The purchase itself is `POST /api/premium {action:'activate'}`
 * or `POST /api/wallet {action:'subscribe'}` — both call
 * `#/lib/wallet.server#activateTier` — and a second write path for the same money
 * would be the third place a price could disagree with a charge.
 */

/** What each paid tier actually changes, in the words of the code that enforces it. */
const TIER_SUMMARY: Record<Exclude<Tier, "free">, string> = {
	plus: "The daily tap allowance stops applying.",
	gold: "Unlimited taps, plus boosters granted every month.",
	platinum:
		"Unlimited taps, the largest monthly booster grant, and every paid surface.",
};

export const Route = createFileRoute("/api/gamechangers/")({
	server: {
		handlers: {
			GET: withSecurity(
				async ({ caller }) => {
					try {
						const tier: Tier = caller ? await currentTier(caller.id) : "free";
						const roleRow = caller
							? await db
									.select({ role: users.role })
									.from(users)
									.where(eq(users.id, caller.id))
									.limit(1)
							: [];

						const [configRow] = await db
							.select({ value: siteConfig.value })
							.from(siteConfig)
							.where(eq(siteConfig.key, "feature_flags"))
							.limit(1);
						const config =
							configRow?.value && typeof configRow.value === "object"
								? (configRow.value as Record<string, unknown>)
								: null;
						const { flags } = resolveFeatureFlags({
							config,
							readEnv: (name) => process.env[name],
							context: { tier, role: roleRow[0]?.role ?? null },
						});

						const ladder = TIER_ORDER.filter(
							(t): t is Exclude<Tier, "free"> => t !== "free",
						).map((entry) => ({
							id: `tier:${entry}`,
							name: tierName(entry),
							description: TIER_SUMMARY[entry],
							kind: "tier" as const,
							price: tierPrice(entry),
							perks: TIER_PERKS[entry],
							monthlyBoosts: MONTHLY_BOOSTS[entry],
							tapLimit: Number.isFinite(tapLimitFor(entry))
								? tapLimitFor(entry)
								: null,
							unlocked: tierRank(tier) >= tierRank(entry),
							current: tier === entry,
							/** Where the buy happens; this route does not take money. */
							action: "activate",
							actionRoute: "/api/premium",
						}));

						const surfaces = FEATURE_FLAGS.filter(
							(flag) => flag.audience !== "all",
						).map((flag) => ({
							id: `flag:${flag.key}`,
							name: flag.key,
							description: flag.description,
							kind: "surface" as const,
							price: null,
							perks: [] as readonly string[],
							monthlyBoosts: 0,
							tapLimit: null,
							unlocked: Boolean(flags[flag.key]),
							current: false,
							action: flags[flag.key] ? "open" : "upgrade",
							actionRoute: "/api/premium",
						}));

						return json({
							items: [...ladder, ...surfaces],
							tier,
							tierName: tierName(tier),
							// The screen reads `items` or `data`; both are answered so the
							// generated component and any older caller see the same rows.
							data: [...ladder, ...surfaces],
						});
					} catch (error) {
						if (error instanceof ApiError)
							return jsonError(error.message, error.status);
						return unexpected("gamechangers/list", error);
					}
				},
				{
					auth: "optional",
					rateLimit: {
						limit: 60,
						key: ({ caller, ip }) => `gamechangers:${caller?.id ?? ip}`,
					},
				},
			),

			// Declared so the verb is answered in JSON: the generated screen posted a
			// per-item `boost` here, which is a purchase, and purchases belong to
			// `/api/premium` and `/api/wallet` — not to a catalogue route.
			POST: methodNotAllowed("GET"),
			PUT: methodNotAllowed("GET"),
			PATCH: methodNotAllowed("GET"),
			DELETE: methodNotAllowed("GET"),
		},
	},
});
