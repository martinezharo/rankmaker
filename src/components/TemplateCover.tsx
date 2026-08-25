/**
 * A template's cover: the uploaded image when there is one, otherwise a
 * collage of its option images, otherwise SmartImage's text placeholder.
 * See src/lib/covers.ts for the resolution order.
 */
import SmartImage from './SmartImage';
import { COLLAGE_TILES, resolveImageUrl } from '../lib/covers';

export interface TemplateCoverProps {
	cover: string | null;
	/** Resolved option images (`template.collage`). */
	collage?: string[];
	title: string;
	className?: string;
	/** LCP cover: eager-load it (forwarded to SmartImage / collage tiles). */
	priority?: boolean;
	width?: number;
	height?: number;
}

export default function TemplateCover({
	cover,
	collage = [],
	title,
	className = '',
	priority = false,
	width,
	height,
}: TemplateCoverProps) {
	const coverSrc = resolveImageUrl(cover);
	const tiles = coverSrc ? [] : collage.slice(0, COLLAGE_TILES);

	// A partial grid looks broken, so anything short of a full set falls
	// through to the placeholder.
	if (tiles.length === COLLAGE_TILES) {
		return (
			<div class={`relative overflow-hidden bg-surface ${className}`}>
				<div
					class="rm-collage absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px bg-border"
					role="img"
					aria-label={title}
				>
					{tiles.map((src) => (
						<img
							key={src}
							src={src}
							alt=""
							loading={priority ? 'eager' : 'lazy'}
							decoding="async"
							class="w-full h-full object-cover bg-surface"
						/>
					))}
				</div>
			</div>
		);
	}

	return (
		<SmartImage
			src={coverSrc}
			alt={title}
			text={title}
			className={className}
			priority={priority}
			width={width}
			height={height}
		/>
	);
}
