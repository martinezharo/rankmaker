/**
 * Reveals a SmartImage's text placeholder when its <img> fails to load.
 *
 * Delegated rather than an inline `onerror=` attribute so it covers every
 * card on the page, including the ones rendered server-side with no island
 * around them and the ones a client render appends later.
 *
 * `error` does not bubble, so the listener has to be registered in the capture
 * phase on the document.
 */
const FALLBACK_SELECTOR = '.smart-image-fallback';

function revealFallback(img: HTMLImageElement): void {
	img.style.display = 'none';
	const fallback = img.parentElement?.querySelector<HTMLElement>(FALLBACK_SELECTOR);
	if (fallback) {
		fallback.classList.remove('hidden');
		fallback.style.display = 'flex';
	}
}

function onError(event: Event): void {
	const target = event.target;
	if (
		target instanceof HTMLImageElement &&
		target.hasAttribute('data-fallback-img')
	) {
		revealFallback(target);
	}
}

let bound = false;

export function initImageFallbacks(): void {
	if (!bound) {
		document.addEventListener('error', onError, true);
		bound = true;
	}

	// Images that failed before this ran (or before hydration) never fire the
	// event again — `complete` with a zero natural width is the "already broken"
	// signal.
	document
		.querySelectorAll<HTMLImageElement>('img[data-fallback-img]')
		.forEach((img) => {
			if (img.complete && img.naturalWidth === 0) revealFallback(img);
		});
}
