import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../../src/pages/api/templates/index';
import { MAX_TEMPLATES_PER_USER } from '../../../src/lib/template-limits';
import { listNotifications } from '../../../src/lib/notifications';
import { getOfficialTemplates } from '../../../src/lib/templates';
import { createTestDb, type TestD1 } from '../../../src/test/d1';
import { apiContext } from '../../../src/test/api';
import {
	insertImage,
	insertTemplate,
	insertUser,
	signIn,
} from '../../../src/test/factories';

const IMAGE_BASE = 'https://img.test';
const uploaded = (n: number) => `u/user-1/aaaaaaaaaaaaaaaa${n}.webp`;
const uploadedUrl = (n: number) => `${IMAGE_BASE}/${uploaded(n)}`;

let db: TestD1;
let alice: { id: string; username: string };

beforeEach(async () => {
	db = createTestDb();
	alice = await insertUser(db, { username: 'alice' });
});
afterEach(() => {
	db.close();
});

const body = (overrides: Record<string, unknown> = {}) => ({
	title: 'My Brand New Ranking',
	description: 'A description that is long enough to pass.',
	category: 'Movies',
	cover_image: uploadedUrl(0),
	visibility: 'public',
	options: [
		{ name: 'One', image: null },
		{ name: 'Two', image: null },
		{ name: 'Three', image: null },
		{ name: 'Four', image: null },
	],
	...overrides,
});

const post = (
	payload: unknown,
	options: { cookies?: Record<string, string>; origin?: string | null } = {}
) =>
	POST(
		apiContext({
			db,
			path: '/api/templates',
			body: payload,
			cookies: options.cookies ?? {},
			origin: options.origin,
			env: { IMAGES_PUBLIC_BASE: IMAGE_BASE },
		}) as never
	);

/** The cover the default body references has to be an upload alice owns. */
async function ownCover() {
	await insertImage(db, alice.id, uploaded(0));
	return signIn(db, alice.id);
}

describe('POST /api/templates', () => {
	it('creates a template with its options in order', async () => {
		const response = await post(body(), { cookies: await ownCover() });
		expect(response.status).toBe(200);
		const { id, slug } = (await response.json()) as any;
		expect(slug).toBe('my-brand-new-ranking');

		const row = await db
			.prepare('SELECT creator_id, visibility FROM templates WHERE id = ?')
			.bind(id)
			.first<{ creator_id: string; visibility: string }>();
		expect(row).toEqual({ creator_id: alice.id, visibility: 'public' });

		const { results } = await db
			.prepare(
				'SELECT name FROM template_options WHERE template_id = ? ORDER BY position'
			)
			.bind(id)
			.all<{ name: string }>();
		expect(results.map((r) => r.name)).toEqual([
			'One',
			'Two',
			'Three',
			'Four',
		]);
	});

	it('reuses a guest import when the browser retries the same local id', async () => {
		const cookies = await signIn(db, alice.id);
		const payload = body({
			source_local_id: 'local-draft-123',
			description: '',
			category: 'Movies',
			cover_image: '',
			visibility: 'private',
		});

		const first = (await (await post(payload, { cookies })).json()) as any;
		const second = (await (await post(payload, { cookies })).json()) as any;

		expect(second).toMatchObject({
			ok: true,
			id: first.id,
			slug: first.slug,
			reused: true,
		});
		expect(first.id).toMatch(/^local-[a-f0-9]{64}$/);
		expect(
			(await db.prepare('SELECT COUNT(*) AS n FROM templates').first<{ n: number }>())
				?.n
		).toBe(1);
		expect(
			(
				await db
					.prepare('SELECT COUNT(*) AS n FROM template_options')
					.first<{ n: number }>()
			)?.n
		).toBe(4);
	});

	it('creates one template and one option set for concurrent guest import retries', async () => {
		const cookies = await signIn(db, alice.id);
		const payload = body({
			source_local_id: 'concurrent-local-draft',
			description: '',
			category: 'Movies',
			cover_image: '',
			visibility: 'private',
		});

		const responses = await Promise.all([
			post(payload, { cookies }),
			post(payload, { cookies }),
		]);
		expect(responses.every((response) => response.ok)).toBe(true);
		expect(
			(await db.prepare('SELECT COUNT(*) AS n FROM templates').first<{ n: number }>())
				?.n
		).toBe(1);
		expect(
			(
				await db
					.prepare('SELECT COUNT(*) AS n FROM template_options')
					.first<{ n: number }>()
			)?.n
		).toBe(4);
	});

	it('reserves local import ids for private text-only templates', async () => {
		const cookies = await ownCover();
		for (const payload of [
			body({ source_local_id: 'bad id' }),
			body({ source_local_id: 'local-draft-123' }),
		]) {
			expect((await post(payload, { cookies })).status).toBe(400);
		}
		expect(await db.prepare('SELECT id FROM templates').first()).toBeNull();
	});

	it('rejects a cross-site request', async () => {
		const response = await post(body(), {
			cookies: await ownCover(),
			origin: null,
		});
		expect(response.status).toBe(403);
		expect(await db.prepare('SELECT id FROM templates').first()).toBeNull();
	});

	it('requires a session', async () => {
		expect((await post(body())).status).toBe(401);
	});

	it('rejects invalid JSON', async () => {
		expect((await post('not json', { cookies: await ownCover() })).status).toBe(
			400
		);
	});

	it('rejects an invalid payload without creating anything', async () => {
		const response = await post(body({ title: 'no' }), {
			cookies: await ownCover(),
		});
		expect(response.status).toBe(400);
		expect(await db.prepare('SELECT id FROM templates').first()).toBeNull();
	});

	it('refuses to reference an upload owned by someone else', async () => {
		const bob = await insertUser(db, { username: 'bob' });
		await insertImage(db, bob.id, uploaded(0));

		const response = await post(body(), {
			cookies: await signIn(db, alice.id),
		});
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'Invalid image.' });
	});

	it('claims the uploads the new template references', async () => {
		const response = await post(body(), { cookies: await ownCover() });
		const { id } = (await response.json()) as any;

		const row = await db
			.prepare('SELECT template_id FROM images WHERE key = ?')
			.bind(uploaded(0))
			.first<{ template_id: string }>();
		expect(row?.template_id).toBe(id);
	});

	it('suffixes a slug that is already taken', async () => {
		await insertTemplate(db, alice.id, { slug: 'my-brand-new-ranking' });
		const response = await post(body(), { cookies: await ownCover() });
		expect(((await response.json()) as any).slug).toBe(
			'my-brand-new-ranking-2'
		);
	});

	it('never collides with an official slug', async () => {
		const official = getOfficialTemplates()[0];
		const response = await post(body({ title: official.title }), {
			cookies: await ownCover(),
		});
		expect(((await response.json()) as any).slug).not.toBe(official.slug);
	});

	it('gives an unlisted template an unguessable slug', async () => {
		const response = await post(
			body({ visibility: 'unlisted' }),
			{ cookies: await ownCover() }
		);
		expect(((await response.json()) as any).slug).toMatch(
			/^my-brand-new-ranking-[a-z0-9]{12}$/
		);
	});

	it('enforces the per-user template limit', async () => {
		for (let i = 0; i < MAX_TEMPLATES_PER_USER; i++) {
			await insertTemplate(db, alice.id, { slug: `existing-${i}` });
		}
		const response = await post(body(), { cookies: await ownCover() });
		expect(response.status).toBe(403);
		expect(((await response.json()) as any).error).toMatch(/at most/);
	});

	it('counts only the caller’s own templates against the limit', async () => {
		const bob = await insertUser(db, { username: 'bob' });
		for (let i = 0; i < MAX_TEMPLATES_PER_USER; i++) {
			await insertTemplate(db, bob.id, { slug: `bobs-${i}` });
		}
		expect((await post(body(), { cookies: await ownCover() })).status).toBe(
			200
		);
	});

	it('tells the creator’s followers about a new public template', async () => {
		const fan = await insertUser(db, { username: 'fan' });
		await db
			.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)')
			.bind(fan.id, alice.id)
			.run();

		await post(body(), { cookies: await ownCover() });

		const [notification] = await listNotifications(db, fan.id);
		expect(notification.type).toBe('new_template');
		expect(notification.slug).toBe('my-brand-new-ranking');
	});

	it('stays quiet about a hidden template, which would leak it', async () => {
		const fan = await insertUser(db, { username: 'fan' });
		await db
			.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)')
			.bind(fan.id, alice.id)
			.run();

		const cookies = await ownCover();
		for (const visibility of ['private', 'unlisted']) {
			await post(body({ visibility }), { cookies });
		}
		expect(await listNotifications(db, fan.id)).toEqual([]);
	});

	it('stores the creator’s mature flag', async () => {
		const response = await post(body({ is_mature: true }), {
			cookies: await ownCover(),
		});
		const { id } = (await response.json()) as any;
		const row = await db
			.prepare('SELECT is_mature, mature_locked FROM templates WHERE id = ?')
			.bind(id)
			.first<{ is_mature: number; mature_locked: number }>();
		expect(row).toEqual({ is_mature: 1, mature_locked: 0 });
	});
});
