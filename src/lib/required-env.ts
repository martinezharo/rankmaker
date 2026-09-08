/**
 * Canonical list of the environment values production needs, and how each one
 * is provisioned in Cloudflare. This is the single source of truth for:
 *   - the runtime readiness probe (`src/pages/api/health.ts`)
 *   - the pre-deploy readiness check (`.github/scripts/check-deploy-readiness.ts`,
 *     run in CI and by the `pre-push` git hook)
 *
 * When a new feature reads a new `env.*` value, add it here so both checks start
 * demanding it — that is what stops "I forgot to set the secret in prod" drift.
 *
 * Bindings (DB, KV, AI, IMAGES, IMAGES_BUCKET) are NOT listed: they live in
 * `wrangler.jsonc`, so they are versioned and deploy atomically with the code.
 * Only the hand-provisioned values (secrets + dashboard vars) can drift.
 *
 *   secret: true   → set with `wrangler secret put` (appears in `wrangler secret list`)
 *   secret: false  → a plain var (Cloudflare dashboard "Variables", or a code default)
 *   required: true → production is broken without it; the checks FAIL
 *   required: false→ the feature degrades gracefully; the checks only WARN
 */
export interface RequiredEnvVar {
    name: string;
    secret: boolean;
    required: boolean;
    /** Runtime value used when the binding is absent; such values are healthy. */
    fallback?: string;
    description: string;
}

export const DEFAULT_SITE_URL = 'https://rankmaker.net';
export const DEFAULT_IMAGES_PUBLIC_BASE = 'https://img.rankmaker.net';

export const PRODUCTION_ENV: RequiredEnvVar[] = [
    {
        name: 'SESSION_SECRET',
        secret: true,
        required: true,
        description: 'HMAC key for D1 sessions and the signed OAuth/signup handoff cookies',
    },
    {
        name: 'GOOGLE_CLIENT_ID',
        secret: true,
        required: false,
        description:
            'Google OAuth client id — the PRIMARY sign-in button. Unset means the button is not offered and only GitHub is left; set it (see .dev.vars.example)',
    },
    {
        name: 'GOOGLE_CLIENT_SECRET',
        secret: true,
        required: false,
        description: 'Google OAuth client secret; without it the Google button is not offered',
    },
    {
        name: 'GITHUB_CLIENT_ID',
        secret: true,
        required: true,
        description:
            'GitHub OAuth app client id. Required because sign-in must always have at least one working provider',
    },
    {
        name: 'GITHUB_CLIENT_SECRET',
        secret: true,
        required: true,
        description: 'GitHub OAuth app client secret (the GitHub button is broken without it)',
    },
    {
        name: 'OPENAI_API_KEY',
        secret: true,
        required: false,
        description: 'omni-moderation for image uploads; uploads skip moderation when unset',
    },
    {
        name: 'RESEND_API_KEY',
        secret: true,
        required: false,
        description: 'Resend key for notification emails; emails are skipped when unset',
    },
    {
        name: 'RESEND_FROM',
        secret: false,
        required: false,
        description: 'Verified Resend sender, e.g. "RANKMAKER <notifications@rankmaker.net>"',
    },
    {
        name: 'SITE_URL',
        secret: false,
        required: false,
        fallback: DEFAULT_SITE_URL,
        description: 'Absolute base URL for links in emails (defaults to https://rankmaker.net)',
    },
    {
        name: 'IMAGES_PUBLIC_BASE',
        secret: false,
        required: false,
        fallback: DEFAULT_IMAGES_PUBLIC_BASE,
        description: 'Public base URL for uploaded images (defaults to img.rankmaker.net in prod)',
    },
];

/** Tables the app expects to exist in D1 — keep in sync with `migrations/`. */
export const EXPECTED_TABLES: string[] = [
    'users',
    'user_identities',
    'sessions',
    'templates',
    'template_options',
    'template_saves',
    'follows',
    'ranking_results',
    'comments',
    'votes',
    'images',
    'rankings',
    'notifications',
    'guest_template_metrics',
    'measurement_metadata',
];

export const requiredEnv = () => PRODUCTION_ENV.filter((v) => v.required);
export const optionalEnv = () => PRODUCTION_ENV.filter((v) => !v.required);
