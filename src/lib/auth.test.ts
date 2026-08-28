import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	SESSION_COOKIE,
	checkOrigin,
	createSession,
	deleteSession,
	getSessionUser,
	isUsernameTaken,
	json,
	randomHex,
	sessionCookieOptions,
	shortCookieOptions,
	signPayload,
	usernameProblem,
	verifyPayload,
} from './auth';
import { createTestDb, type TestD1 } from '../test/d1';
import { fakeCookies } from '../test/cookies';
import { insertUser } from '../test/factories';

describe('signed payloads', () => {
	it('round-trips UTF-8 payloads', async () => {
		const payload = { username: 'José 日本', exp: Date.now() + 60_000 };
		const signed = await signPayload('test-secret', payload);

		expect(await verifyPayload('test-secret', signed)).toEqual(payload);
	});

	it('rejects signatures with an invalid length', async () => {
		const signed = await signPayload('test-secret', { exp: Date.now() + 60_000 });

		expect(await verifyPayload('test-secret', `${signed}0`)).toBeNull();
	});

	it('rejects expired payloads', async () => {
		const signed = await signPayload('test-secret', { exp: Date.now() - 1 });

		expect(await verifyPayload('test-secret', signed)).toBeNull();
	});

	it('rejects a payload signed with a different secret', async () => {
		const signed = await signPayload('one-secret', {
			username: 'alice',
			exp: Date.now() + 60_000,
		});

		expect(await verifyPayload('another-secret', signed)).toBeNull();
	});

	it('rejects a tampered payload that keeps a well-formed signature', async () => {
		const signed = await signPayload('test-secret', {
			username: 'alice',
			exp: Date.now() + 60_000,
		});
		const [data, sig] = signed.split('.');
		const forged = `${data.slice(0, -1)}${data.slice(-1) === 'A' ? 'B' : 'A'}.${sig}`;

		expect(await verifyPayload('test-secret', forged)).toBeNull();
	});

	it('rejects malformed and empty values without throwing', async () => {
		for (const value of [undefined, '', 'no-dot', '.', 'a.b', '$$$.'.padEnd(70, '0')]) {
			expect(await verifyPayload('test-secret', value)).toBeNull();
		}
	});

	it('accepts a payload with no expiry', async () => {
		const signed = await signPayload('test-secret', { username: 'alice' });
		expect(await verifyPayload('test-secret', signed)).toEqual({
			username: 'alice',
		});
	});
});

describe('cookie options', () => {
	it('keeps the session cookie unreadable from JavaScript and same-site', () => {
		const options = sessionCookieOptions();
		expect(options.httpOnly).toBe(true);
		expect(options.sameSite).toBe('lax');
		expect(options.path).toBe('/');
		expect(options.maxAge).toBe(30 * 24 * 60 * 60);
	});

	it('gives the short-lived handoff cookies the same protections', () => {
		const options = shortCookieOptions(600);
		expect(options.httpOnly).toBe(true);
		expect(options.sameSite).toBe('lax');
		expect(options.maxAge).toBe(600);
	});
});

describe('randomHex', () => {
	it('returns two hex characters per byte', () => {
		expect(randomHex(16)).toMatch(/^[0-9a-f]{32}$/);
	});

	it('does not repeat itself', () => {
		const values = new Set(Array.from({ length: 50 }, () => randomHex(32)));
		expect(values.size).toBe(50);
	});
});

describe('checkOrigin', () => {
	const request = (origin: string | null) =>
		new Request('https://rankmaker.net/api/templates', {
			method: 'POST',
			headers: origin ? { Origin: origin } : {},
		});

	it('accepts a same-origin request', () => {
		expect(checkOrigin(request('https://rankmaker.net'))).toBe(true);
	});

	it('rejects a cross-site request', () => {
		expect(checkOrigin(request('https://evil.test'))).toBe(false);
	});

	it('rejects a missing Origin header', () => {
		expect(checkOrigin(request(null))).toBe(false);
	});

	it('rejects an origin that only looks like ours', () => {
		for (const origin of [
			'https://rankmaker.net.evil.test',
			'http://rankmaker.net',
			'https://sub.rankmaker.net',
			'null',
		]) {
			expect(checkOrigin(request(origin))).toBe(false);
		}
	});
});

describe('usernameProblem', () => {
	it('accepts ordinary usernames', () => {
		for (const username of ['abc', 'alice', 'a_b-c', 'User99', 'a'.repeat(30)]) {
			expect(usernameProblem(username)).toBeNull();
		}
	});

	it('rejects anything that is not a string', () => {
		for (const value of [undefined, null, 42, {}, ['alice']]) {
			expect(usernameProblem(value)).toBe('Username is required.');
		}
	});

	it('rejects the wrong length', () => {
		expect(usernameProblem('ab')).toMatch(/3-30/);
		expect(usernameProblem('a'.repeat(31))).toMatch(/3-30/);
	});

	it('requires the first and last character to be alphanumeric', () => {
		for (const username of ['-alice', 'alice-', '_alice', 'alice_']) {
			expect(usernameProblem(username)).toMatch(/3-30/);
		}
	});

	it('rejects characters that would break a profile URL', () => {
		for (const username of ['ali ce', 'ali/ce', 'ali.ce', 'ali@ce', 'álice']) {
			expect(usernameProblem(username)).toMatch(/3-30/);
		}
	});

	it('rejects reserved names whatever their casing', () => {
		for (const username of ['admin', 'RANKMAKER', 'Settings', 'api']) {
			expect(usernameProblem(username)).toBe('This username is reserved.');
		}
	});
});

describe('json', () => {
	it('serializes with a JSON content type and the given status', async () => {
		const response = json({ ok: true }, 201, { 'X-Test': '1' });
		expect(response.status).toBe(201);
		expect(response.headers.get('Content-Type')).toBe('application/json');
		expect(response.headers.get('X-Test')).toBe('1');
		expect(await response.json()).toEqual({ ok: true });
	});
});

describe('sessions', () => {
	let db: TestD1;
	beforeEach(() => {
		db = createTestDb();
	});
	afterEach(() => {
		db.close();
	});

	it('resolves the signed-in user from the session cookie', async () => {
		const alice = await insertUser(db, {
			username: 'alice',
			isVerified: true,
			showMature: true,
		});
		const sessionId = await createSession(db, alice.id);

		expect(
			await getSessionUser(fakeCookies({ [SESSION_COOKIE]: sessionId }), db)
		).toEqual({
			id: alice.id,
			username: 'alice',
			avatar: 'star-purple',
			isVerified: true,
			showMature: true,
		});
	});

	it('has no user without a session cookie', async () => {
		expect(await getSessionUser(fakeCookies(), db)).toBeNull();
	});

	it('has no user for an unknown session id', async () => {
		expect(
			await getSessionUser(
				fakeCookies({ [SESSION_COOKIE]: 'not-a-real-session' }),
				db
			)
		).toBeNull();
	});

	it('rejects an expired session and deletes the row', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		await db
			.prepare(
				'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
			)
			.bind('stale', alice.id, new Date(Date.now() - 1000).toISOString())
			.run();

		expect(
			await getSessionUser(fakeCookies({ [SESSION_COOKIE]: 'stale' }), db)
		).toBeNull();
		expect(
			await db.prepare('SELECT id FROM sessions').first()
		).toBeNull();
	});

	it('issues an unguessable session id', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		const first = await createSession(db, alice.id);
		const second = await createSession(db, alice.id);
		expect(first).toMatch(/^[0-9a-f]{64}$/);
		expect(first).not.toBe(second);
	});

	it('logs out only the session that was ended', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		const phone = await createSession(db, alice.id);
		const laptop = await createSession(db, alice.id);

		await deleteSession(db, phone);

		expect(
			await getSessionUser(fakeCookies({ [SESSION_COOKIE]: phone }), db)
		).toBeNull();
		expect(
			await getSessionUser(fakeCookies({ [SESSION_COOKIE]: laptop }), db)
		).not.toBeNull();
	});

	it('drops every session when the account is deleted', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		const sessionId = await createSession(db, alice.id);
		await db.prepare('DELETE FROM users WHERE id = ?').bind(alice.id).run();

		expect(
			await getSessionUser(fakeCookies({ [SESSION_COOKIE]: sessionId }), db)
		).toBeNull();
	});
});

describe('isUsernameTaken', () => {
	let db: TestD1;
	beforeEach(() => {
		db = createTestDb();
	});
	afterEach(() => {
		db.close();
	});

	it('matches regardless of case, so lookalikes cannot register', async () => {
		await insertUser(db, { username: 'Alice' });
		expect(await isUsernameTaken(db, 'alice')).toBe(true);
		expect(await isUsernameTaken(db, 'ALICE')).toBe(true);
	});

	it('is false for a free username', async () => {
		expect(await isUsernameTaken(db, 'nobody-yet')).toBe(false);
	});

	it('is true for the reserved official account', async () => {
		expect(await isUsernameTaken(db, 'rankmaker')).toBe(true);
	});
});
