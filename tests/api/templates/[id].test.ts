import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DELETE, PUT } from '../../../src/pages/api/templates/[id]';
import { createTestDb, type TestD1 } from '../../../src/test/d1';
import { apiContext, fakeBucket } from '../../../src/test/api';
import {
	insertImage,
	insertRankingEvents,
	insertTemplate,
	insertUser,
	signIn,
} from '../../../src/test/factories';

const IMAGE_BASE = 'https://img.test';
const uploaded = (n: number) => `u/user-1/aaaaaaaaaaaaaaaa${n}.webp`;
const uploadedUrl = (n: number) => `${IMAGE_BASE}/${uploaded(n)}`;
/**
 * A cover from the external-link era. The template already stores it, so it
 * stays valid on edit and contributes no upload key — which keeps the tests
 * that are not about images free of image bookkeeping.
 */
const LEGACY_COVER = 'https://legacy.test/old-cover.jpg';

let db: TestD1;
let alice: { id: string; username: string };
let bob: { id: string; username: string };
let bucket: ReturnType<typeof fakeBucket>;

beforeEach(async () => {
	db = createTestDb();
	bucket = fakeBucket();
	alice = await insertUser(db, { username: 'alice' });
	bob = await insertUser(db, { username: 'bob' });
});
afterEach(() => {
	db.close();
});

function context(options: {
	id: string;
	method: string;
	body?: unknown;
	cookies?: Record<string, string>;
	origin?: string | null;
}) {
	return apiContext({
		db,
		path: `/api/templates/${options.id}`,
		method: options.method,
		params: { id: options.id },
		body: options.body,
		cookies: options.cookies ?? {},
		origin: options.origin,
		env: {
			IMAGES_BUCKET: bucket.bucket,
			IMAGES_PUBLIC_BASE: IMAGE_BASE,
		},
	}) as never;
}

const validBody = (overrides: Record<string, unknown> = {}) => ({
	title: 'An Edited Title',
	description: 'A description that is long enough to pass.',
	category: 'Movies',
	cover_image: LEGACY_COVER,
	visibility: 'public',
	options: [
		{ name: 'One', image: null },
		{ name: 'Two', image: null },
		{ name: 'Three', image: null },
		{ name: 'Four', image: null },
	],
	...overrides,
});

/** A public template owned by `alice`, with a cover so it validates. */
async function alicesTemplate(
	overrides: Parameters<typeof insertTemplate>[2] = {}
) {
	return insertTemplate(db, alice.id, {
		slug: 'alices-ranking',
		coverImage: LEGACY_COVER,
		...overrides,
	});
}

describe('PUT /api/templates/:id — authorization', () => {
	it('rejects a cross-site request', async () => {
		const template = await alicesTemplate();
		const response = await PUT(
			context({
				id: template.id,
				method: 'PUT',
				body: validBody(),
				cookies: await signIn(db, alice.id),
				origin: null,
			})
		);
		expect(response.status).toBe(403);
	});

	it('requires a session', async () => {
		const template = await alicesTemplate();
		const response = await PUT(
			context({ id: template.id, method: 'PUT', body: validBody() })
		);
		expect(response.status).toBe(401);
	});

	it('refuses to edit someone else’s template', async () => {
		const template = await alicesTemplate();
		const response = await PUT(
			context({
				id: template.id,
				method: 'PUT',
				body: validBody({ title: 'Hijacked Title' }),
				cookies: await signIn(db, bob.id),
			})
		);
		expect(response.status).toBe(403);

		const row = await db
			.prepare('SELECT title FROM templates WHERE id = ?')
			.bind(template.id)
			.first<{ title: string }>();
		expect(row?.title).not.toBe('Hijacked Title');
	});

	it('answers the same way for a template that does not exist', async () => {
		const response = await PUT(
			context({
				id: 'no-such-template',
				method: 'PUT',
				body: validBody(),
				cookies: await signIn(db, bob.id),
			})
		);
		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({ error: 'Template not found.' });
	});
});

describe('PUT /api/templates/:id — the edit itself', () => {
	it('applies the new fields and replaces the options in order', async () => {
		const template = await alicesTemplate();
		const response = await PUT(
			context({
				id: template.id,
				method: 'PUT',
				body: validBody({ title: 'Brand New Title', category: 'Games' }),
				cookies: await signIn(db, alice.id),
			})
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			ok: true,
			slug: 'alices-ranking',
		});

		const row = await db
			.prepare('SELECT title, category FROM templates WHERE id = ?')
			.bind(template.id)
			.first<{ title: string; category: string }>();
		expect(row).toEqual({ title: 'Brand New Title', category: 'Games' });

		const { results } = await db
			.prepare(
				'SELECT name, position FROM template_options WHERE template_id = ? ORDER BY position'
			)
			.bind(template.id)
			.all<{ name: string; position: number }>();
		expect(results.map((r) => r.name)).toEqual([
			'One',
			'Two',
			'Three',
			'Four',
		]);
	});

	it('keeps the slug stable, so share links and counts survive an edit', async () => {
		const template = await alicesTemplate();
		await PUT(
			context({
				id: template.id,
				method: 'PUT',
				body: validBody({ title: 'A Completely Different Title' }),
				cookies: await signIn(db, alice.id),
			})
		);
		const row = await db
			.prepare('SELECT slug FROM templates WHERE id = ?')
			.bind(template.id)
			.first<{ slug: string }>();
		expect(row?.slug).toBe('alices-ranking');
	});

	it('rejects an invalid payload without changing anything', async () => {
		const template = await alicesTemplate();
		const response = await PUT(
			context({
				id: template.id,
				method: 'PUT',
				body: validBody({ title: 'no' }),
				cookies: await signIn(db, alice.id),
			})
		);
		expect(response.status).toBe(400);

		const { results } = await db
			.prepare('SELECT name FROM template_options WHERE template_id = ?')
			.bind(template.id)
			.all();
		expect(results).toHaveLength(2); // the factory's originals, untouched
	});

	it('rejects invalid JSON', async () => {
		const template = await alicesTemplate();
		const response = await PUT(
			context({
				id: template.id,
				method: 'PUT',
				body: 'not json',
				cookies: await signIn(db, alice.id),
			})
		);
		expect(response.status).toBe(400);
	});

	it('refuses to reference an upload owned by someone else', async () => {
		const template = await alicesTemplate();
		await insertImage(db, bob.id, uploaded(7));

		const response = await PUT(
			context({
				id: template.id,
				method: 'PUT',
				body: validBody({ cover_image: uploadedUrl(7) }),
				cookies: await signIn(db, alice.id),
			})
		);
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'Invalid image.' });
	});

	it('claims the uploads it now references', async () => {
		const template = await alicesTemplate();
		await insertImage(db, alice.id, uploaded(7));

		await PUT(
			context({
				id: template.id,
				method: 'PUT',
				body: validBody({ cover_image: uploadedUrl(7) }),
				cookies: await signIn(db, alice.id),
			})
		);

		const row = await db
			.prepare('SELECT template_id FROM images WHERE key = ?')
			.bind(uploaded(7))
			.first<{ template_id: string }>();
		expect(row?.template_id).toBe(template.id);
	});

	it('deletes the uploads the edit dropped, from R2 and D1', async () => {
		const template = await alicesTemplate();
		await insertImage(db, alice.id, uploaded(1), template.id);
		await insertImage(db, alice.id, uploaded(2), template.id);
		bucket.objects.add(uploaded(1));
		bucket.objects.add(uploaded(2));

		await PUT(
			context({
				id: template.id,
				method: 'PUT',
				body: validBody({ cover_image: uploadedUrl(1) }),
				cookies: await signIn(db, alice.id),
			})
		);

		expect(bucket.objects.has(uploaded(1))).toBe(true);
		expect(bucket.objects.has(uploaded(2))).toBe(false);
		expect(
			await db
				.prepare('SELECT key FROM images WHERE key = ?')
				.bind(uploaded(2))
				.first()
		).toBeNull();
	});

	it('grandfathers an image URL the template already stored', async () => {
		const template = await alicesTemplate({ coverImage: LEGACY_COVER });

		const response = await PUT(
			context({
				id: template.id,
				method: 'PUT',
				body: validBody({ cover_image: LEGACY_COVER }),
				cookies: await signIn(db, alice.id),
			})
		);
		expect(response.status).toBe(200);
	});

	it('rejects an image URL from a host we never served', async () => {
		const template = await alicesTemplate();
		const response = await PUT(
			context({
				id: template.id,
				method: 'PUT',
				body: validBody({ cover_image: 'https://evil.test/pic.webp' }),
				cookies: await signIn(db, alice.id),
			})
		);
		expect(response.status).toBe(400);
	});
});

describe('PUT /api/templates/:id — the mature flag', () => {
	it('lets the creator flag their own template', async () => {
		const template = await alicesTemplate();
		await PUT(
			context({
				id: template.id,
				method: 'PUT',
				body: validBody({ is_mature: true }),
				cookies: await signIn(db, alice.id),
			})
		);
		const row = await db
			.prepare('SELECT is_mature FROM templates WHERE id = ?')
			.bind(template.id)
			.first<{ is_mature: number }>();
		expect(row?.is_mature).toBe(1);
	});

	it('refuses to let the creator un-flag what an admin decided', async () => {
		const template = await alicesTemplate({
			isMature: true,
			matureLocked: true,
		});
		const response = await PUT(
			context({
				id: template.id,
				method: 'PUT',
				body: validBody({ is_mature: false }),
				cookies: await signIn(db, alice.id),
			})
		);
		expect(response.status).toBe(200);

		const row = await db
			.prepare('SELECT is_mature FROM templates WHERE id = ?')
			.bind(template.id)
			.first<{ is_mature: number }>();
		expect(row?.is_mature).toBe(1);
	});
});

describe('PUT /api/templates/:id — going unlisted', () => {
	it('issues a fresh unguessable slug, because the old one is public knowledge', async () => {
		const template = await alicesTemplate();
		const response = await PUT(
			context({
				id: template.id,
				method: 'PUT',
				body: validBody({ visibility: 'unlisted' }),
				cookies: await signIn(db, alice.id),
			})
		);
		const { slug } = (await response.json()) as { slug: string };
		expect(slug).not.toBe('alices-ranking');
		expect(slug).toMatch(/-[a-z0-9]{12}$/);
	});

	it('moves every slug-keyed record with it, so nothing links to a dead URL', async () => {
		const template = await alicesTemplate();
		await insertRankingEvents(db, 'alices-ranking', 2);
		await db
			.prepare(
				`INSERT INTO ranking_results (user_id, slug, title, result)
				 VALUES (?, 'alices-ranking', 'T', '[]')`
			)
			.bind(bob.id)
			.run();
		await db
			.prepare(
				`INSERT INTO comments (id, slug, user_id, body)
				 VALUES ('c1', 'alices-ranking', ?, 'Nice')`
			)
			.bind(bob.id)
			.run();
		await db
			.prepare(
				`INSERT INTO template_saves (user_id, slug) VALUES (?, 'alices-ranking')`
			)
			.bind(bob.id)
			.run();
		await db
			.prepare(
				`INSERT INTO votes (user_id, subject_type, subject_id, value)
				 VALUES (?, 'template', 'alices-ranking', 1)`
			)
			.bind(bob.id)
			.run();
		await db
			.prepare(
				`INSERT INTO notifications (id, user_id, type, actor_id, slug, title)
				 VALUES ('n1', ?, 'new_template', ?, 'alices-ranking', 'T')`
			)
			.bind(bob.id, alice.id)
			.run();

		const response = await PUT(
			context({
				id: template.id,
				method: 'PUT',
				body: validBody({ visibility: 'unlisted' }),
				cookies: await signIn(db, alice.id),
			})
		);
		const { slug } = (await response.json()) as { slug: string };

		for (const [table, column] of [
			['rankings', 'slug'],
			['ranking_results', 'slug'],
			['comments', 'slug'],
			['template_saves', 'slug'],
			['notifications', 'slug'],
			['votes', 'subject_id'],
		] as const) {
			const { results } = await db
				.prepare(`SELECT ${column} AS value FROM ${table}`)
				.all<{ value: string }>();
			expect(
				results.map((r) => r.value),
				`${table}.${column}`
			).toEqual(results.map(() => slug));
		}
	});

	it('does not re-roll the slug on a later edit that stays unlisted', async () => {
		const template = await alicesTemplate({ visibility: 'unlisted' });
		const response = await PUT(
			context({
				id: template.id,
				method: 'PUT',
				body: validBody({ visibility: 'unlisted' }),
				cookies: await signIn(db, alice.id),
			})
		);
		expect(await response.json()).toEqual({
			ok: true,
			slug: 'alices-ranking',
		});
	});
});

describe('DELETE /api/templates/:id', () => {
	it('deletes the template and cascades its options', async () => {
		const template = await alicesTemplate();
		const response = await DELETE(
			context({
				id: template.id,
				method: 'DELETE',
				cookies: await signIn(db, alice.id),
			})
		);
		expect(response.status).toBe(200);
		expect(
			await db
				.prepare('SELECT id FROM templates WHERE id = ?')
				.bind(template.id)
				.first()
		).toBeNull();
		expect(
			await db
				.prepare('SELECT id FROM template_options WHERE template_id = ?')
				.bind(template.id)
				.first()
		).toBeNull();
	});

	it('refuses to delete someone else’s template', async () => {
		const template = await alicesTemplate();
		const response = await DELETE(
			context({
				id: template.id,
				method: 'DELETE',
				cookies: await signIn(db, bob.id),
			})
		);
		expect(response.status).toBe(403);
		expect(
			await db
				.prepare('SELECT id FROM templates WHERE id = ?')
				.bind(template.id)
				.first()
		).not.toBeNull();
	});

	it('rejects a cross-site delete', async () => {
		const template = await alicesTemplate();
		const response = await DELETE(
			context({
				id: template.id,
				method: 'DELETE',
				cookies: await signIn(db, alice.id),
				origin: null,
			})
		);
		expect(response.status).toBe(403);
	});

	it('requires a session', async () => {
		const template = await alicesTemplate();
		expect(
			(await DELETE(context({ id: template.id, method: 'DELETE' }))).status
		).toBe(401);
	});

	it('takes the uploaded images with it, before the row is gone', async () => {
		const template = await alicesTemplate();
		await insertImage(db, alice.id, uploaded(1), template.id);
		bucket.objects.add(uploaded(1));

		await DELETE(
			context({
				id: template.id,
				method: 'DELETE',
				cookies: await signIn(db, alice.id),
			})
		);

		expect(bucket.objects.has(uploaded(1))).toBe(false);
		expect(await db.prepare('SELECT key FROM images').first()).toBeNull();
	});
});
