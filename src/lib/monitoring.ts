// ═══════════════════════════════════════════════════════════════════════════════
// Monitoring — Sentry + PostHog Integration
// ═══════════════════════════════════════════════════════════════════════════════
//
// Lazy-loaded wrappers that no-op when environment variables are not configured.
// Import from here instead of importing Sentry or PostHog directly.

import type { PostHog } from "posthog-js";

// ─── Sentry ─────────────────────────────────────────────────────────────────

let sentryInitPromise: Promise<typeof import("@sentry/nextjs")> | null = null;

async function getSentry() {
  if (!sentryInitPromise) {
    sentryInitPromise = import("@sentry/nextjs");
  }
  return sentryInitPromise;
}

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  getSentry().then((Sentry) => {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? "development",
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });
  });
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  getSentry().then((Sentry) => {
    Sentry.withScope((scope) => {
      if (context) {
        scope.setExtras(context);
      }
      Sentry.captureException(error);
    });
  });
}

export function captureMessage(message: string, level: "info" | "warning" | "error" = "info") {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  getSentry().then((Sentry) => {
    Sentry.captureMessage(message, level);
  });
}

// ─── PostHog ────────────────────────────────────────────────────────────────

let posthogInstance: PostHog | null = null;

async function getPostHog(): Promise<PostHog | null> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;

  if (posthogInstance) return posthogInstance;

  const posthog = (await import("posthog-js")).default;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: false,
    capture_pageleave: true,
    persistence: "localStorage+sessionStorage",
  });
  posthogInstance = posthog;
  return posthogInstance;
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  getPostHog().then((ph) => {
    ph?.capture(event, properties);
  });
}

export function identifyUser(distinctId: string, traits?: Record<string, unknown>) {
  getPostHog().then((ph) => {
    ph?.identify(distinctId, traits);
  });
}

export function resetUser() {
  getPostHog().then((ph) => {
    ph?.reset();
  });
}

export async function isFeatureEnabled(flag: string): Promise<boolean> {
  const ph = await getPostHog();
  if (!ph) return false;
  return ph.isFeatureEnabled(flag) ?? false;
}

export function getFeatureFlag(flag: string): string | boolean | undefined {
  if (!posthogInstance) return undefined;
  return posthogInstance.getFeatureFlag(flag);
}

// ─── Unified Error Handler ──────────────────────────────────────────────────

export function reportError(error: unknown, extra?: Record<string, unknown>) {
  captureException(error, extra);
  trackEvent("error_occurred", {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...extra,
  });
}

// ─── Performance ────────────────────────────────────────────────────────────

export function startTransaction(name: string): { finish: () => void } {
  // Returns a no-op finisher when Sentry is not configured.
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return { finish: () => {} };

  let startTime = performance.now();

  return {
    finish: () => {
      const duration = performance.now() - startTime;
      trackEvent("transaction_complete", { name, duration_ms: Math.round(duration) });
    },
  };
}
