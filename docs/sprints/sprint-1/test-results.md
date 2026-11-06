# Sprint 1 — Build and Test Results (S1-16)

> **Run:** 2026-11-06, 12:38 (UTC+7) · **Code commit:** `516399e` (`Sprint-1/staging` after PR #31, the last code
> change of Sprint 1). S1-16 changes documentation only, so the release `v0.1.0` contains this same code.
> **Environment:** Windows 11 Pro, Node.js 25.8.0, PostgreSQL 16.14 (Docker, `localhost:5434`), Playwright 1.64.1
> with Chromium.

## 1. Summary

| Check | Command | Passed | Failed | Skipped | Result |
|---|---|---|---|---|---|
| Server unit + API/DB (Vitest + Supertest) | `npm --prefix server test` | 183 | 0 | 0 | Pass (16 files, 45.8 s) |
| Client component (Vitest + React Testing Library) | `npm --prefix client test` | 69 | 0 | 0 | Pass (9 files, 8.0 s) |
| End-to-end (Playwright, Chromium, 1 worker) | `npm run test:e2e` | 7 | 0 | 0 | Pass (26.4 s) |
| Lint (ESLint) | `npm run lint` | — | — | — | No problems |
| Format (Prettier) | `npm run format:check` | — | — | — | All files formatted |
| Types | `npm --prefix server run typecheck`, `npm --prefix client run typecheck` | — | — | — | No errors |
| Client production build | `npm --prefix client run build` | — | — | — | Built |

**Total automated tests: 259 passed, 0 failed, 0 skipped.** No test is marked `skip`, `todo`, `only` or
`fails`. The server and E2E suites need the Docker database (`docker compose up -d`); each uses its own
database (`ymom_test`, `ymom_e2e`), never the dev database.

## 2. Tests per file

### 2.1 Server (`server/test/`)

| File | Level | Tests | Main IDs |
|---|---|---|---|
| `unit/ledger.unit.test.ts` | Unit | 17 | T-SUM-UNIT-01…04 (balances, summary) |
| `unit/validateTransaction.unit.test.ts` | Unit | 23 | T-TX-UNIT-01…06 |
| `unit/auth.unit.test.ts` | Unit | 10 | T-AUTH-UNIT-01…03, T-AUTH-SEC-01 |
| `unit/admin.unit.test.ts` | Unit | 2 | T-ADM-UNIT-01 (BR-07) |
| `unit/requireRole.unit.test.ts` | Unit | 3 | `requireRole` |
| `unit/ownership.unit.test.ts` | Unit | 3 | `assertOwned` (BR-04) |
| `unit/errors.unit.test.ts` | Unit | 5 | Error response shape |
| `api/auth.api.test.ts` | API + DB | 19 | T-AUTH-API-01…04, T-AUTH-SEC-01 |
| `api/access.api.test.ts` | API + DB | 6 | T-ADM-API-04 (role matrix, BR-04…BR-06) |
| `api/admin.api.test.ts` | API + DB | 4 | T-ADM-API-01…03 |
| `api/accounts.api.test.ts` | API + DB | 23 | T-ACC-API-01…10, T-ACC-SEED-01 |
| `api/transactions.api.test.ts` | API + DB | 25 | T-TX-API-01…10 |
| `api/summary.api.test.ts` | API + DB | 6 | T-SUM-API-01…05 |
| `api/history.api.test.ts` | API + DB | 5 | T-HST-API-01…03 |
| `api/schema.db.test.ts` | DB | 22 | Database constraints (BR-02, BR-04, BR-12) |
| `api/harness.api.test.ts` | API | 10 | Test harness, test-only route off outside `test` |
| **Total** | | **183** | |

### 2.2 Client (`client/test/`)

| File | Tests | Main IDs |
|---|---|---|
| `money.test.ts` | 25 | T-MONEY-UNIT-01…02 (satang parsing and formatting) |
| `auth.test.tsx` | 9 | T-AUTH-UI-01 |
| `RequireRole.test.tsx` | 6 | Route guard by role |
| `apiClient.test.ts` | 5 | 401 handling, error shape |
| `adminUsers.test.tsx` | 3 | T-ADM-UI-01 |
| `dashboard.test.tsx` | 5 | T-SUM-UI-01 |
| `openingBalance.test.tsx` | 7 | T-ACC-UI-01…02 |
| `transactionForm.test.tsx` | 5 | T-TX-UI-01…02 |
| `history.test.tsx` | 4 | T-HST-UI-01 |
| **Total** | **69** | |

### 2.3 End-to-end (`e2e/`)

| # | Test | Result |
|---|---|---|
| 1 | T-AUTH-E2E-01: invalid password shows alert; valid login as alice lands on `/dashboard` | Pass |
| 2 | T-AUTH-E2E-02: Log out returns to `/login` and blocks `/dashboard` | Pass |
| 3 | T-ADM-E2E-01: admin sees the user list and is redirected away from `/dashboard` | Pass |
| 4 | T-ADM-E2E-02: admin disables alice → her login is refused → re-enabled → she logs in | Pass |
| 5 | T-ACC-E2E-01 / T-TX-E2E-01 / T-SUM-E2E-01: the demo journey gives Bank 38,500.00, card 0.00, income 30,000.00, expense 1,500.00 | Pass |
| 6 | Rejected case (BR-01): unallocated lines cannot be saved in the UI and the API returns 400 | Pass |
| 7 | Access case (BR-04, BR-05): alice cannot open bob's transaction; admin cannot reach financial pages | Pass |

Each Sprint 1 acceptance criterion is mapped to its test ID, test file/name and result in
`docs/traceability.md` §6. Manual checks are recorded separately in `docs/sprints/sprint-1/integration.md` §3.

## 3. Output excerpts

```text
$ npm --prefix server test
 Test Files  16 passed (16)
      Tests  183 passed (183)
   Duration  45.82s

$ npm --prefix client test
 Test Files  9 passed (9)
      Tests  69 passed (69)
   Duration  7.97s

$ npm run test:e2e
Running 7 tests using 1 worker
  ok 1 e2e\auth-admin.spec.ts:11:3 › … › T-AUTH-E2E-01 … (1.3s)
  ok 2 e2e\auth-admin.spec.ts:35:3 › … › T-AUTH-E2E-02 … (757ms)
  ok 3 e2e\auth-admin.spec.ts:53:3 › … › T-ADM-E2E-01 … (703ms)
  ok 4 e2e\auth-admin.spec.ts:80:3 › … › T-ADM-E2E-02 … (1.7s)
  ok 5 e2e\demo-journey.spec.ts:13:3 › … › T-ACC-E2E-01 / T-TX-E2E-01 / T-SUM-E2E-01 … (3.3s)
  ok 6 e2e\demo-journey.spec.ts:90:3 › … › rejected case … (BR-01) (1.0s)
  ok 7 e2e\demo-journey.spec.ts:129:3 › … › access case … (BR-04, BR-05) (1.9s)
  7 passed (26.4s)

$ npm run lint            → (no output: no problems)
$ npm run format:check    → All matched files use Prettier code style!
$ npm --prefix client run build → ✓ built in 958ms
```
