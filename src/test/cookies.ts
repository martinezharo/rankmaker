/**
 * A stand-in for Astro's `AstroCookies` — enough of it for the modules that
 * read and write cookies (auth sessions, the mature-content preference), plus
 * a record of what was written so tests can assert on the flags that make a
 * cookie safe (httpOnly, sameSite, path, maxAge).
 */
import type { AstroCookies } from 'astro';

export type WrittenCookie = {
	value: string;
	options: Record<string, unknown>;
};

export type FakeCookies = AstroCookies & {
	written: Map<string, WrittenCookie>;
	deleted: string[];
};

export function fakeCookies(
	initial: Record<string, string> = {}
): FakeCookies {
	const jar = new Map(Object.entries(initial));
	const written = new Map<string, WrittenCookie>();
	const deleted: string[] = [];

	const api = {
		written,
		deleted,
		get(name: string) {
			const value = jar.get(name);
			return value === undefined
				? undefined
				: { value, json: () => JSON.parse(value), number: () => Number(value), boolean: () => value === 'true' };
		},
		has: (name: string) => jar.has(name),
		set(name: string, value: string, options: Record<string, unknown> = {}) {
			jar.set(name, value);
			written.set(name, { value, options });
		},
		delete(name: string) {
			jar.delete(name);
			deleted.push(name);
		},
	};
	return api as unknown as FakeCookies;
}
