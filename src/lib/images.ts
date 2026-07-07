/**
 * User-uploaded template images: R2 storage, WebP re-encoding, moderation
 * and lifecycle (claim on template create/edit, delete on replace/remove,
 * lazy cleanup of abandoned uploads).
 *
 * Storage model: uploads live in the same bucket as official assets
 * (img.rankmaker.net) but under the `u/{userId}/{uuid}.webp` prefix, so
 * official `covers/` and `options/` keys can never be touched by user
 * flows. D1 `images` rows track ownership; `template_id` is NULL until a
 * template create/edit claims the key.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** Cap on the stored WebP; oversized outputs get one lower-quality retry. */
export const MAX_STORED_BYTES = 512 * 1024;
export const DAILY_UPLOAD_LIMIT = 150;

/** Longest edge of the re-encoded image, per upload kind. */
export const IMAGE_DIMENSIONS = {
    cover: 1200,
    option: 600,
} as const;

export type UploadKind = keyof typeof IMAGE_DIMENSIONS;

const PROD_PUBLIC_BASE = 'https://img.rankmaker.net';

/**
 * Public base URL uploads are served from (no trailing slash). In dev the
 * bucket is a local miniflare simulation that img.rankmaker.net obviously
 * can't serve, so previews go through the GET /api/images/[...key] route.
 */
export function imagePublicBase(env: { IMAGES_PUBLIC_BASE?: string }): string {
    const configured = env.IMAGES_PUBLIC_BASE?.trim();
    if (configured) return configured.replace(/\/+$/, '');
    return import.meta.env.DEV ? '/api/images' : PROD_PUBLIC_BASE;
}

const KEY_RE = /^u\/[A-Za-z0-9_-]+\/[A-Za-z0-9-]{16,}\.webp$/;

/**
 * Returns the R2 key iff `url` is an uploaded-image URL under `base`.
 * Anything else (external links, official covers/ and options/ assets)
 * returns null.
 */
export function extractImageKey(url: string, base: string): string | null {
    if (!url.startsWith(base + '/')) return null;
    const key = url.slice(base.length + 1);
    return KEY_RE.test(key) ? key : null;
}

export function imageKeyToUrl(key: string, base: string): string {
    return `${base}/${key}`;
}

/** Unique R2 keys referenced by a template's cover + options. */
export function collectImageKeys(
    data: { cover_image: string | null; options: { image: string | null }[] },
    base: string
): string[] {
    const keys = new Set<string>();
    const add = (url: string | null) => {
        if (!url) return;
        const key = extractImageKey(url, base);
        if (key) keys.add(key);
    };
    add(data.cover_image);
    for (const o of data.options) add(o.image);
    return [...keys];
}

// ── Upload validation ────────────────────────────────────────────────────

export type SniffedType = 'jpeg' | 'png' | 'gif' | 'webp';

/** Magic-byte sniffing — the client's Content-Type header is untrusted. */
export function sniffImageType(bytes: Uint8Array): SniffedType | null {
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return 'jpeg';
    }
    if (
        bytes.length >= 8 &&
        bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
        bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
    ) {
        return 'png';
    }
    if (
        bytes.length >= 6 &&
        bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 &&
        (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61
    ) {
        return 'gif';
    }
    if (
        bytes.length >= 12 &&
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) {
        return 'webp';
    }
    return null;
}

// ── Moderation (OpenAI omni-moderation, free endpoint) ──────────────────

/**
 * Per-category score thresholds — an image is rejected when any score
 * reaches its threshold. Tuned "Instagram-level": swimwear, movie/game
 * violence and artistic partial nudity pass; explicit sexual content,
 * gore and self-harm imagery don't. `sexual/minors` is near-zero
 * tolerance. Plain `violence` fires high on posters and game art, so its
 * threshold is a backstop only — `violence/graphic` is the real gate.
 */
export const MODERATION_THRESHOLDS: Record<string, number> = {
    'sexual/minors': 0.02,
    sexual: 0.65,
    'violence/graphic': 0.75,
    violence: 0.9,
    'self-harm': 0.75,
    'self-harm/intent': 0.75,
    'self-harm/instructions': 0.75,
};

export function evaluateImageModeration(
    scores: Record<string, unknown> | null | undefined
): { allowed: boolean; category?: string } {
    // A response without scores is malformed — fail closed.
    if (!scores || typeof scores !== 'object' || Array.isArray(scores)) {
        return { allowed: false };
    }
    for (const [category, threshold] of Object.entries(MODERATION_THRESHOLDS)) {
        const score = scores[category];
        if (typeof score === 'number' && score >= threshold) {
            return { allowed: false, category };
        }
    }
    return { allowed: true };
}

/** btoa over large buffers overflows the arg limit — encode in chunks. */
export function base64Encode(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}

export type ModerationVerdict =
    | { verdict: 'allowed' }
    | { verdict: 'rejected'; category?: string }
    | { verdict: 'unavailable' };

/**
 * Moderates the re-encoded WebP (what we'd actually store). Missing key =
 * moderation deliberately not configured (local dev): allow with a warning.
 * API failure = fail closed as 'unavailable' (the user can retry) — never
 * store an unmoderated image by accident.
 */
export async function moderateImage(
    apiKey: string | undefined,
    webpBytes: ArrayBuffer
): Promise<ModerationVerdict> {
    if (!apiKey) {
        console.warn('OPENAI_API_KEY not set — skipping image moderation.');
        return { verdict: 'allowed' };
    }
    const dataUrl = `data:image/webp;base64,${base64Encode(webpBytes)}`;
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const res = await fetch('https://api.openai.com/v1/moderations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: 'omni-moderation-latest',
                    input: [{ type: 'image_url', image_url: { url: dataUrl } }],
                }),
            });
            if (res.status >= 500 || res.status === 429) {
                continue; // transient — retry once
            }
            if (!res.ok) {
                console.error('Moderation API error:', res.status);
                return { verdict: 'unavailable' };
            }
            const data: any = await res.json();
            const result = evaluateImageModeration(
                data?.results?.[0]?.category_scores
            );
            return result.allowed
                ? { verdict: 'allowed' }
                : { verdict: 'rejected', category: result.category };
        } catch (error) {
            if (attempt === 1) console.error('Moderation fetch failed:', error);
        }
    }
    return { verdict: 'unavailable' };
}

// ── Lifecycle (D1 `images` table + R2 objects) ──────────────────────────

function placeholders(n: number): string {
    return Array(n).fill('?').join(',');
}

/** Every key must be an upload owned by this user. */
export async function verifyImageOwnership(
    db: D1Database,
    keys: string[],
    userId: string
): Promise<boolean> {
    if (keys.length === 0) return true;
    const row = await db
        .prepare(
            `SELECT COUNT(*) AS n FROM images
             WHERE key IN (${placeholders(keys.length)}) AND user_id = ?`
        )
        .bind(...keys, userId)
        .first<{ n: number }>();
    return (row?.n ?? 0) === keys.length;
}

/**
 * Points the keys at the template. A key is claimed by at most one
 * template — the upload UI never reuses URLs, so reassignment only
 * happens if someone hand-crafts a payload, and then last-write-wins.
 */
export async function claimImages(
    db: D1Database,
    keys: string[],
    templateId: string,
    userId: string
): Promise<void> {
    if (keys.length === 0) return;
    await db
        .prepare(
            `UPDATE images SET template_id = ?
             WHERE key IN (${placeholders(keys.length)}) AND user_id = ?`
        )
        .bind(templateId, ...keys, userId)
        .run();
}

async function deleteImageRows(
    db: D1Database,
    bucket: R2Bucket,
    keys: string[]
): Promise<void> {
    if (keys.length === 0) return;
    await bucket.delete(keys);
    await db
        .prepare(`DELETE FROM images WHERE key IN (${placeholders(keys.length)})`)
        .bind(...keys)
        .run();
}

/** After an edit: drop images the template no longer references. */
export async function deleteUnusedTemplateImages(
    db: D1Database,
    bucket: R2Bucket,
    templateId: string,
    keepKeys: string[]
): Promise<void> {
    const rows = await db
        .prepare(
            keepKeys.length === 0
                ? 'SELECT key FROM images WHERE template_id = ?'
                : `SELECT key FROM images WHERE template_id = ?
                   AND key NOT IN (${placeholders(keepKeys.length)})`
        )
        .bind(templateId, ...keepKeys)
        .all<{ key: string }>();
    await deleteImageRows(db, bucket, rows.results.map((r) => r.key));
}

/** On template delete: drop all of its images. */
export async function deleteTemplateImages(
    db: D1Database,
    bucket: R2Bucket,
    templateId: string
): Promise<void> {
    await deleteUnusedTemplateImages(db, bucket, templateId, []);
}

/**
 * Lazy orphan cleanup, run per-user from the upload endpoint (there is no
 * cron: the Astro adapter owns the worker entry, so no scheduled handler).
 * Uploads unclaimed after a day were abandoned forms.
 */
export async function cleanupOrphanImages(
    db: D1Database,
    bucket: R2Bucket,
    userId: string
): Promise<void> {
    const rows = await db
        .prepare(
            `SELECT key FROM images
             WHERE user_id = ? AND template_id IS NULL
               AND created_at < datetime('now', '-1 day')
             LIMIT 50`
        )
        .bind(userId)
        .all<{ key: string }>();
    await deleteImageRows(db, bucket, rows.results.map((r) => r.key));
}
