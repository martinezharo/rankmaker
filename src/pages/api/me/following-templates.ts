export const prerender = false;

import type { APIRoute } from 'astro';
import { getSessionUser, json } from '../../../lib/auth';
import { listFollowingTemplates } from '../../../lib/follows';

/**
 * GET → `{ templates: [...] }`, the latest public templates from the accounts
 * the logged-in user follows. Powers the homepage "Following" row, which is
 * rendered client-side because the homepage is publicly cached and this data
 * is per-user. Anonymous callers (or users following no one with templates)
 * get an empty array. Never cached.
 */
export const GET: APIRoute = async (context) => {
	const headers = { 'Cache-Control': 'private, no-store' };
	try {
		const { env } = context.locals.runtime;
		const user = await getSessionUser(context.cookies, env.DB);
		if (!user) return json({ templates: [] }, 200, headers);

		const templates = await listFollowingTemplates(env.DB, user.id, 8);
		// Trim the payload to what the card renderer needs.
		const slim = templates.map((t) => ({
			slug: t.slug,
			title: t.title,
			description: t.description,
			category: t.category,
			cover_image: t.cover_image,
			times_ranked: t.times_ranked,
			votes: t.votes ?? 0,
			creator: t.creator,
		}));
		return json({ templates: slim }, 200, headers);
	} catch (error) {
		console.error('Following templates error:', error);
		return json({ templates: [] }, 200, headers);
	}
};
