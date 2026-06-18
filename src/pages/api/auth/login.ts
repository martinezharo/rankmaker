export const prerender = false;

import type { APIRoute } from 'astro';
import {
    OAUTH_STATE_COOKIE,
    randomHex,
    shortCookieOptions,
    signPayload,
} from '../../../lib/auth';

/**
 * Kicks off the GitHub OAuth flow. The random `state` (and the post-login
 * `next` path) travel in a signed, short-lived cookie checked by /callback.
 */
export const GET: APIRoute = async (context) => {
    const { env } = context.locals.runtime;
    const url = new URL(context.request.url);

    // Only allow same-site relative paths to avoid open redirects. Reject
    // backslashes too: browsers normalize "\" to "/" in the Location header,
    // so "/\evil.com" would resolve to the protocol-relative "//evil.com".
    let next = url.searchParams.get('next') || '/';
    if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
        next = '/';
    }

    const state = randomHex(16);
    const cookieValue = await signPayload(env.SESSION_SECRET, {
        state,
        next,
        exp: Date.now() + 10 * 60 * 1000,
    });
    context.cookies.set(
        OAUTH_STATE_COOKIE,
        cookieValue,
        shortCookieOptions(600)
    );

    const authorize = new URL('https://github.com/login/oauth/authorize');
    authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
    authorize.searchParams.set(
        'redirect_uri',
        `${url.origin}/api/auth/callback`
    );
    authorize.searchParams.set('state', state);
    // Request read access to the user's email addresses so we can send
    // notification emails (Resend). Email is stored on first signup / refreshed
    // on subsequent logins; users can still opt out of emails in-app.
    authorize.searchParams.set('scope', 'user:email');

    return context.redirect(authorize.toString(), 302);
};
