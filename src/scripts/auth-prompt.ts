/**
 * Shared "you need to be signed in" entry point. Every login-gated action
 * across the app (save, vote, comment, follow, header nav, guest template
 * creation) used to hard-navigate straight to the provider; they now all
 * funnel through this so the pretty <LoginModal> (mounted once in
 * Layout.astro) opens instead, and the provider buttons inside it do the
 * actual OAuth redirect.
 */
import { openModal } from './modal-a11y';

/**
 * Build the login URL, defaulting `next` to the current page and the provider
 * to whichever one the server considers primary (see
 * src/lib/oauth-providers.ts).
 */
export function loginUrl(next?: string, provider?: string): string {
	const path = next ?? window.location.pathname + window.location.search;
	const params = new URLSearchParams({ next: path });
	if (provider) params.set('provider', provider);
	return `/api/auth/login?${params}`;
}

/**
 * Open the shared login modal, pointing every provider button at `next` (or
 * the current page). Falls back to a direct redirect if the modal isn't on the
 * page — defensive only, Layout mounts it everywhere.
 */
export function openLoginPrompt(next?: string): void {
	const modal = document.getElementById('login-modal');
	const links = modal
		? Array.from(
				modal.querySelectorAll<HTMLAnchorElement>('a[data-login-provider]')
			)
		: [];
	if (!modal || links.length === 0) {
		window.location.href = loginUrl(next);
		return;
	}
	for (const link of links) {
		link.href = loginUrl(next, link.dataset.loginProvider);
	}
	openModal(modal, { focus: links[0] });
}
