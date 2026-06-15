/**
 * Results share-image renderer — draws the ranking (podium + 2-column list) onto
 * a canvas and triggers a PNG download. Extracted from the template page so the
 * page stays focused on battle/UI control.
 *
 * The canvas drawing itself is exercised by the e2e download smoke test; the
 * pure layout helpers (`computeCanvasHeight`, `truncate`) are unit-tested.
 */

export type RankedItem = {
	id: number | string;
	name: string;
	image: string | null;
};

// Canvas layout constants (px).
const W = 1080;
const PAD = 50;
const ROW_H = 100;
const COL_GAP = 24;
const PODIUM_IMG = 120;
const PODIUM_H = 420;
const HEADER_H = 140;
const FOOTER_H = 60;

/**
 * Total canvas height for a ranking of `count` items. Items 4+ render in a
 * 2-column grid below the podium; the +60 is the "Full Ranking" label band.
 */
export function computeCanvasHeight(count: number): number {
	const restCount = Math.max(0, count - 3);
	const restRows = Math.ceil(restCount / 2);
	const REST_H = restRows > 0 ? restRows * ROW_H + 60 : 0;
	return HEADER_H + PODIUM_H + REST_H + FOOTER_H + PAD;
}

/**
 * Trim `text` one character at a time (down to a 3-char floor) until it fits
 * `maxW`, appending an ellipsis when anything was removed. `measure` returns the
 * rendered width of a string (in the page: `ctx.measureText(t).width`).
 */
export function truncate(
	text: string,
	maxW: number,
	measure: (t: string) => number
): string {
	let t = text;
	while (measure(t) > maxW && t.length > 3) {
		t = t.slice(0, -1);
	}
	return t.length < text.length ? t + '…' : t;
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
	function loadImg(src: string | null): Promise<HTMLImageElement | null> {
		return new Promise((resolve) => {
			if (!src) return resolve(null);
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.onload = () => resolve(img);
			img.onerror = () => resolve(null);
			img.src = src;
		});
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
	ctx.font = "600 13px -apple-system, 'Segoe UI', sans-serif";
	ctx.textAlign = 'center';
	ctx.fillText(L.results, W / 2, curY + 16);

	ctx.fillStyle = '#ffffff';
	ctx.font = "bold 32px -apple-system, 'Segoe UI', sans-serif";
	ctx.fillText(title, W / 2, curY + 60);

	ctx.fillStyle = 'rgba(255,255,255,0.4)';
	ctx.font = "400 14px -apple-system, 'Segoe UI', sans-serif";
	ctx.fillText('', W / 2, curY + 86);
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
			ctx.fillStyle = '#FBBF24';
			ctx.font = 'bold 26px -apple-system, sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText('👑', x + w / 2, imgY + 2);
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
		ctx.font = "bold 15px -apple-system, 'Segoe UI', sans-serif";
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
		ctx.font = '900 13px -apple-system, sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText(medal.label, x + w / 2, colY + 26);
	});

	curY = podiumBaseY + 20;

	// ─── Full Ranking (rest, 2 columns) ───
	if (restItems.length > 0) {
		// Section label
		ctx.fillStyle = '#ffffff';
		ctx.font = "bold 17px -apple-system, 'Segoe UI', sans-serif";
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

		const colWidth = (W - PAD * 2 - COL_GAP) / 2;

		restItems.forEach((item, i) => {
			const globalIdx = i + 3; // actual rank index
			const col = i % 2;
			const row = Math.floor(i / 2);
			const x = PAD + col * (colWidth + COL_GAP);
			const y = curY + row * ROW_H;

			// Card background
			roundRect(x, y, colWidth, ROW_H - 12, 14);
			ctx.fillStyle = 'rgba(255,255,255,0.03)';
			ctx.fill();
			roundRect(x, y, colWidth, ROW_H - 12, 14);
			ctx.strokeStyle = 'rgba(255,255,255,0.06)';
			ctx.lineWidth = 1;
			ctx.stroke();

			// Rank number badge
			const badgeSize = 32;
			const badgeX = x + 14;
			const badgeY = y + (ROW_H - 12 - badgeSize) / 2;
			roundRect(badgeX, badgeY, badgeSize, badgeSize, 8);
			ctx.fillStyle = 'rgba(255,255,255,0.06)';
			ctx.fill();
			ctx.fillStyle = 'rgba(255,255,255,0.4)';
			ctx.font = '800 13px -apple-system, sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText(
				String(globalIdx + 1),
				badgeX + badgeSize / 2,
				badgeY + badgeSize / 2 + 5
			);

			// Image
			const imgX = badgeX + badgeSize + 12;
			const imgY2 = y + (ROW_H - 12 - 50) / 2;
			drawRoundedImg(allImages[item.id], imgX, imgY2, 50, 10);

			// Name
			ctx.fillStyle = '#e0e0e0';
			ctx.font = "500 14px -apple-system, 'Segoe UI', sans-serif";
			ctx.textAlign = 'left';
			const nameMaxW = colWidth - (imgX - x + 50 + 20);
			ctx.fillText(
				truncText(item.name, nameMaxW),
				imgX + 60,
				y + (ROW_H - 12) / 2 + 5
			);
		});
	}

	// ─── Watermark footer ───
	const footerY = H - 30;
	ctx.fillStyle = 'rgba(255,255,255,0.15)';
	ctx.font = "500 12px -apple-system, 'Segoe UI', sans-serif";
	ctx.textAlign = 'center';
	ctx.fillText(L.madeWith, W / 2, footerY);

	// ─── Download ───
	const link = document.createElement('a');
	link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_ranking.png`;
	link.href = canvas.toDataURL('image/png');
	link.click();
}
