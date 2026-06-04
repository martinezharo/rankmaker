/// <reference types="astro/client" />

type KVListResult = {
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
};

type KVNamespace = {
    put(key: string, value: string): Promise<void>;
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

type Runtime = {
    env: {
        'rm-times-ranked': KVNamespace;
        DB: D1Database;
    };
    cf: Record<string, unknown>;
};

declare namespace App {
    interface Locals {
        runtime: Runtime;
    }
}
