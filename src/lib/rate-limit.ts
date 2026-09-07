/**
 * Minimal fixed-window rate limiter backed by KV — an abuse guard, not a hard
 * quota. Mirrors the daily cost cap in api/templates/describe.ts: KV get→put
 * is not atomic, so concurrent requests can slightly exceed the limit, which
 * is fine for throttling scripted spam rather than enforcing an exact ceiling.
 */
import { hmacKey } from './auth';

/**
 * Opaque per-client bucket for endpoints with no signed-in user to key on.
 *
 * The limiter has to tell visitors apart, but a raw IP in a KV key is exactly
 * the identifier those endpoints promise not to retain. An HMAC keyed with the
 * session secret stays stable for the window and is useless to anyone reading
 * the namespace — a bare SHA-256 of an IPv4 is brute-forceable in seconds, an
 * HMAC is not without the secret. Requests with no client IP (local dev) all
 * share one bucket, which only makes the limit stricter.
 */
export async function anonymousClientKey(
    secret: string | undefined,
    request: Request
): Promise<string> {
    const address = request.headers.get('cf-connecting-ip') ?? 'local';
    // Production always has the secret — `required-env` fails the deploy check
    // without it. Local dev and CI may not, and there the limiter should keep
    // working rather than turn every request into an error; those environments
    // have no real visitors whose address needs protecting.
    const mac = await crypto.subtle.sign(
        'HMAC',
        await hmacKey(secret || 'rankmaker-dev'),
        new TextEncoder().encode(address)
    );
    return Array.from(new Uint8Array(mac).subarray(0, 16), (b) =>
        b.toString(16).padStart(2, '0')
    ).join('');
}

export async function withinRateLimit(
    kv: KVNamespace,
    key: string,
    limit: number,
    windowSeconds: number
): Promise<boolean> {
    const bucket = Math.floor(Date.now() / 1000 / windowSeconds);
    const fullKey = `rl:${key}:${bucket}`;
    const used = parseInt((await kv.get(fullKey)) ?? '0', 10) || 0;
    if (used >= limit) return false;
    await kv.put(fullKey, String(used + 1), {
        expirationTtl: windowSeconds + 5,
    });
    return true;
}
