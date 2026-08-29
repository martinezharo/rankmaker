// @vitest-environment happy-dom
/**
 * The share-image renderer.
 *
 * There is no pixel comparison here — what breaks in production is not a
 * slightly different gradient, it is a canvas sized wrong for the ranking, an
 * option image that never loads, or a download whose filename the OS refuses.
 * The 2D context is a recorder, so those are what the assertions read.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	computeCanvasHeight,
	downloadRankingImage,
	truncate,
	type RankedItem,
} from './ranking-share-image';

type Call = { method: string; args: unknown[] };

/** A 2D context that records what was drawn. */
function recordingContext() {
	const calls: Call[] = [];
	const gradient = { addColorStop: vi.fn() };
	const record =
		(method: string) =>
		(...args: unknown[]) => {
			calls.push({ method, args });
		};
	const context = {
		calls,
		canvas: null as unknown,
		createLinearGradient: vi.fn(() => gradient),
		createRadialGradient: vi.fn(() => gradient),
		measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
		save: record('save'),
		restore: record('restore'),
		beginPath: record('beginPath'),
		closePath: record('closePath'),
		moveTo: record('moveTo'),
		lineTo: record('lineTo'),
		quadraticCurveTo: record('quadraticCurveTo'),
		arc: record('arc'),
		clip: record('clip'),
		fill: record('fill'),
		stroke: record('stroke'),
		fillRect: record('fillRect'),
		strokeRect: record('strokeRect'),
		fillText: record('fillText'),
		strokeText: record('strokeText'),
		drawImage: record('drawImage'),
		translate: record('translate'),
		rotate: record('rotate'),
		scale: record('scale'),
		setTransform: record('setTransform'),
		fillStyle: '',
		strokeStyle: '',
		lineWidth: 0,
		font: '',
		textAlign: '',
		textBaseline: '',
		globalAlpha: 1,
		shadowColor: '',
		shadowBlur: 0,
	};
	return context;
}

const drawnText = (context: ReturnType<typeof recordingContext>) =>
	context.calls.filter((c) => c.method === 'fillText').map((c) => c.args[0]);

const item = (id: number, name: string, image: string | null = null): RankedItem => ({
	id,
	name,
	image,
});

let context: ReturnType<typeof recordingContext>;
let canvas: HTMLCanvasElement | null;
let requested: string[];
/** Sources that should fail to load, exercising the CORS retry. */
let failing: Set<string>;
let clicked: HTMLAnchorElement[];

beforeEach(() => {
	context = recordingContext();
	canvas = null;
	requested = [];
	failing = new Set();
	clicked = [];

	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
		function (this: HTMLCanvasElement) {
			canvas = this;
			return context as unknown as CanvasRenderingContext2D;
		}
	);
	vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
		'data:image/png;base64,AAAA'
	);
	vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
		this: HTMLAnchorElement
	) {
		clicked.push(this);
	});

	// An <img> that resolves on the next microtask, so `await` reaches it.
	class FakeImage {
		crossOrigin = '';
		width = 200;
		height = 200;
		onload: (() => void) | null = null;
		onerror: (() => void) | null = null;
		#src = '';
		set src(value: string) {
			this.#src = value;
			requested.push(value);
			queueMicrotask(() =>
				failing.has(value) ? this.onerror?.() : this.onload?.()
			);
		}
		get src() {
			return this.#src;
		}
	}
	vi.stubGlobal('Image', FakeImage);
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('computeCanvasHeight', () => {
	const BASE = 110 + 460 + 60 + 50;

	it('has no rest band for 3 or fewer items', () => {
		for (const count of [0, 1, 2, 3]) {
			expect(computeCanvasHeight(count), String(count)).toBe(BASE);
		}
	});

	it('adds one 2-column row band for items 4–5', () => {
		expect(computeCanvasHeight(4)).toBe(BASE + 100 + 60);
		expect(computeCanvasHeight(5)).toBe(BASE + 100 + 60);
	});

	it('grows by a row every two extra items', () => {
		expect(computeCanvasHeight(7)).toBe(BASE + 200 + 60);
		expect(computeCanvasHeight(9)).toBe(BASE + 300 + 60);
	});
});

describe('truncate', () => {
	const measure = (t: string) => t.length * 10;
	// Flags are the awkward case: two surrogate pairs, four code units, one
	// character on screen.
	const ES = '\u{1F1EA}\u{1F1F8}';
	const AR = '\u{1F1E6}\u{1F1F7}';
	const FR = '\u{1F1EB}\u{1F1F7}';
	const DE = '\u{1F1E9}\u{1F1EA}';

	it('returns text unchanged when it fits', () => {
		expect(truncate('Alien', 100, measure)).toBe('Alien');
	});

	it('trims and marks the cut with an ellipsis', () => {
		// Trimmed until it measures within the budget: 6 characters at 10px.
		expect(truncate('A very long option name', 60, measure)).toBe('A very\u2026');
	});

	it('never trims below a three-character floor', () => {
		expect(truncate('Alien', 1, measure)).toBe('Ali…');
	});

	it('trims whole emoji, never half of one', () => {
		// Trimming by code unit would cut the second flag in two and leave a
		// lone surrogate, which the canvas draws as a replacement glyph.
		const cut = truncate(`Best ${ES}${AR}`, 90, measure);
		expect(cut).toBe(`Best ${ES}\u2026`);
		expect(() => encodeURIComponent(cut)).not.toThrow();
	});

	it('counts the floor in characters, not in code units', () => {
		expect(truncate(`${ES}${AR}${FR}${DE}`, 1, measure)).toBe(
			`${ES}${AR}${FR}\u2026`
		);
	});
});

describe('downloadRankingImage', () => {
	const ranking = [
		item(1, 'Alien', 'https://img.test/1.webp'),
		item(2, 'Heat', 'https://img.test/2.webp'),
		item(3, 'Se7en', null),
		item(4, 'Fargo', 'https://img.test/4.webp'),
		item(5, 'Casino', null),
	];

	it('draws nothing at all for an empty ranking', async () => {
		await downloadRankingImage([], 'Best Movies');
		expect(context.calls).toHaveLength(0);
		expect(clicked).toHaveLength(0);
	});

	it('sizes the canvas for the ranking it was given', async () => {
		await downloadRankingImage(ranking, 'Best Movies');
		expect(canvas!.width).toBe(1080);
		expect(canvas!.height).toBe(computeCanvasHeight(5));
	});

	it('loads every option image once', async () => {
		await downloadRankingImage(ranking, 'Best Movies');
		expect(requested).toEqual([
			'https://img.test/1.webp',
			'https://img.test/2.webp',
			'https://img.test/4.webp',
		]);
	});

	it('re-requests past the HTTP cache when the CORS load fails', async () => {
		failing.add('https://img.test/1.webp');
		await downloadRankingImage([item(1, 'Alien', 'https://img.test/1.webp')], 'T');
		expect(requested).toEqual([
			'https://img.test/1.webp',
			'https://img.test/1.webp?cors=1',
		]);
	});

	it('appends the retry marker to a URL that already has a query', async () => {
		failing.add('https://img.test/1.webp?v=2');
		await downloadRankingImage([item(1, 'Alien', 'https://img.test/1.webp?v=2')], 'T');
		expect(requested[1]).toBe('https://img.test/1.webp?v=2&cors=1');
	});

	it('draws the images it loaded', async () => {
		await downloadRankingImage(ranking, 'Best Movies');
		expect(
			context.calls.filter((c) => c.method === 'drawImage').length
		).toBeGreaterThanOrEqual(3);
	});

	it('draws a placeholder instead of a broken image', async () => {
		failing.add('https://img.test/1.webp');
		failing.add('https://img.test/1.webp?cors=1');
		await downloadRankingImage([item(1, 'Alien', 'https://img.test/1.webp')], 'T');
		expect(context.calls.some((c) => c.method === 'drawImage')).toBe(false);
		expect(context.calls.some((c) => c.method === 'fill')).toBe(true);
	});

	it('writes the title, the labels and the watermark onto the image', async () => {
		await downloadRankingImage(ranking, 'Best Movies', {
			results: 'RESULTADOS',
			fullRanking: 'Ranking completo',
			madeWith: 'Hecho con rankmaker.net',
			podium: ['1º', '2º', '3º'],
		});

		const text = drawnText(context);
		expect(text).toContain('Best Movies');
		expect(text).toContain('RESULTADOS');
		expect(text).toContain('Ranking completo');
		expect(text).toContain('Hecho con rankmaker.net');
		expect(text).toContain('1º');
	});

	it('falls back to English labels when the caller passes none', async () => {
		await downloadRankingImage(ranking, 'Best Movies');
		const text = drawnText(context);
		expect(text).toContain('RESULTS');
		expect(text).toContain('Made with rankmaker.net');
	});

	it('names every ranked option', async () => {
		await downloadRankingImage(ranking, 'Best Movies');
		const text = drawnText(context);
		for (const name of ['Alien', 'Heat', 'Se7en', 'Fargo', 'Casino']) {
			expect(text, name).toContain(name);
		}
	});

	it('leaves out the "full ranking" band when there is nothing below the podium', async () => {
		await downloadRankingImage(ranking.slice(0, 3), 'Best Movies');
		expect(drawnText(context)).not.toContain('Full Ranking');
	});

	it('downloads a PNG under a filesystem-safe name', async () => {
		await downloadRankingImage(ranking, 'Best Movies: The 90s / Redux!');
		expect(clicked).toHaveLength(1);
		expect(clicked[0].download).toBe(
			'best_movies__the_90s___redux__ranking.png'
		);
		expect(clicked[0].href).toBe('data:image/png;base64,AAAA');
	});

	it('gives up quietly when the browser has no 2D context', async () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
		await downloadRankingImage(ranking, 'Best Movies');
		expect(clicked).toHaveLength(0);
	});

	it('renders a two-item ranking, where the podium is not full', async () => {
		await downloadRankingImage(ranking.slice(0, 2), 'Best Movies');
		expect(clicked).toHaveLength(1);
		expect(drawnText(context)).toContain('Alien');
	});
});
