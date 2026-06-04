export const prerender = false;

import type { APIRoute } from 'astro';
import { getCounts } from '../../lib/counts';

export const GET: APIRoute = async (context) => {
    const debug = new URL(context.request.url).searchParams.has('debug');
    try {
        const { env } = context.locals.runtime;

        // TEMP DEBUG: surface why production 500s. Remove once D1 binding works.
        if (!env || !env.DB) {
            return new Response(
                JSON.stringify({
                    error: 'No DB binding',
                    ...(debug
                        ? { envKeys: env ? Object.keys(env) : null }
                        : {}),
                }),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        const counts = await getCounts(env.DB);

        return new Response(JSON.stringify({ counts }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=60',
            },
        });
    } catch (error) {
        console.error('Counts API error:', error);
        return new Response(
            JSON.stringify({
                error: 'Internal server error',
                ...(debug ? { detail: String(error) } : {}),
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
