import { describe, expect, it } from 'vitest';
import { serializeJsonForScript } from './safe-json';

describe('serializeJsonForScript', () => {
	it('keeps JSON data parseable while neutralizing HTML-sensitive characters', () => {
		const value = {
			text: '</script><script>alert("xss")</script> & separators',
		};

		const serialized = serializeJsonForScript(value);

		expect(serialized).not.toContain('<');
		expect(serialized).not.toContain('>');
		expect(serialized).not.toContain('&');
		expect(JSON.parse(serialized)).toEqual(value);
	});

	it('serializes undefined as JSON null', () => {
		expect(serializeJsonForScript(undefined)).toBe('null');
	});
});
