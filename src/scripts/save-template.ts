/**
 * Client-side save (bookmark) toggle, shared by template cards and the ranking
 * page's intro view. Template pages/cards are publicly cached, so the saved
 * state can't be rendered server-side — we fetch the user's saved slugs once
 * per page and mark matching `.save-btn` elements, then toggle via the API.
 *
 * A `.save-btn` carries `data-slug`, `data-save-aria`, `data-unsave-aria`, an
 * `<i>` bookmark icon (regular = unsaved, solid = saved), and optionally a
 * `.save-label` span with `data-label-save` / `data-label-saved` text.
 */

let savedSlugsPromise: Promise<Set<string>> | null = null;

/** Fetch (once per page load) the set of slugs this user has saved. */
function loadSavedSlugs(): Promise<Set<string>> {
	if (!savedSlugsPromise) {
		savedSlugsPromise = fetch('/api/me/saved')
			.then((r) => (r.ok ? r.json() : { slugs: [] }))
			.then((d: { slugs?: string[] }) => new Set(d.slugs ?? []))
			.catch(() => new Set<string>());
	}
	return savedSlugsPromise;
}

function paint(btn: HTMLElement, saved: boolean) {
	btn.dataset.saved = saved ? '1' : '';
	const icon = btn.querySelector('i');
	if (icon) {
		icon.classList.toggle('fa-solid', saved);
		icon.classList.toggle('fa-regular', !saved);
	}
	const aria = saved ? btn.dataset.unsaveAria : btn.dataset.saveAria;
	if (aria) btn.setAttribute('aria-label', aria);
	const label = btn.querySelector<HTMLElement>('.save-label');
	if (label) {
		const text = saved
			? label.dataset.labelSaved
			: label.dataset.labelSave;
		if (text) label.textContent = text;
	}
}

function redirectToLogin() {
	const next = encodeURIComponent(
		window.location.pathname + window.location.search
	);
	window.location.href = `/api/auth/login?next=${next}`;
}

export function initSaveButtons() {
	const buttons = Array.from(
		document.querySelectorAll<HTMLElement>('.save-btn')
	).filter((b) => !b.dataset.saveBound);
	if (buttons.length === 0) return;

	for (const btn of buttons) {
		btn.dataset.saveBound = '1';

		btn.addEventListener('click', async (e) => {
			e.preventDefault();
			e.stopPropagation();
			const slug = btn.dataset.slug;
			if (!slug || btn.dataset.savePending) return;

			const next = btn.dataset.saved !== '1';
			btn.dataset.savePending = '1';
			paint(btn, next); // optimistic
			try {
				const res = await fetch('/api/me/saved', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						slug,
						action: next ? 'save' : 'unsave',
					}),
				});
				if (res.status === 401) {
					redirectToLogin();
					return;
				}
				if (res.ok) {
					// Keep the cached set in sync so other pages reflect it.
					const slugs = await loadSavedSlugs();
					if (next) slugs.add(slug);
					else slugs.delete(slug);
				} else {
					paint(btn, !next); // revert
				}
			} catch {
				paint(btn, !next); // revert
			}
			delete btn.dataset.savePending;
		});
	}

	// Mark already-saved buttons once the saved set is known.
	loadSavedSlugs().then((slugs) => {
		for (const btn of buttons) {
			if (btn.dataset.slug && slugs.has(btn.dataset.slug)) {
				paint(btn, true);
			}
		}
	});
}
