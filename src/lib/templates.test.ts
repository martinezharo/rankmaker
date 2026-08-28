import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	MAX_OPTIONS,
	MIN_OPTIONS,
	OFFICIAL_USER_ID,
	canAccessTemplate,
	generateUniqueSlug,
	generateUnlistedSlug,
	getCanonicalTemplateSlug,
	getOfficialTemplateBySlug,
	getOfficialTemplates,
	getTemplateBySlug,
	getTemplateOwnerId,
	listBrowseTemplates,
	listSavedTemplates,
	listTemplatesByUserId,
	listUserTemplates,
	slugify,
	templateExists,
	validateTemplateInput,
	type TemplateImagePolicy,
} from './templates';
import { createTestDb, type TestD1 } from '../test/d1';
import {
	insertRankingEvents,
	insertTemplate,
	insertUser,
} from '../test/factories';

let db: TestD1;
beforeEach(() => {
	db = createTestDb();
});
afterEach(() => {
	db.close();
});

// ── Official (JSON) templates ────────────────────────────────────────────────

describe('official templates', () => {
	it('carry no ranking count of their own — D1 is the only source', () => {
		expect(getOfficialTemplates().every((t) => t.times_ranked === 0)).toBe(
			true
		);
	});
});

describe('getOfficialTemplateBySlug', () => {
	it('returns the canonical template for a case-insensitive slug lookup', () => {
		const canonical = getOfficialTemplates()[0];
		const found = getOfficialTemplateBySlug(canonical.slug.toUpperCase());
		expect(found?.slug).toBe(canonical.slug);
	});

	it('returns null for an unknown slug', () => {
		expect(getOfficialTemplateBySlug('definitely-not-a-template')).toBeNull();
	});
});

// ── Resolving a slug across both sources ─────────────────────────────────────

describe('getTemplateBySlug', () => {
	it('resolves an official template without touching D1', async () => {
		const official = getOfficialTemplates()[0];
		const found = await getTemplateBySlug(db, official.slug);
		expect(found?.source).toBe('official');
		expect(found?.creator.username).toBe('RANKMAKER');
	});

	it('resolves a user template, with its options in position order', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		await insertTemplate(db, alice.id, {
			slug: 'my-ranking',
			options: [{ name: 'First' }, { name: 'Second' }, { name: 'Third' }],
		});

		const found = await getTemplateBySlug(db, 'MY-Ranking');
		expect(found?.source).toBe('user');
		expect(found?.options.map((o) => o.name)).toEqual([
			'First',
			'Second',
			'Third',
		]);
	});

	it('returns null for a slug that exists in neither source', async () => {
		expect(await getTemplateBySlug(db, 'nope')).toBeNull();
	});

	it('keeps an unknown visibility from opening up a template', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		await insertTemplate(db, alice.id, { slug: 'weird' });
		// The CHECK constraint blocks bad values on the way in, so the mapper's
		// fallback only matters for rows written before it existed.
		db.raw.exec("PRAGMA writable_schema = ON");
		db.raw.exec("UPDATE templates SET visibility = 'public'");
		db.raw.exec("PRAGMA writable_schema = OFF");
		const found = await getTemplateBySlug(db, 'weird');
		expect(found?.visibility).toBe('public');
	});
});

describe('getCanonicalTemplateSlug', () => {
	it('answers with the source spelling, not the caller’s', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		await insertTemplate(db, alice.id, { slug: 'Mixed-Case-Slug' });
		expect(await getCanonicalTemplateSlug(db, 'mixed-case-slug')).toBe(
			'Mixed-Case-Slug'
		);
	});

	it('prefers the official spelling', async () => {
		const official = getOfficialTemplates()[0];
		expect(
			await getCanonicalTemplateSlug(db, official.slug.toUpperCase())
		).toBe(official.slug);
	});

	it('is null for an unknown slug, so writes reject it', async () => {
		expect(await getCanonicalTemplateSlug(db, 'invented')).toBeNull();
	});
});

describe('templateExists', () => {
	it('sees hidden templates too — it only rejects invented slugs', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		await insertTemplate(db, alice.id, {
			slug: 'secret',
			visibility: 'private',
		});
		expect(await templateExists(db, 'SECRET')).toBe(true);
		expect(await templateExists(db, 'not-a-slug')).toBe(false);
	});

	it('sees official templates', async () => {
		expect(await templateExists(db, getOfficialTemplates()[0].slug)).toBe(
			true
		);
	});
});

describe('getTemplateOwnerId', () => {
	it('attributes official templates to the RANKMAKER account', async () => {
		expect(
			await getTemplateOwnerId(db, getOfficialTemplates()[0].slug)
		).toBe(OFFICIAL_USER_ID);
	});

	it('resolves a user template to its creator, case-insensitively', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		await insertTemplate(db, alice.id, { slug: 'Alices-Ranking' });
		expect(await getTemplateOwnerId(db, 'alices-ranking')).toBe(alice.id);
	});

	it('is null for an unknown slug', async () => {
		expect(await getTemplateOwnerId(db, 'ghost')).toBeNull();
	});
});

// ── Access control ───────────────────────────────────────────────────────────

describe('canAccessTemplate', () => {
	const priv = {
		source: 'user' as const,
		visibility: 'private' as const,
		creator: { username: 'alice', avatar: 'x', isVerified: false },
	};

	it('lets the creator through', () => {
		expect(canAccessTemplate(priv, 'alice')).toBe(true);
	});

	it('keeps another signed-in user out of a private template', () => {
		expect(canAccessTemplate(priv, 'bob')).toBe(false);
	});

	it('keeps a signed-out visitor out of a private template', () => {
		expect(canAccessTemplate(priv, null)).toBe(false);
		expect(canAccessTemplate(priv, undefined)).toBe(false);
	});

	it('is case-sensitive on the username, so a lookalike cannot pass', () => {
		expect(canAccessTemplate(priv, 'Alice')).toBe(false);
	});

	it('leaves unlisted templates reachable by anyone with the slug', () => {
		expect(
			canAccessTemplate({ ...priv, visibility: 'unlisted' }, null)
		).toBe(true);
	});

	it('never gates official templates', () => {
		expect(
			canAccessTemplate({ ...priv, source: 'official' }, null)
		).toBe(true);
	});
});

// ── Listings, visibility and the mature filter ───────────────────────────────

describe('listUserTemplates', () => {
	it('lists only public templates', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		await insertTemplate(db, alice.id, { slug: 'shown' });
		await insertTemplate(db, alice.id, {
			slug: 'hidden',
			visibility: 'private',
		});
		await insertTemplate(db, alice.id, {
			slug: 'link-only',
			visibility: 'unlisted',
		});

		const slugs = (await listUserTemplates(db)).map((t) => t.slug);
		expect(slugs).toEqual(['shown']);
	});

	it('hides mature templates unless the viewer opted in', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		await insertTemplate(db, alice.id, { slug: 'tame' });
		await insertTemplate(db, alice.id, { slug: 'spicy', isMature: true });

		expect((await listUserTemplates(db)).map((t) => t.slug)).toEqual([
			'tame',
		]);
		expect(
			(await listUserTemplates(db, true)).map((t) => t.slug).sort()
		).toEqual(['spicy', 'tame']);
	});

	it('orders newest first', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		await insertTemplate(db, alice.id, {
			slug: 'older',
			createdAt: '2026-01-01T00:00:00.000Z',
		});
		await insertTemplate(db, alice.id, {
			slug: 'newer',
			createdAt: '2026-06-01T00:00:00.000Z',
		});
		expect((await listUserTemplates(db)).map((t) => t.slug)).toEqual([
			'newer',
			'older',
		]);
	});

	it('carries the option names and collage images the cards need', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		await insertTemplate(db, alice.id, {
			slug: 'with-images',
			options: [
				{ name: 'One', image: 'https://img.test/1.webp' },
				{ name: 'Two', image: 'https://img.test/2.webp' },
				{ name: 'Three', image: 'https://img.test/3.webp' },
				{ name: 'Four', image: 'https://img.test/4.webp' },
			],
		});
		const [template] = await listUserTemplates(db);
		expect(template.optionNames).toBe('One Two Three Four');
		expect(template.collage).toHaveLength(4);
	});

	it('leaves the collage empty when too few options have an image', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		await insertTemplate(db, alice.id, {
			slug: 'thin',
			options: [
				{ name: 'One', image: 'https://img.test/1.webp' },
				{ name: 'Two' },
				{ name: 'Three' },
				{ name: 'Four' },
			],
		});
		expect((await listUserTemplates(db))[0].collage).toEqual([]);
	});
});

describe('listBrowseTemplates', () => {
	it('is officials plus public user templates', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		await insertTemplate(db, alice.id, { slug: 'mine' });
		const slugs = (await listBrowseTemplates(db)).map((t) => t.slug);
		expect(slugs).toContain('mine');
		expect(slugs).toContain(getOfficialTemplates()[0].slug);
	});

	it('applies the mature filter to both sources at once', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		await insertTemplate(db, alice.id, { slug: 'spicy', isMature: true });
		expect(
			(await listBrowseTemplates(db)).some((t) => t.is_mature)
		).toBe(false);
		expect(
			(await listBrowseTemplates(db, true)).map((t) => t.slug)
		).toContain('spicy');
	});
});

describe('listTemplatesByUserId', () => {
	it('shows a visitor only the public ones', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		await insertTemplate(db, alice.id, { slug: 'public-one' });
		await insertTemplate(db, alice.id, {
			slug: 'private-one',
			visibility: 'private',
		});
		expect(
			(await listTemplatesByUserId(db, alice.id)).map((t) => t.slug)
		).toEqual(['public-one']);
	});

	it('shows the owner their hidden and mature templates', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		await insertTemplate(db, alice.id, { slug: 'public-one' });
		await insertTemplate(db, alice.id, {
			slug: 'private-one',
			visibility: 'private',
		});
		await insertTemplate(db, alice.id, {
			slug: 'mature-one',
			isMature: true,
		});
		expect(
			(
				await listTemplatesByUserId(db, alice.id, {
					includeHidden: true,
				})
			)
				.map((t) => t.slug)
				.sort()
		).toEqual(['mature-one', 'private-one', 'public-one']);
	});

	it('never leaks another user’s templates', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		const bob = await insertUser(db, { username: 'bob' });
		await insertTemplate(db, alice.id, { slug: 'alices' });
		await insertTemplate(db, bob.id, { slug: 'bobs' });
		expect(
			(await listTemplatesByUserId(db, bob.id)).map((t) => t.slug)
		).toEqual(['bobs']);
	});

	it('gives the RANKMAKER account every official template as well', async () => {
		const result = await listTemplatesByUserId(db, OFFICIAL_USER_ID);
		expect(result.length).toBeGreaterThanOrEqual(
			getOfficialTemplates().length
		);
		expect(result.every((t) => t.creator.username === 'RANKMAKER')).toBe(
			true
		);
	});
});

// ── Saved templates ──────────────────────────────────────────────────────────

describe('listSavedTemplates', () => {
	async function save(userId: string, slug: string, at: string) {
		await db
			.prepare(
				`INSERT INTO template_saves (user_id, slug, created_at)
				 VALUES (?, ?, ?)`
			)
			.bind(userId, slug, at)
			.run();
	}

	it('returns saved templates newest-saved first', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		await insertTemplate(db, alice.id, { slug: 'first' });
		await insertTemplate(db, alice.id, { slug: 'second' });
		await save(alice.id, 'first', '2026-01-01T00:00:00.000Z');
		await save(alice.id, 'second', '2026-02-01T00:00:00.000Z');

		expect((await listSavedTemplates(db, alice.id)).map((t) => t.slug)).toEqual(
			['second', 'first']
		);
	});

	it('drops slugs whose template no longer exists', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		await save(alice.id, 'deleted-template', '2026-01-01T00:00:00.000Z');
		expect(await listSavedTemplates(db, alice.id)).toEqual([]);
	});

	it('hides someone else’s private template even when it is saved', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		const bob = await insertUser(db, { username: 'bob' });
		await insertTemplate(db, bob.id, {
			slug: 'bobs-secret',
			visibility: 'private',
		});
		await save(alice.id, 'bobs-secret', '2026-01-01T00:00:00.000Z');
		expect(await listSavedTemplates(db, alice.id)).toEqual([]);
	});

	it('keeps the owner’s own hidden templates', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		await insertTemplate(db, alice.id, {
			slug: 'my-secret',
			visibility: 'private',
		});
		await save(alice.id, 'my-secret', '2026-01-01T00:00:00.000Z');
		expect(
			(await listSavedTemplates(db, alice.id)).map((t) => t.slug)
		).toEqual(['my-secret']);
	});

	it('merges live ranking counts, whatever the slug’s spelling', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		await insertTemplate(db, alice.id, { slug: 'Mixed-Case' });
		await save(alice.id, 'Mixed-Case', '2026-01-01T00:00:00.000Z');
		await insertRankingEvents(db, 'mixed-case', 3);

		const [saved] = await listSavedTemplates(db, alice.id);
		expect(saved.times_ranked).toBe(3);
	});

	it('reports zero for a saved official template nobody has ranked', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		const official = getOfficialTemplates()[0];
		await save(alice.id, official.slug, '2026-01-01T00:00:00.000Z');

		const [saved] = await listSavedTemplates(db, alice.id);
		expect(saved.times_ranked).toBe(0);
	});

	it('gives a saved official template its live count', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		const official = getOfficialTemplates()[0];
		await save(alice.id, official.slug, '2026-01-01T00:00:00.000Z');
		await insertRankingEvents(db, official.slug, 6);

		const [saved] = await listSavedTemplates(db, alice.id);
		expect(saved.times_ranked).toBe(6);
	});
});

// ── Slug generation ──────────────────────────────────────────────────────────

describe('slugify', () => {
	it('lowercases, strips diacritics and joins words with dashes', () => {
		expect(slugify('Mejores Películas de Acción')).toBe(
			'mejores-peliculas-de-accion'
		);
	});

	it('collapses punctuation and trims stray dashes', () => {
		expect(slugify('  ¿Best?? Movies -- Ever!  ')).toBe('best-movies-ever');
	});

	it('caps the length without leaving a trailing dash', () => {
		const slug = slugify('a'.repeat(58) + ' bcdefgh');
		expect(slug.length).toBeLessThanOrEqual(60);
		expect(slug.endsWith('-')).toBe(false);
	});

	it('falls back to "ranking" when nothing survives', () => {
		expect(slugify('日本語')).toBe('ranking');
		expect(slugify('')).toBe('ranking');
	});
});

describe('generateUniqueSlug', () => {
	it('uses the plain slug when it is free', async () => {
		expect(await generateUniqueSlug(db, 'Brand New Topic')).toBe(
			'brand-new-topic'
		);
	});

	it('suffixes past a taken user slug, ignoring case', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		await insertTemplate(db, alice.id, { slug: 'Best-Movies' });
		expect(await generateUniqueSlug(db, 'best movies')).toBe(
			'best-movies-2'
		);
	});

	it('keeps counting past every taken suffix', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		await insertTemplate(db, alice.id, { slug: 'best-movies' });
		await insertTemplate(db, alice.id, { slug: 'best-movies-2' });
		await insertTemplate(db, alice.id, { slug: 'best-movies-3' });
		expect(await generateUniqueSlug(db, 'Best Movies')).toBe(
			'best-movies-4'
		);
	});

	it('never collides with an official template', async () => {
		const official = getOfficialTemplates()[0];
		const generated = await generateUniqueSlug(db, official.title);
		expect(generated).not.toBe(official.slug);
	});
});

describe('generateUnlistedSlug', () => {
	it('keeps a readable prefix and appends an unguessable token', async () => {
		const slug = await generateUnlistedSlug(db, 'My Secret Ranking');
		expect(slug).toMatch(/^my-secret-ranking-[a-z0-9]{12}$/);
	});

	it('is different every time, so URLs cannot be enumerated', async () => {
		const slugs = new Set(
			await Promise.all(
				Array.from({ length: 10 }, () =>
					generateUnlistedSlug(db, 'Same Title')
				)
			)
		);
		expect(slugs.size).toBe(10);
	});

	it('still produces a slug for an untranslatable title', async () => {
		expect(await generateUnlistedSlug(db, '日本語')).toMatch(
			/^ranking-[a-z0-9]{12}$/
		);
	});
});

// ── Input validation (the gate every user template passes through) ───────────

describe('validateTemplateInput', () => {
	const policy: TemplateImagePolicy = { base: 'https://img.test' };
	const uploaded = (n: number) =>
		`https://img.test/u/user-1/aaaaaaaaaaaaaaaa${n}.webp`;

	const options = (count: number, withImages = 0) =>
		Array.from({ length: count }, (_, i) => ({
			name: `Option ${i}`,
			image: i < withImages ? uploaded(i) : null,
		}));

	const valid = () => ({
		title: 'A Perfectly Fine Title',
		description: 'A description that is long enough.',
		category: 'Movies',
		cover_image: uploaded(9),
		visibility: 'public',
		options: options(MIN_OPTIONS),
	});

	const expectError = (body: unknown, match: RegExp) => {
		const result = validateTemplateInput(body, policy);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toMatch(match);
	};

	it('accepts a well-formed public template', () => {
		const result = validateTemplateInput(valid(), policy);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.visibility).toBe('public');
			expect(result.data.is_mature).toBe(false);
			expect(result.data.options).toHaveLength(MIN_OPTIONS);
		}
	});

	it('trims the title and rejects one that is too short or too long', () => {
		const result = validateTemplateInput(
			{ ...valid(), title: '  Padded Title  ' },
			policy
		);
		expect(result.ok && result.data.title).toBe('Padded Title');
		expectError({ ...valid(), title: 'ab' }, /Title/);
		expectError({ ...valid(), title: 'a'.repeat(81) }, /Title/);
		expectError({ ...valid(), title: 123 }, /Title/);
	});

	it('rejects an unknown visibility', () => {
		expectError({ ...valid(), visibility: 'secret' }, /visibility/);
	});

	it('treats a missing visibility as public, for older clients', () => {
		const { visibility, ...body } = valid();
		const result = validateTemplateInput(body, policy);
		expect(result.ok && result.data.visibility).toBe('public');
	});

	it('requires a description and category only for public templates', () => {
		expectError({ ...valid(), description: 'too short' }, /Description/);
		expectError({ ...valid(), category: '' }, /category/);

		const unlisted = validateTemplateInput(
			{
				...valid(),
				visibility: 'unlisted',
				description: '',
				category: '',
				cover_image: null,
				options: options(MIN_OPTIONS),
			},
			policy
		);
		expect(unlisted.ok).toBe(true);
	});

	it('caps the description at 300 characters on every visibility', () => {
		expectError(
			{
				...valid(),
				visibility: 'private',
				description: 'x'.repeat(301),
			},
			/300/
		);
	});

	it('rejects a category that is not one of ours', () => {
		expectError({ ...valid(), category: 'Nonsense' }, /category/);
	});

	it('enforces the option count bounds', () => {
		expectError({ ...valid(), options: options(MIN_OPTIONS - 1) }, /at least/);
		expectError({ ...valid(), options: options(MAX_OPTIONS + 1) }, /at most/);
		expectError({ ...valid(), options: 'not-an-array' }, /Options/);
	});

	it('rejects duplicate option names, ignoring case and padding', () => {
		expectError(
			{
				...valid(),
				options: [
					{ name: 'Alien', image: null },
					{ name: ' alien ', image: null },
					{ name: 'C', image: null },
					{ name: 'D', image: null },
				],
			},
			/Duplicate option/
		);
	});

	it('rejects a nameless or overlong option', () => {
		expectError(
			{ ...valid(), options: [...options(3), { name: '   ', image: null }] },
			/needs a name/
		);
		expectError(
			{
				...valid(),
				options: [...options(3), { name: 'x'.repeat(81), image: null }],
			},
			/needs a name/
		);
	});

	it('only accepts images that were uploaded to our own bucket', () => {
		expectError(
			{ ...valid(), cover_image: 'https://evil.test/pic.webp' },
			/Cover image/
		);
		expectError(
			{
				...valid(),
				options: [
					{ name: 'A', image: 'https://evil.test/pic.webp' },
					...options(3),
				],
			},
			/uploaded image/
		);
		expectError(
			{
				...valid(),
				cover_image: 'javascript:alert(1)',
			},
			/Cover image/
		);
	});

	it('grandfathers URLs the template already stores', () => {
		const legacy = 'https://legacy.test/old-cover.jpg';
		const result = validateTemplateInput(
			{ ...valid(), cover_image: legacy },
			{ base: 'https://img.test', allowedUrls: new Set([legacy]) }
		);
		expect(result.ok).toBe(true);
	});

	it('rejects an absurdly long image URL even if it is grandfathered-looking', () => {
		expectError(
			{ ...valid(), cover_image: `https://img.test/${'x'.repeat(600)}` },
			/Cover image/
		);
	});

	it('lets a public template skip the cover when its options can build a collage', () => {
		const result = validateTemplateInput(
			{
				...valid(),
				cover_image: null,
				options: options(MIN_OPTIONS, MIN_OPTIONS),
			},
			policy
		);
		expect(result.ok).toBe(true);
	});

	it('requires a cover when the options cannot build one', () => {
		expectError(
			{ ...valid(), cover_image: null, options: options(MIN_OPTIONS, 3) },
			/Cover image is required/
		);
	});

	it('lets a private template fall back to the text placeholder', () => {
		const result = validateTemplateInput(
			{
				...valid(),
				visibility: 'private',
				cover_image: null,
				options: options(MIN_OPTIONS),
			},
			policy
		);
		expect(result.ok).toBe(true);
	});

	it('only treats an explicit `true` as the mature flag', () => {
		const on = validateTemplateInput(
			{ ...valid(), is_mature: true },
			policy
		);
		expect(on.ok && on.data.is_mature).toBe(true);
		for (const value of ['true', 1, 'on', null, undefined]) {
			const result = validateTemplateInput(
				{ ...valid(), is_mature: value },
				policy
			);
			expect(result.ok && result.data.is_mature).toBe(false);
		}
	});

	it('survives a hostile body without throwing', () => {
		for (const body of [null, undefined, 'string', 42, []]) {
			expect(validateTemplateInput(body, policy).ok).toBe(false);
		}
	});
});
