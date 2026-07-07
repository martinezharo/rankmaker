/**
 * Client-side image upload for the template form: pre-compresses to WebP
 * on a canvas (bandwidth save only — the server re-encodes whatever it
 * receives, so nothing here is trusted) and POSTs to /api/images.
 */

export const CLIENT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ACCEPTED_TYPES = /^image\/(jpeg|png|webp|gif)$/;

/** Longest edge sent over the wire; the server caps smaller per kind. */
const CLIENT_MAX_DIM = { cover: 1600, option: 800 } as const;

/** Below this size the canvas round-trip costs more than it saves. */
const COMPRESS_THRESHOLD_BYTES = 250 * 1024;

export type UploadKind = keyof typeof CLIENT_MAX_DIM;

export type UploadResult =
    | { ok: true; url: string }
    | { ok: false; error: string };

async function compressForUpload(file: File, maxDim: number): Promise<Blob> {
    // GIFs skip the canvas: drawing one keeps a single frame, and the
    // server handles the (possibly animated) original fine.
    if (file.size < COMPRESS_THRESHOLD_BYTES || file.type === 'image/gif') {
        return file;
    }
    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return file;
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/webp', 0.85)
        );
        // Older Safari encodes PNG instead of WebP — fine, the server
        // converts. Only use the result when it actually got smaller.
        if (blob && blob.size < file.size) return blob;
    } catch {
        // Undecodable here ≠ undecodable on the server; send the original.
    }
    return file;
}

/**
 * Uploads one image and resolves to its public URL or a machine-readable
 * error code ('too_large' | 'unsupported_type' | 'image_rejected' |
 * 'rate_limited' | 'upload_failed') that the form maps to i18n copy.
 */
export async function uploadTemplateImage(
    file: File,
    kind: UploadKind
): Promise<UploadResult> {
    if (!ACCEPTED_TYPES.test(file.type)) {
        return { ok: false, error: 'unsupported_type' };
    }
    if (file.size > CLIENT_MAX_UPLOAD_BYTES) {
        return { ok: false, error: 'too_large' };
    }
    const blob = await compressForUpload(file, CLIENT_MAX_DIM[kind]);
    try {
        const res = await fetch(`/api/images?kind=${kind}`, {
            method: 'POST',
            headers: { 'Content-Type': blob.type || file.type },
            body: blob,
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok && typeof data.url === 'string') {
            return { ok: true, url: data.url };
        }
        return {
            ok: false,
            error: typeof data?.error === 'string' ? data.error : 'upload_failed',
        };
    } catch {
        return { ok: false, error: 'upload_failed' };
    }
}
