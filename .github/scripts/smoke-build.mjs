/**
 * Smoke-test the built Worker — the artefact that actually gets deployed.
 *
 * Everything else in this repo tests `astro dev`: vitest calls route handlers
 * directly, and Playwright drives the dev server. None of that executes
 * `dist/server/entry.mjs`, so a bundle that compiles cleanly and still serves
 * garbage passes the whole suite.
 *
 * That is not hypothetical. With `nodejs_compat` enabled, Astro's renderer
 * detected workerd's `process` shim as Node, rendered pages through
 * `renderToAsyncIterable()`, and workerd — which does not accept an async
 * iterable as a `BodyInit` — served every page as the literal string
 * "[object Object]" with a 200. Dev was perfect; production was blank.
 *
 * So this boots the real bundle in workerd and asserts that the bytes coming
 * back are the page we meant to send. Status codes are not enough: the failure
 * above returned 200 on every route.
 *
 *   node .github/scripts/smoke-build.mjs        (expects dist/ to exist)
 *
 * Exit codes: 0 = the build serves real pages · 1 = it does not.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const PORT = 8787;
const BASE = `http://127.0.0.1:${PORT}`;
const CONFIG = 'dist/server/wrangler.json';

/**
 * Each check names what the response must contain. `html` pages must open with
 * a doctype — that is the assertion that "[object Object]" fails.
 */
const CHECKS = [
	{ path: '/', kind: 'html' },
	{ path: '/search', kind: 'html' },
	{ path: '/about', kind: 'html' },
	{ path: '/create', kind: 'html' },
	{ path: '/category/movies', kind: 'html' },
	{ path: '/template/best-social-networks-ranking', kind: 'html' },
	// Prefixed locales go through the middleware's `rewrite()`, a different
	// path through the renderer than an unprefixed page.
	{ path: '/es/', kind: 'html' },
	{ path: '/sitemap.xml', contains: '<?xml' },
	{ path: '/robots.txt', contains: 'User-agent:' },
	{ path: '/api/auth/me', contains: '"user"' },
];

/** Minimum plausible size for a rendered page. "[object Object]" is 15 bytes. */
const MIN_HTML_BYTES = 1024;

function startWorker() {
	const child = spawn(
		'pnpm',
		[
			'exec',
			'wrangler',
			'dev',
			'-c',
			CONFIG,
			'--local',
			'--port',
			String(PORT),
			'--ip',
			'127.0.0.1',
		],
		{ stdio: ['ignore', 'pipe', 'pipe'] }
	);
	const log = [];
	child.stdout.on('data', (d) => log.push(d.toString()));
	child.stderr.on('data', (d) => log.push(d.toString()));
	return { child, log };
}

async function waitForReady(timeoutMs = 90_000) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			await fetch(`${BASE}/robots.txt`, { signal: AbortSignal.timeout(3000) });
			return true;
		} catch {
			await new Promise((r) => setTimeout(r, 1000));
		}
	}
	return false;
}

async function main() {
	if (!existsSync(CONFIG)) {
		process.stdout.write(
			`✗ ${CONFIG} is missing — run \`pnpm build\` first.\n`
		);
		process.exit(1);
	}

	const { child, log } = startWorker();
	let failures = 0;

	try {
		if (!(await waitForReady())) {
			process.stdout.write('✗ the built Worker never became ready\n');
			process.stdout.write(log.join('').slice(-2000) + '\n');
			process.exit(1);
		}

		for (const check of CHECKS) {
			let body, status;
			try {
				const res = await fetch(`${BASE}${check.path}`, {
					redirect: 'manual',
					signal: AbortSignal.timeout(30_000),
				});
				status = res.status;
				body = await res.text();
			} catch (error) {
				process.stdout.write(`✗ ${check.path} — request failed: ${error}\n`);
				failures++;
				continue;
			}

			const problems = [];
			// Every route here is expected to answer 200. Accepting anything
			// else would let the 404 page pass as a hit: it renders through the
			// same Layout, so it clears both the doctype and size checks.
			if (status < 200 || status >= 300) problems.push(`status ${status}`);
			if (body.includes('[object Object]')) {
				problems.push('body is "[object Object]"');
			}
			if (check.kind === 'html') {
				if (!/^\s*<!DOCTYPE html>/i.test(body)) {
					problems.push(`no doctype (starts: ${JSON.stringify(body.slice(0, 40))})`);
				}
				if (body.length < MIN_HTML_BYTES) {
					problems.push(`only ${body.length} bytes`);
				}
			}
			if (check.contains && !body.includes(check.contains)) {
				problems.push(`missing ${JSON.stringify(check.contains)}`);
			}

			if (problems.length) {
				process.stdout.write(`✗ ${check.path} — ${problems.join('; ')}\n`);
				failures++;
			} else {
				process.stdout.write(
					`✓ ${check.path} (${status}, ${body.length} bytes)\n`
				);
			}
		}
	} finally {
		child.kill('SIGTERM');
	}

	if (failures) {
		process.stdout.write(`\n${failures} check(s) failed against the built Worker.\n`);
		process.exit(1);
	}
	process.stdout.write('\nThe built Worker serves real pages.\n');
	process.exit(0);
}

await main();
