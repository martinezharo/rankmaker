/**
 * Canonical facts about the deployed site.
 *
 * The origin was previously re-declared in every page that builds an absolute
 * URL (canonicals, sitemap, structured data), which is exactly the kind of
 * constant that goes stale in one file only.
 */
import { DEFAULT_SITE_URL } from './required-env';

/**
 * Production origin, without a trailing slash.
 *
 * Deliberately the same value email links fall back to. That one is
 * per-environment (`env.SITE_URL` can override it); canonicals, hreflang, the
 * sitemap and structured data always have to speak for production.
 */
export const SITE_URL = DEFAULT_SITE_URL;

/**
 * The square cover rendered on the home page (see SEOContent.astro) and declared
 * there as the page's primary image: a 1v1 duel resolving into a top 3.
 *
 * Google picks the thumbnail beside a search result from the images in the
 * page — it ignores og:image for that — and favours large square ones, so the
 * home page ships this candidate rather than leaving only the demo cover art.
 * Regenerate the file with `pnpm gen:brand-cover`.
 */
export const BRAND_COVER = {
	path: '/rankmaker-cover.webp',
	url: `${SITE_URL}/rankmaker-cover.webp`,
	width: 1200,
	height: 1200,
} as const;
