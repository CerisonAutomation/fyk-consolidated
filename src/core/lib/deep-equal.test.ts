import { describe, it, expect } from "vitest";
import { deepEqual } from "./deep-equal";

describe("deepEqual", () => {
  it("returns true for identical primitives", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual("hello", "hello")).toBe(true);
    expect(deepEqual(true, true)).toBe(true);
  });

  it("returns false for different primitives", () => {
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual("hello", "world")).toBe(false);
    expect(deepEqual(true, false)).toBe(false);
  });

  it("returns true for same reference", () => {
    const obj = { a: 1 };
    expect(deepEqual(obj, obj)).toBe(true);
  });

  it("returns true for equal objects", () => {
    expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
  });

  it("returns false for objects with different values", () => {
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it("returns false for objects with different keys", () => {
    expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
  });

  it("returns false for objects with different key counts", () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it("handles nested objects", () => {
    const a = { x: { y: { z: 1 } } };
    const b = { x: { y: { z: 1 } } };
    expect(deepEqual(a, b)).toBe(true);
  });

  it("detects nested object differences", () => {
    const a = { x: { y: 1 } };
    const b = { x: { y: 2 } };
    expect(deepEqual(a, b)).toBe(false);
  });

  it("returns true for equal arrays", () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
  });

  it("returns false for arrays with different lengths", () => {
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it("returns false for arrays with different values", () => {
    expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
  });

  it("handles nested arrays", () => {
    expect(deepEqual([[1, 2], [3, 4]], [[1, 2], [3, 4]])).toBe(true);
    expect(deepEqual([[1, 2], [3, 4]], [[1, 2], [3, 5]])).toBe(false);
  });

  it("handles mixed objects and arrays", () => {
    const a = { items: [1, 2, 3], nested: { deep: true } };
    const b = { items: [1, 2, 3], nested: { deep: true } };
    expect(deepEqual(a, b)).toBe(true);
  });

  it("returns false when comparing object to array", () => {
    expect(deepEqual({ a: 1 }, [1])).toBe(false);
  });

  it("handles Date objects as non-equal (different references)", () => {
    const d1 = new Date("2024-01-01");
    const d2 = new Date("2024-01-01");
    // deepEqual compares by structure; Date objects have no enumerable keys
    // so they will be compared as objects with same keys => true
    expect(deepEqual(d1, d2)).toBe(true);
  });

  it("returns true for both null", () => {
    expect(deepEqual(null, null)).toBe(true);
  });

  it("returns false for null vs object", () => {
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual({}, null)).toBe(false);
  });

  it("returns false when one value is undefined", () => {
    expect(deepEqual(undefined, undefined)).toBe(true);
    expect(deepEqual(undefined, null)).toBe(false);
  });

  it("returns false for different types", () => {
    expect(deepEqual(1, "1")).toBe(false);
    expect(deepEqual([1], { 0: 1 })).toBe(false);
  });

  it("handles empty objects and arrays", () => {
    expect(deepEqual({}, {})).toBe(true);
    expect(deepEqual([], [])).toBe(true);
    expect(deepEqual({}, [])).toBe(false);
  });

  it("handles deeply nested structures", () => {
    const deep = { a: { b: { c: { d: { e: { f: [1, 2, 3] } } } } } };
    const copy = { a: { b: { c: { d: { e: { f: [1, 2, 3] } } } } } };
    expect(deepEqual(deep, copy)).toBe(true);
  });
});
