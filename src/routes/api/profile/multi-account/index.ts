import { createFileRoute } from "@tanstack/react-router";
import { eq, and } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { multiAccountTokens } from "#/schema";

const addSchema = z.object({
  accountId: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1).max(50),
  accessToken: z.string().min(10),
  refreshToken: z.string().min(10),
});

export const Route = createFileRoute("/api/profile/multi-account/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      GET: withSecurity(async ({ caller }) => {
        const user = requireCaller(caller);
        const accounts = await db.select().from(multiAccountTokens).where(eq(multiAccountTokens.ownerUserId, user.id));
        return json({ accounts: accounts.map(a => ({ accountId: a.accountId, email: a.email, displayName: a.displayName, expiresAt: a.expiresAt, lastUsedAt: a.lastUsedAt })), count: accounts.length, max: 5 });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `multi:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const body = await readJson(request, addSchema, 4*1024);
        if (body.accountId === user.id) return jsonError("Cannot add self", 400);
        const existing = await db.select().from(multiAccountTokens).where(eq(multiAccountTokens.ownerUserId, user.id));
        if (existing.length >= 5) return jsonError("Max 5 accounts", 400);
        if (existing.some(a => a.accountId === body.accountId)) return jsonError("Already exists", 400);
        const [created] = await db.insert(multiAccountTokens).values({
          ownerUserId: user.id,
          accountId: body.accountId,
          email: body.email,
          displayName: body.displayName,
          accessTokenHash: `hash_${body.accessToken.slice(0,10)}`,
          refreshTokenHash: `hash_${body.refreshToken.slice(0,10)}`,
          expiresAt: new Date(Date.now()+3600*1000),
        }).returning();
        return json({ ok: true, account: { accountId: created.accountId, email: created.email, displayName: created.displayName } }, { status: 201 });
      }, { rateLimit: { limit: 10, key: ({ caller }) => `multi:POST:${caller?.id}` } }),
      DELETE: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const accountId = url.searchParams.get("accountId");
        if (!accountId) return jsonError("accountId required", 400);
        await db.delete(multiAccountTokens).where(and(eq(multiAccountTokens.ownerUserId, user.id), eq(multiAccountTokens.accountId, accountId)));
        return json({ ok: true, deleted: accountId });
      }, { rateLimit: { limit: 10, key: ({ caller }) => `multi:DELETE:${caller?.id}` } }),
    },
  },
});

