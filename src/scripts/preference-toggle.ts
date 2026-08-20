/**
 * Wiring for the account/browser preference switches on /preferences.
 *
 * Every switch rendered by `ui/Toggle.astro` with a `data-pref-key` posts that
 * key to POST /api/me/preferences (the single endpoint behind every
 * preference). The UI flips optimistically and reverts on failure, showing the
 * message stored on the element named by `data-pref-error`.
 */
import { clientT } from '../i18n/client';

/** Paint a switch in the given state (the DOM is the state — see Toggle.astro). */
export function setToggleState(toggle: HTMLElement, on: boolean): void {
	toggle.setAttribute('aria-checked', String(on));
	toggle.classList.toggle('bg-primary', on);
	toggle.classList.toggle('bg-border', !on);
	toggle.querySelector('span')?.classList.toggle('translate-x-5', on);
}

export function isToggleOn(toggle: HTMLElement): boolean {
	return toggle.getAttribute('aria-checked') === 'true';
}

/**
 * Persist one preference. Resolves to whether the write succeeded; callers
 * decide what to do next (revert the switch, reload the page…).
 */
export async function savePreference(
	key: string,
	value: boolean
): Promise<boolean> {
	try {
		const res = await fetch('/api/me/preferences', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ [key]: value }),
		});
		return res.ok;
	} catch {
		return false;
	}
}

function showError(toggle: HTMLElement, message: string): void {
	const errorId = toggle.dataset.prefError;
	if (!errorId) return;
	const el = document.getElementById(errorId);
	// Setting textContent (rather than unhiding) is what makes the
	// role="status" live region announce it.
	if (el) el.textContent = message;
}

function clearError(toggle: HTMLElement): void {
	showError(toggle, '');
}

/** Bind every preference switch on the page. Safe to call on every navigation. */
export function bindPreferenceToggles(): void {
	const t = clientT();
	document
		.querySelectorAll<HTMLElement>('[data-pref-key]')
		.forEach((toggle) => {
			if (toggle.dataset.bound) return;
			toggle.dataset.bound = '1';
			toggle.addEventListener('click', async () => {
				const key = toggle.dataset.prefKey!;
				const next = !isToggleOn(toggle);
				clearError(toggle);
				setToggleState(toggle, next);
				if (await savePreference(key, next)) {
					// Listings are filtered server-side, so the pages already
					// rendered in this session are stale once the mature
					// preference changes.
					if (key === 'showMature') {
						document.dispatchEvent(
							new CustomEvent('rm:mature-changed', {
								detail: { showMature: next },
							})
						);
					}
					return;
				}
				setToggleState(toggle, !next);
				showError(toggle, t('preferences.saveError'));
			});
		});
}
