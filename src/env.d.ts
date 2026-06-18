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
