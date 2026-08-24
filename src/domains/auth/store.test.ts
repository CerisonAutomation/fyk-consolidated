import { describe, it, expect, beforeEach } from "vitest";
import { setAuth, getAuthSnapshot } from "./store";

describe("auth store", () => {
  beforeEach(() => {
    // Reset to initial state
    setAuth(null);
  });

  it("initial state is unauthenticated", () => {
    const state = getAuthSnapshot();
    expect(state.auth).toBeNull();
  });

  it("setAuth sets the user", () => {
    setAuth({ userId: "user-123" });
    const state = getAuthSnapshot();
    expect(state.auth).toEqual({ userId: "user-123" });
  });

  it("setAuth(null) clears authentication", () => {
    setAuth({ userId: "user-123" });
    setAuth(null);
    const state = getAuthSnapshot();
    expect(state.auth).toBeNull();
  });

  it("setAuth overwrites previous auth", () => {
    setAuth({ userId: "user-1" });
    setAuth({ userId: "user-2" });
    const state = getAuthSnapshot();
    expect(state.auth?.userId).toBe("user-2");
  });
});
