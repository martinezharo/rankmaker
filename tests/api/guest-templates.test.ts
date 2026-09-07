import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../src/pages/api/guest-templates';
import { recordGuestTemplateMetric } from '../../src/lib/guest-template-metrics';
import { createTestDb, type TestD1 } from '../../src/test/d1';
import { apiContext, fakeKv } from '../../src/test/api';
let db: TestD1;
let kv: ReturnType<typeof fakeKv>;
beforeEach(() => {
	db = createTestDb();
	kv = fakeKv();
});
afterEach(() => {
	db.close();
	vi.restoreAllMocks();
});
const metric = { id: 'guest-123', origin: 'new', played: false };
const CLIENT_IP = '203.0.113.7';
const post = (body: unknown = metric, origin?: string | null) =>
	POST(
		apiContext({
			db,
			body,
			origin,
			headers: { 'cf-connecting-ip': CLIENT_IP },
			env: { 'rm-times-ranked': kv.kv, SESSION_SECRET: 'test-secret' },
		})
	);
describe('guest template measurement', () => {
	it('counts retries and multiple starts once, retaining the first observation', async () => {
		expect((await post()).status).toBe(200);
		await db
			.prepare(
				"UPDATE guest_template_metrics SET first_seen_at='2026-01-01 00:00:00'"
			)
			.run();
		await post();
		await post({ ...metric, played: true });
		await post({ ...metric, played: true });
		const rows = (
			await db.prepare('SELECT * FROM guest_template_metrics').all()
		).results;
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			first_seen_at: '2026-01-01 00:00:00',
			origin: 'new',
			converted_at: null,
		});
		expect(rows[0].first_played_at).toBeTruthy();
	});
	it('retains an import when creation arrives late and never accepts conversion from a client', async () => {
		await recordGuestTemplateMetric(
			db,
			{ id: 'guest-123', origin: 'recovered', played: true },
			'local-server-id'
		);
		await post({
			...metric,
			converted_at: '2020-01-01',
			imported_template_id: 'fake',
		});
		const row = await db
			.prepare('SELECT * FROM guest_template_metrics')
			.first<Record<string, unknown>>();
		expect(row).toMatchObject({
			origin: 'recovered',
			imported_template_id: 'local-server-id',
		});
		expect(row?.converted_at).toBeTruthy();
		await post({ ...metric, id: 'another', converted_at: '2020-01-01' });
		expect(
			await db
				.prepare(
					"SELECT converted_at FROM guest_template_metrics WHERE local_id='another'"
				)
				.first('converted_at')
		).toBeNull();
	});
	it('rejects cross-origin, malformed, missing and oversized payloads', async () => {
		expect((await post(metric, null)).status).toBe(403);
		expect((await post(metric, 'https://elsewhere.test')).status).toBe(403);
		for (const input of [
			null,
			{},
			{ ...metric, id: 'bad id' },
			{ ...metric, origin: 'anything' },
			{ ...metric, played: 1 },
		])
			expect((await post(input)).status).toBe(400);
		expect((await post('{')).status).toBe(400);
		expect((await post('a'.repeat(513))).status).toBe(413);
	});
	it('buckets a visitor without keeping their address', async () => {
		expect((await post()).status).toBe(200);
		const keys = [...kv.store.keys()];
		expect(keys).toHaveLength(1);
		expect(keys[0]).not.toContain(CLIENT_IP);
		expect(keys[0]).toMatch(/^rl:guest-metrics:[0-9a-f]{32}:\d+$/);
	});

	it('still buckets a visitor when no secret is configured', async () => {
		const response = await POST(
			apiContext({
				db,
				body: metric,
				headers: { 'cf-connecting-ip': CLIENT_IP },
				env: { 'rm-times-ranked': kv.kv },
			})
		);
		expect(response.status).toBe(200);
		expect([...kv.store.keys()][0]).not.toContain(CLIENT_IP);
	});

	it('rate limits repeated submissions', async () => {
		for (let i = 0; i < 60; i++) expect((await post()).status).toBe(200);
		expect((await post()).status).toBe(429);
	});
	it('does not acknowledge a database failure, allowing client retry', async () => {
		await db.prepare('DROP TABLE guest_template_metrics').run();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		expect((await post()).status).toBe(503);
	});
});
