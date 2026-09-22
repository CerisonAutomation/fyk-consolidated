import { createFileRoute } from "@tanstack/react-router";
import { and, eq, gt } from "drizzle-orm";
import { methodNotAllowed, readJson, z } from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { getDb } from "@/db";
import { otpCodes } from "@/schema";
import { createHash, randomInt } from "crypto";

const sendSchema = z.object({
  action: z.literal("send"),
  phone: z.string().min(8).max(20),
  country: z.string().min(2).max(4).default("+1"),
});

const verifySchema = z.object({
  action: z.literal("verify"),
  phone: z.string().min(8).max(20),
  code: z.string().length(6),
  country: z.string().min(2).max(4).default("+1"),
});

const requestSchema = z.discriminatedUnion("action", [sendSchema, verifySchema]);

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generateOtp(): string {
  return String(randomInt(100000, 1000000));
}

export const Route = createFileRoute("/api/auth/phone/")({
  server: {
    handlers: {
      GET: methodNotAllowed("POST"),
      PUT: methodNotAllowed("POST"),
      PATCH: methodNotAllowed("POST"),
      DELETE: methodNotAllowed("POST"),

      POST: withSecurity(
        async ({ request }) => {
          const body = await readJson(request, requestSchema, 4 * 1024);
          const db = getDb();

          if (body.action === "send") {
            // Rate limit: 3 attempts per 5 min per phone, check DB
            const recent = await db
              .select()
              .from(otpCodes)
              .where(
                and(
                  eq(otpCodes.phone, body.phone),
                  eq(otpCodes.country, body.country),
                  gt(otpCodes.expiresAt, new Date(Date.now() - 5 * 60 * 1000)),
                ),
              )
              .limit(10);

            if (recent.length >= 3) {
              return jsonError("Too many attempts, try later", 429);
            }

            const code = generateOtp();
            const codeHash = hashCode(code);

            await db.insert(otpCodes).values({
              phone: body.phone,
              country: body.country,
              codeHash,
              attempts: 0,
              verified: false,
              expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            });

            // Log only in dev mode via structured logger, never expose code in production
            if (process.env.DEV_MODE === "1") {
              const { logger } = await import("#/lib/logger");
              logger.info({ phone: `${body.country}:${body.phone}` }, "OTP generated");
            }

            return json({
              ok: true,
              message: "OTP sent",
              ...(process.env.DEV_MODE === "1" ? { debugCode: code } : {}),
            });
          }

          // Verify — check DB, hashed, expiry, attempts
          const rows = await db
            .select()
            .from(otpCodes)
            .where(
              and(
                eq(otpCodes.phone, body.phone),
                eq(otpCodes.country, body.country),
                eq(otpCodes.verified, false),
                gt(otpCodes.expiresAt, new Date()),
              ),
            )
            .orderBy(otpCodes.createdAt)
            .limit(1);

          const stored = rows[0];
          if (!stored) {
            return jsonError("No OTP found or expired, request a new one", 400);
          }

          if (stored.attempts >= 5) {
            return jsonError("Too many failed attempts, request new code", 429);
          }

          const inputHash = hashCode(body.code);
          if (stored.codeHash !== inputHash) {
            // Increment attempts
            await db
              .update(otpCodes)
              .set({ attempts: stored.attempts + 1 })
              .where(eq(otpCodes.id, stored.id));
            return jsonError("Invalid code", 400);
          }

          // Mark verified
          await db
            .update(otpCodes)
            .set({ verified: true, verifiedAt: new Date() })
            .where(eq(otpCodes.id, stored.id));

          return json({
            ok: true,
            verified: true,
            phone: body.phone,
            message: "Phone verified — proceed to create session",
          });
        },
        {
          auth: "optional",
          rateLimit: {
            limit: 10,
            key: ({ ip }) => `phone:${ip}`,
          },
        },
      ),
    },
  },
});
