/**
 * The image upload endpoint — the app's only path from an untrusted byte
 * stream to stored content, and therefore its main abuse surface.
 *
 * The Cloudflare Images binding, R2 and OpenAI are stubbed; what is under test
 * is the pipeline's order and its failure handling: cheap validation before
 * quota is spent, no unmoderated image ever stored, and no R2 object left
 * behind without the D1 row that owns it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../../src/pages/api/images/index';
import { GET as SERVE } from '../../../src/pages/api/images/[...key]';
import {
	DAILY_UPLOAD_LIMIT,
	MAX_STORED_BYTES,
	MAX_UPLOAD_BYTES,
} from '../../../src/lib/images';
import { createTestDb, type TestD1 } from '../../../src/test/d1';
import { apiContext, fakeBucket, fakeKv, TEST_ORIGIN } from '../../../src/test/api';
import { insertUser, signIn } from '../../../src/test/factories';

const IMAGE_BASE = 'https://img.test';

/** A minimal but genuine PNG header, so the magic-byte sniff passes. */
const PNG = new Uint8Array([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48,
	0x44, 0x52, 0, 0, 0, 1,
]);

let db: TestD1;
let bucket: ReturnType<typeof fakeBucket>;
let kv: ReturnType<typeof fakeKv>;
let alice: { id: string; username: string };

/** The Images binding, which re-encodes to WebP. */
function fakeImages(output: Uint8Array = new Uint8Array([1, 2, 3, 4])) {
	return {
		input: () => ({
			transform: () => ({
				output: async () => ({
					response: () => new Response(output as BodyInit),
				}),
			}),
		}),
	};
}

beforeEach(async () => {
	db = createTestDb();
	bucket = fakeBucket();
	kv = fakeKv();
	alice = await insertUser(db, { username: 'alice' });
	// Moderation says "allowed" unless a test says otherwise.
	vi.stubGlobal(
		'fetch',
		vi.fn(
			async () =>
				new Response(
					JSON.stringify({ results: [{ category_scores: {} }] }),
					{ status: 200 }
				)
		)
	);
});
afterEach(() => {
	db.close();
	vi.unstubAllGlobals();
});

async function upload(
	options: {
		body?: BodyInit | null;
		kind?: string | null;
		cookies?: Record<string, string>;
		origin?: string | null;
		env?: Record<string, unknown>;
		contentLength?: string;
	} = {}
) {
	const {
		body = PNG,
		kind = 'cover',
		cookies = await signIn(db, alice.id),
		origin,
		env = {},
		contentLength,
	} = options;

	const url = `${TEST_ORIGIN}/api/images${kind === null ? '' : `?kind=${kind}`}`;
	const headers: Record<string, string> = {
		'Content-Type': 'application/octet-stream',
	};
	if (origin !== null) headers.Origin = TEST_ORIGIN;
	if (contentLength) headers['content-length'] = contentLength;

	const context = apiContext({
		db,
		path: url,
		method: 'POST',
		origin,
		cookies,
		env: {
			IMAGES: fakeImages(),
			IMAGES_BUCKET: bucket.bucket,
			IMAGES_PUBLIC_BASE: IMAGE_BASE,
			'rm-times-ranked': kv.kv,
			OPENAI_API_KEY: 'test-key',
			...env,
		},
	}) as any;
	// The route reads raw bytes, which apiContext's JSON-shaped body does not
	// cover — hand it a request carrying the real payload.
	context.request = new Request(url, { method: 'POST', headers, body });
	return { response: await POST(context as never), context };
}

const quotaUsed = () =>
	Number(
		kv.store.get(
			`img-up:${alice.id}:${new Date().toISOString().slice(0, 10)}`
		) ?? 0
	);

describe('POST /api/images', () => {
	it('stores the re-encoded image and hands back its public URL', async () => {
		const { response } = await upload();
		expect(response.status).toBe(200);

		const { url } = (await response.json()) as any;
		expect(url).toMatch(
			new RegExp(`^${IMAGE_BASE}/u/${alice.id}/[0-9a-f-]{36}\\.webp$`)
		);

		const key = url.slice(IMAGE_BASE.length + 1);
		expect(bucket.objects.has(key)).toBe(true);
		const row = await db
			.prepare('SELECT user_id, template_id FROM images WHERE key = ?')
			.bind(key)
			.first<{ user_id: string; template_id: string | null }>();
		expect(row).toEqual({ user_id: alice.id, template_id: null });
	});

	it('rejects a cross-site upload', async () => {
		const { response } = await upload({ origin: null });
		expect(response.status).toBe(403);
		expect(bucket.objects.size).toBe(0);
	});

	it('requires a session', async () => {
		const { response } = await upload({ cookies: {} });
		expect(response.status).toBe(401);
	});

	it('rejects an unknown or missing kind', async () => {
		for (const kind of [null, '', 'banner', 'COVER']) {
			const { response } = await upload({ kind });
			expect(response.status, String(kind)).toBe(400);
			expect(((await response.json()) as any).error).toBe('invalid_kind');
		}
	});

	it('rejects an empty body', async () => {
		const { response } = await upload({ body: new Uint8Array() });
		expect(response.status).toBe(400);
	});

	it('rejects bytes that are not a recognised image', async () => {
		const { response } = await upload({
			body: new TextEncoder().encode('<svg onload=alert(1)>'),
		});
		expect(response.status).toBe(415);
		expect(((await response.json()) as any).error).toBe('unsupported_type');
	});

	it('rejects an oversized upload on the declared length alone', async () => {
		const { response } = await upload({
			contentLength: String(MAX_UPLOAD_BYTES + 1),
		});
		expect(response.status).toBe(413);
		expect(quotaUsed()).toBe(0);
	});

	it('rejects an oversized body even when the header lies', async () => {
		const { response } = await upload({
			body: new Uint8Array(MAX_UPLOAD_BYTES + 1024),
		});
		expect(response.status).toBe(413);
	});

	it('rejects a re-encoded image that is still too big to store', async () => {
		const { response } = await upload({
			env: { IMAGES: fakeImages(new Uint8Array(MAX_STORED_BYTES + 1)) },
		});
		expect(response.status).toBe(413);
		expect(bucket.objects.size).toBe(0);
	});

	it('never spends quota on a request that fails cheap validation', async () => {
		await upload({ kind: 'banner' });
		await upload({ body: new TextEncoder().encode('not an image') });
		expect(quotaUsed()).toBe(0);
	});

	it('enforces the daily upload cap', async () => {
		kv.store.set(
			`img-up:${alice.id}:${new Date().toISOString().slice(0, 10)}`,
			String(DAILY_UPLOAD_LIMIT)
		);
		const { response } = await upload();
		expect(response.status).toBe(429);
		expect(bucket.objects.size).toBe(0);
	});

	it('counts each upload against the caller’s own cap', async () => {
		await upload();
		await upload();
		expect(quotaUsed()).toBe(2);
	});

	it('refuses an image moderation rejects, and still spends the quota', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							results: [{ category_scores: { 'sexual/minors': 1 } }],
						}),
						{ status: 200 }
					)
			)
		);
		const { response } = await upload();
		expect(response.status).toBe(422);
		expect(((await response.json()) as any).error).toBe('image_rejected');
		expect(bucket.objects.size).toBe(0);
		expect(quotaUsed()).toBe(1);
	});

	it('stores nothing, and refunds the quota, when moderation is unavailable', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('nope', { status: 400 }))
		);
		const { response } = await upload();
		expect(response.status).toBe(503);
		expect(bucket.objects.size).toBe(0);
		expect(await db.prepare('SELECT key FROM images').first()).toBeNull();
		expect(quotaUsed()).toBe(0);
	});

	it('leaves no untracked object behind when the ownership row fails', async () => {
		const cookies = await signIn(db, alice.id);
		const failing = {
			prepare: (sql: string) =>
				sql.startsWith('INSERT INTO images')
					? {
							bind: () => ({
								run: async () => {
									throw new Error('D1 write failed');
								},
							}),
						}
					: db.prepare(sql),
		};
		const url = `${TEST_ORIGIN}/api/images?kind=cover`;
		const context = apiContext({
			db: failing as never,
			path: url,
			method: 'POST',
			cookies,
			env: {
				IMAGES: fakeImages(),
				IMAGES_BUCKET: bucket.bucket,
				IMAGES_PUBLIC_BASE: IMAGE_BASE,
				'rm-times-ranked': kv.kv,
				OPENAI_API_KEY: 'test-key',
			},
		}) as any;
		context.request = new Request(url, {
			method: 'POST',
			headers: { Origin: TEST_ORIGIN },
			body: PNG,
		});

		const response = await POST(context as never);
		expect(response.status).toBe(500);
		expect(bucket.objects.size).toBe(0);
	});

	it('cleans up the caller’s abandoned uploads in the background', async () => {
		const { context } = await upload();
		expect(context.deferred).toHaveLength(1);
		await Promise.all(context.deferred);
	});
});

describe('GET /api/images/[...key]', () => {
	const serve = (key: string) => {
		const context = apiContext({
			db,
			method: 'GET',
			path: `/api/images/${key}`,
			params: { key },
			env: { IMAGES_BUCKET: bucket.bucket },
		});
		return SERVE(context as never);
	};

	it('serves a stored object, immutably cached and non-sniffable', async () => {
		const key = 'u/alice/aaaaaaaaaaaaaaaa1.webp';
		bucket.objects.add(key);

		const response = await serve(key);
		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe(
			'public, max-age=31536000, immutable'
		);
		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
		expect(response.headers.get('Content-Disposition')).toBe('inline');
	});

	it('404s a key that is not one of ours', async () => {
		for (const key of [
			'covers/official.webp',
			'../../etc/passwd',
			'u/alice/short.webp',
			'u/alice/aaaaaaaaaaaaaaaa1.png',
			'',
		]) {
			expect((await serve(key)).status, key).toBe(404);
		}
	});

	it('404s a well-formed key with no object behind it', async () => {
		expect((await serve('u/alice/bbbbbbbbbbbbbbbb2.webp')).status).toBe(404);
	});
});
