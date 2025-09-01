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
