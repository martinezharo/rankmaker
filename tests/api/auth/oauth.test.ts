/**
 * The GitHub OAuth handshake: /login → GitHub → /callback → (/signup →
 * /complete-signup) or a session.
 *
 * GitHub's side is stubbed at `fetch`, which is the whole point: the failure
 * modes worth guarding are ours — an open redirect in `next`, a forged or
 * replayed `state`, a token exchange that fails, and the rule that no user row
 * exists until a username is picked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as LOGIN } from '../../../src/pages/api/auth/login';
import { GET as CALLBACK } from '../../../src/pages/api/auth/callback';
import { POST as COMPLETE_SIGNUP } from '../../../src/pages/api/auth/complete-signup';
import {
	OAUTH_STATE_COOKIE,
	SESSION_COOKIE,
	SIGNUP_COOKIE,
	getSessionUser,
	signPayload,
} from '../../../src/lib/auth';
import { SELECTABLE_AVATAR_KEYS } from '../../../src/lib/avatars';
import { createTestDb, type TestD1 } from '../../../src/test/d1';
import { apiContext, TEST_ORIGIN, type TestContext } from '../../../src/test/api';
import { insertUser } from '../../../src/test/factories';

const SECRET = 'test-session-secret';
const ENV = {
	SESSION_SECRET: SECRET,
	GITHUB_CLIENT_ID: 'client-id',
	GITHUB_CLIENT_SECRET: 'client-secret',
};

let db: TestD1;

beforeEach(() => {
	db = createTestDb();
});
afterEach(() => {
	db.close();
	vi.unstubAllGlobals();
});

function ctx(options: {
	path: string;
	method?: string;
	body?: unknown;
	cookies?: Record<string, string>;
	origin?: string | null;
}): TestContext {
	return apiContext({
		db,
		path: options.path,
		method: options.method ?? 'GET',
		body: options.body,
		cookies: options.cookies ?? {},
		origin: options.origin,
		env: ENV,
	});
}

/** GitHub's responses, keyed by URL, with a record of what we asked for. */
function stubGitHub(overrides: Record<string, unknown> = {}) {
	const responses: Record<string, unknown> = {
		'https://github.com/login/oauth/access_token': {
			access_token: 'gh-token',
		},
		'https://api.github.com/user': { id: 4242, login: 'octocat' },
		'https://api.github.com/user/emails': [
			{ email: 'unverified@example.test', primary: false, verified: false },
			{ email: 'primary@example.test', primary: true, verified: true },
		],
		...overrides,
	};
	const calls: { url: string; init?: RequestInit }[] = [];
	const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		const body = responses[url];
		if (body === undefined) return new Response('{}', { status: 404 });
		if (body instanceof Response) return body.clone();
		return new Response(JSON.stringify(body), { status: 200 });
	});
	vi.stubGlobal('fetch', fetchMock);
	return { calls, fetchMock };
}

/** A valid signed state cookie, as /login would have set it. */
const stateCookie = (state: string, next = '/') =>
	signPayload(SECRET, { state, next, exp: Date.now() + 600_000 });

describe('GET /api/auth/login', () => {
	it('redirects to GitHub with our client id and callback', async () => {
		const response = await LOGIN(ctx({ path: '/api/auth/login' }) as never);
		expect(response.status).toBe(302);

		const location = new URL(response.headers.get('Location')!);
		expect(location.origin + location.pathname).toBe(
			'https://github.com/login/oauth/authorize'
		);
		expect(location.searchParams.get('client_id')).toBe('client-id');
		expect(location.searchParams.get('redirect_uri')).toBe(
			`${TEST_ORIGIN}/api/auth/callback`
		);
		expect(location.searchParams.get('scope')).toBe('user:email');
		expect(location.searchParams.get('state')).toMatch(/^[0-9a-f]{32}$/);
	});

	it('remembers a same-site return path', async () => {
		const context = ctx({ path: '/api/auth/login?next=/template/x' });
		await LOGIN(context as never);
		const cookie = context.cookies.written.get(OAUTH_STATE_COOKIE)!;
		expect(cookie.options).toMatchObject({ httpOnly: true, maxAge: 600 });
		expect(cookie.value).toContain('.');
	});

	it('refuses to be turned into an open redirect', async () => {
		for (const next of [
			'https://evil.test',
			'//evil.test',
			'/\\evil.test',
			'\\\\evil.test',
			'javascript:alert(1)',
		]) {
			const context = ctx({
				path: `/api/auth/login?next=${encodeURIComponent(next)}`,
			});
			await LOGIN(context as never);
			// The rejected path never reaches the signed cookie, so /callback
			// can only ever redirect back to "/".
			const value = context.cookies.written.get(OAUTH_STATE_COOKIE)!.value;
			const payload = JSON.parse(
				Buffer.from(
					value.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'),
					'base64'
				).toString()
			);
			expect(payload.next, next).toBe('/');
		}
	});

	it('issues a different state every time', async () => {
		const states = new Set<string>();
		for (let i = 0; i < 5; i++) {
			const response = await LOGIN(ctx({ path: '/api/auth/login' }) as never);
			states.add(
				new URL(response.headers.get('Location')!).searchParams.get('state')!
			);
		}
		expect(states.size).toBe(5);
	});
});

describe('GET /api/auth/callback', () => {
	const callback = async (
		options: {
			code?: string | null;
			state?: string | null;
			cookieState?: string;
			next?: string;
			cookies?: Record<string, string>;
		} = {}
	) => {
		const {
			code = 'gh-code',
			state = 'the-state',
			cookieState = 'the-state',
			next = '/',
		} = options;
		const params = new URLSearchParams();
		if (code !== null) params.set('code', code);
		if (state !== null) params.set('state', state);
		const context = ctx({
			path: `/api/auth/callback?${params}`,
			cookies: {
				[OAUTH_STATE_COOKIE]: await stateCookie(cookieState, next),
				...options.cookies,
			},
		});
		return { response: await CALLBACK(context as never), context };
	};

	const failed = (response: Response) => {
		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('/?auth_error=1');
	};

	it('hands a brand-new user off to /signup without creating a row', async () => {
		stubGitHub();
		const { response, context } = await callback();

		expect(response.headers.get('Location')).toBe('/signup');
		expect(context.cookies.written.get(SIGNUP_COOKIE)?.options).toMatchObject(
			{ httpOnly: true, maxAge: 900 }
		);
		expect(
			await db.prepare('SELECT id FROM users WHERE github_id = 4242').first()
		).toBeNull();
	});

	it('signs an existing user straight in, and back to where they were', async () => {
		const alice = await insertUser(db, {
			username: 'alice',
			githubId: 4242,
		});
		stubGitHub();

		const { response, context } = await callback({ next: '/template/x' });

		expect(response.headers.get('Location')).toBe('/template/x');
		const sessionCookie = context.cookies.written.get(SESSION_COOKIE)!;
		expect(sessionCookie.options).toMatchObject({
			httpOnly: true,
			sameSite: 'lax',
		});
		expect(await getSessionUser(context.cookies, db)).toMatchObject({
			id: alice.id,
			username: 'alice',
		});
	});

	it('refreshes the stored email on every login', async () => {
		const alice = await insertUser(db, { username: 'alice', githubId: 4242 });
		stubGitHub();
		await callback();

		const row = await db
			.prepare('SELECT email FROM users WHERE id = ?')
			.bind(alice.id)
			.first<{ email: string }>();
		expect(row?.email).toBe('primary@example.test');
	});

	it('does not clobber a stored email when GitHub gives none', async () => {
		const alice = await insertUser(db, { username: 'alice', githubId: 4242 });
		await db
			.prepare('UPDATE users SET email = ? WHERE id = ?')
			.bind('known@example.test', alice.id)
			.run();
		stubGitHub({
			'https://api.github.com/user': { id: 4242, login: 'octocat' },
			'https://api.github.com/user/emails': [],
		});

		await callback();

		const row = await db
			.prepare('SELECT email FROM users WHERE id = ?')
			.bind(alice.id)
			.first<{ email: string }>();
		expect(row?.email).toBe('known@example.test');
	});

	it('falls back to the profile email when no verified address is listed', async () => {
		await insertUser(db, { username: 'alice', githubId: 4242 });
		stubGitHub({
			'https://api.github.com/user': {
				id: 4242,
				login: 'octocat',
				email: 'profile@example.test',
			},
			'https://api.github.com/user/emails': [
				{ email: 'nope@example.test', primary: true, verified: false },
			],
		});

		await callback();

		const row = await db
			.prepare('SELECT email FROM users WHERE github_id = 4242')
			.first<{ email: string }>();
		expect(row?.email).toBe('profile@example.test');
	});

	it('rejects a state that does not match the signed cookie', async () => {
		stubGitHub();
		const { response } = await callback({
			state: 'forged',
			cookieState: 'the-state',
		});
		failed(response);
	});

	it('rejects a callback with no state cookie at all', async () => {
		stubGitHub();
		const context = ctx({
			path: '/api/auth/callback?code=gh-code&state=the-state',
		});
		failed(await CALLBACK(context as never));
	});

	it('rejects an expired state cookie', async () => {
		stubGitHub();
		const context = ctx({
			path: '/api/auth/callback?code=gh-code&state=the-state',
			cookies: {
				[OAUTH_STATE_COOKIE]: await signPayload(SECRET, {
					state: 'the-state',
					next: '/',
					exp: Date.now() - 1,
				}),
			},
		});
		failed(await CALLBACK(context as never));
	});

	it('rejects a state cookie signed with another secret', async () => {
		stubGitHub();
		const context = ctx({
			path: '/api/auth/callback?code=gh-code&state=the-state',
			cookies: {
				[OAUTH_STATE_COOKIE]: await signPayload('someone-elses-secret', {
					state: 'the-state',
					next: '/',
					exp: Date.now() + 600_000,
				}),
			},
		});
		failed(await CALLBACK(context as never));
	});

	it('rejects a callback with no code', async () => {
		stubGitHub();
		failed((await callback({ code: null })).response);
	});

	it('clears the state cookie so it cannot be replayed', async () => {
		stubGitHub();
		const { context } = await callback();
		expect(context.cookies.deleted).toContain(OAUTH_STATE_COOKIE);
	});

	it('fails cleanly when the token exchange is refused', async () => {
		stubGitHub({
			'https://github.com/login/oauth/access_token': {
				error: 'bad_verification_code',
			},
		});
		failed((await callback()).response);
	});

	it('fails cleanly when GitHub will not identify the user', async () => {
		stubGitHub({
			'https://api.github.com/user': new Response('nope', { status: 401 }),
		});
		failed((await callback()).response);
	});

	it('fails cleanly on an unexpected user payload', async () => {
		stubGitHub({ 'https://api.github.com/user': { login: 'octocat' } });
		failed((await callback()).response);
	});

	it('fails cleanly when GitHub is unreachable', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new Error('network down');
			})
		);
		failed((await callback()).response);
	});

	it('identifies itself to GitHub, which rejects requests without a User-Agent', async () => {
		const { calls } = stubGitHub();
		await callback();
		for (const call of calls) {
			expect(
				(call.init?.headers as Record<string, string>)['User-Agent'],
				call.url
			).toBe('rankmaker');
		}
	});
});

describe('POST /api/auth/complete-signup', () => {
	const signupCookie = (overrides: Record<string, unknown> = {}) =>
		signPayload(SECRET, {
			ghId: 4242,
			ghLogin: 'octocat',
			ghEmail: 'primary@example.test',
			next: '/',
			exp: Date.now() + 900_000,
			...overrides,
		});

	const complete = async (
		body: unknown,
		options: { cookie?: string | null; origin?: string | null } = {}
	) => {
		const cookie =
			options.cookie === null ? undefined : (options.cookie ?? (await signupCookie()));
		const context = ctx({
			path: '/api/auth/complete-signup',
			method: 'POST',
			body,
			cookies: cookie ? { [SIGNUP_COOKIE]: cookie } : {},
			origin: options.origin,
		});
		return { response: await COMPLETE_SIGNUP(context as never), context };
	};

	it('creates the account, signs them in and clears the handoff', async () => {
		const { response, context } = await complete({
			username: 'octocat',
			avatar: SELECTABLE_AVATAR_KEYS[0],
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true, next: '/' });

		const row = await db
			.prepare(
				'SELECT username, avatar, github_id, email FROM users WHERE username = ?'
			)
			.bind('octocat')
			.first<any>();
		expect(row).toEqual({
			username: 'octocat',
			avatar: SELECTABLE_AVATAR_KEYS[0],
			github_id: 4242,
			email: 'primary@example.test',
		});
		expect(await getSessionUser(context.cookies, db)).toMatchObject({
			username: 'octocat',
		});
		expect(context.cookies.deleted).toContain(SIGNUP_COOKIE);
	});

	it('sends them back where they started', async () => {
		const { response } = await complete(
			{ username: 'octocat', avatar: SELECTABLE_AVATAR_KEYS[0] },
			{ cookie: await signupCookie({ next: '/template/x' }) }
		);
		expect(((await response.json()) as any).next).toBe('/template/x');
	});

	it('rejects a cross-site request', async () => {
		const { response } = await complete(
			{ username: 'octocat', avatar: SELECTABLE_AVATAR_KEYS[0] },
			{ origin: null }
		);
		expect(response.status).toBe(403);
		expect(await db.prepare('SELECT id FROM users WHERE github_id = 4242').first())
			.toBeNull();
	});

	it('refuses without a valid handoff cookie', async () => {
		for (const cookie of [null, 'garbage', await signupCookie({ exp: 1 })]) {
			const { response } = await complete(
				{ username: 'octocat', avatar: SELECTABLE_AVATAR_KEYS[0] },
				{ cookie }
			);
			expect(response.status).toBe(401);
		}
	});

	it('refuses a handoff cookie forged with another secret', async () => {
		const forged = await signPayload('someone-elses-secret', {
			ghId: 9999,
			ghLogin: 'attacker',
			next: '/',
			exp: Date.now() + 900_000,
		});
		const { response } = await complete(
			{ username: 'attacker', avatar: SELECTABLE_AVATAR_KEYS[0] },
			{ cookie: forged }
		);
		expect(response.status).toBe(401);
	});

	it('applies the username rules', async () => {
		for (const username of ['ab', '-nope-', 'admin', 42, undefined]) {
			const { response } = await complete({
				username,
				avatar: SELECTABLE_AVATAR_KEYS[0],
			});
			expect(response.status, String(username)).toBe(400);
		}
	});

	it('rejects an avatar that is not one of the presets', async () => {
		for (const avatar of ['official', 'made-up', '', 42, null, undefined]) {
			const { response } = await complete({ username: 'octocat', avatar });
			expect(response.status, String(avatar)).toBe(400);
		}
	});

	it('409s a username that is already taken, whatever its casing', async () => {
		await insertUser(db, { username: 'Octocat' });
		const { response } = await complete({
			username: 'octocat',
			avatar: SELECTABLE_AVATAR_KEYS[0],
		});
		expect(response.status).toBe(409);
	});

	it('409s rather than 500s when the same GitHub account signs up twice', async () => {
		await insertUser(db, { username: 'first', githubId: 4242 });
		const { response } = await complete({
			username: 'second',
			avatar: SELECTABLE_AVATAR_KEYS[0],
		});
		expect(response.status).toBe(409);
	});

	it('rejects invalid JSON', async () => {
		const { response } = await complete('not json');
		expect(response.status).toBe(400);
	});
});
