export const prerender = false;

import type { APIRoute } from 'astro';
import { checkOrigin, getSessionUser, json } from '../../../../lib/auth';
import { markAllRead } from '../../../../lib/notifications';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * POST /api/me/notifications/read — mark all of the caller's notifications as
 * read. Called by the notifications page on load ("seeing them" clears the
 * pending state). Login + same-origin required.
 */
export const POST: APIRoute = async (context) => {
	if (!checkOrigin(context.request)) {
		return json({ error: 'Forbidden' }, 403);
	}
	try {
		const db = context.locals.runtime.env.DB;
		const user = await getSessionUser(context.cookies, db);
		if (!user) return json({ error: 'Not logged in' }, 401);

		await markAllRead(db, user.id);
		return json({ ok: true }, 200, NO_STORE);
	} catch (error) {
		console.error('Notifications read error:', error);
		return json({ error: 'Internal server error' }, 500);
	}
};
