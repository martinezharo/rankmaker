/**
 * Moderation suspension — the single source of truth for "is this template
 * held back by a moderator, and why?".
 *
 * A suspended template is treated exactly like an unlisted one (out of every
 * public listing, URL still works), with one difference: the creator did not
 * choose it and cannot lift it. It therefore lives in its own column,
 * `templates.suspension_reason`, which no API path writes — see
 * migrations/0023_template_suspension.sql for the how and why, including the
 * SQL a moderator runs from the D1 dashboard.
 *
 * The creator is told: a "suspended" badge on their template carries an info
 * icon whose tooltip is the translated reason (`suspension.reasons.*`).
 */

/**
 * The reasons a moderator can pick. The value stored in D1 is the key, so the
 * reason shown to the creator follows their language and can be reworded
 * without a data migration.
 *
 * Keep in sync with `suspension.reasons` in src/i18n/locales/en.ts.
 */
export const SUSPENSION_REASONS = ['low_quality'] as const;

export type SuspensionReason = (typeof SUSPENSION_REASONS)[number];

/**
 * The stored value as a known reason, or null when the template is not
 * suspended. Unknown strings are treated as *not* suspended rather than as a
 * reason we cannot explain: a typo in the dashboard should not take a template
 * down with an untranslatable badge.
 */
export function parseSuspensionReason(
    value: string | null | undefined
): SuspensionReason | null {
    return value != null &&
        (SUSPENSION_REASONS as readonly string[]).includes(value)
        ? (value as SuspensionReason)
        : null;
}

/** The i18n key for a reason, for `t()`. */
export function suspensionReasonKey(reason: SuspensionReason): string {
    return `suspension.reasons.${reason}`;
}

/**
 * SQL fragments over a `templates t` row, shared by every query that decides
 * what a *visitor* may be shown. Written against the raw column rather than
 * `parseSuspensionReason` because the filter runs in D1: any non-NULL value
 * hides the template, so an unknown reason still keeps it out of listings even
 * though the badge falls back to the plain "suspended" wording.
 */

/** A template is listed publicly only when its creator made it public *and* no moderator suspended it. */
export const LISTED_SQL = "t.visibility = 'public' AND t.suspension_reason IS NULL";

/** The complement of {@link LISTED_SQL} — everything a public surface must hide. */
export const NOT_LISTED_SQL =
    "(t.visibility != 'public' OR t.suspension_reason IS NOT NULL)";
