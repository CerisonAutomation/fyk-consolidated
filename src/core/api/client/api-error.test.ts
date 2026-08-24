import { describe, it, expect } from "vitest";
import { ApiError, apiErrorKinds } from "./api-error";

function makeError(
  overrides: Partial<ConstructorParameters<typeof ApiError>[0]> = {},
) {
  return new ApiError({
    message: "test error",
    request: { method: "GET", path: "/api/test" },
    ...overrides,
  });
}

describe("ApiError", () => {
  it("creates an error with the correct name", () => {
    const error = makeError();
    expect(error.name).toBe("ApiError");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
  });

  it("stores request info", () => {
    const error = makeError({
      request: { method: "POST", path: "/api/users", body: { name: "test" } },
    });
    expect(error.request.method).toBe("POST");
    expect(error.request.path).toBe("/api/users");
    expect(error.request.body).toEqual({ name: "test" });
  });

  it("stores response info", () => {
    const error = makeError({
      response: { status: 404, body: "not found" },
    });
    expect(error.response).toEqual({ status: 404, body: "not found" });
  });

  it("defaults response to null", () => {
    const error = makeError();
    expect(error.response).toBeNull();
  });

  it("defaults kind to null", () => {
    const error = makeError();
    expect(error.kind).toBeNull();
  });

  it("stores kind", () => {
    const error = makeError({ kind: "Auth" });
    expect(error.kind).toBe("Auth");
  });

  it("stores cause", () => {
    const cause = new Error("original");
    const error = makeError({ cause });
    expect(error.cause).toBe(cause);
  });
});

describe("retryable property", () => {
  it("is retryable for Http kind", () => {
    expect(makeError({ kind: "Http" }).retryable).toBe(true);
  });

  it("is retryable for Auth kind", () => {
    expect(makeError({ kind: "Auth" }).retryable).toBe(true);
  });

  it("is retryable for Unauthorized kind", () => {
    expect(makeError({ kind: "Unauthorized" }).retryable).toBe(true);
  });

  it("is retryable for RequestBlocked kind", () => {
    expect(makeError({ kind: "RequestBlocked" }).retryable).toBe(true);
  });

  it("is retryable for NetworkBlocked kind", () => {
    expect(makeError({ kind: "NetworkBlocked" }).retryable).toBe(true);
  });

  it("is retryable for 500 status", () => {
    expect(
      makeError({ response: { status: 500, body: "" } }).retryable,
    ).toBe(true);
  });

  it("is retryable for 502 status", () => {
    expect(
      makeError({ response: { status: 502, body: "" } }).retryable,
    ).toBe(true);
  });

  it("is retryable for 401 status", () => {
    expect(
      makeError({ response: { status: 401, body: "" } }).retryable,
    ).toBe(true);
  });

  it("is retryable for 408 status", () => {
    expect(
      makeError({ response: { status: 408, body: "" } }).retryable,
    ).toBe(true);
  });

  it("is retryable for 429 status", () => {
    expect(
      makeError({ response: { status: 429, body: "" } }).retryable,
    ).toBe(true);
  });

  it("is not retryable for 400 status", () => {
    expect(
      makeError({ response: { status: 400, body: "" } }).retryable,
    ).toBe(false);
  });

  it("is not retryable for 404 status", () => {
    expect(
      makeError({ response: { status: 404, body: "" } }).retryable,
    ).toBe(false);
  });

  it("is not retryable for NotLoggedIn kind", () => {
    expect(makeError({ kind: "NotLoggedIn" }).retryable).toBe(false);
  });

  it("is not retryable for Banned kind", () => {
    expect(makeError({ kind: "Banned" }).retryable).toBe(false);
  });

  it("is not retryable for RateLimited kind without response", () => {
    expect(makeError({ kind: "RateLimited" }).retryable).toBe(false);
  });
});

describe("apiErrorKinds", () => {
  it("contains expected error kinds", () => {
    expect(apiErrorKinds).toContain("Http");
    expect(apiErrorKinds).toContain("Auth");
    expect(apiErrorKinds).toContain("NotLoggedIn");
    expect(apiErrorKinds).toContain("NetworkBlocked");
    expect(apiErrorKinds).toContain("SessionCleared");
  });

  it("is readonly", () => {
    expect(apiErrorKinds).toHaveLength(12);
  });
});
