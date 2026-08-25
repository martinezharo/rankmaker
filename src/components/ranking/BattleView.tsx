/**
 * The duel screen: progress, the two options, and the controls.
 *
 * All of it renders from `SessionState` — the session decides what to ask, this
 * decides what that looks like. Timing lives here because it is presentation:
 * a pick glows, then slides out, and only then is reported to the session, so
 * the animation and the state change can't race.
 *
 * Card entrance animations restart because the cards are keyed by the duel;
 * a new duel remounts them. The DOM version had to strip six animation classes
 * and force a reflow to get the same effect.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import DuelCard, { type CardMotion, type DuelSide } from './DuelCard';
import type { RankingItem, SessionState } from '../../lib/ranking-session';
import type { TFunction } from '../../i18n';

/** Winner glow before the cards start leaving. */
const WINNER_GLOW_MS = 300;
/** Slide-out before the next duel is requested. */
const PICK_EXIT_MS = 280;
/** A skip has no winner, so it leaves sooner and together. */
const SKIP_HOLD_MS = 120;
const SKIP_EXIT_MS = 260;

export interface BattleViewProps {
	state: SessionState;
	title: string;
	t: TFunction;
	atMinimum: boolean;
	onPick: (side: DuelSide) => void;
	onSkip: () => void;
	onUndo: () => void;
	onFinishEarly: () => void;
	onRemove: (item: RankingItem) => void;
}

export default function BattleView({
	state,
	title,
	t,
	atMinimum,
	onPick,
	onSkip,
	onUndo,
	onFinishEarly,
	onRemove,
}: BattleViewProps) {
	/** The answer being animated, if any. Blocks double-answers. */
	const [leaving, setLeaving] = useState<'a' | 'b' | 'skip' | null>(null);
	const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

	const duel = state.duel;
	const duelKey = duel ? `${duel.a.id}-${duel.b.id}-${state.round}` : 'none';

	// A new duel (or an undo) clears any animation left over from the last one.
	useEffect(() => {
		setLeaving(null);
		return () => {
			timers.current.forEach(clearTimeout);
			timers.current = [];
		};
	}, [duelKey]);

	const after = (ms: number, fn: () => void) => {
		timers.current.push(setTimeout(fn, ms));
	};

	function answer(side: DuelSide) {
		if (leaving || !duel) return;
		setLeaving(side);
		after(WINNER_GLOW_MS + PICK_EXIT_MS, () => onPick(side));
	}

	function defer() {
		if (leaving || !duel || !state.canSkip) return;
		setLeaving('skip');
		after(SKIP_HOLD_MS + SKIP_EXIT_MS, () => onSkip());
	}

	/** How each card should animate given the answer in flight. */
	function motion(side: DuelSide): CardMotion {
		if (!leaving) return 'in';
		if (leaving === 'skip') return 'skip';
		if (leaving === side) return 'winner';
		// The loser leaves the way the winner isn't going.
		return leaving === 'a' ? 'out-right' : 'out-left';
	}

	const percent = Math.min(
		100,
		Math.round((state.round / Math.max(state.total, 1)) * 100)
	);

	return (
		<section
			id="battle-view"
			class={`min-h-[calc(100dvh-4rem)] animate-battle-enter ${state.finalRound ? 'final-round' : ''}`}
		>
			<div class="sticky top-16 z-30 bg-surface/90 backdrop-blur-xl border-b border-border/50">
				<div class="mx-auto max-w-4xl px-4 sm:px-6 py-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
					<div class="flex items-center gap-3">
						<span
							id="battle-progress"
							role="status"
							aria-live="polite"
							aria-atomic="true"
							class="text-sm font-semibold text-text-primary whitespace-nowrap"
							data-rm-tip={t('tooltip.progress')}
							data-rm-tip-placement="bottom"
						>
							{t('ranking.roundProgress', {
								current: state.round,
								total: state.total,
							})}
						</span>
						<div class="flex-1 sm:flex-none sm:w-32 h-1.5 rounded-full bg-border overflow-hidden">
							<div
								id="battle-progress-bar"
								class="h-full bg-gradient-to-r from-primary to-primary-light rounded-full transition-all duration-500"
								style={`width: ${percent}%`}
							/>
						</div>
						{state.pendingSkips > 0 && (
							<span
								id="battle-skipped-count"
								role="status"
								aria-live="polite"
								aria-atomic="true"
								class="whitespace-nowrap text-[11px] font-semibold text-sky-400"
							>
								{t('ranking.skippedCount', { n: state.pendingSkips })}
							</span>
						)}
					</div>

					<div class="flex items-center justify-between gap-1 sm:justify-end sm:gap-2">
						<button
							id="battle-undo-btn"
							type="button"
							disabled={!state.canUndo || leaving !== null}
							onClick={onUndo}
							data-rm-tip={t('tooltip.undo')}
							data-rm-tip-placement="bottom"
							class="inline-flex items-center justify-center min-h-11 px-3 py-2 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
						>
							<i class="fa-solid fa-rotate-left mr-1" />
							{t('ranking.undo')}
						</button>
						{state.canSkip && (
							<button
								id="battle-skip-btn"
								type="button"
								onClick={defer}
								data-rm-tip={t('tooltip.skip')}
								data-rm-tip-placement="bottom"
								class="inline-flex items-center justify-center min-h-11 px-3 py-2 rounded-lg text-xs font-medium text-sky-400 hover:text-sky-300 hover:bg-sky-400/10 transition-colors"
							>
								<i class="fa-solid fa-forward mr-1" />
								{t('ranking.skipForLater')}
							</button>
						)}
						<button
							id="battle-finish-btn"
							type="button"
							onClick={onFinishEarly}
							data-rm-tip={t('tooltip.finishEarly')}
							data-rm-tip-placement="bottom"
							class="inline-flex items-center justify-center min-h-11 px-3 py-2 rounded-lg text-xs font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 transition-colors"
						>
							<i class="fa-solid fa-flag-checkered mr-1" />
							{t('ranking.finishEarly')}
						</button>
					</div>
				</div>
			</div>

			<div class="text-center mt-6 mb-2 px-4">
				<p class="text-xs text-text-muted uppercase tracking-widest font-semibold">
					{t('ranking.rankingLabel')}
				</p>
				<h2 id="battle-title" class="text-lg sm:text-xl font-bold text-text-primary mt-1">
					{title}
				</h2>
			</div>

			<div class="mx-auto max-w-4xl px-4 sm:px-6 py-4 sm:py-6 flex flex-col items-center">
				<div class="w-full flex flex-col xs:flex-row items-center xs:items-stretch justify-center gap-4 xs:gap-3 sm:gap-6 relative">
					{duel && (
						<DuelCard
							key={`a-${duelKey}`}
							item={duel.a}
							side="a"
							motion={motion('a')}
							removeDisabled={atMinimum}
							removeLabel={t('ranking.removeOptionAria', { name: duel.a.name })}
							removeTip={
								atMinimum ? t('ranking.removeMinNotice') : t('tooltip.removeOption')
							}
							onPick={() => answer('a')}
							onRemove={() => onRemove(duel.a)}
						/>
					)}

					<div class="shrink-0 z-10 xs:absolute xs:left-1/2 xs:top-1/2 xs:-translate-x-1/2 xs:-translate-y-1/2">
						<div class="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-surface border-2 border-primary/40 flex items-center justify-center animate-vs-pulse">
							<span class="text-sm sm:text-lg font-black uppercase text-gradient-gold">
								{t('ranking.vs')}
							</span>
						</div>
					</div>

					{duel && (
						<DuelCard
							key={`b-${duelKey}`}
							item={duel.b}
							side="b"
							motion={motion('b')}
							removeDisabled={atMinimum}
							removeLabel={t('ranking.removeOptionAria', { name: duel.b.name })}
							removeTip={
								atMinimum ? t('ranking.removeMinNotice') : t('tooltip.removeOption')
							}
							onPick={() => answer('b')}
							onRemove={() => onRemove(duel.b)}
						/>
					)}
				</div>

				<p id="battle-hint" class="mt-6 sm:mt-8 text-sm text-text-muted text-center">
					{state.finalRound ? t('ranking.noSkipping') : t('ranking.tapPreferred')}
				</p>
			</div>
		</section>
	);
}
