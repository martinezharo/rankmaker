import { defineConfig, devices } from '@playwright/test';

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
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	reporter: 'list',
	use: {
		baseURL: 'http://localhost:4321',
		trace: 'on-first-retry',
	},
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
	],
	webServer: {
		command: 'pnpm dev',
		url: 'http://localhost:4321',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
