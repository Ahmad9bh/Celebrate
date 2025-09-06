# Contributing

Thanks for contributing to Celebrate! This short guide covers branch naming, commit style, local checks, and PRs.

## Branch naming

- feature/* — new features (e.g., `feature/owner-dashboard`)
- fix/* — bug fixes (e.g., `fix/booking-timeout`)
- docs/* — documentation changes (e.g., `docs/testing-guide`)
- chore/* — tooling or maintenance (e.g., `chore/dep-bumps`)
- ci/* — CI workflows (e.g., `ci/upload-playwright-artifacts`)

## Commit style

Use concise, conventional prefixes:

- feat(...): new user-visible functionality
- fix(...): bug fixes
- docs(...): documentation changes
- chore(...): maintenance, refactors, tooling
- ci(...): CI/CD changes
- test(...): tests only

Examples:

- `ci(e2e): stabilize Playwright; docs: Testing & CI; prisma: binary engine for tests`
- `fix(api): prevent double booking on same date`

## Running checks locally

From repo root:

- Backend tests:
  ```bash
  npm run backend-tests
  ```
- E2E (Playwright):
  ```bash
  # first run only
  (cd frontend && npx playwright install)

  # headless
  npm run e2e

  # UI inspector
  npm run e2e:ui
  ```
- Start both apps (dev):
  ```bash
  npm run start:all
  ```
- Show last Playwright report:
  ```bash
  cd frontend
  npx playwright show-report
  ```

Notes:
- Tests use `backend/.env.test` (pooled + direct Neon URLs). Do not set URLs inline in PowerShell; edit the file.
- E2E runs Next.js in production mode to avoid dev/HMR invalid hook errors.

## Pull Requests

- Keep PRs focused and small where possible.
- Ensure CI is green before requesting review.
- Use this merge message template (edit as needed):

Title:
```
ci(e2e): stabilize Playwright; docs: Testing & CI; prisma: binary engine for tests
```

Bullets:
```
- Run Next.js in production mode during E2E to avoid dev/HMR invalid hook errors.
- Deflake E2E: add timed response waits + DOM polling in `admin_filters.spec.ts`, `soft_delete.spec.ts`, `booking.spec.ts`.
- Harden backend tests on Windows/CI via `PRISMA_CLIENT_ENGINE_TYPE=binary`; load `backend/.env.test`.
- Document direct vs pooled Neon URLs, schema isolation, and local E2E/Prisma troubleshooting in `README.md`.
- Add root scripts (`ci:test`, `ci:db:push`, `start:all`) for consistent local/CI workflows.
```

## Coding style

- TypeScript: prefer explicit types in public APIs; strict null checks.
- Keep imports at the top of files; avoid side-effect imports.
- Tests: prefer resilient waits (time-bounded response + DOM polling) over brittle fixed sleeps.

## Getting help

- Check `README.md` → Testing & CI, E2E troubleshooting, Backend tests troubleshooting.
- Open an issue with steps to reproduce and environment details.
