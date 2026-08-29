/**
 * Global test setup.
 *
 * Bindings live in a module-scoped object (`src/test/runtime.ts`, which vitest
 * aliases over `cloudflare:workers`), so without this a handler test that never
 * calls `apiContext()` would silently read whatever the previous test installed
 * instead of failing on a missing binding. Clearing between tests keeps each
 * one honest about what it actually set up.
 */
import { beforeEach } from 'vitest';
import { clearTestEnv } from './runtime';

beforeEach(clearTestEnv);
