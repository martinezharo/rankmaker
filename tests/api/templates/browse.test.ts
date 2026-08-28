import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET } from '../../../src/pages/api/templates/browse';
import { MATURE_COOKIE } from '../../../src/lib/mature';
import { createTestDb, type TestD1 } from '../../../src/test/d1';
import { apiContext } from '../../../src/test/api';
import {
	insertRankingEvents,
	insertTemplate,
	insertUser,
} from '../../../src/test/factories';

let db: TestD1;
let alice: { id: string; username: string };

beforeEach(async () => {
	db = createTestDb();
	alice = await insertUser(db, { username: 'alice' });
});
afterEach(() => {
	db.close();
});

const browse = (options: { optedIn?: boolean; user?: string } = {}) =>
	GET(
		apiContext({
			db,
			method: 'GET',
			path: options.user
				? `/api/templates/browse?user=${encodeURIComponent(options.user)}`
				: '/api/templates/browse',
			cookies: options.optedIn ? { [MATURE_COOKIE]: '1' } : {},
		}) as never
	);

const items = async (response: Response) =>
	((await response.json()) as any).items;

describe('GET /api/templates/browse', () => {
	it('hands an opted-out viewer nothing, so the cached grid stands', async () => {
		await insertTemplate(db, alice.id, { slug: 'anything' });
		expect(await items(await browse())).toBeNull();
	});

	it('re-derives the listing for a viewer who opted into mature content', async () => {
		await insertTemplate(db, alice.id, { slug: 'tame' });
		await insertTemplate(db, alice.id, { slug: 'spicy', isMature: true });

		const slugs = (await items(await browse({ optedIn: true }))).map(
			(i: any) => i.slug
		);
		expect(slugs).toContain('spicy');
		expect(slugs).toContain('tame');
	});

	it('still hides templates that are not public', async () => {
		await insertTemplate(db, alice.id, {
			slug: 'private-one',
			visibility: 'private',
			isMature: true,
		});
		await insertTemplate(db, alice.id, {
			slug: 'unlisted-one',
			visibility: 'unlisted',
		});

		const slugs = (await items(await browse({ optedIn: true }))).map(
			(i: any) => i.slug
		);
		expect(slugs).not.toContain('private-one');
		expect(slugs).not.toContain('unlisted-one');
	});

	it('orders by live ranking count, most-ranked first', async () => {
		await insertTemplate(db, alice.id, { slug: 'quiet' });
		await insertTemplate(db, alice.id, { slug: 'popular' });
		await insertRankingEvents(db, 'popular', 5);

		const listing = await items(await browse({ optedIn: true }));
		expect(listing[0].slug).toBe('popular');
		expect(listing[0].times_ranked).toBe(5);
	});

	it('scopes to one profile when asked', async () => {
		const bob = await insertUser(db, { username: 'bob' });
		await insertTemplate(db, alice.id, { slug: 'alices' });
		await insertTemplate(db, bob.id, { slug: 'bobs', isMature: true });

		const slugs = (await items(await browse({ optedIn: true, user: 'bob' }))).map(
			(i: any) => i.slug
		);
		expect(slugs).toEqual(['bobs']);
	});

	it('resolves the profile username case-insensitively', async () => {
		await insertTemplate(db, alice.id, { slug: 'alices' });
		const slugs = (
			await items(await browse({ optedIn: true, user: 'ALICE' }))
		).map((i: any) => i.slug);
		expect(slugs).toEqual(['alices']);
	});

	it('hands back nothing for an unknown profile', async () => {
		expect(
			await items(await browse({ optedIn: true, user: 'nobody' }))
		).toBeNull();
	});

	it('carries the fields a card needs to render itself', async () => {
		await insertTemplate(db, alice.id, {
			slug: 'card-fields',
			title: 'Card Fields',
			coverImage: 'https://img.test/cover.webp',
		});
		const [item] = await items(await browse({ optedIn: true, user: 'alice' }));
		expect(item).toMatchObject({
			slug: 'card-fields',
			title: 'Card Fields',
			cover_image: 'https://img.test/cover.webp',
			creator: { username: 'alice' },
			is_mature: false,
		});
		expect(item.optionNames).toBe('A B');
	});

	it('is never cached — it is the per-viewer variant', async () => {
		expect((await browse()).headers.get('Cache-Control')).toBe(
			'private, no-store'
		);
	});
});
