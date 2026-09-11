/**
 * Unified HTTP client for the FYK API.
 *
 * Wraps fetch with:
 *   - Automatic Bearer token injection from localStorage
 *   - JSON content-type and credentials
 *   - Zod response validation
 *   - Result<T> return type (no thrown errors)
 *   - Retryable error classification
 */

import { z } from "zod";
import { ok, fail, type Result } from "../domain/errors";

const TOKEN_KEY = "fyk:session-token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 500,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function http<T>(
  url: string,
  options: RequestInit = {},
  schema?: z.ZodSchema<T>,
): Promise<Result<T>> {
  try {
    const token = getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) ?? {}),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(url, { ...options, headers, credentials: "include" });
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      const error = new ApiError(
        body?.code ?? `HTTP_${res.status}`,
        body?.error ?? body?.message ?? `Request failed: ${res.status}`,
        res.status,
        res.status === 429 || res.status === 503,
      );
      return fail(error as any);
    }

    if (schema) {
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return fail(
          new ApiError(
            "VALIDATION_ERROR",
            `Response validation failed: ${parsed.error.message}`,
            500,
          ) as any,
        );
      }
      return ok(parsed.data);
    }

    return ok(body as T);
  } catch (error) {
    if (error instanceof ApiError) return fail(error as any);
    return fail(
      new ApiError(
        "NETWORK_ERROR",
        (error as Error).message ?? "Network error",
        0,
        true,
      ) as any,
    );
  }
}

// ─── Convenience methods ─────────────────────────────────────────────────────

export const httpGet = <T>(url: string, schema?: z.ZodSchema<T>) =>
  http<T>(url, { method: "GET" }, schema);

export const httpPost = <T>(
  url: string,
  body?: unknown,
  schema?: z.ZodSchema<T>,
) =>
  http<T>(
    url,
    { method: "POST", body: body ? JSON.stringify(body) : undefined },
    schema,
  );

export const httpPut = <T>(
  url: string,
  body?: unknown,
  schema?: z.ZodSchema<T>,
) =>
  http<T>(
    url,
    { method: "PUT", body: body ? JSON.stringify(body) : undefined },
    schema,
  );

export const httpDelete = <T>(url: string, schema?: z.ZodSchema<T>) =>
  http<T>(url, { method: "DELETE" }, schema);
