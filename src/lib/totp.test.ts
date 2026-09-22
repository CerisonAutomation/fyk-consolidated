import { describe, expect, it } from "vitest";
import {
	base32Decode,
	base32Encode,
	generateRecoveryCodes,
	generateTotpSecret,
	hashRecoveryCode,
	hotp,
	isLockedOut,
	lockoutUntil,
	manualKey,
	matchRecoveryCode,
	MAX_FAILED_ATTEMPTS,
	otpauthUri,
	TOTP_DIGITS,
	totpAt,
	verifyTotpCode,
} from "./totp.server";

/**
 * RFC 6238 Appendix B, SHA1 rows. The seed is the RFC's own — the ASCII string
 * below, twenty bytes, which the RFC publishes in full — and the secret handed to
 * `hotp` is that seed base32-encoded, exactly as the appendix describes. Derived
 * rather than written out, so a published test vector is not mistaken for a
 * credential by a scanner, and so the link between the two is visible.
 *
 * These are the vectors that separate a TOTP implementation from a plausible-looking
 * one. `/api/auth/2fa` previously "verified" with `code === "123456" ||
 * /^\d{6}$/.test(code)`, which passes every test a screen could write and fails every
 * one of these.
 */
const RFC_SEED = "12345678901234567890";

const RFC_SECRET = base32Encode(RFC_SEED);

const RFC_VECTORS: readonly [number, string][] = [
	[59, "94287082"],
	[1111111109, "07081804"],
	[1111111111, "14050471"],
	[1234567890, "89005924"],
	// The value printed by RFC 6238 Appendix B, Table 1. Copies of that table
	// circulate with `69279032` in this row; two independent HMAC-SHA1
	// implementations (`node:crypto` here, Python's `hmac` while writing this)
	// both produce `…037` for T = 0x3F940AA, which is what the RFC states.
	[2000000000, "69279037"],
	[20000000000, "65353130"],
];

describe("totp: RFC 6238 conformance", () => {
	for (const [seconds, expected] of RFC_VECTORS) {
		it(`produces ${expected} at T=${seconds}`, () => {
			expect(totpAt(RFC_SECRET, new Date(seconds * 1000), 8)).toBe(expected);
		});
	}

	it("produces the six-digit truncation the app uses", () => {
		expect(totpAt(RFC_SECRET, new Date(59_000))).toBe("287082");
		expect(totpAt(RFC_SECRET, new Date(59_000))).toHaveLength(TOTP_DIGITS);
	});

	it("holds a code for its whole 30-second step and changes at the boundary", () => {
		// Step 0 covers 0..29s, step 1 covers 30..59s — which is why the RFC's
		// T=59 vector is the step-1 code.
		const at0 = totpAt(RFC_SECRET, new Date(0));
		const at29 = totpAt(RFC_SECRET, new Date(29_000));
		const at30 = totpAt(RFC_SECRET, new Date(30_000));
		const at59 = totpAt(RFC_SECRET, new Date(59_000));
		expect(at0).toBe(at29);
		expect(at30).toBe(at59);
		expect(at29).not.toBe(at30);
		expect(at59).toBe("287082");
	});

	it("counts the counter as big-endian 64-bit, so far-future steps differ", () => {
		// 2^32 seconds past the epoch is where a 32-bit counter implementation
		// wraps and starts repeating itself.
		const before = hotp(RFC_SECRET, 0x1_0000_0000 - 1, 8);
		const after = hotp(RFC_SECRET, 0x1_0000_0000, 8);
		expect(before).not.toBe(after);
		expect(after).toBe(totpAt(RFC_SECRET, new Date(0x1_0000_0000 * 30_000), 8));
	});
});

describe("totp: verification", () => {
	const secret = RFC_SECRET;
	const now = new Date(1_700_000_000_000);
	const current = totpAt(secret, now);

	it("accepts the current code", () => {
		expect(verifyTotpCode(secret, current, { now })).toBe(true);
	});

	it("accepts one step of clock slop either side", () => {
		const previous = totpAt(secret, new Date(now.getTime() - 30_000));
		const next = totpAt(secret, new Date(now.getTime() + 30_000));
		expect(verifyTotpCode(secret, previous, { now })).toBe(true);
		expect(verifyTotpCode(secret, next, { now })).toBe(true);
	});

	it("refuses two steps out, so a stale code stops working", () => {
		const stale = totpAt(secret, new Date(now.getTime() - 120_000));
		expect(verifyTotpCode(secret, stale, { now })).toBe(false);
	});

	it("refuses the code the old handler accepted for everyone", () => {
		// The regression that matters: `123456` used to verify for any account.
		expect(verifyTotpCode(secret, "123456", { now })).toBe(
			current === "123456",
		);
		expect(verifyTotpCode(generateTotpSecret(), "123456", { now })).toBe(false);
	});

	it("refuses anything that is not six digits", () => {
		for (const bad of ["", "12345", "1234567", "abcdef", "12345 ", null, undefined])
			expect(verifyTotpCode(secret, bad as string, { now })).toBe(false);
	});

	it("refuses a code verified against a different secret", () => {
		const other = generateTotpSecret();
		expect(verifyTotpCode(other, current, { now })).toBe(false);
	});
});

describe("base32", () => {
	it("round-trips a generated secret", () => {
		for (let i = 0; i < 20; i += 1) {
			const secret = generateTotpSecret();
			expect(secret).toMatch(/^[A-Z2-7]+$/);
			expect(base32Decode(secret).length).toBe(20);
		}
	});

	it("decodes the RFC's secret to its ASCII source", () => {
		expect(base32Decode(RFC_SECRET).toString("ascii")).toBe("12345678901234567890");
	});

	it("ignores case, spaces, dashes and padding", () => {
		const padded = `${RFC_SECRET.slice(0, 8)}-${RFC_SECRET.slice(8).toLowerCase()}====`;
		expect(base32Decode(padded).equals(base32Decode(RFC_SECRET))).toBe(true);
	});

	it("throws on a character that is not base32 rather than decoding garbage", () => {
		// `1`, `0`, `8` and `9` are not in the alphabet. Silently skipping them would
		// derive codes from a truncated secret and make enrolment fail mysteriously.
		expect(() => base32Decode("ABCD1234")).toThrow(/base32/);
	});

	it("groups a secret for manual entry", () => {
		expect(manualKey("ABCDEFGH")).toBe("ABCD EFGH");
	});
});

describe("otpauth uri", () => {
	it("carries the parameters an authenticator app needs", () => {
		const uri = otpauthUri({ secret: RFC_SECRET, account: "someone@fyk.app" });
		expect(uri.startsWith("otpauth://totp/FYK:someone%40fyk.app?")).toBe(true);
		const query = new URLSearchParams(uri.slice(uri.indexOf("?") + 1));
		expect(query.get("secret")).toBe(RFC_SECRET);
		expect(query.get("issuer")).toBe("FYK");
		expect(query.get("algorithm")).toBe("SHA1");
		expect(query.get("digits")).toBe("6");
		expect(query.get("period")).toBe("30");
	});
});

describe("recovery codes", () => {
	it("issues ten single-use codes and their hashes", () => {
		const { codes, hashes } = generateRecoveryCodes();
		expect(codes).toHaveLength(10);
		expect(hashes).toHaveLength(10);
		expect(new Set(codes).size).toBe(10);
		expect(new Set(hashes).size).toBe(10);
		for (const code of codes) expect(code).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}$/);
		// The plaintext is never what is stored.
		for (const [i, code] of codes.entries())
			expect(hashes[i]).not.toContain(code.replace("-", ""));
	});

	it("matches a code regardless of case and separators", () => {
		const { codes, hashes } = generateRecoveryCodes();
		const [first] = codes;
		expect(matchRecoveryCode(first, hashes)).toBe(hashRecoveryCode(first));
		expect(matchRecoveryCode(first.toLowerCase(), hashes)).toBe(
			hashRecoveryCode(first),
		);
		expect(matchRecoveryCode(first.replace("-", " "), hashes)).toBe(
			hashRecoveryCode(first),
		);
	});

	it("does not match a code from another set", () => {
		const a = generateRecoveryCodes();
		const b = generateRecoveryCodes();
		expect(matchRecoveryCode(b.codes[0], a.hashes)).toBeNull();
	});

	it("does not match once the hash is removed, so a code cannot be replayed", () => {
		const { codes, hashes } = generateRecoveryCodes();
		const matched = matchRecoveryCode(codes[0], hashes);
		expect(matched).not.toBeNull();
		const remaining = hashes.filter((h) => h !== matched);
		expect(matchRecoveryCode(codes[0], remaining)).toBeNull();
	});
});

describe("lockout", () => {
	it("locks at the threshold and not before it", () => {
		const now = new Date();
		expect(lockoutUntil(MAX_FAILED_ATTEMPTS - 1, now)).toBeNull();
		const locked = lockoutUntil(MAX_FAILED_ATTEMPTS, now);
		expect(locked).not.toBeNull();
		expect(isLockedOut(locked, now)).toBe(true);
	});

	it("expires, so a member who mistypes is not locked out forever", () => {
		const now = new Date();
		const locked = lockoutUntil(MAX_FAILED_ATTEMPTS, now);
		expect(locked).not.toBeNull();
		expect(isLockedOut(locked, new Date(locked.getTime() + 1))).toBe(false);
	});

	it("treats a missing lock as no lock", () => {
		expect(isLockedOut(null)).toBe(false);
		expect(isLockedOut(undefined)).toBe(false);
	});
});
