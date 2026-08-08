/**
 * Serialize data for an inline JSON script without allowing HTML parsing to
 * terminate the script element. JSON strings may contain user-provided text,
 * so escaping only quotes is not enough: `<` starts an HTML end tag before the
 * browser's JSON parser ever sees it.
 */
const SCRIPT_ESCAPE_MAP: Record<string, string> = {
	'<': '\\u003c',
	'>': '\\u003e',
	'&': '\\u0026',
	'\u2028': '\\u2028',
	'\u2029': '\\u2029',
};

export function serializeJsonForScript(value: unknown): string {
	const json = JSON.stringify(value);
	if (json === undefined) return 'null';
	return json.replace(
		/[<>&\u2028\u2029]/g,
		(character) => SCRIPT_ESCAPE_MAP[character]
	);
}
