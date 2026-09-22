import { createFileRoute } from "@tanstack/react-router";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";

/**
 * Banners — 8.4
 * Rotating promo banners fetched from server, client reports shown/clicked for tracking.
 */

type Banner = {
  id: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  imageUrl?: string;
  type: "promo" | "feature" | "event" | "safety";
  priority: number;
  active: boolean;
  startsAt: string;
  endsAt: string;
};

const banners: Banner[] = [
  {
    id: "1",
    title: "Upgrade to Plus",
    body: "Unlimited taps, see who liked you, and more",
    cta: "Upgrade",
    href: "/premium",
    type: "promo",
    priority: 10,
    active: true,
    startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "2",
    title: "Verify Your Profile",
    body: "Get verified badge and boost trust score",
    cta: "Verify Now",
    href: "/settings/profile?verify=1",
    type: "feature",
    priority: 8,
    active: true,
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "3",
    title: "Safety Center",
    body: "Learn how to stay safe while dating",
    cta: "Learn More",
    href: "/safety",
    type: "safety",
    priority: 5,
    active: true,
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const updateSchema = z.object({
  bannerId: z.string().min(1).max(100),
  action: z.enum(["shown", "clicked", "dismissed"]),
});

export const Route = createFileRoute("/api/banners/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),

      GET: withSecurity(
        async ({ request }) => {
          const url = new URL(request.url);
          const type = url.searchParams.get("type");

          const now = Date.now();
          const active = banners.filter((b) => {
            if (!b.active) return false;
            if (new Date(b.startsAt).getTime() > now) return false;
            if (new Date(b.endsAt).getTime() < now) return false;
            if (type && b.type !== type) return false;
            return true;
          });

          const sorted = active.sort((a, b) => b.priority - a.priority);

          return json({ banners: sorted, count: sorted.length });
        },
        { auth: "optional", rateLimit: { limit: 60, key: ({ ip }) => `banners:GET:${ip}` } },
      ),

      POST: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const body = await readJson(request, updateSchema, 2 * 1024);

          // In production: insert into banner_events for campaign tracking

          return json({
            ok: true,
            bannerId: body.bannerId,
            action: body.action,
            userId: user.id,
            timestamp: new Date().toISOString(),
          });
        },
        { rateLimit: { limit: 60, key: ({ caller }) => `banners:POST:${caller?.id}` } },
      ),
    },
  },
});
