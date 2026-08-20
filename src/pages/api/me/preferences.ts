export const prerender = false;

import type { APIRoute } from 'astro';
import { checkOrigin, getSessionUser, json } from '../../../lib/auth';
import { setEmailPref } from '../../../lib/notifications';
import { writeMaturePref } from '../../../lib/mature';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * POST /api/me/preferences — the single write endpoint behind /preferences
 * (and the mature-content gate modal).
 *
 * Body may carry either or both keys:
 *   { showMature?: boolean, emailNotifications?: boolean }
 *
 * `showMature` works for signed-out visitors too: it is a cookie first (that's
 * what the render path reads) and, when there is a session, is also stored on
 * the account so it follows the user to their other devices. `/api/auth/me`
 * re-stamps the cookie from the account value on every navigation.
 *
 * `emailNotifications` is account state, so it requires a session.
 */
export const POST: APIRoute = async (context) => {
	if (!checkOrigin(context.request)) {
		return json({ error: 'Forbidden' }, 403);
	}

	try {
		const db = context.locals.runtime.env.DB;
		const user = await getSessionUser(context.cookies, db);

		let body: { showMature?: unknown; emailNotifications?: unknown };
		try {
			body = await context.request.json();
		} catch {
			return json({ error: 'Invalid JSON' }, 400);
		}

		const { showMature, emailNotifications } = body;
		if (showMature === undefined && emailNotifications === undefined) {
			return json({ error: 'Nothing to update.' }, 400);
		}
		if (showMature !== undefined && typeof showMature !== 'boolean') {
			return json({ error: 'showMature must be a boolean' }, 400);
		}
		if (
			emailNotifications !== undefined &&
			typeof emailNotifications !== 'boolean'
		) {
			return json({ error: 'emailNotifications must be a boolean' }, 400);
		}

		if (emailNotifications !== undefined) {
			if (!user) return json({ error: 'Not logged in' }, 401);
			await setEmailPref(db, user.id, emailNotifications);
		}

		if (showMature !== undefined) {
			writeMaturePref(context.cookies, showMature);
			if (user) {
				await db
					.prepare('UPDATE users SET show_mature = ? WHERE id = ?')
					.bind(showMature ? 1 : 0, user.id)
					.run();
			}
		}

		return json({ ok: true, showMature, emailNotifications }, 200, NO_STORE);
	} catch (error) {
		console.error('Preferences error:', error);
		return json({ error: 'Internal server error' }, 500);
	}
};
