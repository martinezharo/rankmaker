export const prerender = false;

import type { APIRoute } from 'astro';
import { checkOrigin, getSessionUser, json } from '../../../lib/auth';

// A profile bio is short free text. Stored as-is and rendered as text content
// (Astro escapes it), so there's no markup/XSS concern — we only bound length.
export const MAX_BIO_LEN = 280;

/**
 * POST — update the logged-in user's profile bio. Auth + same-origin required
 * (see checkOrigin). An empty/whitespace-only bio clears it (stored as NULL).
 */
export const POST: APIRoute = async (context) => {
	if (!checkOrigin(context.request)) {
		return json({ error: 'Forbidden' }, 403);
	}

	try {
		const { env } = context.locals.runtime;
		const user = await getSessionUser(context.cookies, env.DB);
		if (!user) return json({ error: 'Unauthorized' }, 401);

		let body: { bio?: unknown };
		try {
			body = await context.request.json();
		} catch {
			return json({ error: 'Invalid JSON' }, 400);
		}

		if (typeof body.bio !== 'string') {
			return json({ error: 'Invalid bio' }, 400);
		}

		const trimmed = body.bio.trim();
		if (trimmed.length > MAX_BIO_LEN) {
			return json({ error: 'Bio is too long.' }, 400);
		}
		const bio = trimmed.length > 0 ? trimmed : null;

		await env.DB.prepare('UPDATE users SET bio = ? WHERE id = ?')
			.bind(bio, user.id)
			.run();

		return json({ ok: true, bio }, 200);
	} catch (error) {
		console.error('Profile POST error:', error);
		return json({ error: 'Internal server error' }, 500);
	}
};
