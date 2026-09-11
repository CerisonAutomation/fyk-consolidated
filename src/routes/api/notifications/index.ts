import { createFileRoute } from "@tanstack/react-router";
import { prisma } from "#/db";
import { auth } from "#/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

async function getCurrentUser(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    return session?.user ?? null;
  } catch {
    return null;
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Route ──────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/api/notifications/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getCurrentUser(request);
        if (!user) {
          return json({ notifications: [], unread: 0 });
        }

        const [notifications, unread] = await Promise.all([
          prisma.notification.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            take: 50,
            include: {
              actor: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                  handle: true,
                  online: true,
                  lastActive: true,
                  city: true,
                  area: true,
                },
              },
            },
          }),
          prisma.notification.count({
            where: { userId: user.id, read: false },
          }),
        ]);

        const mapped = notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body ?? undefined,
          actor_id: n.fromUserId ?? undefined,
          href: n.deepLink ?? undefined,
          read: n.read,
          created_at: n.createdAt.toISOString(),
          actor: n.actor
            ? {
                id: n.actor.id,
                pseudo: n.actor.name ?? "",
                nick: n.actor.handle ?? "",
                photos: n.actor.avatar ? [n.actor.avatar] : [],
                online: n.actor.online,
                tribes: [] as string[],
                geo: n.actor.city
                  ? { lat: 0, lng: 0, city: n.actor.city }
                  : undefined,
                lastSeen: n.actor.lastActive?.toISOString() ?? "",
                status: "online",
              }
            : undefined,
        }));

        return json({ notifications: mapped, unread });
      },

      POST: async ({ request }) => {
        const user = await getCurrentUser(request);
        if (!user) {
          return json({ error: "Unauthorized" }, 401);
        }

        const body = await request.json();
        const { action, notificationId } = body;

        // ── Mark single notification as read ──────────────────────────
        if (action === "markRead" && notificationId) {
          await prisma.notification.updateMany({
            where: { id: notificationId, userId: user.id },
            data: { read: true, readAt: new Date() },
          });
          return json({ ok: true });
        }

        // ── Mark all as read ──────────────────────────────────────────
        if (action === "markAllRead") {
          await prisma.notification.updateMany({
            where: { userId: user.id, read: false },
            data: { read: true, readAt: new Date() },
          });
          return json({ ok: true });
        }

        // ── Clear all notifications ───────────────────────────────────
        if (action === "clear") {
          await prisma.notification.deleteMany({
            where: { userId: user.id },
          });
          return json({ ok: true });
        }

        return json({ error: "Unknown action" }, 400);
      },
    },
  },
});
