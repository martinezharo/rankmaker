// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initTemplateVote } from './template-vote';
import { click, flush, inlineDictionary, mount } from '../test/dom';

function page(slug: string | null = 'best-movies') {
	mount(`
		${
			slug === null
				? ''
				: `<script type="application/json" id="ranking-data">${JSON.stringify({ slug })}</script>`
		}
		<div class="template-vote">
			<button class="vote-up"></button>
			<span class="vote-score"></span>
			<button class="vote-down"></button>
		</div>
		<div class="template-vote">
			<button class="vote-up"></button>
			<span class="vote-score"></span>
			<button class="vote-down"></button>
		</div>
		<span data-vote-score></span>
		<div id="login-modal" class="hidden">
			<a id="login-modal-continue" href="#">Continue</a>
		</div>
	`);
}

const upButtons = () => [...document.querySelectorAll('.vote-up')];
const downButtons = () => [...document.querySelectorAll('.vote-down')];
const scores = () =>
	[...document.querySelectorAll('.vote-score')].map((s) => s.textContent);

let fetchMock: ReturnType<typeof vi.fn>;

/** GET returns the viewer's state; POST returns the fresh totals. */
function stubApi(
	state: { score: number; myVote: number; loggedIn: boolean },
	post: { status?: number; body?: unknown } = {}
) {
	fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
		if (init?.method === 'POST') {
			return {
				ok: (post.status ?? 200) < 400,
				status: post.status ?? 200,
				json: async () => post.body ?? { score: 1, myVote: 1 },
			};
		}
		return { ok: true, status: 200, json: async () => state };
	});
	vi.stubGlobal('fetch', fetchMock);
}

beforeEach(() => {
	inlineDictionary();
	vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
		fn(0);
		return 0;
	});
});
afterEach(() => {
	vi.unstubAllGlobals();
});

describe('initTemplateVote', () => {
	it('paints the current score and the viewer’s own vote', async () => {
		page();
		stubApi({ score: 12, myVote: 1, loggedIn: true });
		initTemplateVote();
		await flush();

		expect(scores()).toEqual(['12', '12']);
		for (const up of upButtons()) {
			expect(up.className).toContain('text-primary');
		}
		expect(document.querySelector('[data-vote-score]')).toHaveTextContent('12');
	});

	it('marks a downvote on the down arrow only', async () => {
		page();
		stubApi({ score: -1, myVote: -1, loggedIn: true });
		initTemplateVote();
		await flush();

		expect(downButtons()[0].className).toContain('text-red-400');
		expect(upButtons()[0].className).not.toContain('text-primary');
	});

	it('casts a vote and shows the fresh score everywhere', async () => {
		page();
		stubApi({ score: 0, myVote: 0, loggedIn: true }, { body: { score: 1, myVote: 1 } });
		initTemplateVote();
		await flush();

		click(upButtons()[0]);
		await flush();

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/templates/vote',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({ slug: 'best-movies', value: 1 }),
			})
		);
		expect(scores()).toEqual(['1', '1']);
	});

	it('clears the vote when the active arrow is pressed again', async () => {
		page();
		stubApi({ score: 1, myVote: 1, loggedIn: true }, { body: { score: 0, myVote: 0 } });
		initTemplateVote();
		await flush();

		click(upButtons()[0]);
		await flush();

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/templates/vote',
			expect.objectContaining({
				body: JSON.stringify({ slug: 'best-movies', value: 0 }),
			})
		);
		expect(upButtons()[0].className).not.toContain('text-primary');
	});

	it('flips an upvote straight to a downvote', async () => {
		page();
		stubApi({ score: 1, myVote: 1, loggedIn: true }, { body: { score: -1, myVote: -1 } });
		initTemplateVote();
		await flush();

		click(downButtons()[0]);
		await flush();

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/templates/vote',
			expect.objectContaining({
				body: JSON.stringify({ slug: 'best-movies', value: -1 }),
			})
		);
	});

	it('asks a signed-out visitor to sign in instead of voting', async () => {
		page();
		stubApi({ score: 3, myVote: 0, loggedIn: false });
		initTemplateVote();
		await flush();

		click(upButtons()[0]);
		await flush();

		expect(document.getElementById('login-modal')!.classList).not.toContain(
			'hidden'
		);
		expect(
			fetchMock.mock.calls.filter(([, init]) => (init as any)?.method === 'POST')
		).toHaveLength(0);
	});

	it('asks them to sign in when the session expired mid-page', async () => {
		page();
		stubApi({ score: 3, myVote: 0, loggedIn: true }, { status: 401 });
		initTemplateVote();
		await flush();

		click(upButtons()[0]);
		await flush();

		expect(document.getElementById('login-modal')!.classList).not.toContain(
			'hidden'
		);
	});

	it('leaves the score alone when the request fails', async () => {
		page();
		stubApi({ score: 5, myVote: 0, loggedIn: true }, { status: 500 });
		initTemplateVote();
		await flush();

		click(upButtons()[0]);
		await flush();

		expect(scores()).toEqual(['5', '5']);
	});

	it('leaves it alone when the network is down', async () => {
		page();
		vi.stubGlobal(
			'fetch',
			vi.fn(async (_url: string, init?: RequestInit) => {
				if (init?.method === 'POST') throw new Error('offline');
				return {
					ok: true,
					json: async () => ({ score: 5, myVote: 0, loggedIn: true }),
				};
			})
		);
		initTemplateVote();
		await flush();

		click(upButtons()[0]);
		await flush();

		expect(scores()).toEqual(['5', '5']);
	});

	it('does nothing on a page with no vote control', () => {
		mount('<div>No voting here</div>');
		vi.stubGlobal('fetch', vi.fn());
		initTemplateVote();
		expect(fetch).not.toHaveBeenCalled();
	});

	it('does nothing without a template to vote on', () => {
		page(null);
		vi.stubGlobal('fetch', vi.fn());
		initTemplateVote();
		expect(fetch).not.toHaveBeenCalled();
	});

	it('binds each control once, however often it runs', async () => {
		page();
		stubApi({ score: 0, myVote: 0, loggedIn: true });
		initTemplateVote();
		initTemplateVote();
		await flush();

		click(upButtons()[0]);
		await flush();

		expect(
			fetchMock.mock.calls.filter(([, init]) => (init as any)?.method === 'POST')
		).toHaveLength(1);
	});
});
