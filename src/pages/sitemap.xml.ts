export const prerender = false;

import type { APIRoute } from 'astro';
import { getOfficialTemplates, listUserTemplates } from '../lib/templates';
import { defaultLocale, localizePath, locales } from '../i18n';

const SITE_URL = 'https://rankmaker.net';

interface SitemapEntry {
    /** Site-relative path (e.g. "/search"); localized variants are derived. */
    path: string;
    lastmod?: string;
}

const absUrl = (path: string) => `${SITE_URL}${path}`;

// URLs are already URL-encoded, but escape XML metacharacters defensively.
const xmlEscape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Real modification date or nothing — a fake/always-now lastmod makes
// Google distrust the whole sitemap.
const toLastmod = (value: string | undefined): string | undefined => {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

/**
 * One <url> entry per locale, each carrying the full set of hreflang
 * alternates (+ x-default → the unprefixed English URL). This is the layout
 * Google expects for a multilingual sitemap.
 */
function urlEntries(entry: SitemapEntry): string {
    const alternates = [
        ...locales.map(
            (loc) =>
                `<xhtml:link rel="alternate" hreflang="${loc}" href="${xmlEscape(absUrl(localizePath(entry.path, loc)))}" />`
        ),
        `<xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(absUrl(localizePath(entry.path, defaultLocale)))}" />`,
    ].join('');

    return locales
        .map((loc) => {
            const loc_url = xmlEscape(absUrl(localizePath(entry.path, loc)));
            return `
  <url>
    <loc>${loc_url}</loc>${entry.lastmod ? `
    <lastmod>${entry.lastmod}</lastmod>` : ''}
    ${alternates}
  </url>`;
        })
        .join('');
}

export const GET: APIRoute = async (context) => {
    const staticPages: SitemapEntry[] = [
        '/',
        '/search',
        '/about',
        '/contact',
        '/cookie-policy',
        '/legal-notice',
        '/privacy-policy',
        '/terms-of-use',
    ].map((path) => ({ path }));

    // Official + user-created templates and creator profiles.
    let userTemplates: Awaited<ReturnType<typeof listUserTemplates>> = [];
    let profiles: SitemapEntry[] = [{ path: '/u/RANKMAKER' }];
    try {
        const db = context.locals.runtime.env.DB;
        userTemplates = await listUserTemplates(db);
        const { results } = await db
            .prepare('SELECT username FROM users')
            .all<{ username: string }>();
        profiles = results.map((r) => ({
            path: `/u/${encodeURIComponent(r.username)}`,
        }));
    } catch {
        // official-only fallback
    }

    const templatePages: SitemapEntry[] = [
        ...getOfficialTemplates(),
        ...userTemplates,
    ].map((t) => ({
        path: `/template/${t.slug}`,
        lastmod: toLastmod(t.updated_at ?? t.created_at),
    }));

    const allPages = [...staticPages, ...templatePages, ...profiles];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  ${allPages.map(urlEntries).join('')}
</urlset>`;

    return new Response(sitemap, {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=3600',
        },
    });
};
