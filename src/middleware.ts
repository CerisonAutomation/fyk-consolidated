/**
 * Server request guards shared by every `/api/*` handler.
 * NOTE: this module runs on the server. It is imported by `src/routes/api/**`,
 * which TanStack Start only evaluates server-side.
 * The server-only auth import is dynamic to satisfy import-protection.
 */

import { logError, logger } from "#/lib/logger";
import {
  clientIp,
  DEFAULT_WINDOW_MS,
  enforceRateLimit,
  type RateLimitResult,
} from "#/lib/rate-limit";
import {
  noStoreHeaders,
  publicCacheHeaders,
  securityHeaders,
} from "#/lib/security";
import type { Caller } from "#/lib/supabase-auth.server";

const SCOPE = "request-security";

export function json(
  data: unknown,
  init?: {
    status?: number;
    cache?: "private" | "public";
    headers?: Record<string, string>;
  },
): Response {
  const status = init?.status ?? 200;
  const cache =
    init?.cache === "public" || init?.headers?.["Cache-Control"]
      ? publicCacheHeaders(30)
      : noStoreHeaders();
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...securityHeaders(),
      ...cache,
      ...init?.headers,
    },
  });
}

export function jsonError(
  message: string,
  status = 400,
  error?: unknown,
): Response {
  if (error !== undefined) logError(SCOPE, error, { status, message });
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...securityHeaders(),
      ...noStoreHeaders(),
    },
  });
}

export function toSafeError(error: unknown): {
  status: number;
  message: string;
} {
  if (error instanceof ApiError)
    return { status: error.status, message: error.message };
  if (error instanceof Error) {
    logError("api", error);
    return { status: 500, message: "Something went wrong. Please try again." };
  }
  logError("api", error);
  return { status: 500, message: "Something went wrong. Please try again." };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function allowedOrigins(): string[] {
  const raw = process.env.CORS_ALLOWED_ORIGINS ?? "";
  return raw
    .split(",")
    .map((entry) => entry.trim().replace(/\/+$/, ""))
    .filter((entry) => entry.length > 0 && entry !== "*")
    .map((entry) => {
      try {
        return new URL(entry).origin;
      } catch {
        logger.warn(
          { scope: SCOPE, entry },
          "ignoring malformed CORS_ALLOWED_ORIGINS entry",
        );
        return "";
      }
    })
    .filter(Boolean);
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function assertSameOrigin(request: Request): void {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return;

  const auth = request.headers.get("authorization");
  if (auth && /^bearer\s+\S+/i.test(auth.trim())) return;

  const secFetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (secFetchSite === "same-origin" || secFetchSite === "none") return;
  if (secFetchSite === "cross-site" || secFetchSite === "same-site") {
    throw new ApiError(403, "Cross-site request blocked");
  }

  const expected = requestOrigin(request);
  const origin = request.headers.get("origin");
  if (origin) {
    if (origin === expected || allowedOrigins().includes(origin)) return;
    throw new ApiError(403, "Origin not allowed");
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (
        refererOrigin === expected ||
        allowedOrigins().includes(refererOrigin)
      )
        return;
    } catch {
      /* malformed — rejected below */
    }
    throw new ApiError(403, "Referer not allowed");
  }

  throw new ApiError(403, "Missing origin information");
}

export function requestOrigin(request: Request): string {
  try {
    return new URL(request.url).origin;
  } catch {
    return "unknown-origin";
  }
}

export const DEFAULT_MAX_BODY_BYTES = 64 * 1024;

export async function readBodyCapped(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array | null> {
  const declared = Number.parseInt(
    request.headers.get("content-length") ?? "",
    10,
  );
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ApiError(
      413,
      `Request body exceeds ${Math.round(maxBytes / 1024)}KB`,
    );
  }
  if (!request.body) return null;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new ApiError(
        413,
        `Request body exceeds ${Math.round(maxBytes / 1024)}KB`,
      );
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export type JsonBodyResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: Response };

export async function parseJsonBody<T>(
  request: Request,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES,
): Promise<JsonBodyResult<T>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return {
      ok: false,
      response: jsonError("Content-Type must be application/json", 415),
    };
  }
  let body: Uint8Array | null;
  try {
    body = await readBodyCapped(request, maxBytes);
  } catch (error) {
    if (error instanceof ApiError)
      return { ok: false, response: jsonError(error.message, error.status) };
    throw error;
  }
  if (!body || body.byteLength === 0)
    return { ok: false, response: jsonError("Request body is required", 400) };
  try {
    return { ok: true, data: JSON.parse(new TextDecoder().decode(body)) as T };
  } catch {
    return {
      ok: false,
      response: jsonError("Request body is not valid JSON", 400),
    };
  }
}

export type SecurityContext = {
  request: Request;
  caller: Caller | null;
  ip: string;
};

export type SecurityOptions = {
  maxBodySize?: number;
  rateLimit?: {
    limit: number;
    windowMs?: number;
    key: (ctx: { caller: Caller | null; ip: string }) => string;
  };
  auth?: "required" | "optional";
  allowCrossSite?: boolean;
};

export type SecuredHandler = (
  ctx: SecurityContext,
) => Promise<Response> | Response;

export type SecuredRouteHandler = (ctx: {
  request: Request;
}) => Promise<Response>;

export function withSecurity(
  handler: SecuredHandler,
  options: SecurityOptions = {},
): SecuredRouteHandler {
  const maxBytes = options.maxBodySize ?? DEFAULT_MAX_BODY_BYTES;

  return async ({ request }: { request: Request }): Promise<Response> => {
    const method = request.method.toUpperCase();
    const wantsAuth =
      options.auth ??
      (method === "GET" || method === "HEAD" ? "optional" : "required");

    try {
      if (!options.allowCrossSite) assertSameOrigin(request);
    } catch (error) {
      const safe = toSafeError(error);
      return jsonError(
        safe.message,
        safe.status,
        error instanceof ApiError ? undefined : error,
      );
    }

    if (!SAFE_METHODS.has(method)) {
      const declared = Number.parseInt(
        request.headers.get("content-length") ?? "",
        10,
      );
      if (Number.isFinite(declared) && declared > maxBytes) {
        return jsonError(
          `Request body exceeds ${Math.round(maxBytes / 1024)}KB`,
          413,
        );
      }
    }

    // Dynamic import to avoid static server-only import in client bundle
    const { getCaller } = await import("#/lib/supabase-auth.server");
    const caller = await getCaller(request);
    if (wantsAuth === "required" && !caller) {
      return jsonError("Sign in to continue", 401);
    }

    const ip = clientIp(request);
    let rate: RateLimitResult | undefined;
    if (options.rateLimit) {
      const key = options.rateLimit.key({ caller, ip });
      const outcome = await enforceRateLimit(
        key,
        options.rateLimit.limit,
        options.rateLimit.windowMs ?? DEFAULT_WINDOW_MS,
      );
      if (outcome.blocked) return outcome.response;
      rate = outcome.result;
    }

    let response: Response;
    try {
      response = await handler({ request, caller, ip });
    } catch (error) {
      const safe = toSafeError(error);
      response = jsonError(
        safe.message,
        safe.status,
        error instanceof ApiError ? undefined : error,
      );
    }

    return withResponseHeaders(response, rate);
  };
}

export function withResponseHeaders(
  response: Response,
  rate?: RateLimitResult,
): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(securityHeaders()))
    headers.set(key, value);
  if (rate) {
    headers.set("RateLimit-Limit", String(rate.limit));
    headers.set("RateLimit-Remaining", String(rate.remaining));
    headers.set(
      "RateLimit-Reset",
      String(Math.max(0, Math.ceil((rate.resetAt - Date.now()) / 1000))),
    );
  }
  if (!headers.has("cache-control") && response.status < 400) {
    for (const [key, value] of Object.entries(noStoreHeaders()))
      headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function validateString(
  value: unknown,
  name: string,
  opts?: { min?: number; max?: number; pattern?: RegExp },
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== "string")
    return { ok: false, error: `${name} must be a string` };
  const trimmed = value.trim();
  if (opts?.min !== undefined && trimmed.length < opts.min) {
    return {
      ok: false,
      error: `${name} must be at least ${opts.min} characters`,
    };
  }
  if (opts?.max !== undefined && trimmed.length > opts.max) {
    return {
      ok: false,
      error: `${name} must be at most ${opts.max} characters`,
    };
  }
  if (opts?.pattern && !opts.pattern.test(trimmed)) {
    return { ok: false, error: `${name} format is invalid` };
  }
  return { ok: true, value: trimmed };
}

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateUuid(
  value: unknown,
  name: string,
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== "string")
    return { ok: false, error: `${name} must be a string` };
  if (!UUID_PATTERN.test(value))
    return { ok: false, error: `${name} must be a UUID` };
  return { ok: true, value };
}

export function safeDeepLink(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
  if (/[<>\"'`\s]/.test(trimmed)) return null;
  return trimmed.slice(0, 512);
}

export { clientIp };
export type { RateLimitResult };
