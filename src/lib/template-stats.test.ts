import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getTemplateStat, getTemplateStats } from './template-stats';
import { applyTemplateVote } from './template-votes';
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

/** What the table itself holds, bypassing the visibility filter. */
function storedRows() {
	return db.raw
		.prepare('SELECT * FROM template_stats ORDER BY slug_key')
		.all();
}

describe('the template_stats triggers', () => {
	it('starts a slug at its first play and adds up from there', async () => {
		await insertRankingEvents(db, 'best-movies', 3);

		expect(storedRows()).toEqual([
			{ slug_key: 'best-movies', times_ranked: 3, votes: 0 },
		]);
	});

	it('folds case variants of a slug into one row', async () => {
		await insertRankingEvents(db, 'Best-Movies', 2);
		await insertRankingEvents(db, 'best-movies', 3);

		expect(await getTemplateStat(db, 'BEST-MOVIES', 'times_ranked')).toBe(5);
	});

	it('walks the count back down when events are deleted', async () => {
		await insertRankingEvents(db, 'best-movies', 3);
		await db.prepare('DELETE FROM rankings WHERE slug = ?').bind('best-movies').run();

		expect(await getTemplateStat(db, 'best-movies', 'times_ranked')).toBe(0);
	});

	it('moves the count with the slug when an event row is re-pointed', async () => {
		await insertRankingEvents(db, 'old-slug', 2);
		await db.prepare('UPDATE rankings SET slug = ?').bind('new-slug').run();

		expect(await getTemplateStat(db, 'old-slug', 'times_ranked')).toBe(0);
		expect(await getTemplateStat(db, 'new-slug', 'times_ranked')).toBe(2);
	});

	it('tracks the net vote score through vote, re-vote and unvote', async () => {
		const bob = await insertUser(db, { username: 'bob' });
		await insertTemplate(db, alice.id, { slug: 'best-movies' });

		await applyTemplateVote(db, alice.id, 'best-movies', 1);
		await applyTemplateVote(db, bob.id, 'best-movies', 1);
		expect(await getTemplateStat(db, 'best-movies', 'votes')).toBe(2);

		// A re-vote is an upsert: the UPDATE branch has to account for it.
		await applyTemplateVote(db, bob.id, 'best-movies', -1);
		expect(await getTemplateStat(db, 'best-movies', 'votes')).toBe(0);

		await applyTemplateVote(db, alice.id, 'best-movies', 0);
		expect(await getTemplateStat(db, 'best-movies', 'votes')).toBe(-1);
	});

	it('ignores votes cast on anything that is not a template', async () => {
		await db
			.prepare(
				`INSERT INTO votes (user_id, subject_type, subject_id, value)
				 VALUES (?, 'comment', '42', 1)`
			)
			.bind(alice.id)
			.run();

		expect(storedRows()).toEqual([]);
	});

	it('takes a vote back out when deleting its author cascades the row away', async () => {
		await insertTemplate(db, alice.id, { slug: 'best-movies' });
		await applyTemplateVote(db, alice.id, 'best-movies', 1);

		// votes.user_id is ON DELETE CASCADE. The cascade has to reach the
		// trigger too, or an account deletion silently inflates every score
		// that account ever voted on.
		await db.prepare('DELETE FROM users WHERE id = ?').bind(alice.id).run();

		expect(await getTemplateStat(db, 'best-movies', 'votes')).toBe(0);
	});
});

describe('getTemplateStats', () => {
	it('returns both maps from one read', async () => {
		await insertTemplate(db, alice.id, { slug: 'best-movies' });
		await insertRankingEvents(db, 'best-movies', 4);
		await applyTemplateVote(db, alice.id, 'best-movies', 1);

		expect(await getTemplateStats(db)).toEqual({
			counts: { 'best-movies': 4 },
			votes: { 'best-movies': 1 },
		});
	});

	it('omits a counter that has fallen back to zero, so the maps match what a live aggregate returned', async () => {
		await insertRankingEvents(db, 'best-movies', 1);
		await db.prepare('DELETE FROM rankings').run();

		// The row survives the delete; the map must not report "0 ranked".
		expect(storedRows()).toHaveLength(1);
		expect(await getTemplateStats(db)).toEqual({ counts: {}, votes: {} });
	});

	it('does not leak the slugs of hidden templates through the public maps', async () => {
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

		const { counts } = await getTemplateStats(db);
		expect(counts).toEqual({ 'public-one': 1 });
	});

	it('gives the owner view every slug, hidden ones included', async () => {
		await insertTemplate(db, alice.id, {
			slug: 'private-one',
			visibility: 'private',
		});
		await insertRankingEvents(db, 'private-one', 2);

		const { counts } = await getTemplateStats(db, true);
		expect(counts).toEqual({ 'private-one': 2 });
	});

	it('excludes a hidden template even when the event row spells the slug differently', async () => {
		await insertTemplate(db, alice.id, {
			slug: 'Private-One',
			visibility: 'private',
		});
		await insertRankingEvents(db, 'private-one');

		expect((await getTemplateStats(db)).counts).toEqual({});
	});

	it('keeps counting official slugs, which have no templates row at all', async () => {
		await insertRankingEvents(db, 'all-star-wars-movies', 5);

		expect((await getTemplateStats(db)).counts).toEqual({
			'all-star-wars-movies': 5,
		});
	});
});

describe('getTemplateStat', () => {
	it('is zero for a slug nobody has touched', async () => {
		expect(await getTemplateStat(db, 'never-played', 'times_ranked')).toBe(0);
		expect(await getTemplateStat(db, 'never-played', 'votes')).toBe(0);
	});
});
