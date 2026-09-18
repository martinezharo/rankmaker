/**
 * Crawlers refused at the edge, by user agent.
 *
 * This list is the last resort, not the first: public/robots.txt is where a
 * crawler is asked to stay out, and a well-behaved one honours it for free. A
 * name only belongs here once it has been seen crawling *despite* that, since
 * serving the 403 costs a Worker invocation of its own.
 */
export const BLOCKED_CRAWLER_USER_AGENTS = ['SERankingBacklinksBot'];

/**
 * URL prefixes that are the app's own JSON surface rather than content.
 *
 * Nothing under them is a search result, but crawlers reach them anyway:
 * they execute the page's JavaScript, see the `fetch()` targets and the
 * sign-in `<a href>`, and queue them as links. Over 14 days (measured
 * 2026-09-18) Googlebot alone spent 230 requests on /api/me/history, 222 on
 * /api/comments, 219 on /api/templates/vote and 53 starting an OAuth flow it
 * can never finish — each one a Worker invocation serving a bot.
 *
 * Three consequences, because a crawler honours at most one of them:
 *   - `src/middleware.ts` does not apply the locale rewrite here, so the
 *     surface has no `/es/api/…` aliases to crawl in the first place,
 *   - public/robots.txt asks crawlers not to fetch it (the layer that
 *     actually saves the invocation) — crawlers.test.ts holds the file to
 *     this list, prefixes included,
 *   - `X-Robots-Tag: noindex` keeps the JSON out of an index when something
 *     fetches it regardless.
 *
 * Safe to cover the whole prefix: /api/counts only overwrites numbers the page
 * already rendered server-side, and uploaded images are served from
 * img.rankmaker.net in production — /api/images is a dev-only fallback.
 */
export const API_PATH_PREFIXES = ['/api/'];

/**
 * Whether `pathname` addresses the JSON surface rather than a page.
 *
 * Takes the path as written, so it is false for `/es/api/counts` — that is a
 * locale-prefixed *page* path, and the middleware is what refuses to turn it
 * into a second URL for the same endpoint.
 */
export function isApiPath(pathname: string): boolean {
	return API_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isBlockedCrawler(userAgent: string | null): boolean {
	return (
		userAgent !== null &&
		BLOCKED_CRAWLER_USER_AGENTS.some((crawler) => userAgent.includes(crawler))
	);
}
