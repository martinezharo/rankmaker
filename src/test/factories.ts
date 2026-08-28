/**
 * Row builders for the D1-backed tests.
 *
 * Tests state only what they care about ("a private template owned by alice");
 * everything else gets a valid default here, so adding a NOT NULL column means
 * one edit rather than one per test.
 */
import type { TestD1 } from './d1';

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${++counter}`;

export type SeededUser = { id: string; username: string };

export async function insertUser(
	db: TestD1,
	overrides: Partial<{
		id: string;
		username: string;
		avatar: string;
		isVerified: boolean;
		showMature: boolean;
		bio: string | null;
		githubId: number | null;
	}> = {}
): Promise<SeededUser> {
	const id = overrides.id ?? nextId('user');
	const username = overrides.username ?? id;
	await db
		.prepare(
			`INSERT INTO users (id, github_id, username, avatar, is_verified, bio, show_mature)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			id,
			overrides.githubId ?? null,
			username,
			overrides.avatar ?? 'star-purple',
			overrides.isVerified ? 1 : 0,
			overrides.bio ?? null,
			overrides.showMature ? 1 : 0
		)
		.run();
	return { id, username };
}

export type SeededTemplate = { id: string; slug: string; creatorId: string };

export async function insertTemplate(
	db: TestD1,
	creatorId: string,
	overrides: Partial<{
		id: string;
		slug: string;
		title: string;
		description: string | null;
		category: string;
		coverImage: string | null;
		visibility: 'public' | 'private' | 'unlisted';
		isMature: boolean;
		matureLocked: boolean;
		createdAt: string;
		options: { name: string; image?: string | null }[];
	}> = {}
): Promise<SeededTemplate> {
	const id = overrides.id ?? nextId('tpl');
	const slug = overrides.slug ?? id;
	const createdAt = overrides.createdAt ?? '2026-01-01T00:00:00.000Z';
	await db
		.prepare(
			`INSERT INTO templates
			   (id, creator_id, slug, title, description, category, cover_image,
			    created_at, updated_at, visibility, is_mature, mature_locked)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			id,
			creatorId,
			slug,
			overrides.title ?? `Title ${id}`,
			overrides.description ?? 'A description long enough to be valid.',
			overrides.category ?? 'Movies',
			overrides.coverImage ?? null,
			createdAt,
			createdAt,
			overrides.visibility ?? 'public',
			overrides.isMature ? 1 : 0,
			overrides.matureLocked ? 1 : 0
		)
		.run();

	const options = overrides.options ?? [{ name: 'A' }, { name: 'B' }];
	for (const [position, option] of options.entries()) {
		await db
			.prepare(
				`INSERT INTO template_options (template_id, name, image, position)
				 VALUES (?, ?, ?, ?)`
			)
			.bind(id, option.name, option.image ?? null, position)
			.run();
	}
	return { id, slug, creatorId };
}

/** One row in `rankings` per "started a ranking" event — what getCounts sums. */
export async function insertRankingEvents(
	db: TestD1,
	slug: string,
	times = 1
): Promise<void> {
	for (let i = 0; i < times; i++) {
		await db
			.prepare('INSERT INTO rankings (slug, url, date) VALUES (?, ?, ?)')
			.bind(slug, `https://rankmaker.org/template/${slug}`, '2026-01-01')
			.run();
	}
}

/**
 * A saved ranking. `result` is the ordered `[{id,name,image}]` JSON the
 * history page and the comment "top pick" badge both read.
 */
export async function insertRankingResult(
	db: TestD1,
	userId: string,
	slug: string,
	overrides: Partial<{
		title: string;
		result: { id: number; name: string; image: string | null }[];
		updatedAt: string;
	}> = {}
): Promise<void> {
	const updatedAt = overrides.updatedAt ?? '2026-01-01T00:00:00.000Z';
	await db
		.prepare(
			`INSERT INTO ranking_results
			   (user_id, slug, title, result, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT(user_id, slug) DO UPDATE SET
			   title = excluded.title,
			   result = excluded.result,
			   updated_at = excluded.updated_at`
		)
		.bind(
			userId,
			slug,
			overrides.title ?? `Title for ${slug}`,
			JSON.stringify(
				overrides.result ?? [{ id: 1, name: 'Winner', image: null }]
			),
			updatedAt,
			updatedAt
		)
		.run();
}

/**
 * A live session for `userId`, shaped as the cookie jar an API context takes:
 * `apiContext({ cookies: await signIn(db, user.id) })`.
 */
export async function signIn(
	db: TestD1,
	userId: string
): Promise<Record<string, string>> {
	const { createSession, SESSION_COOKIE } = await import('../lib/auth');
	return { [SESSION_COOKIE]: await createSession(db, userId) };
}

/** An uploaded-image row, as the upload endpoint would have left it. */
export async function insertImage(
	db: TestD1,
	userId: string,
	key: string,
	templateId: string | null = null
): Promise<void> {
	await db
		.prepare(
			'INSERT INTO images (key, user_id, template_id) VALUES (?, ?, ?)'
		)
		.bind(key, userId, templateId)
		.run();
}
