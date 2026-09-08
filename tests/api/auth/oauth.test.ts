/**
 * The OAuth handshake: /login → provider → /callback → (/signup →
 * /complete-signup) or a session.
 *
 * Google is the primary provider and GitHub the secondary one, and both go
 * through the same two routes — so these tests run the shared rules once and
 * the provider-specific bits (authorize URL, token exchange, profile shape)
 * per provider.
 *
 * The providers' side is stubbed at `fetch`, which is the whole point: the
 * failure modes worth guarding are ours — an open redirect in `next`, a forged
 * or replayed `state`, a token exchange that fails, the rule that no user row
 * exists until a username is picked, and the rule that a second provider only
 * joins an existing account on a *verified* address.
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
import { findUserIdByIdentity } from '../../../src/lib/identities';
import { getMarketingConsent } from '../../../src/lib/marketing-consent';
import { createTestDb, type TestD1 } from '../../../src/test/d1';
import { apiContext, TEST_ORIGIN, type TestContext } from '../../../src/test/api';
import { insertUser } from '../../../src/test/factories';

const SECRET = 'test-session-secret';
const ENV = {
	SESSION_SECRET: SECRET,
	GOOGLE_CLIENT_ID: 'google-client-id',
	GOOGLE_CLIENT_SECRET: 'google-client-secret',
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
	env?: Record<string, unknown>;
}): TestContext {
	return apiContext({
		db,
		path: options.path,
		method: options.method ?? 'GET',
		body: options.body,
		cookies: options.cookies ?? {},
		origin: options.origin,
		env: options.env ?? ENV,
	});
}

/** The payload of a signed cookie, without verifying it. */
function payloadOf(cookieValue: string): Record<string, unknown> {
	return JSON.parse(
		Buffer.from(
			cookieValue.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'),
			'base64'
		).toString()
	);
}

/** The providers' responses, keyed by URL, with a record of what we asked. */
function stubProviders(overrides: Record<string, unknown> = {}) {
	const responses: Record<string, unknown> = {
		// Google
		'https://oauth2.googleapis.com/token': { access_token: 'google-token' },
		'https://openidconnect.googleapis.com/v1/userinfo': {
			sub: '1122334455',
			email: 'primary@example.test',
			email_verified: true,
		},
		// GitHub
		'https://github.com/login/oauth/access_token': { access_token: 'gh-token' },
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
const stateCookie = (
	state: string,
	next = '/',
	/** null omits the field, as cookies minted before providers existed did. */
	provider: string | null = 'google'
) =>
	signPayload(SECRET, {
		state,
		next,
		...(provider ? { provider } : {}),
		exp: Date.now() + 600_000,
	});

describe('GET /api/auth/login', () => {
	it('sends people to Google, the primary provider, by default', async () => {
		const response = await LOGIN(ctx({ path: '/api/auth/login' }) as never);
		expect(response.status).toBe(302);

		const location = new URL(response.headers.get('Location')!);
		expect(location.origin + location.pathname).toBe(
			'https://accounts.google.com/o/oauth2/v2/auth'
		);
		expect(location.searchParams.get('client_id')).toBe('google-client-id');
		expect(location.searchParams.get('redirect_uri')).toBe(
			`${TEST_ORIGIN}/api/auth/callback`
		);
		expect(location.searchParams.get('response_type')).toBe('code');
		expect(location.searchParams.get('scope')).toBe('openid email');
		expect(location.searchParams.get('prompt')).toBe('select_account');
		expect(location.searchParams.get('state')).toMatch(/^[0-9a-f]{32}$/);
	});

	it('sends them to GitHub when asked for it', async () => {
		const response = await LOGIN(
			ctx({ path: '/api/auth/login?provider=github' }) as never
		);
		const location = new URL(response.headers.get('Location')!);
		expect(location.origin + location.pathname).toBe(
			'https://github.com/login/oauth/authorize'
		);
		expect(location.searchParams.get('client_id')).toBe('client-id');
		expect(location.searchParams.get('scope')).toBe('user:email');
		expect(location.searchParams.get('redirect_uri')).toBe(
			`${TEST_ORIGIN}/api/auth/callback`
		);
	});

	it('remembers the provider, so one callback can serve them all', async () => {
		for (const [query, provider] of [
			['', 'google'],
			['?provider=github', 'github'],
			// Unknown or unconfigured → the primary one, never a 500.
			['?provider=myspace', 'google'],
		]) {
			const context = ctx({ path: `/api/auth/login${query}` });
			await LOGIN(context as never);
			const cookie = context.cookies.written.get(OAUTH_STATE_COOKIE)!;
			expect(payloadOf(cookie.value).provider, query).toBe(provider);
		}
	});

	it('falls back to a configured provider when the requested one is not', async () => {
		const response = await LOGIN(
			ctx({
				path: '/api/auth/login?provider=google',
				env: { ...ENV, GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' },
			}) as never
		);
		expect(response.headers.get('Location')).toContain('github.com');
	});

	it('fails cleanly when no provider has credentials', async () => {
		const response = await LOGIN(
			ctx({
				path: '/api/auth/login',
				env: { SESSION_SECRET: SECRET },
			}) as never
		);
		expect(response.headers.get('Location')).toBe('/?auth_error=1');
	});

	it('remembers a same-site return path', async () => {
		const context = ctx({ path: '/api/auth/login?next=/template/x' });
		await LOGIN(context as never);
		const cookie = context.cookies.written.get(OAUTH_STATE_COOKIE)!;
		expect(cookie.options).toMatchObject({ httpOnly: true, maxAge: 600 });
		expect(payloadOf(cookie.value).next).toBe('/template/x');
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
			expect(payloadOf(value).next, next).toBe('/');
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
			provider?: string | null;
			cookies?: Record<string, string>;
		} = {}
	) => {
		const {
			code = 'the-code',
			state = 'the-state',
			cookieState = 'the-state',
			next = '/',
			provider = 'google',
		} = options;
		const params = new URLSearchParams();
		if (code !== null) params.set('code', code);
		if (state !== null) params.set('state', state);
		const context = ctx({
			path: `/api/auth/callback?${params}`,
			cookies: {
				[OAUTH_STATE_COOKIE]: await stateCookie(cookieState, next, provider),
				...options.cookies,
			},
		});
		return { response: await CALLBACK(context as never), context };
	};

	const failed = (response: Response) => {
		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('/?auth_error=1');
	};

	/** Accounts the migrations seed (RANKMAKER, the deleted-user placeholder). */
	const realUsers = async () =>
		(
			await db
				.prepare(
					"SELECT COUNT(*) AS n FROM users WHERE id NOT IN ('rankmaker-official', 'deleted-user')"
				)
				.first<{ n: number }>()
		)!.n;

	it('hands a brand-new Google user off to /signup without creating a row', async () => {
		stubProviders();
		const { response, context } = await callback();

		expect(response.headers.get('Location')).toBe('/signup');
		const handoff = context.cookies.written.get(SIGNUP_COOKIE)!;
		expect(handoff.options).toMatchObject({ httpOnly: true, maxAge: 900 });
		expect(payloadOf(handoff.value)).toMatchObject({
			provider: 'google',
			accountId: '1122334455',
			// Google has no usernames, so the address' local part is the seed.
			login: 'primary',
			email: 'primary@example.test',
		});
		expect(await realUsers()).toBe(0);
		expect(await db.prepare('SELECT user_id FROM user_identities').first()).toBeNull();
	});

	it('hands a brand-new GitHub user off with their GitHub login', async () => {
		stubProviders();
		const { response, context } = await callback({ provider: 'github' });

		expect(response.headers.get('Location')).toBe('/signup');
		expect(
			payloadOf(context.cookies.written.get(SIGNUP_COOKIE)!.value)
		).toMatchObject({
			provider: 'github',
			accountId: '4242',
			login: 'octocat',
		});
	});

	it('signs a known identity straight in, and back to where they were', async () => {
		const alice = await insertUser(db, {
			username: 'alice',
			identity: { provider: 'google', accountId: '1122334455' },
		});
		stubProviders();

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

	it('treats a state cookie with no provider as GitHub, so logins in flight survive a deploy', async () => {
		const alice = await insertUser(db, {
			username: 'alice',
			identity: { provider: 'github', accountId: '4242' },
		});
		stubProviders();

		const { context } = await callback({ provider: null });

		expect(await getSessionUser(context.cookies, db)).toMatchObject({
			id: alice.id,
		});
	});

	it('rejects a state cookie naming a provider we do not have', async () => {
		stubProviders();
		failed((await callback({ provider: 'myspace' })).response);
	});

	it('refreshes the stored email on every login', async () => {
		const alice = await insertUser(db, {
			username: 'alice',
			identity: { provider: 'google', accountId: '1122334455' },
		});
		stubProviders();
		await callback();

		const row = await db
			.prepare('SELECT email, email_verified FROM users WHERE id = ?')
			.bind(alice.id)
			.first<{ email: string; email_verified: number }>();
		expect(row?.email).toBe('primary@example.test');
		// Verified, so a second provider may be matched against it later.
		expect(row?.email_verified).toBe(1);
	});

	it('does not clobber a stored email when the provider gives none', async () => {
		const alice = await insertUser(db, {
			username: 'alice',
			email: 'known@example.test',
			identity: { provider: 'github', accountId: '4242' },
		});
		stubProviders({
			'https://api.github.com/user': { id: 4242, login: 'octocat' },
			'https://api.github.com/user/emails': [],
		});

		await callback({ provider: 'github' });

		const row = await db
			.prepare('SELECT email FROM users WHERE id = ?')
			.bind(alice.id)
			.first<{ email: string }>();
		expect(row?.email).toBe('known@example.test');
	});

	it('falls back to the GitHub profile email when no verified address is listed', async () => {
		const alice = await insertUser(db, {
			username: 'alice',
			identity: { provider: 'github', accountId: '4242' },
		});
		stubProviders({
			'https://api.github.com/user': {
				id: 4242,
				login: 'octocat',
				email: 'profile@example.test',
			},
			'https://api.github.com/user/emails': [
				{ email: 'nope@example.test', primary: true, verified: false },
			],
		});

		await callback({ provider: 'github' });

		const row = await db
			.prepare('SELECT email, email_verified FROM users WHERE id = ?')
			.bind(alice.id)
			.first<{ email: string; email_verified: number }>();
		expect(row?.email).toBe('profile@example.test');
		// Good enough to email, not good enough to link another provider to.
		expect(row?.email_verified).toBe(0);
	});

	describe('linking a second provider', () => {
		it('signs a GitHub user in through Google on their verified address', async () => {
			// The upgrade path that matters: everyone who has an account today
			// signed up with GitHub, and the new primary button is Google.
			const alice = await insertUser(db, {
				username: 'alice',
				email: 'primary@example.test',
				emailVerified: true,
				identity: { provider: 'github', accountId: '4242' },
			});
			stubProviders();

			const { response, context } = await callback();

			expect(response.headers.get('Location')).toBe('/');
			expect(await getSessionUser(context.cookies, db)).toMatchObject({
				id: alice.id,
			});
			// Linked on the spot, so the next login is a direct hit.
			expect(
				await findUserIdByIdentity(db, 'google', '1122334455')
			).toBe(alice.id);
			// One account, now reachable through both providers.
			expect(await realUsers()).toBe(1);
		});

		it('refuses to link an address the provider has not verified', async () => {
			await insertUser(db, {
				username: 'alice',
				email: 'primary@example.test',
				emailVerified: true,
				identity: { provider: 'github', accountId: '4242' },
			});
			stubProviders({
				'https://openidconnect.googleapis.com/v1/userinfo': {
					sub: '1122334455',
					email: 'primary@example.test',
					email_verified: false,
				},
			});

			const { response, context } = await callback();

			// Anything else would hand alice's account to whoever can type her
			// address into a provider that does not check it.
			expect(response.headers.get('Location')).toBe('/signup');
			expect(context.cookies.written.get(SESSION_COOKIE)).toBeUndefined();
			expect(await findUserIdByIdentity(db, 'google', '1122334455')).toBeNull();
		});

		it('refuses to guess when two accounts share the address', async () => {
			for (const username of ['alice', 'bob']) {
				await insertUser(db, {
					username,
					email: 'primary@example.test',
					emailVerified: true,
				});
			}

			stubProviders();

			const { response } = await callback();

			expect(response.headers.get('Location')).toBe('/signup');
			expect(await findUserIdByIdentity(db, 'google', '1122334455')).toBeNull();
		});

		it('refuses to link to an address the account never verified', async () => {
			// The other half of the rule: an address a provider vouches for
			// still has to meet an account that vouched for it too, or
			// storing an unverified address would be enough to collect
			// whoever proves that same address elsewhere later.
			await insertUser(db, {
				username: 'alice',
				email: 'primary@example.test',
				emailVerified: false,
				identity: { provider: 'github', accountId: '4242' },
			});
			stubProviders();

			const { response } = await callback();

			expect(response.headers.get('Location')).toBe('/signup');
			expect(await findUserIdByIdentity(db, 'google', '1122334455')).toBeNull();
		});
	});

	it('rejects a state that does not match the signed cookie', async () => {
		stubProviders();
		const { response } = await callback({
			state: 'forged',
			cookieState: 'the-state',
		});
		failed(response);
	});

	it('rejects a callback with no state cookie at all', async () => {
		stubProviders();
		const context = ctx({
			path: '/api/auth/callback?code=the-code&state=the-state',
		});
		failed(await CALLBACK(context as never));
	});

	it('rejects an expired state cookie', async () => {
		stubProviders();
		const context = ctx({
			path: '/api/auth/callback?code=the-code&state=the-state',
			cookies: {
				[OAUTH_STATE_COOKIE]: await signPayload(SECRET, {
					state: 'the-state',
					next: '/',
					provider: 'google',
					exp: Date.now() - 1,
				}),
			},
		});
		failed(await CALLBACK(context as never));
	});

	it('rejects a state cookie signed with another secret', async () => {
		stubProviders();
		const context = ctx({
			path: '/api/auth/callback?code=the-code&state=the-state',
			cookies: {
				[OAUTH_STATE_COOKIE]: await signPayload('someone-elses-secret', {
					state: 'the-state',
					next: '/',
					provider: 'google',
					exp: Date.now() + 600_000,
				}),
			},
		});
		failed(await CALLBACK(context as never));
	});

	it('rejects a callback with no code', async () => {
		stubProviders();
		failed((await callback({ code: null })).response);
	});

	it('will not redirect off-site even if the signed cookie says so', async () => {
		// Belt and braces: /login already refuses to sign one of these.
		await insertUser(db, {
			username: 'alice',
			identity: { provider: 'google', accountId: '1122334455' },
		});
		stubProviders();
		const { response } = await callback({ next: '//evil.test' });
		expect(response.headers.get('Location')).toBe('/');
	});

	it('clears the state cookie so it cannot be replayed', async () => {
		stubProviders();
		const { context } = await callback();
		expect(context.cookies.deleted).toContain(OAUTH_STATE_COOKIE);
	});

	it('fails cleanly when the token exchange is refused', async () => {
		stubProviders({
			'https://oauth2.googleapis.com/token': { error: 'invalid_grant' },
		});
		failed((await callback()).response);
	});

	it('fails cleanly when the provider will not identify the user', async () => {
		stubProviders({
			'https://openidconnect.googleapis.com/v1/userinfo': new Response(
				'nope',
				{ status: 401 }
			),
		});
		failed((await callback()).response);
	});

	it('fails cleanly on an unexpected user payload', async () => {
		stubProviders({
			'https://openidconnect.googleapis.com/v1/userinfo': {
				email: 'primary@example.test',
			},
		});
		failed((await callback()).response);
		stubProviders({ 'https://api.github.com/user': { login: 'octocat' } });
		failed((await callback({ provider: 'github' })).response);
	});

	it('fails cleanly when the provider is unreachable', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new Error('network down');
			})
		);
		failed((await callback()).response);
	});

	it('posts the Google token exchange as a form, which is all it accepts', async () => {
		const { calls } = stubProviders();
		await callback();
		const exchange = calls.find(
			(c) => c.url === 'https://oauth2.googleapis.com/token'
		)!;
		expect(
			(exchange.init?.headers as Record<string, string>)['Content-Type']
		).toBe('application/x-www-form-urlencoded');
		const body = new URLSearchParams(exchange.init?.body as string);
		expect(Object.fromEntries(body)).toMatchObject({
			code: 'the-code',
			client_id: 'google-client-id',
			client_secret: 'google-client-secret',
			grant_type: 'authorization_code',
			redirect_uri: `${TEST_ORIGIN}/api/auth/callback`,
		});
	});

	it('identifies itself to GitHub, which rejects requests without a User-Agent', async () => {
		const { calls } = stubProviders();
		await callback({ provider: 'github' });
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
			provider: 'google',
			accountId: '1122334455',
			login: 'primary',
			email: 'primary@example.test',
			emailVerified: true,
			next: '/',
			exp: Date.now() + 900_000,
			...overrides,
		});

	const userId = async (username: string) =>
		(
			await db
				.prepare('SELECT id FROM users WHERE username = ?')
				.bind(username)
				.first<{ id: string }>()
		)!.id;

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

	it('creates the account and its identity, signs them in, clears the handoff', async () => {
		const { response, context } = await complete({
			username: 'octocat',
			avatar: SELECTABLE_AVATAR_KEYS[0],
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true, next: '/' });

		const row = await db
			.prepare(
				'SELECT id, username, avatar, email, email_verified FROM users WHERE username = ?'
			)
			.bind('octocat')
			.first<any>();
		expect(row).toMatchObject({
			username: 'octocat',
			avatar: SELECTABLE_AVATAR_KEYS[0],
			email: 'primary@example.test',
			// Carried from the provider, not assumed: an account created from
			// an unverified address must not collect another provider later.
			email_verified: 1,
		});
		expect(await findUserIdByIdentity(db, 'google', '1122334455')).toBe(row.id);
		expect(await getSessionUser(context.cookies, db)).toMatchObject({
			username: 'octocat',
		});
		expect(context.cookies.deleted).toContain(SIGNUP_COOKIE);
	});

	it('creates a GitHub identity for a GitHub handoff', async () => {
		await complete(
			{ username: 'octocat', avatar: SELECTABLE_AVATAR_KEYS[0] },
			{
				cookie: await signupCookie({
					provider: 'github',
					accountId: '4242',
					login: 'octocat',
				}),
			}
		);
		expect(await findUserIdByIdentity(db, 'github', '4242')).toBe(
			await userId('octocat')
		);
	});

	it('stores an unverified address as unverified', async () => {
		await complete(
			{ username: 'octocat', avatar: SELECTABLE_AVATAR_KEYS[0] },
			{ cookie: await signupCookie({ emailVerified: false }) }
		);
		const row = await db
			.prepare('SELECT email, email_verified FROM users WHERE username = ?')
			.bind('octocat')
			.first<{ email: string; email_verified: number }>();
		expect(row?.email).toBe('primary@example.test');
		expect(row?.email_verified).toBe(0);
	});

	it('records the marketing opt-in when the box is ticked', async () => {
		await complete({
			username: 'octocat',
			avatar: SELECTABLE_AVATAR_KEYS[0],
			marketingConsent: true,
		});
		const id = await userId('octocat');
		expect(await getMarketingConsent(db, id)).toBe(true);
	});

	it('never infers consent from a missing or truthy-ish value', async () => {
		for (const [i, value] of [undefined, 'true', 1, null].entries()) {
			await complete(
				{
					username: `octocat${i}`,
					avatar: SELECTABLE_AVATAR_KEYS[0],
					marketingConsent: value,
				},
				// A fresh provider account per pass: identities are unique.
				{ cookie: await signupCookie({ accountId: `500${i}` }) }
			);
			expect(
				await getMarketingConsent(db, await userId(`octocat${i}`)),
				`marketingConsent: ${String(value)}`
			).toBe(false);
		}
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
		expect(
			await db.prepare('SELECT user_id FROM user_identities').first()
		).toBeNull();
	});

	it('refuses without a valid handoff cookie', async () => {
		for (const cookie of [
			null,
			'garbage',
			await signupCookie({ exp: 1 }),
			// Handoffs from before the signup flow spoke providers, and any
			// forgery that drops a field.
			await signupCookie({ provider: undefined }),
			await signupCookie({ provider: 'myspace' }),
			await signupCookie({ accountId: undefined }),
		]) {
			const { response } = await complete(
				{ username: 'octocat', avatar: SELECTABLE_AVATAR_KEYS[0] },
				{ cookie }
			);
			expect(response.status).toBe(401);
		}
	});

	it('refuses a handoff cookie forged with another secret', async () => {
		const forged = await signPayload('someone-elses-secret', {
			provider: 'google',
			accountId: '9999',
			login: 'attacker',
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

	it('409s rather than 500s when the same provider account signs up twice', async () => {
		await insertUser(db, {
			username: 'first',
			identity: { provider: 'google', accountId: '1122334455' },
		});
		const { response } = await complete({
			username: 'second',
			avatar: SELECTABLE_AVATAR_KEYS[0],
		});
		expect(response.status).toBe(409);
		// The whole signup is one transaction, so the rejected attempt leaves
		// no half-created account behind.
		expect(
			await db.prepare('SELECT id FROM users WHERE username = ?').bind('second').first()
		).toBeNull();
	});

	it('rejects invalid JSON', async () => {
		const { response } = await complete('not json');
		expect(response.status).toBe(400);
	});
});
