/**
 * Integrity of the bundled official templates.
 *
 * `src/data/templates.json` is edited by hand and ships straight to
 * production: nothing validates it at build time, and a single bad entry is
 * not a 500 the monitoring notices — it is one silently broken ranking page.
 * These are the invariants the app relies on but never checks at runtime.
 */
import { describe, expect, it } from 'vitest';
import { getOfficialTemplates, slugify } from '../lib/templates';
import { MAX_OPTIONS, MIN_OPTIONS } from '../lib/template-limits';
import { CATEGORY_NAMES } from '../lib/categories';
import { RESERVED_USERNAMES } from '../lib/auth';

const templates = getOfficialTemplates();

/** Reported per template so a failure names the culprit, not just a count. */
const offenders = (predicate: (t: (typeof templates)[number]) => boolean) =>
	templates.filter(predicate).map((t) => t.slug);

describe('the official template catalogue', () => {
	it('is not empty', () => {
		expect(templates.length).toBeGreaterThan(0);
	});

	it('gives every template a unique id', () => {
		const ids = templates.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('gives every template a slug that is unique even ignoring case', () => {
		// Slug lookups are case-insensitive, so two spellings would resolve to
		// whichever the array happens to hit first.
		const slugs = templates.map((t) => t.slug.toLowerCase());
		const duplicates = slugs.filter((s, i) => slugs.indexOf(s) !== i);
		expect([...new Set(duplicates)]).toEqual([]);
	});

	it('uses URL-safe slugs that survive a round-trip through slugify', () => {
		expect(offenders((t) => slugify(t.slug) !== t.slug)).toEqual([]);
	});

	it('never claims a slug that a reserved route would shadow', () => {
		expect(
			offenders((t) => RESERVED_USERNAMES.includes(t.slug.toLowerCase()))
		).toEqual([]);
	});

	it('gives every template a title and a description', () => {
		expect(offenders((t) => !t.title?.trim())).toEqual([]);
		expect(offenders((t) => !t.description?.trim())).toEqual([]);
	});

	it('files every template under a category we actually render', () => {
		expect(
			offenders((t) => !t.category || !CATEGORY_NAMES.includes(t.category))
		).toEqual([]);
	});

	it('gives every template a cover the card can paint', () => {
		// Either its own cover image or enough option images for the collage.
		expect(
			offenders((t) => !t.cover_image && t.collage.length === 0)
		).toEqual([]);
	});

	it('has parseable timestamps', () => {
		expect(
			offenders(
				(t) =>
					Number.isNaN(Date.parse(t.created_at)) ||
					Number.isNaN(Date.parse(t.updated_at))
			)
		).toEqual([]);
	});

	it('carries no ranking count of its own — D1 is the only source', () => {
		// The catalogue used to seed a placeholder figure, which then disagreed
		// with the live count on every surface that merged the real one.
		expect(offenders((t) => t.times_ranked !== 0)).toEqual([]);
	});
});

describe('the options of every official template', () => {
	it('stay within the limits the create form enforces', () => {
		expect(
			offenders(
				(t) =>
					t.options.length < MIN_OPTIONS ||
					t.options.length > MAX_OPTIONS
			)
		).toEqual([]);
	});

	it('have integer ids — the ranking engine parses them as numbers', () => {
		expect(
			offenders((t) =>
				t.options.some((o) => !Number.isInteger(o.id))
			)
		).toEqual([]);
	});

	it('have ids unique within their template, so duels are unambiguous', () => {
		expect(
			offenders((t) => new Set(t.options.map((o) => o.id)).size !== t.options.length)
		).toEqual([]);
	});

	it('all have a name', () => {
		expect(
			offenders((t) => t.options.some((o) => !o.name?.trim()))
		).toEqual([]);
	});

	it('have no duplicate names, which would make a duel unreadable', () => {
		expect(
			offenders((t) => {
				const names = t.options.map((o) => o.name.trim().toLowerCase());
				return new Set(names).size !== names.length;
			})
		).toEqual([]);
	});

	it('only reference images over https', () => {
		expect(
			offenders((t) =>
				t.options.some(
					(o) => o.image != null && !o.image.startsWith('https://')
				)
			)
		).toEqual([]);
	});
});

describe('every official template is playable', () => {
	it('maps to the shared Template shape with an official creator', () => {
		for (const template of templates) {
			expect(template.source).toBe('official');
			expect(template.visibility).toBe('public');
			expect(template.creator.username).toBe('RANKMAKER');
			expect(template.mature_locked).toBe(false);
		}
	});

	it('exposes its option names for search', () => {
		expect(
			offenders(
				(t) =>
					t.optionNames !==
					t.options.map((o) => o.name).join(' ')
			)
		).toEqual([]);
	});
});
