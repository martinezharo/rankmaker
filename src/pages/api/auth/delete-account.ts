export const prerender = false;

import type { APIRoute } from 'astro';
import {
    SESSION_COOKIE,
    checkOrigin,
    getSessionUser,
    json,
} from '../../../lib/auth';
import { detachUserComments } from '../../../lib/comments';

/**
 * Permanently deletes the account. The DELETE on `users` cascades to
 * sessions, templates and template_options. Anonymous `rankings` rows (keyed
 * only by slug, no user id) are intentionally kept as aggregate analytics.
 *
 * Comments are handled separately, first: `detachUserComments` soft-deletes
 * this user's own comments and reassigns them to a placeholder account, so
 * the `DELETE FROM users` below can't cascade through them — which would
 * otherwise cascade a second time through `comments.parent_id` and delete
 * every reply *other* users had written underneath.
 */
export const POST: APIRoute = async (context) => {
    if (!checkOrigin(context.request)) {
        return json({ error: 'Forbidden' }, 403);
    }

    try {
        const db = context.locals.runtime.env.DB;
        const user = await getSessionUser(context.cookies, db);
        if (!user) return json({ error: 'Not logged in' }, 401);

        let body: { confirmUsername?: unknown };
        try {
            body = await context.request.json();
        } catch {
            return json({ error: 'Invalid JSON' }, 400);
        }
        if (body.confirmUsername !== user.username) {
            return json(
                { error: 'Username confirmation does not match.' },
                400
            );
        }

        await detachUserComments(db, user.id);
        await db.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run();
        context.cookies.delete(SESSION_COOKIE, { path: '/' });

        return json({ ok: true });
    } catch (error) {
        console.error('Delete account error:', error);
        return json({ error: 'Internal server error' }, 500);
    }
};
