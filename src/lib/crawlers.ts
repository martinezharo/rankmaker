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
 * Two layers, because a crawler honours at most one of them: public/robots.txt
 * asks them not to fetch (which is what actually saves the invocation), and
 * `X-Robots-Tag: noindex` on the response keeps the JSON out of an index when
 * something fetches it regardless. `src/middleware.ts` applies the header;
 * crawlers.test.ts holds robots.txt to the same list.
 *
 * Safe to cover the whole prefix: /api/counts only overwrites numbers the page
 * already rendered server-side, and uploaded images are served from
 * img.rankmaker.net in production — /api/images is a dev-only fallback.
 */
export const NOINDEX_PATH_PREFIXES = ['/api/'];

/** Whether a response for `pathname` should be kept out of search indexes. */
export function isNoindexPath(pathname: string): boolean {
	return NOINDEX_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isBlockedCrawler(userAgent: string | null): boolean {
	return (
		userAgent !== null &&
		BLOCKED_CRAWLER_USER_AGENTS.some((crawler) => userAgent.includes(crawler))
	);
}
