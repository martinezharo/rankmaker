/**
 * HTML escaping for the modules that build markup as strings.
 *
 * Several parts of the app render HTML as text — avatars, cover collages,
 * client-side card lists — because the same markup has to come out identical
 * on the server and in the browser. Every one of those needs the same escape,
 * so it lives here rather than being re-declared per file.
 */
const ENTITIES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;',
};

/** Escape `value` for interpolation into element text or a quoted attribute. */
export function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (c) => ENTITIES[c]!);
}
