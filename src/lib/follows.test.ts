import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	getFollowCounts,
	isFollowing,
	listFollowers,
	listFollowing,
	listFollowingTemplates,
	setFollow,
} from './follows';
import { createTestDb, type TestD1 } from '../test/d1';
import {
	insertRankingEvents,
	insertTemplate,
	insertUser,
} from '../test/factories';

let db: TestD1;
let alice: { id: string; username: string };
let bob: { id: string; username: string };

beforeEach(async () => {
	db = createTestDb();
	alice = await insertUser(db, { username: 'alice' });
	bob = await insertUser(db, { username: 'bob', bio: 'I rank things' });
});
afterEach(() => {
	db.close();
});

describe('setFollow / isFollowing', () => {
	it('follows and unfollows', async () => {
		expect(await setFollow(db, alice.id, bob.id, true)).toBe(true);
		expect(await isFollowing(db, alice.id, bob.id)).toBe(true);

		expect(await setFollow(db, alice.id, bob.id, false)).toBe(false);
		expect(await isFollowing(db, alice.id, bob.id)).toBe(false);
	});

	it('is directional — following someone is not being followed', async () => {
		await setFollow(db, alice.id, bob.id, true);
		expect(await isFollowing(db, bob.id, alice.id)).toBe(false);
	});

	it('is idempotent, so a double tap does not duplicate the row', async () => {
		await setFollow(db, alice.id, bob.id, true);
		await setFollow(db, alice.id, bob.id, true);
		expect(await getFollowCounts(db, bob.id)).toEqual({
			followers: 1,
			following: 0,
		});
	});

	it('unfollowing someone you never followed is harmless', async () => {
		expect(await setFollow(db, alice.id, bob.id, false)).toBe(false);
	});

	it('refuses to let you follow yourself', async () => {
		expect(await setFollow(db, alice.id, alice.id, true)).toBe(false);
		expect(await isFollowing(db, alice.id, alice.id)).toBe(false);
	});
});

describe('getFollowCounts', () => {
	it('counts both directions separately', async () => {
		const carol = await insertUser(db, { username: 'carol' });
		await setFollow(db, alice.id, bob.id, true);
		await setFollow(db, carol.id, bob.id, true);
		await setFollow(db, bob.id, alice.id, true);

		expect(await getFollowCounts(db, bob.id)).toEqual({
			followers: 2,
			following: 1,
		});
	});

	it('is zero for a user nobody follows', async () => {
		expect(await getFollowCounts(db, alice.id)).toEqual({
			followers: 0,
			following: 0,
		});
	});

	it('drops the edges when an account is deleted', async () => {
		await setFollow(db, alice.id, bob.id, true);
		await db.prepare('DELETE FROM users WHERE id = ?').bind(alice.id).run();
		expect(await getFollowCounts(db, bob.id)).toEqual({
			followers: 0,
			following: 0,
		});
	});
});

describe('listFollowers / listFollowing', () => {
	it('returns the public profile summary, newest follow first', async () => {
		const carol = await insertUser(db, { username: 'carol' });
		await setFollow(db, alice.id, bob.id, true);
		await setFollow(db, carol.id, bob.id, true);
		await db
			.prepare(
				'UPDATE follows SET created_at = ? WHERE follower_id = ?'
			)
			.bind('2026-01-01T00:00:00.000Z', alice.id)
			.run();
		await db
			.prepare('UPDATE follows SET created_at = ? WHERE follower_id = ?')
			.bind('2026-02-01T00:00:00.000Z', carol.id)
			.run();

		expect((await listFollowers(db, bob.id)).map((u) => u.username)).toEqual([
			'carol',
			'alice',
		]);
		expect(await listFollowing(db, alice.id)).toEqual([
			{
				username: 'bob',
				avatar: 'star-purple',
				isVerified: false,
				bio: 'I rank things',
			},
		]);
	});

	it('honours the limit', async () => {
		const carol = await insertUser(db, { username: 'carol' });
		await setFollow(db, alice.id, bob.id, true);
		await setFollow(db, carol.id, bob.id, true);
		expect(await listFollowers(db, bob.id, 1)).toHaveLength(1);
	});

	it('is empty for someone with no follows', async () => {
		expect(await listFollowers(db, alice.id)).toEqual([]);
		expect(await listFollowing(db, alice.id)).toEqual([]);
	});
});

describe('listFollowingTemplates', () => {
	beforeEach(async () => {
		await setFollow(db, alice.id, bob.id, true);
	});

	it('shows public templates from the accounts you follow, newest first', async () => {
		await insertTemplate(db, bob.id, {
			slug: 'older',
			createdAt: '2026-01-01T00:00:00.000Z',
		});
		await insertTemplate(db, bob.id, {
			slug: 'newer',
			createdAt: '2026-02-01T00:00:00.000Z',
		});

		expect(
			(await listFollowingTemplates(db, alice.id)).map((t) => t.slug)
		).toEqual(['newer', 'older']);
	});

	it('ignores templates from accounts you do not follow', async () => {
		const carol = await insertUser(db, { username: 'carol' });
		await insertTemplate(db, carol.id, { slug: 'not-followed' });
		expect(await listFollowingTemplates(db, alice.id)).toEqual([]);
	});

	it('never surfaces a hidden template', async () => {
		await insertTemplate(db, bob.id, {
			slug: 'private-one',
			visibility: 'private',
		});
		await insertTemplate(db, bob.id, {
			slug: 'unlisted-one',
			visibility: 'unlisted',
		});
		expect(await listFollowingTemplates(db, alice.id)).toEqual([]);
	});

	it('hides mature templates unless the viewer opted in', async () => {
		await insertTemplate(db, bob.id, { slug: 'spicy', isMature: true });
		expect(await listFollowingTemplates(db, alice.id)).toEqual([]);
		expect(
			(await listFollowingTemplates(db, alice.id, 8, true)).map((t) => t.slug)
		).toEqual(['spicy']);
	});

	it('honours the limit', async () => {
		await insertTemplate(db, bob.id, {
			slug: 'a',
			createdAt: '2026-01-01T00:00:00.000Z',
		});
		await insertTemplate(db, bob.id, {
			slug: 'b',
			createdAt: '2026-02-01T00:00:00.000Z',
		});
		expect(await listFollowingTemplates(db, alice.id, 1)).toHaveLength(1);
	});

	it('merges the live ranking count and vote score onto the cards', async () => {
		await insertTemplate(db, bob.id, { slug: 'counted' });
		await insertRankingEvents(db, 'counted', 4);
		await db
			.prepare(
				`INSERT INTO votes (user_id, subject_type, subject_id, value)
				 VALUES (?, 'template', ?, 1)`
			)
			.bind(alice.id, 'counted')
			.run();

		const [template] = await listFollowingTemplates(db, alice.id);
		expect(template.times_ranked).toBe(4);
		expect(template.votes).toBe(1);
	});

	it('carries the creator’s profile so the card can credit them', async () => {
		await insertTemplate(db, bob.id, { slug: 'bobs' });
		const [template] = await listFollowingTemplates(db, alice.id);
		expect(template.creator.username).toBe('bob');
		expect(template.source).toBe('user');
	});
});
