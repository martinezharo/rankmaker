/** Shared wire contract. Never include the contents of a private template. */
export const LOCAL_TEMPLATE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
export type GuestTemplateMetric = {
	id: string;
	origin: 'new' | 'recovered';
	played: boolean;
};

export function parseGuestTemplateMetric(
	value: unknown
): GuestTemplateMetric | null {
	if (!value || typeof value !== 'object') return null;
	const v = value as Record<string, unknown>;
	if (
		typeof v.id !== 'string' ||
		!LOCAL_TEMPLATE_ID_RE.test(v.id) ||
		(v.origin !== 'new' && v.origin !== 'recovered') ||
		typeof v.played !== 'boolean'
	)
		return null;
	return { id: v.id, origin: v.origin, played: v.played };
}

/** First observations win; retries and out-of-order observations cannot reset milestones. */
export async function recordGuestTemplateMetric(
	db: D1Database,
	metric: GuestTemplateMetric,
	importedTemplateId: string | null = null
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO guest_template_metrics
		(local_id, origin, first_played_at, converted_at, imported_template_id)
		VALUES (?, ?, CASE WHEN ? THEN datetime('now') END,
			CASE WHEN ? IS NOT NULL THEN datetime('now') END, ?)
		ON CONFLICT(local_id) DO UPDATE SET
			first_played_at = COALESCE(guest_template_metrics.first_played_at, excluded.first_played_at),
			converted_at = COALESCE(guest_template_metrics.converted_at, excluded.converted_at),
			imported_template_id = COALESCE(guest_template_metrics.imported_template_id, excluded.imported_template_id)
		WHERE (guest_template_metrics.first_played_at IS NULL AND excluded.first_played_at IS NOT NULL)
			OR (guest_template_metrics.converted_at IS NULL AND excluded.converted_at IS NOT NULL)`
		)
		.bind(
			metric.id,
			metric.origin,
			metric.played ? 1 : 0,
			importedTemplateId,
			importedTemplateId
		)
		.run();
}
