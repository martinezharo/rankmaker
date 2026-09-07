/**
 * Read a request body without ever buffering more than `maxBytes`.
 *
 * Content-Length is optional for HTTP requests, so checking that header alone
 * still lets a chunked request grow until the runtime's memory limit. Returning
 * null lets the route report a normal 413 before allocating an oversized
 * buffer.
 */
export async function readBoundedBody(
    request: Request,
    maxBytes: number
): Promise<ArrayBuffer | null> {
    if (!request.body) return new ArrayBuffer(0);

    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;

            total += value.byteLength;
            if (total > maxBytes) {
                await reader.cancel().catch(() => undefined);
                return null;
            }
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }

    const output = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        output.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return output.buffer;
}

