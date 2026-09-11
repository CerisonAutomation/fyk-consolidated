// ═══════════════════════════════════════════════════════════════════════════════
// Application — King Pet Use Cases
// ═══════════════════════════════════════════════════════════════════════════════
//
// Orchestrates domain logic with repository ports.
// Contains NO Prisma imports — only port interfaces.

import type { PetRepository, WalletRepository } from "../ports/repositories";
import type { PetState, PetItem, PetAdventure } from "../domain/types";
import {
  calculateLevelUp,
  calculateEvolution,
  XP_PER_ACTION,
  canEquipItem,
  validateRename,
} from "../domain/pet";
import { ok, fail, type Result } from "../domain/errors";

// ─── Service ─────────────────────────────────────────────────────────────────

export class PetService {
  constructor(
    private petRepo: PetRepository,
    private walletRepo: WalletRepository,
  ) {}

  // ── Queries ──────────────────────────────────────────────────────────────

  /** Returns the pet for a user, creating one if it does not exist. */
  async getPet(userId: string): Promise<Result<PetState>> {
    const pet = await this.ensurePet(userId);
    return ok(pet);
  }

  /** Returns available wardrobe items from the catalog. */
  async getWardrobeItems(): Promise<Result<PetItem[]>> {
    const items = await this.petRepo.getItems();
    return ok(items);
  }

  /** Returns available adventures from the catalog. */
  async getAdventures(): Promise<Result<PetAdventure[]>> {
    const adventures = await this.petRepo.getAdventures();
    return ok(adventures);
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  /** Feed the pet: +20 XP, mood happy. */
  async feedPet(userId: string): Promise<Result<{ pet: PetState; evolved: boolean }>> {
    return this.action(userId, "feed");
  }

  /** Play with the pet: +25 XP, mood excited. */
  async playPet(userId: string): Promise<Result<{ pet: PetState; evolved: boolean }>> {
    return this.action(userId, "play");
  }

  /** Rest the pet: +10 XP, mood sleepy. */
  async restPet(userId: string): Promise<Result<{ pet: PetState; evolved: boolean }>> {
    return this.action(userId, "rest");
  }

  /** Dress the pet: +15 XP, mood happy. */
  async dressPet(userId: string): Promise<Result<{ pet: PetState; evolved: boolean }>> {
    return this.action(userId, "dress");
  }

  /** Send the pet on an adventure: costs bones from wallet, XP reward. */
  async adventurePet(
    userId: string,
    adventureId: string,
  ): Promise<Result<{ pet: PetState; evolved: boolean }>> {
    const pet = await this.ensurePet(userId);
    const adventures = await this.petRepo.getAdventures();
    const adventure = adventures.find((a) => a.id === adventureId);
    if (!adventure) {
      return fail("ADVENTURE_NOT_FOUND", `Adventure "${adventureId}" does not exist`);
    }

    // Check wallet balance
    const wallet = await this.walletRepo.findByUserId(userId);
    if (!wallet || wallet.balance < adventure.boneCost) {
      return fail("INSUFFICIENT_BONES", `Need ${adventure.boneCost} bones for this adventure`, {
        required: adventure.boneCost,
        available: wallet?.balance ?? 0,
      });
    }

    // Deduct bones from wallet
    await this.walletRepo.updateBalance(userId, -adventure.boneCost);
    await this.walletRepo.addTransaction(wallet.id, {
      type: "debit",
      amount: adventure.boneCost,
      description: `Adventure: ${adventure.theme ?? adventure.id}`,
    });

    // Compute new XP & level using domain function
    const { experience, level, leveled } = calculateLevelUp(
      pet.experience + adventure.rewardAmount,
      pet.level,
    );
    const stage = calculateEvolution(level, pet.stage);

    const updated = await this.petRepo.update(userId, {
      experience,
      level,
      stage,
      mood: "excited",
      adventures: [...pet.adventures, adventureId],
      happiness: Math.min(100, pet.happiness + 30),
      lastAdventureAt: new Date().toISOString(),
    });

    return ok({ pet: updated, evolved: leveled });
  }

  /** Buy a wardrobe item. Checks stage requirement and deducts bones. */
  async buyPetItem(
    userId: string,
    itemId: string,
  ): Promise<Result<{ pet: PetState }>> {
    const pet = await this.ensurePet(userId);
    const items = await this.petRepo.getItems();
    const item = items.find((i) => i.id === itemId);
    if (!item) {
      return fail("ITEM_NOT_FOUND", `Wardrobe item "${itemId}" does not exist`);
    }

    // Check stage requirement using domain function
    if (!canEquipItem(pet.stage, item.stageRequired)) {
      return fail("STAGE_REQUIREMENT", `Pet must be ${item.stageRequired} or higher to wear this item`, {
        currentStage: pet.stage,
        requiredStage: item.stageRequired,
      });
    }

    // Check if already owned
    if (pet.wardrobe.includes(item.id)) {
      return fail("ALREADY_OWNED", `Pet already owns "${item.name}"`);
    }

    // Check wallet
    const wallet = await this.walletRepo.findByUserId(userId);
    if (!wallet || wallet.balance < item.boneCost) {
      return fail("INSUFFICIENT_BONES", `Need ${item.boneCost} bones but have ${wallet?.balance ?? 0}`, {
        required: item.boneCost,
        available: wallet?.balance ?? 0,
      });
    }

    // Deduct bones
    await this.walletRepo.updateBalance(userId, -item.boneCost);
    await this.walletRepo.addTransaction(wallet.id, {
      type: "debit",
      amount: item.boneCost,
      description: `Purchased ${item.name}`,
    });

    // Add item to wardrobe
    const updated = await this.petRepo.update(userId, {
      wardrobe: [...pet.wardrobe, item.id],
    });

    return ok({ pet: updated });
  }

  /** Toggle equip/unequip a wardrobe item the pet owns. */
  async equipPetItem(
    userId: string,
    itemId: string,
  ): Promise<Result<{ pet: PetState; equipped: boolean }>> {
    const pet = await this.ensurePet(userId);

    // Must own the item
    if (!pet.wardrobe.includes(itemId)) {
      return fail("NOT_OWNED", `Pet does not own wardrobe item "${itemId}"`);
    }

    const currentlyEquipped = new Set(pet.equipped);
    const isEquipped = currentlyEquipped.has(itemId);

    if (isEquipped) {
      currentlyEquipped.delete(itemId);
    } else {
      currentlyEquipped.add(itemId);
    }

    const updated = await this.petRepo.update(userId, {
      equipped: [...currentlyEquipped],
    });

    return ok({ pet: updated, equipped: !isEquipped });
  }

  /** Rename the pet. Validates 2-16 characters, alphanumeric. */
  async renamePet(userId: string, name: string): Promise<Result<{ pet: PetState }>> {
    // Use domain validation function
    const validation = validateRename(name);
    if (!validation.ok) {
      return validation as Result<{ pet: PetState }>;
    }

    // Ensure pet exists
    await this.ensurePet(userId);

    const updated = await this.petRepo.update(userId, { name: name.trim() });
    return ok({ pet: updated });
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async ensurePet(userId: string): Promise<PetState> {
    let pet = await this.petRepo.findByUserId(userId);
    if (!pet) {
      pet = await this.petRepo.create(userId);
    }
    return pet;
  }

  /** Shared action handler for feed/play/rest/dress. */
  private async action(
    userId: string,
    type: string,
  ): Promise<Result<{ pet: PetState; evolved: boolean }>> {
    const pet = await this.ensurePet(userId);
    const gained = XP_PER_ACTION[type] ?? 0;

    const { experience, level, leveled } = calculateLevelUp(
      pet.experience + gained,
      pet.level,
    );
    const stage = calculateEvolution(level, pet.stage);

    const moodMap: Record<string, string> = {
      feed: "happy",
      play: "excited",
      rest: "sleepy",
      dress: "happy",
    };

    const updated = await this.petRepo.update(userId, {
      experience,
      level,
      stage,
      mood: (moodMap[type] ?? "happy") as PetState["mood"],
    });

    return ok({ pet: updated, evolved: leveled });
  }
}
