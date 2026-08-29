import { describe, expect, it } from 'vitest';
import {
	EXPECTED_TABLES,
	PRODUCTION_ENV,
	optionalEnv,
	requiredEnv,
} from './required-env';
import { createTestDb } from '../test/d1';

describe('the production environment manifest', () => {
	it('names each value once', () => {
		const names = PRODUCTION_ENV.map((v) => v.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it('describes every value, so a failing check is actionable', () => {
		for (const value of PRODUCTION_ENV) {
			expect(value.description.trim(), value.name).not.toBe('');
		}
	});

	it('gives every declared fallback a concrete value', () => {
		for (const value of PRODUCTION_ENV.filter((v) => v.fallback !== undefined)) {
			expect(value.fallback?.trim(), value.name).not.toBe('');
		}
	});

	it('splits cleanly into required and optional', () => {
		expect([...requiredEnv(), ...optionalEnv()]).toHaveLength(
			PRODUCTION_ENV.length
		);
		expect(requiredEnv().every((v) => v.required)).toBe(true);
		expect(optionalEnv().every((v) => !v.required)).toBe(true);
	});

	it('demands the values login and sessions cannot work without', () => {
		expect(requiredEnv().map((v) => v.name).sort()).toEqual([
			'GITHUB_CLIENT_ID',
			'GITHUB_CLIENT_SECRET',
			'SESSION_SECRET',
		]);
	});
});

describe('EXPECTED_TABLES', () => {
	/**
	 * The health probe and the pre-deploy check both assert these tables exist
	 * in production. If a migration adds a table and this list is not updated,
	 * both checks go on passing while knowing nothing about it.
	 */
	it('matches exactly what the migrations create', () => {
		const db = createTestDb();
		const actual = db.raw
			.prepare(
				`SELECT name FROM sqlite_master
				 WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
				   AND name != 'd1_migrations'`
			)
			.all()
			.map((row: any) => row.name as string);
		db.close();

		expect([...EXPECTED_TABLES].sort()).toEqual(actual.sort());
	});
});
