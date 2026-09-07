import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	getMarketingConsent,
	setMarketingConsent,
} from './marketing-consent';
import { createTestDb, type TestD1 } from '../test/d1';
import { insertUser } from '../test/factories';

let db: TestD1;
let alice: { id: string };

beforeEach(async () => {
	db = createTestDb();
	alice = await insertUser(db, { username: 'alice' });
});
afterEach(() => db.close());

const audit = async (userId: string) =>
	db
		.prepare(
			`SELECT marketing_consent AS consent,
			        marketing_consent_at AS at,
			        marketing_consent_source AS source
			 FROM users WHERE id = ?`
		)
		.bind(userId)
		.first<{ consent: number; at: string | null; source: string | null }>();

describe('marketing consent', () => {
	it('is off for a new account — consent is never assumed', async () => {
		expect(await getMarketingConsent(db, alice.id)).toBe(false);
		expect(await audit(alice.id)).toEqual({
			consent: 0,
			at: null,
			source: null,
		});
	});

	it('records when and where consent was given', async () => {
		await setMarketingConsent(db, alice.id, true, 'signup');

		expect(await getMarketingConsent(db, alice.id)).toBe(true);
		const row = await audit(alice.id);
		expect(row?.consent).toBe(1);
		expect(row?.source).toBe('signup');
		expect(row?.at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
	});

	it('keeps the audit trail when consent is withdrawn', async () => {
		await setMarketingConsent(db, alice.id, true, 'signup');
		const granted = await audit(alice.id);

		await setMarketingConsent(db, alice.id, false, 'preferences');

		expect(await getMarketingConsent(db, alice.id)).toBe(false);
		// The flag is what the sending path checks; the stamp stays as proof of
		// the consent past messages were sent under.
		expect(await audit(alice.id)).toEqual({
			consent: 0,
			at: granted?.at,
			source: 'signup',
		});
	});

	it('re-stamps the source when consent is given again elsewhere', async () => {
		await setMarketingConsent(db, alice.id, true, 'signup');
		await setMarketingConsent(db, alice.id, false, 'preferences');
		await setMarketingConsent(db, alice.id, true, 'preferences');

		expect(await audit(alice.id)).toMatchObject({
			consent: 1,
			source: 'preferences',
		});
	});

	it('does not leak another account’s consent', async () => {
		const bob = await insertUser(db, { username: 'bob' });
		await setMarketingConsent(db, alice.id, true, 'signup');
		expect(await getMarketingConsent(db, bob.id)).toBe(false);
	});
});
