/** The ordered result rows. SortableJS owns their temporary drag order; Preact
 * remains the source of truth before and after a completed drop. */
import type { RankingItem } from '../../lib/ranking-session';

export interface ResultsListProps {
	ranked: readonly RankingItem[];
	reordering?: boolean;
	animate?: boolean;
}

const positionClass = (index: number): string => {
	if (index === 0) return 'medal-gold text-xl font-black';
	if (index === 1) return 'medal-silver text-xl font-black';
	if (index === 2) return 'medal-bronze text-xl font-black';
	return 'bg-border/60 text-text-muted text-lg font-black';
};

export default function ResultsList({
	ranked,
	reordering = false,
	animate = true,
}: ResultsListProps) {
	return (
		<div id="results-list" class="space-y-2">
			{ranked.map((item, index) => (
				<div
					key={item.id}
					data-item-id={item.id}
					class={`rank-item flex items-center gap-3 sm:gap-4 p-3 rounded-xl border ${
						index < 3
							? 'bg-primary/5 border-primary/15'
							: 'bg-surface-elevated border-border'
					} ${animate ? 'animate-rank-slide' : ''}`}
					style={animate ? `animation-delay:${0.6 + index * 0.06}s` : undefined}
				>
					<div
						class={`rank-pos flex items-center justify-center w-12 h-12 rounded-xl shrink-0 ${positionClass(index)}`}
					>
						{index + 1}
					</div>
					<div class="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden bg-surface shrink-0">
						{item.image && (
							<img
								src={item.image}
								alt={item.name}
								class="w-full h-full object-cover"
							/>
						)}
					</div>
					<p class="text-base font-semibold text-text-primary flex-1 line-clamp-1">
						{item.name}
					</p>
					<span
						class={`${reordering ? 'flex' : 'hidden'} rank-drag-handle items-center justify-center w-10 h-10 rounded-lg bg-border/40 text-text-secondary cursor-grab active:cursor-grabbing shrink-0 touch-none`}
					>
						<i class="fa-solid fa-grip-vertical" />
					</span>
				</div>
			))}
		</div>
	);
}
