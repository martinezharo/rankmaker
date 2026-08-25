/**
 * An image that degrades to a seeded text placeholder.
 *
 * Preact rather than Astro so the exact same component renders on the server
 * (cards, covers) and in the browser (the listing grid's mature merge, the
 * guest-local template page). The client-side card renderers used to rebuild
 * this markup as template strings, which is how server and client drifted.
 *
 * The load-failure fallback is a delegated listener (src/scripts/image-fallback.ts)
 * rather than an inline `onerror` attribute: it has to work for cards that are
 * server-rendered with no island around them, and it keeps executable markup
 * out of the HTML.
 */
import { stringToColor } from '../lib/placeholder-color';

/**
 * Default intrinsic dimensions for priority covers: matches the `aspect-4/3`
 * container (1200×900 = 4:3). Lets the browser reserve the LCP box before the
 * image arrives. Real cover aspect ratios vary (the object-cover crop handles
 * that), so this only reserves space — it never distorts the rendered image.
 */
const PRIORITY_DEFAULT_W = 1200;
const PRIORITY_DEFAULT_H = 900;

export interface SmartImageProps {
	src: string | null;
	alt: string;
	/** Additional classes for the container. */
	className?: string;
	/** Text shown by the fallback. */
	text: string;
	/** Option thumbnails use a smaller text size. */
	isOption?: boolean;
	/** LCP image: load eagerly with high fetch priority. */
	priority?: boolean;
	/** Intrinsic pixel dimensions of `src`. Only meaningful with `priority`. */
	width?: number;
	height?: number;
}

/**
 * `null`, the literal strings "null"/"undefined", and placehold.co URLs all
 * mean "no image" — the last because seeded data used to point there.
 */
function isUsableSrc(src: string | null): src is string {
	return (
		!!src &&
		src !== 'null' &&
		src !== 'undefined' &&
		!src.includes('placehold.co')
	);
}

export default function SmartImage({
	src,
	alt,
	className = '',
	text,
	isOption = false,
	priority = false,
	width,
	height,
}: SmartImageProps) {
	const hasImage = isUsableSrc(src);

	// Only emit width/height when explicitly meaningful (priority images). Lazy
	// <img> in cards rely on their container's aspect-ratio and would be lied
	// to by guessed dimensions.
	const intrinsicW = priority ? (width ?? PRIORITY_DEFAULT_W) : width;
	const intrinsicH = priority ? (height ?? PRIORITY_DEFAULT_H) : height;
	const hasIntrinsic = priority && !!intrinsicW && !!intrinsicH;

	return (
		<div class={`relative overflow-hidden bg-surface ${className}`}>
			{hasImage && (
				<img
					src={src}
					alt={alt}
					width={hasIntrinsic ? intrinsicW : undefined}
					height={hasIntrinsic ? intrinsicH : undefined}
					class="w-full h-full object-cover transition-opacity duration-300"
					loading={priority ? 'eager' : 'lazy'}
					fetchpriority={priority ? 'high' : 'auto'}
					decoding={priority ? 'async' : undefined}
					data-fallback-img
				/>
			)}

			{/* The `smart-image-fallback*` classes are stable hooks for surfaces
			    that fill this in the browser (the guest-local template page). */}
			<div
				class={`smart-image-fallback absolute inset-0 flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-surface-elevated to-surface border border-white/5 ${hasImage ? 'hidden' : 'flex'}`}
				style={`--tw-gradient-to: ${stringToColor(text)}40;`}
			>
				<span
					class={`smart-image-fallback-text font-bold text-text-primary/90 leading-tight ${isOption ? 'text-xs line-clamp-2' : 'text-xl sm:text-2xl line-clamp-3'}`}
				>
					{text}
				</span>
				{!isOption && <div class="mt-2 w-12 h-1 bg-primary/50 rounded-full" />}
			</div>
		</div>
	);
}
