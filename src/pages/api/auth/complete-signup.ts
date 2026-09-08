export const prerender = false;

import type { APIRoute } from 'astro';
import {
    SESSION_COOKIE,
    SIGNUP_COOKIE,
    checkOrigin,
    createSession,
    isSignupPayload,
    isUsernameTaken,
    json,
    sessionCookieOptions,
    usernameProblem,
    verifyPayload,
    type SignupPayload,
} from '../../../lib/auth';
import { isValidAvatarKey } from '../../../lib/avatars';
import { insertIdentityStatement } from '../../../lib/identities';
import { setMarketingConsent } from '../../../lib/marketing-consent';
import { getEnv } from '../../../lib/runtime';

/**
 * Final signup step: creates the user row (username is permanent) + session.
 *
 * `marketingConsent` is the opt-in checkbox on /signup. It is separate from the
 * notification email the account gets by default: see
 * src/lib/marketing-consent.ts for why the two purposes cannot share a flag.
 */
export const POST: APIRoute = async (context) => {
    const env = getEnv();
    if (!checkOrigin(context.request)) {
        return json({ error: 'Forbidden' }, 403);
    }

    const signup = await verifyPayload<SignupPayload>(
        env.SESSION_SECRET,
        context.cookies.get(SIGNUP_COOKIE)?.value
    );
    if (!isSignupPayload(signup)) {
        return json({ error: 'Signup session expired. Log in again.' }, 401);
    }

    let body: {
        username?: unknown;
        avatar?: unknown;
        marketingConsent?: unknown;
    };
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
    // Anything but an explicit `true` is "no consent" — never infer one.
    const marketingConsent = body.marketingConsent === true;

    const db = env.DB;
    if (await isUsernameTaken(db, username as string)) {
        return json({ error: 'Username is already taken.' }, 409);
    }

    const userId = crypto.randomUUID();
    try {
        // One transaction: an account nobody can sign in to, or an identity
        // pointing at no account, would both be unrecoverable for the user.
        await db.batch([
            db
                .prepare(
                    'INSERT INTO users (id, username, avatar, email, email_verified) VALUES (?, ?, ?, ?, ?)'
                )
                .bind(
                    userId,
                    username,
                    body.avatar,
                    signup.email ?? null,
                    signup.emailVerified ? 1 : 0
                ),
            insertIdentityStatement(
                db,
                signup.provider,
                signup.accountId,
                userId
            ),
        ]);
    } catch (error) {
        // UNIQUE constraint race: the username or the provider account was
        // grabbed between the check above and here.
        console.error('Signup insert error:', error);
        return json({ error: 'Username is already taken.' }, 409);
    }

    if (marketingConsent) {
        // A second statement rather than more columns on the INSERT, so the
        // consent columns stay owned by one module. The account already
        // exists at this point, so a failure here must not abort the signup:
        // the user keeps their account with consent left at its default 0,
        // which is the safe direction, and can opt in from /preferences.
        try {
            await setMarketingConsent(db, userId, true, 'signup');
        } catch (error) {
            console.error('Signup marketing consent error:', error);
        }
    }

    const sessionId = await createSession(db, userId);
    context.cookies.set(SESSION_COOKIE, sessionId, sessionCookieOptions());
    context.cookies.delete(SIGNUP_COOKIE, { path: '/' });

    return json({ ok: true, next: signup.next || '/' });
};
