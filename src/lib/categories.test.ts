import { describe, expect, it } from 'vitest';
import {
	CATEGORIES,
	CATEGORY_ICONS,
	CATEGORY_NAMES,
	CATEGORY_SLUGS,
	categoryFromSlug,
	categoryIcon,
	categorySlug,
} from './categories';

describe('the category list', () => {
	it('names each category once', () => {
		expect(new Set(CATEGORY_NAMES).size).toBe(CATEGORY_NAMES.length);
	});

	it('gives every category a FontAwesome icon', () => {
		for (const category of CATEGORIES) {
			expect(category.icon, category.name).toMatch(/^fa-/);
			expect(CATEGORY_ICONS[category.name]).toBe(category.icon);
		}
	});
});

describe('categorySlug', () => {
	it('makes a URL-safe slug', () => {
		expect(categorySlug('Movies')).toBe('movies');
		expect(categorySlug('History & Culture')).toBe('history-and-culture');
	});

	it('leaves no leading or trailing dash', () => {
		for (const name of CATEGORY_NAMES) {
			const slug = categorySlug(name);
			expect(slug, name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
		}
	});

	it('produces a distinct slug per category, so the pages cannot collide', () => {
		const slugs = CATEGORY_SLUGS.map((c) => c.slug);
		expect(new Set(slugs).size).toBe(slugs.length);
	});
});

describe('categoryFromSlug', () => {
	it('round-trips every category', () => {
		for (const name of CATEGORY_NAMES) {
			expect(categoryFromSlug(categorySlug(name))).toBe(name);
		}
	});

	it('is null for a slug we do not serve', () => {
		for (const slug of ['', 'Movies', 'history-culture', 'invented']) {
			expect(categoryFromSlug(slug)).toBeNull();
		}
	});
});

describe('categoryIcon', () => {
	it('resolves a known category', () => {
		expect(categoryIcon('Movies')).toBe('fa-film');
	});

	it('falls back for an unknown, empty or missing category', () => {
		for (const value of ['Nonsense', '', null, undefined]) {
			expect(categoryIcon(value)).toBe('fa-ellipsis-h');
		}
	});
});
