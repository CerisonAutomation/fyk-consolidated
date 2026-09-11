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

export const Route = createFileRoute("/api/events/")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        // Rate limit: 100 requests per 15 minutes per IP
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
        const rateLimitResult = await checkRateLimit(`events:GET:${ip}`, 100, 15 * 60 * 1000);
        if (!rateLimitResult.allowed) {
          return jsonError("Rate limit exceeded", 429);
        }

        const user = await getCurrentUser(request);

        const events = await prisma.event.findMany({
          where: { status: "published" },
          orderBy: { startsAt: "asc" },
          take: 100,
          include: {
            rsvps: {
              select: { profileId: true, status: true },
            },
            host: {
              select: { id: true, name: true, avatar: true, handle: true },
            },
          },
        });

        const mapped = events.map((e) => {
          const rsvpCount = e.rsvps.filter((r) => r.status === "going").length;
          const userRsvp = user
            ? e.rsvps.find((r) => r.profileId === user.id)
            : null;

          return {
            id: e.id,
            name: e.title,
            description: e.description ?? "",
            category: e.activityId ?? "Other",
            location: [e.venue, e.address, e.city].filter(Boolean).join(", "),
            lat: e.lat,
            lng: e.lng,
            start_time: e.startsAt.toISOString(),
            end_time: e.endsAt?.toISOString() ?? null,
            created_by: e.hostId,
            max_attendees: e.capacity,
            cost: e.cost,
            status: e.status,
            tags: [] as string[],
            attendee_count: rsvpCount,
            attending: userRsvp?.status === "going" ? true : null,
            isMine: user ? e.hostId === user.id : false,
            creator: e.host
              ? {
                  id: e.host.id,
                  name: e.host.name,
                  avatar: e.host.avatar,
                  handle: e.host.handle,
                }
              : null,
          };
        });

        return json({ events: mapped });
      },

      POST: withSecurity(async ({ request }: { request: Request }) => {
        // Rate limit: 20 mutations per 15 minutes per user
        const user = await getCurrentUser(request);
        if (!user) {
          return jsonError("Unauthorized", 401);
        }

        const rateLimitResult = await checkRateLimit(`events:POST:${user.id}`, 20, 15 * 60 * 1000);
        if (!rateLimitResult.allowed) {
          return jsonError("Rate limit exceeded", 429);
        }

        const bodyResult = await parseJsonBody<{
          action?: string;
          name?: string;
          description?: string;
          category?: string;
          location?: string;
          start_time?: string;
          max_attendees?: number;
          cost?: string;
          eventId?: string;
        }>(request);

        if (!bodyResult.ok) return bodyResult.response;
        const body = bodyResult.data;
        const { action } = body;

        // -- Create event --
        if (action === "create") {
          const nameResult = validateString(body.name, "Title", { min: 3, max: 200 });
          if (!nameResult.ok) return jsonError(nameResult.error, 400);

          // Validate optional fields
          if (body.description && body.description.length > 5000) {
            return jsonError("Description must be at most 5000 characters", 400);
          }
          if (body.max_attendees !== undefined) {
            const capacity = Number(body.max_attendees);
            if (!Number.isFinite(capacity) || capacity < 1 || capacity > 10000) {
              return jsonError("Capacity must be between 1 and 10,000", 400);
            }
          }

          const event = await prisma.event.create({
            data: {
              hostId: user.id,
              title: nameResult.value,
              description: body.description?.trim() || null,
              activityId: body.category?.trim() || null,
              venue: body.location?.trim() || null,
              startsAt: body.start_time
                ? new Date(body.start_time)
                : new Date(Date.now() + 7 * 86400000),
              capacity: body.max_attendees ? Number(body.max_attendees) : null,
              cost: body.cost ? String(body.cost).trim().slice(0, 50) : null,
              status: "published",
            },
          });

          // Auto-RSVP the host as going
          await prisma.eventRsvp.create({
            data: {
              eventId: event.id,
              profileId: user.id,
              status: "going",
            },
          });

          return json({ ok: true, eventId: event.id });
        }

        // -- RSVP (join / leave) --
        if (action === "join" || action === "leave") {
          const eventIdResult = validateString(body.eventId, "eventId");
          if (!eventIdResult.ok) return jsonError(eventIdResult.error, 400);

          if (action === "join") {
            // Check capacity
            const event = await prisma.event.findUnique({
              where: { id: eventIdResult.value },
              include: { rsvps: { where: { status: "going" } } },
            });
            if (!event) return jsonError("Event not found", 404);
            if (event.capacity && event.rsvps.length >= event.capacity) {
              return jsonError("Event is full", 400);
            }

            await prisma.eventRsvp.upsert({
              where: {
                eventId_profileId: { eventId: eventIdResult.value, profileId: user.id },
              },
              create: { eventId: eventIdResult.value, profileId: user.id, status: "going" },
              update: { status: "going" },
            });
          } else {
            // Leave
            await prisma.eventRsvp.deleteMany({
              where: { eventId: eventIdResult.value, profileId: user.id },
            });
          }

          return json({ ok: true });
        }

        return jsonError("Unknown action", 400);
      }, { maxBodySize: 64 * 1024 }), // 64KB max for event creation
    },
  },
});
