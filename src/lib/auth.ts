/**
 * Auth plumbing: D1-backed sessions, HMAC-signed short-lived cookies for the
 * OAuth state / signup handoff, and shared validation rules.
 */
import type { AstroCookies } from 'astro';

export const SESSION_COOKIE = 'rm_session';
export const SIGNUP_COOKIE = 'rm_signup';
export const OAUTH_STATE_COOKIE = 'rm_oauth_state';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type SessionUser = {
    id: string;
    username: string;
    avatar: string;
    isVerified: boolean;
};

export function sessionCookieOptions() {
    return {
        httpOnly: true,
        secure: import.meta.env.PROD,
        sameSite: 'lax' as const,
        path: '/',
        maxAge: SESSION_TTL_MS / 1000,
    };
}

export function shortCookieOptions(maxAgeSeconds: number) {
    return {
        httpOnly: true,
        secure: import.meta.env.PROD,
        sameSite: 'lax' as const,
        path: '/',
        maxAge: maxAgeSeconds,
    };
}

export function randomHex(bytes: number): string {
    const buf = crypto.getRandomValues(new Uint8Array(bytes));
    return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(
    db: D1Database,
    userId: string
): Promise<string> {
    const id = randomHex(32);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    await db
        .prepare(
            'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
        )
        .bind(id, userId, expiresAt)
        .run();
    return id;
}

export async function deleteSession(
    db: D1Database,
    sessionId: string
): Promise<void> {
    await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

/**
 * Resolve the logged-in user from the session cookie. Expired sessions are
 * lazily deleted. Returns null when there is no valid session.
 */
export async function getSessionUser(
    cookies: AstroCookies,
    db: D1Database
): Promise<SessionUser | null> {
    const sessionId = cookies.get(SESSION_COOKIE)?.value;
    if (!sessionId) return null;

    const row = await db
        .prepare(
            `SELECT s.expires_at, u.id, u.username, u.avatar, u.is_verified
             FROM sessions s JOIN users u ON u.id = s.user_id
             WHERE s.id = ?`
        )
        .bind(sessionId)
        .first<{
            expires_at: string;
            id: string;
            username: string;
            avatar: string;
            is_verified: number;
        }>();
    if (!row) return null;

    if (new Date(row.expires_at).getTime() < Date.now()) {
        await deleteSession(db, sessionId);
        return null;
    }

    return {
        id: row.id,
        username: row.username,
        avatar: row.avatar,
        isVerified: row.is_verified === 1,
    };
}

// ── HMAC-signed payloads (OAuth state + signup handoff cookies) ──────────────

async function hmacKey(secret: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );
}

function b64urlEncode(s: string): string {
    return btoa(unescape(encodeURIComponent(s)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function b64urlDecode(s: string): string {
    const padded = s.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(escape(atob(padded)));
}

/** Sign a JSON payload: base64url(json) + "." + hex(hmac). */
export async function signPayload(
    secret: string,
    payload: Record<string, unknown>
): Promise<string> {
    const data = b64urlEncode(JSON.stringify(payload));
    const key = await hmacKey(secret);
    const sig = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(data)
    );
    const sigHex = Array.from(new Uint8Array(sig), (b) =>
        b.toString(16).padStart(2, '0')
    ).join('');
    return `${data}.${sigHex}`;
}

/**
 * Verify a signed payload. Returns null on any tamper/format issue or when
 * the embedded `exp` (ms epoch) is in the past.
 */
export async function verifyPayload<T extends { exp?: number }>(
    secret: string,
    value: string | undefined
): Promise<T | null> {
    if (!value) return null;
    const dot = value.lastIndexOf('.');
    if (dot < 0) return null;
    const data = value.slice(0, dot);
    const sigHex = value.slice(dot + 1);
    try {
        const key = await hmacKey(secret);
        const sigBytes = new Uint8Array(
            (sigHex.match(/.{2}/g) || []).map((h) => parseInt(h, 16))
        );
        const ok = await crypto.subtle.verify(
            'HMAC',
            key,
            sigBytes,
            new TextEncoder().encode(data)
        );
        if (!ok) return null;
        const payload = JSON.parse(b64urlDecode(data)) as T;
        if (typeof payload.exp === 'number' && payload.exp < Date.now()) {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
}

// ── CSRF / input rules ───────────────────────────────────────────────────────

/**
 * Mutating endpoints require a same-origin `Origin` header (browsers always
 * send it on cross-site and fetch POSTs). Combined with SameSite=Lax cookies
 * this blocks CSRF.
 */
export function checkOrigin(request: Request): boolean {
    const origin = request.headers.get('Origin');
    if (!origin) return false;
    try {
        return origin === new URL(request.url).origin;
    } catch {
        return false;
    }
}

export const USERNAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,28}[a-zA-Z0-9]$/;

export const RESERVED_USERNAMES = [
    'rankmaker',
    'admin',
    'administrator',
    'mod',
    'moderator',
    'official',
    'support',
    'help',
    'api',
    'template',
    'templates',
    'search',
    'create',
    'category',
    'edit',
    'me',
    'history',
    'saved',
    'notifications',
    'u',
    'user',
    'users',
    'profile',
    'settings',
    'account',
    'login',
    'logout',
    'signup',
    'signin',
    'auth',
    'about',
    'legal',
    'privacy',
    'terms',
];

export function usernameProblem(username: unknown): string | null {
    if (typeof username !== 'string') return 'Username is required.';
    if (!USERNAME_RE.test(username)) {
        return 'Use 3-30 letters, numbers, dashes or underscores (must start and end with a letter or number).';
    }
    if (RESERVED_USERNAMES.includes(username.toLowerCase())) {
        return 'This username is reserved.';
    }
    return null;
}

export async function isUsernameTaken(
    db: D1Database,
    username: string
): Promise<boolean> {
    const row = await db
        .prepare('SELECT 1 AS x FROM users WHERE username = ? COLLATE NOCASE')
        .bind(username)
        .first();
    return row !== null;
}

// ── Small JSON response helper shared by the API endpoints ──────────────────

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers },
    });
}
