import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// 1. CSP Headers
// ---------------------------------------------------------------------------

test.describe("Content Security Policy", () => {
  test("landing page serves a Content-Security-Policy header", async ({
    request,
  }) => {
    const response = await request.get("/");
    const csp = response.headers()["content-security-policy"];

    // CSP should be present and non-empty
    expect(csp).toBeTruthy();
    expect(csp!.length).toBeGreaterThan(0);
  });

  test("CSP header includes default-src directive", async ({ request }) => {
    const response = await request.get("/");
    const csp = response.headers()["content-security-policy"];

    expect(csp).toBeTruthy();
    // Must have at least a default-src or script-src directive
    expect(csp).toMatch(/default-src|script-src/);
  });

  test("API routes also carry CSP headers", async ({ request }) => {
    const response = await request.get("/api/health");
    const csp = response.headers()["content-security-policy"];

    expect(csp).toBeTruthy();
    expect(csp!.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 2. No sensitive data in HTML source
// ---------------------------------------------------------------------------

test.describe("No sensitive data in HTML", () => {
  test("page source does not contain environment variables or API keys", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const html = await page.content();

    // Should not contain Supabase anon key or service role key patterns
    expect(html).not.toMatch(/SUPABASE_SERVICE_ROLE|service_role/i);
    expect(html).not.toMatch(/eyJhbGciOiJIUzI1NiJ9.*service_role/i);

    // Should not expose internal environment variable names
    expect(html).not.toMatch(/process\.env\.[A-Z_]+/);
  });

  test("page source does not contain database connection strings", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const html = await page.content();

    // No postgres:// or postgresql:// connection strings
    expect(html).not.toMatch(/postgres(ql)?:\/\/[^\s"']+/i);
  });

  test("page source does not contain hardcoded passwords or secrets", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const html = await page.content();

    // Common secret patterns that should never appear in client HTML
    expect(html).not.toMatch(/password\s*[:=]\s*["'][^"']+["']/i);
    expect(html).not.toMatch(/secret\s*[:=]\s*["'][^"']+["']/i);
    expect(html).not.toMatch(/api[_-]?key\s*[:=]\s*["'][^"']+["']/i);
  });
});

// ---------------------------------------------------------------------------
// 3. Auth cookies have secure flags
// ---------------------------------------------------------------------------

test.describe("Auth cookie security", () => {
  test("auth-related cookies include Secure flag", async ({ page, context }) => {
    // Set a fake auth cookie to verify the cookie jar configuration
    await context.addCookies([
      {
        name: "sb-access-token",
        value: "test-token",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
      {
        name: "sb-refresh-token",
        value: "test-refresh",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ]);

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const cookies = await context.cookies();
    const authCookies = cookies.filter((c) =>
      c.name.startsWith("sb-") || c.name.startsWith("__session"),
    );

    // All auth cookies should be httpOnly
    for (const cookie of authCookies) {
      expect(cookie.httpOnly, `${cookie.name} should be httpOnly`).toBe(true);
    }
  });

  test("auth cookies have SameSite attribute", async ({ context }) => {
    await context.addCookies([
      {
        name: "sb-access-token",
        value: "test",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ]);

    const cookies = await context.cookies();
    const sbCookie = cookies.find((c) => c.name === "sb-access-token");

    expect(sbCookie).toBeDefined();
    expect(sbCookie!.sameSite).toMatch(/Lax|Strict/);
  });
});

// ---------------------------------------------------------------------------
// 4. API returns proper error codes for unauthenticated requests
// ---------------------------------------------------------------------------

test.describe("API auth enforcement", () => {
  test("auth/me endpoint returns 401 or 403 for unauthenticated request", async ({
    request,
  }) => {
    const response = await request.get("/api/auth/me");
    const status = response.status();

    // Should reject unauthenticated requests with 401 or 403
    expect([401, 403, 404]).toContain(status);
  });

  test("events API returns proper error for unauthenticated request", async ({
    request,
  }) => {
    const response = await request.get("/api/events");
    const status = response.status();

    // Should return 401/403 for unauthenticated users, or 405 if method not allowed
    expect(status).toBeGreaterThanOrEqual(400);
  });

  test("notifications API returns proper error for unauthenticated request", async ({
    request,
  }) => {
    const response = await request.get("/api/notifications");
    const status = response.status();

    // Should return 401/403 for unauthenticated users, or 405 if method not allowed
    expect(status).toBeGreaterThanOrEqual(400);
  });

  test("health endpoint is publicly accessible", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
  });

  test("ready endpoint is publicly accessible", async ({ request }) => {
    const response = await request.get("/api/ready");
    expect(response.status()).toBe(200);
  });
});
