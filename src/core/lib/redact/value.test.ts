import { describe, it, expect } from "vitest";
import {
  redactValue,
  parseJson,
  redactResponseBody,
  readResponseBody,
  summariseNonJson,
} from "./value";

describe("redactValue", () => {
  it("masks string values", () => {
    const result = redactValue({ name: "John" }) as Record<string, unknown>;
    expect(result.name).toBe("<string:4>");
  });

  it("masks number values", () => {
    const result = redactValue({ count: 42 }) as Record<string, unknown>;
    expect(result.count).toBe("<number>");
  });

  it("masks boolean values", () => {
    const result = redactValue({ flag: true }) as Record<string, unknown>;
    expect(result.flag).toBe("<boolean>");
  });

  it("passes through null and undefined", () => {
    expect(redactValue(null)).toBeNull();
    expect(redactValue(undefined)).toBeUndefined();
  });

  it("preserves verbatim keys", () => {
    const result = redactValue({ status: 200, kind: "Http" }) as Record<
      string,
      unknown
    >;
    expect(result.status).toBe(200);
    expect(result.kind).toBe("Http");
  });

  it("scrubs prose keys", () => {
    const result = redactValue({
      message: "user@example.com said hello",
    }) as Record<string, unknown>;
    expect(typeof result.message).toBe("string");
    expect(result.message).not.toContain("user@example.com");
  });

  it("caps long string values in prose keys", () => {
    const longMessage = "a".repeat(500);
    const result = redactValue({ message: longMessage }) as Record<
      string,
      unknown
    >;
    expect((result.message as string).length).toBeLessThan(400);
  });

  it("masks arrays", () => {
    const result = redactValue({ items: [1, 2, 3] }) as Record<
      string,
      unknown
    >;
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items).toEqual(["<number>", "<number>", "<number>"]);
  });

  it("limits array items", () => {
    const result = redactValue({ items: Array.from({ length: 20 }, (_, i) => i) }) as Record<
      string,
      unknown
    >;
    expect((result.items as unknown[]).length).toBe(11); // 10 + overflow marker
    expect((result.items as unknown[])[10]).toBe("<+10 more>");
  });

  it("handles nested objects", () => {
    const result = redactValue({
      user: { name: "John", age: 30 },
    }) as Record<string, unknown>;
    const nested = result.user as Record<string, unknown>;
    expect(nested.name).toBe("<string:4>");
    expect(nested.age).toBe("<number>");
  });

  it("detects circular references", () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    const result = redactValue(obj) as Record<string, unknown>;
    expect(result.self).toBe("<circular>");
    expect(result.a).toBe("<number>");
  });

  it("handles deep nesting limit", () => {
    // Build 7 levels of "nested" wrapping { val: "end" }
    let deep: Record<string, unknown> = { val: "end" };
    for (let i = 0; i < 7; i++) {
      deep = { nested: deep };
    }
    const result = redactValue(deep) as Record<string, unknown>;
    // walk starts at depth 0; walkEntry increments to depth+1.
    // At depth 6 (maxDepth), the object is replaced with "<nested>".
    // With 7 levels: depth 0->1->2->3->4->5->6 (capped)
    // result.nested = level1, ..., result.nested(6x) = "<nested>"
    const level1 = result.nested as Record<string, unknown>;
    const level2 = level1.nested as Record<string, unknown>;
    const level3 = level2.nested as Record<string, unknown>;
    const level4 = level3.nested as Record<string, unknown>;
    const level5 = level4.nested as Record<string, unknown>;
    expect(level5.nested).toBe("<nested>");
  });

  it("masks non-plain objects", () => {
    const date = new Date("2024-01-01");
    const result = redactValue({ d: date }) as Record<string, unknown>;
    expect(result.d).toBe("<Date>");
  });
});

describe("parseJson", () => {
  it("parses valid JSON", () => {
    const result = parseJson('{"a": 1}');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ a: 1 });
  });

  it("returns ok:false for invalid JSON", () => {
    expect(parseJson("not json").ok).toBe(false);
  });

  it("returns ok:false for oversized input", () => {
    const huge = "x".repeat(512 * 1024 + 1);
    expect(parseJson(huge).ok).toBe(false);
  });

  it("strips __proto__ keys", () => {
    const result = parseJson('{"__proto__": {"polluted": true}, "safe": true}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ safe: true });
    }
  });
});

describe("redactResponseBody", () => {
  it("redacts JSON body values", () => {
    const json = JSON.stringify({ name: "secret", count: 42 });
    const result = redactResponseBody(json) as Record<string, unknown>;
    expect(result.name).toBe("<string:6>");
    expect(result.count).toBe("<number>");
  });

  it("summarizes non-JSON as text", () => {
    const result = redactResponseBody("just plain text") as {
      nonJson: string;
      length: number;
    };
    expect(result.nonJson).toBe("text");
    expect(result.length).toBe(15);
  });

  it("summarizes HTML", () => {
    const result = redactResponseBody("<html><title>T</title><body>hi</body></html>") as {
      nonJson: string;
      length: number;
      title?: string;
    };
    expect(result.nonJson).toBe("html");
    expect(result.title).toBe("T");
  });
});

describe("readResponseBody", () => {
  it("parses JSON body", () => {
    const result = readResponseBody('{"ok": true}');
    expect(result).toEqual({ ok: true });
  });

  it("returns raw text for non-JSON", () => {
    const result = readResponseBody("plain text");
    expect(result).toBe("plain text");
  });
});

describe("summariseNonJson", () => {
  it("identifies plain text", () => {
    const result = summariseNonJson("hello world");
    expect(result.nonJson).toBe("text");
    expect(result.length).toBe(11);
  });

  it("identifies HTML with title", () => {
    const result = summariseNonJson("<!DOCTYPE html><html><head><title>My Page</title></head></html>");
    expect(result.nonJson).toBe("html");
    expect(result.title).toBe("My Page");
  });

  it("identifies HTML without title", () => {
    const result = summariseNonJson("<html><body>content</body></html>");
    expect(result.nonJson).toBe("html");
  });
});
