/**
 * Template cover resolution, shared by every surface that paints a cover
 * (cards, template page, /me, search, the "Following" row).
 *
 * A template shows, in order of preference:
 *   1. its own `cover_image`;
 *   2. a collage built from its options' images, when at least
 *      `COLLAGE_TILES` of them have one — this is why uploading a cover is
 *      optional even for public templates;
 *   3. the seeded text placeholder (SmartImage's fallback).
 *
 * The collage is pure markup (a 2×2 grid of <img>), not a generated bitmap,
 * so it costs nothing to produce and stays correct when options are edited.
 * `collageHtml` exists because half the card renderers are client-side
 * template strings — server components and those strings must not drift.
 */
import { escapeHtml } from './escape';

/** Images a collage is built from. A 2×2 grid: fewer tiles looks broken. */
export const COLLAGE_TILES = 4;

/**
 * Normalizes a stored image path to something an <img> can load: absolute
 * URLs pass through, `public/…` assets become site-root paths.
 */
export function resolveImageUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    if (path.startsWith('public/')) return path.replace('public/', '/');
    return path;
}

/**
 * The first `COLLAGE_TILES` usable images, or `[]` when there aren't enough
 * for a full grid. Order is the caller's order (option position), so the
 * collage is stable across renders.
 */
export function collageImages(
    images: (string | null | undefined)[]
): string[] {
    const usable: string[] = [];
    for (const image of images) {
        const url = resolveImageUrl(typeof image === 'string' ? image.trim() : image);
        if (!url) continue;
        usable.push(url);
        if (usable.length === COLLAGE_TILES) return usable;
    }
    return [];
}

/** `collageImages` over a template's options. */
export function collageFromOptions(
    options: { image: string | null }[] | undefined
): string[] {
    return collageImages((options ?? []).map((o) => o.image));
}

/** Whether these options can back a collage cover (i.e. the cover is optional). */
export function canBuildCollage(
    options: { image: string | null }[] | undefined
): boolean {
    return collageFromOptions(options).length === COLLAGE_TILES;
}

/**
 * List queries fetch option images as one newline-joined column instead of
 * a second round trip (URLs never contain a newline).
 */
export function parseOptionImages(value: string | null | undefined): string[] {
    if (!value) return [];
    return value.split('\n').filter((s) => s.length > 0);
}

/**
 * Collage markup for a container that is already `relative` and sized (the
 * cover boxes all are). Returns '' when there aren't enough images, so
 * callers can treat a falsy result as "fall back to the placeholder".
 */
export function collageHtml(
    images: string[],
    label: string,
    options: { eager?: boolean } = {}
): string {
    if (images.length < COLLAGE_TILES) return '';
    const loading = options.eager ? 'eager' : 'lazy';
    const tiles = images
        .slice(0, COLLAGE_TILES)
        .map(
            (src) =>
                `<img src="${escapeHtml(src)}" alt="" loading="${loading}" ` +
                `decoding="async" class="w-full h-full object-cover bg-surface" />`
        )
        .join('');
    return (
        `<div class="rm-collage absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px bg-border" ` +
        `role="img" aria-label="${escapeHtml(label)}">${tiles}</div>`
    );
}
