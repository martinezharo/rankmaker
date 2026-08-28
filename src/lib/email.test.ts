import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SITE_URL, renderEmail, sendEmail, siteUrl } from './email';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

const CONFIGURED = {
	RESEND_API_KEY: 'test-key',
	RESEND_FROM: 'RANKMAKER <no-reply@rankmaker.net>',
};

const message = {
	to: 'reader@example.test',
	subject: 'Hello',
	html: '<p>Hi</p>',
	text: 'Hi',
};

describe('siteUrl', () => {
	it('falls back to the production site', () => {
		expect(siteUrl({})).toBe(DEFAULT_SITE_URL);
		expect(siteUrl({ SITE_URL: '' })).toBe(DEFAULT_SITE_URL);
	});

	it('uses the configured base without a trailing slash', () => {
		expect(siteUrl({ SITE_URL: 'https://staging.test/' })).toBe(
			'https://staging.test'
		);
		expect(siteUrl({ SITE_URL: 'https://staging.test///' })).toBe(
			'https://staging.test'
		);
	});
});

describe('sendEmail', () => {
	it('posts the message to Resend', async () => {
		const fetchMock = vi.fn(
			async (_url: string, _init?: RequestInit) =>
				new Response('{}', { status: 200 })
		);
		vi.stubGlobal('fetch', fetchMock);

		expect(await sendEmail(CONFIGURED, message)).toBe(true);

		const [url, init = {}] = fetchMock.mock.calls[0];
		expect(url).toBe('https://api.resend.com/emails');
		expect((init.headers as any).Authorization).toBe('Bearer test-key');
		expect(JSON.parse(init.body as string)).toEqual({
			from: CONFIGURED.RESEND_FROM,
			to: [message.to],
			subject: message.subject,
			html: message.html,
			text: message.text,
		});
	});

	it('does nothing when sending is not configured', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		for (const env of [
			{},
			{ RESEND_API_KEY: 'k' },
			{ RESEND_FROM: 'f' },
		]) {
			expect(await sendEmail(env, message)).toBe(false);
		}
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('does nothing without a recipient', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		expect(await sendEmail(CONFIGURED, { ...message, to: '' })).toBe(false);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('reports failure without throwing when Resend refuses', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('bad request', { status: 422 }))
		);
		expect(await sendEmail(CONFIGURED, message)).toBe(false);
	});

	it('swallows a network failure — email must never break the request', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new Error('network down');
			})
		);
		expect(await sendEmail(CONFIGURED, message)).toBe(false);
	});

	it('omits the text part when there is none', async () => {
		const fetchMock = vi.fn(
			async (_url: string, _init?: RequestInit) =>
				new Response('{}', { status: 200 })
		);
		vi.stubGlobal('fetch', fetchMock);
		await sendEmail(CONFIGURED, {
			to: message.to,
			subject: message.subject,
			html: message.html,
		});
		const [, init = {}] = fetchMock.mock.calls[0];
		expect(JSON.parse(init.body as string)).not.toHaveProperty('text');
	});
});

describe('renderEmail', () => {
	const opts = {
		heading: 'New comment',
		intro: 'alice commented on your template.',
		ctaLabel: 'Open it',
		ctaUrl: 'https://rankmaker.net/template/x',
		footer: 'Manage your emails',
	};

	it('renders both parts, with the CTA linking where it says', () => {
		const { html, text } = renderEmail(opts);
		expect(html).toContain('New comment');
		expect(html).toContain('href="https://rankmaker.net/template/x"');
		expect(text).toContain('Open it: https://rankmaker.net/template/x');
		expect(text).toContain('Manage your emails');
	});

	it('includes the optional body block only when given one', () => {
		expect(renderEmail({ ...opts, body: 'A quoted comment' }).html).toContain(
			'A quoted comment'
		);
		expect(renderEmail({ ...opts, body: 'A quoted comment' }).text).toContain(
			'A quoted comment'
		);
		expect(renderEmail(opts).html).not.toContain('A quoted comment');
	});

	it('escapes every interpolated value, including the link', () => {
		const { html } = renderEmail({
			heading: '<script>alert(1)</script>',
			intro: '"><img onerror=alert(1)>',
			body: '<b>bold</b>',
			ctaLabel: '</a><script>x</script>',
			ctaUrl: 'https://rankmaker.net/"onmouseover="alert(1)',
			footer: '<hr>',
		});
		// Every hostile value survives only as inert text.
		expect(html).not.toContain('<script>');
		expect(html).not.toContain('<img ');
		expect(html).not.toContain('<b>bold</b>');
		expect(html).not.toContain('<hr>');
		expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
		// The CTA's quote is escaped, so it cannot close the href attribute.
		expect(html).toContain(
			'href="https://rankmaker.net/&quot;onmouseover=&quot;alert(1)"'
		);
	});

	it('uses only inline styles — most mail clients strip <style> blocks', () => {
		expect(renderEmail(opts).html).not.toContain('<style');
	});
});
