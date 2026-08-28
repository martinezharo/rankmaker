import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET, POST } from '../../../src/pages/api/me/history';
import { getOfficialTemplates } from '../../../src/lib/templates';
import { createTestDb, type TestD1 } from '../../../src/test/d1';
import { apiContext } from '../../../src/test/api';
import {
	insertRankingEvents,
	insertTemplate,
	insertUser,
	signIn,
} from '../../../src/test/factories';

let db: TestD1;
let alice: { id: string; username: string };
let bob: { id: string; username: string };

/** A template with four options, so a result has something to be ranked from. */
const OPTIONS = [
	{ name: 'One' },
	{ name: 'Two' },
	{ name: 'Three' },
	{ name: 'Four' },
];

beforeEach(async () => {
	db = createTestDb();
	alice = await insertUser(db, { username: 'alice' });
	bob = await insertUser(db, { username: 'bob' });
	await insertTemplate(db, alice.id, {
		slug: 'best-movies',
		title: 'Best Movies',
		options: OPTIONS,
	});
});
afterEach(() => {
	db.close();
});

/** The option ids the factory generated for a template, in position order. */
async function optionIds(slug: string): Promise<number[]> {
	const { results } = await db
		.prepare(
			`SELECT o.id FROM template_options o
			 JOIN templates t ON t.id = o.template_id
			 WHERE t.slug = ? ORDER BY o.position`
		)
		.bind(slug)
		.all<{ id: number }>();
	return results.map((r) => r.id);
}

const post = (
	body: unknown,
	options: { cookies?: Record<string, string>; origin?: string | null } = {}
) =>
	POST(
		apiContext({
			db,
			path: '/api/me/history',
			body,
			cookies: options.cookies ?? {},
			origin: options.origin,
		}) as never
	);

const get = (slug: string | null, cookies: Record<string, string> = {}) =>
	GET(
		apiContext({
			db,
			method: 'GET',
			path: slug
				? `/api/me/history?slug=${encodeURIComponent(slug)}`
				: '/api/me/history',
			cookies,
		}) as never
	);

describe('POST /api/me/history', () => {
	it('saves a completed ranking, rebuilt from canonical template data', async () => {
		const ids = await optionIds('best-movies');
		const response = await post(
			{
				slug: 'best-movies',
				result: [{ id: ids[2], name: 'spoofed' }, { id: ids[0] }],
			},
			{ cookies: await signIn(db, alice.id) }
		);
		expect(response.status).toBe(200);

		const { entry } = (await response.json()) as any;
		expect(entry.slug).toBe('best-movies');
		expect(entry.title).toBe('Best Movies');
		// Names come from the template, never from the client's payload.
		expect(entry.result.map((r: any) => r.name)).toEqual(['Three', 'One']);
	});

	it('overwrites the previous result when the user re-ranks', async () => {
		const ids = await optionIds('best-movies');
		const cookies = await signIn(db, alice.id);
		await post({ slug: 'best-movies', result: [{ id: ids[0] }, { id: ids[1] }] }, { cookies });
		await post({ slug: 'best-movies', result: [{ id: ids[1] }, { id: ids[0] }] }, { cookies });

		const { results } = await db
			.prepare('SELECT result FROM ranking_results WHERE user_id = ?')
			.bind(alice.id)
			.all<{ result: string }>();
		expect(results).toHaveLength(1);
		expect(JSON.parse(results[0].result).map((r: any) => r.name)).toEqual([
			'Two',
			'One',
		]);
	});

	it('stores it under the canonical slug and collapses case aliases', async () => {
		const ids = await optionIds('best-movies');
		await db
			.prepare(
				`INSERT INTO ranking_results (user_id, slug, title, result)
				 VALUES (?, 'Best-Movies', 'Old', '[]')`
			)
			.bind(alice.id)
			.run();

		await post(
			{ slug: 'BEST-MOVIES', result: [{ id: ids[0] }, { id: ids[1] }] },
			{ cookies: await signIn(db, alice.id) }
		);

		const { results } = await db
			.prepare('SELECT slug FROM ranking_results WHERE user_id = ?')
			.bind(alice.id)
			.all<{ slug: string }>();
		expect(results).toEqual([{ slug: 'best-movies' }]);
	});

	it('rejects a result containing an option the template does not have', async () => {
		const response = await post(
			{ slug: 'best-movies', result: [{ id: 999_999 }, { id: 999_998 }] },
			{ cookies: await signIn(db, alice.id) }
		);
		expect(response.status).toBe(400);
	});

	it('rejects a result that repeats an option', async () => {
		const ids = await optionIds('best-movies');
		const response = await post(
			{ slug: 'best-movies', result: [{ id: ids[0] }, { id: ids[0] }] },
			{ cookies: await signIn(db, alice.id) }
		);
		expect(response.status).toBe(400);
	});

	it('rejects a result that is too short or too long', async () => {
		const ids = await optionIds('best-movies');
		const cookies = await signIn(db, alice.id);
		for (const result of [
			[],
			[{ id: ids[0] }],
			'not an array',
			[...ids, ...ids].map((id) => ({ id })),
		]) {
			expect((await post({ slug: 'best-movies', result }, { cookies })).status).toBe(
				400
			);
		}
	});

	it('accepts a partial ranking, because options can be excluded', async () => {
		const ids = await optionIds('best-movies');
		const response = await post(
			{ slug: 'best-movies', result: [{ id: ids[0] }, { id: ids[1] }] },
			{ cookies: await signIn(db, alice.id) }
		);
		expect(response.status).toBe(200);
	});

	it('stores the battle history alongside the result', async () => {
		const ids = await optionIds('best-movies');
		const response = await post(
			{
				slug: 'best-movies',
				result: [{ id: ids[0] }, { id: ids[1] }],
				battles: { version: 1, decisions: [[ids[0], ids[1], 0]] },
			},
			{ cookies: await signIn(db, alice.id) }
		);
		expect(((await response.json()) as any).entry.battles.decisions).toEqual([
			[ids[0], ids[1], 0],
		]);
	});

	it('rejects a battle history referencing options the template does not have', async () => {
		const ids = await optionIds('best-movies');
		const response = await post(
			{
				slug: 'best-movies',
				result: [{ id: ids[0] }, { id: ids[1] }],
				battles: { version: 1, decisions: [[999_999, 999_998, 0]] },
			},
			{ cookies: await signIn(db, alice.id) }
		);
		expect(response.status).toBe(400);
	});

	it('accepts an older client that sends no battle history at all', async () => {
		const ids = await optionIds('best-movies');
		const response = await post(
			{ slug: 'best-movies', result: [{ id: ids[0] }, { id: ids[1] }] },
			{ cookies: await signIn(db, alice.id) }
		);
		expect(((await response.json()) as any).entry.battles).toBeUndefined();
	});

	it('rejects a cross-site request', async () => {
		const ids = await optionIds('best-movies');
		const response = await post(
			{ slug: 'best-movies', result: [{ id: ids[0] }, { id: ids[1] }] },
			{ cookies: await signIn(db, alice.id), origin: null }
		);
		expect(response.status).toBe(403);
		expect(await db.prepare('SELECT slug FROM ranking_results').first()).toBeNull();
	});

	it('skips quietly for an anonymous visitor, who keeps results locally', async () => {
		const response = await post({ slug: 'best-movies', result: [] });
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true, skipped: true });
	});

	it('404s a template that does not exist', async () => {
		expect(
			(
				await post(
					{ slug: 'invented', result: [{ id: 1 }, { id: 2 }] },
					{ cookies: await signIn(db, alice.id) }
				)
			).status
		).toBe(404);
	});

	it('404s someone else’s private template', async () => {
		await insertTemplate(db, alice.id, {
			slug: 'alices-secret',
			visibility: 'private',
			options: OPTIONS,
		});
		const ids = await optionIds('alices-secret');
		expect(
			(
				await post(
					{ slug: 'alices-secret', result: [{ id: ids[0] }, { id: ids[1] }] },
					{ cookies: await signIn(db, bob.id) }
				)
			).status
		).toBe(404);
	});

	it('rejects a blank slug and invalid JSON', async () => {
		const cookies = await signIn(db, alice.id);
		expect((await post({ slug: '   ', result: [] }, { cookies })).status).toBe(
			400
		);
		expect((await post('not json', { cookies })).status).toBe(400);
	});

	it('works for official templates', async () => {
		const official = getOfficialTemplates()[0];
		const response = await post(
			{
				slug: official.slug,
				result: official.options.slice(0, 2).map((o) => ({ id: o.id })),
			},
			{ cookies: await signIn(db, alice.id) }
		);
		expect(response.status).toBe(200);
	});
});

describe('GET /api/me/history', () => {
	it('returns the saved result for a slug', async () => {
		const ids = await optionIds('best-movies');
		const cookies = await signIn(db, alice.id);
		await post({ slug: 'best-movies', result: [{ id: ids[1] }, { id: ids[0] }] }, { cookies });

		const payload = (await (await get('best-movies', cookies)).json()) as any;
		expect(payload.result.map((r: any) => r.name)).toEqual(['Two', 'One']);
		expect(payload.entry.slug).toBe('best-movies');
		expect(typeof payload.entry.ts).toBe('number');
	});

	it('finds it whatever spelling the caller asks with', async () => {
		const ids = await optionIds('best-movies');
		const cookies = await signIn(db, alice.id);
		await post({ slug: 'best-movies', result: [{ id: ids[0] }, { id: ids[1] }] }, { cookies });
		expect(
			((await (await get('BEST-MOVIES', cookies)).json()) as any).result
		).not.toBeNull();
	});

	it('is null for a template this user has not ranked', async () => {
		expect(
			await (await get('best-movies', await signIn(db, alice.id))).json()
		).toEqual({ result: null, entry: null });
	});

	it('never returns another user’s result', async () => {
		const ids = await optionIds('best-movies');
		await post(
			{ slug: 'best-movies', result: [{ id: ids[0] }, { id: ids[1] }] },
			{ cookies: await signIn(db, alice.id) }
		);
		expect(
			((await (await get('best-movies', await signIn(db, bob.id))).json()) as any)
				.result
		).toBeNull();
	});

	it('is null for an anonymous visitor', async () => {
		expect(await (await get('best-movies')).json()).toEqual({ result: null });
	});

	it('lists the played slugs when no slug is asked for', async () => {
		await db
			.prepare(
				'INSERT INTO rankings (slug, date, user_id) VALUES (?, ?, ?)'
			)
			.bind('best-movies', '2026-01-01', alice.id)
			.run();
		await insertRankingEvents(db, 'best-movies'); // anonymous, not attributed

		expect(
			await (await get(null, await signIn(db, alice.id))).json()
		).toEqual({ slugs: ['best-movies'] });
	});

	it('is an empty list for an anonymous visitor', async () => {
		expect(await (await get(null)).json()).toEqual({ slugs: [] });
	});

	it('is never cached', async () => {
		expect((await get(null)).headers.get('Cache-Control')).toBe(
			'private, no-store'
		);
	});
});
