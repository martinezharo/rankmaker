// @ts-nocheck — legacy client-side controller (untyped DOM glue), extracted
// verbatim from src/pages/template/[slug].astro so more than one page can
// drive the same ranking surface (the DB-backed template page and the
// guest-local template page). It is deliberately source-agnostic: everything
// it needs — slug, title, cover and options — comes from the `#ranking-data`
// JSON element in the current DOM, so any page that renders the ranking
// surface (see src/components/ranking/RankingSurface.astro) and fills that
// element can call `rankingInit()`.
//
// The build transpiles without type-checking; bundling surfaced strict-mode
// noise (implicit any, possibly-null getElementById). Extracted logic in
// src/scripts/*.ts stays fully typed and checked.
//
// Pages wire it to `astro:page-load` themselves: the handler re-queries the
// DOM each time, so no listener-stacking guard is needed.
import {
    getKnownResult,
    recordResult,
    mergeSort,
    compKey,
} from "./ranking-sort";
import { downloadRankingImage } from "./ranking-share-image";
import { createReorder } from "./ranking-reorder";
import { openModal, closeModal } from "./modal-a11y";
import { parseBattleHistory } from "../lib/battle-history";
import {
    recordStart,
    saveResult,
    saveHistoryEntry,
    syncResultToAccount,
    getLocalResult,
    consumePendingResult,
    consumeForceFresh,
    getExcludedIds,
    setExcludedIds,
} from "./history";
import { clientT } from "../i18n/client";

// Undo the pre-paint guard set by the inline script near the top of
// the page (it hides detail view + START CTA before first paint when
// a saved result exists). Called once the real `hidden` classes
// reflect the landing decision — and on every early bail-out, so the
// guard can never strand the page with the detail view hidden.
const clearSavedResultGuard = () =>
    document.documentElement.classList.remove("rm-saved-result");

export function rankingInit() {
    const t = clientT();
    // Read options + title from the JSON data element in the current
    // (swapped) DOM, so they can never lag behind the page on screen.
    const dataEl = document.getElementById("ranking-data");
    if (!dataEl) {
        clearSavedResultGuard();
        return;
    }
    let rankingData;
    try {
        rankingData = JSON.parse(dataEl.textContent);
    } catch {
        clearSavedResultGuard();
        return;
    }
    const items = rankingData.options;
    const templateTitle = rankingData.title;
    const templateSlug = rankingData.slug;
    const templateCover = rankingData.cover || "";
    if (!items || items.length < 2) {
        clearSavedResultGuard();
        return;
    }

    // ─── Removed options (persisted per template) ────
    // The user can exclude options they don't care about; the set lives
    // in localStorage because this page is publicly cached (same reason
    // the played-templates filter is client-side). Ids are compared as
    // strings so number/string ids round-trip safely through storage.
    let excludedIds = new Set(
        getExcludedIds(templateSlug).map(String),
    );
    const activeItems = () =>
        items.filter((it) => !excludedIds.has(String(it.id)));
    // Stale exclusions (e.g. the template's options changed) must never
    // leave fewer than 2 rankable options — reset rather than strand.
    if (activeItems().length < 2) {
        excludedIds = new Set();
        setExcludedIds(templateSlug, []);
    }

    // Persist a completed result: localStorage for everyone (anonymous
    // history + instant same-device recommendation filtering) and, for
    // logged-in users, D1 via /api/me/history (the endpoint no-ops for
    // anonymous visitors, so we can POST unconditionally).
    function persistResult(ranked) {
        if (!templateSlug || !ranked || ranked.length === 0) return;
        const result = ranked.map((it) => ({
            id: it.id,
            name: it.name,
            image: it.image,
        }));
        const localEntry = saveResult(
            templateSlug,
            templateTitle,
            result,
            templateCover,
            {
                version: 1,
                decisions: battleHistory.map((battle) => [
                    battle.a.id,
                    battle.b.id,
                    battle.winner.id === battle.a.id ? 0 : 1,
                ]),
            },
        );
        if (!localEntry) return;
        // Tell the comments thread to refresh once the result is saved:
        // the author's ranking badge is resolved live from ranking_results,
        // so it can now appear on their comments without a page reload.
        const notify = () =>
            document.dispatchEvent(
                new CustomEvent("rankmaker:ranking-saved", {
                    detail: { slug: templateSlug },
                }),
            );
        // Explicitly track the request and only announce a saved ranking
        // after D1 accepted it. The helper uses keepalive and retains the
        // local copy for a later retry if the request fails.
        void syncResultToAccount(localEntry).then((synced) => {
            if (synced) notify();
        });
    }

    // ─── DOM refs ────────────────────────────────────
    const detailView = document.getElementById("detail-view");
    const battleView = document.getElementById("battle-view");
    const resultsView = document.getElementById("results-view");
    const startBtn = document.getElementById("start-ranking-btn");
    const startCta = document.getElementById("start-ranking-cta");
    const progressEl = document.getElementById("battle-progress");
    const progressBar = document.getElementById("battle-progress-bar");
    const undoBtn = document.getElementById("battle-undo-btn");
    const skipBtn = document.getElementById("battle-skip-btn");
    const skippedCountEl = document.getElementById(
        "battle-skipped-count",
    );
    const battleHint = document.getElementById("battle-hint");
    const actionShareTemplate = document.getElementById(
        "action-share-template",
    );
    const actionShareX = document.getElementById("action-share-x");
    const finishBtn = document.getElementById("battle-finish-btn");
    const cardA = document.getElementById("battle-card-a");
    const cardB = document.getElementById("battle-card-b");
    const imgA = document.getElementById("battle-img-a");
    const imgB = document.getElementById("battle-img-b");
    const fallbackA = document.getElementById("battle-fallback-a");
    const fallbackB = document.getElementById("battle-fallback-b");
    const fallbackTextA = document.getElementById(
        "battle-fallback-text-a",
    );
    const fallbackTextB = document.getElementById(
        "battle-fallback-text-b",
    );
    const nameA = document.getElementById("battle-name-a");
    const nameB = document.getElementById("battle-name-b");
    const finishModal = document.getElementById("finish-early-modal");
    const finishCancel = document.getElementById("finish-cancel-btn");
    const finishConfirm = document.getElementById("finish-confirm-btn");
    const transitionOvl = document.getElementById("transition-overlay");
    const podiumEl = document.getElementById("results-podium");
    const rankListEl = document.getElementById("results-list");
    const historyModal = document.getElementById("history-modal");
    const historyBackdrop = document.getElementById(
        "history-modal-backdrop",
    );
    const historyList = document.getElementById("history-list");
    const historyClose = document.getElementById("history-close-btn");
    const actionHistory = document.getElementById("action-history");
    const actionRankAgain =
        document.getElementById("action-rank-again");
    const removeModal = document.getElementById("remove-option-modal");
    const removeBody = document.getElementById("remove-option-body");
    const removeCancel = document.getElementById("remove-cancel-btn");
    const removeConfirm =
        document.getElementById("remove-confirm-btn");
    const removeBackdrop = document.getElementById(
        "remove-modal-backdrop",
    );
    const battleRemoveA = document.getElementById("battle-remove-a");
    const battleRemoveB = document.getElementById("battle-remove-b");

    // ─── Merge Sort with Human Input & Transitive Inference ──
    // comparisonMap: key "idA-idB" => 1 (A wins) or -1 (B wins)
    let comparisonMap = {};
    const itemIds = items.map((i) => i.id);
    let battleHistory = []; // {a, b, winner, roundNum}
    let undoStack = []; // snapshots for undo
    let currentRound = 0;
    let totalEstimate = 0;
    let sortResolve = null; // resolve function for current comparison promise
    let isProcessing = false; // prevent double-clicks
    let lastRanked = []; // stores the final ranking for download image
    // Pairs the user deferred ("skip for later"): compKey -> {aItem,bItem}.
    // Resolved provisionally (keep order) WITHOUT touching comparisonMap, so
    // they never pollute transitive inference. Re-asked in a forced final
    // round (see runSort reconciliation) unless transitivity settled them.
    let skipped = {};
    let skipAllowed = true; // false during the forced final round

    // Escape user-provided strings before innerHTML interpolation
    // (option names/images can come from user-created templates).
    const esc = (s) =>
        String(s).replace(
            /[&<>"']/g,
            (c) =>
                ({
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;",
                })[c],
        );

    // Generate a consistent color based on the text string (Client-side version)
    const stringToColor = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const c = (hash & 0x00ffffff).toString(16).toUpperCase();
        return "#" + "00000".substring(0, 6 - c.length) + c;
    };

    // ─── Rank position badge (shared by render + reorder) ──────
    // Big, left-aligned position number. The podium top-3 get a
    // minted gold/silver/bronze medallion (see .medal-* in global.css).
    const posLabel = (i) => `${i + 1}`;
    const posClasses = (i) =>
        i === 0
            ? "medal-gold text-xl font-black"
            : i === 1
              ? "medal-silver text-xl font-black"
              : i === 2
                ? "medal-bronze text-xl font-black"
                : "bg-border/60 text-text-muted text-lg font-black";
    const POS_BASE =
        "rank-pos flex items-center justify-center w-12 h-12 rounded-xl shrink-0";

    function setupImage(img, fallback, fallbackText, item) {
        // Reset state
        img.style.display = "block";
        fallback.classList.add("hidden");
        fallback.classList.remove("flex");

        // Set content
        fallbackText.textContent = item.name;
        const color = stringToColor(item.name);
        fallback.style.setProperty("--tw-gradient-to", color + "40"); // 40 is hex opacity

        // Check for explicit "null" or placehold.co (our old placeholder)
        // If it's the old placeholder, force fallback immediately
        const isPlaceholder =
            !item.image ||
            item.image.includes("placehold.co") ||
            item.image === "null";

        if (isPlaceholder) {
            img.style.display = "none";
            fallback.classList.remove("hidden");
            fallback.classList.add("flex");
        } else {
            img.src = item.image;
            img.alt = item.name;
            img.onerror = () => {
                img.style.display = "none";
                fallback.classList.remove("hidden");
                fallback.classList.add("flex");
            };
        }
    }

    // Comparison bookkeeping + transitive inference + the generic merge
    // sort live in src/scripts/ranking-sort.ts (unit-tested). This is the
    // human-input bridge: it resolves a pair from the known results, or
    // shows the battle and waits for a click. `generation` rejects a
    // pending comparison when the user restarts mid-sort.
    function compare(aItem, bItem, generation) {
        const known = getKnownResult(comparisonMap, aItem.id, bItem.id);
        if (known !== 0) {
            return Promise.resolve(known > 0 ? -1 : 1); // -1 = a first (wins)
        }
        // Need human input
        currentRound++;
        updateProgress();
        return new Promise((resolve, reject) => {
            // If this sort run was cancelled, reject immediately
            if (generation !== sortGeneration) {
                return reject(new Error("cancelled"));
            }
            sortResolve = resolve;
            showBattle(aItem, bItem);
        });
    }

    // ─── Skip bookkeeping ────────────────────────────
    // A skipped pair is "settled" once transitivity from real picks has
    // since determined it — those never need re-asking (the opportunistic
    // win). The rest come back in the forced final round.
    function isSkipSettled(key) {
        const [a, b] = key.split("-").map(Number);
        return getKnownResult(comparisonMap, a, b) !== 0;
    }
    function pendingSkipKeys() {
        return Object.keys(skipped).filter((k) => !isSkipSettled(k));
    }

    // ─── Progress ────────────────────────────────────
    function updateProgress() {
        // Skipped pairs are comparisons the sort already counted in the
        // estimate, so they don't inflate the denominator — currentRound
        // only counts real decisions (skips decrement it back out). The
        // max() guards the rare case where deferring causes the forced
        // final round to need a few extra duels, so the text never reads
        // "Round 18 of ~17".
        const denom = Math.max(totalEstimate, currentRound);
        const pct = Math.min(
            100,
            Math.round((currentRound / denom) * 100),
        );
        if (progressEl)
            progressEl.textContent = t("ranking.roundProgress", {
                current: currentRound,
                total: denom,
            });
        if (progressBar) progressBar.style.width = `${pct}%`;
        if (skippedCountEl) {
            const pending = pendingSkipKeys().length;
            if (pending > 0) {
                skippedCountEl.textContent = t("ranking.skippedCount", {
                    n: pending,
                });
                skippedCountEl.classList.remove("hidden");
            } else {
                skippedCountEl.classList.add("hidden");
            }
        }
    }

    // Toggle the forced final-round look: hide skip, intensify the UI red.
    function setFinalRoundUI(active) {
        if (skipBtn) skipBtn.classList.toggle("hidden", active);
        if (battleView) battleView.classList.toggle("final-round", active);
        if (battleHint)
            battleHint.textContent = active
                ? t("ranking.noSkipping")
                : t("ranking.tapPreferred");
    }

    // ─── Show Battle ─────────────────────────────────
    function showBattle(a, b) {
        // Set content with smart fallback logic
        setupImage(imgA, fallbackA, fallbackTextA, a);
        setupImage(imgB, fallbackB, fallbackTextB, b);

        nameA.textContent = a.name;
        nameB.textContent = b.name;
        cardA.dataset.itemId = a.id;
        cardB.dataset.itemId = b.id;
        if (battleRemoveA)
            battleRemoveA.setAttribute(
                "aria-label",
                t("ranking.removeOptionAria", { name: a.name }),
            );
        if (battleRemoveB)
            battleRemoveB.setAttribute(
                "aria-label",
                t("ranking.removeOptionAria", { name: b.name }),
            );

        // Reset ALL animation classes (both in & out, both directions)
        const allAnimClasses = [
            "animate-slide-left",
            "animate-slide-right",
            "animate-out-left",
            "animate-out-right",
            "animate-skip-out",
            "battle-card-winner",
        ];
        cardA.classList.remove(...allAnimClasses);
        cardB.classList.remove(...allAnimClasses);
        // Force reflow so the browser restarts the animation
        void cardA.offsetWidth;
        void cardB.offsetWidth;
        cardA.classList.add("animate-slide-left");
        cardB.classList.add("animate-slide-right");

        isProcessing = false;
    }

    // ─── Handle Pick ─────────────────────────────────
    function handlePick(winnerSide) {
        if (isProcessing || !sortResolve) return;
        isProcessing = true;

        const aId = parseInt(cardA.dataset.itemId);
        const bId = parseInt(cardB.dataset.itemId);
        const aItem = items.find((x) => x.id === aId);
        const bItem = items.find((x) => x.id === bId);
        const aWins = winnerSide === "a";

        // Save to undo stack
        undoStack.push({
            comparisonMapSnapshot: { ...comparisonMap },
            battleHistoryLength: battleHistory.length,
            // Store the round *before* this battle was shown. `compare`
            // increments currentRound when it re-shows the undone battle
            // on replay, so storing the post-increment value would drift
            // the counter +1 per undo (and re-introduce >100% overshoot).
            round: currentRound - 1,
            skippedSnapshot: { ...skipped },
        });
        undoBtn.disabled = false;

        // Record
        recordResult(comparisonMap, itemIds, aId, bId, aWins);
        battleHistory.push({
            a: aItem,
            b: bItem,
            winner: aWins ? aItem : bItem,
            roundNum: currentRound,
        });

        // Animate winner glow
        const winCard = aWins ? cardA : cardB;
        const loseCard = aWins ? cardB : cardA;
        winCard.classList.add("battle-card-winner");

        // Short delay for visual feedback, then resolve
        setTimeout(() => {
            cardA.classList.add(
                aWins ? "animate-out-right" : "animate-out-left",
            );
            cardB.classList.add(
                aWins ? "animate-out-left" : "animate-out-right",
            );

            setTimeout(() => {
                const resolve = sortResolve;
                sortResolve = null;
                resolve(aWins ? -1 : 1);
            }, 280);
        }, 300);
    }

    cardA.addEventListener("click", () => handlePick("a"));
    cardB.addEventListener("click", () => handlePick("b"));
    // The cards are role=button divs (a real <button> can't nest the
    // remove control), so Enter/Space must be wired up by hand. Only
    // when the card itself has focus — not the nested remove button.
    const cardKeydown = (side) => (e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handlePick(side);
        }
    };
    cardA.addEventListener("keydown", cardKeydown("a"));
    cardB.addEventListener("keydown", cardKeydown("b"));

    // ─── Remove options from this ranking ────────────
    // Both entry points (detail-grid buttons and the buttons over the
    // battle cards) funnel into the same confirm modal. Removing
    // mid-battle reuses the Undo machinery: cancel the pending
    // comparison and restart the sort — transitive inference replays
    // every answered duel, so the user continues where they were,
    // minus the battles involving the removed option.
    let pendingRemove = null; // item awaiting modal confirmation

    function requestRemove(item) {
        if (!item || activeItems().length <= 2) return;
        pendingRemove = item;
        removeBody.textContent = t("ranking.removeModalBody", {
            name: item.name,
        });
        openModal(removeModal, { focus: removeCancel });
    }

    removeCancel.addEventListener("click", () => {
        pendingRemove = null;
        closeModal(removeModal);
    });
    removeBackdrop.addEventListener("click", () => {
        pendingRemove = null;
        closeModal(removeModal);
    });
    removeConfirm.addEventListener("click", () => {
        closeModal(removeModal);
        const item = pendingRemove;
        pendingRemove = null;
        if (item) excludeOption(item.id);
    });

    function excludeOption(id) {
        excludedIds.add(String(id));
        setExcludedIds(templateSlug, [...excludedIds]);
        // Drop deferred duels involving the removed option so they can
        // never resurface in the forced final round.
        for (const key of Object.keys(skipped)) {
            const [a, b] = key.split("-");
            if (a === String(id) || b === String(id))
                delete skipped[key];
        }
        // Removal is deliberately not undoable via the battle Undo
        // button: restoring a snapshot could resurrect skipped pairs
        // for the removed option. Restore lives in the detail grid.
        undoStack = [];
        undoBtn.disabled = true;
        refreshOptionCards();
        refreshRemoveButtons();
        if (!battleView.classList.contains("hidden")) {
            savedShuffleOrder = savedShuffleOrder.filter(
                (it) => String(it.id) !== String(id),
            );
            const n = savedShuffleOrder.length;
            totalEstimate = Math.ceil(n * Math.log2(n) - n + 1);
            updateProgress();
            // Same pattern as Undo: cancel + re-run, fast-forwarding
            // through everything already answered.
            sortResolve = null;
            restartSort();
        }
    }

    function restoreOption(id) {
        excludedIds.delete(String(id));
        setExcludedIds(templateSlug, [...excludedIds]);
        refreshOptionCards();
        refreshRemoveButtons();
    }

    // Reflect the exclusion set on the detail-grid cards: dim + badge
    // the removed ones and flip their button into a restore control.
    function refreshOptionCards() {
        document
            .querySelectorAll("[data-option-card]")
            .forEach((card) => {
                const excluded = excludedIds.has(
                    String(card.dataset.optionCard),
                );
                const media = card.querySelector(".option-media");
                const badge = card.querySelector(
                    ".option-removed-badge",
                );
                const name = card.querySelector(".option-name");
                const btn = card.querySelector("[data-remove-option]");
                if (media) {
                    media.classList.toggle("grayscale", excluded);
                    media.classList.toggle("opacity-40", excluded);
                }
                if (badge) {
                    badge.classList.toggle("hidden", !excluded);
                    badge.classList.toggle("flex", excluded);
                }
                if (name) name.classList.toggle("opacity-50", excluded);
                if (btn) {
                    const icon = btn.querySelector("i");
                    if (icon)
                        icon.className = excluded
                            ? "fa-solid fa-rotate-left text-xs"
                            : "fa-solid fa-trash-can text-xs";
                    btn.classList.toggle("hover:bg-red-500", !excluded);
                    btn.classList.toggle(
                        "hover:bg-emerald-500",
                        excluded,
                    );
                    btn.setAttribute(
                        "aria-label",
                        t(
                            excluded
                                ? "ranking.restoreOptionAria"
                                : "ranking.removeOptionAria",
                            { name: btn.dataset.optionName || "" },
                        ),
                    );
                }
            });
    }

    // Every remove control carries its own tooltip, so the state and the
    // sentence explaining it are set together.
    //
    // `aria-disabled` rather than `disabled`: a disabled button receives no
    // pointer or focus events, so the tooltip explaining *why* it can't be
    // used would never open on the one control that needs it. The click
    // handlers below check the flag instead.
    function setRemoveState(btn, disabled, tip) {
        btn.setAttribute("aria-disabled", String(disabled));
        btn.dataset.rmTip = disabled ? t("ranking.removeMinNotice") : tip;
    }

    // A ranking needs at least 2 options: at the floor, disable every
    // remove control (restore stays available on excluded cards).
    function refreshRemoveButtons() {
        const atMin = activeItems().length <= 2;
        document
            .querySelectorAll("[data-remove-option]")
            .forEach((btn) => {
                const excluded = excludedIds.has(
                    String(btn.dataset.removeOption),
                );
                setRemoveState(
                    btn,
                    atMin && !excluded,
                    t(
                        excluded
                            ? "tooltip.restoreOption"
                            : "tooltip.removeOption",
                    ),
                );
            });
        [battleRemoveA, battleRemoveB].forEach((btn) => {
            if (!btn) return;
            setRemoveState(btn, atMin, t("tooltip.removeOption"));
        });
    }

    document
        .querySelectorAll("[data-remove-option]")
        .forEach((btn) => {
            btn.addEventListener("click", () => {
                if (btn.getAttribute("aria-disabled") === "true") return;
                const id = btn.dataset.removeOption;
                if (excludedIds.has(String(id))) {
                    restoreOption(id);
                } else if (activeItems().length > 2) {
                    // From the detail grid (pre-battle) we remove
                    // straight away — it's undoable via the restore
                    // control on the card itself, so the confirm
                    // modal is unnecessary noise here. The modal only
                    // guards mid-battle removals.
                    excludeOption(Number(id));
                }
            });
        });

    const battleRemoveHandler = (card) => (e) => {
        // Don't let the click bubble to the card and count as a pick.
        e.stopPropagation();
        if (isProcessing) return;
        if (e.currentTarget.getAttribute("aria-disabled") === "true") return;
        requestRemove(
            items.find((x) => x.id === parseInt(card.dataset.itemId)),
        );
    };
    if (battleRemoveA)
        battleRemoveA.addEventListener(
            "click",
            battleRemoveHandler(cardA),
        );
    if (battleRemoveB)
        battleRemoveB.addEventListener(
            "click",
            battleRemoveHandler(cardB),
        );

    refreshOptionCards();
    refreshRemoveButtons();

    // ─── Skip (defer this duel) ──────────────────────
    // Resolve provisionally (keep order) WITHOUT recording, so merge sort
    // proceeds but transitivity stays clean. The pair is parked in
    // `skipped` and re-surfaces in the forced final round (runSort) unless
    // a later real pick settles it by transitivity.
    function handleSkip() {
        if (isProcessing || !sortResolve || !skipAllowed) return;
        isProcessing = true;

        const aId = parseInt(cardA.dataset.itemId);
        const bId = parseInt(cardB.dataset.itemId);
        const aItem = items.find((x) => x.id === aId);
        const bItem = items.find((x) => x.id === bId);

        // Skipping is undoable too.
        undoStack.push({
            comparisonMapSnapshot: { ...comparisonMap },
            battleHistoryLength: battleHistory.length,
            round: currentRound - 1,
            skippedSnapshot: { ...skipped },
        });
        undoBtn.disabled = false;

        skipped[compKey(aId, bId)] = { aItem, bItem };
        // A skip is not a decision — undo the round bump `compare` made so
        // the progress counter tracks real decisions only.
        currentRound--;
        updateProgress();

        // Neutral exit: both cards drift away together, no winner glow.
        setTimeout(() => {
            cardA.classList.add("animate-skip-out");
            cardB.classList.add("animate-skip-out");
            setTimeout(() => {
                const resolve = sortResolve;
                sortResolve = null;
                resolve(-1); // provisional, unrecorded (keep order)
            }, 260);
        }, 120);
    }

    if (skipBtn) skipBtn.addEventListener("click", handleSkip);

    // ─── Undo ────────────────────────────────────────
    undoBtn.addEventListener("click", () => {
        // Ignore undo while a pick is still animating (isProcessing):
        // sortResolve is still set during the ~580ms window, but a stale
        // setTimeout from the in-flight pick would otherwise resolve the
        // freshly re-shown battle with the old answer.
        if (undoStack.length === 0 || !sortResolve || isProcessing)
            return;

        const snapshot = undoStack.pop();
        comparisonMap = snapshot.comparisonMapSnapshot;
        battleHistory.length = snapshot.battleHistoryLength;
        currentRound = snapshot.round;
        skipped = { ...snapshot.skippedSnapshot };

        if (undoStack.length === 0) undoBtn.disabled = true;

        updateProgress();

        // Cancel the current pending comparison and restart the sort.
        // We keep the restored comparisonMap / battleHistory / undoStack
        // so transitive inference will auto-skip all already-answered battles,
        // effectively fast-forwarding to the battle we just undid.
        sortResolve = null;
        restartSort();
    });

    // ─── Finish Early ─────────────────────────────────
    finishBtn.addEventListener("click", () => {
        openModal(finishModal, { focus: finishCancel });
    });

    finishCancel.addEventListener("click", () => {
        closeModal(finishModal);
    });

    document
        .getElementById("finish-modal-backdrop")
        .addEventListener("click", () => {
            closeModal(finishModal);
        });

    finishConfirm.addEventListener("click", () => {
        closeModal(finishModal);
        finishEarly();
    });

    function finishEarly() {
        // Rank based on win rate from existing comparisons. Only the
        // active options — comparisonMap entries for removed ones are
        // skipped by the `scores[id]` guards below.
        const scores = {};
        const pool = activeItems();
        pool.forEach((item) => {
            scores[item.id] = { wins: 0, total: 0 };
        });

        for (const [key, val] of Object.entries(comparisonMap)) {
            const [idA, idB] = key.split("-").map(Number);
            if (val > 0) {
                // idA wins against idB (since idA < idB by our key convention)
                if (scores[idA]) {
                    scores[idA].wins++;
                    scores[idA].total++;
                }
                if (scores[idB]) {
                    scores[idB].total++;
                }
            } else {
                if (scores[idB]) {
                    scores[idB].wins++;
                    scores[idB].total++;
                }
                if (scores[idA]) {
                    scores[idA].total++;
                }
            }
        }

        const ranked = [...pool].sort((a, b) => {
            const aRate =
                scores[a.id].total > 0
                    ? scores[a.id].wins / scores[a.id].total
                    : 0.5;
            const bRate =
                scores[b.id].total > 0
                    ? scores[b.id].wins / scores[b.id].total
                    : 0.5;
            if (bRate !== aRate) return bRate - aRate;
            return scores[b.id].wins - scores[a.id].wins;
        });

        sortResolve = null;
        showResults(ranked);
    }

    // ─── Start Sort (fresh — resets everything) ─────
    let sortGeneration = 0; // incremented on each restart to cancel old runs
    let savedShuffleOrder = []; // fixed shuffle so undo replays the exact same tree

    async function startSort() {
        const pool = activeItems();
        const n = pool.length;
        // Worst-case merge sort comparison count. Transitive inference
        // almost never short-circuits a comparison on a fresh run (merge
        // only ever pits not-yet-connected halves against each other), so
        // the old optimistic *0.8 factor under-estimated and the bar
        // overshot 100% ("Round 16 of ~14"). This is an upper bound, so
        // the bar fills toward 100% without exceeding it.
        totalEstimate = Math.ceil(n * Math.log2(n) - n + 1);
        currentRound = 0;
        comparisonMap = {};
        battleHistory = [];
        undoStack = [];
        skipped = {};
        undoBtn.disabled = true;
        setFinalRoundUI(false);
        // Shuffle once and save the order — undo restarts reuse this
        savedShuffleOrder = [...pool].sort(() => Math.random() - 0.5);
        updateProgress();
        await runSort();
    }

    // ─── Restart Sort (preserves comparisonMap/history) ──
    async function restartSort() {
        await runSort();
    }

    // ─── Run Sort (shared logic) ─────────────────────
    // allowSkip=false runs the forced final round: skipping is disabled so
    // every still-unsettled deferred pair gets a real answer and the sort
    // terminates with a clean total order.
    async function runSort(allowSkip = true) {
        sortGeneration++;
        const myGeneration = sortGeneration;
        skipAllowed = allowSkip;
        setFinalRoundUI(!allowSkip);
        try {
            const sorted = await mergeSort(
                [...savedShuffleOrder],
                (a, b) => compare(a, b, myGeneration),
                () => myGeneration !== sortGeneration,
            );
            if (myGeneration !== sortGeneration) return; // superseded
            const pending = pendingSkipKeys();
            if (allowSkip && pending.length > 0) {
                // Deferred duels remain — re-run with skipping disabled.
                // The fast-forward replays every real pick, so only the
                // unsettled skips (plus any divergence they cause) resurface.
                await enterFinalRound(pending.length);
                if (myGeneration !== sortGeneration) return;
                return runSort(false);
            }
            showResults(sorted);
        } catch (e) {
            // Sort was interrupted (undo restart) — this is expected
        }
    }

    // Brief, non-invasive transition into the forced final round.
    function enterFinalRound(count) {
        return new Promise((resolve) => {
            setFinalRoundUI(true);
            const banner = document.createElement("div");
            banner.className = "final-round-banner";
            banner.setAttribute("role", "status");
            banner.setAttribute("aria-live", "polite");
            banner.innerHTML = `<i class="fa-solid fa-bolt"></i> ${t(count === 1 ? "ranking.suddenDeathOne" : "ranking.suddenDeath", { count })}`;
            battleView.appendChild(banner);
            setTimeout(() => {
                banner.classList.add("final-round-banner-out");
                setTimeout(() => {
                    banner.remove();
                    resolve();
                }, 360);
            }, 1150);
        });
    }

    // ─── Start Ranking ──────────────────────────────
    startBtn.addEventListener("click", () => {
        // Track ranking start (fire-and-forget)
        fetch("/api/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                url: window.location.href,
                date: new Date().toISOString(),
            }),
        }).catch(() => {}); // Silently ignore tracking errors

        // Mark as played locally (logged-in attribution is server-side
        // via /api/track) so it's hidden from recommendations right away.
        recordStart(templateSlug);

        detailView.classList.add("hidden");
        startCta.classList.add("hidden");
        battleView.classList.remove("hidden");
        battleView.classList.add("animate-battle-enter");
        window.scrollTo({ top: 0, behavior: "smooth" });
        startSort();
    });

    // ─── Epic Transition → Results ──────────────────
    function showResults(ranked) {
        // Epic transition
        transitionOvl.classList.remove("hidden");
        transitionOvl.innerHTML = `
        <div class="flash animate-flash"></div>
        ${Array.from({ length: 12 }, (_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            const dist = 80 + Math.random() * 120;
            const x = Math.cos(angle) * dist;
            const y = Math.sin(angle) * dist;
            const delay = Math.random() * 0.3;
            const hue =
                Math.random() > 0.5 ? "132, 0, 255" : "255, 215, 0";
            return `<div class="particle" style="left:calc(50% + ${x}px);top:calc(50% + ${y}px);background:rgba(${hue},0.8);animation:particleGlow 0.8s ${delay}s ease-out both;"></div>`;
        }).join("")}
    `;

        setTimeout(() => {
            battleView.classList.add("hidden");
            transitionOvl.classList.add("hidden");
            resultsView.classList.remove("hidden");
            window.scrollTo({ top: 0, behavior: "smooth" });
            renderResults(ranked);
            persistResult(ranked);
        }, 900);
    }

    // ─── Render Results ─────────────────────────────
    function renderResults(ranked) {
        lastRanked = ranked;
        // Podium
        const medalColors = [
            {
                bg: "from-amber-400/20 to-amber-600/10",
                border: "border-amber-400/60",
                text: "text-amber-400",
                icon: "fa-crown",
                label: t("ranking.podium1"),
            },
            {
                bg: "from-gray-300/15 to-gray-400/5",
                border: "border-gray-400/50",
                text: "text-gray-300",
                icon: "fa-medal",
                label: t("ranking.podium2"),
            },
            {
                bg: "from-orange-400/15 to-orange-600/5",
                border: "border-orange-500/40",
                text: "text-orange-400",
                icon: "fa-award",
                label: t("ranking.podium3"),
            },
        ];
        const podiumOrder =
            ranked.length >= 3
                ? [1, 0, 2]
                : ranked.length === 2
                  ? [null, 0, 1]
                  : [null, 0, null];
        const heights = [
            "h-36 sm:h-44",
            "h-48 sm:h-56",
            "h-28 sm:h-36",
        ];

        podiumEl.innerHTML = podiumOrder
            .map((idx, pos) => {
                if (idx === null || idx >= ranked.length)
                    return `<div class="w-28 sm:w-36"></div>`;
                const item = ranked[idx];
                const medal = medalColors[idx];
                const height = heights[pos];
                const delay =
                    pos === 1 ? "0s" : pos === 0 ? "0.2s" : "0.4s";

                return `
            <div class="flex flex-col items-center w-28 sm:w-36 animate-podium-rise" style="animation-delay:${delay}">
                ${idx === 0 ? `<i class="fa-solid fa-crown text-amber-400 text-xl mb-2 animate-crown" style="animation-delay:0.8s"></i>` : ""}
                <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 ${medal.border} mb-3 shadow-lg">
                    <img src="${esc(item.image)}" alt="${esc(item.name)}" class="w-full h-full object-cover" />
                </div>
                <p class="text-sm font-bold text-text-primary text-center line-clamp-2 mb-2">${esc(item.name)}</p>
                <div class="w-full ${height} rounded-t-2xl bg-gradient-to-t ${medal.bg} border-t-2 border-x-2 ${medal.border} flex items-start justify-center pt-3">
                    <span class="text-xs font-black ${medal.text} uppercase tracking-wider">${medal.label}</span>
                </div>
            </div>
        `;
            })
            .join("");

        // Full Ranking List
        rankListEl.innerHTML = ranked
            .map((item, i) => {
                const delay = `${0.6 + i * 0.06}s`;
                const isTop3 = i < 3;
                return `
            <div class="rank-item flex items-center gap-3 sm:gap-4 p-3 rounded-xl ${isTop3 ? "bg-primary/5 border border-primary/15" : "bg-surface-elevated border border-border"} animate-rank-slide" style="animation-delay:${delay}" data-item-id="${item.id}">
                <div class="${POS_BASE} ${posClasses(i)}">${posLabel(i)}</div>
                <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden bg-surface shrink-0">
                    <img src="${esc(item.image)}" alt="${esc(item.name)}" class="w-full h-full object-cover" />
                </div>
                <p class="text-base font-semibold text-text-primary flex-1 line-clamp-1">${esc(item.name)}</p>
                <span class="rank-drag-handle hidden items-center justify-center w-10 h-10 rounded-lg bg-border/40 text-text-secondary cursor-grab active:cursor-grabbing shrink-0 touch-none"><i class="fa-solid fa-grip-vertical"></i></span>
            </div>
        `;
            })
            .join("");
    }

    // ─── Battle History Modal ───────────────────────
    actionHistory.addEventListener("click", () => {
        historyList.innerHTML =
            battleHistory.length === 0
                ? `<p class="text-sm text-text-muted text-center py-6">${esc(t("ranking.noBattlesRecorded"))}</p>`
                : battleHistory
                      .map((b, i) => {
                          const aWon = b.winner.id === b.a.id;
                          return `
                <div class="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border">
                    <span class="text-xs text-text-muted font-mono w-6 shrink-0">${i + 1}.</span>
                    <div class="flex items-center gap-2 flex-1 min-w-0">
                        <div class="flex items-center gap-2 ${aWon ? "opacity-100" : "opacity-40"} flex-1 min-w-0">
                            <div class="w-7 h-7 rounded-md overflow-hidden shrink-0 ${aWon ? "ring-2 ring-primary/60" : ""}">
                                <img src="${esc(b.a.image)}" alt="" class="w-full h-full object-cover" />
                            </div>
                            <span class="text-xs font-medium text-text-primary truncate">${esc(b.a.name)}</span>
                        </div>
                        <span class="text-[10px] text-text-muted font-bold shrink-0 mx-1">${esc(t("ranking.vs"))}</span>
                        <div class="flex items-center gap-2 ${!aWon ? "opacity-100" : "opacity-40"} flex-1 min-w-0 justify-end">
                            <span class="text-xs font-medium text-text-primary truncate">${esc(b.b.name)}</span>
                            <div class="w-7 h-7 rounded-md overflow-hidden shrink-0 ${!aWon ? "ring-2 ring-primary/60" : ""}">
                                <img src="${esc(b.b.image)}" alt="" class="w-full h-full object-cover" />
                            </div>
                        </div>
                    </div>
                </div>
            `;
                      })
                      .join("");
        openModal(historyModal, { focus: historyClose });
    });

    historyClose.addEventListener("click", () =>
        closeModal(historyModal),
    );
    historyBackdrop.addEventListener("click", () =>
        closeModal(historyModal),
    );

    // ─── Download Image ─────────────────────────────
    // Loads every option image (cross-origin) and renders a large
    // canvas — slow on poor connections, so show a busy state instead
    // of leaving the button looking unresponsive.
    const downloadBtn = document.getElementById(
        "action-download-image",
    );
    downloadBtn.addEventListener("click", async () => {
        if (downloadBtn.dataset.busy) return;
        downloadBtn.dataset.busy = "1";
        const original = downloadBtn.innerHTML;
        downloadBtn.setAttribute("aria-busy", "true");
        downloadBtn.innerHTML = `<i class="fa-solid fa-spinner btn-spinner text-xs text-primary/70"></i>${t("ranking.generating")}`;
        try {
            await downloadRankingImage(
                lastRanked,
                templateTitle || t("ranking.myRanking"),
                {
                    results: t("ranking.results").toUpperCase(),
                    fullRanking: t("ranking.fullRanking"),
                    madeWith: t("ranking.shareImgMadeWith"),
                    podium: [
                        t("ranking.podium1").toUpperCase(),
                        t("ranking.podium2").toUpperCase(),
                        t("ranking.podium3").toUpperCase(),
                    ],
                },
            );
        } finally {
            downloadBtn.innerHTML = original;
            downloadBtn.removeAttribute("aria-busy");
            delete downloadBtn.dataset.busy;
        }
    });

    // ─── Reorder Manually (drag & drop via SortableJS) ────────────
    let reorderMode = false;
    const actionReorder = document.getElementById("action-reorder");

    // Renumber the position badges + restyle top-3 rows from the current
    // DOM order. Cheap; runs live on every order shift during a drag so
    // positions update in real time.
    function renumberPositions() {
        rankListEl.querySelectorAll(".rank-item").forEach((el, i) => {
            const pos = el.querySelector(".rank-pos");
            const isTop3 = i < 3;

            if (pos) {
                pos.textContent = posLabel(i);
                pos.className = `${POS_BASE} ${posClasses(i)}`;
            }

            // Update row bg (top-3 highlight)
            el.className = el.className
                .replace(/bg-primary\/5/g, "")
                .replace(/border-primary\/15/g, "")
                .replace(/bg-surface-elevated/g, "")
                .replace(/border-border/g, "");
            if (isTop3) {
                el.classList.add("bg-primary/5", "border-primary/15");
            } else {
                el.classList.add(
                    "bg-surface-elevated",
                    "border-border",
                );
            }
        });
    }

    // On drop: rebuild lastRanked from the new DOM order, renumber, and
    // re-render the podium.
    function applyReorder(orderedIds) {
        lastRanked = orderedIds
            .map((id) =>
                lastRanked.find((item) => String(item.id) === id),
            )
            .filter(Boolean);
        renumberPositions();
        renderPodium(lastRanked);
        // Save the user's manually reordered result (upsert).
        persistResult(lastRanked);
    }

    const reorder = createReorder(rankListEl, {
        onChange: renumberPositions,
        onEnd: applyReorder,
    });

    const reorderIcon = actionReorder.querySelector("i");
    const reorderLabel = document.getElementById("action-reorder-label");
    actionReorder.addEventListener("click", () => {
        reorderMode = !reorderMode;
        reorder.setEnabled(reorderMode);
        const handles =
            rankListEl.querySelectorAll(".rank-drag-handle");

        if (reorderMode) {
            actionReorder.classList.add(
                "!border-primary/60",
                "!text-primary",
                "!bg-primary/10",
            );
            if (reorderIcon)
                reorderIcon.className =
                    "fa-solid fa-check text-xs text-primary";
            if (reorderLabel)
                reorderLabel.textContent = t("ranking.doneReordering");
            handles.forEach((h) => h.classList.remove("hidden"));
            handles.forEach((h) => h.classList.add("flex"));
            // Drop the one-shot entrance animation: its `both` fill-mode
            // pins a transform that fights SortableJS's live reorder
            // transforms (causing lag and rows not moving until drop).
            rankListEl
                .querySelectorAll(".rank-item")
                .forEach((el) =>
                    el.classList.remove("animate-rank-slide"),
                );
        } else {
            actionReorder.classList.remove(
                "!border-primary/60",
                "!text-primary",
                "!bg-primary/10",
            );
            if (reorderIcon)
                reorderIcon.className =
                    "fa-solid fa-arrows-up-down text-xs text-primary/70";
            if (reorderLabel)
                reorderLabel.textContent = t("ranking.reorderManually");
            handles.forEach((h) => h.classList.add("hidden"));
            handles.forEach((h) => h.classList.remove("flex"));
        }
    });

    // ─── Podium renderer (extracted for reuse) ───────
    function renderPodium(ranked) {
        const medalColors = [
            {
                bg: "from-amber-400/20 to-amber-600/10",
                border: "border-amber-400/60",
                text: "text-amber-400",
                icon: "fa-crown",
                label: t("ranking.podium1"),
            },
            {
                bg: "from-gray-300/15 to-gray-400/5",
                border: "border-gray-400/50",
                text: "text-gray-300",
                icon: "fa-medal",
                label: t("ranking.podium2"),
            },
            {
                bg: "from-orange-400/15 to-orange-600/5",
                border: "border-orange-500/40",
                text: "text-orange-400",
                icon: "fa-award",
                label: t("ranking.podium3"),
            },
        ];
        const podiumOrder =
            ranked.length >= 3
                ? [1, 0, 2]
                : ranked.length === 2
                  ? [null, 0, 1]
                  : [null, 0, null];
        const heights = [
            "h-36 sm:h-44",
            "h-48 sm:h-56",
            "h-28 sm:h-36",
        ];

        podiumEl.innerHTML = podiumOrder
            .map((idx, pos) => {
                if (idx === null || idx >= ranked.length)
                    return `<div class="w-28 sm:w-36"></div>`;
                const item = ranked[idx];
                const medal = medalColors[idx];
                const height = heights[pos];
                return `
                <div class="flex flex-col items-center w-28 sm:w-36 animate-podium-rise" style="animation-delay:0s">
                    ${idx === 0 ? `<i class="fa-solid fa-crown text-amber-400 text-xl mb-2"></i>` : ""}
                    <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 ${medal.border} mb-3 shadow-lg">
                        <img src="${esc(item.image)}" alt="${esc(item.name)}" class="w-full h-full object-cover" />
                    </div>
                    <p class="text-sm font-bold text-text-primary text-center line-clamp-2 mb-2">${esc(item.name)}</p>
                    <div class="w-full ${height} rounded-t-2xl bg-gradient-to-t ${medal.bg} border-t-2 border-x-2 ${medal.border} flex items-start justify-center pt-3">
                        <span class="text-xs font-black ${medal.text} uppercase tracking-wider">${medal.label}</span>
                    </div>
                </div>
            `;
            })
            .join("");
    }

    // ─── Rank Again ─────────────────────────────────
    actionRankAgain.addEventListener("click", () => {
        if (reorderMode) {
            actionReorder.click();
        } // exit reorder mode
        // Back to the options grid: that's where the restore controls
        // live, so the user can re-include excluded options before a
        // fresh ranking (battle has no restore path of its own).
        resultsView.classList.add("hidden");
        battleView.classList.add("hidden");
        detailView.classList.remove("hidden");
        startCta.classList.remove("hidden");
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // ─── Share Template ────────────────────────────
    // Optional: surfaces without a public URL to share (the guest-local
    // template page) leave both share buttons out of the results view.
    actionShareTemplate?.addEventListener("click", async () => {
        const title = templateTitle || t("ranking.myRanking");
        const url = window.location.href;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: t("card.shareTitle", { title }),
                    url,
                });
            } catch (err) {
                console.error("Error sharing:", err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(url);
                const ic = actionShareTemplate.querySelector("i");
                if (ic) {
                    ic.className =
                        "fa-solid fa-check text-xs text-emerald-500";
                    setTimeout(() => {
                        ic.className =
                            "fa-solid fa-share-nodes text-xs text-primary/70";
                    }, 2000);
                }
            } catch (err) {
                console.error("Error copying:", err);
            }
        }
    });

    // ─── Share on X ──────────────────────────────
    actionShareX?.addEventListener("click", () => {
        const title = templateTitle || t("ranking.myRanking");
        const url = window.location.href;
        const text = t("ranking.shareXText", { title });
        const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        window.open(xUrl, "_blank", "noopener");
    });

    // ─── Land on saved results ──────────────────────
    // If this user has already completed this template, open straight on
    // the results view (podium + actions) instead of the detail/START
    // view — "Rank Again" is the way back into a fresh ranking. Sources,
    // in order: the /history "View details" handoff (sessionStorage),
    // this browser's localStorage, then D1 for logged-in users on a fresh
    // device. All client-side, so the publicly-cached HTML is untouched.
    function restoreBattleHistory(entry) {
        const stored = parseBattleHistory(entry?.battles);
        if (!stored) {
            battleHistory = [];
            return;
        }

        // Prefer the saved result snapshots for names/images, but retain
        // current template options so battles involving an option that
        // was excluded from the final ranking can still be displayed.
        const itemById = new Map(
            items.map((item) => [String(item.id), item]),
        );
        for (const item of entry.result) {
            itemById.set(String(item.id), item);
        }

        const restored = [];
        for (const [leftId, rightId, winnerSide] of stored.decisions) {
            const a = itemById.get(String(leftId));
            const b = itemById.get(String(rightId));
            if (!a || !b) continue;
            restored.push({
                a,
                b,
                winner: winnerSide === 0 ? a : b,
                roundNum: restored.length + 1,
            });
        }
        battleHistory = restored;
    }

    function showSavedResult(entry) {
        const result = entry?.result;
        if (!result || result.length < 2) return;
        restoreBattleHistory(entry);
        detailView.classList.add("hidden");
        startCta.classList.add("hidden");
        battleView.classList.add("hidden");
        resultsView.classList.remove("hidden");
        renderResults(result); // already persisted — do not re-save
    }

    function maybeShowSavedResult() {
        // "Rank again" from /history asks for a fresh ranking — keep the
        // normal detail/START view even though a saved result exists.
        if (consumeForceFresh(templateSlug)) return;
        const pending = consumePendingResult(templateSlug);
        if (pending && pending.result) {
            showSavedResult(pending);
            return;
        }
        const local = getLocalResult(templateSlug);
        if (local && local.result) {
            showSavedResult(local);
        }
        // Fetch a newer cross-device result in the background. It must
        // not replace the already-painted detail view: doing so removes
        // a long page of content after first paint and creates a large
        // layout shift (including a jump of the persistent footer).
        //
        // The result is still cached locally for the next visit, where
        // the pre-paint guard above can select the results view before
        // it becomes visible. The explicit "View details" action on
        // /history continues to open it immediately via the pending
        // sessionStorage handoff.
        fetch(
            `/api/me/history?slug=${encodeURIComponent(templateSlug)}`,
            { headers: { Accept: "application/json" } },
        )
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                const remote = data?.entry;
                if (!remote?.result) return;

                if (local && local.ts > remote.ts) {
                    void syncResultToAccount(local);
                    return;
                }

                saveHistoryEntry(remote);
            })
            .catch(() => {});
    }
    maybeShowSavedResult();
    // The synchronous part of maybeShowSavedResult has run: the real
    // `hidden` classes now encode the landing decision, so the
    // pre-paint guard is no longer needed (the async D1 fallback shows
    // the detail view while in flight, same as before the guard).
    clearSavedResultGuard();
}
