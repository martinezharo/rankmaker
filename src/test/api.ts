/**
 * A stand-in for Astro's `APIContext`, so the route handlers in
 * `src/pages/api/**` can be called directly.
 *
 * These handlers are where authorization actually lives — the same-origin
 * check, "are you logged in", "is this yours", "may you even see this
 * template". Testing them through the module boundary is the only way to
 * assert on the responses a browser would receive, without a dev server.
 *
 * `request` defaults to a same-origin POST so tests opt *out* of passing CSRF
 * (`origin: null`) rather than having to remember to opt in.
 */
import type { APIContext } from 'astro';
import { fakeCookies, type FakeCookies } from './cookies';
import type { TestD1 } from './d1';

export const TEST_ORIGIN = 'https://rankmaker.test';

/** The R2 slice the image lifecycle uses, with an inspectable object set. */
export function fakeBucket() {
	const objects = new Set<string>();
	return {
		objects,
		bucket: {
			put: async (key: string) => {
				objects.add(key);
				return { key };
			},
			get: async (key: string) => (objects.has(key) ? { key } : null),
			delete: async (keys: string | string[]) => {
				for (const key of [keys].flat()) objects.delete(key);
			},
		} as unknown as R2Bucket,
	};
}

/** The KV slice used for rate limiting and caches. */
export function fakeKv() {
	const store = new Map<string, string>();
	return {
		store,
		kv: {
			get: async (key: string) => store.get(key) ?? null,
			put: async (key: string, value: string) => {
				store.set(key, value);
			},
			delete: async (key: string) => {
				store.delete(key);
			},
		} as unknown as KVNamespace,
	};
}

export type TestContext = APIContext & {
	cookies: FakeCookies;
	/** Promises handed to `ctx.waitUntil`, so tests can await the fan-out. */
	deferred: Promise<unknown>[];
};

export function apiContext(options: {
	db: TestD1;
	path?: string;
	method?: string;
	/** Pass `null` to simulate a cross-site request with no Origin header. */
	origin?: string | null;
	body?: unknown;
	headers?: Record<string, string>;
	params?: Record<string, string>;
	cookies?: Record<string, string>;
	env?: Record<string, unknown>;
}): TestContext {
	const {
		db,
		path = '/api/test',
		method = 'POST',
		origin = TEST_ORIGIN,
		body,
		headers = {},
		params = {},
		cookies = {},
		env = {},
	} = options;

	const url = path.startsWith('http') ? path : `${TEST_ORIGIN}${path}`;
	const requestHeaders: Record<string, string> = { ...headers };
	if (origin !== null) requestHeaders.Origin = origin;
	if (body !== undefined && requestHeaders['Content-Type'] === undefined) {
		requestHeaders['Content-Type'] = 'application/json';
	}

	const request = new Request(url, {
		method,
		headers: requestHeaders,
		body:
			body === undefined || method === 'GET' || method === 'HEAD'
				? undefined
				: typeof body === 'string'
					? body
					: JSON.stringify(body),
	});

	const deferred: Promise<unknown>[] = [];
	const responseHeaders = new Headers();

	return {
		request,
		params,
		cookies: fakeCookies(cookies),
		url: new URL(url),
		locals: {
			runtime: {
				env: { DB: db, ...env },
				ctx: {
					waitUntil: (p: Promise<unknown>) => deferred.push(p),
					passThroughOnException: () => {},
				},
			},
		},
		redirect: (location: string, status = 302) =>
			new Response(null, { status, headers: { Location: location } }),
		response: { headers: responseHeaders },
		deferred,
	} as unknown as TestContext;
}
