import { api } from "@/lib/client";

/**
 * The premium screen's API client: bones, the shop, the membership.
 *
 * WHY THIS FILE IS THREE FUNCTIONS AND NOT A QUERY LAYER
 * ------------------------------------------------------
 * It replaces `src/integrations/supabase/wallet.ts` (475 lines), which was the
 * browser acting as the payments system: it set `wallet.balance` directly, wrote
 * `premium_entitlements` rows to grant itself Premium, invented a receipt id from
 * `Date.now()`, and called `client.rpc('wallet_credit_and_log')` — a Postgres
 * function no migration ever created, whose guaranteed failure was answered with
 * a fallback that wrote the balance by hand.
 *
 * The functions keep the old exported names so `premium-client.tsx` changed only
 * where it stopped being the authority. Everything it renders — prices, the tier
 * ladder, the daily amount, whether a top-up is even possible — comes from
 * `GET /api/wallet`, which reads it from `#/lib/economy` and the database.
 */

export type WalletTransaction = {
	id: string;
	type: string;
	/** Signed: positive credits, negative debits (0019). */
	amount: number;
	description: string;
	source: string;
	created_at: string;
};

export type WalletPayload = {
	wallet: {
		balance: number;
		currency: string;
		consumables: { type: string; quantity: number }[];
		transactions: WalletTransaction[];
		subscription: {
			tier: string;
			status: string;
			current_period_end: string | null;
		} | null;
	};
	shop: {
		type: string;
		label: string;
		cost: number;
		emoji: string;
		desc: string;
	}[];
	tiers: Record<string, { name: string; price: number; perks: string[] }>;
	currentTier: string;
	paymentsConfigured: boolean;
};

export type WalletAction =
	| { action: "daily" }
	| { action: "buy"; type: string; idempotencyKey?: string }
	| { action: "topup"; packId: string; idempotencyKey?: string }
	| { action: "subscribe"; tier: "plus" | "gold" | "platinum" }
	| { action: "cancel" };

export function loadWalletData(): Promise<WalletPayload> {
	return api<WalletPayload>("/api/wallet");
}

/**
 * A spend or a claim. The server's error message is the message the screen shows:
 * `api()` throws `ApiError(status, message)`, so "Already claimed today" and "Not
 * enough bones for that — it costs 120" arrive as real failures instead of a toast
 * that says success over a row the database rejected.
 */
export function performWalletAction(
	action: WalletAction,
): Promise<Record<string, unknown> & { ok: boolean }> {
	return api("/api/wallet", { method: "POST", body: action });
}

/**
 * One boost, spent from the inventory. `#/lib/store.ts` used to fire the old
 * `/api/boost` on a timer and swallow the rejection; the button in the shop calls
 * this and shows what came back.
 */
export function spendBoost(): Promise<{
	ok: boolean;
	expiresAt: string;
	boostsLeft: number;
	minutes: number;
}> {
	return api("/api/boost", { method: "POST", body: {} });
}
