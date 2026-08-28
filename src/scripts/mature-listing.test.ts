/**
 * The client half of the mature-content filter.
 *
 * Its rule is one-directional: a grid only ever swaps in a *wider* listing,
 * and only once `/api/auth/me` has said the viewer opted in. Every failure —
 * no answer yet, a failed request, a viewer who did not opt in — has to leave
 * the server-rendered (mature-free) HTML alone, because that is the only
 * direction that cannot show adult content to someone who did not ask for it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

// Re-imported per test: the module holds the viewer's preference and the
// in-flight requests in module scope, which is exactly what has to reset.
async function loadModule() {
	vi.resetModules();
	return import('./mature-listing');
}

const items = (...slugs: string[]) => slugs.map((slug) => ({ slug }) as any);

function stubFetch(
	responder: (url: string) => unknown = () => ({ items: items('spicy') })
) {
	const mock = vi.fn(async (url: string) => ({
		ok: true,
		json: async () => responder(url),
	}));
	vi.stubGlobal('fetch', mock);
	return mock;
}

/** The module resolves its fetch on a microtask; let those settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('subscribeListing', () => {
	it('does not fetch or notify before the preference is known', async () => {
		const fetchMock = stubFetch();
		const { subscribeListing } = await loadModule();
		const notify = vi.fn();

		subscribeListing({}, notify);
		await settle();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(notify).not.toHaveBeenCalled();
	});

	it('does nothing for a viewer who did not opt in', async () => {
		const fetchMock = stubFetch();
		const { subscribeListing, publishMaturePreference } = await loadModule();
		const notify = vi.fn();

		subscribeListing({}, notify);
		publishMaturePreference(false);
		await settle();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(notify).not.toHaveBeenCalled();
	});

	it('swaps in the viewer’s own listing once they opted in', async () => {
		stubFetch();
		const { subscribeListing, publishMaturePreference } = await loadModule();
		const notify = vi.fn();

		subscribeListing({}, notify);
		publishMaturePreference(true);
		await settle();

		expect(notify).toHaveBeenCalledWith(items('spicy'));
	});

	it('fetches immediately when the preference is already known', async () => {
		stubFetch();
		const { subscribeListing, publishMaturePreference } = await loadModule();
		publishMaturePreference(true);

		const notify = vi.fn();
		subscribeListing({}, notify);
		await settle();

		expect(notify).toHaveBeenCalledWith(items('spicy'));
	});

	it('asks for one profile’s templates when scoped to a user', async () => {
		const fetchMock = stubFetch();
		const { subscribeListing, publishMaturePreference } = await loadModule();

		subscribeListing({ username: 'a b' }, vi.fn());
		publishMaturePreference(true);
		await settle();

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/templates/browse?user=a%20b',
			expect.anything()
		);
	});

	it('issues one request per scope however many grids subscribe', async () => {
		const fetchMock = stubFetch();
		const { subscribeListing, publishMaturePreference } = await loadModule();

		// The home page renders a grid per category, all on the browse scope.
		const notifies = [vi.fn(), vi.fn(), vi.fn()];
		for (const notify of notifies) subscribeListing({}, notify);
		subscribeListing({ username: 'alice' }, vi.fn());
		publishMaturePreference(true);
		await settle();

		expect(fetchMock).toHaveBeenCalledTimes(2);
		for (const notify of notifies) expect(notify).toHaveBeenCalledTimes(1);
	});

	it('leaves the server listing alone when the request fails', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new Error('offline');
			})
		);
		const { subscribeListing, publishMaturePreference } = await loadModule();
		const notify = vi.fn();

		subscribeListing({}, notify);
		publishMaturePreference(true);
		await settle();

		expect(notify).not.toHaveBeenCalled();
	});

	it('leaves it alone on a non-OK response', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
		const { subscribeListing, publishMaturePreference } = await loadModule();
		const notify = vi.fn();

		subscribeListing({}, notify);
		publishMaturePreference(true);
		await settle();

		expect(notify).not.toHaveBeenCalled();
	});

	it('leaves it alone when the endpoint says there is nothing to swap in', async () => {
		stubFetch(() => ({ items: null }));
		const { subscribeListing, publishMaturePreference } = await loadModule();
		const notify = vi.fn();

		subscribeListing({}, notify);
		publishMaturePreference(true);
		await settle();

		expect(notify).not.toHaveBeenCalled();
	});

	it('stops notifying once unsubscribed', async () => {
		stubFetch();
		const { subscribeListing, publishMaturePreference } = await loadModule();
		const notify = vi.fn();

		subscribeListing({}, notify)();
		publishMaturePreference(true);
		await settle();

		expect(notify).not.toHaveBeenCalled();
	});
});

describe('publishMaturePreference', () => {
	it('only acts on a change of answer, not on every navigation', async () => {
		const fetchMock = stubFetch();
		const { subscribeListing, publishMaturePreference } = await loadModule();

		subscribeListing({}, vi.fn());
		publishMaturePreference(true);
		publishMaturePreference(true);
		publishMaturePreference(true);
		await settle();

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

describe('resetListingCache', () => {
	it('lets the next page fetch a fresh listing', async () => {
		const fetchMock = stubFetch();
		const {
			subscribeListing,
			publishMaturePreference,
			resetListingCache,
		} = await loadModule();

		publishMaturePreference(true);
		subscribeListing({}, vi.fn());
		await settle();

		resetListingCache();
		subscribeListing({}, vi.fn());
		await settle();

		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('keeps the preference, which belongs to the viewer not the page', async () => {
		stubFetch();
		const {
			subscribeListing,
			publishMaturePreference,
			resetListingCache,
		} = await loadModule();

		publishMaturePreference(true);
		resetListingCache();

		const notify = vi.fn();
		subscribeListing({}, notify);
		await settle();

		expect(notify).toHaveBeenCalled();
	});
});
