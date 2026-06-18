/**
 * Client-side share toggle for template cards, shared by the static cards
 * (TemplateCard.astro) and dynamically-injected rows (the homepage "Following"
 * row). A `.share-btn` carries `data-title` and `data-slug` plus an `<i>` icon.
 *
 * Uses the Web Share API where available, otherwise copies the URL to the
 * clipboard and flashes a check on the icon. Binding is idempotent
 * (`data-shareBound`) so it can run again after new buttons are injected.
 */
import { clientT, getClientLocale } from '../i18n/client';
import { localizePath } from '../i18n';

export function initShareButtons(): void {
	const t = clientT();
	const locale = getClientLocale();

	const buttons = Array.from(
		document.querySelectorAll<HTMLElement>('.share-btn')
	).filter((b) => !b.dataset.shareBound);

	for (const btn of buttons) {
		btn.dataset.shareBound = '1';
		btn.addEventListener('click', async (e) => {
			e.preventDefault();
			e.stopPropagation();
			const title = btn.dataset.title || '';
			const slug = btn.dataset.slug || '';
			const url = `${window.location.origin}${localizePath(`/template/${slug}`, locale)}`;

			if (navigator.share) {
				try {
					await navigator.share({
						title: t('card.shareTitle', { title }),
						url,
					});
				} catch {
					/* user dismissed the share sheet */
				}
			} else {
				await navigator.clipboard.writeText(url);
				const icon = btn.querySelector('i');
				if (icon) {
					icon.className = 'fa-solid fa-check text-xs';
					setTimeout(() => {
						icon.className = 'fa-solid fa-share-nodes text-xs';
					}, 1500);
				}
			}
		});
	}
}
