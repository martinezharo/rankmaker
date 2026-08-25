/**
 * Mature-content filter — the single source of truth for "does this viewer see
 * templates flagged as mature?".
 *
 * The flag itself lives on the template (`templates.is_mature`, set manually by
 * the creator or an admin — there is no automated moderation). This module owns
 * the *viewer* side of it:
 *
 *   - `rm_mature` cookie → what the *page's own* render path reads. It works
 *     for signed-out visitors too.
 *   - `users.show_mature` → the account-level value, so the preference follows
 *     the user across devices. `/api/auth/me` re-stamps the cookie from it on
 *     every navigation, so the DB always wins for signed-in users.
 *
 * ## Why listings never render the viewer's variant
 *
 * Listing pages are served from Cloudflare's edge cache, whose key is the URL
 * — cookies are not part of it, and the cache is consulted *before* the Worker
 * runs. A per-viewer render would therefore be stored and handed to whoever
 * asked next, and marking the opted-in response `no-store` does not help: it
 * stops that response being stored, but it cannot stop an opted-in viewer
 * being served the opted-out copy that is already there.
 *
 * So every listing renders the canonical, mature-free variant, and a viewer
 * who opted in re-derives their own in the browser from
 * `/api/templates/browse` (see src/scripts/mature-listing.ts). Single-template
 * pages are different: a flagged template renders two different pages for the
 * same URL, so those are `no-store` and never cached at all.
 *
 * Default is OFF, which is also what search engines and first-time visitors
 * get.
 */
import type { AstroCookies } from 'astro';

export const MATURE_COOKIE = 'rm_mature';

/** A year — the preference is deliberately sticky. */
const MATURE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/**
 * Only the server writes this cookie (through /api/me/preferences), so it can
 * stay httpOnly. `lax` keeps it on normal navigations, which is all the render
 * path needs.
 */
export function matureCookieOptions() {
    return {
        httpOnly: true,
        secure: import.meta.env.PROD,
        sameSite: 'lax' as const,
        path: '/',
        maxAge: MATURE_COOKIE_MAX_AGE,
    };
}

/** Whether this request opted into seeing mature templates. */
export function readMaturePref(cookies: AstroCookies): boolean {
    return cookies.get(MATURE_COOKIE)?.value === '1';
}

/** Persist the preference on the response. */
export function writeMaturePref(cookies: AstroCookies, value: boolean): void {
    cookies.set(MATURE_COOKIE, value ? '1' : '0', matureCookieOptions());
}

/**
 * SQL fragment appended to a `templates t` query to drop flagged templates.
 * Empty when the viewer opted in. Always a constant — never interpolates
 * caller input.
 */
export function matureSqlFilter(showMature: boolean): string {
    return showMature ? '' : ' AND t.is_mature = 0';
}

/** Drop flagged templates from an already-loaded list (official JSON + D1). */
export function filterMature<T extends { is_mature: boolean }>(
    templates: T[],
    showMature: boolean
): T[] {
    return showMature ? templates : templates.filter((t) => !t.is_mature);
}

/**
 * Cache-Control for a listing page.
 *
 * A constant, not a function of the viewer: listings render the canonical
 * variant for everyone (see the module docstring), so every visitor may be
 * served the same cached copy. `max-age` is short because listings reorder as
 * templates are ranked and voted on.
 */
export const LISTING_CACHE_CONTROL = 'public, max-age=60';

/**
 * Whether a template must be gated behind the blur + confirmation modal for
 * this viewer.
 *
 * Only public templates gate: a private or unlisted template is already
 * unlisted everywhere, so the flag rides along silently until it is published
 * (which is exactly what was asked for — flagging an unlisted template must not
 * change anything about it today).
 */
export function isMatureGated(
    template: { is_mature: boolean; visibility: string },
    showMature: boolean
): boolean {
    return (
        template.is_mature && template.visibility === 'public' && !showMature
    );
}
