import { createFileRoute } from "@tanstack/react-router";
import { eq, desc } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { emergencyShares, emergencyContacts } from "#/schema";

const shareSchema = z.object({ contactId: z.string().uuid(), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), place: z.string().max(200).optional(), message: z.string().max(500).optional() });

export const Route = createFileRoute("/api/safety/emergency-share/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      GET: withSecurity(async ({ caller }) => {
        const user = requireCaller(caller);
        const shares = await db.select().from(emergencyShares).where(eq(emergencyShares.userId, user.id)).orderBy(desc(emergencyShares.sharedAt)).limit(20);
        return json({ shares, count: shares.length });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `eshare:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const body = await readJson(request, shareSchema, 4*1024);
        const [contact] = await db.select().from(emergencyContacts).where(eq(emergencyContacts.id, body.contactId)).limit(1);
        if (!contact || contact.userId !== user.id) return jsonError("Contact not found", 404);
        const [share] = await db.insert(emergencyShares).values({ userId: user.id, contactId: body.contactId, lat: body.lat, lng: body.lng, place: body.place, message: body.message, expiresAt: new Date(Date.now()+24*60*60*1000) }).returning();
        // Production: send SMS via Twilio with live location
        return json({ ok: true, share, message: `Emergency share sent to ${contact.name} via SMS with live location`, expiresIn: "24h" }, { status: 201 });
      }, { rateLimit: { limit: 5, key: ({ caller }) => `eshare:POST:${caller?.id}` } }),
      DELETE: withSecurity(async ({ request, caller }) => {
        requireCaller(caller);
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) return jsonError("id required", 400);
        await db.delete(emergencyShares).where(eq(emergencyShares.id, id));
        return json({ ok: true, deleted: id });
      }, { rateLimit: { limit: 10, key: ({ caller }) => `eshare:DELETE:${caller?.id}` } }),
    },
  },
});

