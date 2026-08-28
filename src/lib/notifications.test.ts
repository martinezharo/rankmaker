import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	countUnread,
	dispatchNotification,
	getEmailPref,
	listNotifications,
	markAllRead,
	notifyNewTemplate,
	setEmailPref,
} from './notifications';
import { OFFICIAL_USER_ID } from './templates';
import { createTestDb, type TestD1 } from '../test/d1';
import { insertUser } from '../test/factories';

let db: TestD1;
let owner: { id: string; username: string };
let actor: { id: string; username: string };

beforeEach(async () => {
	db = createTestDb();
	owner = await insertUser(db, { username: 'owner' });
	actor = await insertUser(db, { username: 'actor' });
});
afterEach(() => {
	db.close();
	vi.unstubAllGlobals();
});

/** Env with email configured, plus a spy on the outbound Resend request. */
function withEmail() {
	const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
	vi.stubGlobal('fetch', fetchMock);
	return {
		env: {
			DB: db as unknown as D1Database,
			RESEND_API_KEY: 'test-key',
			RESEND_FROM: 'RANKMAKER <no-reply@rankmaker.net>',
			SITE_URL: 'https://rankmaker.net',
		},
		fetchMock,
	};
}

function sentEmail(fetchMock: ReturnType<typeof vi.fn>) {
	expect(fetchMock).toHaveBeenCalledTimes(1);
	const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
	expect(url).toBe('https://api.resend.com/emails');
	return JSON.parse(init.body as string);
}

describe('dispatchNotification', () => {
	it('records the notification and emails the recipient', async () => {
		await insertUser(db, { id: 'with-email', username: 'reader' });
		await db
			.prepare('UPDATE users SET email = ? WHERE id = ?')
			.bind('reader@example.test', 'with-email')
			.run();
		const { env, fetchMock } = withEmail();

		await dispatchNotification(env, undefined, {
			recipientId: 'with-email',
			actorId: actor.id,
			type: 'comment_on_template',
			slug: 'best-movies',
			title: 'Best Movies',
			commentId: 'c1',
		});

		const [item] = await listNotifications(db, 'with-email');
		expect(item.type).toBe('comment_on_template');
		expect(item.slug).toBe('best-movies');
		expect(item.title).toBe('Best Movies');
		expect(item.commentId).toBe('c1');
		expect(item.isRead).toBe(false);
		expect(item.actor.username).toBe('actor');

		const body = sentEmail(fetchMock);
		expect(body.to).toEqual(['reader@example.test']);
		expect(body.html).toContain(
			'https://rankmaker.net/template/best-movies'
		);
		expect(body.subject).toBe('New comment on your template');
		expect(body.html).toContain('actor');
		expect(body.html).toContain('Best Movies');
		expect(body.text).toContain('actor');
	});

	it('never notifies you about your own action', async () => {
		const { env, fetchMock } = withEmail();
		await dispatchNotification(env, undefined, {
			recipientId: actor.id,
			actorId: actor.id,
			type: 'comment_reply',
			slug: 'best-movies',
			title: 'Best Movies',
		});
		expect(await listNotifications(db, actor.id)).toEqual([]);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('never notifies the official account, which cannot log in', async () => {
		const { env } = withEmail();
		await dispatchNotification(env, undefined, {
			recipientId: OFFICIAL_USER_ID,
			actorId: actor.id,
			type: 'comment_on_template',
			slug: 'official-one',
			title: 'Official',
		});
		expect(await listNotifications(db, OFFICIAL_USER_ID)).toEqual([]);
	});

	it('ignores an empty recipient rather than writing a dangling row', async () => {
		const { env } = withEmail();
		await dispatchNotification(env, undefined, {
			recipientId: '',
			actorId: actor.id,
			type: 'comment_reply',
			slug: 'best-movies',
			title: 'Best Movies',
		});
		const row = await db.prepare('SELECT id FROM notifications').first();
		expect(row).toBeNull();
	});

	it('still records the notification when the recipient has no email', async () => {
		const { env, fetchMock } = withEmail();
		await dispatchNotification(env, undefined, {
			recipientId: owner.id,
			actorId: actor.id,
			type: 'comment_reply',
			slug: 'best-movies',
			title: 'Best Movies',
		});
		expect(await listNotifications(db, owner.id)).toHaveLength(1);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('respects the recipient’s email opt-out', async () => {
		await db
			.prepare('UPDATE users SET email = ? WHERE id = ?')
			.bind('owner@example.test', owner.id)
			.run();
		await setEmailPref(db, owner.id, false);
		const { env, fetchMock } = withEmail();

		await dispatchNotification(env, undefined, {
			recipientId: owner.id,
			actorId: actor.id,
			type: 'comment_reply',
			slug: 'best-movies',
			title: 'Best Movies',
		});

		expect(await listNotifications(db, owner.id)).toHaveLength(1);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('does not email for the low-priority new_template kind', async () => {
		await db
			.prepare('UPDATE users SET email = ? WHERE id = ?')
			.bind('owner@example.test', owner.id)
			.run();
		const { env, fetchMock } = withEmail();

		await dispatchNotification(env, undefined, {
			recipientId: owner.id,
			actorId: actor.id,
			type: 'new_template',
			slug: 'brand-new',
			title: 'Brand New',
		});

		expect(await listNotifications(db, owner.id)).toHaveLength(1);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('hands the email to waitUntil instead of blocking the response', async () => {
		await db
			.prepare('UPDATE users SET email = ? WHERE id = ?')
			.bind('owner@example.test', owner.id)
			.run();
		const { env, fetchMock } = withEmail();
		const pending: Promise<unknown>[] = [];

		await dispatchNotification(env, (p) => pending.push(p), {
			recipientId: owner.id,
			actorId: actor.id,
			type: 'comment_reply',
			slug: 'best-movies',
			title: 'Best Movies',
		});

		expect(pending).toHaveLength(1);
		await Promise.all(pending);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('percent-encodes the slug in the email link', async () => {
		await db
			.prepare('UPDATE users SET email = ? WHERE id = ?')
			.bind('owner@example.test', owner.id)
			.run();
		const { env, fetchMock } = withEmail();

		await dispatchNotification(env, undefined, {
			recipientId: owner.id,
			actorId: actor.id,
			type: 'comment_on_template',
			slug: 'a b/c',
			title: 'Odd slug',
		});

		expect(sentEmail(fetchMock).html).toContain('/template/a%20b%2Fc');
	});
});

describe('notifyNewTemplate', () => {
	it('notifies every follower in one go', async () => {
		const fanA = await insertUser(db, { username: 'fan-a' });
		const fanB = await insertUser(db, { username: 'fan-b' });
		for (const fan of [fanA, fanB]) {
			await db
				.prepare(
					'INSERT INTO follows (follower_id, following_id) VALUES (?, ?)'
				)
				.bind(fan.id, actor.id)
				.run();
		}

		await notifyNewTemplate(db, {
			creatorId: actor.id,
			slug: 'fresh',
			title: 'Fresh Ranking',
		});

		for (const fan of [fanA, fanB]) {
			const [item] = await listNotifications(db, fan.id);
			expect(item.type).toBe('new_template');
			expect(item.slug).toBe('fresh');
			expect(item.commentId).toBeNull();
		}
	});

	it('is a no-op when nobody follows the creator', async () => {
		await notifyNewTemplate(db, {
			creatorId: actor.id,
			slug: 'fresh',
			title: 'Fresh Ranking',
		});
		expect(await db.prepare('SELECT id FROM notifications').first()).toBeNull();
	});
});

describe('reading and clearing', () => {
	async function notify(recipientId: string, slug: string, createdAt: string) {
		await db
			.prepare(
				`INSERT INTO notifications
				   (id, user_id, type, actor_id, slug, title, created_at)
				 VALUES (?, ?, 'comment_reply', ?, ?, ?, ?)`
			)
			.bind(`n-${slug}-${recipientId}`, recipientId, actor.id, slug, slug, createdAt)
			.run();
	}

	it('lists newest first', async () => {
		await notify(owner.id, 'older', '2026-01-01T00:00:00.000Z');
		await notify(owner.id, 'newer', '2026-02-01T00:00:00.000Z');
		expect((await listNotifications(db, owner.id)).map((n) => n.slug)).toEqual(
			['newer', 'older']
		);
	});

	it('honours the limit', async () => {
		await notify(owner.id, 'a', '2026-01-01T00:00:00.000Z');
		await notify(owner.id, 'b', '2026-02-01T00:00:00.000Z');
		expect(await listNotifications(db, owner.id, 1)).toHaveLength(1);
	});

	it('never shows one user another user’s notifications', async () => {
		await notify(owner.id, 'mine', '2026-01-01T00:00:00.000Z');
		expect(await listNotifications(db, actor.id)).toEqual([]);
		expect(await countUnread(db, actor.id)).toBe(0);
	});

	it('counts unread and clears them for that user only', async () => {
		await notify(owner.id, 'one', '2026-01-01T00:00:00.000Z');
		await notify(actor.id, 'two', '2026-01-01T00:00:00.000Z');
		expect(await countUnread(db, owner.id)).toBe(1);

		await markAllRead(db, owner.id);

		expect(await countUnread(db, owner.id)).toBe(0);
		expect(await countUnread(db, actor.id)).toBe(1);
		expect((await listNotifications(db, owner.id))[0].isRead).toBe(true);
	});

	it('drops a user’s notifications when their account goes', async () => {
		await notify(owner.id, 'one', '2026-01-01T00:00:00.000Z');
		await db.prepare('DELETE FROM users WHERE id = ?').bind(owner.id).run();
		expect(await countUnread(db, owner.id)).toBe(0);
	});
});

describe('the email preference', () => {
	it('defaults to on', async () => {
		expect(await getEmailPref(db, owner.id)).toBe(true);
	});

	it('round-trips', async () => {
		await setEmailPref(db, owner.id, false);
		expect(await getEmailPref(db, owner.id)).toBe(false);
		await setEmailPref(db, owner.id, true);
		expect(await getEmailPref(db, owner.id)).toBe(true);
	});

	it('defaults to on for an unknown user rather than throwing', async () => {
		expect(await getEmailPref(db, 'nobody')).toBe(true);
	});
});
