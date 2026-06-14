export const prerender = false;

import type { APIRoute } from 'astro';
import { checkOrigin, getSessionUser, json } from '../../../../lib/auth';
import { applyVote } from '../../../../lib/comments';

/**
 * POST /api/comments/:id/vote — cast/clear this user's vote. Login +
 * same-origin required. Body `{ value: 1 | -1 | 0 }` (0 clears). Returns the
 * fresh up/down totals and the caller's resulting vote.
 */
export const POST: APIRoute = async (context) => {
	if (!checkOrigin(context.request)) {
		return json({ error: 'Forbidden' }, 403);
	}

	const id = context.params.id ?? '';
	try {
		const { env } = context.locals.runtime;
		const user = await getSessionUser(context.cookies, env.DB);
		if (!user) return json({ error: 'Not logged in' }, 401);

		let body: { value?: unknown };
		try {
			body = await context.request.json();
		} catch {
			return json({ error: 'Invalid JSON' }, 400);
		}

		const value = body.value;
		if (value !== 1 && value !== -1 && value !== 0) {
			return json({ error: 'Invalid vote' }, 400);
		}

		const totals = await applyVote(env.DB, user.id, id, value);
		return json(totals, 200, { 'Cache-Control': 'private, no-store' });
	} catch (error) {
		console.error('Comment vote error:', error);
		return json({ error: 'Internal server error' }, 500);
	}
};
