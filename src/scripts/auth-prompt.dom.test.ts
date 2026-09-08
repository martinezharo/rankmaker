// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loginUrl, openLoginPrompt } from './auth-prompt';
import { mount } from '../test/dom';

/** The modal as LoginModal.astro renders it: one link per provider. */
function withModal() {
	mount(`
		<button id="opener">Sign in</button>
		<div id="login-modal" class="hidden">
			<a data-login-provider="google" href="#">Continue with Google</a>
			<a data-login-provider="github" href="#">Continue with GitHub</a>
		</div>
	`);
	const links = Array.from(
		document.querySelectorAll<HTMLAnchorElement>('a[data-login-provider]')
	);
	return {
		modal: document.getElementById('login-modal')!,
		links,
		google: links[0],
		github: links[1],
	};
}

beforeEach(() => {
	vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
		fn(0);
		return 0;
	});
	window.history.replaceState({}, '', '/template/best-movies?from=home');
});
afterEach(() => {
	vi.unstubAllGlobals();
});

describe('loginUrl', () => {
	it('returns to the current page by default', () => {
		expect(loginUrl()).toBe(
			'/api/auth/login?next=%2Ftemplate%2Fbest-movies%3Ffrom%3Dhome'
		);
	});

	it('encodes an explicit destination', () => {
		expect(loginUrl('/me?tab=saved')).toBe(
			'/api/auth/login?next=%2Fme%3Ftab%3Dsaved'
		);
	});

	it('names a provider only when one was asked for', () => {
		// Without it the server picks the primary provider, which is the whole
		// point: the no-JS links in the markup stay provider-agnostic.
		expect(loginUrl('/create')).toBe('/api/auth/login?next=%2Fcreate');
		expect(loginUrl('/create', 'google')).toBe(
			'/api/auth/login?next=%2Fcreate&provider=google'
		);
	});
});

describe('openLoginPrompt', () => {
	it('opens the shared modal, pointed at the current page', () => {
		const { modal, google, github } = withModal();
		openLoginPrompt();

		expect(modal.classList.contains('hidden')).toBe(false);
		expect(google.getAttribute('href')).toBe(loginUrl(undefined, 'google'));
		expect(github.getAttribute('href')).toBe(loginUrl(undefined, 'github'));
		// Focus lands on the primary provider, the first button in the dialog.
		expect(document.activeElement).toBe(google);
	});

	it('points every provider at an explicit destination', () => {
		const { google, github } = withModal();
		openLoginPrompt('/create');
		expect(google.getAttribute('href')).toBe(
			'/api/auth/login?next=%2Fcreate&provider=google'
		);
		expect(github.getAttribute('href')).toBe(
			'/api/auth/login?next=%2Fcreate&provider=github'
		);
	});

	it('redirects directly when the modal is not on the page', () => {
		mount('<div>No modal here</div>');
		const location = { href: '' };
		vi.stubGlobal('location', location);

		openLoginPrompt('/create');

		expect(location.href).toBe('/api/auth/login?next=%2Fcreate');
	});

	it('redirects directly when the modal offers no provider', () => {
		mount('<div id="login-modal" class="hidden"></div>');
		const location = { href: '' };
		vi.stubGlobal('location', location);

		openLoginPrompt('/create');

		expect(location.href).toBe('/api/auth/login?next=%2Fcreate');
	});
});
