// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loginUrl, openLoginPrompt } from './auth-prompt';
import { mount } from '../test/dom';

function withModal() {
	mount(`
		<button id="opener">Sign in</button>
		<div id="login-modal" class="hidden">
			<a id="login-modal-continue" href="#">Continue with GitHub</a>
		</div>
	`);
	return {
		modal: document.getElementById('login-modal')!,
		link: document.getElementById('login-modal-continue') as HTMLAnchorElement,
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
});

describe('openLoginPrompt', () => {
	it('opens the shared modal, pointed at the current page', () => {
		const { modal, link } = withModal();
		openLoginPrompt();

		expect(modal.classList.contains('hidden')).toBe(false);
		expect(link.getAttribute('href')).toBe(loginUrl());
		expect(document.activeElement).toBe(link);
	});

	it('points the modal at an explicit destination', () => {
		const { link } = withModal();
		openLoginPrompt('/create');
		expect(link.getAttribute('href')).toBe('/api/auth/login?next=%2Fcreate');
	});

	it('redirects directly when the modal is not on the page', () => {
		mount('<div>No modal here</div>');
		const location = { href: '' };
		vi.stubGlobal('location', location);

		openLoginPrompt('/create');

		expect(location.href).toBe('/api/auth/login?next=%2Fcreate');
	});
});
