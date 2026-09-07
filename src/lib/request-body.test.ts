import { describe, expect, it } from 'vitest';
import { readBoundedBody } from './request-body';

describe('readBoundedBody', () => {
	it('returns the body when it stays within the limit', async () => {
		const request = new Request('https://rankmaker.test/upload', {
			method: 'POST',
			body: 'abc',
		});

		expect(await readBoundedBody(request, 3)).toEqual(
			new TextEncoder().encode('abc').buffer
		);
	});

	it('stops reading once the limit is exceeded', async () => {
		const request = new Request('https://rankmaker.test/upload', {
			method: 'POST',
			body: 'abcd',
		});

		expect(await readBoundedBody(request, 3)).toBeNull();
	});
});
