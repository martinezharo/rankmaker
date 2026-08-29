// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hydrate } from 'preact';
import SearchResults from './SearchResults';
import { SELECT_SYNC_EVENT } from '../scripts/select-sync';
import type { ListingItem } from '../lib/listings';
import { flush, inlineDictionary, mount, render, screen } from '../test/dom';

const item = (
	slug: string,
	overrides: Partial<ListingItem> = {}
): ListingItem => ({
	slug,
	title: slug.replace(/-/g, ' '),
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

/** The filter bar /search renders in Astro, which this island wires itself to. */
function filterBar() {
	mount(`
		<input id="search-input" />
		<select id="category-select">
			<option value="">All</option>
			<option value="Movies">Movies</option>
			<option value="Games">Games</option>
		</select>
		<button id="search-clear" class="hidden">Clear</button>
		<button id="reset-filters" class="hidden">Reset</button>
		<span id="results-count"></span>
		<div id="grid"></div>
	`);
	return {
		input: document.getElementById('search-input') as HTMLInputElement,
		select: document.getElementById('category-select') as HTMLSelectElement,
		clear: document.getElementById('search-clear')!,
		reset: document.getElementById('reset-filters')!,
		count: document.getElementById('results-count')!,
		grid: document.getElementById('grid')!,
	};
}

const shownSlugs = () =>
	[...document.querySelectorAll('a[href^="/template/"]')].map((a) =>
		a.getAttribute('href')!.replace('/template/', '')
	);

const rankedText = (slug: string) =>
	document.querySelector(`[data-count-slug="${slug}"]`)?.textContent;

/** Typing is debounced; wait past the debounce window. */
const afterDebounce = () => new Promise((resolve) => setTimeout(resolve, 200));

beforeEach(() => {
	vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ items: null }) })));
	inlineDictionary();
});
afterEach(() => {
	vi.unstubAllGlobals();
	delete (window as any).__rmCounts;
	window.history.replaceState({}, '', '/search');
});

const results = [
	item('the-godfather', { title: 'The Godfather', category: 'Movies' }),
	item('halo', { title: 'Halo', category: 'Games', optionNames: 'Master Chief' }),
	item('alien', { title: 'Alien', category: 'Movies' }),
];

describe('SearchResults', () => {
	it('renders everything it was handed, in the server order', () => {
		const bar = filterBar();
		render(<SearchResults items={results} />, { container: bar.grid });
		expect(shownSlugs()).toEqual(['the-godfather', 'halo', 'alien']);
	});

	it('reports the result count in the filter bar', async () => {
		const bar = filterBar();
		render(<SearchResults items={results} />, { container: bar.grid });
		await flush();
		expect(bar.count.textContent).toContain('3');
	});

	it('uses the singular phrasing for exactly one result', async () => {
		const bar = filterBar();
		render(<SearchResults items={[results[0]]} />, { container: bar.grid });
		await flush();
		expect(bar.count.textContent).toBe('Showing 1 template');
	});

	it('filters as the user types, after the debounce', async () => {
		const bar = filterBar();
		render(<SearchResults items={results} />, { container: bar.grid });

		bar.input.value = 'godfather';
		bar.input.dispatchEvent(new Event('input'));
		await afterDebounce();

		expect(shownSlugs()).toEqual(['the-godfather']);
	});

	it('matches on option names, not just the title', async () => {
		const bar = filterBar();
		render(<SearchResults items={results} />, { container: bar.grid });

		bar.input.value = 'master chief';
		bar.input.dispatchEvent(new Event('input'));
		await afterDebounce();

		expect(shownSlugs()).toEqual(['halo']);
	});

	it('narrows to the chosen category', async () => {
		const bar = filterBar();
		render(<SearchResults items={results} />, { container: bar.grid });

		bar.select.value = 'Games';
		bar.select.dispatchEvent(new Event('change'));
		await flush();

		expect(shownSlugs()).toEqual(['halo']);
	});

	it('shows the empty state when nothing matches', async () => {
		const bar = filterBar();
		render(<SearchResults items={results} />, { container: bar.grid });

		bar.input.value = 'nothing matches this';
		bar.input.dispatchEvent(new Event('input'));
		await afterDebounce();

		expect(shownSlugs()).toEqual([]);
		expect(screen.getByRole('heading')).toBeInTheDocument();
	});

	it('reveals the clear button only while there is a query', async () => {
		const bar = filterBar();
		render(<SearchResults items={results} />, { container: bar.grid });
		await flush();
		expect(bar.clear.classList.contains('hidden')).toBe(true);

		bar.input.value = 'alien';
		bar.input.dispatchEvent(new Event('input'));
		await afterDebounce();

		expect(bar.clear.classList.contains('hidden')).toBe(false);
		expect(bar.reset.classList.contains('hidden')).toBe(false);
	});

	it('clears the query when the clear button is pressed', async () => {
		const bar = filterBar();
		render(<SearchResults items={results} />, { container: bar.grid });

		bar.input.value = 'alien';
		bar.input.dispatchEvent(new Event('input'));
		await afterDebounce();

		bar.clear.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect(bar.input.value).toBe('');
		expect(shownSlugs()).toHaveLength(3);
	});

	it('resets both filters at once, syncing the enhanced dropdown', async () => {
		const bar = filterBar();
		const synced = vi.fn();
		bar.select.addEventListener(SELECT_SYNC_EVENT, synced);
		render(<SearchResults items={results} />, { container: bar.grid });

		bar.input.value = 'alien';
		bar.input.dispatchEvent(new Event('input'));
		bar.select.value = 'Movies';
		bar.select.dispatchEvent(new Event('change'));
		await afterDebounce();

		bar.reset.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect(bar.input.value).toBe('');
		expect(bar.select.value).toBe('');
		expect(synced).toHaveBeenCalled();
		expect(shownSlugs()).toHaveLength(3);
	});

	it('applies a deep link’s query and category on load', async () => {
		window.history.replaceState({}, '', '/search?q=alien&category=Movies');
		const bar = filterBar();
		render(<SearchResults items={results} />, { container: bar.grid });
		await flush();

		expect(bar.input.value).toBe('alien');
		expect(bar.select.value).toBe('Movies');
		expect(shownSlugs()).toEqual(['alien']);
	});

	it('refreshes live ranking counts without moving the server-rendered cards', async () => {
		const bar = filterBar();
		render(<SearchResults items={results} />, { container: bar.grid });
		await flush();

		(window as any).__rmCounts = { alien: 50, halo: 10, 'the-godfather': 1 };
		document.dispatchEvent(new CustomEvent('rm:counts'));
		await flush();

		expect(shownSlugs()).toEqual(['the-godfather', 'halo', 'alien']);
		expect(rankedText('alien')).toBe('50 ranked');
		expect(rankedText('halo')).toBe('10 ranked');
		expect(rankedText('the-godfather')).toBe('1 ranked');
	});

	it('uses live counts that arrived before the island subscribed', async () => {
		(window as any).__rmCounts = { alien: 50, halo: 10, 'the-godfather': 1 };
		const bar = filterBar();
		render(<SearchResults items={results} />, { container: bar.grid });
		await flush();

		expect(shownSlugs()).toEqual(['the-godfather', 'halo', 'alien']);
		expect(rankedText('alien')).toBe('50 ranked');
	});

	it('keeps each cover attached to its template when live counts refresh', async () => {
		const coveredResults = results.map((result) => ({
			...result,
			cover_image: `https://img.test/${result.slug}.webp`,
		}));
		const bar = filterBar();
		const serverRender = render(<SearchResults items={coveredResults} />, {
			container: bar.grid,
		});
		await flush();
		const serverMarkup = bar.grid.innerHTML;
		serverRender.unmount();
		bar.grid.innerHTML = serverMarkup;
		hydrate(<SearchResults items={coveredResults} />, bar.grid);
		await flush();
		(window as any).__rmCounts = { alien: 50, halo: 10, 'the-godfather': 1 };
		document.dispatchEvent(new CustomEvent('rm:counts'));
		await flush();
		expect(shownSlugs()).toEqual(['the-godfather', 'halo', 'alien']);

		for (const result of coveredResults) {
			const { slug, title } = result;
			const card = document.querySelector<HTMLAnchorElement>(
				`a[href="/template/${slug}"]`
			);
			expect(card).not.toBeNull();
			expect(card!.querySelector('img')).toHaveAttribute(
				'src',
				`https://img.test/${slug}.webp`
			);
			expect(card!.querySelector('img')).toHaveAttribute('alt', title);
		}
	});

	it('keeps the server order until the counts arrive', async () => {
		const bar = filterBar();
		render(<SearchResults items={results} />, { container: bar.grid });
		await flush();
		expect(shownSlugs()).toEqual(['the-godfather', 'halo', 'alien']);
	});

	it('swaps in a mature viewer’s listing', async () => {
		vi.resetModules();
		const mature = await import('../scripts/mature-listing');
		const { default: Island } = await import('./SearchResults');
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				json: async () => ({ items: [item('spicy')] }),
			}))
		);

		const bar = filterBar();
		render(<Island items={results} />, { container: bar.grid });
		mature.publishMaturePreference(true);
		await flush();
		await flush();

		expect(shownSlugs()).toEqual(['spicy']);
	});
});
