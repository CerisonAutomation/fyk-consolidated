import { expect, test } from "@playwright/test";

/**
 * The claims these tests hold are the ones the app makes to a stranger:
 * it tells the truth about configuration, never leaks internals, and every
 * visible control belongs to a route that exists.
 */

const UNCONFIGURED = process.env.FYK_E2E_BASE_URL === undefined;

test("boot renders the shell without a flash of fake content", async ({ page }) => {
	await page.goto("/");
	await expect(page).toHaveTitle(/FYK/);
	await expect(page.locator("body")).not.toContainText(/lorem ipsum|todo:|coming soon|placeholder@fyk/i);
});

test(UNCONFIGURED ? "unconfigured app names the missing variables instead of spinning" : "configured app reaches the auth screen or the app", async ({ page }) => {
	await page.goto("/grid");
	const body = page.locator("body");
	if (UNCONFIGURED) {
		await expect(body).toContainText("FYK is not connected yet");
		await expect(body).toContainText("VITE_SUPABASE_URL");
		await expect(body).toContainText("Re-check configuration");
	} else {
		await expect(body).toContainText(/Sign in|Nearby/);
	}
});

test("API errors are envelopes, never stack traces", async ({ request }) => {
	const response = await request.get("/api/health");
	const body = await response.json();
	expect(body.requestId).toMatch(/^fyk_[a-z0-9]+$/i);
	expect(response.headers()["content-type"]).toContain("application/json");
	expect(response.headers()["cache-control"]).toBe("no-store");
	if (UNCONFIGURED) {
		expect(response.status()).toBe(503);
		expect(body.error.code).toBe("dependency_unavailable");
		expect(JSON.stringify(body)).not.toMatch(/at\s+\w+.*:\d+:\d+|\.tsx?:\d+|postgres:\/\//);
	}
});

test("unknown API routes 404 without echoing the path", async ({ request }) => {
	const response = await request.get("/api/not-a-real-endpoint/private-fragment");
	expect(response.status()).toBe(404);
	const body = await response.json();
	expect(body.error.message).toBe("That endpoint does not exist.");
});

test("the 404 screen offers only routes that exist", async ({ page }) => {
	await page.goto("/definitely-not-a-page");
	await expect(page.locator("h1")).toContainText("That page is not part of FYK");
	const links = page.locator("main a[href], body a[href]");
	expect(await links.count()).toBeGreaterThan(2);
	for (const href of await links.evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href") ?? ""))) {
		expect(["/grid", "/board", "/chat", "/events", "/settings"]).toContain(href);
	}
});
