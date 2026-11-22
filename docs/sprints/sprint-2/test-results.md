# Sprint 2 — Build and Test Results (S2-07)

> **Run:** 2026-11-22, 23:41 (UTC+7) · **Code commit:** `a8d6b06` (`Sprint-2/staging` after PR #78, the last code
> change of Sprint 2). S2-07 changes documentation only, so the Sprint 2 release on `main` contains this same code.
> **Environment:** Windows 11 Pro, Node.js 25.8.0, PostgreSQL 16.14 (Docker, `localhost:5434`), Playwright 1.64.1
> with Chromium.

## 1. Summary

| Check | Command | Passed | Failed | Skipped | Result |
|---|---|---|---|---|---|
| Server unit + API/DB (Vitest + Supertest) | `npm --prefix server test` | 265 | 0 | 0 | Pass (23 files, 63.0 s) |
| Client component (Vitest + React Testing Library) | `npm --prefix client test` | 110 | 0 | 0 | Pass (18 files, 9.6 s) |
| End-to-end (Playwright, Chromium, 1 worker) | `npm run test:e2e` | 12 | 0 | 0 | Pass (42.8 s) |
| Lint (ESLint) | `npm run lint` | — | — | — | No problems |
| Format (Prettier) | `npm run format:check` | — | — | — | All files formatted |
| Types | `npm --prefix server run typecheck`, `npm --prefix client run typecheck` | — | — | — | No errors |
| Client production build | `npm --prefix client run build` | — | — | — | Built |

**Total automated tests: 387 passed, 0 failed, 0 skipped** (Sprint 1 release: 259). No test is marked `skip`,
`todo`, `only` or `fails`. CI (`test-and-docker`) runs the server and client suites, lint, format, types and the
Docker build on every PR; it does **not** run Playwright, so the E2E results above come from this local run.

## 2. Tests per file

### 2.1 Server (`server/test/`)

| File | Level | Tests | Main IDs | Sprint |
|---|---|---|---|---|
| `unit/ledger.unit.test.ts` | Unit | 17 | T-SUM-UNIT-01…04 | 1 |
| `unit/validateTransaction.unit.test.ts` | Unit | 23 | T-TX-UNIT-01…06 | 1 |
| `unit/auth.unit.test.ts` | Unit | 13 | T-AUTH-UNIT-01…03 | 1 |
| `unit/admin.unit.test.ts` · `errors` · `ownership` · `requireRole` | Unit | 2 · 5 · 3 · 3 | T-ADM-UNIT-01, integration points | 1 |
| `unit/accounts.unit.test.ts` | Unit | 21 | T-ACC-UNIT-01 | 2 (F-06) |
| `unit/transactionQuery.unit.test.ts` | Unit | 22 | T-HST-UNIT-01 | 2 (F-09) |
| `api/accounts.api.test.ts` | API | 23 | T-ACC-API-01…10, T-ACC-SEED-01 | 1 (shape revised by F-06) |
| `api/accountManagement.api.test.ts` | API / DB | 20 | T-ACC-API-11…21, T-ACC-DB-01 | 2 (F-06) |
| `api/transactions.api.test.ts` | API | 25 | T-TX-API-01…10 | 1 |
| `api/transfers.api.test.ts` | API | 3 | T-TX-API-11, 12, 14 | 2 (F-07) |
| `api/loans.api.test.ts` | API | 3 | T-DEBT-API-01, 02, 04 | 2 (F-08) |
| `api/history.api.test.ts` | API | 5 | T-HST-API-01…03 | 1 (shape revised by F-09) |
| `api/historySearch.api.test.ts` | API | 6 | T-HST-API-04…09 | 2 (F-09) |
| `api/favorites.api.test.ts` | API | 3 | T-FAV-API-01…03 | 2 (F-10) |
| `api/summary.api.test.ts` | API | 6 | T-SUM-API-01…05 | 1 |
| `api/auth.api.test.ts` | API | 19 | T-AUTH-API-01…04, T-AUTH-SEC-01 | 1 |
| `api/admin.api.test.ts` · `access.api.test.ts` | API | 4 · 6 | T-ADM-API-01…04 (access suite extended by F-10) | 1 |
| `api/schema.db.test.ts` · `harness.api.test.ts` | DB / API | 22 · 11 | schema constraints, test harness | 1 |

### 2.2 Client (`client/test/`)

| File | Tests | Main IDs | Sprint |
|---|---|---|---|
| `money.test.ts` | 25 | T-MONEY-UNIT-01…02 | 1 |
| `transactionForm.test.tsx` | 6 | T-TX-UI-01…03 | 1 |
| `openingBalance.test.tsx` | 8 | T-ACC-UI-01…03 | 1 |
| `dashboard.test.tsx` · `history.test.tsx` | 5 · 10 | T-SUM-UI-01; T-HST-UI-01…04 | 1, 2 (F-07, F-09) |
| `auth.test.tsx` · `adminUsers.test.tsx` · `RequireRole.test.tsx` · `apiClient.test.ts` | 9 · 3 · 6 · 5 | T-AUTH-UI-01, T-ADM-UI-01, guards, `api()` | 1 |
| `newAccount.test.tsx` · `accountsPage.test.tsx` | 1 · 1 | T-ACC-UI-04, T-ACC-UI-05 | 2 (F-06) |
| `transfers.test.ts` · `transferForm.test.tsx` | 6 · 3 | T-TRF-UNIT-01, T-TRF-UI-01…03 | 2 (F-07) |
| `loans.test.ts` · `loansPage.test.tsx` | 4 · 8 | T-DEBT-UNIT-01, T-DEBT-UI-01…02 | 2 (F-08) |
| `dateRanges.test.ts` | 3 | T-HST-UNIT-02 | 2 (F-09) |
| `duplicate.test.ts` · `favorites.test.tsx` | 2 · 5 | T-FAV-UNIT-01, T-FAV-UI-01…03 | 2 (F-10) |

### 2.3 End-to-end (`e2e/`)

| # | Spec | Test | Sprint |
|---|---|---|---|
| 1 | `account-management.spec.ts` | T-ACC-E2E-02 — create Wallet, fund it, pay from it | 2 (F-06) |
| 2–5 | `auth-admin.spec.ts` | T-AUTH-E2E-01…02, T-ADM-E2E-01…02 | 1 |
| 6 | `demo-journey.spec.ts` | T-ACC-E2E-01 / T-TX-E2E-01 / T-SUM-E2E-01 — **Sprint 1 demo journey** (Bank 38,500.00, card 0, income 30,000.00, expense 1,500.00) | 1 (continuity) |
| 7 | `demo-journey.spec.ts` | rejected case BR-01 (UI and API) | 1 |
| 8 | `demo-journey.spec.ts` | access case BR-04 / BR-05 | 1 |
| 9 | `favorites.spec.ts` | T-FAV-E2E-01 — star, duplicate from the dashboard, save dated today | 2 (F-10) |
| 10 | `history-search.spec.ts` | T-HST-E2E-01 — filter Account = Dining | 2 (F-09) |
| 11 | `loans.spec.ts` | T-DEBT-E2E-01 — lend 5,000.00, 2,000.00 repaid; Ben 3,000.00, Bank 35,500.00 | 2 (F-08) |
| 12 | `transfers.spec.ts` | T-TX-E2E-02 — transfer 2,000.00 Bank → Wallet | 2 (F-07) |

## 3. Reproduce

```bash
docker compose up -d                     # PostgreSQL 16 on localhost:5434
npm --prefix server test                 # uses ymom_test
npm --prefix client test
npm run test:e2e                         # uses ymom_e2e, own API/client ports 3100 / 5174
npm run lint && npm run format:check
npm --prefix server run typecheck && npm --prefix client run typecheck
npm --prefix client run build
```
