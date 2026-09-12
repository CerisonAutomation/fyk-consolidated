import { describe, expect, it } from "vitest";
import {
	DAILY_REWARD,
	DAILY_TAP_LIMIT_FREE,
	MONTHLY_BOOSTS,
	PET_ACTIONS,
	PET_MOODS,
	PET_STAGES,
	SHOP_ITEMS,
	TIER_ORDER,
	TIER_PERKS,
	TOPUP_PACKS,
	applyExperience,
	cooldownLeft,
	daysBetweenUtcDays,
	findShopItem,
	findTopupPack,
	isPetMood,
	isTier,
	levelForStage,
	monthlyBoostsFor,
	pushMoodLog,
	stageForLevel,
	streakFor,
	tapLimitFor,
	tierPrice,
} from "#/lib/economy";

/**
 * These are the invariants the deleted browser module could not keep, written as
 * tests so they cannot silently come apart again. Several of them encode a
 * database CHECK from `supabase/migrations` on purpose: the last time the
 * catalogue and the constraint disagreed (`wallet_tx_type_check`,
 * `consumables_type_check`, `notifications_type_check`, `subscriptions_tier_check`)
 * the product kept charging people for rows the database refused.
 */

describe("the shop only sells what a route redeems", () => {
	/** `0019` §1b: `consumables_inventory.type` CHECK list. */
	const DB_CONSUMABLE_TYPES = [
		"boost",
		"super_like",
		"profile_spotlight",
		"read_receipt",
		"incognito",
		"gift_heart",
		"gift_fire",
		"gift_star",
	];

	it("grants a type the database accepts", () => {
		for (const item of SHOP_ITEMS) {
			expect(DB_CONSUMABLE_TYPES).toContain(item.type);
		}
	});

	it("names a redeeming route for every item", () => {
		for (const item of SHOP_ITEMS) {
			expect(item.redeemedBy).toMatch(/^POST \/api\//);
			expect(item.cost).toBeGreaterThan(0);
			expect(Number.isInteger(item.cost)).toBe(true);
		}
	});

	it("is the same list the buy action accepts", () => {
		const ids = SHOP_ITEMS.map((item) => item.type);
		expect(findShopItem("boost")).toBeDefined();
		// `tap_boost` was sold without a redeemer and is gone, not renamed.
		expect(findShopItem("tap_boost")).toBeUndefined();
		expect(findShopItem("gift_heart")).toBeUndefined();
		expect(ids).toEqual(["boost"]);
	});
});

describe("top-ups", () => {
	it("resolves only known packs, and never an arbitrary amount", () => {
		expect(findTopupPack("pack_500")).toEqual({
			id: "pack_500",
			bones: 500,
			label: "500 bones",
		});
		expect(findTopupPack("pack_999999999")).toBeUndefined();
		expect(findTopupPack(undefined)).toBeUndefined();
		expect(findTopupPack("")).toBeUndefined();
	});

	it("keeps every pack a positive integer", () => {
		for (const pack of Object.values(TOPUP_PACKS)) {
			expect(Number.isInteger(pack.bones)).toBe(true);
			expect(pack.bones).toBeGreaterThan(0);
		}
	});
});

describe("tiers", () => {
	/** `0019` §1b: `premium_entitlements_tier_check` / `subscriptions_tier_check`. */
	const DB_TIER_VALUES = ["free", "plus", "gold", "platinum"];

	it("sells exactly what the database can store", () => {
		for (const tier of TIER_ORDER) expect(DB_TIER_VALUES).toContain(tier);
		expect(TIER_ORDER).toEqual(DB_TIER_VALUES);
	});

	it("ranks the ladder the screens sort on", () => {
		expect(tapLimitFor("free")).toBe(DAILY_TAP_LIMIT_FREE);
		expect(tapLimitFor("plus")).toBe(Number.POSITIVE_INFINITY);
		expect(tapLimitFor("gold")).toBe(Number.POSITIVE_INFINITY);
		expect(tapLimitFor(undefined)).toBe(DAILY_TAP_LIMIT_FREE);
		expect(isTier("diamond")).toBe(false);
	});

	it("prices tiers from the shared catalogue, not from copy", () => {
		expect(tierPrice("free")).toBe(0);
		for (const tier of TIER_ORDER.filter((t) => t !== "free")) {
			expect(tierPrice(tier)).toBeGreaterThan(0);
		}
	});

	it("only promises perks it can enforce", () => {
		const enforced = new Set([
			"50 taps a day",
			"Discover and chat",
			"King Pet",
			"Unlimited taps",
			"Everything in Plus",
			"Everything in Gold",
			/^(\d+) boosts every month$/,
		]);
		for (const [tier, perks] of Object.entries(TIER_PERKS)) {
			for (const perk of perks) {
				const ok = [...enforced].some((rule) =>
					typeof rule === "string" ? rule === perk : rule.test(perk),
				);
				expect(ok, `${tier} advertises "${perk}", which nothing enforces`).toBe(true);
			}
		}
	});

	it("grants exactly the boosts the perk line promises", () => {
		for (const tier of TIER_ORDER) {
			const promised = TIER_PERKS[tier].find((perk) => perk.includes("boosts every month"));
			const number = Number(promised?.match(/^(\d+)/)?.[1] ?? 0);
			expect(monthlyBoostsFor(tier)).toBe(number);
			expect(MONTHLY_BOOSTS[tier]).toBe(number);
		}
	});
});

describe("the pet's progression", () => {
	it("rewards what the copy on the buttons says", () => {
		expect(PET_ACTIONS.feed.xp).toBe(20);
		expect(PET_ACTIONS.play.xp).toBe(25);
		expect(PET_ACTIONS.rest.xp).toBe(10);
		expect(PET_ACTIONS.dress.xp).toBe(15);
	});

	it("keeps every mood inside king_pet_mood_check (0013)", () => {
		for (const action of Object.values(PET_ACTIONS)) {
			expect(isPetMood(action.mood), `${action.mood} is not a CHECKed mood`).toBe(true);
		}
		for (const mood of ["playful", "sad", "hungry", "excited", "happy", "sleepy"]) {
			expect(PET_MOODS).toContain(mood);
		}
	});

	it("walks the stage ladder in one direction only", () => {
		expect(stageForLevel(1)).toBe("baby");
		expect(stageForLevel(4)).toBe("juvenile");
		expect(stageForLevel(10)).toBe("adult");
		expect(stageForLevel(16)).toBe("elder");
		expect(PET_STAGES.indexOf(stageForLevel(9))).toBe(
			PET_STAGES.indexOf(stageForLevel(8)),
		);
		for (let level = 1; level < 40; level += 1) {
			const stage = stageForLevel(level);
			expect(PET_STAGES).toContain(stage);
			expect(level).toBeGreaterThanOrEqual(levelForStage(stage));
		}
	});

	it("applies every level a large gain earns", () => {
		// The old client applied at most one level per action: 400 XP at level 1
		// stopped at level 2 with 300 XP still on the bar.
		const single = applyExperience(1, 150);
		expect(single.level).toBe(2);
		expect(single.experience).toBe(50);
		const burst = applyExperience(1, 400);
		expect(burst.level).toBe(3); // 100 + 200 spent, 100 left under the 300 bar
		expect(burst.experience).toBe(100);
		expect(burst.leveledUp).toBe(true);
		expect(applyExperience(3, 0).leveledUp).toBe(false);
	});

	it("refuses a second interaction until the cooldown passes", () => {
		const last = new Date("2026-09-12T10:00:00Z");
		expect(cooldownLeft(last, 60, new Date("2026-09-12T10:30:00Z"))).toBe(30);
		expect(cooldownLeft(last, 60, new Date("2026-09-12T11:00:00Z"))).toBe(0);
		expect(cooldownLeft(null, 60, new Date())).toBe(0);
		expect(cooldownLeft(last, 0, new Date("2026-09-12T10:01:00Z"))).toBe(0);
	});

	it("counts a streak in days, not in clicks", () => {
		expect(streakFor(0, 99)).toBe(1);
		expect(streakFor(4, 1)).toBe(5);
		expect(streakFor(4, 0)).toBe(4);
		expect(streakFor(9, 3)).toBe(1);
		const now = new Date("2026-09-12T23:50:00Z");
		expect(daysBetweenUtcDays(new Date("2026-09-11T00:10:00Z"), now)).toBe(1);
		// Same UTC day, twelve minutes apart — the day, not the clock, is the unit.
		expect(daysBetweenUtcDays(new Date("2026-09-12T00:05:00Z"), now)).toBe(0);
	});

	it("caps the mood log the jsonb column has to hold", () => {
		let log: { mood: string; time: string }[] = [];
		for (let i = 0; i < 200; i += 1)
			log = pushMoodLog(log, { mood: "happy", time: new Date(i).toISOString() });
		expect(log).toHaveLength(30);
		expect(log[29]?.time).toBe(new Date(199).toISOString());
	});
});

describe("money rules", () => {
	it("pays a positive whole number for the daily", () => {
		expect(Number.isInteger(DAILY_REWARD)).toBe(true);
		expect(DAILY_REWARD).toBeGreaterThan(0);
		// `wallet_tx_amount_check` (0019) forbids 0: a zero-amount row would be a
		// ledger entry that moves nothing, and the trigger would reject it.
		expect(DAILY_REWARD).not.toBe(0);
	});

	it("keeps the daily reward below the cheapest product", () => {
		// Otherwise "wait 24h" beats buying anything and the shop has no purpose.
		expect(DAILY_REWARD).toBeLessThan(Math.min(...SHOP_ITEMS.map((i) => i.cost)));
	});
});
