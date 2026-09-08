const BLOCKED_CRAWLER_USER_AGENTS = ['SERankingBacklinksBot'];

export function isBlockedCrawler(userAgent: string | null): boolean {
	return (
		userAgent !== null &&
		BLOCKED_CRAWLER_USER_AGENTS.some((crawler) => userAgent.includes(crawler))
	);
}
