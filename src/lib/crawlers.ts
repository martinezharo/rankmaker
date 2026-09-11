/**
 * Crawlers refused at the edge, by user agent.
 *
 * This list is the last resort, not the first: public/robots.txt is where a
 * crawler is asked to stay out, and a well-behaved one honours it for free. A
 * name only belongs here once it has been seen crawling *despite* that, since
 * serving the 403 costs a Worker invocation of its own.
 */
export const BLOCKED_CRAWLER_USER_AGENTS = ['SERankingBacklinksBot'];

export function isBlockedCrawler(userAgent: string | null): boolean {
	return (
		userAgent !== null &&
		BLOCKED_CRAWLER_USER_AGENTS.some((crawler) => userAgent.includes(crawler))
	);
}
