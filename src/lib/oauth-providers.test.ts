/**
 * The provider registry's selection rules. The handshakes themselves are
 * covered end to end in tests/api/auth/oauth.test.ts; what matters here is
 * which provider a deploy offers, and what happens when its credentials are
 * missing — the difference between "the Google button is not shown" and "the
 * Google button 500s".
 */
import { describe, expect, it } from 'vitest';
import {
	PROVIDERS,
	configuredProviders,
	isProviderConfigured,
	isProviderId,
	getProvider,
	resolveProvider,
} from './oauth-providers';

const BOTH = {
	GOOGLE_CLIENT_ID: 'g-id',
	GOOGLE_CLIENT_SECRET: 'g-secret',
	GITHUB_CLIENT_ID: 'gh-id',
	GITHUB_CLIENT_SECRET: 'gh-secret',
} as unknown as Env;

const env = (overrides: Record<string, string | undefined>) =>
	({ ...BOTH, ...overrides }) as unknown as Env;

describe('the provider registry', () => {
	it('puts Google first — it is the primary sign-in option', () => {
		expect(PROVIDERS.map((p) => p.id)).toEqual(['google', 'github']);
	});

	it('recognises only the providers it defines', () => {
		expect(isProviderId('google')).toBe(true);
		expect(isProviderId('github')).toBe(true);
		for (const value of ['myspace', '', null, undefined, 42, {}]) {
			expect(isProviderId(value), String(value)).toBe(false);
		}
	});

	it('needs both halves of a credential pair', () => {
		const google = getProvider('google');
		expect(isProviderConfigured(BOTH, google)).toBe(true);
		expect(isProviderConfigured(env({ GOOGLE_CLIENT_ID: '' }), google)).toBe(
			false
		);
		expect(
			isProviderConfigured(env({ GOOGLE_CLIENT_SECRET: undefined }), google)
		).toBe(false);
	});
});

describe('configuredProviders', () => {
	it('offers only what this deploy has credentials for', () => {
		expect(
			configuredProviders(
				env({ GOOGLE_CLIENT_ID: undefined, GOOGLE_CLIENT_SECRET: undefined })
			).map((p) => p.id)
		).toEqual(['github']);
	});

	it('keeps the priority order', () => {
		expect(configuredProviders(BOTH).map((p) => p.id)).toEqual([
			'google',
			'github',
		]);
	});

	it('offers everything when nothing is configured', () => {
		// A sign-in dialog with no way to sign in would be a worse bug than the
		// misconfiguration itself; /login logs and redirects instead.
		expect(configuredProviders({} as Env).map((p) => p.id)).toEqual([
			'google',
			'github',
		]);
	});
});

describe('resolveProvider', () => {
	it('honours a usable request', () => {
		expect(resolveProvider(BOTH, 'github')?.id).toBe('github');
	});

	it('defaults to the primary provider', () => {
		for (const requested of [null, '', 'myspace']) {
			expect(resolveProvider(BOTH, requested)?.id, String(requested)).toBe(
				'google'
			);
		}
	});

	it('falls back rather than sending someone to a provider we cannot finish with', () => {
		expect(
			resolveProvider(env({ GOOGLE_CLIENT_SECRET: undefined }), 'google')?.id
		).toBe('github');
	});

	it('is null when the deploy has no usable provider at all', () => {
		expect(resolveProvider({} as Env, 'google')).toBeNull();
	});
});
