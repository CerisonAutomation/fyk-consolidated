import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import {
	methodNotAllowed,
	readJson,
	requireCaller,
	unexpected,
	z,
} from "@/lib/api-helpers";
import {
	beginEnrolment,
	disableTwoFactor,
	enableTwoFactor,
	regenerateRecoveryCodes,
	twoFactorFailureResponse,
	twoFactorStatus,
	type TwoFactorFailure,
	verifyEnrolmentCode,
	verifySecondFactor,
} from "@/lib/two-factor.server";
import {
	MAX_FAILED_ATTEMPTS,
	RECOVERY_CODE_COUNT,
	TOTP_DIGITS,
	TOTP_ISSUER,
	TOTP_PERIOD_SECONDS,
} from "@/lib/totp.server";
import { ApiError, json, jsonError, withSecurity } from "@/middleware";

/**
 * `GET/POST /api/auth/2fa` — TOTP two-factor authentication.
 *
 * WHAT THIS REPLACED
 * ------------------
 * A handler that generated a secret, returned it, and stored nothing, because there
 * was no table for it; verified with `code === "123456" || /^\d{6}$/.test(code)`, so
 * any six digits passed; and flipped `users.two_factor_enabled` through a Drizzle
 * `as any` cast for a column the model did not declare. The screen said "Two-factor
 * enabled" over an account whose second factor was a guess away. `/api/safety/2fa`
 * then documented backup codes, a recovery flow and staff enforcement that no code
 * implemented.
 *
 * 0031 adds `two_factor_credentials` (server-only: RLS with no policies, both client
 * roles revoked), `#/lib/totp.server` implements RFC 6238 over `node:crypto`, and
 * `#/lib/two-factor.server` owns the state machine. This route is its HTTP surface,
 * and `/api/safety/2fa` calls the same module rather than describing it.
 *
 * THE CONTRACT
 *   GET            → status only. Never the secret.
 *   POST setup     → mint (or re-mint) a secret, return the otpauth URI once
 *   POST verify    → check a code against the pending secret, change nothing else
 *   POST enable    → the code proves the secret was stored: enable + issue recovery codes
 *   POST disable   → requires a current code or an unused recovery code
 *   POST backup_codes → reissue recovery codes behind a verified TOTP code
 *   POST recovery  → consume one recovery code (sign-in path)
 *
 * Five failed verifications lock the row for fifteen minutes
 * (`#/lib/totp.server#MAX_FAILED_ATTEMPTS`), which is what makes a six-digit code
 * expensive to brute force rather than a million-request form.
 */

const codeSchema = z.string().trim().min(6).max(20);

const requestSchema = z.discriminatedUnion("action", [
	z.object({ action: z.literal("setup") }).strict(),
	z.object({ action: z.literal("status") }).strict(),
	z.object({ action: z.literal("verify"), code: codeSchema }).strict(),
	z.object({ action: z.literal("enable"), code: codeSchema }).strict(),
	z.object({ action: z.literal("disable"), code: codeSchema }).strict(),
	z.object({ action: z.literal("backup_codes"), code: codeSchema }).strict(),
	z
		.object({ action: z.literal("recovery"), backupCode: codeSchema })
		.strict(),
]);

function failure(f: TwoFactorFailure): Response {
	const mapped = twoFactorFailureResponse(f);
	return jsonError(mapped.message, mapped.status);
}

export const Route = createFileRoute("/api/auth/2fa/")({
	server: {
		handlers: {
			GET: withSecurity(
				async ({ caller }) => {
					const user = requireCaller(caller);
					try {
						return json(
							{
								...(await twoFactorStatus(user.id)),
								// The parameters a client needs to render "scan this" copy and a
								// countdown ring, without being told anything secret.
								algorithm: {
									issuer: TOTP_ISSUER,
									digits: TOTP_DIGITS,
									periodSeconds: TOTP_PERIOD_SECONDS,
									hash: "SHA1",
								},
								recoveryCodeCount: RECOVERY_CODE_COUNT,
								maxFailedAttempts: MAX_FAILED_ATTEMPTS,
							},
							{ cache: "private" },
						);
					} catch (error) {
						return unexpected("auth/2fa:GET", error);
					}
				},
				{
					auth: "required",
					rateLimit: {
						limit: 30,
						key: ({ caller }) => `2fa:status:${caller?.id ?? "anon"}`,
					},
				},
			),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					try {
						const body = await readJson(request, requestSchema, 2 * 1024);

						switch (body.action) {
							case "status":
								return json(await twoFactorStatus(user.id), { cache: "private" });

							case "setup": {
								const enrolment = await beginEnrolment(user.id);
								return json({
									ok: true,
									// Shown once. A later `status` never returns it, and a member
									// who lost it re-runs `setup`, which invalidates this secret.
									secret: enrolment.secret,
									otpauthUri: enrolment.uri,
									qrData: enrolment.uri,
									manualKey: enrolment.manualKey,
									next: "POST {action:'enable', code} with a code from your authenticator",
								});
							}

							case "verify": {
								const result = await verifyEnrolmentCode(user.id, body.code);
								if (!result.ok) return failure(result);
								return json({ ok: true, verified: true });
							}

							case "enable": {
								const result = await db.transaction((tx) =>
									enableTwoFactor(user.id, body.code, tx),
								);
								if (!result.ok) return failure(result);
								return json({
									ok: true,
									enabled: true,
									// Single-use, shown once; only hashes are stored (0031).
									recoveryCodes: result.recoveryCodes,
									warning:
										"Store these now. They are not shown again, and each works once.",
								});
							}

							case "disable": {
								const result = await db.transaction((tx) =>
									disableTwoFactor(user.id, body.code, tx),
								);
								if (!result.ok) return failure(result);
								return json({
									ok: true,
									enabled: false,
									viaRecovery: result.viaRecovery,
								});
							}

							case "backup_codes": {
								const result = await db.transaction((tx) =>
									regenerateRecoveryCodes(user.id, body.code, tx),
								);
								if (!result.ok) return failure(result);
								return json({
									ok: true,
									recoveryCodes: result.recoveryCodes,
									warning:
										"Previous recovery codes no longer work. Store these now.",
								});
							}

							case "recovery": {
								const result = await db.transaction((tx) =>
									verifySecondFactor(user.id, body.backupCode, tx),
								);
								if (!result.ok) return failure(result);
								return json({
									ok: true,
									verified: true,
									viaRecovery: result.viaRecovery,
									recoveryCodesLeft: (await twoFactorStatus(user.id))
										.recoveryCodesLeft,
								});
							}
						}
					} catch (error) {
						if (error instanceof ApiError)
							return jsonError(error.message, error.status);
						return unexpected("auth/2fa:POST", error);
					}
				},
				{
					auth: "required",
					maxBodySize: 2 * 1024,
					// Ten an hour: enrolment is four requests, and a client retrying a
					// failed code should hit the row lockout before it hits this.
					rateLimit: {
						limit: 10,
						windowMs: 60 * 60 * 1000,
						key: ({ caller }) => `2fa:write:${caller?.id ?? "anon"}`,
					},
				},
			),

			PUT: methodNotAllowed("GET, POST"),
			PATCH: methodNotAllowed("GET, POST"),
			DELETE: methodNotAllowed("GET, POST"),
		},
	},
});
