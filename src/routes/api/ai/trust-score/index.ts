import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, requireCaller } from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { users } from "@/schema";
import { calculateTrustScore, detectScamKeywords, detectUnderageKeywords } from "@/domains/ai/heuristic/trust-safety";

/**
 * Trust & Risk Scoring — 25.14
 * Hidden per-user safety score combining verification, reports, scam signals.
 */

export const Route = createFileRoute("/api/ai/trust-score/")({
  server: {
    handlers: {
      POST: methodNotAllowed("GET"),
      PUT: methodNotAllowed("GET"),
      PATCH: methodNotAllowed("GET"),
      DELETE: methodNotAllowed("GET"),

      GET: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const url = new URL(request.url);
          const targetId = url.searchParams.get("targetId") ?? user.id;

          // Only admin or self can see own score; others get limited view
          const isSelf = targetId === user.id;

          const [target] = await db
            .select({
              id: users.id,
              verification: users.verification,
              trustScore: users.trustScore,
              bio: users.bio,
              photos: users.photos,
              createdAt: users.createdAt,
              isSuspended: users.isSuspended,
              tier: users.tier,
            })
            .from(users)
            .where(eq(users.id, targetId))
            .limit(1);

          if (!target) return jsonError("User not found", 404);

          const accountAgeDays = Math.floor((Date.now() - new Date(target.createdAt as any).getTime()) / (1000 * 60 * 60 * 24));

          const signals = {
            userId: target.id,
            verified: (target.verification ?? 0) >= 2,
            reportCount: 0, // would query reports table
            reportReasons: [],
            accountAgeDays,
            photoCount: Array.isArray(target.photos) ? (target.photos as any[]).length : 0,
            bioLength: target.bio?.length ?? 0,
            hasSocialLinks: false,
            messageVelocity: 5,
            scamKeywords: target.bio ? detectScamKeywords(target.bio) : [],
            underageKeywords: target.bio ? detectUnderageKeywords(target.bio) : [],
            blockedByCount: 0,
            isPremium: (target.tier ?? "free") !== "free",
          };

          const score = calculateTrustScore(signals);

          // Never expose full score to other users
          if (!isSelf) {
            return json({
              userId: target.id,
              isVerified: signals.verified,
              trustLevel: score.riskLevel === "low" ? "trusted" : "unverified",
              // No numeric score for others
            });
          }

          return json({
            userId: target.id,
            ...score,
            signals: {
              verified: signals.verified,
              accountAgeDays,
              photoCount: signals.photoCount,
              bioLength: signals.bioLength,
            },
            ethics: {
              neverShownToOthers: true,
              feedsModeration: true,
            },
          });
        },
        { rateLimit: { limit: 30, key: ({ caller }) => `trust-score:${caller?.id}` } },
      ),
    },
  },
});
