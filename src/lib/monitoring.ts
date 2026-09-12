// ═══════════════════════════════════════════════════════════════════════════════
// Monitoring — analytics + error reporting (browser only)
// ═══════════════════════════════════════════════════════════════════════════════
//
// WHY IT CHANGED
// --------------
// This module was imported by nothing and, had anything imported it, it would
// have crashed at boot: it read `process.env.NEXT_PUBLIC_POSTHOG_KEY` (a) there
// is no `process` in the browser bundle and (b) `NEXT_PUBLIC_*` is a Next.js
// convention this Vite project never populates, and it lazy-imported
// `@sentry/nextjs`, a package that only works inside a Next.js runtime.
//
// Now: Vite env vars via `import.meta.env`, no framework-specific SDK, and a
// pluggable error sink. PostHog stays a real integration; error reporting POSTs
// to `VITE_ERROR_REPORT_ENDPOINT` when one is configured (point it at a Sentry
// bucket, GlitchTip, or your own collector) and is a no-op otherwise.
//
// Server-side logging is `#/lib/logger` (pino) — never this module.
// ═══════════════════════════════════════════════════════════════════════════════

import type { PostHog } from "posthog-js";

const config = {
	posthogKey: (import.meta.env.VITE_POSTHOG_KEY as string | undefined) ?? "",
	posthogHost:
		(import.meta.env.VITE_POSTHOG_HOST as string | undefined) ??
		"https://us.i.posthog.com",
	errorEndpoint:
		(import.meta.env.VITE_ERROR_REPORT_ENDPOINT as string | undefined) ?? "",
	enabled: import.meta.env.VITE_ANALYTICS_ENABLED !== "false",
};

const isBrowser = typeof window !== "undefined";

/* -------------------------------- PostHog --------------------------------- */

let posthogInstance: PostHog | null = null;
let posthogPromise: Promise<PostHog | null> | null = null;

async function getPostHog(): Promise<PostHog | null> {
	if (!isBrowser || !config.enabled || !config.posthogKey) return null;
	if (posthogInstance) return posthogInstance;
	if (posthogPromise) return posthogPromise;

	posthogPromise = (async () => {
		const posthog = (await import("posthog-js")).default;
		posthog.init(config.posthogKey, {
			api_host: config.posthogHost,
			capture_pageview: false,
			capture_pageleave: true,
			persistence: "localStorage" as const,
			// A dating platform has more than the usual amount of sensitive
			// screen content: never mirror the DOM into a session replay.
			// (Session replay is intentionally not enabled here.)
		});
		posthogInstance = posthog;
		return posthog;
	})().catch(() => null);

	return posthogPromise;
}

export function trackEvent(
	event: string,
	properties?: Record<string, unknown>,
): void {
	void getPostHog().then((posthog) => posthog?.capture(event, properties));
}

export function identifyUser(
	userId: string,
	traits?: Record<string, unknown>,
): void {
	void getPostHog().then((posthog) => posthog?.identify(userId, traits));
}

export function resetUser(): void {
	void getPostHog().then((posthog) => posthog?.reset());
}

export async function isFeatureEnabled(flag: string): Promise<boolean> {
	const posthog = await getPostHog();
	return posthog?.isFeatureEnabled(flag) ?? false;
}

export function getFeatureFlag(flag: string): string | boolean | undefined {
	return posthogInstance?.getFeatureFlag(flag);
}

/* ------------------------------ error reporting ----------------------------- */

export type ErrorContext = Record<
	string,
	string | number | boolean | null | undefined
>;

/**
 * Fire-and-forget error report. Never throws, never blocks the UI, and never
 * includes message text when the sink is unreachable — a crash handler that can
 * itself reject is how blank screens happen.
 */
export function reportError(error: unknown, context?: ErrorContext): void {
	if (!isBrowser) return;

	const payload = {
		message: error instanceof Error ? error.message : String(error),
		name: error instanceof Error ? error.name : "Unknown",
		stack: error instanceof Error ? error.stack : undefined,
		url: window.location.pathname,
		at: new Date().toISOString(),
		...context,
	};

	if (import.meta.env.DEV) {
		console.error("[reportError]", payload);
	}
	trackEvent("error_occurred", payload);

	if (!config.errorEndpoint) return;
	const body = JSON.stringify(payload);
	// `sendBeacon` survives page unload; `fetch(keepalive)` is the fallback.
	if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
		navigator.sendBeacon(
			config.errorEndpoint,
			new Blob([body], { type: "application/json" }),
		);
		return;
	}
	void fetch(config.errorEndpoint, {
		method: "POST",
		body,
		keepalive: true,
		headers: { "content-type": "application/json" },
	}).catch(() => undefined);
}

/** Session start marker; call once from the app shell. */
export function initMonitoring(): void {
	if (!isBrowser || !config.enabled) return;
	void getPostHog();
	window.addEventListener("unhandledrejection", (event) => {
		reportError(event.reason, { source: "unhandledrejection" });
	});
}
