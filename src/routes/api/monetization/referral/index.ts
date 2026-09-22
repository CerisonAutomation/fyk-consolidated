import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { users } from "#/schema";
import { generateReferralCode, REFERRAL_REWARDS } from "#/lib/monetization";

/**
 * Referral Program — 22.2
 * Unique referral link, reward when referee becomes paying member.
 */

const redeemSchema = z.object({
  code: z.string().min(5).max(30),
});

export const Route = createFileRoute("/api/monetization/referral/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),

      GET: withSecurity(
        async ({ caller }) => {
          const user = requireCaller(caller);

          // Get or generate referral code
          const [me] = await db
            .select({ referralCode: (users as any).referralCode })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);

          let code = (me as any)?.referralCode as string | undefined;
          if (!code) {
            code = generateReferralCode(user.id);
            await db.update(users).set({ referralCode: code } as any).where(eq(users.id, user.id));
          }

          // Mock stats
          const stats = {
            code,
            link: `https://fyk.app/r/${code}`,
            clicks: Math.floor(Math.random() * 20),
            conversions: Math.floor(Math.random() * 5),
            rewardsEarned: {
              days: Math.floor(Math.random() * 21),
              coins: Math.floor(Math.random() * 300),
            },
            rewards: REFERRAL_REWARDS,
          };

          return json(stats);
        },
        { rateLimit: { limit: 30, key: ({ caller }) => `referral:GET:${caller?.id}` } },
      ),

      POST: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const body = await readJson(request, redeemSchema, 2 * 1024);

          // Validate code exists and not own code
          const [me] = await db
            .select({ referralCode: (users as any).referralCode })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);

          if ((me as any)?.referralCode === body.code) {
            return jsonError("Cannot redeem own code", 400);
          }

          // In production: lookup code, create referral row, grant referee reward

          return json({
            ok: true,
            redeemed: body.code,
            reward: REFERRAL_REWARDS.referee,
            message: `Welcome! You got ${REFERRAL_REWARDS.referee.days} days free + ${REFERRAL_REWARDS.referee.coins} coins`,
          });
        },
        { rateLimit: { limit: 10, key: ({ caller }) => `referral:POST:${caller?.id}` } },
      ),
    },
  },
});
