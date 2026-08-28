// @vitest-environment happy-dom
/**
 * Drag-to-reorder. SortableJS is a third-party library and is stubbed here —
 * what this owns, and what breaks the ranking if it is wrong, is the glue:
 * the options it is configured with, and reading the dropped order back out of
 * the DOM.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '../test/dom';

const created: {
	element: HTMLElement;
	options: Record<string, any>;
	option: ReturnType<typeof vi.fn>;
	destroy: ReturnType<typeof vi.fn>;
}[] = [];

vi.mock('sortablejs', () => ({
	default: {
		create: vi.fn((element: HTMLElement, options: Record<string, any>) => {
			const instance = {
				element,
				options,
				option: vi.fn(),
				destroy: vi.fn(),
			};
			created.push(instance);
			return instance;
		}),
	},
}));

function list(...ids: string[]) {
	mount(`
		<div id="results-list">
			${ids
				.map(
					(id) =>
						`<div class="rank-item" data-item-id="${id}">
							<span class="rank-drag-handle"></span>
						</div>`
				)
				.join('')}
		</div>
	`);
	return document.getElementById('results-list')!;
}

const latest = () => created[created.length - 1];

beforeEach(() => {
	created.length = 0;
});
afterEach(() => {
	vi.clearAllMocks();
});

describe('createReorder', () => {
	it('starts disabled — the page turns reordering on', async () => {
		const { createReorder } = await import('./ranking-reorder');
		createReorder(list('1', '2'), { onEnd: vi.fn() });
		expect(latest().options.disabled).toBe(true);
	});

	it('drags whole rows by their handle only', async () => {
		const { createReorder } = await import('./ranking-reorder');
		createReorder(list('1', '2'), { onEnd: vi.fn() });

		expect(latest().options.handle).toBe('.rank-drag-handle');
		expect(latest().options.draggable).toBe('.rank-item');
	});

	it('uses the fallback drag, which is what works on touch', async () => {
		const { createReorder } = await import('./ranking-reorder');
		createReorder(list('1', '2'), { onEnd: vi.fn() });

		expect(latest().options.forceFallback).toBe(true);
		expect(latest().options.supportPointer).toBe(false);
		expect(latest().options.fallbackOnBody).toBe(true);
	});

	it('auto-scrolls, because a ranking can be 50 rows long', async () => {
		const { createReorder } = await import('./ranking-reorder');
		createReorder(list('1', '2'), { onEnd: vi.fn() });
		expect(latest().options.scroll).toBe(true);
	});

	it('reports the dropped order, read from the live DOM', async () => {
		const { createReorder } = await import('./ranking-reorder');
		const element = list('1', '2', '3');
		const onEnd = vi.fn();
		createReorder(element, { onEnd });

		// SortableJS has already moved the rows by the time onEnd fires.
		element.append(element.firstElementChild!);
		latest().options.onEnd();

		expect(onEnd).toHaveBeenCalledWith(['2', '3', '1']);
	});

	it('reports an empty string for a row with no id rather than dropping it', async () => {
		const { createReorder } = await import('./ranking-reorder');
		const element = list('1');
		element.querySelector('.rank-item')!.removeAttribute('data-item-id');
		const onEnd = vi.fn();
		createReorder(element, { onEnd });

		latest().options.onEnd();
		expect(onEnd).toHaveBeenCalledWith(['']);
	});

	it('forwards the live mid-drag change, so rows can renumber', async () => {
		const { createReorder } = await import('./ranking-reorder');
		const onChange = vi.fn();
		createReorder(list('1', '2'), { onEnd: vi.fn(), onChange });

		latest().options.onChange();
		expect(onChange).toHaveBeenCalledTimes(1);
	});

	it('is fine without an onChange handler', async () => {
		const { createReorder } = await import('./ranking-reorder');
		createReorder(list('1', '2'), { onEnd: vi.fn() });
		expect(() => latest().options.onChange()).not.toThrow();
	});

	it('turns dragging on and off', async () => {
		const { createReorder } = await import('./ranking-reorder');
		const controller = createReorder(list('1', '2'), { onEnd: vi.fn() });

		controller.setEnabled(true);
		expect(latest().option).toHaveBeenCalledWith('disabled', false);

		controller.setEnabled(false);
		expect(latest().option).toHaveBeenCalledWith('disabled', true);
	});

	it('tears itself down', async () => {
		const { createReorder } = await import('./ranking-reorder');
		const controller = createReorder(list('1'), { onEnd: vi.fn() });

		controller.destroy();
		expect(latest().destroy).toHaveBeenCalledTimes(1);
	});
});
