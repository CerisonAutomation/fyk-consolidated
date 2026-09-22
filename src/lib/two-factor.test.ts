import { describe, expect, it } from "vitest";
import { twoFactorFailureResponse } from "./two-factor.server";

/**
 * The refusal vocabulary, tested on its own.
 *
 * The state machine itself needs a database, and `#/lib/schema-coverage.test.ts` is
 * what proves the table it writes to exists in the migration set. What is testable
 * without one is the mapping from a reason to an HTTP answer — the part both
 * `/api/auth/2fa` and `/api/safety/2fa` share, and the part that decides whether a
 * locked account is told "try again later" (423) or "wrong code" (400).
 */
describe("two-factor refusals", () => {
	it("answers a lockout with 423 and says when it ends", () => {
		const mapped = twoFactorFailureResponse({
			ok: false,
			reason: "locked",
			lockedUntil: "2026-01-01T00:15:00.000Z",
		});
		expect(mapped.status).toBe(423);
		expect(mapped.message).toContain("2026-01-01T00:15:00.000Z");
		expect(mapped.body.lockedUntil).toBe("2026-01-01T00:15:00.000Z");
	});

	it("answers a bad code with 400 and how many attempts are left", () => {
		const mapped = twoFactorFailureResponse({
			ok: false,
			reason: "invalid-code",
			attemptsLeft: 2,
		});
		expect(mapped.status).toBe(400);
		expect(mapped.body.attemptsLeft).toBe(2);
	});

	it("answers every state problem with 409, not 500", () => {
		for (const reason of [
			"not-enrolled",
			"already-enabled",
			"no-pending-enrolment",
			"not-enabled",
		] as const) {
			const mapped = twoFactorFailureResponse({ ok: false, reason });
			expect(mapped.status, reason).toBe(409);
			expect(mapped.message.length, reason).toBeGreaterThan(10);
		}
	});

	it("never answers 200 for a failure", () => {
		for (const reason of [
			"locked",
			"invalid-code",
			"not-enrolled",
			"already-enabled",
			"no-pending-enrolment",
			"not-enabled",
		] as const) {
			const mapped = twoFactorFailureResponse({ ok: false, reason });
			expect(mapped.status, reason).toBeGreaterThanOrEqual(400);
		}
	});
});
