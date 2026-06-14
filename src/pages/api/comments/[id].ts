export const prerender = false;

import type { APIRoute } from 'astro';
import { checkOrigin, getSessionUser, json } from '../../../lib/auth';
import { softDeleteComment } from '../../../lib/comments';

/**
 * DELETE /api/comments/:id — soft-delete the caller's own comment. Login +
 * same-origin required; ownership is enforced in the UPDATE itself. The node is
 * kept (so any replies still have a parent) but its content is cleared.
 */
export const DELETE: APIRoute = async (context) => {
	if (!checkOrigin(context.request)) {
		return json({ error: 'Forbidden' }, 403);
	}

	const id = context.params.id ?? '';
	try {
		const { env } = context.locals.runtime;
		const user = await getSessionUser(context.cookies, env.DB);
		if (!user) return json({ error: 'Not logged in' }, 401);

		const ok = await softDeleteComment(env.DB, id, user.id);
		if (!ok) return json({ error: 'Not found' }, 404);
		return json({ ok: true }, 200, { 'Cache-Control': 'private, no-store' });
	} catch (error) {
		console.error('Comment DELETE error:', error);
		return json({ error: 'Internal server error' }, 500);
	}
};
