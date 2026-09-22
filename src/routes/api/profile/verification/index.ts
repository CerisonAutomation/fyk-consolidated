import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";
import { users } from "#/schema";
import { generatePoseChallenge, verificationExpiry, heuristicFaceMatch } from "#/core/model/verification";

const requestSchema = z.object({
  selfieUrl: z.string().url().max(2048),
  pose: z.string().min(2).max(50).optional(),
});

export const Route = createFileRoute("/api/profile/verification/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),

      GET: withSecurity(
        async ({ caller }) => {
          const user = requireCaller(caller);

          const [me] = await db
            .select({
              verification: users.verification,
              trustScore: users.trustScore,
            })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);

          const challenge = generatePoseChallenge();
          const isVerified = (me?.verification ?? 0) >= 2;

          return json({
            verified: isVerified,
            verificationLevel: me?.verification ?? 0,
            trustScore: me?.trustScore ?? 50,
            challenge: {
              pose: challenge,
              instruction: `Please ${challenge.replace(/_/g, " ")}`,
              expiresAt: verificationExpiry(),
            },
            rewards: {
              coins: 50,
              trustBoost: 22,
            },
          });
        },
        { rateLimit: { limit: 30, key: ({ caller }) => `verify:GET:${caller?.id}` } },
      ),

      POST: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const body = await readJson(request, requestSchema, 4 * 1024);

          const [me] = await db
            .select({ avatar: users.avatar, photos: users.photos })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);

          const profilePhoto = me?.avatar ?? "";
          const faceMatch = heuristicFaceMatch(profilePhoto, body.selfieUrl);

          const requestId = crypto.randomUUID();

          if (process.env.DEV_MODE === "1" && faceMatch.confidence > 0.5) {
            await db
              .update(users)
              .set({
                verification: 2,
                trustScore: 72,
              } as any)
              .where(eq(users.id, user.id));

            return json({
              ok: true,
              requestId,
              status: "approved",
              confidence: faceMatch.confidence,
              verified: true,
              message: "Verified! Badge granted + 50 coins",
            });
          }

          return json({
            ok: true,
            requestId,
            status: "pending",
            confidence: faceMatch.confidence,
            verified: false,
            message: "Selfie submitted, awaiting review (24h)",
            expiresAt: verificationExpiry(),
          });
        },
        {
          rateLimit: { limit: 5, key: ({ caller }) => `verify:POST:${caller?.id}` },
        },
      ),
    },
  },
});
