/**
 * Deterministic accent colour for image-less placeholders, so the same name
 * always gets the same tint. Shared by SmartImage.astro (server-rendered
 * fallbacks) and the guest-local template page, which builds its option cards
 * in the browser and has to match them exactly.
 */
export function stringToColor(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
	}
	const c = (hash & 0x00ffffff).toString(16).toUpperCase();
	return '#' + '00000'.substring(0, 6 - c.length) + c;
}
