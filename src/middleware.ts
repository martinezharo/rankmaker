import { defineMiddleware } from 'astro:middleware';
import { defaultLocale, isLocale } from './i18n/config';

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

function applySecurityHeaders(response: Response): Response {
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
}

/**
 * Single middleware: resolve the locale from the URL prefix, then apply the
 * security headers to the rendered response.
 *
 * URL-prefix i18n — the first path segment selects the language (`/es/…`,
 * `/fr/…`); English is the unprefixed default. The locale is exposed as
 * `locals.locale` and the request is rewritten to the canonical (unprefixed)
 * route so one set of pages serves every language. We do the rewrite + headers
 * in a single middleware because `context.rewrite()` does NOT re-run the
 * middleware chain — splitting them would leave prefixed pages without a CSP.
 */
export const onRequest = defineMiddleware(async (context, next) => {
	const { pathname } = context.url;
	const seg = pathname.split('/')[1];

	let response: Response;
	if (isLocale(seg) && seg !== defaultLocale) {
		context.locals.locale = seg;
		const rest = pathname.slice(seg.length + 1) || '/';
		// Preserve the query string; rewrite to the unprefixed route.
		response = await context.rewrite(rest + context.url.search);
	} else {
		// `context.rewrite()` re-runs this middleware for the unprefixed path,
		// where `seg` is no longer a locale — don't clobber a locale already
		// resolved on the first pass.
		if (!context.locals.locale) context.locals.locale = defaultLocale;
		response = await next();
	}

	return applySecurityHeaders(response);
});
