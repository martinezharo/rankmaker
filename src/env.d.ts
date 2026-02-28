/// <reference types="astro/client" />

type KVNamespace = {
    put(key: string, value: string): Promise<void>;
    get(key: string): Promise<string | null>;
    delete(key: string): Promise<void>;
    list(): Promise<{ keys: { name: string }[] }>;
};

type Runtime = {
    env: {
        KV: KVNamespace;
    };
    cf: Record<string, unknown>;
};

declare namespace App {
    interface Locals {
        runtime: Runtime;
    }
}
