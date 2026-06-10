export const prerender = false;

import type { APIRoute } from 'astro';
import {
    SESSION_COOKIE,
    checkOrigin,
    deleteSession,
    json,
} from '../../../lib/auth';

export const POST: APIRoute = async (context) => {
    if (!checkOrigin(context.request)) {
        return json({ error: 'Forbidden' }, 403);
    }

    try {
        const sessionId = context.cookies.get(SESSION_COOKIE)?.value;
        if (sessionId) {
            await deleteSession(context.locals.runtime.env.DB, sessionId);
        }
        context.cookies.delete(SESSION_COOKIE, { path: '/' });
        return json({ ok: true });
    } catch (error) {
        console.error('Logout error:', error);
        return json({ error: 'Internal server error' }, 500);
    }
};
