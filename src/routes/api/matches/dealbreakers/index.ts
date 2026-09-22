import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";
import { users } from "#/schema";

/**
 * Dealbreakers — 15.5
 * Hard filters marked by user, profiles violating them permanently hidden.
 */

const saveSchema = z.object({
  dealbreakers: z
    .array(
      z.object({
        field: z.string().min(1).max(50),
        value: z.string().min(1).max(100),
        operator: z.enum(["equals", "not_equals", "includes", "excludes"]),
      }),
    )
    .max(20),
});

export const Route = createFileRoute("/api/matches/dealbreakers/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),

      GET: withSecurity(
        async ({ caller }) => {
          const user = requireCaller(caller);
          const [me] = await db
            .select({ dealbreakers: (users as any).dealbreakers })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);

          return json({ dealbreakers: (me as any)?.dealbreakers ?? [] });
        },
        { rateLimit: { limit: 60, key: ({ caller }) => `dealbreakers:GET:${caller?.id}` } },
      ),

      POST: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const body = await readJson(request, saveSchema, 4 * 1024);

          await db.update(users).set({ dealbreakers: body.dealbreakers } as any).where(eq(users.id, user.id));

          return json({ ok: true, dealbreakers: body.dealbreakers });
        },
        { rateLimit: { limit: 20, key: ({ caller }) => `dealbreakers:POST:${caller?.id}` } },
      ),

      DELETE: withSecurity(
        async ({ caller }) => {
          const user = requireCaller(caller);
          await db.update(users).set({ dealbreakers: [] } as any).where(eq(users.id, user.id));
          return json({ ok: true, cleared: true });
        },
        { rateLimit: { limit: 20, key: ({ caller }) => `dealbreakers:DELETE:${caller?.id}` } },
      ),
    },
  },
});
