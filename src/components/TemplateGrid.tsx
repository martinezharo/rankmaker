/**
 * A grid of TemplateCards. Purely presentational — it renders exactly the
 * items it is handed.
 *
 * Two things drive it: ListingGrid (which swaps in a mature viewer's own
 * listing) and SearchResults (which filters). Both render through this so the
 * cards are identical wherever they appear.
 */
import { Fragment } from 'preact';
import type { ComponentChildren } from 'preact';
import TemplateCard from './TemplateCard';
import type { ListingItem } from '../lib/listings';
import { defaultLocale, type Locale } from '../i18n/config';

export interface TemplateGridProps {
	items: ListingItem[];
	locale?: Locale;
	headingLevel?: 'h2' | 'h3';
	class?: string;
	/**
	 * Wrapper class for each card. The home rows are a horizontal scroller on
	 * mobile and need a per-card width; the plain grids don't wrap at all.
	 */
	itemClass?: string;
	/** Rendered instead of the grid when there is nothing to show. */
	empty?: ComponentChildren;
}

const DEFAULT_GRID = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4';

export default function TemplateGrid({
	items,
	locale = defaultLocale,
	headingLevel = 'h3',
	class: className = DEFAULT_GRID,
	itemClass,
	empty = null,
}: TemplateGridProps) {
	if (items.length === 0) return <>{empty}</>;

	return (
		<div class={className}>
			{items.map((item) => {
				const card = (
					<TemplateCard
						template={item}
						headingLevel={headingLevel}
						locale={locale}
					/>
				);
				return itemClass ? (
					<div key={item.slug} class={itemClass}>
						{card}
					</div>
				) : (
					<Fragment key={item.slug}>{card}</Fragment>
				);
			})}
		</div>
	);
}
