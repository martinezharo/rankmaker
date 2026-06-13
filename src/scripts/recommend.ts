/**
 * Pure lexical recommendation scoring — no D1, no AI.
 *
 * Ranks candidate templates against the one being viewed by counting shared
 * significant words across their titles + option names (title words weighted
 * higher), with a small bonus for the same category. The result is a single
 * blended ranking: strong topical matches first (e.g. a Taylor Swift ranking
 * surfaces her other rankings, a Star Wars one surfaces related ones), padded
 * with same-category templates, then popular ones.
 *
 * Candidates are scored in-memory per request, which is comfortable up to a
 * few thousand templates (see CLAUDE.md). When the catalogue outgrows that,
 * the same scoring idea moves into a D1 FTS5 MATCH query without changing the
 * weighting intuition here.
 */
import { CATEGORY_NAMES } from '../lib/categories';

/** The minimal shape the scorer reads. `Template` satisfies it structurally. */
export type RecommendCandidate = {
    slug: string;
    title: string;
    category: string | null;
    /** Space-joined option names. Falls back to '' when absent. */
    optionNames?: string;
    times_ranked: number;
};

/** Generic + ranking-domain words that carry no topical signal. */
const STOPWORDS = new Set<string>([
    'the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on', 'for', 'with',
    'by', 'at', 'from', 'as', 'vs', 'versus', 'your', 'you', 'my', 'our',
    'is', 'are', 'be', 'all', 'any', 'every', 'most', 'more', 'less',
    'best', 'top', 'greatest', 'worst', 'good', 'great',
    'ranking', 'rankings', 'rank', 'ranked', 'ranker', 'tier', 'tierlist',
    'list', 'lists', 'favorite', 'favorites', 'favourite', 'favourites',
    'ultimate', 'definitive', 'official', 'ever', 'time', 'times',
    'edition', 'vol', 'part', 'this', 'that', 'these', 'those',
    'who', 'what', 'which', 'when', 'where', 'how', 'best',
    // category names carry no signal beyond the explicit category bonus
    ...CATEGORY_NAMES.flatMap((c) => c.toLowerCase().split(/[^a-z0-9]+/)),
]);

/** Title words count this much more than option words toward similarity. */
const TITLE_WEIGHT = 3;
const OPTION_WEIGHT = 1;
/** Same category, no word overlap → ranks above unrelated, below any match. */
const CATEGORY_BONUS = 0.5;

/** Lowercase, strip diacritics, split on non-alphanumerics, drop stopwords. */
export function tokenize(text: string): string[] {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/**
 * Weighted token map for a template: a word in the title weighs more than the
 * same word appearing only among the options. Title weight wins on overlap.
 */
function tokenWeights(c: RecommendCandidate): Map<string, number> {
    const weights = new Map<string, number>();
    for (const t of tokenize(c.title)) weights.set(t, TITLE_WEIGHT);
    for (const t of tokenize(c.optionNames ?? '')) {
        if (!weights.has(t)) weights.set(t, OPTION_WEIGHT);
    }
    return weights;
}

function score(
    targetWeights: Map<string, number>,
    candidate: RecommendCandidate,
    targetCategory: string | null
): number {
    const candWeights = tokenWeights(candidate);
    let s = 0;
    for (const [token, w] of targetWeights) {
        const cw = candWeights.get(token);
        if (cw) s += w * cw;
    }
    if (targetCategory && candidate.category === targetCategory) {
        s += CATEGORY_BONUS;
    }
    return s;
}

/**
 * Rank `candidates` for the template being viewed and return the top `limit`.
 * The viewed template is excluded by slug. Ties break by popularity, then slug
 * (stable/deterministic).
 */
export function recommendTemplates<T extends RecommendCandidate>(
    target: RecommendCandidate,
    candidates: T[],
    limit = 8
): T[] {
    const targetWeights = tokenWeights(target);

    const scored = candidates
        .filter((c) => c.slug !== target.slug)
        .map((c) => ({ c, s: score(targetWeights, c, target.category) }))
        .sort(
            (a, b) =>
                b.s - a.s ||
                b.c.times_ranked - a.c.times_ranked ||
                a.c.slug.localeCompare(b.c.slug)
        );

    return scored.slice(0, limit).map((x) => x.c);
}
