export const prerender = false;

import type { APIRoute } from 'astro';
import { checkOrigin, getSessionUser, json } from '../../../lib/auth';
import {
	canAccessTemplate,
	getTemplateBySlug,
	getTemplateOwnerId,
} from '../../../lib/templates';
import {
	createComment,
	getComment,
	getCommentAuthorId,
	listComments,
	parentOnSlug,
	MAX_BODY_LEN,
} from '../../../lib/comments';
import { dispatchNotification } from '../../../lib/notifications';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * GET /api/comments?slug=… — public. The full comment thread for a template
 * plus the viewer's context (who they are, whether they can attach a saved
 * result). Loaded client-side because template pages are publicly cached, so
 * this is the only place that knows the current session.
 */
export const GET: APIRoute = async (context) => {
	const slug = new URL(context.request.url).searchParams.get('slug') ?? '';
	try {
		const { env } = context.locals.runtime;
		const template = await getTemplateBySlug(env.DB, slug);
		if (!template) return json({ error: 'Not found' }, 404, NO_STORE);

		const user = await getSessionUser(context.cookies, env.DB);
		// Private templates: same "creator only" rule as the page — a comment
		// thread is real content, not just metadata, so it must 404 for everyone
		// else instead of leaking through this publicly-cached-page-adjacent API.
		if (!canAccessTemplate(template, user?.username)) {
			return json({ error: 'Not found' }, 404, NO_STORE);
		}
		const comments = await listComments(env.DB, slug, user?.id ?? null);

		return json(
			{
				currentUser: user
					? {
							username: user.username,
							avatar: user.avatar,
							isVerified: user.isVerified,
						}
					: null,
				comments,
			},
			200,
			NO_STORE
		);
	} catch (error) {
		console.error('Comments GET error:', error);
		return json({ error: 'Internal server error' }, 500, NO_STORE);
	}
};

/**
 * POST /api/comments — create a comment or reply. Login + same-origin required.
 * The author's ranking is not stored on the comment: it's resolved live from
 * ranking_results when the thread is read, so it shows up automatically once
 * they've ranked (even if they comment first) and tracks any later re-rank.
 */
export const POST: APIRoute = async (context) => {
	if (!checkOrigin(context.request)) {
		return json({ error: 'Forbidden' }, 403);
	}

	try {
		const { env } = context.locals.runtime;
		const user = await getSessionUser(context.cookies, env.DB);
		if (!user) return json({ error: 'Not logged in' }, 401);

		let body: {
			slug?: string;
			body?: string;
			parentId?: string;
		};
		try {
			body = await context.request.json();
		} catch {
			return json({ error: 'Invalid JSON' }, 400);
		}

		const slug = typeof body.slug === 'string' ? body.slug : '';
		const template = await getTemplateBySlug(env.DB, slug);
		if (!template) return json({ error: 'Not found' }, 404);
		if (!canAccessTemplate(template, user.username)) {
			return json({ error: 'Not found' }, 404);
		}

		const text = typeof body.body === 'string' ? body.body.trim() : '';
		if (!text) return json({ error: 'Comment is empty' }, 400);
		if (text.length > MAX_BODY_LEN) {
			return json({ error: 'Comment is too long' }, 400);
		}

		let parentId: string | null = null;
		if (typeof body.parentId === 'string' && body.parentId) {
			if (!(await parentOnSlug(env.DB, body.parentId, slug))) {
				return json({ error: 'Invalid parent' }, 400);
			}
			parentId = body.parentId;
		}

		const id = await createComment(env.DB, {
			slug,
			userId: user.id,
			parentId,
			body: text,
		});

		// Notify (best-effort — never fail the comment if this throws).
		// A reply notifies the parent comment's author; a top-level comment
		// notifies the template owner. dispatchNotification skips self-notifies.
		try {
			const recipientId = parentId
				? await getCommentAuthorId(env.DB, parentId)
				: await getTemplateOwnerId(env.DB, slug);
			if (recipientId) {
				await dispatchNotification(
					env,
					context.locals.runtime.ctx?.waitUntil?.bind(
						context.locals.runtime.ctx
					),
					{
						recipientId,
						actorId: user.id,
						type: parentId
							? 'comment_reply'
							: 'comment_on_template',
						slug,
						title: template.title,
						commentId: id,
					}
				);
			}
		} catch (notifyError) {
			console.error('Notification dispatch error:', notifyError);
		}

		const comment = await getComment(env.DB, id, user.id);
		return json({ ok: true, comment }, 200, NO_STORE);
	} catch (error) {
		console.error('Comments POST error:', error);
		return json({ error: 'Internal server error' }, 500);
	}
};
