/// <reference types="astro/client" />

type KVListResult = {
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
};

type KVNamespace = {
    put(
        key: string,
        value: string,
        options?: { expirationTtl?: number }
    ): Promise<void>;
    get(key: string): Promise<string | null>;
    delete(key: string): Promise<void>;
    list(options?: {
        prefix?: string;
        cursor?: string;
        limit?: number;
    }): Promise<KVListResult>;
};

type D1Result<T = Record<string, unknown>> = {
    results: T[];
    success: boolean;
    /** Not populated by every adapter — treat a missing value as unknown, not 0. */
    meta?: { changes?: number };
};

type D1PreparedStatement = {
    bind(...values: unknown[]): D1PreparedStatement;
    all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
    first<T = unknown>(column?: string): Promise<T | null>;
    run(): Promise<D1Result>;
};

type D1Database = {
    prepare(query: string): D1PreparedStatement;
    exec(query: string): Promise<unknown>;
    batch<T = Record<string, unknown>>(
        statements: D1PreparedStatement[]
    ): Promise<D1Result<T>[]>;
};

type R2ObjectBody = {
    body: ReadableStream<Uint8Array>;
    httpMetadata?: { contentType?: string };
};

type R2Bucket = {
    put(
        key: string,
        value: ArrayBuffer | ReadableStream<Uint8Array>,
        options?: {
            httpMetadata?: { contentType?: string; cacheControl?: string };
        }
    ): Promise<unknown>;
    get(key: string): Promise<R2ObjectBody | null>;
    delete(keys: string | string[]): Promise<void>;
};

/** Cloudflare Images binding — used to re-encode uploads server-side. */
type ImageTransformationResult = {
    contentType(): string;
    image(): ReadableStream<Uint8Array>;
    response(): Response;
};

type ImageTransformer = {
    transform(options: {
        width?: number;
        height?: number;
        fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
    }): ImageTransformer;
    output(options: {
        format: 'image/webp' | 'image/avif' | 'image/jpeg' | 'image/png';
        quality?: number;
    }): Promise<ImageTransformationResult>;
};

type ImagesBinding = {
    input(data: ReadableStream<Uint8Array> | ArrayBuffer): ImageTransformer;
    info(
        data: ReadableStream<Uint8Array>
    ): Promise<{ format: string; fileSize?: number; width?: number; height?: number }>;
};

type Ai = {
    run(
        model: string,
        inputs: {
            messages: {
                role: 'system' | 'user' | 'assistant';
                content: string;
            }[];
            max_tokens?: number;
            temperature?: number;
        }
    ): Promise<{ response?: string }>;
};

type Runtime = {
    env: {
        'rm-times-ranked': KVNamespace;
        DB: D1Database;
        AI: Ai;
        IMAGES: ImagesBinding;
        IMAGES_BUCKET: R2Bucket;
        /** OpenAI key for the (free) image moderation endpoint. When unset
         *  (local dev), uploads skip moderation with a console warning. */
        OPENAI_API_KEY?: string;
        /** Public base URL for uploaded images. Defaults to
         *  https://img.rankmaker.net in prod and /api/images in dev. */
        IMAGES_PUBLIC_BASE?: string;
        GITHUB_CLIENT_ID: string;
        GITHUB_CLIENT_SECRET: string;
        SESSION_SECRET: string;
        /** Resend API key — when unset, notification emails are skipped. */
        RESEND_API_KEY?: string;
        /** Verified Resend sender, e.g. "RANKMAKER <notifications@rankmaker.net>". */
        RESEND_FROM?: string;
        /** Absolute base URL for links in emails (defaults to https://rankmaker.net). */
        SITE_URL?: string;
    };
    cf: Record<string, unknown>;
    /** Cloudflare execution context — `waitUntil` keeps fire-and-forget work
     *  (notification emails) alive after the response is returned. */
    ctx: { waitUntil(promise: Promise<unknown>): void };
};

declare namespace App {
    interface Locals {
        runtime: Runtime;
        /** Active UI locale, resolved from the URL prefix in middleware. */
        locale: import('./i18n/config').Locale;
    }
}
