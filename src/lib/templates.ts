/**
 * Normalized template layer: official templates (src/data/templates.json) and
 * user-created templates (D1) merged behind one `Template` shape so every
 * page treats both sources identically.
 */
import templatesJson from '../data/templates.json';
import { CATEGORY_NAMES } from './categories';

export const VISIBILITIES = ['public', 'private', 'unlisted'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export type Creator = {
    username: string;
    avatar: string;
    isVerified: boolean;
};

export type TemplateOption = {
    id: number;
    name: string;
    image: string | null;
};

export type Template = {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    category: string | null;
    cover_image: string | null;
    times_ranked: number;
    created_at: string;
    updated_at: string;
    options: TemplateOption[];
    creator: Creator;
    source: 'official' | 'user';
    visibility: Visibility;
    /** Space-joined option names — only populated by list queries for search. */
    optionNames?: string;
};

export const OFFICIAL_USER_ID = 'rankmaker-official';

export const OFFICIAL_CREATOR: Creator = {
    username: 'RANKMAKER',
    avatar: 'official',
    isVerified: true,
};

// ── Official (JSON) templates ────────────────────────────────────────────────

function mapOfficial(t: any): Template {
    return {
        id: t.id,
        slug: t.slug,
        title: t.title,
        description: t.description ?? null,
        category: t.category ?? null,
        cover_image: t.cover_image ?? null,
        times_ranked: t.times_ranked ?? 0,
        created_at: t.created_at,
        updated_at: t.updated_at,
        options: (t.options || []).map((o: any) => ({
            id: o.id,
            name: o.name,
            image: o.image ?? null,
        })),
        creator: OFFICIAL_CREATOR,
        source: 'official',
        visibility: 'public',
        optionNames: (t.options || []).map((o: any) => o.name).join(' '),
    };
}

let officialCache: Template[] | null = null;

export function getOfficialTemplates(): Template[] {
    if (!officialCache) {
        officialCache = (templatesJson as any[]).map(mapOfficial);
    }
    return officialCache;
}

export function getOfficialTemplateBySlug(slug: string): Template | null {
    return getOfficialTemplates().find((t) => t.slug === slug) ?? null;
}

// ── User (D1) templates ──────────────────────────────────────────────────────

type TemplateRow = {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    category: string;
    cover_image: string | null;
    created_at: string;
    updated_at: string;
    username: string;
    avatar: string;
    is_verified: number;
    visibility: string;
    option_names?: string | null;
};

function mapRow(row: TemplateRow, options: TemplateOption[] = []): Template {
    return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        category: row.category,
        cover_image: row.cover_image,
        times_ranked: 0, // pages merge real counts via getCounts(db)
        created_at: row.created_at,
        updated_at: row.updated_at,
        options,
        creator: {
            username: row.username,
            avatar: row.avatar,
            isVerified: row.is_verified === 1,
        },
        source: 'user',
        visibility: (VISIBILITIES as readonly string[]).includes(row.visibility)
            ? (row.visibility as Visibility)
            : 'public',
        optionNames: row.option_names ?? undefined,
    };
}

const TEMPLATE_SELECT = `
    SELECT t.id, t.slug, t.title, t.description, t.category, t.cover_image,
           t.created_at, t.updated_at, t.visibility,
           u.username, u.avatar, u.is_verified
    FROM templates t JOIN users u ON u.id = t.creator_id`;

const TEMPLATE_LIST_SELECT = `
    SELECT t.id, t.slug, t.title, t.description, t.category, t.cover_image,
           t.created_at, t.updated_at, t.visibility,
           u.username, u.avatar, u.is_verified,
           (SELECT GROUP_CONCAT(o.name, ' ') FROM template_options o
             WHERE o.template_id = t.id) AS option_names
    FROM templates t JOIN users u ON u.id = t.creator_id`;

export async function loadOptions(
    db: D1Database,
    templateId: string
): Promise<TemplateOption[]> {
    const { results } = await db
        .prepare(
            `SELECT id, name, image FROM template_options
             WHERE template_id = ? ORDER BY position, id`
        )
        .bind(templateId)
        .all<{ id: number; name: string; image: string | null }>();
    return results;
}

export async function getUserTemplateBySlug(
    db: D1Database,
    slug: string
): Promise<Template | null> {
    const row = await db
        .prepare(`${TEMPLATE_SELECT} WHERE t.slug = ? COLLATE NOCASE`)
        .bind(slug)
        .first<TemplateRow>();
    if (!row) return null;
    return mapRow(row, await loadOptions(db, row.id));
}

/** Resolve a slug from either source. JSON first — no D1 hit for officials. */
export async function getTemplateBySlug(
    db: D1Database,
    slug: string
): Promise<Template | null> {
    return (
        getOfficialTemplateBySlug(slug) ?? (await getUserTemplateBySlug(db, slug))
    );
}

/** Public user templates (no per-option rows) for home/search list views. */
export async function listUserTemplates(db: D1Database): Promise<Template[]> {
    const { results } = await db
        .prepare(
            `${TEMPLATE_LIST_SELECT} WHERE t.visibility = 'public'
             ORDER BY t.created_at DESC`
        )
        .all<TemplateRow>();
    return results.map((r) => mapRow(r));
}

/**
 * Templates created by a user. RANKMAKER also owns every JSON template.
 * Public ones only by default; pass `includeHidden` for owner views (/me).
 */
export async function listTemplatesByUserId(
    db: D1Database,
    userId: string,
    includeHidden = false
): Promise<Template[]> {
    const { results } = await db
        .prepare(
            `${TEMPLATE_LIST_SELECT} WHERE t.creator_id = ?
             ${includeHidden ? '' : "AND t.visibility = 'public'"}
             ORDER BY t.created_at DESC`
        )
        .bind(userId)
        .all<TemplateRow>();
    const own = results.map((r) => mapRow(r));
    return userId === OFFICIAL_USER_ID
        ? [...getOfficialTemplates(), ...own]
        : own;
}

// ── Slug generation ──────────────────────────────────────────────────────────

export function slugify(title: string): string {
    const base = title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // strip diacritics
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)
        .replace(/-+$/, '');
    return base || 'ranking';
}

/** Generate a slug unique across JSON templates and D1 templates. */
export async function generateUniqueSlug(
    db: D1Database,
    title: string
): Promise<string> {
    const base = slugify(title);

    const taken = new Set<string>();
    for (const t of getOfficialTemplates()) {
        const s = t.slug.toLowerCase();
        if (s === base || s.startsWith(`${base}-`)) taken.add(s);
    }
    const { results } = await db
        .prepare(
            `SELECT slug FROM templates
             WHERE slug = ? COLLATE NOCASE OR slug LIKE ? || '-%' COLLATE NOCASE`
        )
        .bind(base, base)
        .all<{ slug: string }>();
    for (const r of results) taken.add(r.slug.toLowerCase());

    if (!taken.has(base)) return base;
    for (let i = 2; ; i++) {
        const candidate = `${base}-${i}`;
        if (!taken.has(candidate)) return candidate;
    }
}

/** ~62 bits of crypto randomness — unguessable, the whole point of unlisted. */
function randomToken(length = 12): string {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    let out = '';
    for (const b of bytes) out += alphabet[b % alphabet.length];
    return out;
}

/**
 * Slug for unlisted templates: readable title prefix + random token, so the
 * URL can't be guessed or enumerated. Collisions are practically impossible
 * but uniqueness is still verified (the column is UNIQUE).
 */
export async function generateUnlistedSlug(
    db: D1Database,
    title: string
): Promise<string> {
    const base = slugify(title).slice(0, 40).replace(/-+$/, '') || 'ranking';
    for (;;) {
        const candidate = `${base}-${randomToken()}`;
        if (getOfficialTemplateBySlug(candidate)) continue;
        const exists = await db
            .prepare('SELECT 1 FROM templates WHERE slug = ? COLLATE NOCASE')
            .bind(candidate)
            .first();
        if (!exists) return candidate;
    }
}

// ── Input validation (shared by POST create / PUT update) ────────────────────

export const MIN_OPTIONS = 4;
export const MAX_OPTIONS = 50;
export const MAX_TEMPLATES_PER_USER = 50;

export type TemplateInput = {
    title: string;
    description: string;
    category: string;
    cover_image: string;
    visibility: Visibility;
    options: { name: string; image: string | null }[];
};

function isHttpUrl(value: string): boolean {
    if (value.length > 500) return false;
    try {
        const u = new URL(value);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}

export function validateTemplateInput(
    body: any
): { ok: true; data: TemplateInput } | { ok: false; error: string } {
    const err = (error: string) => ({ ok: false as const, error });

    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    if (title.length < 3 || title.length > 80) {
        return err('Title must be between 3 and 80 characters.');
    }

    const description =
        typeof body?.description === 'string' ? body.description.trim() : '';
    if (description.length < 15) {
        return err('Description is required (at least 15 characters).');
    }
    if (description.length > 300) {
        return err('Description must be 300 characters or less.');
    }

    const category = typeof body?.category === 'string' ? body.category : '';
    if (!CATEGORY_NAMES.includes(category)) {
        return err('Pick a valid category.');
    }

    const cover =
        typeof body?.cover_image === 'string' ? body.cover_image.trim() : '';
    if (!cover) {
        return err('Cover image is required.');
    }
    if (!isHttpUrl(cover)) {
        return err('Cover image must be a valid http(s) URL.');
    }

    // Optional for older clients — missing means public (the previous behavior).
    const visibility: Visibility =
        body?.visibility === undefined || body?.visibility === ''
            ? 'public'
            : body.visibility;
    if (!VISIBILITIES.includes(visibility)) {
        return err('Pick a valid visibility.');
    }

    if (!Array.isArray(body?.options)) return err('Options are required.');
    if (body.options.length < MIN_OPTIONS) {
        return err(`Add at least ${MIN_OPTIONS} options.`);
    }
    if (body.options.length > MAX_OPTIONS) {
        return err(`A template can have at most ${MAX_OPTIONS} options.`);
    }

    const options: TemplateInput['options'] = [];
    const seen = new Set<string>();
    for (const o of body.options) {
        const name = typeof o?.name === 'string' ? o.name.trim() : '';
        if (name.length < 1 || name.length > 80) {
            return err('Every option needs a name (max 80 characters).');
        }
        const key = name.toLowerCase();
        if (seen.has(key)) return err(`Duplicate option: "${name}".`);
        seen.add(key);

        let image: string | null = null;
        if (typeof o?.image === 'string' && o.image.trim()) {
            image = o.image.trim();
            if (!isHttpUrl(image)) {
                return err(
                    `Option "${name}": image must be a valid http(s) URL.`
                );
            }
        }
        options.push({ name, image });
    }

    return {
        ok: true,
        data: {
            title,
            description,
            category,
            cover_image: cover,
            visibility,
            options,
        },
    };
}
