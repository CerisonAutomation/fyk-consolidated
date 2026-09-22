import { eq } from "drizzle-orm";
import { type DbLike, db } from "@/db";
import {
	generateRecoveryCodes,
	generateTotpSecret,
	isLockedOut,
	lockoutUntil,
	manualKey,
	matchRecoveryCode,
	MAX_FAILED_ATTEMPTS,
	otpauthUri,
	verifyTotpCode,
} from "@/lib/totp.server";
import { twoFactorCredentials, users } from "@/schema";

/**
 * The second factor's state machine, in one module both 2FA routes call.
 *
 * WHY NOT IN THE ROUTE
 * --------------------
 * `/api/auth/2fa` is canonical and `/api/safety/2fa` is an alias the safety screens
 * reach for. Two handlers that each own part of enrolment is how an account ends up
 * with a stored secret and no enabled flag, or an enabled flag and no secret — the
 * second of which is what the route did before 0031, when it wrote
 * `users.two_factor_enabled` through an `as any` cast for a column the Drizzle model
 * did not declare and verified codes with `code === "123456"`.
 *
 * STATES
 *   none        no row: 2FA off, nothing pending
 *   pending     row with `enabled = false`: a secret exists and was shown once,
 *               waiting for the member to prove they stored it
 *   enabled     row with `enabled = true`: the secret verifies, recovery codes exist
 *
 * `users.two_factor_enabled` mirrors `enabled` inside the same transaction so a
 * profile card does not need a join. `status()` reports a mismatch rather than
 * papering over one, because a flag that disagrees with its credential is either a
 * bug or an edit made outside this module, and both deserve to be visible.
 */

export type TwoFactorReason =
	| "locked"
	| "invalid-code"
	| "not-enrolled"
	| "already-enabled"
	| "no-pending-enrolment"
	| "not-enabled";

export type TwoFactorFailure = {
	ok: false;
	reason: TwoFactorReason;
	/** Present for `locked` and `invalid-code`. */
	detail?: string;
	attemptsLeft?: number;
	lockedUntil?: string | null;
};

export type TwoFactorStatus = {
	enabled: boolean;
	pendingEnrolment: boolean;
	recoveryCodesLeft: number;
	verifiedAt: string | null;
	lockedUntil: string | null;
	/** `users.two_factor_enabled` disagrees with the credential row. */
	flagMismatch: boolean;
};

type Row = typeof twoFactorCredentials.$inferSelect;

async function readRow(userId: string, tx: DbLike): Promise<Row | undefined> {
	const [row] = await tx
		.select()
		.from(twoFactorCredentials)
		.where(eq(twoFactorCredentials.userId, userId))
		.limit(1);
	return row;
}

function recoveryHashes(row: Row | undefined): string[] {
	const value = row?.recoveryCodes;
	return Array.isArray(value) ? value.map((v) => String(v)) : [];
}

/** The HTTP shape of each refusal, so both routes answer identically. */
export function twoFactorFailureResponse(failure: TwoFactorFailure): {
	status: number;
	message: string;
	body: Record<string, unknown>;
} {
	switch (failure.reason) {
		case "locked":
			return {
				status: 423,
				message: `Too many attempts. Try again after ${failure.lockedUntil ?? "a while"}.`,
				body: { lockedUntil: failure.lockedUntil ?? null },
			};
		case "invalid-code":
			return {
				status: 400,
				message: "That code is not valid",
				body: { attemptsLeft: failure.attemptsLeft ?? 0 },
			};
		case "not-enrolled":
			return {
				status: 409,
				message: "Set up two-factor authentication first",
				body: {},
			};
		case "already-enabled":
			return {
				status: 409,
				message: "Two-factor authentication is already on",
				body: {},
			};
		case "no-pending-enrolment":
			return {
				status: 409,
				message: "There is no enrolment in progress — start again with setup",
				body: {},
			};
		case "not-enabled":
			return {
				status: 409,
				message: "Two-factor authentication is not enabled",
				body: {},
			};
	}
}

export async function twoFactorStatus(
	userId: string,
	tx: DbLike = db,
): Promise<TwoFactorStatus> {
	const [row, me] = await Promise.all([
		readRow(userId, tx),
		tx
			.select({ flag: users.twoFactorEnabled })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1),
	]);
	const enabled = Boolean(row?.enabled);
	return {
		enabled,
		pendingEnrolment: Boolean(row) && !enabled,
		recoveryCodesLeft: recoveryHashes(row).length,
		verifiedAt: row?.verifiedAt?.toISOString() ?? null,
		lockedUntil: isLockedOut(row?.lockedUntil)
			? (row?.lockedUntil?.toISOString() ?? null)
			: null,
		flagMismatch: Boolean(me[0]?.flag) !== enabled,
	};
}

/**
 * Start (or restart) enrolment: mint a secret, store it unconfirmed, return it once.
 *
 * Restarting invalidates the previous secret rather than leaving two live ones, so
 * a URI screenshotted during an abandoned attempt stops working.
 */
export async function beginEnrolment(
	userId: string,
	tx: DbLike = db,
): Promise<{ secret: string; uri: string; manualKey: string }> {
	const secret = generateTotpSecret();
	const [me] = await tx
		.select({ email: users.email, handle: users.handle })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);
	const account = me?.email || (me?.handle ? `@${me.handle}` : userId);

	await tx
		.insert(twoFactorCredentials)
		.values({
			userId,
			secret,
			enabled: false,
			recoveryCodes: [],
			attempts: 0,
			lockedUntil: null,
			verifiedAt: null,
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: twoFactorCredentials.userId,
			set: {
				secret,
				enabled: false,
				recoveryCodes: [],
				attempts: 0,
				lockedUntil: null,
				verifiedAt: null,
				updatedAt: new Date(),
			},
		});

	return { secret, uri: otpauthUri({ secret, account }), manualKey: manualKey(secret) };
}

/**
 * Record a failed verification: bump the counter, lock at the threshold.
 * Shared by every verifying path so the lockout cannot be bypassed by using a
 * different action.
 */
async function recordFailure(
	userId: string,
	row: Row,
	tx: DbLike,
): Promise<TwoFactorFailure> {
	const attempts = Number(row.attempts ?? 0) + 1;
	const locked = lockoutUntil(attempts);
	await tx
		.update(twoFactorCredentials)
		.set({ attempts, lockedUntil: locked, updatedAt: new Date() })
		.where(eq(twoFactorCredentials.userId, userId));
	return {
		ok: false,
		reason: "invalid-code",
		attemptsLeft: Math.max(0, MAX_FAILED_ATTEMPTS - attempts),
		lockedUntil: locked?.toISOString() ?? null,
	};
}

async function recordSuccess(userId: string, tx: DbLike): Promise<void> {
	await tx
		.update(twoFactorCredentials)
		.set({ attempts: 0, lockedUntil: null, updatedAt: new Date() })
		.where(eq(twoFactorCredentials.userId, userId));
}

/** Check a code without changing any state, for the enrolment screen's "try it" step. */
export async function verifyEnrolmentCode(
	userId: string,
	code: string,
	tx: DbLike = db,
): Promise<{ ok: true } | TwoFactorFailure> {
	const row = await readRow(userId, tx);
	if (!row) return { ok: false, reason: "not-enrolled" };
	if (isLockedOut(row.lockedUntil))
		return {
			ok: false,
			reason: "locked",
			lockedUntil: row.lockedUntil?.toISOString() ?? null,
		};
	if (!verifyTotpCode(row.secret, code)) return recordFailure(userId, row, tx);
	await recordSuccess(userId, tx);
	return { ok: true };
}

/**
 * Confirm enrolment: the code proves the member stored the secret, so the flag is
 * set and the recovery codes are minted. The codes are returned once, in plaintext;
 * only their hashes are kept.
 */
export async function enableTwoFactor(
	userId: string,
	code: string,
	tx: DbLike = db,
): Promise<{ ok: true; recoveryCodes: string[] } | TwoFactorFailure> {
	const row = await readRow(userId, tx);
	if (!row) return { ok: false, reason: "not-enrolled" };
	if (row.enabled) return { ok: false, reason: "already-enabled" };
	if (isLockedOut(row.lockedUntil))
		return {
			ok: false,
			reason: "locked",
			lockedUntil: row.lockedUntil?.toISOString() ?? null,
		};
	if (!verifyTotpCode(row.secret, code)) return recordFailure(userId, row, tx);

	const { codes, hashes } = generateRecoveryCodes();
	const now = new Date();
	await tx
		.update(twoFactorCredentials)
		.set({
			enabled: true,
			verifiedAt: now,
			recoveryCodes: hashes,
			attempts: 0,
			lockedUntil: null,
			updatedAt: now,
		})
		.where(eq(twoFactorCredentials.userId, userId));
	// Same transaction, same fact: the denormalised flag the profile reads.
	await tx
		.update(users)
		.set({ twoFactorEnabled: true, updatedAt: now })
		.where(eq(users.id, userId));

	return { ok: true, recoveryCodes: codes };
}

/**
 * Turn 2FA off. Requires a current code or an unused recovery code: a stolen session
 * cookie alone must not be able to remove the second factor.
 */
export async function disableTwoFactor(
	userId: string,
	code: string,
	tx: DbLike = db,
): Promise<{ ok: true; viaRecovery: boolean } | TwoFactorFailure> {
	const row = await readRow(userId, tx);
	if (!row) return { ok: false, reason: "not-enrolled" };
	if (!row.enabled) return { ok: false, reason: "not-enabled" };
	if (isLockedOut(row.lockedUntil))
		return {
			ok: false,
			reason: "locked",
			lockedUntil: row.lockedUntil?.toISOString() ?? null,
		};

	const hashes = recoveryHashes(row);
	const matchedHash = matchRecoveryCode(code, hashes);
	const viaRecovery = matchedHash !== null;
	if (!viaRecovery && !verifyTotpCode(row.secret, code))
		return recordFailure(userId, row, tx);

	const now = new Date();
	await tx
		.delete(twoFactorCredentials)
		.where(eq(twoFactorCredentials.userId, userId));
	await tx
		.update(users)
		.set({ twoFactorEnabled: false, updatedAt: now })
		.where(eq(users.id, userId));

	return { ok: true, viaRecovery };
}

/**
 * Consume a recovery code, then reissue the set.
 *
 * A recovery code is single-use, and a member who has used one has usually lost the
 * authenticator: leaving nine codes live against a secret nobody can produce would
 * be the only way back in, and reissuing after a verified TOTP keeps that path
 * deliberate.
 */
export async function regenerateRecoveryCodes(
	userId: string,
	code: string,
	tx: DbLike = db,
): Promise<{ ok: true; recoveryCodes: string[] } | TwoFactorFailure> {
	const row = await readRow(userId, tx);
	if (!row) return { ok: false, reason: "not-enrolled" };
	if (!row.enabled) return { ok: false, reason: "not-enabled" };
	if (isLockedOut(row.lockedUntil))
		return {
			ok: false,
			reason: "locked",
			lockedUntil: row.lockedUntil?.toISOString() ?? null,
		};
	if (!verifyTotpCode(row.secret, code)) return recordFailure(userId, row, tx);

	const { codes, hashes } = generateRecoveryCodes();
	await tx
		.update(twoFactorCredentials)
		.set({
			recoveryCodes: hashes,
			attempts: 0,
			lockedUntil: null,
			updatedAt: new Date(),
		})
		.where(eq(twoFactorCredentials.userId, userId));
	return { ok: true, recoveryCodes: codes };
}

/**
 * Verify the second factor at sign-in: a TOTP code, or one recovery code consumed.
 * The matched hash is removed in the same transaction, so a code cannot be replayed.
 */
export async function verifySecondFactor(
	userId: string,
	code: string,
	tx: DbLike = db,
): Promise<{ ok: true; viaRecovery: boolean } | TwoFactorFailure> {
	const row = await readRow(userId, tx);
	if (!row) return { ok: false, reason: "not-enrolled" };
	if (!row.enabled) return { ok: false, reason: "not-enabled" };
	if (isLockedOut(row.lockedUntil))
		return {
			ok: false,
			reason: "locked",
			lockedUntil: row.lockedUntil?.toISOString() ?? null,
		};

	const hashes = recoveryHashes(row);
	const matchedHash = matchRecoveryCode(code, hashes);
	if (matchedHash !== null) {
		await tx
			.update(twoFactorCredentials)
			.set({
				recoveryCodes: hashes.filter((h) => h !== matchedHash),
				attempts: 0,
				lockedUntil: null,
				updatedAt: new Date(),
			})
			.where(eq(twoFactorCredentials.userId, userId));
		return { ok: true, viaRecovery: true };
	}

	if (!verifyTotpCode(row.secret, code)) return recordFailure(userId, row, tx);
	await recordSuccess(userId, tx);
	return { ok: true, viaRecovery: false };
}
