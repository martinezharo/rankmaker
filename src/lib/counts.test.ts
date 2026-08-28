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

describe('getCounts', () => {
	it('counts one ranking event per row, keyed by the lowercased slug', async () => {
		await insertRankingEvents(db, 'best-movies', 3);
		await insertRankingEvents(db, 'best-games', 1);

		expect(await getCounts(db)).toEqual({
			'best-movies': 3,
			'best-games': 1,
		});
	});

	it('folds legacy case variants of a slug into one total', async () => {
		await insertRankingEvents(db, 'Best-Movies', 2);
		await insertRankingEvents(db, 'best-movies', 3);

		expect(await getCounts(db)).toEqual({ 'best-movies': 5 });
	});

	it('is empty when nothing has been ranked', async () => {
		expect(await getCounts(db)).toEqual({});
	});

	it('does not leak the slugs of hidden templates through the public map', async () => {
		await insertTemplate(db, alice.id, {
			slug: 'private-one',
			visibility: 'private',
		});
		await insertTemplate(db, alice.id, {
			slug: 'unlisted-one',
			visibility: 'unlisted',
		});
		await insertTemplate(db, alice.id, { slug: 'public-one' });
		await insertRankingEvents(db, 'private-one');
		await insertRankingEvents(db, 'unlisted-one');
		await insertRankingEvents(db, 'public-one');

		expect(await getCounts(db)).toEqual({ 'public-one': 1 });
	});

	it('gives the owner view every slug, hidden ones included', async () => {
		await insertTemplate(db, alice.id, {
			slug: 'private-one',
			visibility: 'private',
		});
		await insertRankingEvents(db, 'private-one', 2);

		expect(await getCounts(db, true)).toEqual({ 'private-one': 2 });
	});

	it('excludes a hidden template even when the event row spells the slug differently', async () => {
		await insertTemplate(db, alice.id, {
			slug: 'Private-One',
			visibility: 'private',
		});
		await insertRankingEvents(db, 'private-one');

		expect(await getCounts(db)).toEqual({});
	});

	it('keeps counting official slugs, which have no templates row at all', async () => {
		await insertRankingEvents(db, 'all-star-wars-movies', 5);
		expect(await getCounts(db)).toEqual({ 'all-star-wars-movies': 5 });
	});
});
