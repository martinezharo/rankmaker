import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET } from '../../src/pages/api/counts';
import { createTestDb, type TestD1 } from '../../src/test/d1';
import { apiContext } from '../../src/test/api';
import {
	insertRankingEvents,
	insertTemplate,
	insertUser,
} from '../../src/test/factories';

let db: TestD1;

beforeEach(() => {
	db = createTestDb();
});
afterEach(() => {
	db.close();
});

const counts = () =>
	GET(apiContext({ db, method: 'GET', path: '/api/counts' }) as never);

describe('GET /api/counts', () => {
	it('is public and returns the per-slug totals', async () => {
		await insertRankingEvents(db, 'best-movies', 3);
		const response = await counts();
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			counts: { 'best-movies': 3 },
		});
	});

	it('never lists the slug of a template that is not public', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		await insertTemplate(db, alice.id, {
			slug: 'unlisted-one',
			visibility: 'unlisted',
		});
		await insertRankingEvents(db, 'unlisted-one');

		expect(await counts()).toBeTruthy();
		expect(((await (await counts()).json()) as any).counts).toEqual({});
	});

	it('is edge-cacheable — the answer is the same for everyone', async () => {
		expect((await counts()).headers.get('Cache-Control')).toBe(
			'public, max-age=60'
		);
	});
});
