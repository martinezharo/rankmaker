import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET } from '../../src/pages/api/health';
import { createTestDb, type TestD1 } from '../../src/test/d1';
import { apiContext } from '../../src/test/api';

let db: TestD1;

const REQUIRED = {
	SESSION_SECRET: 'a-secret',
	GITHUB_CLIENT_ID: 'id',
	GITHUB_CLIENT_SECRET: 'secret',
};
const OPTIONAL_INTEGRATIONS = {
	OPENAI_API_KEY: 'k',
	RESEND_API_KEY: 'k',
	RESEND_FROM: 'f',
};
const DEFAULT_BACKED = {
	SITE_URL: 'https://rankmaker.net',
	IMAGES_PUBLIC_BASE: 'https://img.rankmaker.net',
};
const OPTIONAL = { ...OPTIONAL_INTEGRATIONS, ...DEFAULT_BACKED };

beforeEach(() => {
	db = createTestDb();
});
afterEach(() => {
	db.close();
});

const probe = (env: Record<string, unknown>, key?: string) =>
	GET(
		apiContext({
			db,
			method: 'GET',
			path: key ? `/api/health?key=${encodeURIComponent(key)}` : '/api/health',
			env,
		}) as never
	);

describe('GET /api/health', () => {
	it('is ok when every table and value is present', async () => {
		const response = await probe({ ...REQUIRED, ...OPTIONAL });
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			status: 'ok',
			checks: { db: true, requiredEnv: true },
		});
	});

	it('is ok when only values with runtime fallbacks are omitted', async () => {
		const response = await probe({ ...REQUIRED, ...OPTIONAL_INTEGRATIONS });
		expect(response.status).toBe(200);
		expect(((await response.json()) as any).status).toBe('ok');
	});

	it('is degraded — but still 200 — when an optional integration is missing', async () => {
		const response = await probe({ ...REQUIRED, ...DEFAULT_BACKED });
		expect(response.status).toBe(200);
		expect(((await response.json()) as any).status).toBe('degraded');
	});

	it('is unhealthy and 503 when a required secret is missing', async () => {
		const response = await probe({
			...REQUIRED,
			...OPTIONAL,
			SESSION_SECRET: '',
		});
		expect(response.status).toBe(503);
		expect(((await response.json()) as any).status).toBe('unhealthy');
	});

	it('is unhealthy when the database is unreachable', async () => {
		const broken = {
			prepare: () => {
				throw new Error('D1 is down');
			},
		} as never;
		const response = await GET(
			apiContext({
				db: broken,
				method: 'GET',
				path: '/api/health',
				env: { ...REQUIRED, ...OPTIONAL },
			}) as never
		);
		expect(response.status).toBe(503);
	});

	it('withholds the detail from an unauthenticated caller', async () => {
		const payload = (await (await probe(REQUIRED)).json()) as any;
		expect(payload.checks).toEqual({ db: true, requiredEnv: true });
		expect(payload.env).toBeUndefined();
		expect(payload.db).toBeUndefined();
	});

	it('returns the detail to a caller holding the secret', async () => {
		const payload = (await (
			await probe(REQUIRED, REQUIRED.SESSION_SECRET)
		).json()) as any;
		expect(payload.db).toEqual({ ok: true, missingTables: [], error: null });
		expect(payload.env.missingRequired).toEqual([]);
		expect(payload.env.missingOptional.sort()).toEqual(
			Object.keys(OPTIONAL_INTEGRATIONS).sort()
		);
	});

	it('ignores a wrong or truncated key', async () => {
		for (const key of ['wrong', 'a-secre', 'a-secret-longer']) {
			const payload = (await (await probe(REQUIRED, key)).json()) as any;
			expect(payload.env, key).toBeUndefined();
		}
	});

	it('is never cached and never indexed', async () => {
		const response = await probe(REQUIRED);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
	});
});
