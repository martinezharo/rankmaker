/**
 * The top-three podium.
 *
 * One implementation. The DOM version had this markup twice — once in the
 * initial results render and once in the renderer used after a manual reorder —
 * which is exactly the kind of drift a component makes impossible.
 */
import type { RankingItem } from '../../lib/ranking-session';
import type { TFunction } from '../../i18n';

interface Medal {
	bg: string;
	border: string;
	text: string;
	labelKey: string;
}

const MEDALS: Medal[] = [
	{
		bg: 'from-amber-400/20 to-amber-600/10',
		border: 'border-amber-400/60',
		text: 'text-amber-400',
		labelKey: 'ranking.podium1',
	},
	{
		bg: 'from-gray-300/15 to-gray-400/5',
		border: 'border-gray-400/50',
		text: 'text-gray-300',
		labelKey: 'ranking.podium2',
	},
	{
		bg: 'from-orange-400/15 to-orange-600/5',
		border: 'border-orange-500/40',
		text: 'text-orange-400',
		labelKey: 'ranking.podium3',
	},
];

/** Second, first, third — the winner stands in the middle, on the tallest step. */
const HEIGHTS = ['h-36 sm:h-44', 'h-48 sm:h-56', 'h-28 sm:h-36'];

/** Staggered rise: the winner first, then the runners-up. */
const RISE_DELAYS = ['0.2s', '0s', '0.4s'];

export interface PodiumProps {
	ranked: readonly RankingItem[];
	t: TFunction;
	/** Skip the entrance animation — a reorder redraw shouldn't replay it. */
	animate?: boolean;
}

export default function Podium({ ranked, t, animate = true }: PodiumProps) {
	const layout =
		ranked.length >= 3 ? [1, 0, 2] : ranked.length === 2 ? [null, 0, 1] : [null, 0, null];

	return (
		<div
			id="results-podium"
			class="flex items-end justify-center gap-2 sm:gap-4 mb-10 px-4"
		>
			{layout.map((index, position) => {
				if (index === null || index >= ranked.length) {
					return <div key={`gap-${position}`} class="w-28 sm:w-36" />;
				}
				const item = ranked[index]!;
				const medal = MEDALS[index]!;

				return (
					<div
						key={item.id}
						class="flex flex-col items-center w-28 sm:w-36 animate-podium-rise"
						style={`animation-delay:${animate ? RISE_DELAYS[position] : '0s'}`}
					>
						{index === 0 && (
							<i
								class={`fa-solid fa-crown text-amber-400 text-xl mb-2 ${animate ? 'animate-crown' : ''}`}
								style={animate ? 'animation-delay:0.8s' : undefined}
							/>
						)}
						<div
							class={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 ${medal.border} mb-3 shadow-lg`}
						>
							{item.image && (
								<img src={item.image} alt={item.name} class="w-full h-full object-cover" />
							)}
						</div>
						<p class="text-sm font-bold text-text-primary text-center line-clamp-2 mb-2">
							{item.name}
						</p>
						<div
							class={`w-full ${HEIGHTS[position]} rounded-t-2xl bg-gradient-to-t ${medal.bg} border-t-2 border-x-2 ${medal.border} flex items-start justify-center pt-3`}
						>
							<span
								class={`text-xs font-black ${medal.text} uppercase tracking-wider`}
							>
								{t(medal.labelKey)}
							</span>
						</div>
					</div>
				);
			})}
		</div>
	);
}
