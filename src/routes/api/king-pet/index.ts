import { createFileRoute } from "@tanstack/react-router";
import { asc, eq } from "drizzle-orm";
import { type DbLike, db } from "@/db";
import {
	cleanText,
	methodNotAllowed,
	readJson,
	requireCaller,
	unexpected,
	z,
} from "@/lib/api-helpers";
import {
	applyExperience,
	cooldownLeft,
	daysBetweenUtcDays,
	levelForStage,
	PET_ACTIONS,
	type PetActionName,
	pushMoodLog,
	stageForLevel,
	streakFor,
} from "@/lib/economy";
import {
	InsufficientBalance,
	postLedger,
	walletBalance,
} from "@/lib/wallet.server";
import { json, jsonError, withSecurity } from "@/middleware";
import { kingPet, petAdventures, petItems } from "@/schema";

/**
 * `GET/POST /api/king-pet` — the pet, its shop and its trips.
 *
 * WHY THIS REPLACED `src/integrations/supabase/king-pet.ts`
 * ----------------------------------------------------------
 * The pet is a game layer over the same currency, so the old module needed the
 * wallet — and it had three ways to be wrong about it:
 *
 *   - `creditBones`/`debitBones` set `wallet.balance` by hand and inserted a
 *     `wallet_transactions` row typed `'credit'`/`'debit'`, which `0013`'s CHECK
 *     never allowed. The debit "worked" (the balance was overwritten), the ledger
 *     row was rejected — so money vanished with no record;
 *   - `king_pet.bones` was a second balance the screen showed while the wallet held
 *     the real one (0019 dropped the column);
 *   - XP, level and streak were computed in the browser and written straight to
 *     `king_pet`, so `feed` could be tapped forty times a minute for forty `+20 XP`
 *     — and the `last_fed_at`/`last_played_at`/`last_adventure_at` columns, which
 *     exist precisely to make that impossible, were never read or written.
 *
 * Now: the server owns progression, cooldowns come from those columns, an
 * adventure takes its `duration_minutes` and pays out on return (`GET` resolves it,
 * which is why there is no "claim" button to fake), and the only spend path is the
 * ledger. Purchased items land in `wardrobe`, so `equip` can only choose from what
 * the account actually bought.
 */

const STAGE_ORDER = ["baby", "juvenile", "adult", "elder"] as const;

type PendingAdventure = {
	theme: string;
	emoji: string;
	startedAt: string;
	endsAt: string;
	rewardType: "xp" | "bones";
	rewardAmount: number;
};

type PetView = {
	name: string;
	stage: string;
	mood: string;
	bones: number;
	experience: number;
	level: number;
	streak: number;
	wardrobe: string[];
	equipped: string[];
	adventures: string[];
	mood_log: { mood: string; time: string }[];
};

function asStringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((entry): entry is string => typeof entry === "string")
		: [];
}

function asMoodLog(value: unknown): { mood: string; time: string }[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter(
			(entry): entry is { mood: string; time: string } =>
				!!entry &&
				typeof entry === "object" &&
				typeof (entry as { mood?: unknown }).mood === "string" &&
				typeof (entry as { time?: unknown }).time === "string",
		)
		.slice(-30);
}

function asPending(value: unknown): PendingAdventure | null {
	if (!value || typeof value !== "object") return null;
	const row = value as Record<string, unknown>;
	if (typeof row.theme !== "string" || typeof row.endsAt !== "string")
		return null;
	const endsAt = Date.parse(row.endsAt);
	if (!Number.isFinite(endsAt)) return null;
	return {
		theme: row.theme,
		emoji: typeof row.emoji === "string" ? row.emoji : "🗺️",
		startedAt:
			typeof row.startedAt === "string"
				? row.startedAt
				: new Date(endsAt).toISOString(),
		endsAt: new Date(endsAt).toISOString(),
		rewardType: row.rewardType === "bones" ? "bones" : "xp",
		rewardAmount: Number.isFinite(Number(row.rewardAmount))
			? Math.abs(Number(row.rewardAmount))
			: 0,
	};
}

function toView(row: typeof kingPet.$inferSelect, bones: number): PetView {
	return {
		name: row.name ?? "Kingsley",
		stage: row.stage ?? "baby",
		mood: row.mood ?? "happy",
		bones,
		experience: Number(row.experience ?? 0),
		level: Number(row.level ?? 1),
		streak: Number(row.streak ?? 0),
		wardrobe: asStringArray(row.wardrobe),
		equipped: asStringArray(row.equipped),
		adventures: asStringArray(row.adventures),
		mood_log: asMoodLog(row.moodLog),
	};
}

/** The pet row, created on first read. One insert, no `update … where user_id`. */
async function ensurePet(userId: string, tx: DbLike = db) {
	const [existing] = await tx
		.select()
		.from(kingPet)
		.where(eq(kingPet.userId, userId))
		.limit(1);
	if (existing) return existing;

	const [created] = await tx
		.insert(kingPet)
		.values({ userId })
		.onConflictDoNothing({ target: kingPet.userId })
		.returning();
	if (created) return created;

	const [again] = await tx
		.select()
		.from(kingPet)
		.where(eq(kingPet.userId, userId))
		.limit(1);
	if (!again)
		throw new Error(`king_pet row for ${userId} could not be created`);
	return again;
}

/**
 * Collect a finished trip. Called on read, so the reward arrives by itself: a
 * "claim" button would be one more thing a screenshot could show as pending when
 * the server had already paid.
 */
async function resolvePending(
	userId: string,
	tx: DbLike,
): Promise<{
	pet: typeof kingPet.$inferSelect;
	completed: PendingAdventure | null;
} | null> {
	const [row] = await tx
		.select()
		.from(kingPet)
		.where(eq(kingPet.userId, userId))
		.limit(1);
	if (!row) return null;
	const pending = asPending(row.pendingAdventure);
	if (!pending) return null;
	if (Date.parse(pending.endsAt) > Date.now())
		return { pet: row, completed: null };

	if (pending.rewardType === "bones") {
		// Money is always the ledger's business. `entry` is null when the same trip
		// was already collected (two tabs loading at once), so the payout is
		// idempotent on the trip's start time rather than on a lucky read order.
		await postLedger(
			{
				userId,
				type: "adventure",
				amount: pending.rewardAmount,
				description: `${pending.theme} reward`,
				source: "pet-adventure",
				idempotencyKey: `adventure:${userId}:${pending.startedAt}`,
			},
			tx,
		);
	}

	// An XP reward is *not* applied here: collection happens in `POST {action:
	// 'adventure'}` (the next tap), so one code path owns XP, level and stage. A
	// second path in the read would either double-count or disagree with it, and a
	// GET that changes progression is a read that cannot be retried safely.
	const [updated] = await tx
		.update(kingPet)
		.set({
			mood: "excited",
			adventures: asStringArray(row.adventures)
				.concat(pending.theme)
				.slice(-30),
			pendingAdventure: null,
			moodLog: pushMoodLog(asMoodLog(row.moodLog), {
				mood: "excited",
				time: new Date().toISOString(),
			}),
			updatedAt: new Date(),
		})
		.where(eq(kingPet.userId, userId))
		.returning();

	return { pet: updated ?? row, completed: pending };
}

const actionSchema = z.discriminatedUnion("action", [
	z.object({ action: z.enum(["feed", "play", "rest", "dress"]) }),
	z.object({ action: z.literal("equip"), name: z.string().min(1).max(60) }),
	z.object({ action: z.literal("buyItem"), itemId: z.uuid() }),
	z.object({ action: z.literal("adventure"), adventureId: z.uuid() }),
	z.object({ action: z.literal("rename"), name: z.string().min(1).max(24) }),
]);

export const Route = createFileRoute("/api/king-pet/")({
	server: {
		handlers: {
			GET: withSecurity(
				async ({ caller }) => {
					const user = requireCaller(caller);
					try {
						await ensurePet(user.id);
						const resolved = await resolvePending(user.id, db);
						const [row, items, adventures, bones] = await Promise.all([
							resolved
								? Promise.resolve(resolved.pet)
								: db
										.select()
										.from(kingPet)
										.where(eq(kingPet.userId, user.id))
										.limit(1)
										.then((rows) => rows[0]),

							db
								.select()
								.from(petItems)
								.orderBy(asc(petItems.boneCost), asc(petItems.name)),
							db
								.select()
								.from(petAdventures)
								.orderBy(asc(petAdventures.durationMinutes)),
							walletBalance(user.id),
						]);
						const pending = asPending(row?.pendingAdventure);

						return json(
							{
								pet: toView(row, bones),
								items: items.map((item) => ({
									id: item.id,
									name: item.name,
									type: item.type,
									emoji: item.emoji ?? "🎁",
									bone_cost: Number(item.boneCost ?? 0),
									stage_required: item.stageRequired ?? "baby",
								})),
								adventures: adventures.map((adventure) => ({
									id: adventure.id,
									theme: adventure.theme,
									description: adventure.description ?? "",
									emoji: adventure.emoji ?? "🗺️",
									duration_minutes: Number(adventure.durationMinutes ?? 30),
									bone_cost: Number(adventure.boneCost ?? 0),
									reward_type: adventure.rewardType ?? "xp",
									reward_amount: Number(adventure.rewardAmount ?? 0),
								})),
								bones,
								pending,
								// A trip whose bones reward already landed, so the screen can say so.
								justCompleted: resolved?.completed ?? null,
							},
							{ cache: "private" },
						);
					} catch (error) {
						return unexpected("king-pet/GET", error);
					}
				},
				{
					rateLimit: {
						limit: 120,
						key: ({ caller }) => `king-pet:GET:${caller?.id ?? "anon"}`,
					},
				},
			),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const body = await readJson(request, actionSchema, 4 * 1024);

					try {
						// One Response per branch: `jsonError` already builds one, so the
						// transaction returns it and the handler passes it through.
						return await db.transaction(async (tx) => {
							const finished = await resolvePending(user.id, tx);
							const pet = finished?.pet ?? (await ensurePet(user.id, tx));
							const now = new Date();
							const completed = asStringArray(pet.adventures);
							const moodLog = asMoodLog(pet.moodLog);
							let wardrobe = asStringArray(pet.wardrobe);
							let equipped = asStringArray(pet.equipped);

							let level = Number(pet.level ?? 1);
							let experience = Number(pet.experience ?? 0);
							let stage = pet.stage ?? stageForLevel(level);
							let mood = pet.mood ?? "happy";
							let streak = Number(pet.streak ?? 0);
							let name = pet.name ?? "Kingsley";
							let lastFedAt = pet.lastFedAt;
							let lastPlayedAt = pet.lastPlayedAt;
							let lastAdventureAt = pet.lastAdventureAt;
							let pendingAdventure = pet.pendingAdventure;
							let bones = await walletBalance(user.id, tx);
							let leveledUp = false;

							/** The one place XP, level and stage move. */
							const gainXp = (amount: number) => {
								const next = applyExperience(level, experience + amount);
								level = next.level;
								experience = next.experience;
								stage = next.stage;
								leveledUp = leveledUp || next.leveledUp;
							};

							// A trip that finished pays its XP now, in the same transaction as the
							// next action, so `leveledUp` and the toast describe what actually happened.
							if (finished?.completed?.rewardType === "xp")
								gainXp(finished.completed.rewardAmount);

							if (
								body.action === "feed" ||
								body.action === "play" ||
								body.action === "rest" ||
								body.action === "dress"
							) {
								const def = PET_ACTIONS[body.action as PetActionName];
								const last = body.action === "feed" ? lastFedAt : lastPlayedAt;
								const wait = cooldownLeft(
									last ?? null,
									def.cooldownMinutes,
									now,
								);
								if (wait > 0)
									return jsonError(
										`${name} is not ready for that — ${wait} more minute${wait === 1 ? "" : "s"}`,
										409,
									);
								gainXp(def.xp);
								mood = def.mood;
								if (body.action === "feed") {
									streak = lastFedAt
										? streakFor(
												streak,
												daysBetweenUtcDays(new Date(lastFedAt), now),
											)
										: 1;
									lastFedAt = now;
								} else if (body.action === "play") {
									lastPlayedAt = now;
								} else if (body.action === "rest") {
									lastPlayedAt = now;
								}
							} else if (body.action === "equip") {
								const wanted = cleanText(body.name, 60);
								if (!wardrobe.includes(wanted))
									return jsonError(`You have not bought ${wanted} yet`, 409);
								const next = new Set(equipped);
								if (next.has(wanted)) next.delete(wanted);
								else next.add(wanted);
								equipped = [...next].slice(0, 8);
							} else if (body.action === "buyItem") {
								const [item] = await tx
									.select()
									.from(petItems)
									.where(eq(petItems.id, body.itemId))
									.limit(1);
								if (!item)
									return jsonError("That item is not in the shop", 404);
								const required = item.stageRequired ?? "baby";
								if (
									STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]) <
									STAGE_ORDER.indexOf(required as (typeof STAGE_ORDER)[number])
								)
									return jsonError(
										`${item.name} unlocks at level ${levelForStage(required)}`,
										409,
									);
								if (wardrobe.includes(item.name))
									return jsonError(`${item.name} is already yours`, 409);

								const cost = Number(item.boneCost ?? 0);
								if (cost > 0) {
									const entry = await postLedger(
										{
											userId: user.id,
											type: "purchase",
											amount: -cost,
											description: `${item.name} for ${name}`,
											source: `pet-shop:${item.id}`,
										},
										tx,
									);
									if (entry) bones = entry.balance;
								}
								wardrobe = [...wardrobe, item.name].slice(0, 40);
								mood = "happy";
							} else if (body.action === "adventure") {
								const away = asPending(pendingAdventure);
								if (away)
									return jsonError(
										`${name} is still away on ${away.theme}`,
										409,
									);
								const [adventure] = await tx
									.select()
									.from(petAdventures)
									.where(eq(petAdventures.id, body.adventureId))
									.limit(1);
								if (!adventure)
									return jsonError("That adventure does not exist", 404);

								const cost = Number(adventure.boneCost ?? 0);
								if (cost > 0) {
									const entry = await postLedger(
										{
											userId: user.id,
											type: "adventure",
											amount: -cost,
											description: `${adventure.theme} supplies`,
											source: `pet-adventure:${adventure.id}`,
										},
										tx,
									);
									if (entry) bones = entry.balance;
								}

								const minutes = Math.max(
									1,
									Number(adventure.durationMinutes ?? 30),
								);
								pendingAdventure = {
									theme: adventure.theme,
									emoji: adventure.emoji ?? "🗺️",
									startedAt: now.toISOString(),
									endsAt: new Date(
										now.getTime() + minutes * 60_000,
									).toISOString(),
									rewardType: adventure.rewardType === "bones" ? "bones" : "xp",
									rewardAmount: Math.max(
										0,
										Number(adventure.rewardAmount ?? 0),
									),
								};
								mood = "playful";
								lastAdventureAt = now;
							} else if (body.action === "rename") {
								const wanted = cleanText(body.name, 24);
								if (!wanted) return jsonError("A name is required", 400);
								name = wanted;
							} else {
								// Unreachable through the schema; kept so a future action without a
								// handler answers 400 instead of silently saving an unchanged pet.
								return jsonError("That action is not supported yet", 400);
							}

							const [updated] = await tx
								.update(kingPet)
								.set({
									name,
									stage,
									mood,
									level,
									experience,
									streak,
									wardrobe,
									equipped,
									adventures: completed,
									moodLog: pushMoodLog(moodLog, {
										mood,
										time: now.toISOString(),
									}),
									lastFedAt,
									lastPlayedAt,
									lastAdventureAt,
									pendingAdventure,
									updatedAt: now,
								})
								.where(eq(kingPet.userId, user.id))
								.returning();

							if (!updated)
								return jsonError(
									"The pet row disappeared. Reload the page.",
									500,
								);

							return json({
								ok: true,
								pet: toView(updated, bones),
								bones,
								leveledUp,
								pending: asPending(pendingAdventure),
								// `reward` keeps the shape the screen already toasts on.
								reward:
									finished?.completed?.rewardType === "xp"
										? {
												type: "xp",
												amount: finished.completed.rewardAmount,
												theme: finished.completed.theme,
											}
										: undefined,
							});
						});
					} catch (error) {
						if (error instanceof InsufficientBalance)
							return jsonError(
								`Not enough bones for that — it costs ${error.cost}`,
								409,
							);
						return unexpected("king-pet/POST", error);
					}
				},
				{
					maxBodySize: 4 * 1024,
					rateLimit: {
						limit: 240,
						windowMs: 60 * 1000,
						key: ({ caller }) => `king-pet:POST:${caller?.id ?? "anon"}`,
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
