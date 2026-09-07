export const prerender = false;

import type { APIRoute } from 'astro';
import { checkOrigin, getSessionUser, json } from '../../../lib/auth';
import { setMarketingConsent } from '../../../lib/marketing-consent';
import { setEmailPref } from '../../../lib/notifications';
import { writeMaturePref } from '../../../lib/mature';
import { getDb } from '../../../lib/runtime';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/** Every preference this endpoint accepts. All of them are booleans. */
const KEYS = ['showMature', 'emailNotifications', 'marketingEmails'] as const;
type PrefKey = (typeof KEYS)[number];
type Body = Partial<Record<PrefKey, unknown>>;

/**
 * POST /api/me/preferences — the single write endpoint behind /preferences
 * (and the mature-content gate modal).
 *
 * Body may carry any combination of the keys above:
 *   { showMature?: boolean, emailNotifications?: boolean, marketingEmails?: boolean }
 *
 * `showMature` works for signed-out visitors too: it is a cookie first (that's
 * what the render path reads) and, when there is a session, is also stored on
 * the account so it follows the user to their other devices. `/api/auth/me`
 * re-stamps the cookie from the account value on every navigation.
 *
 * `emailNotifications` (activity email) and `marketingEmails` (product news,
 * a separate consent — see src/lib/marketing-consent.ts) are account state, so
 * they require a session.
 */
export const POST: APIRoute = async (context) => {
	if (!checkOrigin(context.request)) {
		return json({ error: 'Forbidden' }, 403);
	}

	try {
		const db = getDb();
		const user = await getSessionUser(context.cookies, db);

		let parsed: unknown;
		try {
			parsed = await context.request.json();
		} catch {
			return json({ error: 'Invalid JSON' }, 400);
		}
		// `null` and arrays are valid JSON but not preference bodies, and
		// indexing them below would throw into the 500 handler.
		if (
			typeof parsed !== 'object' ||
			parsed === null ||
			Array.isArray(parsed)
		) {
			return json({ error: 'Invalid JSON' }, 400);
		}
		const body = parsed as Body;

		const present = KEYS.filter((key) => body[key] !== undefined);
		if (present.length === 0) {
			return json({ error: 'Nothing to update.' }, 400);
		}
		const notBoolean = present.find((key) => typeof body[key] !== 'boolean');
		if (notBoolean) {
			return json({ error: `${notBoolean} must be a boolean` }, 400);
		}
		const values = Object.fromEntries(
			present.map((key) => [key, body[key] as boolean])
		) as Partial<Record<PrefKey, boolean>>;

		// Only `showMature` has a signed-out (cookie) form.
		if (!user && present.some((key) => key !== 'showMature')) {
			return json({ error: 'Not logged in' }, 401);
		}

		if (user && values.emailNotifications !== undefined) {
			await setEmailPref(db, user.id, values.emailNotifications);
		}

		if (user && values.marketingEmails !== undefined) {
			await setMarketingConsent(
				db,
				user.id,
				values.marketingEmails,
				'preferences'
			);
		}

		if (values.showMature !== undefined) {
			writeMaturePref(context.cookies, values.showMature);
			if (user) {
				await db
					.prepare('UPDATE users SET show_mature = ? WHERE id = ?')
					.bind(values.showMature ? 1 : 0, user.id)
					.run();
			}
		}

		return json({ ok: true, ...values }, 200, NO_STORE);
	} catch (error) {
		console.error('Preferences error:', error);
		return json({ error: 'Internal server error' }, 500);
	}
};
