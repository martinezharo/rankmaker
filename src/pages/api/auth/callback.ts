export const prerender = false;

import type { APIRoute } from 'astro';
import {
    OAUTH_STATE_COOKIE,
    SESSION_COOKIE,
    SIGNUP_COOKIE,
    createSession,
    safeNextPath,
    sessionCookieOptions,
    shortCookieOptions,
    signPayload,
    verifyPayload,
} from '../../../lib/auth';
import {
    findUserIdByIdentity,
    findUserIdByLegacyGithubId,
    findUserIdByVerifiedEmail,
    linkIdentity,
} from '../../../lib/identities';
import {
    getProvider,
    isProviderId,
    type OAuthProfile,
    type ProviderId,
} from '../../../lib/oauth-providers';
import { getEnv } from '../../../lib/runtime';

type StatePayload = {
    state: string;
    next: string;
    /** Absent on cookies issued before providers existed — those were GitHub. */
    provider?: string;
    exp: number;
};

/**
 * The OAuth callback, shared by every provider (which one is in the signed
 * state cookie). A known identity gets a session right away; a new one is
 * handed off to /signup through a signed cookie — no user row exists until a
 * username is picked.
 */
export const GET: APIRoute = async (context) => {
    const env = getEnv();
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

    const providerId = statePayload.provider ?? 'github';
    if (!isProviderId(providerId)) {
        console.error('OAuth callback: unknown provider', { providerId });
        return fail();
    }
    const provider = getProvider(providerId);
    const { clientId, clientSecret } = provider.credentials(env);
    if (!clientId || !clientSecret) {
        console.error('OAuth callback: provider not configured', { providerId });
        return fail();
    }

    const next = safeNextPath(statePayload.next);

    try {
        const profile = await provider.fetchProfile({
            code,
            redirectUri: `${url.origin}/api/auth/callback`,
            clientId,
            clientSecret,
        });
        if (!profile) return fail();

        const db = env.DB;
        const userId = await resolveUser(db, provider.id, profile);

        if (userId) {
            // Keep the stored email fresh on every login (it may have been
            // added or changed since signup). Never clobber a stored address
            // with null. The flag travels with the address rather than being
            // sticky: an address that arrives unverified is not one another
            // provider may later be matched against (see migration 0020).
            if (profile.email) {
                await db
                    .prepare(
                        'UPDATE users SET email = ?, email_verified = ? WHERE id = ?'
                    )
                    .bind(profile.email, profile.emailVerified ? 1 : 0, userId)
                    .run();
            }
            const sessionId = await createSession(db, userId);
            context.cookies.set(
                SESSION_COOKIE,
                sessionId,
                sessionCookieOptions()
            );
            context.cookies.delete(SIGNUP_COOKIE, { path: '/' });
            return context.redirect(next, 302);
        }

        // First time here → finish signup at /signup (pick username + avatar).
        const signupCookie = await signPayload(env.SESSION_SECRET, {
            provider: provider.id,
            accountId: profile.accountId,
            login: profile.login,
            email: profile.email,
            emailVerified: profile.emailVerified,
            next,
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
 * The account this profile signs in as, or null when it belongs to nobody yet.
 *
 * Three ways in, tried in that order, and the last two link the identity on
 * the spot so the next login is a direct hit:
 *
 *  1. The identity we already have.
 *  2. The pre-0019 `users.github_id`, so an account created after the
 *     migration's backfill but before this code shipped is adopted rather
 *     than locked out (see src/lib/identities.ts).
 *  3. A *verified* address that exactly one account holds and had verified
 *     itself — otherwise everyone who signed up with GitHub would silently
 *     get a second, empty account the first time they clicked the new Google
 *     button.
 */
async function resolveUser(
    db: D1Database,
    provider: ProviderId,
    profile: OAuthProfile
): Promise<string | null> {
    const known = await findUserIdByIdentity(db, provider, profile.accountId);
    if (known) return known;

    if (provider === 'github') {
        const legacy = await findUserIdByLegacyGithubId(db, profile.accountId);
        if (legacy) return link(db, provider, profile.accountId, legacy, 'legacy github_id');
    }

    if (!profile.email || !profile.emailVerified) return null;
    const owner = await findUserIdByVerifiedEmail(db, profile.email);
    if (!owner) return null;

    return link(db, provider, profile.accountId, owner, 'verified email');
}

/** Attach the identity to the account we matched, and say so in the logs. */
async function link(
    db: D1Database,
    provider: ProviderId,
    accountId: string,
    userId: string,
    matchedBy: string
): Promise<string> {
    await linkIdentity(db, provider, accountId, userId);
    console.log('OAuth callback: linked provider to existing account', {
        provider,
        userId,
        matchedBy,
    });
    return userId;
}
