import { defineConfig, devices } from "@playwright/test";

/**
 * Browser smoke tests for the app shell.
 *
 * These do not need a Supabase project: they assert what is true when the app is
 * not wired to one (a named setup screen, structured API errors, no fake content,
 * no dead links), which is exactly the behaviour a preview deployment can regress.
 * Set FYK_E2E_BASE_URL to point them at a staging build that has data.
 */
const baseURL = process.env.FYK_E2E_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
	testDir: "./e2e",
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	reporter: [["list"]],
	use: { baseURL, trace: "on-first-retry" },
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: process.env.FYK_E2E_BASE_URL
		? undefined
		: {
				command: "pnpm dev",
				url: baseURL,
				reuseExistingServer: true,
				timeout: 120_000,
			},
});
