import { describe, it, expect } from "vitest";
import {
  capText,
  maskGeohash,
  scrubText,
  redactPath,
  redactStack,
  documentTitle,
} from "./text";

describe("capText", () => {
  it("returns the text unchanged when under max", () => {
    expect(capText("hello", 10)).toBe("hello");
  });

  it("returns the text unchanged when exactly at max", () => {
    expect(capText("hello", 5)).toBe("hello");
  });

  it("truncates and adds ellipsis when over max", () => {
    const result = capText("hello world", 5);
    expect(result).toBe("hello\u2026<+6 chars>");
  });

  it("handles empty string", () => {
    expect(capText("", 10)).toBe("");
  });
});

describe("maskGeohash", () => {
  it("preserves first 2 characters", () => {
    expect(maskGeohash("dr5ru166jyb1")).toBe("dr**********");
  });

  it("handles short strings", () => {
    expect(maskGeohash("d")).toBe("d");
    expect(maskGeohash("dr")).toBe("dr");
  });

  it("handles empty string", () => {
    expect(maskGeohash("")).toBe("");
  });
});

describe("scrubText", () => {
  it("redacts email addresses", () => {
    const result = scrubText("Contact user@example.com for info");
    expect(result).not.toContain("user@example.com");
    expect(result).toContain("<email>");
  });

  it("redacts URLs with numeric path segments", () => {
    // URLs with all-lowercase paths like "path" are preserved as route literals,
    // so use a URL with a numeric ID segment to verify redaction
    const result = scrubText("See https://example.com/users/123/settings");
    expect(result).toContain("https://example.com");
    expect(result).not.toContain("123");
    expect(result).toContain("{id}");
  });

  it("redacts non-http URLs completely", () => {
    const result = scrubText("Check file:///etc/passwd");
    expect(result).toContain("<url>");
    expect(result).not.toContain("file://");
  });

  it("redacts posix home directories", () => {
    const result = scrubText("File at /Users/john/file.txt");
    expect(result).toContain("/Users/<user>/file.txt");
  });

  it("redacts windows home directories", () => {
    const result = scrubText("File at C:\\Users\\john\\file.txt");
    expect(result).toContain("C:\\Users\\<user>\\file.txt");
  });

  it("does not alter clean text", () => {
    const clean = "This is just plain text with no PII.";
    expect(scrubText(clean)).toBe(clean);
  });
});

describe("redactPath", () => {
  it("replaces numeric id segments with {id}", () => {
    // "123" does not match routeLiteral (not all-lowercase letters)
    expect(redactPath("/api/users/123/posts")).toBe("/api/users/{id}/posts");
  });

  it("preserves all-lowercase route literals", () => {
    // "users" matches [a-z]+, so it is preserved
    expect(redactPath("/api/users")).toBe("/api/users");
  });

  it("preserves version route literals", () => {
    expect(redactPath("/api/v1/users")).toBe("/api/v1/users");
  });

  it("preserves empty segments", () => {
    expect(redactPath("/api//users")).toBe("/api//users");
  });

  it("replaces mixed segments correctly", () => {
    expect(redactPath("/users/42/posts/789")).toBe("/users/{id}/posts/{id}");
  });

  it("redacts query parameters", () => {
    const result = redactPath("/api/search?q=helloworld&limit=10");
    expect(result).toContain("limit=10"); // verbatim param
    expect(result).not.toContain("q=helloworld");
  });

  it("preserves verbatim query params", () => {
    expect(redactPath("/api/items?limit=50&offset=0")).toBe(
      "/api/items?limit=50&offset=0",
    );
  });

  it("masks geohash query params", () => {
    const result = redactPath("/api/nearby?nearbyGeoHash=dr5ru166jyb1");
    expect(result).toContain("nearbyGeoHash=dr**********");
  });

  it("handles root path", () => {
    expect(redactPath("/")).toBe("/");
  });

  it("redacts non-numeric IDs in path", () => {
    // UUID-like segment is not all-lowercase letters, so it becomes {id}
    expect(redactPath("/items/abc-123-def/details")).toBe(
      "/items/{id}/details",
    );
  });
});

describe("redactStack", () => {
  it("masks home directories in stack trace", () => {
    const stack =
      "Error: test\n    at /Users/john/app/src/index.ts:10:5\n    at /Users/john/app/src/util.ts:20:3";
    const result = redactStack({ stack, message: "test" });
    expect(result).not.toContain("/Users/john/");
    expect(result).toContain("/Users/<user>/");
  });
});

describe("documentTitle", () => {
  it("extracts title from HTML", () => {
    expect(documentTitle("<html><head><title>My Page</title></head></html>")).toBe(
      "My Page",
    );
  });

  it("extracts title with attributes", () => {
    expect(
      documentTitle('<title class="main">Page Title</title>'),
    ).toBe("Page Title");
  });

  it("returns undefined when no title", () => {
    expect(documentTitle("<html><body>no title</body></html>")).toBeUndefined();
  });

  it("returns undefined for empty title", () => {
    expect(documentTitle("<title></title>")).toBeUndefined();
  });

  it("trims whitespace from title", () => {
    expect(documentTitle("<title>  spaced  </title>")).toBe("spaced");
  });
});
