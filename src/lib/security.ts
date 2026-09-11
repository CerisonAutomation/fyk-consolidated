/**
 * Security response headers — single source of truth.
 *
 * WHY: the repo used to declare these in `next.config.ts` (a Next.js file that
 * nothing in this Vite + TanStack Start app reads) and in a root `server.js`
 * dev script that no npm script started. Result: production served every page
 * and every JSON response with zero hardening headers, while `next.config.ts`
 * and `server.js` advertised a CSP, HSTS and `X-Frame-Options` to anyone
 * reading the repo. The dead config was also *wrong*: it disabled
 * `geolocation()` and `microphone()`, which the map and voice-call features
 * need.
 *
 * Where they are applied:
 *   - SSR documents  → `headers()` on the root route (`src/routes/__root.tsx`)
 *   - JSON responses → `json()` / `jsonError()` in `#/middleware`
 *
 * CSP note: `script-src` still allows `'unsafe-inline'` because TanStack Start
 * inlines the hydration payload; `'strict-dynamic'` + nonces is the follow-up
 * (see AUDIT.md, "Hardening follow-ups"). Everything else here is strict today.
 */

export const SECURITY_HEADERS_NAME = "Content-Security-Policy";

const isProduction = (): boolean => process.env.NODE_ENV === "production";

/**
 * Origins the app talks to. Keep this list to network *destinations* only —
 * every entry is a `connect-src` allowance, so a wildcard here is a data-exfil
 * hole.
 */
const CONNECT_SOURCES = [
	"self",
	"https://*.supabase.co",
	"wss://*.supabase.co",
	"https://api.mapbox.com",
	"https://events.mapbox.com",
	"https://tiles.mapbox.com",
	"https://us.i.posthog.com",
	"https://eu.i.posthog.com",
].filter(Boolean);

export function contentSecurityPolicy(): string {
	return [
		"default-src 'self'",
		// Inline scripts are required by the SSR hydration payload; see the note above.
		`script-src 'self' 'unsafe-inline'${isProduction() ? "" : " 'unsafe-eval'"}`,
		// Tailwind/vite inject `<style>` tags, so inline styles are unavoidable.
		"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
		"font-src 'self' https://fonts.gstatic.com data:",
		// Supabase storage + Pexels/Unsplash demo imagery + blob: URLs for local
		// media previews. Tighten to `https://*.supabase.co` once demo assets go.
		"img-src 'self' data: blob: https:",
		"media-src 'self' blob: data:",
		`connect-src ${CONNECT_SOURCES.map((s) => (s === "self" ? "'self'" : s)).join(" ")}`,
		"object-src 'none'",
		"frame-src https://www.google.com/recaptcha/ https://challenges.cloudflare.com",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
		isProduction() ? "upgrade-insecure-requests" : "",
	]
		.filter(Boolean)
		.join("; ");
}

/**
 * Headers applied to every response. `permissionPolicy` deliberately allows
 * camera/microphone/geolocation for same-origin only — the video call, the
 * voice notes and the map all need them (the deleted `next.config.ts` had
 * turned all three off).
 */
export function securityHeaders(): Record<string, string> {
	const headers: Record<string, string> = {
		"Content-Security-Policy": contentSecurityPolicy(),
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options": "DENY",
		"Referrer-Policy": "strict-origin-when-cross-origin",
		"Permissions-Policy": [
			"camera=(self)",
			"microphone=(self)",
			"geolocation=(self)",
			"display-capture=()",
			"payment=(self)",
			"usb=()",
			"accelerometer=()",
			"gyroscope=()",
			"magnetometer=()",
		].join(", "),
		"Cross-Origin-Opener-Policy": "same-origin",
		"Cross-Origin-Resource-Policy": "same-origin",
		"X-DNS-Prefetch-Control": "off",
		"X-Permitted-Cross-Domain-Policies": "none",
	};
	if (isProduction()) {
		// 2 years + subdomains + preload; matches an HSTS-preload submission.
		headers["Strict-Transport-Security"] =
			"max-age=63072000; includeSubDomains; preload";
	}
	return headers;
}

/** Extra protection for anything that carries a session: never cache it. */
export function noStoreHeaders(): Record<string, string> {
	return {
		"Cache-Control": "private, no-store, max-age=0, must-revalidate",
		Pragma: "no-cache",
		Vary: "Cookie, Authorization",
	};
}

/** Cacheable, unauthenticated JSON (the public event list, health checks). */
export function publicCacheHeaders(seconds = 30): Record<string, string> {
	return {
		"Cache-Control": `public, max-age=${seconds}, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`,
		Vary: "Accept-Encoding",
	};
}
