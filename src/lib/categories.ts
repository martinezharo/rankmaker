/**
 * Single source of truth for template categories and their FontAwesome icons
 * (previously copy-pasted across index, search, template page and cards).
 */
export const CATEGORIES: { name: string; icon: string }[] = [
    { name: 'Movies', icon: 'fa-film' },
    { name: 'Music', icon: 'fa-music' },
    { name: 'Sports', icon: 'fa-basketball-ball' },
    { name: 'Games', icon: 'fa-gamepad' },
    { name: 'TV', icon: 'fa-tv' },
    { name: 'People', icon: 'fa-users' },
    { name: 'Internet', icon: 'fa-globe' },
    { name: 'Anime', icon: 'fa-dragon' },
    { name: 'Lifestyle', icon: 'fa-heart' },
    { name: 'Food', icon: 'fa-utensils' },
    { name: 'Politics', icon: 'fa-landmark' },
    { name: 'History & Culture', icon: 'fa-book-open' },
    { name: 'Geography', icon: 'fa-map-marked-alt' },
    { name: 'Motor', icon: 'fa-car' },
    { name: 'Books', icon: 'fa-book' },
    { name: 'Technology', icon: 'fa-microchip' },
    { name: 'Nature', icon: 'fa-leaf' },
    { name: 'Others', icon: 'fa-ellipsis-h' },
];

export const CATEGORY_NAMES = CATEGORIES.map((c) => c.name);

export const CATEGORY_ICONS: Record<string, string> = Object.fromEntries(
    CATEGORIES.map((c) => [c.name, c.icon])
);

export function categoryIcon(category: string | null | undefined): string {
    return (category && CATEGORY_ICONS[category]) || 'fa-ellipsis-h';
}

/**
 * URL-safe slug for a category name — used for the indexable
 * `/category/[slug]` pages (e.g. "History & Culture" → "history-culture").
 */
export function categorySlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/** Reverse of `categorySlug`: slug → canonical category name, or null. */
export function categoryFromSlug(slug: string): string | null {
    for (const c of CATEGORIES) {
        if (categorySlug(c.name) === slug) return c.name;
    }
    return null;
}

/** `[slug, categoryName]` pairs for sitemap / internal linking. */
export const CATEGORY_SLUGS: { slug: string; name: string; icon: string }[] =
    CATEGORIES.map((c) => ({ slug: categorySlug(c.name), name: c.name, icon: c.icon }));
