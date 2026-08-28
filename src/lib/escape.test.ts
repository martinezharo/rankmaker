import { describe, expect, it } from 'vitest';
import { escapeHtml } from './escape';

describe('escapeHtml', () => {
	it('neutralizes every character that could break out of markup', () => {
		expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
	});

	it('closes the script-injection path in element text', () => {
		expect(escapeHtml('<script>alert(1)</script>')).not.toContain('<');
	});

	it('closes the attribute-breakout path', () => {
		const escaped = escapeHtml('" onload="alert(1)');
		expect(escaped).not.toContain('"');
		expect(`<span title="${escaped}">`).not.toMatch(/title="".*onload/);
	});

	it('leaves ordinary text alone', () => {
		expect(escapeHtml('Blade Runner 2049 — 100% great')).toBe(
			'Blade Runner 2049 — 100% great'
		);
		expect(escapeHtml('')).toBe('');
	});

	it('escapes every occurrence, not just the first', () => {
		expect(escapeHtml('<<<')).toBe('&lt;&lt;&lt;');
	});
});
