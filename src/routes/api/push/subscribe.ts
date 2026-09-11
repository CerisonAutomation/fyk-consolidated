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

export const Route = createFileRoute("/api/push/subscribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getCurrentUser(request);
        if (!user) {
          return json({ error: "Unauthorized" }, 401);
        }

        const body = await request.json();
        const { endpoint, p256dh, auth: authKey } = body;

        if (!endpoint || !p256dh || !authKey) {
          return json({ error: "Missing push subscription fields" }, 400);
        }

        // Upsert: store or update the push subscription
        const existing = await prisma.pushSubscription.findFirst({
          where: { userId: user.id, endpoint },
        });

        if (existing) {
          await prisma.pushSubscription.update({
            where: { id: existing.id },
            data: { p256dh, auth: authKey },
          });
        } else {
          await prisma.pushSubscription.create({
            data: {
              userId: user.id,
              endpoint,
              p256dh,
              auth: authKey,
            },
          });
        }

        return json({ ok: true });
      },
    },
  },
});
