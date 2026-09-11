import { describe, expect, it } from "vitest";
import { ApiError, apiErrorKinds } from "../../api/client/api-error";

// ─── Result Type Helpers ────────────────────────────────────────────────────

type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function fail<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

function unwrap<T, E>(result: Result<T, E>): T {
  if (!isOk(result)) throw result.error;
  return result.value;
}

function mapResult<T, U, E>(result: Result<T, E>, fn: (v: T) => U): Result<U, E> {
  return isOk(result) ? ok(fn(result.value)) : result;
}

function flatMapResult<T, U, E>(result: Result<T, E>, fn: (v: T) => Result<U, E>): Result<U, E> {
  return isOk(result) ? fn(result.value) : result;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Result type helpers", () => {
  describe("ok()", () => {
    it("creates a success result", () => {
      const result = ok(42);
      expect(result.ok).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(42);
      }
    });

    it("works with string values", () => {
      const result = ok("hello");
      expect(result.ok).toBe(true);
      expect(unwrap(result)).toBe("hello");
    });

    it("works with object values", () => {
      const result = ok({ name: "test", count: 5 });
      expect(result.ok).toBe(true);
      expect(unwrap(result)).toEqual({ name: "test", count: 5 });
    });
  });

  describe("fail()", () => {
    it("creates a failure result", () => {
      const result = fail(new Error("boom"));
      expect(result.ok).toBe(false);
      if (!isOk(result)) {
        expect(result.error.message).toBe("boom");
      }
    });

    it("works with string errors", () => {
      const result = fail("not found");
      expect(result.ok).toBe(false);
      expect(() => unwrap(result)).toThrow("not found");
    });

    it("preserves error type", () => {
      const err = { code: "AUTH_REQUIRED", message: "Login needed" };
      const result = fail(err);
      expect(result.ok).toBe(false);
      if (!isOk(result)) {
        expect(result.error.code).toBe("AUTH_REQUIRED");
      }
    });
  });

  describe("isOk()", () => {
    it("returns true for ok results", () => {
      expect(isOk(ok(1))).toBe(true);
    });

    it("returns false for fail results", () => {
      expect(isOk(fail("err"))).toBe(false);
    });
  });

  describe("unwrap()", () => {
    it("returns value on success", () => {
      expect(unwrap(ok(10))).toBe(10);
    });

    it("throws on failure", () => {
      expect(() => unwrap(fail(new Error("nope")))).toThrow("nope");
    });
  });

  describe("mapResult()", () => {
    it("transforms ok value", () => {
      const result = mapResult(ok(5), (x) => x * 2);
      expect(unwrap(result)).toBe(10);
    });

    it("passes through fail", () => {
      const result = mapResult(fail("err") as Result<number, string>, (x) => x * 2);
      expect(result.ok).toBe(false);
    });
  });

  describe("flatMapResult()", () => {
    it("chains ok values", () => {
      const parse = (s: string): Result<number, string> => {
        const n = Number(s);
        return isNaN(n) ? fail("not a number") : ok(n);
      };

      const result = flatMapResult(ok("42"), parse);
      expect(unwrap(result)).toBe(42);
    });

    it("stops chain on failure", () => {
      const parse = (s: string): Result<number, string> => {
        const n = Number(s);
        return isNaN(n) ? fail("not a number") : ok(n);
      };

      const result = flatMapResult(fail("input err") as Result<string, string>, parse);
      expect(result.ok).toBe(false);
      if (!isOk(result)) {
        expect(result.error).toBe("input err");
      }
    });
  });

  describe("error code propagation", () => {
    it("propagates error through nested operations", () => {
      const step1 = (v: number): Result<number, string> => ok(v + 1);
      const step2 = (v: number): Result<number, string> =>
        v > 10 ? fail("too_large") : ok(v);
      const step3 = (v: number): Result<string, string> => ok(`val=${v}`);

      let result: Result<string, string> = ok(5);
      result = flatMapResult(result, step1);
      result = flatMapResult(result, step2);
      result = flatMapResult(result, step3);

      expect(unwrap(result)).toBe("val=6");

      // Now test failure propagation
      let result2: Result<string, string> = ok(20);
      result2 = flatMapResult(result2, step1);
      result2 = flatMapResult(result2, step2);
      result2 = flatMapResult(result2, step3);

      expect(result2.ok).toBe(false);
      if (!isOk(result2)) {
        expect(result2.error).toBe("too_large");
      }
    });

    it("preserves ApiError kind through Result", () => {
      const apiErr = new ApiError({
        message: "Unauthorized",
        request: { method: "GET", path: "/api/me" },
        response: { status: 401, body: "Unauthorized" },
        kind: "Unauthorized",
      });

      const result: Result<never, ApiError> = fail(apiErr);

      expect(result.ok).toBe(false);
      if (!isOk(result)) {
        expect(result.error.kind).toBe("Unauthorized");
        expect(result.error.retryable).toBe(true);
      }
    });
  });
});

describe("ApiError", () => {
  it("constructs with all fields", () => {
    const err = new ApiError({
      message: "Not Found",
      request: { method: "GET", path: "/api/users" },
      response: { status: 404, body: '{"error":"not found"}' },
      kind: "Http",
    });

    expect(err.message).toBe("Not Found");
    expect(err.name).toBe("ApiError");
    expect(err.request.method).toBe("GET");
    expect(err.request.path).toBe("/api/users");
    expect(err.response?.status).toBe(404);
    expect(err.kind).toBe("Http");
  });

  it("is an instance of Error", () => {
    const err = new ApiError({
      message: "test",
      request: { method: "GET", path: "/" },
    });

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
  });

  describe("retryable property", () => {
    it("returns true for Http kind", () => {
      const err = new ApiError({
        message: "timeout",
        request: { method: "GET", path: "/" },
        kind: "Http",
      });
      expect(err.retryable).toBe(true);
    });

    it("returns true for Auth kind", () => {
      const err = new ApiError({
        message: "auth expired",
        request: { method: "GET", path: "/" },
        kind: "Auth",
      });
      expect(err.retryable).toBe(true);
    });

    it("returns true for Unauthorized kind", () => {
      const err = new ApiError({
        message: "unauthorized",
        request: { method: "GET", path: "/" },
        kind: "Unauthorized",
      });
      expect(err.retryable).toBe(true);
    });

    it("returns true for 500 status", () => {
      const err = new ApiError({
        message: "server error",
        request: { method: "GET", path: "/" },
        response: { status: 500, body: "Internal Server Error" },
      });
      expect(err.retryable).toBe(true);
    });

    it("returns true for 429 status", () => {
      const err = new ApiError({
        message: "rate limited",
        request: { method: "GET", path: "/" },
        response: { status: 429, body: "Too Many Requests" },
      });
      expect(err.retryable).toBe(true);
    });

    it("returns true for 408 status", () => {
      const err = new ApiError({
        message: "request timeout",
        request: { method: "GET", path: "/" },
        response: { status: 408, body: "Request Timeout" },
      });
      expect(err.retryable).toBe(true);
    });

    it("returns false for 400 status without retryable kind", () => {
      const err = new ApiError({
        message: "bad request",
        request: { method: "POST", path: "/" },
        response: { status: 400, body: "Bad Request" },
      });
      expect(err.retryable).toBe(false);
    });

    it("returns false for 403 status with non-retryable kind", () => {
      const err = new ApiError({
        message: "forbidden",
        request: { method: "GET", path: "/" },
        response: { status: 403, body: "Forbidden" },
        kind: "Banned",
      });
      expect(err.retryable).toBe(false);
    });
  });

  it("lists all error kinds", () => {
    expect(apiErrorKinds).toContain("Http");
    expect(apiErrorKinds).toContain("Auth");
    expect(apiErrorKinds).toContain("Media");
    expect(apiErrorKinds).toContain("NotLoggedIn");
    expect(apiErrorKinds).toContain("Api");
    expect(apiErrorKinds).toContain("Unauthorized");
    expect(apiErrorKinds).toContain("Banned");
    expect(apiErrorKinds).toContain("RateLimited");
    expect(apiErrorKinds).toContain("RequestBlocked");
    expect(apiErrorKinds).toContain("NetworkBlocked");
    expect(apiErrorKinds).toContain("NotInitialized");
    expect(apiErrorKinds).toContain("SessionCleared");
  });
});
