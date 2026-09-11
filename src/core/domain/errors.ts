// ═══════════════════════════════════════════════════════════════════════════════
// Domain — Result type & error helpers
// ═══════════════════════════════════════════════════════════════════════════════

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: DomainError };

export interface DomainError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T>(code: string, message: string, details?: Record<string, unknown>): Result<T>;
export function fail<T>(error: DomainError): Result<T>;
export function fail<T>(
  codeOrError: string | DomainError,
  message?: string,
  details?: Record<string, unknown>,
): Result<T> {
  if (typeof codeOrError === "string") {
    return { ok: false, error: { code: codeOrError, message: message ?? codeOrError, details } };
  }
  return { ok: false, error: codeOrError };
}

export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new DomainErrorClass(result.error.code, result.error.message, result.error.details);
  return result.value;
}

export class DomainErrorClass extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}

/** Validation error — for invalid input (name length, format, etc.) */
export class ValidationError extends Error {
  readonly code = "VALIDATION_ERROR";
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}
