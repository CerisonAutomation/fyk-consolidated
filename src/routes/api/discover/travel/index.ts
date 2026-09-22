import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, readJson, requireCaller, z } from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { users } from "@/schema";
import { TRAVEL_CITIES, resolveEffectiveLocation, isTravelExpired } from "@/core/model/travel";

/**
 * Travel / Passport Mode — 16.1, D3.3
 * Switch home↔trip coordinates, geoMode manual/auto, premium-gated.
 */

const travelSchema = z.object({
  enabled: z.boolean(),
  tripCity: z.string().max(100).optional(),
  tripLat: z.number().min(-90).max(90).optional(),
  tripLng: z.number().min(-180).max(180).optional(),
  durationDays: z.number().int().min(1).max(30).default(7),
});

export const Route = createFileRoute("/api/discover/travel/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),

      GET: withSecurity(
        async ({ caller }) => {
          const user = requireCaller(caller);
          const [me] = await db
            .select({
              lat: users.lat,
              lng: users.lng,
              latCoarse: users.latCoarse,
              lngCoarse: users.lngCoarse,
              city: users.city,
              travelMode: (users as any).travelMode,
              tier: users.tier,
            })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);

          const travelMode = (me as any)?.travelMode ?? { enabled: false, geoMode: "auto" };
          const isPremium = (me?.tier ?? "free") !== "free";

          return json({
            travelMode,
            isPremium,
            premiumRequired: true,
            availableCities: TRAVEL_CITIES,
            effectiveLocation: resolveEffectiveLocation({
              enabled: travelMode.enabled,
              homeLocation: me?.lat != null && me?.lng != null ? { lat: me.lat, lng: me.lng } : null,
              tripLocation: travelMode.tripLocation ?? null,
              geoMode: travelMode.geoMode ?? "auto",
            }),
            isExpired: isTravelExpired(travelMode),
          });
        },
        { rateLimit: { limit: 30, key: ({ caller }) => `travel:GET:${caller?.id}` } },
      ),

      POST: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const body = await readJson(request, travelSchema, 4 * 1024);

          const [me] = await db.select({ tier: users.tier }).from(users).where(eq(users.id, user.id)).limit(1);
          const isPremium = (me?.tier ?? "free") !== "free";

          if (body.enabled && !isPremium) {
            return jsonError("Travel mode requires Plus+", 403);
          }

          let tripLocation = null;
          let tripCity = body.tripCity;

          if (body.tripLat != null && body.tripLng != null) {
            tripLocation = { lat: body.tripLat, lng: body.tripLng };
          } else if (body.tripCity) {
            const city = TRAVEL_CITIES.find((c) => c.city.toLowerCase() === body.tripCity!.toLowerCase());
            if (city) {
              tripLocation = { lat: city.lat, lng: city.lng };
              tripCity = city.city;
            }
          }

          const travelMode = {
            enabled: body.enabled,
            tripLocation,
            tripCity,
            geoMode: body.enabled ? "travel" : "auto",
            expiresAt: body.enabled ? new Date(Date.now() + body.durationDays * 24 * 60 * 60 * 1000).toISOString() : null,
            createdAt: new Date().toISOString(),
          };

          await db.update(users).set({ travelMode } as any).where(eq(users.id, user.id));

          return json({ ok: true, travelMode });
        },
        { rateLimit: { limit: 20, key: ({ caller }) => `travel:POST:${caller?.id}` } },
      ),

      DELETE: withSecurity(
        async ({ caller }) => {
          const user = requireCaller(caller);
          await db.update(users).set({ travelMode: { enabled: false, geoMode: "auto" } } as any).where(eq(users.id, user.id));
          return json({ ok: true, disabled: true });
        },
        { rateLimit: { limit: 20, key: ({ caller }) => `travel:DELETE:${caller?.id}` } },
      ),
    },
  },
});
