export const prerender = false;

import type { APIRoute } from 'astro';

/**
 * Serves uploaded images straight from the R2 binding. In production the
 * canonical URLs point at img.rankmaker.net (the bucket's custom domain,
 * cached at the edge, zero Worker cost) and this route is just a fallback;
 * in dev it's the only way to see local-miniflare uploads, so
 * imagePublicBase() defaults to /api/images there.
 */
const KEY_RE = /^u\/[A-Za-z0-9_-]+\/[A-Za-z0-9-]{16,}\.webp$/;

export const GET: APIRoute = async (context) => {
    const key = context.params.key ?? '';
    if (!KEY_RE.test(key)) return new Response('Not found', { status: 404 });

    const object = await context.locals.runtime.env.IMAGES_BUCKET.get(key);
    if (!object) return new Response('Not found', { status: 404 });

    return new Response(object.body, {
        headers: {
            'Content-Type': 'image/webp',
            'Cache-Control': 'public, max-age=31536000, immutable',
            'X-Content-Type-Options': 'nosniff',
            'Content-Disposition': 'inline',
        },
    });
};
