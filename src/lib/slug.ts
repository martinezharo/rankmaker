/**
 * Derive a template slug from a ranking URL.
 * Ranking pages live at `/template/<slug>`, so the slug is the last
 * non-empty path segment. Returns null when it can't be determined.
 */
export function slugFromUrl(url: string | undefined | null): string | null {
    if (!url) return null;
    try {
        const { pathname } = new URL(url);
        const segments = pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        return last || null;
    } catch {
        return null;
    }
}
