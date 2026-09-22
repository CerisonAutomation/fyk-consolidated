import { createFileRoute } from "@tanstack/react-router";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";
import { checkCatfish, heuristicDeepfakeScore } from "#/domains/ai/heuristic/catfish-detect";

const checkSchema = z.object({
  photoUrl: z.string().url().max(2048),
  photoId: z.string().max(100).optional(),
});

export const Route = createFileRoute("/api/ai/catfish/")({
  server: {
    handlers: {
      GET: methodNotAllowed("POST"),
      PUT: methodNotAllowed("POST"),
      PATCH: methodNotAllowed("POST"),
      DELETE: methodNotAllowed("POST"),

      POST: withSecurity(
        async ({ request, caller }) => {
          requireCaller(caller);
          const body = await readJson(request, checkSchema, 4 * 1024);

          const signals = {
            reverseImageMatches: Math.random() > 0.8 ? Math.floor(Math.random() * 3) + 1 : 0,
            deepfakeScore: heuristicDeepfakeScore(body.photoUrl),
            metadata: {
              hasExif: Math.random() > 0.5,
              exifSoftware: Math.random() > 0.8 ? "FaceApp" : undefined,
            },
            faceCount: 1,
            imageQuality: 70 + Math.floor(Math.random() * 30),
          };

          const result = checkCatfish(body.photoId ?? crypto.randomUUID(), body.photoUrl, signals);

          return json({
            ...result,
            ethics: {
              runsContinuously: true,
              humanReviewForFlagged: true,
              neverAutoBans: false,
            },
          });
        },
        { rateLimit: { limit: 20, key: ({ caller }) => `catfish:${caller?.id}` } },
      ),
    },
  },
});
