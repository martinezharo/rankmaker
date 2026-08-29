export const prerender = false;

import type { APIRoute } from 'astro';
import { checkOrigin, getSessionUser, json } from '../../../lib/auth';
import {
    MAX_TEMPLATES_PER_USER,
    generateUniqueSlug,
    generateUnlistedSlug,
    validateTemplateInput,
} from '../../../lib/templates';
import {
    claimImages,
    collectImageKeys,
    imagePublicBase,
    verifyImageOwnership,
} from '../../../lib/images';
import { notifyNewTemplate } from '../../../lib/notifications';
import { getEnv } from '../../../lib/runtime';

const SOURCE_LOCAL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

async function importedTemplateId(userId: string, sourceLocalId: string) {
    const input = new TextEncoder().encode(`${userId}\0${sourceLocalId}`);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
    return `local-${Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** Create a template (auth required). Body: { title, description, category, cover_image, visibility, options, source_local_id? }. */
export const POST: APIRoute = async (context) => {
    if (!checkOrigin(context.request)) {
        return json({ error: 'Forbidden' }, 403);
    }

    try {
        const env = getEnv();
        const db = env.DB;
        const user = await getSessionUser(context.cookies, db);
        if (!user) return json({ error: 'You must be logged in.' }, 401);

        let body: unknown;
        try {
            body = await context.request.json();
        } catch {
            return json({ error: 'Invalid JSON' }, 400);
        }

        let sourceLocalId: string | null = null;
        if (
            typeof body === 'object' &&
            body !== null &&
            'source_local_id' in body
        ) {
            const value = (body as { source_local_id?: unknown }).source_local_id;
            if (typeof value !== 'string' || !SOURCE_LOCAL_ID_RE.test(value)) {
                return json({ error: 'Invalid local template id.' }, 400);
            }
            sourceLocalId = value;
        }

        const imageBase = imagePublicBase(env);
        const result = validateTemplateInput(body, { base: imageBase });
        if (!result.ok) return json({ error: result.error }, 400);
        const data = result.data;

        // Every referenced image must be an upload owned by this user —
        // this is what stops hand-crafted payloads from pointing at other
        // people's (or unmoderated) objects.
        const imageKeys = collectImageKeys(data, imageBase);
        // This key is reserved for the guest-template importer. Guest
        // templates are always private and text-only, so accepting it on a
        // normal creation would expose an unnecessary idempotency namespace.
        if (
            sourceLocalId &&
            (data.visibility !== 'private' || imageKeys.length > 0)
        ) {
            return json({ error: 'Invalid local template import.' }, 400);
        }
        if (!(await verifyImageOwnership(db, imageKeys, user.id))) {
            return json({ error: 'Invalid image.' }, 400);
        }

        // A deterministic primary key makes imports idempotent without a
        // separate mapping table. If the response was lost after D1 committed,
        // the next page load returns the original template instead of creating
        // a suffixed copy.
        const id = sourceLocalId
            ? await importedTemplateId(user.id, sourceLocalId)
            : crypto.randomUUID();
        if (sourceLocalId) {
            const existing = await db
                .prepare('SELECT id, slug FROM templates WHERE id = ? AND creator_id = ?')
                .bind(id, user.id)
                .first<{ id: string; slug: string }>();
            if (existing) return json({ ok: true, ...existing, reused: true });
        }

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

        // Unlisted templates get a random, unguessable slug — the URL is the
        // only access control they have.
        const slug =
            data.visibility === 'unlisted'
                ? await generateUnlistedSlug(db, data.title)
                : await generateUniqueSlug(db, data.title);

        const optionRows = data.options
            .map(() => 'SELECT ? AS name, ? AS image, ? AS position')
            .join(' UNION ALL ');
        const optionValues = data.options.flatMap((option, position) => [
            option.name,
            option.image,
            position,
        ]);

        // The COUNT above and this INSERT are separate statements, so two
        // concurrent creations could both pass the fast path. The batch runs as
        // one transaction: the template INSERT re-checks the limit atomically,
        // and the option INSERTs are conditioned on the template row existing
        // so the whole batch no-ops cleanly when the limit was hit in between.
        const results = await db.batch([
            db
                .prepare(
                    `INSERT INTO templates (id, creator_id, slug, title, description, category, cover_image, visibility, is_mature)
                     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
                     WHERE (SELECT COUNT(*) FROM templates WHERE creator_id = ?) < ?
                     ON CONFLICT DO NOTHING`
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
                    data.is_mature ? 1 : 0,
                    user.id,
                    MAX_TEMPLATES_PER_USER
                ),
            db
                .prepare(
                    `INSERT INTO template_options (template_id, name, image, position)
                     SELECT ?, options.name, options.image, options.position
                     FROM (${optionRows}) AS options
                     WHERE EXISTS (SELECT 1 FROM templates WHERE id = ?)
                       AND NOT EXISTS (SELECT 1 FROM template_options WHERE template_id = ?)`
                )
                .bind(id, ...optionValues, id, id),
        ]);
        // A concurrent retry can reach the batch before the first request has
        // returned. Its deterministic id loses the insert race, then resolves
        // the row the winner committed.
        if ((results[0]?.meta?.changes ?? 1) === 0 && sourceLocalId) {
            const existing = await db
                .prepare('SELECT id, slug FROM templates WHERE id = ? AND creator_id = ?')
                .bind(id, user.id)
                .first<{ id: string; slug: string }>();
            if (existing) return json({ ok: true, ...existing, reused: true });
        }
        // Missing meta (older adapters) must not read as failure — the fast
        // path already covered the common case, so default to success.
        if ((results[0]?.meta?.changes ?? 1) === 0) {
            return limitError;
        }

        // Claim the uploads (after the INSERT: images.template_id has a FK
        // on templates.id). Claimed keys survive orphan cleanup and are
        // deleted with the template.
        await claimImages(db, imageKeys, id, user.id);

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
