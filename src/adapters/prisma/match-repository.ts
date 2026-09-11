import { PrismaClient } from "../../generated/prisma";
import type {
  Tap,
  Match,
  Favorite,
  Block,
  Report,
} from "../../core/domain/types";
import type { MatchRepository } from "../../core/ports/repositories";

// ── Domain <-> Prisma mappers ──────────────────────────────────────────────

function toDomainTap(row: any): Tap {
  return {
    id: row.id,
    tapperId: row.fromId,
    tappedId: row.toId,
    type: row.kind,
    isSuper: row.kind === "superLike" || row.kind === "crush",
    createdAt: row.createdAt.toISOString(),
  };
}

function toDomainMatch(row: any): Match {
  return {
    id: row.id,
    user1Id: row.user1Id,
    user2Id: row.user2Id,
    status: row.unmatchedAt ? "unmatched" : "active",
    createdAt: row.createdAt.toISOString(),
    unmatchedAt: row.unmatchedAt?.toISOString(),
  };
}

function toDomainFavorite(row: any): Favorite {
  return {
    id: row.id,
    userId: row.userId,
    targetId: row.profileId,
    createdAt: row.createdAt.toISOString(),
  };
}

function toDomainBlock(row: any): Block {
  return {
    id: row.id,
    blockerId: row.fromId,
    blockedId: row.toId,
    reason: row.reason || undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function toDomainReport(row: any): Report {
  return {
    id: row.id,
    reporterId: row.reporterId,
    reportedId: row.reportedId,
    reason: row.reason,
    details: row.details || undefined,
    evidence: (row.evidence as string[]) ?? [],
    status: row.status,
    priority: "normal",
    createdAt: row.createdAt.toISOString(),
  };
}

// ── Adapter ────────────────────────────────────────────────────────────────

export function createMatchRepository(db: PrismaClient): MatchRepository {
  return {
    async findIncomingTaps(userId: string): Promise<Tap[]> {
      const rows = await db.tap.findMany({
        where: { toId: userId },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toDomainTap);
    },

    async findOutgoingTaps(userId: string): Promise<Tap[]> {
      const rows = await db.tap.findMany({
        where: { fromId: userId },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toDomainTap);
    },

    async findMatches(userId: string): Promise<Match[]> {
      const rows = await db.match.findMany({
        where: {
          OR: [{ user1Id: userId }, { user2Id: userId }],
          unmatchedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toDomainMatch);
    },

    async createTap(tapperId: string, tappedId: string, type: string = "tap"): Promise<Tap> {
      const row = await db.tap.upsert({
        where: {
          fromId_toId: { fromId: tapperId, toId: tappedId },
        },
        create: {
          fromId: tapperId,
          toId: tappedId,
          kind: type,
        },
        update: {
          kind: type,
        },
      });
      return toDomainTap(row);
    },

    async deleteTap(tapperId: string, tappedId: string): Promise<void> {
      await db.tap.deleteMany({
        where: { fromId: tapperId, toId: tappedId },
      });
    },

    async createMatch(user1Id: string, user2Id: string): Promise<Match> {
      // Canonical ordering: smaller UUID first
      const [id1, id2] = [user1Id, user2Id].sort();
      const row = await db.match.create({
        data: {
          user1Id: id1,
          user2Id: id2,
          matchType: "like",
        },
      });
      return toDomainMatch(row);
    },

    async findReciprocalTap(fromId: string, toId: string): Promise<Tap | null> {
      const row = await db.tap.findUnique({
        where: { fromId_toId: { fromId: toId, toId: fromId } },
      });
      return row ? toDomainTap(row) : null;
    },

    async findFavorites(userId: string): Promise<Favorite[]> {
      const rows = await db.favorite.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toDomainFavorite);
    },

    async addFavorite(userId: string, targetId: string): Promise<Favorite> {
      const row = await db.favorite.upsert({
        where: {
          userId_profileId: { userId, profileId: targetId },
        },
        create: {
          userId,
          profileId: targetId,
        },
        update: {},
      });
      return toDomainFavorite(row);
    },

    async removeFavorite(userId: string, targetId: string): Promise<void> {
      await db.favorite.deleteMany({
        where: { userId, profileId: targetId },
      });
    },

    async findBlocks(userId: string): Promise<Block[]> {
      const rows = await db.block.findMany({
        where: { fromId: userId },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toDomainBlock);
    },

    async blockUser(blockerId: string, blockedId: string, reason?: string): Promise<Block> {
      const row = await db.block.upsert({
        where: {
          fromId_toId: { fromId: blockerId, toId: blockedId },
        },
        create: {
          fromId: blockerId,
          toId: blockedId,
          reason: reason ?? "",
        },
        update: {
          reason: reason ?? "",
        },
      });
      return toDomainBlock(row);
    },

    async unblockUser(blockerId: string, blockedId: string): Promise<void> {
      await db.block.deleteMany({
        where: { fromId: blockerId, toId: blockedId },
      });
    },

    async createReport(data: {
      reporterId: string;
      reportedId: string;
      reason: string;
      details?: string;
    }): Promise<Report> {
      const row = await db.report.create({
        data: {
          reporterId: data.reporterId,
          reportedId: data.reportedId,
          reason: data.reason,
          details: data.details ?? "",
          status: "open",
        },
      });
      return toDomainReport(row);
    },
  };
}
