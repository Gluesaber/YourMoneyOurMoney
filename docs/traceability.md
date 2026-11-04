# YourMoneyOurMoney — Requirements Traceability Matrix

> **Document Version:** 1.2.0  
> **Date:** 2026-11-04  
> **Status:** Draft  
> **Theme:** Theme 7 — Personal Money and Expense Logging (CPE 334)

This document establishes bidirectional traceability between business requirements, functional requirements, business rules, features, sprints, acceptance criteria, and verification test specifications. Columns for Acceptance Criteria and Test IDs cite real test files (`file › test name`) where implemented in S1-01/S1-02, and `(planned)` where scheduled for S1-05+ or Sprints 2–3. *(Note: F-03 / F-04 AC ranges will be reconciled with S1-10 contracts in S1-15).*

---

## 1. Functional Requirements Traceability Matrix

| FR ID | Functional Requirement Summary | Business Rules | Feature ID | Feature Name | Target Sprint | Acceptance Criteria (AC IDs) | Test IDs & Verification Evidence | Implementation Status |
|---|---|---|---|---|---|---|---|---|
| **FR-AUTH-01** | User authentication with username and password | BR-06 | F-01 | User Authentication & Session Management | Sprint 1 | AC-AUTH-01, AC-AUTH-02, AC-AUTH-03 | *T-AUTH-API-01, T-AUTH-UI-01, T-AUTH-E2E-01 (planned)* | In Progress (S1-05) |
| **FR-AUTH-02** | User session logout and destruction | — | F-01 | User Authentication & Session Management | Sprint 1 | AC-AUTH-04 | *T-AUTH-API-02, T-AUTH-UI-01, T-AUTH-E2E-02 (planned)* | In Progress (S1-05) |
| **FR-AUTH-03** | Retrieve current user profile (`/api/auth/me`) | — | F-01 | User Authentication & Session Management | Sprint 1 | AC-AUTH-05 | *T-AUTH-API-03 (planned)* | In Progress (S1-05) |
| **FR-AUTH-04** | Continuous session check on enabled status | BR-06 | F-01 | User Authentication & Session Management | Sprint 1 | AC-AUTH-06 | *T-AUTH-API-04, T-AUTH-UNIT-01, T-AUTH-UI-01 (planned)* | In Progress (S1-06) |
| **FR-AUTH-05** | Session expiration 24 hr after login (`loginAt` + `rolling: false`) | — | F-01 | User Authentication & Session Management | Sprint 1 | AC-AUTH-07 | *T-AUTH-UNIT-01, T-AUTH-UNIT-02, T-AUTH-API-03 (planned)* | In Progress (S1-05/06) |
| **FR-AUTH-06** | Credential protection & bcrypt password hashing | — | F-01, F-14 | User Authentication / Security Settings | Sprint 1 / 3 | AC-AUTH-08, AC-PROF-01..03 (planned) | `harness.api.test.ts › S1-01 harness › resetDb seeds the demo users with hashed passwords` (seed part); *T-AUTH-UNIT-03, T-AUTH-SEC-01, T-PROF-API-01..02 (planned)* | In Progress (S1-05) |
| **FR-AUTH-07** | Self-service password modification [Added by Team] | BR-06 | F-14 | User Profile & Security Settings [Added by Team] | Sprint 3 | *AC-PROF-01..03 (planned)* | *T-PROF-API-01..02 (planned)* | Planned (Sprint 3) |
| **FR-ADM-01** | Admin listing of all users (no financial data) | BR-05 | F-02 | Administrator User Management | Sprint 1 | AC-ADM-01, AC-ADM-02 | *T-ADM-API-01, T-ADM-UI-01, T-ADM-E2E-01 (planned)* | In Progress (S1-07) |
| **FR-ADM-02** | Admin toggle of user active/disabled status | BR-06, BR-07 | F-02 | Administrator User Management | Sprint 1 | AC-ADM-03 | *T-ADM-API-02, T-ADM-UI-01, T-ADM-E2E-02 (planned)* | In Progress (S1-07) |
| **FR-ADM-03** | Prevent administrator self-disablement | BR-07 | F-02 | Administrator User Management | Sprint 1 | AC-ADM-04 | *T-ADM-API-03, T-ADM-UNIT-01, T-ADM-UI-01 (planned)* | In Progress (S1-07) |
| **FR-ADM-04** | Financial boundary barrier for admin role | BR-05 | F-02 | Administrator User Management | Sprint 1 | AC-ADM-05 | `requireRole.unit.test.ts › requireRole › returns 403 FORBIDDEN for a different role` (middleware part); *T-ADM-API-04, T-ACC-API-03 (planned)* | In Progress (S1-06) |
| **FR-ACC-01** | User retrieval of own accounts and balances | BR-04 | F-03 | Account Setup & Opening Balances | Sprint 1 | AC-ACC-01 | *T-ACC-API-01, T-ACC-UNIT-01 (planned)* | In Progress (S1-11) |
| **FR-ACC-02** | Account types (CASH, LOAN_TAKEN/GIVEN, INC/EXP) | — | F-03, F-06, F-08 | Account Setup / Debt Lifecycle | Sprint 1 / 2 | AC-ACC-02, AC-ACC-07..09 (planned), AC-DEBT-01..04 (planned) | `schema.db.test.ts › S1-02 schema: accounts (BR-12)` (DB subtype checks); *T-ACC-API-04..05, T-DEBT-API-01..03 (planned)* | In Progress (S1-02/11) |
| **FR-ACC-03** | Unique account name per user namespace | — | F-03, F-06 | Account Setup & Opening Balances | Sprint 1 / 2 | AC-ACC-03, AC-ACC-07..09 (planned) | `schema.db.test.ts › S1-02 schema: ownership (BR-04) › rejects a second account with the same name for the same user`; *T-ACC-API-04..05 (planned)* | Completed (S1-02 DB) |
| **FR-ACC-04** | Opening balance and date setup on CASH/LOAN | BR-03, BR-04, BR-12 | F-03, F-06 | Account Setup / Custom Accounts | Sprint 1 / 2 | AC-ACC-04, AC-ACC-05, AC-ACC-07..09 (planned) | `schema.db.test.ts › S1-02 schema: accounts (BR-12)` (DB part); *T-ACC-API-02, T-ACC-UNIT-02 (planned)* | In Progress (S1-11) |
| **FR-ACC-05** | Exclude opening balances from income/expense | BR-08 | F-03, F-05 | Account Setup & Opening Balances | Sprint 1 | AC-ACC-06 | *T-SUM-UNIT-01, T-SUM-API-01 (planned)* | In Progress (S1-13) |
| **FR-ACC-06** | Custom account creation & edit (no type change with txns) | BR-03, BR-04, BR-12 | F-06 | Custom Account & Category Management | Sprint 2 | *AC-ACC-07..09 (planned)* | *T-ACC-API-04..05 (planned)* | Planned (Sprint 2) |
| **FR-TX-01** | Payment transaction recording (CASH/LOAN_TAKEN) | BR-01, BR-02, BR-03, BR-04, BR-09, BR-10, BR-11, BR-13 | F-04, F-08, F-12 | Transaction Recording / Debt / Corrections | Sprint 1 / 2 / 3 | AC-TX-01..03, AC-DEBT-01..04 (planned), AC-VOID-01..03 (planned) | *T-TX-UNIT-01, T-TX-API-01, T-DEBT-API-01..03, T-VOID-API-01..02 (planned)* | In Progress (S1-12) |
| **FR-TX-02** | Receive transaction recording (CASH source) | BR-01, BR-02, BR-03, BR-04, BR-09, BR-10, BR-11, BR-13 | F-04, F-08, F-12 | Transaction Recording / Debt / Corrections | Sprint 1 / 2 / 3 | AC-TX-04..05, AC-DEBT-01..04 (planned), AC-VOID-01..03 (planned) | *T-TX-UNIT-02, T-TX-API-02, T-DEBT-API-01..03, T-VOID-API-01..02 (planned)* | In Progress (S1-12) |
| **FR-TX-03** | Internal account transfer recording (CASH to CASH) | BR-01, BR-02, BR-03, BR-04, BR-08, BR-09, BR-10, BR-11, BR-13 | F-07 | Internal Account Transfers | Sprint 2 | *AC-TX-10..11 (planned)* | *T-TX-API-07..08 (planned)* | Planned (Sprint 2) |
| **FR-TX-04** | Multi-line split allocation per transaction | BR-01, BR-02 | F-04 | Transaction Recording & Split Allocations | Sprint 1 | AC-TX-07 | *T-TX-UNIT-04, T-TX-API-04 (planned)* | In Progress (S1-12) |
| **FR-TX-05** | Atomic persistence via database transaction | BR-13 | F-04, F-12 | Transaction Recording / Corrections | Sprint 1 / 3 | AC-TX-08, AC-VOID-01..03 (planned) | *T-TX-API-05, T-TX-DB-01, T-VOID-API-01..02 (planned)* | In Progress (S1-12) |
| **FR-TX-06** | Composite ownership validation on accounts | BR-04 | F-04 | Transaction Recording & Split Allocations | Sprint 1 | AC-TX-09 | `schema.db.test.ts › S1-02 schema: ownership (BR-04)` (DB composite FKs); *T-TX-API-06 (planned)* | In Progress (S1-12) |
| **FR-TX-07** | Favorite transactions toggle and viewing (`?favorite=true`) | BR-04 | F-10 | Favorite & Duplicate Transactions | Sprint 2 | *AC-FAV-01..03 (planned)* | *T-FAV-API-01..02 (planned)* | Planned (Sprint 2) |
| **FR-TX-08** | Transaction duplication helper | BR-04 | F-10 | Favorite & Duplicate Transactions | Sprint 2 | *AC-FAV-01..03 (planned)* | *T-FAV-UI-01 (planned)* | Planned (Sprint 2) |
| **FR-TX-09** | Debt and loan lifecycle tracking | BR-01, BR-02, BR-03, BR-04, BR-08, BR-09, BR-10, BR-12, BR-13 | F-08 | Debt & Receivable Lifecycle (Lending & Borrowing) | Sprint 2 | *AC-DEBT-01..04 (planned)* | *T-DEBT-API-01..03 (planned)* | Planned (Sprint 2) |
| **FR-TX-10** | Transaction modification and voiding | BR-01, BR-02, BR-04, BR-11, BR-13 | F-12 | Transaction Editing, Voiding & Audit Corrections | Sprint 3 | *AC-VOID-01..03 (planned)* | *T-VOID-API-01..02 (planned)* | Planned (Sprint 3) |
| **FR-SUM-01** | Dynamic balance computation from ledger effects | BR-03, BR-04, BR-08 | F-05, F-08 | Financial Summary / Debt Lifecycle | Sprint 1 / 2 | AC-SUM-01, AC-DEBT-01..04 (planned) | *T-SUM-UNIT-02, T-SUM-API-02, T-DEBT-API-01..03 (planned)* | In Progress (S1-13) |
| **FR-SUM-02** | Consolidated summary API (`GET /api/summary`) | BR-04, BR-05, BR-08 | F-05 | Financial Summary & Transaction History | Sprint 1 | AC-SUM-02, AC-SUM-03 | *T-SUM-API-03, T-SUM-E2E-01 (planned)* | In Progress (S1-13) |
| **FR-SUM-03** | Exclusion of non-income/expense movements | BR-08 | F-05, F-07 | Financial Summary & Transfers | Sprint 1 / 2 | AC-SUM-04, AC-TX-10..11 (planned) | *T-SUM-UNIT-03, T-SUM-API-04, T-TX-API-07..08 (planned)* | In Progress (S1-13) |
| **FR-SUM-04** | Periodic financial reports & summaries (charts [Added by Team]) | BR-03, BR-04, BR-08 | F-11 | Financial Reports & Periodic Spending Summaries | Sprint 3 | *AC-REP-01..04 (planned)* | *T-REP-API-01..02, T-REP-UI-01 (planned)* | Planned (Sprint 3) |
| **FR-HST-01** | Transaction history feed (newest first) | BR-04 | F-05 | Financial Summary & Transaction History | Sprint 1 | AC-HST-01 | *T-HST-API-01, T-HST-UI-01 (planned)* | In Progress (S1-13) |
| **FR-HST-02** | Transaction detail retrieval by ID | BR-04 | F-05 | Financial Summary & Transaction History | Sprint 1 | AC-HST-02 | *T-HST-API-02 (planned)* | In Progress (S1-13) |
| **FR-HST-03** | Transaction search and date filtering | BR-04 | F-09 | Transaction Search, Filtering & Sorting | Sprint 2 | *AC-HST-03..05 (planned)* | *T-HST-API-03, T-HST-UI-02 (planned)* | Planned (Sprint 2) |
| **FR-HST-04** | Data export in CSV and JSON formats [Added by Team] | BR-03, BR-04 | F-13 | Data Export (CSV & JSON) [Added by Team] | Sprint 3 | *AC-EXP-01..03 (planned)* | *T-EXP-API-01..02 (planned)* | Planned (Sprint 3) |
| **FR-SYS-01** | Standardized error envelope `{ error: ... }` | — | Platform | System Infrastructure & Error Handler | Sprint 1 | AC-SYS-01 | `errors.unit.test.ts › errorHandler › turns an AppError into its status and the shared error shape`, `apiClient.test.ts › api() › throws ApiError with the server's status, code, message and details` | Completed (S1-01) |
| **FR-SYS-02** | System health probe endpoint (`/api/health`) | — | Platform | System Infrastructure & Health | Sprint 1 | AC-SYS-02 | `harness.api.test.ts › S1-01 harness › GET /api/health responds without a session` | Completed (S1-01) |

---

## 2. Whole-Product Feature Traceability Matrix (F-01 through F-14)

| Feature ID | Feature Name | Target Sprint | Track Owner | Mapped Functional Requirements (FRs) | Mapped Business Rules (BRs) | Acceptance Criteria (AC IDs) | Verification Test IDs | Implementation Status |
|---|---|---|---|---|---|---|---|---|
| **F-01** | User Authentication & Session Management | **Sprint 1** | Track A | FR-AUTH-01, FR-AUTH-02, FR-AUTH-03, FR-AUTH-04, FR-AUTH-05, FR-AUTH-06 | BR-06 | AC-AUTH-01 .. AC-AUTH-08 | *T-AUTH-UNIT-01..03, T-AUTH-API-01..04, T-AUTH-SEC-01, T-AUTH-UI-01, T-AUTH-E2E-01..02 (planned)* | In Progress (S1-04..08) |
| **F-02** | Administrator User Management | **Sprint 1** | Track A | FR-ADM-01, FR-ADM-02, FR-ADM-03, FR-ADM-04 | BR-05, BR-06, BR-07 | AC-ADM-01 .. AC-ADM-05 | *T-ADM-UNIT-01, T-ADM-API-01..04, T-ADM-UI-01, T-ADM-E2E-01..02 (planned)* | In Progress (S1-04, S1-07, S1-08) |
| **F-03** | Account Setup & Opening Balances | **Sprint 1** | Track B | FR-ACC-01, FR-ACC-02, FR-ACC-03, FR-ACC-04, FR-ACC-05 | BR-03, BR-04, BR-08, BR-12 | AC-ACC-01 .. AC-ACC-06 | `schema.db.test.ts › S1-02 schema: accounts (BR-12)` (DB part); *T-ACC-API-01..02, T-ACC-UNIT-01..02 (planned)* | In Progress (S1-10, S1-11, S1-14) |
| **F-04** | Transaction Recording & Split Allocations | **Sprint 1** | Track B | FR-TX-01, FR-TX-02, FR-TX-04, FR-TX-05, FR-TX-06 | BR-01, BR-02, BR-03, BR-04, BR-09, BR-10, BR-11, BR-13 | AC-TX-01 .. AC-TX-09 | `schema.db.test.ts › S1-02 schema: amounts (BR-02)` (DB part); *T-TX-UNIT-01..04, T-TX-API-01..06 (planned)* | In Progress (S1-10, S1-12, S1-14) |
| **F-05** | Financial Summary & Transaction History | **Sprint 1** | Track B | FR-SUM-01, FR-SUM-02, FR-SUM-03, FR-HST-01, FR-HST-02 | BR-03, BR-04, BR-05, BR-08 | AC-SUM-01..04, AC-HST-01..02 | *T-SUM-UNIT-01..03, T-SUM-API-01..04, T-SUM-E2E-01, T-HST-API-01..02, T-HST-UI-01 (planned)* | In Progress (S1-10, S1-13, S1-14) |
| **F-06** | Custom Account & Category Management | **Sprint 2** | Decided at sprint planning | FR-ACC-02, FR-ACC-03, FR-ACC-06 | BR-03, BR-04, BR-12 | *AC-ACC-07..09 (planned)* | *T-ACC-API-04..05 (planned)* | Planned (Sprint 2) |
| **F-07** | Internal Account Transfers | **Sprint 2** | Decided at sprint planning | FR-TX-03, FR-SUM-03 | BR-01, BR-02, BR-03, BR-04, BR-08, BR-09, BR-10, BR-11, BR-13 | *AC-TX-10..11 (planned)* | *T-TX-API-07..08 (planned)* | Planned (Sprint 2) |
| **F-08** | Debt & Receivable Lifecycle (Lending & Borrowing) | **Sprint 2** | Decided at sprint planning | FR-TX-09, FR-ACC-02, FR-TX-01, FR-TX-02, FR-SUM-01 | BR-01, BR-02, BR-03, BR-04, BR-08, BR-09, BR-10, BR-12, BR-13 | *AC-DEBT-01..04 (planned)* | *T-DEBT-API-01..03 (planned)* | Planned (Sprint 2) |
| **F-09** | Transaction Search, Filtering & Sorting | **Sprint 2** | Decided at sprint planning | FR-HST-03 | BR-04 | *AC-HST-03..05 (planned)* | *T-HST-API-03, T-HST-UI-02 (planned)* | Planned (Sprint 2) |
| **F-10** | Favorite & Duplicate Transactions | **Sprint 2** | Decided at sprint planning | FR-TX-07, FR-TX-08 | BR-04 | *AC-FAV-01..03 (planned)* | *T-FAV-API-01..02, T-FAV-UI-01 (planned)* | Planned (Sprint 2) |
| **F-11** | Financial Reports & Periodic Spending Summaries | **Sprint 3** | Decided at sprint planning | FR-SUM-04 | BR-03, BR-04, BR-08 | *AC-REP-01..04 (planned)* | *T-REP-API-01..02, T-REP-UI-01 (planned)* | Planned (Sprint 3) |
| **F-12** | Transaction Editing, Voiding & Audit Corrections | **Sprint 3** | Decided at sprint planning | FR-TX-10, FR-TX-01, FR-TX-02, FR-TX-05 | BR-01, BR-02, BR-04, BR-11, BR-13 | *AC-VOID-01..03 (planned)* | *T-VOID-API-01..02 (planned)* | Planned (Sprint 3) |
| **F-13** | Data Export (CSV & JSON) [Added by Team] | **Sprint 3** | Decided at sprint planning | FR-HST-04 | BR-03, BR-04 | *AC-EXP-01..03 (planned)* | *T-EXP-API-01..02 (planned)* | Planned (Sprint 3) |
| **F-14** | User Profile & Security Settings [Added by Team] | **Sprint 3** | Decided at sprint planning | FR-AUTH-07, FR-AUTH-06 | BR-06 | *AC-PROF-01..03 (planned)* | *T-PROF-API-01..02 (planned)* | Planned (Sprint 3) |

---

## 3. Business Rules (BR) Traceability Matrix

| BR ID | Business Rule Description | Enforcing FRs | Feature ID | Target Sprint | Primary Enforcing Layer | Verification Evidence / Test IDs |
|---|---|---|---|---|---|---|
| **BR-01** | Allocation lines must sum exactly to total amount | FR-TX-01, FR-TX-02, FR-TX-03, FR-TX-04, FR-TX-09, FR-TX-10 | F-04, F-07, F-08, F-12 | Sprint 1 / 2 / 3 | Service layer (`ledger.ts`) returning `ALLOCATION_MISMATCH` 400 | *T-TX-UNIT-01, T-TX-API-04 (planned)* |
| **BR-02** | Total amount and all line amounts must be > 0 | FR-TX-01, FR-TX-02, FR-TX-03, FR-TX-04, FR-TX-09, FR-TX-10 | F-04, F-07, F-08, F-12 | Sprint 1 / 2 / 3 | DB check constraints `Transaction_totalAmount_positive`, `TransactionLine_amount_positive` & Zod validation | `schema.db.test.ts › S1-02 schema: amounts (BR-02)` (DB part); *T-TX-UNIT-01 (planned)* |
| **BR-03** | Money stored and transmitted as integer satang (THB) | FR-ACC-04, FR-TX-01, FR-TX-02, FR-TX-03, FR-TX-09, FR-SUM-01, FR-SUM-04, FR-HST-04 | F-03, F-04, F-05, F-06, F-07, F-08, F-11, F-13 | Sprint 1 / 2 / 3 | Prisma `Int` schema, Zod schema integer checks, client `toSatang()` | *T-SYS-UNIT-02, T-TX-API-01 (planned)* |
| **BR-04** | User can access only own records (cross-user = 404) | FR-ACC-01, FR-ACC-04, FR-ACC-06, FR-TX-01, FR-TX-02, FR-TX-03, FR-TX-06, FR-TX-07, FR-TX-08, FR-TX-09, FR-TX-10, FR-SUM-01, FR-SUM-02, FR-SUM-04, FR-HST-01, FR-HST-02, FR-HST-03, FR-HST-04 | F-03, F-04, F-05, F-06, F-07, F-08, F-09, F-10, F-11, F-12, F-13 | Sprint 1 / 2 / 3 | DB composite FKs `(id, userId)` & `assertOwned` throwing 404 | `ownership.unit.test.ts › assertOwned (BR-04)`, `schema.db.test.ts › S1-02 schema: ownership (BR-04)` (DB part); *T-ACC-API-01, T-TX-API-06 (planned)* |
| **BR-05** | Administrator cannot access any financial data (403) | FR-ADM-01, FR-ADM-04, FR-SUM-02 | F-02, F-05 | Sprint 1 | Route middleware `requireRole('USER')` throwing 403 on financial routes | `requireRole.unit.test.ts › requireRole › returns 403 FORBIDDEN for a different role`, `RequireRole.test.tsx › route guards (RequireRole) › sends an ADMIN away from a USER page to the admin home` (guard part); *T-ADM-API-04 (planned)* |
| **BR-06** | Disabled user blocked at login (403) & on next request (401) | FR-AUTH-01, FR-AUTH-04, FR-AUTH-07, FR-ADM-02 | F-01, F-02, F-14 | Sprint 1 / 3 | Auth login query check & `requireUser` per-request DB `isEnabled` check | *T-AUTH-API-04, T-ADM-E2E-02 (planned)* |
| **BR-07** | Administrator cannot disable own account (400) | FR-ADM-02, FR-ADM-03 | F-02 | Sprint 1 | Admin route validation returning `SELF_DISABLE_NOT_ALLOWED` 400 | *T-ADM-API-03, T-ADM-UNIT-01 (planned)* |
| **BR-08** | Non-income/expense movements excluded from totals | FR-ACC-04, FR-ACC-05, FR-TX-03, FR-TX-09, FR-SUM-01, FR-SUM-02, FR-SUM-03, FR-SUM-04 | F-03, F-04, F-05, F-07, F-08, F-11 | Sprint 1 / 2 / 3 | Ledger summary calculation filter (`ledger.ts`) | *T-SUM-UNIT-01, T-SUM-API-04 (planned)* |
| **BR-09** | Payment source: CASH/LOAN_TAKEN; Receive source: CASH | FR-TX-01, FR-TX-02, FR-TX-03, FR-TX-09 | F-04, F-07, F-08 | Sprint 1 / 2 | Service layer validation (`ledger.ts`) returning `INVALID_ACCOUNT_TYPE` 400 | *T-TX-UNIT-01, T-TX-API-01 (planned)* |
| **BR-10** | Allowed line types per Payment / Receive kind | FR-TX-01, FR-TX-02, FR-TX-03, FR-TX-09 | F-04, F-07, F-08 | Sprint 1 / 2 | Service layer validation (`ledger.ts`) returning `INVALID_ACCOUNT_TYPE` 400 | *T-TX-UNIT-01, T-TX-API-02 (planned)* |
| **BR-11** | Source account cannot appear as an allocation line | FR-TX-01, FR-TX-02, FR-TX-03, FR-TX-10 | F-04, F-07, F-12 | Sprint 1 / 2 / 3 | Service layer validation (`ledger.ts`) returning `VALIDATION_ERROR` 400 | *T-TX-UNIT-01, T-TX-API-01 (planned)* |
| **BR-12** | Opening balances allowed only on CASH, LOAN_TAKEN/GIVEN | FR-ACC-04, FR-ACC-06, FR-TX-09 | F-03, F-06, F-08 | Sprint 1 / 2 | DB check `Account_openingBalance_allowed_type` & service check returning `INVALID_ACCOUNT_TYPE` 400 | `schema.db.test.ts › S1-02 schema: accounts (BR-12)` (DB check constraints); *T-ACC-API-02 (planned)* |
| **BR-13** | Transaction saved all-or-nothing (atomic rollback) | FR-TX-01, FR-TX-02, FR-TX-03, FR-TX-05, FR-TX-09, FR-TX-10 | F-04, F-07, F-08, F-12 | Sprint 1 / 2 / 3 | `prisma.$transaction` wrapping transaction header and lines | *T-TX-API-05, T-TX-DB-01 (planned)* |

---

## 4. Theme 7 Brief Item Compliance Matrix

### 4.1 Theme 7 Brief Item Compliance Matrix
This matrix traces every requirement (including Sprint 1 core scope and "Later sprints" scope) and explicit boundary defined in the official **Theme 7 (Personal Money and Expense Logging)** course brief:

| Brief Ref | Topic / Requirement Area | In / Out of Scope | Mapped Specification | Target Sprint / Exclusion Justification | Verification Evidence / Test IDs |
|---|---|---|---|---|---|
| **T7-AUTH** | User accounts & credential-based authentication | In Scope | FR-AUTH-01 .. FR-AUTH-06, F-01 | Sprint 1 | `harness.api.test.ts › S1-01 harness › resetDb seeds the demo users with hashed passwords` (seed part); *T-AUTH-API-01..04 (planned)* |
| **T7-ISOL** | Private multi-user platform (financial isolation) | In Scope | FR-ADM-04, BR-04, BR-05, DL-04..06 | Sprint 1 | `ownership.unit.test.ts › assertOwned (BR-04)`, `schema.db.test.ts › S1-02 schema: ownership (BR-04)` (DB part); *T-ACC-API-01 (planned)* |
| **T7-ROLES** | Role-based access (User vs Admin separation) | In Scope | FR-ADM-01 .. FR-ADM-04, F-02 | Sprint 1 | `requireRole.unit.test.ts › requireRole › returns 403 FORBIDDEN for a different role`, `RequireRole.test.tsx › route guards (RequireRole) › sends an ADMIN away from a USER page to the admin home` (guard part); *T-ADM-API-01..04 (planned)* |
| **T7-ACCTS** | Accounts & categories (Cash, Card, Debt, Inc/Exp) | In Scope | FR-ACC-01 .. FR-ACC-03, FR-ACC-06, F-03, F-06 | Sprint 1 / 2 | `schema.db.test.ts › S1-02 schema: accounts (BR-12)` (DB subtype checks); *T-ACC-API-01..05 (planned)* |
| **T7-OPEN** | Opening balances with opening dates on CASH/LOAN | In Scope | FR-ACC-04, FR-ACC-05, BR-08, BR-12, F-03 | Sprint 1 | `schema.db.test.ts › S1-02 schema: accounts (BR-12)` (DB check constraints); *T-ACC-API-02 (planned)* |
| **T7-DATE** | Transaction dates recorded on every entry | In Scope | FR-TX-01, FR-TX-02, BR-03, F-04 | Sprint 1 | `schema.db.test.ts › S1-02 schema: valid data › stores a transaction with its allocation line` (DB column); *T-TX-API-01 (planned)* |
| **T7-LOG** | Transaction logging (Payment and Receive) | In Scope | FR-TX-01, FR-TX-02, BR-01, BR-02, BR-09..13, F-04 | Sprint 1 | *T-TX-UNIT-01..02, T-TX-API-01..02 (planned)* |
| **T7-SPLIT** | Split allocations: lines sum exactly to total amount | In Scope | FR-TX-04, BR-01, BR-02, F-04 | Sprint 1 | *T-TX-UNIT-04, T-TX-API-04 (planned)* |
| **T7-DEBT** | Outstanding loans and credit card debt tracking | In Scope | FR-ACC-02, FR-TX-01, FR-SUM-02, F-03..05 (Sprint 1 credit card debt); FR-TX-09, FR-SUM-01, F-08 (Sprint 2 loans given/taken) | Sprint 1 (Card debt) / Sprint 2 (Loans) | *T-SUM-API-03 (Sprint 1 planned); T-DEBT-API-01..03 (Sprint 2 planned)* |
| **T7-BAL** | Real-time dynamic balances & category summaries | In Scope | FR-SUM-01 .. FR-SUM-03, BR-03, BR-08, F-05 | Sprint 1 | *T-SUM-UNIT-01..03, T-SUM-API-01..04 (planned)* |
| **T7-HIST** | Transaction history feed and detail view | In Scope | FR-HST-01, FR-HST-02, F-05 | Sprint 1 | *T-HST-API-01..02, T-HST-UI-01 (planned)* |
| **T7-XFER** | Internal account transfers between liquid accounts *(Later sprints)* | In Scope | FR-TX-03, FR-SUM-03, BR-08..11, F-07 | Sprint 2 | *T-TX-API-07..08 (planned)* |
| **T7-DUP** | Duplicate transaction helper *(Later sprints)* | In Scope | FR-TX-08, F-10 | Sprint 2 | *T-FAV-UI-01 (planned)* |
| **T7-FAV** | Mark and view favorite transactions (`?favorite=true`) *(Later sprints)* | In Scope | FR-TX-07, F-10 | Sprint 2 | *T-FAV-API-01..02 (planned)* |
| **T7-FILT** | Filter and search transactions (dates, accounts, keywords) *(Later sprints)* | In Scope | FR-HST-03, F-09 | Sprint 2 | *T-HST-API-03, T-HST-UI-02 (planned)* |
| **T7-CORR** | Transaction corrections: editing and voiding/deleting *(Later sprints)* | In Scope | FR-TX-10, BR-01, BR-02, BR-04, BR-11, BR-13, F-12 | Sprint 3 | *T-VOID-API-01..02 (planned)* |
| **T7-REPT** | Reports and periodic category spending summaries *(Later sprints)* | In Scope | FR-SUM-04, BR-03, BR-04, BR-08, F-11 | Sprint 3 | *T-REP-API-01..02 (planned)* |
| **T7-EXCL-1**| Envelope / period budgets & shared budgets | **Out of Scope** | SRS §2.2 Exclusion 1 | Excluded: Focus is on single-user personal logging | N/A (Excluded by scope) |
| **T7-EXCL-2**| Automated recurring transactions / cron auto-billing | **Out of Scope** | SRS §2.2 Exclusion 2 | Excluded: Manual logging model guarantees auditability | N/A (Excluded by scope) |
| **T7-EXCL-3**| Direct bank integration & Open Banking API sync | **Out of Scope** | SRS §2.2 Exclusion 3 | Excluded: Self-contained deployment, zero external secrets | N/A (Excluded by scope) |

### 4.2 Team-Added Capabilities & Scope Decisions
The table below documents deliberate team additions and architectural scope boundaries:

| Addition Ref | Topic / Scope Area | Classification | Mapped Specification | Target Sprint / Decision Justification | Verification Evidence / Test IDs |
|---|---|---|---|---|---|
| **T7-TEAM-01** | Data export in CSV and JSON formats | **Team Addition** | FR-HST-04, F-13 | Sprint 3 (DL-09: Data portability) | *T-EXP-API-01..02 (planned)* |
| **T7-TEAM-02** | Self-service password change (`POST /api/auth/change-password`) | **Team Addition** | FR-AUTH-07, F-14 | Sprint 3 (DL-09: Credential rotation) | *T-PROF-API-01..02 (planned)* |
| **T7-TEAM-03** | Visual spending charts (`MonthlyBarChart`, `CategoryPieChart`) in F-11 | **Team Addition** | FR-SUM-04, F-11 | Sprint 3 (DL-09: Visual charts supplementing brief reports) | *T-REP-UI-01 (planned)* |
| **T7-TEAM-04** | Receipt photo uploads dropped from stack | **Scope Boundary** | SRS §2.2 Exclusion 4 | Excluded (DL-08: Multer removed to shrink attack surface) | N/A (Excluded by scope) |
| **T7-TEAM-05** | Multi-currency conversions (THB satang only) | **Scope Boundary** | SRS §2.2 Exclusion 5 | Excluded: Single-currency integer satang eliminates FX drift | N/A (Excluded by scope) |

---

## 5. Non-Functional Requirements (NFR) Traceability Matrix

| NFR ID | Requirement Summary | Target Measurable Metric | Architecture / Implementation Mechanism | Verification Evidence / Test IDs |
|---|---|---|---|---|
| **NFR-SEC-01** | Password Security | Work factor >= 10, no plaintext passwords in DB or API | `bcryptjs` hashing in `seedData.ts` and `auth.routes.ts` | `harness.api.test.ts › S1-01 harness › resetDb seeds the demo users with hashed passwords` (seed part); *T-AUTH-UNIT-03, T-AUTH-SEC-01 (planned)* |
| **NFR-SEC-02** | Session Security | HTTP-only, SameSite=Lax, 24-hr absolute expiration (`loginAt` + `rolling: false`) | `express-session` with `connect-pg-simple` (`session.ts`) & `requireUser` (`auth.ts`) | *T-AUTH-UNIT-01, T-AUTH-UNIT-02, T-AUTH-API-01, T-AUTH-API-03 (planned)* |
| **NFR-SEC-03** | Anti-Enumeration & Tenant Isolation | Cross-user query returns 404, never 403 or data | `assertOwned` + composite FKs `(id, userId)` | `ownership.unit.test.ts › assertOwned (BR-04)`, `schema.db.test.ts › S1-02 schema: ownership (BR-04)` (DB part); *T-ACC-API-01 (planned)* |
| **NFR-SEC-04** | Role-Based Access Enforcement | Wrong role returns 403 on all protected routes | Middleware `requireRole('USER' \| 'ADMIN')` | `requireRole.unit.test.ts › requireRole › returns 403 FORBIDDEN for a different role`, `RequireRole.test.tsx › route guards (RequireRole) › sends an ADMIN away from a USER page to the admin home` (guard part); *T-ADM-API-04 (planned)* |
| **NFR-PERF-01** | API Response Latency | p95 < 200ms read, < 250ms write, < 500ms auth | Express async handlers, efficient Prisma queries | *T-PERF-BENCH-01 (planned)* |
| **NFR-PERF-02** | Database Query Performance | Query execution < 50ms up to 100k records | Indexes on `(userId, name)`, `(userId, date)`, `transactionId`, `accountId` | *T-DB-INDEX-01 (planned)* |
| **NFR-REL-01** | Data Persistence Across Restarts | 100% data surviving container/service restarts | PostgreSQL volume mount in `docker-compose.yml` | *T-REL-E2E-01 (planned)* |
| **NFR-REL-02** | Transactional Atomicity | 0 partial writes on transaction save | `prisma.$transaction` rollback on error | *T-TX-API-05, T-TX-DB-01 (planned)* |
| **NFR-REL-03** | Satang Accuracy (No Float Drift) | 0 satang calculation error across operations | Integer satang in DB (`Int`) and API payloads | *T-SYS-UNIT-02, T-TX-API-01 (planned)* |
| **NFR-COMP-01** | Browser Compatibility | Chrome, Firefox, Edge full functionality (CI targets Chromium/Firefox) | Standards-compliant React 18, Vite ES2022 bundle | *T-E2E-BROWSER-01 (planned)* |
| **NFR-COMP-02** | Viewport Responsiveness | 360px width to 1920x1080px layout support | Bootstrap 5 grid, responsive containers | *T-E2E-RESPONSIVE-01 (planned)* |
| **NFR-COMP-03** | Localized Currency Presentation | Amounts in THB (e.g. 1,500.00 THB), converted to/from integer satang | `client/src/lib/money.ts` (`toSatang`, `formatBaht`) | *T-SYS-UNIT-02, T-UI-MONEY-01 (planned)* |
| **NFR-MAINT-01** | Code Quality & Static Typing | 0 TypeScript errors, 0 ESLint errors, 0 Prettier errors | TypeScript strict mode, CI lint & format checks | `npm run lint`, `npm run format:check` |
| **NFR-MAINT-02** | Automated Test Coverage | 100% CI pass rate, BR-01..BR-13 verified by automated tests | Vitest server & client suites, Playwright E2E suite | `npm test`, *`npm run test:e2e` (planned)* |
