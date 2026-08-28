/**
 * Direct access to the local D1 the dev server is running against.
 *
 * The account flows — signing in, creating a template, commenting, following —
 * cannot be reached from a browser alone: a session only exists after a real
 * GitHub OAuth round-trip, which the Worker performs server-side and which no
 * browser-level route interception can stand in for.
 *
 * So the tests write the session the OAuth callback would have written, into
 * the same miniflare-backed SQLite file the dev server reads. Nothing is
 * mocked: the app then resolves that session, and every authorization check
 * runs for real.
 *
 * Everything seeded here is prefixed `e2e-`, and only rows carrying that prefix
 * are ever deleted — the local database is a developer's own, and a test must
 * not touch their data. Cleanup runs once in the global teardown rather than
 * after each test, so a write never lands while a page is still finishing a
 * request against the same file.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const D1_DIR = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';

/** Everything this suite creates is named with this prefix. */
export const E2E_PREFIX = 'e2e-';

let dbPath: string | null = null;

/** Apply the migrations, then locate the database file wrangler wrote to. */
export function prepareDatabase(): string {
	if (dbPath) return dbPath;
	execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'migrations', 'apply', 'rankmaker', '--local'], {
		stdio: 'pipe',
	});
	const file = readdirSync(D1_DIR).find(
		(name) => name.endsWith('.sqlite') && !name.startsWith('metadata')
	);
	if (!file) {
		throw new Error(
			`No local D1 database in ${D1_DIR}. Run: pnpm run db:migrate:local`
		);
	}
	dbPath = join(D1_DIR, file);
	return dbPath;
}

/**
 * Open the database, do one piece of work, close it.
 *
 * The dev server holds the same file, so a write can land while it is mid
 * transaction. `busy_timeout` waits that out rather than failing the test on a
 * lock that clears in milliseconds; the retry covers the rarer case where the
 * lock is taken before the timeout can be set.
 */
function withDb<T>(fn: (db: DatabaseSync) => T): T {
	let lastError: unknown;
	for (let attempt = 0; attempt < 5; attempt++) {
		let db: DatabaseSync | null = null;
		try {
			db = new DatabaseSync(prepareDatabase(), { timeout: 5_000 });
			db.exec('PRAGMA busy_timeout = 5000');
			return fn(db);
		} catch (error) {
			lastError = error;
			if (!String(error).includes('locked') && !String(error).includes('busy')) {
				throw error;
			}
			sleep(100 * (attempt + 1));
		} finally {
			db?.close();
		}
	}
	throw lastError;
}

/** Block the (synchronous) fixture for `ms`, to let a lock clear. */
function sleep(ms: number): void {
	const shared = new Int32Array(new SharedArrayBuffer(4));
	Atomics.wait(shared, 0, 0, ms);
}

export type SeededUser = { id: string; username: string; sessionId: string };

/**
 * A user with a live session, exactly as the OAuth callback would leave them.
 * `unique` keeps parallel or repeated runs from colliding on the UNIQUE
 * username; it is part of the name so a leftover row is obviously a test's.
 */
export function seedUser(
	unique: string,
	overrides: { avatar?: string; bio?: string; isVerified?: boolean } = {}
): SeededUser {
	const id = `${E2E_PREFIX}user-${unique}`;
	const username = `${E2E_PREFIX}${unique}`;
	const sessionId = `${E2E_PREFIX}session-${unique}`;
	withDb((db) => {
		db.prepare(
			`INSERT OR REPLACE INTO users (id, username, avatar, is_verified, bio)
			 VALUES (?, ?, ?, ?, ?)`
		).run(
			id,
			username,
			overrides.avatar ?? 'star-purple',
			overrides.isVerified ? 1 : 0,
			overrides.bio ?? null
		);
		db.prepare(
			`INSERT OR REPLACE INTO sessions (id, user_id, expires_at)
			 VALUES (?, ?, ?)`
		).run(sessionId, id, new Date(Date.now() + 86_400_000).toISOString());
	});
	return { id, username, sessionId };
}

export type SeededTemplate = { id: string; slug: string };

export function seedTemplate(
	creatorId: string,
	unique: string,
	overrides: {
		title?: string;
		description?: string;
		category?: string;
		visibility?: 'public' | 'private' | 'unlisted';
		isMature?: boolean;
		options?: string[];
	} = {}
): SeededTemplate {
	const id = `${E2E_PREFIX}tpl-${unique}`;
	const slug = `${E2E_PREFIX}${unique}`;
	withDb((db) => {
		db.prepare(
			`INSERT OR REPLACE INTO templates
			   (id, creator_id, slug, title, description, category, cover_image,
			    visibility, is_mature)
			 VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`
		).run(
			id,
			creatorId,
			slug,
			overrides.title ?? `E2E ${unique}`,
			overrides.description ??
				'A template seeded by the end-to-end suite, long enough to be valid.',
			overrides.category ?? 'Movies',
			overrides.visibility ?? 'public',
			overrides.isMature ? 1 : 0
		);
		const options = overrides.options ?? ['Alpha', 'Bravo', 'Charlie', 'Delta'];
		for (const [position, name] of options.entries()) {
			db.prepare(
				`INSERT INTO template_options (template_id, name, image, position)
				 VALUES (?, ?, NULL, ?)`
			).run(id, name, position);
		}
	});
	return { id, slug };
}

/** Read back a row, for the assertions that have to look past the UI. */
export function queryOne<T = Record<string, unknown>>(
	sql: string,
	...params: (string | number | null)[]
): T | null {
	return withDb((db) => (db.prepare(sql).get(...params) as T) ?? null);
}

export function queryAll<T = Record<string, unknown>>(
	sql: string,
	...params: (string | number | null)[]
): T[] {
	return withDb((db) => db.prepare(sql).all(...params) as T[]);
}

/**
 * Remove everything this suite created. Only `e2e-` rows: deleting the users
 * cascades to their templates, sessions, comments, follows and notifications.
 */
export function cleanupSeededData(): void {
	withDb((db) => {
		db.exec(`PRAGMA foreign_keys = ON`);
		db.exec(`DELETE FROM users WHERE id LIKE '${E2E_PREFIX}%'`);
		db.exec(`DELETE FROM templates WHERE id LIKE '${E2E_PREFIX}%'`);
		db.exec(`DELETE FROM rankings WHERE slug LIKE '${E2E_PREFIX}%'`);
		db.exec(`DELETE FROM ranking_results WHERE slug LIKE '${E2E_PREFIX}%'`);
		db.exec(`DELETE FROM comments WHERE slug LIKE '${E2E_PREFIX}%'`);
		db.exec(`DELETE FROM template_saves WHERE slug LIKE '${E2E_PREFIX}%'`);
		db.exec(
			`DELETE FROM votes WHERE subject_type = 'template' AND subject_id LIKE '${E2E_PREFIX}%'`
		);
		db.exec(`DELETE FROM notifications WHERE slug LIKE '${E2E_PREFIX}%'`);
	});
}
