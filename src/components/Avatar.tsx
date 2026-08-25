/**
 * A preset icon avatar (users never upload photos — see src/lib/avatars.ts).
 *
 * Real markup rather than the `avatarHtml()` string builder: this component
 * renders identically on the server and in the browser, which is the whole
 * reason that string existed.
 */
import { AVATAR_PRESETS } from '../lib/avatars';
import { defaultLocale, type Locale } from '../i18n/config';
import { useTranslations } from '../i18n';

export const AVATAR_SIZES = { sm: 20, md: 32, lg: 48, xl: 80 } as const;

export type AvatarSize = keyof typeof AVATAR_SIZES;

export interface AvatarProps {
	avatar: string;
	size?: AvatarSize;
	verified?: boolean;
	/** Active locale — components render on both sides, so it comes in as a prop. */
	locale?: Locale;
}

export default function Avatar({
	avatar,
	size = 'md',
	verified = false,
	locale = defaultLocale,
}: AvatarProps) {
	const t = useTranslations(locale);
	const preset = AVATAR_PRESETS[avatar] ?? AVATAR_PRESETS['star-purple']!;
	const sizePx = AVATAR_SIZES[size];
	const iconSize = Math.round(sizePx * 0.45);
	const badgeSize = Math.max(10, Math.round(sizePx * 0.32));

	return (
		<span
			class="relative inline-flex shrink-0"
			style={`width:${sizePx}px;height:${sizePx}px;`}
		>
			<span
				class="flex items-center justify-center rounded-full w-full h-full overflow-hidden"
				style={`background:${preset.bg};${preset.img ? 'border:1px solid #2a2a3a;' : ''}`}
			>
				{preset.img ? (
					<img
						src={preset.img}
						alt=""
						class="w-full h-full object-contain"
						style={`padding:${Math.max(2, Math.round(sizePx * 0.08))}px;`}
					/>
				) : (
					<i
						class={`fa-solid ${preset.icon}`}
						style={`font-size:${iconSize}px;color:${preset.fg};`}
					/>
				)}
			</span>
			{verified && (
				<span
					class="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-surface"
					style={`width:${badgeSize}px;height:${badgeSize}px;`}
					data-rm-tip={t('tooltip.verified')}
				>
					<i
						class="fa-solid fa-circle-check"
						style={`font-size:${badgeSize - 3}px;color:#FFD700;`}
					/>
				</span>
			)}
		</span>
	);
}
