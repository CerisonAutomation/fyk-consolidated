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

export const Route = createFileRoute("/api/push/subscribe")({
  server: {
    handlers: {
      POST: withSecurity(async ({ request }) => {
        const user = await getCurrentUser(request);
        if (!user) {
          return jsonError("Unauthorized", 401);
        }

        // Rate limit: 10 requests per 15 minutes per user
        const rateLimitResult = await checkRateLimit(`push:${user.id}`, 10, 15 * 60 * 1000);
        if (!rateLimitResult.allowed) {
          return jsonError("Rate limit exceeded", 429);
        }

        const bodyResult = await parseJsonBody<{
          endpoint?: string;
          p256dh?: string;
          auth?: string;
        }>(request, 16 * 1024); // 16KB max

        if (!bodyResult.ok) return bodyResult.response;
        const { endpoint, p256dh, auth: authKey } = bodyResult.data;

        // Validate required fields
        const endpointResult = validateString(endpoint, "endpoint", { min: 10, max: 1000 });
        if (!endpointResult.ok) return jsonError(endpointResult.error, 400);

        const p256dhResult = validateString(p256dh, "p256dh", { min: 10, max: 1000 });
        if (!p256dhResult.ok) return jsonError(p256dhResult.error, 400);

        const authResult = validateString(authKey, "auth", { min: 10, max: 1000 });
        if (!authResult.ok) return jsonError(authResult.error, 400);

        // Validate endpoint URL format (prevent SSRF via push subscription)
        try {
          const url = new URL(endpointResult.value);
          if (!["https:"].includes(url.protocol)) {
            return jsonError("Push endpoint must use HTTPS", 400);
          }
        } catch {
          return jsonError("Invalid push endpoint URL", 400);
        }

        // Upsert: store or update the push subscription
        const existing = await prisma.pushSubscription.findFirst({
          where: { userId: user.id, endpoint: endpointResult.value },
        });

        if (existing) {
          await prisma.pushSubscription.update({
            where: { id: existing.id },
            data: { p256dh: p256dhResult.value, auth: authResult.value },
          });
        } else {
          await prisma.pushSubscription.create({
            data: {
              userId: user.id,
              endpoint: endpointResult.value,
              p256dh: p256dhResult.value,
              auth: authResult.value,
            },
          });
        }

        return json({ ok: true });
      }, { maxBodySize: 16 * 1024 }),
    },
  },
});
