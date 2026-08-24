import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  classifyError,
  isRetryable,
  formatErrorMessage,
  showErrorToast,
  type ErrorCategory,
} from "./error-toast";
import { ApiError } from "#/core/api/client/api-error";

// Mock document for DOM-based toast
beforeEach(() => {
  document.body.innerHTML = "";
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

function makeApiError(
  overrides: Partial<ConstructorParameters<typeof ApiError>[0]> = {},
) {
  return new ApiError({
    message: "test error",
    request: { method: "GET", path: "/api/test" },
    ...overrides,
  });
}

describe("classifyError", () => {
  it("classifies NetworkBlocked as network", () => {
    expect(classifyError(makeApiError({ kind: "NetworkBlocked" }))).toBe(
      "network",
    );
  });

  it("classifies Auth as auth", () => {
    expect(classifyError(makeApiError({ kind: "Auth" }))).toBe("auth");
  });

  it("classifies Unauthorized as auth", () => {
    expect(classifyError(makeApiError({ kind: "Unauthorized" }))).toBe("auth");
  });

  it("classifies NotLoggedIn as auth", () => {
    expect(classifyError(makeApiError({ kind: "NotLoggedIn" }))).toBe("auth");
  });

  it("classifies Banned as auth", () => {
    expect(classifyError(makeApiError({ kind: "Banned" }))).toBe("auth");
  });

  it("classifies RateLimited as network", () => {
    expect(classifyError(makeApiError({ kind: "RateLimited" }))).toBe(
      "network",
    );
  });

  it("classifies 500 response as server", () => {
    expect(
      classifyError(
        makeApiError({ response: { status: 500, body: "" } }),
      ),
    ).toBe("server");
  });

  it("classifies 502 response as server", () => {
    expect(
      classifyError(
        makeApiError({ response: { status: 502, body: "" } }),
      ),
    ).toBe("server");
  });

  it("classifies 400 response as client", () => {
    expect(
      classifyError(
        makeApiError({ response: { status: 400, body: "" } }),
      ),
    ).toBe("client");
  });

  it("classifies 404 response as client", () => {
    expect(
      classifyError(
        makeApiError({ response: { status: 404, body: "" } }),
      ),
    ).toBe("client");
  });

  it("classifies network error messages as network", () => {
    expect(classifyError(new Error("Failed to fetch"))).toBe("network");
    expect(classifyError(new Error("NetworkError"))).toBe("network");
    expect(classifyError(new Error("ECONNREFUSED"))).toBe("network");
    expect(classifyError(new Error("timeout"))).toBe("network");
  });

  it("classifies unknown errors as unknown", () => {
    expect(classifyError(new Error("something broke"))).toBe("unknown");
    expect(classifyError("string error")).toBe("unknown");
    expect(classifyError(42)).toBe("unknown");
  });
});

describe("isRetryable", () => {
  it("returns true for NetworkBlocked", () => {
    expect(isRetryable(makeApiError({ kind: "NetworkBlocked" }))).toBe(true);
  });

  it("returns true for 500 status", () => {
    expect(
      isRetryable(makeApiError({ response: { status: 500, body: "" } })),
    ).toBe(true);
  });

  it("returns true for network errors", () => {
    expect(isRetryable(new Error("Failed to fetch"))).toBe(true);
  });

  it("returns false for 404 status", () => {
    expect(
      isRetryable(makeApiError({ response: { status: 404, body: "" } })),
    ).toBe(false);
  });

  it("returns false for unknown non-network errors", () => {
    expect(isRetryable(new Error("something broke"))).toBe(false);
  });
});

describe("formatErrorMessage", () => {
  it("formats NetworkBlocked", () => {
    expect(formatErrorMessage(makeApiError({ kind: "NetworkBlocked" }))).toBe(
      "Network request was blocked",
    );
  });

  it("formats Auth error", () => {
    expect(formatErrorMessage(makeApiError({ kind: "Auth" }))).toBe(
      "Authentication failed",
    );
  });

  it("formats status code errors", () => {
    expect(
      formatErrorMessage(
        makeApiError({ response: { status: 404, body: "" } }),
      ),
    ).toBe("Request failed with status 404");
  });

  it("falls back to error message", () => {
    expect(formatErrorMessage(new Error("custom error"))).toBe("custom error");
  });

  it("stringifies non-Error values", () => {
    expect(formatErrorMessage("oops")).toBe("oops");
    expect(formatErrorMessage(42)).toBe("42");
  });
});

describe("showErrorToast", () => {
  it("creates a toast element in the DOM", () => {
    showErrorToast({ label: "Test", error: new Error("fail") });
    const toast = document.querySelector('[role="alert"]');
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toContain("Test");
    expect(toast?.textContent).toContain("fail");
  });

  it("creates a retry button for retryable errors", () => {
    const onRetry = vi.fn();
    showErrorToast({
      label: "Test",
      error: makeApiError({ kind: "NetworkBlocked" }),
      onRetry,
    });
    const retryBtn = document.querySelector(".error-toast-retry");
    expect(retryBtn).not.toBeNull();
  });

  it("does not create retry button for non-retryable errors", () => {
    showErrorToast({
      label: "Test",
      error: makeApiError({ response: { status: 404, body: "" } }),
    });
    const retryBtn = document.querySelector(".error-toast-retry");
    expect(retryBtn).toBeNull();
  });

  it("calls onRetry when retry button is clicked", () => {
    const onRetry = vi.fn();
    showErrorToast({
      label: "Test",
      error: makeApiError({ kind: "NetworkBlocked" }),
      onRetry,
    });
    const retryBtn = document.querySelector(".error-toast-retry") as HTMLButtonElement;
    retryBtn.click();
    expect(onRetry).toHaveBeenCalled();
  });

  it("dismisses toast when dismiss button is clicked", () => {
    showErrorToast({ label: "Test", error: new Error("fail") });
    const dismissBtn = document.querySelector(
      ".error-toast-dismiss",
    ) as HTMLButtonElement;
    dismissBtn.click();
    const toast = document.querySelector('[role="alert"]');
    // After dismiss, the toast should have the exit class
    expect(toast?.classList.contains("error-toast-exit")).toBe(true);
  });

  it("auto-dismisses after 8 seconds", () => {
    showErrorToast({ label: "Test", error: new Error("fail") });
    let toast = document.querySelector('[role="alert"]');
    expect(toast).not.toBeNull();

    vi.advanceTimersByTime(8000);
    toast = document.querySelector('[role="alert"]');
    expect(toast?.classList.contains("error-toast-exit")).toBe(true);
  });

  it("shows category label for auth errors", () => {
    showErrorToast({
      label: "Test",
      error: makeApiError({ kind: "Auth" }),
    });
    const toast = document.querySelector('[role="alert"]');
    expect(toast?.textContent).toContain("Auth error");
  });

  it("shows category label for server errors", () => {
    showErrorToast({
      label: "Test",
      error: makeApiError({ response: { status: 500, body: "" } }),
    });
    const toast = document.querySelector('[role="alert"]');
    expect(toast?.textContent).toContain("Server error");
  });
});
