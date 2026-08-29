/**
 * The /search results grid.
 *
 * This island exists to delete a duplicate. /search used to ship a second card
 * renderer as a template string that "mirrors TemplateCard.astro" — and it had
 * already drifted from it (no share button, the wrong hover variant, the save
 * button in the wrong corner). Rendering results through the same TemplateCard
 * the server uses makes that class of bug impossible.
 *
 * The filter bar stays in Astro: the category dropdown is a custom component
 * with its own styling and keyboard handling, and there is no reason to
 * hydrate it. This subscribes to its DOM events, and writes back the two bits
 * of state that live on the bar itself (the result count and the
 * clear/reset affordances).
 */
import { useEffect, useMemo, useState } from 'preact/hooks';
import TemplateGrid from './TemplateGrid';
import { filterByCategory, matchesQuery, type ListingItem } from '../lib/listings';
import { subscribeListing } from '../scripts/mature-listing';
import { setSelectValue } from '../scripts/select-sync';
import { slugValue, type SlugValues } from '../lib/slug';
import { defaultLocale, type Locale } from '../i18n/config';
import { useTranslations } from '../i18n';

/** Debounce for typing in the search box, in milliseconds. */
const INPUT_DEBOUNCE_MS = 150;

/**
 * The live ranking counts Layout.astro fetches, or undefined before they land
 * (and always on the server, where this component also renders).
 */
function liveCounts(): SlugValues | undefined {
	if (typeof window === 'undefined') return undefined;
	return (window as unknown as { __rmCounts?: SlugValues }).__rmCounts;
}

export interface SearchResultsProps {
	items: ListingItem[];
	locale?: Locale;
}

export default function SearchResults({
	items,
	locale = defaultLocale,
}: SearchResultsProps) {
	const t = useTranslations(locale);
	const [listing, setListing] = useState(items);
	const [query, setQuery] = useState('');
	const [category, setCategory] = useState('');
	const [rankingCounts, setRankingCounts] = useState<SlugValues>();
	/** True once a filter or viewer preference changes the server-rendered list. */
	const [clientOwnsGrid, setClientOwnsGrid] = useState(false);

	// A viewer who opted into mature content gets their own listing — the
	// server HTML is the shared, mature-free one (see src/lib/mature.ts).
	useEffect(
		() =>
			subscribeListing({}, (next) => {
				setClientOwnsGrid(true);
				setListing(next);
			}),
		[]
	);

	useEffect(() => {
		const input = document.getElementById('search-input') as HTMLInputElement | null;
		const select = document.getElementById('category-select') as HTMLSelectElement | null;
		const clearBtn = document.getElementById('search-clear');
		const resetBtn = document.getElementById('reset-filters');

		let timer: ReturnType<typeof setTimeout>;
		const onInput = () => {
			clearTimeout(timer);
			timer = setTimeout(() => {
				setClientOwnsGrid(true);
				setQuery(input?.value ?? '');
			}, INPUT_DEBOUNCE_MS);
		};
		const onCategory = () => {
			setClientOwnsGrid(true);
			setCategory(select?.value ?? '');
		};
		const onClear = () => {
			if (input) {
				input.value = '';
				input.focus();
			}
			setClientOwnsGrid(true);
			setQuery('');
		};
		const onReset = () => {
			if (input) input.value = '';
			// The enhanced dropdown needs the sync event, and deliberately does
			// not fire `change` — so update our own state directly.
			if (select) setSelectValue(select, '');
			setClientOwnsGrid(true);
			setQuery('');
			setCategory('');
		};
		const onCounts = () => {
			const next = liveCounts();
			if (next) setRankingCounts(next);
		};

		input?.addEventListener('input', onInput);
		select?.addEventListener('change', onCategory);
		clearBtn?.addEventListener('click', onClear);
		resetBtn?.addEventListener('click', onReset);
		document.addEventListener('rm:counts', onCounts);
		// Layout may finish its cached fetch before this island hydrates, in which
		// case the event has already fired. Consume the value it left behind.
		if (liveCounts()) onCounts();

		// Deep links: /search?q=…&category=…
		const params = new URLSearchParams(window.location.search);
		const q = params.get('q');
		const cat = params.get('category');
		if (q && input) {
			input.value = q;
			setClientOwnsGrid(true);
			setQuery(q);
		}
		if (cat && select) {
			setSelectValue(select, cat);
			setClientOwnsGrid(true);
			setCategory(cat);
		}

		return () => {
			clearTimeout(timer);
			input?.removeEventListener('input', onInput);
			select?.removeEventListener('change', onCategory);
			clearBtn?.removeEventListener('click', onClear);
			resetBtn?.removeEventListener('click', onReset);
			document.removeEventListener('rm:counts', onCounts);
		};
	}, []);

	const results = useMemo(() => {
		const scoped = category ? filterByCategory(listing, category) : listing;
		const matched = scoped.filter((item) => matchesQuery(item, query));
		// Keep the SSR order stable so covers never jump after first paint. The
		// page cache is short-lived; only the displayed count needs a live refresh.
		return rankingCounts
			? matched.map((item) => ({
					...item,
					times_ranked: slugValue(rankingCounts, item.slug),
				}))
			: matched;
	}, [listing, query, category, rankingCounts]);

	// The count and the filter-bar affordances live in the Astro markup.
	useEffect(() => {
		const count = document.getElementById('results-count');
		if (count) {
			count.textContent =
				results.length === 1
					? t('search.showingOne', { n: results.length })
					: t('search.showing', { n: results.length });
		}
		const clearBtn = document.getElementById('search-clear');
		clearBtn?.classList.toggle('hidden', !query);
		clearBtn?.classList.toggle('flex', !!query);
		document
			.getElementById('reset-filters')
			?.classList.toggle('hidden', !query && !category);
	}, [results.length, query, category, t]);

	const grid = (
		<TemplateGrid
			items={results}
			locale={locale}
			empty={
				<div class="text-center py-20 space-y-4">
					<div class="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
						<i class="fa-solid fa-magnifying-glass text-primary text-2xl" />
					</div>
					<h3 class="text-lg font-semibold text-text-primary">
						{t('search.emptyTitle')}
					</h3>
					<p class="text-sm text-text-muted max-w-md mx-auto">
						{t('search.emptyBody')}
					</p>
				</div>
			}
		/>
	);

	// Preact cannot recover list keys from server DOM. Change the boundary only
	// when a filter or preference changes the list, making that transition an
	// atomic client render without replacing the initial grid after page load.
	return clientOwnsGrid ? (
		<section data-search-results aria-labelledby="results-count">
			{grid}
		</section>
	) : (
		<div data-search-results>{grid}</div>
	);
}
