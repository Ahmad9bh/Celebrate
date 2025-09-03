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

- Prisma schema application in `backend/`:
  - Fallback path for reliability: `npx prisma db push --force-reset --skip-generate`.
  - TODO: Switch back to `npx prisma migrate deploy` when migrations are stable.
- Backend unit tests from `backend/` with pooled DB URL.
- Frontend Playwright E2E from `frontend/` (browsers installed in CI, HTML report uploaded on failure).

### Notes

- Do NOT commit real `.env` files. All sensitive values should be provided via GitHub Actions secrets.
- Prisma CLI must use the DIRECT (non-pooled) URL; applications/tests should use the pooled URL.
- Node modules are cached in CI via `actions/setup-node` with `cache: npm`.

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
- `db:seed` → seeds database using `backend/prisma/seed.ts`
- `db:reset` → resets DB then seeds
