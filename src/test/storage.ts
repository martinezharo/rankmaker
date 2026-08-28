/**
 * In-memory `Storage`, for the browser-side modules that persist to
 * localStorage / sessionStorage.
 *
 * The unit environment is plain Node with no DOM, and those modules are
 * deliberately fail-safe (a missing Storage means "no saved data"), so without
 * a stub their happy paths never run.
 */
export function memStorage(): Storage {
	const entries = new Map<string, string>();
	return {
		getItem: (key) => (entries.has(key) ? entries.get(key)! : null),
		setItem: (key, value) => void entries.set(key, String(value)),
		removeItem: (key) => void entries.delete(key),
		clear: () => entries.clear(),
		key: (index) => Array.from(entries.keys())[index] ?? null,
		get length() {
			return entries.size;
		},
	} as Storage;
}
