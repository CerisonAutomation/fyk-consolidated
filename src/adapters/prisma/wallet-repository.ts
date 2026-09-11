import { PrismaClient } from "../../generated/prisma/client";
import type {
  Wallet,
  WalletTransaction,
  Consumable,
} from "../../core/domain/types";
import type { WalletRepository } from "../../core/ports/repositories";

// ── Domain <-> Prisma mappers ──────────────────────────────────────────────

function toDomainWallet(row: any): Wallet {
  return {
    id: row.id,
    userId: row.userId,
    balance: row.balance,
    currency: "bones",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDomainTransaction(row: any): WalletTransaction {
  return {
    id: row.id,
    walletId: row.walletId,
    type: row.type,
    amount: row.amount,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
  };
}

function toDomainConsumable(row: any): Consumable {
  return {
    id: row.id,
    userId: row.userId,
    type: row.itemKey,
    quantity: row.quantity,
    expiresAt: row.expiresAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

// ── Adapter ────────────────────────────────────────────────────────────────

export function createWalletRepository(db: PrismaClient): WalletRepository {
  return {
    async findByUserId(userId: string): Promise<Wallet | null> {
      const row = await db.wallet.findUnique({
        where: { userId },
      });
      return row ? toDomainWallet(row) : null;
    },

    async create(userId: string): Promise<Wallet> {
      const row = await db.wallet.create({
        data: {
          userId,
          balance: 50,
          lifetime: 50,
        },
      });
      return toDomainWallet(row);
    },

    async updateBalance(userId: string, delta: number): Promise<Wallet> {
      const row = await db.wallet.update({
        where: { userId },
        data: {
          balance: { increment: delta },
          lifetime: delta > 0 ? { increment: delta } : undefined,
        },
      });
      return toDomainWallet(row);
    },

    async addTransaction(
      walletId: string,
      tx: { type: "credit" | "debit" | "refund"; amount: number; description: string },
    ): Promise<WalletTransaction> {
      // Fetch current wallet balance for the snapshot
      const wallet = await db.wallet.findUnique({ where: { id: walletId } });
      if (!wallet) throw new Error("Wallet not found");

      const balanceAfter =
        tx.type === "debit" ? wallet.balance - tx.amount : wallet.balance + tx.amount;

      const row = await db.walletTransaction.create({
        data: {
          walletId,
          userId: wallet.userId,
          type: tx.type,
          amount: tx.amount,
          balance: balanceAfter,
          description: tx.description,
        },
      });

      return toDomainTransaction(row);
    },

    async getTransactions(
      walletId: string,
      limit: number = 50,
    ): Promise<WalletTransaction[]> {
      const rows = await db.walletTransaction.findMany({
        where: { walletId },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return rows.map(toDomainTransaction);
    },

    async getConsumables(userId: string): Promise<Consumable[]> {
      const rows = await db.consumablesInventory.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toDomainConsumable);
    },

    async upsertConsumable(
      userId: string,
      type: string,
      quantityDelta: number,
    ): Promise<Consumable> {
      const row = await db.consumablesInventory.upsert({
        where: {
          userId_itemKey: { userId, itemKey: type },
        },
        create: {
          userId,
          itemKey: type,
          quantity: Math.max(0, quantityDelta),
        },
        update: {
          quantity: { increment: quantityDelta },
        },
      });
      return toDomainConsumable(row);
    },
  };
}
