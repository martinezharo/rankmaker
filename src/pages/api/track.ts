export const prerender = false;

import type { APIRoute } from 'astro';
import { checkOrigin, getSessionUser } from '../../lib/auth';
import { slugFromUrl } from '../../lib/slug';
import { templateExists } from '../../lib/templates';

// Counts feed the public "X ranked" numbers AND the home/search ordering, so
// this write path is abuse-sensitive: require a same-origin Origin (as every
// other mutating route does) and only record events for slugs that actually
// resolve to a template. Bounds on url/date keep a spammer from bloating KV/D1.
const MAX_URL_LEN = 512;
const MAX_DATE_LEN = 40;

export const POST: APIRoute = async (context) => {
    if (!checkOrigin(context.request)) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const { env, cf } = context.locals.runtime;

        // Parse request body
        let body: { url?: string; date?: string };
        try {
            body = await context.request.json();
        } catch {
            return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const url = (body.url || 'unknown').slice(0, MAX_URL_LEN);
        const date = (body.date || new Date().toISOString()).slice(
            0,
            MAX_DATE_LEN
        );
        const country = (cf as any)?.country || 'unknown';

        // Only count events for a slug that maps to a real template (official
        // JSON or a D1 row). Bogus/invented slugs never reach storage.
        const slug = slugFromUrl(url);
        if (!slug) {
            return new Response(JSON.stringify({ ok: true, skipped: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        if (!(await templateExists(env.DB, slug))) {
            return new Response(JSON.stringify({ ok: true, skipped: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Create a unique key based on timestamp + random suffix
        const key = `ranking_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const value = JSON.stringify({
            url,
            date,
            country,
        });

        // Keep the KV event log (backup / raw history)
        await env['rm-times-ranked'].put(key, value);

        // Attribute the play to the logged-in user (NULL when anonymous). This
        // is the "played" signal used to hide already-played templates from the
        // "You might also like" row.
        const user = await getSessionUser(context.cookies, env.DB);

        // Record the event in D1 so counts can be aggregated efficiently.
        try {
            await env.DB.prepare(
                'INSERT INTO rankings (slug, url, date, country, user_id) VALUES (?, ?, ?, ?, ?)'
            )
                .bind(slug, url, date, country, user?.id ?? null)
                .run();
        } catch (dbError) {
            // Don't fail the request if D1 write fails; KV log still captured it.
            console.error('Track D1 insert error:', dbError);
        }

        return new Response(JSON.stringify({ ok: true, key }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Track API error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
