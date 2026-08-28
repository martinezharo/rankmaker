import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withinRateLimit } from './rate-limit';

/** The slice of KVNamespace the limiter uses, with an inspectable store. */
function fakeKv() {
	const store = new Map<string, string>();
	const puts: { key: string; options?: { expirationTtl?: number } }[] = [];
	return {
		store,
		puts,
		kv: {
			get: async (key: string) => store.get(key) ?? null,
			put: async (
				key: string,
				value: string,
				options?: { expirationTtl?: number }
			) => {
				store.set(key, value);
				puts.push({ key, options });
			},
		} as unknown as KVNamespace,
	};
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-08-28T12:00:00.000Z'));
});
afterEach(() => {
	vi.useRealTimers();
});

describe('withinRateLimit', () => {
	it('allows requests up to the limit and refuses the next one', async () => {
		const { kv } = fakeKv();
		expect(await withinRateLimit(kv, 'ip:1.2.3.4', 2, 60)).toBe(true);
		expect(await withinRateLimit(kv, 'ip:1.2.3.4', 2, 60)).toBe(true);
		expect(await withinRateLimit(kv, 'ip:1.2.3.4', 2, 60)).toBe(false);
	});

	it('counts each key separately', async () => {
		const { kv } = fakeKv();
		await withinRateLimit(kv, 'ip:1.1.1.1', 1, 60);
		expect(await withinRateLimit(kv, 'ip:2.2.2.2', 1, 60)).toBe(true);
	});

	it('starts a fresh budget in the next window', async () => {
		const { kv } = fakeKv();
		expect(await withinRateLimit(kv, 'ip:1.2.3.4', 1, 60)).toBe(true);
		expect(await withinRateLimit(kv, 'ip:1.2.3.4', 1, 60)).toBe(false);

		vi.advanceTimersByTime(60_000);
		expect(await withinRateLimit(kv, 'ip:1.2.3.4', 1, 60)).toBe(true);
	});

	it('expires each window’s counter, so KV does not grow without bound', async () => {
		const { kv, puts } = fakeKv();
		await withinRateLimit(kv, 'ip:1.2.3.4', 5, 60);
		expect(puts[0].options?.expirationTtl).toBe(65);
	});

	it('does not spend budget on a refused request', async () => {
		const { kv, puts } = fakeKv();
		await withinRateLimit(kv, 'ip:1.2.3.4', 1, 60);
		await withinRateLimit(kv, 'ip:1.2.3.4', 1, 60);
		expect(puts).toHaveLength(1);
	});

	it('treats a corrupted counter as zero rather than locking a user out', async () => {
		const { kv, store } = fakeKv();
		const bucket = Math.floor(Date.now() / 1000 / 60);
		store.set(`rl:ip:1.2.3.4:${bucket}`, 'not-a-number');
		expect(await withinRateLimit(kv, 'ip:1.2.3.4', 1, 60)).toBe(true);
	});

	it('refuses everything when the limit is zero', async () => {
		const { kv } = fakeKv();
		expect(await withinRateLimit(kv, 'ip:1.2.3.4', 0, 60)).toBe(false);
	});
});
