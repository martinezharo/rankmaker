/**
 * Card component for template previews.
 *
 * Rendered server-side by every listing (home sections, /search, /category,
 * profiles, recommendations) and client-side by TemplateGrid when it merges in
 * mature templates. One implementation for both — /search used to carry a
 * parallel template-string renderer that had to be kept in sync by hand.
 *
 * The save/share buttons stay plain DOM hooks (`.save-btn` / `.share-btn` plus
 * their data attributes) wired by src/scripts/save-template.ts and
 * share-template.ts, so cards work with or without an island around them.
 */
import Avatar from './Avatar';
import TemplateCover from './TemplateCover';
import { categoryIcon } from '../lib/categories';
import type { Creator } from '../lib/templates';
import { defaultLocale, type Locale } from '../i18n/config';
import { localizePath, useTranslations } from '../i18n';

/** The template fields a card actually paints. */
export interface CardTemplate {
	slug: string;
	title: string;
	description?: string | null;
	category?: string | null;
	cover_image?: string | null;
	collage?: string[];
	times_ranked: number;
	votes?: number;
	creator?: Creator;
	/** Option names, used by /search's client-side filtering. */
	optionNames?: string;
	is_mature?: boolean;
}

export interface TemplateCardProps {
	template: CardTemplate;
	/** Heading level for the card title in the surrounding page outline. */
	headingLevel?: 'h2' | 'h3';
	locale?: Locale;
}

export default function TemplateCard({
	template,
	headingLevel = 'h3',
	locale = defaultLocale,
}: TemplateCardProps) {
	const t = useTranslations(locale);
	const L = (p: string) => localizePath(p, locale);
	const creator = template.creator;
	const Heading = headingLevel;

	return (
		<a
			href={L(`/template/${template.slug}`)}
			class="group flex flex-col h-full rounded-2xl bg-surface-elevated border border-border hover:border-primary/40 transition-all duration-300 overflow-hidden hover:shadow-[0_0_30px_rgba(132,0,255,0.12)]"
		>
			<div class="relative aspect-4/3 overflow-hidden bg-surface">
				<TemplateCover
					cover={template.cover_image ?? null}
					collage={template.collage}
					title={template.title}
					className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
				/>

				{template.category && (
					<span
						class="absolute top-3 left-3 flex items-center justify-center w-8 h-8 rounded-lg bg-black/60 backdrop-blur-sm text-white transition-colors group-hover:bg-primary/80"
						data-rm-tip={t('tooltip.category', {
							category: t(`categories.${template.category}`),
						})}
						data-rm-tip-placement="bottom"
					>
						<i class={`fa-solid ${categoryIcon(template.category)} text-[12px]`} />
					</span>
				)}

				<button
					type="button"
					class="save-btn absolute top-3 right-12 w-8 h-8 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-primary/80 transition-all opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100"
					aria-label={t('card.saveAria')}
					data-save-aria={t('card.saveAria')}
					data-unsave-aria={t('card.unsaveAria')}
					data-save-tip={t('tooltip.save')}
					data-unsave-tip={t('tooltip.unsave')}
					data-rm-tip={t('tooltip.save')}
					data-rm-tip-placement="bottom"
					data-slug={template.slug}
				>
					<i class="fa-regular fa-bookmark text-xs" />
				</button>
				<button
					type="button"
					class="share-btn absolute top-3 right-3 w-8 h-8 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-primary/80 transition-all opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100"
					aria-label={t('card.shareAria')}
					data-rm-tip={t('tooltip.shareTemplate')}
					data-rm-tip-placement="bottom"
					data-title={template.title}
					data-slug={template.slug}
				>
					<i class="fa-solid fa-share-nodes text-xs" />
				</button>
			</div>

			<div class="flex-1 p-4 space-y-2">
				<Heading class="font-semibold text-sm text-text-primary leading-tight line-clamp-1 group-hover:text-white transition-colors">
					{template.title}
				</Heading>

				{creator && (
					// The card itself is an <a>, so the creator "link" is a span
					// handled by the global [data-profile-href] click delegate.
					<span
						class="creator-link inline-flex items-center gap-1.5 cursor-pointer"
						data-profile-href={L(`/u/${encodeURIComponent(creator.username)}`)}
						data-rm-tip={t('tooltip.viewProfile', { username: creator.username })}
					>
						<Avatar
							avatar={creator.avatar}
							size="sm"
							verified={creator.isVerified}
							locale={locale}
						/>
						<span class="text-xs text-text-muted font-medium hover:text-text-primary transition-colors">
							@{creator.username}
						</span>
					</span>
				)}

				{template.description && (
					<p class="text-xs text-text-muted leading-relaxed line-clamp-2">
						{template.description}
					</p>
				)}

				<div class="flex items-center gap-3 pt-1">
					<span class="inline-flex items-center gap-1.5" data-rm-tip={t('tooltip.timesRanked')}>
						<i class="fa-solid fa-fire text-[10px] text-primary/70" />
						<span
							class="text-xs text-text-muted font-medium"
							data-count-slug={template.slug}
						>
							{t('card.ranked', { n: template.times_ranked.toLocaleString() })}
						</span>
					</span>
					<span class="inline-flex items-center gap-1.5" data-rm-tip={t('tooltip.votes')}>
						<i class="fa-solid fa-arrow-up text-[10px] text-primary/70" />
						<span class="text-xs text-text-muted font-medium" data-vote-slug={template.slug}>
							{t('card.votes', { n: (template.votes ?? 0).toLocaleString() })}
						</span>
					</span>
				</div>
			</div>
		</a>
	);
}
