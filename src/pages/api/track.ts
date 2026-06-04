export const prerender = false;

import type { APIRoute } from 'astro';
import { slugFromUrl } from '../../lib/slug';

export const POST: APIRoute = async (context) => {
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

        const url = body.url || 'unknown';
        const date = body.date || new Date().toISOString();
        const country = (cf as any)?.country || 'unknown';

        // Create a unique key based on timestamp + random suffix
        const key = `ranking_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const value = JSON.stringify({
            url,
            date,
            country,
        });

        // Keep the KV event log (backup / raw history)
        await env['rm-times-ranked'].put(key, value);

        // Record the event in D1 so counts can be aggregated efficiently.
        // Skip if we can't derive a slug (no valid template = no count).
        const slug = slugFromUrl(url);
        if (slug) {
            try {
                await env.DB.prepare(
                    'INSERT INTO rankings (slug, url, date, country) VALUES (?, ?, ?, ?)'
                )
                    .bind(slug, url, date, country)
                    .run();
            } catch (dbError) {
                // Don't fail the request if D1 write fails; KV log still captured it.
                console.error('Track D1 insert error:', dbError);
            }
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
