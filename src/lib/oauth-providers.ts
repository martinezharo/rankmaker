/**
 * The identity providers you can sign in with, and the only place that knows
 * how one differs from another.
 *
 * Everything provider-specific lives in this registry: the env vars holding
 * the credentials, the authorize URL, the token exchange, and the shape of the
 * profile response. `/api/auth/login` and `/api/auth/callback` are written
 * against `OAuthProvider` alone, so adding a provider is a new entry here plus
 * its two secrets — no route, no schema and no UI branch changes (the login
 * modal renders whatever `configuredProviders()` returns, and identities are
 * rows in `user_identities`, not columns).
 *
 * Providers are listed in priority order: the first one is the primary CTA and
 * the default when `/api/auth/login` is called without `?provider=`.
 */

export type ProviderId = 'google' | 'github';

/** What we need from a provider to sign somebody in, normalised. */
export type OAuthProfile = {
    /** Stable, provider-scoped account id. Never reused, never re-assigned. */
    accountId: string;
    /** Seed for the username prefill on /signup. Not unique, not stable. */
    login: string;
    email: string | null;
    /**
     * Whether the provider vouches for the address. Only a verified address
     * may be matched against an existing account (see src/lib/identities.ts) —
     * an unverified one would let anybody claim someone else's account by
     * typing their email into a throwaway provider profile.
     */
    emailVerified: boolean;
};

export type OAuthProvider = {
    id: ProviderId;
    /** Shown in the UI, e.g. "Continue with Google". */
    label: string;
    /** Font Awesome classes for the provider's mark. */
    icon: string;
    /** The credentials, or nulls when the deploy has not been given them. */
    credentials(env: Env): { clientId: string | null; clientSecret: string | null };
    authorizeUrl(input: {
        clientId: string;
        redirectUri: string;
        state: string;
    }): string;
    /**
     * Exchange the callback `code` for the user's profile. Returns null on any
     * failure — a refused exchange, an unexpected payload, an unreachable
     * provider — after logging what happened. Never throws.
     */
    fetchProfile(input: {
        code: string;
        redirectUri: string;
        clientId: string;
        clientSecret: string;
    }): Promise<OAuthProfile | null>;
};

// ── Google ───────────────────────────────────────────────────────────────────

const google: OAuthProvider = {
    id: 'google',
    label: 'Google',
    icon: 'fa-brands fa-google',

    credentials: (env) => ({
        clientId: env.GOOGLE_CLIENT_ID || null,
        clientSecret: env.GOOGLE_CLIENT_SECRET || null,
    }),

    authorizeUrl({ clientId, redirectUri, state }) {
        const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        url.searchParams.set('client_id', clientId);
        url.searchParams.set('redirect_uri', redirectUri);
        url.searchParams.set('response_type', 'code');
        // `openid email` is all we read. `profile` is deliberately NOT
        // requested: the name and picture would be personal data we have no
        // use for — usernames and avatars are picked on /signup.
        url.searchParams.set('scope', 'openid email');
        url.searchParams.set('state', state);
        // No refresh token: we only ever call the userinfo endpoint once, in
        // the callback, and then forget the access token.
        url.searchParams.set('access_type', 'online');
        // People with several Google accounts (a personal and a work one)
        // otherwise get silently signed in as whichever they used last.
        url.searchParams.set('prompt', 'select_account');
        return url.toString();
    },

    async fetchProfile({ code, redirectUri, clientId, clientSecret }) {
        try {
            const token = await postForToken(
                'https://oauth2.googleapis.com/token',
                {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Accept: 'application/json',
                },
                new URLSearchParams({
                    code,
                    client_id: clientId,
                    client_secret: clientSecret,
                    redirect_uri: redirectUri,
                    grant_type: 'authorization_code',
                }).toString()
            );
            if (!token) return null;

            // The OpenID userinfo endpoint rather than decoding the id_token:
            // the response is the same claims over a channel we already trust,
            // and it needs no JWT signature verification.
            const res = await fetch(
                'https://openidconnect.googleapis.com/v1/userinfo',
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) {
                console.error('OAuth google: userinfo failed', {
                    status: res.status,
                });
                return null;
            }
            const user = (await res.json()) as {
                sub?: string;
                email?: string;
                email_verified?: boolean;
            };
            if (!user.sub) {
                console.error('OAuth google: userinfo has no subject');
                return null;
            }
            const email = user.email ?? null;
            return {
                accountId: user.sub,
                // Google has no usernames, so the address' local part is the
                // closest thing to one the person will recognise.
                login: email ? email.split('@')[0] : '',
                email,
                emailVerified: user.email_verified === true,
            };
        } catch (error) {
            console.error('OAuth google: profile fetch threw', error);
            return null;
        }
    },
};

// ── GitHub ───────────────────────────────────────────────────────────────────

/** GitHub rejects API requests without one; Workers' fetch sends none. */
const GITHUB_HEADERS = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'rankmaker',
};

const github: OAuthProvider = {
    id: 'github',
    label: 'GitHub',
    icon: 'fa-brands fa-github',

    credentials: (env) => ({
        clientId: env.GITHUB_CLIENT_ID || null,
        clientSecret: env.GITHUB_CLIENT_SECRET || null,
    }),

    authorizeUrl({ clientId, redirectUri, state }) {
        const url = new URL('https://github.com/login/oauth/authorize');
        url.searchParams.set('client_id', clientId);
        url.searchParams.set('redirect_uri', redirectUri);
        url.searchParams.set('state', state);
        // Read access to the address list so we can send notification emails
        // (and match a returning GitHub user to an account they created with
        // Google). Users can still opt out of emails in-app.
        url.searchParams.set('scope', 'user:email');
        return url.toString();
    },

    async fetchProfile({ code, redirectUri, clientId, clientSecret }) {
        try {
            const token = await postForToken(
                'https://github.com/login/oauth/access_token',
                {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'User-Agent': 'rankmaker',
                },
                JSON.stringify({
                    client_id: clientId,
                    client_secret: clientSecret,
                    code,
                    redirect_uri: redirectUri,
                })
            );
            if (!token) return null;

            const res = await fetch('https://api.github.com/user', {
                headers: { ...GITHUB_HEADERS, Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                console.error('OAuth github: user fetch failed', {
                    status: res.status,
                });
                return null;
            }
            const user = (await res.json()) as {
                id?: number;
                login?: string;
                email?: string | null;
            };
            if (typeof user.id !== 'number' || !user.login) {
                console.error('OAuth github: unexpected user payload');
                return null;
            }

            const verified = await fetchGitHubVerifiedEmail(token);
            return {
                accountId: String(user.id),
                login: user.login,
                // The public profile email is the fallback. GitHub does not
                // say whether it is verified, so it is treated as unverified:
                // good enough to email, not good enough to match an account.
                email: verified ?? user.email ?? null,
                emailVerified: verified !== null,
            };
        } catch (error) {
            console.error('OAuth github: profile fetch threw', error);
            return null;
        }
    },
};

/**
 * The primary verified address from `/user/emails` (needs the user:email
 * scope), else any verified one, else null. Never throws — a missing email
 * only costs notification emails.
 */
async function fetchGitHubVerifiedEmail(token: string): Promise<string | null> {
    try {
        const res = await fetch('https://api.github.com/user/emails', {
            headers: { ...GITHUB_HEADERS, Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return null;
        const emails = (await res.json()) as {
            email?: string;
            primary?: boolean;
            verified?: boolean;
        }[];
        if (!Array.isArray(emails)) return null;
        const primary = emails.find((e) => e.primary && e.verified);
        const anyVerified = emails.find((e) => e.verified);
        return primary?.email ?? anyVerified?.email ?? null;
    } catch (error) {
        console.error('OAuth github: email fetch failed', error);
        return null;
    }
}

/** POST an authorization code and return the access token, or null. */
async function postForToken(
    url: string,
    headers: Record<string, string>,
    body: string
): Promise<string | null> {
    const res = await fetch(url, { method: 'POST', headers, body });
    const data = (await res.json().catch(() => null)) as {
        access_token?: string;
        error?: string;
        error_description?: string;
    } | null;
    if (!data?.access_token) {
        console.error('OAuth: token exchange failed', {
            url,
            status: res.status,
            error: data?.error,
            description: data?.error_description,
        });
        return null;
    }
    return data.access_token;
}

// ── Registry ─────────────────────────────────────────────────────────────────

/** Priority order: the first entry is the primary sign-in option. */
export const PROVIDERS: readonly OAuthProvider[] = [google, github];

export function isProviderId(value: unknown): value is ProviderId {
    return PROVIDERS.some((p) => p.id === value);
}

export function getProvider(id: ProviderId): OAuthProvider {
    return PROVIDERS.find((p) => p.id === id)!;
}

export function isProviderConfigured(env: Env, provider: OAuthProvider): boolean {
    const { clientId, clientSecret } = provider.credentials(env);
    return clientId !== null && clientSecret !== null;
}

/**
 * The providers this deploy actually has credentials for, in priority order.
 *
 * The login modal renders from this, so a provider whose secrets are not set
 * (a fresh local checkout, a deploy mid-rollout) is not offered rather than
 * offered and broken. Falls back to the full list if nothing is configured, so
 * a misconfigured deploy shows the normal UI and fails loudly at /login
 * instead of rendering a sign-in dialog with no way to sign in.
 */
export function configuredProviders(env: Env): OAuthProvider[] {
    const configured = PROVIDERS.filter((p) => isProviderConfigured(env, p));
    return configured.length > 0 ? configured : [...PROVIDERS];
}

/**
 * The provider to send someone to: the one they asked for when it is usable,
 * otherwise the primary configured one. Null when the deploy has no usable
 * provider at all.
 */
export function resolveProvider(
    env: Env,
    requested: string | null
): OAuthProvider | null {
    const usable = PROVIDERS.filter((p) => isProviderConfigured(env, p));
    if (isProviderId(requested)) {
        const asked = getProvider(requested);
        if (usable.includes(asked)) return asked;
    }
    return usable[0] ?? null;
}
