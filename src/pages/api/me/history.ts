export const prerender = false;

import type { APIRoute } from 'astro';
import { checkOrigin, getSessionUser, json } from '../../../lib/auth';
import { templateExists } from '../../../lib/templates';

// Bounds so a logged-in user can't bloat the row. A result is the ordered list
// of options they ranked — typically small, but cap it defensively.
const MAX_TITLE_LEN = 200;
const MAX_RESULT_ITEMS = 200;
const MAX_NAME_LEN = 200;
const MAX_IMAGE_LEN = 1024;

type RankedItem = { id: number | string; name: string; image: string };

/**
 * GET — two shapes, both per-user and never cached:
 *   - `?slug=…` → `{ result: RankedItem[] | null }`, the saved result for that
 *     template, so a logged-in user lands on their results view even on a fresh
 *     device (where this browser's localStorage has no copy).
 *   - no slug → `{ slugs: [] }`, the "played" slugs that drive the client-side
 *     recommendation filter.
 * Anonymous visitors get the empty shape (they read localStorage instead).
 */
export const GET: APIRoute = async (context) => {
	const headers = { 'Cache-Control': 'private, no-store' };
	const slug = new URL(context.request.url).searchParams.get('slug');
	try {
		const { env } = context.locals.runtime;
		const user = await getSessionUser(context.cookies, env.DB);

		if (slug) {
			if (!user) return json({ result: null }, 200, headers);
			const row = await env.DB.prepare(
				'SELECT result FROM ranking_results WHERE user_id = ? AND slug = ?'
			)
				.bind(user.id, slug)
				.first<{ result: string }>();
			let result: RankedItem[] | null = null;
			if (row) {
				try {
					result = JSON.parse(row.result) as RankedItem[];
				} catch {
					result = null;
				}
			}
			return json({ result }, 200, headers);
		}

		if (!user) return json({ slugs: [] }, 200, headers);

		const { results } = await env.DB.prepare(
			'SELECT DISTINCT slug FROM rankings WHERE user_id = ?'
		)
			.bind(user.id)
			.all<{ slug: string }>();
		return json({ slugs: results.map((r) => r.slug) }, 200, headers);
	} catch (error) {
		console.error('History GET error:', error);
		return json(slug ? { result: null } : { slugs: [] }, 200, headers);
	}
};

/**
 * POST — save a completed ranking result. Upserts one row per (user, template):
 * re-ranking overwrites the previous result. No-ops (skipped) for anonymous
 * visitors, who persist results to localStorage on the client instead.
 */
export const POST: APIRoute = async (context) => {
	if (!checkOrigin(context.request)) {
		return json({ error: 'Forbidden' }, 403);
	}

	try {
		const { env } = context.locals.runtime;
		const user = await getSessionUser(context.cookies, env.DB);
		if (!user) return json({ ok: true, skipped: true }, 200);

		let body: {
			slug?: string;
			title?: string;
			cover?: string;
			result?: RankedItem[];
		};
		try {
			body = await context.request.json();
		} catch {
			return json({ error: 'Invalid JSON' }, 400);
		}

		const slug = typeof body.slug === 'string' ? body.slug : '';
		if (!slug) return json({ ok: true, skipped: true }, 200);

		// Only persist results for a slug that maps to a real template.
		if (!(await templateExists(env.DB, slug))) {
			return json({ ok: true, skipped: true }, 200);
		}

		const title = (body.title || slug).slice(0, MAX_TITLE_LEN);
		const cover =
			typeof body.cover === 'string'
				? body.cover.slice(0, MAX_IMAGE_LEN)
				: null;
		const result = Array.isArray(body.result)
			? body.result.slice(0, MAX_RESULT_ITEMS).map((it) => ({
					id: it?.id ?? null,
					name: String(it?.name ?? '').slice(0, MAX_NAME_LEN),
					image: String(it?.image ?? '').slice(0, MAX_IMAGE_LEN),
				}))
			: [];
		if (result.length === 0) return json({ ok: true, skipped: true }, 200);

		await env.DB.prepare(
			`INSERT INTO ranking_results (user_id, slug, title, cover, result)
			 VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT(user_id, slug) DO UPDATE SET
			   result = excluded.result,
			   title = excluded.title,
			   cover = excluded.cover,
			   updated_at = datetime('now')`
		)
			.bind(user.id, slug, title, cover, JSON.stringify(result))
			.run();

		return json({ ok: true }, 200);
	} catch (error) {
		console.error('History POST error:', error);
		return json({ error: 'Internal server error' }, 500);
	}
};
