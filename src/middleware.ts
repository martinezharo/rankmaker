import { defineMiddleware } from 'astro:middleware';

/**
 * Security headers for all on-demand (SSR) responses — which is every page
 * that renders user content (templates, search, profiles) plus the API routes.
 *
 * The CSP is intentionally permissive on inline script/style (the app ships
 * inline gtag bootstrap, inline JSON data islands and `style=` attributes, so a
 * strict nonce policy would break it), but it still locks down the things that
 * actually matter for this app: only known origins may serve scripts, the page
 * can't be framed (clickjacking), `base`/`form` targets are pinned to self, and
 * plugins are disabled. Images allow any https host because option/cover images
 * are arbitrary user-supplied URLs.
 */
const CSP = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
	"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
	'font-src https://fonts.gstatic.com https://cdnjs.cloudflare.com',
	"img-src 'self' https: data:",
	"connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com",
	"frame-ancestors 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"object-src 'none'",
].join('; ');

export const onRequest = defineMiddleware(async (_context, next) => {
	const response = await next();

	// Don't rewrite non-HTML/redirect bodies (e.g. the sitemap sets its own
	// content-type and never needs these), but the headers are harmless there
	// too — apply broadly and let per-route Cache-Control etc. stand.
	const headers = response.headers;
	if (!headers.has('Content-Security-Policy')) {
		headers.set('Content-Security-Policy', CSP);
	}
	headers.set('X-Content-Type-Options', 'nosniff');
	headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	headers.set('X-Frame-Options', 'DENY');

	return response;
});
