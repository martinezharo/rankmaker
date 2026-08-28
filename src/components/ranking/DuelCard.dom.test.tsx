// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import DuelCard, { type CardMotion, type DuelSide } from './DuelCard';
import type { RankingItem } from '../../lib/ranking-session';
import { fireEvent, render } from '../../test/dom';

const item = (overrides: Partial<RankingItem> = {}): RankingItem =>
	({ id: 1, name: 'Alien', image: 'https://img.test/alien.webp', ...overrides }) as RankingItem;

function renderCard(
	overrides: Partial<Parameters<typeof DuelCard>[0]> = {}
) {
	const onPick = vi.fn();
	const onRemove = vi.fn();
	const result = render(
		<DuelCard
			item={item()}
			side="a"
			motion="in"
			removeDisabled={false}
			removeLabel="Remove option"
			removeTip="Remove this option"
			onPick={onPick}
			onRemove={onRemove}
			{...overrides}
		/>
	);
	return { ...result, onPick, onRemove };
}

const card = () => document.querySelector('.battle-card')!;

describe('DuelCard', () => {
	it('carries the id and name the engine and the e2e suite key on', () => {
		renderCard();
		expect(card()).toHaveAttribute('data-item-id', '1');
		expect(card()).toHaveAttribute('id', 'battle-card-a');
		expect(document.getElementById('battle-name-a')).toHaveTextContent('Alien');
	});

	it('picks when the card is clicked', () => {
		const { onPick } = renderCard();
		fireEvent.click(card());
		expect(onPick).toHaveBeenCalledTimes(1);
	});

	it('is operable from the keyboard, like the button it looks like', () => {
		const { onPick } = renderCard();
		for (const key of ['Enter', ' ']) {
			fireEvent.keyDown(card(), { key });
		}
		expect(onPick).toHaveBeenCalledTimes(2);
	});

	it('ignores other keys', () => {
		const { onPick } = renderCard();
		fireEvent.keyDown(card(), { key: 'a' });
		fireEvent.keyDown(card(), { key: 'Tab' });
		expect(onPick).not.toHaveBeenCalled();
	});

	it('announces itself as a focusable button to assistive tech', () => {
		renderCard();
		expect(card()).toHaveAttribute('role', 'button');
		expect(card()).toHaveAttribute('tabindex', '0');
	});

	it('removes without also counting as a pick', () => {
		const { onPick, onRemove } = renderCard();
		fireEvent.click(document.getElementById('battle-remove-a')!);
		expect(onRemove).toHaveBeenCalledTimes(1);
		expect(onPick).not.toHaveBeenCalled();
	});

	it('refuses to remove at the option floor, but stays focusable to explain why', () => {
		const { onRemove } = renderCard({ removeDisabled: true });
		const button = document.getElementById('battle-remove-a')!;

		fireEvent.click(button);

		expect(onRemove).not.toHaveBeenCalled();
		expect(button).toHaveAttribute('aria-disabled', 'true');
		// Not the `disabled` attribute: that would kill the tooltip that says why.
		expect(button).not.toHaveAttribute('disabled');
		expect(button).toHaveAttribute('data-rm-tip', 'Remove this option');
	});

	it('shows the option image when it has one', () => {
		renderCard();
		expect(document.querySelector('img')).toHaveAttribute(
			'src',
			'https://img.test/alien.webp'
		);
	});

	it('falls back to a coloured name plate when the image fails to load', () => {
		renderCard();
		fireEvent.error(document.querySelector('img')!);
		expect(document.querySelector('img')).toBeNull();
		expect(card()).toHaveTextContent('Alien');
	});

	it('treats the legacy placeholder host and a stringified null as no image', () => {
		for (const image of [
			null,
			'',
			'null',
			'https://placehold.co/200x200/111118/8400FF?text=Alien',
		]) {
			document.body.innerHTML = '';
			renderCard({ item: item({ image: image as string }) });
			expect(document.querySelector('img'), String(image)).toBeNull();
		}
	});

	it('enters from its own side and leaves back towards it', () => {
		const cases: [DuelSide, CardMotion, string][] = [
			['a', 'in', 'animate-slide-left'],
			['b', 'in', 'animate-slide-right'],
			['a', 'out', 'animate-out-left'],
			['b', 'out', 'animate-out-right'],
		];
		for (const [side, motion, expected] of cases) {
			document.body.innerHTML = '';
			renderCard({ side, motion });
			expect(
				document.querySelector('.battle-card')!.className,
				`${side}/${motion}`
			).toContain(expected);
		}
	});

	it('glows in place before it leaves, then keeps the glow on the way out', () => {
		document.body.innerHTML = '';
		renderCard({ motion: 'winner' });
		expect(card().className).toContain('battle-card-winner');
		expect(card().className).not.toContain('animate-out');

		document.body.innerHTML = '';
		renderCard({ motion: 'winner-out' });
		expect(card().className).toContain('battle-card-winner');
		expect(card().className).toContain('animate-out-left');
	});

	it('carries no animation while holding, so nothing pins its transform', () => {
		renderCard({ motion: 'hold' });
		expect(card().className).not.toContain('animate-');
	});

	it('plays the shared skip exit for a deferred duel', () => {
		renderCard({ motion: 'skip' });
		expect(card().className).toContain('animate-skip-out');
	});

	it('renders a hostile option name as text', () => {
		renderCard({ item: item({ name: '<img src=x onerror=alert(1)>', image: null }) });
		expect(document.querySelector('img[src="x"]')).toBeNull();
		expect(document.getElementById('battle-name-a')).toHaveTextContent(
			'<img src=x onerror=alert(1)>'
		);
	});
});
