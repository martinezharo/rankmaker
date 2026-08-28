// @vitest-environment happy-dom
/**
 * Importing a guest's browser-local templates into their new account.
 *
 * The rule that matters: a template is only dropped from this browser once the
 * account has accepted it. Anything else — a lapsed session, a full account, a
 * network failure — must leave the user's work where it is for the next
 * attempt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memStorage } from '../test/storage';

async function loadModule() {
	vi.resetModules();
	return import('./local-templates-sync');
}

const localTemplate = (id: string, title: string) => ({
	id,
	title,
	description: 'A guest template',
	category: 'Movies',
	options: [
		{ id: 1, name: 'One' },
		{ id: 2, name: 'Two' },
		{ id: 3, name: 'Three' },
		{ id: 4, name: 'Four' },
	],
	created_at: Number(id.replace(/\D/g, '')) || 1,
});

function seedLocalTemplates(...templates: ReturnType<typeof localTemplate>[]) {
	localStorage.setItem(
		'rankmaker_local_templates',
		JSON.stringify(templates)
	);
}

type Reply = { ok: boolean; body: unknown };

function stubApi(options: {
	signedIn?: boolean;
	creates?: Reply[];
	meFails?: boolean;
}) {
	const creates = [...(options.creates ?? [])];
	const calls: unknown[] = [];
	const mock = vi.fn(async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		if (url === '/api/auth/me') {
			if (options.meFails) throw new Error('offline');
			return {
				ok: true,
				json: async () => ({ user: options.signedIn ? { username: 'a' } : null }),
			};
		}
		if (url === '/api/templates') {
			const next = creates.shift();
			if (!next) throw new Error('offline');
			return { ok: next.ok, json: async () => next.body };
		}
		return { ok: true, json: async () => ({}) };
	});
	vi.stubGlobal('fetch', mock);
	return { mock, calls };
}

const stored = () =>
	JSON.parse(localStorage.getItem('rankmaker_local_templates') ?? '[]');

beforeEach(() => {
	vi.stubGlobal('localStorage', memStorage());
	vi.stubGlobal('sessionStorage', memStorage());
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetModules();
});

describe('syncLocalTemplates', () => {
	it('does nothing at all when this browser has no local templates', async () => {
		const { mock } = stubApi({ signedIn: true });
		const { syncLocalTemplates } = await loadModule();

		expect(await syncLocalTemplates()).toEqual([]);
		expect(mock).not.toHaveBeenCalled();
	});

	it('leaves them alone for a visitor who is not signed in', async () => {
		seedLocalTemplates(localTemplate('t1', 'Mine'));
		const { mock } = stubApi({ signedIn: false });
		const { syncLocalTemplates } = await loadModule();

		expect(await syncLocalTemplates()).toEqual([]);
		expect(stored()).toHaveLength(1);
		expect(
			mock.mock.calls.filter(([url]) => url === '/api/templates')
		).toHaveLength(0);
	});

	it('imports each one as a private template and forgets it locally', async () => {
		seedLocalTemplates(localTemplate('t1', 'Mine'));
		const { mock } = stubApi({
			signedIn: true,
			creates: [{ ok: true, body: { ok: true, slug: 'mine-abc' } }],
		});
		const { syncLocalTemplates } = await loadModule();

		expect(await syncLocalTemplates()).toEqual([
			{ id: 't1', slug: 'mine-abc' },
		]);
		expect(stored()).toEqual([]);

		const [, init] = mock.mock.calls.find(
			([url]) => url === '/api/templates'
		) as [string, RequestInit];
		expect(JSON.parse(init.body as string)).toMatchObject({
			title: 'Mine',
			visibility: 'private',
			cover_image: '',
			options: [
				{ name: 'One', image: null },
				{ name: 'Two', image: null },
				{ name: 'Three', image: null },
				{ name: 'Four', image: null },
			],
		});
	});

	it('imports oldest first, so the account keeps the creation order', async () => {
		// listLocalTemplates returns newest first.
		seedLocalTemplates(
			localTemplate('t2', 'Newer'),
			localTemplate('t1', 'Older')
		);
		const { mock } = stubApi({
			signedIn: true,
			creates: [
				{ ok: true, body: { ok: true, slug: 'older-abc' } },
				{ ok: true, body: { ok: true, slug: 'newer-abc' } },
			],
		});
		const { syncLocalTemplates } = await loadModule();
		await syncLocalTemplates();

		const titles = mock.mock.calls
			.filter(([url]) => url === '/api/templates')
			.map(([, init]) => JSON.parse((init as RequestInit).body as string).title);
		expect(titles).toEqual(['Older', 'Newer']);
	});

	it('moves the ranking already played onto the imported slug', async () => {
		seedLocalTemplates(localTemplate('t1', 'Mine'));
		localStorage.setItem(
			'rankmaker_history',
			JSON.stringify({
				'local:t1': {
					slug: 'local:t1',
					title: 'Mine',
					ts: 1,
					result: [{ id: 1, name: 'One', image: '' }],
				},
			})
		);
		stubApi({
			signedIn: true,
			creates: [{ ok: true, body: { ok: true, slug: 'mine-abc' } }],
		});
		const { syncLocalTemplates } = await loadModule();
		await syncLocalTemplates();

		const history = JSON.parse(
			localStorage.getItem('rankmaker_history') ?? '{}'
		);
		expect(history['local:t1']).toBeUndefined();
		expect(history['mine-abc'].result).toHaveLength(1);
	});

	it('keeps the rest when one import is refused', async () => {
		seedLocalTemplates(
			localTemplate('t2', 'Second'),
			localTemplate('t1', 'First')
		);
		stubApi({
			signedIn: true,
			creates: [
				{ ok: true, body: { ok: true, slug: 'first-abc' } },
				{ ok: false, body: { error: 'You can create at most 50 templates.' } },
			],
		});
		const { syncLocalTemplates } = await loadModule();

		expect(await syncLocalTemplates()).toEqual([
			{ id: 't1', slug: 'first-abc' },
		]);
		expect(stored().map((t: { id: string }) => t.id)).toEqual(['t2']);
	});

	it('keeps everything when the network drops mid-import', async () => {
		seedLocalTemplates(localTemplate('t1', 'Mine'));
		stubApi({ signedIn: true, creates: [] });
		const { syncLocalTemplates } = await loadModule();

		expect(await syncLocalTemplates()).toEqual([]);
		expect(stored()).toHaveLength(1);
	});

	it('keeps them when the session check itself fails', async () => {
		seedLocalTemplates(localTemplate('t1', 'Mine'));
		stubApi({ meFails: true });
		const { syncLocalTemplates } = await loadModule();

		expect(await syncLocalTemplates()).toEqual([]);
		expect(stored()).toHaveLength(1);
	});

	it('announces what it imported, so open surfaces can update', async () => {
		seedLocalTemplates(localTemplate('t1', 'Mine'));
		stubApi({
			signedIn: true,
			creates: [{ ok: true, body: { ok: true, slug: 'mine-abc' } }],
		});
		const heard = vi.fn();
		document.addEventListener('rankmaker:local-templates-imported', heard);
		const { syncLocalTemplates } = await loadModule();

		await syncLocalTemplates();

		expect((heard.mock.calls[0][0] as CustomEvent).detail).toEqual({
			imported: [{ id: 't1', slug: 'mine-abc' }],
		});
		document.removeEventListener('rankmaker:local-templates-imported', heard);
	});

	it('says nothing when it imported nothing', async () => {
		seedLocalTemplates(localTemplate('t1', 'Mine'));
		stubApi({ signedIn: false });
		const heard = vi.fn();
		document.addEventListener('rankmaker:local-templates-imported', heard);
		const { syncLocalTemplates } = await loadModule();

		await syncLocalTemplates();

		expect(heard).not.toHaveBeenCalled();
		document.removeEventListener('rankmaker:local-templates-imported', heard);
	});

	it('runs once even when several pages ask at the same time', async () => {
		seedLocalTemplates(localTemplate('t1', 'Mine'));
		const { mock } = stubApi({
			signedIn: true,
			creates: [{ ok: true, body: { ok: true, slug: 'mine-abc' } }],
		});
		const { syncLocalTemplates } = await loadModule();

		const [a, b] = await Promise.all([
			syncLocalTemplates(),
			syncLocalTemplates(),
		]);

		expect(a).toEqual(b);
		expect(
			mock.mock.calls.filter(([url]) => url === '/api/templates')
		).toHaveLength(1);
	});
});
