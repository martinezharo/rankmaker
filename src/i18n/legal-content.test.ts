import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { legalContent } from './legal-content';

const obsoleteLegalClaims = [
	'Hostinger',
	'Google Analytics',
	'Google Ads',
	'PHPSESSID',
	'rankmaker_visited',
	'remember_token',
	'cookie_consent_status',
	'_ga',
	'_gid'
];

describe('legal service and storage inventory', () => {
	it.each(Object.entries(legalContent))(
		'documents every cookie the %s site actually sets',
		(_locale, content) => {
			for (const name of ['rm_session', 'rm_oauth_state', 'rm_signup', 'rm_mature']) {
				expect(content.cookiePolicy).toContain(name);
			}
		}
	);

	it.each(Object.entries(legalContent))(
		'contains no obsolete provider or cookie claims in %s',
		(_locale, content) => {
			const copy = `${content.cookiePolicy}\n${content.privacyPolicy}`;
			for (const claim of obsoleteLegalClaims) {
				expect(copy).not.toContain(claim);
			}
		}
	);

	it.each(Object.entries(legalContent))(
		'names every current external processor in %s',
		(_locale, content) => {
			for (const provider of ['Cloudflare', 'Google', 'GitHub', 'Resend', 'OpenAI']) {
				expect(content.privacyPolicy).toContain(provider);
			}
		}
	);
});

describe('analytics integration', () => {
	it('keeps Cloudflare Web Analytics and removes the Google tag', () => {
		const layout = readFileSync(join(process.cwd(), 'src/layouts/Layout.astro'), 'utf8');
		const middleware = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf8');
		const shippedSource = `${layout}\n${middleware}`;

		expect(shippedSource).toContain('static.cloudflareinsights.com');
		// Every environment ships this layout with the same beacon token, so
		// the host check is the only thing keeping dev servers, the e2e suite
		// and preview deployments out of the production figures.
		expect(layout).toContain('location.hostname !== analyticsHost');
		expect(shippedSource).not.toMatch(
			/googletagmanager|google-analytics\.com|G-LER7ZFV5BV|\bgtag\b/
		);
		expect(existsSync(join(process.cwd(), 'src/components/CookieConsent.astro'))).toBe(false);
	});
});
