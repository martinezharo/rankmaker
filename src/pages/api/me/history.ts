export const prerender = false;

import type { APIRoute } from 'astro';
import { checkOrigin, getSessionUser, json } from '../../../lib/auth';
import {
	canAccessTemplate,
	getTemplateBySlug,
} from '../../../lib/templates';
import {
	canonicalizeRankingResult,
	rankingResultTimestamp,
	type RankedItem,
} from '../../../lib/ranking-results';
import {
	canonicalizeBattleHistory,
	parseBattleHistory,
} from '../../../lib/battle-history';

type StoredResult = {
	slug: string;
	title: string;
	cover: string | null;
	result: string;
	battle_history: string | null;
	updated_at: string;
};

function storedBattleHistory(raw: string | null) {
	if (!raw) return undefined;
	try {
		return parseBattleHistory(JSON.parse(raw)) ?? undefined;
	} catch {
		return undefined;
	}
}

function storedEntry(row: StoredResult) {
	try {
		const result = JSON.parse(row.result);
		if (!Array.isArray(result)) return null;
		return {
			slug: row.slug,
			title: row.title,
			cover: row.cover ?? undefined,
			result: result as RankedItem[],
			battles: storedBattleHistory(row.battle_history),
			ts: rankingResultTimestamp(row.updated_at),
		};
	} catch {
		return null;
	}
}

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
				`SELECT slug, title, cover, result, battle_history, updated_at
				 FROM ranking_results WHERE user_id = ? AND slug = ?`
			)
				.bind(user.id, slug)
				.first<StoredResult>();
			const entry = row ? storedEntry(row) : null;
			// Keep `result` for older clients while exposing timestamped metadata so
			// current clients can resolve local/server conflicts correctly.
			return json({ result: entry?.result ?? null, entry }, 200, headers);
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

		let body: { slug?: unknown; result?: unknown; battles?: unknown };
		try {
			body = await context.request.json();
		} catch {
			return json({ error: 'Invalid JSON' }, 400);
		}

		const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
		if (!slug) return json({ error: 'Invalid template.' }, 400);

		const template = await getTemplateBySlug(env.DB, slug);
		if (!template || !canAccessTemplate(template, user.username)) {
			// Same response for missing and inaccessible private templates.
			return json({ error: 'Template not found.' }, 404);
		}

		const canonical = canonicalizeRankingResult(template, body.result);
		if (!canonical.ok) return json({ error: canonical.error }, 400);
		const canonicalBattles = canonicalizeBattleHistory(
			template.options,
			body.battles
		);
		if (!canonicalBattles.ok) {
			return json({ error: canonicalBattles.error }, 400);
		}
		const title = template.title;
		const cover = template.cover_image;
		const result = canonical.result;
		const battles = canonicalBattles.battles;

		const saved = await env.DB.prepare(
			`INSERT INTO ranking_results
			   (user_id, slug, title, cover, result, battle_history, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
			 ON CONFLICT(user_id, slug) DO UPDATE SET
			   result = excluded.result,
			   battle_history = excluded.battle_history,
			   title = excluded.title,
			   cover = excluded.cover,
			   updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
			 RETURNING updated_at`
		)
			.bind(
				user.id,
				slug,
				title,
				cover,
				JSON.stringify(result),
				battles ? JSON.stringify(battles) : null
			)
			.first<{ updated_at: string }>();
		if (!saved) throw new Error('Ranking result was not saved.');

		return json(
			{
				ok: true,
				entry: {
					slug,
					title,
					cover: cover ?? undefined,
					result,
					battles,
					ts: rankingResultTimestamp(saved.updated_at),
				},
			},
			200
		);
	} catch (error) {
		console.error('History POST error:', error);
		return json({ error: 'Internal server error' }, 500);
	}
};
