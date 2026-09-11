import { createFileRoute } from "@tanstack/react-router";
import { prisma } from "#/db";
import { auth } from "#/lib/auth";
import { withSecurity, json, jsonError, parseJsonBody, validateString } from "#/middleware";
import { checkRateLimit } from "#/lib/rate-limit";

// -- Helpers --

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

// -- Route --

export const Route = createFileRoute("/api/notifications/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Rate limit: 100 requests per 15 minutes per IP
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
        const rateLimitResult = await checkRateLimit(`notifications:GET:${ip}`, 100, 15 * 60 * 1000);
        if (!rateLimitResult.allowed) {
          return jsonError("Rate limit exceeded", 429);
        }

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

      POST: withSecurity(async ({ request }) => {
        const user = await getCurrentUser(request);
        if (!user) {
          return jsonError("Unauthorized", 401);
        }

        // Rate limit: 30 mutations per 15 minutes per user
        const rateLimitResult = await checkRateLimit(`notifications:POST:${user.id}`, 30, 15 * 60 * 1000);
        if (!rateLimitResult.allowed) {
          return jsonError("Rate limit exceeded", 429);
        }

        const bodyResult = await parseJsonBody<{
          action?: string;
          notificationId?: string;
        }>(request);

        if (!bodyResult.ok) return bodyResult.response;
        const { action, notificationId } = bodyResult.data;

        // -- Mark single notification as read --
        if (action === "markRead" && notificationId) {
          const idResult = validateString(notificationId, "notificationId");
          if (!idResult.ok) return jsonError(idResult.error, 400);

          await prisma.notification.updateMany({
            where: { id: idResult.value, userId: user.id },
            data: { read: true, readAt: new Date() },
          });
          return json({ ok: true });
        }

        // -- Mark all as read --
        if (action === "markAllRead") {
          await prisma.notification.updateMany({
            where: { userId: user.id, read: false },
            data: { read: true, readAt: new Date() },
          });
          return json({ ok: true });
        }

        // -- Clear all notifications --
        if (action === "clear") {
          await prisma.notification.deleteMany({
            where: { userId: user.id },
          });
          return json({ ok: true });
        }

        return jsonError("Unknown action", 400);
      }, { maxBodySize: 4 * 1024 }), // 4KB max for notification actions
    },
  },
});
