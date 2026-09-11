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

const MEETNOW_EXPIRY_HOURS = 4;

// ── Route ──────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/api/meetnow/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getCurrentUser(request);
        if (!user) {
          return json({ posts: [] });
        }

        const now = new Date();

        const posts = await prisma.meetNowPost.findMany({
          where: {
            status: "active",
            expiresAt: { gt: now },
          },
          include: {
            user: {
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
          orderBy: { createdAt: "desc" },
          take: 50,
        });


        const mapped = posts.map((post) => ({
          id: post.id,
          user_id: post.userId,
          category: post.category,
          note: post.place ?? "",
          location: post.location ?? "",
          expires_at: post.expiresAt.toISOString(),
          active: post.status === "active",
          created_at: post.createdAt.toISOString(),
          user: post.user
            ? {
                id: post.user.id,
                pseudo: post.user.name ?? "",
                nick: post.user.handle ?? "",
                photos: post.user.avatar ? [post.user.avatar] : [],
                online: post.user.online,
                verified: false,
                tribes: [] as string[],
                geo: post.user.city
                  ? { lat: 0, lng: 0, city: post.user.city }
                  : undefined,
                lastSeen: post.user.lastActive?.toISOString() ?? "",
                status: "online",
              }
            : undefined,
        }));

        return json({ posts: mapped });
      },

      POST: async ({ request }) => {
        const user = await getCurrentUser(request);
        if (!user) {
          return json({ error: "Unauthorized" }, 401);
        }

        const body = await request.json();
        const { action, postId, category, note, location } = body;

        // ── Create a new MeetNow post ─────────────────────────────────
        if (!action || action === "create") {
          if (!category) {
            return json({ error: "category required" }, 400);
          }

          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + MEETNOW_EXPIRY_HOURS);

          const post = await prisma.meetNowPost.create({
            data: {
              userId: user.id,
              category,
              place: note ?? "",
              location: location ?? null,
              status: "active",
              expiresAt,
            },
            include: {
              user: {
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
          });

          return json({
            ok: true,
            post: {
              id: post.id,
              user_id: post.userId,
              category: post.category,
              note: post.place ?? "",
              location: post.location ?? "",
              expires_at: post.expiresAt.toISOString(),
              active: true,
              created_at: post.createdAt.toISOString(),
              user: post.user
                ? {
                    id: post.user.id,
                    pseudo: post.user.name ?? "",
                    nick: post.user.handle ?? "",
                    photos: post.user.avatar ? [post.user.avatar] : [],
                    online: post.user.online,
                    verified: false,
                    tribes: [] as string[],
                    geo: post.user.city
                      ? { lat: 0, lng: 0, city: post.user.city }
                      : undefined,
                    lastSeen: post.user.lastActive?.toISOString() ?? "",
                    status: "online",
                  }
                : undefined,
            },
          });
        }

        // ── Join a MeetNow post ───────────────────────────────────────
        if (action === "join") {
          if (!postId) {
            return json({ error: "postId required" }, 400);
          }

          const post = await prisma.meetNowPost.findUnique({
            where: { id: postId },
          });

          if (!post) return json({ error: "Post not found" }, 404);
          if (post.status !== "active")
            return json({ error: "Post is no longer active" }, 400);
          if (post.expiresAt < new Date())
            return json({ error: "Post has expired" }, 400);
          if (post.userId === user.id)
            return json({ error: "Cannot join your own post" }, 400);

          // Send a tap to the post author (if not already sent)
          const existingTap = await prisma.tap.findUnique({
            where: { fromId_toId: { fromId: user.id, toId: post.userId } },
          });

          if (!existingTap) {
            await prisma.tap.create({
              data: {
                fromId: user.id,
                toId: post.userId,
                kind: "meetnow_join",
              },
            });
          }

          // Create notification for the post author
          await prisma.notification.create({
            data: {
              userId: post.userId,
              type: "meetnow",
              title: "MeetNow Join",
              body: `Someone joined your MeetNow post at ${post.place || "unknown location"}!`,
              deepLink: `/meetnow/${postId}`,
              fromUserId: user.id,
            },
          });

          return json({ ok: true });
        }

        return json({ error: "Unknown action" }, 400);
      },
    },
  },
});
