import { PrismaClient } from "../../generated/prisma";
import type { PetState, PetItem, PetAdventure } from "../../core/domain/types";
import type { PetRepository } from "../../core/ports/repositories";

// ── Domain <-> Prisma mapper ───────────────────────────────────────────────

function toDomainPet(row: any): PetState {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    stage: row.stage,
    mood: row.mood,
    bones: row.bones,
    experience: row.experience,
    level: row.level,
    streak: 0,
    wardrobe: (row.costume && row.costume !== "none" ? [row.costume] : []),
    equipped: (row.equipped as string[]) ?? [],
    adventures: (row.adventures as string[]) ?? [],
    moodLog: (row.moodLog as string[]) ?? [],
    lastFedAt: row.lastFed?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

// ── Adapter ────────────────────────────────────────────────────────────────

export function createPetRepository(db: PrismaClient): PetRepository {
  return {
    async findByUserId(userId: string): Promise<PetState | null> {
      const row = await db.kingPet.findUnique({ where: { userId } });
      return row ? toDomainPet(row) : null;
    },

    async create(userId: string): Promise<PetState> {
      const row = await db.kingPet.create({
        data: {
          userId,
          name: "Kinglet",
          stage: "egg",
          mood: "happy",
          bones: 50,
          hunger: 75,
          happiness: 75,
          experience: 0,
          level: 1,
          activity: "at_home",
        },
      });
      return toDomainPet(row);
    },

    async update(userId: string, data: Partial<PetState>): Promise<PetState> {
      const updateData: Record<string, any> = {};

      if (data.name !== undefined) updateData.name = data.name;
      if (data.stage !== undefined) updateData.stage = data.stage;
      if (data.mood !== undefined) updateData.mood = data.mood;
      if (data.bones !== undefined) updateData.bones = data.bones;
      if (data.experience !== undefined) updateData.experience = data.experience;
      if (data.level !== undefined) updateData.level = data.level;
      if (data.wardrobe !== undefined && data.wardrobe.length > 0) {
        updateData.costume = data.wardrobe[0];
      }
      if (data.equipped !== undefined) updateData.equipped = data.equipped;
      if (data.adventures !== undefined) updateData.adventures = data.adventures;
      if (data.moodLog !== undefined) updateData.moodLog = data.moodLog;
      if (data.lastFedAt !== undefined) updateData.lastFed = new Date(data.lastFedAt);

      const row = await db.kingPet.update({
        where: { userId },
        data: updateData,
      });
      return toDomainPet(row);
    },

    async getItems(): Promise<PetItem[]> {
      // pet_items is a reference/catalog table; query raw if the Prisma
      // client has not been regenerated with the table in the schema.
      try {
        const rows = await (db as any).petItem?.findMany({
          orderBy: { name: "asc" },
        });
        if (!rows) return [];
        return rows.map((row: any) => ({
          id: row.id,
          name: row.name,
          type: row.type,
          emoji: row.emoji,
          boneCost: row.boneCost,
          stageRequired: row.stageRequired ?? "egg",
        }));
      } catch {
        return [];
      }
    },

    async getAdventures(): Promise<PetAdventure[]> {
      try {
        const rows = await (db as any).petAdventure?.findMany({
          orderBy: { theme: "asc" },
        });
        if (!rows) return [];
        return rows.map((row: any) => ({
          id: row.id,
          theme: row.theme,
          description: row.description,
          emoji: row.emoji,
          durationMinutes: row.durationMinutes,
          boneCost: row.boneCost,
          rewardType: row.rewardType,
          rewardAmount: row.rewardAmount,
        }));
      } catch {
        return [];
      }
    },
  };
}
