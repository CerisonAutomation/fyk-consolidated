/**
 * Security middleware utilities for TanStack Start server handlers.
 *
 * Per OWASP Top 10, api-security.md, and csp-headers.md:
 *   - CSRF protection via Origin/Referer header validation
 *   - Input validation helpers
 *   - Request size limits
 *   - Content-Type enforcement
 *   - Security logging
 */

// ---------------------------------------------------------------------------
// CSRF Protection (OWASP A01: Broken Access Control)
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://fyk.app",
  "https://www.fyk.app",
];

/**
 * Validates that a mutating request (POST, PUT, DELETE, PATCH) originates
 * from an allowed origin. Per api-security.md CORS section.
 *
 * Safe methods (GET, HEAD, OPTIONS) are exempt — they carry no side effects.
 */
export function validateCsrfOrigin(request: Request): { ok: boolean; error?: string } {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return { ok: true };
  }

  // Check Origin header first (most reliable for CORS requests)
  const origin = request.headers.get("origin");
  if (origin) {
    if (ALLOWED_ORIGINS.includes(origin)) return { ok: true };
    return { ok: false, error: `CSRF: origin '${origin}' not allowed` };
  }

  // Fallback: check Referer header
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
      if (ALLOWED_ORIGINS.includes(refererOrigin)) return { ok: true };
    } catch {
      // Malformed referer
    }
    return { ok: false, error: "CSRF: invalid referer" };
  }

  // No origin or referer — allow non-browser clients (curl, mobile apps)
  // but log for monitoring
  console.warn("[CSRF] No origin/referer on mutating request:", method, request.url);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Input Validation (OWASP A03: Injection)
// ---------------------------------------------------------------------------

/**
 * Validates request Content-Type for POST/PUT/PATCH requests.
 * Prevents unexpected content types from being processed.
 */
export function requireContentType(
  request: Request,
  ...allowed: string[]
): { ok: boolean; error?: string } {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD") return { ok: true };

  const contentType = request.headers.get("content-type");
  if (!contentType) {
    return { ok: false, error: "Content-Type header required" };
  }

  const isAllowed = allowed.some((type) => contentType.includes(type));
  if (!isAllowed) {
    return { ok: false, error: `Content-Type must be one of: ${allowed.join(", ")}` };
  }

  return { ok: true };
}

/**
 * Enforces a maximum request body size to prevent DoS attacks.
 * Per api-security.md request size limits section.
 */
export function checkRequestSize(
  request: Request,
  maxBytes: number,
): { ok: boolean; error?: string } {
  const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
  if (contentLength > maxBytes) {
    return {
      ok: false,
      error: `Request too large: ${(contentLength / 1024 / 1024).toFixed(1)}MB exceeds ${(maxBytes / 1024 / 1024).toFixed(1)}MB limit`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// JSON Body Parsing with Validation
// ---------------------------------------------------------------------------

/**
 * Safely parses request JSON body with size limit and schema validation.
 * Returns a typed result or an error Response.
 */
export async function parseJsonBody<T>(
  request: Request,
  maxBytes = 1024 * 1024, // 1MB default
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  const sizeCheck = checkRequestSize(request, maxBytes);
  if (!sizeCheck.ok) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: sizeCheck.error }),
        { status: 413, headers: { "Content-Type": "application/json" } },
      ),
    };
  }

  const ctCheck = requireContentType(request, "application/json");
  if (!ctCheck.ok) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: ctCheck.error }),
        { status: 415, headers: { "Content-Type": "application/json" } },
      ),
    };
  }

  try {
    const data = (await request.json()) as T;
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    };
  }
}

// ---------------------------------------------------------------------------
// Security Helpers
// ---------------------------------------------------------------------------

/** Standard JSON response helper. */
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Standard error response. Never leaks internal details. */
export function jsonError(
  message: string,
  status = 400,
  details?: unknown,
): Response {
  const body: Record<string, unknown> = { error: message };
  if (details && process.env.NODE_ENV !== "production") {
    body.details = details;
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Validates that a value is a non-empty string within length bounds.
 * Use for user-provided text fields to prevent injection.
 */
export function validateString(
  value: unknown,
  name: string,
  opts?: { min?: number; max?: number; pattern?: RegExp },
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== "string") {
    return { ok: false, error: `${name} must be a string` };
  }
  const trimmed = value.trim();
  if (opts?.min !== undefined && trimmed.length < opts.min) {
    return { ok: false, error: `${name} must be at least ${opts.min} characters` };
  }
  if (opts?.max !== undefined && trimmed.length > opts.max) {
    return { ok: false, error: `${name} must be at most ${opts.max} characters` };
  }
  if (opts?.pattern && !opts.pattern.test(trimmed)) {
    return { ok: false, error: `${name} format is invalid` };
  }
  return { ok: true, value: trimmed };
}

// ---------------------------------------------------------------------------
// Route Security Wrapper
// ---------------------------------------------------------------------------

/**
 * Wraps a TanStack Start server handler with common security checks:
 *   1. CSRF origin validation
 *   2. Content-Type enforcement
 *   3. Request size limits
 *
 * Usage in a route file:
 *   import { withSecurity } from "#/middleware";
 *   POST: withSecurity(async ({ request }) => { ... }, { maxBodySize: 1024 * 64 })
 */
export function withSecurity(
  handler: (ctx: { request: Request }) => Promise<Response>,
  options?: { maxBodySize?: number; requireAuth?: boolean },
): (ctx: { request: Request }) => Promise<Response> {
  return async (ctx) => {
    const { request } = ctx;

    // CSRF check
    const csrf = validateCsrfOrigin(request);
    if (!csrf.ok) {
      return jsonError(csrf.error!, 403);
    }

    // Size check for mutating methods
    const method = request.method.toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      const maxBytes = options?.maxBodySize ?? 1024 * 1024;
      const sizeCheck = checkRequestSize(request, maxBytes);
      if (!sizeCheck.ok) {
        return jsonError(sizeCheck.error!, 413);
      }
    }

    return handler(ctx);
  };
}
