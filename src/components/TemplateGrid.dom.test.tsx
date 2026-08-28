// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import TemplateGrid from './TemplateGrid';
import ListingGrid from './ListingGrid';
import type { ListingItem } from '../lib/listings';
import { flush, render, screen } from '../test/dom';
import { vi, afterEach } from 'vitest';

const item = (slug: string, overrides: Partial<ListingItem> = {}): ListingItem => ({
	slug,
	title: slug.toUpperCase(),
	description: null,
	category: 'Movies',
	cover_image: null,
	collage: [],
	times_ranked: 0,
	votes: 0,
	optionNames: '',
	creator: { username: 'alice', avatar: 'star-purple', isVerified: false },
	is_mature: false,
	...overrides,
});

describe('TemplateGrid', () => {
	it('renders a card per item, in the order given', () => {
		render(<TemplateGrid items={[item('a'), item('b'), item('c')]} />);
		expect(
			[...document.querySelectorAll('a[href^="/template/"]')].map((a) =>
				a.getAttribute('href')
			)
		).toEqual(['/template/a', '/template/b', '/template/c']);
	});

	it('renders the empty state instead of an empty grid', () => {
		render(<TemplateGrid items={[]} empty={<p>Nothing here</p>} />);
		expect(screen.getByText('Nothing here')).toBeInTheDocument();
		expect(document.querySelector('a[href^="/template/"]')).toBeNull();
	});

	it('renders nothing at all when empty with no empty state', () => {
		const { container } = render(<TemplateGrid items={[]} />);
		expect(container).toBeEmptyDOMElement();
	});

	it('wraps each card when the caller needs a per-card width', () => {
		const { container } = render(
			<TemplateGrid items={[item('a')]} itemClass="w-64 shrink-0" />
		);
		expect(container.querySelector('.w-64.shrink-0 a')).toBeTruthy();
	});

	it('does not wrap when no item class is given', () => {
		const { container } = render(<TemplateGrid items={[item('a')]} />);
		expect(container.firstElementChild!.firstElementChild!.tagName).toBe('A');
	});

	it('uses the caller’s grid class', () => {
		const { container } = render(
			<TemplateGrid items={[item('a')]} class="my-own-grid" />
		);
		expect(container.querySelector('.my-own-grid')).toBeTruthy();
	});

	it('passes the heading level and locale down to every card', () => {
		const { container } = render(
			<TemplateGrid items={[item('a')]} headingLevel="h2" locale="es" />
		);
		expect(container.querySelector('h2')).toBeTruthy();
		expect(container.querySelector('a')).toHaveAttribute(
			'href',
			'/es/template/a'
		);
	});
});

describe('ListingGrid', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it('renders exactly the server listing, so hydration changes nothing', () => {
		vi.stubGlobal('fetch', vi.fn());
		render(<ListingGrid items={[item('server-a'), item('server-b')]} />);
		expect(
			[...document.querySelectorAll('a[href^="/template/"]')].map((a) =>
				a.getAttribute('href')
			)
		).toEqual(['/template/server-a', '/template/server-b']);
	});

	it('shows the empty state when the server had nothing', () => {
		vi.stubGlobal('fetch', vi.fn());
		render(<ListingGrid items={[]} empty={<p>No templates</p>} />);
		expect(screen.getByText('No templates')).toBeInTheDocument();
	});

	it('swaps in a mature viewer’s listing, narrowed and capped as the server did', async () => {
		vi.resetModules();
		const mature = await import('../scripts/mature-listing');
		const { default: Grid } = await import('./ListingGrid');
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				json: async () => ({
					items: [
						item('spicy', { category: 'Movies' }),
						item('also-spicy', { category: 'Movies' }),
						item('elsewhere', { category: 'Games' }),
					],
				}),
			}))
		);

		render(<Grid items={[item('tame')]} category="Movies" limit={1} />);
		mature.publishMaturePreference(true);
		await flush();
		await flush();

		const hrefs = [...document.querySelectorAll('a[href^="/template/"]')].map(
			(a) => a.getAttribute('href')
		);
		expect(hrefs).toEqual(['/template/spicy']);
	});
});
