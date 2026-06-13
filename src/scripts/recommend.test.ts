import { describe, it, expect } from 'vitest';
import { tokenize, recommendTemplates, type RecommendCandidate } from './recommend';

const t = (
    slug: string,
    title: string,
    category: string | null,
    optionNames = '',
    times_ranked = 0
): RecommendCandidate => ({ slug, title, category, optionNames, times_ranked });

describe('tokenize', () => {
    it('lowercases, splits, and strips diacritics', () => {
        expect(tokenize('Star Wars: Episode IV')).toEqual([
            'star',
            'wars',
            'episode',
            'iv',
        ]);
        expect(tokenize('Pokémon')).toEqual(['pokemon']);
    });

    it('drops generic ranking words and category names', () => {
        // "best", "ranking", "the", "movies" all carry no topical signal
        expect(tokenize('The Best Movies Ranking')).toEqual([]);
    });

    it('drops single characters', () => {
        expect(tokenize('a X b')).toEqual([]);
    });
});

describe('recommendTemplates', () => {
    const target = t('best-taylor-swift-albums', 'Taylor Swift Albums', 'Music', '1989 Red Folklore Lover');

    const pool: RecommendCandidate[] = [
        t('taylor-swift-songs', 'Taylor Swift Songs Ranking', 'Music', 'Cruel Summer Anti-Hero Lover', 10),
        t('pop-divas', 'Pop Divas', 'Music', 'Beyonce Adele Rihanna', 500),
        t('star-wars-films', 'Star Wars Films', 'Movies', 'A New Hope Empire Strikes Back', 9000),
        t('best-taylor-swift-albums', 'Taylor Swift Albums', 'Music', '1989 Red Folklore Lover', 999), // self
    ];

    it('excludes the viewed template by slug', () => {
        const recs = recommendTemplates(target, pool);
        expect(recs.find((r) => r.slug === target.slug)).toBeUndefined();
    });

    it('ranks the strongest topical match first', () => {
        const recs = recommendTemplates(target, pool);
        // Shares "Taylor"+"Swift" in the title (+ "Lover" option) — beats the
        // same-category-only "Pop Divas" and the cross-category Star Wars one.
        expect(recs[0].slug).toBe('taylor-swift-songs');
    });

    it('puts a same-category match above an unrelated one', () => {
        const recs = recommendTemplates(target, pool);
        const divas = recs.findIndex((r) => r.slug === 'pop-divas');
        const starWars = recs.findIndex((r) => r.slug === 'star-wars-films');
        expect(divas).toBeLessThan(starWars);
    });

    it('respects the limit', () => {
        expect(recommendTemplates(target, pool, 1)).toHaveLength(1);
    });

    it('breaks ties by popularity when there is no overlap', () => {
        const neutral = t('colors', 'Color Wheel', 'Others');
        const recs = recommendTemplates(neutral, [
            t('a', 'Cars', 'Motor', '', 5),
            t('b', 'Dogs', 'Nature', '', 50),
        ]);
        expect(recs[0].slug).toBe('b');
    });
});
