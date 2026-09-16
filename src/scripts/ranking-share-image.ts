/**
 * Results share-image renderer — draws the ranking (podium + column list) onto
 * a canvas and triggers a PNG download. Extracted from the template page so the
 * page stays focused on battle/UI control.
 *
 * The canvas drawing itself is exercised by the e2e download smoke test; the
 * pure layout helpers (`restLayout`, `gridPosition`, `computeCanvasHeight`,
 * `truncate`) are unit-tested.
 */

import crownSvg from '@fortawesome/fontawesome-free/svgs/solid/crown.svg?raw';

import { graphemesOf } from '../lib/text';

export type RankedItem = {
	id: number | string;
	name: string;
	image: string | null;
};

// Canvas layout constants (px).
const W = 1080;
const PAD = 50;
const COL_GAP = 24;
const PODIUM_IMG = 120;
const PODIUM_H = 460;
const HEADER_H = 110;
const FOOTER_H = 60;
/** Height of the "Full Ranking" label band above the grid. */
const REST_LABEL_H = 60;

/**
 * Columns grow instead of rows: a long single-file list makes the PNG far
 * taller than any feed will show. A column narrower than ~300px truncates most
 * option names, so at 1080px wide three is as far as this can go.
 */
const MAX_ROWS_PER_COL = 10;
const MAX_COLS = 3;
/** Below the podium, every row is a card of `rowH - 12` px. */
const CARD_INSET = 12;

/**
 * One stack for every string drawn on the canvas. The emoji families come last,
 * the way the CSS stacks do: option names are user text and routinely contain
 * emoji, and leaving the fallback implicit renders them differently — or as
 * tofu — depending on what the browser happens to pick.
 */
const FONT_STACK =
	"-apple-system, 'Segoe UI', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji'";

/** `font('bold', 32)` → a canvas font shorthand on the shared stack. */
const font = (weight: string, size: number) =>
	`${weight} ${size}px ${FONT_STACK}`;

/**
 * The winner's crown, taken from the same Font Awesome icon the on-page podium
 * renders (`fa-solid fa-crown`, see Podium.tsx). Reading the shipped SVG keeps
 * the image and the site on one silhouette, and keeps following the icon when
 * the package updates it; hand-drawing a second crown did not.
 */
const CROWN = (() => {
	const box = crownSvg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
	const path = crownSvg.match(/\sd="([^"]+)"/);
	return {
		path: path?.[1] ?? '',
		width: Number(box?.[1] ?? 0),
		height: Number(box?.[2] ?? 0),
	};
})();

/** Gold shared with the winner's ring, and with `text-amber-400` on the page. */
const CROWN_GOLD = '#FBBF24';

/** Geometry of the "Full Ranking" grid that renders the items below the podium. */
export interface RestLayout {
	/** Items below the podium, i.e. `count - 3`. */
	count: number;
	cols: number;
	/** Rows in the tallest column. */
	rows: number;
	colWidth: number;
	rowH: number;
	/** Thumbnail edge, shrunk along with the row when the grid gets dense. */
	imgSize: number;
	/** Band height including the label, or 0 when there is nothing to draw. */
	height: number;
}

/**
 * Lay out the items below the podium. Column count follows the item count so
 * the image stays roughly feed-shaped, and the densest grid trades a little
 * row height for the extra column it needs.
 */
export function restLayout(count: number): RestLayout {
	const restCount = Math.max(0, count - 3);
	if (restCount === 0) {
		return {
			count: 0,
			cols: 0,
			rows: 0,
			colWidth: 0,
			rowH: 0,
			imgSize: 0,
			height: 0,
		};
	}

	const cols = Math.min(
		MAX_COLS,
		Math.max(2, Math.ceil(restCount / MAX_ROWS_PER_COL))
	);
	const rows = Math.ceil(restCount / cols);
	const dense = cols >= MAX_COLS;
	const rowH = dense ? 84 : 100;

	return {
		count: restCount,
		cols,
		rows,
		colWidth: (W - PAD * 2 - COL_GAP * (cols - 1)) / cols,
		rowH,
		imgSize: dense ? 44 : 50,
		height: rows * rowH + REST_LABEL_H,
	};
}

/**
 * Where the `index`-th item below the podium sits in the grid. Filling is
 * column-major — a whole column top to bottom, then the next one — because a
 * ranking is read in sequence, and row-major order makes the eye cross the
 * image for every step. Columns differ by at most one row, the extra rows
 * going to the leftmost columns.
 */
export function gridPosition(
	index: number,
	layout: RestLayout
): { col: number; row: number } {
	const base = Math.floor(layout.count / layout.cols);
	const extra = layout.count % layout.cols;
	let col = 0;
	let offset = index;
	for (;;) {
		const colRows = base + (col < extra ? 1 : 0);
		if (offset < colRows) return { col, row: offset };
		offset -= colRows;
		col++;
	}
}

/** Total canvas height for a ranking of `count` items. */
export function computeCanvasHeight(count: number): number {
	return HEADER_H + PODIUM_H + restLayout(count).height + FOOTER_H + PAD;
}

/** Never trim a label below this many characters, however narrow the column. */
const TRUNCATE_FLOOR = 3;

/**
 * Trim `text` one character at a time (down to a 3-character floor) until it
 * fits `maxW`, appending an ellipsis when anything was removed. `measure`
 * returns the rendered width of a string (in the page: `ctx.measureText(t).width`).
 *
 * A "character" here is a grapheme cluster, not a UTF-16 code unit: trimming by
 * code unit can strip half of an emoji and leave a lone surrogate, which the
 * canvas draws as a replacement glyph in an image people share.
 */
export function truncate(
	text: string,
	maxW: number,
	measure: (t: string) => number
): string {
	const graphemes = graphemesOf(text);
	let kept = graphemes.length;
	let fitted = text;
	while (kept > TRUNCATE_FLOOR && measure(fitted) > maxW) {
		kept--;
		fitted = graphemes.slice(0, kept).join('');
	}
	return kept < graphemes.length ? fitted + '…' : text;
}

/**
 * Localized labels baked into the canvas. Optional so existing callers/tests
 * keep working; the page passes translated strings (see template/[slug].astro).
 */
export interface ShareImageLabels {
	results: string;
	fullRanking: string;
	madeWith: string;
	podium: [string, string, string];
}

const DEFAULT_LABELS: ShareImageLabels = {
	results: 'RESULTS',
	fullRanking: 'Full Ranking',
	madeWith: 'Made with rankmaker.net',
	podium: ['1ST', '2ND', '3RD'],
};

/** Render the ranking to a PNG and trigger a browser download. */
export async function downloadRankingImage(
	ranked: RankedItem[],
	title: string,
	labels: Partial<ShareImageLabels> = {}
): Promise<void> {
	if (ranked.length === 0) return;

	const L: ShareImageLabels = { ...DEFAULT_LABELS, ...labels };

	const restItems = ranked.slice(3);
	const rest = restLayout(ranked.length);
	const H = computeCanvasHeight(ranked.length);

	const canvas = document.createElement('canvas');
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext('2d');
	if (!ctx) return;

	// ─── Background ───
	const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
	bgGrad.addColorStop(0, '#0c0c14');
	bgGrad.addColorStop(0.5, '#0f0f1a');
	bgGrad.addColorStop(1, '#0a0a12');
	ctx.fillStyle = bgGrad;
	ctx.fillRect(0, 0, W, H);

	// Subtle purple glow at top
	const glowGrad = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * 0.6);
	glowGrad.addColorStop(0, 'rgba(132, 0, 255, 0.08)');
	glowGrad.addColorStop(1, 'transparent');
	ctx.fillStyle = glowGrad;
	ctx.fillRect(0, 0, W, H / 2);

	// ─── Helpers (close over ctx) ───
	function tryLoad(src: string): Promise<HTMLImageElement | null> {
		return new Promise((resolve) => {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.onload = () => resolve(img);
			img.onerror = () => resolve(null);
			img.src = src;
		});
	}

	async function loadImg(src: string | null): Promise<HTMLImageElement | null> {
		if (!src) return null;
		const img = await tryLoad(src);
		if (img) return img;
		// The page's plain <img> tags cache these images without CORS headers
		// (the no-Origin response carries no Vary: Origin), so this crossOrigin
		// request can be served a cached copy missing Access-Control-Allow-Origin
		// and fail. Re-request past the HTTP cache so the CORS header arrives.
		return tryLoad(src + (src.includes('?') ? '&' : '?') + 'cors=1');
	}

	function roundRect(x: number, y: number, w: number, h: number, r: number) {
		ctx!.beginPath();
		ctx!.moveTo(x + r, y);
		ctx!.lineTo(x + w - r, y);
		ctx!.quadraticCurveTo(x + w, y, x + w, y + r);
		ctx!.lineTo(x + w, y + h - r);
		ctx!.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
		ctx!.lineTo(x + r, y + h);
		ctx!.quadraticCurveTo(x, y + h, x, y + h - r);
		ctx!.lineTo(x, y + r);
		ctx!.quadraticCurveTo(x, y, x + r, y);
		ctx!.closePath();
	}

	function drawRoundedImg(
		img: HTMLImageElement | null,
		x: number,
		y: number,
		size: number,
		radius: number
	) {
		if (!img) {
			// Placeholder
			roundRect(x, y, size, size, radius);
			ctx!.fillStyle = '#1a1a2e';
			ctx!.fill();
			ctx!.strokeStyle = '#333';
			ctx!.lineWidth = 1;
			ctx!.stroke();
			return;
		}
		ctx!.save();
		roundRect(x, y, size, size, radius);
		ctx!.clip();
		// Draw image covering the area
		const scale = Math.max(size / img.width, size / img.height);
		const sw = img.width * scale;
		const sh = img.height * scale;
		ctx!.drawImage(img, x - (sw - size) / 2, y - (sh - size) / 2, sw, sh);
		ctx!.restore();
	}

	/**
	 * Stamp the crown icon, scaled to `w` and sitting on `bottomY`. Typing the
	 * 👑 emoji instead left its shape to the browser's emoji font — different
	 * on every platform, and tofu wherever none is installed.
	 */
	function drawCrown(cx: number, bottomY: number, w: number) {
		const scale = w / CROWN.width;
		ctx!.save();
		ctx!.translate(cx - w / 2, bottomY - CROWN.height * scale);
		ctx!.scale(scale, scale);
		ctx!.fillStyle = CROWN_GOLD;
		ctx!.fill(new Path2D(CROWN.path));
		ctx!.restore();
	}

	const truncText = (text: string, maxW: number) =>
		truncate(text, maxW, (t) => ctx!.measureText(t).width);

	// ─── Load all images ───
	const allImages: Record<string, HTMLImageElement | null> = {};
	await Promise.all(
		ranked.map(async (item) => {
			allImages[item.id] = await loadImg(item.image);
		})
	);

	// ─── Header ───
	let curY = PAD;
	ctx.fillStyle = 'rgba(255,255,255,0.35)';
	ctx.font = font('600', 13);
	ctx.textAlign = 'center';
	ctx.fillText(L.results, W / 2, curY + 16);

	ctx.fillStyle = '#ffffff';
	ctx.font = font('bold', 32);
	ctx.fillText(title, W / 2, curY + 60);
	curY += HEADER_H;

	// ─── Podium ───
	const medalColors = [
		{
			border: '#FBBF24',
			bg: 'rgba(251,191,36,0.15)',
			label: L.podium[0],
			text: '#FBBF24',
			crown: true,
		},
		{
			border: '#9CA3AF',
			bg: 'rgba(156,163,175,0.10)',
			label: L.podium[1],
			text: '#9CA3AF',
			crown: false,
		},
		{
			border: '#F97316',
			bg: 'rgba(249,115,22,0.10)',
			label: L.podium[2],
			text: '#F97316',
			crown: false,
		},
	];
	const podiumWidths = [180, 200, 180]; // 2nd, 1st, 3rd
	const podiumHeights = [160, 210, 130]; // visual column heights
	const podiumOrder =
		ranked.length >= 3
			? [1, 0, 2]
			: ranked.length === 2
				? [null, 0, 1]
				: [null, 0, null];
	const podiumCenterX = W / 2;
	const podiumSpacing = 12;
	// Position columns: [left, center, right]
	const colW = podiumWidths;
	const totalPodiumW = colW[0] + colW[1] + colW[2] + podiumSpacing * 2;
	const podiumStartX = podiumCenterX - totalPodiumW / 2;

	const podiumBaseY = curY + PODIUM_H - 40; // bottom of podium area

	podiumOrder.forEach((idx, pos) => {
		if (idx === null || idx >= ranked.length) return;
		const item = ranked[idx];
		const medal = medalColors[idx];
		const img = allImages[item.id];
		const w = colW[pos];
		const h = podiumHeights[pos];
		const x =
			podiumStartX +
			(pos === 0
				? 0
				: pos === 1
					? colW[0] + podiumSpacing
					: colW[0] + colW[1] + podiumSpacing * 2);

		const imgSize = idx === 0 ? PODIUM_IMG + 16 : PODIUM_IMG;
		const imgX = x + (w - imgSize) / 2;

		// Crown for 1st
		const crownH = medal.crown ? 30 : 0;
		const imgY = podiumBaseY - h - imgSize - 50 - crownH;

		if (medal.crown) {
			drawCrown(x + w / 2, imgY + crownH - 2, 34);
		}

		// Image
		drawRoundedImg(img, imgX, imgY + crownH, imgSize, 18);

		// Border ring
		roundRect(imgX - 2, imgY + crownH - 2, imgSize + 4, imgSize + 4, 20);
		ctx.strokeStyle = medal.border;
		ctx.lineWidth = 3;
		ctx.stroke();

		// Name
		ctx.fillStyle = '#ffffff';
		ctx.font = font('bold', 15);
		ctx.textAlign = 'center';
		const nameY = imgY + crownH + imgSize + 22;
		ctx.fillText(truncText(item.name, w - 10), x + w / 2, nameY);

		// Podium column
		const colY = nameY + 14;
		const colH = podiumBaseY - colY;
		roundRect(x + 8, colY, w - 16, colH, 16);
		// Create gradient for column
		const colGrad = ctx.createLinearGradient(0, colY, 0, colY + colH);
		colGrad.addColorStop(0, medal.bg);
		colGrad.addColorStop(1, 'rgba(0,0,0,0)');
		ctx.fillStyle = colGrad;
		ctx.fill();
		// Column border
		roundRect(x + 8, colY, w - 16, colH, 16);
		ctx.strokeStyle = medal.border + '50'; // add alpha
		ctx.lineWidth = 2;
		ctx.stroke();

		// Label inside column
		ctx.fillStyle = medal.text;
		ctx.font = font('900', 13);
		ctx.textAlign = 'center';
		ctx.fillText(medal.label, x + w / 2, colY + 26);
	});

	curY = podiumBaseY + 20;

	// ─── Full Ranking (rest, column-major grid) ───
	if (restItems.length > 0) {
		// Section label
		ctx.fillStyle = '#ffffff';
		ctx.font = font('bold', 17);
		ctx.textAlign = 'left';
		ctx.fillText(L.fullRanking, PAD, curY + 20);

		// Separator line
		ctx.strokeStyle = 'rgba(255,255,255,0.08)';
		ctx.lineWidth = 1;
		const textW = ctx.measureText(L.fullRanking).width;
		ctx.beginPath();
		ctx.moveTo(PAD + textW + 16, curY + 16);
		ctx.lineTo(W - PAD, curY + 16);
		ctx.stroke();
		curY += 50;

		const { colWidth, rowH, imgSize } = rest;
		const cardH = rowH - CARD_INSET;

		restItems.forEach((item, i) => {
			const globalIdx = i + 3; // actual rank index
			const { col, row } = gridPosition(i, rest);
			const x = PAD + col * (colWidth + COL_GAP);
			const y = curY + row * rowH;

			// Card background
			roundRect(x, y, colWidth, cardH, 14);
			ctx.fillStyle = 'rgba(255,255,255,0.03)';
			ctx.fill();
			roundRect(x, y, colWidth, cardH, 14);
			ctx.strokeStyle = 'rgba(255,255,255,0.06)';
			ctx.lineWidth = 1;
			ctx.stroke();

			// Rank number badge
			const badgeSize = 32;
			const badgeX = x + 14;
			const badgeY = y + (cardH - badgeSize) / 2;
			roundRect(badgeX, badgeY, badgeSize, badgeSize, 8);
			ctx.fillStyle = 'rgba(255,255,255,0.06)';
			ctx.fill();
			ctx.fillStyle = 'rgba(255,255,255,0.4)';
			ctx.font = font('800', 13);
			ctx.textAlign = 'center';
			ctx.fillText(
				String(globalIdx + 1),
				badgeX + badgeSize / 2,
				badgeY + badgeSize / 2 + 5
			);

			// Image
			const imgX = badgeX + badgeSize + 12;
			const imgY2 = y + (cardH - imgSize) / 2;
			drawRoundedImg(allImages[item.id], imgX, imgY2, imgSize, 10);

			// Name
			ctx.fillStyle = '#e0e0e0';
			ctx.font = font('500', 14);
			ctx.textAlign = 'left';
			const nameX = imgX + imgSize + 10;
			const nameMaxW = colWidth - (nameX - x) - 10;
			ctx.fillText(truncText(item.name, nameMaxW), nameX, y + cardH / 2 + 5);
		});
	}

	// ─── Watermark footer ───
	const footerY = H - 30;
	ctx.fillStyle = 'rgba(255,255,255,0.15)';
	ctx.font = font('500', 12);
	ctx.textAlign = 'center';
	ctx.fillText(L.madeWith, W / 2, footerY);

	// ─── Download ───
	const link = document.createElement('a');
	link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_ranking.png`;
	link.href = canvas.toDataURL('image/png');
	link.click();
}
