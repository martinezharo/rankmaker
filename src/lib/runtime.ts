/**
 * The one place the app reaches the Cloudflare platform.
 *
 * Astro 6 removed `Astro.locals.runtime` (the Cloudflare adapter still defines
 * the property, but every getter on it throws). Bindings now come from the
 * `cloudflare:workers` built-in module, and the per-request execution context
 * from `locals.cfContext`.
 *
 * Everything goes through here rather than importing `cloudflare:workers`
 * directly in 39 route files, for two reasons:
 *
 *   - The next platform rename is a one-file change. The last one cost a
 *     39-file sweep precisely because the access was spread out.
 *   - `cloudflare:workers` only resolves inside workerd. Tests alias this
 *     module (see `vitest.config.ts` and `src/test/runtime.ts`) so route
 *     handlers stay callable from plain Node without every test faking a
 *     platform object.
 */
import { env } from 'cloudflare:workers';

/**
 * The Worker's bindings (D1, KV, R2, AI, Images) and secrets.
 *
 * Valid for the lifetime of the isolate, not of a request — safe to call at
 * any point inside a handler, but never capture it in module scope, where it
 * would be read before the isolate has one.
 */
export function getEnv(): Env {
	return env;
}

/** Shorthand for the D1 binding, which is what most callers actually want. */
export function getDb(): D1Database {
	return getEnv().DB;
}

/**
 * The execution context, whose `waitUntil` keeps fire-and-forget work
 * (notification emails, analytics writes) alive past the response.
 *
 * Absent outside a live request — prerendering and tests both run without one
 * — so callers must handle `undefined` rather than assume it is there.
 */
export function getExecutionContext(context: {
	locals: App.Locals;
}): ExecutionContext | undefined {
	return (context.locals as { cfContext?: ExecutionContext }).cfContext;
}
