export const prerender = false;

import type { APIRoute } from 'astro';
import { checkOrigin, getSessionUser, json } from '../../../lib/auth';
import {
    MAX_TEMPLATES_PER_USER,
    generateUniqueSlug,
    validateTemplateInput,
} from '../../../lib/templates';

/** Create a template (auth required). Body: { title, description, category, cover_image, options }. */
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

        const count = await db
            .prepare('SELECT COUNT(*) AS n FROM templates WHERE creator_id = ?')
            .bind(user.id)
            .first<{ n: number }>();
        if ((count?.n ?? 0) >= MAX_TEMPLATES_PER_USER) {
            return json(
                { error: `You can create at most ${MAX_TEMPLATES_PER_USER} templates.` },
                403
            );
        }

        const id = crypto.randomUUID();
        const slug = await generateUniqueSlug(db, data.title);

        await db.batch([
            db
                .prepare(
                    `INSERT INTO templates (id, creator_id, slug, title, description, category, cover_image)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`
                )
                .bind(
                    id,
                    user.id,
                    slug,
                    data.title,
                    data.description,
                    data.category,
                    data.cover_image
                ),
            ...data.options.map((o, i) =>
                db
                    .prepare(
                        `INSERT INTO template_options (template_id, name, image, position)
                         VALUES (?, ?, ?, ?)`
                    )
                    .bind(id, o.name, o.image, i)
            ),
        ]);

        return json({ ok: true, id, slug });
    } catch (error) {
        console.error('Create template error:', error);
        return json({ error: 'Internal server error' }, 500);
    }
};
