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
                'Cache-Control': 'public, max-age=60',
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
