// ═══════════════════════════════════════════════════════════════════════════════
// Pet — Lifecycle & Progression
// ═══════════════════════════════════════════════════════════════════════════════

import type { PrismaClient } from "../../generated/prisma/client.js";
import { ADVENTURES, type AdventureId } from "./adventures.js";
import {
	WARDROBE_ITEMS,
	type WardrobeItemId,
} from "./wardrobe.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_PET_NAME = "Kingsley";
const XP_PER_LEVEL = 100;

// ─── Types ───────────────────────────────────────────────────────────────────

export type PetStage = "egg" | "hatchling" | "juvenile" | "adult" | "legendary";
export type PetMood = "happy" | "hungry" | "sleepy" | "excited" | "bored" | "sick" | "adventurous";

export interface PetState {
	id: string;
	name: string;
	stage: PetStage;
	mood: PetMood;
	bones: number;
	hunger: number;
	happiness: number;
	experience: number;
	level: number;
	activity: string;
	costume: string;
	adventures: string[];
	equipped: Record<string, unknown> | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeLevel(xp: number): number {
	return Math.floor(xp / XP_PER_LEVEL) + 1;
}

function computeStage(level: number): PetStage {
	if (level >= 10) return "adult";
	if (level >= 5) return "juvenile";
	return "hatchling";
}

function levelUpCheck(levelBefore: number, levelAfter: number): { evolved: boolean; newStage: PetStage } {
	if (levelBefore === levelAfter) return { evolved: false, newStage: computeStage(levelAfter) };
	const newStage = computeStage(levelAfter);
	const oldStage = computeStage(levelBefore);
	return { evolved: newStage !== oldStage, newStage };
}

function nowISO(): string {
	return new Date().toISOString();
}

function mapPet(raw: {
	id: string;
	name: string;
	stage: string;
	mood: string;
	bones: number;
	hunger: number;
	happiness: number;
	experience: number;
	level: number;
	activity: string;
	costume: string;
	adventures: unknown;
	equipped: unknown;
}): PetState {
	return {
		id: raw.id,
		name: raw.name,
		stage: raw.stage as PetStage,
		mood: raw.mood as PetMood,
		bones: raw.bones,
		hunger: raw.hunger,
		happiness: raw.happiness,
		experience: raw.experience,
		level: raw.level,
		activity: raw.activity,
		costume: raw.costume,
		adventures: (raw.adventures as string[]) ?? [],
		equipped: raw.equipped as Record<string, unknown> | null,
	};
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Ensures a pet exists for the user. Creates "Kingsley" if none exists.
 */
export async function ensurePet(
	db: PrismaClient,
	userId: string,
): Promise<PetState> {
	const existing = await db.kingPet.findUnique({ where: { userId } });
	if (existing) return mapPet(existing);

	const created = await db.kingPet.create({
		data: {
			userId,
			name: DEFAULT_PET_NAME,
			stage: "hatchling",
			mood: "happy",
			bones: 50,
			hunger: 75,
			happiness: 75,
			experience: 0,
			level: 1,
			activity: "at_home",
			costume: "none",
			adventures: [],
			equipped: null,
			moodLog: [{ mood: "happy", at: nowISO() }],
		},
	});

	return mapPet(created);
}

/**
 * Feed the pet: +20 XP, mood happy, hunger restored.
 */
export async function feedPet(
	db: PrismaClient,
	userId: string,
): Promise<{ pet: PetState; evolved: boolean }> {
	const before = await ensurePet(db, userId);
	const newXP = before.experience + 20;
	const newLevel = computeLevel(newXP);
	const { evolved } = levelUpCheck(before.level, newLevel);
	const newStage = computeStage(newLevel);

	const existing = await db.kingPet.findUnique({ where: { userId } });
	const moodLog = [...((existing?.moodLog as Array<Record<string, unknown>>) ?? [])];
	moodLog.push({ mood: "happy", at: nowISO() });

	const updated = await db.kingPet.update({
		where: { userId },
		data: {
			experience: newXP,
			level: newLevel,
			stage: newStage,
			mood: "happy",
			hunger: Math.min(100, before.hunger + 25),
			happiness: Math.min(100, before.happiness + 10),
			lastFed: new Date(),
			moodLog,
		},
	});

	return { pet: mapPet(updated), evolved };
}

/**
 * Play with the pet: +25 XP, mood excited.
 */
export async function playPet(
	db: PrismaClient,
	userId: string,
): Promise<{ pet: PetState; evolved: boolean }> {
	const before = await ensurePet(db, userId);
	const newXP = before.experience + 25;
	const newLevel = computeLevel(newXP);
	const { evolved } = levelUpCheck(before.level, newLevel);
	const newStage = computeStage(newLevel);

	const existing = await db.kingPet.findUnique({ where: { userId } });
	const moodLog = [...((existing?.moodLog as Array<Record<string, unknown>>) ?? [])];
	moodLog.push({ mood: "excited", at: nowISO() });

	const updated = await db.kingPet.update({
		where: { userId },
		data: {
			experience: newXP,
			level: newLevel,
			stage: newStage,
			mood: "excited",
			happiness: Math.min(100, before.happiness + 20),
			moodLog,
		},
	});

	return { pet: mapPet(updated), evolved };
}

/**
 * Rest the pet: +10 XP, mood sleepy.
 */
export async function restPet(
	db: PrismaClient,
	userId: string,
): Promise<{ pet: PetState; evolved: boolean }> {
	const before = await ensurePet(db, userId);
	const newXP = before.experience + 10;
	const newLevel = computeLevel(newXP);
	const { evolved } = levelUpCheck(before.level, newLevel);
	const newStage = computeStage(newLevel);

	const existing = await db.kingPet.findUnique({ where: { userId } });
	const moodLog = [...((existing?.moodLog as Array<Record<string, unknown>>) ?? [])];
	moodLog.push({ mood: "sleepy", at: nowISO() });

	const updated = await db.kingPet.update({
		where: { userId },
		data: {
			experience: newXP,
			level: newLevel,
			stage: newStage,
			mood: "sleepy",
			hunger: Math.max(0, before.hunger - 5),
			happiness: Math.min(100, before.happiness + 5),
			moodLog,
		},
	});

	return { pet: mapPet(updated), evolved };
}

/**
 * Dress the pet: +15 XP, mood happy.
 */
export async function dressPet(
	db: PrismaClient,
	userId: string,
): Promise<{ pet: PetState; evolved: boolean }> {
	const before = await ensurePet(db, userId);
	const newXP = before.experience + 15;
	const newLevel = computeLevel(newXP);
	const { evolved } = levelUpCheck(before.level, newLevel);
	const newStage = computeStage(newLevel);

	const existing = await db.kingPet.findUnique({ where: { userId } });
	const moodLog = [...((existing?.moodLog as Array<Record<string, unknown>>) ?? [])];
	moodLog.push({ mood: "happy", at: nowISO() });

	const updated = await db.kingPet.update({
		where: { userId },
		data: {
			experience: newXP,
			level: newLevel,
			stage: newStage,
			mood: "happy",
			happiness: Math.min(100, before.happiness + 15),
			moodLog,
		},
	});

	return { pet: mapPet(updated), evolved };
}

/**
 * Send the pet on an adventure: costs bones, +40 XP, mood excited.
 */
export async function adventurePet(
	db: PrismaClient,
	userId: string,
	adventureId: AdventureId,
): Promise<{ pet: PetState; evolved: boolean; error?: string }> {
	const adventure = ADVENTURES[adventureId];
	if (!adventure) {
		const pet = await ensurePet(db, userId);
		return { pet, evolved: false, error: "Adventure not found" };
	}

	const pet = await ensurePet(db, userId);

	if (pet.bones < adventure.cost) {
		return { pet, evolved: false, error: "Insufficient bones for this adventure" };
	}

	const newXP = pet.experience + adventure.xpReward;
	const newLevel = computeLevel(newXP);
	const { evolved } = levelUpCheck(pet.level, newLevel);
	const newStage = computeStage(newLevel);

	const existing = await db.kingPet.findUnique({ where: { userId } });
	const moodLog = [...((existing?.moodLog as Array<Record<string, unknown>>) ?? [])];
	moodLog.push({ mood: "excited", at: nowISO(), adventure: adventureId });

	const adventureEnds = new Date();
	adventureEnds.setMinutes(adventureEnds.getMinutes() + adventure.durationMinutes);

	const updated = await db.kingPet.update({
		where: { userId },
		data: {
			experience: newXP,
			level: newLevel,
			stage: newStage,
			mood: "excited",
			bones: pet.bones - adventure.cost,
			activity: `adventure:${adventureId}`,
			adventureEndsAt: adventureEnds,
			adventures: [...pet.adventures, adventureId],
			happiness: Math.min(100, pet.happiness + 30),
			moodLog,
		},
	});

	return { pet: mapPet(updated), evolved };
}

/**
 * Buy a wardrobe item for the pet. Checks stage requirement and deducts bones.
 */
export async function buyPetItem(
	db: PrismaClient,
	userId: string,
	itemId: WardrobeItemId,
): Promise<{ success: boolean; pet: PetState; error?: string }> {
	const item = WARDROBE_ITEMS[itemId];
	if (!item) {
		const pet = await ensurePet(db, userId);
		return { success: false, pet, error: "Item not found" };
	}

	const pet = await ensurePet(db, userId);

	const stageOrder: Record<PetStage, number> = {
		egg: 0,
		hatchling: 0,
		juvenile: 1,
		adult: 2,
		legendary: 3,
	};
	const reqOrder = stageOrder[item.minStage as PetStage] ?? 0;
	if (stageOrder[pet.stage] < reqOrder) {
		return {
			success: false,
			pet,
			error: `Pet must be ${item.minStage} or higher to wear this item`,
		};
	}

	if (pet.bones < item.price) {
		return { success: false, pet, error: "Insufficient bones" };
	}

	// Track owned items in the adventures array (repurposed as wardrobe ownership)
	const owned = new Set(pet.adventures);
	owned.add(itemId);

	const updated = await db.kingPet.update({
		where: { userId },
		data: {
			bones: pet.bones - item.price,
			adventures: [...owned],
		},
	});

	return { success: true, pet: mapPet(updated) };
}

/**
 * Toggle equip/unequip a wardrobe item.
 */
export async function equipPetItem(
	db: PrismaClient,
	userId: string,
	itemId: WardrobeItemId,
): Promise<{ pet: PetState; equipped: boolean }> {
	const pet = await ensurePet(db, userId);
	const currentEquipped = (pet.equipped ?? {}) as Record<string, boolean>;
	const isEquipped = !!currentEquipped[itemId];
	const newEquipped = { ...currentEquipped, [itemId]: !isEquipped };

	const updated = await db.kingPet.update({
		where: { userId },
		data: { equipped: newEquipped },
	});

	return { pet: mapPet(updated), equipped: !isEquipped };
}

/**
 * Rename the pet. Validates 1-20 characters.
 */
export async function renamePet(
	db: PrismaClient,
	userId: string,
	name: string,
): Promise<{ success: boolean; pet?: PetState; error?: string }> {
	const trimmed = name.trim();
	if (trimmed.length === 0 || trimmed.length > 20) {
		return { success: false, error: "Name must be 1-20 characters" };
	}

	const updated = await db.kingPet.update({
		where: { userId },
		data: { name: trimmed },
	});

	return { success: true, pet: mapPet(updated) };
}
