export const prerender = false;

import type { APIRoute } from 'astro';
import { checkOrigin, getSessionUser, json } from '../../../../lib/auth';
import { setEmailPref } from '../../../../lib/notifications';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * POST /api/me/notifications/prefs — toggle the caller's notification-email
 * preference. Body: { emailNotifications: boolean }. Login + same-origin.
 */
export const POST: APIRoute = async (context) => {
	if (!checkOrigin(context.request)) {
		return json({ error: 'Forbidden' }, 403);
	}
	try {
		const db = context.locals.runtime.env.DB;
		const user = await getSessionUser(context.cookies, db);
		if (!user) return json({ error: 'Not logged in' }, 401);

		let body: { emailNotifications?: unknown };
		try {
			body = await context.request.json();
		} catch {
			return json({ error: 'Invalid JSON' }, 400);
		}
		if (typeof body.emailNotifications !== 'boolean') {
			return json({ error: 'emailNotifications must be a boolean' }, 400);
		}

		await setEmailPref(db, user.id, body.emailNotifications);
		return json(
			{ ok: true, emailNotifications: body.emailNotifications },
			200,
			NO_STORE
		);
	} catch (error) {
		console.error('Notifications prefs error:', error);
		return json({ error: 'Internal server error' }, 500);
	}
};
