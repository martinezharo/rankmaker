export const prerender = false;

import type { APIRoute } from 'astro';
import {
    OAUTH_STATE_COOKIE,
    randomHex,
    safeNextPath,
    shortCookieOptions,
    signPayload,
} from '../../../lib/auth';
import { resolveProvider } from '../../../lib/oauth-providers';
import { getEnv } from '../../../lib/runtime';

/**
 * Kicks off the OAuth flow with `?provider=` (Google unless asked otherwise —
 * see src/lib/oauth-providers.ts for the order). The random `state`, the
 * chosen provider and the post-login `next` path travel in a signed,
 * short-lived cookie that /callback checks.
 */
export const GET: APIRoute = async (context) => {
    const env = getEnv();
    const url = new URL(context.request.url);

    const next = safeNextPath(url.searchParams.get('next'));

    const provider = resolveProvider(env, url.searchParams.get('provider'));
    if (!provider) {
        console.error('OAuth login: no provider has credentials configured');
        return context.redirect('/?auth_error=1', 302);
    }
    const { clientId } = provider.credentials(env);

    const state = randomHex(16);
    const cookieValue = await signPayload(env.SESSION_SECRET, {
        state,
        next,
        provider: provider.id,
        exp: Date.now() + 10 * 60 * 1000,
    });
    context.cookies.set(
        OAUTH_STATE_COOKIE,
        cookieValue,
        shortCookieOptions(600)
    );

    // Every provider shares one callback URL — the provider is in the signed
    // state cookie — so adding one is a console entry, not a new route.
    return context.redirect(
        provider.authorizeUrl({
            clientId: clientId!,
            redirectUri: `${url.origin}/api/auth/callback`,
            state,
        }),
        302
    );
};
