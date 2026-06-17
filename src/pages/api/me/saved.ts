export const prerender = false;

import type { APIRoute } from 'astro';
import { checkOrigin, getSessionUser, json } from '../../../lib/auth';
import { getOfficialTemplateBySlug, listSavedSlugs } from '../../../lib/templates';

/** Does this slug map to a real template (official JSON or D1)? */
async function templateExists(db: D1Database, slug: string): Promise<boolean> {
	return (
		getOfficialTemplateBySlug(slug) !== null ||
		(await db
			.prepare('SELECT 1 FROM templates WHERE slug = ? COLLATE NOCASE')
			.bind(slug)
			.first()) !== null
	);
}

/**
 * GET → `{ slugs: string[] }`, the slugs this user has saved. Drives client-side
 * marking of save buttons on publicly-cached pages (cards, ranking page).
 * Anonymous callers get an empty array. Never cached.
 */
export const GET: APIRoute = async (context) => {
	const headers = { 'Cache-Control': 'private, no-store' };
	try {
		const { env } = context.locals.runtime;
		const user = await getSessionUser(context.cookies, env.DB);
		if (!user) return json({ slugs: [] }, 200, headers);
		return json({ slugs: await listSavedSlugs(env.DB, user.id) }, 200, headers);
	} catch (error) {
		console.error('Saved GET error:', error);
		return json({ slugs: [] }, 200, headers);
	}
};

/**
 * POST `{ slug, action: 'save' | 'unsave' }` — toggle a saved template. Login +
 * same-origin required. Returns `{ saved: boolean }`.
 */
export const POST: APIRoute = async (context) => {
	if (!checkOrigin(context.request)) {
		return json({ error: 'Forbidden' }, 403);
	}

	try {
		const { env } = context.locals.runtime;
		const user = await getSessionUser(context.cookies, env.DB);
		if (!user) return json({ error: 'Not logged in' }, 401);

		let body: { slug?: unknown; action?: unknown };
		try {
			body = await context.request.json();
		} catch {
			return json({ error: 'Invalid JSON' }, 400);
		}

		const slug = typeof body.slug === 'string' ? body.slug : '';
		const action = body.action === 'unsave' ? 'unsave' : 'save';
		if (!slug || !(await templateExists(env.DB, slug))) {
			return json({ error: 'Template not found' }, 404);
		}

		if (action === 'save') {
			await env.DB.prepare(
				'INSERT OR IGNORE INTO template_saves (user_id, slug) VALUES (?, ?)'
			)
				.bind(user.id, slug)
				.run();
		} else {
			await env.DB.prepare(
				'DELETE FROM template_saves WHERE user_id = ? AND slug = ?'
			)
				.bind(user.id, slug)
				.run();
		}

		return json(
			{ saved: action === 'save' },
			200,
			{ 'Cache-Control': 'private, no-store' }
		);
	} catch (error) {
		console.error('Saved POST error:', error);
		return json({ error: 'Internal server error' }, 500);
	}
};
