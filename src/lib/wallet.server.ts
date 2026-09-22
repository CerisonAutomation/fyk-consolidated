import { and, eq, gte, sql } from "drizzle-orm";
import { type DbLike, db } from "@/db";
import {
	hoursAgo,
	isTier,
	PURCHASES_PER_HOUR,
	type Tier,
	tierRank,
} from "@/lib/economy";
import {
	consumablesInventory,
	premiumEntitlements,
	subscriptions,
	users,
	wallet,
	walletTransactions,
} from "@/schema";

/**
 * The wallet primitives every money-touching route shares.
 *
 * WHY THE ROUTES CANNOT JUST UPDATE `wallet.balance`
 * --------------------------------------------------
 * `0019_server_owned_economy.sql` made `wallet.balance` a *derived* column: a
 * trigger moves it from an insert into `wallet_transactions`, refuses a negative
 * result, and raises if anything writes `balance` directly. So the only way to
 * change a balance in this codebase is `postLedger()` below, which is what makes
 * "two writes that must both succeed" (debit + item grant) structurally
 * impossible to get wrong — the old client module did them as two independent
 * `await`s, which is how a failed item grant took someone's bones anyway.
 *
 * Errors are mapped to the vocabulary the screens already render, so nothing here
 * can produce a "success" the ledger disagrees with.
 */

export class InsufficientBalance extends Error {
	constructor(public readonly cost: number) {
		super("Not enough bones");
		this.name = "InsufficientBalance";
	}
}

/** Ledger row kinds. Each must be in `wallet_tx_type_check` (0019 §1b). */
export type LedgerType =
	| "daily"
	| "purchase"
	| "spend"
	| "gift"
	| "topup"
	| "bonus"
	| "refund"
	| "adventure"
	| "streak"
	| "subscription"
	| "adjustment";

export type WalletRowData = { id: string; balance: number; currency: string };

/** What a brand-new account starts with, as a `bonus` ledger row (0019). */
export const WELCOME_BONUS = 50;

/**
 * The account's wallet, created on first touch. `insert … on conflict do nothing`
 * because two tabs can read at the same moment; the unique index on `user_id`
 * makes the loser a no-op rather than a second wallet.
 */
export async function ensureWallet(
	userId: string,
	tx: DbLike = db,
): Promise<WalletRowData> {
	const [existing] = await tx
		.select({
			id: wallet.id,
			balance: wallet.balance,
			currency: wallet.currency,
		})
		.from(wallet)
		.where(eq(wallet.userId, userId))
		.limit(1);
	if (existing) return existing;

	const [created] = await tx
		.insert(wallet)
		.values({ userId, balance: 0 })
		.onConflictDoNothing({ target: wallet.userId })
		.returning({
			id: wallet.id,
			balance: wallet.balance,
			currency: wallet.currency,
		});
	if (created) {
		// The welcome balance is a ledger entry, not a number typed into the new
		// row: `balance` is derived from the ledger since 0019, and `sum(amount)`
		// has to equal it for every account, always.
		await tx.insert(walletTransactions).values({
			walletId: created.id,
			type: "bonus",
			amount: WELCOME_BONUS,
			description: "Welcome bonus",
			source: "wallet-created",
		});
		return { ...created, balance: Number(created.balance) + WELCOME_BONUS };
	}

	const [again] = await tx
		.select({
			id: wallet.id,
			balance: wallet.balance,
			currency: wallet.currency,
		})
		.from(wallet)
		.where(eq(wallet.userId, userId))
		.limit(1);
	if (!again) throw new Error(`wallet for ${userId} could not be created`);
	return again;
}

/**
 * Move money. `amount` is signed: positive credits, negative debits (0019 made
 * the ledger signed precisely so a caller cannot get the direction wrong).
 *
 * Returns the balance after the movement, or `null` when `idempotencyKey` had
 * already been seen — a retry is then a no-op that reports the original result,
 * never a second mint.
 */
export async function postLedger(
	params: {
		userId: string;
		type: LedgerType;
		amount: number;
		description: string;
		source?: string;
		idempotencyKey?: string;
	},
	tx: DbLike = db,
): Promise<{ balance: number; id: string } | null> {
	const { userId, type, amount, description, source, idempotencyKey } = params;
	if (!Number.isInteger(amount) || amount === 0) {
		throw new Error(
			`ledger amount must be a non-zero integer, got ${String(amount)}`,
		);
	}

	const w = await ensureWallet(userId, tx);

	if (idempotencyKey) {
		const [seen] = await tx
			.select({ id: walletTransactions.id })
			.from(walletTransactions)
			.where(
				and(
					eq(walletTransactions.walletId, w.id),
					eq(walletTransactions.idempotencyKey, idempotencyKey),
				),
			)
			.limit(1);
		if (seen) return null;
	}

	try {
		const [row] = await tx
			.insert(walletTransactions)
			.values({
				walletId: w.id,
				type,
				amount,
				description: description.slice(0, 500),
				source: source ?? "api",
				idempotencyKey: idempotencyKey ?? null,
			})
			.returning({ id: walletTransactions.id });

		const [after] = await tx
			.select({ balance: wallet.balance })
			.from(wallet)
			.where(eq(wallet.id, w.id))
			.limit(1);

		return { id: row.id, balance: Number(after?.balance ?? 0) };
	} catch (error) {
		const code = (error as { code?: string } | null)?.code;
		// The trigger raises with PL/pgSQL's generic `raise_exception` for a
		// negative balance and the partial unique index raises 23505 for a raced
		// retry. Both are expected outcomes with a user-facing meaning, so they
		// are translated here instead of becoming a 500.
		if (code === "P0001") throw new InsufficientBalance(Math.abs(amount));
		if (code === "23505" && idempotencyKey) return null;
		throw error;
	}
}

/** Balance without creating a wallet: an account with no ledger owns 0 bones. */
export async function walletBalance(
	userId: string,
	tx: DbLike = db,
): Promise<number> {
	const [row] = await tx
		.select({ balance: wallet.balance })
		.from(wallet)
		.where(eq(wallet.userId, userId))
		.limit(1);
	return Number(row?.balance ?? 0);
}

/** The last 50 movements, newest first, in the shape the premium screen draws. */
export async function recentTransactions(userId: string, limit = 50) {
	const w = await ensureWallet(userId);
	return await db
		.select({
			id: walletTransactions.id,
			type: walletTransactions.type,
			amount: walletTransactions.amount,
			description: walletTransactions.description,
			source: walletTransactions.source,
			created_at: walletTransactions.createdAt,
		})
		.from(walletTransactions)
		.where(eq(walletTransactions.walletId, w.id))
		.orderBy(sql`${walletTransactions.createdAt} desc`)
		.limit(Math.min(Math.max(limit, 1), 100));
}

/**
 * Purchases in the current rolling hour, counted from the ledger rather than a
 * client-supplied claim. `POST` routes call this inside their own transaction, so
 * the check and the write cannot be interleaved by a second request.
 */
export async function purchaseCountLastHour(
	userId: string,
	tx: DbLike = db,
): Promise<number> {
	const w = await ensureWallet(userId, tx);
	const [row] = await tx
		.select({ n: sql<number>`count(*)::int` })
		.from(walletTransactions)
		.where(
			and(
				eq(walletTransactions.walletId, w.id),
				gte(walletTransactions.createdAt, hoursAgo(new Date(), 1)),
				sql`${walletTransactions.amount} < 0`,
			),
		);
	return Number(row?.n ?? 0);
}

export function purchaseLimitReached(count: number): boolean {
	return count >= PURCHASES_PER_HOUR;
}

/* --------------------------------- privilege --------------------------------- */

/**
 * The tier an account actually has right now.
 *
 * `premium_entitlements` wins over `subscriptions` because they answer different
 * questions: a card that went `past_due` this morning has not expired the access
 * the customer paid for, and an expired entitlement must not keep granting it.
 * `users.tier` is the mirror the projection and the profile badge read.
 */
export async function currentTier(
	userId: string,
	tx: DbLike = db,
): Promise<Tier> {
	const [ent] = await tx
		.select({
			tier: premiumEntitlements.tier,
			expiresAt: premiumEntitlements.expiresAt,
		})
		.from(premiumEntitlements)
		.where(eq(premiumEntitlements.profileId, userId))
		.limit(1);

	if (ent?.tier && isTier(ent.tier)) {
		if (!ent.expiresAt || ent.expiresAt > new Date()) return ent.tier;
		return "free";
	}

	const [me] = await tx
		.select({ tier: users.tier })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);
	return isTier(me?.tier) ? me.tier : "free";
}

export function hasAccess(actual: Tier, required: Tier): boolean {
	return tierRank(actual) >= tierRank(required);
}

/**
 * Grant or revoke a tier, in one transaction. Writes the entitlement (the truth),
 * the provider record (`subscriptions`, whose `status` becomes `superseded` for
 * the rows it replaces) and the `users.tier` mirror that the profile projection
 * and the badge read. A route must never call this with a tier the payment for has
 * not been confirmed — which is why `POST /api/wallet {action:'subscribe'}` checks
 * `paymentsConfigured()` first.
 */
export async function setTier(
	params: {
		userId: string;
		tier: Tier;
		source: string;
		expiresAt: Date | null;
	},
	tx: DbLike = db,
): Promise<void> {
	const { userId, tier, source, expiresAt } = params;
	await tx
		.insert(premiumEntitlements)
		.values({
			profileId: userId,
			tier,
			source,
			expiresAt,
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: premiumEntitlements.profileId,
			set: { tier, source, expiresAt, updatedAt: new Date() },
		});

	// `superseded` is what the old client module wrote, and the database has
	// never accepted it: `subscriptions_status_check` (0013) allows
	// active/cancelled/past_due/trialing/expired, so that UPDATE failed with 23514
	// and every "renew" left the previous subscription active beside the new one.
	await tx
		.update(subscriptions)
		.set({ status: "expired", updatedAt: new Date() })
		.where(
			and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")),
		);

	if (tier !== "free") {
		await tx.insert(subscriptions).values({
			userId,
			tier,
			status: "active",
			currentPeriodEnd: expiresAt,
		});
	}

	await tx
		.update(users)
		.set({ tier, updatedAt: new Date() })
		.where(eq(users.id, userId));
}

/** The provider-side record, for the screen's "renews on …" line. */
export async function activeSubscription(userId: string, tx: DbLike = db) {
	const [row] = await tx
		.select({
			tier: subscriptions.tier,
			status: subscriptions.status,
			current_period_end: subscriptions.currentPeriodEnd,
		})
		.from(subscriptions)
		.where(
			and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")),
		)
		.orderBy(sql`${subscriptions.createdAt} desc`)
		.limit(1);
	return row ?? null;
}

/**
 * Add (or spend) units of a shop item, returning the quantity afterwards.
 *
 * `delta` may be negative; the row is never allowed to go below zero, and the
 * `UPDATE … WHERE quantity >= -delta` guard means a spend that races with another
 * spend fails as "not enough" instead of over-drawing. Both `buy` (shop) and the
 * tier-boost grant (subscribe) go through here, so the inventory and the ledger
 * can never disagree about what was paid for.
 */
export async function upsertConsumable(
	params: { userId: string; type: string; delta: number },
	tx: DbLike = db,
): Promise<number> {
	const { userId, type, delta } = params;
	if (!Number.isInteger(delta) || delta === 0)
		throw new Error(
			`consumable delta must be a non-zero integer, got ${String(delta)}`,
		);

	const [existing] = await tx
		.select({
			id: consumablesInventory.id,
			quantity: consumablesInventory.quantity,
		})
		.from(consumablesInventory)
		.where(
			and(
				eq(consumablesInventory.userId, userId),
				eq(consumablesInventory.type, type),
				sql`${consumablesInventory.expiresAt} is null or ${consumablesInventory.expiresAt} > now()`,
			),
		)
		.orderBy(sql`${consumablesInventory.createdAt} desc`)
		.limit(1);

	if (delta > 0) {
		if (existing) {
			await tx
				.update(consumablesInventory)
				.set({ quantity: Number(existing.quantity ?? 0) + delta })
				.where(eq(consumablesInventory.id, existing.id));
			return Number(existing.quantity ?? 0) + delta;
		}
		await tx
			.insert(consumablesInventory)
			.values({ userId, type, quantity: delta });
		return delta;
	}

	if (!existing) return 0;
	const [updated] = await tx
		.update(consumablesInventory)
		.set({ quantity: Number(existing.quantity ?? 0) + delta })
		.where(
			and(
				eq(consumablesInventory.id, existing.id),
				sql`${consumablesInventory.quantity} >= ${-delta}`,
			),
		)
		.returning({ quantity: consumablesInventory.quantity });
	if (!updated) return 0;
	// An emptied row is deleted rather than left at 0: `GET /api/wallet` filters
	// on `quantity > 0`, and 0-rows accumulated into a table that grows forever.
	if (Number(updated.quantity) <= 0) {
		await tx
			.delete(consumablesInventory)
			.where(eq(consumablesInventory.id, existing.id));
		return 0;
	}
	return Number(updated.quantity);
}
