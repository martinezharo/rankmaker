// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { SELECT_SYNC_EVENT, setSelectValue } from './select-sync';
import { mount } from '../test/dom';

function select(): HTMLSelectElement {
	mount(`
		<select id="category-select">
			<option value="">All</option>
			<option value="Movies">Movies</option>
		</select>
	`);
	return document.getElementById('category-select') as HTMLSelectElement;
}

describe('setSelectValue', () => {
	it('sets the native value', () => {
		const element = select();
		setSelectValue(element, 'Movies');
		expect(element.value).toBe('Movies');
	});

	it('tells the enhanced trigger to repaint', () => {
		const element = select();
		const listener = vi.fn();
		element.addEventListener(SELECT_SYNC_EVENT, listener);

		setSelectValue(element, 'Movies');

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('does not fire `change`, matching the native behaviour', () => {
		const element = select();
		const onChange = vi.fn();
		element.addEventListener('change', onChange);

		setSelectValue(element, 'Movies');

		expect(onChange).not.toHaveBeenCalled();
	});

	it('clears back to the empty option', () => {
		const element = select();
		setSelectValue(element, 'Movies');
		setSelectValue(element, '');
		expect(element.value).toBe('');
	});
});
