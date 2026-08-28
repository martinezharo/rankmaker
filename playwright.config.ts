import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4321';

// E2E runs against `astro dev` (miniflare-backed, deterministic port 4321).
// The behaviours we guard — ViewTransitions client navigation and the ranking
// engine's script execution — are identical to production in dev. Tests only
// hit official templates (bundled JSON), so no D1 migrations are required.
//
// Prerequisite: Playwright's browser system libs must be installed once
//   sudo npx playwright install-deps chromium
// (or: sudo apt-get install -y libnspr4 libnss3 libnssutil3 libasound2)
export default defineConfig({
	testDir: './e2e',
	testMatch: '**/*.spec.ts',
	// Apply the local D1 migrations and clear anything a previous run left
	// behind; the account specs seed sessions straight into that database
	// (see e2e/fixtures/d1.ts).
	globalSetup: './e2e/fixtures/global-setup.ts',
	globalTeardown: './e2e/fixtures/global-teardown.ts',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	reporter: 'list',
	use: {
		baseURL,
		trace: 'on-first-retry',
	},
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
	],
	webServer: process.env.PLAYWRIGHT_BASE_URL
		? undefined
		: {
				// Astro is invoked directly, with an explicit host and port,
				// so the server always lands where `baseURL` points. Going
				// through the `dev` script is not enough: a machine can wrap
				// its package manager to bind the dev server to another
				// interface (this repo's own VPS does), and Playwright then
				// waits on a localhost nothing is listening on.
				command: 'pnpm exec astro dev --host 127.0.0.1 --port 4321',
				url: baseURL,
				reuseExistingServer: !process.env.CI,
				timeout: 120_000,
			},
});
