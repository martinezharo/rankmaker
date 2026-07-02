/**
 * Minimal fixed-window rate limiter backed by KV — an abuse guard, not a hard
 * quota. Mirrors the daily cost cap in api/templates/describe.ts: KV get→put
 * is not atomic, so concurrent requests can slightly exceed the limit, which
 * is fine for throttling scripted spam rather than enforcing an exact ceiling.
 */
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
