import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	applyTemplateVote,
	getTemplateVoteScore,
	getTemplateVotes,
	getUserTemplateVote,
} from './template-votes';
import { createTestDb, type TestD1 } from '../test/d1';
import { insertTemplate, insertUser } from '../test/factories';

let db: TestD1;
let alice: { id: string; username: string };
let bob: { id: string; username: string };

beforeEach(async () => {
	db = createTestDb();
	alice = await insertUser(db, { username: 'alice' });
	bob = await insertUser(db, { username: 'bob' });
});
afterEach(() => {
	db.close();
});

describe('applyTemplateVote', () => {
	it('records an upvote and reports the fresh score', async () => {
		expect(await applyTemplateVote(db, alice.id, 'best-movies', 1)).toEqual({
			score: 1,
			myVote: 1,
		});
	});

	it('flips a vote rather than stacking it', async () => {
		await applyTemplateVote(db, alice.id, 'best-movies', 1);
		expect(await applyTemplateVote(db, alice.id, 'best-movies', -1)).toEqual({
			score: -1,
			myVote: -1,
		});
	});

	it('clears a vote with 0', async () => {
		await applyTemplateVote(db, alice.id, 'best-movies', 1);
		expect(await applyTemplateVote(db, alice.id, 'best-movies', 0)).toEqual({
			score: 0,
			myVote: 0,
		});
		expect(await getUserTemplateVote(db, alice.id, 'best-movies')).toBe(0);
	});

	it('sums one vote per user', async () => {
		await applyTemplateVote(db, alice.id, 'best-movies', 1);
		expect(await applyTemplateVote(db, bob.id, 'best-movies', 1)).toEqual({
			score: 2,
			myVote: 1,
		});
	});

	it('collapses a legacy case-variant vote into the canonical row', async () => {
		await applyTemplateVote(db, alice.id, 'Best-Movies', 1);
		await applyTemplateVote(db, alice.id, 'best-movies', -1);

		const { results } = await db
			.prepare(
				`SELECT subject_id, value FROM votes
				 WHERE user_id = ? AND subject_type = 'template'`
			)
			.bind(alice.id)
			.all<{ subject_id: string; value: number }>();
		expect(results).toEqual([{ subject_id: 'best-movies', value: -1 }]);
		expect(await getTemplateVoteScore(db, 'best-movies')).toBe(-1);
	});

	it('keeps one user’s vote from clearing another’s', async () => {
		await applyTemplateVote(db, alice.id, 'best-movies', 1);
		await applyTemplateVote(db, bob.id, 'best-movies', 1);
		await applyTemplateVote(db, alice.id, 'best-movies', 0);
		expect(await getTemplateVoteScore(db, 'best-movies')).toBe(1);
	});
});

describe('getUserTemplateVote', () => {
	it('reads the caller’s own vote, ignoring slug casing', async () => {
		await applyTemplateVote(db, alice.id, 'best-movies', -1);
		expect(await getUserTemplateVote(db, alice.id, 'BEST-MOVIES')).toBe(-1);
	});

	it('is 0 when the user has not voted', async () => {
		expect(await getUserTemplateVote(db, bob.id, 'best-movies')).toBe(0);
	});
});

describe('getTemplateVoteScore', () => {
	it('is 0 for a template nobody voted on', async () => {
		expect(await getTemplateVoteScore(db, 'untouched')).toBe(0);
	});

	it('nets upvotes against downvotes', async () => {
		const carol = await insertUser(db, { username: 'carol' });
		await applyTemplateVote(db, alice.id, 'best-movies', 1);
		await applyTemplateVote(db, bob.id, 'best-movies', 1);
		await applyTemplateVote(db, carol.id, 'best-movies', -1);
		expect(await getTemplateVoteScore(db, 'best-movies')).toBe(1);
	});
});

describe('getTemplateVotes', () => {
	it('keys every score by the lowercased slug', async () => {
		await applyTemplateVote(db, alice.id, 'Best-Movies', 1);
		await applyTemplateVote(db, bob.id, 'best-games', -1);

		expect(await getTemplateVotes(db)).toEqual({
			'best-movies': 1,
			'best-games': -1,
		});
	});

	it('ignores comment votes, which share the table', async () => {
		await db
			.prepare(
				`INSERT INTO votes (user_id, subject_type, subject_id, value)
				 VALUES (?, 'comment', 'c1', 1)`
			)
			.bind(alice.id)
			.run();
		expect(await getTemplateVotes(db)).toEqual({});
	});

	it('does not leak hidden template slugs through the public map', async () => {
		await insertTemplate(db, alice.id, {
			slug: 'private-one',
			visibility: 'private',
		});
		await applyTemplateVote(db, bob.id, 'private-one', 1);

		expect(await getTemplateVotes(db)).toEqual({});
		expect(await getTemplateVotes(db, true)).toEqual({ 'private-one': 1 });
	});

	it('drops a user’s votes with their account', async () => {
		await applyTemplateVote(db, alice.id, 'best-movies', 1);
		await db.prepare('DELETE FROM users WHERE id = ?').bind(alice.id).run();
		expect(await getTemplateVotes(db)).toEqual({});
	});
});
