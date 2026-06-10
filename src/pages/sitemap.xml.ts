export const prerender = false;

import type { APIRoute } from 'astro';
import { getOfficialTemplates, listUserTemplates } from '../lib/templates';

const SITE_URL = 'https://rankmaker.net';

export const GET: APIRoute = async (context) => {
    const pages = [
        '',
        '/search',
        '/about',
        '/contact',
        '/cookie-policy',
        '/legal-notice',
        '/privacy-policy',
        '/terms-of-use',
    ];

    // Official + user-created templates and creator profiles.
    let userTemplates: Awaited<ReturnType<typeof listUserTemplates>> = [];
    let profiles: string[] = ['/u/RANKMAKER'];
    try {
        const db = context.locals.runtime.env.DB;
        userTemplates = await listUserTemplates(db);
        const { results } = await db
            .prepare('SELECT username FROM users')
            .all<{ username: string }>();
        profiles = results.map((r) => `/u/${encodeURIComponent(r.username)}`);
    } catch {
        // official-only fallback
    }

    const templatePages = [...getOfficialTemplates(), ...userTemplates].map(
        (t) => `/template/${t.slug}`
    );

    // Helper to determine priority
    const getPriority = (page: string) => {
        if (page === '') return '1.0';
        if (page.startsWith('/template/')) return '0.9';
        if (page === '/search') return '0.8';
        if (page.startsWith('/u/')) return '0.5';
        return '0.3'; // Lower priority for legal/contact/info pages
    };

    // Helper to determine changefreq
    const getChangeFreq = (page: string) => {
        if (page === '' || page === '/search') return 'daily';
        if (page.startsWith('/template/')) return 'weekly';
        return 'monthly';
    };

    const allPages = [...pages, ...templatePages, ...profiles];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${allPages
            .map(
                (page) => `
  <url>
    <loc>${SITE_URL}${page}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>${getChangeFreq(page)}</changefreq>
    <priority>${getPriority(page)}</priority>
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
