/**
 * Template size/quantity limits, in their own module so client bundles can
 * import them without pulling in src/lib/templates.ts (which drags in the
 * bundled official-templates JSON and the D1 query layer).
 *
 * src/lib/templates.ts re-exports these, so server code can keep importing
 * them from there.
 */

export const MIN_OPTIONS = 4;
export const MAX_OPTIONS = 50;
export const MAX_TEMPLATES_PER_USER = 50;
