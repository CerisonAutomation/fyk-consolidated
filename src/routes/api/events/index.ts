import { createFileRoute } from "@tanstack/react-router";
import { prisma } from "#/db";
import { auth } from "#/lib/auth";

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

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// -- Route --

export const Route = createFileRoute("/api/events/")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
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

      POST: async ({ request }: { request: Request }) => {
        const user = await getCurrentUser(request);
        if (!user) {
          return json({ error: "Unauthorized" }, 401);
        }

        const body = await request.json();
        const { action } = body;

        // -- Create event --
        if (action === "create") {
          const {
            name,
            description,
            category,
            location,
            start_time,
            max_attendees,
            cost,
          } = body;

          if (!name || name.trim().length < 3) {
            return json({ error: "Title must be at least 3 characters" }, 400);
          }

          const event = await prisma.event.create({
            data: {
              hostId: user.id,
              title: name.trim(),
              description: description ?? null,
              activityId: category ?? null,
              venue: location ?? null,
              startsAt: start_time
                ? new Date(start_time)
                : new Date(Date.now() + 7 * 86400000),
              capacity: max_attendees ?? null,
              cost: cost ? String(cost) : null,
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
          const { eventId } = body;
          if (!eventId) {
            return json({ error: "eventId required" }, 400);
          }

          if (action === "join") {
            // Check capacity
            const event = await prisma.event.findUnique({
              where: { id: eventId },
              include: { rsvps: { where: { status: "going" } } },
            });
            if (!event) return json({ error: "Event not found" }, 404);
            if (event.capacity && event.rsvps.length >= event.capacity) {
              return json({ error: "Event is full" }, 400);
            }

            await prisma.eventRsvp.upsert({
              where: {
                eventId_profileId: { eventId, profileId: user.id },
              },
              create: { eventId, profileId: user.id, status: "going" },
              update: { status: "going" },
            });
          } else {
            // Leave
            await prisma.eventRsvp.deleteMany({
              where: { eventId, profileId: user.id },
            });
          }

          return json({ ok: true });
        }

        return json({ error: "Unknown action" }, 400);
      },
    },
  },
});
