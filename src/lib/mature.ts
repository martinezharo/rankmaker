/**
 * Mature-content filter — the single source of truth for "does this viewer see
 * templates flagged as mature?".
 *
 * The flag itself lives on the template (`templates.is_mature`, set manually by
 * the creator or an admin — there is no automated moderation). This module owns
 * the *viewer* side of it:
 *
 *   - `rm_mature` cookie → what the render path reads. It works for signed-out
 *     visitors too, and it is the only thing a cached page could ever depend
 *     on, which is why listing pages that honour it must not be publicly cached
 *     (see `listingCacheControl`).
 *   - `users.show_mature` → the account-level value, so the preference follows
 *     the user across devices. `/api/auth/me` re-stamps the cookie from it on
 *     every navigation, so the DB always wins for signed-in users.
 *
 * Default is OFF: the *cached, shared* variant of every listing is the one
 * WITHOUT mature templates, which is also what search engines and first-time
 * visitors get.
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
 * Cache-Control for a listing page whose contents depend on the preference.
 *
 * The opted-out response is identical for everyone, so it keeps the normal
 * shared cache. The opted-in response is personal — it must never be stored in
 * a shared cache where an opted-out visitor could be served it.
 */
export function listingCacheControl(showMature: boolean): string {
    return showMature ? 'private, no-store' : 'public, max-age=60';
}

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
