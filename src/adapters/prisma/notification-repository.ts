import { PrismaClient } from "../../generated/prisma/client";
import type { Notification } from "../../core/domain/types";
import type { NotificationRepository } from "../../core/ports/repositories";

// ── Domain <-> Prisma mapper ───────────────────────────────────────────────

function toDomainNotification(row: any): Notification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body || undefined,
    actorId: row.fromUserId ?? undefined,
    href: row.deepLink || undefined,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  };
}

// ── Adapter ────────────────────────────────────────────────────────────────

export function createNotificationRepository(db: PrismaClient): NotificationRepository {
  return {
    async create(notification: {
      userId: string;
      type: string;
      title: string;
      body?: string;
      actorId?: string;
      href?: string;
    }): Promise<Notification> {
      const row = await db.notification.create({
        data: {
          userId: notification.userId,
          type: notification.type,
          title: notification.title,
          body: notification.body ?? "",
          fromUserId: notification.actorId ?? null,
          deepLink: notification.href ?? "",
        },
      });
      return toDomainNotification(row);
    },

    async findByUserId(userId: string, limit: number = 50): Promise<Notification[]> {
      const rows = await db.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return rows.map(toDomainNotification);
    },

    async markRead(id: string): Promise<void> {
      await db.notification.update({
        where: { id },
        data: { read: true, readAt: new Date() },
      });
    },

    async markAllRead(userId: string): Promise<void> {
      await db.notification.updateMany({
        where: { userId, read: false },
        data: { read: true, readAt: new Date() },
      });
    },

    async clear(userId: string): Promise<void> {
      await db.notification.deleteMany({ where: { userId } });
    },

    async getUnreadCount(userId: string): Promise<number> {
      return db.notification.count({
        where: { userId, read: false },
      });
    },
  };
}
