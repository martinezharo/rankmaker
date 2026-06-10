export const prerender = false;

import type { APIRoute } from 'astro';
import {
    SESSION_COOKIE,
    SIGNUP_COOKIE,
    checkOrigin,
    createSession,
    isUsernameTaken,
    json,
    sessionCookieOptions,
    usernameProblem,
    verifyPayload,
} from '../../../lib/auth';
import { isValidAvatarKey } from '../../../lib/avatars';

type SignupPayload = { ghId: number; ghLogin: string; next: string; exp: number };

/**
 * Final signup step: creates the user row (username is permanent) + session.
 */
export const POST: APIRoute = async (context) => {
    const { env } = context.locals.runtime;
    if (!checkOrigin(context.request)) {
        return json({ error: 'Forbidden' }, 403);
    }

    const signup = await verifyPayload<SignupPayload>(
        env.SESSION_SECRET,
        context.cookies.get(SIGNUP_COOKIE)?.value
    );
    if (!signup) {
        return json({ error: 'Signup session expired. Log in again.' }, 401);
    }

    let body: { username?: unknown; avatar?: unknown };
    try {
        body = await context.request.json();
    } catch {
        return json({ error: 'Invalid JSON' }, 400);
    }

    const username = body.username;
    const problem = usernameProblem(username);
    if (problem) return json({ error: problem }, 400);
    if (!isValidAvatarKey(body.avatar)) {
        return json({ error: 'Invalid avatar.' }, 400);
    }

    const db = env.DB;
    if (await isUsernameTaken(db, username as string)) {
        return json({ error: 'Username is already taken.' }, 409);
    }

    const userId = crypto.randomUUID();
    try {
        await db
            .prepare(
                'INSERT INTO users (id, github_id, username, avatar) VALUES (?, ?, ?, ?)'
            )
            .bind(userId, signup.ghId, username, body.avatar)
            .run();
    } catch (error) {
        // UNIQUE constraint race: username or github_id grabbed concurrently.
        console.error('Signup insert error:', error);
        return json({ error: 'Username is already taken.' }, 409);
    }

    const sessionId = await createSession(db, userId);
    context.cookies.set(SESSION_COOKIE, sessionId, sessionCookieOptions());
    context.cookies.delete(SIGNUP_COOKIE, { path: '/' });

    return json({ ok: true, next: signup.next || '/' });
};
