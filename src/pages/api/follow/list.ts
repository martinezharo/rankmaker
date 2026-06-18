export const prerender = false;

import type { APIRoute } from 'astro';
import { json } from '../../../lib/auth';
import { listFollowers, listFollowing } from '../../../lib/follows';

/**
 * GET `?username=…&type=followers|following` → `{ users: UserSummary[] }`.
 * Public — anyone can see who follows whom. The lists are rendered in a modal
 * on the profile page (client-side). Short public cache.
 */
export const GET: APIRoute = async (context) => {
	const headers = { 'Cache-Control': 'public, max-age=30' };
	try {
		const url = new URL(context.request.url);
		const username = url.searchParams.get('username') ?? '';
		const type = url.searchParams.get('type') === 'following'
			? 'following'
			: 'followers';

		const { env } = context.locals.runtime;
		const row = username
			? await env.DB.prepare(
					'SELECT id FROM users WHERE username = ? COLLATE NOCASE'
				)
					.bind(username)
					.first<{ id: string }>()
			: null;
		if (!row) return json({ users: [] }, 200, headers);

		const users =
			type === 'following'
				? await listFollowing(env.DB, row.id)
				: await listFollowers(env.DB, row.id);

		return json({ users }, 200, headers);
	} catch (error) {
		console.error('Follow list error:', error);
		return json({ users: [] }, 200, { 'Cache-Control': 'no-store' });
	}
};
