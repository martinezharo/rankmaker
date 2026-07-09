/**
 * Pre-deploy readiness check. Queries PRODUCTION Cloudflare and fails when:
 *   - there are D1 migrations in `migrations/` not yet applied to remote, or
 *   - a required secret from `src/lib/required-env.ts` is not set in prod.
 *
 * Run in CI (blocks merge) and by the `pre-push` git hook (blocks a push that
 * advances `main`, which is what triggers the Cloudflare deploy).
 *
 *   npx --yes tsx .github/scripts/check-deploy-readiness.ts [--migrations] [--secrets]
 *
 * With no flags it runs both checks. Needs Cloudflare auth: either
 * CLOUDFLARE_API_TOKEN in the environment (CI) or a local `wrangler login`.
 * `account_id` and the D1 database name come from `wrangler.jsonc`.
 *
 * Exit codes: 0 = ready · 1 = drift detected (required) · 2 = could not check.
 */
import { spawnSync } from 'node:child_process';
import { PRODUCTION_ENV } from '../../src/lib/required-env.ts';

const DB_NAME = 'rankmaker'; // matches d1_databases[0].database_name in wrangler.jsonc

const flags = process.argv.slice(2);
const runMigrations = flags.length === 0 || flags.includes('--migrations');
const runSecrets = flags.length === 0 || flags.includes('--secrets');

let hardFail = false; // required drift → block the deploy
let couldNotCheck = false; // auth/network → surface but don't claim "ready"

function wrangler(args: string[]): { ok: boolean; out: string } {
    const res = spawnSync('npx', ['--yes', 'wrangler@latest', ...args], {
        encoding: 'utf8',
        env: process.env,
    });
    const out = `${res.stdout ?? ''}\n${res.stderr ?? ''}`;
    return { ok: res.status === 0, out };
}

function checkMigrations() {
    process.stdout.write('→ Checking D1 migrations (remote)…\n');
    const { ok, out } = wrangler(['d1', 'migrations', 'list', DB_NAME, '--remote']);

    if (/no migrations to apply/i.test(out)) {
        process.stdout.write('  ✅ No pending migrations.\n');
        return;
    }
    const pending = [...out.matchAll(/\b(\d{4}_[\w-]+\.sql)\b/g)].map((m) => m[1]);
    if (pending.length > 0) {
        hardFail = true;
        process.stdout.write(
            `  ❌ ${pending.length} migration(s) not applied to production:\n` +
                pending.map((p) => `       - ${p}`).join('\n') +
                '\n     Run: pnpm run db:migrate:remote\n'
        );
        return;
    }
    // Neither a clean signal nor a pending list → we couldn't read the state.
    couldNotCheck = true;
    process.stdout.write(
        `  ⚠️  Could not determine migration state${ok ? '' : ' (wrangler errored)'}. Output:\n` +
            indent(out) +
            '\n'
    );
}

function checkSecrets() {
    process.stdout.write('→ Checking production secrets…\n');
    const { ok, out } = wrangler(['secret', 'list']);
    const set = parseSecretNames(out);
    if (!set) {
        couldNotCheck = true;
        process.stdout.write(
            `  ⚠️  Could not read secret list${ok ? '' : ' (wrangler errored)'}. Output:\n` +
                indent(out) +
                '\n'
        );
        return;
    }

    const secretVars = PRODUCTION_ENV.filter((v) => v.secret);
    const missingRequired = secretVars.filter((v) => v.required && !set.has(v.name));
    const missingOptional = secretVars.filter((v) => !v.required && !set.has(v.name));

    if (missingRequired.length > 0) {
        hardFail = true;
        process.stdout.write('  ❌ Missing REQUIRED secret(s) in production:\n');
        for (const v of missingRequired) {
            process.stdout.write(`       - ${v.name}  (${v.description})\n`);
        }
        process.stdout.write('     Set with: npx wrangler secret put <NAME>\n');
    }
    if (missingOptional.length > 0) {
        process.stdout.write('  ⚠️  Optional secret(s) not set (feature will degrade):\n');
        for (const v of missingOptional) {
            process.stdout.write(`       - ${v.name}  (${v.description})\n`);
        }
    }
    if (missingRequired.length === 0 && missingOptional.length === 0) {
        process.stdout.write('  ✅ All expected secrets are set.\n');
    }
    // Note: non-secret vars (secret:false) can't be seen from `secret list`.
    // The runtime /api/health probe covers those against the live bindings.
}

/** Parse the JSON array printed by `wrangler secret list` into a name set. */
function parseSecretNames(out: string): Set<string> | null {
    const start = out.indexOf('[');
    const end = out.lastIndexOf(']');
    if (start === -1 || end === -1 || end < start) return null;
    try {
        const arr = JSON.parse(out.slice(start, end + 1)) as { name?: string }[];
        return new Set(arr.map((e) => e.name).filter((n): n is string => !!n));
    } catch {
        return null;
    }
}

const indent = (s: string) =>
    s
        .trim()
        .split('\n')
        .map((l) => `       ${l}`)
        .join('\n');

if (runMigrations) checkMigrations();
if (runSecrets) checkSecrets();

if (hardFail) {
    process.stdout.write('\n✖ Deploy readiness check FAILED — fix the above before deploying.\n');
    process.exit(1);
}
if (couldNotCheck) {
    process.stdout.write(
        '\n⚠ Deploy readiness check could not run fully (missing Cloudflare auth?).\n'
    );
    process.exit(2);
}
process.stdout.write('\n✔ Production is up to date with this code.\n');
process.exit(0);
