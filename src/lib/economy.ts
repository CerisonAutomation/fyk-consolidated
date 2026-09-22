import { TIERS } from "@/lib/constants";

/**
 * The server's side of the economy: what things cost, what a tier means, and how
 * the pet's progression is computed.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `src/integrations/supabase/wallet.ts` (475 lines, imported by the premium
 * screen) and `king-pet.ts` (380) held the prices, the daily reward, the tier perks and
 * the level curve *in the browser bundle*. That is not only a security problem —
 * `insert into wallet_transactions (amount: 999999)` was one `curl` away from a
 * rich account — it was also dead code: `0013_production_patterns.sql` had
 * `wallet_transactions.type CHECK (type in ('earn','spend',…))` while that module
 * wrote `'credit'`/`'debit'`, so every ledger row those screens "wrote" was
 * rejected by the database and the result was never checked.
 *
 * So this module is the authority the API routes use, and the browser gets
 * numbers back from `GET /api/wallet` instead of deciding them. Prices are read
 * from `#/lib/constants` (`TIERS`) where a tier is concerned, so the marketing
 * copy on `/premium` and the charge cannot drift apart.
 *
 * Everything here is pure and unit-tested (`economy.test.ts`); the SQL lives in
 * the routes and in `0019_server_owned_economy.sql`.
 */

/* --------------------------------- currency --------------------------------- */

export const BONES = "bones";

/** What the daily check-in pays. Deliberately small: it is a habit, not income. */
export const DAILY_REWARD = 15;

/**
 * Purchases allowed per rolling hour. The old client constant (`10`) was applied
 * by counting its own `wallet_transactions` rows *before* writing, which is a
 * race; here the count is taken inside the same transaction as the write, so it
 * is the same rule with a real guarantee.
 */
export const PURCHASES_PER_HOUR = 10;

/* ----------------------------------- shop ----------------------------------- */

export type ShopItem = {
	/** The `consumables_inventory.type` value the item grants. */
	type: string;
	label: string;
	cost: number;
	emoji: string;
	desc: string;
	/**
	 * Which route redeems one unit of this item. A shop entry without a redeemer
	 * is a charge with no product, and the test below fails the build if one is
	 * added — the reason `tap_boost`, `super_like`, `profile_spotlight`,
	 * `read_receipt` and `incognito` are not for sale even though the table can
	 * store them (see AUDIT.md §2.13).
	 */
	redeemedBy: string;
};

/**
 * The catalogue. The client is never told a price it may choose to ignore.
 *
 * It contains exactly one row, and that is the honest size: a shop entry is a
 * charge, so it may only exist when some route *redeems* what it sold.
 * `src/integrations/supabase/wallet.ts` sold five items — `tap_boost`, `boost`,
 * and three gifts. Of those, `boost` was the only one any code consumed
 * (`POST /api/boost` decrements one `consumables_inventory` row), `tap_boost` was
 * a duplicate of it with a different name, and the gifts had no sender UI at all:
 * `grep -rn "gift" src/components` found nothing outside this screen. The bones
 * left the wallet (`wallet.balance` was set directly) and no item arrived, because
 * the insert into `consumables_inventory` was rejected by `consumables_type_check`
 * (0013) and its error was never read.
 *
 * `super_like`, `profile_spotlight`, `read_receipt` and `incognito` stay valid
 * values of `consumables_inventory.type` — a database created before this
 * migration may hold them — and are not for sale until a route redeems them.
 */
export const SHOP_ITEMS: readonly ShopItem[] = [
	{
		type: "boost",
		label: "Profile Boost",
		cost: 120,
		emoji: "\u26A1",
		desc: "Top of the grid for 60 minutes",
		redeemedBy: "POST /api/boost",
	},
] as const;

export function findShopItem(type: unknown): ShopItem | undefined {
	if (typeof type !== "string") return undefined;
	return SHOP_ITEMS.find((item) => item.type === type);
}

/**
 * Top-up packs. Arbitrary amounts are refused on purpose: a client that can pick
 * its own number can pick `1000000`. A real payment provider invoice is what
 * turns a pack into money, and until one is configured `POST /api/wallet
 * {action:'topup'}` does not credit anything (see `paymentsConfigured`).
 */
export const TOPUP_PACKS: Readonly<
	Record<string, { bones: number; label: string }>
> = {
	pack_100: { bones: 100, label: "100 bones" },
	pack_500: { bones: 500, label: "500 bones" },
	pack_1000: { bones: 1000, label: "1000 bones" },
};

export function findTopupPack(id: unknown) {
	if (typeof id !== "string") return undefined;
	const pack = TOPUP_PACKS[id as keyof typeof TOPUP_PACKS];
	return pack ? { id, ...pack } : undefined;
}

/* ---------------------------------- premium ---------------------------------- */

/** The order the ladder in `/premium` and `/gamechangers` uses. */
export const TIER_ORDER = ["free", "plus", "gold", "platinum"] as const;
export type Tier = (typeof TIER_ORDER)[number];

/** Tiers the shop can sell. `free` is what you fall back to, never bought. */
export const SELLABLE_TIERS = TIER_ORDER.slice(1) as Exclude<Tier, "free">[];

export function isTier(value: unknown): value is Tier {
	return (
		typeof value === "string" &&
		(TIER_ORDER as readonly string[]).includes(value)
	);
}

export function tierRank(tier: unknown): number {
	const index = TIER_ORDER.indexOf(isTier(tier) ? tier : "free");
	return index < 0 ? 0 : index;
}

/** Anything above `free` unlocks the paid surface. */
export function isPaidTier(tier: unknown): boolean {
	return tierRank(tier) > 0;
}

/**
 * Perks, per tier — and every line here is something a route enforces, because a
 * perk list is a promise the database either keeps or breaks. The previous copy
 * advertised "48 AI features", "No ads", "Video calls", "Priority support" and
 * "Travel mode" for an app that has no ads, no video calls and no support queue.
 *
 * What is enforced, and where:
 *   - `50 taps a day`  — `POST /api/taps` counts today's taps for a `free` tier.
 *   - `Unlimited taps` — the same check, skipped for tier >= plus.
 *   - The visitors list (`GET /api/interest/{tab}` with `tab=visitors`) is *not*
 *     a perk: every account can see it, so `TIER_PERKS` does not claim it. The
 *     previous copy sold "Who viewed you", "48 AI features", "Video calls", "No
 *     ads", "Travel mode" and "Priority support" to an app with no ad slot, no
 *     call UI and no support queue.
 *   - `N boosts every month` — `POST /api/wallet {action:'subscribe'}` grants that
 *     many `consumables_inventory` rows, which `POST /api/boost` spends.
 */
export const TIER_PERKS: Record<Tier, readonly string[]> = {
	free: ["50 taps a day", "Discover and chat", "King Pet"],
	plus: ["Unlimited taps"],
	gold: ["Everything in Plus", "2 boosts every month"],
	platinum: ["Everything in Gold", "10 boosts every month"],
};

/** Free accounts get this many taps per UTC day; paid accounts are unlimited. */
export const DAILY_TAP_LIMIT_FREE = 50;

export function tapLimitFor(tier: unknown): number {
	return isPaidTier(tier) ? Number.POSITIVE_INFINITY : DAILY_TAP_LIMIT_FREE;
}

/** Boosters granted when a subscription starts or renews, per tier per month. */
export const MONTHLY_BOOSTS: Record<Tier, number> = {
	free: 0,
	plus: 0,
	gold: 2,
	platinum: 10,
};

/** Display name, from the same `TIERS` table the price comes from. */
export function tierName(tier: Tier): string {
	const entry = (TIERS as Record<string, { name?: string } | undefined>)[tier];
	return (
		entry?.name ??
		(tier === "free" ? "Free" : tier[0].toUpperCase() + tier.slice(1))
	);
}

/** Boosters a subscription grants per month. `0` means the tier sells no boosts. */
export function monthlyBoostsFor(tier: Tier): number {
	return MONTHLY_BOOSTS[tier] ?? 0;
}

/** Monthly price, straight from `#/lib/constants`, so copy and charge agree. */
export function tierPrice(tier: Tier): number {
	const entry = (TIERS as Record<string, { price?: number } | undefined>)[tier];
	if (tier === "free") return 0;
	const price = entry?.price;
	return typeof price === "number" && Number.isFinite(price) && price > 0
		? price
		: 0;
}

/**
 * `PAYMENTS_DEV_MODE` is the only way money or privilege is granted without a
 * payment provider, and it is deliberately *not* `DEV_MODE`: a preview deploy that
 * sets `DEV_MODE=1` for logging must not become a Premium generator.
 */
export function paymentsConfigured(
	env: Record<string, string | undefined> = process.env,
) {
	return env.PAYMENTS_DEV_MODE === "1" || Boolean(env.STRIPE_SECRET_KEY);
}

/**
 * The honest answer when someone asks to buy what no provider can sell yet. It is
 * a 503 with a real reason, never a success — the app used to hand out
 * `source: 'mock_payment'` entitlements and print a receipt id built from
 * `Date.now()`, which is the definition of a stub that lies.
 */
export const PAYMENTS_UNAVAILABLE =
	"Checkout is not configured on this deployment, so no payment can be taken and nothing was charged.";

/* ------------------------------- date helpers ------------------------------- */

/**
 * The calendar day a daily reward is tied to. UTC, not the server's timezone: a
 * reward that rolls over at a time that depends on which pod answered is a reward
 * users can farm by retrying.
 */
export function dayKey(now: Date = new Date()): string {
	return now.toISOString().slice(0, 10);
}

export function dailyIdempotencyKey(
	userId: string,
	now: Date = new Date(),
): string {
	return `daily:${userId}:${dayKey(now)}`;
}

/** Start of the current UTC day, for "how many in the last 24h" style limits. */
export function hoursAgo(from: Date, hours: number): Date {
	return new Date(from.getTime() - hours * 60 * 60 * 1000);
}

/* ---------------------------------- king pet --------------------------------- */

/**
 * Pet progression. The client module computed XP, level, stage and streak in the
 * browser and then wrote the result to `king_pet`; `0019` refused that, and these
 * functions are what the API uses instead. Same numbers as before, so the screen
 * behaves the way it always appeared to — but now a second tap within the
 * cooldown earns nothing.
 */
export const PET_ACTIONS = {
	feed: { xp: 20, mood: "happy", cooldownMinutes: 60 },
	play: { xp: 25, mood: "excited", cooldownMinutes: 60 },
	rest: { xp: 10, mood: "sleepy", cooldownMinutes: 120 },
	dress: { xp: 15, mood: "excited", cooldownMinutes: 0 },
} as const;

export type PetActionName = keyof typeof PET_ACTIONS;

export const PET_MOODS = [
	"happy",
	"sad",
	"hungry",
	"playful",
	"sleepy",
	"excited",
] as const;

/** `king_pet.mood` is CHECKed against this list (0013); nothing else may be stored. */
export function isPetMood(value: unknown): value is (typeof PET_MOODS)[number] {
	return (
		typeof value === "string" &&
		(PET_MOODS as readonly string[]).includes(value)
	);
}

export const PET_STAGES = ["baby", "juvenile", "adult", "elder"] as const;

/**
 * The level each stage unlocks at. `elder` exists in `king_pet_stage_check`
 * (0013) but the curve in the old client module never reached it, so the top
 * stage was unreachable in practice; it is kept, at a level the XP curve can get
 * to. One table for both directions, so a stage requirement in the shop and the
 * stage a player reaches can never disagree.
 */
export const LEVEL_FOR_STAGE: Record<(typeof PET_STAGES)[number], number> = {
	baby: 1,
	juvenile: 4,
	adult: 10,
	elder: 16,
};

/** The level a stage unlocks at — the inverse of `stageForLevel`, one table. */
export function levelForStage(stage: string): number {
	return (
		LEVEL_FOR_STAGE[stage as (typeof PET_STAGES)[number]] ??
		LEVEL_FOR_STAGE.baby
	);
}

/** `king_pet.stage` is CHECKed against this list (0013). */
export function stageForLevel(level: number): (typeof PET_STAGES)[number] {
	const safe = Number.isFinite(level) ? level : 1;
	let stage: (typeof PET_STAGES)[number] = "baby";
	for (const candidate of PET_STAGES) {
		if (safe >= LEVEL_FOR_STAGE[candidate]) stage = candidate;
	}
	return stage;
}

export function xpForNextLevel(level: number): number {
	return Math.max(1, level) * 100;
}

/**
 * Apply an XP gain and return the level-ups it caused. The old client applied at
 * most one level per action, so a 400-XP adventure landed as "level 2".
 */
export function applyExperience(
	level: number,
	experience: number,
): { level: number; experience: number; stage: string; leveledUp: boolean } {
	let nextLevel = Math.max(1, level);
	let budget = Math.max(0, experience);
	let leveledUp = false;
	while (budget >= xpForNextLevel(nextLevel)) {
		budget -= xpForNextLevel(nextLevel);
		nextLevel += 1;
		leveledUp = true;
	}
	return {
		level: nextLevel,
		experience: budget,
		stage: stageForLevel(nextLevel),
		leveledUp,
	};
}

/**
 * Streak in days, counted on the calendar rather than the click counter (the
 * client incremented it once per `feed`, so "7-day streak" meant "tapped feed
 * seven times in a row"). `daysSinceLast` comes from `king_pet.last_fed_at`.
 */
export function streakFor(prevStreak: number, daysSinceLast: number): number {
	if (daysSinceLast <= 0) return Math.max(1, prevStreak);
	if (daysSinceLast === 1) return Math.max(1, prevStreak) + 1;
	return 1;
}

/** Whole days between two UTC calendar days; negative and zero both mean "today". */
export function daysBetweenUtcDays(earlier: Date, later: Date): number {
	const a = Date.parse(`${earlier.toISOString().slice(0, 10)}T00:00:00Z`);
	const b = Date.parse(`${later.toISOString().slice(0, 10)}T00:00:00Z`);
	if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
	return Math.floor((b - a) / 86_400_000);
}

/** Cooldown check for a pet action; returns the wait left, in minutes. */
export function cooldownLeft(
	last: Date | null,
	cooldownMinutes: number,
	now: Date = new Date(),
): number {
	if (cooldownMinutes <= 0 || !last) return 0;
	const readyAt = last.getTime() + cooldownMinutes * 60_000;
	return Math.max(0, Math.ceil((readyAt - now.getTime()) / 60_000));
}

/** Mood log entries are capped: `mood_log` is a jsonb column, not a history table. */
export const MOOD_LOG_LIMIT = 30;

export function pushMoodLog<T>(log: readonly T[], entry: T): T[] {
	const next = [...log, entry];
	return next.length > MOOD_LOG_LIMIT
		? next.slice(next.length - MOOD_LOG_LIMIT)
		: next;
}
