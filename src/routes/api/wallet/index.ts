import { createFileRoute } from "@tanstack/react-router";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	methodNotAllowed,
	readJson,
	requireCaller,
	unexpected,
	z,
} from "@/lib/api-helpers";
import {
	DAILY_REWARD,
	findShopItem,
	findTopupPack,
	monthlyBoostsFor,
	PAYMENTS_UNAVAILABLE,
	paymentsConfigured,
	SHOP_ITEMS,
	TIER_ORDER,
	TIER_PERKS,
	TOPUP_PACKS,
	tierName,
	tierPrice,
} from "@/lib/economy";
import {
	activeSubscription,
	currentTier,
	InsufficientBalance,
	postLedger,
	purchaseCountLastHour,
	purchaseLimitReached,
	recentTransactions,
	setTier,
	upsertConsumable,
	walletBalance,
} from "@/lib/wallet.server";
import { json, jsonError, withSecurity } from "@/middleware";
import { consumablesInventory } from "@/schema";

/**
 * `GET/POST /api/wallet` — bones, the shop, and the membership.
 *
 * WHY THIS REPLACED `src/integrations/supabase/wallet.ts`
 * --------------------------------------------------------
 * That module was 475 lines of the browser writing the economy straight into
 * Postgres: `wallet.update({ balance })` to mint or burn,
 * `premium_entitlements.insert({ tier: 'gold', source: 'dev-mode' })` to grant
 * itself Premium, `wallet_transactions.insert({ type: 'credit', … })` for a
 * history the ledger's own CHECK had never accepted. Every one of those writes was
 * either an escalation any signed-in account could use, or a row the database
 * rejected silently — and the screen reported success either way, with a receipt id
 * made from `Date.now()`, which is the closest this repository came to a fake
 * payment.
 *
 * Here the client states an *intent* (`buy a boost`, `claim the daily`) and the
 * server decides the price, the amount, the entitlement and the expiry. Prices come
 * from `#/lib/economy`, one place, so the copy on `/premium` and the charge cannot
 * drift. Money moves by appending to the ledger (0019), from which `wallet.balance`
 * is derived, and nothing is granted for a purchase unless a payment provider (or
 * the explicit `PAYMENTS_DEV_MODE` flag) exists.
 *
 * The response keeps the shape `premium-client.tsx` already rendered
 * (`wallet` / `shop` / `tiers` / `currentTier`), so the screen kept its design and
 * lost its authority.
 */

/** `idempotencyKey` on a spend: a retried request applies once, never twice. */
const idempotencyField = z.string().min(8).max(200).optional();

const actionSchema = z.discriminatedUnion("action", [
	z.object({ action: z.literal("daily") }),
	z.object({
		action: z.literal("buy"),
		type: z.enum(SHOP_ITEMS.map((item) => item.type) as [string, ...string[]]),
		idempotencyKey: idempotencyField,
	}),
	z.object({
		action: z.literal("topup"),
		packId: z.string().min(1).max(40),
		idempotencyKey: idempotencyField,
	}),
	z.object({
		action: z.literal("subscribe"),
		tier: z.enum(["plus", "gold", "platinum"]),
	}),
	z.object({ action: z.literal("cancel") }),
]);

const activeStock = sql`(${consumablesInventory.quantity} > 0)
  and (${consumablesInventory.expiresAt} is null or ${consumablesInventory.expiresAt} > now())`;

export const Route = createFileRoute("/api/wallet/")({
	server: {
		handlers: {
			GET: withSecurity(
				async ({ caller }) => {
					const user = requireCaller(caller);
					try {
						const [tier, balance, transactions, subscription, stock] =
							await Promise.all([
								currentTier(user.id),
								walletBalance(user.id),
								recentTransactions(user.id, 50),
								activeSubscription(user.id),
								db
									.select({
										type: consumablesInventory.type,
										quantity: sql<number>`coalesce(sum(${consumablesInventory.quantity}), 0)::int`,
									})
									.from(consumablesInventory)
									.where(
										and(eq(consumablesInventory.userId, user.id), activeStock),
									)
									.groupBy(consumablesInventory.type),
							]);

						const tiers = Object.fromEntries(
							TIER_ORDER.filter((key) => key !== "free").map((key) => [
								key,
								{
									name: tierName(key),
									price: tierPrice(key),
									perks: TIER_PERKS[key],
								},
							]),
						);

						return json(
							{
								wallet: {
									balance,
									currency: "bones",
									consumables: stock.map((row) => ({
										type: row.type,
										quantity: Number(row.quantity ?? 0),
									})),
									transactions,
									subscription: subscription
										? {
												tier: subscription.tier,
												status: subscription.status,
												current_period_end: subscription.current_period_end
													? new Date(
															subscription.current_period_end,
														).toISOString()
													: null,
											}
										: null,
								},
								shop: SHOP_ITEMS.map(({ type, label, cost, emoji, desc }) => ({
									type,
									label,
									cost,
									emoji,
									desc,
								})),
								tiers,
								currentTier: tier,
								// The screen does not render this, but a deployment must not be able to
								// imply that a purchase works when no provider is configured.
								paymentsConfigured: paymentsConfigured(),
							},
							{ cache: "private" },
						);
					} catch (error) {
						return unexpected("wallet/GET", error);
					}
				},
				{
					rateLimit: {
						limit: 120,
						key: ({ caller }) => `wallet:GET:${caller?.id ?? "anon"}`,
					},
				},
			),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const body = await readJson(request, actionSchema, 4 * 1024);

					try {
						switch (body.action) {
							case "daily": {
								const entry = await db.transaction((tx) =>
									postLedger(
										{
											userId: user.id,
											type: "daily",
											amount: DAILY_REWARD,
											description: "Daily reward",
											source: "daily-check-in",
											// A key, not a `description` match: two taps in the same
											// second used to both see "not claimed yet" and both pay.
											idempotencyKey: `daily:${user.id}:${new Date().toISOString().slice(0, 10)}`,
										},
										tx,
									),
								);
								if (!entry)
									return jsonError(
										"Already claimed today — come back tomorrow",
										409,
									);
								return json({
									ok: true,
									balance: entry.balance,
									amount: DAILY_REWARD,
								});
							}

							case "buy": {
								const item = findShopItem(body.type);
								if (!item) return jsonError("That item is not for sale", 400);

								const outcome = await db.transaction(async (tx) => {
									if (
										purchaseLimitReached(
											await purchaseCountLastHour(user.id, tx),
										)
									)
										return { limited: true } as const;

									const entry = await postLedger(
										{
											userId: user.id,
											type: "purchase",
											amount: -item.cost,
											description: item.label,
											source: `shop:${item.type}`,
											idempotencyKey: body.idempotencyKey,
										},
										tx,
									);
									// Same key as an earlier request: report it, charge nothing.
									if (!entry) return { duplicate: true } as const;

									const quantity = await upsertConsumable(
										{ userId: user.id, type: item.type, delta: 1 },
										tx,
									);
									return {
										balance: entry.balance,
										quantity,
										label: item.label,
									};
								});

								if ("limited" in outcome)
									return jsonError(
										"Too many purchases in the last hour. Try again shortly.",
										429,
									);
								if ("duplicate" in outcome)
									return json({
										ok: true,
										duplicate: true,
										note: "That purchase was already applied.",
									});

								return json({ ok: true, ...outcome, item: item.type });
							}

							case "topup": {
								const pack = findTopupPack(body.packId);
								if (!pack)
									return jsonError(
										`Unknown pack. Choose one of: ${Object.keys(TOPUP_PACKS).join(", ")}`,
										400,
									);
								if (!paymentsConfigured())
									return jsonError(PAYMENTS_UNAVAILABLE, 503);

								const entry = await postLedger({
									userId: user.id,
									type: "topup",
									amount: pack.bones,
									description: `Top-up ${pack.label}`,
									// Named so an audit of the ledger can see that no provider invoice
									// backed this credit.
									source: "dev-mode-topup",
									idempotencyKey: body.idempotencyKey,
								});
								if (!entry)
									return json({
										ok: true,
										duplicate: true,
										note: "That top-up was already applied.",
									});
								return json({
									ok: true,
									balance: entry.balance,
									amount: pack.bones,
									packId: pack.id,
									// The ledger row's own id: "receipt" has to mean a row someone can
									// find, not a string built from the clock.
									reference: entry.id,
								});
							}

							case "subscribe": {
								if (!paymentsConfigured())
									return jsonError(PAYMENTS_UNAVAILABLE, 503);

								const periodEnd = new Date();
								periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
								const boosts = monthlyBoostsFor(body.tier);

								await db.transaction(async (tx) => {
									await setTier(
										{
											userId: user.id,
											tier: body.tier,
											source: "dev-mode-grant",
											expiresAt: periodEnd,
										},
										tx,
									);
									// The perk is the product: Gold and Platinum pay for boosts, so the
									// same route that grants the tier puts them in the inventory.
									if (boosts > 0)
										await upsertConsumable(
											{ userId: user.id, type: "boost", delta: boosts },
											tx,
										);
								});

								return json({
									ok: true,
									tier: body.tier,
									renewsAt: periodEnd.toISOString(),
									monthlyBoosts: boosts,
									note: process.env.STRIPE_SECRET_KEY
										? undefined
										: "Granted by PAYMENTS_DEV_MODE. No payment was taken.",
								});
							}

							case "cancel": {
								await db.transaction((tx) =>
									setTier(
										{
											userId: user.id,
											tier: "free",
											source: "cancelled",
											expiresAt: null,
										},
										tx,
									),
								);
								return json({
									ok: true,
									tier: "free",
									note: "Cancelled. Paid features stop now; anything you bought stays in your inventory.",
								});
							}
						}
					} catch (error) {
						if (error instanceof InsufficientBalance)
							return jsonError(
								`Not enough bones for that — it costs ${error.cost}`,
								409,
							);
						return unexpected("wallet/POST", error);
					}
				},
				{
					maxBodySize: 4 * 1024,
					rateLimit: {
						limit: 30,
						windowMs: 60 * 60 * 1000,
						key: ({ caller }) => `wallet:POST:${caller?.id ?? "anon"}`,
					},
				},
			),

			// Declared so an unsupported verb is answered in JSON. Without these, a `PUT
			// /api/wallet` reached the SPA handler and returned `200 text/html`.
			PUT: methodNotAllowed("GET, POST"),
			PATCH: methodNotAllowed("GET, POST"),
			DELETE: methodNotAllowed("GET, POST"),
		},
	},
});
