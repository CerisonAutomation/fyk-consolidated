/**
 * The credential reader behind `#/lib/document-auth.server`.
 *
 * These are the cases the SSR guard stands or falls on, and they need no database,
 * no Supabase project and no network: a document is only as protected as this
 * function's ability to find the session in a `Cookie:` header and to ignore
 * everything that only *looks* like one.
 */
import { describe, expect, it } from "vitest";
import { documentDecision } from "#/lib/document-auth.server";
import { tokenFromCookieHeader } from "#/lib/supabase-auth.server";

/** The JSON supabase-js persists, base64url-encoded the way `@supabase/ssr` does. */
function sessionCookieValue(session: unknown): string {
	return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

const JWT = [
	Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
		"base64url",
	),
	Buffer.from(JSON.stringify({ sub: "u1", role: "authenticated" })).toString(
		"base64url",
	),
	"sig",
].join(".");

describe("tokenFromCookieHeader", () => {
	it("reads the default Supabase cookie name", () => {
		const value = sessionCookieValue({ access_token: JWT });
		expect(tokenFromCookieHeader(`sb-abcxyz-auth-token=${value}`)).toBe(JWT);
	});

	it("reassembles a chunked session, in chunk order", () => {
		// `@supabase/ssr` chunks above 3180 bytes and names the parts
		// `<name>.0`, `<name>.1`, … — out of order in the header on purpose, because
		// a browser may present them in any order.
		const full = sessionCookieValue({ access_token: JWT });
		const a = full.slice(0, 40);
		const b = full.slice(40);
		const header = `other=1; sb-ref-auth-token.1=${b}; sb-ref-auth-token.0=${a}`;
		expect(tokenFromCookieHeader(header)).toBe(JWT);
	});

	it("ignores the PKCE code verifier and other lookalikes", () => {
		const verifier = "aBC123_-dEf456_gHiJ789_kLmN012_oPqR345_sTuV678_wXy";
		// A verifier is 43 chars of base64url; it is not three dot-separated segments,
		// so a reader that only pattern-matched the name would answer "no token"
		// anyway — this asserts it stays that way when a *valid* session is absent.
		expect(
			tokenFromCookieHeader(`sb-ref-auth-code-verifier=${verifier}`),
		).toBeNull();
		// And when both are present, the token wins and the verifier is not returned.
		const header = `sb-ref-auth-code-verifier=${verifier}; sb-ref-auth-token=${sessionCookieValue({ access_token: JWT })}`;
		expect(tokenFromCookieHeader(header)).toBe(JWT);
	});

	it("refuses a cookie that is not a session", () => {
		// The chunk pattern must not turn an unrelated cookie family into a
		// credential, and undecodable junk must not throw.
		expect(tokenFromCookieHeader("sb-ref-auth-token=%E0%A4%A")).toBeNull();
		expect(
			tokenFromCookieHeader("sb-ref-auth-token=53b-22-not-json"),
		).toBeNull();
		expect(tokenFromCookieHeader("")).toBeNull();
		expect(tokenFromCookieHeader(null)).toBeNull();
	});

	it("reads a raw JWT stored as the whole cookie value", () => {
		// Supported because `bearerToken()` predates the cookie client and the
		// comment in `#/integrations/supabase/client` documents the shape: a
		// deployment that stores the access token directly must still verify.
		expect(tokenFromCookieHeader(`fyk.auth=${JWT}`)).toBe(JWT);
	});
});

/**
 * The navigation table. Every row here is a bug that would be invisible in a screenshot
 * and expensive in production: a loop, a lockout during an outage, or a stranger shown a
 * private screen.
 */
describe("documentDecision", () => {
	it("sends an authenticated id with no profile row to onboarding", () => {
		expect(
			documentDecision({ status: "authenticated", provisioned: "missing" }),
		).toEqual({ action: "onboarding", render: false });
	});

	it("renders for a provisioned account", () => {
		expect(
			documentDecision({ status: "authenticated", provisioned: "present" }),
		).toEqual({ action: "render", render: true });
	});

	it("never reads a database outage as a new account", () => {
		// `unknown` is what `profileRowExists` returns when there is no DATABASE_URL or
		// the pooler refused. Treating it as `missing` would redirect every signed-in
		// user to onboarding during a DB blip — and onboarding is where a form writes a
		// profile row, so it would write one over a healthy account.
		expect(
			documentDecision({ status: "authenticated", provisioned: "unknown" }),
		).toEqual({ action: "render", render: true });
	});

	it("sends anonymous and unverifiable credentials to sign-in", () => {
		for (const status of ["anonymous", "rejected"] as const) {
			expect(documentDecision({ status, provisioned: "unknown" })).toEqual({
				action: "sign-in",
				render: false,
			});
		}
	});

	it("renders for the fail-open states, and never redirects them to onboarding", () => {
		for (const status of ["expired", "unreachable", "unconfigured"] as const) {
			const decision = documentDecision({ status, provisioned: "missing" });
			expect(decision).toEqual({ action: "render", render: true });
		}
		// `provisioned` is only consulted for an authenticated caller: without a verified
		// id there is nobody to look up, and a stranger must not be sent into the flow that
		// creates rows.
	});
});
