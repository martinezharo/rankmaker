import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getCounts } from './counts';
import { createTestDb, type TestD1 } from '../test/d1';
import {
	insertRankingEvents,
	insertTemplate,
	insertUser,
} from '../test/factories';

let db: TestD1;
let alice: { id: string; username: string };

beforeEach(async () => {
	db = createTestDb();
	alice = await insertUser(db, { username: 'alice' });
});
afterEach(() => {
	db.close();
});

// getCounts is the ranking-count half of getTemplateStats; how the numbers are
// arrived at is covered in template-stats.test.ts. What matters here is that
// the wrapper hands back that half, and passes `includeHidden` through — the
// flag is what keeps private slugs out of the public /api/counts payload.
describe('getCounts', () => {
	it('is the count map, keyed by the lowercased slug', async () => {
		await insertRankingEvents(db, 'Best-Movies', 2);
		await insertRankingEvents(db, 'best-games', 1);

		expect(await getCounts(db)).toEqual({
			'best-movies': 2,
			'best-games': 1,
		});
	});

	it('is empty when nothing has been ranked', async () => {
		expect(await getCounts(db)).toEqual({});
	});

	it('does not leak the slugs of hidden templates', async () => {
		await insertTemplate(db, alice.id, {
			slug: 'private-one',
			visibility: 'private',
		});
		await insertRankingEvents(db, 'private-one');

		expect(await getCounts(db)).toEqual({});
		expect(await getCounts(db, true)).toEqual({ 'private-one': 1 });
	});
});
