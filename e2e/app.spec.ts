import { test, expect } from "@playwright/test";

test("landing page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/FYK/);
});

test("auth page renders", async ({ page }) => {
  await page.goto("/auth/sign-in");
  await expect(page.locator("text=Sign In")).toBeVisible();
});

test("grid page requires auth", async ({ page }) => {
  await page.goto("/grid");
  await expect(page).toHaveURL(/sign-in/);
});

test("API health check", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
});
