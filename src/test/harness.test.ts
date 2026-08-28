import { describe, expect, it } from 'vitest';
import { createTestDb, migrationFiles } from './d1';
import { insertTemplate, insertUser } from './factories';

describe('the D1 test harness', () => {
	it('applies every migration in the repo', () => {
		const db = createTestDb();
		const tables = db.raw
			.prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
			.all()
			.map((r: any) => r.name);
		expect(migrationFiles().length).toBeGreaterThan(0);
		expect(tables).toEqual(
			expect.arrayContaining([
				'users',
				'sessions',
				'templates',
				'template_options',
				'rankings',
				'comments',
				'votes',
				'follows',
				'notifications',
			])
		);
		db.close();
	});

	it('starts empty apart from the two structural placeholder accounts', () => {
		const db = createTestDb();
		const tables = db.raw
			.prepare(
				`SELECT name FROM sqlite_master
				 WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
				   AND name != 'd1_migrations'`
			)
			.all()
			.map((r: any) => r.name as string);
		const populated = tables.filter(
			(name) =>
				(
					db.raw
						.prepare(`SELECT COUNT(*) AS n FROM "${name}"`)
						.get() as any
				).n > 0
		);
		expect(populated).toEqual(['users']);
		expect(
			db.raw
				.prepare('SELECT id FROM users ORDER BY id')
				.all()
				.map((r: any) => r.id)
		).toEqual(['deleted-user', 'rankmaker-official']);
		db.close();
	});

	it('resolves first() to null, never undefined', async () => {
		const db = createTestDb();
		expect(await db.prepare('SELECT 1 WHERE 0').first()).toBeNull();
		db.close();
	});

	it('enforces foreign keys, as D1 does', async () => {
		const db = createTestDb();
		await expect(
			insertTemplate(db, 'nobody', { slug: 'orphan' })
		).rejects.toThrow();
		db.close();
	});

	it('rejects undefined binds instead of writing NULL', async () => {
		const db = createTestDb();
		expect(() =>
			db.prepare('SELECT ?').bind(undefined)
		).toThrow(/D1_TYPE_ERROR/);
		db.close();
	});

	it('rolls a failed batch back as a unit', async () => {
		const db = createTestDb();
		const user = await insertUser(db, { username: 'alice' });
		await expect(
			db.batch([
				db
					.prepare('INSERT INTO rankings (slug, date) VALUES (?, ?)')
					.bind('one', '2026-01-01'),
				db
					.prepare('INSERT INTO users (id, username) VALUES (?, ?)')
					.bind('dup', user.username),
			])
		).rejects.toThrow();
		const { results } = await db
			.prepare('SELECT COUNT(*) AS n FROM rankings')
			.all<{ n: number }>();
		expect(results[0].n).toBe(0);
		db.close();
	});
});
