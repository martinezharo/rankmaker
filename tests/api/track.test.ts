import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../src/pages/api/track';
import { getCounts } from '../../src/lib/counts';
import { getOfficialTemplates } from '../../src/lib/templates';
import { createTestDb, type TestD1 } from '../../src/test/d1';
import { apiContext, fakeKv, TEST_ORIGIN } from '../../src/test/api';
import { insertTemplate, insertUser, signIn } from '../../src/test/factories';

let db: TestD1;
let kv: ReturnType<typeof fakeKv>;
let alice: { id: string; username: string };

beforeEach(async () => {
	db = createTestDb();
	kv = fakeKv();
	alice = await insertUser(db, { username: 'alice' });
	await insertTemplate(db, alice.id, { slug: 'best-movies' });
});
afterEach(() => {
	db.close();
});

const track = (
	body: unknown,
	options: { cookies?: Record<string, string>; origin?: string | null } = {}
) =>
	POST(
		apiContext({
			db,
			path: '/api/track',
			body,
			cookies: options.cookies ?? {},
			origin: options.origin,
			env: { 'rm-times-ranked': kv.kv },
		}) as never
	);

const url = (slug: string) => `${TEST_ORIGIN}/template/${slug}`;

describe('POST /api/track', () => {
	it('records a ranking event for a real template', async () => {
		const response = await track({ url: url('best-movies') });
		expect(response.status).toBe(200);
		expect(await getCounts(db)).toEqual({ 'best-movies': 1 });
	});

	it('records events for official templates too', async () => {
		const official = getOfficialTemplates()[0];
		await track({ url: url(official.slug) });
		expect(await getCounts(db)).toEqual({ [official.slug]: 1 });
	});

	it('rejects a cross-site request — counts drive the public ordering', async () => {
		const response = await track({ url: url('best-movies') }, { origin: null });
		expect(response.status).toBe(403);
		expect(await getCounts(db)).toEqual({});
	});

	it('skips an invented slug instead of inflating the counts', async () => {
		const response = await track({ url: url('not-a-real-template') });
		expect(await response.json()).toEqual({ ok: true, skipped: true });
		expect(await getCounts(db)).toEqual({});
	});

	it('skips a URL it cannot read a slug out of', async () => {
		for (const value of ['', 'not-a-url', TEST_ORIGIN + '/']) {
			const response = await track({ url: value });
			expect(await response.json()).toEqual({ ok: true, skipped: true });
		}
		expect(await getCounts(db)).toEqual({});
	});

	it('normalizes the slug so case variants do not split the count', async () => {
		await track({ url: url('BEST-MOVIES') });
		await track({ url: url('best-movies') });
		const row = await db
			.prepare('SELECT DISTINCT slug FROM rankings')
			.all<{ slug: string }>();
		expect(row.results).toEqual([{ slug: 'best-movies' }]);
	});

	it('attributes the play to the signed-in user, and nobody when anonymous', async () => {
		await track({ url: url('best-movies') }, { cookies: await signIn(db, alice.id) });
		await track({ url: url('best-movies') });

		const { results } = await db
			.prepare('SELECT user_id FROM rankings ORDER BY id')
			.all<{ user_id: string | null }>();
		expect(results).toEqual([{ user_id: alice.id }, { user_id: null }]);
	});

	it('keeps a copy of the raw event in KV', async () => {
		await track({ url: url('best-movies'), date: '2026-08-28T00:00:00.000Z' });
		expect(kv.store.size).toBe(1);
		const [value] = [...kv.store.values()];
		expect(JSON.parse(value)).toMatchObject({
			url: url('best-movies'),
			date: '2026-08-28T00:00:00.000Z',
		});
	});

	it('truncates an oversized url and date rather than storing them', async () => {
		await track({
			url: `${url('best-movies')}?${'x'.repeat(1000)}`,
			date: 'y'.repeat(200),
		});
		const row = await db
			.prepare('SELECT url, date FROM rankings')
			.first<{ url: string; date: string }>();
		expect(row!.url.length).toBe(512);
		expect(row!.date.length).toBe(40);
	});

	it('rejects invalid JSON', async () => {
		expect((await track('not json')).status).toBe(400);
	});

	it('defaults the date when the client omits it', async () => {
		await track({ url: url('best-movies') });
		const row = await db
			.prepare('SELECT date FROM rankings')
			.first<{ date: string }>();
		expect(Number.isNaN(Date.parse(row!.date))).toBe(false);
	});
});
