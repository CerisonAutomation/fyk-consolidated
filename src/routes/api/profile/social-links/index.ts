import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, readJson, requireCaller, z } from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { users } from "@/schema";
import { validateSocialLinks } from "@/core/model/social-links";
import { getDeepLink } from "@/core/model/social-links";

const upsertSchema = z.object({
  links: z
    .array(
      z.object({
        platform: z.enum(["instagram", "twitter", "tiktok", "bluesky", "telegram", "whatsapp", "spotify"]),
        url: z.string().url().max(500),
      }),
    )
    .max(7),
});

export const Route = createFileRoute("/api/profile/social-links/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),

      GET: withSecurity(
        async ({ caller }) => {
          const user = requireCaller(caller);
          const [me] = await db
            .select({ socialLinks: (users as any).socialLinks })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);

          const links = (me as any)?.socialLinks ?? [];

          return json({ links });
        },
        { rateLimit: { limit: 60, key: ({ caller }) => `social-links:GET:${caller?.id}` } },
      ),

      POST: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const body = await readJson(request, upsertSchema, 4 * 1024);

          const toValidate = body.links.map((l) => ({
            platform: l.platform as any,
            url: l.url,
          }));

          const { valid, invalid } = validateSocialLinks(toValidate);

          if (invalid.length > 0) {
            return jsonError(`Invalid links: ${invalid.map((i: any) => i.platform).join(", ")}`, 400);
          }

          await db
            .update(users)
            .set({ socialLinks: valid } as any)
            .where(eq(users.id, user.id));

          return json({
            ok: true,
            links: valid.map((l: any) => ({
              ...l,
              deepLink: l.handle ? getDeepLink(l.platform, l.handle) : undefined,
            })),
          });
        },
        { rateLimit: { limit: 20, key: ({ caller }) => `social-links:POST:${caller?.id}` } },
      ),

      DELETE: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const url = new URL(request.url);
          const platform = url.searchParams.get("platform");

          if (!platform) {
            await db.update(users).set({ socialLinks: [] } as any).where(eq(users.id, user.id));
            return json({ ok: true, cleared: true });
          }

          const [me] = await db
            .select({ socialLinks: (users as any).socialLinks })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);

          const current = ((me as any)?.socialLinks ?? []) as any[];
          const filtered = current.filter((l: any) => l.platform !== platform);

          await db.update(users).set({ socialLinks: filtered } as any).where(eq(users.id, user.id));

          return json({ ok: true, removed: platform, links: filtered });
        },
        { rateLimit: { limit: 20, key: ({ caller }) => `social-links:DELETE:${caller?.id}` } },
      ),
    },
  },
});
