# YourMoneyOurMoney — Requirements Traceability Matrix

> **Document Version:** 1.3.0  
> **Date:** 2026-11-05  
> **Status:** Sprint 1 verified (S1-15)  
> **Theme:** Theme 7 — Personal Money and Expense Logging (CPE 334)

This document traces requirements → features → sprints → acceptance criteria → tests → results. Acceptance criteria
(AC) are defined in the feature contracts (`docs/sprints/sprint-1/F-0x-*.md`, §6) and tests in their software test
specifications (§7). Every Sprint 1 test ID below exists in the code; §6 lists the file that holds it.

**Sprint 1 verification run (S1-15, 2026-11-05)** on `Sprint-1/staging` with all Sprint 1 features merged
(`c54abff`) plus the S1-15 E2E specs — all passing; full output in `docs/sprints/sprint-1/integration.md`:

| Suite | Command | Result |
|---|---|---|
| Server unit + API/DB | `npm --prefix server test` | 183 / 183 passed |
| Client component | `npm --prefix client test` | 69 / 69 passed |
| End-to-end (Playwright, Chromium) | `npm run test:e2e` | 7 / 7 passed (5 consecutive runs) |
| Lint · format · types | `npm run lint` · `npm run format:check` · `typecheck` | clean |

**ID rule:** an ID means one thing only. IDs reserved for Sprint 2–3 were renumbered in S1-15 where Sprint 1
contracts had already used the same number (e.g. F-06 planned `AC-ACC-07..09` → `AC-ACC-12..14`).
Result column: **Pass** = automated tests passing in the run above; **Planned** = not yet implemented.

---

## 1. Functional Requirements Traceability Matrix

| FR ID | Functional Requirement Summary | Business Rules | Feature | Sprint | Acceptance Criteria | Tests | Result |
|---|---|---|---|---|---|---|---|
| **FR-AUTH-01** | User authentication with username and password | BR-06 | F-01 | 1 | AC-AUTH-01, AC-AUTH-02, AC-AUTH-03 | T-AUTH-API-01, T-AUTH-UI-01, T-AUTH-E2E-01 | **Pass** |
| **FR-AUTH-02** | User session logout and destruction | — | F-01 | 1 | AC-AUTH-04 | T-AUTH-API-02, T-AUTH-UI-01, T-AUTH-E2E-02 | **Pass** |
| **FR-AUTH-03** | Retrieve current user profile (`/api/auth/me`) | — | F-01 | 1 | AC-AUTH-05 | T-AUTH-API-03 | **Pass** |
| **FR-AUTH-04** | Continuous session check on enabled status | BR-06 | F-01 | 1 | AC-AUTH-06 | T-AUTH-UNIT-01, T-AUTH-API-04, T-AUTH-UI-01, T-ADM-API-04 | **Pass** |
| **FR-AUTH-05** | Session expiration 24 h after login (`loginAt` + `rolling: false`) | — | F-01 | 1 | AC-AUTH-07 | T-AUTH-UNIT-01, T-AUTH-UNIT-02, T-AUTH-API-03 | **Pass** |
| **FR-AUTH-06** | Credential protection & bcrypt password hashing | — | F-01, F-14 | 1 / 3 | AC-AUTH-08; AC-PROF-01..03 (Sprint 3) | T-AUTH-UNIT-03, T-AUTH-SEC-01; T-PROF-API-01..02 (Sprint 3) | **Pass** (Sprint 1 part) |
| **FR-AUTH-07** | Self-service password modification [Added by Team] | BR-06 | F-14 | 3 | AC-PROF-01..03 | T-PROF-API-01..02 | Planned |
| **FR-ADM-01** | Admin listing of all users (no financial data) | BR-05 | F-02 | 1 | AC-ADM-01, AC-ADM-02 | T-ADM-API-01, T-ADM-UI-01, T-ADM-E2E-01 | **Pass** |
| **FR-ADM-02** | Admin toggle of user active/disabled status | BR-06, BR-07 | F-02 | 1 | AC-ADM-03 | T-ADM-API-02, T-ADM-UI-01, T-ADM-E2E-02 | **Pass** |
| **FR-ADM-03** | Prevent administrator self-disablement | BR-07 | F-02 | 1 | AC-ADM-04 | T-ADM-UNIT-01, T-ADM-API-03, T-ADM-UI-01, T-ADM-E2E-01 | **Pass** |
| **FR-ADM-04** | Financial boundary barrier for admin role | BR-05 | F-02 | 1 | AC-ADM-05 | T-ADM-API-04, T-ACC-API-09, T-TX-API-10, T-HST-API-03, S1-15 access E2E | **Pass** |
| **FR-ACC-01** | User retrieval of own accounts and balances | BR-04 | F-03 | 1 | AC-ACC-01, AC-ACC-02 | T-ACC-API-01, T-ACC-API-02, T-SUM-API-04 | **Pass** |
| **FR-ACC-02** | Account types (CASH, LOAN_TAKEN/GIVEN, INC/EXP) | — | F-03, F-06, F-08 | 1 / 2 | AC-ACC-01; AC-ACC-12..14, AC-DEBT-01..04 (Sprint 2) | T-ACC-API-01, T-ACC-SEED-01, schema DB tests; T-ACC-API-11..12, T-DEBT-API-01..03 (Sprint 2) | **Pass** (Sprint 1 part) |
| **FR-ACC-03** | Unique account name per user namespace | — | F-03, F-06 | 1 / 2 | AC-ACC-01; AC-ACC-12..14 (Sprint 2) | schema DB tests (unique name per user), T-ACC-SEED-01; T-ACC-API-11..12 (Sprint 2) | **Pass** (Sprint 1 part) |
| **FR-ACC-04** | Opening balance and date setup on CASH/LOAN | BR-03, BR-04, BR-12 | F-03, F-06 | 1 / 2 | AC-ACC-03 .. AC-ACC-09, AC-ACC-11 | T-ACC-API-03 .. T-ACC-API-09, T-ACC-UI-01, T-ACC-UI-02, T-ACC-E2E-01 | **Pass** |
| **FR-ACC-05** | Exclude opening balances from income/expense | BR-08 | F-03, F-05 | 1 | AC-ACC-10, AC-SUM-04 | T-ACC-API-10, T-SUM-UNIT-04, T-ACC-E2E-01 | **Pass** |
| **FR-ACC-06** | Custom account creation & edit (no type change with txns) | BR-03, BR-04, BR-12 | F-06 | 2 | AC-ACC-12..14 | T-ACC-API-11..12 | Planned |
| **FR-TX-01** | Payment transaction recording (CASH/LOAN_TAKEN) | BR-01, BR-02, BR-03, BR-04, BR-09, BR-10, BR-11, BR-13 | F-04, F-08, F-12 | 1 / 2 / 3 | AC-TX-02 .. AC-TX-12; AC-DEBT-01..04, AC-VOID-01..03 (later) | T-TX-UNIT-01..06, T-TX-API-02..10, T-TX-UI-01..02, T-TX-E2E-01; T-DEBT-API-01..03, T-VOID-API-01..02 (later) | **Pass** (Sprint 1 part) |
| **FR-TX-02** | Receive transaction recording (CASH source) | BR-01, BR-02, BR-03, BR-04, BR-09, BR-10, BR-11, BR-13 | F-04, F-08, F-12 | 1 / 2 / 3 | AC-TX-01, AC-TX-04 .. AC-TX-11; AC-DEBT-01..04, AC-VOID-01..03 (later) | T-TX-UNIT-01..06, T-TX-API-01, T-TX-API-04..10, T-TX-UI-02, S1-15 demo-journey E2E; T-DEBT-API-01..03, T-VOID-API-01..02 (later) | **Pass** (Sprint 1 part) |
| **FR-TX-03** | Internal account transfer recording (CASH to CASH) | BR-01, BR-02, BR-03, BR-04, BR-08, BR-09, BR-10, BR-11, BR-13 | F-07 | 2 | AC-TX-13..14 | T-TX-API-11..12 *(API already accepts CASH lines: T-TX-UNIT-01, T-SUM-UNIT-03)* | Planned |
| **FR-TX-04** | Multi-line split allocation per transaction | BR-01, BR-02 | F-04 | 1 | AC-TX-02, AC-TX-04, AC-TX-12 | T-TX-UNIT-01, T-TX-UNIT-02, T-TX-API-02, T-TX-API-04, T-TX-UI-01, T-TX-E2E-01 | **Pass** |
| **FR-TX-05** | Atomic persistence via database transaction | BR-13 | F-04, F-12 | 1 / 3 | AC-TX-11; AC-VOID-01..03 (Sprint 3) | T-TX-API-04 .. T-TX-API-09 (counts unchanged on every rejection); T-VOID-API-01..02 (Sprint 3) | **Pass** (Sprint 1 part) |
| **FR-TX-06** | Composite ownership validation on accounts | BR-04 | F-04 | 1 | AC-TX-09 | T-TX-API-09, T-ADM-API-04, schema DB tests (ownership) | **Pass** |
| **FR-TX-07** | Favorite transactions toggle and viewing (`?favorite=true`) | BR-04 | F-10 | 2 | AC-FAV-01..03 | T-FAV-API-01..02 | Planned |
| **FR-TX-08** | Transaction duplication helper | BR-04 | F-10 | 2 | AC-FAV-01..03 | T-FAV-UI-01 | Planned |
| **FR-TX-09** | Debt and loan lifecycle tracking | BR-01, BR-02, BR-03, BR-04, BR-08, BR-09, BR-10, BR-12, BR-13 | F-08 | 2 | AC-DEBT-01..04 | T-DEBT-API-01..03 | Planned |
| **FR-TX-10** | Transaction modification and voiding | BR-01, BR-02, BR-04, BR-11, BR-13 | F-12 | 3 | AC-VOID-01..03 | T-VOID-API-01..02 | Planned |
| **FR-SUM-01** | Dynamic balance computation from ledger effects | BR-03, BR-04, BR-08 | F-05, F-08 | 1 / 2 | AC-SUM-01, AC-SUM-02, AC-SUM-03, AC-SUM-05; AC-DEBT-01..04 (Sprint 2) | T-SUM-UNIT-01..03, T-SUM-API-01..04, T-ACC-API-03; T-DEBT-API-01..03 (Sprint 2) | **Pass** (Sprint 1 part) |
| **FR-SUM-02** | Consolidated summary API (`GET /api/summary`) | BR-04, BR-05, BR-08 | F-05 | 1 | AC-SUM-01, AC-SUM-02, AC-SUM-06, AC-SUM-07 | T-SUM-API-01, T-SUM-API-02, T-SUM-API-05, T-SUM-UI-01, T-SUM-E2E-01 | **Pass** |
| **FR-SUM-03** | Exclusion of non-income/expense movements | BR-08 | F-05, F-07 | 1 / 2 | AC-SUM-04, AC-ACC-10 | T-SUM-UNIT-04, T-ACC-API-10, T-SUM-API-02, T-SUM-E2E-01 | **Pass** |
| **FR-SUM-04** | Periodic financial reports & summaries (charts [Added by Team]) | BR-03, BR-04, BR-08 | F-11 | 3 | AC-REP-01..04 | T-REP-API-01..02, T-REP-UI-01 | Planned |
| **FR-HST-01** | Transaction history feed (newest first) | BR-04 | F-05 | 1 | AC-HST-01 | T-HST-API-01, T-HST-UI-01, T-SUM-E2E-01 | **Pass** |
| **FR-HST-02** | Transaction detail retrieval by ID | BR-04 | F-05 | 1 | AC-HST-02 | T-HST-API-02, T-HST-UI-01, S1-15 access E2E | **Pass** |
| **FR-HST-03** | Transaction search and date filtering | BR-04 | F-09 | 2 | AC-HST-04..06 | T-HST-API-04, T-HST-UI-02 | Planned |
| **FR-HST-04** | Data export in CSV and JSON formats [Added by Team] | BR-03, BR-04 | F-13 | 3 | AC-EXP-01..03 | T-EXP-API-01..02 | Planned |
| **FR-SYS-01** | Standardized error envelope `{ error: ... }` | — | Platform | 1 | AC-SYS-01 | errors unit tests, client `api()` tests | **Pass** |
| **FR-SYS-02** | System health probe endpoint (`/api/health`) | — | Platform | 1 | AC-SYS-02 | harness API tests (health) | **Pass** |

---

## 2. Feature Traceability Matrix (F-01 through F-14)

| Feature | Name | Sprint | Owner | FRs | BRs | Acceptance Criteria | Tests | Result |
|---|---|---|---|---|---|---|---|---|
| **F-01** | User Authentication & Session Management | **1** | Track A | FR-AUTH-01 .. FR-AUTH-06 | BR-06 | AC-AUTH-01 .. AC-AUTH-08 | T-AUTH-UNIT-01..03, T-AUTH-API-01..04, T-AUTH-SEC-01, T-AUTH-UI-01, T-AUTH-E2E-01..02 | **Pass** (S1-04 .. S1-08) |
| **F-02** | Administrator User Management | **1** | Track A | FR-ADM-01 .. FR-ADM-04 | BR-05, BR-06, BR-07 | AC-ADM-01 .. AC-ADM-05 | T-ADM-UNIT-01, T-ADM-API-01..04, T-ADM-UI-01, T-ADM-E2E-01..02 | **Pass** (S1-04, S1-06 .. S1-08) |
| **F-03** | Account Setup & Opening Balances | **1** | Track B | FR-ACC-01 .. FR-ACC-05 | BR-03, BR-04, BR-08, BR-12 | AC-ACC-01 .. AC-ACC-11 | T-ACC-API-01..10, T-ACC-SEED-01, T-ACC-UI-01..02, T-ACC-E2E-01 | **Pass** (S1-10, S1-11, S1-14) |
| **F-04** | Transaction Recording & Split Allocations | **1** | Track B | FR-TX-01, FR-TX-02, FR-TX-04, FR-TX-05, FR-TX-06 | BR-01, BR-02, BR-03, BR-04, BR-09, BR-10, BR-11, BR-13 | AC-TX-01 .. AC-TX-12 | T-TX-UNIT-01..06, T-TX-API-01..10, T-MONEY-UNIT-01..02, T-TX-UI-01..02, T-TX-E2E-01 | **Pass** (S1-10, S1-12, S1-14) |
| **F-05** | Financial Summary & Transaction History | **1** | Track B | FR-SUM-01 .. FR-SUM-03, FR-HST-01, FR-HST-02 | BR-03, BR-04, BR-05, BR-08 | AC-SUM-01 .. AC-SUM-07, AC-HST-01 .. AC-HST-03 | T-SUM-UNIT-01..04, T-SUM-API-01..05, T-HST-API-01..03, T-SUM-UI-01, T-HST-UI-01, T-SUM-E2E-01 | **Pass** (S1-10, S1-13, S1-14) |
| **F-06** | Custom Account & Category Management | 2 | Decided at sprint planning | FR-ACC-02, FR-ACC-03, FR-ACC-06 | BR-03, BR-04, BR-12 | AC-ACC-12..14 | T-ACC-API-11..12 | Planned |
| **F-07** | Internal Account Transfers | 2 | Decided at sprint planning | FR-TX-03, FR-SUM-03 | BR-01 .. BR-04, BR-08 .. BR-11, BR-13 | AC-TX-13..14 | T-TX-API-11..12 | Planned |
| **F-08** | Debt & Receivable Lifecycle (Lending & Borrowing) | 2 | Decided at sprint planning | FR-TX-09, FR-ACC-02, FR-TX-01, FR-TX-02, FR-SUM-01 | BR-01 .. BR-04, BR-08 .. BR-10, BR-12, BR-13 | AC-DEBT-01..04 | T-DEBT-API-01..03 | Planned |
| **F-09** | Transaction Search, Filtering & Sorting | 2 | Decided at sprint planning | FR-HST-03 | BR-04 | AC-HST-04..06 | T-HST-API-04, T-HST-UI-02 | Planned |
| **F-10** | Favorite & Duplicate Transactions | 2 | Decided at sprint planning | FR-TX-07, FR-TX-08 | BR-04 | AC-FAV-01..03 | T-FAV-API-01..02, T-FAV-UI-01 | Planned |
| **F-11** | Financial Reports & Periodic Spending Summaries | 3 | Decided at sprint planning | FR-SUM-04 | BR-03, BR-04, BR-08 | AC-REP-01..04 | T-REP-API-01..02, T-REP-UI-01 | Planned |
| **F-12** | Transaction Editing, Voiding & Audit Corrections | 3 | Decided at sprint planning | FR-TX-10, FR-TX-01, FR-TX-02, FR-TX-05 | BR-01, BR-02, BR-04, BR-11, BR-13 | AC-VOID-01..03 | T-VOID-API-01..02 | Planned |
| **F-13** | Data Export (CSV & JSON) [Added by Team] | 3 | Decided at sprint planning | FR-HST-04 | BR-03, BR-04 | AC-EXP-01..03 | T-EXP-API-01..02 | Planned |
| **F-14** | User Profile & Security Settings [Added by Team] | 3 | Decided at sprint planning | FR-AUTH-07, FR-AUTH-06 | BR-06 | AC-PROF-01..03 | T-PROF-API-01..02 | Planned |

---

## 3. Business Rules (BR) Traceability Matrix

| BR ID | Business Rule | Enforcing FRs | Features | Sprint | Enforcing Layer | Sprint 1 Tests | Result |
|---|---|---|---|---|---|---|---|
| **BR-01** | Allocation lines must sum exactly to the total | FR-TX-01 .. FR-TX-04, FR-TX-09, FR-TX-10 | F-04, F-07, F-08, F-12 | 1 / 2 / 3 | `validateTransaction` (`ledger.ts`) → 400 `ALLOCATION_MISMATCH`; Save disabled in the form | T-TX-UNIT-02, T-TX-UNIT-06, T-TX-API-04, T-TX-UI-01, T-TX-UI-02, S1-15 rejected-case E2E | **Pass** |
| **BR-02** | Total and every line amount > 0 | FR-TX-01 .. FR-TX-04, FR-TX-09, FR-TX-10 | F-04, F-07, F-08, F-12 | 1 / 2 / 3 | zod schema + DB CHECK constraints | T-TX-API-05, schema DB tests (amounts) | **Pass** |
| **BR-03** | Money stored and transmitted as integer satang (THB) | FR-ACC-04, FR-TX-01 .. FR-TX-03, FR-TX-09, FR-SUM-01, FR-SUM-04, FR-HST-04 | F-03 .. F-08, F-11, F-13 | 1 / 2 / 3 | Prisma `Int`, zod `.int()`, client `toSatang` / `formatBaht` | T-MONEY-UNIT-01, T-MONEY-UNIT-02, T-ACC-API-07, T-TX-API-05, T-ACC-UI-01 | **Pass** |
| **BR-04** | A user can access only their own records (other user's = 404) | FR-ACC-01, FR-ACC-04, FR-TX-01, FR-TX-02, FR-TX-06, FR-SUM-01, FR-SUM-02, FR-HST-01, FR-HST-02 (+ later FRs) | F-03 .. F-13 | 1 / 2 / 3 | `userId` filter on every query, `assertOwned`, composite FKs `(id, userId)` | T-ACC-API-02, T-ACC-API-08, T-TX-API-09, T-SUM-API-05, T-HST-API-01, T-HST-API-02, T-ADM-API-04, ownership unit tests, schema DB tests, S1-15 access E2E | **Pass** |
| **BR-05** | Administrator cannot access any financial data (403) | FR-ADM-01, FR-ADM-04, FR-SUM-02 | F-02, F-05 | 1 | `requireRole("USER")` on financial routes; admin routes select only identity fields | T-ADM-API-01, T-ADM-API-04, T-ACC-API-09, T-TX-API-10, T-HST-API-03, T-ADM-E2E-01, S1-15 access E2E | **Pass** |
| **BR-06** | Disabled user blocked at login (403) and on next request (401) | FR-AUTH-01, FR-AUTH-04, FR-ADM-02 | F-01, F-02 | 1 | login check + `requireUser` per-request `isEnabled` | T-AUTH-API-01, T-AUTH-API-04, T-AUTH-UNIT-01, T-ADM-API-02, T-ADM-API-04, T-ADM-E2E-02 | **Pass** |
| **BR-07** | Administrator cannot disable own account (400) | FR-ADM-02, FR-ADM-03 | F-02 | 1 | `assertCanChangeEnabled` → 400 `SELF_DISABLE_NOT_ALLOWED`; button disabled in UI | T-ADM-UNIT-01, T-ADM-API-03, T-ADM-UI-01, T-ADM-E2E-01 | **Pass** |
| **BR-08** | Transfers, borrowing, repayments and opening balances never count as income or expense | FR-ACC-04, FR-ACC-05, FR-TX-03, FR-TX-09, FR-SUM-01 .. FR-SUM-04 | F-03, F-04, F-05, F-07, F-08, F-11 | 1 / 2 / 3 | `computeBalances` / `summarize` (`ledger.ts`) | T-SUM-UNIT-03, T-SUM-UNIT-04, T-ACC-API-10, T-SUM-API-02, T-SUM-E2E-01 | **Pass** |
| **BR-09** | Payment source CASH/LOAN_TAKEN; Receive source CASH | FR-TX-01 .. FR-TX-03, FR-TX-09 | F-04, F-07, F-08 | 1 / 2 | `validateTransaction` → 400 `INVALID_ACCOUNT_TYPE`; form offers only allowed sources | T-TX-UNIT-03, T-TX-API-06, form component tests | **Pass** |
| **BR-10** | Allowed line types per Payment / Receive | FR-TX-01 .. FR-TX-03, FR-TX-09 | F-04, F-07, F-08 | 1 / 2 | `validateTransaction` → 400 `INVALID_ACCOUNT_TYPE`; form offers only allowed lines | T-TX-UNIT-04, T-TX-API-07, form component tests | **Pass** |
| **BR-11** | Source account cannot be one of its own lines | FR-TX-01 .. FR-TX-03, FR-TX-10 | F-04, F-07, F-12 | 1 / 2 / 3 | `validateTransaction` → 400 `VALIDATION_ERROR`; source removed from line options | T-TX-UNIT-05, T-TX-UNIT-06, T-TX-API-08, form component tests | **Pass** |
| **BR-12** | Opening balances only on CASH, LOAN_TAKEN, LOAN_GIVEN | FR-ACC-04, FR-ACC-06, FR-TX-09 | F-03, F-06, F-08 | 1 / 2 | route check → 400 `INVALID_ACCOUNT_TYPE` + DB CHECK constraint | T-ACC-API-06, schema DB tests (accounts) | **Pass** |
| **BR-13** | A transaction is saved all-or-nothing | FR-TX-01 .. FR-TX-03, FR-TX-05, FR-TX-09, FR-TX-10 | F-04, F-07, F-08, F-12 | 1 / 2 / 3 | one `prisma.$transaction` for transaction + lines | T-TX-API-04 .. T-TX-API-10 (counts unchanged after every rejection) | **Pass** |

---

## 4. Theme 7 Brief Item Compliance Matrix

### 4.1 Brief items

| Brief Ref | Topic / Requirement Area | In / Out | Mapped Specification | Sprint | Evidence | Result |
|---|---|---|---|---|---|---|
| **T7-AUTH** | User accounts & credential-based authentication | In | FR-AUTH-01 .. FR-AUTH-06, F-01 | 1 | T-AUTH-API-01..04, T-AUTH-E2E-01..02 | **Pass** |
| **T7-ISOL** | Private multi-user platform (financial isolation) | In | FR-ADM-04, BR-04, BR-05, DL-04..06 | 1 | T-ADM-API-04, T-SUM-API-05, S1-15 access E2E | **Pass** |
| **T7-ROLES** | Role-based access (User vs Admin) | In | FR-ADM-01 .. FR-ADM-04, F-02 | 1 | T-ADM-API-01..04, T-ADM-E2E-01..02 | **Pass** |
| **T7-ACCTS** | Accounts & categories (Cash, Card, Debt, Income, Expense) | In | FR-ACC-01 .. FR-ACC-03, FR-ACC-06, F-03, F-06 | 1 / 2 | T-ACC-API-01, T-ACC-SEED-01 (seeded set); account management Planned (Sprint 2) | **Pass** (Sprint 1 part) |
| **T7-OPEN** | Opening balances with opening dates | In | FR-ACC-04, FR-ACC-05, BR-08, BR-12, F-03 | 1 | T-ACC-API-03..10, T-ACC-E2E-01 | **Pass** |
| **T7-DATE** | Transaction dates on every entry | In | FR-TX-01, FR-TX-02, F-04 | 1 | T-TX-API-01, T-TX-API-05 (date validation) | **Pass** |
| **T7-LOG** | Transaction logging (Payment and Receive) | In | FR-TX-01, FR-TX-02, BR-01, BR-02, BR-09 .. BR-13, F-04 | 1 | T-TX-UNIT-01..06, T-TX-API-01..10, T-TX-E2E-01 | **Pass** |
| **T7-SPLIT** | Split allocations; lines equal total | In | FR-TX-04, BR-01, BR-02, F-04 | 1 | T-TX-UNIT-02, T-TX-API-02, T-TX-API-04, T-TX-UI-01, S1-15 rejected-case E2E | **Pass** |
| **T7-DEBT** | Outstanding loans and credit-card debt | In | Card debt: FR-SUM-02, F-05 (Sprint 1); loans: FR-TX-09, F-08 (Sprint 2) | 1 / 2 | T-SUM-API-03, T-SUM-E2E-01; T-DEBT-API-01..03 Planned | **Pass** (card debt) |
| **T7-BAL** | Balances & category summaries | In | FR-SUM-01 .. FR-SUM-03, BR-08, F-05 | 1 | T-SUM-UNIT-01..04, T-SUM-API-01..05, T-SUM-UI-01, T-SUM-E2E-01 | **Pass** |
| **T7-HIST** | Transaction history and detail | In | FR-HST-01, FR-HST-02, F-05 | 1 | T-HST-API-01..03, T-HST-UI-01 | **Pass** |
| **T7-XFER** | Transfers between own accounts *(Later sprints)* | In | FR-TX-03, F-07 | 2 | T-TX-API-11..12 | Planned |
| **T7-DUP** | Duplicate transaction *(Later sprints)* | In | FR-TX-08, F-10 | 2 | T-FAV-UI-01 | Planned |
| **T7-FAV** | Mark and view favorites *(Later sprints)* | In | FR-TX-07, F-10 | 2 | T-FAV-API-01..02 | Planned |
| **T7-FILT** | Filter and search transactions *(Later sprints)* | In | FR-HST-03, F-09 | 2 | T-HST-API-04, T-HST-UI-02 | Planned |
| **T7-CORR** | Transaction corrections *(Later sprints)* | In | FR-TX-10, F-12 | 3 | T-VOID-API-01..02 | Planned |
| **T7-REPT** | Reports and category spending summaries *(Later sprints)* | In | FR-SUM-04, F-11 | 3 | T-REP-API-01..02 | Planned |
| **T7-EXCL-1** | Period / shared budgets | **Out** | SRS §2.2 Exclusion 1 | — | N/A (excluded) | — |
| **T7-EXCL-2** | Automatic recurring transactions | **Out** | SRS §2.2 Exclusion 2 | — | N/A (excluded) | — |
| **T7-EXCL-3** | Bank integration | **Out** | SRS §2.2 Exclusion 3 | — | N/A (excluded) | — |

### 4.2 Team-added capabilities & scope decisions

| Ref | Topic | Classification | Mapped Specification | Sprint / Justification | Evidence |
|---|---|---|---|---|---|
| **T7-TEAM-01** | Data export (CSV, JSON) | Team Addition | FR-HST-04, F-13 | Sprint 3 (DL-09) | T-EXP-API-01..02 (Planned) |
| **T7-TEAM-02** | Self-service password change | Team Addition | FR-AUTH-07, F-14 | Sprint 3 (DL-09) | T-PROF-API-01..02 (Planned) |
| **T7-TEAM-03** | Visual spending charts in F-11 | Team Addition | FR-SUM-04, F-11 | Sprint 3 (DL-09) | T-REP-UI-01 (Planned) |
| **T7-TEAM-04** | Receipt photo uploads | Scope Boundary | SRS §2.2 Exclusion 4 | Excluded (DL-08) | N/A |
| **T7-TEAM-05** | Multi-currency | Scope Boundary | SRS §2.2 Exclusion 5 | Excluded (THB satang only) | N/A |

---

## 5. Non-Functional Requirements (NFR) Traceability Matrix

| NFR ID | Requirement | Measurable Target | Mechanism | Evidence | Result |
|---|---|---|---|---|---|
| **NFR-SEC-01** | Password security | bcrypt cost ≥ 10; no plaintext in DB or responses | `bcryptjs` in `seedData.ts`, `auth.routes.ts` | T-AUTH-UNIT-03, T-AUTH-SEC-01 | **Pass** |
| **NFR-SEC-02** | Session security | HTTP-only, SameSite=Lax, 24 h absolute expiry | `session.ts`, `requireUser` (`loginAt`) | T-AUTH-UNIT-01, T-AUTH-UNIT-02, T-AUTH-API-01, T-AUTH-API-03 | **Pass** |
| **NFR-SEC-03** | Anti-enumeration & tenant isolation | Other user's record → 404, identical to a missing id | `assertOwned`, composite FKs | T-ACC-API-08, T-TX-API-09, T-HST-API-02, T-ADM-API-04 | **Pass** |
| **NFR-SEC-04** | Role-based access enforcement | Wrong role → 403 on every protected route | `requireRole` middleware | T-ADM-API-04, T-ACC-API-09, T-TX-API-10, T-HST-API-03, requireRole unit tests | **Pass** |
| **NFR-PERF-01** | API response latency | p95 < 200 ms read, < 250 ms write, < 500 ms auth | Prisma queries, no N+1 per request | T-PERF-BENCH-01 | Planned |
| **NFR-PERF-02** | Database query performance | < 50 ms up to 100k records | Indexes `(userId, name)`, `(userId, date)`, `transactionId`, `accountId` | T-DB-INDEX-01 | Planned |
| **NFR-REL-01** | Data persistence across restarts | 100% of data survives restart | PostgreSQL volume (dev); managed DB (Lab 5) | T-REL-E2E-01 (Lab 5 deployment check) | Planned |
| **NFR-REL-02** | Transactional atomicity | 0 partial writes | `prisma.$transaction` | T-TX-API-04 .. T-TX-API-09 | **Pass** |
| **NFR-REL-03** | Satang accuracy | 0 satang error | integer satang; text-based `toSatang` | T-MONEY-UNIT-01, T-MONEY-UNIT-02, T-SUM-UNIT-02, T-SUM-API-02 | **Pass** |
| **NFR-COMP-01** | Browser compatibility | Chrome, Firefox, Edge | Playwright projects | Chromium: all E2E (7 / 7); Firefox / Edge: Planned | **Partial** |
| **NFR-COMP-02** | Viewport responsiveness | 360 px – 1920 px without sideways scroll | Bootstrap grid, two-column tables | Manual check at 364 px (S1-14, `integration.md`); automated T-E2E-RESPONSIVE-01 Planned | **Partial** |
| **NFR-COMP-03** | Currency presentation | THB with two decimals; exact satang conversion | `client/src/lib/money.ts` | T-MONEY-UNIT-01, T-MONEY-UNIT-02, T-SUM-UI-01 | **Pass** |
| **NFR-MAINT-01** | Code quality & static typing | 0 TS / ESLint / Prettier errors | strict TS, ESLint, Prettier | `npm run lint`, `npm run format:check`, `typecheck` | **Pass** |
| **NFR-MAINT-02** | Automated test coverage | 100% pass; BR-01 .. BR-13 covered | Vitest + Playwright | §3 (every BR has passing tests); `npm test`, `npm run test:e2e` | **Pass** |

---

## 6. Test index (where each Sprint 1 test lives)

| Test IDs | File |
|---|---|
| T-AUTH-UNIT-01..03, T-AUTH-SEC-01 (config part) | `server/test/unit/auth.unit.test.ts` |
| T-AUTH-API-01..04, T-AUTH-SEC-01 | `server/test/api/auth.api.test.ts` |
| T-ADM-UNIT-01 | `server/test/unit/admin.unit.test.ts` |
| T-ADM-API-01..03 | `server/test/api/admin.api.test.ts` |
| T-ADM-API-04 | `server/test/api/access.api.test.ts` |
| T-ACC-API-01..10, T-ACC-SEED-01 | `server/test/api/accounts.api.test.ts` |
| T-TX-UNIT-01..06 | `server/test/unit/validateTransaction.unit.test.ts` |
| T-TX-API-01..10 | `server/test/api/transactions.api.test.ts` |
| T-SUM-UNIT-01..04 | `server/test/unit/ledger.unit.test.ts` |
| T-SUM-API-01..05 | `server/test/api/summary.api.test.ts` |
| T-HST-API-01..03 | `server/test/api/history.api.test.ts` |
| schema DB tests (amounts, ownership, accounts, unique names) | `server/test/api/schema.db.test.ts` |
| harness / errors / ownership / requireRole tests | `server/test/api/harness.api.test.ts`, `server/test/unit/{errors,ownership,requireRole}.unit.test.ts` |
| T-AUTH-UI-01 | `client/test/auth.test.tsx` |
| T-ADM-UI-01 | `client/test/adminUsers.test.tsx` |
| T-ACC-UI-01..02 | `client/test/openingBalance.test.tsx` |
| T-MONEY-UNIT-01..02 | `client/test/money.test.ts` |
| T-TX-UI-01..02, form component tests | `client/test/transactionForm.test.tsx` |
| T-SUM-UI-01 | `client/test/dashboard.test.tsx` |
| T-HST-UI-01 | `client/test/history.test.tsx` |
| client `api()` tests, route-guard tests | `client/test/apiClient.test.ts`, `client/test/RequireRole.test.tsx` |
| T-AUTH-E2E-01..02, T-ADM-E2E-01..02 | `e2e/auth-admin.spec.ts` |
| T-ACC-E2E-01, T-TX-E2E-01, T-SUM-E2E-01, rejected-case E2E, access E2E | `e2e/demo-journey.spec.ts` |
