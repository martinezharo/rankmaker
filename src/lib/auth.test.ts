import { describe, expect, it } from 'vitest';
import { signPayload, verifyPayload } from './auth';

describe('signed payloads', () => {
	it('round-trips UTF-8 payloads', async () => {
		const payload = { username: 'José 日本', exp: Date.now() + 60_000 };
		const signed = await signPayload('test-secret', payload);

		expect(await verifyPayload('test-secret', signed)).toEqual(payload);
	});

	it('rejects signatures with an invalid length', async () => {
		const signed = await signPayload('test-secret', { exp: Date.now() + 60_000 });

		expect(await verifyPayload('test-secret', `${signed}0`)).toBeNull();
	});

	it('rejects expired payloads', async () => {
		const signed = await signPayload('test-secret', { exp: Date.now() - 1 });

		expect(await verifyPayload('test-secret', signed)).toBeNull();
	});
});
