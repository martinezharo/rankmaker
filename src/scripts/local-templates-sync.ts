/**
 * Import this browser's guest ("local") templates into the account, the first
 * time a page loads with a session.
 *
 * Guests build templates in localStorage (src/lib/local-templates.ts) and can
 * play them straight away; the moment they sign in — from anywhere in the app,
 * not just the create flow — those templates are POSTed to /api/templates as
 * private templates and dropped from local storage. Any ranking already played
 * against a local template is re-keyed to the new slug so its result survives
 * the move.
 *
 * Runs from Layout on every page load, but only ever touches the network when
 * this browser actually has local templates to import.
 */

import {
	deleteLocalTemplate,
	listLocalTemplates,
	localTemplateSlug,
	type LocalTemplate,
} from '../lib/local-templates';
import {
	getLocalResult,
	removeLocalResult,
	saveHistoryEntry,
	syncResultToAccount,
} from './history';

/** Slug a local template ended up with, once imported. */
export type ImportedTemplate = { id: string; slug: string };

/** One run per page session — re-entrant calls await the same promise. */
let running: Promise<ImportedTemplate[]> | null = null;

async function isSignedIn(): Promise<boolean> {
	try {
		const res = await fetch('/api/auth/me', {
			headers: { 'cache-control': 'no-cache' },
		});
		if (!res.ok) return false;
		const data = (await res.json()) as { user?: unknown };
		return !!data.user;
	} catch {
		return false;
	}
}

/** The create-form payload for a local template (always private, no images). */
function importPayload(template: LocalTemplate) {
	return {
		source_local_id: template.id,
		title: template.title,
		description: template.description,
		category: template.category ?? '',
		cover_image: '',
		visibility: 'private',
		options: template.options.map((option) => ({
			name: option.name,
			image: null,
		})),
	};
}

/**
 * Move the ranking this browser played against the local template onto the
 * imported template's slug, then push it to the account like any other result.
 */
function moveLocalResult(localSlug: string, slug: string): void {
	const entry = getLocalResult(localSlug);
	if (!entry) return;
	removeLocalResult(localSlug);
	const moved = { ...entry, slug };
	saveHistoryEntry(moved);
	void syncResultToAccount(moved);
}

/**
 * Import every local template, oldest first so the account keeps the order
 * they were created in. Stops at the first failure (a full account, a lapsed
 * session, a rejected payload) and leaves the rest in local storage for the
 * next attempt rather than dropping the user's work.
 */
export function syncLocalTemplates(): Promise<ImportedTemplate[]> {
	if (running) return running;

	running = (async () => {
		const templates = listLocalTemplates();
		if (templates.length === 0) return [];
		if (!(await isSignedIn())) return [];

		const imported: ImportedTemplate[] = [];
		for (const template of [...templates].reverse()) {
			let slug: string | null = null;
			try {
				const res = await fetch('/api/templates', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(importPayload(template)),
				});
				const result = (await res.json()) as {
					ok?: boolean;
					slug?: string;
				};
				if (res.ok && result.ok && result.slug) slug = result.slug;
			} catch {
				/* network error — try again on the next page load */
			}
			if (!slug) break;

			deleteLocalTemplate(template.id);
			moveLocalResult(localTemplateSlug(template.id), slug);
			imported.push({ id: template.id, slug });
		}

		if (imported.length > 0) {
			document.dispatchEvent(
				new CustomEvent('rankmaker:local-templates-imported', {
					detail: { imported },
				})
			);
		}
		return imported;
	})();

	// Allow a later navigation to retry whatever is still pending.
	void running.finally(() => {
		running = null;
	});

	return running;
}
