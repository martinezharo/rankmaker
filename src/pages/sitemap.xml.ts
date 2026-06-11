export const prerender = false;

import type { APIRoute } from 'astro';
import { getOfficialTemplates, listUserTemplates } from '../lib/templates';

const SITE_URL = 'https://rankmaker.net';

interface SitemapEntry {
    loc: string;
    lastmod?: string;
}

// Real modification date or nothing — a fake/always-now lastmod makes
// Google distrust the whole sitemap.
const toLastmod = (value: string | undefined): string | undefined => {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

export const GET: APIRoute = async (context) => {
    const staticPages: SitemapEntry[] = [
        '',
        '/search',
        '/about',
        '/contact',
        '/cookie-policy',
        '/legal-notice',
        '/privacy-policy',
        '/terms-of-use',
    ].map((path) => ({ loc: `${SITE_URL}${path}` }));

    // Official + user-created templates and creator profiles.
    let userTemplates: Awaited<ReturnType<typeof listUserTemplates>> = [];
    let profiles: SitemapEntry[] = [{ loc: `${SITE_URL}/u/RANKMAKER` }];
    try {
        const db = context.locals.runtime.env.DB;
        userTemplates = await listUserTemplates(db);
        const { results } = await db
            .prepare('SELECT username FROM users')
            .all<{ username: string }>();
        profiles = results.map((r) => ({
            loc: `${SITE_URL}/u/${encodeURIComponent(r.username)}`,
        }));
    } catch {
        // official-only fallback
    }

    const templatePages: SitemapEntry[] = [
        ...getOfficialTemplates(),
        ...userTemplates,
    ].map((t) => ({
        loc: `${SITE_URL}/template/${t.slug}`,
        lastmod: toLastmod(t.updated_at ?? t.created_at),
    }));

    const allPages = [...staticPages, ...templatePages, ...profiles];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${allPages
            .map(
                (page) => `
  <url>
    <loc>${page.loc}</loc>${page.lastmod ? `
    <lastmod>${page.lastmod}</lastmod>` : ''}
  </url>`,
            )
            .join('')}
</urlset>`;

    return new Response(sitemap, {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=3600',
        },
    });
};
