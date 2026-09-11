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

const MEETNOW_EXPIRY_HOURS = 4;

// -- Route --

export const Route = createFileRoute("/api/meetnow/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Rate limit: 100 requests per 15 minutes per IP
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
        const rateLimitResult = await checkRateLimit(`meetnow:GET:${ip}`, 100, 15 * 60 * 1000);
        if (!rateLimitResult.allowed) {
          return jsonError("Rate limit exceeded", 429);
        }

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

      POST: withSecurity(async ({ request }) => {
        const user = await getCurrentUser(request);
        if (!user) {
          return jsonError("Unauthorized", 401);
        }

        // Rate limit: 10 mutations per 15 minutes per user
        const rateLimitResult = await checkRateLimit(`meetnow:POST:${user.id}`, 10, 15 * 60 * 1000);
        if (!rateLimitResult.allowed) {
          return jsonError("Rate limit exceeded", 429);
        }

        const bodyResult = await parseJsonBody<{
          action?: string;
          postId?: string;
          category?: string;
          note?: string;
          location?: string;
        }>(request, 32 * 1024); // 32KB max

        if (!bodyResult.ok) return bodyResult.response;
        const { action, postId, category, note, location } = bodyResult.data;

        // -- Create a new MeetNow post --
        if (!action || action === "create") {
          const catResult = validateString(category, "category", { min: 1, max: 50 });
          if (!catResult.ok) return jsonError(catResult.error, 400);

          if (note && note.length > 500) {
            return jsonError("Note must be at most 500 characters", 400);
          }
          if (location && location.length > 200) {
            return jsonError("Location must be at most 200 characters", 400);
          }

          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + MEETNOW_EXPIRY_HOURS);

          const post = await prisma.meetNowPost.create({
            data: {
              userId: user.id,
              category: catResult.value,
              place: note?.trim() || "",
              location: location?.trim() || null,
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

        // -- Join a MeetNow post --
        if (action === "join") {
          const idResult = validateString(postId, "postId");
          if (!idResult.ok) return jsonError(idResult.error, 400);

          const post = await prisma.meetNowPost.findUnique({
            where: { id: idResult.value },
          });

          if (!post) return jsonError("Post not found", 404);
          if (post.status !== "active")
            return jsonError("Post is no longer active", 400);
          if (post.expiresAt < new Date())
            return jsonError("Post has expired", 400);
          if (post.userId === user.id)
            return jsonError("Cannot join your own post", 400);

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

        return jsonError("Unknown action", 400);
      }, { maxBodySize: 32 * 1024 }),
    },
  },
});
