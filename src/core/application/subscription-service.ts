import type { WalletRepository, SubscriptionRepository } from "../ports/repositories";
import { canAfford } from "../domain/wallet";
import { ok, fail, type Result } from "../domain/errors";
import type { Wallet, Subscription, ShopItem } from "../domain/types";

const SHOP_ITEMS: ShopItem[] = [
  { id: "tap_boost", name: "Tap Boost", emoji: "🚀", description: "Get seen by 5x more kings for 30 min", boneCost: 50, type: "boost" },
  { id: "boost", name: "Profile Boost", emoji: "⚡", description: "Top of the grid for 60 minutes", boneCost: 120, type: "boost" },
  { id: "gift_heart", name: "Heart Gift", emoji: "❤️", description: "Send to a favourite king", boneCost: 20, type: "gift" },
  { id: "gift_fire", name: "Fire Gift", emoji: "🔥", description: "Show serious interest", boneCost: 35, type: "gift" },
  { id: "gift_star", name: "Star Gift", emoji: "⭐", description: "The ultimate flex", boneCost: 60, type: "gift" },
];

const TIER_DEFS = [
  { tier: "plus" as const, name: "Plus", price: "$9.99/mo", perks: ["Unlimited taps", "Advanced filters", "Who viewed you", "25 AI features/day", "No ads"] },
  { tier: "gold" as const, name: "Gold", price: "$19.99/mo", perks: ["Everything in Plus", "Incognito mode", "Unlimited AI", "Video calls", "King Pet premium", "See all taps"] },
  { tier: "platinum" as const, name: "Platinum", price: "$29.99/mo", perks: ["Everything in Gold", "Priority support", "Exclusive events", "10 boosts/month", "Travel mode", "Undo tap"] },
];

export class SubscriptionService {
  constructor(
    private walletRepo: WalletRepository,
    private subscriptionRepo: SubscriptionRepository,
  ) {}

  async getWallet(userId: string): Promise<Result<{ wallet: Wallet; shop: ShopItem[]; tiers: typeof TIER_DEFS; consumables: any[]; subscription: Subscription | null }>> {
    const wallet = await this.walletRepo.findByUserId(userId);
    if (!wallet) {
      const created = await this.walletRepo.create(userId);
      const consumables = await this.walletRepo.getConsumables(userId);
      const sub = await this.subscriptionRepo.findByUserId(userId);
      return ok({ wallet: created, shop: SHOP_ITEMS, tiers: TIER_DEFS, consumables, subscription: sub });
    }
    const consumables = await this.walletRepo.getConsumables(userId);
    const sub = await this.subscriptionRepo.findByUserId(userId);
    return ok({ wallet, shop: SHOP_ITEMS, tiers: TIER_DEFS, consumables, subscription: sub });
  }

  async buyItem(userId: string, itemId: string): Promise<Result<{ balance: number }>> {
    const item = SHOP_ITEMS.find((i) => i.id === itemId);
    if (!item) return fail({ code: "NOT_FOUND", message: "Item not found" } as any);

    const wallet = await this.walletRepo.findByUserId(userId);
    if (!wallet) return fail({ code: "NOT_FOUND", message: "Wallet not found" } as any);
    if (!canAfford(wallet.balance, item.boneCost)) return fail({ code: "INSUFFICIENT_FUNDS", message: "Not enough bones" } as any);

    await this.walletRepo.updateBalance(userId, -item.boneCost);
    await this.walletRepo.addTransaction(wallet.id, { type: "debit", amount: item.boneCost, description: item.name });
    await this.walletRepo.upsertConsumable(userId, item.type, 1);

    return ok({ balance: wallet.balance - item.boneCost });
  }

  async claimDailyReward(userId: string): Promise<Result<{ balance: number }>> {
    const wallet = await this.walletRepo.findByUserId(userId);
    if (!wallet) return fail({ code: "NOT_FOUND", message: "Wallet not found" } as any);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const txs = await this.walletRepo.getTransactions(wallet.id, 20);
    if (txs.some((t) => t.description === "Daily reward" && new Date(t.createdAt) >= today)) {
      return fail({ code: "ALREADY_CLAIMED", message: "Already claimed today" } as any);
    }

    await this.walletRepo.updateBalance(userId, 15);
    await this.walletRepo.addTransaction(wallet.id, { type: "credit", amount: 15, description: "Daily reward" });
    return ok({ balance: wallet.balance + 15 });
  }

  async subscribe(userId: string, tier: string): Promise<Result<{ tier: string }>> {
    const def = TIER_DEFS.find((t) => t.tier === tier);
    if (!def) return fail({ code: "INVALID_TIER", message: "Invalid tier" } as any);
    await this.subscriptionRepo.delete(userId);
    await this.subscriptionRepo.create(userId, tier);
    return ok({ tier });
  }

  async cancelSubscription(userId: string): Promise<Result<void>> {
    await this.subscriptionRepo.delete(userId);
    return ok(undefined);
  }
}
