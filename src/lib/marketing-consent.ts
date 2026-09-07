/**
 * Consent to receive marketing email (product news), stored on the user row.
 *
 * Deliberately separate from `users.email_notifications` (src/lib/notifications.ts):
 * that flag governs email the user asked for by using the product — replies and
 * comments — while this one governs email we send because we want to. Consent
 * under the GDPR is purpose-specific, so the two can never share a column, and
 * every marketing send must check THIS one.
 *
 * See migrations/0018_marketing_consent.sql for the columns and why the
 * timestamp/source are kept.
 */

/** Where a consent decision was made. Stored verbatim for the audit trail. */
export const MARKETING_CONSENT_SOURCES = ['signup', 'preferences'] as const;
export type MarketingConsentSource =
	(typeof MARKETING_CONSENT_SOURCES)[number];

/** Whether the user has opted in to marketing email. Defaults to false. */
export async function getMarketingConsent(
	db: D1Database,
	userId: string
): Promise<boolean> {
	const row = await db
		.prepare('SELECT marketing_consent FROM users WHERE id = ?')
		.bind(userId)
		.first<{ marketing_consent: number }>();
	return (row?.marketing_consent ?? 0) === 1;
}

/**
 * Record a consent decision.
 *
 * Granting stamps when and where it was given; withdrawing only flips the flag,
 * so the proof of the consent a past campaign was sent under survives.
 */
export async function setMarketingConsent(
	db: D1Database,
	userId: string,
	granted: boolean,
	source: MarketingConsentSource
): Promise<void> {
	if (!granted) {
		await db
			.prepare('UPDATE users SET marketing_consent = 0 WHERE id = ?')
			.bind(userId)
			.run();
		return;
	}
	await db
		.prepare(
			`UPDATE users
			 SET marketing_consent = 1,
			     marketing_consent_at = datetime('now'),
			     marketing_consent_source = ?
			 WHERE id = ?`
		)
		.bind(source, userId)
		.run();
}
