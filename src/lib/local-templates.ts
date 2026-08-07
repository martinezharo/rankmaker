/**
 * Guest ("local") templates — templates a visitor creates without an account.
 *
 * They live in this browser's localStorage instead of D1, are playable exactly
 * like a DB-backed template (see src/pages/local/[id].astro, which feeds the
 * shared ranking engine from here) and are uploaded to the account the first
 * time the visitor signs in (see src/scripts/local-templates-sync.ts).
 *
 * Guests can't upload images, so a local template is text only; everything
 * else matches the create form's shape so importing is a plain POST of the
 * same payload /api/templates already validates.
 *
 * The pure helpers (parse/upsert/remove) are exported and unit-tested; the
 * localStorage wrappers are thin and fail-safe — storage may be unavailable
 * (private mode, disabled cookies) and that must never break the UI.
 */

import { MAX_OPTIONS } from './template-limits';

const STORAGE_KEY = 'rankmaker_local_templates';

/**
 * Deliberately small: local templates are a try-before-you-sign-in device, and
 * every one of them is POSTed on the next sign-in. The account limit
 * (MAX_TEMPLATES_PER_USER) stays the real ceiling.
 */
export const MAX_LOCAL_TEMPLATES = 5;

export type LocalTemplateOption = {
	/** Stable within the template (1-based position); the ranking engine keys battles by it. */
	id: number;
	name: string;
};

export type LocalTemplate = {
	id: string;
	title: string;
	description: string;
	category: string | null;
	options: LocalTemplateOption[];
	/** Epoch ms — newest first ordering, and the tie-break on import. */
	created_at: number;
};

/** What the create form hands over; ids and timestamps are assigned here. */
export type LocalTemplateInput = {
	title: string;
	description?: string;
	category?: string | null;
	options: { name: string }[];
};

/**
 * Ranking slug for a local template. The `local:` prefix cannot collide with a
 * real slug (those are URL segments, so `:` never appears in them), which
 * keeps the shared ranking history/exclusion stores — keyed by slug — from
 * mixing a local template up with a DB-backed one.
 */
export function localTemplateSlug(id: string): string {
	return `local:${id}`;
}

/** True for a ranking slug that belongs to a local template. */
export function isLocalTemplateSlug(slug: string | null | undefined): boolean {
	return typeof slug === 'string' && slug.startsWith('local:');
}

/** The local template id inside a `local:` slug, or null for any other slug. */
export function localTemplateIdFromSlug(slug: string): string | null {
	return isLocalTemplateSlug(slug) ? slug.slice('local:'.length) || null : null;
}

/** The page that plays a local template. */
export function localTemplatePath(id: string): string {
	return `/local/${id}`;
}

// ── Pure helpers (unit-tested) ────────────────────────────────────────────────

function isOption(value: unknown): value is { name: unknown } {
	return typeof value === 'object' && value !== null && 'name' in value;
}

/**
 * Validate a stored blob back into templates, dropping anything malformed
 * rather than throwing — a corrupt entry must not hide the rest.
 */
export function parseLocalTemplates(value: unknown): LocalTemplate[] {
	if (!Array.isArray(value)) return [];
	const templates: LocalTemplate[] = [];
	for (const entry of value) {
		if (typeof entry !== 'object' || entry === null) continue;
		const t = entry as Record<string, unknown>;
		if (typeof t.id !== 'string' || !t.id) continue;
		if (typeof t.title !== 'string' || !t.title.trim()) continue;
		if (!Array.isArray(t.options)) continue;
		const options: LocalTemplateOption[] = [];
		for (const option of t.options) {
			if (!isOption(option)) continue;
			const name = typeof option.name === 'string' ? option.name.trim() : '';
			if (!name) continue;
			options.push({ id: options.length + 1, name });
			if (options.length === MAX_OPTIONS) break;
		}
		if (options.length < 2) continue;
		templates.push({
			id: t.id,
			title: t.title,
			description: typeof t.description === 'string' ? t.description : '',
			category: typeof t.category === 'string' && t.category ? t.category : null,
			options,
			created_at:
				typeof t.created_at === 'number' && Number.isFinite(t.created_at)
					? t.created_at
					: 0,
		});
	}
	return templates.sort((a, b) => b.created_at - a.created_at);
}

/** Insert or replace one template, newest first and capped. */
export function upsertLocalTemplate(
	list: LocalTemplate[],
	template: LocalTemplate
): LocalTemplate[] {
	const next = [template, ...list.filter((t) => t.id !== template.id)];
	return next
		.sort((a, b) => b.created_at - a.created_at)
		.slice(0, MAX_LOCAL_TEMPLATES);
}

/** Drop one template by id. */
export function removeLocalTemplate(
	list: LocalTemplate[],
	id: string
): LocalTemplate[] {
	return list.filter((t) => t.id !== id);
}

/** Normalize form input into a stored template (ids/timestamp assigned here). */
export function toLocalTemplate(input: LocalTemplateInput): LocalTemplate {
	const options: LocalTemplateOption[] = [];
	for (const option of input.options) {
		const name = option?.name?.trim();
		if (!name) continue;
		options.push({ id: options.length + 1, name });
		if (options.length === MAX_OPTIONS) break;
	}
	return {
		id: newId(),
		title: input.title.trim(),
		description: (input.description ?? '').trim(),
		category: input.category || null,
		options,
		created_at: Date.now(),
	};
}

function newId(): string {
	// crypto.randomUUID needs a secure context; the fallback only has to be
	// unique within one browser's small list.
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID();
	}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ── localStorage wrappers (fail-safe) ─────────────────────────────────────────

function read(): LocalTemplate[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? parseLocalTemplates(JSON.parse(raw)) : [];
	} catch {
		return [];
	}
}

/**
 * Fired after any change to this browser's templates, so surfaces that show
 * them (the header's guest menu, the list on /me) can re-render without
 * polling localStorage.
 */
export const LOCAL_TEMPLATES_CHANGED = 'rankmaker:local-templates-changed';

function write(list: LocalTemplate[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
	} catch {
		/* storage unavailable or full — ignore */
	}
	// Guarded: this module is also imported by unit tests, which have no DOM.
	if (typeof document !== 'undefined') {
		document.dispatchEvent(new CustomEvent(LOCAL_TEMPLATES_CHANGED));
	}
}

/** Every local template in this browser, newest first. */
export function listLocalTemplates(): LocalTemplate[] {
	return read();
}

/** One local template, or null when this browser doesn't have it. */
export function getLocalTemplate(id: string): LocalTemplate | null {
	if (!id) return null;
	return read().find((t) => t.id === id) ?? null;
}

/** Persist a newly created template; returns the stored copy (with its id). */
export function saveLocalTemplate(input: LocalTemplateInput): LocalTemplate {
	const template = toLocalTemplate(input);
	write(upsertLocalTemplate(read(), template));
	return template;
}

/** Forget one local template (also used once it has been imported). */
export function deleteLocalTemplate(id: string): void {
	write(removeLocalTemplate(read(), id));
}

/** True when this browser is at the local-template cap. */
export function atLocalTemplateLimit(): boolean {
	return read().length >= MAX_LOCAL_TEMPLATES;
}
