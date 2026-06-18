export const prerender = false;

import type { APIRoute } from 'astro';
import {
    OAUTH_STATE_COOKIE,
    SESSION_COOKIE,
    SIGNUP_COOKIE,
    createSession,
    sessionCookieOptions,
    shortCookieOptions,
    signPayload,
    verifyPayload,
} from '../../../lib/auth';

type StatePayload = { state: string; next: string; exp: number };

/**
 * GitHub OAuth callback. Existing users (matched by github_id) get a session
 * right away; new users are handed off to /signup via a signed cookie — no
 * user row is created until they pick a username.
 */
export const GET: APIRoute = async (context) => {
    const { env } = context.locals.runtime;
    const url = new URL(context.request.url);
    const fail = () => context.redirect('/?auth_error=1', 302);

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    const statePayload = await verifyPayload<StatePayload>(
        env.SESSION_SECRET,
        context.cookies.get(OAUTH_STATE_COOKIE)?.value
    );
    context.cookies.delete(OAUTH_STATE_COOKIE, { path: '/' });

    if (!code || !state || !statePayload || statePayload.state !== state) {
        console.error('OAuth callback: missing/mismatched state', {
            hasCode: !!code,
            hasState: !!state,
            hasCookie: !!statePayload,
        });
        return fail();
    }

    try {
        // Exchange the code for an access token. GitHub requires a
        // User-Agent header (Workers' fetch sends none by default).
        const tokenRes = await fetch(
            'https://github.com/login/oauth/access_token',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'User-Agent': 'rankmaker',
                },
                body: JSON.stringify({
                    client_id: env.GITHUB_CLIENT_ID,
                    client_secret: env.GITHUB_CLIENT_SECRET,
                    code,
                    redirect_uri: `${url.origin}/api/auth/callback`,
                }),
            }
        );
        const tokenData = (await tokenRes.json()) as {
            access_token?: string;
            error?: string;
            error_description?: string;
        };
        if (!tokenData.access_token) {
            console.error('OAuth callback: token exchange failed', {
                status: tokenRes.status,
                error: tokenData.error,
                description: tokenData.error_description,
            });
            return fail();
        }

        // Fetch the GitHub user (User-Agent is mandatory for api.github.com).
        const userRes = await fetch('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                Accept: 'application/vnd.github+json',
                'User-Agent': 'rankmaker',
            },
        });
        if (!userRes.ok) {
            console.error('OAuth callback: user fetch failed', {
                status: userRes.status,
            });
            return fail();
        }
        const ghUser = (await userRes.json()) as {
            id?: number;
            login?: string;
            email?: string | null;
        };
        if (typeof ghUser.id !== 'number' || !ghUser.login) {
            console.error('OAuth callback: unexpected user payload');
            return fail();
        }

        // Resolve the best email for notifications: prefer the primary, verified
        // address from /user/emails (only exposed with the user:email scope);
        // fall back to the public profile email. Missing email is non-fatal.
        const email = await fetchPrimaryEmail(
            tokenData.access_token,
            ghUser.email ?? null
        );

        const db = env.DB;
        const existing = await db
            .prepare('SELECT id FROM users WHERE github_id = ?')
            .bind(ghUser.id)
            .first<{ id: string }>();

        if (existing) {
            // Keep the stored email fresh on every login (it may have been added
            // or changed since signup). Don't clobber a stored email with null.
            if (email) {
                await db
                    .prepare('UPDATE users SET email = ? WHERE id = ?')
                    .bind(email, existing.id)
                    .run();
            }
            const sessionId = await createSession(db, existing.id);
            context.cookies.set(
                SESSION_COOKIE,
                sessionId,
                sessionCookieOptions()
            );
            context.cookies.delete(SIGNUP_COOKIE, { path: '/' });
            return context.redirect(statePayload.next || '/', 302);
        }

        // First-time login → finish signup at /signup (pick username + avatar).
        const signupCookie = await signPayload(env.SESSION_SECRET, {
            ghId: ghUser.id,
            ghLogin: ghUser.login,
            ghEmail: email,
            next: statePayload.next || '/',
            exp: Date.now() + 15 * 60 * 1000,
        });
        context.cookies.set(
            SIGNUP_COOKIE,
            signupCookie,
            shortCookieOptions(900)
        );
        return context.redirect('/signup', 302);
    } catch (error) {
        console.error('OAuth callback error:', error);
        return fail();
    }
};

/**
 * The user's primary, verified email via the GitHub `/user/emails` endpoint
 * (requires the user:email scope). Falls back to the public profile email, then
 * null. Never throws — a missing email just means no notification emails.
 */
async function fetchPrimaryEmail(
    accessToken: string,
    profileEmail: string | null
): Promise<string | null> {
    try {
        const res = await fetch('https://api.github.com/user/emails', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github+json',
                'User-Agent': 'rankmaker',
            },
        });
        if (res.ok) {
            const emails = (await res.json()) as {
                email?: string;
                primary?: boolean;
                verified?: boolean;
            }[];
            const primary = emails.find((e) => e.primary && e.verified);
            const anyVerified = emails.find((e) => e.verified);
            const chosen = primary?.email ?? anyVerified?.email ?? null;
            if (chosen) return chosen;
        }
    } catch (error) {
        console.error('OAuth callback: email fetch failed', error);
    }
    return profileEmail;
}
