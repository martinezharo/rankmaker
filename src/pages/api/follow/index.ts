export const prerender = false;

import type { APIRoute } from 'astro';
import { checkOrigin, getSessionUser, json } from '../../../lib/auth';
import {
	getFollowCounts,
	isFollowing,
	setFollow,
} from '../../../lib/follows';
import { withinRateLimit } from '../../../lib/rate-limit';

// Abuse guard against scripted follow/unfollow spam — generous enough that a
// person clicking around real profiles never notices it.
const FOLLOW_RATE_LIMIT = 30;
const FOLLOW_RATE_WINDOW_SECONDS = 300;

/** Resolve a user id from a username (case-insensitive). */
async function userIdByUsername(
	db: D1Database,
	username: string
): Promise<string | null> {
	const row = await db
		.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE')
		.bind(username)
		.first<{ id: string }>();
	return row?.id ?? null;
}

/**
 * GET `?username=…` → `{ exists, followers, following, isFollowing, isSelf,
 * loggedIn }`. Profile pages are publicly cached, so the follow button's
 * per-viewer state is fetched client-side. Counts are public; the rest depend
 * on the session. Never cached.
 */
export const GET: APIRoute = async (context) => {
	const headers = { 'Cache-Control': 'private, no-store' };
	const username =
		new URL(context.request.url).searchParams.get('username') ?? '';
	try {
		const { env } = context.locals.runtime;
		const targetId = username ? await userIdByUsername(env.DB, username) : null;
		if (!targetId) {
			return json(
				{
					exists: false,
					followers: 0,
					following: 0,
					isFollowing: false,
					isSelf: false,
					loggedIn: false,
				},
				200,
				headers
			);
		}

		const counts = await getFollowCounts(env.DB, targetId);
		const viewer = await getSessionUser(context.cookies, env.DB);
		const isSelf = viewer?.id === targetId;
		const following =
			viewer && !isSelf
				? await isFollowing(env.DB, viewer.id, targetId)
				: false;

		return json(
			{
				exists: true,
				followers: counts.followers,
				following: counts.following,
				isFollowing: following,
				isSelf,
				loggedIn: viewer !== null,
			},
			200,
			headers
		);
	} catch (error) {
		console.error('Follow GET error:', error);
		return json(
			{
				exists: false,
				followers: 0,
				following: 0,
				isFollowing: false,
				isSelf: false,
				loggedIn: false,
			},
			200,
			headers
		);
	}
};

/**
 * POST `{ username, action: 'follow' | 'unfollow' }` — follow/unfollow a user.
 * Login + same-origin required. Returns `{ isFollowing, followers }` (the
 * target's fresh follower count). Following yourself is rejected.
 */
export const POST: APIRoute = async (context) => {
	if (!checkOrigin(context.request)) {
		return json({ error: 'Forbidden' }, 403);
	}

	try {
		const { env } = context.locals.runtime;
		const viewer = await getSessionUser(context.cookies, env.DB);
		if (!viewer) return json({ error: 'Not logged in' }, 401);

		let body: { username?: unknown; action?: unknown };
		try {
			body = await context.request.json();
		} catch {
			return json({ error: 'Invalid JSON' }, 400);
		}

		const username = typeof body.username === 'string' ? body.username : '';
		const follow = body.action !== 'unfollow';

		const targetId = username
			? await userIdByUsername(env.DB, username)
			: null;
		if (!targetId) return json({ error: 'User not found' }, 404);
		if (targetId === viewer.id) {
			return json({ error: "You can't follow yourself" }, 400);
		}

		if (
			!(await withinRateLimit(
				env['rm-times-ranked'],
				`follow:${viewer.id}`,
				FOLLOW_RATE_LIMIT,
				FOLLOW_RATE_WINDOW_SECONDS
			))
		) {
			return json({ error: 'rate_limited' }, 429);
		}

		await setFollow(env.DB, viewer.id, targetId, follow);
		const counts = await getFollowCounts(env.DB, targetId);

		return json(
			{ isFollowing: follow, followers: counts.followers },
			200,
			{ 'Cache-Control': 'private, no-store' }
		);
	} catch (error) {
		console.error('Follow POST error:', error);
		return json({ error: 'Internal server error' }, 500);
	}
};
