// @vitest-environment happy-dom
/**
 * The engine's integration with the server-rendered shell.
 *
 * The comparison logic is `RankingSession`'s and is unit-tested there; the duel
 * and result markup are the Preact components' and are tested there. What is
 * only ever exercised here is the wiring between them and the page: the
 * `#ranking-data` payload, the modals, persistence, the share controls, and the
 * teardown that has to run before a client-side navigation swaps the document.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { advanceTimers, flush, inlineDictionary, mount } from '../test/dom';
import type { RankingData } from '../lib/ranking-data';

vi.mock('./ranking-share-image', () => ({
	downloadRankingImage: vi.fn(async () => undefined),
	computeCanvasHeight: vi.fn(),
	truncate: vi.fn(),
}));
vi.mock('./ranking-reorder', () => ({
	createReorder: vi.fn(() => ({
		setEnabled: vi.fn(),
		destroy: vi.fn(),
	})),
}));

const data = (overrides: Partial<RankingData> = {}): RankingData => ({
	slug: 'best-movies',
	title: 'Best Movies',
	cover: '',
	options: [
		{ id: 1, name: 'Alien', image: '' },
		{ id: 2, name: 'Heat', image: '' },
		{ id: 3, name: 'Se7en', image: '' },
		{ id: 4, name: 'Fargo', image: '' },
	],
	...overrides,
});

/** The markup the template page renders around the engine. */
function shell(payload: unknown = data()): void {
	document.documentElement.classList.add('rm-saved-result');
	mount(`
		<script type="application/json" id="ranking-data">${
			typeof payload === 'string' ? payload : JSON.stringify(payload)
		}</script>
		<div id="detail-view">
			<div data-option-card="1">
				<div class="option-media"></div>
				<span class="option-removed-badge hidden"></span>
				<span class="option-name"></span>
				<button data-remove-option="1" data-option-name="Alien"><i></i></button>
			</div>
		</div>
		<div id="start-ranking-cta">
			<button id="start-ranking-btn">Start</button>
		</div>
		<div id="ranking-battle-root"></div>
		<div id="transition-overlay" class="hidden"></div>
		<section id="results-view" class="hidden">
			<div id="results-podium-root"></div>
			<div id="results-list-root"></div>
			<button id="action-history">History</button>
			<button id="action-download-image"><i></i>Download</button>
			<button id="action-reorder"><i></i><span id="action-reorder-label"></span></button>
			<button id="action-rank-again">Again</button>
			<button id="action-share-template"><i></i></button>
			<button id="action-share-x"></button>
		</section>
		<div id="finish-early-modal" class="hidden">
			<div id="finish-modal-backdrop"></div>
			<button id="finish-cancel-btn">Cancel</button>
			<button id="finish-confirm-btn">Finish</button>
		</div>
		<div id="remove-option-modal" class="hidden">
			<div id="remove-modal-backdrop"></div>
			<p id="remove-option-body"></p>
			<button id="remove-cancel-btn">Cancel</button>
			<button id="remove-confirm-btn">Remove</button>
		</div>
		<div id="history-modal" class="hidden">
			<div id="history-modal-backdrop"></div>
			<div id="history-list"></div>
			<button id="history-close-btn">Close</button>
		</div>
	`);
}

const $ = <T extends HTMLElement>(id: string) =>
	document.getElementById(id) as T | null;

const click = (id: string) =>
	$(id)?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

/** Start the ranking and let the first duel paint. */
async function start() {
	click('start-ranking-btn');
	await flush();
}

/** Answer the duel on screen, waiting out the two animation beats. */
async function pickA() {
	document
		.getElementById('battle-card-a')!
		.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
	await advanceTimers(600);
}

/** Answer duels until the ranking is complete and the results have painted. */
async function rankEverything() {
	for (let guard = 0; guard < 40 && $('battle-card-a'); guard++) await pickA();
	// The results view waits out its transition flourish.
	await advanceTimers(1000);
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
		fn(0);
		return 0;
	});
	vi.stubGlobal('scrollTo', vi.fn());
	vi.clearAllMocks();
	fetchMock = vi.fn(async () => ({
		ok: true,
		json: async () => ({ entry: null }),
	}));
	vi.stubGlobal('fetch', fetchMock);
	localStorage.clear();
	sessionStorage.clear();
	inlineDictionary();
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.resetModules();
	document.documentElement.className = '';
});

async function init() {
	const { rankingInit } = await import('./ranking-engine');
	rankingInit();
	await flush();
	return rankingInit;
}

describe('rankingInit — refusing to run', () => {
	it('does nothing, and clears the guard, when the page is not a ranking page', async () => {
		mount('<div>Some other page</div>');
		document.documentElement.classList.add('rm-saved-result');
		await init();
		expect(document.documentElement.classList.contains('rm-saved-result')).toBe(
			false
		);
	});

	it('gives up on an unparseable payload rather than throwing', async () => {
		shell('{not json');
		await init();
		expect($('battle-card-a')).toBeNull();
		expect(document.documentElement.classList.contains('rm-saved-result')).toBe(
			false
		);
	});

	it('gives up when there are too few options to rank', async () => {
		shell(data({ options: [{ id: 1, name: 'Alone', image: '' }] }));
		await init();
		await start();
		expect($('battle-card-a')).toBeNull();
	});

	it('gives up on a payload with no slug — nothing could be persisted', async () => {
		shell(data({ slug: '' }));
		await init();
		await start();
		expect($('battle-card-a')).toBeNull();
	});
});

describe('rankingInit — starting a ranking', () => {
	beforeEach(async () => {
		shell();
		await init();
	});

	it('hides the detail view and shows the first duel', async () => {
		await start();
		expect($('detail-view')!.classList.contains('hidden')).toBe(true);
		expect($('start-ranking-cta')!.classList.contains('hidden')).toBe(true);
		expect($('battle-card-a')).not.toBeNull();
		expect($('battle-card-b')).not.toBeNull();
	});

	it('records the play so the template’s counter moves', async () => {
		await start();
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/track',
			expect.objectContaining({ method: 'POST' })
		);
	});

	it('survives the tracking call failing', async () => {
		fetchMock.mockRejectedValue(new Error('offline'));
		await expect(start()).resolves.toBeUndefined();
		expect($('battle-card-a')).not.toBeNull();
	});

	it('reaches the results view once every duel is answered', async () => {
		await start();
		await rankEverything();

		expect($('results-view')!.classList.contains('hidden')).toBe(false);
		expect(document.querySelectorAll('.rank-item')).toHaveLength(4);
		expect(document.getElementById('results-podium')).not.toBeNull();
	});

	it('saves the finished ranking to this browser', async () => {
		await start();
		await rankEverything();

		const stored = JSON.parse(
			localStorage.getItem('rankmaker_history') ?? '{}'
		);
		expect(stored['best-movies'].result).toHaveLength(4);
		expect(stored['best-movies'].title).toBe('Best Movies');
	});
});

describe('rankingInit — the option controls on the detail page', () => {
	beforeEach(async () => {
		shell();
		await init();
	});

	it('removes an option, and restores it on a second press', async () => {
		const card = document.querySelector('[data-option-card="1"]')!;
		const button = card.querySelector('[data-remove-option]')!;

		button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();
		expect(card.querySelector('.option-removed-badge')!.className).toContain(
			'flex'
		);
		expect(card.querySelector('.option-media')!.className).toContain(
			'grayscale'
		);

		button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();
		expect(card.querySelector('.option-removed-badge')!.className).toContain(
			'hidden'
		);
	});

	it('remembers the removal for the next visit', async () => {
		document
			.querySelector('[data-remove-option]')!
			.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();
		expect(
			JSON.parse(localStorage.getItem('rankmaker_excluded') ?? '{}')
		).toEqual({ 'best-movies': ['1'] });
	});

	it('ignores a press on a control it has disabled', async () => {
		const button = document.querySelector('[data-remove-option]')!;
		button.setAttribute('aria-disabled', 'true');
		button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();
		expect(
			document.querySelector('.option-removed-badge')!.className
		).toContain('hidden');
	});
});

describe('rankingInit — the modals', () => {
	beforeEach(async () => {
		shell();
		await init();
		await start();
	});

	it('asks before finishing early, and does nothing on cancel', async () => {
		click('battle-finish-btn');
		await flush();
		expect($('finish-early-modal')!.classList.contains('hidden')).toBe(false);

		click('finish-cancel-btn');
		await flush();
		expect($('finish-early-modal')!.classList.contains('hidden')).toBe(true);
		expect($('battle-card-a')).not.toBeNull();
	});

	it('finishes early on confirm', async () => {
		await pickA();
		click('battle-finish-btn');
		await flush();
		click('finish-confirm-btn');
		await advanceTimers(1000);

		expect($('results-view')!.classList.contains('hidden')).toBe(false);
	});

	it('dismisses the finish modal from its backdrop', async () => {
		click('battle-finish-btn');
		await flush();
		click('finish-modal-backdrop');
		await flush();
		expect($('finish-early-modal')!.classList.contains('hidden')).toBe(true);
	});

	it('names the option in the remove confirmation', async () => {
		click('battle-remove-a');
		await flush();
		expect($('remove-option-modal')!.classList.contains('hidden')).toBe(false);
		expect($('remove-option-body')!.textContent).toContain(
			document.getElementById('battle-name-a')!.textContent
		);
	});

	it('keeps the option when the removal is cancelled', async () => {
		const name = $('battle-name-a')!.textContent;
		click('battle-remove-a');
		await flush();
		click('remove-cancel-btn');
		await flush();

		expect($('remove-option-modal')!.classList.contains('hidden')).toBe(true);
		expect($('battle-name-a')!.textContent).toBe(name);
	});

	it('drops the option on confirm, and never asks about it again', async () => {
		const removed = $('battle-name-a')!.textContent!;
		click('battle-remove-a');
		await flush();
		click('remove-confirm-btn');
		await flush();

		for (let guard = 0; guard < 40 && $('battle-card-a'); guard++) {
			expect($('battle-name-a')!.textContent).not.toBe(removed);
			expect($('battle-name-b')!.textContent).not.toBe(removed);
			await pickA();
		}
		await advanceTimers(1000);
		expect(document.querySelectorAll('.rank-item')).toHaveLength(3);
	});

	it('lists the duels answered so far', async () => {
		await pickA();
		click('action-history');
		await flush();

		expect($('history-modal')!.classList.contains('hidden')).toBe(false);
		expect($('history-list')!.querySelectorAll('.rounded-xl').length)
			.toBeGreaterThan(0);

		click('history-close-btn');
		await flush();
		expect($('history-modal')!.classList.contains('hidden')).toBe(true);
	});

	it('says so when nothing has been answered yet', async () => {
		click('action-history');
		await flush();
		expect($('history-list')!.textContent).toContain('No battles');
	});
});

describe('rankingInit — the results controls', () => {
	beforeEach(async () => {
		shell();
		await init();
		await start();
		await rankEverything();
	});

	it('goes back to the template to rank again', async () => {
		click('action-rank-again');
		await flush();
		expect($('results-view')!.classList.contains('hidden')).toBe(true);
		expect($('detail-view')!.classList.contains('hidden')).toBe(false);
		expect($('battle-card-a')).toBeNull();
	});

	it('toggles reorder mode and says so on the control', async () => {
		click('action-reorder');
		await flush();
		expect($('action-reorder-label')!.textContent).toBe('Done Reordering');
		expect(document.querySelector('.rank-drag-handle')!.className).toContain(
			'flex'
		);

		click('action-reorder');
		await flush();
		expect($('action-reorder-label')!.textContent).toBe('Reorder Manually');
	});

	it('shares through the native sheet when the device has one', async () => {
		const share = vi.fn(async () => undefined);
		vi.stubGlobal('navigator', { share });
		click('action-share-template');
		await flush();
		expect(share).toHaveBeenCalledWith(
			expect.objectContaining({ url: window.location.href })
		);
	});

	it('falls back to copying the link, and says it copied', async () => {
		const writeText = vi.fn(async () => undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		click('action-share-template');
		await flush();

		expect(writeText).toHaveBeenCalledWith(window.location.href);
		expect(
			$('action-share-template')!.querySelector('i')!.className
		).toContain('fa-check');
	});

	it('survives a clipboard that refuses', async () => {
		vi.stubGlobal('navigator', {
			clipboard: {
				writeText: async () => {
					throw new Error('not a secure context');
				},
			},
		});
		click('action-share-template');
		await expect(flush()).resolves.toBeUndefined();
	});

	it('opens X with the ranking title and this page', async () => {
		const open = vi.fn();
		vi.stubGlobal('open', open);
		click('action-share-x');
		await flush();

		const [url, target, features] = open.mock.calls[0];
		expect(url).toContain('https://x.com/intent/tweet');
		expect(url).toContain(encodeURIComponent(window.location.href));
		expect(target).toBe('_blank');
		expect(features).toBe('noopener');
	});

	it('shows progress while the share image is generated, then restores', async () => {
		const { downloadRankingImage } = await import('./ranking-share-image');
		click('action-download-image');
		await flush();

		expect(downloadRankingImage).toHaveBeenCalledTimes(1);
		expect($('action-download-image')).not.toHaveAttribute('aria-busy');
		expect($('action-download-image')!.dataset.busy).toBeUndefined();
	});

	it('ignores a second download press while one is running', async () => {
		const { downloadRankingImage } = await import('./ranking-share-image');
		(downloadRankingImage as ReturnType<typeof vi.fn>).mockImplementation(
			() => new Promise(() => {})
		);
		click('action-download-image');
		click('action-download-image');
		await flush();
		expect(downloadRankingImage).toHaveBeenCalledTimes(1);
	});
});

describe('rankingInit — a result saved earlier', () => {
	it('shows it straight away instead of the start button', async () => {
		localStorage.setItem(
			'rankmaker_history',
			JSON.stringify({
				'best-movies': {
					slug: 'best-movies',
					title: 'Best Movies',
					ts: Date.now(),
					result: [
						{ id: 2, name: 'Heat', image: '' },
						{ id: 1, name: 'Alien', image: '' },
					],
				},
			})
		);
		shell();
		await init();

		expect($('results-view')!.classList.contains('hidden')).toBe(false);
		expect($('detail-view')!.classList.contains('hidden')).toBe(true);
		expect(
			[...document.querySelectorAll('.rank-item p')].map((p) => p.textContent)
		).toEqual(['Heat', 'Alien']);
	});

	it('ignores it when the page asked for a fresh ranking', async () => {
		localStorage.setItem(
			'rankmaker_history',
			JSON.stringify({
				'best-movies': {
					slug: 'best-movies',
					title: 'Best Movies',
					ts: Date.now(),
					result: [
						{ id: 2, name: 'Heat', image: '' },
						{ id: 1, name: 'Alien', image: '' },
					],
				},
			})
		);
		sessionStorage.setItem(
			'rankmaker_force_fresh',
			JSON.stringify('best-movies')
		);
		shell();
		await init();

		expect($('results-view')!.classList.contains('hidden')).toBe(true);
		expect($('detail-view')!.classList.contains('hidden')).toBe(false);
	});

	it('ignores a stored result too short to be a ranking', async () => {
		localStorage.setItem(
			'rankmaker_history',
			JSON.stringify({
				'best-movies': {
					slug: 'best-movies',
					title: 'Best Movies',
					ts: Date.now(),
					result: [{ id: 1, name: 'Alien', image: '' }],
				},
			})
		);
		shell();
		await init();
		expect($('results-view')!.classList.contains('hidden')).toBe(true);
	});

	it('asks the account for its copy', async () => {
		shell();
		await init();
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/me/history?slug=best-movies',
			expect.anything()
		);
	});
});

describe('rankingInit — teardown', () => {
	it('clears the previous page’s render before setting up the next', async () => {
		shell();
		const rankingInit = await init();
		await start();
		expect($('battle-card-a')).not.toBeNull();

		// A client-side navigation re-runs init against the swapped-in document.
		rankingInit();
		await flush();
		expect($('battle-card-a')).toBeNull();
	});

	it('drops the guard class so the page is never left blanked', async () => {
		shell();
		await init();
		expect(document.documentElement.classList.contains('rm-saved-result')).toBe(
			false
		);
	});
});
