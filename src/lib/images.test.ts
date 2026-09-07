import { describe, expect, it } from 'vitest';
import {
    MODERATION_THRESHOLDS,
    collectImageKeys,
    evaluateImageModeration,
    extractImageKey,
    sniffImageType,
} from './images';

const BASE = 'https://img.rankmaker.net';
const KEY = 'u/abc-123/0f8fad5b-d9cb-469f-a165-70867728950e.webp';

describe('extractImageKey', () => {
    it('extracts a valid uploaded-image key', () => {
        expect(extractImageKey(`${BASE}/${KEY}`, BASE)).toBe(KEY);
    });

    it('works with a relative dev base', () => {
        expect(extractImageKey(`/api/images/${KEY}`, '/api/images')).toBe(KEY);
    });

    it('rejects external URLs', () => {
        expect(extractImageKey('https://example.com/cat.webp', BASE)).toBeNull();
    });

    it('rejects official asset prefixes (covers/, options/)', () => {
        expect(extractImageKey(`${BASE}/covers/x.webp`, BASE)).toBeNull();
        expect(extractImageKey(`${BASE}/options/x.webp`, BASE)).toBeNull();
    });

    it('rejects lookalike hosts sharing the prefix string', () => {
        expect(
            extractImageKey(`https://img.rankmaker.net.evil.com/${KEY}`, BASE)
        ).toBeNull();
    });

    it('rejects traversal and non-webp keys', () => {
        expect(extractImageKey(`${BASE}/u/a/../../covers/x.webp`, BASE)).toBeNull();
        expect(extractImageKey(`${BASE}/u/abc/0f8fad5bd9cb469fa165.png`, BASE)).toBeNull();
    });
});

describe('collectImageKeys', () => {
    it('collects unique keys from cover and options, ignoring externals', () => {
        const keys = collectImageKeys(
            {
                cover_image: `${BASE}/${KEY}`,
                options: [
                    { image: `${BASE}/${KEY}` },
                    { image: 'https://example.com/x.jpg' },
                    { image: null },
                ],
            },
            BASE
        );
        expect(keys).toEqual([KEY]);
    });
});

describe('sniffImageType', () => {
    const bytes = (...values: number[]) => new Uint8Array(values);

    it('detects jpeg/png/gif/webp/avif', () => {
        expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg');
        expect(
            sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
        ).toBe('png');
        expect(
            sniffImageType(new Uint8Array([...'GIF89a'].map((c) => c.charCodeAt(0))))
        ).toBe('gif');
        const webp = new Uint8Array(12);
        webp.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0);
        webp.set([...'WEBP'].map((c) => c.charCodeAt(0)), 8);
        expect(sniffImageType(webp)).toBe('webp');
        const avif = new Uint8Array(12);
        avif.set([...'ftyp'].map((c) => c.charCodeAt(0)), 4);
        avif.set([...'avif'].map((c) => c.charCodeAt(0)), 8);
        expect(sniffImageType(avif)).toBe('avif');
        const avis = new Uint8Array(12);
        avis.set([...'ftyp'].map((c) => c.charCodeAt(0)), 4);
        avis.set([...'avis'].map((c) => c.charCodeAt(0)), 8);
        expect(sniffImageType(avis)).toBe('avif');
    });

    it('rejects SVG and arbitrary bytes', () => {
        expect(
            sniffImageType(new Uint8Array([...'<svg '].map((c) => c.charCodeAt(0))))
        ).toBeNull();
        expect(sniffImageType(bytes(0x00, 0x01, 0x02, 0x03))).toBeNull();
    });
});

describe('evaluateImageModeration', () => {
    it('allows benign scores', () => {
        expect(
            evaluateImageModeration({ sexual: 0.1, violence: 0.4 }).allowed
        ).toBe(true);
    });

    it('allows suggestive-but-ok content below the sexual threshold', () => {
        expect(
            evaluateImageModeration({ sexual: 0.5, 'sexual/minors': 0 }).allowed
        ).toBe(true);
    });

    it('blocks explicit sexual content', () => {
        const r = evaluateImageModeration({ sexual: 0.92 });
        expect(r.allowed).toBe(false);
        expect(r.category).toBe('sexual');
    });

    it('has near-zero tolerance for sexual/minors', () => {
        expect(
            evaluateImageModeration({ 'sexual/minors': 0.05 }).allowed
        ).toBe(false);
    });

    it('allows fictional gore (death-metal covers, game art) but blocks extreme gore', () => {
        expect(evaluateImageModeration({ violence: 0.8 }).allowed).toBe(true);
        expect(evaluateImageModeration({ 'violence/graphic': 0.8 }).allowed).toBe(true);
        expect(evaluateImageModeration({ 'violence/graphic': 0.96 }).allowed).toBe(false);
    });

    it('fails closed on malformed responses', () => {
        expect(evaluateImageModeration(undefined).allowed).toBe(false);
        expect(evaluateImageModeration(null).allowed).toBe(false);
        expect(evaluateImageModeration([] as unknown as Record<string, unknown>).allowed).toBe(false);
    });

    it('ignores non-numeric scores', () => {
        expect(
            evaluateImageModeration({ sexual: 'high' as unknown as number }).allowed
        ).toBe(true);
    });

    it('every threshold category actually triggers', () => {
        for (const category of Object.keys(MODERATION_THRESHOLDS)) {
            expect(evaluateImageModeration({ [category]: 1 }).allowed).toBe(false);
        }
    });
});
