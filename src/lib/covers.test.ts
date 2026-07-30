import { describe, expect, it } from 'vitest';
import {
    COLLAGE_TILES,
    canBuildCollage,
    collageFromOptions,
    collageHtml,
    collageImages,
    parseOptionImages,
    resolveImageUrl,
} from './covers';

const opt = (image: string | null) => ({ image });

describe('resolveImageUrl', () => {
    it('passes absolute URLs through', () => {
        expect(resolveImageUrl('https://img.rankmaker.net/a.webp')).toBe(
            'https://img.rankmaker.net/a.webp'
        );
    });

    it('rewrites public/ assets to site-root paths', () => {
        expect(resolveImageUrl('public/covers/a.webp')).toBe('/covers/a.webp');
    });

    it('returns null for empty values', () => {
        expect(resolveImageUrl(null)).toBeNull();
        expect(resolveImageUrl('')).toBeNull();
        expect(resolveImageUrl(undefined)).toBeNull();
    });
});

describe('collageImages', () => {
    it('takes the first COLLAGE_TILES usable images, in order', () => {
        const images = ['a', 'b', 'c', 'd', 'e'].map((n) => `/${n}.webp`);
        expect(collageImages(images)).toEqual([
            '/a.webp',
            '/b.webp',
            '/c.webp',
            '/d.webp',
        ]);
    });

    it('skips missing images and resolves the rest', () => {
        expect(
            collageImages([
                null,
                'public/a.webp',
                '  ',
                '/b.webp',
                '/c.webp',
                undefined,
                '/d.webp',
            ])
        ).toEqual(['/a.webp', '/b.webp', '/c.webp', '/d.webp']);
    });

    it('returns nothing when there are not enough for a full grid', () => {
        expect(collageImages(['/a.webp', '/b.webp', '/c.webp', null])).toEqual(
            []
        );
        expect(collageImages([])).toEqual([]);
    });
});

describe('collageFromOptions / canBuildCollage', () => {
    it('builds from option images', () => {
        const options = ['/a', '/b', null, '/c', '/d', '/e'].map(opt);
        expect(collageFromOptions(options)).toEqual(['/a', '/b', '/c', '/d']);
        expect(canBuildCollage(options)).toBe(true);
    });

    it('is false when fewer than COLLAGE_TILES options have an image', () => {
        const options = ['/a', null, '/b', '/c'].map(opt);
        expect(collageFromOptions(options)).toEqual([]);
        expect(canBuildCollage(options)).toBe(false);
        expect(canBuildCollage(undefined)).toBe(false);
    });
});

describe('parseOptionImages', () => {
    it('splits the newline-joined list query column', () => {
        expect(parseOptionImages('/a\n/b\n/c')).toEqual(['/a', '/b', '/c']);
    });

    it('handles empty values', () => {
        expect(parseOptionImages(null)).toEqual([]);
        expect(parseOptionImages('')).toEqual([]);
    });
});

describe('collageHtml', () => {
    const images = ['/a.webp', '/b.webp', '/c.webp', '/d.webp'];

    it('renders one tile per image', () => {
        const html = collageHtml(images, 'My ranking');
        expect(html.match(/<img /g)).toHaveLength(COLLAGE_TILES);
        expect(html).toContain('aria-label="My ranking"');
        expect(html).toContain('loading="lazy"');
    });

    it('eager-loads tiles for priority covers', () => {
        expect(collageHtml(images, 'x', { eager: true })).toContain(
            'loading="eager"'
        );
    });

    it('escapes the label and image URLs', () => {
        const html = collageHtml(
            ['/a.webp?x="1"', '/b.webp', '/c.webp', '/d.webp'],
            '<script>alert(1)</script>'
        );
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
        expect(html).toContain('/a.webp?x=&quot;1&quot;');
    });

    it('renders nothing without a full set of tiles', () => {
        expect(collageHtml(images.slice(0, 3), 'x')).toBe('');
    });
});
