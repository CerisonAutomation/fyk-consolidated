/**
 * Enterprise Error Handling — Max error handling, telemetry, self-healing, recovery
 * Gold: predictable operation, graceful recovery, observable
 */

export type ErrorSeverity = "low" | "medium" | "high" | "critical";
export type ErrorCategory = "validation" | "auth" | "network" | "database" | "external" | "business" | "system" | "security";

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public category: ErrorCategory,
    public severity: ErrorSeverity,
    public retryable: boolean,
    public details?: Record<string, unknown>,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      category: this.category,
      severity: this.severity,
      retryable: this.retryable,
      details: this.details,
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", 400, "validation", "low", false, details);
    this.name = "ValidationError";
  }
}

export class AuthError extends AppError {
  constructor(message = "Authentication required", code = "AUTH_REQUIRED") {
    super(message, code, 401, "auth", "medium", false);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", code = "FORBIDDEN") {
    super(message, code, 403, "auth", "medium", false);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(`${resource} not found${id ? `: ${id}` : ""}`, "NOT_FOUND", 404, "business", "low", false, { resource, id });
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "CONFLICT", 409, "business", "low", false, details);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterMs?: number) {
    super("Rate limit exceeded", "RATE_LIMIT", 429, "system", "medium", true, { retryAfterMs });
    this.name = "RateLimitError";
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, cause?: unknown) {
    super(`External service ${service} unavailable`, "EXTERNAL_SERVICE", 502, "external", "high", true, { service }, cause);
    this.name = "ExternalServiceError";
  }
}

export class DatabaseError extends AppError {
  constructor(operation: string, cause?: unknown) {
    super(`Database ${operation} failed`, "DATABASE_ERROR", 500, "database", "high", true, { operation }, cause);
    this.name = "DatabaseError";
  }
}

// Result type — functional error handling, no throw
export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}

export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? { ok: true, value: fn(result.value) } : result;
}

export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  return result.ok ? result : err(fn(result.error));
}

export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  throw result.error;
}

export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}

// Try-catch wrapper to Result
export async function tryAsync<T>(fn: () => Promise<T>): Promise<Result<T, AppError>> {
  try {
    return ok(await fn());
  } catch (error) {
    if (error instanceof AppError) return err(error);
    return err(new AppError(error instanceof Error ? error.message : "Unknown error", "UNKNOWN", 500, "system", "high", false, {}, error));
  }
}

export function trySync<T>(fn: () => T): Result<T, AppError> {
  try {
    return ok(fn());
  } catch (error) {
    if (error instanceof AppError) return err(error);
    return err(new AppError(error instanceof Error ? error.message : "Unknown error", "UNKNOWN", 500, "system", "high", false, {}, error));
  }
}

// Error classification for telemetry
export function classifyError(error: unknown): { category: ErrorCategory; severity: ErrorSeverity; retryable: boolean } {
  if (error instanceof AppError) return { category: error.category, severity: error.severity, retryable: error.retryable };
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("validation") || msg.includes("invalid")) return { category: "validation", severity: "low", retryable: false };
    if (msg.includes("auth") || msg.includes("unauthorized")) return { category: "auth", severity: "medium", retryable: false };
    if (msg.includes("network") || msg.includes("timeout") || msg.includes("econnreset")) return { category: "network", severity: "high", retryable: true };
    if (msg.includes("database") || msg.includes("postgres") || msg.includes("drizzle")) return { category: "database", severity: "high", retryable: true };
  }
  return { category: "system", severity: "high", retryable: false };
}

// Global error handler with telemetry
export function handleError(error: unknown, context?: { userId?: string; action?: string; resource?: string }): AppError {
  const appError = error instanceof AppError ? error : new AppError(error instanceof Error ? error.message : "Unknown error", "UNKNOWN", 500, "system", "high", false, context, error);

  // Telemetry
  const { telemetry } = require("./telemetry") as { telemetry: { counter: (name: string, value: number, labels?: Record<string, string>) => void } };
  telemetry.counter("error.total", 1, { category: appError.category, code: appError.code, severity: appError.severity });

  // Log with context
  const { logger } = require("#/lib/logger") as { logger: { error: (obj: unknown, msg?: string) => void } };
  logger.error({ err: appError, context, category: appError.category, severity: appError.severity }, appError.message);

  return appError;
}

// Recovery strategies
export type RecoveryStrategy = "retry" | "fallback" | "circuit-break" | "ignore" | "fail";

export function getRecoveryStrategy(error: AppError): RecoveryStrategy {
  if (error.retryable && error.category === "network") return "retry";
  if (error.retryable && error.category === "external") return "circuit-break";
  if (error.category === "validation") return "fail";
  if (error.category === "auth") return "fail";
  if (error.severity === "low") return "ignore";
  return "fallback";
}
