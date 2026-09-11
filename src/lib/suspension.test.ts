import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	LISTED_SQL,
	NOT_LISTED_SQL,
	SUSPENSION_REASONS,
	parseSuspensionReason,
	suspensionReasonKey,
} from './suspension';
import { en } from '../i18n/locales/en';
import { createTestDb, type TestD1 } from '../test/d1';
import { insertTemplate, insertUser } from '../test/factories';

let db: TestD1;

beforeEach(() => {
	db = createTestDb();
});

afterEach(() => {
	db.close();
});

describe('parseSuspensionReason', () => {
	it('accepts every known reason', () => {
		for (const reason of SUSPENSION_REASONS) {
			expect(parseSuspensionReason(reason)).toBe(reason);
		}
	});

	it('reads "not suspended" from null and undefined', () => {
		expect(parseSuspensionReason(null)).toBeNull();
		expect(parseSuspensionReason(undefined)).toBeNull();
	});

	it('treats an unknown value as not suspended', () => {
		// A typo in the moderation SQL must not take a template down behind a
		// badge whose reason we cannot translate.
		expect(parseSuspensionReason('lowquality')).toBeNull();
		expect(parseSuspensionReason('')).toBeNull();
	});
});

describe('the reason wording', () => {
	it('has an English string for every reason', () => {
		for (const reason of SUSPENSION_REASONS) {
			expect(
				(en.suspension.reasons as Record<string, string>)[reason],
				suspensionReasonKey(reason)
			).toBeTruthy();
		}
	});

	it('translates through the key the badge uses', () => {
		expect(suspensionReasonKey('low_quality')).toBe(
			'suspension.reasons.low_quality'
		);
	});
});

describe('the SQL fragments', () => {
	it('are exact complements of each other', () => {
		// Both sides are pasted into queries that decide what a visitor sees;
		// if they ever drift, a template could be hidden from listings but
		// still counted in /api/counts (or the reverse).
		expect(LISTED_SQL).toContain("t.visibility = 'public'");
		expect(LISTED_SQL).toContain('t.suspension_reason IS NULL');
		expect(NOT_LISTED_SQL).toContain("t.visibility != 'public'");
		expect(NOT_LISTED_SQL).toContain('t.suspension_reason IS NOT NULL');
	});
});

describe('the database constraint', () => {
	it('rejects a suspension reason that the site cannot translate', async () => {
		const alice = await insertUser(db, { username: 'alice' });
		const template = await insertTemplate(db, alice.id);

		await expect(
			db
				.prepare(
					'UPDATE templates SET suspension_reason = ? WHERE id = ?'
				)
				.bind('lowquality', template.id)
				.run()
		).rejects.toThrow(/CHECK constraint failed/);
	});
});
