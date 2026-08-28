/**
 * A D1 binding backed by Node's built-in SQLite, for unit tests.
 *
 * The alternative — hand-rolled mocks that return canned rows — verifies that
 * we called a method, not that the SQL is correct. Every D1 module in this
 * repo is mostly SQL: a typo in a column name, a predicate that silently
 * matches nothing, a missing `COLLATE NOCASE`, or a constraint we forgot
 * about are exactly the failures that reach production. Running the real
 * statements against the real migrations catches those.
 *
 * The shim implements the slice of the D1 API the app uses
 * (`prepare/bind/first/all/run/batch/exec`) and reproduces the behaviours the
 * calling code depends on:
 *
 *   - `first()` resolves to `null`, never `undefined` (callers compare to null)
 *   - booleans bind as 1/0, like workerd does
 *   - `undefined` binds are rejected, like D1's D1_TYPE_ERROR
 *   - foreign keys are enforced, as they are in D1
 *   - `batch()` runs inside a transaction and rolls back as a unit
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'migrations');

/** Every migration file, in the order wrangler would apply them. */
export function migrationFiles(): string[] {
	return readdirSync(MIGRATIONS_DIR)
		.filter((f) => f.endsWith('.sql'))
		.sort();
}

type Bindable = string | number | bigint | null | Uint8Array;

function toBindable(value: unknown, index: number): Bindable {
	if (value === undefined) {
		// D1 raises D1_TYPE_ERROR rather than binding NULL, and a silent NULL
		// here would hide the bug the test is meant to catch.
		throw new Error(`D1_TYPE_ERROR: parameter ${index + 1} is undefined`);
	}
	if (typeof value === 'boolean') return value ? 1 : 0;
	if (
		value === null ||
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'bigint' ||
		value instanceof Uint8Array
	) {
		return value as Bindable;
	}
	throw new Error(`D1_TYPE_ERROR: unsupported parameter ${index + 1}`);
}

class FakeStatement {
	constructor(
		private readonly db: DatabaseSync,
		private readonly sql: string,
		private readonly params: Bindable[] = []
	) {}

	bind(...values: unknown[]): FakeStatement {
		return new FakeStatement(this.db, this.sql, values.map(toBindable));
	}

	async first<T = Record<string, unknown>>(
		column?: string
	): Promise<T | null> {
		const row = this.db.prepare(this.sql).get(...this.params) as
			| Record<string, unknown>
			| undefined;
		if (row === undefined) return null;
		return (column ? (row[column] as T) : (row as T)) ?? null;
	}

	async all<T = Record<string, unknown>>(): Promise<{
		results: T[];
		success: true;
		meta: Record<string, unknown>;
	}> {
		const results = this.db.prepare(this.sql).all(...this.params) as T[];
		return { results, success: true, meta: {} };
	}

	async run(): Promise<{
		results: never[];
		success: true;
		meta: { changes: number; last_row_id: number };
	}> {
		const info = this.db.prepare(this.sql).run(...this.params);
		return {
			results: [],
			success: true,
			meta: {
				changes: Number(info.changes),
				last_row_id: Number(info.lastInsertRowid),
			},
		};
	}

	/** `raw()` is unused by the app; present so the shape stays honest. */
	async raw<T = unknown[]>(): Promise<T[]> {
		const rows = this.db.prepare(this.sql).all(...this.params) as Record<
			string,
			unknown
		>[];
		return rows.map((r) => Object.values(r)) as T[];
	}
}

export type TestD1 = D1Database & { close(): void; raw: DatabaseSync };

/**
 * An empty in-memory database with every migration applied.
 * Each call is fully isolated, so tests never share state.
 */
export function createTestDb(): TestD1 {
	const db = new DatabaseSync(':memory:');
	db.exec('PRAGMA foreign_keys = ON');
	for (const file of migrationFiles()) {
		db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
	}
	// 0002 backfills the production ranking event log. Tests start from an
	// empty log so a count is exactly what the test seeded. The *structural*
	// seed rows (the RANKMAKER account, the deleted-user placeholder) stay —
	// application code addresses them by their fixed ids. `harness.test.ts`
	// asserts that nothing else arrives pre-populated, so a future migration
	// that seeds data fails loudly instead of skewing unrelated tests.
	db.exec('DELETE FROM rankings');

	const api = {
		prepare: (sql: string) => new FakeStatement(db, sql),
		async batch(statements: FakeStatement[]) {
			db.exec('BEGIN');
			try {
				const out = [];
				for (const s of statements) out.push(await s.run());
				db.exec('COMMIT');
				return out;
			} catch (error) {
				db.exec('ROLLBACK');
				throw error;
			}
		},
		async exec(sql: string) {
			db.exec(sql);
			return { count: 0, duration: 0 };
		},
		async dump() {
			throw new Error('dump() is not supported in tests');
		},
		withSession() {
			throw new Error('withSession() is not supported in tests');
		},
		close: () => db.close(),
		raw: db,
	};
	return api as unknown as TestD1;
}
