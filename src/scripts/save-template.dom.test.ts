// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, flush, mount } from '../test/dom';

/** The module caches the saved-slug fetch per page load, so reimport it. */
async function loadModule() {
	vi.resetModules();
	return import('./save-template');
}

function page() {
	mount(`
		<button class="save-btn" data-slug="best-movies"
			data-save-aria="Save" data-unsave-aria="Unsave"
			data-save-tip="Save it" data-unsave-tip="Unsave it">
			<i class="fa-regular fa-bookmark"></i>
			<span class="save-label" data-label-save="Save" data-label-saved="Saved"></span>
		</button>
		<button class="save-btn" data-slug="best-games"
			data-save-aria="Save" data-unsave-aria="Unsave">
			<i class="fa-regular fa-bookmark"></i>
		</button>
		<div id="login-modal" class="hidden">
			<a id="login-modal-continue" href="#">Continue</a>
		</div>
	`);
}

const buttons = () => [...document.querySelectorAll<HTMLElement>('.save-btn')];

let fetchMock: ReturnType<typeof vi.fn>;

function stubApi(
	saved: string[] = [],
	post: { status?: number; reject?: boolean } = {}
) {
	fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
		if (init?.method === 'POST') {
			if (post.reject) throw new Error('offline');
			return { ok: (post.status ?? 200) < 400, status: post.status ?? 200 };
		}
		return { ok: true, json: async () => ({ slugs: saved }) };
	});
	vi.stubGlobal('fetch', fetchMock);
}

beforeEach(() => {
	vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
		fn(0);
		return 0;
	});
});
afterEach(() => {
	vi.unstubAllGlobals();
});

describe('initSaveButtons', () => {
	it('marks the templates this user already saved', async () => {
		page();
		stubApi(['best-movies']);
		const { initSaveButtons } = await loadModule();
		initSaveButtons();
		await flush();

		expect(buttons()[0].dataset.saved).toBe('1');
		expect(buttons()[0].querySelector('i')!.className).toContain('fa-solid');
		expect(buttons()[0]).toHaveAttribute('aria-label', 'Unsave');
		expect(buttons()[0]).toHaveAttribute('data-rm-tip', 'Unsave it');
		expect(buttons()[0].querySelector('.save-label')).toHaveTextContent('Saved');
		expect(buttons()[1].dataset.saved).toBeFalsy();
	});

	it('saves on click, painting before the request lands', async () => {
		page();
		stubApi([]);
		const { initSaveButtons } = await loadModule();
		initSaveButtons();
		await flush();

		click(buttons()[0]);
		expect(buttons()[0].dataset.saved).toBe('1');
		await flush();

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/me/saved',
			expect.objectContaining({
				body: JSON.stringify({ slug: 'best-movies', action: 'save' }),
			})
		);
	});

	it('unsaves an already-saved template', async () => {
		page();
		stubApi(['best-movies']);
		const { initSaveButtons } = await loadModule();
		initSaveButtons();
		await flush();

		click(buttons()[0]);
		await flush();

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/me/saved',
			expect.objectContaining({
				body: JSON.stringify({ slug: 'best-movies', action: 'unsave' }),
			})
		);
		expect(buttons()[0].dataset.saved).toBeFalsy();
		expect(buttons()[0].querySelector('i')!.className).toContain('fa-regular');
	});

	it('does not follow the card link it sits inside', async () => {
		page();
		stubApi([]);
		const { initSaveButtons } = await loadModule();
		initSaveButtons();
		await flush();

		const event = new MouseEvent('click', { bubbles: true, cancelable: true });
		buttons()[0].dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
	});

	it('undoes the optimistic paint and prompts when not signed in', async () => {
		page();
		stubApi([], { status: 401 });
		const { initSaveButtons } = await loadModule();
		initSaveButtons();
		await flush();

		click(buttons()[0]);
		await flush();

		expect(buttons()[0].dataset.saved).toBeFalsy();
		expect(document.getElementById('login-modal')!.classList).not.toContain(
			'hidden'
		);
	});

	it('reverts when the request is refused', async () => {
		page();
		stubApi([], { status: 500 });
		const { initSaveButtons } = await loadModule();
		initSaveButtons();
		await flush();

		click(buttons()[0]);
		await flush();

		expect(buttons()[0].dataset.saved).toBeFalsy();
	});

	it('reverts when the network is down', async () => {
		page();
		stubApi([], { reject: true });
		const { initSaveButtons } = await loadModule();
		initSaveButtons();
		await flush();

		click(buttons()[0]);
		await flush();

		expect(buttons()[0].dataset.saved).toBeFalsy();
	});

	it('ignores a second press while the first is in flight', async () => {
		page();
		let resolvePost: (value: unknown) => void = () => {};
		fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
			if (init?.method === 'POST') {
				return new Promise((resolve) => {
					resolvePost = resolve;
				});
			}
			return { ok: true, json: async () => ({ slugs: [] }) };
		});
		vi.stubGlobal('fetch', fetchMock);

		const { initSaveButtons } = await loadModule();
		initSaveButtons();
		await flush();

		click(buttons()[0]);
		click(buttons()[0]);
		await flush();

		expect(
			fetchMock.mock.calls.filter(([, init]) => (init as any)?.method === 'POST')
		).toHaveLength(1);
		resolvePost({ ok: true, status: 200 });
	});

	it('binds each button once, however often it runs', async () => {
		page();
		stubApi([]);
		const { initSaveButtons } = await loadModule();
		initSaveButtons();
		initSaveButtons();
		await flush();

		click(buttons()[0]);
		await flush();

		expect(
			fetchMock.mock.calls.filter(([, init]) => (init as any)?.method === 'POST')
		).toHaveLength(1);
	});

	it('fetches the saved set once per page, not once per button', async () => {
		page();
		stubApi([]);
		const { initSaveButtons } = await loadModule();
		initSaveButtons();
		await flush();

		expect(
			fetchMock.mock.calls.filter(([url]) => url === '/api/me/saved')
		).toHaveLength(1);
	});

	it('does nothing on a page with no save buttons', async () => {
		mount('<div>Nothing to save</div>');
		const fetchSpy = vi.fn();
		vi.stubGlobal('fetch', fetchSpy);
		const { initSaveButtons } = await loadModule();
		initSaveButtons();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('survives a saved-slug fetch that fails', async () => {
		page();
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new Error('offline');
			})
		);
		const { initSaveButtons } = await loadModule();
		initSaveButtons();
		await flush();
		expect(buttons()[0].dataset.saved).toBeFalsy();
	});
});
