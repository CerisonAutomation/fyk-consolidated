import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import {
	methodNotAllowed,
	readJson,
	requireCaller,
	unexpected,
	z,
} from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
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
import { ApiError, json, jsonError, withSecurity } from "@/middleware";

/**
 * `GET/POST /api/safety/2fa` — the safety centre's door to the same second factor.
 *
 * This path used to be a description: it returned a JSON document listing
 * `backup_codes`, a `recovery` flow and "enforcedFor: admin, moderator", none of
 * which existed anywhere, and a POST that answered `{redirect: "/api/auth/2fa"}` —
 * which a `fetch` follows only if the client asks it to, so the safety screen's
 * enable button silently did nothing.
 *
 * An alias that does not work is worse than no alias, so this one calls
 * `#/lib/two-factor.server` — the same module `/api/auth/2fa` calls — and accepts the
 * same actions with the same bodies. One implementation, two doors: the safety
 * centre and the account screens both reach real enrolment, and a change to the
 * state machine cannot make them disagree.
 *
 * The one thing this route adds is a log line for the security-relevant outcomes
 * (enabled, disabled, recovery used), because a second factor being removed is the
 * event an operator needs to find afterwards.
 */

const codeSchema = z.string().trim().min(6).max(20);

const requestSchema = z.discriminatedUnion("action", [
	z.object({ action: z.literal("setup") }).strict(),
	z.object({ action: z.literal("status") }).strict(),
	z.object({ action: z.literal("verify"), code: codeSchema }).strict(),
	z.object({ action: z.literal("enable"), code: codeSchema }).strict(),
	z.object({ action: z.literal("disable"), code: codeSchema }).strict(),
	z.object({ action: z.literal("backup_codes"), code: codeSchema }).strict(),
	z.object({ action: z.literal("recovery"), backupCode: codeSchema }).strict(),
]);

const AUDITED = new Set(["enable", "disable", "recovery", "backup_codes"]);

function failure(f: TwoFactorFailure): Response {
	const mapped = twoFactorFailureResponse(f);
	return jsonError(mapped.message, mapped.status);
}

export const Route = createFileRoute("/api/safety/2fa/")({
	server: {
		handlers: {
			GET: withSecurity(
				async ({ caller }) => {
					const user = requireCaller(caller);
					try {
						return json(
							{
								...(await twoFactorStatus(user.id)),
								canonical: "/api/auth/2fa",
							},
							{ cache: "private" },
						);
					} catch (error) {
						return unexpected("safety/2fa:GET", error);
					}
				},
				{
					auth: "required",
					rateLimit: {
						limit: 30,
						key: ({ caller }) => `safety:2fa:status:${caller?.id ?? "anon"}`,
					},
				},
			),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					try {
						const body = await readJson(request, requestSchema, 2 * 1024);
						let response: Response;
						let outcome: string = "ok";

						switch (body.action) {
							case "status":
								response = json(await twoFactorStatus(user.id), { cache: "private" });
								break;
							case "setup": {
								const enrolment = await beginEnrolment(user.id);
								response = json({
									ok: true,
									secret: enrolment.secret,
									otpauthUri: enrolment.uri,
									qrData: enrolment.uri,
									manualKey: enrolment.manualKey,
									canonical: "/api/auth/2fa",
								});
								break;
							}
							case "verify": {
								const result = await verifyEnrolmentCode(user.id, body.code);
								if (!result.ok) {
									outcome = result.reason;
									response = failure(result);
								} else response = json({ ok: true, verified: true });
								break;
							}
							case "enable": {
								const result = await db.transaction((tx) =>
									enableTwoFactor(user.id, body.code, tx),
								);
								if (!result.ok) {
									outcome = result.reason;
									response = failure(result);
								} else
									response = json({
										ok: true,
										enabled: true,
										recoveryCodes: result.recoveryCodes,
										warning:
											"Store these now. They are not shown again, and each works once.",
									});
								break;
							}
							case "disable": {
								const result = await db.transaction((tx) =>
									disableTwoFactor(user.id, body.code, tx),
								);
								if (!result.ok) {
									outcome = result.reason;
									response = failure(result);
								} else
									response = json({
										ok: true,
										enabled: false,
										viaRecovery: result.viaRecovery,
									});
								break;
							}
							case "backup_codes": {
								const result = await db.transaction((tx) =>
									regenerateRecoveryCodes(user.id, body.code, tx),
								);
								if (!result.ok) {
									outcome = result.reason;
									response = failure(result);
								} else
									response = json({
										ok: true,
										recoveryCodes: result.recoveryCodes,
									});
								break;
							}
							case "recovery": {
								const result = await db.transaction((tx) =>
									verifySecondFactor(user.id, body.backupCode, tx),
								);
								if (!result.ok) {
									outcome = result.reason;
									response = failure(result);
								} else
									response = json({
										ok: true,
										verified: true,
										viaRecovery: result.viaRecovery,
									});
								break;
							}
						}

						if (AUDITED.has(body.action))
							logger.info(
								{
									scope: "safety/2fa",
									event: `two_factor.${body.action}`,
									userId: user.id,
									outcome,
								},
								"two-factor authentication changed",
							);

						return response;
					} catch (error) {
						if (error instanceof ApiError)
							return jsonError(error.message, error.status);
						return unexpected("safety/2fa:POST", error);
					}
				},
				{
					auth: "required",
					maxBodySize: 2 * 1024,
					rateLimit: {
						limit: 10,
						windowMs: 60 * 60 * 1000,
						key: ({ caller }) => `safety:2fa:write:${caller?.id ?? "anon"}`,
					},
				},
			),

			PUT: methodNotAllowed("GET, POST"),
			PATCH: methodNotAllowed("GET, POST"),
			DELETE: methodNotAllowed("GET, POST"),
		},
	},
});
