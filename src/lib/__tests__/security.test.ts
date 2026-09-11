import { describe, expect, it } from "vitest";
import {
	contentSecurityPolicy,
	noStoreHeaders,
	publicCacheHeaders,
	securityHeaders,
} from "#/lib/security";

/**
 * These headers used to live in `next.config.ts` — a file this Vite app never
 * reads — so production served nothing while the repo claimed a strict CSP.
 * The tests pin the parts that are load-bearing for a dating app: nobody may
 * frame the site, nobody may read precise geolocation from another origin, and
 * anything carrying a session must not be cached.
 */
describe("contentSecurityPolicy", () => {
	const csp = contentSecurityPolicy();

	it("defaults to same-origin and forbids framing and plugins", () => {
		expect(csp).toContain("default-src 'self'");
		expect(csp).toContain("frame-ancestors 'none'");
		expect(csp).toContain("object-src 'none'");
		expect(csp).toContain("base-uri 'self'");
		expect(csp).toContain("form-action 'self'");
	});

	it("allows exactly the backends the app talks to", () => {
		expect(csp).toContain("connect-src");
		expect(csp).toMatch(/connect-src[^;]*'self'/);
		expect(csp).toContain("https://*.supabase.co");
		expect(csp).toContain("wss://*.supabase.co");
		expect(csp).toContain("https://api.mapbox.com");
	});

	it("never opens a fetch-capable directive to the whole web", () => {
		const connect =
			csp.split("; ").find((entry) => entry.startsWith("connect-src")) ?? "";
		const sources = connect.split(" ").slice(1);
		// A bare `https:` (or `*`) turns connect-src into an exfil channel:
		// any host could be POSTed to from the page. Sub-domains are fine.
		for (const source of sources) {
			expect(source).not.toBe("https:");
			expect(source).not.toBe("http:");
			expect(source).not.toBe("*");
			expect(source).not.toBe("data:");
		}
		expect(sources.length).toBeGreaterThan(1);
	});

	it("drops the removed Sentry integration from connect-src", () => {
		expect(csp).not.toMatch(/sentry/i);
	});

	it("keeps 'unsafe-eval' out of production but allows it for HMR in dev", () => {
		const previous = process.env.NODE_ENV;
		try {
			process.env.NODE_ENV = "production";
			expect(contentSecurityPolicy()).not.toContain("unsafe-eval");
			expect(contentSecurityPolicy()).toContain("upgrade-insecure-requests");
			process.env.NODE_ENV = "development";
			expect(contentSecurityPolicy()).toContain("unsafe-eval");
		} finally {
			process.env.NODE_ENV = previous;
		}
	});
});

describe("securityHeaders", () => {
	it("sends nosniff, DENY framing and a referrer policy", () => {
		const headers = securityHeaders();
		expect(headers["X-Content-Type-Options"]).toBe("nosniff");
		expect(headers["X-Frame-Options"]).toBe("DENY");
		expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
	});

	it("permits the media and location features the app actually ships", () => {
		const policy = securityHeaders()["Permissions-Policy"];
		expect(policy).toContain("camera=(self)");
		expect(policy).toContain("microphone=(self)");
		expect(policy).toContain("geolocation=(self)");
		// Screen sharing and USB are never used: deny them explicitly.
		expect(policy).toContain("display-capture=()");
		expect(policy).toContain("usb=()");
	});

	it("only sends HSTS in production", () => {
		const previous = process.env.NODE_ENV;
		try {
			process.env.NODE_ENV = "development";
			expect(securityHeaders()["Strict-Transport-Security"]).toBeUndefined();
			process.env.NODE_ENV = "production";
			expect(securityHeaders()["Strict-Transport-Security"]).toMatch(
				/^max-age=\d{6,}/,
			);
		} finally {
			process.env.NODE_ENV = previous;
		}
	});
});

describe("cache headers", () => {
	it("never caches a response that can carry a session", () => {
		const headers = noStoreHeaders();
		expect(headers["Cache-Control"]).toContain("no-store");
		expect(headers.Vary).toContain("Cookie");
		expect(headers.Vary).toContain("Authorization");
	});

	it("keeps public cache lifetimes short and bounded", () => {
		expect(publicCacheHeaders(5)["Cache-Control"]).toBe(
			"public, max-age=5, s-maxage=5, stale-while-revalidate=10",
		);
	});
});
