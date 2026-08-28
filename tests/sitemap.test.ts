import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET } from '../src/pages/sitemap.xml';
import { getOfficialTemplates } from '../src/lib/templates';
import { CATEGORY_SLUGS } from '../src/lib/categories';
import { createTestDb, type TestD1 } from '../src/test/d1';
import { apiContext } from '../src/test/api';
import { insertTemplate, insertUser } from '../src/test/factories';

let db: TestD1;
let alice: { id: string; username: string };

beforeEach(async () => {
	db = createTestDb();
	alice = await insertUser(db, { username: 'alice' });
});
afterEach(() => {
	db.close();
});

async function sitemap(): Promise<{ xml: string; locs: string[]; response: Response }> {
	const response = await GET(
		apiContext({ db, method: 'GET', path: '/sitemap.xml' }) as never
	);
	const xml = await response.text();
	return {
		xml,
		locs: [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]),
		response,
	};
}

describe('GET /sitemap.xml', () => {
	it('is well-formed XML served as XML', async () => {
		const { xml, response } = await sitemap();
		expect(response.headers.get('Content-Type')).toBe('application/xml');
		expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(
			true
		);
		expect(xml).toContain(
			'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
		);
		expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
	});

	it('lists the home page, the legal pages and every category', async () => {
		const { locs } = await sitemap();
		expect(locs).toContain('https://rankmaker.net/');
		expect(locs).toContain('https://rankmaker.net/about');
		for (const category of CATEGORY_SLUGS) {
			expect(locs).toContain(
				`https://rankmaker.net/category/${category.slug}`
			);
		}
	});

	it('lists every official template', async () => {
		const { locs } = await sitemap();
		for (const template of getOfficialTemplates()) {
			expect(locs).toContain(
				`https://rankmaker.net/template/${template.slug}`
			);
		}
	});

	it('lists public user templates and their creators’ profiles', async () => {
		await insertTemplate(db, alice.id, { slug: 'alices-public' });
		const { locs } = await sitemap();
		expect(locs).toContain('https://rankmaker.net/template/alices-public');
		expect(locs).toContain('https://rankmaker.net/u/alice');
	});

	it('never leaks a template that is not public', async () => {
		await insertTemplate(db, alice.id, {
			slug: 'private-one',
			visibility: 'private',
		});
		await insertTemplate(db, alice.id, {
			slug: 'unlisted-one',
			visibility: 'unlisted',
		});
		const { xml } = await sitemap();
		expect(xml).not.toContain('private-one');
		expect(xml).not.toContain('unlisted-one');
	});

	it('never lists a template flagged as mature', async () => {
		await insertTemplate(db, alice.id, { slug: 'spicy', isMature: true });
		expect((await sitemap()).xml).not.toContain('spicy');
	});

	it('emits English URLs only while the content is not localized', async () => {
		const { locs } = await sitemap();
		expect(locs.filter((l) => /rankmaker\.net\/(es|fr|zh|ms|de|pt)(\/|$)/.test(l)))
			.toEqual([]);
	});

	it('has no duplicate URLs', async () => {
		await insertTemplate(db, alice.id, { slug: 'alices-public' });
		const { locs } = await sitemap();
		expect(new Set(locs).size).toBe(locs.length);
	});

	it('carries a real lastmod, never an invented one', async () => {
		await insertTemplate(db, alice.id, {
			slug: 'dated',
			createdAt: '2026-03-04T05:06:07.000Z',
		});
		const { xml } = await sitemap();
		expect(xml).toContain('<lastmod>2026-03-04T05:06:07.000Z</lastmod>');
		for (const [, value] of xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) {
			expect(Number.isNaN(Date.parse(value))).toBe(false);
		}
	});

	it('percent-encodes a username so it cannot break the XML', async () => {
		await insertUser(db, { username: 'a-b_c' });
		const { locs } = await sitemap();
		expect(locs).toContain('https://rankmaker.net/u/a-b_c');
	});

	it('still serves the official catalogue when D1 is unavailable', async () => {
		const broken = {
			prepare: () => {
				throw new Error('D1 is down');
			},
		};
		const response = await GET(
			apiContext({ db: broken as never, method: 'GET', path: '/sitemap.xml' }) as never
		);
		const xml = await response.text();
		expect(response.status).toBe(200);
		expect(xml).toContain(
			`/template/${getOfficialTemplates()[0].slug}`
		);
		expect(xml).toContain('/u/RANKMAKER');
	});

	it('is edge-cacheable for an hour', async () => {
		expect((await sitemap()).response.headers.get('Cache-Control')).toBe(
			'public, max-age=3600'
		);
	});
});
