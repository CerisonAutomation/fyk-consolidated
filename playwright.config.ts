import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright project for `e2e/`.
 *
 * The repo shipped `e2e/app.spec.ts` and three Playwright packages but no
 * config, so `pnpm exec playwright test` scanned the repository root as its
 * testDir (picking up unit tests and `src/`), never started the app, and every
 * spec failed on `page.goto("/")` with "baseUrl not set".
 *
 * `pnpm test:e2e` now:
 *   1. builds nothing (uses the dev server, which is what we want to exercise:
 *      SSR + API routes with HMR-free `vite dev` semantics),
 *   2. reuses a server already listening on the port (`reuseExistingServer`),
 *   3. fails fast with a real assertion instead of an unusable project.
 *
 * Set `PLAYWRIGHT_BASE_URL` to point the suite at a deployed environment
 * instead (CI's preview URL, staging, …).
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const managed = !process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
	testDir: "./e2e",
	timeout: 30_000,
	expect: { timeout: 5_000 },
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? [ ["github"], ["list"] ] : [["list"]],
	use: {
		baseURL,
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: managed
		? {
				command: "pnpm dev --host 127.0.0.1",
				url: baseURL,
				// The dev server needs Supabase env vars at import time in a few
				// modules; dummy values keep `GET /` renderable for route-level
				// assertions. Real credentials are only needed by auth specs.
				env: {
					VITE_SUPABASE_URL: "https://e2e.invalid.supabase.co",
					VITE_SUPABASE_ANON_KEY: "e2e-anon-key",
					DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
					NODE_ENV: "development",
				},
				reuseExistingServer: !process.env.CI,
				timeout: 120_000,
			}
		: undefined,
});
