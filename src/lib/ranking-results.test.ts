import { describe, expect, it } from 'vitest';
import {
    canonicalizeRankingResult,
    rankingResultTimestamp,
} from './ranking-results';

const template = {
    options: [
        { id: 1, name: 'One', image: 'one.webp' },
        { id: 2, name: 'Two', image: null },
        { id: 3, name: 'Three', image: 'three.webp' },
    ],
};

describe('canonicalizeRankingResult', () => {
    it('keeps the client order but derives names and images from the template', () => {
        const result = canonicalizeRankingResult(template, [
            { id: 3, name: 'Forged', image: 'https://attacker.example/image' },
            { id: 1, name: 'Also forged', image: '' },
        ]);

        expect(result).toEqual({
            ok: true,
            result: [
                { id: 3, name: 'Three', image: 'three.webp' },
                { id: 1, name: 'One', image: 'one.webp' },
            ],
        });
    });

    it('allows a valid subset for rankings with excluded options', () => {
        expect(canonicalizeRankingResult(template, [{ id: 1 }, { id: 2 }])).toEqual({
            ok: true,
            result: [
                { id: 1, name: 'One', image: 'one.webp' },
                { id: 2, name: 'Two', image: '' },
            ],
        });
    });

    it.each([
        [[{ id: 1 }], 'at least 2'],
        [[{ id: 1 }, { id: 1 }], 'duplicate'],
        [[{ id: 1 }, { id: 99 }], 'unknown'],
        [[{ name: 'Missing id' }, { id: 1 }], 'invalid'],
    ])('rejects invalid input %#', (input, message) => {
        const result = canonicalizeRankingResult(template, input);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toContain(message);
    });
});

describe('rankingResultTimestamp', () => {
    it('parses legacy D1 UTC datetimes and ISO datetimes', () => {
        expect(rankingResultTimestamp('2026-07-14 12:30:00')).toBe(
            Date.parse('2026-07-14T12:30:00Z')
        );
        expect(rankingResultTimestamp('2026-07-14T12:30:00.123Z')).toBe(
            Date.parse('2026-07-14T12:30:00.123Z')
        );
    });
});
