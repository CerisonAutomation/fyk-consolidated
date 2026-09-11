// ═══════════════════════════════════════════════════════════════════════════════
// Economy — Wallet Management
// ═══════════════════════════════════════════════════════════════════════════════

import type { PrismaClient } from "../../generated/prisma/client.js";
import { getShopItem } from "./shop.js";
import {
	SUBSCRIPTION_TIERS,
	type SubscriptionTierId,
} from "./subscriptions.js";

const INITIAL_BONES = 50;
const DAILY_REWARD_AMOUNT = 15;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WalletWithDetails {
	balance: number;
	lifetime: number;
	transactions: Array<{
		id: string;
		type: string;
		amount: number;
		balance: number;
		description: string;
		createdAt: Date;
	}>;
	consumables: Array<{
		itemKey: string;
		quantity: number;
		expiresAt: Date | null;
	}>;
	subscription: {
		plan: string;
		tier: string;
		status: string;
		expiresAt: Date | null;
	} | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStart(): Date {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Ensures a wallet exists for the user. Creates one with 50 bones if none exists.
 */
export async function ensureWallet(
	db: PrismaClient,
	userId: string,
): Promise<{ id: string; balance: number; lifetime: number }> {
	const existing = await db.wallet.findUnique({ where: { userId } });
	if (existing) return existing;

	return db.wallet.create({
		data: {
			userId,
			balance: INITIAL_BONES,
			lifetime: INITIAL_BONES,
		},
	});
}

/**
 * Returns the full wallet with transactions, consumables, and subscription.
 */
export async function getWallet(
	db: PrismaClient,
	userId: string,
): Promise<WalletWithDetails> {
	const wallet = await ensureWallet(db, userId);

	const [transactions, consumables, subscription] = await Promise.all([
		db.walletTransaction.findMany({
			where: { walletId: wallet.id },
			orderBy: { createdAt: "desc" },
			take: 50,
		}),
		db.consumablesInventory.findMany({
			where: { userId },
		}),
		db.subscription.findFirst({
			where: { userId, status: "active" },
			orderBy: { createdAt: "desc" },
		}),
	]);

	return {
		balance: wallet.balance,
		lifetime: wallet.lifetime,
		transactions: transactions.map((tx) => ({
			id: tx.id,
			type: tx.type,
			amount: tx.amount,
			balance: tx.balance,
			description: tx.description,
			createdAt: tx.createdAt,
		})),
		consumables: consumables.map((c) => ({
			itemKey: c.itemKey,
			quantity: c.quantity,
			expiresAt: c.expiresAt,
		})),
		subscription: subscription
			? {
					plan: subscription.plan,
					tier: subscription.tier,
					status: subscription.status,
					expiresAt: subscription.expiresAt,
				}
			: null,
	};
}

/**
 * Buys an item from the shop. Deducts bones and adds to consumables inventory.
 */
export async function buyItem(
	db: PrismaClient,
	userId: string,
	itemId: string,
): Promise<{ success: boolean; balance: number; error?: string }> {
	const item = getShopItem(itemId);
	if (!item) {
		return { success: false, balance: 0, error: "Item not found" };
	}

	const wallet = await ensureWallet(db, userId);

	if (wallet.balance < item.price) {
		return {
			success: false,
			balance: wallet.balance,
			error: "Insufficient bones",
		};
	}

	const newBalance = wallet.balance - item.price;

	const [, transaction] = await db.$transaction([
		db.wallet.update({
			where: { id: wallet.id },
			data: { balance: newBalance },
		}),
		db.walletTransaction.create({
			data: {
				walletId: wallet.id,
				userId,
				type: "spend",
				amount: -item.price,
				balance: newBalance,
				description: `Purchased ${item.name}`,
				referenceId: itemId,
			},
		}),
		db.consumablesInventory.upsert({
			where: { userId_itemKey: { userId, itemKey: itemId } },
			create: { userId, itemKey: itemId, quantity: 1 },
			update: { quantity: { increment: 1 } },
		}),
	]);

	return { success: true, balance: transaction.balance };
}

/**
 * Claims the daily reward of 15 bones if not already claimed today.
 */
export async function dailyReward(
	db: PrismaClient,
	userId: string,
): Promise<{ success: boolean; balance: number; error?: string }> {
	const wallet = await ensureWallet(db, userId);
	const dayStart = todayStart();

	const existingClaim = await db.walletTransaction.findFirst({
		where: {
			walletId: wallet.id,
			type: "bonus",
			description: "Daily reward",
			createdAt: { gte: dayStart },
		},
	});

	if (existingClaim) {
		return {
			success: false,
			balance: wallet.balance,
			error: "Already claimed today",
		};
	}

	const newBalance = wallet.balance + DAILY_REWARD_AMOUNT;

	const [, transaction] = await db.$transaction([
		db.wallet.update({
			where: { id: wallet.id },
			data: {
				balance: newBalance,
				lifetime: { increment: DAILY_REWARD_AMOUNT },
			},
		}),
		db.walletTransaction.create({
			data: {
				walletId: wallet.id,
				userId,
				type: "bonus",
				amount: DAILY_REWARD_AMOUNT,
				balance: newBalance,
				description: "Daily reward",
			},
		}),
	]);

	return { success: true, balance: transaction.balance };
}

/**
 * Adds bones to the wallet (e.g. from in-app purchase).
 */
export async function topup(
	db: PrismaClient,
	userId: string,
	amount: number,
): Promise<{ success: boolean; balance: number; error?: string }> {
	if (amount <= 0) {
		return { success: false, balance: 0, error: "Amount must be positive" };
	}

	const wallet = await ensureWallet(db, userId);
	const newBalance = wallet.balance + amount;

	const [, transaction] = await db.$transaction([
		db.wallet.update({
			where: { id: wallet.id },
			data: {
				balance: newBalance,
				lifetime: { increment: amount },
			},
		}),
		db.walletTransaction.create({
			data: {
				walletId: wallet.id,
				userId,
				type: "purchase",
				amount,
				balance: newBalance,
				description: `Top-up of ${amount} bones`,
			},
		}),
	]);

	return { success: true, balance: transaction.balance };
}

/**
 * Creates or updates a subscription for the given tier.
 */
export async function subscribe(
	db: PrismaClient,
	userId: string,
	tier: SubscriptionTierId,
): Promise<{ success: boolean; subscription: { plan: string; tier: string; status: string }; error?: string }> {
	const tierDef = SUBSCRIPTION_TIERS[tier];
	if (!tierDef || tier === "free") {
		return { success: false, subscription: { plan: "free", tier: "free", status: "active" }, error: "Invalid tier" };
	}

	// Deactivate any existing active subscriptions
	await db.subscription.updateMany({
		where: { userId, status: "active" },
		data: { status: "superseded" },
	});

	const expiresAt = new Date();
	expiresAt.setMonth(expiresAt.getMonth() + 1);

	const subscription = await db.subscription.create({
		data: {
			userId,
			plan: tier,
			tier,
			status: "active",
			expiresAt,
		},
	});

	// Update user tier
	await db.user.update({
		where: { id: userId },
		data: {
			tier,
			premiumTier: tier,
			isPremium: true,
		},
	});

	return {
		success: true,
		subscription: {
			plan: subscription.plan,
			tier: subscription.tier,
			status: subscription.status,
		},
	};
}

/**
 * Cancels the active subscription and resets the user tier to free.
 */
export async function cancelSubscription(
	db: PrismaClient,
	userId: string,
): Promise<{ success: boolean; error?: string }> {
	const subscription = await db.subscription.findFirst({
		where: { userId, status: "active" },
	});

	if (!subscription) {
		return { success: false, error: "No active subscription" };
	}

	await db.$transaction([
		db.subscription.update({
			where: { id: subscription.id },
			data: {
				status: "canceled",
				canceledAt: new Date(),
				autoRenew: false,
			},
		}),
		db.user.update({
			where: { id: userId },
			data: {
				tier: "free",
				premiumTier: "none",
				isPremium: false,
			},
		}),
	]);

	return { success: true };
}
