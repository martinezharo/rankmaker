/**
 * Preset avatars. Users never upload photos — they pick one of these
 * icon + color combos at signup (a random one is preselected).
 * The key is stored on the `users.avatar` column.
 */
export type AvatarPreset = {
    icon: string; // FontAwesome solid class (fa-xxx)
    bg: string; // CSS background (color or gradient)
    fg: string; // icon color
    img?: string; // image avatar (used instead of the icon when set)
};

export const AVATAR_PRESETS: Record<string, AvatarPreset> = {
    'bolt-purple': { icon: 'fa-bolt', bg: '#8400FF', fg: '#ffffff' },
    'fire-gold': { icon: 'fa-fire', bg: '#FFBA00', fg: '#1a1205' },
    'dragon-emerald': { icon: 'fa-dragon', bg: '#10b981', fg: '#04130d' },
    'rocket-blue': { icon: 'fa-rocket', bg: '#3b82f6', fg: '#ffffff' },
    'ghost-slate': { icon: 'fa-ghost', bg: '#64748b', fg: '#ffffff' },
    'gamepad-red': { icon: 'fa-gamepad', bg: '#ef4444', fg: '#ffffff' },
    'music-pink': { icon: 'fa-music', bg: '#ec4899', fg: '#ffffff' },
    'star-purple': { icon: 'fa-star', bg: '#a033ff', fg: '#ffffff' },
    'skull-dark': { icon: 'fa-skull', bg: '#27272a', fg: '#e4e4e7' },
    'cat-orange': { icon: 'fa-cat', bg: '#f97316', fg: '#ffffff' },
    'gem-teal': { icon: 'fa-gem', bg: '#14b8a6', fg: '#ffffff' },
    'bolt-lime': { icon: 'fa-meteor', bg: '#84cc16', fg: '#101503' },
    'moon-indigo': { icon: 'fa-moon', bg: '#6366f1', fg: '#ffffff' },
    'pepper-maroon': { icon: 'fa-pepper-hot', bg: '#b91c1c', fg: '#ffffff' },
    'paw-brown': { icon: 'fa-paw', bg: '#a16207', fg: '#ffffff' },
    'snowflake-cyan': { icon: 'fa-snowflake', bg: '#06b6d4', fg: '#ffffff' },
    // Reserved for the seeded RANKMAKER account — never selectable at signup.
    // Renders the site logo (favicon) on a dark background.
    official: {
        icon: 'fa-crown',
        bg: '#0a0a0f',
        fg: '#FFD700',
        img: '/favicon.webp',
    },
};

/** Keys users may actually pick (everything except `official`). */
export const SELECTABLE_AVATAR_KEYS = Object.keys(AVATAR_PRESETS).filter(
    (k) => k !== 'official'
);

export function isValidAvatarKey(key: unknown): key is string {
    return (
        typeof key === 'string' && SELECTABLE_AVATAR_KEYS.includes(key)
    );
}

export function randomAvatarKey(): string {
    return SELECTABLE_AVATAR_KEYS[
        Math.floor(Math.random() * SELECTABLE_AVATAR_KEYS.length)
    ];
}

/**
 * Render an avatar as an HTML string. Used by Avatar.astro (set:html) and
 * by client scripts (header auth slot, search result cards) so the markup
 * stays identical everywhere.
 */
export function avatarHtml(
    key: string,
    sizePx: number,
    verified = false
): string {
    const preset = AVATAR_PRESETS[key] ?? AVATAR_PRESETS['star-purple'];
    const iconSize = Math.round(sizePx * 0.45);
    const badgeSize = Math.max(10, Math.round(sizePx * 0.32));
    const badge = verified
        ? `<span class="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-surface" style="width:${badgeSize}px;height:${badgeSize}px;" title="Verified"><i class="fa-solid fa-circle-check" style="font-size:${badgeSize - 3}px;color:#FFD700;"></i></span>`
        : '';
    const inner = preset.img
        ? `<img src="${preset.img}" alt="" class="w-full h-full object-contain" style="padding:${Math.max(2, Math.round(sizePx * 0.08))}px;" />`
        : `<i class="fa-solid ${preset.icon}" style="font-size:${iconSize}px;color:${preset.fg};"></i>`;
    return (
        `<span class="relative inline-flex shrink-0" style="width:${sizePx}px;height:${sizePx}px;">` +
        `<span class="flex items-center justify-center rounded-full w-full h-full overflow-hidden" style="background:${preset.bg};${preset.img ? 'border:1px solid #2a2a3a;' : ''}">` +
        inner +
        `</span>${badge}</span>`
    );
}
