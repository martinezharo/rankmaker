export const prerender = false;

import type { APIRoute } from 'astro';
import { json } from '../../../lib/auth';
import { getCounts } from '../../../lib/counts';
import { getTemplateVotes } from '../../../lib/template-votes';
import { decorateListing } from '../../../lib/listings';
import { readMaturePref } from '../../../lib/mature';
import { listBrowseTemplates, listTemplatesByUserId } from '../../../lib/templates';

/**
 * The browse listing *as this viewer should see it*.
 *
 * Listing pages are publicly cached, so their HTML is always the canonical,
 * mature-free variant — the edge cache key does not include cookies, so a
 * per-viewer render would be handed to whoever asked next. A viewer who opted
 * into mature content therefore re-derives their listing in the browser from
 * this endpoint, which is `no-store` and reads the cookie.
 *
 * Everyone else gets `items: null` and the server-rendered grid stands, so
 * this costs one small request for the small minority who opted in and nothing
 * at all for everybody else.
 *
 * `?user=<username>` scopes it to a profile page's templates.
 */
export const GET: APIRoute = async (context) => {
	const headers = { 'Cache-Control': 'private, no-store' };
	try {
		// The cookie is re-stamped from the account on every navigation by
		// /api/auth/me, so it is the current value for signed-in users too.
		if (!readMaturePref(context.cookies)) {
			return json({ items: null }, 200, headers);
		}

		const db = context.locals.runtime.env.DB;
		const username = context.url.searchParams.get('user');

		if (username) {
			const user = await db
				.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE')
				.bind(username)
				.first<{ id: string }>();
			if (!user) return json({ items: null }, 200, headers);

			const [templates, counts, votes] = await Promise.all([
				listTemplatesByUserId(db, user.id, { showMature: true }),
				getCounts(db),
				getTemplateVotes(db),
			]);
			return json(
				{ items: decorateListing(templates, { counts, votes }) },
				200,
				headers
			);
		}

		const [templates, counts, votes] = await Promise.all([
			listBrowseTemplates(db, true),
			getCounts(db),
			getTemplateVotes(db),
		]);
		return json(
			{ items: decorateListing(templates, { counts, votes }) },
			200,
			headers
		);
	} catch (error) {
		// Degrade to the server-rendered (mature-free) grid rather than 500 —
		// the page is already on screen and complete.
		console.error('browse listing failed:', error);
		return json({ items: null }, 200, headers);
	}
};
