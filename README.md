# Celebrate

A full-stack platform to discover, compare, and book event venues. Web (Next.js), Mobile (Expo), Backend (Express + TypeScript). Multi-language (EN/AR) and multi-currency (GBP + Gulf currencies) ready.

## Structure
- `/frontend` – Next.js app router web app
- `/mobile` – Expo React Native mobile app (iOS/Android)
- `/backend` – Express + TypeScript REST API with in-memory seed data
- `/docs` – Documentation (user flows, API spec, database schema)

## Quick start

Prereqs: Node 18+, npm or pnpm, Git.

### Backend
```
cd backend
npm install
npm run dev
```
Server: http://localhost:4000

### Frontend
```
cd frontend
npm install
npm run dev
```
Web: http://localhost:3000

### Mobile (Expo)
```
cd mobile
npm install
npm run start
```
Scan with Expo Go app (or run `npm run android` / `npm run ios`).

## Environment variables
Create `.env` files in each package from the provided `.env.example` files.

- Backend (`/backend/.env`):
```
PORT=4000
JWT_SECRET=dev-secret
STRIPE_SECRET_KEY=sk_test_xxx
ALLOWED_ORIGINS=http://localhost:3000
```

- Frontend (`/frontend/.env.local`):
```
NEXT_PUBLIC_API_BASE=http://localhost:4000
NEXT_PUBLIC_DEFAULT_CURRENCY=GBP
NEXT_PUBLIC_DEFAULT_LANG=en
```

- Mobile (`/mobile/.env`):
```
EXPO_PUBLIC_API_BASE=http://localhost:4000
EXPO_PUBLIC_DEFAULT_CURRENCY=GBP
EXPO_PUBLIC_DEFAULT_LANG=en
```

## Notes
- Data is in-memory for now via `backend/src/seed.ts`.
- Replace payment stubs with real Stripe + local gateways later.
- Designed for UK + Gulf first; currencies and locales are configurable.

## Local Development Setup

### Backend
```bash
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm test
```

### Frontend
```bash
cd frontend
npm ci
# Install Playwright browsers (first run only)
npx playwright install
# Run E2E tests
npm run test:e2e
```

Note: Run each block from the indicated directory (`backend/` or `frontend/`). The Prisma commands only apply to the backend.

## Running Prisma & Tests

Run all Prisma commands and tests from `backend/`:

```bash
cd backend
npx prisma generate
npx prisma db push --force-reset --skip-generate
npm test
```

Note: You can also run Prisma from the repo root now (schema mapped via `package.json`), e.g. `npx prisma generate`.

### Safe local testing with backend/.env.test

Important: backend tests reset the database schema before running. To avoid touching your dev/prod DB, use a dedicated test database via `backend/.env.test`.

Steps:

1) Create `backend/.env.test` from the example:

```
cp backend/.env.test.example backend/.env.test
```

2) Set these variables in `backend/.env.test` to a SAFE test DB/branch:

- `DATABASE_URL` (pooled; e.g. Neon pooler host with `sslmode=require&pgbouncer=true&connection_limit=1`)
- `DIRECT_DATABASE_URL` (direct host; used by Prisma CLI for reset/push)
- Optional: `SHADOW_DATABASE_URL`

3) Install backend dev deps (adds `dotenv-cli` which loads `.env.test` for test Prisma commands):

```
cd backend
npm install
```

4) Run backend tests from repo root or backend directory:

```
# from repo root
npm run backend-tests

# or from backend/
npm test
```

The backend test pre-script will load `backend/.env.test` and run `prisma db push --force-reset --skip-generate` against the test database only.

Note: Keep your regular dev `.env` pointing at your dev database; tests will not use it once `.env.test` is present.

## Environment Variables

Below are the key env vars. Store real secrets only in `.env` files (not committed). Values below are examples for local development only.

### backend/.env

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Postgres connection string used by the app and Prisma Client |
| `JWT_SECRET` | Secret for signing JWTs in dev |
| `STRIPE_SECRET_KEY` | Stripe secret (use a test key in dev) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret (dev) |
| `ALLOWED_ORIGINS` | Comma-separated origins allowed by CORS |

Example (dev only):

```env
# backend/.env (example – do NOT commit real secrets)
DATABASE_URL=postgresql://neondb_owner:npg_VZzyg1Oa2JmX@ep-lively-scene-ab78tzb2-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
JWT_SECRET=dev-secret
STRIPE_SECRET_KEY=sk_test_example
STRIPE_WEBHOOK_SECRET=whsec_mock
ALLOWED_ORIGINS=http://localhost:3000,https://celebrate.vercel.app
```

### frontend/.env.local

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_API_BASE` | Backend API base URL |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |

Example (dev only):

```env
# frontend/.env.local (example – do NOT commit real secrets)
NEXT_PUBLIC_API_BASE=http://localhost:4000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_dummy
```

## CI Setup (GitHub Actions)

This repo includes `.github/workflows/ci.yml` to run Prisma schema setup, backend tests, and frontend E2E tests.

### Required GitHub Actions Secrets

Set these in GitHub → Settings → Secrets and variables → Actions:

- `PG_TEST_DATABASE_URL` — pooled Postgres URL for app runtime/tests (e.g., Neon "-pooler").
- `PG_TEST_DIRECT_DATABASE_URL` — DIRECT/non-pooled URL used by Prisma CLI (migrations/schema push).
- `PG_TEST_SHADOW_DATABASE_URL` — shadow DB used by Prisma migration engine (safe to set even if using `db push`).
- `JWT_SECRET` — secret for signing JWTs in CI (any non-empty string is fine for tests).

### What CI runs

- __Schema setup (backend)__
  - Uses DIRECT (non-pooled) URL for Prisma CLI.
  - Applies schema via `db push` to an isolated schema name per job: `&schema=<job>_${{ github.run_id }}`.
  - Note: we pin Prisma CLI to 5.22.x for stability. Upgrade to 6.x later with the migration guide.
- __Backend tests (Vitest)__
  - Runs with pooled URL.
  - Forces `PRISMA_CLIENT_ENGINE_TYPE=binary` for maximum stability on Windows/CI.
  - Ignores env files by setting `PRISMA_IGNORE_ENV_FILES=1` and loads `backend/.env.test` explicitly where needed.
- __Frontend E2E (Playwright)__
  - Starts backend on port 4000 and Next.js on port 3000.
  - In CI, Next.js is built and started in production mode (disables dev HMR to avoid React invalid-hook errors).
  - Uploads HTML report and raw `test-results` on failure for debugging.

### Notes

- __Do not commit__ real `.env` files. Use GitHub Actions secrets.
- __Prisma CLI must use the DIRECT URL__; apps/tests should use the pooled URL.
- Node modules are cached in CI via `actions/setup-node`.
- Schemas are isolated per job/run to prevent test interference.

Prisma versioning: CI currently pins `prisma@5.22.0`. Ignore local upgrade prompts to v6 until we coordinate a repo-wide upgrade.

## Health Endpoints

The backend exposes two health endpoints for convenience:

- `GET /api/health` → returns `{ ok: true }`
- `GET /health` → returns `{ ok: true }`

These are served by `backend/src/server.ts` and are available when running `npm run start:api`.

## Root Scripts Recap

From the repo root `package.json`:

- `start:api` → runs backend dev server (port 4000)
- `start:web` → runs frontend dev server (port 3000)
- `test:all` → backend unit tests + frontend E2E
- `ci:test` → backend tests then frontend E2E (useful locally to mirror CI)
- `ci:db:push` → run Prisma `db push` against `backend/prisma/schema.prisma`
- `start:all` → run both backend and frontend together (dev)
- `db:seed` → seeds database using `backend/prisma/seed.ts`
- `db:reset` → resets DB then seeds
- `db:generate` → Prisma client generate (backend)

## E2E stability tips

- __Wait for the network and the UI__:
  - Wrap state-changing clicks (approve/suspend/delete) in `Promise.all([waitForResponse, click])`.
  - After filter toggles, wait for the admin list to reload and then assert DOM with a polling helper.
- __Use the DOM polling helper__ for eventual UI consistency:
  - `frontend/tests/e2e/_utils.ts` provides `waitRowsContain(page, tableTestId, rowTestId, text, expectedCount, timeout)`.
  - Prefer this over only `toHaveCount()` when CI is under load.
- __Run Next.js in production__ during CI to avoid React invalid hook errors.
- __Keep timeouts realistic in CI__: tests use longer timeouts under `CI=true`.

## Local E2E troubleshooting

- __Run only a single spec__ to iterate quickly:
  ```bash
  # from repo root
  npm run e2e -- --grep "Admin filters"
  # or explicitly point to a spec
  npm run e2e -- tests/e2e/admin_filters.spec.ts
  ```

- __Useful Playwright env vars__ (set before running):
  ```bash
  # increase log verbosity
  DEBUG=pw:api
  # slow motion to observe behavior (ms)
  PWDEBUG=console
  # headful mode
  HEADED=1
  ```

- __Open the last HTML report locally__:
  ```bash
  # from frontend/
  cd frontend
  npx playwright show-report
  # or specify a path
  npx playwright show-report playwright-report
  ```

- __Record a trace__ for failures and inspect:
  ```bash
  # Playwright config already enables trace on first retry; to force it:
  PLAYWRIGHT_TRACE=on npm run e2e
  # Then open traces from the HTML report or with:
  npx playwright show-trace path/to/trace.zip
  ```

## Direct vs pooled URLs (Prisma + Neon)

- __Applications/Prisma Client__: use the pooled URL (Neon pooler host) with `sslmode=require`.
- __Prisma CLI (db push, migrate)__: use the DIRECT URL (non-pooled host) to avoid transaction/visibility issues.
- In CI, we also isolate schemas per job/run by appending `&schema=<job>_${{ github.run_id }}`.

## Backend tests troubleshooting (Vitest + Prisma)

- __Use a dedicated test env__: copy `backend/.env.test.example` to `backend/.env.test` and point it to a SAFE test DB/branch. Test scripts already set `PRISMA_IGNORE_ENV_FILES=1`.
- __Direct vs pooled URLs__:
  - Prisma CLI (db push/migrate): `DIRECT_DATABASE_URL` (non-pooled host) for reliability.
  - App/Prisma Client at runtime: `DATABASE_URL` (pooled host) for connection efficiency.
- __Windows stability__: tests set `PRISMA_CLIENT_ENGINE_TYPE=binary` in `backend/package.json` to avoid platform-specific flakiness.
- __Run a single test__ (from repo root):
  ```bash
  npm run backend-tests -- -t "your test name"
  # or run watch mode
  npm run test:watch --workspace backend
  ```
- __Increase logging when debugging Prisma__:
  ```bash
  # verbose Prisma engine logs
  DEBUG=prisma:engine npm run backend-tests
  # or log queries (requires client config support)
  PRISMA_LOG_LEVEL=query npm run backend-tests
  ```
- __Manual schema reset (DANGER: test DB only)__:
  ```bash
  # from repo root
  npm run db:reset
  # quick reset via db push (no migrate history)
  npm run ci:db:push
  ```
