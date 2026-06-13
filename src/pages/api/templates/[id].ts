export const prerender = false;

import type { APIRoute } from 'astro';
import type { APIContext } from 'astro';
import {
    checkOrigin,
    getSessionUser,
    json,
    type SessionUser,
} from '../../../lib/auth';
import {
    generateUnlistedSlug,
    validateTemplateInput,
} from '../../../lib/templates';

type Owned = { id: string; slug: string; visibility: string };

/** Returns the template iff it exists and belongs to the session user. */
async function getOwned(
    db: D1Database,
    templateId: string,
    user: SessionUser
): Promise<Owned | null> {
    const row = await db
        .prepare(
            'SELECT id, slug, creator_id, visibility FROM templates WHERE id = ?'
        )
        .bind(templateId)
        .first<{
            id: string;
            slug: string;
            creator_id: string;
            visibility: string;
        }>();
    if (!row || row.creator_id !== user.id) return null;
    return { id: row.id, slug: row.slug, visibility: row.visibility };
}

type AuthResult =
    | { ok: false; response: Response }
    | { ok: true; db: D1Database; user: SessionUser; owned: Owned };

async function authorize(context: APIContext): Promise<AuthResult> {
    if (!checkOrigin(context.request)) {
        return { ok: false, response: json({ error: 'Forbidden' }, 403) };
    }
    const db = context.locals.runtime.env.DB;
    const user = await getSessionUser(context.cookies, db);
    if (!user) {
        return {
            ok: false,
            response: json({ error: 'You must be logged in.' }, 401),
        };
    }
    const owned = await getOwned(db, context.params.id as string, user);
    if (!owned) {
        // Same response for "not found" and "not yours".
        return {
            ok: false,
            response: json({ error: 'Template not found.' }, 403),
        };
    }
    return { ok: true, db, user, owned };
}

/**
 * Update a template. The slug is preserved so share links and counts stay
 * stable — except when switching TO unlisted: the old slug is already public
 * knowledge, so a fresh random one is generated (and the ranking counts are
 * moved to it).
 */
export const PUT: APIRoute = async (context) => {
    try {
        const auth = await authorize(context);
        if (!auth.ok) return auth.response;
        const { db, owned } = auth;

        let body: unknown;
        try {
            body = await context.request.json();
        } catch {
            return json({ error: 'Invalid JSON' }, 400);
        }
        const result = validateTemplateInput(body);
        if (!result.ok) return json({ error: result.error }, 400);
        const data = result.data;

        const becameUnlisted =
            data.visibility === 'unlisted' && owned.visibility !== 'unlisted';
        const slug = becameUnlisted
            ? await generateUnlistedSlug(db, data.title)
            : owned.slug;

        await db.batch([
            db
                .prepare(
                    `UPDATE templates
                     SET title = ?, description = ?, category = ?, cover_image = ?,
                         visibility = ?, slug = ?, updated_at = datetime('now')
                     WHERE id = ?`
                )
                .bind(
                    data.title,
                    data.description,
                    data.category,
                    data.cover_image,
                    data.visibility,
                    slug,
                    owned.id
                ),
            ...(becameUnlisted
                ? [
                      db
                          .prepare(
                              'UPDATE rankings SET slug = ? WHERE slug = ? COLLATE NOCASE'
                          )
                          .bind(slug, owned.slug),
                  ]
                : []),
            db
                .prepare('DELETE FROM template_options WHERE template_id = ?')
                .bind(owned.id),
            ...data.options.map((o, i) =>
                db
                    .prepare(
                        `INSERT INTO template_options (template_id, name, image, position)
                         VALUES (?, ?, ?, ?)`
                    )
                    .bind(owned.id, o.name, o.image, i)
            ),
        ]);

        return json({ ok: true, slug });
    } catch (error) {
        console.error('Update template error:', error);
        return json({ error: 'Internal server error' }, 500);
    }
};

/** Delete a template (options cascade). */
export const DELETE: APIRoute = async (context) => {
    try {
        const auth = await authorize(context);
        if (!auth.ok) return auth.response;
        const { db, owned } = auth;

        await db
            .prepare('DELETE FROM templates WHERE id = ?')
            .bind(owned.id)
            .run();

        return json({ ok: true });
    } catch (error) {
        console.error('Delete template error:', error);
        return json({ error: 'Internal server error' }, 500);
    }
};
