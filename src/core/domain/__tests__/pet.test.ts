import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Prisma Mock Factory ────────────────────────────────────────────────────

function createMockDb() {
  const petStore = new Map<string, Record<string, unknown>>();
  let petIdCounter = 0;

  const db = {
    kingPet: {
      findUnique: vi.fn(async ({ where }: { where: { userId: string } }) => {
        return petStore.get(where.userId) ?? null;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const id = `pet_${++petIdCounter}`;
        const pet = { id, ...data };
        petStore.set(data.userId as string, pet);
        return pet;
      }),
      update: vi.fn(async ({ where, data }: { where: { userId: string }; data: Record<string, unknown> }) => {
        const pet = petStore.get(where.userId);
        if (!pet) throw new Error("Pet not found");
        Object.assign(pet, data);
        return pet;
      }),
    },
  };

  return db as unknown as import("@prisma/client").PrismaClient;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("pet lifecycle", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
  });

  describe("level up with enough XP", () => {
    it("levels up when XP crosses a 100-point threshold via feeding", async () => {
      const { ensurePet, feedPet } = await import("../../../domains/pet/lifecycle");

      // Create a pet with 80 XP (level 1, needs 20 more for level 2)
      await ensurePet(db, "user_lp");
      const pet = await (db as any).kingPet.findUnique({ where: { userId: "user_lp" } });
      pet.experience = 80;
      pet.level = 1;

      // feedPet adds +20 XP -> 100 XP -> level 2
      const result = await feedPet(db, "user_lp");

      expect(result.pet.level).toBe(2);
      expect(result.pet.experience).toBe(100);
    });

    it("does not level up when XP stays below threshold", async () => {
      const { ensurePet, restPet } = await import("../../../domains/pet/lifecycle");

      // Start at 0 XP (level 1), rest adds +10 XP -> 10 XP -> still level 1
      await ensurePet(db, "user_noup");
      const result = await restPet(db, "user_noup");

      expect(result.pet.level).toBe(1);
      expect(result.pet.experience).toBe(10);
      expect(result.evolved).toBe(false);
    });
  });

  describe("evolution at level 5 and 10", () => {
    it("evolves from hatchling to juvenile at level 5", async () => {
      const { ensurePet, feedPet } = await import("../../../domains/pet/lifecycle");

      await ensurePet(db, "user_evo5");
      const pet = await (db as any).kingPet.findUnique({ where: { userId: "user_evo5" } });
      pet.experience = 380; // level 4 (floor(380/100)+1 = 4)
      pet.level = 4;
      pet.stage = "hatchling";

      // feedPet adds +20 XP -> 400 -> level 5 -> juvenile
      const result = await feedPet(db, "user_evo5");

      expect(result.pet.level).toBe(5);
      expect(result.pet.stage).toBe("juvenile");
      expect(result.evolved).toBe(true);
    });

    it("evolves from juvenile to adult at level 10", async () => {
      const { ensurePet, feedPet } = await import("../../../domains/pet/lifecycle");

      await ensurePet(db, "user_evo10");
      const pet = await (db as any).kingPet.findUnique({ where: { userId: "user_evo10" } });
      pet.experience = 880; // level 9
      pet.level = 9;
      pet.stage = "juvenile";

      // feedPet adds +20 XP -> 900 -> level 10 -> adult
      const result = await feedPet(db, "user_evo10");

      expect(result.pet.level).toBe(10);
      expect(result.pet.stage).toBe("adult");
      expect(result.evolved).toBe(true);
    });

    it("does not evolve when level stays below threshold", async () => {
      const { ensurePet, feedPet } = await import("../../../domains/pet/lifecycle");

      await ensurePet(db, "user_noevo");
      const pet = await (db as any).kingPet.findUnique({ where: { userId: "user_noevo" } });
      pet.experience = 30; // level 1
      pet.level = 1;

      // feedPet adds +20 XP -> 50 -> level 1 -> still hatchling
      const result = await feedPet(db, "user_noevo");

      expect(result.pet.level).toBe(1);
      expect(result.pet.stage).toBe("hatchling");
      expect(result.evolved).toBe(false);
    });
  });

  describe("equip item with stage requirements", () => {
    it("allows buying an item when stage meets requirement", async () => {
      const { ensurePet, buyPetItem } = await import("../../../domains/pet/lifecycle");

      await ensurePet(db, "user_equip");
      const pet = await (db as any).kingPet.findUnique({ where: { userId: "user_equip" } });
      pet.stage = "juvenile";
      pet.bones = 100;

      // sunglasses requires "baby" stage (juvenile is higher)
      const result = await buyPetItem(db, "user_equip", "sunglasses");

      expect(result.success).toBe(true);
    });

    it("rejects buying an item when stage is too low", async () => {
      const { ensurePet, buyPetItem } = await import("../../../domains/pet/lifecycle");

      await ensurePet(db, "user_noquip");
      const pet = await (db as any).kingPet.findUnique({ where: { userId: "user_noquip" } });
      pet.stage = "hatchling";
      pet.bones = 200;

      // cape requires "adult" stage (hatchling is too low)
      const result = await buyPetItem(db, "user_noquip", "cape");

      expect(result.success).toBe(false);
      expect(result.error).toContain("must be");
    });

    it("rejects buying when bones are insufficient", async () => {
      const { ensurePet, buyPetItem } = await import("../../../domains/pet/lifecycle");

      await ensurePet(db, "user_poor");
      const pet = await (db as any).kingPet.findUnique({ where: { userId: "user_poor" } });
      pet.stage = "adult";
      pet.bones = 5; // golden_crown costs 60

      const result = await buyPetItem(db, "user_poor", "golden_crown");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Insufficient bones");
    });

    it("golden_crown requires juvenile stage", async () => {
      const { ensurePet, buyPetItem } = await import("../../../domains/pet/lifecycle");

      await ensurePet(db, "user_crown");
      const pet = await (db as any).kingPet.findUnique({ where: { userId: "user_crown" } });
      pet.stage = "hatchling";
      pet.bones = 200;

      const result = await buyPetItem(db, "user_crown", "golden_crown");

      expect(result.success).toBe(false);
      expect(result.error).toContain("juvenile");
    });
  });

  describe("wardrobe item definitions", () => {
    it("all items have valid prices", async () => {
      const { WARDROBE_ITEMS } = await import("../../../domains/pet/wardrobe");

      for (const item of Object.values(WARDROBE_ITEMS)) {
        expect(item.price).toBeGreaterThan(0);
        expect(item.minStage).toBeDefined();
      }
    });

    it("baby items are cheapest", async () => {
      const { WARDROBE_ITEMS } = await import("../../../domains/pet/wardrobe");

      const babyItems = Object.values(WARDROBE_ITEMS).filter((i) => i.minStage === "baby");
      const adultItems = Object.values(WARDROBE_ITEMS).filter((i) => i.minStage === "adult");

      const maxBaby = Math.max(...babyItems.map((i) => i.price));
      const minAdult = Math.min(...adultItems.map((i) => i.price));

      expect(maxBaby).toBeLessThan(minAdult);
    });
  });
});
