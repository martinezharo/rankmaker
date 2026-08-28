// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLIENT_MAX_UPLOAD_BYTES, uploadTemplateImage } from './image-upload';

/** A File of a given type and size, without allocating the bytes. */
function file(type: string, size = 1024, name = 'pic'): File {
	const value = new File([new Uint8Array(1)], name, { type });
	Object.defineProperty(value, 'size', { value, configurable: true });
	Object.defineProperty(value, 'size', { value: size, configurable: true });
	return value;
}

let fetchMock: ReturnType<typeof vi.fn>;

function stubApi(reply: { ok?: boolean; body?: unknown; reject?: boolean } = {}) {
	fetchMock = vi.fn(async () => {
		if (reply.reject) throw new Error('offline');
		return {
			ok: reply.ok ?? true,
			json: async () => reply.body ?? { ok: true, url: 'https://img.test/a.webp' },
		};
	});
	vi.stubGlobal('fetch', fetchMock);
}

beforeEach(() => {
	// The canvas path is opt-in below; by default decoding fails and the
	// original file is sent, which is the documented fallback.
	vi.stubGlobal('createImageBitmap', async () => {
		throw new Error('no decoder here');
	});
});
afterEach(() => {
	vi.unstubAllGlobals();
});

describe('uploadTemplateImage', () => {
	it('uploads and returns the public URL', async () => {
		stubApi();
		expect(await uploadTemplateImage(file('image/png'), 'cover')).toEqual({
			ok: true,
			url: 'https://img.test/a.webp',
		});
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/images?kind=cover',
			expect.objectContaining({ method: 'POST' })
		);
	});

	it('tells the server which kind it is', async () => {
		stubApi();
		await uploadTemplateImage(file('image/png'), 'option');
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/images?kind=option',
			expect.anything()
		);
	});

	it('refuses a type we do not accept, without a request', async () => {
		stubApi();
		for (const type of ['image/svg+xml', 'text/html', 'application/pdf', '']) {
			expect(await uploadTemplateImage(file(type), 'cover')).toEqual({
				ok: false,
				error: 'unsupported_type',
			});
		}
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('accepts every type the form offers', async () => {
		stubApi();
		for (const type of [
			'image/jpeg',
			'image/png',
			'image/webp',
			'image/gif',
			'image/avif',
		]) {
			expect((await uploadTemplateImage(file(type), 'cover')).ok, type).toBe(
				true
			);
		}
	});

	it('refuses an oversized file before spending the bandwidth', async () => {
		stubApi();
		expect(
			await uploadTemplateImage(
				file('image/png', CLIENT_MAX_UPLOAD_BYTES + 1),
				'cover'
			)
		).toEqual({ ok: false, error: 'too_large' });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('passes the server’s error code through for the form to translate', async () => {
		for (const error of [
			'image_rejected',
			'rate_limited',
			'too_large',
			'unsupported_type',
		]) {
			stubApi({ ok: false, body: { error } });
			expect(await uploadTemplateImage(file('image/png'), 'cover')).toEqual({
				ok: false,
				error,
			});
		}
	});

	it('falls back to a generic failure when the server says nothing useful', async () => {
		stubApi({ ok: false, body: {} });
		expect(await uploadTemplateImage(file('image/png'), 'cover')).toEqual({
			ok: false,
			error: 'upload_failed',
		});

		stubApi({ ok: true, body: { ok: true } });
		expect(await uploadTemplateImage(file('image/png'), 'cover')).toEqual({
			ok: false,
			error: 'upload_failed',
		});
	});

	it('reports a failure rather than throwing when the network is down', async () => {
		stubApi({ reject: true });
		expect(await uploadTemplateImage(file('image/png'), 'cover')).toEqual({
			ok: false,
			error: 'upload_failed',
		});
	});

	it('sends a small file as-is, without a canvas round-trip', async () => {
		stubApi();
		const bitmap = vi.fn();
		vi.stubGlobal('createImageBitmap', bitmap);

		await uploadTemplateImage(file('image/png', 1024), 'cover');

		expect(bitmap).not.toHaveBeenCalled();
	});

	it('sends a GIF as-is, so an animation is not flattened to one frame', async () => {
		stubApi();
		const bitmap = vi.fn();
		vi.stubGlobal('createImageBitmap', bitmap);

		await uploadTemplateImage(file('image/gif', 5 * 1024 * 1024), 'cover');

		expect(bitmap).not.toHaveBeenCalled();
	});

	it('sends the original when the browser cannot decode it', async () => {
		stubApi();
		const original = file('image/png', 5 * 1024 * 1024);
		await uploadTemplateImage(original, 'cover');
		expect(fetchMock.mock.calls[0][1].body).toBe(original);
	});
});

describe('the pre-upload compression', () => {
	/**
	 * A decoded bitmap of the given size, plus a canvas whose `toBlob` returns
	 * a WebP of `encodedSize` bytes.
	 */
	function stubCanvas(
		bitmap: { width: number; height: number },
		encodedSize: number
	) {
		const drawImage = vi.fn();
		const canvas = {
			width: 0,
			height: 0,
			getContext: vi.fn(() => ({ drawImage })),
			toBlob: vi.fn((cb: (blob: Blob | null) => void) =>
				cb({ size: encodedSize, type: 'image/webp' } as Blob)
			),
		};
		vi.spyOn(document, 'createElement').mockImplementation(
			(tag: string) =>
				(tag === 'canvas'
					? canvas
					: document.createElementNS(
							'http://www.w3.org/1999/xhtml',
							tag
						)) as HTMLElement
		);
		vi.stubGlobal('createImageBitmap', async () => ({
			...bitmap,
			close: vi.fn(),
		}));
		return { canvas, drawImage };
	}

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('scales a large image down to the longest edge for its kind', async () => {
		stubApi();
		const { canvas } = stubCanvas({ width: 4000, height: 2000 }, 1024);

		await uploadTemplateImage(file('image/png', 5 * 1024 * 1024), 'cover');

		expect(canvas.width).toBe(1600);
		expect(canvas.height).toBe(800);
	});

	it('uses the smaller cap for an option image', async () => {
		stubApi();
		const { canvas } = stubCanvas({ width: 4000, height: 2000 }, 1024);

		await uploadTemplateImage(file('image/png', 5 * 1024 * 1024), 'option');

		expect(canvas.width).toBe(800);
	});

	it('never upscales an image that is already small enough', async () => {
		stubApi();
		const { canvas } = stubCanvas({ width: 400, height: 300 }, 1024);

		await uploadTemplateImage(file('image/png', 5 * 1024 * 1024), 'cover');

		expect(canvas.width).toBe(400);
		expect(canvas.height).toBe(300);
	});

	it('sends the compressed blob when it actually got smaller', async () => {
		stubApi();
		stubCanvas({ width: 4000, height: 2000 }, 1024);

		await uploadTemplateImage(file('image/png', 5 * 1024 * 1024), 'cover');

		expect(fetchMock.mock.calls[0][1].body).toMatchObject({
			size: 1024,
			type: 'image/webp',
		});
	});

	it('keeps the original when the re-encode came out bigger', async () => {
		stubApi();
		stubCanvas({ width: 4000, height: 2000 }, 9 * 1024 * 1024);
		const original = file('image/png', 5 * 1024 * 1024);

		await uploadTemplateImage(original, 'cover');

		expect(fetchMock.mock.calls[0][1].body).toBe(original);
	});
});
