# Roadmap

This roadmap outlines phases to complete and enhance Celebrate across backend, web, mobile, testing, DevOps, and docs.

## Phase 0 — Foundation (DONE/ONGOING)

- Ensure local/CI parity, stable envs, repeatable data, deterministic tests.
- Exit criteria:
  - `backend/.env.test` set with pooled + direct Neon URLs.
  - CI green across migrations, backend-tests, e2e-frontend.
  - E2E runs Next.js in production mode; flake points hardened.

## Phase 1 — Backend APIs

- Goals:
  - Finalize CRUD for venues, bookings, owners, and admin actions.
  - Harden auth/roles: admin vs owner vs user pathways.
  - Payments: toggleable "mock payments" and real Stripe path; stable webhooks.
- Tasks:
  - Validate and sanitize request payloads in `backend/src/server.ts`.
  - Add pagination/sorting/search for `GET /api/venues`.
  - Booking invariants (no double-booking; date windows).
  - Webhook idempotency (store processed event IDs).
  - Observability: structured logs for `payments`, `bookings`, `admin` flows.
- Exit criteria:
  - OpenAPI sketch in `docs/api_spec.md` matches implementation.
  - All endpoints respond with well-formed error shapes.

Status
- Pagination/sorting/search for `GET /api/venues`: DONE
- Standardized error shape `{ error: { code, message, details? } }`: DONE (key endpoints)
- Webhook idempotency (Stripe): DONE (uses `ProcessedEvent` table)
- Minimal structured logging (JSON lines) for payments/bookings/admin: DONE
- Remaining: finalize OpenAPI sketch and extend validation coverage

## Phase 2 — Frontend UX

- Goals:
  - Polish admin/owner dashboards. Accessible, responsive, clear empty/error states.
  - Improve filters (admin) and owner views (my venues, quick actions).
- Tasks:
  - Use `getByRole`/ARIA alignment; a11y labels and roles consistent.
  - Add skeletons/loaders and toast notifications on actions.
  - Error boundaries and “retry” flows.
- Exit criteria:
  - Lighthouse checks: a11y & performance above thresholds.
  - No console errors/warnings in normal flows.

## Phase 3 — Mobile app

- Goals:
  - Parity for browse/search/venue details; login; basic booking.
- Tasks:
  - Auth persistence with Expo SecureStore.
  - Reuse API types/responses; unify config via `.env`.
  - Offline-first list caching (SWR/React Query equivalent).
- Exit criteria:
  - iOS/Android buildable; basic smoke passes.

## Phase 4 — Testing

- Goals:
  - Expand backend unit/integration coverage.
  - Keep E2E green and fast; robust seed and cleanup strategy.
- Tasks:
  - Test factories and scenario seeds in `backend/src/seed.ts`.
  - Use polling for eventual consistency (e.g., `waitRowsContain`, backend fetch loops).
  - Playwright traces for retries; artifact upload on CI failures.
- Exit criteria:
  - Coverage thresholds: backend lines >80%, functions >75%.
  - E2E flake rate ~0 across 10+ consecutive CI runs.

## Phase 5 — DevOps

- Goals:
  - Production deploys, secrets, migrations process, observability.
- Tasks:
  - Choose hosting: backend (Render/Fly), frontend (Vercel/Netlify).
  - Secrets via platform vaults.
  - Migrations: `migrate deploy` on direct URL; release health checks.
  - Observability: app logs aggregation; basic tracing.
- Exit criteria:
  - One-click deploy to staging/prod; rollback steps documented.
  - Runbook(s) in `docs/`.

## Phase 6 — Security & compliance

- Goals:
  - Input validation, rate limiting, auth hardening, PII handling.
- Tasks:
  - Validate payloads (zod/joi) at API edges.
  - Rate-limit sensitive endpoints.
  - Centralize PII logging rules; redact tokens/keys.
- Exit criteria:
  - Security checklist in `docs/` signed off.

## Phase 7 — Performance

- Goals:
  - DB indexing, query tuning, caching, frontend bundle optimizations.
- Tasks:
  - Indexes for frequent filters (status, ownerId, city).
  - SWR cache keys & stale-while-revalidate.
  - Next.js Analyze/Lighthouse; code-split heavy routes.
- Exit criteria:
  - p95 latency targets met; Lighthouse perf >80 on key pages.

## Phase 8 — Docs & enablement

- Goals:
  - Onboarding docs, runbooks, API docs, contribution workflow.
- Tasks:
  - Keep `docs/README.md` index up to date.
  - `docs/CONTRIBUTING.md`: branch/commit style, checks, PR template.
  - Troubleshooting (Windows locks, Playwright report ports).
- Exit criteria:
  - New contributor can set up, run tests, and open a PR in <1 hour.

---

## Sprint-ready backlog (sample)

- Backend
  - Add pagination/sorting/search to `GET /api/venues`.
  - Add webhook idempotency store and tests.
  - Strengthen input validation for venue create/update.
- Frontend
  - Admin/owner tables: loading skeletons + toast notifications.
  - Improve a11y roles and labels; align Playwright selectors.
- Mobile
  - Implement login + token persistence; venue list + detail screens.
- Testing
  - Unit tests for booking invariants & admin mutations.
  - Enable Playwright trace on retry and artifact upload.
- DevOps
  - Draft deployment runbook; choose hosting; add post-deploy smoke.

## Workflow & standards

- Issues & milestones: track per phase (Phase 1 — Backend APIs, etc.).
- Branching: `feature/*`, `fix/*`, `docs/*`, `ci/*`; PRs use “Squash and merge”.
- Commit prefixes: `feat`, `fix`, `docs`, `chore`, `ci`, `test`.
- Tests green required for merge; Playwright artifacts on failure.

## Acceptance criteria

- Backend endpoint: typed responses, correct codes, validation, tests, logs.
- Frontend flow: a11y complete; includes empty/error/loading states; no console errors; resilient E2E.
- CI: all jobs green; artifacts available; reproducible.

## Risks & mitigations

- Windows file locks (Prisma): kill Node processes; remove `.prisma/client`; regenerate.
- E2E flakes: time-bounded response waits + DOM polling; Next.js in prod during E2E.
- DB contention: pooled URL for runtime, direct URL for CLI; schema isolation in CI.
