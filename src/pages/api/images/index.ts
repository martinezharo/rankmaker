export const prerender = false;

import type { APIRoute } from 'astro';
import { checkOrigin, getSessionUser, json } from '../../../lib/auth';
import {
    DAILY_UPLOAD_LIMIT,
    IMAGE_DIMENSIONS,
    MAX_STORED_BYTES,
    MAX_UPLOAD_BYTES,
    cleanupOrphanImages,
    imageKeyToUrl,
    imagePublicBase,
    moderateImage,
    sniffImageType,
    type UploadKind,
} from '../../../lib/images';

/**
 * Upload a template image (auth required). Raw image bytes in the body,
 * `?kind=cover|option` picks the target size. Pipeline: size cap →
 * magic-byte sniff → re-encode to WebP via the Images binding (the
 * client's bytes are never stored: this strips metadata and any embedded
 * payloads) → moderation (OpenAI omni-moderation on the re-encoded image)
 * → R2 put under u/{userId}/ → D1 ownership row.
 *
 * Error codes are machine-readable; the form maps them to i18n messages.
 */
export const POST: APIRoute = async (context) => {
    if (!checkOrigin(context.request)) {
        return json({ error: 'Forbidden' }, 403);
    }

    try {
        const { env, ctx } = context.locals.runtime;
        const user = await getSessionUser(context.cookies, env.DB);
        if (!user) return json({ error: 'You must be logged in.' }, 401);

        const kindParam = context.url.searchParams.get('kind');
        const kind: UploadKind = kindParam === 'cover' ? 'cover' : 'option';

        // Reject oversized bodies before buffering when the header is
        // present; the byteLength check below is the real gate.
        const declared = parseInt(
            context.request.headers.get('content-length') ?? '0',
            10
        );
        if (declared > MAX_UPLOAD_BYTES) {
            return json({ error: 'too_large' }, 413);
        }

        // Soft daily cost/abuse cap, same KV pattern as /api/templates/describe.
        const kv = env['rm-times-ranked'];
        const day = new Date().toISOString().slice(0, 10);
        const rlKey = `img-up:${user.id}:${day}`;
        const used = parseInt((await kv.get(rlKey)) ?? '0', 10) || 0;
        if (used >= DAILY_UPLOAD_LIMIT) {
            return json({ error: 'rate_limited' }, 429);
        }
        await kv.put(rlKey, String(used + 1), { expirationTtl: 60 * 60 * 48 });

        const original = await context.request.arrayBuffer();
        if (original.byteLength === 0) return json({ error: 'unsupported_type' }, 400);
        if (original.byteLength > MAX_UPLOAD_BYTES) {
            return json({ error: 'too_large' }, 413);
        }
        if (!sniffImageType(new Uint8Array(original).subarray(0, 16))) {
            return json({ error: 'unsupported_type' }, 415);
        }

        // Re-encode to WebP, longest edge capped per kind. scale-down never
        // upscales and preserves aspect ratio. A decode failure here means
        // the bytes weren't a real image after all.
        const maxDim = IMAGE_DIMENSIONS[kind];
        const encode = async (quality: number) => {
            const result = await env.IMAGES.input(new Response(original).body!)
                .transform({ width: maxDim, height: maxDim, fit: 'scale-down' })
                .output({ format: 'image/webp', quality });
            return result.response().arrayBuffer();
        };
        let webp: ArrayBuffer;
        try {
            webp = await encode(82);
            if (webp.byteLength > MAX_STORED_BYTES) webp = await encode(55);
        } catch (error) {
            console.error('Image re-encode failed:', error);
            return json({ error: 'unsupported_type' }, 415);
        }
        if (webp.byteLength > MAX_STORED_BYTES) {
            return json({ error: 'too_large' }, 413);
        }

        const moderation = await moderateImage(env.OPENAI_API_KEY, webp);
        if (moderation.verdict === 'rejected') {
            console.warn(
                `Image rejected by moderation (${moderation.category}) for user ${user.id}`
            );
            return json({ error: 'image_rejected' }, 422);
        }
        if (moderation.verdict === 'unavailable') {
            return json({ error: 'upload_failed' }, 503);
        }

        const key = `u/${user.id}/${crypto.randomUUID()}.webp`;
        await env.IMAGES_BUCKET.put(key, webp, {
            httpMetadata: {
                contentType: 'image/webp',
                cacheControl: 'public, max-age=31536000, immutable',
            },
        });
        await env.DB.prepare(
            'INSERT INTO images (key, user_id) VALUES (?, ?)'
        )
            .bind(key, user.id)
            .run();

        // Piggyback abandoned-upload cleanup for this user on the response.
        ctx.waitUntil(
            cleanupOrphanImages(env.DB, env.IMAGES_BUCKET, user.id).catch(
                (error) => console.error('Orphan image cleanup error:', error)
            )
        );

        return json({ ok: true, url: imageKeyToUrl(key, imagePublicBase(env)) });
    } catch (error) {
        console.error('Image upload error:', error);
        return json({ error: 'upload_failed' }, 500);
    }
};
