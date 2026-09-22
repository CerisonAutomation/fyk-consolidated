import {
	createHash,
	createHmac,
	randomBytes,
	timingSafeEqual,
} from "node:crypto";

/**
 * RFC 6238 TOTP and RFC 4648 base32, with no dependency.
 *
 * WHY THIS IS HERE AND NOT IN THE ROUTE
 * -------------------------------------
 * `/api/auth/2fa` used to verify a second factor with `code === "123456" ||
 * /^\d{6}$/.test(code)` — a check that passes for every six-digit code, including
 * the ones an attacker types — and it generated a secret it never stored, because
 * no table existed to store it in (0031 adds one). A second factor that accepts any
 * code is not a weak second factor, it is a UI that says "protected" over an account
 * that is not.
 *
 * The algorithm is ~80 lines of `node:crypto`: HMAC-SHA1 over an 8-byte counter,
 * dynamic truncation, modulo 10^digits. Adding `otpauth` or `speakeasy` for that
 * would put a dependency in the trust path of every login, and neither would be
 * exercised by more code than this file's tests are.
 *
 * `*.server.ts` because it reads secrets and runs only where `node:crypto` exists.
 */

/** RFC 4648 base32 alphabet — the encoding every authenticator app expects. */
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** One step of clock slop either side: a phone at :29 and a server at :31 agree. */
export const TOTP_VERIFY_WINDOW = 1;

/** 20 bytes = 160 bits, the RFC 4226 recommendation for HMAC-SHA1. */
export const TOTP_SECRET_BYTES = 20;

export const TOTP_ISSUER = "FYK";

/**
 * Base32 (RFC 4648, no padding). The encoder half of `base32Decode`.
 *
 * Exported because the RFC 6238 test vectors are published as a *seed* — the ASCII
 * string `12345678901234567890` — and their secret is that seed encoded. Writing the
 * encoded string into the test made a published test vector look like a hardcoded
 * credential to secret scanners, which is a true observation about the shape of the
 * data and a false one about its meaning; deriving it removes the ambiguity. The same
 * pair is what a manual entry screen needs.
 */
export function base32Encode(input: Uint8Array | string): string {
	const raw = typeof input === "string" ? Buffer.from(input, "utf8") : input;
	let out = "";
	let bits = 0;
	let value = 0;
	for (const byte of raw) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
	return out;
}

/** A fresh base32 secret. Unpadded, upper case, no separators. */
export function generateTotpSecret(bytes = TOTP_SECRET_BYTES): string {
	return base32Encode(randomBytes(bytes));
}

/** Decode base32, ignoring case, spaces, dashes and RFC 4648 padding. */
export function base32Decode(input: string): Buffer {
	const clean = input
		.toUpperCase()
		.replace(/[=\s-]/g, "")
		.slice(0, 128);
	const bytes: number[] = [];
	let bits = 0;
	let value = 0;
	for (const char of clean) {
		const index = BASE32_ALPHABET.indexOf(char);
		// An unknown character means this is not a base32 secret at all. Returning a
		// truncated buffer would produce valid-looking codes from a wrong secret,
		// which is the failure mode that is impossible to diagnose from a UI.
		if (index < 0) throw new Error("secret is not base32");
		value = (value << 5) | index;
		bits += 5;
		if (bits >= 8) {
			bytes.push((value >>> (bits - 8)) & 0xff);
			bits -= 8;
		}
	}
	return Buffer.from(bytes);
}

/** RFC 4226 HOTP: HMAC-SHA1 over the counter, then dynamic truncation. */
export function hotp(
	secret: string,
	counter: number,
	digits = TOTP_DIGITS,
): string {
	const key = base32Decode(secret);
	const buffer = Buffer.alloc(8);
	// The counter is big-endian and 64-bit; JavaScript bit ops are 32-bit, so the
	// two halves are written separately.
	buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
	buffer.writeUInt32BE(counter >>> 0, 4);

	const digest = createHmac("sha1", key).update(buffer).digest();
	const offset = digest[digest.length - 1] & 0x0f;
	const truncated =
		((digest[offset] & 0x7f) << 24) |
		((digest[offset + 1] & 0xff) << 16) |
		((digest[offset + 2] & 0xff) << 8) |
		(digest[offset + 3] & 0xff);

	return String(truncated % 10 ** digits).padStart(digits, "0");
}

/** The code a secret shows at one instant. */
export function totpAt(
	secret: string,
	when: Date = new Date(),
	digits = TOTP_DIGITS,
): string {
	const counter = Math.floor(when.getTime() / 1000 / TOTP_PERIOD_SECONDS);
	return hotp(secret, counter, digits);
}

/**
 * Verify a code against the current step and `window` steps either side.
 *
 * Comparison is `timingSafeEqual` on fixed-length buffers: a string `===` leaks the
 * first differing digit through response time, and a six-digit code is small enough
 * that a timing oracle matters.
 */
export function verifyTotpCode(
	secret: string,
	code: string,
	options: { now?: Date; window?: number; digits?: number } = {},
): boolean {
	const digits = options.digits ?? TOTP_DIGITS;
	const window = options.window ?? TOTP_VERIFY_WINDOW;
	const now = options.now ?? new Date();

	const candidate = String(code ?? "").trim();
	if (!new RegExp(`^\\d{${digits}}$`).test(candidate)) return false;

	const step = Math.floor(now.getTime() / 1000 / TOTP_PERIOD_SECONDS);
	const expected = Buffer.from(candidate.padEnd(digits, "0"));
	for (let offset = -window; offset <= window; offset += 1) {
		const generated = Buffer.from(hotp(secret, step + offset, digits));
		if (generated.length === expected.length && timingSafeEqual(generated, expected))
			return true;
	}
	return false;
}

/** The `otpauth://` URI an authenticator app scans. Percent-encoded per RFC 3986. */
export function otpauthUri(params: {
	secret: string;
	account: string;
	issuer?: string;
	digits?: number;
	period?: number;
}): string {
	const issuer = params.issuer ?? TOTP_ISSUER;
	const digits = params.digits ?? TOTP_DIGITS;
	const period = params.period ?? TOTP_PERIOD_SECONDS;
	const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(params.account)}`;
	const query = new URLSearchParams({
		secret: params.secret,
		issuer,
		algorithm: "SHA1",
		digits: String(digits),
		period: String(period),
	});
	return `otpauth://totp/${label}?${query.toString()}`;
}

/** Group a secret for the "can't scan the QR code" path: `ABCD EFGH …`. */
export function manualKey(secret: string): string {
	return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}

/* ------------------------------- recovery codes ------------------------------ */

export const RECOVERY_CODE_COUNT = 10;

/**
 * Recovery codes, and the hashes to store.
 *
 * Formatted `XXXXX-XXXXX` from 15 hex characters of `randomBytes` so a code is
 * unambiguous to read aloud (no `0/O`, no `1/I/l`) and cannot be guessed: 60 bits
 * each, ten of them, single-use.
 */
export function generateRecoveryCodes(
	count = RECOVERY_CODE_COUNT,
): { codes: string[]; hashes: string[] } {
	const codes: string[] = [];
	const hashes: string[] = [];
	for (let i = 0; i < count; i += 1) {
		const raw = randomBytes(8).toString("hex").slice(0, 10).toUpperCase();
		const code = `${raw.slice(0, 5)}-${raw.slice(5)}`;
		codes.push(code);
		hashes.push(hashRecoveryCode(code));
	}
	return { codes, hashes };
}

/** Normalise (upper case, no separators) then sha256 — the stored form. */
export function hashRecoveryCode(code: string): string {
	const normalised = String(code ?? "")
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, "");
	return createHash("sha256").update(normalised).digest("hex");
}

/**
 * Which stored hash this code matches, or `null`.
 *
 * Returns the hash rather than a boolean because a recovery code is single-use: the
 * caller removes exactly the entry that matched. Every hash is compared, and the
 * comparison is constant-time, so the loop cannot be used as an oracle for the
 * position of a match.
 */
export function matchRecoveryCode(
	code: string,
	hashes: readonly string[],
): string | null {
	const candidate = hashRecoveryCode(code);
	const buffer = Buffer.from(candidate);
	let matched: string | null = null;
	for (const hash of hashes) {
		const stored = Buffer.from(String(hash));
		if (stored.length === buffer.length && timingSafeEqual(stored, buffer))
			matched = hash;
	}
	return matched;
}

/* --------------------------------- lockout ---------------------------------- */

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

/**
 * Should this attempt be refused before it is even checked?
 *
 * Without a lockout, a six-digit code is 10^6 possibilities and an attacker with a
 * session cookie can try them at the rate limit's pace. Five failures costing
 * fifteen minutes makes that a year per account, and the counter resets on success
 * so a member who mistypes once is not punished for it.
 */
export function isLockedOut(
	lockedUntil: Date | null | undefined,
	now: Date = new Date(),
): boolean {
	return Boolean(lockedUntil && lockedUntil.getTime() > now.getTime());
}

export function lockoutUntil(
	attempts: number,
	now: Date = new Date(),
): Date | null {
	return attempts >= MAX_FAILED_ATTEMPTS
		? new Date(now.getTime() + LOCKOUT_MINUTES * 60_000)
		: null;
}
