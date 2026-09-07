# Guest template measurement

Migration `0017_guest_template_metrics.sql` introduces the metadata-only
`guest_template_metrics` table and a measurement start timestamp. Apply it before
shipping this feature. No local template title, description, options or images
are uploaded by measurement.

`local-templates.ts` marks new templates with `measurement_version: 1` and retains
the first-play flag in localStorage. Old templates have no version and are
reported as recovered. The browser sends observations on creation, page load,
first play and reconnect; failed requests retry while the template remains in
storage. Keepalive protects the creation observation across navigation. Measurement
failures do not block local creation or play.

`POST /api/guest-templates` requires a same-origin request, validates a bounded
payload and uses the existing short-lived KV abuse limiter. That limiter buckets
a visitor by an HMAC of their address keyed with `SESSION_SECRET`, never the
address itself, so the KV namespace holds no identifier either. D1 records first
observations and first milestones idempotently by local ID. Client events cannot
set an import or conversion. Like other unauthenticated usage counters, this is
observational telemetry, not proof of unique people or a fraud-resistant metric.

`POST /api/templates` confirms conversion only after an authenticated import.
It repairs a missing observation if the browser's event was delayed or blocked.
A failed measurement after import leaves the browser copy for a retry; the
existing deterministic import ID prevents a duplicate account template. The
import retry also repairs the conversion milestone. Metric IDs remain after an
account/template is deleted, without storing an account identifier.

The companion rankmaker-admin repo queries this shared database and documents
periods, cohort conversion, historical coverage and the treatment of old imports.
Historical guest templates cannot be recovered unless their browser returns.

Validation: unit/API tests use the actual migration; the account E2E test covers
creation, first play and authenticated import through the real local Worker.
