/**
 * D1 access layer for in-app notifications + the email fan-out that rides along
 * with the two "direct" kinds.
 *
 * Pattern mirrors src/lib/comments.ts and src/lib/follows.ts: this module only
 * talks to the database (and to Resend via src/lib/email.ts). The trigger code
 * (POST /api/comments, POST /api/templates) resolves the recipient and calls
 * `dispatchNotification` / `notifyNewTemplate`.
 *
 * Three kinds, see migrations/0011_notifications.sql:
 *   - 'comment_on_template' — comment on a template you own       (emailed)
 *   - 'comment_reply'       — reply to one of your comments       (emailed)
 *   - 'new_template'        — someone you follow published one    (in-app only)
 *
 * Emails are sent only for the two direct kinds, only when the recipient has an
 * email on file AND hasn't opted out (users.email_notifications).
 */
import { randomHex } from './auth';
import { OFFICIAL_USER_ID } from './templates';
import { useTranslations } from '../i18n';
import { renderEmail, sendEmail, siteUrl, type EmailEnv } from './email';

export type NotificationType =
	| 'comment_on_template'
	| 'comment_reply'
	| 'new_template';

export const NOTIFICATION_TYPES: NotificationType[] = [
	'comment_on_template',
	'comment_reply',
	'new_template',
];

/** The kinds that also trigger an email (direct interactions). */
const EMAILABLE: NotificationType[] = ['comment_on_template', 'comment_reply'];

export type NotificationItem = {
	id: string;
	type: NotificationType;
	slug: string;
	title: string;
	commentId: string | null;
	createdAt: string;
	isRead: boolean;
	actor: { username: string; avatar: string; isVerified: boolean };
};

type NotifyEnv = { DB: D1Database } & EmailEnv;

// ── Reads ────────────────────────────────────────────────────────────────────

/** Count of the user's unread notifications (drives the header badge). */
export async function countUnread(
	db: D1Database,
	userId: string
): Promise<number> {
	const row = await db
		.prepare(
			'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0'
		)
		.bind(userId)
		.first<{ n: number }>();
	return row?.n ?? 0;
}

/** A user's notifications, newest first, with the actor's public profile. */
export async function listNotifications(
	db: D1Database,
	userId: string,
	limit = 100
): Promise<NotificationItem[]> {
	const { results } = await db
		.prepare(
			`SELECT n.id, n.type, n.slug, n.title, n.comment_id, n.is_read, n.created_at,
			        u.username, u.avatar, u.is_verified
			 FROM notifications n
			 JOIN users u ON u.id = n.actor_id
			 WHERE n.user_id = ?
			 ORDER BY n.created_at DESC
			 LIMIT ?`
		)
		.bind(userId, limit)
		.all<{
			id: string;
			type: string;
			slug: string;
			title: string;
			comment_id: string | null;
			is_read: number;
			created_at: string;
			username: string;
			avatar: string;
			is_verified: number;
		}>();
	return results.map((r) => ({
		id: r.id,
		type: r.type as NotificationType,
		slug: r.slug,
		title: r.title,
		commentId: r.comment_id,
		createdAt: r.created_at,
		isRead: r.is_read === 1,
		actor: {
			username: r.username,
			avatar: r.avatar,
			isVerified: r.is_verified === 1,
		},
	}));
}

/** Mark every unread notification for this user as read. */
export async function markAllRead(
	db: D1Database,
	userId: string
): Promise<void> {
	await db
		.prepare(
			'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0'
		)
		.bind(userId)
		.run();
}

/** Whether the user currently wants notification emails. */
export async function getEmailPref(
	db: D1Database,
	userId: string
): Promise<boolean> {
	const row = await db
		.prepare('SELECT email_notifications FROM users WHERE id = ?')
		.bind(userId)
		.first<{ email_notifications: number }>();
	return (row?.email_notifications ?? 1) === 1;
}

/** Toggle the user's notification-email preference. */
export async function setEmailPref(
	db: D1Database,
	userId: string,
	enabled: boolean
): Promise<void> {
	await db
		.prepare('UPDATE users SET email_notifications = ? WHERE id = ?')
		.bind(enabled ? 1 : 0, userId)
		.run();
}

// ── Writes ─────────────────────────────────────────────────────────────────

function insertStmt(
	db: D1Database,
	row: {
		id: string;
		userId: string;
		type: NotificationType;
		actorId: string;
		slug: string;
		title: string;
		commentId: string | null;
	}
): D1PreparedStatement {
	return db
		.prepare(
			`INSERT INTO notifications (id, user_id, type, actor_id, slug, title, comment_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			row.id,
			row.userId,
			row.type,
			row.actorId,
			row.slug,
			row.title,
			row.commentId
		);
}

/**
 * Create one notification and, for the emailable kinds, fire off an email.
 * No-ops when the recipient is the actor (don't notify yourself) or the
 * non-loggable official account.
 *
 * `waitUntil` (Cloudflare ctx.waitUntil) keeps the email request alive past the
 * response; when absent the email is awaited inline.
 */
export async function dispatchNotification(
	env: NotifyEnv,
	waitUntil: ((p: Promise<unknown>) => void) | undefined,
	params: {
		recipientId: string;
		actorId: string;
		type: NotificationType;
		slug: string;
		title: string;
		commentId?: string | null;
	}
): Promise<void> {
	const { recipientId, actorId, type, slug, title } = params;
	if (!recipientId || recipientId === actorId) return;
	if (recipientId === OFFICIAL_USER_ID) return;

	const db = env.DB;
	await insertStmt(db, {
		id: randomHex(16),
		userId: recipientId,
		type,
		actorId,
		slug,
		title,
		commentId: params.commentId ?? null,
	}).run();

	if (!EMAILABLE.includes(type)) return;

	// Resolve recipient contact + actor name for the email body in a single
	// round-trip (both are rows in `users`), then split them back out.
	const { results: userRows } = await db
		.prepare('SELECT id, email, email_notifications, username FROM users WHERE id IN (?, ?)')
		.bind(recipientId, actorId)
		.all<{
			id: string;
			email: string | null;
			email_notifications: number;
			username: string;
		}>();
	const recipient = userRows.find((r) => r.id === recipientId);
	if (!recipient?.email || recipient.email_notifications !== 1) return;

	const actor = userRows.find((r) => r.id === actorId);
	const actorName = actor?.username ?? 'Someone';

	const promise = sendNotificationEmail(env, {
		to: recipient.email,
		type,
		actorName,
		title,
		slug,
	});
	if (waitUntil) waitUntil(promise);
	else await promise;
}

/**
 * Fan a 'new_template' notification out to everyone who follows the creator.
 * In-app only (no email — these are low-priority and would be noisy). Done in a
 * single batch so a popular creator doesn't issue N round-trips.
 */
export async function notifyNewTemplate(
	db: D1Database,
	params: { creatorId: string; slug: string; title: string }
): Promise<void> {
	const { creatorId, slug, title } = params;
	const { results } = await db
		.prepare('SELECT follower_id FROM follows WHERE following_id = ?')
		.bind(creatorId)
		.all<{ follower_id: string }>();
	if (results.length === 0) return;

	const stmts = results.map((r) =>
		insertStmt(db, {
			id: randomHex(16),
			userId: r.follower_id,
			type: 'new_template',
			actorId: creatorId,
			slug,
			title,
			commentId: null,
		})
	);
	await db.batch(stmts);
}

// ── Email content (English; emails have no per-user locale) ──────────────────

async function sendNotificationEmail(
	env: NotifyEnv,
	params: {
		to: string;
		type: NotificationType;
		actorName: string;
		title: string;
		slug: string;
	}
): Promise<boolean> {
	const t = useTranslations('en');
	const base = siteUrl(env);
	const ctaUrl = `${base}/template/${encodeURIComponent(params.slug)}`;
	const vars = { actor: params.actorName, title: params.title };

	const key =
		params.type === 'comment_on_template'
			? 'commentOnTemplate'
			: 'commentReply';

	const { html, text } = renderEmail({
		heading: t(`email.${key}.heading`, vars),
		intro: t(`email.${key}.intro`, vars),
		ctaLabel: t('email.cta'),
		ctaUrl,
		footer: t('email.footer', { url: `${base}/notifications` }),
	});

	return sendEmail(env, {
		to: params.to,
		subject: t(`email.${key}.subject`, vars),
		html,
		text,
	});
}
