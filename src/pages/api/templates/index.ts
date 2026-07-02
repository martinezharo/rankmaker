export const prerender = false;

import type { APIRoute } from 'astro';
import { checkOrigin, getSessionUser, json } from '../../../lib/auth';
import {
    MAX_TEMPLATES_PER_USER,
    generateUniqueSlug,
    generateUnlistedSlug,
    validateTemplateInput,
} from '../../../lib/templates';
import { notifyNewTemplate } from '../../../lib/notifications';

/** Create a template (auth required). Body: { title, description, category, cover_image, visibility, options }. */
export const POST: APIRoute = async (context) => {
    if (!checkOrigin(context.request)) {
        return json({ error: 'Forbidden' }, 403);
    }

    try {
        const db = context.locals.runtime.env.DB;
        const user = await getSessionUser(context.cookies, db);
        if (!user) return json({ error: 'You must be logged in.' }, 401);

        let body: unknown;
        try {
            body = await context.request.json();
        } catch {
            return json({ error: 'Invalid JSON' }, 400);
        }

        const result = validateTemplateInput(body);
        if (!result.ok) return json({ error: result.error }, 400);
        const data = result.data;

        const limitError = json(
            { error: `You can create at most ${MAX_TEMPLATES_PER_USER} templates.` },
            403
        );

        // Fast path only — the atomic re-check lives in the INSERT below. This
        // just avoids the slug-generation queries when the user is clearly over.
        const count = await db
            .prepare('SELECT COUNT(*) AS n FROM templates WHERE creator_id = ?')
            .bind(user.id)
            .first<{ n: number }>();
        if ((count?.n ?? 0) >= MAX_TEMPLATES_PER_USER) {
            return limitError;
        }

        const id = crypto.randomUUID();
        // Unlisted templates get a random, unguessable slug — the URL is the
        // only access control they have.
        const slug =
            data.visibility === 'unlisted'
                ? await generateUnlistedSlug(db, data.title)
                : await generateUniqueSlug(db, data.title);

        // The COUNT above and this INSERT are separate statements, so two
        // concurrent creations could both pass the fast path. The batch runs as
        // one transaction: the template INSERT re-checks the limit atomically,
        // and the option INSERTs are conditioned on the template row existing
        // so the whole batch no-ops cleanly when the limit was hit in between.
        const results = await db.batch([
            db
                .prepare(
                    `INSERT INTO templates (id, creator_id, slug, title, description, category, cover_image, visibility)
                     SELECT ?, ?, ?, ?, ?, ?, ?, ?
                     WHERE (SELECT COUNT(*) FROM templates WHERE creator_id = ?) < ?`
                )
                .bind(
                    id,
                    user.id,
                    slug,
                    data.title,
                    data.description,
                    data.category,
                    data.cover_image,
                    data.visibility,
                    user.id,
                    MAX_TEMPLATES_PER_USER
                ),
            ...data.options.map((o, i) =>
                db
                    .prepare(
                        `INSERT INTO template_options (template_id, name, image, position)
                         SELECT ?, ?, ?, ?
                         WHERE EXISTS (SELECT 1 FROM templates WHERE id = ?)`
                    )
                    .bind(id, o.name, o.image, i, id)
            ),
        ]);
        // Missing meta (older adapters) must not read as failure — the fast
        // path already covered the common case, so default to success.
        if ((results[0]?.meta?.changes ?? 1) === 0) {
            return limitError;
        }

        // Tell followers about new PUBLIC templates only (private/unlisted are
        // hidden, so surfacing them would leak them). Best-effort.
        if (data.visibility === 'public') {
            try {
                await notifyNewTemplate(db, {
                    creatorId: user.id,
                    slug,
                    title: data.title,
                });
            } catch (notifyError) {
                console.error('New-template notification error:', notifyError);
            }
        }

        return json({ ok: true, id, slug });
    } catch (error) {
        console.error('Create template error:', error);
        return json({ error: 'Internal server error' }, 500);
    }
};
