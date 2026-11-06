# Sprint 1 — GitHub Issue Drafts (Theme 7: Personal Money and Expense Logging)

> Draft v0.2 — 3 Nov 2026. Sprint 1 ships with **Project Deliverable 1, Sun 8 Nov 2026, 23:59**.
> IDs `S1-xx` are draft IDs; replace them with real GitHub `#numbers` when creating the issues.
> Milestone for all issues: **Sprint 1**. Assignees: **A**, **B**, or **A + B** (pair).

## Labels to create

`setup` · `docs` · `contract` · `feature` · `backend` · `frontend` · `security` · `test` · `integration` · `release`

## Stack (from TokTickIT, adjusted)

React 18 + Vite + React Router + Bootstrap · Express 4 + TypeScript · Prisma 5 + PostgreSQL 16 (Docker) ·
`express-session` + `connect-pg-simple` + `bcryptjs` · Vitest + Supertest · React Testing Library · Playwright.
Changes: **add `zod`** (request validation), **add ESLint/Prettier** (gives Lab 5 CI a lint check), **drop Multer**
(no uploads). Money columns are Prisma `Int` holding satang.

## Business rules agreed so far (go into the SRS in S1-03)

| ID | Rule |
|---|---|
| BR-01 | A transaction's allocation lines must sum exactly to its total amount. |
| BR-02 | Total and every line amount must be > 0. |
| BR-03 | Money is stored as integer satang (THB); no floating-point money anywhere. |
| BR-04 | A User can access only their own accounts, transactions, favorites and summaries. |
| BR-05 | An Administrator cannot read or modify any user's financial data or summaries. |
| BR-06 | A disabled user cannot log in, and an existing session stops working on its next request. |
| BR-07 | An Administrator cannot disable their own account. |
| BR-08 | Transfers, borrowing, loan repayments and opening balances are never counted as income or expense. |
| BR-09 | Payment source must be CASH or LOAN_TAKEN; Receive source must be CASH. |
| BR-10 | Allowed line types — Payment: EXPENSE, LOAN_TAKEN, LOAN_GIVEN, CASH. Receive: INCOME, LOAN_GIVEN, LOAN_TAKEN, CASH. |
| BR-11 | The source account cannot appear as one of its own allocation lines. |
| BR-12 | Only CASH, LOAN_TAKEN and LOAN_GIVEN accounts have opening balances. |
| BR-13 | A transaction is saved all-or-nothing; a rejected transaction changes no balance. |

Error convention: wrong role → **403**; another user's record → **404** (does not reveal that it exists).

## Dependency map

```
S1-01 ─┬─ S1-02 ─┬─ A: S1-03, S1-04 → S1-05 → S1-06 → S1-07 → S1-08 ─┐
       │         └─ B: S1-09, S1-10 → S1-11 → S1-12 → S1-13 → S1-14 ─┼─ S1-15 → S1-16
```

A and B do not block each other after S1-02:
- B tests as a logged-in user through a **test-only login helper** built in S1-01, not through A's login.
- A writes the cross-user and admin access tests against the endpoint list in S1-02. They start failing (TDD) and pass once B's routes merge.
- Soft link only: B's UI (S1-14) uses A's login API (S1-05), which is planned to merge two days earlier.

---

## Phase 0 — Together

### S1-01 · Project scaffold, sprint branch and test harness
**Labels:** `setup` · **Assignee:** A + B · **Depends on:** — · **Blocks:** everything

Set up the repository so both tracks can start in parallel.

**Tasks**
- [ ] Monorepo with `client/` (Vite + React + TS + React Router + Bootstrap) and `server/` (Express + TS + Prisma)
- [ ] `docker-compose.yml` with PostgreSQL 16 for dev, plus a separate test database
- [ ] Branches `main` and `sprint-1`; protection: PR + 1 approving review required, no self-approval
- [ ] Project board (Backlog / Contract / In progress / Review / Done), labels, milestone **Sprint 1**
- [ ] Issue template and PR template (linked Issue, FR/BR/AC IDs, test command + result, reviewer's specific check)
- [ ] `express-session` + `connect-pg-simple` wired; `requireUser` and `requireRole(role)` middleware **signatures** with a placeholder implementation
- [ ] Test-only route `POST /api/test/login-as` mounted **only when `NODE_ENV=test`** and a `agentAs(username)` Supertest helper
- [ ] Shared error middleware returning `{ error: { code, message, details? } }`
- [ ] React app shell: layout, router, API client (`fetch` with credentials)
- [ ] ESLint + Prettier; `.env.example`; `README.md` with setup and test commands

**Done when**
- [ ] Fresh clone → documented commands → client, server, DB, migrations and one example test all run
- [ ] A test proves `/api/test/login-as` returns 404 when `NODE_ENV` is not `test`

### S1-02 · Shared contracts: data model, balance rules, API map, role matrix
**Labels:** `docs` `contract` · **Assignee:** A + B · **Depends on:** S1-01 · **Blocks:** S1-04, S1-10

Freeze what both tracks code against. Write it into `docs/system-sds.md` (draft sections) and the Prisma migration for the financial tables (`Account`, `Transaction`, `TransactionLine`).

**Tasks**
- [ ] Prisma schema + migration:
  - `User(id, username unique, passwordHash, role USER|ADMIN, isEnabled)` *(added in S1-01)*
  - `Account(id, userId, name, type CASH|LOAN_GIVEN|LOAN_TAKEN|INCOME|EXPENSE, subtype BANK|WALLET|CREDIT_CARD|null, openingBalance Int, openingDate)`
  - `Transaction(id, userId, kind PAYMENT|RECEIVE, sourceAccountId, date, totalAmount Int, note, isFavorite, createdAt)`
  - `TransactionLine(id, transactionId, accountId, amount Int)`
  - Unique `(userId, name)` on Account; FKs; check `amount > 0`
- [ ] Balance-effect table (balances are computed from opening balance + lines, not stored):

  | Form | Source effect | Line EXPENSE / INCOME | Line LOAN_TAKEN | Line LOAN_GIVEN | Line CASH |
  |---|---|---|---|---|---|
  | Payment | CASH −, or LOAN_TAKEN debt + | expense + | debt − (repayment) | receivable + (lend) | + (transfer in) |
  | Receive | CASH + | income + | debt + (borrow) | receivable − (repaid) | − (transfer out) |

- [ ] API map (all under `/api`): `POST auth/login`, `POST auth/logout`, `GET auth/me`, `GET admin/users`,
  `PATCH admin/users/:id`, `GET accounts`, `PUT accounts/:id/opening-balance`, `POST transactions`,
  `GET transactions`, `GET transactions/:id`, `GET summary` — each with role, request, response and error codes
- [ ] Role/permission matrix (USER: own financial routes; ADMIN: `admin/*` + `auth/*` only)

**Done when**
- [ ] Both members approve the PR; any later change goes through a PR reviewed by both

---

## Track A — Identity, access control, admin

### S1-03 · SRS, feature inventory and traceability matrix
**Labels:** `docs` · **Assignee:** A (B reviews) · **Depends on:** S1-02

**Tasks**
- [ ] `docs/srs.md`: actors (User, Administrator), FR with IDs, BR-01…BR-13, measurable NFRs (e.g. password hashing, response time, data survives restart), scope, exclusions (period/shared budgets, recurring transactions, bank integration), assumptions, decision log
- [ ] `docs/features.md`: feature inventory for the **whole product** (Sprint 1–3)
- [ ] `docs/traceability.md`: FR/BR → feature → sprint, with AC/test columns to fill in later

**Done when**
- [ ] Every Theme 7 brief item maps to at least one FR or an explicit exclusion

### S1-04 · Contract: F-01 Authentication and F-02 Admin user management
**Labels:** `contract` `docs` · **Assignee:** A (B reviews) · **Depends on:** S1-02 · **Blocks:** S1-05

Write `docs/sprints/sprint-1/F-01-auth.md` and `F-02-admin.md`. **Merge before any S1-05 code PR** (the course checks that contracts come before code).

**Tasks**
- [ ] Feature SDS: behavior, session lifecycle (create on login, cookie flags, expiry, destroy on logout, disabled-user check per request), validation, errors, permissions
- [ ] API spec for auth and admin endpoints (request/response/error shapes)
- [ ] Acceptance criteria with IDs (AC-01…)
- [ ] STS: test IDs, preconditions, inputs, expected results, level (unit/API/E2E), AC covered
- [ ] Definition of Done

### S1-05 · Login, logout and current user
**Labels:** `feature` `backend` `security` · **Assignee:** A · **Depends on:** S1-04

**Tasks**
- [x] Seed users: at least 2 USERs (`alice`, `bob`) and 1 ADMIN (`admin`), passwords hashed with bcryptjs *(seeded in S1-01 via `server/prisma/seedData.ts`)*
- [ ] `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- [ ] Disabled users rejected at login (BR-06)

**Done when (tests, written first)**
- [ ] Valid login → 200 + session; `me` returns id, username, role
- [ ] Wrong password and unknown user → same 401 message
- [ ] Disabled user → login refused
- [ ] After logout, `me` → 401
- [ ] No plaintext password in DB or any response

### S1-06 · Server-side authorization and access-control tests
**Labels:** `feature` `backend` `security` `test` · **Assignee:** A · **Depends on:** S1-05

Replace the placeholder guards from S1-01 with real ones and prove the access rules.

**Tasks**
- [ ] `requireUser`: 401 without a valid session; re-checks `isEnabled` each request (BR-06)
- [ ] `requireRole`: 403 for wrong role
- [x] `assertOwned(record, userId)` helper → 404 when not owned (BR-04); used by B's routes *(implemented in S1-01)*
- [ ] Every route in the S1-02 API map has a guard

**Done when (tests; financial-route tests may stay red until B's routes merge)**
- [ ] Unauthenticated request to every financial route → 401
- [ ] User 1 reading User 2's account, transaction, opening balance or summary → 404
- [ ] Admin calling any financial route → 403 (BR-05)
- [ ] User calling `admin/*` → 403
- [ ] Disabled user's existing session → 401 on next request

### S1-07 · Admin: list users, enable and disable
**Labels:** `feature` `backend` · **Assignee:** A · **Depends on:** S1-06

**Tasks**
- [ ] `GET /api/admin/users` → id, username, role, isEnabled only (no financial fields)
- [ ] `PATCH /api/admin/users/:id` with `{ isEnabled }`

**Done when (tests)**
- [ ] Admin disables a user → that user can no longer log in; re-enable → can log in
- [ ] Admin disabling self → 400 (BR-07)
- [ ] Response contains no financial data

### S1-08 · Login, logout and admin UI with E2E tests
**Labels:** `feature` `frontend` `test` · **Assignee:** A · **Depends on:** S1-05, S1-07

**Tasks**
- [ ] Login page with error message; logout in navbar; current username shown
- [ ] Frontend route guard (redirect to login; admin → admin page, user → dashboard)
- [ ] Admin user-management page with enable/disable toggle
- [ ] RTL component test for the login form

**Done when (Playwright)**
- [ ] User logs in → lands on dashboard; logs out → back to login
- [ ] Admin disables a user → that user's login shows an error
- [ ] Admin opening `/dashboard` URL is redirected / blocked

---

## Track B — Accounts, transactions, balances, summaries

### S1-09 · System-level SDS and three-sprint plan
**Labels:** `docs` · **Assignee:** B (A reviews) · **Depends on:** S1-02

**Tasks**
- [ ] `docs/system-sds.md`: architecture and stack (with reasons), data model diagram, UI structure and conventions, API conventions, role matrix, configuration/env vars, planned Docker + GCP deployment
- [ ] `docs/sprints/plan.md`: goals and feature allocation for Sprints 1–3, dependencies, what is left after Sprint 1

### S1-10 · Contract: F-03 Accounts & opening balance, F-04 Record transaction, F-05 Summary & history
**Labels:** `contract` `docs` · **Assignee:** B (A reviews) · **Depends on:** S1-02 · **Blocks:** S1-11

Write `docs/sprints/sprint-1/F-03-…`, `F-04-…`, `F-05-…`. **Merge before any S1-11 code PR.**

**Tasks**
- [ ] Feature SDS: workflow, BR-01…BR-13 as they apply, validation, error codes, permissions
- [ ] API + data spec for the endpoints, including the summary response shape
- [ ] AC with IDs, STS with test IDs and expected numbers for the demo journey, DoD

### S1-11 · Seeded accounts and opening balance
**Labels:** `feature` `backend` · **Assignee:** B · **Depends on:** S1-10

**Tasks**
- [ ] Seed per demo user: Bank (CASH/BANK), Credit Card (LOAN_TAKEN/CREDIT_CARD), Income: Salary, Interest; Expense: Dining, Groceries, Electricity, Telecom
- [ ] `GET /api/accounts` (own only)
- [ ] `PUT /api/accounts/:id/opening-balance` with amount + date

**Done when (tests)**
- [ ] Opening balance on Bank shows in its balance and **not** in income (BR-08)
- [ ] Opening balance on an INCOME or EXPENSE account → 400 (BR-12)
- [ ] Negative or non-integer amount → 400

### S1-12 · Record a Payment or Receive transaction
**Labels:** `feature` `backend` · **Assignee:** B · **Depends on:** S1-11

**Tasks**
- [ ] Zod schema for `POST /api/transactions`: kind, sourceAccountId, date, totalAmount, note, lines[]
- [ ] Pure validation function (unit-testable) for BR-01, 02, 09, 10, 11
- [ ] Save transaction + lines in one `prisma.$transaction` (BR-13); all accounts must belong to the user

**Done when (unit + API tests, written first)**
- [ ] Salary 30,000 → Bank (Receive, INCOME line) saved
- [ ] Credit-card Payment 1,500 split Dining 900 + Groceries 600 saved
- [ ] Bank Payment 1,500 to Credit Card (LOAN_TAKEN line) saved as a repayment
- [ ] Lines sum ≠ total → 400 `ALLOCATION_MISMATCH`, nothing saved
- [ ] Zero/negative amount, empty lines, wrong source type, wrong line type, source used as a line → 400
- [ ] Line pointing at another user's account → 404, nothing saved

### S1-13 · Balances, credit card debt, income/expense summary and history
**Labels:** `feature` `backend` · **Assignee:** B · **Depends on:** S1-12

**Tasks**
- [ ] `GET /api/summary`: balance per CASH account, debt per LOAN_TAKEN account, total income, total expense, totals per INCOME and EXPENSE account
- [ ] `GET /api/transactions` (own, newest first, with source and line names)
- [ ] `GET /api/transactions/:id` with lines

**Done when (tests)**
- [ ] After the Sprint 1 demo journey (opening 10,000 → salary 30,000 → card 900 + 600 → repay 1,500): Bank 38,500 · card debt 0 · income 30,000 · expense 1,500 · Dining 900 · Groceries 600
- [ ] Repayment and opening balance appear in history but not in income/expense (BR-08)

### S1-14 · Dashboard, transaction forms and history UI
**Labels:** `feature` `frontend` · **Assignee:** B · **Depends on:** S1-13 (and S1-05 for real login)

**Tasks**
- [ ] Dashboard: bank balances, card debt, income vs expense, category totals
- [ ] Opening balance form
- [ ] Payment form and Receive form: choose source, add/remove allocation lines, live "remaining to allocate"; Save disabled until it is 0
- [ ] History list and transaction detail page
- [ ] Show server error messages (e.g. allocation mismatch)
- [ ] Amounts entered/shown in baht, sent to the API in satang
- [ ] RTL test for the allocation form (remaining amount, add/remove line)

**Done when**
- [ ] The full demo journey can be done through the UI

---

## Phase 2 — Together

### S1-15 · Sprint 1 integration and demo-journey E2E test
**Labels:** `integration` `test` · **Assignee:** A + B · **Depends on:** S1-08, S1-14

**Tasks**
- [ ] All feature PRs merged into `sprint-1`; full test suite passes on the merged branch
- [ ] Playwright: the official Sprint 1 journey end to end, checking the numbers from S1-13
- [ ] Playwright: a rejected case (allocation mismatch) and an access case (User 1 cannot open User 2's transaction URL)
- [ ] Each member runs the other's track by hand; record results in `docs/sprints/sprint-1/integration.md`
- [ ] Fill AC → test → result columns in `docs/traceability.md`

### S1-16 · Release v0.1.0 and Deliverable 1 evidence index
**Labels:** `release` `docs` · **Assignee:** A + B · **Depends on:** S1-15

**Tasks**
- [ ] Release PR `sprint-1 → main`, reviewed; tag `v0.1.0`
- [ ] Save test output (command, result, commit hash) in `docs/sprints/sprint-1/test-results.md`
- [ ] `docs/sprints/sprint-1/evidence.md`: rubric part → artifact link → IDs → result
- [ ] Reproducible demo steps (seed accounts + steps) in README
- [ ] AI-use declaration and contribution table

---

**Not in Sprint 1:** creating/managing accounts, loan-given/taken flows beyond the seeds, transfer UI,
editing/correcting transactions, search and filter, favorites, duplicate, reports.
