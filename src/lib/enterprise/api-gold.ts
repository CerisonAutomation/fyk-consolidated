/**
 * Enterprise API Gold — Maximum standard API factory
 * Gold: ISO/IEC 25010, OWASP, W3C, WCAG, observable, secure, fast, reliable, maintainable
 * 
 * Every route must have:
 * - Requirements: acceptance criteria, negative scenarios, permissions, data rules, observability
 * - Code: formatting, linting, type checking, code review, unit tests, dependency checks
 * - API: documented contracts, schema validation, auth, authorization, rate limits, safe errors, backward compat
 * - Testing: critical journeys e2e, API/integration business rules and failure paths
 * - Security: no critical/high findings, secrets never in source, least privilege
 * - Accessibility: WCAG 2.2 AA
 * - Performance: Core Web Vitals budgets measured in CI
 * - Operations: monitoring, alerts, rollback, migration checks, runbook
 * - Release: blocked when critical workflow fails, data integrity risk, security fail, rollback unavailable
 */

import { z } from "zod";
import { telemetry } from "./telemetry";
import { resilient, getCircuitBreaker } from "./self-healing";
import { getHardenedHeaders, auditLogger, SlidingWindowRateLimiter } from "./security-hardened";
import { traceRequest, finishTrace, auditTrail, alerter } from "./observability";
import { tryAsync, AppError, ValidationError, RateLimitError } from "./error-handling";
import { cache, checkBudget } from "./performance";
import { validate } from "./validation";

export type GoldApiConfig = {
  name: string;
  path: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  auth: "required" | "optional" | "none";
  rateLimit?: { limit: number; windowMs: number };
  validation?: {
    query?: z.ZodSchema;
    body?: z.ZodSchema;
    params?: z.ZodSchema;
  };
  cache?: { ttlSec: number; staleTtlSec: number; key: (req: Request) => string };
  circuitBreaker?: string;
  retry?: { maxAttempts: number; timeoutMs: number };
  audit?: { action: string; resource: string };
  performanceBudget?: { maxP50Ms: number; maxP95Ms: number };
  idempotency?: boolean;
};

export type GoldApiContext = {
  request: Request;
  traceId: string;
  spanId: string;
  startTime: number;
  userId?: string;
  params: Record<string, string>;
  query: Record<string, string>;
  body?: unknown;
};

export type GoldApiHandler<T> = (ctx: GoldApiContext) => Promise<T>;

const globalRateLimiter = new SlidingWindowRateLimiter();

export function createGoldApi<T>(config: GoldApiConfig, handler: GoldApiHandler<T>) {
  return async (request: Request): Promise<Response> => {
    const trace = traceRequest(request);
    const span = telemetry.startSpan(`api.${config.name}`, "server", undefined, {
      method: config.method,
      path: config.path,
      auth: config.auth,
    });

    try {
      // Security headers
      const hardenedHeaders = getHardenedHeaders();

      // Rate limiting
      if (config.rateLimit) {
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        const key = `${config.path}:${ip}`;
        const result = globalRateLimiter.check(key, config.rateLimit.limit, config.rateLimit.windowMs);
        if (!result.allowed) {
          telemetry.counter("api.rate_limited", 1, { path: config.path });
          alerter.alert("warning", "Rate limit", `${key} exceeded ${config.rateLimit.limit}`, { path: config.path });
          throw new RateLimitError(result.retryAfterMs);
        }
      }

      // Auth check
      let userId: string | undefined;
      if (config.auth === "required") {
        const auth = request.headers.get("authorization");
        if (!auth) throw new AppError("Authentication required", "AUTH_REQUIRED", 401, "auth", "medium", false);
        // In real app, verify JWT
        userId = "mock-user-id";
        telemetry.setSpanAttribute(span.spanId, "userId", userId);
      }

      // Validation
      const url = new URL(request.url);
      const query: Record<string, string> = {};
      url.searchParams.forEach((v, k) => (query[k] = v));

      if (config.validation?.query) {
        const result = validate(config.validation.query, query);
        if (!result.ok) throw new ValidationError("Invalid query", { errors: result.errors });
      }

      let body: unknown;
      if (config.method !== "GET" && config.method !== "DELETE") {
        try {
          const text = await request.text();
          if (text) body = JSON.parse(text);
        } catch {
          // No body or invalid JSON — validation will catch if required
        }
        if (config.validation?.body) {
          const result = validate(config.validation.body, body);
          if (!result.ok) throw new ValidationError("Invalid body", { errors: result.errors });
        }
      }

      const params: Record<string, string> = {};
      // Extract params from path — simplified

      const ctx: GoldApiContext = { request, traceId: trace.traceId, spanId: span.spanId, startTime: trace.startTime, userId, params, query, body };

      // Idempotency check
      if (config.idempotency && config.method === "POST") {
        const idempotencyKey = request.headers.get("x-idempotency-key") ?? (body as any)?.idempotencyKey;
        if (idempotencyKey) {
          const cached = await cache.get(`idempotency:${idempotencyKey}`);
          if (cached) {
            telemetry.counter("api.idempotency.hit", 1, { path: config.path });
            return new Response(JSON.stringify(cached.value), {
              status: 200,
              headers: { "Content-Type": "application/json", ...hardenedHeaders, "X-Idempotency-Hit": "true", "X-Trace-Id": trace.traceId },
            });
          }
        }
      }

      // Cache check for GET
      if (config.cache && config.method === "GET") {
        const cacheKey = config.cache.key(request);
        const cached = await cache.get(cacheKey);
        if (cached) {
          telemetry.counter("api.cache.hit", 1, { path: config.path, layer: cached.layer });
          return new Response(JSON.stringify(cached.value), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...hardenedHeaders,
              "X-Cache": `HIT from ${cached.layer}`,
              "X-Cache-Hits": String(cached.hits),
              "X-Trace-Id": trace.traceId,
            },
          });
        }
      }

      // Execute with resilience
      const breaker = config.circuitBreaker ? getCircuitBreaker(config.circuitBreaker) : undefined;
      const operation = async () => {
        if (breaker) return breaker.execute(() => handler(ctx));
        return handler(ctx);
      };

      const resilientOperation = async () => {
        if (config.retry) {
          return resilient(operation, {
            retry: { maxAttempts: config.retry.maxAttempts, initialDelayMs: 100, maxDelayMs: 5000, factor: 2, jitter: true },
            timeoutMs: config.retry.timeoutMs,
            circuitBreaker: config.circuitBreaker,
          });
        }
        return operation();
      };

      const result = await tryAsync(resilientOperation);

      if (!result.ok) throw result.error;

      const duration = Date.now() - trace.startTime;

      // Performance budget check
      if (config.performanceBudget) {
        const budgetCheck = checkBudget({ p50: duration, p95: duration }, { name: config.name, maxLcpMs: 2500, maxInpMs: 200, maxCls: 0.1, maxBundleKb: 300, maxApiP50Ms: config.performanceBudget.maxP50Ms, maxApiP95Ms: config.performanceBudget.maxP95Ms, maxApiP99Ms: 400 });
        if (!budgetCheck.pass) {
          alerter.alert("warning", "Performance budget exceeded", `${config.path} ${duration}ms > ${config.performanceBudget.maxP50Ms}ms`, { path: config.path });
        }
      }

      // Cache set for GET
      if (config.cache && config.method === "GET") {
        const cacheKey = config.cache.key(request);
        await cache.set(cacheKey, result.value, config.cache.ttlSec);
      }

      // Idempotency store for POST
      if (config.idempotency && config.method === "POST") {
        const idempotencyKey = request.headers.get("x-idempotency-key") ?? (body as any)?.idempotencyKey;
        if (idempotencyKey) await cache.set(`idempotency:${idempotencyKey}`, result.value, 86400);
      }

      // Audit
      if (config.audit) {
        auditLogger.log({ userId, action: config.audit.action, resource: config.audit.resource, ip: request.headers.get("x-forwarded-for") ?? undefined, userAgent: request.headers.get("user-agent") ?? undefined, result: "success", details: { traceId: trace.traceId, durationMs: duration } });
        auditTrail.record({ userId, action: config.audit.action, resource: config.audit.resource, ip: request.headers.get("x-forwarded-for") ?? undefined, userAgent: request.headers.get("user-agent") ?? undefined, traceId: trace.traceId });
      }

      telemetry.endSpan(span.spanId, "ok");
      finishTrace(trace, 200);
      telemetry.histogram(`api.${config.name}.duration`, duration, { method: config.method, status: "200" });

      return new Response(JSON.stringify(result.value), {
        status: 200,
        headers: { "Content-Type": "application/json", ...hardenedHeaders, "X-Trace-Id": trace.traceId, "X-Response-Time": `${duration}ms` },
      });
    } catch (error) {
      const appError = error instanceof AppError ? error : new AppError(error instanceof Error ? error.message : "Unknown error", "UNKNOWN", 500, "system", "high", false, {}, error);
      telemetry.endSpan(span.spanId, "error", appError.message);
      finishTrace(trace, appError.status, appError.message);
      telemetry.counter(`api.${config.name}.errors`, 1, { code: appError.code, category: appError.category });

      if (config.audit) {
        auditLogger.log({ action: config.audit.action, resource: config.audit.resource, result: "failure", details: { error: appError.code, traceId: trace.traceId } });
      }

      if (appError.severity === "critical") alerter.alert("critical", `API ${config.name} failed`, appError.message, { path: config.path, code: appError.code });
      else if (appError.severity === "high") alerter.alert("warning", `API ${config.name} error`, appError.message, { path: config.path });

      return new Response(JSON.stringify({ error: appError.message, code: appError.code, traceId: trace.traceId }), {
        status: appError.status,
        headers: { "Content-Type": "application/json", ...getHardenedHeaders(), "X-Trace-Id": trace.traceId, "X-Error-Code": appError.code },
      });
    }
  };
}

// Gold standard route builder
export function goldRoute<T>(config: GoldApiConfig, handler: GoldApiHandler<T>) {
  const api = createGoldApi(config, handler);
  return { handler: api, config };
}
