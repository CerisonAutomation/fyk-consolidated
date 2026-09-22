import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, requireCaller } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";
import { deletionRequests } from "#/schema";

export const Route = createFileRoute("/api/safety/deletion/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),
      GET: withSecurity(async ({ caller }) => {
        const user = requireCaller(caller);
        const [request] = await db.select().from(deletionRequests).where(eq(deletionRequests.userId, user.id)).limit(1);
        return json({ request, hasRequest: !!request });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `sdel:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ caller }) => {
        requireCaller(caller);
        return json({ message: "Use /api/profile/deletion for deletion flow", redirect: "/api/profile/deletion" });
      }, { rateLimit: { limit: 10, key: ({ caller }) => `sdel:POST:${caller?.id}` } }),
    },
  },
});

