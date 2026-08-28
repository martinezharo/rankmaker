// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BattleView from './BattleView';
import type { RankingItem, SessionState } from '../../lib/ranking-session';
import { advanceTimers, fireEvent, render } from '../../test/dom';
import { useTranslations } from '../../i18n/server';

const t = useTranslations('en');

const option = (id: number, name: string): RankingItem =>
	({ id, name, image: null }) as RankingItem;

const state = (overrides: Partial<SessionState> = {}): SessionState =>
	({
		phase: 'battling',
		duel: { a: option(1, 'Alien'), b: option(2, 'Heat') },
		round: 3,
		total: 10,
		pendingSkips: 0,
		finalRound: false,
		canUndo: true,
		canSkip: true,
		excluded: new Set<string>(),
		history: [],
		ranked: null,
		...overrides,
	}) as SessionState;

function renderView(overrides: Partial<Parameters<typeof BattleView>[0]> = {}) {
	const handlers = {
		onPick: vi.fn(),
		onSkip: vi.fn(),
		onUndo: vi.fn(),
		onFinishEarly: vi.fn(),
		onRemove: vi.fn(),
	};
	const result = render(
		<BattleView
			state={state()}
			title="Best Movies"
			t={t}
			atMinimum={false}
			{...handlers}
			{...overrides}
		/>
	);
	return { ...result, ...handlers };
}

const cardA = () => document.getElementById('battle-card-a')!;
const cardB = () => document.getElementById('battle-card-b')!;

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
});

describe('BattleView', () => {
	it('shows the duel, the title and the progress', () => {
		renderView();
		expect(document.getElementById('battle-name-a')).toHaveTextContent('Alien');
		expect(document.getElementById('battle-name-b')).toHaveTextContent('Heat');
		expect(document.getElementById('battle-title')).toHaveTextContent(
			'Best Movies'
		);
		expect(document.getElementById('battle-progress')).toHaveTextContent('3');
		expect(document.getElementById('battle-progress')).toHaveTextContent('10');
	});

	it('announces progress politely, so a screen reader is not interrupted', () => {
		renderView();
		const progress = document.getElementById('battle-progress')!;
		expect(progress).toHaveAttribute('role', 'status');
		expect(progress).toHaveAttribute('aria-live', 'polite');
	});

	it('fills the progress bar in proportion to the round', () => {
		renderView({ state: state({ round: 5, total: 10 }) });
		expect(
			(document.getElementById('battle-progress-bar') as HTMLElement).style.width
		).toBe('50%');
	});

	it('never overfills the bar when the estimate is beaten', () => {
		renderView({ state: state({ round: 30, total: 10 }) });
		expect(
			(document.getElementById('battle-progress-bar') as HTMLElement).style.width
		).toBe('100%');
	});

	it('reports the pick only after the two animation beats', async () => {
		const { onPick } = renderView();

		fireEvent.click(cardA());
		expect(onPick).not.toHaveBeenCalled();

		// First beat: the winner glows in place, the loser just holds.
		expect(cardA().className).toContain('battle-card-winner');
		expect(cardB().className).not.toContain('animate-out');

		await advanceTimers(300);
		// Second beat: both leave, each towards its own side.
		expect(cardA().className).toContain('animate-out-left');
		expect(cardB().className).toContain('animate-out-right');
		expect(onPick).not.toHaveBeenCalled();

		await advanceTimers(280);
		expect(onPick).toHaveBeenCalledExactlyOnceWith('a');
	});

	it('reports the other side when the other card is picked', async () => {
		const { onPick } = renderView();
		fireEvent.click(cardB());
		await advanceTimers(600);
		expect(onPick).toHaveBeenCalledExactlyOnceWith('b');
	});

	it('ignores a second click while a pick is animating', async () => {
		const { onPick } = renderView();

		fireEvent.click(cardA());
		fireEvent.click(cardB());
		fireEvent.click(cardA());
		await advanceTimers(600);

		expect(onPick).toHaveBeenCalledExactlyOnceWith('a');
	});

	it('leaves both cards together on a deferral, with no winner glow', async () => {
		const { onSkip } = renderView();

		fireEvent.click(document.getElementById('battle-skip-btn')!);
		expect(cardA().className).not.toContain('battle-card-winner');

		await advanceTimers(120);
		expect(cardA().className).toContain('animate-skip-out');
		expect(cardB().className).toContain('animate-skip-out');

		await advanceTimers(260);
		expect(onSkip).toHaveBeenCalledTimes(1);
	});

	it('hides the skip control in the forced final round', () => {
		renderView({ state: state({ canSkip: false, finalRound: true }) });
		expect(document.getElementById('battle-skip-btn')).toBeNull();
		expect(document.getElementById('battle-view')!.className).toContain(
			'final-round'
		);
		expect(document.getElementById('battle-hint')).toHaveTextContent(
			t('ranking.noSkipping')
		);
	});

	it('shows how many duels are still deferred', () => {
		renderView({ state: state({ pendingSkips: 2 }) });
		expect(document.getElementById('battle-skipped-count')).toHaveTextContent(
			'2'
		);
	});

	it('says nothing about deferrals when there are none', () => {
		renderView();
		expect(document.getElementById('battle-skipped-count')).toBeNull();
	});

	it('disables undo until something has been answered', () => {
		renderView({ state: state({ canUndo: false }) });
		expect(document.getElementById('battle-undo-btn')).toBeDisabled();
	});

	it('disables undo while a pick is animating, so it cannot race', () => {
		renderView();
		fireEvent.click(cardA());
		expect(document.getElementById('battle-undo-btn')).toBeDisabled();
	});

	it('undoes and finishes early on demand', () => {
		const { onUndo, onFinishEarly } = renderView();
		fireEvent.click(document.getElementById('battle-undo-btn')!);
		fireEvent.click(document.getElementById('battle-finish-btn')!);
		expect(onUndo).toHaveBeenCalledTimes(1);
		expect(onFinishEarly).toHaveBeenCalledTimes(1);
	});

	it('removes the option the card belongs to', () => {
		const { onRemove, onPick } = renderView();
		fireEvent.click(document.getElementById('battle-remove-b')!);
		expect(onRemove).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ name: 'Heat' })
		);
		expect(onPick).not.toHaveBeenCalled();
	});

	it('explains why removing is refused at the option floor', () => {
		renderView({ atMinimum: true });
		expect(document.getElementById('battle-remove-a')).toHaveAttribute(
			'data-rm-tip',
			t('ranking.removeMinNotice')
		);
	});

	it('the incoming duel never wears the outgoing winner’s glow', async () => {
		const { rerender } = renderView();
		fireEvent.click(cardA());
		await advanceTimers(580);

		// The session hands over a fresh state for the next duel.
		rerender(
			<BattleView
				state={state({
					duel: { a: option(3, 'Heat'), b: option(4, 'Se7en') },
					round: 4,
				})}
				title="Best Movies"
				t={t}
				atMinimum={false}
				onPick={vi.fn()}
				onSkip={vi.fn()}
				onUndo={vi.fn()}
				onFinishEarly={vi.fn()}
				onRemove={vi.fn()}
			/>
		);

		expect(cardA().className).not.toContain('battle-card-winner');
		expect(cardA().className).not.toContain('animate-out');
		expect(cardA().className).toContain('animate-slide-left');
	});

	it('an undo restoring the same pair does not revive the old answer', async () => {
		const before = state();
		const { rerender } = renderView({ state: before });
		fireEvent.click(cardA());
		await advanceTimers(580);

		// Undo re-asks the identical duel at the identical round — a new state
		// object, but every field the same.
		rerender(
			<BattleView
				state={state()}
				title="Best Movies"
				t={t}
				atMinimum={false}
				onPick={vi.fn()}
				onSkip={vi.fn()}
				onUndo={vi.fn()}
				onFinishEarly={vi.fn()}
				onRemove={vi.fn()}
			/>
		);

		expect(cardA().className).not.toContain('battle-card-winner');
	});

	it('renders nothing to pick when the session has no duel', () => {
		renderView({ state: state({ duel: null }) });
		expect(document.getElementById('battle-card-a')).toBeNull();
		expect(document.getElementById('battle-card-b')).toBeNull();
	});

	it('does nothing on a deferral once skipping is disallowed', async () => {
		const { onSkip } = renderView({ state: state({ canSkip: false }) });
		await advanceTimers(600);
		expect(onSkip).not.toHaveBeenCalled();
	});
});
