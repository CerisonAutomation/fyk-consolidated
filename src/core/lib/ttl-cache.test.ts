import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TtlCache } from "./ttl-cache";

describe("TtlCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores and retrieves a value", () => {
    const cache = new TtlCache<string, number>({ ttlMs: 1000 });
    cache.set("a", 42);
    expect(cache.get("a")).toBe(42);
  });

  it("returns null for missing keys", () => {
    const cache = new TtlCache<string, number>({ ttlMs: 1000 });
    expect(cache.get("missing")).toBeNull();
  });

  it("expires entries after TTL", () => {
    const cache = new TtlCache<string, number>({ ttlMs: 500 });
    cache.set("a", 42);

    vi.advanceTimersByTime(499);
    expect(cache.get("a")).toBe(42);

    vi.advanceTimersByTime(2);
    expect(cache.get("a")).toBeNull();
  });

  it("deletes an entry", () => {
    const cache = new TtlCache<string, number>({ ttlMs: 1000 });
    cache.set("a", 42);
    cache.delete("a");
    expect(cache.get("a")).toBeNull();
  });

  it("clears all entries", () => {
    const cache = new TtlCache<string, number>({ ttlMs: 1000 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.clear();
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBeNull();
  });

  it("update modifies an existing entry", () => {
    const cache = new TtlCache<string, number>({ ttlMs: 1000 });
    cache.set("a", 10);
    cache.update("a", (current) => current + 5);
    expect(cache.get("a")).toBe(15);
  });

  it("update is a no-op for missing keys", () => {
    const cache = new TtlCache<string, number>({ ttlMs: 1000 });
    cache.update("missing", (current) => current + 1);
    expect(cache.get("missing")).toBeNull();
  });

  it("update refreshes the TTL", () => {
    const cache = new TtlCache<string, number>({ ttlMs: 500 });
    cache.set("a", 10);

    vi.advanceTimersByTime(400);
    cache.update("a", (current) => current + 1);
    expect(cache.get("a")).toBe(11);

    // TTL was refreshed, so 400ms more should still be valid
    vi.advanceTimersByTime(400);
    expect(cache.get("a")).toBe(11);

    // But after another 200ms total should expire
    vi.advanceTimersByTime(200);
    expect(cache.get("a")).toBeNull();
  });

  it("handles overwriting a key", () => {
    const cache = new TtlCache<string, number>({ ttlMs: 1000 });
    cache.set("a", 1);
    cache.set("a", 2);
    expect(cache.get("a")).toBe(2);
  });

  it("handles numeric keys", () => {
    const cache = new TtlCache<number, string>({ ttlMs: 1000 });
    cache.set(1, "one");
    cache.set(2, "two");
    expect(cache.get(1)).toBe("one");
    expect(cache.get(2)).toBe("two");
  });
});
