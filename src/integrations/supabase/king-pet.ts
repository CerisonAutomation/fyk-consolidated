/**
 * King Pet -- Supabase integration
 *
 * All pet data lives in the king_pet, pet_items, and pet_adventures tables.
 * This module replaces the old api("/api/pet") calls with direct Supabase queries.
 */

import { getSupabase, toFailure, type Result } from "./client";
import type {
  KingPet as KingPetRow,
  PetItem as PetItemRow,
  PetAdventure as PetAdventureRow,
} from "./types";

// -- Domain shapes returned to components ------------------------------------

export type PetData = {
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
  mood_log: Array<{ mood: string; time: string }>;
};

export type PetItem = {
  id: string;
  name: string;
  type: string;
  emoji: string;
  bone_cost: number;
  stage_required: string;
};

export type PetAdventure = {
  id: string;
  theme: string;
  description: string;
  emoji: string;
  duration_minutes: number;
  bone_cost: number;
  reward_type: string;
  reward_amount: number;
};

export type PetLoadResult = {
  pet: PetData;
  items: PetItem[];
  adventures: PetAdventure[];
  bones: number;
};

export type PetActionResult = {
  pet: PetData;
  reward?: { type: string; amount: number; theme: string };
  leveledUp?: boolean;
};

// -- Helpers -----------------------------------------------------------------

function fail(code: string, message: string): { ok: false; code: string; message: string } {
  return { ok: false, code, message };
}

function rowToPet(row: KingPetRow): PetData {
  return {
    name: row.name,
    stage: row.stage,
    mood: row.mood,
    bones: row.bones,
    experience: row.experience,
    level: row.level,
    streak: row.streak,
    wardrobe: (row.wardrobe as string[]) ?? [],
    equipped: (row.equipped as string[]) ?? [],
    adventures: (row.adventures as string[]) ?? [],
    mood_log: (row.mood_log as Array<{ mood: string; time: string }>) ?? [],
  };
}

function rowToItem(row: PetItemRow): PetItem {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    emoji: row.emoji ?? "\u{1F381}",
    bone_cost: row.bone_cost,
    stage_required: row.stage_required,
  };
}

function rowToAdventure(row: PetAdventureRow): PetAdventure {
  return {
    id: row.id,
    theme: row.theme,
    description: row.description ?? "",
    emoji: row.emoji ?? "\u{1F5FA}",
    duration_minutes: row.duration_minutes,
    bone_cost: row.bone_cost,
    reward_type: row.reward_type,
    reward_amount: row.reward_amount,
  };
}

function randomMood(base: string): string {
  const moods = ["happy", "excited", "hungry", "sleepy", "sad"];
  if (Math.random() < 0.6) return base;
  return moods[Math.floor(Math.random() * moods.length)];
}

function calculateStage(level: number): string {
  if (level >= 10) return "adult";
  if (level >= 4) return "juvenile";
  return "baby";
}

async function ensureWalletBalance(
  client: NonNullable<ReturnType<typeof getSupabase>>,
  userId: string,
): Promise<{ walletId: string; balance: number }> {
  const { data: existing } = await client
    .from("wallet")
    .select("id,balance")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return { walletId: existing.id, balance: existing.balance };

  const { data: created } = await client
    .from("wallet")
    .insert({ user_id: userId, balance: 50, currency: "bones" })
    .select("id,balance")
    .single();

  return { walletId: created!.id, balance: created!.balance };
}

async function creditBones(
  client: NonNullable<ReturnType<typeof getSupabase>>,
  userId: string,
  amount: number,
  description: string,
): Promise<void> {
  const { walletId, balance } = await ensureWalletBalance(client, userId);
  await client.from("wallet").update({ balance: balance + amount }).eq("id", walletId);
  await client.from("wallet_transactions").insert({
    wallet_id: walletId,
    type: "credit",
    amount,
    description,
  });
}

async function debitBones(
  client: NonNullable<ReturnType<typeof getSupabase>>,
  userId: string,
  amount: number,
  description: string,
): Promise<void> {
  const { walletId, balance } = await ensureWalletBalance(client, userId);
  await client.from("wallet").update({ balance: balance - amount }).eq("id", walletId);
  await client.from("wallet_transactions").insert({
    wallet_id: walletId,
    type: "debit",
    amount,
    description,
  });
}

// -- Public API --------------------------------------------------------------

export async function loadPetData(userId: string): Promise<Result<PetLoadResult>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  const [petResult, itemsResult, adventuresResult] = await Promise.all([
    client.from("king_pet").select("*").eq("user_id", userId).maybeSingle(),
    client.from("pet_items").select("*").order("name", { ascending: true }),
    client.from("pet_adventures").select("*").order("theme", { ascending: true }),
  ]);

  if (petResult.error) return toFailure(petResult.error);

  let petRow: KingPetRow | null = petResult.data;

  if (!petRow) {
    const { data: created, error: createError } = await client
      .from("king_pet")
      .insert({
        user_id: userId,
        name: "Kinglet",
        stage: "baby",
        mood: "happy",
        bones: 50,
        experience: 0,
        level: 1,
        streak: 0,
      })
      .select("*")
      .single();

    if (createError) return toFailure(createError);
    petRow = created;
    await ensureWalletBalance(client, userId);
  }

  const { data: walletRow } = await client
    .from("wallet")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();

  const items = (itemsResult.data ?? []).map(rowToItem);
  const adventures = (adventuresResult.data ?? []).map(rowToAdventure);
  const bones = walletRow?.balance ?? 0;

  return {
    ok: true,
    data: { pet: rowToPet(petRow), items, adventures, bones },
  };
}

export async function performPetAction(
  userId: string,
  action: string,
  params?: Record<string, unknown>,
): Promise<Result<PetActionResult>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  const { data: petRow, error: fetchError } = await client
    .from("king_pet")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (fetchError || !petRow) return toFailure(fetchError ?? new Error("Pet not found"));

  const pet = rowToPet(petRow);
  const updatedPet = { ...pet };
  let reward: PetActionResult["reward"] = undefined;
  let leveledUp = false;

  const now = new Date().toISOString();

  switch (action) {
    case "feed": {
      const xpGain = 20;
      updatedPet.experience += xpGain;
      updatedPet.mood = "happy";
      updatedPet.streak = (petRow.streak ?? 0) + 1;
      if (updatedPet.streak % 3 === 0) {
        const bonus = 10;
        updatedPet.bones += bonus;
        reward = { type: "bones", amount: bonus, theme: "Streak bonus" };
        await creditBones(client, userId, bonus, "Streak bonus");
      }
      break;
    }
    case "play": {
      updatedPet.experience += 25;
      updatedPet.mood = randomMood("excited");
      reward = { type: "xp", amount: 25, theme: "Playtime" };
      break;
    }
    case "rest": {
      updatedPet.experience += 10;
      updatedPet.mood = "sleepy";
      break;
    }
    case "dress": {
      updatedPet.experience += 15;
      updatedPet.mood = "excited";
      break;
    }
    case "equip": {
      const itemName = params?.name as string;
      if (!itemName) return fail("INVALID", "Item name required");
      const equipped = [...updatedPet.equipped];
      const idx = equipped.indexOf(itemName);
      if (idx >= 0) {
        equipped.splice(idx, 1);
      } else {
        equipped.push(itemName);
      }
      updatedPet.equipped = equipped;
      break;
    }
    case "buyItem": {
      const itemId = params?.itemId as string;
      if (!itemId) return fail("INVALID", "Item ID required");
      const { data: itemRow } = await client.from("pet_items").select("*").eq("id", itemId).single();
      if (!itemRow) return fail("NOT_FOUND", "Item not found");
      if (updatedPet.bones < itemRow.bone_cost) return fail("INSUFFICIENT_FUNDS", "Not enough bones");
      const stageOrder = ["baby", "juvenile", "adult"];
      if (stageOrder.indexOf(updatedPet.stage) < stageOrder.indexOf(itemRow.stage_required)) {
        return fail("LOCKED", "Pet stage too low");
      }
      updatedPet.bones -= itemRow.bone_cost;
      if (!updatedPet.wardrobe.includes(itemRow.name)) {
        updatedPet.wardrobe = [...updatedPet.wardrobe, itemRow.name];
      }
      await debitBones(client, userId, itemRow.bone_cost, "Bought pet item: " + itemRow.name);
      break;
    }
    case "adventure": {
      const adventureId = params?.adventureId as string;
      if (!adventureId) return fail("INVALID", "Adventure ID required");
      const { data: advRow } = await client.from("pet_adventures").select("*").eq("id", adventureId).single();
      if (!advRow) return fail("NOT_FOUND", "Adventure not found");
      if (updatedPet.bones < advRow.bone_cost) return fail("INSUFFICIENT_FUNDS", "Not enough bones");
      updatedPet.bones -= advRow.bone_cost;
      await debitBones(client, userId, advRow.bone_cost, "Adventure: " + advRow.theme);
      if (advRow.reward_type === "xp") {
        updatedPet.experience += advRow.reward_amount;
        reward = { type: "xp", amount: advRow.reward_amount, theme: advRow.theme };
      } else {
        updatedPet.bones += advRow.reward_amount;
        reward = { type: "bones", amount: advRow.reward_amount, theme: advRow.theme };
        await creditBones(client, userId, advRow.reward_amount, "Adventure reward: " + advRow.theme);
      }
      const advDone = [...updatedPet.adventures];
      if (!advDone.includes(advRow.theme)) advDone.push(advRow.theme);
      updatedPet.adventures = advDone;
      updatedPet.mood = "excited";
      break;
    }
    case "rename": {
      const newName = (params?.name as string)?.trim();
      if (!newName) return fail("INVALID", "Name required");
      updatedPet.name = newName;
      break;
    }
    default:
      return fail("UNKNOWN_ACTION", "Unknown action: " + action);
  }

  // Level up check
  const xpNeeded = updatedPet.level * 100;
  if (updatedPet.experience >= xpNeeded) {
    updatedPet.level += 1;
    updatedPet.experience -= xpNeeded;
    updatedPet.stage = calculateStage(updatedPet.level);
    leveledUp = true;
    updatedPet.mood = "excited";
  }

  // Append mood log entry
  const moodLog = [...((petRow.mood_log as Array<{ mood: string; time: string }>) ?? [])];
  moodLog.push({ mood: updatedPet.mood, time: now });
  if (moodLog.length > 30) moodLog.splice(0, moodLog.length - 30);

  // Persist
  const { error: updateError } = await client
    .from("king_pet")
    .update({
      name: updatedPet.name,
      stage: updatedPet.stage,
      mood: updatedPet.mood,
      bones: updatedPet.bones,
      experience: updatedPet.experience,
      level: updatedPet.level,
      streak: updatedPet.streak,
      wardrobe: updatedPet.wardrobe,
      equipped: updatedPet.equipped,
      adventures: updatedPet.adventures,
      mood_log: moodLog,
    })
    .eq("user_id", userId);

  if (updateError) return toFailure(updateError);

  updatedPet.mood_log = moodLog;
  return { ok: true, data: { pet: updatedPet, reward, leveledUp } };
}
