/**
 * One side of a duel.
 *
 * A `role="button"` div rather than a real <button> because the remove control
 * is a nested button, which a <button> may not contain — so Enter/Space are
 * wired by hand to keep it operable like the button it looks like.
 */
import { useState } from 'preact/hooks';
import { stringToColor } from '../../lib/placeholder-color';
import type { RankingItem } from '../../lib/ranking-session';

export type DuelSide = 'a' | 'b';

/** How this card should be animating right now. */
export type CardMotion = 'in' | 'winner' | 'out-left' | 'out-right' | 'skip';

export interface DuelCardProps {
	item: RankingItem;
	side: DuelSide;
	motion: CardMotion;
	/** Removing is refused at the option floor, but stays focusable to explain why. */
	removeDisabled: boolean;
	removeLabel: string;
	removeTip: string;
	onPick: () => void;
	onRemove: () => void;
}

const MOTION_CLASS: Record<CardMotion, string> = {
	in: '',
	winner: 'battle-card-winner',
	'out-left': 'animate-out-left',
	'out-right': 'animate-out-right',
	skip: 'animate-skip-out',
};

/** The old seeded placeholder host; treat it as "no image". */
function hasImage(item: RankingItem): boolean {
	return (
		!!item.image && item.image !== 'null' && !item.image.includes('placehold.co')
	);
}

export default function DuelCard({
	item,
	side,
	motion,
	removeDisabled,
	removeLabel,
	removeTip,
	onPick,
	onRemove,
}: DuelCardProps) {
	const [failed, setFailed] = useState(false);
	const showImage = hasImage(item) && !failed;
	const entrance = side === 'a' ? 'animate-slide-left' : 'animate-slide-right';

	return (
		<div
			id={`battle-card-${side}`}
			data-item-id={item.id}
			role="button"
			tabIndex={0}
			onClick={onPick}
			onKeyDown={(event) => {
				// Only when the card itself has focus — not the nested button.
				if (event.target !== event.currentTarget) return;
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					onPick();
				}
			}}
			class={`battle-card group flex flex-col w-full xs:w-auto xs:flex-1 xs:min-w-0 sm:flex-none sm:w-72 rounded-2xl bg-surface-elevated border-2 border-border hover:border-primary/60 transition-all duration-200 overflow-hidden cursor-pointer active:scale-[0.97] ${entrance} ${MOTION_CLASS[motion]}`}
		>
			<div class="relative aspect-square shrink-0 overflow-hidden bg-surface">
				{showImage && (
					<img
						src={item.image!}
						alt={item.name}
						onError={() => setFailed(true)}
						class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
					/>
				)}
				{!showImage && (
					<div
						class="absolute inset-0 flex flex-col items-center justify-center p-3 sm:p-4 text-center bg-gradient-to-br from-surface-elevated to-surface border border-white/5"
						style={`--tw-gradient-to: ${stringToColor(item.name)}40;`}
					>
						<span class="font-bold text-text-primary/90 leading-tight text-base xs:text-lg sm:text-2xl line-clamp-3">
							{item.name}
						</span>
					</div>
				)}
				{/* `aria-disabled` rather than `disabled`: a disabled button gets no
				    pointer or focus events, so the tooltip explaining *why* it can't
				    be used would never open on the one control that needs it. */}
				<button
					id={`battle-remove-${side}`}
					type="button"
					aria-disabled={removeDisabled}
					aria-label={removeLabel}
					data-rm-tip={removeTip}
					data-rm-tip-placement="bottom"
					onClick={(event) => {
						// Don't let this bubble to the card and count as a pick.
						event.stopPropagation();
						if (removeDisabled) return;
						onRemove();
					}}
					class="absolute top-2 right-2 z-10 w-9 h-9 rounded-lg bg-black/55 backdrop-blur-sm text-white/80 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors aria-disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:hover:bg-black/55 aria-disabled:hover:text-white/80 cursor-pointer"
				>
					<i class="fa-solid fa-trash-can text-xs" />
				</button>
			</div>
			<div class="flex-1 flex items-center justify-center p-3 sm:p-4 min-h-[3.5rem]">
				<p class="text-sm sm:text-base font-bold text-text-primary text-center line-clamp-2">
					{item.name}
				</p>
			</div>
		</div>
	);
}
