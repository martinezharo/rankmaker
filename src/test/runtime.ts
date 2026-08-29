/**
 * Stand-in for the `cloudflare:workers` built-in module.
 *
 * That module only resolves inside workerd, so `vitest.config.ts` aliases it
 * here. `src/lib/runtime.ts` imports `env` from it exactly as production does,
 * which is the point: the route handlers under test run the same binding
 * lookup they run in the Worker, instead of reading a platform object the test
 * fabricated for them.
 *
 * `apiContext()` installs the per-test bindings via `setTestEnv`; `env` itself
 * is a stable object reference so a module-scope import stays valid across
 * tests.
 */

/** The live bindings object, mutated in place by `setTestEnv`. */
export const env = {} as Env;

/** Replace the bindings for one test. Called by `apiContext()`. */
export function setTestEnv(next: Record<string, unknown>): void {
	for (const key of Object.keys(env)) {
		delete (env as unknown as Record<string, unknown>)[key];
	}
	Object.assign(env, next);
}

/** Drop every binding, so a handler that runs without `apiContext()` fails
 *  loudly rather than reading another test's leftovers. */
export function clearTestEnv(): void {
	setTestEnv({});
}
