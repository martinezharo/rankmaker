export const prerender = false;

import type { APIRoute } from 'astro';
import { checkOrigin, getSessionUser, json } from '../../../lib/auth';
import { canAccessTemplate, getTemplateBySlug } from '../../../lib/templates';
import {
	applyTemplateVote,
	getTemplateVoteScore,
	getUserTemplateVote,
} from '../../../lib/template-votes';

/**
 * GET `?slug=…` → `{ score, myVote, loggedIn }`. The ranking page is publicly
 * cached, so per-user vote state can't be rendered server-side — the client
 * fetches it on load. Anonymous callers get `myVote: 0, loggedIn: false`.
 */
export const GET: APIRoute = async (context) => {
	const headers = { 'Cache-Control': 'private, no-store' };
	const slug = new URL(context.request.url).searchParams.get('slug') ?? '';
	try {
		const { env } = context.locals.runtime;
		if (!slug) return json({ score: 0, myVote: 0, loggedIn: false }, 200, headers);

		const user = await getSessionUser(context.cookies, env.DB);
		// Private templates are creator-only, same rule as the page and the
		// comments API — don't leak a vote score for a template the caller
		// isn't allowed to see.
		const template = await getTemplateBySlug(env.DB, slug);
		if (!template || !canAccessTemplate(template, user?.username)) {
			return json({ score: 0, myVote: 0, loggedIn: false }, 200, headers);
		}

		const score = await getTemplateVoteScore(env.DB, slug);
		const myVote = user
			? await getUserTemplateVote(env.DB, user.id, slug)
			: 0;

		return json({ score, myVote, loggedIn: user !== null }, 200, headers);
	} catch (error) {
		console.error('Template vote GET error:', error);
		return json({ score: 0, myVote: 0, loggedIn: false }, 200, headers);
	}
};

/**
 * POST `{ slug, value: 1 | -1 | 0 }` — cast/clear this user's vote. Login +
 * same-origin required. Returns the fresh net score and the caller's vote.
 */
export const POST: APIRoute = async (context) => {
	if (!checkOrigin(context.request)) {
		return json({ error: 'Forbidden' }, 403);
	}

	try {
		const { env } = context.locals.runtime;
		const user = await getSessionUser(context.cookies, env.DB);
		if (!user) return json({ error: 'Not logged in' }, 401);

		let body: { slug?: unknown; value?: unknown };
		try {
			body = await context.request.json();
		} catch {
			return json({ error: 'Invalid JSON' }, 400);
		}

		const slug = typeof body.slug === 'string' ? body.slug : '';
		const value = body.value;
		if (value !== 1 && value !== -1 && value !== 0) {
			return json({ error: 'Invalid vote' }, 400);
		}
		const template = slug ? await getTemplateBySlug(env.DB, slug) : null;
		if (!template || !canAccessTemplate(template, user.username)) {
			return json({ error: 'Template not found' }, 404);
		}

		const totals = await applyTemplateVote(env.DB, user.id, slug, value);
		return json(totals, 200, { 'Cache-Control': 'private, no-store' });
	} catch (error) {
		console.error('Template vote POST error:', error);
		return json({ error: 'Internal server error' }, 500);
	}
};
