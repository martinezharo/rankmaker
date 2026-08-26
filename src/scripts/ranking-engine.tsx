/**
 * Client controller for both ranking surfaces.
 *
 * RankingSession owns every comparison decision. Preact owns the battle and
 * dynamic result markup. This file is deliberately limited to integration
 * with the server-rendered shell: persistence, modals, sharing, SortableJS and
 * the detail-page option controls.
 */
import { render } from 'preact';
import BattleView from '../components/ranking/BattleView';
import Podium from '../components/ranking/Podium';
import ResultsList from '../components/ranking/ResultsList';
import {
	RankingSession,
	type BattleRecord,
	type RankingItem,
	type SessionState,
} from '../lib/ranking-session';
import { parseBattleHistory } from '../lib/battle-history';
import type { RankingData } from '../lib/ranking-data';
import { downloadRankingImage } from './ranking-share-image';
import { createReorder, type ReorderController } from './ranking-reorder';
import { openModal, closeModal } from './modal-a11y';
import {
	consumeForceFresh,
	consumePendingResult,
	getExcludedIds,
	getLocalResult,
	recordStart,
	saveHistoryEntry,
	saveResult,
	setExcludedIds,
	syncResultToAccount,
	type HistoryEntry,
} from './history';
import { clientT } from '../i18n/client';

const clearSavedResultGuard = () =>
	document.documentElement.classList.remove('rm-saved-result');

let disposeCurrent: (() => void) | null = null;

function element<T extends HTMLElement>(id: string): T | null {
	return document.getElementById(id) as T | null;
}

function normalizeItems(data: RankingData): RankingItem[] {
	return data.options
		.map((item) => ({
			id: Number(item.id),
			name: String(item.name),
			image: item.image ? String(item.image) : null,
		}))
		.filter((item) => Number.isFinite(item.id) && item.name.length > 0);
}

function restoredItems(value: unknown): RankingItem[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => {
			if (typeof item !== 'object' || item === null) return null;
			const record = item as Record<string, unknown>;
			const id = Number(record.id);
			if (!Number.isFinite(id) || typeof record.name !== 'string') return null;
			return {
				id,
				name: record.name,
				image: typeof record.image === 'string' ? record.image : null,
			};
		})
		.filter((item): item is RankingItem => item !== null);
}

export function rankingInit(): void {
	disposeCurrent?.();
	disposeCurrent = null;

	const dataElement = element<HTMLScriptElement>('ranking-data');
	const battleRoot = element<HTMLElement>('ranking-battle-root');
	const podiumRoot = element<HTMLElement>('results-podium-root');
	const listRoot = element<HTMLElement>('results-list-root');
	const detailView = element<HTMLElement>('detail-view');
	const resultsView = element<HTMLElement>('results-view');
	const startButton = element<HTMLButtonElement>('start-ranking-btn');
	const startCta = element<HTMLElement>('start-ranking-cta');
	if (
		!dataElement ||
		!battleRoot ||
		!podiumRoot ||
		!listRoot ||
		!detailView ||
		!resultsView ||
		!startButton ||
		!startCta
	) {
		clearSavedResultGuard();
		return;
	}
	// Stable non-null aliases: these nodes belong to the current Astro document
	// and remain valid until disposeCurrent runs on the next page swap.
	const battleContainer = battleRoot;
	const podiumContainer = podiumRoot;
	const listContainer = listRoot;
	const detailContainer = detailView;
	const resultsContainer = resultsView;
	const startControl = startButton;
	const ctaContainer = startCta;

	let data: RankingData;
	try {
		data = JSON.parse(dataElement.textContent ?? '') as RankingData;
	} catch {
		clearSavedResultGuard();
		return;
	}
	const items = normalizeItems(data);
	if (!data.slug || items.length < 2) {
		clearSavedResultGuard();
		return;
	}

	const abort = new AbortController();
	const listen = <K extends keyof HTMLElementEventMap>(
		target: HTMLElement | Document,
		type: K,
		listener: (event: HTMLElementEventMap[K]) => void
	) => target.addEventListener(type, listener as EventListener, { signal: abort.signal });
	const t = clientT();
	let reorder: ReorderController | null = null;
	let reorderMode = false;
	let lastRanked: RankingItem[] = [];
	let lastHistory: readonly BattleRecord[] = [];
	let pendingRemove: RankingItem | null = null;
	let resultTransitioning = false;
	let previousPhase: SessionState['phase'] = 'idle';
	let resultTimer: ReturnType<typeof setTimeout> | null = null;

	const finishModal = element<HTMLElement>('finish-early-modal');
	const finishCancel = element<HTMLButtonElement>('finish-cancel-btn');
	const finishConfirm = element<HTMLButtonElement>('finish-confirm-btn');
	const finishBackdrop = element<HTMLElement>('finish-modal-backdrop');
	const removeModal = element<HTMLElement>('remove-option-modal');
	const removeBody = element<HTMLElement>('remove-option-body');
	const removeCancel = element<HTMLButtonElement>('remove-cancel-btn');
	const removeConfirm = element<HTMLButtonElement>('remove-confirm-btn');
	const removeBackdrop = element<HTMLElement>('remove-modal-backdrop');
	const historyModal = element<HTMLElement>('history-modal');
	const historyList = element<HTMLElement>('history-list');
	const historyClose = element<HTMLButtonElement>('history-close-btn');
	const historyBackdrop = element<HTMLElement>('history-modal-backdrop');
	const transitionOverlay = element<HTMLElement>('transition-overlay');

	function persistResult(ranked: readonly RankingItem[]): void {
		const result = ranked.map((item) => ({
			id: item.id,
			name: item.name,
			image: item.image ?? '',
		}));
		const localEntry = saveResult(
			data.slug,
			data.title,
			result,
			data.cover,
			{
				version: 1,
				decisions: lastHistory.map((battle) => [
					battle.a.id,
					battle.b.id,
					battle.winner.id === battle.a.id ? 0 : 1,
				]),
			}
		);
		if (!localEntry) return;
		void syncResultToAccount(localEntry).then((synced) => {
			if (!synced) return;
			document.dispatchEvent(
				new CustomEvent('rankmaker:ranking-saved', {
					detail: { slug: data.slug },
				})
			);
		});
	}

	function renderResults(ranked: readonly RankingItem[], animate = true): void {
		lastRanked = [...ranked];
		render(<Podium ranked={lastRanked} t={t} animate={animate} />, podiumContainer);
		render(
			<ResultsList
				ranked={lastRanked}
				reordering={reorderMode}
				animate={animate && !reorderMode}
			/>,
			listContainer
		);
		setupReorder();
	}

	function showResults(ranked: readonly RankingItem[], persist: boolean): void {
		if (resultTransitioning) return;
		resultTransitioning = true;
		if (transitionOverlay) {
			transitionOverlay.classList.remove('hidden');
			transitionOverlay.replaceChildren();
			const flash = document.createElement('div');
			flash.className = 'flash animate-flash';
			transitionOverlay.append(flash);
			for (let index = 0; index < 12; index++) {
				const angle = (index / 12) * Math.PI * 2;
				const distance = 80 + Math.random() * 120;
				const particle = document.createElement('div');
				particle.className = 'particle';
				particle.style.left = `calc(50% + ${Math.cos(angle) * distance}px)`;
				particle.style.top = `calc(50% + ${Math.sin(angle) * distance}px)`;
				particle.style.background =
					Math.random() > 0.5 ? 'rgba(132, 0, 255, 0.8)' : 'rgba(255, 215, 0, 0.8)';
				particle.style.animation = `particleGlow 0.8s ${Math.random() * 0.3}s ease-out both`;
				transitionOverlay.append(particle);
			}
		}
		resultTimer = setTimeout(() => {
			render(null, battleContainer);
			transitionOverlay?.classList.add('hidden');
			resultsContainer.classList.remove('hidden');
			window.scrollTo({ top: 0, behavior: 'smooth' });
			renderResults(ranked);
			if (persist) persistResult(ranked);
			resultTransitioning = false;
		}, 900);
	}

	function requestFinishEarly(): void {
		if (finishModal && finishCancel) openModal(finishModal, { focus: finishCancel });
	}

	function requestRemove(item: RankingItem): void {
		if (session.atMinimum || !removeModal || !removeCancel) return;
		pendingRemove = item;
		if (removeBody) {
			removeBody.textContent = t('ranking.removeModalBody', { name: item.name });
		}
		openModal(removeModal, { focus: removeCancel });
	}

	function enterFinalRound(count: number): Promise<void> {
		return new Promise((resolve) => {
			const banner = document.createElement('div');
			banner.className = 'final-round-banner';
			banner.setAttribute('role', 'status');
			banner.setAttribute('aria-live', 'polite');
			const icon = document.createElement('i');
			icon.className = 'fa-solid fa-bolt';
			banner.append(icon, ` ${t(count === 1 ? 'ranking.suddenDeathOne' : 'ranking.suddenDeath', { count })}`);
			element<HTMLElement>('battle-view')?.append(banner);
			setTimeout(() => {
				banner.classList.add('final-round-banner-out');
				setTimeout(() => {
					banner.remove();
					resolve();
				}, 360);
			}, 1150);
		});
	}

	const session = new RankingSession(items, {
		onChange: (state: SessionState) => {
			const justFinished = previousPhase === 'battling' && state.phase === 'results';
			previousPhase = state.phase;
			lastHistory = state.history;
			refreshOptionCards(state);
			if (state.phase === 'battling') {
				resultsContainer.classList.add('hidden');
				render(
					<BattleView
						state={state}
						title={data.title}
						t={t}
						atMinimum={session.atMinimum}
						onPick={(side) => session.pick(side)}
						onSkip={() => session.skip()}
						onUndo={() => session.undo()}
						onFinishEarly={requestFinishEarly}
						onRemove={requestRemove}
					/>,
					battleContainer
				);
			}
			if (justFinished && state.ranked) {
				showResults(state.ranked, true);
			}
		},
		onFinalRound: enterFinalRound,
		onExcludedChange: (excluded) => setExcludedIds(data.slug, excluded),
	});

	function refreshOptionCards(state = session.state): void {
		const atMinimum = session.atMinimum;
		for (const card of document.querySelectorAll<HTMLElement>('[data-option-card]')) {
			const id = String(card.dataset.optionCard);
			const excluded = state.excluded.has(id);
			card.querySelector('.option-media')?.classList.toggle('grayscale', excluded);
			card.querySelector('.option-media')?.classList.toggle('opacity-40', excluded);
			const badge = card.querySelector<HTMLElement>('.option-removed-badge');
			badge?.classList.toggle('hidden', !excluded);
			badge?.classList.toggle('flex', excluded);
			card.querySelector('.option-name')?.classList.toggle('opacity-50', excluded);
			const button = card.querySelector<HTMLButtonElement>('[data-remove-option]');
			if (!button) continue;
			const icon = button.querySelector('i');
			if (icon) {
				icon.className = excluded
					? 'fa-solid fa-rotate-left text-xs'
					: 'fa-solid fa-trash-can text-xs';
			}
			button.classList.toggle('hover:bg-red-500', !excluded);
			button.classList.toggle('hover:bg-emerald-500', excluded);
			button.setAttribute('aria-disabled', String(atMinimum && !excluded));
			button.setAttribute(
				'aria-label',
				t(excluded ? 'ranking.restoreOptionAria' : 'ranking.removeOptionAria', {
					name: button.dataset.optionName ?? '',
				})
			);
			button.dataset.rmTip = atMinimum && !excluded
				? t('ranking.removeMinNotice')
				: t(excluded ? 'tooltip.restoreOption' : 'tooltip.removeOption');
		}
	}

	for (const button of document.querySelectorAll<HTMLButtonElement>('[data-remove-option]')) {
		listen(button, 'click', () => {
			if (button.getAttribute('aria-disabled') === 'true') return;
			const id = Number(button.dataset.removeOption);
			if (!Number.isFinite(id)) return;
			if (session.state.excluded.has(String(id))) session.restore(id);
			else session.exclude(id);
		});
	}

	session.adoptExcluded(getExcludedIds(data.slug).map(String));

	listen(startControl, 'click', () => {
		void fetch('/api/track', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: window.location.href, date: new Date().toISOString() }),
		}).catch(() => undefined);
		recordStart(data.slug);
		detailContainer.classList.add('hidden');
		ctaContainer.classList.add('hidden');
		resultsContainer.classList.add('hidden');
		window.scrollTo({ top: 0, behavior: 'smooth' });
		session.start();
	});

	if (finishCancel && finishModal) {
		listen(finishCancel, 'click', () => closeModal(finishModal));
	}
	if (finishBackdrop && finishModal) {
		listen(finishBackdrop, 'click', () => closeModal(finishModal));
	}
	if (finishConfirm && finishModal) {
		listen(finishConfirm, 'click', () => {
			closeModal(finishModal);
			session.finishEarly();
		});
	}
	if (removeCancel && removeModal) {
		listen(removeCancel, 'click', () => {
			pendingRemove = null;
			closeModal(removeModal);
		});
	}
	if (removeBackdrop && removeModal) {
		listen(removeBackdrop, 'click', () => {
			pendingRemove = null;
			closeModal(removeModal);
		});
	}
	if (removeConfirm && removeModal) {
		listen(removeConfirm, 'click', () => {
			closeModal(removeModal);
			const item = pendingRemove;
			pendingRemove = null;
			if (item) session.exclude(item.id);
		});
	}

	const actionHistory = element<HTMLButtonElement>('action-history');
	if (actionHistory && historyModal && historyClose && historyList) {
		listen(actionHistory, 'click', () => {
			render(
				lastHistory.length === 0 ? (
					<p class="text-sm text-text-muted text-center py-6">
						{t('ranking.noBattlesRecorded')}
					</p>
				) : (
					<>
						{lastHistory.map((battle, index) => {
							const aWon = battle.winner.id === battle.a.id;
							return (
								<div key={`${battle.a.id}-${battle.b.id}-${index}`} class="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border">
									<span class="text-xs text-text-muted font-mono w-6 shrink-0">{index + 1}.</span>
									<div class="flex items-center gap-2 flex-1 min-w-0">
										<div class={`flex items-center gap-2 ${aWon ? 'opacity-100' : 'opacity-40'} flex-1 min-w-0`}>
											{battle.a.image && <img src={battle.a.image} alt="" class={`w-7 h-7 rounded-md object-cover shrink-0 ${aWon ? 'ring-2 ring-primary/60' : ''}`} />}
											<span class="text-xs font-medium text-text-primary truncate">{battle.a.name}</span>
										</div>
										<span class="text-[10px] text-text-muted font-bold shrink-0 mx-1">{t('ranking.vs')}</span>
										<div class={`flex items-center gap-2 ${aWon ? 'opacity-40' : 'opacity-100'} flex-1 min-w-0 justify-end`}>
											<span class="text-xs font-medium text-text-primary truncate">{battle.b.name}</span>
											{battle.b.image && <img src={battle.b.image} alt="" class={`w-7 h-7 rounded-md object-cover shrink-0 ${!aWon ? 'ring-2 ring-primary/60' : ''}`} />}
										</div>
									</div>
								</div>
							);
						})}
					</>
				),
				historyList
			);
			openModal(historyModal, { focus: historyClose });
		});
		listen(historyClose, 'click', () => closeModal(historyModal));
		if (historyBackdrop) listen(historyBackdrop, 'click', () => closeModal(historyModal));
	}

	const downloadButton = element<HTMLButtonElement>('action-download-image');
	if (downloadButton) {
		listen(downloadButton, 'click', async () => {
			if (downloadButton.dataset.busy) return;
			downloadButton.dataset.busy = '1';
			downloadButton.setAttribute('aria-busy', 'true');
			const original = downloadButton.innerHTML;
			downloadButton.replaceChildren();
			const spinner = document.createElement('i');
			spinner.className = 'fa-solid fa-spinner btn-spinner text-xs text-primary/70';
			downloadButton.append(spinner, t('ranking.generating'));
			try {
				await downloadRankingImage(lastRanked, data.title || t('ranking.myRanking'), {
					results: t('ranking.results').toUpperCase(),
					fullRanking: t('ranking.fullRanking'),
					madeWith: t('ranking.shareImgMadeWith'),
					podium: [
						t('ranking.podium1').toUpperCase(),
						t('ranking.podium2').toUpperCase(),
						t('ranking.podium3').toUpperCase(),
					],
				});
			} finally {
				downloadButton.innerHTML = original;
				downloadButton.removeAttribute('aria-busy');
				delete downloadButton.dataset.busy;
			}
		});
	}

	const actionReorder = element<HTMLButtonElement>('action-reorder');
	function updateReorderControl(): void {
		if (!actionReorder) return;
		actionReorder.classList.toggle('!border-primary/60', reorderMode);
		actionReorder.classList.toggle('!text-primary', reorderMode);
		actionReorder.classList.toggle('!bg-primary/10', reorderMode);
		const icon = actionReorder.querySelector('i');
		if (icon) {
			icon.className = reorderMode
				? 'fa-solid fa-check text-xs text-primary'
				: 'fa-solid fa-arrows-up-down text-xs text-primary/70';
		}
		const label = element<HTMLElement>('action-reorder-label');
		if (label) {
			label.textContent = t(
				reorderMode ? 'ranking.doneReordering' : 'ranking.reorderManually'
			);
		}
	}
	function setupReorder(): void {
		reorder?.destroy();
		const resultList = element<HTMLElement>('results-list');
		if (!resultList) return;
		reorder = createReorder(resultList, {
			onEnd: (orderedIds) => {
				const byId = new Map(lastRanked.map((item) => [String(item.id), item]));
				lastRanked = orderedIds
					.map((id) => byId.get(id))
					.filter((item): item is RankingItem => item !== undefined);
				renderResults(lastRanked, false);
				persistResult(lastRanked);
			},
		});
		reorder.setEnabled(reorderMode);
	}
	if (actionReorder) {
		listen(actionReorder, 'click', () => {
			reorderMode = !reorderMode;
			updateReorderControl();
			renderResults(lastRanked, false);
		});
	}

	const actionRankAgain = element<HTMLButtonElement>('action-rank-again');
	if (actionRankAgain) {
		listen(actionRankAgain, 'click', () => {
			reorderMode = false;
			reorder?.setEnabled(false);
			updateReorderControl();
			resultsContainer.classList.add('hidden');
			render(null, battleContainer);
			detailContainer.classList.remove('hidden');
			ctaContainer.classList.remove('hidden');
			window.scrollTo({ top: 0, behavior: 'smooth' });
		});
	}

	const actionShareTemplate = element<HTMLButtonElement>('action-share-template');
	if (actionShareTemplate) {
		listen(actionShareTemplate, 'click', async () => {
			const title = data.title || t('ranking.myRanking');
			if (navigator.share) {
				try {
					await navigator.share({ title: t('card.shareTitle', { title }), url: window.location.href });
				} catch {
					/* The native sheet can be dismissed. */
				}
				return;
			}
			try {
				await navigator.clipboard.writeText(window.location.href);
				const icon = actionShareTemplate.querySelector('i');
				if (icon) {
					icon.className = 'fa-solid fa-check text-xs text-emerald-500';
					setTimeout(() => {
						icon.className = 'fa-solid fa-share-nodes text-xs text-primary/70';
					}, 2000);
				}
			} catch {
				/* Clipboard can be unavailable outside a secure context. */
			}
		});
	}
	const actionShareX = element<HTMLButtonElement>('action-share-x');
	if (actionShareX) {
		listen(actionShareX, 'click', () => {
			const title = data.title || t('ranking.myRanking');
			const text = t('ranking.shareXText', { title });
			window.open(
				`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`,
				'_blank',
				'noopener'
			);
		});
	}

	function restoreHistory(entry: HistoryEntry): BattleRecord[] {
		const stored = parseBattleHistory(entry.battles);
		if (!stored) return [];
		const byId = new Map(items.map((item) => [String(item.id), item]));
		for (const item of restoredItems(entry.result)) byId.set(String(item.id), item);
		const history: BattleRecord[] = [];
		for (const [leftId, rightId, winnerSide] of stored.decisions) {
			const a = byId.get(String(leftId));
			const b = byId.get(String(rightId));
			if (!a || !b) continue;
			history.push({ a, b, winner: winnerSide === 0 ? a : b, roundNum: history.length + 1 });
		}
		return history;
	}

	function showSavedResult(entry: HistoryEntry): void {
		const ranked = restoredItems(entry.result);
		if (ranked.length < 2) return;
		lastHistory = restoreHistory(entry);
		detailContainer.classList.add('hidden');
		ctaContainer.classList.add('hidden');
		resultsContainer.classList.remove('hidden');
		renderResults(ranked);
	}

	let local: HistoryEntry | null = null;
	if (!consumeForceFresh(data.slug)) {
		const pending = consumePendingResult(data.slug);
		local = getLocalResult(data.slug);
		if (pending?.result) showSavedResult(pending);
		else if (local?.result) showSavedResult(local);
	}
	void fetch(`/api/me/history?slug=${encodeURIComponent(data.slug)}`, {
		headers: { Accept: 'application/json' },
	})
		.then((response) => (response.ok ? response.json() : null))
		.then((payload: { entry?: HistoryEntry } | null) => {
			const remote = payload?.entry;
			if (!remote?.result) return;
			if (local && local.ts > remote.ts) void syncResultToAccount(local);
			else saveHistoryEntry(remote);
		})
		.catch(() => undefined);

	clearSavedResultGuard();
	disposeCurrent = () => {
		abort.abort();
		reorder?.destroy();
		if (resultTimer) clearTimeout(resultTimer);
		render(null, battleContainer);
		render(null, podiumContainer);
		render(null, listContainer);
	};
}
