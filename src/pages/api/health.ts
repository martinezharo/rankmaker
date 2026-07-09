export const prerender = false;

import type { APIRoute } from 'astro';
import {
    PRODUCTION_ENV,
    EXPECTED_TABLES,
    requiredEnv,
} from '../../lib/required-env';

/**
 * Deploy-readiness probe. Verifies at runtime — against the ACTUAL production
 * bindings — that the expected D1 tables exist and every required env value is
 * present. This is the last line of defence against migration/secret drift: a
 * broken deploy shows up here instead of as a 500 for a real user.
 *
 * - `status: 'ok'`         → everything present.
 * - `status: 'degraded'`   → all required values present, some optional missing.
 * - `status: 'unhealthy'`  → a required secret or an expected table is missing
 *                            (HTTP 503).
 *
 * Detail (which tables / which env keys are missing) is only returned when the
 * request carries `?key=<SESSION_SECRET>` — env var *names* are already in the
 * repo, but we still avoid advertising which optional integrations are unset.
 */
export const GET: APIRoute = async (context) => {
    const { env } = context.locals.runtime;

    // --- DB: do the expected tables exist? ---
    let dbOk = false;
    let missingTables: string[] = [];
    let dbError: string | null = null;
    try {
        const { results } = await env.DB.prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        ).all<{ name: string }>();
        const present = new Set(results.map((r) => r.name));
        missingTables = EXPECTED_TABLES.filter((t) => !present.has(t));
        dbOk = missingTables.length === 0;
    } catch (error) {
        dbError = error instanceof Error ? error.message : 'unknown DB error';
    }

    // --- Env: are required / optional values present? ---
    const isSet = (name: string) => {
        const value = (env as Record<string, unknown>)[name];
        return typeof value === 'string' && value.length > 0;
    };
    const missingRequired = requiredEnv()
        .map((v) => v.name)
        .filter((name) => !isSet(name));
    const missingOptional = PRODUCTION_ENV.filter((v) => !v.required)
        .map((v) => v.name)
        .filter((name) => !isSet(name));

    const healthy = dbOk && missingRequired.length === 0;
    const status = !healthy
        ? 'unhealthy'
        : missingOptional.length > 0
          ? 'degraded'
          : 'ok';

    const authorized = isAuthorized(context.url, env.SESSION_SECRET);
    const body: Record<string, unknown> = { status };
    if (authorized) {
        body.db = { ok: dbOk, missingTables, error: dbError };
        body.env = { missingRequired, missingOptional };
    } else {
        // Enough to alert without leaking specifics.
        body.checks = {
            db: dbOk,
            requiredEnv: missingRequired.length === 0,
        };
    }

    return new Response(JSON.stringify(body), {
        status: healthy ? 200 : 503,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex',
        },
    });
};

/** Constant-time compare of the `?key=` param against SESSION_SECRET. */
function isAuthorized(url: URL, secret: string | undefined): boolean {
    if (!secret) return false;
    const provided = url.searchParams.get('key');
    if (!provided) return false;
    const a = new TextEncoder().encode(provided);
    const b = new TextEncoder().encode(secret);
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}
