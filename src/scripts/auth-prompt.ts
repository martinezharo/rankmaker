/**
 * Shared "you need to be signed in" entry point. Every login-gated action
 * across the app (save, vote, comment, follow, header nav, guest template
 * creation) used to hard-navigate straight to GitHub; they now all funnel
 * through this so the pretty <LoginModal> (mounted once in Layout.astro)
 * opens instead, with the modal's own CTA doing the actual OAuth redirect.
 */
import { openModal } from './modal-a11y';

/** Build the GitHub-login URL, defaulting `next` to the current page. */
export function loginUrl(next?: string): string {
	const path = next ?? window.location.pathname + window.location.search;
	return `/api/auth/login?next=${encodeURIComponent(path)}`;
}

/**
 * Open the shared login modal, pointing its "Continue with GitHub" link at
 * `next` (or the current page). Falls back to a direct redirect if the modal
 * isn't on the page — defensive only, Layout mounts it everywhere.
 */
export function openLoginPrompt(next?: string): void {
	const modal = document.getElementById('login-modal');
	const continueLink = document.getElementById(
		'login-modal-continue'
	) as HTMLAnchorElement | null;
	if (!modal || !continueLink) {
		window.location.href = loginUrl(next);
		return;
	}
	continueLink.href = loginUrl(next);
	openModal(modal, { focus: continueLink });
}
