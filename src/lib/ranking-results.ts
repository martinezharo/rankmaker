import type { Template } from './templates';

export type RankedItem = {
    id: number | string;
    name: string;
    image: string;
};

type CanonicalResult =
    | { ok: true; result: RankedItem[] }
    | { ok: false; error: string };

/**
 * Validate the client-provided ordering against the current template and
 * rebuild every display field from canonical template data. Results may be a
 * subset because users can deliberately exclude options before ranking.
 */
export function canonicalizeRankingResult(
    template: Pick<Template, 'options'>,
    input: unknown
): CanonicalResult {
    if (!Array.isArray(input) || input.length < 2) {
        return { ok: false, error: 'A completed ranking needs at least 2 items.' };
    }
    if (input.length > template.options.length) {
        return { ok: false, error: 'The ranking contains too many items.' };
    }

    const options = new Map(
        template.options.map((option) => [String(option.id), option])
    );
    const seen = new Set<string>();
    const result: RankedItem[] = [];

    for (const item of input) {
        if (typeof item !== 'object' || item === null || !('id' in item)) {
            return { ok: false, error: 'The ranking contains an invalid item.' };
        }
        const rawId = (item as { id: unknown }).id;
        if (typeof rawId !== 'number' && typeof rawId !== 'string') {
            return { ok: false, error: 'The ranking contains an invalid item.' };
        }

        const key = String(rawId);
        const option = options.get(key);
        if (!option || seen.has(key)) {
            return { ok: false, error: 'The ranking contains an unknown or duplicate item.' };
        }
        seen.add(key);
        result.push({
            id: option.id,
            name: option.name,
            image: option.image ?? '',
        });
    }

    return { ok: true, result };
}

/** D1's legacy datetime values use a space and no timezone; they are UTC. */
export function rankingResultTimestamp(value: string): number {
    const normalized = value.includes('T')
        ? value
        : `${value.replace(' ', 'T')}Z`;
    const timestamp = new Date(normalized).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}
