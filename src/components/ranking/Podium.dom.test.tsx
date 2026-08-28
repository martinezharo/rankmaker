// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import Podium from './Podium';
import ResultsList from './ResultsList';
import type { RankingItem } from '../../lib/ranking-session';
import { render } from '../../test/dom';
import { useTranslations } from '../../i18n/server';

const t = useTranslations('en');

const items = (count: number): RankingItem[] =>
	Array.from(
		{ length: count },
		(_, i) =>
			({
				id: i + 1,
				name: `Option ${i + 1}`,
				image: `https://img.test/${i + 1}.webp`,
			}) as RankingItem
	);

const names = () =>
	[...document.querySelectorAll('#results-podium p')].map((p) => p.textContent);

describe('Podium', () => {
	it('stands the winner in the middle, between the runners-up', () => {
		render(<Podium ranked={items(3)} t={t} />);
		expect(names()).toEqual(['Option 2', 'Option 1', 'Option 3']);
	});

	it('leaves the third step empty when only two were ranked', () => {
		render(<Podium ranked={items(2)} t={t} />);
		expect(names()).toEqual(['Option 1', 'Option 2']);
		expect(document.querySelectorAll('#results-podium > div')).toHaveLength(3);
	});

	it('stands a lone winner in the middle with both sides empty', () => {
		render(<Podium ranked={items(1)} t={t} />);
		expect(names()).toEqual(['Option 1']);
	});

	it('shows only the top three, however long the ranking', () => {
		render(<Podium ranked={items(10)} t={t} />);
		expect(names()).toHaveLength(3);
	});

	it('crowns the winner and nobody else', () => {
		render(<Podium ranked={items(3)} t={t} />);
		const crowns = document.querySelectorAll('.fa-crown');
		expect(crowns).toHaveLength(1);
		expect(crowns[0].closest('div')).toHaveTextContent('Option 1');
	});

	it('labels each step', () => {
		render(<Podium ranked={items(3)} t={t} />);
		expect(document.getElementById('results-podium')).toHaveTextContent(
			t('ranking.podium1')
		);
	});

	it('replays no entrance on a reorder redraw', () => {
		render(<Podium ranked={items(3)} t={t} animate={false} />);
		expect(document.querySelector('.animate-crown')).toBeNull();
		for (const step of document.querySelectorAll('#results-podium > div')) {
			expect((step as HTMLElement).style.animationDelay || '0s').toBe('0s');
		}
	});

	it('staggers the entrance on the first paint', () => {
		render(<Podium ranked={items(3)} t={t} />);
		expect(document.querySelector('.animate-crown')).toBeTruthy();
	});

	it('renders an image-less option without a broken image', () => {
		render(
			<Podium
				ranked={[{ id: 1, name: 'No image', image: null } as RankingItem]}
				t={t}
			/>
		);
		expect(document.querySelector('#results-podium img')).toBeNull();
	});
});

describe('ResultsList', () => {
	const rows = () => [...document.querySelectorAll('.rank-item')];

	it('renders every option in order, numbered from one', () => {
		render(<ResultsList ranked={items(4)} />);
		expect(rows()).toHaveLength(4);
		expect(
			rows().map((row) => row.querySelector('.rank-pos')!.textContent)
		).toEqual(['1', '2', '3', '4']);
	});

	it('keys each row by option id, which the reorder script reads back', () => {
		render(<ResultsList ranked={items(2)} />);
		expect(rows().map((row) => row.getAttribute('data-item-id'))).toEqual([
			'1',
			'2',
		]);
	});

	it('medals the top three and nothing below', () => {
		render(<ResultsList ranked={items(4)} />);
		const classes = rows().map((row) => row.querySelector('.rank-pos')!.className);
		expect(classes[0]).toContain('medal-gold');
		expect(classes[1]).toContain('medal-silver');
		expect(classes[2]).toContain('medal-bronze');
		expect(classes[3]).not.toContain('medal');
	});

	it('hides the drag handles until reordering is turned on', () => {
		render(<ResultsList ranked={items(2)} />);
		for (const handle of document.querySelectorAll('.rank-drag-handle')) {
			expect(handle.className).toContain('hidden');
		}
	});

	it('shows the drag handles while reordering', () => {
		render(<ResultsList ranked={items(2)} reordering />);
		for (const handle of document.querySelectorAll('.rank-drag-handle')) {
			expect(handle.className).toContain('flex');
			expect(handle.className).not.toContain('hidden');
		}
	});

	it('replays no entrance after a reorder', () => {
		render(<ResultsList ranked={items(2)} animate={false} />);
		expect(document.querySelector('.animate-rank-slide')).toBeNull();
	});

	it('staggers the entrance on the first paint', () => {
		render(<ResultsList ranked={items(2)} />);
		expect(document.querySelectorAll('.animate-rank-slide')).toHaveLength(2);
	});

	it('renders an empty ranking as an empty list, not a crash', () => {
		render(<ResultsList ranked={[]} />);
		expect(document.getElementById('results-list')).toBeEmptyDOMElement();
	});
});
