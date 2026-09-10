export const prerender = false;

import type { APIRoute } from 'astro';
import { getCounts } from '../../lib/counts';
import { getEnv } from '../../lib/runtime';

export const GET: APIRoute = async () => {
    try {
        const env = getEnv();

        const counts = await getCounts(env.DB);

        return new Response(JSON.stringify({ counts }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                // Fetched by every page load to refresh the numbers on cached
                // HTML (see Layout.astro), so this is the most-requested route
                // on the site. The payload is identical for every visitor, so
                // let the edge serve it: `stale-while-revalidate` means a
                // background refresh instead of a Worker invocation — and a
                // D1 read — per request.
                'Cache-Control':
                    'public, max-age=60, s-maxage=60, stale-while-revalidate=600',
            },
        });
    } catch (error) {
        console.error('Counts API error:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
